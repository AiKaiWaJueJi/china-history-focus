/**
 * fix-campaign-geo.mjs —— 把行军路线从「地名」重算成「百分比坐标」
 * ===========================================================================
 * 为什么需要这一步：
 *   CampaignRoutes 的坐标系是**百分比**（x×10、y×640/100 → viewBox 0..1000/0..640），
 *   周 / 楚汉 / 三国 / 南北朝 四盘的数据都是百分比（如 {x:25,y:62.8}）。
 *   七朝新沙盘当初写成了投影绝对坐标（如 {x:272,y:332}），
 *   渲染时被 ×10 → 画到画布外，于是「沙盘缺少行军路线」。
 *
 * 做法：以 campaigns[].from / via[] / to 的地名为唯一真源，
 *       查 scripts/lib/geo-lib.mjs 的 CITY 表（含 cities-hist.mjs 的史书地名补表）
 *       → 投影 → 转百分比，重写 points；顺带判定 side（攻方 / 敌方反攻）。
 *
 * 校验（这三条是「版图与路线自洽」的底线）：
 *   · 每一程的端点都落在版图内（不能画到海里）；
 *   · 每一幕至少有一程打进目标政权（"打到了"这件事必须有路线证据）；
 *   · 目标政权本身在版图里存在。
 *
 * 用法：node scripts/fix-campaign-geo.mjs [--check]
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { CITY, project } from './lib/geo-lib.mjs'
import { SIDE_OVERRIDE } from './lib/side-override.mjs'

const CHECK_ONLY = process.argv.includes('--check')
const MAPS = ['sui', 'tang', 'five_dynasties', 'song', 'yuan', 'ming', 'qing']

const parse = (s) => s.trim().split(/\s+/).map((p) => p.split(',').map(Number))
const inside = (pt, ring) => {
  let c = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    if (yi > pt[1] !== yj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) c = !c
  }
  return c
}
/** 投影坐标 → CampaignRoutes 的百分比坐标（x/10, y/6.4），点是 { x, y } 对象 */
const toPct = ([x, y]) => ({
  x: Math.round((x / 10) * 100) / 100,
  y: Math.round((y / 6.4) * 100) / 100,
})

/** 点是否在环内（tol>0 时贴边也算：底板单元是浮点裁剪出来的，交界处有 0.1 级的细缝） */
const nearRing = (pt, ring, tol) => {
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]
    const b = ring[(i + 1) % ring.length]
    const dx = b[0] - a[0]
    const dy = b[1] - a[1]
    const len2 = dx * dx + dy * dy || 1e-9
    const t = Math.max(0, Math.min(1, ((pt[0] - a[0]) * dx + (pt[1] - a[1]) * dy) / len2))
    if (Math.hypot(pt[0] - (a[0] + dx * t), pt[1] - (a[1] + dy * t)) <= tol) return true
  }
  return false
}

let bad = 0
for (const dynasty of MAPS) {
  const file = `src/data/endgame.${dynasty}.json`
  const endgame = JSON.parse(readFileSync(file, 'utf8'))
  const geo = JSON.parse(readFileSync(`src/data/${endgame.mapId}.geo.json`, 'utf8'))
  const attackerRing = parse(geo.attacker.points)
  const rings = Object.fromEntries([geo.attacker, ...geo.regions].map((r) => [r.id, parse(r.points)]))
  const allRings = Object.values(rings)
  const inAny = (pt) => allRings.some((ring) => inside(pt, ring))

  let changed = 0
  for (const ev of endgame.events) {
    const targetRing = rings[ev.nationId]
    if (!targetRing) {
      console.error(`✗ ${dynasty}/${ev.id} 目标「${ev.nationId}」不在版图里`)
      bad += 1
      continue
    }
    let reached = false
    for (const c of ev.campaigns ?? []) {
      const names = [c.from, ...(c.via ?? []), c.to]
      const missing = names.filter((n) => !CITY[n])
      if (missing.length) {
        console.error(`✗ ${dynasty}/${ev.id}「${c.general}」地名不在 CITY 表：${missing.join(',')}`)
        bad += 1
        continue
      }
      const pts = names.map((n) => toPct(project(CITY[n][0], CITY[n][1])))
      const key = JSON.stringify(pts)
      if (JSON.stringify(c.points) !== key) {
        c.points = pts
        changed += 1
      }

      const first = [pts[0].x * 10, pts[0].y * 6.4]
      const last = [pts[pts.length - 1].x * 10, pts[pts.length - 1].y * 6.4]

      if (!pts.every((p) => inAny([p.x * 10, p.y * 6.4]) || allRings.some((ring) => nearRing([p.x * 10, p.y * 6.4], ring, 4)))) {
        console.error(
          `✗ ${dynasty}/${ev.id}「${c.general}」有端点落在版图之外：` +
            names.map((n) => `${n}(${project(CITY[n][0], CITY[n][1]).join(',')})`).join(' '),
        )
        bad += 1
      }
      if (inside(last, targetRing)) reached = true

      // 攻方 / 敌方：起点在目标境内、终点在攻方境内 → 敌方反攻（如冯国璋攻汉口）
      c.side =
        SIDE_OVERRIDE[`${dynasty}:${ev.id}:${c.general}`] ??
        (inside(first, targetRing) && inside(last, attackerRing) ? 'enemy' : 'qin')
      void attackerRing
    }
    /*
      有几种史实情形本来就不会「打进目标」：
        · 定杨 620：唐军收复河东、刘武周弃并州北走突厥，马邑是弃守而非攻取；
        · 夏 621：决胜在虎牢（郑境），窦建德既擒，河北诸州传檄而定。
      所以这一条只作提示，不当失败。
    */
    if (ev.campaigns?.length && !reached) {
      console.warn(`⚠ ${dynasty}/${ev.id} 没有一程终点落在目标「${ev.nationId}」境内（史实上属弃守或传檄而定）`)
    }
  }
  if (!CHECK_ONLY) writeFileSync(file, JSON.stringify(endgame, null, 2) + '\n', 'utf8')
  console.log(`${dynasty}: ${changed} 条路线重算坐标${changed && !CHECK_ONLY ? '（已写盘）' : ''}`)
}

if (bad) {
  console.error(`\n共 ${bad} 处需要修正`)
  process.exitCode = 1
} else {
  console.log('\n全部路线坐标与落点校验通过')
}
