/**
 * WarringStatesMap —— 可交互的战国版图
 * ===========================================================================
 * 三层结构：
 *   1. .map-photo   你上传的地图照片（低饱和 + 压暗 + 轻微模糊）→ 只负责时代质感
 *   2. .map-svg     手绘示意版图（7 个 polygon）→ 负责可交互、可动画
 *   3. 墨色覆盖层   每个国家一个 clip-path 包裹 + 全宽 rect，靠 scaleX(0→1) 实现
 *                   "秦的墨色自西向东漫过该国"的吞噬观感
 *
 * 为什么用 scaleX + clipPath 而不是直接改 fill：
 *   直接改 fill 只是"变色"，读完不知道"是哪一刻被吞的"；
 *   scaleX 的矩形被国家轮廓裁剪后，视觉上是**墨色在疆域内蔓延**，
 *   而且这个变换是可逆的 —— index 回退时它自动倒放。
 */
import { useState, type ReactNode } from 'react'
import type { EndgameEvent } from '../../core/emperorTypes'
import { ALL_REGIONS, RIVERS } from './mapGeometry'

interface WarringStatesMapProps {
  events: EndgameEvent[]
  index: number
  /** 聚焦战报时地图变暗 */
  dimmed: boolean
  onConquer: (event: EndgameEvent) => void
  onExitFocus: () => void
  /** 终局态叠加层（秦印 + 进入秦朝的入口卡片），放在地图容器内居中 */
  overlay?: ReactNode
}

export function WarringStatesMap({
  events,
  index,
  dimmed,
  onConquer,
  onExitFocus,
  overlay,
}: WarringStatesMapProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  const hoveredEvent = events.find((event) => event.nationId === hoveredId) ?? null
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
          const event = events.find((item) => item.nationId === region.id) ?? null
          const isQin = region.id === 'qin'
          const captured = isQin || (event ? event.order <= index : false)
          const isNewest = Boolean(event && event.order === index)
          const isHovered = hoveredId === region.id

          return (
            <g
              key={region.id}
              className={`region${captured ? ' is-captured' : ''}${isNewest ? ' is-newest' : ''}${
                isHovered ? ' is-hovered' : ''
              }${isQin ? ' is-qin' : ''}`}
              data-nation={region.id}
              data-captured={captured ? 'true' : 'false'}
              onClick={() => {
                if (!event) return
                onConquer(event)
              }}
              onMouseEnter={() => setHoveredId(region.id)}
              onMouseLeave={() => setHoveredId((current) => (current === region.id ? null : current))}
            >
              <polygon
                className="region-base"
                points={region.points}
                style={{ fill: region.color }}
              />

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
            </g>
          )
        })}
      </svg>

      {/* 悬浮提示：已灭亡的国家显示战报梗概 */}
      {hoveredEvent && hoveredRegion ? (
        <div
          className={`map-tip${hoveredCaptured ? ' is-captured' : ''}`}
          style={{
            left: `${(hoveredRegion.label[0] / 1000) * 100}%`,
            top: `${(hoveredRegion.label[1] / 640) * 100}%`,
          }}
        >
          <span className="map-tip-year">{hoveredEvent.year}</span>
          <span className="map-tip-title">{hoveredEvent.desc}</span>
          <span className="map-tip-brief">
            {hoveredCaptured ? hoveredEvent.brief : '尚未入秦图 · 点击推演至此'}
          </span>
        </div>
      ) : null}

      {overlay}

      <p className="map-footnote">示意版图 · 相对方位依史 · 点击国家可正推或回溯</p>
    </div>
  )
}
