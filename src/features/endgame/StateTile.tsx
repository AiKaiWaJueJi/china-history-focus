/**
 * StateTile —— 单个诸侯国的容器
 * ===========================================================================
 * DOM 分两层，是为了让「亡」字不被灰化吃掉：
 *   .state-tile-face  ← 灰化 / 缩小 / 压暗作用在这一层（名字、年份、光晕）
 *   .state-tile-stamp ← 独立在外层，始终保留血红
 * 如果把 filter 加在最外层，印章也会变成灰的，视觉冲击会削掉一大半。
 */
import type { CSSProperties } from 'react'
import type { EndgameEvent } from '../../core/emperorTypes'

interface StateTileProps {
  event: EndgameEvent
  index: number
  fallen: boolean
  isLatest: boolean
}

export function StateTile({ event, index, fallen, isLatest }: StateTileProps) {
  return (
    <div
      className={`state-tile${fallen ? ' is-fallen' : ''}${isLatest ? ' is-latest' : ''}`}
      style={{ '--i': index } as CSSProperties}
      data-state={event.target}
    >
      <div className="state-tile-face">
        <span className="state-tile-glow" aria-hidden="true" />
        <span className="state-tile-name">{event.target}</span>
        <span className="state-tile-year">{event.year}</span>
      </div>

      <span className="state-tile-stamp" aria-hidden="true">
        亡
      </span>
    </div>
  )
}
