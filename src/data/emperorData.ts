/**
 * 帝王 / 分段 / 诸侯 / 终局 数据仓库
 * ---------------------------------------------------------------------------
 * 所有朝代的数据都从这里注册。批量导入新朝代时：
 *   1. 把三个 JSON 放进 src/data/
 *   2. 在下面的 registry 里加一行
 * 组件层零改动。
 *
 * （原文件名 zhouEmperors.ts 已不准确——现在它同时服务周与秦。）
 */
import zhouRaw from './emperors.zhou.json'
import qinRaw from './emperors.qin.json'
import hanRaw from './emperors.han.json'
import jinRaw from './emperors.jin.json'
import suiRaw from './emperors.sui.json'
import tangRaw from './emperors.tang.json'
import fiveDynastiesRaw from './emperors.five_dynasties.json'
import songRaw from './emperors.song.json'
import yuanRaw from './emperors.yuan.json'
import mingRaw from './emperors.ming.json'
import qingRaw from './emperors.qing.json'
import segmentsZhouRaw from './segments.zhou.json'
import segmentsQinRaw from './segments.qin.json'
import segmentsHanRaw from './segments.han.json'
import segmentsJinRaw from './segments.jin.json'
import segmentsSuiRaw from './segments.sui.json'
import segmentsTangRaw from './segments.tang.json'
import segmentsFiveDynastiesRaw from './segments.five_dynasties.json'
import segmentsSongRaw from './segments.song.json'
import segmentsYuanRaw from './segments.yuan.json'
import segmentsMingRaw from './segments.ming.json'
import segmentsQingRaw from './segments.qing.json'
import lordsZhouRaw from './lords.zhou.json'
/* 南北朝 54 帝的数据源（多行并行时间轴）：这里只借它建档案抽屉的反查表，
   时间轴组件本身仍然直接读 nanbei.json，两边不共享状态。 */
import nanbeiRaw from './nanbei.json'
import { tenStates } from './tenStates'
import endgameZhouRaw from './endgame.zhou.json'
import endgameChuhanRaw from './endgame.chuhan.json'
import endgameHanRaw from './endgame.han.json'
import endgameNanbeiRaw from './endgame.nanbei.json'
import endgameSuiRaw from './endgame.sui.json'
import endgameFiveDynastiesRaw from './endgame.five_dynasties.json'
import endgameSongRaw from './endgame.song.json'
import endgameTangRaw from './endgame.tang.json'
import endgameYuanRaw from './endgame.yuan.json'
import endgameMingRaw from './endgame.ming.json'
import endgameQingRaw from './endgame.qing.json'
import fallZhouRaw from './fall.zhou.json'
import fallQinRaw from './fall.qin.json'
import fallHanRaw from './fall.han.json'
import fallJinRaw from './fall.jin.json'
import fallSuiRaw from './fall.sui.json'
import fallTangRaw from './fall.tang.json'
import fallFiveDynastiesRaw from './fall.five_dynasties.json'
import fallSongRaw from './fall.song.json'
import fallYuanRaw from './fall.yuan.json'
import fallMingRaw from './fall.ming.json'
import fallQingRaw from './fall.qing.json'
import type {
  DynastyEmperors,
  DynastyEndgame,
  DynastyLords,
  DynastySegments,
  EmperorRecord,
  Lord,
  TimelineSegment,
} from '../core/emperorTypes'

const EMPERORS: Record<string, DynastyEmperors> = {
  zhou: zhouRaw as DynastyEmperors,
  qin: qinRaw as DynastyEmperors,
  han: hanRaw as DynastyEmperors,
  jin: jinRaw as DynastyEmperors,
  sui: suiRaw as DynastyEmperors,
  tang: tangRaw as DynastyEmperors,
  five_dynasties: fiveDynastiesRaw as DynastyEmperors,
  song: songRaw as DynastyEmperors,
  yuan: yuanRaw as DynastyEmperors,
  ming: mingRaw as DynastyEmperors,
  qing: qingRaw as DynastyEmperors,
}

const SEGMENTS: Record<string, DynastySegments> = {
  zhou: segmentsZhouRaw as DynastySegments,
  qin: segmentsQinRaw as DynastySegments,
  han: segmentsHanRaw as DynastySegments,
  jin: segmentsJinRaw as DynastySegments,
  sui: segmentsSuiRaw as DynastySegments,
  tang: segmentsTangRaw as DynastySegments,
  five_dynasties: segmentsFiveDynastiesRaw as DynastySegments,
  song: segmentsSongRaw as DynastySegments,
  yuan: segmentsYuanRaw as DynastySegments,
  ming: segmentsMingRaw as DynastySegments,
  qing: segmentsQingRaw as DynastySegments,
}

const LORDS: Record<string, DynastyLords> = {
  zhou: lordsZhouRaw as DynastyLords,
}

const ENDGAME: Record<string, DynastyEndgame> = {
  // 周：秦灭六国（战国地图）
  zhou: endgameZhouRaw as DynastyEndgame,
  // 秦：楚汉相争（楚汉地图）——秦亡后到汉立之间的五年，挂在这里
  qin: endgameChuhanRaw as DynastyEndgame,
  // 汉：三国归晋（三国地图）——汉末到晋统一，挂在这里
  han: endgameHanRaw as DynastyEndgame,
  // 南北朝：周灭齐 → 隋代周 → 渡江 → 灭陈（大一统模板）
  southern_northern: endgameNanbeiRaw as DynastyEndgame,
  // 隋：唐统一战争（隋末群雄）
  sui: endgameSuiRaw as DynastyEndgame,
  // 五代：宋统一战争（荆南 → 北汉）
  five_dynasties: endgameFiveDynastiesRaw as DynastyEndgame,
  // 宋：元灭宋（襄阳 → 崖山）
  song: endgameSongRaw as DynastyEndgame,
  // 唐：梁晋争霸（唐亡 → 五代序幕）
  tang: endgameTangRaw as DynastyEndgame,
  // 元：明北伐（自应天至大都）
  yuan: endgameYuanRaw as DynastyEndgame,
  // 明：清兵入关（甲申之变）
  ming: endgameMingRaw as DynastyEndgame,
  // 清：辛亥革命（自武昌至退位）
  qing: endgameQingRaw as DynastyEndgame,
}

export function getDynastyEmperors(dynastyId: string | undefined): DynastyEmperors | null {
  if (!dynastyId) return null
  return EMPERORS[dynastyId] ?? null
}

export function getDynastySegments(dynastyId: string | undefined): DynastySegments | null {
  if (!dynastyId) return null
  return SEGMENTS[dynastyId] ?? null
}

export function getDynastyLords(dynastyId: string | undefined): DynastyLords | null {
  if (!dynastyId) return null
  return LORDS[dynastyId] ?? null
}

/** 朝代收尾的终局推演数据（目前只有周有） */
export function getDynastyEndgame(dynastyId: string | undefined): DynastyEndgame | null {
  if (!dynastyId) return null
  return ENDGAME[dynastyId] ?? null
}

/**
 * 朝代收尾的过渡章节（周有两章：段间「平王东迁」+ 收尾「九鼎入秦」）。
 * 与 endgame 分开登记：有的朝代有沙盘，有的只有过渡页。
 */
const FALL: Record<string, unknown> = {
  zhou: fallZhouRaw,
  qin: fallQinRaw,
  han: fallHanRaw,
  jin: fallJinRaw,
  sui: fallSuiRaw,
  tang: fallTangRaw,
  five_dynasties: fallFiveDynastiesRaw,
  song: fallSongRaw,
  yuan: fallYuanRaw,
  ming: fallMingRaw,
  qing: fallQingRaw,
}

/** 该朝代是否有收尾可走（沙盘或过渡页）——决定时间轴末页要不要出现"继续下滑" */
export function hasDynastyClosing(dynastyId: string | undefined): boolean {
  if (!dynastyId) return false
  return Boolean(ENDGAME[dynastyId] || FALL[dynastyId])
}

/**
 * 末页入口按钮上的收尾称谓。
 * 优先用过渡页副题（周：周室倾覆 / 秦：秦亡）；
 * 没有过渡页的朝代才退回沙盘副题。
 * 注意别反了：这里曾错取沙盘副题，导致周显示成"秦灭六国"。
 */
export function getDynastyClosingLabel(dynastyId: string | undefined): string {
  if (!dynastyId) return ''
  // 过渡页的副题就是这一朝的收尾称谓（周：周室倾覆 / 秦：秦亡）
  const fall = FALL[dynastyId] as { subtitle?: string } | undefined
  if (fall?.subtitle) return fall.subtitle
  const endgame = ENDGAME[dynastyId] as { subtitle?: string } | undefined
  return endgame?.subtitle ?? ''
}

export function hasDynastyEmperors(dynastyId: string | undefined): boolean {
  return Boolean(dynastyId && EMPERORS[dynastyId])
}

/** 年份格式化：-475 → 前475 */
export function formatYear(year: number): string {
  return year < 0 ? `前${Math.abs(year)}` : `${year}`
}

/* -------------------------------------------------------------------------- */
/* 档案抽屉（帝王 / 诸侯）—— 按 id 反查，补齐「同朝 / 同期」这些渲染所需上下文    */
/* -------------------------------------------------------------------------- */

export interface EmperorArchiveRef {
  emperor: EmperorRecord
  dynastyId: string
  dynastyName: string
  /** 同朝上一位 / 下一位（保底出链，也方便顺着朝代连续读） */
  prev?: EmperorRecord
  next?: EmperorRecord
  /** 本朝分段表，用来把事件挂回「西周 / 春秋 / 战国」这种时代坐标 */
  segments: TimelineSegment[]
  /** 在本朝帝王序列中的序号（1 起）与总数——让读者知道"这是第几位" */
  index: number
  total: number
}

const EMPEROR_ARCHIVE = new Map<string, EmperorArchiveRef>()
for (const [dynastyId, doc] of Object.entries(EMPERORS)) {
  const segments = SEGMENTS[dynastyId]?.segments ?? []
  doc.emperors.forEach((emperor, index) => {
    EMPEROR_ARCHIVE.set(emperor.id, {
      emperor,
      dynastyId,
      dynastyName: doc.name,
      prev: index > 0 ? doc.emperors[index - 1] : undefined,
      next: index < doc.emperors.length - 1 ? doc.emperors[index + 1] : undefined,
      segments,
      index: index + 1,
      total: doc.emperors.length,
    })
  })
}

/*
  南北朝 54 帝：数据在 nanbei.json（五行并行时间轴的独立数据源），不在 emperors.*.json。
  2026-11-21 之前他们的帝王卡没有档案入口——卡片没有 aria-label、点了什么都不发生，
  而十二朝那边的卡是整卡入口，这是最容易被读者当成"坏了"的一处不一致。
  这里把同一份数据接进 EMPEROR_ARCHIVE：
    · 分段 = 十个政权（十六国余部 / 北魏 / 东魏·北齐 / 西魏·北周 / 南朝四朝），
      所以档案里的「时代」显示的是政权而不是西周/春秋那种时代；
    · 前后主限定在**同一政权内**（北魏的下一任不等于东魏的开国）；
    · 序号也是政权内序号——「本朝第 12 / 54 位」会把三个并行政权的世系混成一条，没有意义。
*/
const NANBEI_POLITY_NAME = new Map(nanbeiRaw.polities.map((p) => [p.id, p.name]))
const NANBEI_SEGMENTS: TimelineSegment[] = nanbeiRaw.polities.map((p) => ({
  id: p.id,
  name: p.name,
  startYear: p.start,
  endYear: p.end,
  accent: '#8d8a7a',
  desc: p.full,
}))
const NANBEI_BY_POLITY = new Map<string, EmperorRecord[]>()
for (const e of nanbeiRaw.emperors) {
  const record: EmperorRecord = {
    id: e.id,
    posthumousTitle: e.title,
    personalName: e.name,
    reign: e.reign,
    startYear: e.start,
    endYear: e.end,
    segmentId: e.polity,
    portrait: e.portrait,
    /* JSON 里的枚举是字符串字面量的超集：这里显式收窄，越界值在类型层面就该炸 */
    events: e.events as EmperorRecord['events'],
    evaluation: e.evaluation as EmperorRecord['evaluation'],
    posthumousRule: e.posthumousRule,
  }
  const list = NANBEI_BY_POLITY.get(e.polity) ?? []
  list.push(record)
  NANBEI_BY_POLITY.set(e.polity, list)
}
for (const [polity, list] of NANBEI_BY_POLITY) {
  list.forEach((emperor, index) => {
    EMPEROR_ARCHIVE.set(emperor.id, {
      emperor,
      dynastyId: 'southern_northern',
      dynastyName: `南北朝 · ${NANBEI_POLITY_NAME.get(polity) ?? polity}`,
      prev: index > 0 ? list[index - 1] : undefined,
      next: index < list.length - 1 ? list[index + 1] : undefined,
      segments: NANBEI_SEGMENTS,
      index: index + 1,
      total: list.length,
    })
  })
}

/*
  十国君主：数据在 ten_states.json。同样接进 EMPEROR_ARCHIVE——档案抽屉的结构化时间线
  只认「帝王记录」这个形状，不关心它来自哪个朝代文件。
  分段 = 该国（所以「时代」显示「南唐」）；前后主 = 同国先后君主；
  序号也是该国之内——「十国第 37 位」没有意义。
*/
for (const state of tenStates) {
  const segments: TimelineSegment[] = [
    {
      id: state.polityId,
      name: state.polityName,
      startYear: state.monarchs[0]?.start ?? 0,
      endYear: state.monarchs[state.monarchs.length - 1]?.end ?? 0,
      accent: '#8d8a7a',
      desc: '十国之一',
    },
  ]
  /* 先把整国的帝王记录建出来，再挂前后主——比在 set 里互相查表干净 */
  const records: EmperorRecord[] = state.monarchs.map((m) => ({
    id: m.id,
    posthumousTitle: m.title,
    personalName: m.name,
    reign: m.reign,
    startYear: m.start,
    endYear: m.end,
    segmentId: state.polityId,
    /* 十国君主没有画像（页面上也不出卡片），给空串，ArchiveBody 不读这个字段 */
    portrait: '',
    events: m.events as EmperorRecord['events'],
    evaluation: m.evaluation,
    posthumousRule: m.posthumousRule,
  }))
  records.forEach((record, index) => {
    EMPEROR_ARCHIVE.set(record.id, {
      emperor: record,
      dynastyId: 'five_dynasties',
      dynastyName: `十国 · ${state.polityName}`,
      prev: index > 0 ? records[index - 1] : undefined,
      next: index < records.length - 1 ? records[index + 1] : undefined,
      segments,
      index: index + 1,
      total: records.length,
    })
  })
}

export function getEmperorArchive(id: string): EmperorArchiveRef | null {
  return EMPEROR_ARCHIVE.get(id) ?? null
}


export interface LordArchiveRef {
  lord: Lord
  dynastyId: string
  /** 同朝诸侯（东周同一批），用于「同期诸侯」横向跳转 */
  siblings: Lord[]
}

const LORD_ARCHIVE = new Map<string, LordArchiveRef>()
for (const [dynastyId, doc] of Object.entries(LORDS)) {
  for (const lord of doc.lords) LORD_ARCHIVE.set(lord.id, { lord, dynastyId, siblings: doc.lords })
}

export function getLordArchive(id: string): LordArchiveRef | null {
  return LORD_ARCHIVE.get(id) ?? null
}

/**
 * 某一年「在任称霸」的诸侯。
 * 口径与时间轴联动一致：用**称霸期**求交，而不是在位期——
 * 齐桓公前685 即位、前679 鄄之会才始霸。
 */
export function lordsRulingAt(year: number): Lord[] {
  const doc = LORDS.zhou
  if (!doc) return []
  return doc.lords.filter((lord) => year >= lord.hegemonyStart && year <= lord.hegemonyEnd)
}

