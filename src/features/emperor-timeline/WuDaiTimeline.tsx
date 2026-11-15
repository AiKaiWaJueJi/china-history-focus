/**
 * WuDaiTimeline —— 五代十国并行时间轴（907—960）
 * ===========================================================================
 * 五代十国与南北朝同构：中原五朝先后相继，南方十国同时并存。
 * 用法与南北朝一致——强制分页、每页只看一段窗口、行随存亡增删；
 * 差别有二：
 *   1. 只有「中原五代」一行挂帝王卡，十国行改为**政权带**（国名 + 起止年 + 悬停注），
 *      因为十国君主多为国主/王，不入帝系（与「十六国余部」同一口径）；
 *   2. 窗口只有 53 年、却要放 9 行，所以行高按 kind 加权（中原行 2.6fr，十国行 1fr），
 *      避免把帝王卡压成一条缝。
 *
 * 数据：src/data/wudai.json（行 / 政权 / 节点 / 页窗口），帝王直接读
 * src/data/emperors.five_dynasties.json，用 segmentId 映射到政权（seg_houliang → p_houliang）。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import raw from '../../data/wudai.json'
import empFile from '../../data/emperors.five_dynasties.json'
import type { EmperorRecord } from '../../core/emperorTypes'
import { EmperorCard } from './EmperorCard'
import { useWheelPaging } from './useWheelPaging'
import './wudai.css'

interface Row {
  id: string
  name: string
  note: string
  accent: string
  kind: 'dynasty' | 'states'
}
interface Polity {
  id: string
  name: string
  row: string
  start: number
  end: number
  full: string
  note: string
  leader?: string
}
interface Node {
  id: string
  year: number
  name: string
  note: string
  chapter?: string
}
interface PageWindow {
  from: number
  to: number
}

const PAGES = raw.pages as PageWindow[]
const ROWS = raw.rows as Row[]
const POLITIES = raw.polities as Polity[]
const NODES = raw.nodes as Node[]

/** segmentId → 政权 id：五代只有五个中原政权有帝系 */
const SEG_TO_POLITY: Record<string, string> = {
  seg_houliang: 'p_houliang',
  seg_houtang: 'p_houtang',
  seg_houjin: 'p_houjin',
  seg_houhan: 'p_houhan',
  seg_houzhou: 'p_houzhou',
}

const EMPERORS = empFile.emperors as unknown as EmperorRecord[]

export function WuDaiTimeline() {
  const navigate = useNavigate()
  const location = useLocation()

  const [pageIndex, setPageIndex] = useState(0)
  const [laneW, setLaneW] = useState(1000)
  const laneRef = useRef<HTMLDivElement | null>(null)
  const pageAt = useRef(0)

  const page = PAGES[Math.min(pageIndex, PAGES.length - 1)]
  const span = Math.max(page.to - page.from, 1)
  const scale = laneW / span

  const emperors = useMemo(() => {
    return EMPERORS.map((e) => ({ ...e, polityId: SEG_TO_POLITY[e.segmentId] }))
  }, [])

  /** 本页活着的行：政权与窗口相交；中原行整段都在 */
  const activeRows = useMemo(
    () =>
      ROWS.filter((row) => {
        if (row.kind === 'dynasty') return true
        return POLITIES.some((p) => p.row === row.id && p.start < page.to && p.end > page.from)
      }),
    [page],
  )

  const otherRows = Math.max(activeRows.length - 1, 1)

  /* 量一下行区宽度：窗口按页铺满，比例尺因此每页自适应 */
  useEffect(() => {
    const measure = () => {
      const el = laneRef.current
      if (el) setLaneW(Math.max(300, el.clientWidth))
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [pageIndex, activeRows.length])

  useEffect(() => {
    pageAt.current = performance.now()
  }, [pageIndex])

  const goFall = useCallback(() => {
    if (performance.now() - pageAt.current < 800) return
    navigate('/dynasty/five_dynasties/fall')
  }, [navigate])

  const changePage = useCallback((next: number) => setPageIndex(next), [])

  /*
    段末页继续下滚 = 进改朝换代的过渡页，而不是直接翻到下一段。
    五代十国的五页正好卡在四个易代节点上（923 后唐灭梁 / 936 石晋代唐 /
    947 契丹灭晋 / 951 郭威建周），与周秦汉晋「段末下滚进过渡页」完全同构；
    最后一页（951—960）的节点是收尾的「陈桥兵变」，交给 onBeyondEnd。
  */
  const onLeavePage = useCallback(
    (from: number) => {
      const node = NODES.find((n) => n.year === PAGES[from]?.to)
      if (!node?.chapter || node.chapter === 'fall') return false
      navigate(`/dynasty/five_dynasties/fall/${node.chapter}`)
      return true
    },
    [navigate],
  )

  useWheelPaging({
    pageCount: PAGES.length,
    pageIndex,
    onChange: changePage,
    onBeyondEnd: goFall,
    onLeavePage,
  })

  /* 从过渡页回来：回到最后一页 */
  useEffect(() => {
    const target = (location.state as { page?: string | number } | null)?.page
    if (target === 'last') setPageIndex(PAGES.length - 1)
    if (typeof target === 'number') setPageIndex(Math.max(0, Math.min(target, PAGES.length - 1)))
  }, [location.state])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        navigate('/')
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [navigate])

  const pos = (year: number) => Math.max(0, Math.min(laneW, (year - page.from) * scale))
  const clampWidth = (start: number, end: number) =>
    Math.max(18, Math.min(pos(end), laneW) - Math.max(pos(start), 0))

  /** 帝王卡：按即位年定位，重叠时向右让位（不改时间位置，只挪卡片） */
  const cards = useMemo(() => {
    const inPage = emperors.filter((e) => e.startYear < page.to && e.endYear > page.from)
    const out: { emperor: EmperorRecord; left: number; top: number }[] = []
    let cursor = -999
    for (const e of inPage) {
      const natural = Math.max(0, (e.startYear - page.from) * scale)
      const left = Math.min(Math.max(natural, cursor + 6), Math.max(laneW - 104, 0))
      out.push({ emperor: e as EmperorRecord & { polityId?: string }, left, top: 0 })
      cursor = left + 98
    }
    return out
  }, [emperors, page, scale, laneW])

  const yticks = useMemo(() => {
    const step = span <= 10 ? 1 : span <= 20 ? 2 : 5
    const out: number[] = []
    for (let y = page.from; y <= page.to; y += step) out.push(y)
    return out
  }, [page, span])

  const pageNode = NODES.find((n) => n.year === page.to)

  return (
    <div className="wdc-page">
      <header className="wdc-head">
        <button type="button" className="wdc-btn" onClick={() => navigate('/')}>
          ← 返回
        </button>
        <h1 className="wdc-title">五代十国</h1>
        <span className="wdc-period">907 — 960</span>
        <span className="wdc-count">
          五代 14 帝 · 十国 {POLITIES.filter((p) => p.row !== 'r_zhongyuan').length} 政权 · 第{' '}
          {pageIndex + 1} / {PAGES.length} 页
        </span>
        <span className="wdc-hint">滚轮 / ← → 翻页 · ESC 返回</span>
      </header>

      <div className="wdc-axis">
        {yticks.map((year) => (
          <span key={year} className="wdc-tick" style={{ left: pos(year) }}>
            <em>{year}</em>
          </span>
        ))}
      </div>

      <div className="wdc-stage">
        <div
          className="wdc-rows"
          style={{ gridTemplateRows: `2.6fr repeat(${otherRows}, 1fr)` }}
        >
          {activeRows.map((row, rowIndex) => {
            const polities = POLITIES.filter(
              (p) => p.row === row.id && p.start < page.to && p.end > page.from,
            )
            const isDynasty = row.kind === 'dynasty'
            return (
              <div key={row.id} className="wdc-row" data-kind={row.kind}>
                <div className="wdc-label" style={{ borderColor: row.accent }}>
                  <span className="wdc-label-name" style={{ color: row.accent }}>
                    {row.name}
                  </span>
                  <span className="wdc-label-note">{row.note}</span>
                </div>
                <div
                  className="wdc-lane"
                  ref={rowIndex === 0 ? laneRef : undefined}
                >
                  {polities.map((p) =>
                    isDynasty ? null : (
                      <div
                        key={p.id}
                        className="wdc-polity"
                        data-fresh={p.start >= page.from && p.start <= page.from + 2 ? '' : undefined}
                        style={{
                          left: pos(Math.max(p.start, page.from)),
                          width: clampWidth(p.start, p.end),
                          borderColor: row.accent,
                        }}
                        title={`${p.name} ${p.start}—${p.end} · ${p.note}`}
                      >
                        <span className="wdc-polity-name" style={{ color: row.accent }}>
                          {p.name}
                        </span>
                        <span className="wdc-polity-span">
                          {Math.max(p.start, page.from)}—{Math.min(p.end, page.to)}
                        </span>
                        {p.leader ? <span className="wdc-polity-leader">开国 {p.leader}</span> : null}
                      </div>
                    ),
                  )}

                  {isDynasty
                    ? cards.map(({ emperor, left }) => (
                        <div
                          key={emperor.id}
                          className="wdc-card"
                          style={{ left }}
                          title={`${emperor.posthumousTitle} · ${emperor.posthumousRule ?? ''}`}
                        >
                          <EmperorCard emperor={emperor} index={0} layout="stacked-top" compact />
                        </div>
                      ))
                    : null}
                </div>
              </div>
            )
          })}
        </div>

      </div>

      <footer className="wdc-foot">
        <div className="wdc-dots">
          {PAGES.map((p, i) => (
            <button
              key={`${p.from}-${p.to}`}
              type="button"
              className={`wdc-dot${i === pageIndex ? ' is-on' : ''}`}
              aria-label={`第 ${i + 1} 页`}
              onClick={() => setPageIndex(i)}
            />
          ))}
        </div>
        <div className="wdc-step">
          {pageNode ? (
            <button
              type="button"
              className="wdc-node"
              data-clickable={pageNode.chapter ? '' : undefined}
              onClick={() => {
                if (pageNode.chapter) navigate(`/dynasty/five_dynasties/fall/${pageNode.chapter}`)
              }}
              title={`${pageNode.year} ${pageNode.name} · ${pageNode.note}`}
            >
              <span className="wdc-node-year">{pageNode.year}</span>
              <span className="wdc-node-name">{pageNode.name}</span>
              <span className="wdc-node-note">{pageNode.note}</span>
            </button>
          ) : null}
          <span className="wdc-range">
            {page.from} — {page.to}
          </span>
          <button
            type="button"
            className="wdc-btn"
            disabled={pageIndex === 0}
            onClick={() => setPageIndex(Math.max(0, pageIndex - 1))}
          >
            ← 上一页
          </button>
          {pageIndex === PAGES.length - 1 ? (
            <button type="button" className="wdc-btn wdc-btn--fall" onClick={goFall}>
              继续下滑 · 陈桥兵变 ↓
            </button>
          ) : (
            <button
              type="button"
              className="wdc-btn"
              onClick={() => setPageIndex(Math.min(PAGES.length - 1, pageIndex + 1))}
            >
              下一页 →
            </button>
          )}
        </div>
      </footer>
    </div>
  )
}
