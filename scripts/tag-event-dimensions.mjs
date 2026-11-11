/**
 * 给周朝事件补充 dimension 字段（military / political / culture）
 * ---------------------------------------------------------------------------
 * 上下思维导图要按"军事成就 / 政治文教"分组展示，因此事件需要显式维度。
 * 这里用一张**显式的 id → 维度映射表**，而不是靠关键词猜：
 * 数据一旦交给别人维护，关键词匹配会悄悄错分，映射表则是可逐条 review 的。
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(fileURLToPath(import.meta.url))
const FILE = join(ROOT, '../src/data/emperors.zhou.json')

const DIM = {
  // —— 军事：战争、征伐、兵乱 ——
  e_muye: 'military',
  e_sanjian: 'military',
  e_zhaonan: 'military',
  e_hanshui: 'military',
  e_xizheng: 'military',
  e_mie_mi: 'military',
  e_quanrong: 'military',
  e_guoren: 'military',
  e_qianmu: 'military',
  e_quanrong_po: 'military',
  e_wangzi_tui: 'military',
  e_wangzi_dai: 'military',
  e_chengpu: 'military',
  e_wangshi_neiluan: 'military',
  e_jinchu: 'military',
  e_bi_zhi_zhan: 'military',
  e_an_zhan: 'military',
  e_wangzi_chao: 'military',
  e_wangzi_chao_2: 'military',
  e_ping_chao: 'military',
  e_wuyue: 'military',
  e_yue_mie_wu: 'military',
  e_jinyang: 'military',
  e_sanjia_miezhi: 'military',
  e_sanjin_fa_qi: 'military',
  e_guiling: 'military',
  e_maling: 'military',
  e_wuguo_faqin: 'military',
  e_changping: 'military',
  e_qin_mie_zhou: 'military',
  e_xuge: 'military',

  // —— 政治：制度、君位、会盟、内政 ——
  e_ke_shang: 'political',
  e_fengjian: 'political',
  e_zhougong: 'political',
  e_luoyi: 'political',
  e_chengkang: 'political',
  e_dafeng: 'political',
  e_lvxing: 'political',
  e_wangshi_shuai: 'political',
  e_feng_fei: 'political',
  e_muma: 'political',
  e_peng_qi: 'political',
  e_zhuhou_buchao: 'political',
  e_zhuanli: 'political',
  e_gonghe: 'political',
  e_xuan_zhongxing: 'political',
  e_bujie: 'political',
  e_fei_di: 'political',
  e_xi_zhou_wang: 'political',
  e_dongqian: 'political',
  e_wanggang: 'political',
  e_huan_gong: 'political',
  e_ju_zhi_hui: 'political',
  e_zunwang: 'political',
  e_kuqiu: 'political',
  e_jiantu: 'political',
  e_wen_ding: 'political',
  e_mibing_1: 'political',
  e_mibing_2: 'political',
  e_chu_ling_hui: 'political',
  e_zhu_daqian: 'political',
  e_dao_yuhai: 'political',
  e_zhanguo: 'political',
  e_ai_beisha: 'political',
  e_si_shixiong: 'political',
  e_feng_di: 'political',
  e_xi_zhou_huan: 'political',
  e_sanjia_fenjin: 'political',
  e_jiuding_zhen: 'political',
  e_tian_dai_qi: 'political',
  e_zhoushi_yishuai: 'political',
  e_zhuhou_buchao_2: 'political',
  e_shangyang: 'political',
  e_hezong: 'political',
  e_zhou_fenlie: 'political',

  // —— 文教 ——
  e_kongzi: 'culture',
  e_xunshou: 'culture',
}

const data = JSON.parse(readFileSync(FILE, 'utf8'))

let touched = 0
const missing = []

for (const emperor of data.emperors) {
  for (const event of emperor.events) {
    const dimension = DIM[event.id]
    if (!dimension) {
      missing.push(`${emperor.posthumousTitle} / ${event.name} (${event.id})`)
      continue
    }
    event.dimension = dimension
    touched++
  }
}

// 重新排序每个 event 的键，确保 JSON 可读且稳定
for (const emperor of data.emperors) {
  emperor.events = emperor.events.map((event) => ({
    id: event.id,
    name: event.name,
    dimension: event.dimension,
    year: event.year,
  }))
}

data.note =
  '本文件为阶段二「单朝代测试数据」：完整覆盖西周 12 王与东周 25 王，共 37 位。events 按 dimension 分为 military（军事）/ political（政治）/ culture（文教），用于上下思维导图分组；为要点摘录，非学术级编年。'

writeFileSync(FILE, JSON.stringify(data, null, 2) + '\n', 'utf8')

console.log(`已标注 ${touched} 条事件的维度`)
if (missing.length) {
  console.log('缺失维度：')
  for (const m of missing) console.log('  - ' + m)
  process.exitCode = 1
}
