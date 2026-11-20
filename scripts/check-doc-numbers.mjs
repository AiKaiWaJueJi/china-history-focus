/**
 * check-doc-numbers.mjs —— 文档「现状数字」与数据的机械对账（不联网、不跑浏览器）
 * ===========================================================================
 * 为什么需要：2026-11-20 那一轮交接时发现，docs/交接文档.md 的「现状」数字已经过期
 * （写 359 条百科、30 套 793 条，实际是 496 条、31 套 820 条），而**文档是新会话的第一入口**，
 * 数字错了等于把人往旧路上带。人肉抽查靠不住，就让机器比。
 *
 * 比的是「数据能算出来的数字」：
 *   · 百科库总量与分项（codex.entries.json 的 counts）
 *   · 事件注解条数（各数据源的事件总数）
 *   · 生平条数（emperor-bios.json）
 *   · 原文条数 / 留白登记（codex.quotes.json / codex.no-quote.json）
 *   · 十国 41 君主、南北朝 54 帝、辽夏金 29 君主
 * 比不了的是「跑出来的条数」（run-all 套数/条数）——那要真跑验收，脚本里只能当常量引用。
 *
 * 用法：node scripts/check-doc-numbers.mjs [--doc=docs/交接文档.md]
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs'

const args = process.argv.slice(2)
const docPath = (args.find((a) => a.startsWith('--doc=')) ?? '--doc=docs/交接文档.md').slice(6)
const DOC = readFileSync(docPath, 'utf8')

const readJ = (p) => JSON.parse(readFileSync(p, 'utf8'))
const has = (s) => DOC.includes(s)

const checks = []
const check = (name, ok, detail) => checks.push({ name, ok, detail })

/* ---------- 数据侧现算 ---------- */
const counts = readJ('src/data/codex.entries.json').counts
const quotes = readJ('scripts/data/codex.quotes.json')
const noQuote = readJ('scripts/data/codex.no-quote.json')
const bios = readJ('src/data/emperor-bios.json')

let events = 0
for (const f of readdirSync('src/data').filter((f) => /^(emperors|lords)\..*\.json$/.test(f))) {
  const doc = readJ(`src/data/${f}`)
  for (const who of doc.emperors ?? doc.lords ?? doc) events += (who.events ?? []).length
}
for (const f of ['nanbei.json', 'ten_states.json', 'song_parallel.json']) {
  if (!existsSync(`src/data/${f}`)) continue
  const doc = readJ(`src/data/${f}`)
  const rows = doc.emperors ?? doc.rulers ?? (doc.states ?? []).flatMap((s) => s.monarchs ?? [])
  for (const who of rows) events += (who.events ?? []).length
}
const noteCount = Object.keys(readJ('src/data/event-notes.json')).length - 1
const bioCount = Object.keys(bios).length - 1
const nanbei = readJ('src/data/nanbei.json').emperors.length
const tenMonarchs = readJ('src/data/ten_states.json').states.reduce((n, s) => n + s.monarchs.length, 0)
const parRulers = readJ('src/data/song_parallel.json').rulers.length

/* ---------- 逐项对账 ---------- */
check('百科库总量', has(`**${counts.total} 条百科**`), `数据 ${counts.total} 条`)
check('百科分项（帝王 / 君主 / 政权）',
  has(`帝王 ${counts.emperor} / 君主 ${counts.ruler} / 政权 ${counts.regime}`),
  `数据 帝王 ${counts.emperor} / 君主 ${counts.ruler} / 政权 ${counts.regime}`)
check('事件注解条数', has(`**${noteCount} / ${noteCount}（100%）**`), `数据 ${noteCount} 条（事件共 ${events} 条）`)
check('事件覆盖率分母', noteCount === events, `${noteCount} vs ${events}`)
check('生平条数', has(`**${bioCount} / ${bioCount}（100%）**`), `数据 ${bioCount} 位`)
check('原文条数', has(`（${quotes.length} 条）`), `数据 ${quotes.length} 条`)
check('留白登记', has(`/ ${noQuote.length} 留白 /`), `数据 ${noQuote.length} 条`)
check('南北朝 54 帝', has(`南北朝 ${nanbei}`), `数据 ${nanbei} 位`)
check('十国 41 君主', has(`十国 ${tenMonarchs}`), `数据 ${tenMonarchs} 位`)
check('辽夏金 29 君主', has(`辽夏金 ${parRulers}`), `数据 ${parRulers} 位`)

/* ---------- 报告 ---------- */
const failed = checks.filter((c) => !c.ok)
for (const c of checks) console.log(`${c.ok ? '✓' : '✗'} ${c.name}${c.ok ? '' : ` —— ${c.detail}`}`)
console.log(`\n===== 文档数字对账：${checks.length - failed.length}/${checks.length} 通过（${docPath}）=====`)
if (failed.length) {
  console.log('提示：文案要跟着数据改。改完重跑本脚本；别只改数字不改分项。')
  process.exitCode = 1
}
