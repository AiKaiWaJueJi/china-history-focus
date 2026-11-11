/**
 * 帝王数据仓库（阶段二）
 * ---------------------------------------------------------------------------
 * 目前只提供「周」一个朝代用于验证 UI 与交互；批量导入其它朝代时，
 * 在这里注册新的 JSON 即可，组件层不需要任何改动。
 */
import zhouRaw from './emperors.zhou.json'
import type { DynastyEmperors } from '../core/emperorTypes'

const REGISTRY: Record<string, DynastyEmperors> = {
  zhou: zhouRaw as DynastyEmperors,
}

/** 取某个朝代的帝王序列（按数据文件中的即位顺序） */
export function getDynastyEmperors(dynastyId: string | undefined): DynastyEmperors | null {
  if (!dynastyId) return null
  return REGISTRY[dynastyId] ?? null
}

/** 是否已有该朝代的帝王数据 */
export function hasDynastyEmperors(dynastyId: string | undefined): boolean {
  return Boolean(dynastyId && REGISTRY[dynastyId])
}
