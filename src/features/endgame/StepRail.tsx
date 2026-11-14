/**
 * StepRail —— 阶梯式时间线控制器
 * ===========================================================================
 * 0 = 战前，1..6 = 已灭到第 N 国。
 * 这是「可逆」最直观的入口：任意节点都可双向跳转，
 * 而且它把"顺序"这件事显式画了出来（韩→赵→魏→楚→燕→齐）。
 */
import type { EndgameEvent } from '../../core/emperorTypes'
import { useEndgameStore } from './useEndgameStore'

interface StepRailProps {
  events: EndgameEvent[]
  index: number
  onSelect: (value: number) => void
  /** 「战前」节点的年份，由沙盘数据给出（周：前230 / 楚汉：前206） */
  preYear: string
}

export function StepRail({ events, index, onSelect, preYear }: StepRailProps) {
  // 与地图双向联动：地图上悬浮哪一国，这里对应的节点就亮起流光
  const hovered = useEndgameStore((s) => s.hoveredNation)
  const setHovered = useEndgameStore((s) => s.setHovered)

  return (
    <nav className="step-rail" aria-label="统一进程节点">
      <button
        type="button"
        className={`rail-node rail-node--zero${index === 0 ? ' is-active' : ''}`}
        onClick={() => onSelect(0)}
        onMouseEnter={() => setHovered(null)}
      >
        <span className="rail-node-name">战前</span>
        <span className="rail-node-year">{preYear}</span>
      </button>

      {events.map((event) => {
        const state = event.order < index ? 'past' : event.order === index ? 'active' : 'future'
        return (
          <button
            key={event.id}
            type="button"
            className={`rail-node is-${state}${hovered === event.nationId ? ' is-hovered' : ''}`}
            onClick={() => onSelect(event.order)}
            onMouseEnter={() => setHovered(event.nationId)}
            onMouseLeave={() => setHovered(null)}
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
