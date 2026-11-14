/**
 * FallStage —— 周室倾覆 / 九鼎入秦（时间轴与沙盘之间的过渡）
 * ===========================================================================
 * 为什么需要这一页：
 *   赧王死于前 256，秦灭六国始于前 230，中间空了二十六年。
 *   直接跳过去，等于把"天命转移"整个略过了——而它恰恰是周秦之间的枢纽。
 *
 * 三个要点：
 *   1. **自滚动**：外层 body 是 overflow:hidden，所以这一页自己当滚动容器，
 *      否则内容会被直接截断（这就是之前"只能看一半"的原因）。
 *   2. **自动下沉**：进来后如果用户不动滚轮，页面按每秒约 12px 缓缓下移，
 *      让三幕随文字浮现自然展开；一碰滚轮就交还控制权，且不再自动。
 *   3. **上滚返回**：滚到顶部继续上滚 → 回时间轴末页。
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import fallZhou from '../../data/fall.zhou.json'
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

const FALL: Record<string, FallData> = {
  zhou: fallZhou as FallData,
}

/** 三幕全部浮现所需时间（与 CSS 的 animation-delay 对齐） */
const REVEAL_MS = 5200
/** 自动下沉速度：像素/秒。慢到像画卷自己往下走 */
const AUTO_SPEED = 12

export function FallStage() {
  const { dynastyId } = useParams<{ dynastyId: string }>()
  const navigate = useNavigate()
  const data = dynastyId ? FALL[dynastyId] : undefined

  const scrollerRef = useRef<HTMLDivElement>(null)
  const autoRef = useRef(true)
  const lastWheel = useRef(0)

  const [ready, setReady] = useState(false)
  const [leaving, setLeaving] = useState(false)

  /* 动画走完 → 出现入口 */
  useEffect(() => {
    if (!data) return
    const timer = window.setTimeout(() => setReady(true), REVEAL_MS)
    return () => window.clearTimeout(timer)
  }, [data])

  /* 自动下沉：用户一碰滚轮就停手，之后不再接管 */
  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) return

    let raf = 0
    let last = 0
    const tick = (t: number) => {
      if (!autoRef.current) return
      if (last) {
        const dt = t - last
        const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 2
        if (!atBottom) el.scrollTop += (dt / 1000) * AUTO_SPEED
      }
      last = t
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    const stop = () => {
      autoRef.current = false
    }
    window.addEventListener('wheel', stop, { passive: true })
    window.addEventListener('touchstart', stop, { passive: true })
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('wheel', stop)
      window.removeEventListener('touchstart', stop)
    }
  }, [])

  /* 顶部上滚 → 返回时间轴末页 */
  useEffect(() => {
    const onWheel = (event: WheelEvent) => {
      if (event.deltaY >= 0) return
      const el = scrollerRef.current
      if (!el || el.scrollTop > 2) return
      const now = performance.now()
      if (now - lastWheel.current < 700) return
      lastWheel.current = now
      navigate(`/dynasty/${dynastyId}`, { state: { page: 'last' } })
    }
    window.addEventListener('wheel', onWheel, { passive: true })
    return () => window.removeEventListener('wheel', onWheel)
  }, [dynastyId, navigate])

  /* ESC 返回时间轴 */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      navigate(`/dynasty/${dynastyId}`, { state: { page: 'last' } })
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [dynastyId, navigate])

  /* 进入沙盘：先播画卷展开，再导航 */
  const enterEndgame = useCallback(() => {
    if (!dynastyId || leaving) return
    setLeaving(true)
    window.setTimeout(() => navigate(`/dynasty/${dynastyId}/endgame`), 760)
  }, [dynastyId, leaving, navigate])

  const skip = useCallback(() => setReady(true), [])

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
    <div className="fall-page" data-ready={ready} data-leaving={leaving} onClick={skip} ref={scrollerRef}>
      {/* 极简光影：倾倒的鼎 · 熄灭的宗庙灯火 */}
      <div className="fall-atmos" aria-hidden="true">
        {/*
          一尊倾覆的鼎：圆腹、三足、双耳。
          腹内不看图也有质感——铜绿斑驳与金文，全部用 SVG pattern + 蒙版画出来，
          不引入任何位图。
        */}
        <svg className="fall-ding" viewBox="0 0 200 180" fill="none">
          <defs>
            {/* 铜绿斑驳：大小不一的铜锈点，随机感来自错位的圆心 */}
            <pattern id="fall-patina" width="27" height="27" patternUnits="userSpaceOnUse">
              <circle cx="5" cy="6" r="2.4" fill="#5d8f7a" opacity=".3" />
              <circle cx="19" cy="14" r="1.5" fill="#4a7a6a" opacity=".26" />
              <circle cx="11" cy="23" r="1.1" fill="#8a6a3a" opacity=".28" />
              <circle cx="23" cy="4" r="1.3" fill="#6f9c86" opacity=".22" />
              <circle cx="15" cy="9" r="0.8" fill="#3f6b5d" opacity=".25" />
              <circle cx="3" cy="20" r="1" fill="#8a6a3a" opacity=".2" />
            </pattern>

            {/* 腹内阴影：让鼎有厚度 */}
            <radialGradient id="fall-ding-shade" cx="50%" cy="38%" r="68%">
              <stop offset="40%" stopColor="#000" stopOpacity="0" />
              <stop offset="100%" stopColor="#000" stopOpacity=".55" />
            </radialGradient>

            {/* 只让纹理落在鼎腹里 */}
            <clipPath id="fall-ding-clip">
              <path d="M42 66c0 36 26 54 58 54s58-18 58-54z" />
            </clipPath>
          </defs>
          {/* 腹 */}
          <path
            d="M42 66c0 36 26 54 58 54s58-18 58-54"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
          {/* 口沿 */}
          <ellipse cx="100" cy="66" rx="58" ry="11" stroke="currentColor" strokeWidth="1.4" />
          {/* 双耳 */}
          <path
            d="M66 58c0-14 16-14 16 0M118 58c0-14 16-14 16 0"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
          />
          {/* 腹部纹带 */}
          <path d="M48 84h104" stroke="currentColor" strokeWidth="1.1" opacity=".55" />
          {/* 三足 */}
          <path
            d="M56 112l-8 34M100 120v30M144 112l8 34"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />

          {/* 腹内：铜绿 + 金文 */}
          <g clipPath="url(#fall-ding-clip)">
            <rect x="38" y="56" width="124" height="72" fill="url(#fall-patina)" />
            <rect x="38" y="56" width="124" height="72" fill="url(#fall-ding-shade)" />
            {/* 金文：两三行短画，像铸在腹上的铭 */}
            <g stroke="#e2c27a" strokeWidth="0.9" strokeLinecap="round" opacity=".2">
              <path d="M62 84v16M68 82v20M74 86v14M80 83v18M86 87v12" />
              <path d="M96 84v16M102 82v20M108 86v14M114 83v18M120 87v12" />
              <path d="M128 85v14M134 83v18M140 86v13" />
            </g>
            {/* 一道锈蚀的横向裂痕 */}
            <path d="M48 100h104" stroke="#3f6b5d" strokeWidth="1" opacity=".25" />
          </g>
        </svg>
        <span className="fall-lamp fall-lamp--a" />
        <span className="fall-lamp fall-lamp--b" />
        <span className="fall-lamp fall-lamp--c" />
      </div>

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

      {/* 文末留白，让最后一幕能滚到视口中间 */}
      <div className="fall-tail" aria-hidden="true" />

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

      {leaving ? <div className="fall-unfurl" aria-hidden="true" /> : null}
    </div>
  )
}
