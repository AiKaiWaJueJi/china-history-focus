/**
 * useWheelPaging —— 滚轮分页（带节流 + 冷却）
 * ===========================================================================
 * 需求要点：全局监听 wheel、务必防抖节流、每次触发平滑切到下一页。
 *
 * 实现细节（这几条决定了"不卡顿也不连翻"）：
 *   1. **冷却时间**（cooldown）：一次翻页后 520ms 内忽略新的滚轮事件。
 *      这是最关键的一条——触控板一次滑动会产生几十个 wheel 事件，
 *      没有冷却会瞬间翻好几页。
 *   2. **阈值 + 累积**：deltaY 绝对值小于 18 视为噪声（触控板的微小抖动）忽略。
 *   3. **方向锁定**：冷却期内反向滚动不会立刻回翻，避免来回抖动。
 *   4. 监听器用 `passive: true`，不阻塞浏览器滚动线程。
 *   5. 同时支持键盘（←/→/PgUp/PgDn），保证可达性。
 */
import { useEffect, useRef } from 'react'

export interface WheelPagingOptions {
  pageCount: number
  pageIndex: number
  onChange: (nextIndex: number) => void
  /** 翻页冷却时间（ms） */
  cooldown?: number
  /** 触发翻页的最小滚动量 */
  threshold?: number
  /** 已在最后一页仍继续向下滚时触发（用于进入「终局推演」） */
  onBeyondEnd?: () => void
  /**
   * 从某一页继续向下滚时，若返回 true，表示这次翻页已被消费。
   * 用于「西周 → 东周」这类段间插叙：到段末页不下翻，而是进过渡页。
   */
  onLeavePage?: (fromIndex: number) => boolean
}

export function useWheelPaging({
  pageCount,
  pageIndex,
  onChange,
  cooldown = 520,
  threshold = 18,
  onBeyondEnd,
  onLeavePage,
}: WheelPagingOptions) {
  // 用 ref 保存最新值，避免因为重建监听器导致冷却状态丢失
  const state = useRef({ pageCount, pageIndex, onChange, onBeyondEnd, onLeavePage })
  state.current = { pageCount, pageIndex, onChange, onBeyondEnd, onLeavePage }

  const lastTime = useRef(0)
  const acc = useRef(0)

  useEffect(() => {
    const step = (direction: 1 | -1) => {
      const now = performance.now()
      if (now - lastTime.current < cooldown) return
      const {
        pageIndex: current,
        pageCount: total,
        onChange: emit,
        onBeyondEnd: beyond,
        onLeavePage: leave,
      } = state.current
      const next = current + direction

      // 段末页继续下滚 → 交给调用方决定是否进过渡页
      if (direction > 0 && leave && leave(current)) {
        lastTime.current = now
        acc.current = 0
        return
      }

      // 已到最后一页还继续向下滚 → 交给调用方（进入终局推演）
      if (next > total - 1) {
        if (beyond) {
          lastTime.current = now
          acc.current = 0
          beyond()
        }
        return
      }
      if (next < 0) return

      lastTime.current = now
      acc.current = 0
      emit(next)
    }

    const onWheel = (event: WheelEvent) => {
      // 只处理纵向滚动
      if (Math.abs(event.deltaY) < Math.abs(event.deltaX)) return
      acc.current += event.deltaY
      if (Math.abs(acc.current) < threshold) return

      const direction = acc.current > 0 ? 1 : -1
      acc.current = 0
      step(direction)
    }

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return
      if (event.key === 'ArrowRight' || event.key === 'PageDown') {
        event.preventDefault()
        step(1)
      } else if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
        event.preventDefault()
        step(-1)
      }
    }

    window.addEventListener('wheel', onWheel, { passive: true })
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('wheel', onWheel)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [cooldown, threshold])

  // 供 UI 判断边界（按钮禁用等）
  return {
    canPrev: pageIndex > 0,
    canNext: pageIndex < pageCount - 1,
  }
}
