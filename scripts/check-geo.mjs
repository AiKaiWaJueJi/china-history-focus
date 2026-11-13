/**
 * check-geo.mjs —— 校验战役坐标是否落在正确的版图板块内
 * ===========================================================================
 * 沙盘是示意版图，坐标一旦"溢"到邻国，视觉上就会显示成"秦军出现在楚国境内"。
 * 这个脚本用射线法做点在多边形内的判定，把每个战役点归属到具体国家。
 */
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const geo = readFileSync(join(ROOT, 'src/features/endgame/mapGeometry.ts'), 'utf8')
const data = JSON.parse(readFileSync(join(ROOT, 'src/data/endgame.zhou.json'), 'utf8'))

/** 从 mapGeometry.ts 里抠出 6 个板块的 polygon */
const regions = {}
const start = geo.indexOf('export const SIX_STATES')
const body = geo.slice(start, geo.indexOf('export const QIN_REGION'))
for (const block of body.split(/\n  \{\n/).slice(1)) {
  const id = block.match(/id: '(\w+)'/)?.[1]
  // 楚的 points 换行书写，所以 \s* 必须放进正则
  const pts = block.match(/points:\s*'([^']+)'/)?.[1]
  if (!id || !pts) continue
  regions[id] = { pts: pts.trim().split(/\s+/).map((p) => p.split(',').map(Number)) }
}
// 秦用 QIN_REGION
const qin = geo.slice(geo.indexOf('export const QIN_REGION'))
const qinPts = qin.match(/points:\s*'([^']+)'/)?.[1]
if (qinPts) regions.qin = { pts: qinPts.trim().split(/\s+/).map((p) => p.split(',').map(Number)) }

const inside = (x, y, pts) => {
  let hit = false
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i]
    const [xj, yj] = pts[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit
  }
  return hit
}

const owner = (x, y) => {
  for (const [id, r] of Object.entries(regions)) if (inside(x, y, r.pts)) return id
  return null
}

let bad = 0
for (const ev of data.events) {
  for (const c of ev.campaigns ?? []) {
    c.points.forEach((p, k) => {
      const x = p.x * 10
      const y = p.y * 6.4
      const who = owner(x, y)
      // 规则：任何点都不能出现在版图之外；
      //       秦国第一段的第一点必须在秦境内。
      const isFirstQin = c.side === 'qin' && c.phase === 1 && k === 0
      if (!who || (isFirstQin && who !== 'qin')) {
        bad++
        console.log(
          `✗ ${ev.id} phase${c.phase} 第${k + 1}点 ${c.from}→${c.to} (${p.x},${p.y}) 落在 ${who ?? '图外'}${isFirstQin ? '，秦军首段应从秦境出发' : ''}`,
        )
      }
    })
    ;(c.allies ?? []).forEach((a) => {
      a.points.forEach((p, k) => {
        const who = owner(p.x * 10, p.y * 6.4)
        if (!who) {
          bad++
          console.log(`✗ ${ev.id} 援军 ${a.nation} 第${k + 1}点 在图外 (${p.x},${p.y})`)
        }
      })
    })
  }
}

console.log(bad === 0 ? '✓ 所有战役坐标都落在版图内' : `共 ${bad} 处坐标问题`)
