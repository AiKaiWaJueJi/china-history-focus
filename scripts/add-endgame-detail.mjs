/**
 * 给每个亡国事件补上「灭国前详细情况」与「简要重大事件」
 * ---------------------------------------------------------------------------
 * highlights  用于地图悬浮卡片（2-3 条，一眼抓住要点）
 * detail      用于点击后展开的战报（战前形势 / 战役经过 / 结局）
 *
 * 之前聚焦后战报和简介一模一样，是因为数据里只有一句 report。
 * 这里把叙述拆成三段，聚焦时才真正"有内容可读"。
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(fileURLToPath(import.meta.url))
const FILE = join(ROOT, '../src/data/endgame.zhou.json')

const EXTRA = {
  e_han: {
    highlights: ['内史腾破新郑', '虏韩王安', '置颍川郡'],
    detail: {
      situation:
        '韩为七雄最弱者，地处秦东出之要冲，疆土仅余颍川一隅。韩王安时，国已"地不满千里，兵不过十万"，且屡遭秦蚕食，南阳、上党相继失守。',
      course:
        '前231年，秦以韩国南阳假守内史腾为将，自南阳北向攻韩。韩军不能野战，退守新郑；秦军围城，断其外援。',
      result: '前230年，新郑城破，韩王安出降。秦尽收韩地，置颍川郡，六国之中韩最先亡。',
    },
  },
  e_zhao: {
    highlights: ['王翦破邯郸', '虏赵王迁', '公子嘉奔代'],
    detail: {
      situation:
        '赵经长平之战（前260）后元气大伤，然仍有李牧、司马尚守边，秦军两攻不能下。赵王迁听信谗言，杀李牧、废司马尚，自毁长城。',
      course:
        '前229年，王翦乘赵内乱，自上党、井陉两路并进，直逼邯郸。赵军无帅，节节败退；前228年，邯郸陷落。',
      result:
        '赵王迁被俘，赵亡。公子嘉率宗族数百人北奔代地，自立为代王，直至前222年方为秦所灭。',
    },
  },
  e_wei: {
    highlights: ['王贲引河水灌大梁', '三月城坏', '魏王假出降'],
    detail: {
      situation:
        '魏都大梁城坚池深，四面有鸿沟、黄河环绕，强攻难下。魏自马陵之战后国势日削，至魏王假时已无力野战。',
      course:
        '前225年，王贲不攻坚城，转而引黄河、鸿沟之水灌大梁。水围三月，城墙浸溃崩塌，守军溃散。',
      result: '魏王假出降，魏亡。魏地置砀郡，秦得中原腹心。',
    },
  },
  e_chu: {
    highlights: ['李信轻进先败', '王翦六十万复出', '破寿春虏楚王'],
    detail: {
      situation:
        '楚地五千里，带甲百万，是六国中体量最大者。前225年李信以二十万伐楚，初胜后为项燕所破，秦军损失七都尉——这是秦统一过程中少有的败仗。',
      course:
        '秦王改请王翦，倾国六十万。王翦坚壁不战，日日休士洗沐、与士卒同食，待楚军数挑不得、引兵东退时，方以精兵突袭，大破楚军，追至蕲南，杀项燕。',
      result: '前223年，王翦、蒙武破寿春，虏楚王负刍，楚亡。楚地置楚郡。',
    },
  },
  e_yan: {
    highlights: ['荆轲刺秦旧怨', '燕室东徙辽东', '王贲破辽东'],
    detail: {
      situation:
        '燕太子丹曾遣荆轲刺秦王，事败后秦大举攻燕。前226年，燕都蓟城陷落，燕王喜与太子丹率残部东走辽东，杀太子丹以献秦，求得暂安。',
      course:
        '前222年，王贲率军自右北平东进，追击至辽东，燕军已无退路，残部一战即溃。',
      result: '燕王喜被俘，燕亡。辽东入秦，置辽东郡。',
    },
  },
  e_qi: {
    highlights: ['后胜受金误国', '四十余年不修攻战', '齐王建不战而降'],
    detail: {
      situation:
        '齐自五国伐齐（前284）后一蹶不振。齐王建在位四十余年，齐相后胜受秦重金，日劝齐王勿备，故齐始终不修攻战、不助五国，坐视秦灭他国。',
      course:
        '前221年，王贲灭燕后自燕南下，绕过齐西境防线，直趋临淄。齐军久不习战，未及列阵而溃。',
      result: '齐王建不战而降，齐亡。秦以齐地置齐郡、琅琊郡，六国至此尽入秦图。',
    },
  },
}

const data = JSON.parse(readFileSync(FILE, 'utf8'))
let count = 0

data.events = data.events.map((event) => {
  const extra = EXTRA[event.id]
  if (!extra) {
    console.log(`  缺少补充数据：${event.id}`)
    return event
  }
  count++
  return { ...event, highlights: extra.highlights, detail: extra.detail }
})

writeFileSync(FILE, JSON.stringify(data, null, 2) + '\n', 'utf8')
console.log(`已补充 ${count}/${data.events.length} 个事件的详细战报与要点`)
