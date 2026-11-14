/**
 * WarringStatesMap —— 战国版图（无缝嵌合 · 秦色吞并 · 一统消散）
 * ===========================================================================
 * 视觉分层（自下而上）：
 *   1. .map-photo             上传的战国地图（压暗）—— 时代质感
 *   2. .map-photo--emperor    秦始皇像（模糊），一统时淡入
 *   3. .empire-layer          秦 + 已灭诸国的**并集轮廓**：靠 drop-shadow 得到
 *                             一圈只包外缘的光晕（不会画出内部接缝）
 *   4. 各国 polygon           石色底 + 秦色覆盖层
 *   5. 国名 / 国都            灭国后消散
 *
 * 两个关键设计：
 *   · 灭国后国界线要消失 —— 所以每块自己的描边淡出，外缘交给 empire-layer 的
 *     并集光晕统一表达，内部接缝自然消失。
 *   · 秦字要落在"秦 + 已灭诸国"的重心 —— 按面积加权算多边形重心并平滑移动。
 */
import { useMemo } from 'react'
import type { EndgameEvent } from '../../core/emperorTypes'
import type { CampaignPhase } from '../../core/emperorTypes'
import { ALL_REGIONS, QIN_REGION, RIVERS } from './mapGeometry'
import { CampaignRoutes } from './CampaignRoutes'
import { useEndgameStore } from './useEndgameStore'

interface WarringStatesMapProps {
  events: EndgameEvent[]
  /** 当前正在播放/已播放完的战役序列（按国家） */
  campaigns: CampaignPhase[]
  campaignIndex: number
  campaignDone: boolean
  hoveredCampaign: number | null
  /** 向下滚动跳过剩余动画 */
  onSkipCampaign: () => void
  /** 正在被"墨"吞并的国家（与最后一段行军同步晕染） */
  annexingNation: string | null
  index: number
  dimmed: boolean
  unified: boolean
  onConquer: (event: EndgameEvent) => void
  onExitFocus: () => void
  /** 点「秦」= 回到战前（六国复其疆） */
  onReset: () => void
  overlay?: React.ReactNode
}

/** 多边形面积与形心（鞋带公式） */
function areaCentroid(points: string) {
  const pts = points.split(' ').map((pair) => pair.split(',').map(Number))
  let twiceArea = 0
  let cx = 0
  let cy = 0
  for (let i = 0; i < pts.length; i++) {
    const [x0, y0] = pts[i]
    const [x1, y1] = pts[(i + 1) % pts.length]
    const cross = x0 * y1 - x1 * y0
    twiceArea += cross
    cx += (x0 + x1) * cross
    cy += (y0 + y1) * cross
  }
  const area = twiceArea / 2
  if (Math.abs(area) < 1e-6) return { area: 0, x: 0, y: 0 }
  return { area: Math.abs(area), x: cx / (6 * area), y: cy / (6 * area) }
}

/** 秦 + 已灭诸国的面积加权重心 */
function mergedCentroid(regions: typeof ALL_REGIONS) {
  let total = 0
  let x = 0
  let y = 0
  for (const region of regions) {
    const c = areaCentroid(region.points)
    total += c.area
    x += c.x * c.area
    y += c.y * c.area
  }
  if (total === 0) return { x: QIN_REGION.label[0], y: QIN_REGION.label[1] }
  return { x: x / total, y: y / total }
}

export function WarringStatesMap({
  events,
  campaigns,
  campaignIndex,
  campaignDone,
  hoveredCampaign,
  onSkipCampaign,
  annexingNation,
  index,
  dimmed,
  unified,
  onConquer,
  onExitFocus,
  onReset,
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

  const isCaptured = (id: string) => {
    if (id === 'qin') return true
    const event = eventsByNation.get(id)
    return event ? event.order <= index : false
  }

  /** 秦字的落点：随版图扩张移到合并后的重心 */
  const labelShift = useMemo(() => {
    const captured = ALL_REGIONS.filter((region) => isCaptured(region.id))
    const center = mergedCentroid(captured)
    return {
      dx: center.x - QIN_REGION.label[0],
      dy: center.y - QIN_REGION.label[1],
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, events])

  /*
    一统之后地图层已经退场，此时底部节点的悬浮不该再牵动它：
    否则节点 hover 仍会写出 hoveredNation，而悬浮卡片是 HTML 元素，
    不会跟着 SVG 一起淡出，就会出现"看不见的地图上还在弹提示"。
  */
  // 战报态也要响应 hover：轮廓给一圈中性灰线，提示"这里能点"
  const hoverActive = !unified && Boolean(hoveredId)

  const hoveredEvent = hoverActive && !focusedNation ? (eventsByNation.get(hoveredId!) ?? null) : null
  const hoveredRegion = hoverActive
    ? (ALL_REGIONS.find((region) => region.id === hoveredId) ?? null)
    : null

  return (
    <div
      className="map-stage"
      data-dimmed={dimmed}
      data-unified={unified}
      /*
        向下滚动 = 跳过行军动画，直接看战报。
        比双击好操作：双击容易误触，滚轮是"往下翻 = 继续推进"的自然隐喻。
      */
      onWheel={(e) => {
        if (e.deltaY > 0) onSkipCampaign()
      }}
    >
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
          {/* 六国石色：中性、偏暖，与秦色拉开距离 */}
          <linearGradient id="stone" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#332b22" />
            <stop offset="45%" stopColor="#221c16" />
            <stop offset="100%" stopColor="#12100c" />
          </linearGradient>

          {/* 秦色：更暗、带铜褐，视觉上"沉"于六国之下 */}
          <linearGradient id="qinFill" x1="0" y1="0" x2="0.2" y2="1">
            <stop offset="0%" stopColor="#241505" />
            <stop offset="45%" stopColor="#160c04" />
            <stop offset="100%" stopColor="#070302" />
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

        {/*
          并集轮廓层：所有已归秦的块画在这里。
          它自身的 fill 会被上面的各国图层遮住，唯一作用是让 group 的
          drop-shadow 生成"整块疆域"的外缘光晕 —— 内部接缝不会发光。
        */}
        <g className="empire-layer" aria-hidden="true">
          {ALL_REGIONS.map((region) => (
            <polygon
              key={region.id}
              points={region.points}
              className={isCaptured(region.id) ? 'is-on' : ''}
            />
          ))}
        </g>

        {/* 聚焦战报时整体压暗的就是这一层 */}
        <g className="regions-layer">
        {ALL_REGIONS.map((region) => {
          const event = eventsByNation.get(region.id) ?? null
          const isQin = region.id === 'qin'
          const captured = isCaptured(region.id)
          const isNewest = Boolean(event && event.order === index)

          return (
            <g
              key={region.id}
              className={`region${captured ? ' is-captured' : ''}${isNewest ? ' is-newest' : ''}${
                hoverActive && hoveredId === region.id ? ' is-hovered' : ''
              }${isQin ? ' is-qin' : ''}${focusedNation === region.id ? ' is-focused' : ''}${
                annexingNation === region.id ? ' is-annexing' : ''
              }`}
              data-nation={region.id}
              data-captured={captured ? 'true' : 'false'}
              onClick={() => {
                /*
                  点击后立刻收起悬浮卡：指针还压在版图上，那张"秦灭X"的卡
                  会一直挡着刚开播的行军动画，直到鼠标挪开才消失。
                */
                setHovered(null)
                // 秦不是"被灭国"，它是沙盘的本体：点它等于把时间拨回战前
                if (isQin) {
                  onReset()
                  return
                }
                if (!event) return
                onConquer(event)
              }}
              onMouseEnter={() => setHovered(region.id)}
              onMouseLeave={() => setHovered(null)}
            >
              {/*
                透明命中层：沿边再向外描 10px 且填充透明。
                韩、魏这类窄条在版图上只有十几像素宽，鼠标稍偏一点就点不中；
                这一层把"可点范围"放宽一圈，肉眼看不出来，手感和正常国家一致。
              */}
              <polygon className="region-hit" points={region.points} />
              <polygon className="region-base" points={region.points} />

              <g clipPath={`url(#clip-${region.id})`} className="region-ink-wrap">
                {/* 底色：灭国时由透明淡入为秦色 */}
                <rect className="region-ink" x="0" y="0" width="1000" height="640" />
                {/*
                  呼吸层：单独一层半透明暖色，靠 opacity 循环做出"呼吸"，
                  不动 filter，交给合成器；最暗时底层仍是秦色，疆域始终看得清。
                */}
                <rect className="region-breathe" x="0" y="0" width="1000" height="640" />
              </g>

              <polygon className="region-edge" points={region.points} />

              {/* 秦字不在这里画：它独立成层，避免被后渲染的邻国压住 */}
              {isQin ? null : (
                <text
                  className="region-label"
                  x={region.label[0]}
                  y={region.label[1]}
                  textAnchor="middle"
                  dominantBaseline="middle"
                >
                  {region.name}
                </text>
              )}

              {region.capital ? (
                <g className="capital" pointerEvents="none">
                  <circle className="capital-halo" cx={region.capital.x} cy={region.capital.y} r={9} />
                  <circle className="capital-dot" cx={region.capital.x} cy={region.capital.y} r={3.4} />
                  <text className="capital-label" x={region.capital.x} y={region.capital.y + 21}>
                    {region.capital.name}
                  </text>
                </g>
              ) : null}
            </g>
          )
        })}
        {/*
          秦字单独一层，画在所有国家之后 ——
          之前它在自己的 <g> 里（秦是第一个渲染的），移动后会被邻国的图块盖住。
        */}
        </g>
        <g className="qin-label-layer" aria-hidden="true">
          <text
            className="region-label region-label--qin"
            x={QIN_REGION.label[0]}
            y={QIN_REGION.label[1]}
            textAnchor="middle"
            dominantBaseline="middle"
            style={{ transform: `translate(${labelShift.dx}px, ${labelShift.dy}px)` }}
          >
            秦
          </text>
        </g>
        {/* 行军路线：在版图之上、不参与聚焦压暗 */}
        {/*
          战报态：hover 的版块描一圈中性灰轮廓。
          它在 .regions-layer 之外，因此不会被聚焦时那层 0.26 的压暗吃掉；
          用灰黑而不是金色，避免和"秦疆域"的金色呼吸轮廓抢辨识度。
        */}
        {focusedNation && hoveredRegion ? (
          <polygon className="region-hover-ring" points={hoveredRegion.points} />
        ) : null}

        <CampaignRoutes
          campaigns={campaigns}
          index={campaignIndex}
          done={campaignDone}
          hovered={hoveredCampaign}
        />
      </svg>


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
              {(hoveredEvent.highlights ?? []).map((item) => (
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

      {/* 悬浮「秦」时的提示：它不是战报入口，而是"回到战前"的开关 */}
      {hoveredId === 'qin' ? (
        <div
          className="map-tip is-qin-tip"
          style={{
            left: `${(QIN_REGION.label[0] / 1000) * 100}%`,
            top: `${(QIN_REGION.label[1] / 640) * 100}%`,
          }}
        >
          <span className="map-tip-title">秦</span>
          <span className="map-tip-brief">点击回到战前 · 六国复其疆</span>
        </div>
      ) : null}


      {overlay}

      <p className="map-footnote">示意版图 · 悬停看要点 · 点击国家看战报 · 点「秦」回到战前</p>
    </div>
  )
}
