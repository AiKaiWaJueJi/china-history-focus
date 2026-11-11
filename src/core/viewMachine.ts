/**
 * 视图状态机（View State Machine）
 * ===========================================================================
 * 统一管理「当前在哪个视图 + 选中了谁」，三个阶段共用这一台机器。
 *
 * 【为什么 hover 不进状态机】
 * 阶段一的核心诉求是「hover 时的挤压动画要极致丝滑」。
 * 如果把 hover 写进 Zustand，鼠标每移动一次就会触发一次 setState → React 重渲染，
 * 动画期间 React 与浏览器主线程持续争抢，必然掉帧。
 * 因此 hover 完全交给 CSS 的 `:has()` 处理（见 index.css），
 * 状态机只管「视图跳转」这类低频、离散的状态变更。
 * 这条边界是 120fps 的前提，不是偷懒。
 *
 * 【状态机只做纯计算】
 * 不 import React、不碰 DOM，可用纯函数单测；UI 层只负责派发事件与渲染快照。
 */

import type { ViewId } from './types'

export interface AppSnapshot {
  view: ViewId
  /** 当前朝代（视图2、3 的作用域） */
  dynastyId: string | null
  /** 当前帝王（视图3 的作用域） */
  emperorId: string | null
  /** 视图3 中被选中的历史人物；为 null 表示「未进入人物态」 */
  figureId: string | null
  /** 视图3 中被展开的史事（纵向挤压用）；为 null 表示为默认态 */
  expandedEventId: string | null
}

export type AppEvent =
  /** 视图1 → 视图2：进入某个朝代 */
  | { type: 'OPEN_DYNASTY'; id: string }
  /** 视图2 → 视图3：进入某个帝王 */
  | { type: 'OPEN_EMPEROR'; id: string }
  /** 视图3 内：点击人物切换「人物态 / 默认态」（再点同一人则退出） */
  | { type: 'TOGGLE_FIGURE'; id: string }
  /** 视图3 内：点击史事切换纵向挤压（再点同一事件则复原） */
  | { type: 'TOGGLE_EVENT'; id: string }
  /** 返回上一层：视图3 → 视图2 → 视图1（层内若有展开态，先收拢） */
  | { type: 'BACK' }
  /** 直接回到视图1 */
  | { type: 'RESET' }

export interface AppContext {
  dynastyExists: (id: string) => boolean
  emperorExists: (id: string) => boolean
  figureExists: (id: string) => boolean
  eventExists: (id: string) => boolean
}

export const INITIAL_APP: AppSnapshot = {
  view: 'gallery',
  dynastyId: null,
  emperorId: null,
  figureId: null,
  expandedEventId: null,
}

/**
 * 唯一的状态转移函数（纯函数）。
 *
 * 流转总览：
 *
 *   ① OPEN_DYNASTY(id)
 *        守卫：朝代存在
 *        动作：view = 'timeline'，写入 dynastyId，清空更深层的选中
 *
 *   ② OPEN_EMPEROR(id)
 *        守卫：帝王存在
 *        动作：view = 'detail'，写入 emperorId，清空 figureId / expandedEventId
 *
 *   ③ TOGGLE_FIGURE(id)
 *        守卫：人物存在 且 当前处于视图3
 *        动作：figureId === id ? 置空（回到默认态） : 设为 id
 *        说明：人物态会驱动「顶部帝王模块收起 + 左侧放大至 1/3」的联动动画，
 *              因此这是一次真正的布局态切换，必须由状态机而非 CSS 决定。
 *
 *   ④ TOGGLE_EVENT(id)
 *        守卫：事件存在 且 当前处于视图3
 *        动作：expandedEventId === id ? 置空 : 设为 id（纵向挤压）
 *
 *   ⑤ BACK
 *        优先收拢层内展开态（人物 → 事件），都为空时才退一层视图。
 *        这样「按一次返回只退一个视觉层级」，符合用户预期。
 *
 *   ⑥ RESET
 *        回到初始快照。
 *
 * 所有无效事件返回**同一对象引用**，Zustand 浅比较会跳过通知，避免空转重渲染。
 */
export function transition(
  state: AppSnapshot,
  event: AppEvent,
  ctx: AppContext,
): AppSnapshot {
  switch (event.type) {
    case 'OPEN_DYNASTY': {
      if (!ctx.dynastyExists(event.id)) return state
      if (state.view === 'timeline' && state.dynastyId === event.id) return state
      return {
        view: 'timeline',
        dynastyId: event.id,
        emperorId: null,
        figureId: null,
        expandedEventId: null,
      }
    }

    case 'OPEN_EMPEROR': {
      if (!ctx.emperorExists(event.id)) return state
      if (state.view === 'detail' && state.emperorId === event.id) return state
      return {
        view: 'detail',
        dynastyId: state.dynastyId,
        emperorId: event.id,
        figureId: null,
        expandedEventId: null,
      }
    }

    case 'TOGGLE_FIGURE': {
      if (state.view !== 'detail') return state
      if (!ctx.figureExists(event.id)) return state
      return {
        ...state,
        figureId: state.figureId === event.id ? null : event.id,
        // 进入人物态时收起事件挤压，避免两套挤压动画互相干扰
        expandedEventId: null,
      }
    }

    case 'TOGGLE_EVENT': {
      if (state.view !== 'detail') return state
      if (!ctx.eventExists(event.id)) return state
      // 人物态下右侧显示的是人物事迹，事件挤压不适用
      if (state.figureId) return state
      return {
        ...state,
        expandedEventId: state.expandedEventId === event.id ? null : event.id,
      }
    }

    case 'BACK': {
      // 层内先收拢：人物态 → 事件展开态 → 退出视图
      if (state.figureId) return { ...state, figureId: null }
      if (state.expandedEventId) return { ...state, expandedEventId: null }
      if (state.view === 'detail') {
        return { ...state, view: 'timeline', emperorId: null }
      }
      if (state.view === 'timeline') {
        return { ...INITIAL_APP }
      }
      return state
    }

    case 'RESET': {
      if (state === INITIAL_APP) return state
      const isInitial =
        state.view === INITIAL_APP.view &&
        state.dynastyId === null &&
        state.emperorId === null &&
        state.figureId === null &&
        state.expandedEventId === null
      return isInitial ? state : { ...INITIAL_APP }
    }
  }
}
