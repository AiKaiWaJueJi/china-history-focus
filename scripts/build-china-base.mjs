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
  /*
    允许两种输入：省刚读进来时是「环数组」（[[x,y],…][]），
    一次切分之后拿到的是 polygonClipping 的 MultiPolygon（[[[x,y],…]][][]），
    多级切割（陕北→关中→陕南）会连着调，这里统一一下。
  */
  const isRingArray = typeof rings[0]?.[0]?.[0] === 'number'
  const src = isRingArray ? [[rings[0]]] : rings
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

/* 纬向切线：north = 线北，south = 线南 */
function cutLat(rings, lat, lonA = 96, lonB = 126) {
  return splitByHalfPlane(rings, project(lonA, lat), project(lonB, lat))
}

/** 经向切线（由北向南画线）：west = 线西，east = 线东 */
function cutLon(rings, lon, latA = 50, latB = 18) {
  const r = splitByHalfPlane(rings, project(lon, latA), project(lon, latB))
  // 由北向南画线时，半平面落在**西**侧（见 splitByHalfPlane 的构造），故 west = south
  return { west: r.south, east: r.north }
}

for (const code of Object.keys(provRings)) {
  const p = provRings[code]
  /*
    第三轮把四个省切细：战国/楚汉/三国的疆域按「河内、上党、大梁、南阳、晋阳、邯郸」
    这种古地理分界走，一省一刀已经不够。切法都取真实山河：
      陕西  北纬 35.6（陕北高原 / 关中）、33.95（秦岭）
      山西  39.1（雁门）、37.2（临汾盆地北缘）、东经 112.6（上党）
      河北  39.4（燕山）、37.7（滹沱河）
      河南  33.4（淮河上游 / 南阳盆地）、东经 113.15（洛阳以西）、115.0（宋卫）
  */
  if (code === 'shaanxi') {
    const t = cutLat(p.rings, 35.6)
    const m = cutLat(t.south, 33.95)
    pushCell('shaanxi_bei', '陕北（上郡）', toRings(t.north))
    pushCell('shaanxi_n', '关中', toRings(m.north))
    pushCell('shaanxi_s', '陕南（汉中）', toRings(m.south))
    continue
  }
  if (code === 'shanxi') {
    const t = cutLat(p.rings, 39.1)
    const u = cutLat(t.south, 37.2)
    const v = cutLon(u.south, 112.6)
    pushCell('shanxi_n', '代北', toRings(t.north))
    pushCell('shanxi_c', '晋中（太原）', toRings(u.north))
    pushCell('shanxi_s', '晋南（河东）', toRings(v.west))
    pushCell('shanxi_se', '晋东南（上党）', toRings(v.east))
    continue
  }
  if (code === 'hebei') {
    const t = cutLat(p.rings, 39.4)
    const u = cutLat(t.south, 37.7)
    pushCell('hebei_n', '燕北（幽州）', toRings(t.north))
    pushCell('hebei_c', '中山（真定·保定）', toRings(u.north))
    pushCell('hebei_s', '邯郸（邢洺）', toRings(u.south))
    continue
  }
  if (code === 'henan') {
    const t = cutLat(p.rings, 33.4)
    const u = cutLon(t.north, 113.85)
    const v = cutLon(u.east, 115.0)
    pushCell('henan_w', '河南西（洛阳）', toRings(u.west))
    pushCell('henan_c', '河南中（大梁）', toRings(v.west))
    pushCell('henan_e', '河南东（宋卫）', toRings(v.east))
    pushCell('henan_n', '河南南（南阳）', toRings(t.south))
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

/*
  单元组：老七盘与老四盘的一些政权是按「省」写的（cells: ['henan']），
  省已经被切细了，这里给出展开表——写作省名时自动展开成它的所有子单元。
  注意展开是**一层**的，子单元不再套娃。
*/
const GROUPS = {
  henan: ['henan_w', 'henan_c', 'henan_e', 'henan_n'],
  hebei: ['hebei_n', 'hebei_c', 'hebei_s'],
  hebei_south: ['hebei_c', 'hebei_s'],
  shanxi: ['shanxi_n', 'shanxi_c', 'shanxi_s', 'shanxi_se'],
  shanxi_south: ['shanxi_c', 'shanxi_s', 'shanxi_se'],
  shaanxi: ['shaanxi_bei', 'shaanxi_n', 'shaanxi_s'],
  shaanxi_north: ['shaanxi_bei', 'shaanxi_n'],
}

writeFileSync(
  'scripts/data/china-cells.json',
  JSON.stringify({ viewBox: `0 0 ${W} ${H}`, cells, groups: GROUPS, total }, null, 0) + '\n',
  'utf8',
)

console.log(`单元 ${cells.length} 个，面积和 ${total.toFixed(0)}，重叠采样点 ${multi}`)
for (const c of cells) {
  console.log(`  ${c.id.padEnd(12)} ${c.name.padEnd(10)} rings=${c.rings.length} area=${cellArea(c).toFixed(0)}`)
}
