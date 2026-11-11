/**
 * 领域模型（Domain Model）
 * ===========================================================================
 * 数据结构对齐「中原王朝主线」朝代表：13 个朝代大类，
 * 每个朝代带 subPeriods（西周/东周、西汉/新朝/东汉…）与 fontStyle。
 *
 * 三视图共享同一份扁平数据：
 *   视图1 朝代主页  ← dynasties
 *   视图2 帝王时间轴 ← emperors（按 dynastyId 过滤）
 *   视图3 帝王详情  ← events / figures（阶段三启用）
 */

/** 三个视图标识，与状态机的 view 字段一一对应 */
export type ViewId = 'gallery' | 'timeline' | 'detail'

export interface Dynasty {
  id: string
  name: string
  /** 完整纪年，如「前1046年-前256年」 */
  period: string
  startYear: number
  endYear: number
  /** 主要都城 */
  capital: string
  /** 子时期：西周、东周（春秋战国）… */
  subPeriods: string[]
  /** 代表器物，用于背景图与说明文字 */
  representativeItem: string
  /** 字体风格描述（毛笔/篆书、瘦金体…），由 lib/fonts.ts 解析成真实字体 */
  fontStyle: string
  /** 主色 */
  accent: string
  /** 辅色（高光/说明文字） */
  accentSoft: string
  /** 器物背景图路径 */
  artifact: string
  emperorIds: string[]
  eventIds: string[]
  /** 备注：同期并立政权、历史定位等 */
  notes?: string
}

export interface Emperor {
  id: string
  dynastyId: string
  /** 谥号 / 庙号，如「周武王」 */
  title: string
  /** 本名，如「姬发」 */
  name: string
  reign: string
  portrait: string
  summary: string
  /** 关联史事（阶段二填充） */
  eventIds: string[]
}

export interface HistoryEvent {
  id: string
  emperorId: string
  dynastyId: string
  name: string
  year: number
  summary: string
  figureIds: string[]
}

export interface Figure {
  id: string
  dynastyId: string
  name: string
  role: string
  summary: string
}

export interface HistoryDataset {
  dynasties: Dynasty[]
  emperors: Emperor[]
  events: HistoryEvent[]
  figures: Figure[]
}
