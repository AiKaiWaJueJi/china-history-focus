/**
 * add-evaluations.mjs —— 给周天子加谥法评价
 * ===========================================================================
 * 依据：《逸周书·谥法解》的美/平/恶三类。
 * 我们不按"后世功过"打分，只按谥字本身的制度含义归类——
 * 所以会出现"昭王南征不返，却因'容仪恭美曰昭'而列美谥"这类张力，
 * 这正是想让人看见的：制度给的评价，与历史给出的结局，并不总是一回事。
 *
 * 字段：
 *   evaluation       'good' | 'neutral' | 'bad'
 *   posthumousRule   谥法本义（卡片上的小字）
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const FILE = join(dirname(fileURLToPath(import.meta.url)), '../src/data/emperors.zhou.json')

/** 谥字 → [评价, 谥法本义] */
const RULES = {
  武: ['good', '克定祸乱曰武'],
  成: ['good', '安民立政曰成'],
  康: ['good', '安乐抚民曰康'],
  昭: ['good', '容仪恭美曰昭'],
  穆: ['good', '布德执义曰穆'],
  共: ['neutral', '执事坚固曰共'],
  懿: ['good', '温柔贤善曰懿'],
  孝: ['good', '慈惠爱亲曰孝'],
  夷: ['neutral', '安心好静曰夷'],
  厉: ['bad', '杀戮无辜曰厉'],
  宣: ['good', '圣善周闻曰宣'],
  幽: ['bad', '动静乱常曰幽'],
  平: ['neutral', '治而无眚曰平'],
  桓: ['good', '辟土服远曰桓'],
  庄: ['good', '兵甲亟作曰庄'],
  釐: ['neutral', '质渊受谏曰釐'],
  惠: ['good', '柔质慈民曰惠'],
  襄: ['good', '辟地有德曰襄'],
  顷: ['neutral', '甄心动惧曰顷'],
  匡: ['good', '贞心大度曰匡'],
  定: ['good', '纯行不爽曰定'],
  简: ['good', '一德不懈曰简'],
  灵: ['bad', '乱而不损曰灵'],
  景: ['good', '由义而济曰景'],
  悼: ['neutral', '年中早夭曰悼'],
  敬: ['good', '夙夜警戒曰敬'],
  元: ['good', '能思辩众曰元'],
  贞: ['good', '清白守节曰贞'],
  哀: ['bad', '蚤孤短折曰哀'],
  思: ['neutral', '追悔前过曰思'],
  考: ['neutral', '大虑行节曰考'],
  威: ['good', '猛以刚果曰威'],
  烈: ['good', '有功安民曰烈'],
  安: ['neutral', '好和不争曰安'],
  显: ['good', '行见中外曰显'],
  慎: ['neutral', '敏以敬慎曰慎'],
  靓: ['neutral', '小心畏忌曰靓'],
  赧: ['bad', '赧非谥法正字，后世以其亡国而名之'],
}

/** 从"周贞定王"这类称谓里取出谥字序列 */
const chars = (title) => title.replace(/^周/, '').replace(/王$/, '').split('')

const data = JSON.parse(readFileSync(FILE, 'utf8'))
const tally = { good: 0, neutral: 0, bad: 0 }
const unknown = []

for (const emperor of data.emperors) {
  const cs = chars(emperor.posthumousTitle)
  // 取第一个能识别的谥字（贞定取贞、威烈取威、慎靓取慎）
  const hit = cs.map((c) => [c, RULES[c]]).find(([, rule]) => rule)
  if (!hit) {
    unknown.push(emperor.posthumousTitle)
    emperor.evaluation = 'neutral'
    emperor.posthumousRule = ''
    tally.neutral += 1
    continue
  }
  const [char, [evaluation, rule]] = hit
  emperor.evaluation = evaluation
  emperor.posthumousRule = rule
  tally[evaluation] += 1
  if (cs.length > 1) {
    // 双字谥（贞定、威烈、慎靓）：把第二个字也记下来，便于核对
    console.log(`  ${emperor.posthumousTitle} → 取「${char}」：${rule}`)
  }
}

writeFileSync(FILE, JSON.stringify(data, null, 2) + '\n', 'utf8')
console.log(`\n完成：${data.emperors.length} 位`, tally)
if (unknown.length) console.log('未识别：', unknown.join('、'))
