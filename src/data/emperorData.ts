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
import segmentsZhouRaw from './segments.zhou.json'
import segmentsQinRaw from './segments.qin.json'
import lordsZhouRaw from './lords.zhou.json'
import endgameZhouRaw from './endgame.zhou.json'
import fallZhouRaw from './fall.zhou.json'
import fallQinRaw from './fall.qin.json'
import type {
  DynastyEmperors,
  DynastyEndgame,
  DynastyLords,
  DynastySegments,
} from '../core/emperorTypes'

const EMPERORS: Record<string, DynastyEmperors> = {
  zhou: zhouRaw as DynastyEmperors,
  qin: qinRaw as DynastyEmperors,
}

const SEGMENTS: Record<string, DynastySegments> = {
  zhou: segmentsZhouRaw as DynastySegments,
  qin: segmentsQinRaw as DynastySegments,
}

const LORDS: Record<string, DynastyLords> = {
  zhou: lordsZhouRaw as DynastyLords,
}

const ENDGAME: Record<string, DynastyEndgame> = {
  zhou: endgameZhouRaw as DynastyEndgame,
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
}

/** 该朝代是否有收尾可走（沙盘或过渡页）——决定时间轴末页要不要出现"继续下滑" */
export function hasDynastyClosing(dynastyId: string | undefined): boolean {
  if (!dynastyId) return false
  return Boolean(ENDGAME[dynastyId] || FALL[dynastyId])
}

/**
 * 末页入口按钮上的收尾称谓。
 * 有沙盘用沙盘的副题（周：周室倾覆）；只有过渡页时用过渡页标题（秦：秦亡）。
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
