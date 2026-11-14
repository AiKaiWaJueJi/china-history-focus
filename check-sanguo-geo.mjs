/**
 * 三国沙盘的几何验收
 * ---------------------------------------------------------------------------
 * 与 check-chuhan-geo.mjs 同思路，但基准换成楚汉八块（同一片大陆）：
 *   1. 四块面积之和 == 楚汉八块面积之和（无空洞、无叠合）
 *   2. 两两不重叠（撒点）
 *   3. 国都在境内
 *   4. 行军路线首尾在对应疆域内（攻方起点须在当时已归魏的任一境内）
 *   5. 节点与疆域一一对应（辽东、蜀、吴三块）
 *   6. 存活区间自洽（aliveFrom <= aliveTo）
 */
import fs from 'node:fs'

const geo = JSON.parse(fs.readFileSync('src/data/sanguo.geo.json', 'utf8'))
const chuhan = JSON.parse(fs.readFileSync('src/data/chuhan.geo.json', 'utf8'))
const data = JSON.parse(fs.readFileSync('src/data/endgame.han.json', 'utf8'))

const parse = (s) => s.split(' ').map((p) => p.split(',').map(Number))
const areaOf = (pts) => {
  let a = 0
  for (let i = 0; i < pts.length; i++) {
    const [x0, y0] = pts[i]
    const [x1, y1] = pts[(i + 1) % pts.length]
    a += x0 * y1 - x1 * y0
  }
  return Math.abs(a) / 2
}
const inside = (pt, pts) => {
  let c = false
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i]
    const [xj, yj] = pts[j]
    if (yi > pt[1] !== yj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) c = !c
  }
  return c
}

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass, detail })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' :: ' + detail : ''}`)
}

const regions = geo.regions.map((r) => ({ ...r, pts: parse(r.points) }))
const byId = Object.fromEntries(regions.map((r) => [r.id, r]))

/* ---------- 1) 面积守恒 ---------- */
const baseline = chuhan.regions.reduce((s, r) => s + areaOf(parse(r.points)), 0)
const sunguoArea = regions.reduce((s, r) => s + areaOf(r.pts), 0)
const diff = Math.abs(baseline - sunguoArea)
check(
  '四块面积之和 == 楚汉八块（无空洞、无叠合）',
  diff < baseline * 0.001,
  `${Math.round(sunguoArea)} vs ${Math.round(baseline)}，差 ${diff.toFixed(1)}`,
)

/* ---------- 2) 两两不重叠 ---------- */
let seed = 11
const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296), seed / 4294967296)
let overlaps = 0
for (let i = 0; i < 8000; i++) {
  const pt = [60 + rnd() * 940, 55 + rnd() * 580]
  const hits = regions.filter((r) => inside(pt, r.pts))
  if (hits.length > 1) overlaps++
}
check('两两不重叠（8000 点采样）', overlaps === 0, `重叠点 ${overlaps}`)

/* ---------- 3) 国都在境内 ---------- */
const badCap = regions.filter((r) => !inside([r.capital.x, r.capital.y], r.pts))
check(
  '每块国都都在自己疆域内',
  badCap.length === 0,
  badCap.length ? badCap.map((r) => r.name).join(',') : `${regions.length}/${regions.length}`,
)

/* ---------- 4) 行军路线端点 ---------- */
const attackerId = geo.attacker
const capturedBefore = (order) => [
  attackerId,
  ...data.events.filter((e) => e.order < order).map((e) => e.nationId),
]
const badRoute = []
for (const e of data.events) {
  const target = byId[e.nationId]
  if (!target) {
    badRoute.push(`${e.target}: 没有对应疆域`)
    continue
  }
  const home = capturedBefore(e.order)
    .map((id) => byId[id])
    .filter(Boolean)
  let prevPoint = null
  for (const c of e.campaigns ?? []) {
    if (!c.points?.length) continue
    const toXY = (p) => [p.x * 10, p.y * 6.4]
    const first = toXY(c.points[0])
    const last = toXY(c.points[c.points.length - 1])
    const chainFrom = prevPoint
    const near = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]) < 6
    if (c.side === 'enemy') {
      if (!inside(first, target.pts)) badRoute.push(`${e.target}·${c.general} 起点不在 ${target.name} 境内`)
    } else if (!home.some((r) => inside(first, r.pts)) && !(chainFrom && near(first, chainFrom))) {
      badRoute.push(`${e.target}·${c.general} 起点不在当时已归魏的疆域内`)
    }
    prevPoint = toXY(c.points[c.points.length - 1])
    if (!inside(last, target.pts)) badRoute.push(`${e.target}·${c.general} 终点不在 ${target.name} 境内`)
    for (const mid of c.points.slice(1, -1)) {
      const m = toXY(mid)
      if (!regions.some((r) => inside(m, r.pts))) badRoute.push(`${e.target}·${c.general} 中途点落在版图外`)
    }
  }
}
check('行军路线首尾都在对应疆域内', badRoute.length === 0, badRoute.slice(0, 3).join(' / ') || '全部通过')

/* ---------- 5) 节点与疆域 ---------- */
check(
  '每个节点都有对应疆域',
  data.events.every((e) => Boolean(byId[e.nationId])),
  `${data.events.length} 个节点`,
)
check(
  '没有多余疆域（除攻方魏之外）',
  regions.filter((r) => r.id !== attackerId).length === data.events.length,
  `${regions.length - 1} 块 vs ${data.events.length} 幕`,
)

/* ---------- 6) 存活区间 ---------- */
const badAlive = regions.filter(
  (r) => r.aliveFrom !== undefined && r.aliveTo !== undefined && r.aliveFrom > r.aliveTo,
)
check('存活区间自洽', badAlive.length === 0, badAlive.map((r) => r.name).join(',') || 'ok')

/* ---------- 7) 要地/关隘方位 ---------- */
const badPoints = (geo.points ?? []).filter((p) => !byId[p.regionId] || !inside([p.x, p.y], byId[p.regionId].pts))
check(
  '要地/关隘都在所属疆域内',
  badPoints.length === 0,
  badPoints.length ? badPoints.map((p) => p.name).join(',') : `${(geo.points ?? []).length} 处`,
)

/* ---------- 7) 三国登场顺序 ---------- */
check(
  '蜀、吴、辽东的存续年份符合史实（蜀221 / 吴229 / 辽东—238）',
  byId.shu?.aliveFrom === 221 && byId.wu?.aliveFrom === 229 && byId.liaodong?.aliveTo === 238,
  JSON.stringify({
    shu: byId.shu?.aliveFrom,
    wu: byId.wu?.aliveFrom,
    liaodong: byId.liaodong?.aliveTo,
  }),
)

const failed = results.filter((r) => !r.pass)
console.log(`\n===== ${results.length - failed.length}/${results.length} passed =====`)
if (failed.length) process.exitCode = 1
