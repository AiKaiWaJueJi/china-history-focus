/**
 * merge-sandbox-history.cjs —— 把史实考证稿的行军序列合并进七盘沙盘数据
 * ===========================================================================
 * 考证稿：scripts/data/sandbox-history.json（按《旧唐书》《通鉴》《宋史》
 * 《元史》《明史》《清史稿》逐条核对，含 34 幕 / 114 段行军 / 50 条纠错）。
 *
 * 本脚本只做三件事：
 *   1. 把 campaigns 换成考证稿的版本（战报正文、人物、原文沿用项目原有内容）；
 *   2. 按考证稿修正年份等硬错（如辅公祏 623→624、关中 1368→1369）；
 *   3. 插入原数据缺掉的关键一幕（618 浅水原，唐统一战争的第一战）。
 * campaigns 的坐标不在这里算——points 留空，由 scripts/fix-campaign-geo.mjs
 * 按地名统一投影成百分比坐标。
 *
 * 可重复运行（已有的一幕不会重复插入）。
 * 用法：node scripts/merge-sandbox-history.cjs
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const H = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'sandbox-history.json'), 'utf8'))

/** 地名清洗：去掉括注、统一异名、丢弃「军门/营垒」这类非地理点 */
const DROP = new Set([
  '唐军军门', '元军军门', '宋军军门', '清军大营', '城门', '汉水', '淮、泗',
  '洛阳外围', '襄阳前线', '重庆城内', '武昌城内', '江陵城外', '江陵水城',
  '浅水原南', '浅水原北', '汜水东原', '正阳东', '潮阳港', '三江寨', '鲍浦寨',
  '翁后', '辽河', '湖北军政府', '楚望台', '湖广总督署', '湖北省谘议局',
])
const ALIAS = {
  大梁: '汴州',
  汴梁: '汴州',
  燕京: '北京',
  河南: '洛阳', // 考证稿写「河南（洛阳）」
  武牢: '虎牢',
  虎牢关: '虎牢',
  采石矶: '采石',
  襄州: '襄阳',
  镇州: '真定',
  会稽: '绍兴',
  清军大营: '山海关',
  平江: '苏州',
  洛水北: '洛阳',
  武汉: '武昌',
  武昌城内: '武昌',
  重庆城内: '重庆',
  湖广: '武昌',
  澶州: '濮阳',
}

function norm(name) {
  if (!name) return null
  let s = String(name).replace(/（[^）]*）/g, '').replace(/\([^)]*\)/g, '').trim()
  if (!s || DROP.has(s)) return null
  if (ALIAS[s]) s = ALIAS[s]
  return s
}

/** 每盘：现有事件 id → 考证稿里用它 campaigns 的事件 id 列表（可多幕合并） */
const MAP = {
  sui: {
    ev_sui_xqin: ['ev_sui_xqin'],
    ev_sui_dingyang: ['ev_sui_dingyang'],
    ev_sui_xia: ['ev_sui_xia'],
    ev_sui_zheng: ['ev_sui_zheng'],
    ev_sui_liang: ['ev_sui_liang'],
    ev_sui_wu: ['ev_sui_song'],
  },
  tang: {
    ev_tang_yan: ['ev_tang_yan'],
    ev_tang_liang: ['ev_tang_liang'],
    ev_tang_qi: ['ev_tang_qi'],
    ev_tang_shu: ['ev_tang_shu'],
  },
  five_dynasties: {
    ev_fd_jingnan: ['ev_fd_jingnan'],
    ev_fd_houshu: ['ev_fd_houshu'],
    ev_fd_nanhan: ['ev_fd_nanhan'],
    ev_fd_nantang: ['ev_fd_nantang'],
    ev_fd_wuyue: ['ev_fd_wuyue'],
    ev_fd_beihan: ['ev_fd_beihan'],
  },
  song: {
    ev_song_xiangyang: ['ev_song_xiangyang', 'ev_song_jiang'], // 襄阳围城 + 顺汉水入江
    ev_song_linan: ['ev_song_linan'],
    ev_song_sichuan: ['ev_song_sichuan'],
    ev_song_yashan: ['ev_song_yashan'],
  },
  yuan: {
    ev_yuan_dadu: ['ev_yuan_dadu'],
    ev_yuan_guanzhong: ['ev_yuan_guanzhong'],
    ev_yuan_xia: ['ev_yuan_xia'],
    ev_yuan_liang: ['ev_yuan_yunnan'],
  },
  ming: {
    ev_ming_dashun: ['ev_ming_dashun'],
    ev_ming_nanming: ['ev_ming_nanming'],
    ev_ming_daxi: ['ev_ming_daxi'],
  },
  qing: {
    ev_qing_chuandian: ['ev_qing_chuandian'],
    ev_qing_wuchang: ['ev_qing_nanjing'], // 东南各省光复（南京克复）
    ev_qing_beiyang: ['ev_qing_yangxia'], // 阳夏之战（北洋南下）
    ev_qing_tuiwei: ['ev_qing_tuiwei'],
  },
}

/** 需要新建的一幕（用考证稿的事件对象 + 本项目的字段口径） */
const INSERT = {
  sui: [
    {
      before: 'ev_sui_dingyang',
      agentId: 'ev_sui_xqin',
      nationId: 'xqin',
      target: '西秦（薛仁杲）',
      desc: '浅水原之战',
      year: '618年',
      yearValue: 618,
    },
  ],
}

const YEAR_FIX = {
  'sui:ev_sui_wu': { year: '624年', yearValue: 624 },
  'yuan:ev_yuan_guanzhong': { year: '1369年', yearValue: 1369 },
}

const TOUCH = {
  'sui:ev_sui_wu': { target: '宋（辅公祏）', nationId: 'song', desc: '丹阳平定' },
  'five_dynasties:ev_fd_nantang': { target: '南唐（江南）' },
  'five_dynasties:ev_fd_jingnan': { target: '荆南·楚' },
  'qing:ev_qing_wuchang': { nationId: 'dongnan', target: '东南各省', desc: '各省光复' },
  'qing:ev_qing_chuandian': { target: '川滇' },
  'qing:ev_qing_tuiwei': { target: '清廷' },
  'qing:ev_qing_beiyang': { target: '北洋' },
}

const findAgentEvent = (dynasty, id) => H[dynasty].events.find((e) => e.id === id)

let unresolved = 0
for (const [dynasty, mapping] of Object.entries(MAP)) {
  const file = path.join(ROOT, `src/data/endgame.${dynasty}.json`)
  const endgame = JSON.parse(fs.readFileSync(file, 'utf8'))

  /* 1. 插入新事件（幂等） */
  for (const ins of INSERT[dynasty] ?? []) {
    if (endgame.events.some((e) => e.id === ins.agentId)) continue
    const agentEv = findAgentEvent(dynasty, ins.agentId)
    if (!agentEv) throw new Error(`${dynasty}: 考证稿缺少 ${ins.agentId}`)
    const idx = endgame.events.findIndex((e) => e.id === ins.before)
    endgame.events.splice(idx < 0 ? endgame.events.length : idx, 0, {
      id: ins.agentId,
      order: 0,
      nationId: ins.nationId,
      target: ins.target,
      year: ins.year,
      yearValue: ins.yearValue,
      desc: ins.desc,
      brief: agentEv.brief,
      highlights: (agentEv.campaigns ?? []).slice(0, 3).map((c) => `${c.general} ${c.from}→${c.to}`),
      report: agentEv.report,
      detail: agentEv.detail,
      sourceText: agentEv.sourceText,
      note: agentEv.note,
      campaigns: [],
      figures: [],
    })
  }

  /* 2. 替换 campaigns + 修正硬错 */
  for (const ev of endgame.events) {
    const ids = mapping[ev.id]
    if (!ids) continue
    const agentEvents = ids.map((id) => {
      const found = findAgentEvent(dynasty, id)
      if (!found) throw new Error(`${dynasty}: 考证稿缺少 ${id}`)
      return found
    })
    const merged = []
    for (const ae of agentEvents) {
      for (const c of ae.campaigns ?? []) {
        const from = norm(c.from)
        const to = norm(c.to)
        if (!from || !to) {
          unresolved += 1
          console.log(`  · 跳过（端点非地理）：${ae.id} ${c.general} ${c.from}→${c.to}`)
          continue
        }
        merged.push({
          phase: merged.length + 1,
          side: 'qin',
          general: c.general ?? '',
          from,
          to,
          via: (c.via ?? []).map(norm).filter(Boolean),
          points: [],
          result: c.result ?? '',
          ...(c.troops ? { troops: c.troops } : {}),
        })
      }
    }
    ev.campaigns = merged

    const key = `${dynasty}:${ev.id}`
    if (YEAR_FIX[key]) Object.assign(ev, YEAR_FIX[key])
    if (TOUCH[key]) Object.assign(ev, TOUCH[key])
  }

  /* 3. 重排序号 */
  endgame.events.forEach((ev, i) => {
    ev.order = i + 1
  })

  fs.writeFileSync(file, JSON.stringify(endgame, null, 2) + '\n', 'utf8')
  const n = endgame.events.reduce((s, e) => s + e.campaigns.length, 0)
  console.log(`${dynasty}: ${endgame.events.length} 幕 / ${n} 段行军`)
}

if (unresolved) console.log(`\n共跳过 ${unresolved} 段（端点不是地理点）`)
console.log('下一步：node scripts/fix-campaign-geo.mjs（把地名算成百分比坐标）')
