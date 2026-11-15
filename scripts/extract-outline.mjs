/** 从已有 geo 里提取公共外轮廓（出现一次的边即边境），并自检面积 */
import { readFileSync } from 'node:fs'

const ids = process.argv.slice(2)
for (const id of ids.length ? ids : ['sui', 'sanguo', 'chuhan']) {
  const geo = JSON.parse(readFileSync(`src/data/${id}.geo.json`, 'utf8'))
  const allPolys = [geo.attacker, ...geo.regions]
  const polys = allPolys.map((r) =>
    r.points
      .trim()
      .split(/\s+/)
      .map((p) => p.split(',').map(Number)),
  )
  const edgeKey = (a, b) => {
    const k = (p) => `${p[0]},${p[1]}`
    return k(a) < k(b) ? `${k(a)}|${k(b)}` : `${k(b)}|${k(a)}`
  }
  const count = new Map()
  const edgeEnds = new Map()
  for (const poly of polys) {
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i]
      const b = poly[(i + 1) % poly.length]
      const k = edgeKey(a, b)
      count.set(k, (count.get(k) ?? 0) + 1)
      edgeEnds.set(k, [a, b])
    }
  }
  const ring = [...count.entries()].filter(([, c]) => c === 1).map(([k]) => edgeEnds.get(k))
  // 串成回路
  const byPoint = new Map()
  for (const [a, b] of ring) {
    const k = (p) => `${p[0]},${p[1]}`
    byPoint.set(k(a), b)
  }
  const start = ring[0][0]
  const out = [start]
  let cur = start
  for (let i = 0; i < ring.length + 2; i++) {
    const next = byPoint.get(`${cur[0]},${cur[1]}`)
    if (!next) break
    if (next === start) break
    out.push(next)
    cur = next
  }
  const area = Math.abs(
    out.reduce((s, p, i) => {
      const q = out[(i + 1) % out.length]
      return s + (p[0] * q[1] - q[0] * p[1])
    }, 0) / 2,
  )
  console.log(
    `${id}: 区域 ${geo.regions.length}，边境边 ${ring.length}，轮廓点 ${out.length}，面积 ${area.toFixed(0)}`,
  )
  if (id === 'sui') console.log('OUTLINE=' + JSON.stringify(out))
}
