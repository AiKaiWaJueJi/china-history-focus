/**
 * WarringStatesMap —— 可交互的战国版图
 * ===========================================================================
 * 三层结构：
 *   1. .map-photo   你上传的地图照片（低饱和 + 压暗 + 模糊）→ 只负责时代质感
 *   2. .map-svg     手绘示意版图（7 个 polygon）→ 负责可交互、可动画
 *   3. 墨色覆盖层   每个国家一个 clip-path 包裹 + 全宽 rect，靠 scaleX(0→1) 实现
 *                   "秦的墨色自西向东漫过该国"的吞噬观感
 *
 * 交互分层（本轮重构的重点）：
 *   悬浮 → 只出轻量卡片（年份 + 灭国 + 2-3 条要点），不展开战报
 *   点击 → 展开左侧详细战报（战前形势 / 经过 / 结局）
 *   因此默认没有常驻战报栏，地图独占整个宽度。
 */
import { useMemo } from 'react'
import type { EndgameEvent } from '../../core/emperorTypes'
import { ALL_REGIONS, RIVERS } from './mapGeometry'
import { useEndgameStore } from './useEndgameStore'

interface WarringStatesMapProps {
  events: EndgameEvent[]
  index: number
  /** 聚焦战报时地图变暗 */
  dimmed: boolean
  onConquer: (event: EndgameEvent) => void
  onExitFocus: () => void
  /** 终局态叠加层（秦印 + 进入秦朝的入口卡片） */
  overlay?: React.ReactNode
}

export function WarringStatesMap({
  events,
  index,
  dimmed,
  onConquer,
  onExitFocus,
  overlay,
}: WarringStatesMapProps) {
  const hoveredId = useEndgameStore((s) => s.hoveredNation)
  const focusedNation = useEndgameStore((s) => s.focusedNation)
  const setHovered = useEndgameStore((s) => s.setHovered)

  const eventsByNation = useMemo(() => {
    const map = new Map<string, EndgameEvent>()
    for (const event of events) map.set(event.nationId, event)
    return map
  }, [events])

  const hoveredEvent = hoveredId ? (eventsByNation.get(hoveredId) ?? null) : null
  const hoveredCaptured = hoveredEvent ? hoveredEvent.order <= index : false
  const hoveredRegion = ALL_REGIONS.find((region) => region.id === hoveredId) ?? null

  return (
    <div className="map-stage" data-dimmed={dimmed}>
      <div className="map-photo" aria-hidden="true" />

      <svg
        className="map-svg"
        viewBox="0 0 1000 640"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="战国七雄版图"
      >
        <defs>
          {ALL_REGIONS.map((region) => (
            <clipPath key={region.id} id={`clip-${region.id}`}>
              <polygon points={region.points} />
            </clipPath>
          ))}
        </defs>

        {/* 点击空白处 = 退出聚焦 */}
        <rect className="map-bg" x="0" y="0" width="1000" height="640" onClick={onExitFocus} />

        {RIVERS.map((d, i) => (
          <path key={i} className="map-river" d={d} />
        ))}

        {ALL_REGIONS.map((region) => {
          const event = eventsByNation.get(region.id) ?? null
          const isQin = region.id === 'qin'
          const captured = isQin || (event ? event.order <= index : false)
          const isNewest = Boolean(event && event.order === index)

          return (
            <g
              key={region.id}
              className={`region${captured ? ' is-captured' : ''}${isNewest ? ' is-newest' : ''}${
                hoveredId === region.id ? ' is-hovered' : ''
              }${isQin ? ' is-qin' : ''}${focusedNation === region.id ? ' is-focused' : ''}`}
              data-nation={region.id}
              data-captured={captured ? 'true' : 'false'}
              onClick={() => {
                if (!event) return
                onConquer(event)
              }}
              onMouseEnter={() => setHovered(region.id)}
              onMouseLeave={() => setHovered(null)}
            >
              <polygon className="region-base" points={region.points} style={{ fill: region.color }} />

              {/* 墨色蔓延层：被国家轮廓裁剪，scaleX 0→1 */}
              <g clipPath={`url(#clip-${region.id})`} className="region-ink-wrap">
                <rect className="region-ink" x="0" y="0" width="1000" height="640" />
              </g>

              <polygon className="region-edge" points={region.points} />

              <text
                className="region-label"
                x={region.label[0]}
                y={region.label[1]}
                textAnchor="middle"
                dominantBaseline="middle"
              >
                {region.name}
              </text>

              {/* 国都 */}
              {region.capital ? (
                <g className="capital" pointerEvents="none">
                  <circle className="capital-halo" cx={region.capital.x} cy={region.capital.y} r={9} />
                  <circle className="capital-dot" cx={region.capital.x} cy={region.capital.y} r={3.6} />
                  <text className="capital-label" x={region.capital.x} y={region.capital.y + 21}>
                    {region.capital.name}
                  </text>
                </g>
              ) : null}
            </g>
          )
        })}
      </svg>

      {/* 悬浮卡片：轻量，只给要点，不展开战报 */}
      {hoveredEvent && hoveredRegion ? (
        <div
          className={`map-tip${hoveredCaptured ? ' is-captured' : ''}${
            hoveredRegion.label[1] < 220 ? ' is-below' : ''
          }`}
          style={{
            left: `${(hoveredRegion.label[0] / 1000) * 100}%`,
            top: `${(hoveredRegion.label[1] / 640) * 100}%`,
          }}
        >
          <span className="map-tip-year">{hoveredEvent.year}</span>
          <span className="map-tip-title">{hoveredEvent.desc}</span>
          {hoveredCaptured ? (
            <ul className="map-tip-list">
              {hoveredEvent.highlights.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : (
            <span className="map-tip-brief">尚未入秦图 · 点击推演至此</span>
          )}
          <span className="map-tip-action">{hoveredCaptured ? '点击查看详情 →' : ''}</span>
        </div>
      ) : null}

      {overlay}

      <p className="map-footnote">示意版图 · 相对方位依史 · 悬停看要点，点击看详情</p>
    </div>
  )
}
