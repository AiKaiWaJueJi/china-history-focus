/**
 * EventMindMap —— 悬浮时向上下延伸的事件浮层（思维导图节点）
 * ===========================================================================
 * 需求：鼠标悬浮帝王模块时，在模块**上方和下方**以浮层形式延伸出 2-3 个
 *       重大历史事件名称；移开时平滑淡出。
 *
 * 实现取舍：
 *   · 纯 CSS 驱动显隐（`.emp-card:hover .emp-events`），鼠标移动时零 React 重渲染，
 *     和阶段一的挤压交互保持同一套性能哲学。
 *   · 浮层用 absolute 定位挂在上/下方，**不参与文档流**——
 *     这样它出现/消失都不会引起周围模块重排，避免"浮层一出、三块卡片抖动"。
 *   · 连线用伪元素画 1px 竖线 + 端点圆点，形成"从卡片长出去"的导图感。
 *   · pointer-events: none，浮层不会抢走 hover（否则鼠标一移上去卡片就失去悬浮态）。
 */
import type { CSSProperties } from 'react'
import type { EmperorEvent } from '../../core/emperorTypes'

interface EventMindMapProps {
  events: EmperorEvent[]
  /** 浮层位于卡片上方还是下方 */
  side: 'top' | 'bottom'
}

const formatYear = (year: number) => (year < 0 ? `前${Math.abs(year)}` : `${year}`)

export function EventMindMap({ events, side }: EventMindMapProps) {
  if (events.length === 0) return null

  return (
    <div className={`emp-events emp-events--${side}`} aria-hidden="true">
      {events.map((event, index) => (
        <div
          key={event.id}
          className="emp-event"
          style={{ '--i': index } as CSSProperties}
        >
          <span className="emp-event-dot" />
          <span className="emp-event-body">
            <span className="emp-event-name">{event.name}</span>
            <span className="emp-event-year">{formatYear(event.year)}</span>
          </span>
        </div>
      ))}
    </div>
  )
}
