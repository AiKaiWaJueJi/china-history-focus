/**
 * NanBeiTimeline —— 南北朝多行帝王时间轴（8 页强制分页）
 * ===========================================================================
 * 南朝与北朝是并行的，不能用"一条时间轴翻页"来表达。
 * 这里按行并行：
 *   十六国余部 / 北魏 / 东魏·北齐 / 西魏·北周 / 南朝（宋齐梁陈）
 *
 * 分页模型（2026-11 重构，见 docs/HANDOFF.md）：
 *   1. 420—589 按易代节点切成 8 段，一段一页；滚轮不是横向自由滚动，而是强制翻页；
 *   2. 每页只挂载「本段还活着」的行（420—439 三行、502—534 两行……），
 *      行距由 `grid-template-rows: repeat(activeRows, 1fr)` 自动拉开，
 *      卸载掉的行不会留下空槽；
 *   3. 比例尺**按页自适应**：本段窗口铺满一屏、上下封顶。7 年的 550—557
 *      不会被压成两个字的宽度，40 年的 439—479 也不会把一张卡拉成整屏；
 *   4. 跨页的帝王卡 / 政权块按本页窗口裁切，断口用 data-cut 标记（虚线收边）。
 *
 * 每页右端固定收在本页的易代节点上（439/479/…/589），菱形点开是全屏过渡页。
 */
import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import raw from '../../data/nanbei.json'
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

type PagePolity = Polity & { left: number; right: number }
type PageEmperor = Emperor & { left: number; right: number; cutStart: boolean; cutEnd: boolean }

interface PageRow {
  row: Row
  polities: PagePolity[]
  emperors: PageEmperor[]
  /** 本段之前这块地归谁（如 535 年前的西魏行属北魏） */
  hint: string | null
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
      const polities = DATA.polities
        .filter((p) => p.row === row.id && p.start < to && p.end > from)
        .map((p) => ({ ...p, left: Math.max(p.start, from), right: Math.min(p.end, to) }))
      const emperors = DATA.emperors
        .filter((e) => {
          const polity = polityById.get(e.polity)
          return Boolean(polity && polity.row === row.id && e.start < to && e.end > from)
        })
        .map((e) => ({
          ...e,
          left: Math.max(e.start, from),
          right: Math.min(e.end, to),
          cutStart: e.start < from,
          cutEnd: e.end > to,
        }))
        .sort((a, b) => a.left - b.left)
      // 本行第一个政权若比本页起点晚 3 年以上，才值得提示「之前这块归北魏」
      const hint =
        polities.length > 0 && polities[0].start - from >= 3 ? `${polities[0].start} 年前属北魏` : null
      return { row, polities, emperors, hint }
    })
    .filter((item) => item.polities.length > 0)

  return { from, to, rows, node: DATA.nodes.find((n) => n.year === to) ?? null }
}

const PAGE_SPECS: PageSpec[] = PAGES.map((p) => buildPage(p.from, p.to))

/** 刻度：本页起点 + 段内的整十年；收束年交给节点标 */
function pageTicks(from: number, to: number) {
  const out: number[] = [from]
  for (let year = Math.ceil((from + 3) / 10) * 10; year <= to - 3; year += 10) out.push(year)
  return out
}

/** 卡片窄，去掉朝代前缀，只留庙号/谥号；完整称号在 title 与详情里 */
function displayTitle(title: string) {
  return title.replace(/^(宋|南齐|齐|梁|陈|北魏|东魏|西魏|北齐|北周)/, '')
}

interface PlacedEmperor extends PageEmperor {
  px: number
  width: number
  short: boolean
  cut: 'start' | 'end' | 'both' | null
}

/**
 * 帝王卡在本页泳道上的落点。
 * 短祚圆点要躲开前一个圆点：555 年贞阳侯与敬帝同时、都是圆点，
 * 不推开就只剩一个（点开还能选，但看不出有两个人）。
 */
function placeEmperors(emperors: PageEmperor[], from: number, scale: number, laneW: number): PlacedEmperor[] {
  let dotEdge = -Infinity
  return emperors.map((emperor) => {
    const short = emperor.end - emperor.start <= 2
    const base = (emperor.left - from) * scale
    let px = short ? Math.max(base, dotEdge) : base
    if (short) dotEdge = px + 22
    px = Math.max(0, Math.min(px, laneW - (short ? 20 : 0)))
    const spanPx = (emperor.right - emperor.left) * scale
    const width = Math.max(20, Math.min(short ? 20 : Math.max(spanPx, 54), laneW - px))
    const cut = short
      ? null
      : emperor.cutStart && emperor.cutEnd
        ? 'both'
        : emperor.cutStart
          ? 'start'
          : emperor.cutEnd
            ? 'end'
            : null
    return { ...emperor, px, width, short, cut }
  })
}

/* ---------------- 单页版面 ---------------- */

interface PageBodyProps {
  page: PageSpec
  width: number
  onOpenNode: (id: string) => void
  onSelect: (emperor: Emperor) => void
}

function PageBody({ page, width, onOpenNode, onSelect }: PageBodyProps) {
  const span = page.to - page.from
  // 短窗口（550—557 只有 7 年）必须放大，否则卡片会被压成两个字的宽度
  const scale =
    width > 0
      ? Math.max(MIN_SCALE, Math.min(MAX_SCALE, (width - LABEL - GUTTER - 6) / span))
      : 32
  const laneW = span * scale
  const nodeX = LABEL + laneW + GUTTER / 2
  const rows = page.rows.map((row) => ({
    ...row,
    placed: placeEmperors(row.emperors, page.from, scale, laneW),
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
        {rows.map(({ row, polities, placed, hint }) => (
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
              <div className="nbc-band">
                {hint ? <span className="nbc-empty">{hint}</span> : null}
                {polities.map((polity) => (
                  <div
                    key={polity.id}
                    className="nbc-polity"
                    data-polity={polity.id}
                    style={{
                      left: (polity.left - page.from) * scale,
                      width: (polity.right - polity.left) * scale,
                    }}
                  >
                    <span>
                      {polity.name}
                      <em>{polity.full}</em>
                      {polity.members ? <small>{polity.members}</small> : null}
                    </span>
                  </div>
                ))}
                {placed.map((emperor) => (
                  <button
                    key={emperor.id}
                    type="button"
                    className={`nbc-emp${emperor.short ? ' is-short' : ''}${
                      emperor.width >= 150 ? ' is-wide' : ''
                    }${!emperor.short && emperor.width < 78 ? ' is-tight' : ''}`}
                    data-emp={emperor.id}
                    data-evaluation={emperor.evaluation ?? 'neutral'}
                    data-cut={emperor.cut ?? undefined}
                    style={{ left: emperor.px, width: emperor.width }}
                    onClick={() => onSelect(emperor)}
                    title={`${emperor.title} ${emperor.name}（${emperor.start}—${emperor.end}）`}
                  >
                    <b>{emperor.short ? displayTitle(emperor.title).slice(0, 1) : displayTitle(emperor.title)}</b>
                    <em>
                      {emperor.cut === 'start' || emperor.cut === 'both' ? '← ' : ''}
                      {emperor.start}—{emperor.end}
                      {emperor.cut === 'end' || emperor.cut === 'both' ? ' →' : ''}
                    </em>
                  </button>
                ))}
              </div>
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
  const stageRef = useRef<HTMLDivElement>(null)
  const [stageWidth, setStageWidth] = useState(0)
  const [pageIndex, setPageIndex] = useState(0)
  const [direction, setDirection] = useState(1)
  const [selected, setSelected] = useState<Emperor | null>(null)
  const [nodeId, setNodeId] = useState<string | null>(null)
  const [actIndex, setActIndex] = useState(0)
  const prefersReducedMotion = useReducedMotion()

  /* 版面宽度可测：全页统一比例尺，取最长窗口铺满 */
  useLayoutEffect(() => {
    const el = stageRef.current
    if (!el) return
    const update = () => setStageWidth(el.clientWidth)
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
      setSelected(null)
      return target
    })
  }

  const { canPrev, canNext } = useWheelPaging({
    pageCount: PAGES.length,
    pageIndex,
    // 弹层/详情打开时，滚轮不翻页
    onChange: (next) => {
      if (nodeId || selected) return
      goPage(next)
    },
    // 末页继续下滚 → 收尾沙盘
    onBeyondEnd: () => {
      if (nodeId || selected) return
      navigate('/dynasty/southern_northern/endgame')
    },
  })

  const node = DATA.nodes.find((n) => n.id === nodeId) ?? null

  useLayoutEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (nodeId) setNodeId(null)
      else if (selected) setSelected(null)
      else navigate('/')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [nodeId, selected, navigate])

  const openNode = (id: string) => {
    setSelected(null)
    setNodeId(id)
    setActIndex(0)
  }

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
        <span className="nbc-legend-note">短祚（1—2 年）以圆点表示，点开可看详情</span>
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
            <PageBody page={page} width={stageWidth} onOpenNode={openNode} onSelect={setSelected} />
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

      {selected ? (
        <aside className="nbc-detail" data-emp-detail={selected.id}>
          <button type="button" className="nbc-detail-close" onClick={() => setSelected(null)}>
            ×
          </button>
          <span>{polityById.get(selected.polity)?.name}</span>
          <h2>{selected.title}</h2>
          <p>{selected.name}</p>
          <em>
            {selected.start} — {selected.end} 年在位
          </em>
          <small>点击其他帝王可切换；ESC 关闭</small>
        </aside>
      ) : null}

      {node ? (
        <div className="nbc-overlay" role="dialog" aria-modal="true" onClick={() => setNodeId(null)}>
          <div className="nbc-overlay-card" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="nbc-overlay-close" onClick={() => setNodeId(null)}>
              ×
            </button>
            <div className="nbc-overlay-head">
              <span>{node.year} 年</span>
              <h2>{node.title}</h2>
              <p>{node.subtitle}</p>
            </div>
            <div className="nbc-overlay-act">
              <div className="nbc-overlay-step">
                第 {actIndex + 1} / {node.acts.length} 幕
              </div>
              <h3>{node.acts[actIndex].heading}</h3>
              {node.acts[actIndex].lines.map((line) => (
                <p key={line}>{line}</p>
              ))}
              <blockquote>
                <cite>{node.acts[actIndex].source.book}</cite>
                {node.acts[actIndex].source.text}
              </blockquote>
            </div>
            <div className="nbc-overlay-actions">
              <button type="button" onClick={() => setActIndex((i) => Math.max(0, i - 1))} disabled={actIndex === 0}>
                ← 上一幕
              </button>
              <div className="nbc-overlay-dots">
                {node.acts.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    className={i === actIndex ? 'is-active' : ''}
                    onClick={() => setActIndex(i)}
                    aria-label={`第 ${i + 1} 幕`}
                  />
                ))}
              </div>
              {actIndex < node.acts.length - 1 ? (
                <button type="button" className="nbc-primary" onClick={() => setActIndex((i) => i + 1)}>
                  下一幕 →
                </button>
              ) : (
                <button type="button" className="nbc-primary" onClick={() => setNodeId(null)}>
                  回到时间轴
                </button>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
