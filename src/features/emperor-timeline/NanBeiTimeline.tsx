/**
 * NanBeiTimeline —— 南北朝多行帝王时间轴（8 页强制分页）
 * ===========================================================================
 * 南朝与北朝是并行的，不能用"一条时间轴翻页"来表达。
 * 这里按行并行：
 *   十六国余部 / 北魏 / 东魏·北齐 / 西魏·北周 / 南朝（宋齐梁陈）
 *
 * 分页模型（见 docs/HANDOFF.md §3.9）：
 *   1. 420—589 按易代节点切成 8 段，一段一页；滚轮不是横向自由滚动，而是强制翻页；
 *   2. 每页只挂载「本段还活着」的行（420—439 三行、502—534 两行……），
 *      行距由 `grid-template-rows: repeat(activeRows, 1fr)` 自动拉开；
 *   3. 比例尺按页自适应：本段窗口铺满一屏、上下封顶；
 *   4. 帝王一律用标准 EmperorCard（画像 / 事件枝 / 谥法边框），卡片是**等大竖卡**，
 *      落在即位之年上；在位横跨两页的（如太武帝）两页各出现一次完整模块；
 *   5. 朝代更替由行名 + 卡上的完整庙号表达，不再画政权大色块（旧版 .nbc-polity 已删）。
 */
import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useLocation, useNavigate } from 'react-router-dom'
import raw from '../../data/nanbei.json'
import type { EmperorEvent, EmperorRecord } from '../../core/emperorTypes'
import { EmperorCard } from './EmperorCard'
import { useWheelPaging } from './useWheelPaging'
import './nanbei.css'

interface Row {
  id: string
  name: string
  note: string
}

interface Polity {
  id: string
  name: string
  row: string
  start: number
  end: number
  full: string
  members?: string
}

interface Emperor {
  id: string
  polity: string
  title: string
  name: string
  start: number
  end: number
  evaluation?: 'good' | 'neutral' | 'bad'
  reign?: string
  portrait?: string
  events?: EmperorEvent[]
  posthumousRule?: string
}

interface NodeAct {
  heading: string
  lines: string[]
  source: { book: string; text: string }
}

interface TimelineNode {
  id: string
  year: number
  title: string
  subtitle: string
  acts: NodeAct[]
}

interface NanBeiData {
  id: string
  title: string
  period: string
  intro: string
  rows: Row[]
  polities: Polity[]
  emperors: Emperor[]
  nodes: TimelineNode[]
}

const DATA = raw as NanBeiData
const polityById = new Map(DATA.polities.map((p) => [p.id, p]))

/* ---------------- 分页几何 ---------------- */

/** 8 页：每页都是「以某个易代节点收束」的纪年窗口，首尾相接铺满 420—589 */
const PAGES = [
  { from: 420, to: 439 },
  { from: 439, to: 479 },
  { from: 479, to: 502 },
  { from: 502, to: 534 },
  { from: 534, to: 550 },
  { from: 550, to: 557 },
  { from: 557, to: 577 },
  { from: 577, to: 589 },
] as const

/** 每页独立比例尺：本窗口铺满一屏，短窗口放大但有封顶（否则一张卡会铺满整屏） */
const LABEL = 96
const GUTTER = 64
const MIN_SCALE = 12
const MAX_SCALE = 96
/** 帝王卡宽高比（画像 420×520 的约定比例，竖卡） */
const CARD_RATIO = 0.72

type PageEmperor = Emperor & { left: number }

interface PageRow {
  row: Row
  emperors: PageEmperor[]
}

interface PageSpec {
  from: number
  to: number
  rows: PageRow[]
  node: TimelineNode | null
}

function buildPage(from: number, to: number): PageSpec {
  const rows = DATA.rows
    .map((row) => {
      const emperors = DATA.emperors
        .filter((e) => {
          const polity = polityById.get(e.polity)
          return Boolean(polity && polity.row === row.id && e.start < to && e.end > from)
        })
        .map((e) => ({ ...e, left: Math.max(e.start, from) }))
        .sort((a, b) => a.left - b.left || a.end - b.end)
      // 行存活看政权，不只看帝王：十六国余部没有帝系，但仍是一行
      const alive = DATA.polities.some((p) => p.row === row.id && p.start < to && p.end > from)
      return { row, emperors, alive }
    })
    .filter((item) => item.alive)
    .map(({ row, emperors }) => ({ row, emperors }))

  return { from, to, rows, node: DATA.nodes.find((n) => n.year === to) ?? null }
}

const PAGE_SPECS: PageSpec[] = PAGES.map((p) => buildPage(p.from, p.to))

/** 刻度：本页起点 + 段内的整十年；收束年交给节点标 */
function pageTicks(from: number, to: number) {
  const out: number[] = [from]
  for (let year = Math.ceil((from + 3) / 10) * 10; year <= to - 3; year += 10) out.push(year)
  return out
}

/** 帝王卡：数据 → 标准 EmperorCard 记录 */
function toRecord(emperor: Emperor): EmperorRecord {
  return {
    id: emperor.id,
    posthumousTitle: emperor.title,
    personalName: emperor.name,
    reign: emperor.reign ?? `${emperor.start} — ${emperor.end}`,
    startYear: emperor.start,
    endYear: emperor.end,
    segmentId: emperor.polity,
    portrait: emperor.portrait ?? '',
    events: emperor.events ?? [],
    evaluation: emperor.evaluation ?? 'neutral',
    posthumousRule: emperor.posthumousRule ?? '',
  }
}

/** 卡与卡之间的最小间隙 */
const CARD_GAP = 6
/** 卡高上限：再高就压到行线，画像也够用了 */
const CARD_MAX_H = 180

/**
 * 一行的落点：卡片等宽，按即位年放；挤在一起时先依次右推，
 * 若整行越出泳道就整体左移（不压缩间距），最终一定落在泳道内。
 * 元年即崩的（元凶劭、海陵王……）不再画圆点，也是一个完整模块。
 */
function placeCards(emperors: PageEmperor[], from: number, scale: number, width: number, laneW: number) {
  if (emperors.length === 0) return []
  const lefts = emperors.map((emperor) =>
    Math.max(0, Math.min((emperor.left - from) * scale, laneW - width)),
  )
  for (let i = 1; i < lefts.length; i++) {
    lefts[i] = Math.max(lefts[i], lefts[i - 1] + width + CARD_GAP)
  }
  /*
    连号即位（528 孝庄 / 530 长广 / 531 节闵 / 532 孝武）时前推会级联出界：
    从尾部回推把级联压回来，再前推兜一次底。总宽由 fitW 保证放得下。
  */
  if (lefts[lefts.length - 1] + width > laneW) {
    let limit = laneW - width
    for (let i = lefts.length - 1; i >= 0; i--) {
      lefts[i] = Math.min(lefts[i], limit)
      limit = lefts[i] - width - CARD_GAP
    }
    let cursor = 0
    for (let i = 0; i < lefts.length; i++) {
      lefts[i] = Math.max(lefts[i], cursor)
      cursor = lefts[i] + width + CARD_GAP
    }
  }
  return emperors.map((emperor, i) => ({ emperor, left: lefts[i] }))
}

/* ---------------- 单页版面 ---------------- */

interface PageBodyProps {
  page: PageSpec
  width: number
  height: number
  onOpenNode: (id: string) => void
}

function PageBody({ page, width, height, onOpenNode }: PageBodyProps) {
  const span = page.to - page.from
  const scale =
    width > 0 ? Math.max(MIN_SCALE, Math.min(MAX_SCALE, (width - LABEL - GUTTER - 6) / span)) : 32
  const laneW = span * scale
  const nodeX = LABEL + laneW + GUTTER / 2

  /* 卡片尺寸：竖卡（画像比例），上限 180 高；再按本页最挤的一行收窄，保证排得下 */
  const rowCount = Math.max(1, page.rows.length)
  const rowH = Math.max(120, (height - 54) / rowCount)
  const baseW = Math.round(Math.min(rowH - 24, CARD_MAX_H) * CARD_RATIO)
  const densest = Math.max(1, ...page.rows.map((row) => row.emperors.length))
  const fitW = Math.floor((laneW - CARD_GAP * (densest - 1)) / densest)
  const cardW = Math.max(64, Math.min(baseW, fitW))
  const cardH = Math.min(rowH - 24, Math.round(cardW / CARD_RATIO))

  const rows = page.rows.map((row) => ({
    ...row,
    placed: placeCards(row.emperors, page.from, scale, cardW, laneW),
  }))

  return (
    <>
      <div className="nbc-axis" data-lane={Math.round(laneW)} data-scale={Math.round(scale * 10) / 10}>
        {pageTicks(page.from, page.to).map((year) => (
          <span
            key={year}
            className={`nbc-tick${year === page.from ? ' is-edge' : ''}`}
            style={{ left: LABEL + (year - page.from) * scale }}
          >
            {year}
          </span>
        ))}
        {page.node ? (
          <button
            type="button"
            className="nbc-node"
            style={{ left: nodeX }}
            data-node={page.node.id}
            data-year={page.node.year}
            data-title={page.node.title}
            onClick={() => onOpenNode(page.node!.id)}
            title={`${page.node.year} · ${page.node.title}`}
          >
            <em>{page.node.year}</em>
            <i className="nbc-diamond" />
          </button>
        ) : null}
      </div>

      <div
        className="nbc-rows"
        data-rows={page.rows.length}
        style={{ gridTemplateRows: `repeat(${page.rows.length}, minmax(0, 1fr))` }}
      >
        {rows.map(({ row, placed }) => (
          <div
            key={row.id}
            className={`nbc-row nbc-row-${row.id}`}
            data-row={row.id}
            style={{ gridTemplateColumns: `${LABEL}px ${laneW}px ${GUTTER}px` }}
          >
            <div className="nbc-rowlabel">
              <b>{row.name}</b>
              <em>{row.note}</em>
            </div>
            <div className="nbc-lane">
              {placed.length === 0 ? (
                <span className="nbc-empty">十六国余部诸政权未入帝系，仅标行属</span>
              ) : (
                placed.map(({ emperor, left }) => (
                  <div
                    key={emperor.id}
                    className="nbc-slot"
                    data-emp={emperor.id}
                    style={{ left, width: cardW, height: cardH }}
                  >
                    <EmperorCard emperor={toRecord(emperor)} index={0} compact={cardW < 150} />
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>

      {page.node ? <div className="nbc-node-line" style={{ left: nodeX }} aria-hidden /> : null}
    </>
  )
}

/* ---------------- 主组件 ---------------- */

const pageVariants = {
  enter: (dir: number) => ({ x: dir >= 0 ? '42%' : '-42%', opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir >= 0 ? '-42%' : '42%', opacity: 0 }),
}

export function NanBeiTimeline() {
  const navigate = useNavigate()
  const location = useLocation()
  const stageRef = useRef<HTMLDivElement>(null)
  const [stage, setStage] = useState({ width: 0, height: 0 })
  /* 从过渡页回来时落在它指定的那一页（0 基） */
  const [pageIndex, setPageIndex] = useState(() => {
    const target = (location.state as { page?: number } | null)?.page
    return typeof target === 'number' ? Math.max(0, Math.min(PAGES.length - 1, target)) : 0
  })
  const [direction, setDirection] = useState(1)
  const prefersReducedMotion = useReducedMotion()

  /* 版面可测：比例尺按宽、卡片尺寸按高 */
  useLayoutEffect(() => {
    const el = stageRef.current
    if (!el) return
    const update = () => setStage({ width: el.clientWidth, height: el.clientHeight })
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const page = PAGE_SPECS[pageIndex]
  const activeRows = useMemo(() => new Set(page.rows.map((r) => r.row.id)), [page])
  const pageEmperorCount = page.rows.reduce((sum, r) => sum + r.emperors.length, 0)

  const goPage = (next: number) => {
    const target = Math.max(0, Math.min(PAGES.length - 1, next))
    setPageIndex((current) => {
      if (target === current) return current
      setDirection(target > current ? 1 : -1)
      return target
    })
  }

  /*
    翻过某一页 = 进入该页收束节点的过渡章节（这就是"强制分页"的用意）。
    过渡页演完后会带着 state.page 回到下一页；footer 的「下一页」按钮可以直接跳。
  */
  const goNode = (id: string) => navigate(`/dynasty/southern_northern/fall/${id}`)

  const { canPrev, canNext } = useWheelPaging({
    pageCount: PAGES.length,
    pageIndex,
    onChange: goPage,
    onLeavePage: (from) => {
      const gate = PAGE_SPECS[from]?.node
      if (!gate) return false
      goNode(gate.id)
      return true
    },
  })

  useLayoutEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') navigate('/')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navigate])

  const openNode = (id: string) => goNode(id)

  return (
    <div className="nanbei">
      <header className="nbc-head">
        <button type="button" className="nbc-back" onClick={() => navigate('/')}>
          ← 返回朝代主页
        </button>
        <div className="nbc-title">
          <h1>{DATA.title}</h1>
          <span>{DATA.period}</span>
        </div>
        <button
          type="button"
          className="nbc-endgame"
          onClick={() => navigate('/dynasty/southern_northern/endgame')}
        >
          收尾沙盘 · 隋灭陈 →
        </button>
        <p className="nbc-intro">{DATA.intro}</p>
      </header>

      <div className="nbc-legend">
        {DATA.rows.map((row) => (
          <span
            key={row.id}
            className={`nbc-legend-row nbc-row-${row.id}${activeRows.has(row.id) ? '' : ' is-idle'}`}
          >
            <i />
            {row.name}
            <em>{row.note}</em>
          </span>
        ))}
        <span className="nbc-legend-node">
          <i className="nbc-diamond" />
          易代节点 · 点击查看过渡页
        </span>
        <span className="nbc-legend-note">悬停帝王卡看要事</span>
        <span className="nbc-legend-eval">
          <i className="nbc-eval-good" />
          美谥
          <i className="nbc-eval-neutral" />
          平谥
          <i className="nbc-eval-bad" />
          恶谥
        </span>
      </div>

      <div className="nbc-stage" ref={stageRef} data-page={pageIndex + 1} aria-live="polite">
        <AnimatePresence mode="popLayout" initial={false} custom={direction}>
          <motion.div
            key={pageIndex}
            className="nbc-page"
            data-page={pageIndex + 1}
            data-from={page.from}
            data-to={page.to}
            custom={direction}
            variants={pageVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={
              prefersReducedMotion
                ? { duration: 0.12 }
                : { type: 'spring', stiffness: 260, damping: 32, mass: 0.9 }
            }
          >
            <PageBody page={page} width={stage.width} height={stage.height} onOpenNode={openNode} />
          </motion.div>
        </AnimatePresence>
      </div>

      <footer className="nbc-foot">
        <span className="nbc-foot-meta">
          第 {pageIndex + 1} / {PAGES.length} 页 · {page.from}—{page.to} 年（{page.to - page.from} 年）·{' '}
          {pageEmperorCount} 位帝王
          {page.node ? ` · 本页收束：${page.node.title}` : ''}
        </span>
        <span className="nbc-foot-hint">滚轮 / ← → 翻页 · ESC 返回</span>
        <div className="nbc-dots">
          {PAGES.map((window, index) => (
            <button
              key={window.from}
              type="button"
              className={`nbc-dot${index === pageIndex ? ' is-active' : ''}`}
              aria-label={`第 ${index + 1} 页 · ${window.from}—${window.to}`}
              onClick={() => goPage(index)}
            />
          ))}
        </div>
        <div className="nbc-step">
          <button type="button" disabled={!canPrev} onClick={() => goPage(pageIndex - 1)}>
            ← 上一页
          </button>
          <button type="button" disabled={!canNext} onClick={() => goPage(pageIndex + 1)}>
            下一页 →
          </button>
        </div>
      </footer>

    </div>
  )
}
