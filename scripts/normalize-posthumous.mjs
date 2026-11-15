/**
 * 统一七朝谥法口径（2026-11-15 老大拍板）
 * ---------------------------------------------------------------------------
 * 规则：`posthumousRule` 一律写成「本义曰字」，`evaluation` 由该字的谥法类别决定；
 * 取字口径 = 谥号里出现、且《逸周书·谥法解》有本义的单字；
 * 谥号里找不到可取的、或本无谥号（无谥、伪谥、清/金追谥但有争议）→ 只写缘由、评价 neutral。
 *
 * 字表沿用项目里已定稿的周/漢/晋口径（同字不同义时取本朝谥号实际用例），
 * 本轮只补齐七朝，不改周秦汉晋。
 */
import { readFileSync, writeFileSync } from 'node:fs'

/** 字 → [本义, 评价] */
const DICT = {
  文: ['经纬天地', 'good'],
  武: ['克定祸乱', 'good'],
  成: ['安民立政', 'good'],
  康: ['安乐抚民', 'good'],
  昭: ['容仪恭美', 'good'],
  穆: ['布德执义', 'good'],
  宣: ['圣善周闻', 'good'],
  平: ['治而无眚', 'neutral'],
  桓: ['辟土服远', 'good'],
  庄: ['兵甲亟作', 'good'],
  釐: ['质渊受谏', 'neutral'],
  惠: ['柔质慈民', 'good'],
  襄: ['辟地有德', 'good'],
  顷: ['甄心动惧', 'neutral'],
  匡: ['贞心大度', 'good'],
  定: ['纯行不爽', 'good'],
  简: ['一德不懈', 'good'],
  灵: ['乱而不损', 'bad'],
  景: ['由义而济', 'good'],
  敬: ['夙夜警戒', 'good'],
  元: ['能思辩众', 'good'],
  贞: ['清白守节', 'good'],
  哀: ['蚤孤短折', 'neutral'],
  思: ['追悔前过', 'neutral'],
  悼: ['年中早夭', 'neutral'],
  考: ['大虑行节', 'neutral'],
  威: ['猛以刚果', 'good'],
  烈: ['有功安民', 'good'],
  显: ['行见中外', 'good'],
  安: ['好和不争', 'neutral'],
  幽: ['动静乱常', 'bad'],
  厉: ['杀戮无辜', 'bad'],
  夷: ['安心好静', 'neutral'],
  共: ['执事坚固', 'neutral'],
  懿: ['温柔贤善', 'good'],
  孝: ['慈惠爱亲', 'good'],
  明: ['照临四方', 'good'],
  章: ['温克令仪', 'good'],
  和: ['不刚不柔', 'good'],
  顺: ['慈和遍服', 'neutral'],
  冲: ['幼少在位', 'neutral'],
  质: ['名实不爽', 'neutral'],
  怀: ['慈仁短折', 'neutral'],
  愍: ['在国逢难', 'neutral'],
  闵: ['在国逢难', 'neutral'],
  献: ['聪明睿智', 'good'],
  炀: ['去礼远众', 'bad'],
  肃: ['刚德克就', 'good'],
  恭: ['尊贤贵义', 'good'],
  仁: ['蓄义丰功', 'good'],
  高: ['功德盛大', 'good'],
  光: ['能绍前业', 'good'],
  隐: ['隐拂不成', 'bad'],
  神: ['民无能名', 'neutral'],
  宪: ['博闻多能', 'good'],
}

/** 每位帝王取哪个字（谥号里出现、且字表里有） */
const ASSIGN = {
  sui: { sui_wen: '文', sui_yang: '炀', sui_gong: '恭' },
  tang: {
    tang_gaozu: '武',
    tang_taizong: '文',
    tang_gaozong: '孝',
    tang_zhongzong: '和',
    tang_ruizong: '孝',
    tang_xuanzong: '明',
    tang_suzong: '宣',
    tang_daizong: '文',
    tang_dezong: '文',
    tang_shunzong: '安',
    tang_xianzong: '章',
    tang_muzong: '惠',
    tang_jingzong: '愍',
    tang_wenzong: '献',
    tang_wuzong: '肃',
    tang_xuanzong: '仁',
    tang_yizong: '惠',
    tang_xizong: '定',
    tang_zhaozong: '文',
    tang_aidi: '昭',
  },
  five_dynasties: {
    fd_liang_taizu: '武',
    fd_tang_zhuangzong: '闵',
    fd_tang_mingzong: '和',
    fd_tang_min: '闵',
    fd_jin_gaozu: '文',
    fd_han_gaozu: '昭',
    fd_han_yindi: '隐',
    fd_zhou_taizu: '武',
    fd_zhou_shizong: '文',
    fd_zhou_gong: '恭',
  },
  song: {
    song_taizu: '武',
    song_taizong: '文',
    song_zhenzong: '章',
    song_renzong: '明',
    song_yingzong: '宪',
    song_shenzong: '文',
    song_zhezong: '昭',
    song_huizong: '文',
    song_gaozong: '昭',
    song_xiaozong: '成',
    song_guangzong: '顺',
    song_ningzong: '恭',
    song_lizong: '文',
    song_duzong: '景',
  },
  yuan: {
    yuan_shizu: '文',
    yuan_chengzong: '明',
    yuan_wuzong: '宣',
    yuan_renzong: '文',
    yuan_yingzong: '文',
    yuan_wenzong: '明',
    yuan_mingzong: '献',
    yuan_ningzong: '冲',
  },
  ming: {
    ming_taizu: '武',
    ming_chengzu: '文',
    ming_renzong: '昭',
    ming_xuanzong: '章',
    ming_yingzong: '宪',
    ming_daizong: '景',
    ming_xianzong: '武',
    ming_xiaozong: '敬',
    ming_wuzong: '昭',
    ming_shizong: '肃',
    ming_muzong: '庄',
    ming_shenzong: '显',
    ming_guangzong: '贞',
    ming_xizong: '穆',
    ming_sizong: '愍',
  },
  qing: {
    qing_taizu: '武',
    qing_taizong: '文',
    qing_shizu: '章',
    qing_shengzu: '仁',
    qing_shizong: '宪',
    qing_gaozong: '明',
    qing_renzong: '文',
    qing_xuanzong: '成',
    qing_wenzong: '显',
    qing_muzong: '恭',
    qing_dezong: '景',
  },
}

/** 无谥 / 伪谥 / 追谥存疑 → 只写缘由，评价中性 */
const NOTES = {
  tang_wuzetian: '尊号「则天大圣」，非谥法所得',
  fd_liang_yougui: '弑父自立，废为庶人，无谥',
  fd_liang_modi: '无谥，史称末帝',
  fd_tang_modi: '无谥，史称末帝',
  fd_jin_chudi: '无谥，史称出帝',
  song_qinzong: '宋未上谥；金人上谥「恭文顺德仁孝」，本表不取',
  song_gongdi: '无谥，史称恭帝',
  song_duanzong: '无谥，史称端宗',
  song_bing: '无谥，史称帝昺、末帝',
  yuan_taiding: '无汉式谥号，史称泰定帝',
  yuan_tianshun: '无汉式谥号，史称天顺帝',
  yuan_huizong: '明太祖上谥「顺」，故又称元顺帝（平谥，不取）',
  ming_jianwen: '明无谥；清乾隆追谥「恭闵惠皇帝」，本表不取',
  qing_xuantong: '逊位，无谥；史称宣统帝',
}

const DYNASTIES = ['sui', 'tang', 'five_dynasties', 'song', 'yuan', 'ming', 'qing']

let changed = 0
let untouched = 0

for (const dynasty of DYNASTIES) {
  const path = `src/data/emperors.${dynasty}.json`
  const file = JSON.parse(readFileSync(path, 'utf8'))
  for (const e of file.emperors) {
    const char = ASSIGN[dynasty]?.[e.id]
    if (char) {
      const [meaning, evaluation] = DICT[char]
      const rule = `${meaning}曰${char}`
      if (e.posthumousRule !== rule || e.evaluation !== evaluation) {
        e.posthumousRule = rule
        e.evaluation = evaluation
        changed += 1
      }
      continue
    }
    const note = NOTES[e.id]
    if (note) {
      if (e.posthumousRule !== note || e.evaluation !== 'neutral') {
        e.posthumousRule = note
        e.evaluation = 'neutral'
        changed += 1
      }
      continue
    }
    untouched += 1
    console.log(`未覆盖：${e.id}（${e.posthumousTitle}）`)
  }
  writeFileSync(path, JSON.stringify(file, null, 2) + '\n', 'utf8')
}

console.log(`已改写 ${changed} 条；未覆盖 ${untouched} 条`)
