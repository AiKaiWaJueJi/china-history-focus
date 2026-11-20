/**
 * SongParallelTimeline —— 宋辽金西夏并立（960—1279）四行并行时间轴
 * ===========================================================================
 * 与南北朝、五代十国同一套阅读模型：一次只看一页窗口，滚轮 / ← → 翻页，ESC 退出。
 *
 * 三条设计取舍：
 *   1. **另开视图，不改宋的单行时间轴**。宋那条已被 verify-frame / journey 钉住（分页、段间过渡、末页入口），
 *      改成四行等于推倒重来；而读者要看的是「同时还有谁」，不是「宋帝换排版」。入口放在宋时间轴顶栏。
 *   2. **宋帝复用帝王卡与帝王档案**：他们的百科条目早就在（kind='emperor'），点卡直接进档案。
 *   3. **辽 / 西夏 / 金 用「政权卡」**：这三位不是宋的帝王，出帝王卡会误导；卡片只给谥号、本名、在位年，
 *      点开是 `ruler`（君主）档案——和南北朝、十国君主同一个 kind。
 *
 * 两条阅读辅助（2026-11-21 补）：
 *   · **宋行的分段色带**：北宋 / 南宋本来就写在这一行的注里，但「1127 到底落在哪一页」读不出来。
 *     现在把 segments.song.json 的两段画成宋行底部的一条色带，边界年份取数据里的段界（不写死 1127），
 *     并加一道贯穿行高的虚线——翻到第 5 页（1120—1160）就能看见「靖康前后」从蓝转绿。
 *   · **大事索引可点跳页**：原先只显示「本页大事」，而第 1 页（960—1000）一件大事都没有，
 *     页脚整块不渲染，读者不知道这条线后面还有什么。现在八件大事常驻，当前页那件高亮，
 *     点任一事件直接跳到它所在的那一页。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { EmperorRecord, TimelineSegment } from '../../core/emperorTypes'
import { getDynastyEmperors, getDynastySegments } from '../../data/emperorData'
import { getEntryBySource } from '../../data/codex'
import type { ParallelRuler } from '../../data/songParallel'
import {
  parallelNodes,
  parallelPages,
  parallelPolities,
  parallelPeriod,
  parallelRulersByPolity,
  parallelRows,
  parallelTitle,
} from '../../data/songParallel'
import { useCodexStore } from '../../store/useCodexStore'
import { useWheelPaging } from './useWheelPaging'
import './song-parallel.css'

const CARD_W = 104
const CARD_GAP = 8

const SONG_EMPERORS = (getDynastyEmperors('song')?.emperors ?? []) as unknown as EmperorRecord[]
/* 宋行色带用宋自己的分段数据（北宋 960—1127 / 南宋 1127—1279），不在这里另抄一份年份 */
const SONG_SEGMENTS = (getDynastySegments('song')?.segments ?? []) as TimelineSegment[]
/** 段与段的接缝（= 后一段的起始年），用它在行里画「靖康」那道分界 */
const SONG_SEG_BREAKS = SONG_SEGMENTS.slice(1).map((s) => s.startYear)

const EVAL_LABEL = { good: '美谥', neutral: '平谥', bad: '恶谥' } as const

function evalClass(evaluation: string) {
  return evaluation === 'good' ? 'is-good' : evaluation === 'bad' ? 'is-bad' : 'is-neutral'
}

/** 一张政权卡（辽 / 西夏 / 金 的君主）。点开是 ruler 档案。 */
function RulerCard({
  title,
  name,
  reign,
  evaluation,
  onOpen,
}: {
  title: string
  name: string
  reign: string
  evaluation: string
  onOpen: () => void
}) {
  return (
    <article
      className={`spt-card ${evalClass(evaluation)}`}
      role="button"
      tabIndex={0}
      aria-label={`打开${title}的历史档案`}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return
        event.preventDefault()
        onOpen()
      }}
    >
      <span className="spt-card-title">{title}</span>
      <span className="spt-card-name">{name}</span>
      <span className="spt-card-reign">{reign}</span>
      <span className="spt-card-eval">{EVAL_LABEL[evaluation as keyof typeof EVAL_LABEL] ?? ''}</span>
    </article>
  )
}

export function SongParallelTimeline() {
  const navigate = useNavigate()
  const openEntry = useCodexStore((s) => s.open)

  const [pageIndex, setPageIndex] = useState(0)
  const [laneW, setLaneW] = useState(1000)
  const laneRef = useRef<HTMLDivElement | null>(null)
  const pageAt = useRef(0)

  const page = parallelPages[Math.min(pageIndex, parallelPages.length - 1)]
  const span = Math.max(page.to - page.from, 1)
  const scale = laneW / span

  useEffect(() => {
    const measure = () => {
      const el = laneRef.current
      if (el) setLaneW(Math.max(320, el.clientWidth))
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [pageIndex])

  useEffect(() => {
    pageAt.current = performance.now()
  }, [pageIndex])

  const changePage = useCallback((next: number) => setPageIndex(next), [])

  /* 末页继续下滚：回宋的单行时间轴（那里有正儿八经的收尾过渡页），不在这里再造一个「宋亡」过渡页 */
  const onBeyondEnd = useCallback(() => {
    if (performance.now() - pageAt.current < 800) return
    navigate('/dynasty/song')
  }, [navigate])

  useWheelPaging({
    pageCount: parallelPages.length,
    pageIndex,
    onChange: changePage,
    onBeyondEnd,
  })

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      navigate('/dynasty/song')
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [navigate])

  const pos = (year: number) => Math.max(0, Math.min(laneW, (year - page.from) * scale))
  const clampWidth = (start: number, end: number) =>
    Math.max(16, Math.min(pos(end), laneW) - Math.max(pos(start), 0))

  /** 把一组「起始年」排成不重叠的一行卡（只挪卡片，不改时间位置） */
  const layout = <T extends { start: number }>(items: T[]): (T & { left: number })[] => {
    let cursor = -999
    return items.map((item) => {
      const natural = Math.max(0, (item.start - page.from) * scale)
      const left = Math.min(Math.max(natural, cursor + CARD_GAP), Math.max(laneW - CARD_W, 0))
      cursor = left + CARD_W
      return { ...item, left }
    })
  }

  const songCards = useMemo(
    () =>
      layout(
        SONG_EMPERORS.filter((e) => e.startYear < page.to && e.endYear > page.from).map((e) => ({
          ...e,
          start: e.startYear,
        })),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [page, scale, laneW],
  )

  const rulerCards = useMemo(() => {
    const out = new Map<string, (ParallelRuler & { left: number })[]>()
    for (const polity of parallelPolities) {
      const list = (parallelRulersByPolity.get(polity.id) ?? []).filter(
        (r) => r.start < page.to && r.end > page.from,
      )
      if (!list.length) continue
      out.set(polity.row, layout(list))
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, scale, laneW])

  const yticks = useMemo(() => {
    const step = span <= 40 ? 5 : 10
    const out: number[] = []
    for (let y = page.from; y <= page.to; y += step) out.push(y)
    return out
  }, [page, span])

  /* 大事索引：常驻显示全部节点（原先只显示本页，第 1 页干脆整块不渲染），按年份排好 */
  const nodeIndex = useMemo(
    () =>
      [...parallelNodes]
        .sort((a, b) => a.year - b.year)
        .map((n) => {
          const at = parallelPages.findIndex((p) => n.year >= p.from && n.year < p.to)
          return { ...n, pageIndex: at >= 0 ? at : Math.max(parallelPages.length - 1, 0) }
        }),
    [],
  )

  const jumpToYear = (year: number) => {
    const at = parallelPages.findIndex((p) => year >= p.from && year < p.to)
    if (at >= 0) changePage(at)
  }

  /* 宋不在这份 polities 里（它的帝王读 emperors.song.json），但页面窗口永远落在宋的 960—1279 之内，
     所以「并立」那一行要手动把宋算上——否则第 1 页只写「辽 并立」，读者以为宋不存在 */
  const alive = [
    '宋',
    ...parallelPolities.filter((p) => p.start < page.to && p.end > page.from).map((p) => p.name),
  ]

  return (
    <div className="spt-page">
      <header className="spt-head">
        <button type="button" className="spt-btn" onClick={() => navigate('/dynasty/song')}>
          ← 回宋时间轴
        </button>
        <h1 className="spt-title">{parallelTitle}</h1>
        <span className="spt-period">{parallelPeriod}</span>
        <span className="spt-count">
          宋 {SONG_EMPERORS.length} 帝 · 辽 {parallelRulersByPolity.get('p_liao')?.length ?? 0} 帝 · 西夏{' '}
          {parallelRulersByPolity.get('p_xixia')?.length ?? 0} 帝 · 金 {parallelRulersByPolity.get('p_jin')?.length ?? 0} 帝
          · 第 {pageIndex + 1} / {parallelPages.length} 页
        </span>
        <span className="spt-hint">滚轮 / ← → 翻页 · 点卡片看档案 · ESC 返回</span>
      </header>

      <div className="spt-axis">
        {yticks.map((year) => (
          <span key={year} className="spt-tick" style={{ left: pos(year) }}>
            <em>{year}</em>
          </span>
        ))}
      </div>

      <div className="spt-stage">
        <div
          className="spt-rows"
          style={{ gridTemplateRows: `1.5fr repeat(${Math.max(parallelRows.length - 1, 1)}, 1fr)` }}
        >
          {parallelRows.map((row, rowIndex) => {
            const isSong = row.kind === 'dynasty'
            const polity = parallelPolities.find((p) => p.row === row.id)
            const rulers = rulerCards.get(row.id) ?? []
            return (
              <div key={row.id} className="spt-row" data-kind={row.kind}>
                <div className="spt-label" style={{ borderColor: row.accent }}>
                  <span className="spt-label-name" style={{ color: row.accent }}>
                    {row.name}
                  </span>
                  <span className="spt-label-note">{row.note}</span>
                </div>
                <div className="spt-lane" ref={rowIndex === 0 ? laneRef : undefined}>
                  {polity && polity.start < page.to && polity.end > page.from ? (
                    <div
                      className="spt-band"
                      style={{
                        left: pos(Math.max(polity.start, page.from)),
                        width: clampWidth(polity.start, polity.end),
                        borderColor: row.accent,
                      }}
                      aria-hidden="true"
                    />
                  ) : null}

                  {/* 宋行：北宋 / 南宋 的分段色带（贴在行底那 16px 里，不压卡片） */}
                  {isSong ? (
                    <div className="spt-segs" aria-hidden="true">
                      {SONG_SEGMENTS.map((seg) => {
                        const from = Math.max(seg.startYear, page.from)
                        const to = Math.min(seg.endYear, page.to)
                        if (to <= from) return null
                        const width = clampWidth(from, to)
                        return (
                          <div key={seg.id} className="spt-seg" style={{ left: pos(from), width, color: seg.accent }}>
                            <span className="spt-seg-wash" />
                            <span className="spt-seg-line" />
                            <span className="spt-seg-name">
                              {width >= 150
                                ? `${seg.name} ${seg.startYear}—${seg.endYear}`
                                : width >= 56
                                  ? seg.name
                                  : ''}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  ) : null}
                  {isSong
                    ? SONG_SEG_BREAKS.filter((y) => y > page.from && y < page.to).map((y) => (
                        <span key={y} className="spt-seg-cut" style={{ left: pos(y) }} aria-hidden="true" />
                      ))
                    : null}

                  {isSong
                    ? songCards.map((e) => (
                        <div key={e.id} className="spt-slot" style={{ left: e.left }}>
                          <article
                            className={`spt-card is-emperor ${evalClass(e.evaluation)}`}
                            role="button"
                            tabIndex={0}
                            aria-label={`打开${e.posthumousTitle}的历史档案`}
                            onClick={() => {
                              const entry = getEntryBySource(e.id)
                              if (entry) openEntry(entry.id)
                            }}
                            onKeyDown={(event) => {
                              if (event.key !== 'Enter' && event.key !== ' ') return
                              event.preventDefault()
                              const entry = getEntryBySource(e.id)
                              if (entry) openEntry(entry.id)
                            }}
                          >
                            <span className="spt-card-title">{e.posthumousTitle}</span>
                            <span className="spt-card-name">{e.personalName}</span>
                            <span className="spt-card-reign">{e.reign}</span>
                          </article>
                        </div>
                      ))
                    : rulers.map((r) => (
                        <div key={r.id} className="spt-slot" style={{ left: r.left }}>
                          <RulerCard
                            title={r.title}
                            name={r.name}
                            reign={r.reign}
                            evaluation={r.evaluation}
                            onOpen={() => {
                              const entry = getEntryBySource(r.id)
                              if (entry) openEntry(entry.id)
                            }}
                          />
                        </div>
                      ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {nodeIndex.length ? (
        <footer className="spt-nodes">
          <span className="spt-nodes-label">大事索引</span>
          <div className="spt-nodes-rail">
            {nodeIndex.map((n) => {
              const current = n.pageIndex === pageIndex
              return (
                <button
                  key={`${n.year}-${n.title}`}
                  type="button"
                  className={`spt-node${current ? ' is-current' : ''}`}
                  aria-current={current ? 'true' : undefined}
                  aria-label={`跳到第 ${n.pageIndex + 1} 页：${n.year} ${n.title}`}
                  title={n.subtitle ?? n.title}
                  onClick={() => jumpToYear(n.year)}
                >
                  <em>{n.year}</em>
                  {n.title}
                </button>
              )
            })}
          </div>
        </footer>
      ) : null}

      <div className="spt-foot">
        <span className="spt-alive">
          {alive.join(' · ')} 并立
        </span>
        <div className="spt-pager">
          <button
            type="button"
            className="spt-btn"
            disabled={pageIndex === 0}
            onClick={() => changePage(Math.max(0, pageIndex - 1))}
          >
            ← 上一页
          </button>
          <button
            type="button"
            className="spt-btn"
            disabled={pageIndex === parallelPages.length - 1}
            onClick={() => changePage(Math.min(parallelPages.length - 1, pageIndex + 1))}
          >
            下一页 →
          </button>
        </div>
      </div>
    </div>
  )
}
