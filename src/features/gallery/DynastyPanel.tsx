/**
 * DynastyPanel —— 单个朝代模块
 * ===========================================================================
 * 纯展示 + 一个 onClick。**不持有任何 hover 状态**：
 * 挤压动画完全由 CSS `:has()` 驱动（见 index.css），
 * 因此鼠标划过 5 个模块时 React 一次都不重渲染 —— 这是"丝滑"的根本原因。
 *
 * 主题色通过 CSS 变量注入，而不是在 JS 里算渐变字符串：
 * 变量在样式表里参与 color-mix / linear-gradient，改动只需改数据里的颜色值。
 */
import type { CSSProperties } from 'react'
import type { Dynasty } from '../../core/types'

interface DynastyPanelProps {
  dynasty: Dynasty
  /** 序号，用于左上角的编号（01 / 02 …） */
  index: number
  onOpen: () => void
}

/** CSS 自定义属性需要显式断言，否则 TS 会拒绝未知键 */
type PanelStyle = CSSProperties & {
  '--accent': string
  '--accent-soft': string
  '--media': string
}

export function DynastyPanel({ dynasty, index, onOpen }: DynastyPanelProps) {
  const style: PanelStyle = {
    '--accent': dynasty.accent,
    '--accent-soft': dynasty.accentSoft,
    '--media': `url("${dynasty.artifact}")`,
  }

  return (
    <button
      type="button"
      className="dyn-panel"
      style={style}
      onClick={onOpen}
      aria-label={`进入${dynasty.name}朝，${dynasty.period}，代表器物${dynasty.artifactName}`}
    >
      {/* 文物背景：独立层，只做 transform 动画（合成器友好） */}
      <span className="dyn-media" aria-hidden="true" />
      {/* 压暗遮罩：静态渐变，保证文字对比度随背景变化自适应 */}
      <span className="dyn-shade" aria-hidden="true" />
      {/* 悬浮提亮：纯 opacity 过渡，避免动画化 CSS 渐变导致每帧重绘 */}
      <span className="dyn-light" aria-hidden="true" />
      {/* 顶部主题色展签线 */}
      <span className="dyn-edge" aria-hidden="true" />

      <span className="dyn-body">
        <span className="dyn-ord">{String(index + 1).padStart(2, '0')}</span>

        {/* 竖排毛笔字朝代名 —— 整个视图的视觉主角 */}
        <span className="dyn-name">{dynasty.name}</span>

        <span className="dyn-meta">
          <span className="dyn-alias">{dynasty.alias}</span>
          <span className="dyn-artifact">{dynasty.artifactName}</span>
          <span className="dyn-period">{dynasty.period}</span>
        </span>
      </span>

      {/* 悬浮/聚焦时淡入的进入提示；绝对定位，不改变盒高，避免布局跳动 */}
      <span className="dyn-cta" aria-hidden="true">
        {dynasty.name}朝 · 进入 →
      </span>
    </button>
  )
}
