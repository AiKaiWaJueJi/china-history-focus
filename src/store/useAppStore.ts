/**
 * 全局应用 Store（Zustand）
 * ---------------------------------------------------------------------------
 * 只托管「视图状态机快照」，不托管 hover —— 原因见 core/viewMachine.ts 顶部说明。
 *
 * selector 刻意拆得细：视图1 的面板只订阅自己需要的字段，
 * 任何一次状态变更都不会让整棵树重渲染。
 */
import { create } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import type { AppEvent, AppSnapshot } from '../core/viewMachine'
import { INITIAL_APP, transition } from '../core/viewMachine'
import { entityExists } from '../data'
import { dynastyPath, navigateTo } from '../router/navigation'

interface AppStore extends AppSnapshot {
  dispatch: (event: AppEvent) => void
  openDynasty: (id: string) => void
  openEmperor: (id: string) => void
  toggleFigure: (id: string) => void
  toggleEvent: (id: string) => void
  back: () => void
  reset: () => void
}

const machineContext = {
  dynastyExists: entityExists.dynasty,
  emperorExists: entityExists.emperor,
  figureExists: entityExists.figure,
  eventExists: entityExists.event,
}

export const useAppStore = create<AppStore>()((set, get) => ({
  ...INITIAL_APP,

  dispatch: (event) => {
    const current = get()
    const next = transition(
      {
        view: current.view,
        dynastyId: current.dynastyId,
        emperorId: current.emperorId,
        figureId: current.figureId,
        expandedEventId: current.expandedEventId,
      },
      event,
      machineContext,
    )
    if (next === current) return
    set(next)
  },

  openDynasty: (id) => {
    get().dispatch({ type: 'OPEN_DYNASTY', id })
    // 路由跳转由这里发起：阶段一主页只负责调用 openDynasty，不必关心路由
    navigateTo(dynastyPath(id))
  },
  openEmperor: (id) => get().dispatch({ type: 'OPEN_EMPEROR', id }),
  toggleFigure: (id) => get().dispatch({ type: 'TOGGLE_FIGURE', id }),
  toggleEvent: (id) => get().dispatch({ type: 'TOGGLE_EVENT', id }),
  back: () => get().dispatch({ type: 'BACK' }),
  reset: () => get().dispatch({ type: 'RESET' }),
}))

/** 视图标识（低频变更） */
export const useView = () => useAppStore((s) => s.view)

/** 当前朝代（视图2/3 作用域） */
export const useCurrentDynastyId = () => useAppStore((s) => s.dynastyId)

/** 当前帝王（视图3 作用域） */
export const useCurrentEmperorId = () => useAppStore((s) => s.emperorId)

/** 视图3 的人物态 / 事件挤压态 */
export const useDetailState = () =>
  useAppStore(
    useShallow((s) => ({ figureId: s.figureId, expandedEventId: s.expandedEventId })),
  )
