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
  /** 在位起止（负数＝公元前） */
  startYear: number
  endYear: number
  reign: string
  /**
   * 称霸（强势）期起止。
   * 时间联动以**称霸期**为准，而不是在位期：
   * 齐桓公前685年即位，但前679年鄄之会之后才算真正称霸。
   */
  hegemonyStart: number
  hegemonyEnd: number
  /** 称霸起点的事件描述，如「鄄之会始霸」 */
  hegemonyNote?: string
  segmentId: string
  accent: string
  portrait: string
  events: EmperorEvent[]
}

export interface DynastyLords {
  dynastyId: string
  lords: Lord[]
}

/* -------------------------------------------------------------------------- */
/* 终局推演（朝代收尾模块）                                                     */
/* -------------------------------------------------------------------------- */

/** 战报中可下钻的重要人物 */
export interface EndgameFigure {
  id: string
  name: string
  title: string
  bio: string
  deeds: string[]
}

/** 灭国前的详细情况，三段式叙述 */
export interface EndgameDetail {
  /** 战前形势 */
  situation: string
  /** 战役经过 */
  course: string
  /** 结局 */
  result: string
}

export interface EndgameEvent {
  id: string
  /** 阶梯序号 1..6（0 是"战前"，不占事件） */
  order: number
  /** 对应的地图区域 id（han/zhao/wei/chu/yan/qi） */
  nationId: string
  /** 展示用年份，如「前230年」 */
  year: string
  /** 排序/计算用年份（负数＝公元前） */
  yearValue: number
  /** 被灭的对象，如「韩」 */
  target: string
  /** 简短标题，如「秦灭韩」 */
  desc: string
  /** 一句话梗概，用于地图 Tooltip */
  brief: string
  /** 简要重大事件（悬浮卡片用，2-3 条） */
  highlights: string[]
  /** 战报正文（时间线一句话） */
  report: string
  /** 灭国前详细情况（点击聚焦后展开） */
  detail: EndgameDetail
  /** 本节出现的人物（正文中会被高亮成可点击标签） */
  figures: EndgameFigure[]
}

export interface EndgameNext {
  dynastyId: string
  label: string
  year: string
  hint?: string
}

export interface DynastyEndgame {
  dynastyId: string
  title: string
  subtitle: string
  intro: string
  /** 推演结束后要跳转的下一朝代 */
  next: EndgameNext
  events: EndgameEvent[]
}