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

/*
  形状完整：渲染层把 quotes / related 直接 .map()，缺字段 = 整棵树卸载 = 黑屏。
  第一版生成器漏给 22 条典制条目写 quotes，点「书同文」就是这么黑掉的，
  所以这条断言比任何内容断言都靠前——先证明每一条都能渲染，再谈内容。
*/
const shapeBad = []
for (const e of entries) {
  const bad = []
  if (typeof e.id !== 'string' || !e.id) bad.push('id')
  if (typeof e.name !== 'string' || !e.name) bad.push('name')
  if (typeof e.kind !== 'string') bad.push('kind')
  if (typeof e.body !== 'string') bad.push('body')
  if (!Array.isArray(e.quotes)) bad.push('quotes')
  if (!Array.isArray(e.related)) bad.push('related')
  if (bad.length) shapeBad.push(`${e.id}(${bad.join('/')})`)
}
check('每条条目都具备渲染所需字段（quotes/related 必须是数组）', shapeBad.length === 0, shapeBad.slice(0, 5).join(','))

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
for (const kind of ['battle', 'character', 'emperor', 'ruler', 'regime', 'lord']) {
  const list = entries.filter((e) => e.kind === kind)
  const empty = list.filter((e) => !e.body || e.body.length < 8)
  check(`${kind} 条目都有正文`, empty.length === 0, `${list.length} 条，空 ${empty.length}`)
}

/* ---------- 3b. 十国：政权 → 君主 的链路必须成立 ---------- */
const regimes = entries.filter((e) => e.kind === 'regime')
const rulers = entries.filter((e) => e.kind === 'ruler')
check('政权条目齐（十国 10 + 宋辽金西夏 3 = 13）', regimes.length === 13, `${regimes.length} 个`)
const parallelRegimes = regimes.filter((r) => (r.tags ?? []).includes('宋辽金西夏'))
check(
  '宋辽金西夏三家各有一条政权条目',
  ['辽', '西夏', '金'].every((n) => parallelRegimes.some((r) => r.name === n)),
  parallelRegimes.map((r) => r.name).join(','),
)
const rulerBySource = new Map(rulers.map((e) => [e.sourceId ?? e.id, e]))
const regimeNoRuler = regimes.filter((r) => {
  const links = [...r.body.matchAll(/\[\[[^\]|]+\|([^\]]+)\]\]/g)].map((m) => m[1])
  return !links.some((id) => rulerBySource.has(id))
})
check('每个政权条目都链到了本国君主', regimeNoRuler.length === 0, regimeNoRuler.map((r) => r.name).join(','))
const rulerBadState = rulers.filter((r) => !r.related.some((id) => regimes.some((g) => g.id === id)))
check('每位君主都能回到所属政权', rulerBadState.length === 0, rulerBadState.slice(0, 3).map((r) => r.name).join(','))
check(
  '十国君主不混进帝系（kind 是 ruler 不是 emperor）',
  entries.filter((e) => e.kind === 'emperor').every((e) => !e.id.startsWith('ts_')),
  `君主 ${rulers.length} 位`,
)

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

/* ---------- 4c. 原文的「出处层级」（2026-11-18 批次 1） ---------- */
/*
  这一组守的是**引文的诚实度**，不是内容量：
  · 每条原文都要有出处（work）、原文（text）、译文（translation）；
  · tier 只能是 primary / secondary；
  · 转引（secondary）必须写 via —— 只标「转引」不交代经过谁，等于没交代。
*/
const allQuotes = entries.flatMap((e) => e.quotes.map((q) => ({ id: e.id, q })))
const badTier = allQuotes.filter(({ q }) => q.tier !== 'primary' && q.tier !== 'secondary')
check('每条原文的出处层级只有「一手 / 转引」两种', badTier.length === 0, `${allQuotes.length} 条原文，非法 ${badTier.length}`)

const badQuoteShape = allQuotes.filter(({ q }) => !q.work || !q.text || !q.translation)
check('每条原文都有出处 + 原文 + 译文', badQuoteShape.length === 0, badQuoteShape.slice(0, 4).map((x) => x.id).join(','))

const badVia = allQuotes.filter(({ q }) => q.tier === 'secondary' && !q.via)
check('转引原文都写明了转引链（via）', badVia.length === 0, badVia.slice(0, 4).map((x) => x.id).join(','))
console.log(`     原文 ${allQuotes.length} 条：一手 ${allQuotes.filter(({ q }) => q.tier === 'primary').length} / 转引 ${allQuotes.filter(({ q }) => q.tier === 'secondary').length}`)

/* ---------- 4d. 典制与诸侯：这一轮补的原文覆盖 ---------- */
const extrasNoQuote = extras.filter((e) => !e.quotes.length)
check('每条典制/典故词条都有一段文言原文', extrasNoQuote.length === 0, `${extras.length} 条，缺 ${extrasNoQuote.length}：${extrasNoQuote.slice(0, 4).map((e) => e.name).join(',')}`)

const lords = entries.filter((e) => e.kind === 'lord')
const lordsNoQuote = lords.filter((e) => !e.quotes.length)
check('每位诸侯都有一段文言原文', lordsNoQuote.length === 0, `${lords.length} 位，缺 ${lordsNoQuote.length}：${lordsNoQuote.slice(0, 4).map((e) => e.name).join(',')}`)

/*
  帝王原文覆盖（批次 2 起分批补）：
  这里只**报告**不设阈值——「查不到就留白」是本项目的口径，用覆盖率卡阈值等于逼后人编造。
  想做进度看这行输出即可。
*/
const emperors = entries.filter((e) => e.kind === 'emperor')
const empCover = new Map()
for (const e of emperors) {
  const key = e.dynastyId ?? '?'
  const slot = empCover.get(key) ?? { total: 0, quoted: 0 }
  slot.total += 1
  if (e.quotes.length) slot.quoted += 1
  empCover.set(key, slot)
}
console.log(
  '     帝王原文覆盖：' +
    [...empCover.entries()]
      .sort((a, b) => b[1].total - a[1].total)
      .map(([k, v]) => `${k} ${v.quoted}/${v.total}`)
      .join(' · ') +
    `　合计 ${emperors.filter((e) => e.quotes.length).length}/${emperors.length}`,
)

/* ---------- 4e. 留白登记：查证过「确实没有」的条目要留痕 ---------- */
const blanks = entries.filter((e) => typeof e.noQuote === 'string' && e.noQuote)
check('留白登记都写了理由（≥8 字）', blanks.every((e) => e.noQuote.length >= 8), blanks.filter((e) => e.noQuote.length < 8).slice(0, 3).map((e) => e.id).join(','))
check(
  '留白登记与原文互斥（登记了就不能同时有原文）',
  blanks.every((e) => e.quotes.length === 0),
  blanks.filter((e) => e.quotes.length).slice(0, 3).map((e) => e.id).join(','),
)
console.log(`     已查证无语录：${blanks.length} 位（${blanks.map((e) => e.name).slice(0, 6).join('/')}${blanks.length > 6 ? '…' : ''}）`)

/* ---------- 5. 统计 ---------- */
console.log('\n条目构成：', JSON.stringify(doc.counts))
console.log(`\n===== ${pass}/${pass + fail} passed =====`)
if (fail) process.exitCode = 1
