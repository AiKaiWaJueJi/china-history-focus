/**
 * verify-sandbox.mjs —— 七朝沙盘版图几何 + 已接入三盘的 UI 验收
 * ===========================================================================
 * 几何（离线，不需要浏览器）：
 *   1. 每盘面积和 == 433135（±2，四舍五入误差）；
 *   2. 每块顶点都落在大陆轮廓内（等价于「不重叠且不越界」）；
 *   3. 国都在本块内；行军路线起点在攻方境内、终点在目标境内。
 * UI（起 dev server 后）：
 *   4. /dynasty/<id>/endgame 能渲染地图与战报，战报可推进到终章；
 *   5. 终章按钮指向下一朝。
 */
import { readFileSync } from 'node:fs'
import puppeteer from 'puppeteer-core'

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = process.env.APP_URL ?? 'http://localhost:5180'

const OUTLINE = [
  [60, 130], [250, 80], [430, 60], [620, 62], [800, 70], [950, 90],
  [980, 230], [985, 380], [939.17, 455], [930, 470], [840, 545],
  [700, 600], [540, 622], [380, 610], [250, 560], [150, 470], [72, 340], [66.29, 240],
]

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' :: ' + detail : ''}`)
}

const parse = (pts) => pts.trim().split(/\s+/).map((p) => p.split(',').map(Number))
const areaOf = (poly) =>
  Math.abs(poly.reduce((s, p, i) => {
    const q = poly[(i + 1) % poly.length]
    return s + (p[0] * q[1] - q[0] * p[1])
  }, 0) / 2)

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
  const polys = all.map((r) => parse(r.points))
  const total = polys.reduce((s, p) => s + areaOf(p), 0)
  check(`${sb.geo} 面积守恒`, Math.abs(total - 433135) <= 2, total.toFixed(1))

  const onBoundary = (p, tol = 1.2) =>
    OUTLINE.some((a, i) => {
      const b = OUTLINE[(i + 1) % OUTLINE.length]
      const dx = b[0] - a[0]
      const dy = b[1] - a[1]
      const len = Math.hypot(dx, dy)
      const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (len * len)))
      const px = a[0] + dx * t
      const py = a[1] + dy * t
      return Math.hypot(p[0] - px, p[1] - py) <= tol
    })
  const outside = all.filter((r) => parse(r.points).some((p) => !pointInPoly(p, OUTLINE) && !onBoundary(p)))
  check(`${sb.geo} 各块不越界`, outside.length === 0, outside.map((r) => r.id).join(','))

  const badCap = all.filter((r) => r.capital && !pointInPoly([r.capital.x, r.capital.y], parse(r.points)))
  check(`${sb.geo} 国都在本块`, badCap.length === 0, badCap.map((r) => `${r.id}:${r.capital.name}`).join(','))

  // 路线端点：起点在攻方境内、终点在对应目标境内（只查已写战报的盘）
  const endgamePath = `src/data/endgame.${sb.dynasty}.json`
  let endgame = null
  try {
    endgame = JSON.parse(readFileSync(endgamePath, 'utf8'))
  } catch {
    continue
  }
  if (endgame.mapId !== sb.geo) continue
  let routeOk = true
  let routeDetail = ''
  for (const ev of endgame.events) {
    const target = all.find((r) => r.id === ev.nationId)
    if (!target) { routeOk = false; routeDetail += `${ev.id} 目标区缺失;`; continue }
    for (const c of ev.campaigns ?? []) {
      const from = c.points[0]
      const to = c.points[c.points.length - 1]
      if (!pointInPoly([from.x, from.y], polys[0])) { routeOk = false; routeDetail += `${ev.id} 起点不在攻方;` }
      if (!pointInPoly([to.x, to.y], parse(target.points))) { routeOk = false; routeDetail += `${ev.id} 终点不在目标;` }
    }
  }
  check(`${sb.geo} 行军起止落在各自境内`, routeOk, routeDetail || 'ok')
}

/* ---------------- UI（仅已接入的盘） ---------------- */
const WIRED = [
  { dynasty: 'sui', next: 'tang', steps: 5 },
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
