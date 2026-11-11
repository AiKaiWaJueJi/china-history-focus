/**
 * 帝王 / 分段 / 诸侯 数据仓库（阶段二）
 * ---------------------------------------------------------------------------
 * 目前只注册「周」；批量导入其它朝代时在这里加一条即可，组件层零改动。
 */
import zhouRaw from './emperors.zhou.json'
import segmentsRaw from './segments.zhou.json'
import lordsRaw from './lords.zhou.json'
import type { DynastyEmperors, DynastyLords, DynastySegments } from '../core/emperorTypes'

const EMPERORS: Record<string, DynastyEmperors> = {
  zhou: zhouRaw as DynastyEmperors,
}

const SEGMENTS: Record<string, DynastySegments> = {
  zhou: segmentsRaw as DynastySegments,
}

const LORDS: Record<string, DynastyLords> = {
  zhou: lordsRaw as DynastyLords,
}

export function getDynastyEmperors(dynastyId: string | undefined): DynastyEmperors | null {
  if (!dynastyId) return null
  return EMPERORS[dynastyId] ?? null
}

/** 时代分段（西周 / 东周 …），没有则返回 null */
export function getDynastySegments(dynastyId: string | undefined): DynastySegments | null {
  if (!dynastyId) return null
  return SEGMENTS[dynastyId] ?? null
}

/** 诸侯（春秋五霸 / 战国七雄），没有则返回 null */
export function getDynastyLords(dynastyId: string | undefined): DynastyLords | null {
  if (!dynastyId) return null
  return LORDS[dynastyId] ?? null
}

export function hasDynastyEmperors(dynastyId: string | undefined): boolean {
  return Boolean(dynastyId && EMPERORS[dynastyId])
}

/** 年份格式化：-475 → 前475 */
export function formatYear(year: number): string {
  return year < 0 ? `前${Math.abs(year)}` : `${year}`
}
