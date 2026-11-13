/**
 * CampaignRoutes —— 行军路线图层
 * ===========================================================================
 * 三段一组的战役序列，画在版图之上（但不进 .regions-layer，因此不会被聚焦压暗）。
 *
 * 绘制要点：
 *   1. 路线用二次贝塞尔（中点向外偏移），比直线更有"行军"的动势，
 *      偏移量按段序号正负交替，避免来回两条线完全重叠。
 *   2. 生长动画走 stroke-dashoffset（1→0），1.5s linear，交给合成器。
 *   3. 箭头不随虚线生长——marker 会从 t=0 就出现在终点，所以自己画一个
 *      三角形，延迟到路线快画完时再淡入。
 *   4. 起点微光、终点战火、将领姓名只在"当前段"出现；战报里 hover 复现的
 *      路线不带文字。
 */
import type { CampaignPhase } from '../../core/emperorTypes'
import { CAMPAIGN_GROW_MS } from './useCampaignPlayer'

interface CampaignRoutesProps {
  campaigns: CampaignPhase[]
  /** 当前播放到第几段；-1 表示还没开始 */
  index: number
  done: boolean
  /** 战报里 hover 的段序号 */
  hovered: number | null
}

/** 百分比 → viewBox */
const toView = (x: number, y: number) => ({ x: x * 10, y: y * 6.4 })

/** 中点向外偏移，让路线呈一道弧 */
function curveOf(a: { x: number; y: number }, b: { x: number; y: number }, bow: number) {
  const mx = (a.x + b.x) / 2
  const my = (a.y + b.y) / 2
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = Math.hypot(dx, dy) || 1
  // 法线方向
  const nx = -dy / len
  const ny = dx / len
  const cx = mx + nx * bow
  const cy = my + ny * bow
  return {
    d: `M ${a.x} ${a.y} Q ${cx} ${cy} ${b.x} ${b.y}`,
    // 终点切线方向（控制点 → 终点）
    angle: (Math.atan2(b.y - cy, b.x - cx) * 180) / Math.PI,
    // 标签位置：弧顶
    label: { x: (a.x + 2 * cx + b.x) / 4, y: (a.y + 2 * cy + b.y) / 4 },
  }
}

export function CampaignRoutes({ campaigns, index, done, hovered }: CampaignRoutesProps) {
  if (campaigns.length === 0) return null

  return (
    <g className="campaign-layer" aria-hidden="true">
      <defs>
        {/* 秦军：赤金；敌国：幽蓝 */}
        <marker id="camp-arrow-qin" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#d98b3a" />
        </marker>
        <marker id="camp-arrow-enemy" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#4a90b8" />
        </marker>
      </defs>

      {campaigns.map((campaign, i) => {
        const from = toView(campaign.startPoint.x, campaign.startPoint.y)
        const to = toView(campaign.endPoint.x, campaign.endPoint.y)
        // 正负交替，来回两条线不重叠
        const bow = (i % 2 === 0 ? 1 : -1) * 46
        const curve = curveOf(from, to, bow)

        const isCurrent = !done && i === index
        const isPlayed = done || i < index
        const isHovered = hovered === i
        const state = isCurrent ? 'is-current' : isPlayed ? 'is-played' : 'is-future'

        return (
          <g
            key={`${campaign.phase}-${i}`}
            className={`campaign-route ${state} side-${campaign.side}${isHovered ? ' is-hovered' : ''}`}
          >
            <path
              className="campaign-line"
              d={curve.d}
              pathLength={1}
              markerEnd={`url(#camp-arrow-${campaign.side})`}
              style={{ transitionDuration: `${CAMPAIGN_GROW_MS}ms` }}
            />

            {/* 箭头：虚线画完后再淡入，避免一开始就钉在终点 */}
            <polygon
              className="campaign-arrow"
              points="-13,-7 0,0 -13,7"
              transform={`translate(${to.x} ${to.y}) rotate(${curve.angle})`}
            />

            {/* 起点微光 / 终点战火 */}
            <circle className="campaign-start" cx={from.x} cy={from.y} r={5} />
            <g className="campaign-end" transform={`translate(${to.x} ${to.y})`}>
              <circle className="campaign-flare" r={7} />
              <circle className="campaign-flare-ring" r={10} />
            </g>

            {/* 将军名 + 结果：只在当前段浮现（战报 hover 时不显示） */}
            <g className="campaign-caption" transform={`translate(${curve.label.x} ${curve.label.y})`}>
              <text className="campaign-general" textAnchor="middle" y={-4}>
                {campaign.general}
              </text>
              <text className="campaign-result" textAnchor="middle" y={12}>
                {campaign.result}
              </text>
            </g>
          </g>
        )
      })}
    </g>
  )
}
