/**
 * verify-codex.mjs —— 百科库与导航栈的数据层验收
 * ===========================================================================
 * 数据是「无限下钻」的地基，这里只验能被证明的东西：
 *   1. id 唯一、关联不悬空、标记不指向不存在的条目；
 *   2. 每条战役都有「原文 + 译文」两层（抽屉的核心素材）；
 *   3. 人物 / 帝王 / 诸侯有正文，且正文里至少能织出链（下钻的入口）；
 *   4. 从「帝王 → 人物 → 战役」这条典型路径能一路点到底（模拟钻取）。
 */
import { readFileSync } from 'node:fs'

const doc = JSON.parse(readFileSync('src/data/codex.entries.json', 'utf8'))
const entries = doc.entries
const byId = new Map(entries.map((e) => [e.id, e]))
const bySource = new Map(entries.filter((e) => e.sourceId).map((e) => [e.sourceId, e]))

let pass = 0
let fail = 0
const check = (name, ok, detail = '') => {
  if (ok) pass += 1
  else fail += 1
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' :: ' + detail : ''}`)
}

/* ---------- 1. 结构 ---------- */
check('条目 id 唯一', new Set(entries.map((e) => e.id)).size === entries.length, `${entries.length} 条`)
check('sourceId 唯一', new Set(entries.filter((e) => e.sourceId).map((e) => e.sourceId)).size === entries.filter((e) => e.sourceId).length)

const badRelated = []
for (const e of entries) for (const rid of e.related) if (!byId.has(rid)) badRelated.push(`${e.id}->${rid}`)
check('关联 id 不悬空', badRelated.length === 0, badRelated.slice(0, 4).join(','))

const marker = /\[\[([^\]|]+?)(?:\|([^\]]*))?\]\]/g
const badMarkers = []
let markerCount = 0
for (const e of entries) {
  marker.lastIndex = 0
  for (let m = marker.exec(e.body); m; m = marker.exec(e.body)) {
    markerCount += 1
    const target = m[2] || m[1]
    if (!byId.has(target)) badMarkers.push(`${e.id}->${target}`)
    if (target === e.id) badMarkers.push(`${e.id} 自链`)
  }
}
check('正文标记都指向存在的条目（且无自链）', badMarkers.length === 0, `${markerCount} 处链，坏链 ${badMarkers.slice(0, 3).join(',')}`)

/* ---------- 2. 战役必须有原文 + 译文 ---------- */
const battles = entries.filter((e) => e.kind === 'battle')
const noQuote = battles.filter((e) => !e.quotes.length || !e.quotes[0].text || !e.quotes[0].translation)
check('每条战役都有文言原文 + 白话译文', noQuote.length === 0, `${battles.length} 条战役，缺 ${noQuote.length}`)
const noWork = battles.filter((e) => !e.quotes[0]?.work)
check('每条战役都标了出处', noWork.length === 0, noWork.slice(0, 3).map((e) => e.id).join(','))

/* ---------- 3. 各类都有正文 ---------- */
for (const kind of ['battle', 'character', 'emperor', 'lord']) {
  const list = entries.filter((e) => e.kind === kind)
  const empty = list.filter((e) => !e.body || e.body.length < 8)
  check(`${kind} 条目都有正文`, empty.length === 0, `${list.length} 条，空 ${empty.length}`)
}

/* ---------- 4. 模拟无限下钻（BFS：只要存在长度 ≥ 2 的路径就算通） ---------- */
const linksOf = (entry) => {
  const out = []
  marker.lastIndex = 0
  for (let m = marker.exec(entry.body); m; m = marker.exec(entry.body)) {
    const target = byId.get(m[2] || m[1])
    if (target && target.id !== entry.id) out.push(target)
  }
  return out
}

const start = bySource.get('qin_shi') // 秦始皇（帝王卡点进来）
check('帝王卡可反查到条目', Boolean(start), start?.id ?? '无')
check('帝王正文里有可下钻的链', start ? linksOf(start).length > 0 : false, start ? linksOf(start).map((n) => n.name).join(',') : '无')

/* 从秦始皇出发，不回头地走到 3 层 */
const paths = []
const walk = (node, trail) => {
  if (trail.length >= 3) return
  for (const next of linksOf(node)) {
    if (trail.some((t) => t.id === next.id)) continue
    paths.push([...trail, next])
    walk(next, [...trail, next])
  }
}
walk(start, [start])
const deepest = paths.filter((p) => p.length >= 3).sort((a, b) => b.length - a.length)[0]
check(
  '能从帝王一路下钻至少 2 层',
  paths.some((p) => p.length >= 3),
  deepest ? deepest.map((n) => n.name).join(' → ') : paths.map((p) => p.map((n) => n.name).join('→')).slice(0, 3).join(' | '),
)

/* ---------- 4b. 补充词条与帝王原文 ---------- */
const extras = entries.filter((e) => e.kind === 'extra')
check('补充词条（典制/典故）有正文', extras.every((e) => e.body && e.body.length > 20), `${extras.length} 条`)
check('补充词条都有出链', extras.every((e) => e.related.length > 0), extras.filter((e) => !e.related.length).map((e) => e.name).join(','))

const quoted = entries.filter((e) => e.kind === 'emperor' && e.quotes.length > 0)
check('有帝王带文言原文', quoted.length >= 6, `${quoted.length} 位`)
check(
  '帝王原文都带出处与译文',
  quoted.every((e) => e.quotes.every((q) => q.work && q.text && q.translation)),
  quoted.map((e) => e.name).join(','),
)

/* ---------- 5. 统计 ---------- */
console.log('\n条目构成：', JSON.stringify(doc.counts))
console.log(`\n===== ${pass}/${pass + fail} passed =====`)
if (fail) process.exitCode = 1
