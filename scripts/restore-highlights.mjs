/**
 * restore-highlights.mjs —— 修复被 add-source-text.mjs 误删的 highlights 字段
 * ---------------------------------------------------------------------------
 * 上一版补 sourceText 时用了显式字段解构，漏掉了 highlights，
 * 导致悬浮卡片取 highlights.map 时崩掉。这里补回来，并把脚本改用展开语法，
 * 以后新增字段不会再丢。
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(fileURLToPath(import.meta.url))
const FILE = join(ROOT, '../src/data/endgame.zhou.json')

const HIGHLIGHTS = {
  e_han: ['内史腾破新郑', '虏韩王安', '置颍川郡'],
  e_zhao: ['王翦破邯郸', '虏赵王迁', '公子嘉奔代'],
  e_wei: ['王贲引河水灌大梁', '三月城坏', '魏王假出降'],
  e_chu: ['李信轻进先败', '王翦六十万复出', '破寿春虏楚王'],
  e_yan: ['荆轲刺秦旧怨', '燕室东徙辽东', '王贲破辽东'],
  e_qi: ['后胜受金误国', '四十余年不修攻战', '齐王建不战而降'],
}

const data = JSON.parse(readFileSync(FILE, 'utf8'))
let fixed = 0

data.events = data.events.map((event) => {
  if (Array.isArray(event.highlights)) return event
  const list = HIGHLIGHTS[event.id]
  if (!list) {
    console.log(`  缺少要点：${event.id}`)
    return event
  }
  fixed++
  // 保持字段顺序：brief → highlights → report → detail → figures → sourceText
  const { id, order, nationId, target, year, yearValue, desc, brief, report, detail, figures, sourceText } = event
  return { id, order, nationId, target, year, yearValue, desc, brief, highlights: list, report, detail, figures, sourceText }
})

writeFileSync(FILE, JSON.stringify(data, null, 2) + '\n', 'utf8')
console.log(`已补回 ${fixed}/${data.events.length} 条 highlights`)
