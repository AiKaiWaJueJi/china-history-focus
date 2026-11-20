/**
 * enrich-nanbei.mjs —— 给南北朝 54 帝补「皇帝模块」所需字段 + 生成占位画像
 * ---------------------------------------------------------------------------
 * 做的事（只跑一次，结果直接写回 src/data/nanbei.json）：
 *   1. 每位帝王补 reign / portrait / events[] / posthumousRule（与周秦汉晋同构）；
 *   2. 生成 public/portraits/nanbei-<id>.svg（程序化占位画像，按行分色、冕旒分级）。
 *
 * 事件口径：dimension 只取 military / political / culture，
 * 年份取事件发生年（不是在位年），每人 2—4 条，卡片浮层用。
 * 谥法口径：依《逸周书·谥法解》；王/侯/主/少帝这类"史称"无谥，写明缘由。
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(fileURLToPath(import.meta.url))
const PROJECT = join(ROOT, '..')
const DATA_FILE = join(PROJECT, 'src/data/nanbei.json')
const OUT_DIR = join(PROJECT, 'public/portraits')

const data = JSON.parse(readFileSync(DATA_FILE, 'utf8'))

/* -------------------------------------------------------------------------- */
/* 事件与谥法                                                                  */
/* [事件名, 维度, 年份]                                                        */
/* -------------------------------------------------------------------------- */

const M = 'military'
const P = 'political'
const C = 'culture'

const TABLE = {
  song_wu: [['灭南燕', M, 409], ['灭后秦', M, 417], ['代晋建宋', P, 420]],
  song_shao: [['居丧无礼', P, 422], ['被废遇弑', P, 424]],
  song_wen: [['元嘉之治', P, 425], ['元嘉北伐', M, 430], ['立国子学', C, 438]],
  song_shao2: [['巫蛊事发', P, 452], ['弑父自立', P, 453], ['一月而诛', M, 453]],
  song_xiaowu: [['起兵讨劭', M, 453], ['剪抑宗室', P, 455], ['大明改制', P, 458]],
  song_qianfei: [['狂悖失德', P, 465], ['被弑于华林园', P, 465]],
  song_ming: [['平定义嘉之乱', M, 466], ['泰始方镇之制', P, 467]],
  song_houfei: [['荒暴日甚', P, 474], ['被弑', P, 477]],
  song_shun: [['萧道成辅政', P, 477], ['禅位于齐', P, 479]],

  qi_gao: [['代宋建齐', P, 479], ['节俭革弊', P, 480]],
  qi_wu: [['永明之治', P, 483], ['永明体诗', C, 487]],
  qi_yulin: [['奢纵嬉游', P, 493], ['被废', P, 494]],
  qi_hailing: [['立而旋废', P, 494]],
  qi_ming: [['屠宗自立', P, 494], ['北魏南伐', M, 495]],
  qi_donghun: [['诛戮大臣', P, 499], ['建康被围', M, 501]],
  qi_he: [['江陵称帝', P, 501], ['禅位于梁', P, 502]],

  liang_wu: [['代齐建梁', P, 502], ['天监之治', P, 505], ['舍身同泰寺', C, 527], ['侯景之乱', M, 548]],
  liang_jianwen: [['侯景挟制', P, 549], ['宫体诗风', C, 540], ['被废遇害', P, 551]],
  liang_dong: [['侯景所立', P, 551], ['被废', P, 551]], // 551 年十一月侯景即逼其禅位，在位不足三月
  liang_yuan: [['平侯景', M, 552], ['江陵陷落', M, 554], ['江陵焚书', C, 554]],
  liang_yuanming: [['北齐护送南归', P, 555], ['旋废', P, 555]],
  liang_jing: [['陈霸先辅政', P, 555], ['禅位于陈', P, 557]],

  chen_wu: [['讨平侯景', M, 552], ['击退北齐', M, 556], ['代梁建陈', P, 557]],
  chen_wen: [['天嘉之治', P, 560], ['平定王琳', M, 560]],
  chen_fei: [['年幼即位', P, 566], ['被废', P, 568]],
  chen_xuan: [['太建北伐', M, 573], ['吕梁之败', M, 578]],
  chen_houzhu: [['玉树后庭花', C, 584], ['隋军渡江', M, 588], ['建康陷落', M, 589]],

  wei_mingyuan: [['承拓跋珪基业', P, 420], ['南巡道卒', P, 423]],
  wei_taiwu: [['灭赫连夏', M, 427], ['灭北燕', M, 436], ['灭北凉统一北方', M, 439], ['太武灭佛', C, 446]],
  wei_nanan: [['阉宦拥立', P, 452], ['旋被弑', P, 452]],
  wei_wencheng: [['复兴佛法', C, 452], ['开凿云冈石窟', C, 460]],
  wei_xianwen: [['幼年即位', P, 465], ['禅位太子', P, 471]],
  wei_xiaowen: [['迁都洛阳', P, 494], ['汉化改制', P, 495], ['亲征南伐', M, 497]],
  wei_xuanwu: [['景明之治', P, 500], ['洛阳伽蓝之盛', C, 509]],
  wei_xiaoming: [['胡太后临朝', P, 515], ['六镇之乱', M, 523], ['密召尔朱荣', P, 528]],
  wei_xiaozhuang: [['河阴之变', P, 528], ['诛尔朱荣', P, 530], ['被缢于晋阳', P, 530]],
  wei_changguang: [['尔朱氏所立', P, 530], ['被废', P, 531]],
  wei_jiemin: [['尔朱世隆拥立', P, 531], ['被废遇害', P, 532]],
  wei_xiaowu: [['高欢拥立', P, 532], ['西奔关中', P, 534]],

  dongwei_jing: [['高欢挟迁邺', P, 534], ['禅位北齐', P, 550]],

  beiqi_wenxuan: [['代东魏建齐', P, 550], ['破柔然山胡', M, 553], ['后期酗暴', P, 556]],
  beiqi_fei: [['幼年即位', P, 559], ['被废', P, 560]],
  beiqi_xiaozhao: [['夺位自立', P, 560], ['坠马而卒', P, 561]],
  beiqi_wucheng: [['杀侄自立', P, 561], ['禅位后主', P, 565]],
  beiqi_houzhu: [['诛斛律光', P, 572], ['晋阳失守', M, 577], ['被俘于青州', M, 577]],
  beiqi_youzhu: [['仓促即位', P, 577], ['出逃被俘', M, 577]],

  xiwei_wen: [['宇文泰立帝关中', P, 535], ['沙苑之战', M, 537], ['府兵制初立', M, 550]],
  xiwei_fei: [['谋诛宇文泰', P, 554], ['被废', P, 554]],
  xiwei_gong: [['宇文泰立帝', P, 554], ['禅位北周', P, 557]],

  beizhou_xiaomin: [['受禅建周', P, 557], ['被废遇害', P, 557]],
  beizhou_ming: [['明帝之治', P, 558], ['被鸩', P, 560]],
  beizhou_wu: [['诛宇文护', P, 572], ['建德毁佛', C, 574], ['灭北齐', M, 577]],
  beizhou_xuan: [['荒淫暴虐', P, 578], ['禅位幼主', P, 579]],
  beizhou_jing: [['幼主即位', P, 579], ['禅位于隋', P, 581]],
}

const RULE = {
  song_wu: '克定祸乱曰武',
  song_shao: '无谥，史称少帝',
  song_wen: '经纬天地曰文',
  song_shao2: '无谥，史称元凶劭',
  song_xiaowu: '五宗安之曰孝，克定祸乱曰武',
  song_qianfei: '去礼远众曰废',
  song_ming: '照临四方曰明',
  song_houfei: '去礼远众曰废',
  song_shun: '慈和遍服曰顺',

  qi_gao: '功德盛大曰高',
  qi_wu: '克定祸乱曰武',
  qi_yulin: '无谥，史称郁林王',
  qi_hailing: '无谥，史称海陵王',
  qi_ming: '照临四方曰明',
  qi_donghun: '无谥，史称东昏侯',
  qi_he: '不刚不柔曰和',

  liang_wu: '克定祸乱曰武',
  liang_jianwen: '壹德不解曰简，经纬天地曰文',
  liang_dong: '无谥，史称豫章王',
  liang_yuan: '能思辩众曰元',
  liang_yuanming: '无谥，史称贞阳侯',
  liang_jing: '夙夜警戒曰敬',

  chen_wu: '克定祸乱曰武',
  chen_wen: '经纬天地曰文',
  chen_fei: '去礼远众曰废',
  chen_xuan: '圣善周闻曰宣',
  chen_houzhu: '无谥，史称后主',

  wei_mingyuan: '照临四方曰明，能思辩众曰元',
  wei_taiwu: '克定祸乱曰武',
  wei_nanan: '无谥，史称南安王',
  wei_wencheng: '安民立政曰成',
  wei_xianwen: '无谥，史称献文帝',
  wei_xiaowen: '五宗安之曰孝，经纬天地曰文',
  wei_xuanwu: '圣善周闻曰宣',
  wei_xiaoming: '照临四方曰明',
  wei_xiaozhuang: '胜敌志强曰庄',
  wei_changguang: '无谥，史称长广王',
  wei_jiemin: '好廉自克曰节，在国遭忧曰愍',
  wei_xiaowu: '五宗安之曰孝，克定祸乱曰武',

  dongwei_jing: '柔德考众曰静',

  beiqi_wenxuan: '经纬天地曰文，圣善周闻曰宣',
  beiqi_fei: '去礼远众曰废',
  beiqi_xiaozhao: '五宗安之曰孝，容仪恭美曰昭',
  beiqi_wucheng: '克定祸乱曰武，安民立政曰成',
  beiqi_houzhu: '无谥，史称后主',
  beiqi_youzhu: '无谥，史称幼主',

  xiwei_wen: '经纬天地曰文',
  xiwei_fei: '去礼远众曰废',
  xiwei_gong: '执事坚固曰恭',

  beizhou_xiaomin: '五宗安之曰孝，在国遭忧曰愍',
  beizhou_ming: '照临四方曰明',
  beizhou_wu: '克定祸乱曰武',
  beizhou_xuan: '圣善周闻曰宣',
  beizhou_jing: '柔德安众曰静',
}

/* -------------------------------------------------------------------------- */
/* 行 → 配色（与 nanbei.css 的 --row-accent 对齐）                             */
/* -------------------------------------------------------------------------- */

const ROW_ACCENT = {
  beiwei: { soft: '185,219,191', deep: '#5f7a6a' },
  dong: { soft: '214,183,138', deep: '#8a6a45' },
  xi: { soft: '196,170,201', deep: '#6f5a72' },
  nan: { soft: '176,204,224', deep: '#4f6f86' },
}

const polityRow = new Map(data.polities.map((p) => [p.id, p.row]))

/* -------------------------------------------------------------------------- */
/* 占位画像：冕旒分级 + 行分色                                                  */
/* -------------------------------------------------------------------------- */

/** 冕旒根数：皇帝 12 旒，短祚/末帝减等，纯视觉区分 */
function portraitSvg(emperor) {
  const row = polityRow.get(emperor.polity) ?? 'nan'
  const accent = ROW_ACCENT[row] ?? ROW_ACCENT.nan
  const soft = accent.soft
  const shortReign = emperor.end - emperor.start <= 2
  const beads = shortReign ? 5 : 7

  const beadRow = Array.from({ length: beads }, (_, i) => {
    const x = -42 + (84 / (beads - 1)) * i
    return `<circle cx="${x.toFixed(1)}" cy="96" r="2.1" fill="rgba(${soft},0.55)"/>`
  }).join('')

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 520" width="420" height="520">
  <defs>
    <linearGradient id="pbg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0b0d11"/>
      <stop offset="55%" stop-color="rgba(${soft},0.26)"/>
      <stop offset="100%" stop-color="#07090b"/>
    </linearGradient>
    <radialGradient id="pglow" cx="50%" cy="34%" r="48%">
      <stop offset="0%" stop-color="rgba(${soft},0.42)"/>
      <stop offset="100%" stop-color="rgba(${soft},0)"/>
    </radialGradient>
    <linearGradient id="robe" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="rgba(${soft},0.32)"/>
      <stop offset="100%" stop-color="rgba(${soft},0.1)"/>
    </linearGradient>
    <linearGradient id="pbg2" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="rgba(6,8,10,0)"/>
      <stop offset="100%" stop-color="rgba(6,8,10,0.88)"/>
    </linearGradient>
  </defs>

  <rect width="420" height="520" fill="url(#pbg)"/>
  <ellipse cx="210" cy="170" rx="190" ry="170" fill="url(#pglow)"/>

  <g transform="translate(213 0)" opacity="0.94">
    <!-- 冕板 -->
    <rect x="-52" y="82" width="104" height="10" rx="3" fill="rgba(${soft},0.44)"/>
    <rect x="-34" y="70" width="68" height="12" rx="3" fill="rgba(${soft},0.34)"/>
    <rect x="-16" y="58" width="32" height="12" rx="3" fill="rgba(${soft},0.24)"/>
    <!-- 旒 -->
    ${beadRow}
    <!-- 头与袍 -->
    <ellipse cx="0" cy="152" rx="33" ry="41" fill="rgba(${soft},0.3)"/>
    <path d="M-89 300 Q-70 196 0 190 Q70 196 89 300 L97 520 L-97 520 Z" fill="url(#robe)"/>
    <path d="M-30 200 L0 300 L30 200" fill="none" stroke="rgba(${soft},0.3)" stroke-width="2.5"/>
    <path d="M-14 196 L-14 300 M14 196 L14 300" stroke="rgba(${soft},0.14)" stroke-width="2"/>
  </g>

  <rect y="380" width="420" height="140" fill="url(#pbg2)"/>
</svg>
`
}

/* -------------------------------------------------------------------------- */

mkdirSync(OUT_DIR, { recursive: true })

let portraitCount = 0
const missing = []

for (const emperor of data.emperors) {
  const events = TABLE[emperor.id]
  if (!events) missing.push(emperor.id)

  emperor.reign = `${emperor.start} — ${emperor.end}`
  emperor.portrait = `/portraits/nanbei-${emperor.id}.svg`
  emperor.events = (events ?? []).map(([name, dimension, year], i) => ({
    id: `ev_${emperor.id}_${i + 1}`,
    name,
    dimension,
    year,
  }))
  const rule = RULE[emperor.id]
  if (rule) emperor.posthumousRule = rule.replace(/\n+/g, '')

  // 占位画像
  writeFileSync(join(OUT_DIR, `nanbei-${emperor.id}.svg`), portraitSvg(emperor), 'utf8')
  portraitCount += 1
}

writeFileSync(DATA_FILE, JSON.stringify(data, null, 2) + '\n', 'utf8')

console.log(`帝王 ${data.emperors.length} 位，画像 ${portraitCount} 张`)
if (missing.length) console.log('缺少事件：', missing.join(', '))
const noRule = data.emperors.filter((e) => !e.posthumousRule).map((e) => e.id)
if (noRule.length) console.log('缺少谥法：', noRule.join(', '))
