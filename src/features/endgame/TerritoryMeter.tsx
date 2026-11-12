/**
 * TerritoryMeter —— 大秦版图（六边形拼图 + 进度）
 * ===========================================================================
 * 用"六个六边形依次淬金"替代真实地图：
 *   画战国地图既难又卡，而六边形本身就自带"版图/疆域"的隐喻，
 *   每灭一国就有一块从灰铁变成黑金，视觉上就是"天下一统"在推进。
 *
 * 实现：clip-path 切六边形（纯 CSS，不产生额外 DOM 层级），
 * 颜色/亮度切换只动 filter 与 background，不触发重排。
 */
import type { EndgameEvent } from '../../core/emperorTypes'

interface TerritoryMeterProps {
  events: EndgameEvent[]
  fallen: number
}

export function TerritoryMeter({ events, fallen }: TerritoryMeterProps) {
  const total = events.length
  const ratio = total === 0 ? 0 : fallen / total

  return (
    <div className="territory" aria-label={`大秦版图扩张进度 ${fallen}/${total}`}>
      <div className="territory-head">
        <span className="territory-title">大秦版图</span>
        <span className="territory-count">
          已灭 <em>{fallen}</em> / {total}
        </span>
      </div>

      <div className="territory-hexes">
        {events.map((event, i) => {
          const inked = i < fallen
          return (
            <span
              key={event.id}
              className={`hex${inked ? ' is-inked' : ''}${i === fallen - 1 ? ' is-newest' : ''}`}
              title={inked ? `${event.target} · ${event.year}已入秦图` : `${event.target} · 未下`}
            >
              <span className="hex-label">{event.target}</span>
            </span>
          )
        })}
      </div>

      <div className="territory-bar" aria-hidden="true">
        <span className="territory-bar-fill" style={{ transform: `scaleX(${ratio})` }} />
      </div>
    </div>
  )
}
