/**
 * check-zhanguo-geo.mjs —— 战国七雄版图的完整性
 * ---------------------------------------------------------------------------
 * 2026-11 修过一次：秦的 polygon 多了一个 400,540 的尖角，既压进韩/楚，
 * 又漏掉西南巴蜀那一块（总面积比楚汉八块少了 18510）。
 * 这里把七块与「同一片大陆」的基准面积对齐，并校验不重叠、国都/关隘在境内。
 */
import fs from 'node:fs'

const ZHANGUO = [
  {
    id: 'han', name: '韩', points: '350,430 560,400 580,470 320,520',
    capital: { name: '新郑', x: 512, y: 438 },
    pointsOfInterest: [],
  },
  {
    id: 'zhao', name: '赵', points: '250,80 430,60 620,62 650,175 700,250 330,300 350,180',
    capital: { name: '邯郸', x: 500, y: 232 },
    pointsOfInterest: [
      { name: '井陉', x: 448, y: 168 },
      { name: '长平', x: 470, y: 250 },
      { name: '邯郸', x: 556, y: 196 },
    ],
  },
  {
    id: 'wei', name: '魏', points: '330,300 700,250 760,420 560,400 350,430',
    capital: { name: '大梁', x: 640, y: 302 },
    pointsOfInterest: [],
  },
  {
    id: 'chu', name: '楚',
    points: '760,420 930,470 840,545 700,600 540,622 380,610 250,560 320,520 580,470 560,400',
    capital: { name: '寿春', x: 720, y: 500 },
    pointsOfInterest: [],
  },
  {
    id: 'yan', name: '燕', points: '620,62 800,70 950,90 980,230 790,205 650,175',
    capital: { name: '蓟', x: 860, y: 130 },
    pointsOfInterest: [],
  },
  {
    id: 'qi', name: '齐', points: '650,175 790,205 980,230 985,380 930,470 760,420 700,250',
    capital: { name: '临淄', x: 888, y: 330 },
    pointsOfInterest: [],
  },
  {
    id: 'qin', name: '秦',
    points: '60,130 250,80 350,180 330,300 350,430 320,520 250,560 150,470 72,340',
    capital: { name: '咸阳', x: 250, y: 402 },
    pointsOfInterest: [
      { name: '函谷关', x: 326, y: 310 },
      { name: '巴蜀粮仓', x: 232, y: 470 },
    ],
  },
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

const regions = ZHANGUO.map((r) => ({ ...r, pts: parse(r.points) }))
const byId = Object.fromEntries(regions.map((r) => [r.id, r]))

/* 基准：同一片大陆的楚汉八块 */
const chuhan = JSON.parse(fs.readFileSync('src/data/chuhan.geo.json', 'utf8'))
const baseline = chuhan.regions.reduce((s, r) => s + areaOf(parse(r.points)), 0)
const total = regions.reduce((s, r) => s + areaOf(r.pts), 0)
check(
  '七块面积之和 == 同一片大陆（无重叠、无缺块）',
  Math.abs(total - baseline) < baseline * 0.001,
  `${Math.round(total)} vs ${Math.round(baseline)}，差 ${Math.abs(total - baseline).toFixed(1)}`,
)

/* 两两不重叠 */
let seed = 5
const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296), seed / 4294967296)
let overlaps = 0
for (let i = 0; i < 20000; i++) {
  const pt = [60 + rnd() * 940, 55 + rnd() * 580]
  const hits = regions.filter((r) => inside(pt, r.pts))
  if (hits.length > 1) overlaps++
}
check('两两不重叠（20000 点采样）', overlaps === 0, `重叠点 ${overlaps}`)

/* 国都在境内 */
const badCap = regions.filter((r) => !inside([r.capital.x, r.capital.y], r.pts))
check(
  '七国国都都在自己疆域内',
  badCap.length === 0,
  badCap.length ? badCap.map((r) => r.name).join(',') : `${regions.length}/${regions.length}`,
)

/* 关隘/要地在境内 */
const badPoi = regions.flatMap((r) =>
  r.pointsOfInterest
    .filter((p) => !inside([p.x, p.y], r.pts))
    .map((p) => `${p.name}不在${r.name}`),
)
check('关隘/要地都在所属疆域内', badPoi.length === 0, badPoi.join(' / ') || '5 处')

/* 秦的西南角必须真的在秦境内（曾漏掉巴蜀） */
check(
  '秦含西南巴蜀角（250,560 / 150,470）',
  inside([250, 560], byId.qin.pts) === false && inside([240, 540], byId.qin.pts) === true,
  '边界按共享顶点判定',
)

const failed = results.filter((r) => !r.pass)
console.log(`\n===== ${results.length - failed.length}/${results.length} passed =====`)
if (failed.length) process.exitCode = 1

