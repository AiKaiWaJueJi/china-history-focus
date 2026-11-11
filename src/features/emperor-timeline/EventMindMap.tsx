/**
 * EventMindMap —— 悬浮时向上下延伸的事件浮层（思维导图）
 * ===========================================================================
 * 分组逻辑（这就是"上半区放什么、下半区放什么"的答案）：
 *   上半区 = 军事成就（military）：战争、征伐、兵乱 —— 冲突性、时间点明确的硬事件
 *   下半区 = 政治 · 文教（political / culture）：制度、君位更迭、会盟、文教
 *
 * 为什么这样分：
 *   1. 军事事件天然"向外扩张"，放上方像旗帜；政治制度向内收敛，放下方像根基，
 *      视觉隐喻与内容语义同向，读者不需要额外解释就能建立预期。
 *   2. 下半区把政治与文教合并，是因为二者在周代高度耦合（制礼作乐、
 *      学在官府），拆成三组会让每一侧只剩一个孤零零的节点，反而更乱。
 *   3. 某一侧为空时整组不渲染，另一侧独占该方向的空间，不会出现空框。
 *
 * 布局：同一侧的事件**横向排列**，用满卡片宽度；每个节点向卡片方向引出一条竖线，
 * 形成树状分叉，而不是单列堆叠的一条线。
 *
 * 性能/交互：显隐仍由 CSS `:hover` 驱动，React 不参与；浮层 `pointer-events: none`，
 * 否则鼠标移上去卡片就失去悬浮态、浮层会自己消失。
 */
import type { CSSProperties } from 'react'
import type { EmperorEvent } from '../../core/emperorTypes'

interface EventMindMapProps {
  events: EmperorEvent[]
  /** 浮层位于卡片上方还是下方 */
  side: 'top' | 'bottom'
  /** 分组标题，如「军事成就」 */
  label: string
}

const formatYear = (year: number) => (year < 0 ? `前${Math.abs(year)}` : `${year}`)

export function EventMindMap({ events, side, label }: EventMindMapProps) {
  if (events.length === 0) return null

  return (
    <div className={`emp-events emp-events--${side}`} aria-hidden="true">
      <p className="emp-group-label">{label}</p>
      <div className="emp-event-row">
        {events.map((event, index) => (
          <div
            key={event.id}
            className="emp-event"
            data-dimension={event.dimension}
            data-side={side}
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
    </div>
  )
}
