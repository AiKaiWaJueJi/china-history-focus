/**
 * 终局推演状态机（Zustand）—— 可逆阶梯式
 * ===========================================================================
 * 与上一版最大的区别：
 *   旧版：phase(idle/playing/sealed) + fallen 计数，由计时器自动推进 → 不可逆
 *   新版：**单一整数 index（0..N）**，由用户点击设定 → 天然可逆、可跳转
 *
 * 为什么一个整数就够：
 *   "哪些国家已亡"完全由 index 派生（order <= index），不另存数组。
 *   于是"回退"不需要任何撤销逻辑——把 index 改小，所有派生数据自动回退，
 *   CSS 过渡会自动从当前样式倒放到目标样式。
 *
 * 派生规则：
 *   captured(event) = event.order <= index
 *   battleEvents    = events.slice(0, index)
 *   isFinished      = index === events.length（周 6 / 楚汉 7，total 由页面注入）
 */
import { create } from 'zustand'

export interface EndgameStore {
  /** 0 = 战前；1..6 = 已灭至第 N 国 */
  index: number
  /** 战报聚焦的国家 id；null 表示未聚焦 */
  focusedNation: string | null
  /** 人物卡片的 id；null 表示未打开 */
  profileId: string | null
  /** 鼠标悬浮的国家（地图 ↔ 底部节点双向联动） */
  hoveredNation: string | null
  /** 音效开关 */
  muted: boolean
  /** 总步数（由页面注入，默认 6） */
  total: number

  /** 跳到某个历史节点（可正可负）；会自动收敛到 [0, total] */
  setIndex: (next: number) => void
  /** 直接点某个国家：跳到"该国已亡"这一节点 */
  conquerTo: (order: number, nationId: string) => void
  /** 回到战前（index = 0），并清除聚焦 */
  resetAll: () => void
  focusNation: (nationId: string | null) => void
  setHovered: (nationId: string | null) => void
  openProfile: (id: string | null) => void
  toggleMute: () => void
}

export const useEndgameStore = create<EndgameStore>()((set, get) => ({
  index: 0,
  focusedNation: null,
  profileId: null,
  hoveredNation: null,
  muted: false,
  total: 6,

  setIndex: (next) => {
    const total = get().total
    const clamped = Math.max(0, Math.min(total, next))
    if (clamped === get().index) return
    set({ index: clamped })
  },

  conquerTo: (order, nationId) => {
    const total = get().total
    const clamped = Math.max(0, Math.min(total, order))
    // 同一点击同一国家 = 取消聚焦（再次点击归位）
    const alreadyFocused = get().focusedNation === nationId && get().index === clamped
    set({
      index: clamped,
      focusedNation: alreadyFocused ? null : nationId,
    })
  },

  resetAll: () => set({ index: 0, focusedNation: null, profileId: null }),
  focusNation: (nationId) => set({ focusedNation: nationId }),
  setHovered: (nationId) => {
    if (get().hoveredNation === nationId) return
    set({ hoveredNation: nationId })
  },
  openProfile: (id) => set({ profileId: id }),
  toggleMute: () => set({ muted: !get().muted }),
}))

/* 细粒度 selector */
export const useIndex = () => useEndgameStore((s) => s.index)
export const useFocusedNation = () => useEndgameStore((s) => s.focusedNation)
export const useProfileId = () => useEndgameStore((s) => s.profileId)
export const useMuted = () => useEndgameStore((s) => s.muted)
