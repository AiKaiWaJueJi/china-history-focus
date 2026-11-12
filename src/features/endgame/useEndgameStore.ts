/**
 * 终局推演状态机（Zustand）
 * ===========================================================================
 * 三个阶段：idle（待启动）→ playing（推演中）→ sealed（秦印落下，可进入秦朝）
 *
 * 为什么用 store 而不是组件内 useState：
 *   推演是"有时间序列的状态推进"，需要被多个组件读取
 *   （诸侯卡、版图刻度、战报、终局印章），且必须能一键重置。
 *   集中到一个 store 后，任何时刻这些组件看到的都是同一个 step，
 *   不会出现"卡片已灰、版图还没亮"的错位。
 *
 * 只存**离散状态**，不存动画：动画由 CSS / Framer 各自处理。
 */
import { create } from 'zustand'

export type EndgamePhase = 'idle' | 'playing' | 'sealed'

interface EndgameStore {
  phase: EndgamePhase
  /** 已陷落的国家数量（0..total） */
  fallen: number
  /** 音效静音开关 */
  muted: boolean
  /** 总国数（由页面按数据注入，用于边界计算） */
  total: number
  begin: (total: number) => void
  /** 第 index 个国家陷落（index 从 0 起） */
  fall: (index: number) => void
  seal: () => void
  reset: () => void
  toggleMute: () => void
}

export const useEndgameStore = create<EndgameStore>()((set, get) => ({
  phase: 'idle',
  fallen: 0,
  muted: false,
  total: 0,

  begin: (total) => set({ phase: 'playing', fallen: 0, total }),
  fall: (index) => {
    // 幂等：重复调用不会让计数倒退或跳变
    if (get().phase !== 'playing') return
    const next = Math.min(index + 1, get().total)
    if (next <= get().fallen) return
    set({ fallen: next })
  },
  seal: () => {
    if (get().phase === 'playing') set({ phase: 'sealed' })
  },
  reset: () => set({ phase: 'idle', fallen: 0 }),
  toggleMute: () => set({ muted: !get().muted }),
}))

/* 细粒度 selector：避免无关字段变化导致整页重渲染 */
export const useEndgamePhase = () => useEndgameStore((s) => s.phase)
export const useFallenCount = () => useEndgameStore((s) => s.fallen)
export const useMuted = () => useEndgameStore((s) => s.muted)
