/**
 * 阶段二的帝王数据类型
 * ---------------------------------------------------------------------------
 * 刻意**不放进** core/types.ts：阶段一的数据模型属于「朝代主页」，
 * 这里是为「帝王时间轴」单独定义的结构，两者通过 dynastyId 松耦合。
 */

/** 事件维度：决定它出现在思维导图的上方还是下方 */
export type EventDimension = 'military' | 'political' | 'culture'

export interface EmperorEvent {
  id: string
  name: string
  dimension: EventDimension
  year: number
}

export interface EmperorRecord {
  id: string
  posthumousTitle: string
  personalName: string
  reign: string
  /** 起始年（负数＝公元前），用于分段轴定位与分段判断 */
  startYear: number
  /** 结束年（负数＝公元前），用于分段轴上的"播放头"宽度 */
  endYear: number
  /** 所属时代分段：seg_xizhou / seg_dongzhou */
  segmentId: string
  portrait: string
  events: EmperorEvent[]
}

export interface DynastyEmperors {
  dynastyId: string
  name: string
  period: string
  emperors: EmperorRecord[]
}

/* -------------------------------------------------------------------------- */
/* 时代分段（驱动时间轴上方的刻度带）                                           */
/* -------------------------------------------------------------------------- */

export interface SegmentMarker {
  id: string
  name: string
  /** 标志点所在年份（负数＝公元前） */
  year: number
  note?: string
}

export interface TimelineSegment {
  id: string
  name: string
  startYear: number
  endYear: number
  accent: string
  desc?: string
  /** 段内的子时期标志点，如春秋 / 战国 */
  markers?: SegmentMarker[]
}

export interface DynastySegments {
  dynastyId: string
  segments: TimelineSegment[]
}

/* -------------------------------------------------------------------------- */
/* 诸侯（春秋五霸 / 战国七雄）                                                  */
/* -------------------------------------------------------------------------- */

export type LordEra = '春秋' | '战国'

export interface Lord {
  id: string
  /** 国名，如「齐」 */
  state: string
  /** 代表人物，如「齐桓公」 */
  title: string
  personalName: string
  era: LordEra
  startYear: number
  endYear: number
  period: string
  segmentId: string
  accent: string
  portrait: string
  events: EmperorEvent[]
}

export interface DynastyLords {
  dynastyId: string
  lords: Lord[]
}
