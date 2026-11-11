/**
 * 给诸侯补充「称霸期」 hegemonyStart / hegemonyEnd
 * ---------------------------------------------------------------------------
 * 之前用"在位年份"做时间联动，会失准：
 *   齐桓公前685年即位，但真正称霸是前679年鄄之会之后。
 * 用称霸期求交，才能回答"此刻谁在中原称霸"这个真正的历史问题。
 *
 * 取值依据（均为该政权霸权确立到终结的关键节点）：
 *   齐桓  — 鄄之会始霸（前679）→ 卒（前643）
 *   晋文  — 城濮之战·践土之盟（前632）→ 卒（前628）
 *   楚庄  — 问鼎中原（前606）→ 卒（前591）
 *   吴阖闾 — 柏举之战入郢（前506）→ 卒（前496）
 *   越勾践 — 灭吴北上会盟（前473）→ 卒（前465）
 *   战国七雄无严格"霸"，取各国变法图强 / 强势期的起止。
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(fileURLToPath(import.meta.url))
const FILE = join(ROOT, '../src/data/lords.zhou.json')

const HEGEMONY = {
  lord_qi: [-679, -643, '鄄之会始霸'],
  lord_jin: [-632, -628, '城濮之战·践土之盟'],
  lord_chu: [-606, -591, '问鼎中原'],
  lord_wu: [-506, -496, '柏举之战入郢'],
  lord_yue: [-473, -465, '灭吴北上会盟'],
  lord_qin_sg: [-356, -338, '商鞅变法图强'],
  lord_chu_sg: [-386, -381, '吴起变法'],
  lord_qi_sg: [-353, -320, '桂陵·马陵之胜'],
  lord_yan: [-311, -279, '黄金台招贤至破齐'],
  lord_zhao: [-307, -295, '胡服骑射'],
  lord_wei: [-406, -396, '李悝变法首强'],
  lord_han: [-351, -333, '申不害变法'],
}

const data = JSON.parse(readFileSync(FILE, 'utf8'))
let count = 0

data.lords = data.lords.map((lord) => {
  const entry = HEGEMONY[lord.id]
  if (!entry) {
    console.log(`  缺少称霸期：${lord.id}`)
    return lord
  }
  const [hegemonyStart, hegemonyEnd, note] = entry
  count++
  // 保持字段顺序稳定，便于 diff
  return {
    id: lord.id,
    state: lord.state,
    title: lord.title,
    personalName: lord.personalName,
    era: lord.era,
    startYear: lord.startYear,
    endYear: lord.endYear,
    reign: lord.period,
    hegemonyStart,
    hegemonyEnd,
    hegemonyNote: note,
    segmentId: lord.segmentId,
    accent: lord.accent,
    portrait: lord.portrait,
    events: lord.events,
  }
})

data.note =
  '春秋五霸取『齐桓、晋文、楚庄、吴阖闾、越勾践』一说；战国七雄各取一位代表君主。' +
  'startYear/endYear 为在位年份，hegemonyStart/hegemonyEnd 为称霸（强势）期，时间联动以后者为准。events 为要点摘录。'

writeFileSync(FILE, JSON.stringify(data, null, 2) + '\n', 'utf8')
console.log(`已为 ${count}/${data.lords.length} 位诸侯补上称霸期`)
