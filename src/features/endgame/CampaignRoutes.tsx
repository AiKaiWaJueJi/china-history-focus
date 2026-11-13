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
  /** 当前播放到第几段；-1 表示还没开始 */
  index: number
  done: boolean
  /** 战报里 hover 的段序号 */
  hovered: number | null
}

/** 百分比 → viewBox（1000×640） */
const toView = (p: MapPoint) => ({ x: p.x * 10, y: p.y * 6.4 })

/** 折线路径：M 起点 → L 逐点 */
function polyline(points: MapPoint[]) {
  const vs = points.map(toView)
  return vs.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
}

/** 末段方向（箭头朝向）与该段中点（文字位置） */
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

export function CampaignRoutes({ campaigns, index, done, hovered }: CampaignRoutesProps) {
  if (campaigns.length === 0) return null

  return (
    <g className="campaign-layer" data-settled={done}>
      {campaigns.map((campaign, i) => {
        const isCurrent = !done && i === index
        const isPlayed = done || i < index
        const isHovered = hovered === i
        const state = isCurrent ? 'is-current' : isPlayed ? 'is-played' : 'is-future'
        const t = tail(campaign.points)

        return (
          <g
            key={`p-${campaign.phase}`}
            className={`campaign-route ${state} side-${campaign.side}${isHovered ? ' is-hovered' : ''}`}
          >
            <path className="campaign-line" d={polyline(campaign.points)} pathLength={1} />

            {/* 箭头延迟浮现，避免一开始就钉在终点 */}
            <polygon
              className="campaign-arrow"
              points="-13,-7 0,0 -13,7"
              transform={`translate(${t.end.x} ${t.end.y}) rotate(${t.angle})`}
            />

            <circle className="campaign-start" cx={toView(campaign.points[0]).x} cy={toView(campaign.points[0]).y} r={4.5} />

            <g className="campaign-end" transform={`translate(${t.end.x} ${t.end.y})`}>
              <circle className="campaign-flare" r={6} />
              <circle className="campaign-flare-ring" r={9} />
            </g>

            <g className="campaign-caption" transform={`translate(${t.mid.x} ${t.mid.y})`}>
              <text className="campaign-general" textAnchor="middle" y={-6}>
                {campaign.general}
              </text>
              <text className="campaign-result" textAnchor="middle" y={12}>
                {campaign.result}
              </text>
            </g>

            {/* 重点关隘与目的地：只在该段行军时显示，播完即消失 */}
            <g className="campaign-places">
              {(campaign.via ?? []).map((name, k) => {
                const p = toView(campaign.points[k + 1] ?? campaign.points[0])
                return (
                  <text key={name} className="campaign-place" x={p.x} y={p.y - 12} textAnchor="middle">
                    {name}
                  </text>
                )
              })}
              <text
                className="campaign-place campaign-place--dest"
                x={t.end.x}
                y={t.end.y + 24}
                textAnchor="middle"
              >
                {campaign.to}
              </text>
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
              <g className="campaign-caption" transform={`translate(${t.mid.x} ${t.mid.y})`}>
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
