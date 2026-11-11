/**
 * 数据访问层
 * ---------------------------------------------------------------------------
 * 扁平 JSON + 预建 Map 索引。所有查询 O(1)。
 * 阶段二把 `dataset` 换成 localStorage / IndexedDB 的同形状对象即可，
 * 组件与状态机零改动。
 */
import raw from './history.data.json'
import type { Dynasty, Emperor, Figure, HistoryDataset, HistoryEvent } from '../core/types'

export const dataset = raw as HistoryDataset

export const dynastyById = new Map<string, Dynasty>()
export const emperorById = new Map<string, Emperor>()
export const eventById = new Map<string, HistoryEvent>()
export const figureById = new Map<string, Figure>()

for (const d of dataset.dynasties) dynastyById.set(d.id, d)
for (const e of dataset.emperors) emperorById.set(e.id, e)
for (const ev of dataset.events) eventById.set(ev.id, ev)
for (const f of dataset.figures) figureById.set(f.id, f)

/** 朝代 → 帝王（有序，按数据源顺序即即位次序） */
export const emperorsByDynasty = new Map<string, Emperor[]>()
for (const e of dataset.emperors) {
  const list = emperorsByDynasty.get(e.dynastyId) ?? []
  list.push(e)
  emperorsByDynasty.set(e.dynastyId, list)
}

/** 帝王 → 史事 */
export const eventsByEmperor = new Map<string, HistoryEvent[]>()
for (const ev of dataset.events) {
  const list = eventsByEmperor.get(ev.emperorId) ?? []
  list.push(ev)
  eventsByEmperor.set(ev.emperorId, list)
}

/** 帝王 → 活跃人物（由其史事的 figureIds 去重展开） */
export const figuresByEmperor = new Map<string, Figure[]>()
for (const e of dataset.emperors) {
  const seen = new Set<string>()
  const list: Figure[] = []
  for (const evId of e.eventIds) {
    const ev = eventById.get(evId)
    if (!ev) continue
    for (const fid of ev.figureIds) {
      if (seen.has(fid)) continue
      const f = figureById.get(fid)
      if (f) {
        seen.add(fid)
        list.push(f)
      }
    }
  }
  figuresByEmperor.set(e.id, list)
}

/** 状态机守卫所需的存活性判断 */
export const entityExists = {
  dynasty: (id: string) => dynastyById.has(id),
  emperor: (id: string) => emperorById.has(id),
  event: (id: string) => eventById.has(id),
  figure: (id: string) => figureById.has(id),
}

/** 公元前年份格式化 */
export function formatYear(year: number): string {
  return year < 0 ? `前 ${Math.abs(year)}` : `${year}`
}
