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

export function hasDynastyEmperors(dynastyId: string | undefined): boolean {
  return Boolean(dynastyId && EMPERORS[dynastyId])
}

/** 年份格式化：-475 → 前475 */
export function formatYear(year: number): string {
  return year < 0 ? `前${Math.abs(year)}` : `${year}`
}
