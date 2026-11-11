/**
 * 视图选择器（Selectors）
 * ---------------------------------------------------------------------------
 * 把「焦点快照」翻译成「每块面板该显示什么」。全部为纯函数，与 React 无关。
 *
 * 【核心概念：上下文朝代（context dynasty）】
 * 不论文档焦点停在哪一层，都可以从「当前选中的实体」反推出它所属的朝代，
 * 于是四块面板天然共享同一个"时代上下文"：
 *   选中「明朝」→ 四块面板都在明朝范围内；
 *   选中「朱元璋」→ 仍然在明朝范围内，且事件列表收敛到他参与的事件。
 * 这样解决了"焦点只在某一层时，其它层该显示什么"的歧义，也让十字联动成为默认行为。
 */
import type { Character, Emperor, FocusLevel, HistoryEvent } from './types'
import type { FocusScope } from './focusMachine'
import {
  characterById,
  charactersByDynasty,
  charactersByEvent,
  dataset,
  dynastyById,
  emperorById,
  emperorsByDynasty,
  eventById,
  eventsByCharacter,
  eventsByDynasty,
  eventsByEmperor,
} from '../data'

/** 从当前选中的实体反推它所属的朝代 ID */
export function resolveContextDynastyId(focus: FocusScope): string | null {
  const { focusLevel, selectedId } = focus
  if (!selectedId) return null
  switch (focusLevel) {
    case 'dynasty':
      return dynastyById.has(selectedId) ? selectedId : null
    case 'emperor':
      return emperorById.get(selectedId)?.dynastyId ?? null
    case 'event':
      return eventById.get(selectedId)?.dynastyId ?? null
    case 'character':
      return characterById.get(selectedId)?.dynastyId ?? null
  }
}

/** 皇帝面板的数据作用域 */
export function resolveEmperorScope(focus: FocusScope): Emperor[] {
  const dynastyId = resolveContextDynastyId(focus)
  if (!dynastyId) return dataset.emperors
  return emperorsByDynasty.get(dynastyId) ?? []
}

/** 事件面板的数据作用域：优先按"人物/皇帝 → 其参与事件"收敛，其次按朝代 */
export function resolveEventScope(focus: FocusScope): HistoryEvent[] {
  const { focusLevel, selectedId } = focus

  if (focusLevel === 'emperor' && selectedId) {
    return eventsByEmperor.get(selectedId) ?? []
  }
  if (focusLevel === 'character' && selectedId) {
    return eventsByCharacter.get(selectedId) ?? []
  }

  const dynastyId = resolveContextDynastyId(focus)
  if (!dynastyId) return dataset.events
  return eventsByDynasty.get(dynastyId) ?? []
}

/** 人物面板的数据作用域 */
export function resolveCharacterScope(focus: FocusScope): Character[] {
  const { focusLevel, selectedId } = focus

  // 焦点在事件上 → 只显示该事件的出场人物（最精准）
  if (focusLevel === 'event' && selectedId) {
    return charactersByEvent.get(selectedId) ?? []
  }
  // 焦点在皇帝上 → 显示他参与事件中的全部人物（去重）
  if (focusLevel === 'emperor' && selectedId) {
    const seen = new Set<string>()
    const result: Character[] = []
    for (const ev of eventsByEmperor.get(selectedId) ?? []) {
      for (const c of charactersByEvent.get(ev.id) ?? []) {
        if (!seen.has(c.id)) {
          seen.add(c.id)
          result.push(c)
        }
      }
    }
    if (result.length) return result
  }

  const dynastyId = resolveContextDynastyId(focus)
  if (!dynastyId) return dataset.characters
  return charactersByDynasty.get(dynastyId) ?? []
}


/**
 * 面板底部的「关联快捷芯片」。
 * ---------------------------------------------------------------------------
 * 由于 ID 前缀全局唯一（d_ / e_ / ev_ / c_），可以直接由 selectedId 判定它属于哪张表，
 * 进而推导出"从它出发可以跃迁到哪一层、有哪些候选"。
 * 这比依赖 focusLevel 更健壮：即使将来允许跨层选中，逻辑依然成立。
 *
 * 意义：背景容器的 pointer-events 必须为 none，用户无法点击虚化面板进入下一层，
 * 因此"向下钻取"的入口必须由焦点面板自身提供。
 */
export function resolveOutboundLinks(selectedId: string): {
  level: FocusLevel | null
  ids: string[]
} {
  if (!selectedId) return { level: null, ids: [] }

  if (dynastyById.has(selectedId)) {
    return {
      level: 'emperor',
      ids: emperorsByDynasty.get(selectedId)?.map((e) => e.id) ?? [],
    }
  }
  if (emperorById.has(selectedId)) {
    return {
      level: 'event',
      ids: eventsByEmperor.get(selectedId)?.map((e) => e.id) ?? [],
    }
  }
  if (eventById.has(selectedId)) {
    return {
      level: 'character',
      ids: charactersByEvent.get(selectedId)?.map((c) => c.id) ?? [],
    }
  }
  if (characterById.has(selectedId)) {
    return {
      level: 'event',
      ids: eventsByCharacter.get(selectedId)?.map((e) => e.id) ?? [],
    }
  }
  return { level: null, ids: [] }
}
