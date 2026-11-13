/**
 * StrategicLayer —— 地缘战略点图层（克制版）
 * ===========================================================================
 * 这一版是"降噪"的结果，三条原则：
 *   1. 默认几乎看不见 —— 只是地图上的暗红微点，不抢国名的戏
 *   2. 国家悬停/聚焦时才点亮该国所属的点（渐进式呈现）
 *   3. 说明卡做成"战术标记"的规格：小字号、暗金边、无多余装饰
 *
 * 为什么用 HTML 绝对定位而不是塞进 SVG：
 *   战报聚焦时地图会整层压暗灰化，战略点必须保持高亮 —— 放在 SVG 里会被一起过滤掉。
 *   坐标系仍用 viewBox（1000×640），父级先算出"实际绘制区"（去掉 letterbox 黑边），
 *   本层在这个盒子里用百分比定位，点位才与版图严丝合缝。
 */
import type { StrategicPoint } from './mapGeometry'

export interface ContentBox {
  x: number
  y: number
  w: number
  h: number
}

interface StrategicLayerProps {
  points: StrategicPoint[]
  box: ContentBox | null
  /** 图层开关：默认关闭，用户主动打开才显示 */
  visible: boolean
  /** 当前悬停或聚焦的国家；null 表示都没有 */
  activeNation: string | null
  /** 一统时版图消散，这一层同步隐去 */
  hidden: boolean
}

export function StrategicLayer({
  points,
  box,
  visible,
  activeNation,
  hidden,
}: StrategicLayerProps) {
  if (!box || !visible) return null

  return (
    <div
      className="strategic-layer"
      data-hidden={hidden}
      style={{ left: box.x, top: box.y, width: box.w, height: box.h }}
      aria-label="地缘战略点"
    >
      {points.map((point, index) => {
        const active = activeNation !== null && activeNation === point.regionId
        return (
          <button
            key={point.id}
            type="button"
            className="strat-dot"
            data-active={active}
            style={{
              left: `${(point.x / 1000) * 100}%`,
              top: `${(point.y / 640) * 100}%`,
              // 错开呼吸节奏，避免几个点同时涨缩
              ['--i' as string]: index,
            }}
            aria-label={`${point.name}：${point.description}`}
          >
            <span className="strat-ring" aria-hidden="true" />
            <span className="strat-core" aria-hidden="true" />
            <span className="strat-tip" role="tooltip">
              <span className="strat-tip-name">{point.name}</span>
              <span className="strat-tip-desc">{point.description}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
