/**
 * 导航服务（让非组件代码也能跳转）
 * ---------------------------------------------------------------------------
 * 状态机 / store 不是 React 组件，拿不到 useNavigate。
 * 所以这里做一层"可注入的导航函数"：由 RouterBridge 在 Router 上下文里注册，
 * store 里直接调用 `navigateTo(...)` 即可。
 *
 * 好处：阶段一的 DynastyGallery / DynastyPanel **一行都不用改**——
 * 它们照旧调用 store.openDynasty(id)，跳转由 store 内部完成。
 */

type NavigateFn = (to: string) => void

let navigateFn: NavigateFn | null = null

export function setNavigator(fn: NavigateFn | null) {
  navigateFn = fn
}

export function navigateTo(to: string) {
  navigateFn?.(to)
}

/** 朝代详情页路径（阶段二的帝王时间轴） */
export function dynastyPath(dynastyId: string): string {
  return `/dynasty/${dynastyId}`
}
