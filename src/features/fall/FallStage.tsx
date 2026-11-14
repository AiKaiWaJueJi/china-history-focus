/**
 * FallStage —— 周室倾覆 / 九鼎入秦（时间轴与沙盘之间的过渡）
 * ===========================================================================
 * 三页，可交互翻页，不是一条长卷：
 *
 *   第一幕 秦取九鼎   → 下滚进第二幕
 *   第二幕 周既不祀   → 下滚进第三幕
 *   第三幕 权力更迭   → 文字走完才浮出【王朝覆灭】
 *
 * 几条硬规则（都是按要求来的）：
 *   · 每页文字**逐字浮现**；文字没走完，下滚只是"直接显示完"，不翻页
 *   · 逐字动画**只触发一次**；回到已看过的页，只播翻页动画、文字直接显示
 *   · 【王朝覆灭】只在第三幕文字走完后出现；上滚回第二幕即消失
 *   · 在第一幕再往上滚 → 弹确认框「返回帝王时间轴？」
 *   · 每幕背景不同且左右交替：鼎（左）→ 宗庙（右）→ 断符（左）
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useNavigate, useParams } from 'react-router-dom'
import fallZhou from '../../data/fall.zhou.json'
import fallDongqian from '../../data/fall.zhou.dongqian.json'
import dingPhoto from '../../assets/ding-photo.jpg'
import templePhoto from '../../assets/temple-photo.jpg'
import tallyPhoto from '../../assets/tally-photo.jpg'
import burnPhoto from '../../assets/burn-photo.jpg'
import marchPhoto from '../../assets/march-photo.jpg'
import thronePhoto from '../../assets/throne-photo.jpg'
import './fall.css'

/** 每一幕的影像代号 —— 数据里指定，组件只负责映射到文件 */
const ART: Record<string, string> = {
  ding: dingPhoto,
  temple: templePhoto,
  tally: tallyPhoto,
  burn: burnPhoto,
  march: marchPhoto,
  throne: thronePhoto,
}

const ART_ALT: Record<string, string> = {
  ding: '倾覆的青铜鼎',
  temple: '破败的周代宗庙',
  tally: '断裂的青铜符节',
  burn: '焚毁的西周宫室',
  march: '东迁的车马',
  throne: '空置的王庭',
}

interface FallAct {
  id: string
  /** 影像代号，见 ART 映射表 */
  art?: string
  year: string
  heading: string
  lines: string[]
  source: { book: string; text: string }
  note?: string
}

/** 第三幕走完后去哪里 */
interface FallNext {
  kind: 'endgame' | 'timeline'
  /** kind === 'timeline' 时回落的页码；'last' 表示最后一页 */
  page?: number | 'last'
}

interface FallData {
  dynastyId: string
  title: string
  subtitle: string
  lede: string
  acts: FallAct[]
  enterLabel: string
  enterHint: string
  next?: FallNext
  /** 第一幕上滚确认后，回到时间轴的哪一页 */
  back?: { page: number | 'last' }
}

/**
 * 过渡章节注册表
 * ---------------------------------------------------------------------------
 * key 是 URL 里的 chapter 段，缺省用 DEFAULT_CHAPTER。
 * 周有两个过渡：
 *   fall      西周覆灭 → 秦取九鼎 → 进沙盘（原有）
 *   dongqian  犬戎破镐京 → 平王东迁 → 回时间轴东周首页（新增）
 * 组件完全复用，视觉与交互因此天然一致。
 */
const CHAPTERS: Record<string, Record<string, FallData>> = {
  zhou: {
    dongqian: fallDongqian as FallData,
    fall: fallZhou as FallData,
  },
}

const DEFAULT_CHAPTER = 'fall'

/** 逐字速度（毫秒/字） */
const TYPE_SPEED = 46
/** 翻页冷却，避免触控板一次滑动连翻两页 */
const PAGE_COOLDOWN = 620

export function FallStage() {
  const { dynastyId, chapter } = useParams<{ dynastyId: string; chapter?: string }>()
  const navigate = useNavigate()
  const prefersReducedMotion = useReducedMotion()

  const data = dynastyId ? CHAPTERS[dynastyId]?.[chapter ?? DEFAULT_CHAPTER] : undefined
  const acts = data?.acts ?? []

  const [page, setPage] = useState(0)
  const [dir, setDir] = useState(1)
  /** 每页是否已经"演过一遍"；true 之后文字直接显示 */
  const [played, setPlayed] = useState<boolean[]>(() => acts.map(() => false))
  const [shown, setShown] = useState(0)
  const [confirmBack, setConfirmBack] = useState(false)
  const [leaving, setLeaving] = useState(false)

  const lastWheel = useRef(0)
  const typingRef = useRef<number | null>(null)

  const totalChars = (acts[page]?.lines ?? []).reduce((n, line) => n + line.length, 0)

  /* ---------- 逐字浮现（每页只演一次） ---------- */
  useEffect(() => {
    if (typingRef.current) {
      window.clearInterval(typingRef.current)
      typingRef.current = null
    }
    const act = acts[page]
    if (!act) return

    if (played[page] || prefersReducedMotion) {
      setShown(Number.MAX_SAFE_INTEGER)
      return
    }

    setShown(0)
    let n = 0
    typingRef.current = window.setInterval(() => {
      n += 1
      setShown(n)
      if (n >= totalChars) {
        if (typingRef.current) window.clearInterval(typingRef.current)
        typingRef.current = null
        setPlayed((prev) => prev.map((v, i) => (i === page ? true : v)))
      }
    }, TYPE_SPEED)

    return () => {
      if (typingRef.current) window.clearInterval(typingRef.current)
      typingRef.current = null
    }
    // totalChars 随 page 变化，不单独列为依赖
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, played, prefersReducedMotion])

  const typingDone = shown >= totalChars

  /** 立刻显示完本页 */
  const finishTyping = useCallback(() => {
    if (typingRef.current) {
      window.clearInterval(typingRef.current)
      typingRef.current = null
    }
    setShown(Number.MAX_SAFE_INTEGER)
    setPlayed((prev) => prev.map((v, i) => (i === page ? true : v)))
  }, [page])

  /* ---------- 滚轮翻页 ---------- */
  useEffect(() => {
    if (!data) return
    const onWheel = (event: WheelEvent) => {
      if (confirmBack || leaving) return
      if (Math.abs(event.deltaY) < 24) return

      const now = performance.now()
      if (now - lastWheel.current < PAGE_COOLDOWN) return
      lastWheel.current = now

      if (event.deltaY > 0) {
        // 文字没走完不翻页（点一下页面可以立刻显示完）
        if (!typingDone) return
        if (page < acts.length - 1) {
          setDir(1)
          setPage((p) => p + 1)
        }
        return
      }

      // 向上
      if (page > 0) {
        setDir(-1)
        setPage((p) => p - 1)
      } else {
        setConfirmBack(true)
      }
    }

    window.addEventListener('wheel', onWheel, { passive: true })
    return () => window.removeEventListener('wheel', onWheel)
  }, [data, acts.length, page, typingDone, confirmBack, leaving, finishTyping])

  /* ESC：有确认框先关框，否则询问返回 */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      if (confirmBack) {
        setConfirmBack(false)
        return
      }
      setConfirmBack(true)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [confirmBack])

  const backToTimeline = useCallback(() => {
    const target = data?.back?.page ?? 'last'
    navigate(`/dynasty/${dynastyId}`, { state: { page: target } })
  }, [dynastyId, navigate, data])

  /*
    第三幕之后的出口由数据决定：
      endgame  → 终局沙盘（周室倾覆）
      timeline → 回时间轴指定页（平王东迁 → 东周首页）
  */
  const goNext = useCallback(() => {
    if (!dynastyId || !data || leaving) return
    const next: FallNext = data.next ?? { kind: 'endgame' }
    setLeaving(true)
    window.setTimeout(() => {
      if (next.kind === 'endgame') {
        navigate(`/dynasty/${dynastyId}/endgame`)
      } else {
        navigate(`/dynasty/${dynastyId}`, { state: { page: next.page ?? 'last' } })
      }
    }, 760)
  }, [dynastyId, data, leaving, navigate])

  if (!data) {
    return (
      <div className="fall-page fall-page--empty">
        <p>该朝代没有对应的过渡章节</p>
        <button type="button" onClick={() => navigate('/')}>
          返回
        </button>
      </div>
    )
  }

  const act = acts[page]
  const canEnter = page === acts.length - 1 && typingDone

  /*
    把本页文字按已显示字数切开。
    只保留"已经开头"的行——否则尚未出现的行会占着高度，
    光标被顶到一行空白里，看起来像卡住了。
  */
  let offset = 0
  const visibleLines = act.lines
    .map((line) => {
      const start = offset
      offset += line.length
      const take = Math.max(0, Math.min(line.length, shown - start))
      return { text: line.slice(0, take), started: shown > start }
    })
    .filter((l) => l.started)

  return (
        <div
      className="fall-page"
      data-page={page}
      data-leaving={leaving}
      onClick={() => {
        if (!typingDone) finishTyping()
      }}
    >
      {/* 入场：从时间轴切进来时先盖一层黑，再化开，避免"啪"地出现 */}
      <div className="fall-curtain" aria-hidden="true" />

      <button type="button" className="fall-back" onClick={(e) => { e.stopPropagation(); setConfirmBack(true) }}>
        ↑ 返回时间轴
      </button>

      {/* 页名：小尺寸常驻，不抢单幕的标题 */}
      <div className="fall-brand">
        <span className="fall-brand-sub">{data.subtitle}</span>
        <span className="fall-brand-title">{data.title}</span>
      </div>

      {/* 页码 */}
      <div className="fall-pager" aria-hidden="true">
        {acts.map((a, i) => (
          <span key={a.id} className={`fall-dot${i === page ? ' is-on' : ''}`} />
        ))}
      </div>

      <AnimatePresence mode="wait" custom={dir} initial={false}>
        <motion.section
          key={act.id}
          className={`fall-act fall-act--${page}`}
          custom={dir}
          initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: dir > 0 ? 60 : -60 }}
          animate={{ opacity: 1, x: 0 }}
          exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: dir > 0 ? -60 : 60 }}
          transition={{ duration: prefersReducedMotion ? 0.12 : 0.5, ease: [0.2, 0.9, 0.2, 1] }}
        >
          {/* 每幕的专属影像，位置左右交替 */}
          <div className="fall-art" aria-hidden="true">
            <div className="fall-photo-wrap">
              <img
                className="fall-photo"
                src={ART[act.art ?? 'ding'] ?? ART.ding}
                alt={ART_ALT[act.art ?? 'ding'] ?? '过渡影像'}
              />
            </div>
          </div>

          <div className="fall-copy">
            <p className="fall-year">{act.year}</p>
            <h2 className="fall-heading">{act.heading}</h2>

            <div className="fall-lines">
              {visibleLines.map((line, k) => (
                <p key={k} className="fall-line">
                  {line.text}
                  {k === visibleLines.length - 1 && !typingDone ? (
                    <span className="fall-caret" aria-hidden="true" />
                  ) : null}
                </p>
              ))}
            </div>

            <blockquote className={`fall-source${typingDone ? ' is-in' : ''}`}>
              <span className="fall-source-book">{act.source.book}</span>
              <p className="fall-source-text">{act.source.text}</p>
            </blockquote>

            {act.note ? <p className="fall-note">{act.note}</p> : null}
          </div>
        </motion.section>
      </AnimatePresence>

      {/* 第三幕文字走完才出现；回滚到第二幕即消失 */}
      <div className="fall-foot" data-visible={canEnter}>
        <button type="button" className="fall-enter" onClick={(e) => { e.stopPropagation(); goNext() }}>
          <span className="fall-enter-label">{data.enterLabel}</span>
          <span className="fall-enter-hint">{data.enterHint} →</span>
        </button>
      </div>

      {confirmBack ? (
        <div className="fall-confirm-mask" onClick={() => setConfirmBack(false)}>
          <div className="fall-confirm" onClick={(e) => e.stopPropagation()} role="dialog">
            <p className="fall-confirm-title">返回帝王时间轴？</p>
            <p className="fall-confirm-text">周室倾覆尚未看完，返回后可随时再来。</p>
            <div className="fall-confirm-actions">
              <button type="button" className="fall-confirm-primary" onClick={backToTimeline}>
                返回时间轴
              </button>
              <button type="button" onClick={() => setConfirmBack(false)}>
                继续观看
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {leaving ? <div className="fall-unfurl" aria-hidden="true" /> : null}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* 三幕的影像                                                                  */
/* -------------------------------------------------------------------------- */
// 
// /** 一尊倾覆的鼎：圆腹、三足、双耳，腹内有铜绿与金文 */
// function DingArt() {
//   return (
//     <svg className="fall-ding" viewBox="0 0 200 180" fill="none">
//       <defs>
//         <pattern id="fall-patina" width="27" height="27" patternUnits="userSpaceOnUse">
//           <circle cx="5" cy="6" r="2.4" fill="#5d8f7a" opacity=".3" />
//           <circle cx="19" cy="14" r="1.5" fill="#4a7a6a" opacity=".26" />
//           <circle cx="11" cy="23" r="1.1" fill="#8a6a3a" opacity=".28" />
//           <circle cx="23" cy="4" r="1.3" fill="#6f9c86" opacity=".22" />
//           <circle cx="15" cy="9" r="0.8" fill="#3f6b5d" opacity=".25" />
//           <circle cx="3" cy="20" r="1" fill="#8a6a3a" opacity=".2" />
//         </pattern>
//         <radialGradient id="fall-ding-shade" cx="50%" cy="38%" r="68%">
//           <stop offset="40%" stopColor="#000" stopOpacity="0" />
//           <stop offset="100%" stopColor="#000" stopOpacity=".55" />
//         </radialGradient>
//         <clipPath id="fall-ding-clip">
//           <path d="M42 66c0 36 26 54 58 54s58-18 58-54z" />
//         </clipPath>
//       </defs>
// 
//       <path d="M42 66c0 36 26 54 58 54s58-18 58-54" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
//       <ellipse cx="100" cy="66" rx="58" ry="11" stroke="currentColor" strokeWidth="1.4" />
//       <path d="M66 58c0-14 16-14 16 0M118 58c0-14 16-14 16 0" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
//       <path d="M48 84h104" stroke="currentColor" strokeWidth="1.1" opacity=".55" />
//       <path d="M56 112l-8 34M100 120v30M144 112l8 34" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
// 
//       <g clipPath="url(#fall-ding-clip)">
//         <rect x="38" y="56" width="124" height="72" fill="url(#fall-patina)" />
//         <rect x="38" y="56" width="124" height="72" fill="url(#fall-ding-shade)" />
//         <g stroke="#e2c27a" strokeWidth="0.9" strokeLinecap="round" opacity=".2">
//           <path d="M62 84v16M68 82v20M74 86v14M80 83v18M86 87v12" />
//           <path d="M96 84v16M102 82v20M108 86v14M114 83v18M120 87v12" />
//           <path d="M128 85v14M134 83v18M140 86v13" />
//         </g>
//         <path d="M48 100h104" stroke="#3f6b5d" strokeWidth="1" opacity=".25" />
//       </g>
//     </svg>
//   )
// }

/** 破败的宗庙：柱、断梁、残幡 */
// function TempleArt() {
//   return (
//     <svg className="fall-temple" viewBox="0 0 200 200" fill="none">
//       {/* 台基 */}
//       <path d="M16 168h168" stroke="currentColor" strokeWidth="1.6" />
//       <path d="M26 156h148" stroke="currentColor" strokeWidth="1.1" opacity=".55" />
//       {/* 四根立柱，第二根断掉 */}
//       <path d="M40 156V72M84 156V72M156 156V72" stroke="currentColor" strokeWidth="1.6" />
//       <path d="M118 156v-46" stroke="currentColor" strokeWidth="1.6" />
//       <path d="M112 110h12" stroke="currentColor" strokeWidth="1.2" opacity=".7" />
//       {/* 屋顶：左半留存，右半塌了 */}
//       <path d="M28 72l30-24h44" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
//       <path d="M28 72h56" stroke="currentColor" strokeWidth="1.4" />
//       <path d="M96 48l30 20" stroke="currentColor" strokeWidth="1.2" opacity=".45" strokeDasharray="4 5" />
//       {/* 残幡 */}
//       <path d="M64 72v26l10-6 10 6V72" stroke="currentColor" strokeWidth="1" opacity=".4" />
//       <path d="M170 72v34" stroke="currentColor" strokeWidth="1" opacity=".3" strokeDasharray="6 4" />
//       {/* 门洞里的黑 */}
//       <rect x="52" y="112" width="48" height="44" fill="#000" opacity=".45" />
//     </svg>
//   )
// }

/** 断开的符节：合纵的信物，一分为二 */
// function TallyArt() {
//   return (
//     <svg className="fall-tally" viewBox="0 0 200 180" fill="none">
//       {/* 左半 */}
//       <path d="M30 40h56v100H30z" stroke="currentColor" strokeWidth="1.5" />
//       <path d="M30 66h56M30 92h56M30 118h56" stroke="currentColor" strokeWidth="1" opacity=".45" />
//       <path d="M62 40v100" stroke="currentColor" strokeWidth="1" opacity=".35" strokeDasharray="5 5" />
//       {/* 右半（错开一点，表示断裂） */}
//       <path d="M114 52h56v100h-56z" stroke="currentColor" strokeWidth="1.5" />
//       <path d="M114 78h56M114 104h56M114 130h56" stroke="currentColor" strokeWidth="1" opacity=".45" />
//       <path d="M138 52v100" stroke="currentColor" strokeWidth="1" opacity=".35" strokeDasharray="5 5" />
//       {/* 断口 */}
//       <path d="M90 44l6 18-8 14 7 20-6 22" stroke="currentColor" strokeWidth="1.2" opacity=".5" />
//       <path d="M110 60l-6 16 8 16-7 18" stroke="currentColor" strokeWidth="1" opacity=".35" />
//     </svg>
//   )
// }
