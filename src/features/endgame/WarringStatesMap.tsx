/**
 * WarringStatesMap —— 战国版图（无缝嵌合 · 秦色吞并 · 一统消散）
 * ===========================================================================
 * 视觉分层（自下而上）：
 *   1. .map-photo             上传的战国地图（压暗）—— 时代质感
 *   2. .map-photo--emperor    秦始皇像（模糊），一统时淡入
 *   3. .empire-layer          {mapSpec.attacker.name} + 已灭诸国的**并集轮廓**：靠 drop-shadow 得到
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
import { ZHANGUO_MAP, type MapRegion, type MapSpec } from './mapGeometry'
import { CampaignRoutes } from './CampaignRoutes'
import { useEndgameStore } from './useEndgameStore'

interface WarringStatesMapProps {
  /** 沙盘地图：战国（默认）或楚汉 / 三国 */
  mapSpec?: MapSpec
  /** 当前推演年份（负数＝公元前）；缺省则不做"陆续登场"过滤 */
  currentYear?: number
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
  /** 581「隋代周」战报页：在隋的疆域上聚焦标出易代，关闭战报即消失 */
  usurp?: boolean
  onConquer: (event: EndgameEvent) => void
  onExitFocus: () => void
  /** 点攻方（周=秦 / 楚汉=汉）= 回到战前 */
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
function mergedCentroid(regions: MapRegion[], attacker: MapRegion) {
  let total = 0
  let x = 0
  let y = 0
  for (const region of regions) {
    const c = areaCentroid(region.points)
    total += c.area
    x += c.x * c.area
    y += c.y * c.area
  }
  if (total === 0) return { x: attacker.label[0], y: attacker.label[1] }
  return { x: x / total, y: y / total }
}

export function WarringStatesMap({
  mapSpec = ZHANGUO_MAP,
  currentYear,
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
  usurp = false,
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

  /** 当前地图的全部区域：进攻方 + 待吞并势力 */
  const allRegions: MapRegion[] = useMemo(
    () => [mapSpec.attacker, ...mapSpec.regions],
    [mapSpec],
  )

  const isCaptured = (id: string) => {
    if (id === mapSpec.attacker.id) return true
    const event = eventsByNation.get(id)
    return event ? event.order <= index : false
  }

  /*
    「陆续登场」：只对**尚未归入攻方**的势力做存活过滤。
    · 尚未出生（currentYear < aliveFrom）→ 不渲染，等年份推进时淡入；
    · 已亡而未被吞并（currentYear > aliveTo）→ 不渲染；
    · 已归入版图的势力始终渲染——否则会凭空消失，疆域看起来像被挖了一块。
    楚汉图每块虽带存续区间，但都在被吞并之前出场，过滤不改变现有表现；
    战国图没有该字段，完全不过滤。
  */
  const visibleRegions = useMemo(() => {
    if (currentYear === undefined) return allRegions
    return allRegions.filter((region) => {
      if (region.id === mapSpec.attacker.id) return true
      if (isCaptured(region.id)) return true
      if (region.aliveFrom !== undefined && currentYear < region.aliveFrom) return false
      if (region.aliveTo !== undefined && currentYear > region.aliveTo) return false
      return true
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allRegions, currentYear, index, events, mapSpec])

  /** 只渲染"所属势力已出现在图上"的要地，避免关隘悬在空白处 */
  const visiblePoints = useMemo(
    () => (mapSpec.points ?? []).filter((point) => visibleRegions.some((region) => region.id === point.regionId)),
    [mapSpec, visibleRegions],
  )

  /**
   * 战报打开期间就是「聚焦态」：镜头推近、无关地名压暗、路线提亮。
   * 理由：整幅中国图上，一场战役的行军线只有几十像素，混在国名/国都/关隘里根本看不清；
   * 推近来以后地名也跟着变大，所以还要把它们压暗，否则又挤成一片。
   */
  const campaignPlaying = campaigns.length > 0

  /**
   * 战报镜头：本幕所有路线只占几十个像素（整幅中国 vs 一场战役），
   * 打开战报就把镜头推近到路线的包围盒，让行军线、起止地名与说明回到可读尺寸；
   * 关掉战报回到全景。用 CSS transform 过渡，交给合成器，不逐帧算 viewBox。
   */
  const zoomInfo = useMemo(() => {
    if (campaigns.length === 0) return { transform: 'none', scale: 1 }
    let x0 = Infinity
    let y0 = Infinity
    let x1 = -Infinity
    let y1 = -Infinity
    for (const campaign of campaigns) {
      for (const point of campaign.points) {
        const x = point.x * 10
        const y = point.y * 6.4
        x0 = Math.min(x0, x)
        x1 = Math.max(x1, x)
        y0 = Math.min(y0, y)
        y1 = Math.max(y1, y)
      }
    }
    if (!Number.isFinite(x0)) return { transform: 'none', scale: 1 }
    const pad = 56
    const w = Math.max(x1 - x0, 62) + pad * 2
    const h = Math.max(y1 - y0, 52) + pad * 2
    const scale = Math.min(1000 / w, 640 / h, 3.6)
    if (scale <= 1.02) return { transform: 'none', scale: 1 }
    const cx = (x0 + x1) / 2
    const cy = (y0 + y1) / 2
    return {
      transform: `translate(${(500 - scale * cx).toFixed(1)}px, ${(320 - scale * cy).toFixed(1)}px) scale(${scale.toFixed(2)})`,
      scale,
    }
  }, [campaigns])

  /** 行军说明文字的避让目标：国都（文字在圆点下方 21px）与要地 */
  const obstacles = useMemo(() => {
    const out: { x: number; y: number }[] = []
    for (const region of visibleRegions) {
      if (region.capital) out.push({ x: region.capital.x, y: region.capital.y + 21 })
    }
    for (const point of visiblePoints) out.push({ x: point.x, y: point.y })
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleRegions, visiblePoints])

  /** 进攻方字样的落点：随版图扩张移到合并后的重心 */
  const labelShift = useMemo(() => {
    const captured = visibleRegions.filter((region) => isCaptured(region.id))
    const center = mergedCentroid(captured, mapSpec.attacker)
    return {
      dx: center.x - mapSpec.attacker.label[0],
      dy: center.y - mapSpec.attacker.label[1],
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, events, visibleRegions, mapSpec])

  /*
    攻方国号：默认用地图自带的 attacker.name；
    若声明了 successor 且当前年份已过易代之年，则换国号（三国：265 魏→晋）。
    版图本身不变，只换称谓。
  */
  const attackerName =
    mapSpec.successor && currentYear !== undefined && currentYear >= mapSpec.successor.year
      ? mapSpec.successor.name
      : mapSpec.attacker.name

  /*
    尚未登场的势力：画成虚线幽灵轮廓。
    只是"占位"，不可点、不带国名国都——否则 220 年开局的三国图会缺一大块，
    看起来像地图坏了；也不能让它可点，那会点出一个"穿越"的战报。
  */
  const unbornRegions = useMemo(() => {
    if (currentYear === undefined) return [] as MapRegion[]
    return allRegions.filter((region) => {
      if (region.id === mapSpec.attacker.id) return false
      if (isCaptured(region.id)) return false
      if (region.aliveFrom !== undefined && currentYear < region.aliveFrom) return true
      if (region.aliveTo !== undefined && currentYear > region.aliveTo) return true
      return false
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allRegions, currentYear, index, events, mapSpec])

  /*
    一统之后地图层已经退场，此时底部节点的悬浮不该再牵动它：
    否则节点 hover 仍会写出 hoveredNation，而悬浮卡片是 HTML 元素，
    不会跟着 SVG 一起淡出，就会出现"看不见的地图上还在弹提示"。
  */
  // 战报态也要响应 hover：轮廓给一圈中性灰线，提示"这里能点"
  const hoverActive = !unified && Boolean(hoveredId)

  const hoveredEvent = hoverActive && !focusedNation ? (eventsByNation.get(hoveredId!) ?? null) : null
  const hoveredRegion = hoverActive
    ? (visibleRegions.find((region) => region.id === hoveredId) ?? null)
    : null

  return (
    <div
      className="map-stage"
      data-dimmed={dimmed}
      data-unified={unified}
      // 581「隋代周」：让并集轮廓发光，标出隋的整片疆域
      data-usurp={usurp || undefined}

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
        /* 行军播放中：压暗无关的地名/关隘，只让路线、说明与终点亮着（见 endgame.css） */
        data-campaign-play={campaignPlaying ? '' : undefined}
        style={{ '--map-zoom': zoomInfo.scale } as React.CSSProperties}
        viewBox={mapSpec.viewBox ?? '0 0 1000 640'}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={mapSpec.ariaLabel ?? `${attackerName}与诸侯版图`}
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

          {visibleRegions.map((region) => (
            <clipPath key={region.id} id={`clip-${region.id}`}>
              <polygon points={region.points} />
            </clipPath>
          ))}
        </defs>

        <rect className="map-bg" x="0" y="0" width="1000" height="640" onClick={onExitFocus} />

        {/* 战报镜头层：河流、版图、国名、要地、行军线一起缩放 */}
        {/* 镜头层：只动 transform，不挂 will-change（见 endgame.css 的说明） */}
        <g
          className="map-zoom"
          style={{ transform: zoomInfo.transform, transformOrigin: '0 0' }}
        >
        {mapSpec.rivers.map((d, i) => (
          <path key={i} className="map-river" d={d} />
        ))}

        {/*
          并集轮廓层：所有已归秦的块画在这里。
          它自身的 fill 会被上面的各国图层遮住，唯一作用是让 group 的
          drop-shadow 生成"整块疆域"的外缘光晕 —— 内部接缝不会发光。
        */}
        <g className="empire-layer" aria-hidden="true">
          {visibleRegions.map((region) => (
            <polygon
              key={region.id}
              points={region.points}
              className={isCaptured(region.id) ? 'is-on' : ''}
            />
          ))}
        </g>

        {/* 未登场势力的幽灵轮廓：先把"将来的疆域"占住，避免开局缺一块 */}
        {unbornRegions.length > 0 ? (
          <g className="unborn-layer" aria-hidden="true">
            {unbornRegions.map((region) => (
              <polygon key={region.id} points={region.points} className="region-unborn" />
            ))}
          </g>
        ) : null}

        {/* 聚焦战报时整体压暗的就是这一层 */}
        <g className="regions-layer">
        {visibleRegions.map((region) => {
          const event = eventsByNation.get(region.id) ?? null
          const isQin = region.id === mapSpec.attacker.id
          const captured = isCaptured(region.id)
          const isNewest = Boolean(event && event.order === index)
          const neutral = region.neutral === true

          return (
            <g
              key={region.id}
              className={`region${captured ? ' is-captured' : ''}${isNewest ? ' is-newest' : ''}${
                hoverActive && hoveredId === region.id ? ' is-hovered' : ''
              }${isQin ? ' is-qin' : ''}${neutral ? ' is-neutral' : ''}${focusedNation === region.id ? ' is-focused' : ''}${
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
              onMouseEnter={() => {
                // 终章态（版图已消散、只剩统一大字）不该再产生 hover
                if (unified) return
                if (region.neutral) return
                setHovered(region.id)
              }}
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
                  style={
                    region.labelSize
                      ? { fontSize: `calc(${region.labelSize}px / var(--map-zoom, 1))` }
                      : undefined
                  }
                >
                  {region.name}
                </text>
              )}

              {region.capital ? (
                <g className="capital" pointerEvents="none">
                  <circle className="capital-halo" cx={region.capital.x} cy={region.capital.y} r={9} />
                  <circle className="capital-dot" cx={region.capital.x} cy={region.capital.y} r={3.4} />
                  <text
                    className="capital-label"
                    x={region.capital.x}
                    y={region.capital.y + 21 / zoomInfo.scale}
                  >
                    {region.capital.name}
                  </text>
                </g>
              ) : null}
            </g>
          )
        })}
        {/*
          攻方字样单独一层，画在所有国家之后 ——
          之前它在自己的 <g> 里（秦是第一个渲染的），移动后会被邻国的图块盖住。
        */}
        </g>

        {/* 要地 / 关隘：只标方位，不参与推演；聚焦战报时一起压暗 */}
        {visiblePoints.length > 0 ? (
          <g className="strategic-layer" aria-hidden="true">
            {visiblePoints.map((point) => (
              <g key={point.id} className={`strategic-point kind-${point.kind}`}>
                <title>{point.description}</title>
                <circle cx={point.x} cy={point.y} r={3.2} />
                <text
                  x={point.x + (point.dx ?? 7) / zoomInfo.scale}
                  y={point.y + (point.dy ?? 4) / zoomInfo.scale}
                  textAnchor={point.anchor ?? 'start'}
                >
                  {point.name}
                </text>
              </g>
            ))}
          </g>
        ) : null}

        {/* 第 0 幕：尚未分封，整块疆域只有一个名字 */}
        {index === 0 && mapSpec.empireName ? (
          <text className="map-empire-name" x="500" y="322" textAnchor="middle" dominantBaseline="middle">
            {mapSpec.empireName ?? mapSpec.attacker.name}
          </text>
        ) : null}

        <g className="qin-label-layer" aria-hidden="true">
          <text
            className="region-label region-label--qin"
            x={mapSpec.attacker.label[0]}
            y={mapSpec.attacker.label[1]}
            textAnchor="middle"
            dominantBaseline="middle"
            style={{
              transform: `translate(${labelShift.dx}px, ${labelShift.dy}px)`,
              ...(mapSpec.attacker.labelSize
                ? { fontSize: `calc(${mapSpec.attacker.labelSize}px / var(--map-zoom, 1))` }
                : {}),
            }}
          >
            {attackerName}
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
          /* 说明文字的避让目标：各国国都与要地（换算成 viewBox 坐标） */
          obstacles={obstacles}
          zoomScale={zoomInfo.scale}
        />
        </g>
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
            <span className="map-tip-brief">尚未归{attackerName} · 点击推演至此</span>
          )}
          <span className="map-tip-action">
            {hoveredEvent.order <= index ? '点击查看详情 →' : ''}
          </span>
        </div>
      ) : null}

      {/* 悬浮攻方时的提示：它不是战报入口，而是"回到战前"的开关 */}
      {hoveredId === mapSpec.attacker.id ? (
        <div
          className="map-tip is-qin-tip"
          style={{
            left: `${(mapSpec.attacker.label[0] / 1000) * 100}%`,
            top: `${(mapSpec.attacker.label[1] / 640) * 100}%`,
          }}
        >
          <span className="map-tip-title">{attackerName}</span>
          <span className="map-tip-brief">
            点击回到战前 · {mapSpec.resetHint ?? '六国复其疆'}
          </span>
        </div>
      ) : null}


      {/*
        581 的易代提示落在隋疆域的重心（战报打开时才出现，关掉就消失）。
        之前是个顶部居中的浮标，现在贴到版图里，读战报时一眼对上位置。
      */}
      {usurp ? (
        <div
          className="map-usurp-note"
          style={{
            left: `${((mapSpec.attacker.label[0] + labelShift.dx) / 1000) * 100}%`,
            top: `${((mapSpec.attacker.label[1] + labelShift.dy) / 640) * 100}%`,
          }}
        >
          <span>581</span>
          杨坚称帝 · 改国号隋
        </div>
      ) : null}

      {overlay}

      <p className="map-footnote">示意版图 · 悬停看要点 · 点击国家看战报 · 点「{attackerName}」回到战前</p>
    </div>
  )
}


