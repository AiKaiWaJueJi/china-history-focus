/**
 * DynastyPanel —— 单个朝代模块
 * ===========================================================================
 * 纯展示 + 一个 onClick。**不持有任何 hover 状态**：
 * 挤压动画完全由 CSS `:has()` 驱动（见 index.css），
 * 鼠标划过 13 个模块时 React 一次都不重渲染。
 *
 * 信息量随宽度自适应（容器查询）：
 *   窄态（约 110px）：序号 + 竖排朝代名 + 年代缩写
 *   宽态（悬停约 270px）：额外展开 子时期 / 都城 / 代表器物
 * 用 opacity 而不是 display:none 切换，避免变宽瞬间内部发生布局跳动。
 */
import type { CSSProperties } from 'react'
import type { Dynasty } from '../../core/types'
import { resolveDynastyFont, shortPeriod } from '../../lib/fonts'

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
  '--font-dynasty': string
}

export function DynastyPanel({ dynasty, index, onOpen }: DynastyPanelProps) {
  const style: PanelStyle = {
    '--accent': dynasty.accent,
    '--accent-soft': dynasty.accentSoft,
    '--media': `url("${dynasty.artifact}")`,
    // 字体随朝代变化：篆/隶/楷/行，按数据的 fontStyle 字段解析
    '--font-dynasty': resolveDynastyFont(dynasty.fontStyle),
  }

  return (
    <button
      type="button"
      className="dyn-panel"
      style={style}
      onClick={onOpen}
      aria-label={`${dynasty.name}朝，${dynasty.period}，代表器物${dynasty.representativeItem}`}
    >
      {/* 器物背景：独立层，只做 transform 动画（合成器友好） */}
      <span className="dyn-media" aria-hidden="true" />
      {/* 压暗遮罩：静态渐变，保证文字对比度 */}
      <span className="dyn-shade" aria-hidden="true" />
      {/* 悬浮提亮：纯 opacity，避免动画化渐变导致每帧重绘 */}
      <span className="dyn-light" aria-hidden="true" />
      {/* 顶部主题色展签线 */}
      <span className="dyn-edge" aria-hidden="true" />

      <span className="dyn-body">
        <span className="dyn-ord">{String(index + 1).padStart(2, '0')}</span>

        {/* 竖排书法朝代名 —— 视觉主角，且字体风格随朝代演变 */}
        <span className="dyn-name">{dynasty.name}</span>

        <span className="dyn-meta">
          <span className="dyn-period">{shortPeriod(dynasty.period)}</span>

          {/* 宽态才展开的补充信息；窄态保留占位，避免变宽时布局跳动 */}
          <span className="dyn-detail">
            <span className="dyn-detail-line">{dynasty.subPeriods.join(' · ')}</span>
            <span className="dyn-detail-line">都 {dynasty.capital}</span>
            <span className="dyn-detail-item">{dynasty.representativeItem}</span>
          </span>
        </span>
      </span>
    </button>
  )
}
