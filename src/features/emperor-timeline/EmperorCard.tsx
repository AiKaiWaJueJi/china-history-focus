/**
 * EmperorCard —— 单个帝王模块
 * ===========================================================================
 * 结构分三层，故意的：
 *   .emp-clip   负责圆角 + 裁剪（背景放大时不会溢出模块）
 *   .emp-media  背景图，hover 时 scale(1.05)，只动 transform（合成器友好）
 *   .emp-events 事件浮层，**在 .emp-clip 外面**，所以能伸出模块上下边界
 *
 * 【关于文字模糊】
 * 早先悬浮时给整个 .emp-card 加了 transform: scale(1.012)，
 * 非整数缩放会让卡片内的文字被重新采样 —— 姓名与在位时间就"糊"了。
 * 现在卡片本身不再缩放（只让背景图放大），文字始终按 1:1 像素渲染。
 */
import type { CSSProperties } from 'react'
import type { EmperorRecord } from '../../core/emperorTypes'
import { EventMindMap } from './EventMindMap'

interface EmperorCardProps {
  emperor: EmperorRecord
  /** 在本页中的序号，用于错峰入场 */
  index: number
}

type CardStyle = CSSProperties & {
  '--portrait': string
}

export function EmperorCard({ emperor, index }: EmperorCardProps) {
  const style: CardStyle = {
    '--portrait': `url("${emperor.portrait}")`,
  }

  // 上半区放军事，下半区放政治与文教（理由见 EventMindMap 顶部说明）
  const military = emperor.events.filter((event) => event.dimension === 'military')
  const civic = emperor.events.filter((event) => event.dimension !== 'military')

  return (
    <article className="emp-card" style={style} tabIndex={0} data-index={index}>
      <div className="emp-clip">
        <div className="emp-media" />
        <div className="emp-shade" />
        <div className="emp-content">
          <h2 className="emp-title">{emperor.posthumousTitle}</h2>
          <p className="emp-name">{emperor.personalName}</p>
          <p className="emp-reign">{emperor.reign}</p>
        </div>
        <span className="emp-corner" aria-hidden="true" />
      </div>

      <EventMindMap events={military} side="top" label="军事成就" />
      <EventMindMap events={civic} side="bottom" label="政治 · 文教" />
    </article>
  )
}
