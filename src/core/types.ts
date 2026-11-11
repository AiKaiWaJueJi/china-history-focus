/**
 * 领域模型（Domain Model）
 * ---------------------------------------------------------------------------
 * 设计原则：
 * 1. 数据**扁平化**：四张表各自独立，绝不嵌套，便于阶段 2 的增量编辑与阶段 3 的
 *    AI 局部扩充（只重写某一条记录，不必解析整棵树）。
 * 2. 关系**用 ID 表达**：皇帝持有 eventIds、事件持有 characterIds。
 *    单向权威 + 运行时派生反向索引（见 data/index.ts），避免双向冗余导致数据漂移。
 * 3. 每个实体都带 `dynastyId` 外键，使「按朝代切片」成为 O(1) 查询。
 */

/** 焦点层级：与四个固定容器一一对应 */
export type FocusLevel = 'dynasty' | 'emperor' | 'event' | 'character'


export interface Dynasty {
  id: string
  name: string
  alias: string
  period: string
  startYear: number
  endYear: number
  /** 该朝代的主题色，供时间轴色带与卡片描边使用 */
  accent: string
  summary: string
  /** 向下关联：本朝皇帝 */
  emperorIds: string[]
}

export interface Emperor {
  id: string
  dynastyId: string
  name: string
  title: string
  reign: string
  summary: string
  /** 多对多关联：参与的史事（权威方向） */
  eventIds: string[]
}

export interface HistoryEvent {
  id: string
  dynastyId: string
  name: string
  year: number
  summary: string
  /** 多对多关联：涉及的人物（权威方向） */
  characterIds: string[]
}

export interface Character {
  id: string
  dynastyId: string
  name: string
  role: string
  summary: string
}

/** 数据集整体结构，与 history.data.json 一一对应 */
export interface HistoryDataset {
  dynasties: Dynasty[]
  emperors: Emperor[]
  events: HistoryEvent[]
  characters: Character[]
}

/** 层级 → 实体类型的映射，供泛型函数使用 */
export interface EntityByLevel {
  dynasty: Dynasty
  emperor: Emperor
  event: HistoryEvent
  character: Character
}

export type AnyEntity = EntityByLevel[FocusLevel]
