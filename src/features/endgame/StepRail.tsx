/**
 * StepRail —— 阶梯式时间线控制器
 * ===========================================================================
 * 0 = 战前，1..6 = 已灭到第 N 国。
 * 这是「可逆」最直观的入口：任意节点都可双向跳转，
 * 而且它把"顺序"这件事显式画了出来（韩→赵→魏→楚→燕→齐）。
 */
import type { EndgameEvent } from '../../core/emperorTypes'

interface StepRailProps {
  events: EndgameEvent[]
  index: number
  onSelect: (value: number) => void
}

export function StepRail({ events, index, onSelect }: StepRailProps) {
  return (
    <nav className="step-rail" aria-label="统一进程节点">
      <button
        type="button"
        className={`rail-node rail-node--zero${index === 0 ? ' is-active' : ''}`}
        onClick={() => onSelect(0)}
      >
        <span className="rail-node-name">战前</span>
        <span className="rail-node-year">前256</span>
      </button>

      {events.map((event) => {
        const state = event.order < index ? 'past' : event.order === index ? 'active' : 'future'
        return (
          <button
            key={event.id}
            type="button"
            className={`rail-node is-${state}`}
            onClick={() => onSelect(event.order)}
            aria-current={state === 'active' ? 'step' : undefined}
          >
            <span className="rail-node-name">{event.target}</span>
            <span className="rail-node-year">{event.year.replace('年', '')}</span>
          </button>
        )
      })}

      <div className="rail-progress" aria-hidden="true">
        <span
          className="rail-progress-fill"
          style={{ transform: `scaleX(${events.length === 0 ? 0 : index / events.length})` }}
        />
      </div>
    </nav>
  )
}
