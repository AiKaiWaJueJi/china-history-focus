/**
 * FocusLayer —— 唯一的动画边界
 * ===========================================================================
 * 设计约束（阶段一需求）：
 *   1. 四块容器**永远挂载**，绝不用 display:none 隐藏（那会销毁布局与合成层，
 *      导致下次进入时无法做连续过渡）。
 *   2. 焦点层：opacity 1 / blur 0 / scale 1.10 / z-index 50
 *   3. 背景层：opacity 0.4 / blur 8px / scale 0.95 / z-index 10 / pointer-events none
 *   4. 必须开启 GPU 加速：will-change: transform, filter, opacity
 *
 * 【为什么要拆成"占位层 + 卡片层"两层】
 * 如果把 scale(1.1) 直接加在 grid cell 上，放大后的盒子会超出舞台边界，
 * 被 .stage 的 overflow:hidden 裁掉上下沿（标题栏被切、圆角被削）。
 * 因此这里刻意拆开：
 *   - .panel-frame（静态、无动画）：负责占据网格轨道，并提供 5vh 的上下留白；
 *   - .panel-card（动画）：只在这个留白内的盒子里缩放。
 * 这样 (100% - 2×5vh) × 1.1 ≈ 100%，放大后恰好不越界，
 * 视觉上又完整保留了"卡片向前浮起"的镜头感。
 *
 * 【为什么只订阅布尔值】
 * 若订阅整个快照，任何层级切换都会让四块面板连同其全部子项重渲染。
 * 这里只订阅 `focusLevel === 自己`，于是每次切换每块面板最多重渲染一次（翻转那一刻），
 * 真正的逐帧动画完全由 Framer Motion 在 React 渲染管线之外驱动。
 *
 * 【will-change 的生命周期】
 * 仅在 phase === 'transitioning' 期间挂载，动画结束（SETTLE）立即摘掉。
 * 长期挂着会迫使浏览器保留大量合成层，反而拖慢滚动、增加显存占用。
 *
 * 【inert 的必要性】
 * pointer-events:none 只挡鼠标，键盘 Tab 仍可聚焦到被虚化的按钮，
 * 造成"看不见却能操作"的严重可用性/无障碍问题。inert 能一次性把整棵子树
 * 移出 Tab 序与无障碍树。
 *
 * 【aa11y 降级】
 * 尊重系统「减少动画」偏好：保留透明度变化，取消缩放与虚化。
 */
import { motion, useReducedMotion } from 'framer-motion'
import type { ReactNode } from 'react'
import type { FocusLevel } from '../../core/types'
import { BACKGROUND_LAYER, FOCUSED_LAYER, FOCUS_SPRING } from '../../lib/motion/tokens'
import { useFocusPhase, useFocusStore, useIsFocused } from '../../store/useFocusStore'

interface FocusLayerProps {
  /** 这块容器对应的焦点层级 */
  level: FocusLevel
  children: ReactNode
}

export function FocusLayer({ level, children }: FocusLayerProps) {
  const isFocused = useIsFocused(level)
  const phase = useFocusPhase()
  const settle = useFocusStore((s) => s.settle)
  const prefersReducedMotion = useReducedMotion()

  // 视觉参数全部来自 tokens.ts，组件内不出现任何魔法数字
  const visual = isFocused ? FOCUSED_LAYER : BACKGROUND_LAYER

  // 无障碍降级：不做缩放与虚化，仅用透明度表达层级关系
  const targetScale = prefersReducedMotion ? 1 : visual.scale
  const targetBlur = prefersReducedMotion ? 0 : visual.blur

  const isTransitioning = phase === 'transitioning'

  return (
    <div className="panel-frame">
      <motion.section
        data-layer={level}
        data-focused={isFocused ? 'true' : 'false'}
        aria-hidden={!isFocused}
        inert={!isFocused}
        className="panel-card"
        style={{
          // z-index 是离散属性，不做插值：必须在动画第一帧就生效，
          // 否则会出现"聚焦面板被背景面板短暂压住"的层级闪烁。
          zIndex: visual.zIndex,
          pointerEvents: visual.pointerEvents,
          // GPU 加速：仅在过渡期间把元素提升为独立合成层
          willChange: isTransitioning ? 'transform, filter, opacity' : 'auto',
          transformOrigin: 'center center',
          backfaceVisibility: 'hidden',
        }}
        animate={{
          opacity: visual.opacity,
          scale: targetScale,
          filter: `blur(${targetBlur}px)`,
        }}
        transition={FOCUS_SPRING}
        onAnimationComplete={() => {
          // 只有"聚焦中的那一块"负责派发 SETTLE，避免四块面板重复发同一个事件
          if (isFocused) settle()
        }}
      >
        {children}
      </motion.section>
    </div>
  )
}
