/**
 * EmperorCard —— 单个帝王模块
 * ===========================================================================
 * 结构分三层，故意的：
 *   .emp-clip   负责圆角 + 裁剪（背景放大时不会溢出模块）
 *   .emp-media  背景图，hover 时 scale(1.05)，只动 transform（合成器友好）
 *   .emp-events 事件浮层，**在 .emp-clip 外面**，所以能伸出模块上下边界
 *
 * 三种浮层排布（layout）：
 *   split            上半区军事、下半区政治文教 —— 西周（单层）、晋、唐…默认用这个，
 *                    卡片上下都有空档
 *   stacked-top      全部事件收进上方一组 —— 东周"天子 + 诸侯"双层布局时使用，
 *                    因为下方紧挨着诸侯层，天子浮层向下会压住诸侯
 *   stacked-bottom   全部事件收进下方一组（军事在上、政治文教在下，同框两行）——
 *                    五代十国那种「帝王卡排在九行图的最上面一行」的版面用：
 *                    浮层朝上会被舞台裁掉，只能朝下开，下方是十国政权带，压住无妨
 *
 * 【关于文字模糊】
 * 早先悬浮时给整个 .emp-card 加了 transform: scale(1.012)，
 * 非整数缩放会让卡片内的文字被重新采样 —— 姓名与在位时间就"糊"了。
 * 现在卡片本身不再缩放（只让背景图放大），文字始终 1:1 渲染。
 */
import type { CSSProperties } from 'react'
import type { EmperorRecord } from '../../core/emperorTypes'
import { EventMindMap } from './EventMindMap'
import { useCodexStore } from '../../store/useCodexStore'
import { getEntryBySource } from '../../data/codex'

export type EmperorCardLayout = 'split' | 'stacked-top' | 'stacked-bottom'

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
  const openCodex = useCodexStore((s) => s.open)
  /* 帝王 / 诸侯的 sourceId 就是自己的 id；取不到条目就不出按钮 */
  const codexId = getEntryBySource(emperor.id)?.id ?? null
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
      data-evaluation={emperor.evaluation}
    >
      <div className="emp-clip">
        <div className="emp-media" />
        <div className="emp-shade" />
        <div className="emp-content">
          <h2 className="emp-title">{emperor.posthumousTitle}</h2>
          <p className="emp-name">{emperor.personalName}</p>
          <p className="emp-reign">{emperor.reign}</p>
          {emperor.posthumousRule ? (
            <p className="emp-rule">谥法 · {emperor.posthumousRule}</p>
          ) : null}
        </div>
        {codexId ? (
          <button
            type="button"
            className="emp-codex"
            aria-label={`查看${emperor.posthumousTitle}的档案`}
            title="查看档案"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation()
              openCodex(codexId)
            }}
          >
            档
          </button>
        ) : null}
        <span className="emp-corner" aria-hidden="true" />
      </div>

      {layout === 'split' ? (
        <>
          <EventMindMap side="top" groups={[{ events: military, label: '军事成就' }]} />
          <EventMindMap side="bottom" groups={[{ events: civic, label: '政治 · 文教' }]} />
        </>
      ) : layout === 'stacked-top' ? (
        <EventMindMap side="top" groups={[{ events: emperor.events, label: '在位要事' }]} />
      ) : (
        <EventMindMap
          side="bottom"
          groups={[
            { events: military, label: '军事成就' },
            { events: civic, label: '政治 · 文教' },
          ]}
        />
      )}
    </article>
  )
}
