/**
 * build-china-base.mjs —— 由真实省界 GeoJSON 生成「地理底板」
 * ===========================================================================
 * 为什么换掉 Voronoi：七盘沙盘原来用「大陆轮廓 + 种子点 Voronoi」剖分，
 * 边界是等距垂线，既不像山河，也和史实疆域无关（用户口径：「无意义模块」）。
 *
 * 现在改为：真实中国省界做底板 → 每个政权 = 若干省（或省内切分）的并集。
 * 好处：轮廓是真中国、边界是真山河省界、疆域可按史料指定；
 * 面积守恒与不重叠由「同一套省界共用边」天然保证，脚本里再校验一次。
 *
 * 输出：scripts/data/china-cells.json（随仓库提交，七盘沙盘生成器与几何验收都读它）
 *   { viewBox, cells: [{ id, name, rings: [[[x,y],...],...] }], total }
 *
 * 用法：node scripts/build-china-base.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import polygonClipping from 'polygon-clipping'

/* -------------------------------------------------------------------------- */
/* 投影：等距圆柱 + 中纬压缩，装进 1000×640                                    */
/* -------------------------------------------------------------------------- */
const MIN_LON = 73.4
const MAX_LON = 135.2
const MIN_LAT = 17.9 // 海南岛南端；南海诸岛不画
const MAX_LAT = 53.7
const LAT_REF = 36 // 中纬（cos 压缩）
const KX = Math.cos((LAT_REF * Math.PI) / 180)

const W = 1000
const H = 640
const PAD = 26

const spanX = (MAX_LON - MIN_LON) * KX
const spanY = MAX_LAT - MIN_LAT
const scale = Math.min((W - PAD * 2) / spanX, (H - PAD * 2) / spanY)
const offX = (W - spanX * scale) / 2
const offY = (H - spanY * scale) / 2

export function project(lon, lat) {
  return [offX + (lon - MIN_LON) * KX * scale, offY + (MAX_LAT - lat) * scale]
}

/* -------------------------------------------------------------------------- */
/* Douglas–Peucker 简化（经纬度空间做，容差约 0.06°）                          */
/* -------------------------------------------------------------------------- */
function simplify(pts, tol) {
  if (pts.length < 4) return pts
  const keep = new Uint8Array(pts.length)
  keep[0] = 1
  keep[pts.length - 1] = 1
  const stack = [[0, pts.length - 1]]
  while (stack.length) {
    const [a, b] = stack.pop()
    let maxD = -1
    let idx = -1
    const [ax, ay] = pts[a]
    const [bx, by] = pts[b]
    const dx = bx - ax
    const dy = by - ay
    const len2 = dx * dx + dy * dy || 1e-12
    for (let i = a + 1; i < b; i++) {
      const [px, py] = pts[i]
      const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2))
      const d = Math.hypot(px - (ax + dx * t), py - (ay + dy * t))
      if (d > maxD) {
        maxD = d
        idx = i
      }
    }
    if (maxD > tol) {
      keep[idx] = 1
      stack.push([a, idx], [idx, b])
    }
  }
  return pts.filter((_, i) => keep[i])
}

const area = (ring) => {
  let a = 0
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i]
    const q = ring[(i + 1) % ring.length]
    a += p[0] * q[1] - q[0] * p[1]
  }
  return Math.abs(a / 2)
}

/* -------------------------------------------------------------------------- */
/* 读省界                                                                      */
/* -------------------------------------------------------------------------- */
const RAW = JSON.parse(readFileSync('scripts/data/china-provinces-100000.json', 'utf8'))
/**
 * 图仅示其要：台湾、港澳、南海诸岛不画；
 * 海南是纯岛屿省，画进来会让所属政权变成「多块」，也一并略去。
 * 其余每省只取**主陆块**（最大环），零星岛屿丢弃。
 */
const EXCLUDE = new Set(['台湾省', '香港特别行政区', '澳门特别行政区', '100000_JD', '海南省'])

/** 省名 → 代码（cell id 用拼音缩写更稳，这里直接手写映射） */
const CODE = {
  北京市: 'beijing',
  天津市: 'tianjin',
  河北省: 'hebei',
  山西省: 'shanxi',
  内蒙古自治区: 'neimenggu',
  辽宁省: 'liaoning',
  吉林省: 'jilin',
  黑龙江省: 'heilongjiang',
  上海市: 'shanghai',
  江苏省: 'jiangsu',
  浙江省: 'zhejiang',
  安徽省: 'anhui',
  福建省: 'fujian',
  江西省: 'jiangxi',
  山东省: 'shandong',
  河南省: 'henan',
  湖北省: 'hubei',
  湖南省: 'hunan',
  广东省: 'guangdong',
  广西壮族自治区: 'guangxi',
  海南省: 'hainan',
  重庆市: 'chongqing',
  四川省: 'sichuan',
  贵州省: 'guizhou',
  云南省: 'yunnan',
  西藏自治区: 'xizang',
  陕西省: 'shaanxi',
  甘肃省: 'gansu',
  青海省: 'qinghai',
  宁夏回族自治区: 'ningxia',
  新疆维吾尔自治区: 'xinjiang',
}

/** 每省取「主陆块 + 较大岛屿」，丢掉零星小岛（示意图不需要）。60 ≈ 2700 km² */
const MIN_RING_AREA = 60

const provRings = {}
for (const f of RAW.features) {
  const name = f.properties.name
  if (EXCLUDE.has(name)) continue
  const code = CODE[name]
  if (!code) continue
  const g = f.geometry
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates
  let best = null
  let bestArea = -1
  for (const poly of polys) {
    for (const ring of poly) {
      // 简化在经纬度空间做，容差 0.05°
      const s = simplify(ring.map(([lon, lat]) => [lon, lat]), 0.05)
      if (s.length < 3) continue
      const proj = s.map(([lon, lat]) => project(lon, lat).map((v) => Math.round(v * 10) / 10))
      const a = area(proj)
      if (a < MIN_RING_AREA) continue
      if (a > bestArea) {
        bestArea = a
        best = proj
      }
    }
  }
  if (best) provRings[code] = { name, rings: [best] }
}

/* -------------------------------------------------------------------------- */
/* 省内切分（历史疆域里必须能分开的几处）                                      */
/* -------------------------------------------------------------------------- */
/**
 * 用一条直线（投影坐标下的 a→b）把省切成南北两半。
 * 注意 SVG 的 y 轴朝下：a→b 由西向东时，「南侧」= y 更大的一侧。
 */
function splitByHalfPlane(rings, a, b) {
  const [ax, ay] = a
  const [bx, by] = b
  const dx = bx - ax
  const dy = by - ay
  const FAR = 4000
  // 半平面「南侧」（y 较大的一侧）
  const semi = [
    [
      [ax, ay],
      [bx, by],
      [bx - dy * FAR, by + dx * FAR],
      [ax - dy * FAR, ay + dx * FAR],
    ],
  ]
  const src = rings.length === 1 ? [[rings[0]]] : [rings]
  const south = polygonClipping.intersection(src, semi)
  const north = polygonClipping.difference(src, semi)
  return { north, south }
}

/** polygonClipping 结果 → 简化后的 ring 列表（只取最大环，保证单元=单一多边形） */
function toRings(multi) {
  let best = null
  let bestArea = -1
  for (const poly of multi) {
    for (const ring of poly) {
      const r = ring.map((p) => [Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10])
      if (r.length < 3) continue
      const a = area(r)
      if (a < MIN_RING_AREA / 2) continue
      if (a > bestArea) {
        bestArea = a
        best = r
      }
    }
  }
  return best ? [best] : []
}

const cells = []
const pushCell = (id, name, rings) => {
  if (!rings.length) throw new Error(`空单元：${id}`)
  cells.push({ id, name, rings })
}

for (const code of Object.keys(provRings)) {
  const p = provRings[code]
  /* 陕西：秦岭南北分开（陕北+关中 / 陕南）。秦岭在投影 y 约 350（lat 34） */
  if (code === 'shaanxi') {
    const { north, south } = splitByHalfPlane(p.rings, [project(106.6, 34.0)[0], project(106.6, 34.0)[1]], [project(111.5, 33.95)[0], project(111.5, 33.95)[1]])
    pushCell('shaanxi_n', '关中·陕北', toRings(north))
    pushCell('shaanxi_s', '陕南（汉中）', toRings(south))
    continue
  }
  /* 山西：雁门以北（代北）/ 雁门以南（河东） */
  if (code === 'shanxi') {
    const lat = 39.1
    const { north, south } = splitByHalfPlane(p.rings, [project(110.5, lat)[0], project(110.5, lat)[1]], [project(114.0, lat)[0], project(114.0, lat)[1]])
    pushCell('shanxi_n', '代北', toRings(north))
    pushCell('shanxi_s', '河东', toRings(south))
    continue
  }
  /* 河北：燕山南北（幽燕 / 河北） */
  if (code === 'hebei') {
    const lat = 39.4
    const { north, south } = splitByHalfPlane(p.rings, [project(113.5, lat)[0], project(113.5, lat)[1]], [project(120.0, lat)[0], project(120.0, lat)[1]])
    pushCell('hebei_n', '河北北部', toRings(north))
    pushCell('hebei_s', '河北南部', toRings(south))
    continue
  }
  /* 江苏：淮河以北 / 以南（淮河在苏约北纬 33.0，取 33.05，淮安、清江浦在淮南） */
  if (code === 'jiangsu') {
    const lat = 33.05
    const { north, south } = splitByHalfPlane(p.rings, [project(116.0, lat)[0], project(116.0, lat)[1]], [project(121.5, lat)[0], project(121.5, lat)[1]])
    pushCell('jiangsu_n', '淮北（苏北）', toRings(north))
    pushCell('jiangsu_s', '淮南（苏南）', toRings(south))
    continue
  }
  /* 安徽：淮河以北 / 以南（淮河在皖约北纬 32.5；取 32.45，寿州才落在淮南） */
  if (code === 'anhui') {
    const lat = 32.45
    const { north, south } = splitByHalfPlane(p.rings, [project(114.8, lat)[0], project(114.8, lat)[1]], [project(119.7, lat)[0], project(119.7, lat)[1]])
    pushCell('anhui_n', '淮北（皖北）', toRings(north))
    pushCell('anhui_s', '淮南（皖南）', toRings(south))
    continue
  }
  pushCell(code, p.name, p.rings)
}

/* -------------------------------------------------------------------------- */
/* 自检：面积总和、两两不重叠                                                  */
/* -------------------------------------------------------------------------- */
const cellArea = (c) => c.rings.reduce((s, r) => s + area(r), 0)
const total = cells.reduce((s, c) => s + cellArea(c), 0)

let seed = 12345
const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296), seed / 4294967296)
const inside = (pt, ring) => {
  let c = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    if (yi > pt[1] !== yj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) c = !c
  }
  return c
}
const cellContains = (c, pt) => c.rings.some((r) => inside(pt, r))

let multi = 0
for (let i = 0; i < 60000; i++) {
  const pt = [rnd() * 1000, rnd() * 640]
  let hits = 0
  for (const c of cells) if (cellContains(c, pt)) hits++
  if (hits > 1) multi++
}

writeFileSync(
  'scripts/data/china-cells.json',
  JSON.stringify({ viewBox: `0 0 ${W} ${H}`, cells, total }, null, 0) + '\n',
  'utf8',
)

console.log(`单元 ${cells.length} 个，面积和 ${total.toFixed(0)}，重叠采样点 ${multi}`)
for (const c of cells) {
  console.log(`  ${c.id.padEnd(12)} ${c.name.padEnd(10)} rings=${c.rings.length} area=${cellArea(c).toFixed(0)}`)
}
