/**
 * WarringStatesMap —— 战国版图（无缝嵌合 · 秦色吞并 · 一统拉镜）
 * ===========================================================================
 * 视觉分四层：
 *   1. .map-photo           上传的战国地图（低饱和压暗）—— 时代质感
 *   2. .map-photo--emperor  秦始皇像（模糊），仅一统时淡入
 *   3. .map-svg             无缝嵌合的七块版图
 *   4. 秦色覆盖层           被吞并的块上盖一层"秦色"渐变，opacity 0→1
 *
 * 图块的"厚重感"来自三件事：
 *   · 统一的石色渐变（上亮下暗），而不是七种饱和度很高的彩块
 *   · 每块都有一圈青铜描边（未灭也可见），交界处自然形成双线
 *   · 整组 drop-shadow 投影，看起来像压在图上的一块石版
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
  /** 六国尽墨 */
  unified: boolean
  onConquer: (event: EndgameEvent) => void
  onExitFocus: () => void
  overlay?: React.ReactNode
}

export function WarringStatesMap({
  events,
  index,
  dimmed,
  unified,
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
  const hoveredRegion = ALL_REGIONS.find((region) => region.id === hoveredId) ?? null

  return (
    <div className="map-stage" data-dimmed={dimmed} data-unified={unified}>
      <div className="map-photo" aria-hidden="true" />
      <div className="map-photo map-photo--emperor" aria-hidden="true" />

      <svg
        className="map-svg"
        viewBox="0 0 1000 640"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="战国七雄版图"
      >
        <defs>
          {/* 石版底色：上亮下暗，制造厚度 */}
          <linearGradient id="stone" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2b241c" />
            <stop offset="42%" stopColor="#1b1712" />
            <stop offset="100%" stopColor="#0e0b09" />
          </linearGradient>

          {/* 秦色：暗铜 → 近黑 */}
          <linearGradient id="qinFill" x1="0" y1="0" x2="0.2" y2="1">
            <stop offset="0%" stopColor="#33200f" />
            <stop offset="45%" stopColor="#1d130b" />
            <stop offset="100%" stopColor="#0b0705" />
          </linearGradient>

          {/* 鎏金描边（悬浮 / 聚焦） */}
          <linearGradient id="goldStroke" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#f6e0a4" />
            <stop offset="45%" stopColor="#e0b95f" />
            <stop offset="100%" stopColor="#9c7326" />
          </linearGradient>

          {ALL_REGIONS.map((region) => (
            <clipPath key={region.id} id={`clip-${region.id}`}>
              <polygon points={region.points} />
            </clipPath>
          ))}
        </defs>

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
              {/* 石版底 */}
              <polygon className="region-base" points={region.points} />

              {/* 秦色覆盖：被吞并时淡入，形成"版图被秦色填满"的观感 */}
              <g clipPath={`url(#clip-${region.id})`} className="region-ink-wrap">
                <rect className="region-ink" x="0" y="0" width="1000" height="640" />
              </g>

              {/* 青铜描边：未灭也画，交界处自然成双线，嵌合感更强 */}
              <polygon className="region-edge" points={region.points} />

              {/* 国名（被吞并后逐渐消散） */}
              <text
                className="region-label"
                x={region.label[0]}
                y={region.label[1]}
                textAnchor="middle"
                dominantBaseline="middle"
              >
                {region.name}
              </text>

              {/* 国都（同样随灭国消散） */}
              {region.capital ? (
                <g className="capital" pointerEvents="none">
                  <circle
                    className="capital-halo"
                    cx={region.capital.x}
                    cy={region.capital.y}
                    r={9}
                  />
                  <circle
                    className="capital-dot"
                    cx={region.capital.x}
                    cy={region.capital.y}
                    r={3.4}
                  />
                  <text className="capital-label" x={region.capital.x} y={region.capital.y + 21}>
                    {region.capital.name}
                  </text>
                </g>
              ) : null}
            </g>
          )
        })}
      </svg>

      {/* 悬浮卡片：靠近右缘时向左翻转，避免溢出 */}
      {hoveredEvent && hoveredRegion ? (
        <div
          className={[
            'map-tip',
            hoveredEvent.order <= index ? 'is-captured' : '',
            hoveredRegion.label[0] > 660 ? 'is-flip-x' : '',
            hoveredRegion.label[1] < 220 ? 'is-below' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          style={{
            left: `${(hoveredRegion.label[0] / 1000) * 100}%`,
            top: `${(hoveredRegion.label[1] / 640) * 100}%`,
          }}
        >
          <span className="map-tip-year">{hoveredEvent.year}</span>
          <span className="map-tip-title">{hoveredEvent.desc}</span>
          {hoveredEvent.order <= index ? (
            <ul className="map-tip-list">
              {hoveredEvent.highlights.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : (
            <span className="map-tip-brief">尚未入秦图 · 点击推演至此</span>
          )}
          <span className="map-tip-action">
            {hoveredEvent.order <= index ? '点击查看详情 →' : ''}
          </span>
        </div>
      ) : null}

      {overlay}

      <p className="map-footnote">示意版图 · 相对方位依史 · 悬停看要点，点击看详情</p>
    </div>
  )
}
