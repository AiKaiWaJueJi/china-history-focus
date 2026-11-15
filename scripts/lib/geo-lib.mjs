/**
 * geo-lib.mjs —— 沙盘版图脚本共用的小工具
 * ===========================================================================
 * · 投影（与 build-china-base.mjs 一致，参数由 _scratch/china-base.json 带出）
 * · 经纬度城市表：七盘沙盘的国都、要地、行军路线都从这里取坐标
 * · 多边形工具：面积、点在内、并集取最大环、Catmull-Rom 平滑路径
 */
import polygonClipping from 'polygon-clipping'
import { HIST_CITY } from './cities-hist.mjs'

/* ---------------- 投影 ---------------- */
export const PROJ = {
  MIN_LON: 73.4,
  MAX_LON: 135.2,
  MIN_LAT: 17.9,
  MAX_LAT: 53.7,
  LAT_REF: 36,
  W: 1000,
  H: 640,
  PAD: 26,
}
const KX = Math.cos((PROJ.LAT_REF * Math.PI) / 180)
const spanX = (PROJ.MAX_LON - PROJ.MIN_LON) * KX
const spanY = PROJ.MAX_LAT - PROJ.MIN_LAT
const SCALE = Math.min((PROJ.W - PROJ.PAD * 2) / spanX, (PROJ.H - PROJ.PAD * 2) / spanY)
const OFF_X = (PROJ.W - spanX * SCALE) / 2
const OFF_Y = (PROJ.H - spanY * SCALE) / 2

/** 经纬度 → 投影坐标（保留 1 位小数） */
export function project(lon, lat) {
  return [
    Math.round((OFF_X + (lon - PROJ.MIN_LON) * KX * SCALE) * 10) / 10,
    Math.round((OFF_Y + (PROJ.MAX_LAT - lat) * SCALE) * 10) / 10,
  ]
}

/* ---------------- 城市表（经度, 纬度） ---------------- */
export const CITY = {
  长安: [108.94, 34.34],
  西安: [108.94, 34.34],
  咸阳: [108.71, 34.33],
  凤翔: [107.39, 34.52],
  陈仓: [107.14, 34.36],
  潼关: [110.24, 34.55],
  洛阳: [112.45, 34.62],
  虎牢: [113.24, 34.83],
  汴州: [114.31, 34.8],
  开封: [114.31, 34.8],
  宋州: [115.65, 34.42],
  郓州: [116.47, 35.94],
  青州: [118.48, 36.7],
  兖州: [116.83, 35.55],
  魏州: [115.15, 36.28],
  相州: [114.39, 36.1],
  洺州: [114.5, 36.68],
  邢州: [114.5, 37.07],
  真定: [114.57, 38.15],
  幽州: [116.4, 39.9],
  蓟: [116.4, 39.9],
  涿州: [115.97, 39.49],
  太原: [112.55, 37.87],
  晋阳: [112.55, 37.87],
  平阳: [111.52, 36.09],
  上党: [113.12, 36.2],
  雁门: [112.96, 39.07],
  马邑: [112.43, 39.33],
  云州: [113.3, 40.08],
  大同: [113.3, 40.08],
  河间: [116.1, 38.44],
  沧州: [116.84, 38.3],
  中山: [114.99, 38.52],
  邺: [114.62, 36.33],
  濮阳: [115.03, 35.76],
  寿春: [116.78, 32.58],
  合肥: [117.23, 31.82],
  扬州: [119.41, 32.39],
  广陵: [119.41, 32.39],
  淮阴: [119.02, 33.62],
  盱眙: [118.54, 33.01],
  南京: [118.8, 32.06],
  金陵: [118.8, 32.06],
  建康: [118.8, 32.06],
  丹阳: [118.8, 32.06],
  京口: [119.45, 32.2],
  采石: [118.51, 31.7],
  苏州: [120.62, 31.3],
  杭州: [120.15, 30.27],
  临安: [120.15, 30.27],
  越州: [120.58, 30.0],
  明州: [121.55, 29.87],
  江陵: [112.19, 30.35],
  襄阳: [112.14, 32.04],
  武昌: [114.31, 30.55],
  江夏: [114.31, 30.55],
  夷陵: [111.29, 30.69],
  夔州: [109.47, 31.02],
  奉节: [109.47, 31.02],
  潭州: [112.94, 28.23],
  长沙: [112.94, 28.23],
  岳州: [113.13, 29.37],
  洪州: [115.85, 28.68],
  南昌: [115.85, 28.68],
  江州: [116.0, 29.71],
  九江: [116.0, 29.71],
  虔州: [114.94, 25.85],
  福州: [119.3, 26.08],
  泉州: [118.68, 24.87],
  建州: [118.32, 27.03],
  广州: [113.26, 23.13],
  兴王府: [113.26, 23.13],
  奉元: [108.94, 34.34],
  成都2: [104.07, 30.57],
  桂林: [110.29, 25.27],
  桂州: [110.29, 25.27],
  邕州: [108.37, 22.82],
  成都: [104.07, 30.57],
  重庆: [106.55, 29.56],
  渝州: [106.55, 29.56],
  汉中: [107.02, 33.07],
  兴元: [107.02, 33.07],
  涪城: [104.68, 31.47],
  柏壁: [111.22, 35.61],
  柏乡: [114.69, 37.5],
  泽州: [112.85, 35.5],
  崖山: [113.03, 22.42],
  汉口: [114.28, 30.59],
  滁州: [118.32, 32.3],
  泸州: [105.44, 28.87],
  柏壁: [111.22, 35.61],
  柏乡: [114.69, 37.5],
  泽州: [112.85, 35.5],
  崖山: [113.03, 22.42],
  汉口: [114.28, 30.59],
  滁州: [118.32, 32.3],
  泸州: [105.44, 28.87],
  剑门: [105.53, 32.29],
  梓州: [105.09, 31.1],
  夔门: [109.47, 31.02],
  大理: [100.23, 25.6],
  中庆: [102.83, 24.88],
  昆明: [102.83, 24.88],
  兰州: [103.83, 36.06],
  凉州: [102.63, 37.93],
  甘州: [100.45, 38.93],
  肃州: [98.49, 39.73],
  敦煌: [94.66, 40.14],
  西宁: [101.78, 36.62],
  宁夏: [106.23, 38.49],
  灵州: [106.33, 38.1],
  夏州: [108.53, 37.83],
  榆林: [109.73, 38.28],
  延安: [109.49, 36.58],
  应天: [118.8, 32.06],
  集庆: [118.8, 32.06],
  大都: [116.4, 39.9],
  北京: [116.4, 39.9],
  盛京: [123.43, 41.8],
  沈阳: [123.43, 41.8],
  辽阳: [123.17, 41.27],
  潜龙: [123.43, 41.8],
  宁远: [120.71, 40.62],
  山海关: [119.75, 40.01],
  潼川: [105.09, 31.1],
  洪都: [115.85, 28.68],
  彰德: [114.39, 36.1],
  安庆: [117.06, 30.53],
  徐州: [117.18, 34.26],
  彭城: [117.18, 34.26],
  济州: [116.58, 35.41],
  登州: [120.75, 37.81],
  莱州: [119.94, 37.28],
  颍州: [115.81, 32.9],
  蔡州: [114.35, 32.98],
  邓州: [112.09, 32.68],
  随州: [113.38, 31.72],
  鄂州: [114.89, 30.4],
  黄州: [114.88, 30.45],
  江州2: [116.0, 29.71],
  湖口: [116.22, 29.74],
  饶州: [116.7, 29.29],
  信州: [117.97, 28.45],
  衢州: [118.87, 28.94],
  婺州: [119.65, 29.08],
  台州: [121.42, 28.66],
  温州: [120.7, 28.0],
  处州: [119.92, 28.45],
  邵武: [117.49, 27.34],
  汀州: [116.36, 25.83],
  漳州: [117.65, 24.51],
  潮州: [116.62, 23.66],
  惠州: [114.42, 23.11],
  韶州: [113.6, 24.81],
  连州: [112.38, 24.78],
  衡州: [112.57, 26.89],
  永州: [111.61, 26.42],
  郴州: [113.02, 25.77],
  全州: [111.07, 25.93],
  江州3: [116.0, 29.71],
  建康2: [118.8, 32.06],
}

/* ---------------- 多边形工具 ---------------- */
export const ringArea = (ring) => {
  let a = 0
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i]
    const q = ring[(i + 1) % ring.length]
    a += p[0] * q[1] - q[0] * p[1]
  }
  return Math.abs(a / 2)
}

export const pointInRing = (pt, ring) => {
  let c = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    if (yi > pt[1] !== yj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) c = !c
  }
  return c
}

/** 多个单元环求并集，返回 { ring: 最大外环, extraArea: 被丢弃的多余碎片面积 } */
export function unionRings(rings) {
  const polys = rings.map((r) => [r])
  // 依次并集，避免一次并太多导致的数值抖动
  let acc = null
  for (const p of polys) {
    // p 是 Polygon（[ring]）；accumulator 统一成 MultiPolygon（[polygon]）
    acc = acc === null ? [p] : polygonClipping.union(acc, p)
  }
  let best = null
  let bestArea = -1
  let totalArea = 0
  for (const poly of acc) {
    const ring = poly[0].map((p) => [Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10])
    const a = ringArea(ring)
    totalArea += a
    if (a > bestArea) {
      bestArea = a
      best = ring
    }
  }
  return { ring: best, extraArea: Math.max(0, totalArea - bestArea) }
}

/** 面积加权形心 */
export function centroid(ring) {
  let twice = 0
  let cx = 0
  let cy = 0
  for (let i = 0; i < ring.length; i++) {
    const [x0, y0] = ring[i]
    const [x1, y1] = ring[(i + 1) % ring.length]
    const cross = x0 * y1 - x1 * y0
    twice += cross
    cx += (x0 + x1) * cross
    cy += (y0 + y1) * cross
  }
  const a = twice / 2
  if (Math.abs(a) < 1e-9) return [ring[0][0], ring[0][1]]
  return [cx / (6 * a), cy / (6 * a)]
}

/** 环内距边界最远的内部点（用来放国名，避免压住边界） */
export function innerLabelPoint(ring) {
  let best = null
  let bestD = -1
  const xs = ring.map((p) => p[0])
  const ys = ring.map((p) => p[1])
  const x0 = Math.min(...xs)
  const x1 = Math.max(...xs)
  const y0 = Math.min(...ys)
  const y1 = Math.max(...ys)
  for (let i = 1; i < 24; i++) {
    for (let j = 1; j < 24; j++) {
      const p = [x0 + ((x1 - x0) * i) / 24, y0 + ((y1 - y0) * j) / 24]
      if (!pointInRing(p, ring)) continue
      let d = Infinity
      for (let k = 0; k < ring.length; k++) {
        const a = ring[k]
        const b = ring[(k + 1) % ring.length]
        const dx = b[0] - a[0]
        const dy = b[1] - a[1]
        const len2 = dx * dx + dy * dy || 1e-9
        const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2))
        d = Math.min(d, Math.hypot(p[0] - (a[0] + dx * t), p[1] - (a[1] + dy * t)))
      }
      if (d > bestD) {
        bestD = d
        best = p
      }
    }
  }
  return best ? [Math.round(best[0] * 10) / 10, Math.round(best[1] * 10) / 10] : centroid(ring)
}

/**
 * 国名选址（贪心）：国都点、要地是钉死的地理位置，先把它们占位；
 * 再按面积从大到小给每个政权挑一块「不与任何文字块重叠、且尽量靠内」的位置。
 * 迭代式推挤容易卡在局部最优（国名互相顶住），直接挑空位更稳。
 *
 * @param regions [{ ring, name, size, area }]
 * @param fixed   [{ x, y, w, h }] 已占位的文字块（国都 / 要地）
 */
export function placeLabels(regions, fixed = []) {
  const taken = fixed.map((b) => ({ ...b }))
  const out = new Map()
  const GRID = 32

  const overlapArea = (a, b) => {
    const ox = Math.min(a.x + a.w / 2, b.x + b.w / 2) - Math.max(a.x - a.w / 2, b.x - b.w / 2)
    const oy = Math.min(a.y + a.h / 2, b.y + b.h / 2) - Math.max(a.y - a.h / 2, b.y - b.h / 2)
    return ox > 0 && oy > 0 ? ox * oy : 0
  }
  const distToRing = (pt, ring) => {
    let d = Infinity
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i]
      const b = ring[(i + 1) % ring.length]
      const dx = b[0] - a[0]
      const dy = b[1] - a[1]
      const len2 = dx * dx + dy * dy || 1e-9
      const t = Math.max(0, Math.min(1, ((pt[0] - a[0]) * dx + (pt[1] - a[1]) * dy) / len2))
      d = Math.min(d, Math.hypot(pt[0] - (a[0] + dx * t), pt[1] - (a[1] + dy * t)))
    }
    return d
  }

  /** 在环内网格里找一个「不与已占文字块重叠、且尽量靠内/靠近国都」的位置 */
  const search = (r, size) => {
    const w = r.name.length * size * 1.12
    const h = size * 1.3
    const xs = r.ring.map((p) => p[0])
    const ys = r.ring.map((p) => p[1])
    const x0 = Math.min(...xs)
    const x1 = Math.max(...xs)
    const y0 = Math.min(...ys)
    const y1 = Math.max(...ys)
    const anchor = r.anchor ?? [(x0 + x1) / 2, (y0 + y1) / 2]
    let pos = null
    let score = -Infinity
    let worst = Infinity
    for (let gi = 0; gi <= GRID; gi++) {
      for (let gj = 0; gj <= GRID; gj++) {
        const x = x0 + ((x1 - x0) * gi) / GRID
        const y = y0 + ((y1 - y0) * gj) / GRID
        if (!pointInRing([x, y], r.ring)) continue
        const box = { x, y, w, h }
        let overlap = 0
        for (const b of taken) {
          overlap += overlapArea(box, b)
          if (overlap > 0) break
        }
        const depth = Math.min(distToRing([x, y], r.ring), 60)
        const toAnchor = Math.hypot(x - anchor[0], y - anchor[1])
        const sc = -overlap * 40 + depth * 0.3 - toAnchor * 0.55
        if (sc > score) {
          score = sc
          worst = overlap
          pos = [Math.round(x * 10) / 10, Math.round(y * 10) / 10]
        }
      }
    }
    if (!pos) pos = [Math.round(((x0 + x1) / 2) * 10) / 10, Math.round(((y0 + y1) / 2) * 10) / 10]
    return { pos, score, overlap: worst }
  }

  const order = [...regions].sort((a, b) => (b.area ?? 0) - (a.area ?? 0))
  for (const r of order) {
    /*
      先按标准字号找空位；找不到（如「吴越」只有浙江一省、还压着杭州）就依次缩字号再找——
      宁可国名小一点，也不要糊在国都上。缩过的字号写回 r.size，输出时用。
    */
    let chosen = null
    for (const factor of [1, 0.82, 0.66]) {
      const size = Math.round(r.size * factor * 10) / 10
      const res = search(r, size)
      if (!chosen || res.overlap < chosen.overlap) chosen = { ...res, size }
      if (res.overlap === 0) break
    }
    r.size = chosen.size
    out.set(r, chosen.pos)
    taken.push({ x: chosen.pos[0], y: chosen.pos[1], w: r.name.length * chosen.size * 1.12, h: chosen.size * 1.3 })
  }
  return out
}

/** 史书行军地名并入常用城市表（上古地名的坐标见 cities-hist.mjs） */
Object.assign(CITY, HIST_CITY)

const boxOverlap = (a, b) => {
  const ox = Math.min(a.x + a.w / 2, b.x + b.w / 2) - Math.max(a.x - a.w / 2, b.x - b.w / 2)
  const oy = Math.min(a.y + a.h / 2, b.y + b.h / 2) - Math.max(a.y - a.h / 2, b.y - b.h / 2)
  return ox > 0 && oy > 0 ? ox * oy : 0
}

/**
 * 给「要地」挑标签方位：城市挨得太近（长安—潼关只差 17px），
 * 统一写在点的右下方必然互相压住，所以按候选方位挑一个重叠最少的。
 */
export function pickPointOffset(pt, name, blocks) {
  const w = name.length * 12 * 1.12
  const h = 16
  const cands = [
    { dx: 9, dy: 4, anchor: 'start' },
    { dx: -9, dy: 4, anchor: 'end' },
    { dx: 0, dy: -12, anchor: 'middle' },
    { dx: 0, dy: 16, anchor: 'middle' },
    { dx: 9, dy: -12, anchor: 'start' },
    { dx: -9, dy: -12, anchor: 'end' },
    { dx: 9, dy: 17, anchor: 'start' },
    { dx: -9, dy: 17, anchor: 'end' },
  ]
  let best = cands[0]
  let bestOverlap = Infinity
  for (const c of cands) {
    const cx =
      c.anchor === 'start' ? pt[0] + c.dx + w / 2 : c.anchor === 'end' ? pt[0] + c.dx - w / 2 : pt[0] + c.dx
    const box = { x: cx, y: pt[1] + c.dy, w, h }
    let ov = 0
    for (const b of blocks) {
      ov += boxOverlap(box, b)
      if (ov > bestOverlap) break
    }
    if (ov < bestOverlap) {
      bestOverlap = ov
      best = c
    }
  }
  return best
}

/** 国名字号：随面积缩放，小国不会被大字号压出边界 */
export function labelSize(area, min = 14, max = 32) {
  return Math.round(Math.max(min, Math.min(max, Math.sqrt(area) / 2.2)) * 10) / 10
}

/**
 * 标签排布：按**文字外接矩形**做推挤（国名长短差别很大，
 * 只按字号当半径会让三个字的国名互相压住）。
 * items: [{ ring, label:[x,y], size, width?, fixed? }] —— fixed 的点只当障碍，不被移动
 */
export function layoutLabels(items, iters = 240) {
  const pos = items.map((it) => ({ x: it.label[0], y: it.label[1] }))
  const W = (it) => it.width ?? it.size * 1.12
  const H = (it) => it.size * 1.3
  const shift = (it, p, sx, sy, amount) => {
    const nx = p.x + sx * amount
    const ny = p.y + sy * amount
    if (pointInRing([nx, ny], it.ring)) {
      p.x = nx
      p.y = ny
      return true
    }
    return false
  }
  for (let k = 0; k < iters; k++) {
    let moved = false
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const A = items[i]
        const B = items[j]
        if (A.fixed && B.fixed) continue
        const a = pos[i]
        const b = pos[j]
        const ox =
          Math.min(a.x + W(A) / 2, b.x + W(B) / 2) - Math.max(a.x - W(A) / 2, b.x - W(B) / 2)
        const oy =
          Math.min(a.y + H(A) / 2, b.y + H(B) / 2) - Math.max(a.y - H(A) / 2, b.y - H(B) / 2)
        if (ox <= 0 || oy <= 0) continue

        // 沿「穿透更浅」的轴推开，代价最小
        const useX = ox < oy
        const dir = useX ? (a.x <= b.x ? -1 : 1) : a.y <= b.y ? -1 : 1
        const amount = (useX ? ox : oy) / 2 + 1.5
        const sx = useX ? dir : 0
        const sy = useX ? 0 : dir

        if (A.fixed) {
          shift(B, b, -sx, -sy, amount * 2)
        } else if (B.fixed) {
          shift(A, a, sx, sy, amount * 2)
        } else {
          const ma = shift(A, a, sx, sy, amount)
          const mb = shift(B, b, -sx, -sy, amount)
          if (!ma && !mb) {
            // 两边都被自己的疆域卡住：把小的那个硬挪到邻位
            const small = A.size <= B.size ? [A, a] : [B, b]
            const other = small[0] === A ? b : a
            const dd = Math.hypot(other.x - small[1].x, other.y - small[1].y) || 1
            shift(small[0], small[1], (small[1].x - other.x) / dd, (small[1].y - other.y) / dd, amount * 2)
          }
        }
        moved = true
      }
    }
    if (!moved) break
  }
  return pos.map((p) => [Math.round(p.x * 10) / 10, Math.round(p.y * 10) / 10])
}

/** 折线 → 平滑 SVG path（Catmull-Rom 转三次贝塞尔） */export function smoothPath(points) {
  if (points.length < 2) return ''
  const p = points
  const f = (n) => Math.round(n * 10) / 10
  let d = `M ${f(p[0][0])},${f(p[0][1])}`
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[i - 1] ?? p[i]
    const p1 = p[i]
    const p2 = p[i + 1]
    const p3 = p[i + 2] ?? p2
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6]
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6]
    d += ` C ${f(c1[0])},${f(c1[1])} ${f(c2[0])},${f(c2[1])} ${f(p2[0])},${f(p2[1])}`
  }
  return d
}

/** 经纬度折线 → 投影后的 SVG path */
export function riverPath(lonLat) {
  return smoothPath(lonLat.map(([lon, lat]) => project(lon, lat)))
}

/** 城市名 → 投影坐标 */
export function city(name) {
  const c = CITY[name]
  if (!c) throw new Error(`城市表里没有「${name}」，请先补 scripts/lib/geo-lib.mjs 的 CITY`)
  return project(c[0], c[1])
}
