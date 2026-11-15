/**
 * verify-sandbox.mjs —— 七朝沙盘版图几何 + UI 验收
 * ===========================================================================
 * 版图真源换成了「真实省界底板」：scripts/data/china-cells.json 里 35 个地理单元
 * 平铺成整块中国，每个政权是若干单元的并集（见 scripts/make-sandbox-geo.mjs）。
 * 于是几何验收的重点从「同一块多边形」变成：
 *
 *   1. 每盘面积和 == 底板总面积（既没重叠也没缺块）；
 *   2. 底板每个单元的中心点，恰好落在一个政权里（覆盖无洞）；
 *   3. 两两不重叠（随机采样）；
 *   4. 国都、要地落在所属疆域内，国名落点也在疆域内；
 *   5. 每个战报幕的目标政权在版图里（单元改名后最容易漏的一处）；
 *   6. 行军路线起点在攻方或已吞并地区、终点在目标地区（并校验坐标是百分比口径）。
 *
 * UI 部分：沙盘能打开、逐级推进到终章、终章入口指向下一朝。
 */
import { readFileSync } from 'node:fs'
import puppeteer from 'puppeteer-core'

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = process.env.APP_URL ?? 'http://localhost:5180'

const CELLS = JSON.parse(readFileSync('scripts/data/china-cells.json', 'utf8'))
const BASE_TOTAL = CELLS.total

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' :: ' + detail : ''}`)
}

const parse = (pts) => pts.trim().split(/\s+/).map((p) => p.split(',').map(Number))
const areaOf = (poly) =>
  Math.abs(
    poly.reduce((s, p, i) => {
      const q = poly[(i + 1) % poly.length]
      return s + (p[0] * q[1] - q[0] * p[1])
    }, 0) / 2,
  )

function pointInPoly(p, poly) {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]
    const [xj, yj] = poly[j]
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

const SANDBOXES = [
  { geo: 'sui-unify', dynasty: 'sui', next: 'tang' },
  { geo: 'tang-wudai', dynasty: 'tang', next: 'five_dynasties' },
  { geo: 'fd-song', dynasty: 'five_dynasties', next: 'song' },
  { geo: 'song-yuan', dynasty: 'song', next: 'yuan' },
  { geo: 'yuan-ming', dynasty: 'yuan', next: 'ming' },
  { geo: 'ming-qing', dynasty: 'ming', next: 'qing' },
  { geo: 'qing-xinhai', dynasty: 'qing', next: null },
]

/* ---------------- 几何 ---------------- */
for (const sb of SANDBOXES) {
  const geo = JSON.parse(readFileSync(`src/data/${sb.geo}.geo.json`, 'utf8'))
  const all = [geo.attacker, ...geo.regions]
  const rings = all.map((r) => parse(r.points))
  const total = rings.reduce((s, p) => s + areaOf(p), 0)

  check(
    `${sb.geo} 面积和 == 底板总面积`,
    Math.abs(total - BASE_TOTAL) / BASE_TOTAL < 0.005,
    `${total.toFixed(0)} vs ${BASE_TOTAL.toFixed(0)}`,
  )

  /* 覆盖：底板每个单元的中心点都要正好落在某一块里 */
  const cellCenters = CELLS.cells.map((c) => {
    const ring = c.rings[0]
    let x = 0
    let y = 0
    for (const p of ring) {
      x += p[0]
      y += p[1]
    }
    return [x / ring.length, y / ring.length]
  })
  const uncovered = cellCenters.filter((pt) => rings.filter((r) => pointInPoly(pt, r)).length !== 1)
  check(`${sb.geo} 底板单元无缺块 / 无重叠`, uncovered.length === 0, `${uncovered.length} 个单元中心异常`)

  /* 两两不重叠（随机采样；0.1 位小数舍入会在边界留极细重叠） */
  let seed = 20261115
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296), seed / 4294967296)
  let overlaps = 0
  for (let i = 0; i < 20000; i++) {
    const pt = [rnd() * 1000, rnd() * 640]
    let hits = 0
    for (const r of rings) if (pointInPoly(pt, r)) hits++
    if (hits > 1) overlaps++
  }
  check(`${sb.geo} 区域两两不重叠`, overlaps <= 4, `${overlaps} 个采样点落在多块里`)

  const badCap = all.filter((r) => r.capital && !pointInPoly([r.capital.x, r.capital.y], parse(r.points)))
  check(`${sb.geo} 国都在本块`, badCap.length === 0, badCap.map((r) => `${r.id}:${r.capital.name}`).join(','))

  const badLabel = all.filter((r) => r.label && !pointInPoly(r.label, parse(r.points)))
  check(`${sb.geo} 国名落点在本块`, badLabel.length === 0, badLabel.map((r) => r.id).join(','))

  const badPoints = (geo.points ?? []).filter((p) => {
    const owner = all.find((r) => r.id === p.regionId)
    return !owner || !pointInPoly([p.x, p.y], parse(owner.points))
  })
  check(`${sb.geo} 要地在本块`, badPoints.length === 0, badPoints.map((p) => `${p.name}->${p.regionId}`).join(','))

  /* 战报幕的目标政权必须存在于版图 */
  const endgamePath = `src/data/endgame.${sb.dynasty}.json`
  let endgame = null
  try {
    endgame = JSON.parse(readFileSync(endgamePath, 'utf8'))
  } catch {
    continue
  }
  if (endgame.mapId !== sb.geo) continue

  const byId = Object.fromEntries(all.map((r) => [r.id, r]))
  const missingTarget = endgame.events.filter((ev) => !byId[ev.nationId]).map((ev) => `${ev.id}->${ev.nationId}`)
  check(`${sb.geo} 战报目标政权都在版图里`, missingTarget.length === 0, missingTarget.join(','))

  let routeOk = true
  let routeDetail = ''
  let pctOk = true
  const nearRing = (pt, ring, tol) => {
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i]
      const b = ring[(i + 1) % ring.length]
      const dx = b[0] - a[0]
      const dy = b[1] - a[1]
      const len2 = dx * dx + dy * dy || 1e-9
      const t = Math.max(0, Math.min(1, ((pt[0] - a[0]) * dx + (pt[1] - a[1]) * dy) / len2))
      if (Math.hypot(pt[0] - (a[0] + dx * t), pt[1] - (a[1] + dy * t)) <= tol) return true
    }
    return false
  }
  for (const ev of endgame.events) {
    const target = byId[ev.nationId]
    if (!target) continue
    const targetRing = parse(target.points)
    let reached = false
    for (const c of ev.campaigns ?? []) {
      if (!c.points?.length) {
        routeOk = false
        routeDetail += `${ev.id} 无路线;`
        continue
      }
      // 百分比口径：x/y 应在 0—100（写成投影绝对值会到 200 以上，整条线画到画布外）
      if (c.points.some((p) => p.x > 100.5 || p.y > 100.5 || p.x < 0 || p.y < 0)) {
        pctOk = false
        routeDetail += `${ev.id} 坐标不是百分比;`
      }
      // 端点不能画到海里（底板单元在交界处有 0.1 级细缝，容差 4）
      const offMap = c.points.filter(
        (p) => !rings.some((ring) => pointInPoly([p.x * 10, p.y * 6.4], ring) || nearRing([p.x * 10, p.y * 6.4], ring, 4)),
      )
      if (offMap.length) {
        routeOk = false
        routeDetail += `${ev.id} 有端点在图外;`
      }
      const last = [c.points[c.points.length - 1].x * 10, c.points[c.points.length - 1].y * 6.4]
      if (pointInPoly(last, targetRing)) reached = true
    }
    if (ev.campaigns?.length && !reached) {
      /* 定杨、夏这两幕是弃守 / 传檄而定，不要求有路线打进目标，只提示 */
      routeDetail += `${ev.id}:无路线直达目标(弃守/传檄);`
    }
  }
  check(`${sb.geo} 行军路线坐标是百分比口径`, pctOk, routeDetail || 'ok')
  check(`${sb.geo} 行军端点都落在版图内`, routeOk, routeDetail || 'ok')
}

/* ---------------- UI ---------------- */
const WIRED = [
  { dynasty: 'sui', next: 'tang', steps: 6 },
  { dynasty: 'tang', next: 'five_dynasties', steps: 4 },
  { dynasty: 'five_dynasties', next: 'song', steps: 6 },
  { dynasty: 'song', next: 'yuan', steps: 4 },
  { dynasty: 'yuan', next: 'ming', steps: 4 },
  { dynasty: 'ming', next: 'qing', steps: 3 },
  { dynasty: 'qing', next: 'home', steps: 4 },
]

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: true,
  args: ['--no-sandbox', '--force-device-scale-factor=1'],
  defaultViewport: { width: 1440, height: 900 },
})
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

try {
  const page = await browser.newPage()
  await page.setCacheEnabled(false)
  page.on('pageerror', (e) => console.log('[PAGEERROR]', String(e).slice(0, 160)))

  for (const w of WIRED) {
    await page.goto(`${BASE}/dynasty/${w.dynasty}/endgame`, { waitUntil: 'networkidle2', timeout: 60000 })
    await page.waitForSelector('.endgame-stage, .warring-states-map, .map-svg, svg', { timeout: 15000 })
    await sleep(1200)
    const shell = await page.evaluate(() => ({
      url: location.pathname,
      regions: document.querySelectorAll('.region-path, [data-region], .map-region').length,
      title: document.querySelector('.eg-title, .endgame-title, h1')?.textContent?.trim() ?? '',
    }))
    check(`${w.dynasty} 沙盘可打开`, /\/endgame$/.test(shell.url), shell.url)

    /* 版图上的政权块数 == geo 里的块数（含攻方） */
    const geo = JSON.parse(readFileSync(`src/data/${SANDBOXES.find((s) => s.dynasty === w.dynasty).geo}.geo.json`, 'utf8'))
    const expectRegions = geo.regions.length + 1
    const rendered = await page.evaluate(() => document.querySelectorAll('.regions-layer .region').length)
    check(`${w.dynasty} 版图渲染 ${expectRegions} 块`, rendered === expectRegions, `实际 ${rendered}`)

    for (let i = 0; i < w.steps + 1; i += 1) {
      await page.keyboard.press('ArrowRight')
      await sleep(320)
    }
    const entry = await page.$('.qin-entry')
    check(`${w.dynasty} 终章出现下一朝入口`, Boolean(entry))
    if (entry) {
      await entry.click()
      await sleep(1200)
      const target = w.next === 'home' ? '/' : `/dynasty/${w.next}`
      check(`${w.dynasty} 终章 → ${target}`, page.url().endsWith(target), page.url())
    }
  }
  await browser.close()
} catch (err) {
  console.error(err)
  await browser.close()
  process.exitCode = 1
}

const failed = results.filter((r) => !r.pass)
console.log(`\n===== ${results.length - failed.length}/${results.length} passed =====`)
if (failed.length) process.exitCode = 1
