/**
 * EmperorCard —— 单个帝王模块
 * ===========================================================================
 * 结构分三层，故意的：
 *   .emp-clip   负责圆角 + 裁剪（背景放大时不会溢出模块）
 *   .emp-media  背景图，hover 时 scale(1.05)，只动 transform（合成器友好）
 *   .emp-events 事件浮层，**在 .emp-clip 外面**，所以能伸出模块上下边界
 *
 * 两种浮层排布（layout）：
 *   split       上半区军事、下半区政治文教 —— 西周（单层）时使用，上下都空着
 *   stacked-top 全部事件收进上方一组 —— 东周"天子 + 诸侯"双层布局时使用，
 *               因为下方紧挨着诸侯层，天子浮层向下会压住诸侯
 *
 * 【关于文字模糊】
 * 早先悬浮时给整个 .emp-card 加了 transform: scale(1.012)，
 * 非整数缩放会让卡片内的文字被重新采样 —— 姓名与在位时间就"糊"了。
 * 现在卡片本身不再缩放（只让背景图放大），文字始终 1:1 渲染。
 */
import type { CSSProperties } from 'react'
import type { EmperorRecord } from '../../core/emperorTypes'
import { EventMindMap } from './EventMindMap'

export type EmperorCardLayout = 'split' | 'stacked-top'

interface EmperorCardProps {
  emperor: EmperorRecord
  index: number
  layout?: EmperorCardLayout
  /** 双层布局下的紧凑样式（天子层被弱化） */
  compact?: boolean
}

type CardStyle = CSSProperties & {
  '--portrait': string
}

export function EmperorCard({
  emperor,
  index,
  layout = 'split',
  compact = false,
}: EmperorCardProps) {
  const style: CardStyle = {
    '--portrait': `url("${emperor.portrait}")`,
  }

  const military = emperor.events.filter((event) => event.dimension === 'military')
  const civic = emperor.events.filter((event) => event.dimension !== 'military')

  return (
    <article
      className={`emp-card${compact ? ' emp-card--compact' : ''}`}
      style={style}
      tabIndex={0}
      data-index={index}
      data-layout={layout}
    >
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

      {layout === 'stacked-top' ? (
        <EventMindMap events={emperor.events} side="top" label="在位要事" />
      ) : (
        <>
          <EventMindMap events={military} side="top" label="军事成就" />
          <EventMindMap events={civic} side="bottom" label="政治 · 文教" />
        </>
      )}
    </article>
  )
}
