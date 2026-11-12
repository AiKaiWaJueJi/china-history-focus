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

/** 首国落下的延迟（让玩家先看清六国并立） */
const FIRST_DELAY = 480
/** 间隔 = GAP_BASE + GAP_PER_YEAR × 真实亡国年差，并夹在 [MIN, MAX] 之间 */
const GAP_BASE = 620
const GAP_PER_YEAR = 340
const GAP_MIN = 780
const GAP_MAX = 1700
/** 最后一国陷落后，留一点余韵再落印 */
const SEAL_DELAY = 700

/**
 * 按**真实亡国年差**排节奏，而不是等间隔。
 *
 * 史实年差：韩→赵 2 年、赵→魏 3 年、魏→楚 2 年、楚→燕 1 年、燕→齐 1 年。
 * 映射到时间轴后自然形成"前缓后急"的加速：
 *
 *   韩 0.48s → 赵 1.78s → 魏 3.42s → 楚 4.72s → 燕 5.68s → 齐 6.64s → 落印 7.34s
 *
 * 前三国拖沓、后两国急促，最后戛然而止落印 —— 正是"六王毕"的收束感。
 */
export function buildSchedule(events: EndgameEvent[]): number[] {
  let cursor = FIRST_DELAY
  return events.map((event, index) => {
    if (index > 0) {
      const gapYears = Math.abs(event.yearValue - events[index - 1].yearValue)
      const gap = Math.min(GAP_MAX, Math.max(GAP_MIN, GAP_BASE + GAP_PER_YEAR * gapYears))
      cursor += gap
    }
    return cursor
  })
}

export function useEndgamePlayback(events: EndgameEvent[]) {
  const phase = useEndgameStore((s) => s.phase)
  const fall = useEndgameStore((s) => s.fall)
  const seal = useEndgameStore((s) => s.seal)

  useEffect(() => {
    if (phase !== 'playing' || events.length === 0) return

    const timers: number[] = []
    const schedule = buildSchedule(events)

    schedule.forEach((at, index) => {
      timers.push(
        window.setTimeout(() => {
          fall(index)
          // 音高逐国上行：从 110Hz 起，每国升两个半音，最后近乎尖锐
          if (!useEndgameStore.getState().muted) playDrum(0.85, index * 2)
        }, at),
      )
    })

    const lastAt = schedule[schedule.length - 1] ?? FIRST_DELAY
    timers.push(
      window.setTimeout(() => {
        seal()
        if (!useEndgameStore.getState().muted) playGong(1)
      }, lastAt + SEAL_DELAY),
    )

    return () => {
      for (const timer of timers) window.clearTimeout(timer)
    }
  }, [phase, events, fall, seal])
}
