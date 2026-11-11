/**
 * LordCard —— 诸侯卡片（春秋五霸 / 战国七雄）
 * ===========================================================================
 * 与帝王卡片的区别：
 *   · 主公不是"天子"，所以视觉上不做人像，而是城郭 + 旗（见 lords 画像生成脚本）；
 *   · 卡片更窄（一屏并排 5-7 个），文字以「国名」为主、代表人物为辅；
 *   · 悬浮挤压由 CSS :has() 完成（与阶段一同一套思路），React 不重渲染；
 *   · 悬浮时向**下方**弹出该诸侯的重要事迹（上方是天子区，不能占用）。
 */
import type { CSSProperties } from 'react'
import type { Lord } from '../../core/emperorTypes'
import { EventMindMap } from './EventMindMap'

interface LordCardProps {
  lord: Lord
}

type LordStyle = CSSProperties & {
  '--portrait': string
  '--accent': string
}

export function LordCard({ lord }: LordCardProps) {
  const style: LordStyle = {
    '--portrait': `url("${lord.portrait}")`,
    '--accent': lord.accent,
  }

  return (
    <article className="lord-card" style={style} tabIndex={0}>
      <div className="lord-clip">
        <div className="lord-media" />
        <div className="lord-shade" />
        <div className="lord-content">
          <span className="lord-era">{lord.era}</span>
          <span className="lord-state">{lord.state}</span>
          <span className="lord-title">{lord.title}</span>
          <span className="lord-period">{lord.period}</span>
        </div>
      </div>

      {/* 诸侯空间有限，事迹统一放在下方一组，不再按军事/政治拆两块 */}
      <EventMindMap events={lord.events} side="bottom" label="重要事迹" />
    </article>
  )
}
