/**
 * 阶段二的帝王数据类型
 * ---------------------------------------------------------------------------
 * 刻意**不放进** core/types.ts：阶段一的数据模型属于「朝代主页」，
 * 这里是为「帝王时间轴」单独定义的结构，两者通过 dynastyId 松耦合。
 * 批量导入其它朝代时，只需提供同样形状的 JSON。
 */

/** 事件维度：决定它出现在思维导图的上方还是下方 */
export type EventDimension = 'military' | 'political' | 'culture'

export interface EmperorEvent {
  id: string
  /** 事件名称，思维导图浮层直接展示 */
  name: string
  /** 维度：军事走上半区，政治/文教走下半区 */
  dimension: EventDimension
  /** 年份，负数表示公元前 */
  year: number
}

export interface EmperorRecord {
  id: string
  /** 谥号 / 庙号，如「周武王」 */
  posthumousTitle: string
  /** 本名，如「姬发」 */
  personalName: string
  /** 在位时间，如「前1046 — 前1043」 */
  reign: string
  /** 背景图占位符 URL */
  portrait: string
  /** 在位期间重大事件（2-3 条用于浮层展示） */
  events: EmperorEvent[]
}

export interface DynastyEmperors {
  dynastyId: string
  name: string
  period: string
  emperors: EmperorRecord[]
}
