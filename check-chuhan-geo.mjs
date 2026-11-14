/**
 * 楚汉沙盘的几何验收
 * ---------------------------------------------------------------------------
 * 不再用"网格无重叠"那种弱检查，改成三条能真正抓住问题的断言：
 *
 *   1. **面积守恒**：八块面积之和 == 战国图（秦 + 六国）面积之和。
 *      这条最狠——只要有任何一块被漏画（空洞）或画重（叠合），面积必然对不上。
 *   2. **两两不重叠**：在版图范围内撒点，任何一点不能同时落在两块里。
 *   3. **国都与路线端点**：国都必须落在自己境内；行军路线首尾必须落在出发国/目标国境内。
 */
import fs from 'node:fs'

const geo = JSON.parse(fs.readFileSync('src/data/chuhan.geo.json', 'utf8'))
const data = JSON.parse(fs.readFileSync('src/data/endgame.chuhan.json', 'utf8'))

/* 战国图（秦 + 六国）——面积守恒的基准 */
const ZHANGUO = [
  '350,430 560,400 580,470 320,520',
  '250,80 430,60 620,62 650,175 700,250 330,300 350,180',
  '330,300 700,250 760,420 560,400 350,430',
  '760,420 930,470 840,545 700,600 540,622 380,610 250,560 320,520 580,470 560,400',
  '620,62 800,70 950,90 980,230 790,205 650,175',
  '650,175 790,205 980,230 985,380 930,470 760,420 700,250',
  '60,130 250,80 350,180 330,300 350,430 320,520 250,560 150,470 72,340',
]

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
const zhanguoArea = ZHANGUO.reduce((s, p) => s + areaOf(parse(p)), 0)
const chuhanArea = regions.reduce((s, r) => s + areaOf(r.pts), 0)
const diff = Math.abs(zhanguoArea - chuhanArea)
check(
  '八块面积之和 == 战国全图（无空洞、无叠合）',
  diff < zhanguoArea * 0.001,
  `${Math.round(chuhanArea)} vs ${Math.round(zhanguoArea)}，差 ${diff.toFixed(1)}`,
)

/* ---------- 2) 两两不重叠 ---------- */
let seed = 7
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
const attacker = byId[geo.attacker]
const badRoute = []
for (const e of data.events) {
  const target = byId[e.nationId]
  if (!target) {
    badRoute.push(`${e.target}: 没有对应疆域`)
    continue
  }
  for (const c of e.campaigns ?? []) {
    if (!c.points?.length) continue
    const toXY = (p) => [p.x * 10, p.y * 6.4]
    const first = toXY(c.points[0])
    const last = toXY(c.points[c.points.length - 1])
    const firstOk = c.side === 'enemy' ? inside(first, target.pts) : inside(first, attacker.pts)
    if (!firstOk) badRoute.push(`${e.target}·${c.general} 起点不在出发国境内`)
    if (!inside(last, target.pts)) badRoute.push(`${e.target}·${c.general} 终点不在 ${target.name} 境内`)
  }
}
check('行军路线首尾都在对应疆域内', badRoute.length === 0, badRoute.slice(0, 3).join(' / ') || '全部通过')

/* ---------- 5) 节点与疆域一一对应 ---------- */
check('每个节点都有对应疆域', data.events.every((e) => Boolean(byId[e.nationId])), `${data.events.length} 个节点`)
check('没有多余的疆域（除汉之外）', regions.filter((r) => r.id !== geo.attacker).length === data.events.length,
  `${regions.length - 1} 块 vs ${data.events.length} 幕`)

const failed = results.filter((r) => !r.pass)
console.log(`\n===== ${results.length - failed.length}/${results.length} passed =====`)
if (failed.length) process.exitCode = 1
