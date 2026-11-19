/**
 * CodexDrawer —— 右侧「历史档案」抽屉（无限下钻）
 * ===========================================================================
 * 全局只有一个抽屉：点帝王 / 点诸侯 / 点战报人名 / 点战报标题，都从这里滑出。
 * 正文里的高亮词条不会开新弹窗，而是把当前档案换成下一层——
 * 方向由 store 的 direction 决定：下钻从右滑入，返回从左滑回。
 *
 * 三条设计上的取舍：
 *   1. **不做全屏黑底**：只压暗页面（CSS 里 body:has(.codex-drawer) .app-shell），
 *      再加一层很淡的点击层。用户始终能看见底下是什么页面。
 *   2. **不加 blur**：背景是 SVG 地图与时间轴大 DOM，blur 会整棵树重栅格化，
 *      这一轮沙盘刚为此踩过坑（见 HANDOFF §3.13b）。
 *   3. **面包屑**：无限下钻最容易迷路，顶部把路径摊开来，点任一级直接跳回。
 *
 * 帝王 / 诸侯走 ArchiveBody（结构化时间线），其余类型仍走纯文本 RichText。
 */
import { useEffect, useRef } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import type { CodexEntry } from '../../core/codex'
import { KIND_LABEL } from '../../core/codex'
import { codexById, relatedEntries } from '../../data/codex'
import { hasStructuredArchive } from '../../data/archive'
import {
  useCodexCurrentId,
  useCodexDirection,
  useCodexStack,
  useCodexStore,
} from '../../store/useCodexStore'
import { ArchiveBody } from './ArchiveBody'
import { RichText } from './RichText'
import './codex.css'

/** 方向 1：新档案从右滑入、旧档案向左淡出；方向 -1：反过来 */
const slideVariants = {
  enter: (direction: number) => ({ x: direction > 0 ? '100%' : '-46%', opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (direction: number) => ({ x: direction > 0 ? '-46%' : '100%', opacity: 0 }),
}

/**
 * 一段史料。
 * 出处层级小签（2026-11-18 批次 1 引入）：
 *   · 一手 —— 正史本纪/列传/志、先秦两汉文献；
 *   · 转引 —— 原书亡佚，靠类书/后人注疏留下来；**必须把转引链一并写出来**，
 *     否则读者会以为这是原书原文（那正是本项目最不肯让步的一条）。
 */
function QuoteBlock({ quote }: { quote: CodexEntry['quotes'][number] }) {
  const tier = quote.tier ?? 'primary'
  return (
    <figure className="codex-quote" data-tier={tier}>
      <figcaption className="codex-quote-work">
        {quote.work ? <span className="codex-quote-source">{quote.work}</span> : null}
        <span className="codex-quote-tier" title={tier === 'secondary' ? '原书已佚，此为转引' : '正史/先秦文献原文'}>
          {tier === 'secondary' ? '转引' : '一手'}
        </span>
      </figcaption>
      <blockquote className="codex-quote-text">{quote.text}</blockquote>
      {quote.translation ? <p className="codex-quote-translation">{quote.translation}</p> : null}
      {/* 转引链只要写了就显示：层级标签讲「是不是同时代文献」，via 讲「经过谁 / 何以存疑」，
          两者可以并存（如《泰誓》标转引、via 说明它是伪古文）。 */}
      {quote.via ? (
        <p className="codex-quote-via">
          {tier === 'secondary' ? '转引：' : ''}
          {quote.via}
        </p>
      ) : null}
    </figure>
  )
}

function CodexCard({ entry, onDrill }: { entry: CodexEntry; onDrill: (id: string) => void }) {
  const related = relatedEntries(entry).slice(0, 8)
  /* 帝王 / 诸侯：结构化时间线（全量事件 + 点开详情）；其余类型仍是纯文本正文 */
  const structured = hasStructuredArchive(entry)
  return (
    <>
      <header className="codex-head">
        <div className="codex-head-main">
          <span className="codex-kind">{KIND_LABEL[entry.kind]}</span>
          <h2 className="codex-name">{entry.name}</h2>
          {entry.subtitle ? <p className="codex-subtitle">{entry.subtitle}</p> : null}
          {entry.years ? <p className="codex-years">{entry.years}</p> : null}
        </div>
      </header>

      <div className="codex-scroll">
        {entry.quotes.map((quote, i) => (
          <QuoteBlock key={i} quote={quote} />
        ))}
        {/* 留白登记：不是「还没来得及写」，是查过确实没有。写出来比空着诚实。 */}
        {!entry.quotes.length && entry.noQuote ? (
          <p className="codex-noquote">
            <span className="codex-noquote-label">暂无可靠语录</span>
            {entry.noQuote}
          </p>
        ) : null}
        {structured ? (
          <ArchiveBody entry={entry} onDrill={onDrill} />
        ) : (
          <RichText text={entry.body} onDrill={onDrill} />
        )}
      </div>

      {related.length ? (
        <footer className="codex-foot">
          <span className="codex-foot-label">关联</span>
          <div className="codex-related">
            {related.map((rel) => (
              <button key={rel.id} type="button" className="codex-chip" onClick={() => onDrill(rel.id)}>
                <em>{KIND_LABEL[rel.kind]}</em>
                {rel.name}
              </button>
            ))}
          </div>
        </footer>
      ) : null}
    </>
  )
}

export function CodexDrawer() {
  const stack = useCodexStack()
  const currentId = useCodexCurrentId()
  const direction = useCodexDirection()
  const back = useCodexStore((s) => s.back)
  const close = useCodexStore((s) => s.close)
  const drill = useCodexStore((s) => s.drill)
  const jumpTo = useCodexStore((s) => s.jumpTo)
  const reduce = useReducedMotion()
  const panelRef = useRef<HTMLDivElement>(null)

  const open = stack.length > 0
  const entry = currentId ? codexById.get(currentId) : undefined

  /* ESC 关整层；← 退一级。捕获阶段拦下，避免底下的页面把 ESC 当成"返回主页" */
  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        close()
      } else if (event.key === 'ArrowLeft' && !event.metaKey && !event.ctrlKey && !event.altKey) {
        const target = event.target as HTMLElement | null
        if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return
        event.preventDefault()
        event.stopPropagation()
        back()
      }
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [open, close, back])

  /* 打开时把焦点交给抽屉，键盘用户不会还在页面上乱跑 */
  useEffect(() => {
    if (open) panelRef.current?.focus()
  }, [open])

  if (!open || !entry) return null

  return (
    <div className="codex-root">
      <div className="codex-veil" onClick={close} aria-hidden="true" />

      <AnimatePresence mode="popLayout" custom={direction} initial={false}>
        <motion.div
          key={entry.id}
          ref={panelRef}
          className="codex-drawer"
          custom={direction}
          variants={slideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={
            reduce
              ? { duration: 0 }
              : { type: 'spring', stiffness: 320, damping: 34, mass: 0.9 }
          }
          role="dialog"
          aria-modal="true"
          aria-label={`${KIND_LABEL[entry.kind]}档案：${entry.name}`}
          tabIndex={-1}
        >
          <nav className="codex-crumbs" aria-label="档案路径">
            <button
              type="button"
              className="codex-back"
              onClick={back}
              disabled={stack.length <= 1}
              aria-label="返回上一层"
            >
              ← 返回
            </button>
            <ol className="codex-crumb-list">
              {stack.map((id, i) => {
                const item = codexById.get(id)
                if (!item) return null
                const isLast = i === stack.length - 1
                return (
                  <li key={id}>
                    {isLast ? (
                      <span className="codex-crumb is-current">{item.name}</span>
                    ) : (
                      <button type="button" className="codex-crumb" onClick={() => jumpTo(i)}>
                        {item.name}
                      </button>
                    )}
                    {isLast ? null : <i className="codex-crumb-sep">›</i>}
                  </li>
                )
              })}
            </ol>
            <button type="button" className="codex-close" onClick={close} aria-label="关闭档案">
              ×
            </button>
          </nav>

          <CodexCard entry={entry} onDrill={drill} />
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
