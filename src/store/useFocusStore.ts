/**
 * 全局焦点 Store（Zustand）
 * ---------------------------------------------------------------------------
 * 职责刻意收窄为三件事：
 *   1. 托管状态机快照；
 *   2. 把 UI 意图翻译成状态机事件；
 *   3. 暴露**细粒度 selector**，让每块面板只订阅自己关心的那一片状态。
 *
 * 【为什么不用一个大的 useStore() 取全部】
 * 若面板订阅整个快照，任何一次焦点变化都会让 4 块面板 + 全部子项重渲染，
 * 动画期间就会掉帧。下面的 selector 保证：
 *   - 面板只订阅 `focusLevel === 自己` 这个布尔值 → 只有"对焦"和"失焦"两个时刻重渲染；
 *   - 相位 phase 单独订阅，用于开关 will-change。
 */
import { create } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import type { FocusEvent, FocusScope, FocusSnapshot } from '../core/focusMachine'
import { INITIAL_FOCUS, transition } from '../core/focusMachine'
import type { FocusLevel } from '../core/types'
import { entityExists } from '../data'

interface FocusStore extends FocusSnapshot {
  /** 统一的事件入口：所有状态变更都必须经过状态机，禁止直接 set 字段 */
  dispatch: (event: FocusEvent) => void
  /** 语义化快捷方法（内部仍然只调用 dispatch） */
  focus: (level: FocusLevel, id: string) => void
  back: () => void
  reset: () => void
  settle: () => void
}

/** 注入给状态机的上下文（依赖倒置：状态机不直接依赖数据层） */
const machineContext = { entityExists }

export const useFocusStore = create<FocusStore>()((set, get) => ({
  ...INITIAL_FOCUS,

  dispatch: (event) => {
    const current = get()
    const next = transition(
      {
        focusLevel: current.focusLevel,
        selectedId: current.selectedId,
        history: current.history,
        phase: current.phase,
      },
      event,
      machineContext,
    )
    // 状态机在"无效事件"时返回同一引用，这里据此跳过通知
    if (next === current) return
    set(next)
  },

  focus: (level, id) => get().dispatch({ type: 'FOCUS', level, id }),
  back: () => get().dispatch({ type: 'BACK' }),
  reset: () => get().dispatch({ type: 'RESET' }),
  settle: () => get().dispatch({ type: 'SETTLE' }),
}))

/* -------------------------------------------------------------------------- */
/* 细粒度 selector：组件通过这些读取状态，避免不必要的重渲染                    */
/* -------------------------------------------------------------------------- */

/** 某块面板是否处于焦点（布尔值，只有翻转时才通知） */
export const useIsFocused = (level: FocusLevel) =>
  useFocusStore((s) => s.focusLevel === level)

/** 当前动画相位 */
export const useFocusPhase = () => useFocusStore((s) => s.phase)

/** 当前焦点层级 */
export const useFocusLevel = () => useFocusStore((s) => s.focusLevel)

/** 当前选中 ID */
export const useSelectedId = () => useFocusStore((s) => s.selectedId)

/** 是否可以回退（用于按钮禁用态） */
export const useCanGoBack = () => useFocusStore((s) => s.history.length > 0)

/**
 * 面板用的最小切片：只包含「层级 + 选中 ID」。
 * 用 useShallow 做浅比较，避免每次 set 都生成新对象导致无谓重渲染；
 * 刻意**不包含** phase，因为面板内容与动画相位无关。
 */
export const useFocusScope = (): FocusScope =>
  useFocusStore(useShallow((s) => ({ focusLevel: s.focusLevel, selectedId: s.selectedId })))
