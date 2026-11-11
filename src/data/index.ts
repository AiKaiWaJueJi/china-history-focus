/**
 * 数据访问层（Repository 接缝）
 * ---------------------------------------------------------------------------
 * 这一层刻意做成「纯函数 + 预建索引」：
 * - 阶段 1：数据源是静态 JSON。
 * - 阶段 2：只需把 `dataset` 换成来自 localStorage / IndexedDB 的同一形状对象，
 *   上层组件与状态机零改动。
 * - 阶段 3：AI 扩充得到的增量同样合并进 `HistoryDataset` 形状。
 *
 * 反向索引在这里一次性构建，避免在渲染期反复 filter 造成 O(n²)。
 */
import raw from './history.data.json'
import type {
  AnyEntity,
  Character,
  Dynasty,
  Emperor,
  FocusLevel,
  HistoryDataset,
  HistoryEvent,
} from '../core/types'

export const dataset = raw as HistoryDataset

/* -------------------------------------------------------------------------- */
/* 索引：Map 查询，O(1)                                                        */
/* -------------------------------------------------------------------------- */

export const dynastyById = new Map<string, Dynasty>()
export const emperorById = new Map<string, Emperor>()
export const eventById = new Map<string, HistoryEvent>()
export const characterById = new Map<string, Character>()

for (const d of dataset.dynasties) dynastyById.set(d.id, d)
for (const e of dataset.emperors) emperorById.set(e.id, e)
for (const e of dataset.events) eventById.set(e.id, e)
for (const c of dataset.characters) characterById.set(c.id, c)

/* -------------------------------------------------------------------------- */
/* 派生关系（单向权威 → 反向索引）                                             */
/* -------------------------------------------------------------------------- */

/** 朝代 → 皇帝 */
export const emperorsByDynasty = new Map<string, Emperor[]>()
for (const e of dataset.emperors) {
  const list = emperorsByDynasty.get(e.dynastyId) ?? []
  list.push(e)
  emperorsByDynasty.set(e.dynastyId, list)
}

/** 朝代 → 事件 */
export const eventsByDynasty = new Map<string, HistoryEvent[]>()
for (const ev of dataset.events) {
  const list = eventsByDynasty.get(ev.dynastyId) ?? []
  list.push(ev)
  eventsByDynasty.set(ev.dynastyId, list)
}

/** 皇帝 → 事件（由 emperor.eventIds 展开） */
export const eventsByEmperor = new Map<string, HistoryEvent[]>()
for (const e of dataset.emperors) {
  const list: HistoryEvent[] = []
  for (const evId of e.eventIds) {
    const ev = eventById.get(evId)
    if (ev) list.push(ev)
  }
  eventsByEmperor.set(e.id, list)
}

/** 事件 → 皇帝（反向：哪些皇帝参与了该事件） */
export const emperorsByEvent = new Map<string, Emperor[]>()
for (const e of dataset.emperors) {
  for (const evId of e.eventIds) {
    const list = emperorsByEvent.get(evId) ?? []
    list.push(e)
    emperorsByEvent.set(evId, list)
  }
}

/** 事件 → 人物（由 event.characterIds 展开） */
export const charactersByEvent = new Map<string, Character[]>()
for (const ev of dataset.events) {
  const list: Character[] = []
  for (const cId of ev.characterIds) {
    const c = characterById.get(cId)
    if (c) list.push(c)
  }
  charactersByEvent.set(ev.id, list)
}

/** 人物 → 事件（反向索引） */
export const eventsByCharacter = new Map<string, HistoryEvent[]>()
for (const ev of dataset.events) {
  for (const cId of ev.characterIds) {
    const list = eventsByCharacter.get(cId) ?? []
    list.push(ev)
    eventsByCharacter.set(cId, list)
  }
}

/** 朝代 → 人物（去重，便于人物容器在未选中事件时也能给出候选） */
export const charactersByDynasty = new Map<string, Character[]>()
for (const c of dataset.characters) {
  const list = charactersByDynasty.get(c.dynastyId) ?? []
  list.push(c)
  charactersByDynasty.set(c.dynastyId, list)
}

/* -------------------------------------------------------------------------- */
/* 统一读取入口                                                                */
/* -------------------------------------------------------------------------- */

const LEVEL_TABLES: Record<FocusLevel, Map<string, AnyEntity>> = {
  dynasty: dynastyById as Map<string, AnyEntity>,
  emperor: emperorById as Map<string, AnyEntity>,
  event: eventById as Map<string, AnyEntity>,
  character: characterById as Map<string, AnyEntity>,
}

/** 状态机的守卫依赖：判断某层级的某个 ID 是否真实存在 */
export function entityExists(level: FocusLevel, id: string): boolean {
  return LEVEL_TABLES[level].has(id)
}

/** 取任意层级实体的显示名，供面包屑与 HUD 使用 */
export function getEntityLabel(level: FocusLevel, id: string): string {
  const entity = LEVEL_TABLES[level].get(id)
  if (!entity) return '未知'
  if (level === 'emperor') return (entity as Emperor).title
  return (entity as { name: string }).name
}

/** 取任意层级实体的副标题（朝代名 / 年代 / 身份） */
export function getEntitySubtitle(level: FocusLevel, id: string): string {
  const entity = LEVEL_TABLES[level].get(id)
  if (!entity) return ''
  switch (level) {
    case 'dynasty':
      return (entity as Dynasty).period
    case 'emperor': {
      const e = entity as Emperor
      return `${dynastyById.get(e.dynastyId)?.name ?? ''} · ${e.reign}`
    }
    case 'event': {
      const e = entity as HistoryEvent
      return `${dynastyById.get(e.dynastyId)?.name ?? ''} · ${formatYear(e.year)}`
    }
    case 'character': {
      const c = entity as Character
      return `${dynastyById.get(c.dynastyId)?.name ?? ''} · ${c.role}`
    }
  }
}

/** 公元前年份格式化 */
export function formatYear(year: number): string {
  return year < 0 ? `前 ${Math.abs(year)} 年` : `${year} 年`
}


