/**
 * check-sui-geo.mjs —— 南北朝收尾版图几何验收
 * ---------------------------------------------------------------------------
 * 与战国/楚汉/三国同一套算法：
 *   1. 四块面积之和 == 同一片大陆（说明既没重叠也没缺块）；
 *   2. 两两不重叠（随机采样点）；
 *   3. 国都与要地都落在所属区域内；
 *   4. 两条行军路线的起点在攻方境内、终点在目标境内（史实修正后的坐标）。
 */
import fs from 'node:fs'

const sui = JSON.parse(fs.readFileSync('src/data/sui.geo.json', 'utf8'))
const chuhan = JSON.parse(fs.readFileSync('src/data/chuhan.geo.json', 'utf8'))
const endgame = JSON.parse(fs.readFileSync('src/data/endgame.nanbei.json', 'utf8'))

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
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' :: ' + detail : ''}`)
}

const regions = [sui.attacker, ...sui.regions].map((r) => ({ ...r, pts: parse(r.points) }))
const byId = Object.fromEntries(regions.map((r) => [r.id, r]))

/* 1. 面积守恒 */
const baseline = chuhan.regions.reduce((s, r) => s + areaOf(parse(r.points)), 0)
const total = regions.reduce((s, r) => s + areaOf(r.pts), 0)
check(
  '四块面积之和 == 同一片大陆（无重叠、无缺块）',
  Math.abs(total - baseline) < baseline * 0.001,
  `${Math.round(total)} vs ${Math.round(baseline)}，差 ${Math.abs(total - baseline).toFixed(1)}`,
)

/* 2. 两两不重叠 */
let seed = 7
const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296), seed / 4294967296)
let overlaps = 0
const bounds = { x0: 40, x1: 1000, y0: 40, y1: 640 }
for (let i = 0; i < 40000; i++) {
  const pt = [bounds.x0 + rnd() * (bounds.x1 - bounds.x0), bounds.y0 + rnd() * (bounds.y1 - bounds.y0)]
  const hits = regions.filter((r) => inside(pt, r.pts)).length
  if (hits > 1) overlaps += 1
}
check('区域两两不重叠', overlaps === 0, `${overlaps} 个采样点落在多块里`)

/* 每一块都要有面积（没有空块） */
check(
  '四块都有实际面积',
  regions.every((r) => areaOf(r.pts) > 8000),
  regions.map((r) => `${r.name}:${Math.round(areaOf(r.pts))}`).join(' / '),
)

/* 3. 国都 / 要地在境内 */
const badCapitals = regions
  .filter((r) => r.capital && !inside([r.capital.x, r.capital.y], r.pts))
  .map((r) => `${r.name}·${r.capital.name}`)
check('国都在各自疆域内', badCapitals.length === 0, badCapitals.join(', '))

const badPoints = sui.points.filter((p) => {
  const region = byId[p.regionId]
  return !region || !inside([p.x, p.y], region.pts)
})
check(
  '要地 / 关隘在所属疆域内',
  badPoints.length === 0,
  badPoints.map((p) => `${p.name}->${p.regionId}`).join(', '),
)

/* 4. 行军路线：不能浮在海里 / 突厥境内
   · 起点：攻方境内，或已被吞并的北齐境内（577 之后从齐地出师是合理的）；
   · 终点：目标境内，或攻方境内（如杨素自永安下三峡至江陵，江陵是周的附庸）。
*/
const toView = (pt) => ({ x: pt.x * 10, y: (pt.y * 640) / 100 })
const chinese = ['beizhou', 'qi', 'chen'].map((id) => byId[id].pts)
const inAny = (pt, polys) => polys.some((pts) => inside(pt, pts))
const routeChecks = []
for (const event of endgame.events) {
  const target = byId[event.nationId]
  for (const campaign of event.campaigns ?? []) {
    const first = toView(campaign.points[0])
    const last = toView(campaign.points[campaign.points.length - 1])
    routeChecks.push({
      label: `${campaign.general} ${campaign.from}→${campaign.to}`,
      startOk: inAny([first.x, first.y], chinese),
      endOk: inAny([last.x, last.y], [byId[sui.attacker.id].pts, target?.pts].filter(Boolean)),
    })
  }
}
check(
  '行军起点落在中原三国境内（不在海里、不在突厥）',
  routeChecks.every((r) => r.startOk),
  routeChecks.filter((r) => !r.startOk).map((r) => r.label).join(' | '),
)
check(
  '行军终点落在目标或攻方境内',
  routeChecks.every((r) => r.endOk),
  routeChecks.filter((r) => !r.endOk).map((r) => r.label).join(' | '),
)

const failed = results.filter((r) => !r.pass)
console.log(`\n===== ${results.length - failed.length}/${results.length} passed =====`)
if (failed.length) process.exitCode = 1
