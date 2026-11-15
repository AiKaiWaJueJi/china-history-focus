/** 审计现有谥法口径：把所有 emperors.*.json 里「本义曰字」抽出来，统计字 → 评价分布 */
import { readFileSync } from 'node:fs'

const IDS = ['zhou', 'qin', 'han', 'jin', 'sui', 'tang', 'five_dynasties', 'song', 'yuan', 'ming', 'qing']
const table = new Map()

for (const id of IDS) {
  const file = JSON.parse(readFileSync(`src/data/emperors.${id}.json`, 'utf8'))
  for (const e of file.emperors) {
    const rule = e.posthumousRule ?? ''
    const m = rule.match(/^([^（(，。；：]+)曰([\u4e00-\u9fa5]{1,2})/)
    if (!m) {
      if (!table.has('__unparsed__')) table.set('__unparsed__', [])
      table.get('__unparsed__').push(`${e.id} :: ${rule}`)
      continue
    }
    const meaning = m[1]
    const char = m[2]
    if (!table.has(char)) table.set(char, { meaning, evals: {}, ids: [] })
    const row = table.get(char)
    row.evals[e.evaluation] = (row.evals[e.evaluation] ?? 0) + 1
    if (!row.meaning.includes(meaning)) row.meaning = `${row.meaning} / ${meaning}`
    row.ids.push(e.id)
  }
}

const rows = [...table.entries()].filter(([k]) => k !== '__unparsed__')
rows.sort((a, b) => b[1].ids.length - a[1].ids.length)
console.log(`可用字 ${rows.length} 个：`)
for (const [char, row] of rows) {
  console.log(`${char}\t${row.meaning}\t${JSON.stringify(row.evals)}\t${row.ids.slice(0, 3).join(',')}`)
}
console.log('\n未按「本义曰字」写的：')
for (const line of table.get('__unparsed__') ?? []) console.log(' -', line)
