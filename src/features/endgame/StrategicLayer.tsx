/**
 * StrategicLayer —— 地缘战略点图层
 * ===========================================================================
 * 版图讲"谁的地"，这一层讲"哪块地形值钱"：关隘、决战场、都城、粮仓。
 *
 * 为什么用 HTML 绝对定位而不是塞进 SVG：
 *   1. 战报聚焦时地图会整层压暗灰化，战略点必须保持高亮 —— 放在 SVG 里会被一起过滤掉
 *   2. HTML 的 hover / tooltip / 呼吸动画比 SVG 内部更好控
 *
 * 坐标换算：
 *   SVG 用 preserveAspectRatio="xMidYMid meet"，容器比 1000:640 宽时左右会留黑边。
 *   所以不能直接把 x/1000 当百分比 —— 父级先算出**内容盒**（去掉黑边后的实际绘制区），
 *   本层再在这个盒子里用百分比定位，点位才与版图严丝合缝。
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
  /** 一统时版图消散，这一层同步隐去 */
  hidden: boolean
}

export function StrategicLayer({ points, box, hidden }: StrategicLayerProps) {
  // 一统时不卸载，让 CSS 把它淡出，避免"啪"地消失
  if (!box) return null

  return (
    <div
      className="strategic-layer"
      data-hidden={hidden}
      style={{ left: box.x, top: box.y, width: box.w, height: box.h }}
      aria-label="地缘战略点"
    >
      {points.map((point, index) => (
        <button
          key={point.id}
          type="button"
          className={`strat-dot strat-${point.kind}`}
          style={{
            left: `${(point.x / 1000) * 100}%`,
            top: `${(point.y / 640) * 100}%`,
            // 错开呼吸节奏，避免五个点同时涨缩像故障
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
      ))}
    </div>
  )
}
