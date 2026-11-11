/**
 * 焦点状态机（Focus State Machine）
 * ===========================================================================
 * 这是整个交互引擎的唯一真相来源（single source of truth）。
 *
 * 【为什么是纯函数】
 * 状态机不 import React、不 import 任何 UI 库、不碰 DOM。它只接收
 * `(快照, 事件, 上下文)` 并返回**新的快照**。带来三个好处：
 *   1. 可用 Vitest 直接对转移表做表驱动测试，无需挂载组件；
 *   2. 将来若替换为 XState，只需换实现，UI 层一行不改；
 *   3. 动画层永远不会"猜"状态，它只消费快照。
 *
 * 【两级状态】
 *   - 焦点层级 focusLevel  ∈ dynasty | emperor | event | character
 *   - 选中实体 selectedId   （与层级配对，语义是"该层级上被选中的那一个"）
 *
 * 【设计要点：focusLevel 不等于 selectedId 的类型】
 * 二者是**独立的两个维度**。`selectedId` 是"当前层里被选中的条目"，
 * 而 `focusLevel` 决定**哪一块面板处于景深焦点**。这样在 dynasty 焦点下选中
 * 一个朝代后，仍可以停留在 dynasty 层浏览，而由该朝代的"关联皇帝"快捷芯片
 * 触发向 emperor 层的跃迁（见 FOCUS 事件）。UI 因此既有"逐层钻取"，也有
 * "平级选择"，不会互相打断。
 */

import type { FocusLevel } from './types'

/* -------------------------------------------------------------------------- */
/* 状态定义                                                                    */
/* -------------------------------------------------------------------------- */

/** 面板的视觉相位：transitioning 用于开启 GPU 加速提示，idle 时立即撤销 */
export type FocusPhase = 'idle' | 'transitioning'

/** 焦点路径上的一站，供面包屑与 BACK（回退）使用 */
export interface FocusTrailEntry {
  level: FocusLevel
  id: string
}

export interface FocusSnapshot {
  /** 当前处于景深焦点的层级 */
  focusLevel: FocusLevel
  /** 当前层级上被选中的实体 ID；空串表示"该层尚未选中" */
  selectedId: string
  /** 已走过的焦点路径（不含当前站），用于 BACK 逐级回退 */
  history: FocusTrailEntry[]
  /** 动画相位 */
  phase: FocusPhase
}

/* -------------------------------------------------------------------------- */
/* 事件定义                                                                    */
/* -------------------------------------------------------------------------- */

export type FocusEvent =
  /** 切换焦点到某层级的某个实体（钻取 / 平级选择 / 跳级 都走这一个事件） */
  | { type: 'FOCUS'; level: FocusLevel; id: string }
  /** 沿 history 回退一层 */
  | { type: 'BACK' }
  /** 复位到初始（dynasty 层、无选中） */
  | { type: 'RESET' }
  /** 动画结束，关闭 transitioning 相位 */
  | { type: 'SETTLE' }

/** 状态机的外部依赖：由调用方注入，保持状态机本身无副作用 */
export interface FocusContext {
  /** 守卫条件：实体是否真实存在，防止写入幽灵 ID */
  entityExists: (level: FocusLevel, id: string) => boolean
}

/** 初始快照：从朝代层起步，不预选任何实体 */
export const INITIAL_FOCUS: FocusSnapshot = {
  focusLevel: 'dynasty',
  selectedId: '',
  history: [],
  phase: 'idle',
}

/* -------------------------------------------------------------------------- */
/* 转移实现                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * 唯一的状态转移函数。纯函数：相同入参必然得到相同出参。
 *
 * 状态流转总览（→ 表示返回的新快照）：
 *
 *   ① FOCUS(level, id)
 *        守卫：entityExists(level, id)              —— 实体不存在则原样返回
 *        守卫：与当前 (focusLevel, selectedId) 完全相同 —— 重复聚焦则原样返回（避免动画空转）
 *        动作：把「当前站」压入 history（仅当它有效）
 *              把 (level, id) 设为新的焦点
 *              phase → transitioning（打开 will-change）
 *
 *   ② BACK
 *        守卫：history 为空 —— 原样返回（已在起点）
 *        动作：弹出 history 末项，回到该站
 *              phase → transitioning
 *
 *   ③ RESET
 *        守卫：已在初始态 —— 原样返回
 *        动作：清空 history 与 selectedId，回到 dynasty 层
 *              phase → transitioning
 *
 *   ④ SETTLE
 *        守卫：phase 已是 idle —— 原样返回
 *        动作：phase → idle（撤销 will-change，释放合成层）
 *
 * 「原样返回」是刻意设计：返回**同一个对象引用**，Zustand 的浅比较会自动跳过
 * 无意义的通知，从而避免一次多余的全局重渲染。
 */
export function transition(
  state: FocusSnapshot,
  event: FocusEvent,
  ctx: FocusContext,
): FocusSnapshot {
  switch (event.type) {
    /* ---------------------------------------------------------------- ① */
    case 'FOCUS': {
      // 守卫一：ID 必须真实存在，否则状态机与数据源就会失联
      if (!ctx.entityExists(event.level, event.id)) return state

      // 守卫二：目标与当前完全一致 → 无操作（防止重复点击触发多余动画）
      const isSameTarget = state.focusLevel === event.level && state.selectedId === event.id
      if (isSameTarget) return state

      // 当前站是否值得入栈：初始态（无选中）不入历史，否则回退会出现空站
      const hasCurrentStop = state.selectedId !== ''
      const nextHistory = hasCurrentStop
        ? [...state.history, { level: state.focusLevel, id: state.selectedId }]
        : [...state.history]

      return {
        focusLevel: event.level,
        selectedId: event.id,
        history: nextHistory,
        phase: 'transitioning',
      }
    }

    /* ---------------------------------------------------------------- ② */
    case 'BACK': {
      if (state.history.length === 0) return state

      const nextHistory = state.history.slice(0, -1)
      const previous = state.history[state.history.length - 1]

      return {
        focusLevel: previous.level,
        selectedId: previous.id,
        history: nextHistory,
        phase: 'transitioning',
      }
    }

    /* ---------------------------------------------------------------- ③ */
    case 'RESET': {
      const alreadyInitial =
        state.focusLevel === INITIAL_FOCUS.focusLevel &&
        state.selectedId === INITIAL_FOCUS.selectedId &&
        state.history.length === 0
      if (alreadyInitial) return state

      return { ...INITIAL_FOCUS, phase: 'transitioning' }
    }

    /* ---------------------------------------------------------------- ④ */
    case 'SETTLE': {
      if (state.phase === 'idle') return state
      return { ...state, phase: 'idle' }
    }
  }
}

/**
 * 面板只需要「层级 + 选中 ID」两件事来决定显示内容。
 * 单独抽出这个子类型，可让 selector 的入参最小化，
 * 也让面板订阅的状态切片更精确（不因 history/phase 变化而重渲染）。
 */
export type FocusScope = Pick<FocusSnapshot, 'focusLevel' | 'selectedId'>

/** 供 UI 预判某个操作是否会产生状态变化（用于禁用按钮 / 隐藏提示） */
export function canTransition(
  state: FocusSnapshot,
  event: FocusEvent,
  ctx: FocusContext,
): boolean {
  return transition(state, event, ctx) !== state
}
