/**
 * check-geo.mjs —— 版图几何校验（第三轮起四盘古地图也用真实省界底板）
 * ===========================================================================
 * 校验项（对每一盘）：
 *   1. 面积和 == 底板总面积（既没重叠也没缺块）；
 *   2. 底板每个地理单元的中心点，恰好落在一个政权里（覆盖无洞）；
 *   3. 两两不重叠（随机采样，允许 0.1 位小数舍入造成的极细重叠）；
 *   4. 国都 / 要地 / 国名落点都在所属疆域内；
 *   5. 战报幕的目标政权都存在；行军路线是百分比口径且端点不落到海里。
 *
 * 用法：import { checkGeo } from './lib/check-geo.mjs'
 *       checkGeo('战国', 'zhanguo.geo.json', 'endgame.zhou.json')
 */
import { readFileSync } from 'node:fs'

const parse = (s) => s.trim().split(/\s+/).map((p) => p.split(',').map(Number))
const areaOf = (poly) =>
  Math.abs(
    poly.reduce((s, p, i) => {
      const q = poly[(i + 1) % poly.length]
      return s + (p[0] * q[1] - q[0] * p[1])
    }, 0) / 2,
  )
const inside = (pt, ring) => {
  let c = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    if (yi > pt[1] !== yj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) c = !c
  }
  return c
}
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

export function checkGeo(label, geoFile, endgameFile) {
  const CELLS = JSON.parse(readFileSync('scripts/data/china-cells.json', 'utf8'))
  const geo = JSON.parse(readFileSync(`src/data/${geoFile}`, 'utf8'))
  const all = [geo.attacker, ...geo.regions]
  const rings = all.map((r) => parse(r.points))
  let pass = 0
  let fail = 0
  const check = (name, ok, detail = '') => {
    if (ok) pass += 1
    else fail += 1
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}·${name}${detail ? ' :: ' + detail : ''}`)
  }

  const total = rings.reduce((s, r) => s + areaOf(r), 0)
  check('面积和 == 底板总面积', Math.abs(total - CELLS.total) / CELLS.total < 0.005, `${total.toFixed(0)} vs ${CELLS.total.toFixed(0)}`)

  const centers = CELLS.cells.map((c) => {
    const ring = c.rings[0]
    let x = 0
    let y = 0
    for (const p of ring) {
      x += p[0]
      y += p[1]
    }
    return [x / ring.length, y / ring.length]
  })
  const badCells = centers.filter((pt) => rings.filter((r) => inside(pt, r)).length !== 1)
  check('底板单元无缺块 / 无重叠', badCells.length === 0, `${badCells.length} 个单元中心异常`)

  let seed = 20261115
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296), seed / 4294967296)
  let overlaps = 0
  for (let i = 0; i < 20000; i++) {
    const pt = [rnd() * 1000, rnd() * 640]
    if (rings.filter((r) => inside(pt, r)).length > 1) overlaps += 1
  }
  check('区域两两不重叠', overlaps <= 4, `${overlaps} 个采样点落在多块里`)

  const badCap = all.filter((r) => r.capital && !inside([r.capital.x, r.capital.y], parse(r.points)))
  check('国都在本块', badCap.length === 0, badCap.map((r) => `${r.id}:${r.capital.name}`).join(','))

  const badLabel = all.filter((r) => r.label && !inside(r.label, parse(r.points)))
  check('国名落点在本块', badLabel.length === 0, badLabel.map((r) => r.id).join(','))

  const badPoints = (geo.points ?? []).filter((p) => {
    const owner = all.find((r) => r.id === p.regionId)
    return !owner || !inside([p.x, p.y], parse(owner.points))
  })
  check('要地在本块', badPoints.length === 0, badPoints.map((p) => `${p.name}->${p.regionId}`).join(','))

  if (endgameFile) {
    const endgame = JSON.parse(readFileSync(`src/data/${endgameFile}`, 'utf8'))
    const byId = Object.fromEntries(all.map((r) => [r.id, r]))
    const missing = endgame.events.filter((ev) => !byId[ev.nationId]).map((ev) => `${ev.id}->${ev.nationId}`)
    check('战报目标政权都在版图里', missing.length === 0, missing.join(','))

    let pctOk = true
    let routeOk = true
    const detail = []
    for (const ev of endgame.events) {
      let reached = false
      for (const c of ev.campaigns ?? []) {
        if (!c.points?.length) {
          routeOk = false
          detail.push(`${ev.id} 无路线`)
          continue
        }
        if (c.points.some((p) => p.x > 100.5 || p.y > 100.5 || p.x < 0 || p.y < 0)) {
          pctOk = false
          detail.push(`${ev.id} 坐标越界`)
        }
        if (!c.points.every((p) => rings.some((r) => inside([p.x * 10, p.y * 6.4], r) || nearRing([p.x * 10, p.y * 6.4], r, 4)))) {
          routeOk = false
          detail.push(`${ev.id} 端点在图外`)
        }
        const last = c.points[c.points.length - 1]
        if (byId[ev.nationId] && inside([last.x * 10, last.y * 6.4], parse(byId[ev.nationId].points))) reached = true
      }
      if (ev.campaigns?.length && !reached) detail.push(`${ev.id} 无直达`)
    }
    check('行军路线坐标是百分比口径', pctOk, detail.join(';'))
    check('行军端点都落在版图内', routeOk, detail.join(';'))
  }

  return { pass, fail }
}
