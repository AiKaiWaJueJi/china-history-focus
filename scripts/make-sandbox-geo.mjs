/**
 * 沙盘版图生成器 —— 同一块大陆轮廓 + 政权种子点做 Voronoi 裁切
 * ===========================================================================
 * 为什么这么干：七朝沙盘如果每张都手绘 polygon，工作量大、还容易裂缝/重叠。
 * 这里用「大陆轮廓（面积 433135，与战国/楚汉/三国/南北朝同源）+ 各政权种子点」
 * 做**平面剖分**：相邻两块共用同一条 bisector 端点，天然无缝、不重叠、面积守恒。
 *
 * 用法：node scripts/make-sandbox-geo.mjs [id...]
 * 输出：src/data/<id>.geo.json（attacker + regions + rivers + points）
 */
import { readFileSync, writeFileSync } from 'node:fs'

/** 大陆轮廓（与 sui.geo.json 的外圈一致，面积 433135） */
const OUTLINE = [
  [60, 130], [250, 80], [430, 60], [620, 62], [800, 70], [950, 90],
  [980, 230], [985, 380], [939.17, 455], [930, 470], [840, 545],
  [700, 600], [540, 622], [380, 610], [250, 560], [150, 470], [72, 340], [66.29, 240],
]

/** 每个沙盘：攻方 + 各区（seed 决定剖分位置，label/capital 决定标注） */
const SPECS = {
  'sui-unify': {
    dynastyId: 'sui',
    note: '隋亡之后群雄并立，唐自关中次第削平（618—624）。版图为示意剖分，仅示其要。',
    attacker: { id: 'tang', name: '唐', seed: [300, 300], label: [300, 318], capital: { name: '长安', x: 272, y: 332 } },
    regions: [
      { id: 'zheng', name: '郑', seed: [570, 330], label: [566, 330], capital: { name: '洛阳', x: 570, y: 330 } },
      { id: 'xia', name: '夏', seed: [700, 205], label: [700, 210], capital: { name: '洺州', x: 690, y: 214 } },
      { id: 'liang', name: '梁', seed: [560, 500], label: [560, 500], capital: { name: '江陵', x: 548, y: 486 } },
      { id: 'wu', name: '吴', seed: [840, 420], label: [836, 420], capital: { name: '丹阳', x: 840, y: 424 } },
      { id: 'dingyang', name: '定杨', seed: [430, 235], label: [436, 236], capital: { name: '马邑', x: 438, y: 238 } },
    ],
  },
  'tang-wudai': {
    dynastyId: 'tang',
    note: '唐亡之年，晋与梁争中原，燕、岐、蜀、吴各据一方（907—923）。版图为示意剖分。',
    attacker: { id: 'jin', name: '晋', seed: [420, 245], label: [430, 250], capital: { name: '太原', x: 432, y: 250 } },
    regions: [
      { id: 'houliang', name: '后梁', seed: [600, 330], label: [596, 336], capital: { name: '开封', x: 600, y: 330 } },
      { id: 'yan', name: '燕', seed: [800, 150], label: [796, 150], capital: { name: '幽州', x: 790, y: 152 } },
      { id: 'qi', name: '岐', seed: [250, 300], label: [258, 300], capital: { name: '凤翔', x: 262, y: 306 } },
      { id: 'qianshu', name: '前蜀', seed: [200, 440], label: [212, 444], capital: { name: '成都', x: 214, y: 444 } },
      { id: 'wu', name: '吴', seed: [850, 410], label: [846, 412], capital: { name: '扬州', x: 842, y: 416 } },
    ],
  },
  'fd-song': {
    dynastyId: 'five_dynasties',
    note: '后周世宗取淮南起，至宋灭北汉止（955—979）。版图为示意剖分，仅示其要。',
    attacker: { id: 'song', name: '宋（后周）', seed: [600, 320], label: [596, 326], capital: { name: '开封', x: 600, y: 320 } },
    regions: [
      { id: 'nantang', name: '南唐', seed: [820, 400], label: [812, 402], capital: { name: '金陵', x: 806, y: 408 } },
      { id: 'houshu', name: '后蜀', seed: [210, 440], label: [220, 444], capital: { name: '成都', x: 222, y: 446 } },
      { id: 'nanhan', name: '南汉', seed: [700, 560], label: [700, 560], capital: { name: '兴王府', x: 700, y: 562 } },
      { id: 'jingnan', name: '荆南', seed: [560, 470], label: [562, 474], capital: { name: '江陵', x: 560, y: 470 } },
      { id: 'beihan', name: '北汉', seed: [440, 265], label: [446, 266], capital: { name: '太原', x: 446, y: 266 } },
      { id: 'wuyue', name: '吴越', seed: [900, 470], label: [894, 470], capital: { name: '杭州', x: 890, y: 472 } },
    ],
  },
  'song-yuan': {
    dynastyId: 'song',
    note: '襄阳既破，元军顺江东下：临安出降、四川陷落、崖山蹈海（1273—1279）。版图为示意剖分。',
    attacker: { id: 'yuan', name: '元', seed: [480, 200], label: [486, 206], capital: { name: '大都', x: 640, y: 190 } },
    regions: [
      { id: 'sichuan', name: '四川', seed: [220, 430], label: [230, 434], capital: { name: '重庆', x: 240, y: 440 } },
      { id: 'jinghu', name: '荆湖', seed: [600, 460], label: [602, 462], capital: { name: '江陵', x: 596, y: 458 } },
      { id: 'linan', name: '临安', seed: [820, 410], label: [814, 412], capital: { name: '临安', x: 800, y: 420 } },
      { id: 'minguang', name: '闽广', seed: [700, 560], label: [704, 560], capital: { name: '广州', x: 700, y: 556 } },
      { id: 'dali', name: '大理', seed: [430, 580], label: [430, 580], capital: { name: '大理', x: 430, y: 574 }, neutral: true },
    ],
  },
  'yuan-ming': {
    dynastyId: 'yuan',
    note: '洪武元年前后北伐：山东—河南—大都—山西—陕西—甘肃（1368—1370）。版图为示意剖分。',
    attacker: { id: 'ming', name: '明', seed: [840, 440], label: [834, 444], capital: { name: '应天', x: 826, y: 444 } },
    regions: [
      { id: 'yuan', name: '元', seed: [520, 200], label: [524, 204], capital: { name: '大都', x: 640, y: 190 } },
      { id: 'xia', name: '夏', seed: [240, 450], label: [250, 452], capital: { name: '重庆', x: 258, y: 456 } },
      { id: 'liang', name: '梁王', seed: [470, 580], label: [474, 582], capital: { name: '中庆', x: 474, y: 580 } },
      { id: 'guanzhong', name: '关中', seed: [250, 310], label: [258, 314], capital: { name: '奉元', x: 262, y: 318 } },
    ],
  },
  'ming-qing': {
    dynastyId: 'ming',
    note: '甲申之年：大顺入京、清兵入关、南明立于金陵、大西据蜀（1644）。版图为示意剖分。',
    attacker: { id: 'qing', name: '清', seed: [730, 170], label: [736, 174], capital: { name: '盛京', x: 800, y: 150 } },
    regions: [
      { id: 'dashun', name: '大顺', seed: [430, 320], label: [432, 322], capital: { name: '西安', x: 300, y: 330 } },
      { id: 'nanming', name: '南明', seed: [830, 440], label: [826, 442], capital: { name: '南京', x: 824, y: 444 } },
      { id: 'daxi', name: '大西', seed: [230, 450], label: [240, 452], capital: { name: '成都', x: 242, y: 454 } },
    ],
  },
  'qing-xinhai': {
    dynastyId: 'qing',
    note: '武昌首义后各省独立，南北议和，清帝退位（1911—1912）。版图为示意剖分，仅示其要。',
    attacker: { id: 'geming', name: '革命军', seed: [780, 440], label: [774, 442], capital: { name: '武昌', x: 762, y: 446 } },
    regions: [
      { id: 'qingting', name: '清廷', seed: [620, 220], label: [624, 224], capital: { name: '北京', x: 622, y: 220 } },
      { id: 'beiyang', name: '北洋', seed: [560, 320], label: [566, 322], capital: { name: '彰德', x: 566, y: 324 } },
      { id: 'duli', name: '独立各省', seed: [520, 540], label: [524, 542], capital: { name: '广州', x: 528, y: 544 } },
      { id: 'chuandian', name: '川滇', seed: [240, 450], label: [250, 452], capital: { name: '成都', x: 252, y: 454 } },
    ],
  },
}

const fmt = (n) => Math.round(n * 100) / 100

/** 用一条垂直平分线裁多边形：保留靠近 seed 的一侧 */
function clipByBisector(poly, seed, other) {
  const nx = other[0] - seed[0]
  const ny = other[1] - seed[1]
  const mx = (seed[0] + other[0]) / 2
  const my = (seed[1] + other[1]) / 2
  // 保留 dot(p - mid, n) <= 0
  const inside = (p) => (p[0] - mx) * nx + (p[1] - my) * ny <= 1e-9
  const out = []
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]
    const b = poly[(i + 1) % poly.length]
    const ain = inside(a)
    const bin = inside(b)
    if (ain) out.push(a)
    if (ain !== bin) {
      const dx = b[0] - a[0]
      const dy = b[1] - a[1]
      const den = dx * nx + dy * ny
      if (Math.abs(den) > 1e-12) {
        const t = ((mx - a[0]) * nx + (my - a[1]) * ny) / den
        out.push([a[0] + dx * t, a[1] + dy * t])
      }
    }
  }
  return out
}

function area(poly) {
  let a = 0
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i]
    const q = poly[(i + 1) % poly.length]
    a += p[0] * q[1] - q[0] * p[1]
  }
  return Math.abs(a / 2)
}

function pointInPoly(p, poly) {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]
    const [xj, yj] = poly[j]
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

const wanted = process.argv.slice(2)
const todo = wanted.length ? wanted : Object.keys(SPECS)

for (const id of todo) {
  const spec = SPECS[id]
  if (!spec) {
    console.error(`未知沙盘：${id}`)
    process.exitCode = 1
    continue
  }
  const all = [{ ...spec.attacker, isAttacker: true }, ...spec.regions]
  const cells = []
  for (const region of all) {
    let poly = OUTLINE.map((p) => [...p])
    for (const other of all) {
      if (other === region) continue
      poly = clipByBisector(poly, region.seed, other.seed)
      if (poly.length < 3) break
    }
    const cleaned = []
    for (const p of poly) {
      const q = [fmt(p[0]), fmt(p[1])]
      const last = cleaned[cleaned.length - 1]
      if (!last || last[0] !== q[0] || last[1] !== q[1]) cleaned.push(q)
    }
    if (cleaned.length > 2 && cleaned[0][0] === cleaned[cleaned.length - 1][0] && cleaned[0][1] === cleaned[cleaned.length - 1][1]) {
      cleaned.pop()
    }
    cells.push({ region, points: cleaned, area: area(cleaned) })
  }

  const total = cells.reduce((s, c) => s + c.area, 0)
  const overlaps = cells.filter((c, i) => cells.some((d, j) => i < j && area([c.region.seed, d.region.seed, c.region.seed]) === 0 && false))
  void overlaps

  const attacker = cells.find((c) => c.region.isAttacker)
  const out = {
    dynastyId: spec.dynastyId,
    note: spec.note,
    attacker: {
      id: attacker.region.id,
      name: attacker.region.name,
      points: attacker.points.map((p) => p.join(',')).join(' '),
      label: attacker.region.capital ? [attacker.region.capital.x, attacker.region.capital.y - 26] : attacker.region.label,
      capital: attacker.region.capital,
    },
    regions: cells
      .filter((c) => !c.region.isAttacker)
      .map((c) => ({
        id: c.region.id,
        name: c.region.name,
        points: c.points.map((p) => p.join(',')).join(' '),
        label: c.region.capital ? [c.region.capital.x, c.region.capital.y - 26] : c.region.label,
        capital: c.region.capital,
        ...(c.region.neutral ? { neutral: true } : {}),
      })),
    rivers: [],
    points: [],
  }

  // 自检：国都落在本区、面积和守恒
  const problems = []
  for (const c of cells) {
    if (!pointInPoly([c.region.capital.x, c.region.capital.y], c.points)) {
      problems.push(`国都 ${c.region.capital.name} 不在 ${c.region.id} 内`)
    }
  }
  if (Math.abs(total - 433135) > 1) problems.push(`面积和 ${total.toFixed(0)} != 433135`)

  writeFileSync(`src/data/${id}.geo.json`, JSON.stringify(out, null, 2) + '\n', 'utf8')
  console.log(
    `${id}: ${cells.length} 块，面积和 ${total.toFixed(0)}` +
      (problems.length ? ` ⚠ ${problems.join('；')}` : ' ✓'),
  )
}
