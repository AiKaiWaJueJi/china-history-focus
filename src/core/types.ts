/**
 * 领域模型（Domain Model）
 * ===========================================================================
 * 三视图共享同一套扁平数据：
 *   视图1 朝代主页  ← dynasties
 *   视图2 帝王时间轴 ← emperors（按 dynastyId 过滤）
 *   视图3 帝王详情  ← events / figures（阶段二、三启用）
 *
 * 扁平化 + ID 关联的理由：阶段三的 AI 扩充只会新增/修改单条记录，
 * 不需要读改写整棵树；分页、筛选也都能在 O(1) 索引上完成。
 */

/** 三个视图标识，与状态机的 view 字段一一对应 */
export type ViewId = 'gallery' | 'timeline' | 'detail'

export interface Dynasty {
  id: string
  name: string
  alias: string
  period: string
  startYear: number
  endYear: number
  /** 主色：用于标题、描边、光晕 */
  accent: string
  /** 辅色：用于说明文字与高光，保证在暗底上可读 */
  accentSoft: string
  /** 文物背景图（占位图由 scripts/gen-placeholders.mjs 生成） */
  artifact: string
  artifactName: string
  summary: string
  /** 向下关联：本朝帝王 */
  emperorIds: string[]
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
  /** 关联的史事（阶段二填充） */
  eventIds: string[]
}

export interface HistoryEvent {
  id: string
  emperorId: string
  dynastyId: string
  name: string
  year: number
  summary: string
  /** 参与人物 */
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

/** 状态机守卫用：某一层级存在某 ID */
export type EntityLevel = 'dynasty' | 'emperor' | 'event' | 'figure'
