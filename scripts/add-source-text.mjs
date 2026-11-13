/**
 * add-source-text.mjs —— 给六个灭国战报补《史记》原文
 * ---------------------------------------------------------------------------
 * 原文取自《史记·秦始皇本纪》（灭国诸条），个别处参《白起王翦列传》。
 * 每条配一段今译，供悬浮提示使用。
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(fileURLToPath(import.meta.url))
const FILE = join(ROOT, '../src/data/endgame.zhou.json')

const SOURCES = {
  e_han: {
    bookName: '《史记·秦始皇本纪》',
    text: '十七年，内史腾攻韩，得韩王安，尽纳其地，以其地为郡，命曰颍川。',
    translation:
      '秦王政十七年（前 230），内史腾攻韩，俘获韩王安，尽收韩国土地，设为颍川郡。',
  },
  e_zhao: {
    bookName: '《史记·秦始皇本纪》',
    text: '十八年，大兴兵攻赵，王翦将上地，下井陉，端和将河内，羌瘣伐赵，端和围邯郸城。十九年，王翦、羌瘣尽定取赵地东阳，得赵王。',
    translation:
      '十八年（前 229），大举攻赵：王翦率上地之军，攻下井陉；杨端和率河内之军，羌瘣攻赵，合围邯郸。十九年，王翦、羌瘣平定赵地东阳，俘赵王迁。',
  },
  e_wei: {
    bookName: '《史记·秦始皇本纪》',
    text: '二十二年，王贲攻魏，引河沟灌大梁，大梁城坏，其王请降，尽取其地。',
    translation:
      '二十二年（前 225），王贲攻魏，引黄河、鸿沟之水灌大梁，城墙崩塌，魏王假请降，魏地尽为秦有。',
  },
  e_chu: {
    bookName: '《史记·白起王翦列传》',
    text: '王翦果代李信击荆。荆闻王翦益军而来，乃悉国中兵以拒秦。王翦至，坚壁而守之，不肯战……大破荆军。至蕲南，杀其将军项燕，荆兵遂败走。',
    translation:
      '王翦代李信伐楚。楚闻秦增兵，尽起国中兵抵抗。王翦到后坚壁不战，待楚军东撤，纵精兵大破之，追至蕲南，杀楚将项燕，楚军溃败。',
  },
  e_yan: {
    bookName: '《史记·秦始皇本纪》',
    text: '二十五年，大兴兵，使王贲将，攻燕辽东，得燕王喜。',
    translation: '二十五年（前 222），大举出兵，命王贲为将，攻燕辽东，俘燕王喜，燕亡。',
  },
  e_qi: {
    bookName: '《史记·秦始皇本纪》',
    text: '二十六年，齐王建与其相后胜发兵守其西界，不通秦。秦使将军王贲从燕南攻齐，得齐王建。',
    translation:
      '二十六年（前 221），齐王建与相国后胜发兵守西界，不与秦通使。秦命王贲自燕地南下攻齐，俘齐王建，六国至此尽亡。',
  },
}

const data = JSON.parse(readFileSync(FILE, 'utf8'))
let count = 0

data.events = data.events.map((event) => {
  const source = SOURCES[event.id]
  if (!source) {
    console.log(`  缺少原文：${event.id}`)
    return event
  }
  count++
  // 用展开语法保留所有既有字段：显式解构会静默丢掉新增字段（上次就丢了 highlights）
  return { ...event, sourceText: source }
})

writeFileSync(FILE, JSON.stringify(data, null, 2) + '\n', 'utf8')
console.log(`已补 ${count}/${data.events.length} 条史料原文`)
