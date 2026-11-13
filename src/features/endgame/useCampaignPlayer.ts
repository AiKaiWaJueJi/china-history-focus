/**
 * 战役序列播放器（Campaign Player）
 * ===========================================================================
 * 播放被拆成两个维度：**阶段序号** 与 **阶段内小步**。
 * 于是"生长 → 停留 → 下一段"是一个显式两态机，而不是一堆 setTimeout 堆叠。
 *
 *   idle ──点击国家──▶ playing(index=0, stage=grow)
 *   grow ──1500ms──▶ hold
 *   hold ──500ms──▶ index+1 < n ? grow : settled
 *   settled ──▶ 打开战报；地图上的路线保留为半透明
 *   任意态 ──双击──▶ settled（立即打开战报）
 *   任意态 ──切国/回退──▶ idle（清空）
 *
 * 计时器放在 hook 里（见 useCampaignPlayer），store 只存离散状态；
 * 这样组件重渲染不会重启动画。
 */
import { useEffect } from 'react'
import { create } from 'zustand'
import type { CampaignPhase } from '../../core/emperorTypes'

/** 单段路线生长耗时 */
export const CAMPAIGN_GROW_MS = 1500
/** 生长完毕后的停留，让"结果"被看清 */
export const CAMPAIGN_HOLD_MS = 500

export type CampaignStage = 'grow' | 'hold'

export interface CampaignState {
  campaignNation: string | null
  /** 当前正在播放的段序号（0 起）；-1 表示未开始 */
  campaignIndex: number
  campaignStage: CampaignStage
  /** 整段战役是否播放完毕 */
  campaignDone: boolean
  /** 战报里 hover 某一段时，地图上重新点亮它（不写字） */
  hoveredCampaign: number | null

  startCampaign: (nationId: string) => void
  setCampaignStage: (stage: CampaignStage) => void
  /** 推进到下一段；到末尾则置为 done */
  advanceCampaign: (total: number) => void
  finishCampaign: () => void
  clearCampaign: () => void
  setHoveredCampaign: (phase: number | null) => void
}

export const useCampaignStore = create<CampaignState>()((set, get) => ({
  campaignNation: null,
  campaignIndex: -1,
  campaignStage: 'grow',
  campaignDone: false,
  hoveredCampaign: null,

  startCampaign: (nationId) =>
    set({
      campaignNation: nationId,
      campaignIndex: 0,
      campaignStage: 'grow',
      campaignDone: false,
      hoveredCampaign: null,
    }),

  setCampaignStage: (stage) => set({ campaignStage: stage }),

  advanceCampaign: (total) => {
    const next = get().campaignIndex + 1
    if (next >= total) {
      set({ campaignDone: true, campaignIndex: total - 1 })
    } else {
      set({ campaignIndex: next, campaignStage: 'grow' })
    }
  },

  finishCampaign: () => set({ campaignDone: true }),

  clearCampaign: () =>
    set({
      campaignNation: null,
      campaignIndex: -1,
      campaignStage: 'grow',
      campaignDone: false,
      hoveredCampaign: null,
    }),

  setHoveredCampaign: (phase) => set({ hoveredCampaign: phase }),
}))

/**
 * 驱动状态机前进的计时器。
 * 只在 `grow` / `hold` 两态各排一个 timer，状态一变就清掉旧 timer。
 */
export function useCampaignPlayer(
  campaigns: CampaignPhase[],
  onSettled: () => void,
) {
  const nation = useCampaignStore((s) => s.campaignNation)
  const index = useCampaignStore((s) => s.campaignIndex)
  const stage = useCampaignStore((s) => s.campaignStage)
  const done = useCampaignStore((s) => s.campaignDone)

  useEffect(() => {
    if (!nation || done) return

    const timer = window.setTimeout(
      () => {
        const store = useCampaignStore.getState()
        if (store.campaignStage === 'grow') {
          store.setCampaignStage('hold')
        } else {
          store.advanceCampaign(campaigns.length)
        }
      },
      stage === 'grow' ? CAMPAIGN_GROW_MS : CAMPAIGN_HOLD_MS,
    )

    return () => window.clearTimeout(timer)
    // index 变化也必须重排 timer，因此一并列入依赖
  }, [nation, index, stage, done, campaigns.length])

  // 播放结束：打开战报（只触发一次）
  useEffect(() => {
    if (done) onSettled()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done])
}
