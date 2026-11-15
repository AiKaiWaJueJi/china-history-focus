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
import endgameZhouRaw from './endgame.zhou.json'
import endgameChuhanRaw from './endgame.chuhan.json'
import endgameHanRaw from './endgame.han.json'
import endgameNanbeiRaw from './endgame.nanbei.json'
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
