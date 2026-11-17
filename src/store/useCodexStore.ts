/**
 * useCodexStore —— 历史档案抽屉的导航栈（Zustand）
 * ===========================================================================
 * 全局只有一个抽屉。用户每深入一层，就往 navigationStack 里压一个条目 id；
 * 返回时弹栈，抽屉里换成上一层的内容，**不是**叠一个新的弹窗。
 *
 * 【四个动作的语义（和浏览器历史对齐）】
 *   open(id)      从页面打开（点帝王卡 / 点沙盘事件 / 点战报人名）→ 栈重置为 [id]
 *   drill(id)     点正文里的高亮词条 → 压栈；若目标已在栈中，则退回到那一层
 *                 （A→B→A 不会变成 A→B→A→B，和浏览器「后退到已有页面」一致）
 *   back()        栈深 > 1 弹一层；只剩一层时等同于关闭
 *   close()       整个关掉（ESC / 点空白）
 *
 * 【direction 为什么进 store 而不是组件 state】
 * 抽屉的进出动画方向（下钻从右滑入、返回从左滑回）由这次导航决定。
 * AnimatePresence 需要在**上一帧**就拿到方向，交给 store 一起变更最省事，
 * 组件里只读不写，避免两份方向状态打架。
 *
 * 【为什么单独一个 store，不塞进 useAppStore】
 * useAppStore 是「第几层视图 + 选中谁」的纯状态机（core/viewMachine 有纯函数单测），
 * 抽屉是浮在任意视图之上的**全局浮层**，和视图机正交。混在一起会让
 * BACK 同时承担「退视图」和「退抽屉」两种语义，测试和心智都会乱。
 */

import { create } from 'zustand'
import { codexById } from '../data/codex'

/** 1 = 下钻（新档案从右滑入），-1 = 返回（上一层从左滑回） */
export type CodexDirection = 1 | -1

/** 栈的深度上限：纯防御，避免脚本死循环把栈撑爆 */
const MAX_DEPTH = 24

interface CodexStore {
  /** 导航栈：navigationStack[0] 是根，最后一个是当前 */
  navigationStack: string[]
  direction: CodexDirection
  open: (id: string) => void
  drill: (id: string) => void
  back: () => void
  close: () => void
  jumpTo: (index: number) => void
}

export const useCodexStore = create<CodexStore>()((set, get) => ({
  navigationStack: [],
  direction: 1,

  open: (id) => {
    if (!codexById.has(id)) return
    const { navigationStack } = get()
    if (navigationStack.length === 1 && navigationStack[0] === id) return
    set({ navigationStack: [id], direction: 1 })
  },

  drill: (id) => {
    if (!codexById.has(id)) return
    const { navigationStack } = get()
    if (navigationStack.length === 0) {
      set({ navigationStack: [id], direction: 1 })
      return
    }
    if (navigationStack[navigationStack.length - 1] === id) return

    const seen = navigationStack.indexOf(id)
    if (seen >= 0) {
      // 目标已在历史里：退回到那一层，而不是再压一遍
      set({ navigationStack: navigationStack.slice(0, seen + 1), direction: -1 })
      return
    }
    if (navigationStack.length >= MAX_DEPTH) return
    set({ navigationStack: [...navigationStack, id], direction: 1 })
  },

  back: () => {
    const { navigationStack } = get()
    if (navigationStack.length === 0) return
    if (navigationStack.length === 1) {
      set({ navigationStack: [], direction: -1 })
      return
    }
    set({ navigationStack: navigationStack.slice(0, -1), direction: -1 })
  },

  close: () => {
    if (get().navigationStack.length === 0) return
    set({ navigationStack: [], direction: -1 })
  },

  jumpTo: (index) => {
    const { navigationStack } = get()
    if (index < 0 || index >= navigationStack.length) return
    if (index === navigationStack.length - 1) return
    set({ navigationStack: navigationStack.slice(0, index + 1), direction: -1 })
  },
}))

/* -------------------------------------------------------------------------- */
/* 选择器：组件只订阅自己需要的切片，避免整树重渲染                              */
/* -------------------------------------------------------------------------- */

/** 抽屉是否打开 */
export const useCodexOpen = () => useCodexStore((s) => s.navigationStack.length > 0)

/** 当前条目 id（返回原始值，浅比较即可判等） */
export const useCodexCurrentId = () =>
  useCodexStore((s) => (s.navigationStack.length ? s.navigationStack[s.navigationStack.length - 1] : null))

/** 动画方向 */
export const useCodexDirection = () => useCodexStore((s) => s.direction)

/** 面包屑：栈里的全部 id（只在栈变化时更新） */
export const useCodexStack = () => useCodexStore((s) => s.navigationStack)

/**
 * 抽屉是否开着（非 hook，给 window 级滚轮/键盘处理器用）。
 * 抽屉是浮层，但页面级的「滚轮翻页 / ← → 推演」监听挂在 window 上，
 * 不判断这一下就会在用户读档案时把底下那一屏偷偷翻掉。
 */
export const isCodexOpen = () => useCodexStore.getState().navigationStack.length > 0
