/**
 * FallStage —— 周室倾覆 / 九鼎入秦（时间轴与沙盘之间的过渡）
 * ===========================================================================
 * 为什么需要这一页：
 *   赧王死于前 256，秦灭六国始于前 230，中间空了二十六年。
 *   直接跳过去，等于把"天命转移"这件事整个略过了——而它恰恰是周秦之间的枢纽。
 *
 * 交互：
 *   · 进入后三幕依次浮现（纯 CSS 错峰，不用逐帧 JS）
 *   · 动画走完、或点击屏幕任意处，底部出现【王朝覆灭】
 *   · 页面顶部常驻「↑ 上滚返回时间轴」，在顶部上滚即返回
 *   · 点按钮：画卷向下展开 → 进入沙盘
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import './fall.css'

interface FallAct {
  id: string
  year: string
  heading: string
  lines: string[]
  source: { book: string; text: string }
  note?: string
}

interface FallData {
  dynastyId: string
  title: string
  subtitle: string
  lede: string
  acts: FallAct[]
  enterLabel: string
  enterHint: string
}

import fallZhou from '../../data/fall.zhou.json'

const FALL: Record<string, FallData> = {
  zhou: fallZhou as FallData,
}

/** 三幕全部浮现所需时间（与 CSS 的 animation-delay 对齐） */
const REVEAL_MS = 5200

export function FallStage() {
  const { dynastyId } = useParams<{ dynastyId: string }>()
  const navigate = useNavigate()

  const data = dynastyId ? FALL[dynastyId] : undefined

  const [ready, setReady] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const lastTime = useRef(0)

  /* 动画走完 → 出现入口 */
  useEffect(() => {
    if (!data) return
    const timer = window.setTimeout(() => setReady(true), REVEAL_MS)
    return () => window.clearTimeout(timer)
  }, [data])

  /* 点击任意处 = 跳过动画，直接露出入口 */
  const skip = useCallback(() => setReady(true), [])

  /* 顶部上滚 → 返回时间轴最后一页 */
  useEffect(() => {
    const onWheel = (event: WheelEvent) => {
      if (event.deltaY >= 0) {
        lastTime.current = 0
        return
      }
      const atTop = window.scrollY <= 2
      if (!atTop) return
      const now = performance.now()
      if (now - lastTime.current < 600) return
      lastTime.current = now
      navigate(`/dynasty/${dynastyId}`, { state: { page: 'last' } })
    }
    window.addEventListener('wheel', onWheel, { passive: true })
    return () => window.removeEventListener('wheel', onWheel)
  }, [dynastyId, navigate])

  /* 进入沙盘：先播画卷展开，再导航 */
  const enterEndgame = useCallback(() => {
    if (!dynastyId || leaving) return
    setLeaving(true)
    window.setTimeout(() => navigate(`/dynasty/${dynastyId}/endgame`), 760)
  }, [dynastyId, leaving, navigate])

  /* ESC：优先返回时间轴 */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      navigate(`/dynasty/${dynastyId}`, { state: { page: 'last' } })
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [dynastyId, navigate])

  if (!data) {
    return (
      <div className="fall-page fall-page--empty">
        <p>该朝代没有「周室倾覆」数据</p>
        <button type="button" onClick={() => navigate('/')}>
          返回
        </button>
      </div>
    )
  }

  return (
    <div className="fall-page" data-ready={ready} data-leaving={leaving} onClick={skip}>
      {/* 顶部常驻出口 */}
      <button
        type="button"
        className="fall-back"
        onClick={(event) => {
          event.stopPropagation()
          navigate(`/dynasty/${dynastyId}`, { state: { page: 'last' } })
        }}
      >
        ↑ 上滚返回时间轴
      </button>

      <header className="fall-head">
        <p className="fall-subtitle">{data.subtitle}</p>
        <h1 className="fall-title">{data.title}</h1>
        <p className="fall-lede">{data.lede}</p>
      </header>

      <section className="fall-acts">
        {data.acts.map((act, i) => (
          <article key={act.id} className="fall-act" style={{ ['--i' as string]: i }}>
            <p className="fall-year">{act.year}</p>
            <h2 className="fall-heading">{act.heading}</h2>
            <div className="fall-lines">
              {act.lines.map((line, k) => (
                <p key={k} className="fall-line" style={{ ['--k' as string]: k }}>
                  {line}
                </p>
              ))}
            </div>
            <blockquote className="fall-source">
              <span className="fall-source-book">{act.source.book}</span>
              <p className="fall-source-text">{act.source.text}</p>
            </blockquote>
            {act.note ? <p className="fall-note">{act.note}</p> : null}
          </article>
        ))}
      </section>

      <footer className="fall-foot">
        <button
          type="button"
          className="fall-enter"
          onClick={(event) => {
            event.stopPropagation()
            enterEndgame()
          }}
        >
          <span className="fall-enter-label">{data.enterLabel}</span>
          <span className="fall-enter-hint">{data.enterHint} →</span>
        </button>
      </footer>

      {/* 画卷展开：向下铺满，遮住过渡，再进沙盘 */}
      {leaving ? <div className="fall-unfurl" aria-hidden="true" /> : null}
    </div>
  )
}
