/**
 * 动效令牌（Motion Tokens）
 * ---------------------------------------------------------------------------
 * 景深效果的全部数值都集中在此，组件只消费、不硬编码。
 * 后期调参（做"更像相机"的虚化）只改这一个文件，不必翻遍组件。
 *
 * 【规格来源】阶段一需求明确给定：
 *   聚焦容器：opacity 1,  blur 0px,  scale 1.10, z-index 50
 *   背景容器：opacity 0.4, blur 8px, scale 0.95, z-index 10, pointer-events none
 *
 * 映射关系为「非聚焦即背景」两档：panelLevel === focusLevel ? FOCUSED_LAYER : BACKGROUND_LAYER。
 * 若阶段二需要三档景深（例如引入"相邻层微虚化"），在此增加一档即可，
 * 组件侧无需改动——这是把视觉参数抽成 token 的意义。
 */
import type { FocusLevel } from '../../core/types'

export interface LayerVisual {
  opacity: number
  /** 虚化半径（px），0 表示完全清晰 */
  blur: number
  scale: number
  zIndex: number
  pointerEvents: 'auto' | 'none'
}

/** 焦点层：视觉上"被镜头对上焦" */
export const FOCUSED_LAYER: LayerVisual = {
  opacity: 1,
  blur: 0,
  scale: 1.1,
  zIndex: 50,
  pointerEvents: 'auto',
}

/** 背景层：景深之外，虚化后退，且不可交互 */
export const BACKGROUND_LAYER: LayerVisual = {
  opacity: 0.4,
  blur: 8,
  scale: 0.95,
  zIndex: 10,
  pointerEvents: 'none',
}

/**
 * 焦点切换的弹簧参数。
 * stiffness/damping 组合接近临界阻尼（ζ≈0.87）：有轻微"镜头吸附"的回弹感，
 * 但不会过冲抖动；mass < 1 让起步更轻快。
 */
export const FOCUS_SPRING = {
  type: 'spring',
  stiffness: 210,
  damping: 26,
  mass: 0.9,
  restDelta: 0.001,
} as const

/**
 * 层级元信息：序号 + 中文名。
 * 面板头部（"L1 · 朝代"）与 HUD（"朝代"）共用同一份定义，
 * 避免层级名称散落在多处、改动时漏改。
 */
export const LEVEL_META: Record<FocusLevel, { index: number; name: string }> = {
  dynasty: { index: 1, name: '朝代' },
  emperor: { index: 2, name: '帝王' },
  event: { index: 3, name: '史事' },
  character: { index: 4, name: '人物' },
}
