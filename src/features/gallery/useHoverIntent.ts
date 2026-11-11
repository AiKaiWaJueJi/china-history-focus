/**
 * useHoverIntent —— 指针意图控制器
 * ===========================================================================
 * 为什么不再用 CSS :hover：
 *
 *   挤压会改变各模块宽度 → 布局在**静止的光标下方**发生位移 →
 *   浏览器会在光标位置重新判定 hover，于是"焦点"被相邻模块抢走。
 *   用户的感受就是："我没动鼠标，聚焦的模块却跑到下一格去了。"
 *
 *   CSS :hover 无法区分「指针真的移动了」和「元素自己移动到指针下面了」，
 *   所以必须由 JS 来判定"意图"。
 *
 * 本控制器做三件事：
 *   1. 真实位移判定：两次 pointermove 的坐标差 < 2px 视为未移动，直接忽略。
 *      布局位移时浏览器会补发一次合成 pointermove，坐标不变 → 被这条规则挡掉。
 *   2. 停留阈值（dwell）：指针进入某模块后要停留 80ms 才激活。
 *      横扫时每次移动都会重置计时器，中间模块因此完全不参与动画。
 *   3. 单向锁：一旦激活，只有**真实的指针移动**才会改变激活项；
 *      布局变化本身不会引起任何切换。
 *
 * 实现上是纯 DOM 操作（读写 data-active 属性），不经过 React state，
 * 因此依然保持"hover 期间零 React 重渲染"这个前提。
 */
import { useEffect, useRef } from 'react'

export interface HoverIntentOptions {
  /** 指针停留多久才激活（ms）。越小越跟手，越大越能过滤横扫 */
  dwellMs?: number
  /** 判定为"真实移动"的最小位移（px） */
  moveTolerance?: number
}

export function useHoverIntent(options: HoverIntentOptions = {}) {
  const { dwellMs = 80, moveTolerance = 2 } = options
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = ref.current
    if (!root) return

    const panels = () => Array.from(root.querySelectorAll<HTMLElement>('.dyn-panel'))
    let timer = 0
    let pending = -1
    let active = -1
    let lastX = Number.NaN
    let lastY = Number.NaN

    const apply = (index: number) => {
      if (index === active) return
      active = index
      const list = panels()
      list.forEach((el, i) => {
        if (i === index) el.setAttribute('data-active', 'true')
        else el.removeAttribute('data-active')
      })
      if (index >= 0) root.setAttribute('data-has-active', 'true')
      else root.removeAttribute('data-has-active')
    }

    const panelIndexOf = (target: EventTarget | null): number => {
      const el = (target as HTMLElement | null)?.closest?.('.dyn-panel') as HTMLElement | null
      if (!el) return -1
      return panels().indexOf(el)
    }

    const onPointerMove = (event: PointerEvent) => {
      const dx = Math.abs(event.clientX - lastX)
      const dy = Math.abs(event.clientY - lastY)
      lastX = event.clientX
      lastY = event.clientY

      // 关键：坐标没变说明是布局位移导致的合成事件，不是用户意图
      if (dx < moveTolerance && dy < moveTolerance) return

      const index = panelIndexOf(event.target)
      if (index === pending) return

      pending = index
      window.clearTimeout(timer)

      if (index < 0) {
        apply(-1)
        return
      }

      // 停留阈值：横扫时会被下一次移动不断重置，因此中间模块不会激活
      timer = window.setTimeout(() => {
        if (pending === index) apply(index)
      }, dwellMs)
    }

    const onPointerLeave = () => {
      pending = -1
      window.clearTimeout(timer)
      lastX = Number.NaN
      lastY = Number.NaN
      apply(-1)
    }

    // 键盘可达：Tab 到某个模块时同样展开
    const onFocusIn = (event: FocusEvent) => {
      const index = panelIndexOf(event.target)
      if (index >= 0) {
        pending = index
        window.clearTimeout(timer)
        apply(index)
      }
    }
    const onFocusOut = () => {
      pending = -1
      window.clearTimeout(timer)
      apply(-1)
    }

    root.addEventListener('pointermove', onPointerMove)
    root.addEventListener('pointerleave', onPointerLeave)
    root.addEventListener('focusin', onFocusIn)
    root.addEventListener('focusout', onFocusOut)

    return () => {
      window.clearTimeout(timer)
      root.removeEventListener('pointermove', onPointerMove)
      root.removeEventListener('pointerleave', onPointerLeave)
      root.removeEventListener('focusin', onFocusIn)
      root.removeEventListener('focusout', onFocusOut)
    }
  }, [dwellMs, moveTolerance])

  return ref
}
