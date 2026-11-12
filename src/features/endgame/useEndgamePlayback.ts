/**
 * useEndgamePlayback —— 序列推演的计时器驱动
 * ===========================================================================
 * 只在 phase === 'playing' 期间工作：为每个事件排一个 setTimeout，
 * 到点就 fall(index) 并敲一声战鼓；全部落定后再排一枚"封印"。
 *
 * 三个实现要点：
 *   1. **先排完所有计时器再统一清理**，不依赖链式回调 —— 组件卸载或重置时
 *      一次清空，不会留下"幽灵鼓点"。
 *   2. 音效是否播放**在回调里读 store**（getState），而不是作为依赖：
 *      否则用户中途静音会重建整个计时链，导致动画重头开始。
 *   3. 间隔 1200ms（1–1.5s 区间内），足够看清顺序又不至于拖沓。
 */
import { useEffect } from 'react'
import type { EndgameEvent } from '../../core/emperorTypes'
import { playDrum, playGong } from './audio'
import { useEndgameStore } from './useEndgameStore'

const STEP_INTERVAL = 1200
/** 最后一个国家陷落后，留一点余韵再落印 */
const SEAL_DELAY = 560

export function useEndgamePlayback(events: EndgameEvent[], interval = STEP_INTERVAL) {
  const phase = useEndgameStore((s) => s.phase)
  const fall = useEndgameStore((s) => s.fall)
  const seal = useEndgameStore((s) => s.seal)

  useEffect(() => {
    if (phase !== 'playing' || events.length === 0) return

    const timers: number[] = []

    events.forEach((_, index) => {
      timers.push(
        window.setTimeout(() => {
          fall(index)
          if (!useEndgameStore.getState().muted) playDrum(0.85)
        }, index * interval),
      )
    })

    timers.push(
      window.setTimeout(() => {
        seal()
        if (!useEndgameStore.getState().muted) playGong(1)
      }, events.length * interval + SEAL_DELAY),
    )

    return () => {
      for (const timer of timers) window.clearTimeout(timer)
    }
  }, [phase, events, interval, fall, seal])
}
