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
  /**
   * 谥法评价（《逸周书·谥法解》的美/平/恶三类）：
   *   good    美谥（文、武、成、康…）
   *   neutral 平谥（共、夷、顷…）
   *   bad     恶谥（厉、幽、灵…）
   * 注意：这是"制度给的评价"，不是"历史功过"——昭王南征不返，谥法仍是美谥。
   */
  evaluation: 'good' | 'neutral' | 'bad'
  /** 谥法本义，如「克定祸乱曰武」；卡片上以小字呈现 */
  posthumousRule: string
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

export interface MapPoint {
  /** 版图百分比（0-100），运行时换算成 viewBox */
  x: number
  y: number
}

/** 援军：第三方介入的势力 */
export interface CampaignAlly {
  /** 援军国（可为残部，如"代"） */
  nation: string
  general: string
  /** 兵力数量，文案化（"十万"） */
  troops: string
  /** 出兵理由 */
  reason: string
  /** 援军路线：起点在援军国境内 */
  points: MapPoint[]
}

/** 战役序列中的一段：秦军进攻或敌国反击 */
export interface CampaignPhase {
  phase: number
  side: 'qin' | 'enemy'
  general: string
  from: string
  to: string
  /**
   * 折线路径（≥2 点）。
   * 秦军一律从咸阳出发，经关隘折向目标，不允许凭空出现在敌国境内。
   */
  points: MapPoint[]
  result: string
  /** 中途重点关隘名（与 points 的中间点一一对应），仅动画期间显示 */
  via?: string[]
  /** 本段是否引来援军 */
  allies?: CampaignAlly[]
}

/** 史料原文（古籍引文） */
export interface EndgameSource {
  /** 出处，如《史记·秦始皇本纪》 */
  bookName: string
  /** 文言原文 */
  text: string
  /** 今译，供悬浮提示 */
  translation: string
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
  /** 史料原文 */
  sourceText: EndgameSource
  /** 战役序列：按 phase 顺序播放的进军路线 */
  campaigns: CampaignPhase[]
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