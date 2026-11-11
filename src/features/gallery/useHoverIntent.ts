/**
 * useHoverIntent —— 指针意图控制器 + 锚定式挤压布局
 * ===========================================================================
 * 为什么不再用 CSS :hover：
 *   挤压会改变各模块宽度 → 布局在**静止的光标下方**发生位移 →
 *   浏览器会在光标位置重新判定 hover，于是"焦点"被相邻模块抢走。
 *   CSS :hover 无法区分「指针真的移动了」和「元素自己移动到指针下面了」。
 *
 * 本控制器做四件事：
 *   1. 真实位移判定：两次 pointermove 坐标差 < 2px 视为未移动（挡掉合成事件）
 *   2. 停留阈值（dwell，默认 60ms）：横扫时不激活，避免逐块闪烁
 *   3. 锚定式布局：交给 squeezeLayout，按中轴线决定展开方向
 *   4. 跟随 resize 重算，避免窗口变化后宽度错位
 *
 * 全程只读写 DOM 属性 / 内联样式，不经过 React state。
 */
import { useEffect, useRef } from 'react'
import { applySqueeze } from './squeezeLayout'

export interface HoverIntentOptions {
  /** 指针停留多久才激活（ms）。越小越跟手，越大越能过滤横扫 */
  dwellMs?: number
  /** 判定为"真实移动"的最小位移（px） */
  moveTolerance?: number
}

export function useHoverIntent(options: HoverIntentOptions = {}) {
  const { dwellMs = 60, moveTolerance = 2 } = options
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

    const layout = (index: number) => applySqueeze(root, panels(), index)

    const apply = (index: number) => {
      if (index === active) return
      active = index
      // 顺序很重要：先写布局（flex-grow），再写激活标记。
      // 反过来的话，属性变更会同时改变 transition 参数，导致过渡时间轴错位。
      layout(index)
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

      // 坐标没变 → 是布局位移引发的合成事件，不是用户意图
      if (dx < moveTolerance && dy < moveTolerance) return

      const index = panelIndexOf(event.target)
      if (index === pending) return

      pending = index
      window.clearTimeout(timer)

      if (index < 0) {
        apply(-1)
        return
      }

      // 停留阈值：横扫时会被下一次移动不断重置，中间模块因此不会激活
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

    // 窗口尺寸变化后重新按新的可用宽度计算，避免激活态宽度错位
    const onResize = () => {
      if (active >= 0) layout(active)
    }

    root.addEventListener('pointermove', onPointerMove)
    root.addEventListener('pointerleave', onPointerLeave)
    root.addEventListener('focusin', onFocusIn)
    root.addEventListener('focusout', onFocusOut)
    window.addEventListener('resize', onResize)

    return () => {
      window.clearTimeout(timer)
      root.removeEventListener('pointermove', onPointerMove)
      root.removeEventListener('pointerleave', onPointerLeave)
      root.removeEventListener('focusin', onFocusIn)
      root.removeEventListener('focusout', onFocusOut)
      window.removeEventListener('resize', onResize)
    }
  }, [dwellMs, moveTolerance])

  return ref
}
