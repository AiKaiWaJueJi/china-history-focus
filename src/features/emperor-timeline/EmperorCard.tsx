/**
 * EmperorCard —— 单个帝王模块
 * ===========================================================================
 * 结构分三层，故意的：
 *   .emp-clip   负责圆角 + 裁剪（背景放大时不会溢出模块）
 *   .emp-media  背景图，hover 时 scale(1.05)，只动 transform（合成器友好）
 *   .emp-events 事件浮层，**在 .emp-clip 外面**，所以能伸出模块上下边界
 *
 * 悬浮态全部由 CSS `:has()` 驱动（见 emperor-timeline.css）：
 * 鼠标在 3 个模块间移动时 React 不重渲染，效果依旧跟手。
 */
import type { CSSProperties } from 'react'
import type { EmperorRecord } from '../../core/emperorTypes'
import { EventMindMap } from './EventMindMap'

interface EmperorCardProps {
  emperor: EmperorRecord
  /** 在本页中的序号，用于错峰入场 */
  index: number
}

type CardStyle = CSSProperties & {
  '--portrait': string
  '--delay': string
}

export function EmperorCard({ emperor, index }: EmperorCardProps) {
  const style: CardStyle = {
    '--portrait': `url("${emperor.portrait}")`,
    '--delay': `${index * 70}ms`,
  }

  // 2-3 个事件：一半朝上、一半朝下，形成上下对称的导图
  const splitAt = Math.ceil(emperor.events.length / 2)
  const topEvents = emperor.events.slice(0, splitAt)
  const bottomEvents = emperor.events.slice(splitAt)

  return (
    <article className="emp-card" style={style} tabIndex={0}>
      <div className="emp-clip">
        <div className="emp-media" />
        <div className="emp-shade" />
        <div className="emp-content">
          <h2 className="emp-title">{emperor.posthumousTitle}</h2>
          <p className="emp-name">{emperor.personalName}</p>
          <p className="emp-reign">{emperor.reign}</p>
        </div>
        <span className="emp-corner" aria-hidden="true" />
      </div>

      <EventMindMap events={topEvents} side="top" />
      <EventMindMap events={bottomEvents} side="bottom" />
    </article>
  )
}
