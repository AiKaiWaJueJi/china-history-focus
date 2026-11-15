/**
 * CampaignRoutes —— 行军路线图层（折线版）
 * ===========================================================================
 * 三条规则决定了这一版的形状：
 *
 *   1. **折线**：秦军从咸阳出发，经关隘折向目标（M→L→L），不是两点直线。
 *      转角用 linejoin: round 处理，像行军的转向而不是橡皮筋。
 *
 *   2. **三种势力三种色**：秦军暗金、守军赤铜、援军青玉。
 *      都用低饱和的矿物色，贴着整体的青铜底子，而不是 UI 里的蓝橙箭头。
 *
 *   3. **战报打开后默认全隐**：路线只在"播放"与"被 hover"两种情形下可见。
 *      战报里 hover 某段 → 该段重播一次生长动画 + 终点闪一下。
 */
import type { CampaignPhase, MapPoint } from '../../core/emperorTypes'

interface CampaignRoutesProps {
  campaigns: CampaignPhase[]
  /** 需要避让的地名坐标（viewBox 坐标系中的国都 / 关隘圆点） */
  obstacles?: { x: number; y: number }[]
  /** 战报镜头倍数：文字字号与偏移要按它反算，屏幕上才恒定大小 */
  zoomScale?: number
  /** 地图 viewBox 高度；百分比 y 按它换算（默认 640） */
  height?: number
  /** 当前播放到第几段；-1 表示还没开始 */
  index: number
  done: boolean
  /** 战报里 hover 的段序号 */
  hovered: number | null
}

/** 百分比 → viewBox（1000×640） */
let VIEW_HEIGHT = 640
const toView = (p: MapPoint) => ({ x: p.x * 10, y: (p.y * VIEW_HEIGHT) / 100 })

/** 折线路径：M 起点 → L 逐点 */
function polyline(points: MapPoint[]) {
  const vs = points.map(toView)
  return vs.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
}

/**
 * 文字位置：取**最长那段**的中点，并沿法线外推 24px。
 * 之前用末段中点，短路线（如齐的"济西→临淄"）会让将领名、战果
 * 和终点地名挤成一团。
 */
function captionAt(points: MapPoint[], obstacles: { x: number; y: number }[] = []) {
  const vs = points.map(toView)

  // 取最长那段：路线越长，文字越不容易和端点挤在一起
  let pick = 1
  let longest = -1
  for (let i = 1; i < vs.length; i++) {
    const len = Math.hypot(vs[i].x - vs[i - 1].x, vs[i].y - vs[i - 1].y)
    if (len > longest) {
      longest = len
      pick = i
    }
  }

  const a = vs[pick - 1] ?? vs[0]
  const b = vs[pick]
  const mx = (a.x + b.x) / 2
  const my = (a.y + b.y) / 2
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = Math.hypot(dx, dy) || 1

  // 法线的两个方向都试一遍，取"离所有地名最远"的那个
  const nx = -dy / len
  const ny = dx / len
  const cand = [
    { x: mx + nx * 30, y: my + ny * 30 },
    { x: mx - nx * 30, y: my - ny * 30 },
  ]

  // 地名包括起点、中途关隘、目的地（vs 已是 viewBox 坐标），再加上国都与要地
  const places = [...vs, ...obstacles]
  const clearOf = (p: { x: number; y: number }) =>
    Math.min(...places.map((q) => Math.hypot(p.x - q.x, p.y - q.y)))

  return clearOf(cand[0]) >= clearOf(cand[1]) ? cand[0] : cand[1]
}

/** 末段方向（箭头朝向）与该段中点 */
function tail(points: MapPoint[]) {
  const vs = points.map(toView)
  const end = vs[vs.length - 1]
  const prev = vs[vs.length - 2] ?? end
  const angle = (Math.atan2(end.y - prev.y, end.x - prev.x) * 180) / Math.PI
  return {
    end,
    angle,
    mid: { x: (prev.x + end.x) / 2, y: (prev.y + end.y) / 2 },
  }
}

export function CampaignRoutes({
  campaigns,
  height = 640,
  index,
  done,
  hovered,
  obstacles = [],
  zoomScale = 1,
}: CampaignRoutesProps) {
  VIEW_HEIGHT = height
  if (campaigns.length === 0) return null

  /*
    地名去重：相邻两程常常共用端点（「魏州→杨刘」「杨刘→中都」），
    逐程都写一遍会在同一点叠出两三个同样的地名。
    聚焦镜头推近后尤其明显，所以整层只画第一次出现的地名。
  */
  const seenPlaces = new Set<string>()

  return (
    <g className="campaign-layer" data-settled={done}>
      {campaigns.map((campaign, i) => {
        const isCurrent = !done && i === index
        const isPlayed = done || i < index
        const isHovered = hovered === i
        const state = isCurrent ? 'is-current' : isPlayed ? 'is-played' : 'is-future'
        const t = tail(campaign.points)
        const cap = captionAt(campaign.points, obstacles)

        return (
          <g
            key={`p-${campaign.phase}`}
            className={`campaign-route ${state} side-${campaign.side}${isHovered ? ' is-hovered' : ''}`}
          >
            <path className="campaign-line" d={polyline(campaign.points)} pathLength={1} />

            {/* 箭头延迟浮现，避免一开始就钉在终点 */}
            <polygon
              className="campaign-arrow"
              points={`${-13 / zoomScale},${-7 / zoomScale} 0,0 ${-13 / zoomScale},${7 / zoomScale}`}
              transform={`translate(${t.end.x} ${t.end.y}) rotate(${t.angle})`}
            />

            <circle
              className="campaign-start"
              cx={toView(campaign.points[0]).x}
              cy={toView(campaign.points[0]).y}
              r={4.5 / zoomScale}
            />

            <g className="campaign-end" transform={`translate(${t.end.x} ${t.end.y})`}>
              <circle className="campaign-flare" r={6 / zoomScale} />
              <circle className="campaign-flare-ring" r={9 / zoomScale} />
            </g>

            <g className="campaign-caption" transform={`translate(${cap.x} ${cap.y})`}>
              <text className="campaign-general" textAnchor="middle" y={-6 / zoomScale}>
                {campaign.general}
              </text>
              <text className="campaign-result" textAnchor="middle" y={12 / zoomScale}>
                {campaign.result}
              </text>
            </g>

            {/* 起点、重点关隘与目的地：行军时显示；战报里 hover 复现时也显示（同名只画一次） */}
            <g className="campaign-places">
              {[
                {
                  key: 'origin',
                  name: campaign.from,
                  x: toView(campaign.points[0]).x,
                  y: toView(campaign.points[0]).y + 20 / zoomScale,
                  cls: 'campaign-place campaign-place--origin',
                },
                ...(campaign.via ?? []).map((name, k) => {
                  const p = toView(campaign.points[k + 1] ?? campaign.points[0])
                  return { key: `via-${k}-${name}`, name, x: p.x, y: p.y - 12 / zoomScale, cls: 'campaign-place' }
                }),
                {
                  key: 'dest',
                  name: campaign.to,
                  x: t.end.x,
                  y: t.end.y + 24 / zoomScale,
                  cls: 'campaign-place campaign-place--dest',
                },
              ]
                .filter((place) => {
                  if (!place.name) return false
                  if (seenPlaces.has(place.name)) return false
                  seenPlaces.add(place.name)
                  return true
                })
                .map((place) => (
                  <text key={place.key} className={place.cls} x={place.x} y={place.y} textAnchor="middle">
                    {place.name}
                  </text>
                ))}
            </g>
          </g>
        )
      })}

      {/* 援军：与所属阶段同步出现 */}
      {campaigns.flatMap((campaign, i) =>
        (campaign.allies ?? []).map((ally) => {
          const isCurrent = !done && i === index
          const isPlayed = done || i < index
          const isHovered = hovered === i
          const state = isCurrent ? 'is-current' : isPlayed ? 'is-played' : 'is-future'
          const t = tail(ally.points)
          const cap = captionAt(ally.points, obstacles)

          return (
            <g
              key={`a-${campaign.phase}-${ally.nation}`}
              className={`campaign-route campaign-ally ${state}${isHovered ? ' is-hovered' : ''}`}
            >
              <path className="campaign-line" d={polyline(ally.points)} pathLength={1} />
              <polygon
                className="campaign-arrow"
                points="-11,-6 0,0 -11,6"
                transform={`translate(${t.end.x} ${t.end.y}) rotate(${t.angle})`}
              />
              <circle className="campaign-start" cx={toView(ally.points[0]).x} cy={toView(ally.points[0]).y} r={4} />
              <g className="campaign-end" transform={`translate(${t.end.x} ${t.end.y})`}>
                <circle className="campaign-flare" r={5} />
                <circle className="campaign-flare-ring" r={8} />
              </g>
              <g className="campaign-caption" transform={`translate(${cap.x} ${cap.y})`}>
                <text className="campaign-general" textAnchor="middle" y={-5}>
                  {ally.nation}·{ally.general}
                </text>
                <text className="campaign-result" textAnchor="middle" y={11}>
                  援军 {ally.troops}
                </text>
              </g>
            </g>
          )
        }),
      )}
    </g>
  )
}
