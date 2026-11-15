/**
 * DynastyDetail —— 阶段二独立页面：某朝代的帝王时间轴
 * ===========================================================================
 * 三层结构：
 *   SegmentAxis      时代分段轴（西周 / 东周，含春秋、战国标志点）
 *   timeline-stage   按当前页所属分段切换布局
 *     single         单层：只有天子（3 卡一页）
 *     dual           双层：天子层（紧凑）+ 诸侯层（春秋五霸 / 战国七雄）
 *
 * 隔离原则：本文件与 features/emperor-timeline/* 全部独立，
 * 不改动阶段一（DynastyGallery / DynastyPanel / squeezeLayout）。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import type { EmperorRecord } from '../../core/emperorTypes'
import { dynastyById } from '../../data'
import {
  getDynastyEmperors,
  getDynastyLords,
  getDynastySegments,
  hasDynastyClosing,
  getDynastyClosingLabel,
} from '../../data/emperorData'
import { EmperorPager } from './EmperorPager'
import { LordsRow } from './LordsRow'
import { SegmentAxis } from './SegmentAxis'
import { useWheelPaging } from './useWheelPaging'
import './emperor-timeline.css'

const PAGE_SIZE = 3

/**
 * 段间插叙：进入某个分段之前，先走一屏过渡页。
 * ---------------------------------------------------------------------------
 * key1 = dynastyId，key2 = 目标分段的 segmentId。
 * 触发点不写死页码，而是由「该分段第一位君主所在的页」倒推上一页 ——
 * 将来增删君主、改动 PAGE_SIZE 都不会错位。
 */
const SEGMENT_INTROS: Record<string, Record<string, { chapter: string; label: string }>> = {
  zhou: { seg_dongzhou: { chapter: 'dongqian', label: '平王东迁' } },
  han: {
    seg_xin: { chapter: 'xin', label: '王莽篡漢' },
    seg_donghan: { chapter: 'zhongxing', label: '光武中兴' },
  },
  jin: {
    seg_dongjin: { chapter: 'yongjia', label: '衣冠南渡' },
  },
  /*
    以下三朝的分段界正好是「改朝换代」处，按周秦汉晋同一套规矩裁剪并插过渡页：
      唐  690 革唐为周（武周）→ 705 复国号唐（神龙）
      宋  1127 靖康之变，北宋亡、南宋再造（与「平王东迁」同型：亡国 + 南迁）
      清  1643 世祖入关、1644 定鼎燕京（后金 → 大清治中国）
    隋、元、明 的分段只是年号/时势分期（开皇—大业、元初—守成—内乱—元末、洪武—建文永乐…），
    不是国号更易，故不插过渡页——与「秦只有一段、没有段间过渡」同一口径。
  */
  tang: {
    seg_wuzhou: { chapter: 'wuzhou', label: '武周革命' },
    seg_shengtang: { chapter: 'shenlong', label: '神龙复唐' },
  },
  song: {
    seg_nansong: { chapter: 'jingkang', label: '靖康之变' },
  },
  qing: {
    seg_ruquan: { chapter: 'ruquan', label: '入关定鼎' },
  },
}

interface IntroGate {
  /** 触发页：在这一页继续下滚就进过渡页 */
  page: number
  chapter: string
  label: string
}

export function DynastyDetail() {
  const { dynastyId } = useParams<{ dynastyId: string }>()
  const navigate = useNavigate()
  const location = useLocation()

  const dynasty = dynastyId ? dynastyById.get(dynastyId) : undefined
  const data = getDynastyEmperors(dynastyId)
  const segmentsData = getDynastySegments(dynastyId)
  const lordsData = getDynastyLords(dynastyId)
  /** 有没有收尾（沙盘或过渡页）——秦这类没有沙盘的朝代，也要能进过渡页 */
  const hasClosing = hasDynastyClosing(dynastyId)
  const closingLabel = getDynastyClosingLabel(dynastyId)

  const [pageIndex, setPageIndex] = useState(0)
  const [direction, setDirection] = useState(1)

  const emperors = useMemo(() => data?.emperors ?? [], [data])
  const segments = segmentsData?.segments ?? []
  const lords = lordsData?.lords ?? []

  /*
    分页按**分段**切：同一页绝不含两个时代的君主。
    段长不一定是 3 的倍数（新朝只有 1 位王莽），固定 3 张一排会把王莽
    和光武帝塞进同一页，段间过渡就失去了合法插入点。
    周（西周 12 / 东周 25）恰好都能被 3 整除，分页结果与旧版完全一致。
  */
  const pages = useMemo(() => {
    const out: EmperorRecord[][] = []
    let group: EmperorRecord[] = []
    let groupSeg: string | undefined
    const flush = () => {
      for (let i = 0; i < group.length; i += PAGE_SIZE) out.push(group.slice(i, i + PAGE_SIZE))
      group = []
    }
    for (const emperor of emperors) {
      if (groupSeg !== undefined && emperor.segmentId !== groupSeg) flush()
      groupSeg = emperor.segmentId
      group.push(emperor)
    }
    flush()
    return out
  }, [emperors])

  const pageCount = pages.length

  /** 帝王序号 → 所在页（跳年份用） */
  const pageOfEmperor = useCallback(
    (emperorIndex: number) => {
      let acc = 0
      for (let p = 0; p < pages.length; p++) {
        acc += pages[p].length
        if (emperorIndex < acc) return p
      }
      return Math.max(0, pages.length - 1)
    },
    [pages],
  )

  const handleChange = useCallback((next: number) => {
    setPageIndex((current) => {
      setDirection(next >= current ? 1 : -1)
      return next
    })
  }, [])

  /*
    越过最后一页 → 先进「周室倾覆」过渡页，而不是直接进沙盘。
    赧王卒于前 256，灭六国始于前 230，中间空了二十六年，
    这一段需要一屏把"天命转移"讲完，否则时间线是断的。

    另加 800ms 防抖：用户从上一页滑到末页时惯性还在，
    不设防会出现"还没看清赧王就被弹走"。
  */
  /* 每次换页都记时间：段末页与整表末页共用这一个防抖 */
  const pageAt = useRef(0)
  useEffect(() => {
    pageAt.current = performance.now()
  }, [pageIndex])

  const goFall = useCallback(() => {
    if (!dynastyId || !hasClosing) return
    if (performance.now() - pageAt.current < 800) return
    navigate(`/dynasty/${dynastyId}/fall`)
  }, [dynastyId, hasClosing, navigate])

  /*
    段间过渡的落点：目标分段第一位君主所在页的**上一页**就是触发页。
    分页按分段切，所以目标分段的首页一定以它的第一位君主开头。
    例：东周首位平王 → 页 4，触发页 3；汉：新朝页 4 / 东汉页 5，触发页 3 / 4。
    一个朝代可以有多处段间过渡（如汉有两处），因此这里返回的是列表。
  */
  const introGates = useMemo<IntroGate[]>(() => {
    if (!dynastyId) return []
    const map = SEGMENT_INTROS[dynastyId]
    if (!map) return []
    return Object.entries(map).flatMap(([segId, cfg]) => {
      const page = pages.findIndex((group) => group[0]?.segmentId === segId)
      return page > 0 ? [{ page: page - 1, chapter: cfg.chapter, label: cfg.label }] : []
    })
  }, [dynastyId, pages])

  /** 当前页如果正好是某个段末页，就是这一页的过渡入口 */
  const introGate = introGates.find((gate) => gate.page === pageIndex) ?? null

  const goIntro = useCallback(
    (gate: IntroGate) => {
      if (!dynastyId) return
      if (performance.now() - pageAt.current < 800) return
      navigate(`/dynasty/${dynastyId}/fall/${gate.chapter}`)
    },
    [dynastyId, navigate],
  )

  /* 段末页继续下滚 → 进过渡页，不翻到下一段 */
  const onLeavePage = useCallback(
    (from: number) => {
      const gate = introGates.find((item) => item.page === from)
      if (!gate) return false
      goIntro(gate)
      return true
    },
    [introGates, goIntro],
  )



  const { canPrev, canNext } = useWheelPaging({
    pageCount,
    pageIndex,
    onChange: handleChange,
    // 已在最后一页继续向下滚 → 直接进入终局推演
    onBeyondEnd: hasClosing ? goFall : undefined,
    onLeavePage,
  })

  // ESC 返回主页
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

  useEffect(() => {
    setPageIndex(0)
    setDirection(1)
  }, [dynastyId])

  /*
    从「王朝覆灭」向上滚回来时，要落在**最后一页**而不是第一页。
    用 location.state.page === 'last' 传递意图（不污染 URL，也不写进 store）。
  */
  useEffect(() => {
    if (pageCount === 0) return
    const target = (location.state as { page?: string | number } | null)?.page
    // 数字页码：过渡页回来时精确落到某一页（如平王东迁 → 东周首页 4）
    if (typeof target === 'number') {
      setPageIndex(Math.max(0, Math.min(target, pageCount - 1)))
      setDirection(1)
      return
    }
    if (target === 'last') {
      setPageIndex(pageCount - 1)
      setDirection(-1)
    }
  }, [location.state, pageCount])

  /* ---------------- 当前页所属分段 → 决定布局 ---------------- */
  const pageEmperors = pages[pageIndex] ?? []
  const pageSegmentId = pageEmperors[0]?.segmentId

  // 东周才出现"天子与诸侯并立"，并且需要真的有诸侯数据
  const isDual = pageSegmentId === 'seg_dongzhou' && lords.length > 0

  /*
    当前页的时间窗：从本页第一位君主的即位年，到本页最后一位君主的驾崩年。
    诸侯不再按"春秋/战国"整体筛选，而是**与该时间窗求交** ——
    这样翻页时诸侯会随天子更替动态增删，形成"此刻谁在称霸"的联动记忆。
  */
  const pageStartYear = pageEmperors[0]?.startYear ?? 0
  const pageEndYear = pageEmperors[pageEmperors.length - 1]?.endYear ?? pageStartYear

  const activeLords = useMemo(() => {
    if (lords.length === 0) return []
    return lords
      .map((lord) => ({
        lord,
        /*
          用**称霸期**求交，而不是在位期。
          齐桓公前685年即位，前679年鄄之会才始霸 —— 若用在位期，
          前685-前680 这几年会被误判成"齐桓称霸中"。
          区间交集长度：公元前为负数，相减仍得到正的持续年数。
        */
        overlap:
          Math.min(lord.hegemonyEnd, pageEndYear) - Math.max(lord.hegemonyStart, pageStartYear),
      }))
      .filter((item) => item.overlap > 0)
      // 在本页称霸更久的诸侯排前面
      .sort((a, b) => b.overlap - a.overlap)
      .map((item) => item.lord)
  }, [lords, pageStartYear, pageEndYear])

  /** 点击分段轴上的某一年 → 跳到包含该年（或其后的第一位君主）的那一页 */
  const jumpToYear = useCallback(
    (year: number) => {
      if (emperors.length === 0) return
      let index = emperors.findIndex((emperor) => emperor.startYear >= year)
      if (index < 0) index = emperors.length - 1
      handleChange(pageOfEmperor(index))
    },
    [emperors, pageOfEmperor, handleChange],
  )

  if (!dynasty) {
    return (
      <div className="timeline-page timeline-page--empty">
        <p className="timeline-empty-text">未找到该朝代</p>
        <button type="button" className="timeline-btn" onClick={() => navigate('/')}>
          ← 返回朝代主页
        </button>
      </div>
    )
  }

  return (
    <div className="timeline-page">
      <header className="timeline-head">
        <div className="timeline-head-left">
          <button type="button" className="timeline-btn" onClick={() => navigate('/')}>
            ← 返回
          </button>
          <h1 className="timeline-dynasty" style={{ color: dynasty.accentSoft }}>
            {dynasty.name}
          </h1>
          <span className="timeline-period">{dynasty.period}</span>
        </div>

        <div className="timeline-head-right">
          <span className="timeline-count">
            共 {emperors.length} 位帝王 · 第 {pageIndex + 1} / {Math.max(pageCount, 1)} 页
          </span>
          <span className="timeline-hint">滚轮 / ← → 翻页 · ESC 返回</span>
        </div>
      </header>

      {segments.length > 0 ? (
        <SegmentAxis
          segments={segments}
          currentPage={pageEmperors}
          onJumpToYear={jumpToYear}
        />
      ) : null}

      <div className="timeline-stage" data-layout={isDual ? 'dual' : 'single'}>
        {emperors.length === 0 ? (
          <div className="timeline-empty">
            <p className="timeline-empty-text">「{dynasty.name}」的帝王数据尚未导入</p>
            <p className="timeline-empty-sub">
              阶段二目前只提供「周」作为样例，其余朝代将在批量导入后开放
            </p>
          </div>
        ) : isDual ? (
          <>
            <div className="zhou-layer">
              <EmperorPager
                pageEmperors={pageEmperors}
                pageIndex={pageIndex}
                direction={direction}
                pageSize={PAGE_SIZE}
                layout="stacked-top"
                compact
              />
            </div>
            <LordsRow lords={activeLords} />
          </>
        ) : (
          <EmperorPager
            pageEmperors={pageEmperors}
            pageIndex={pageIndex}
            direction={direction}
            pageSize={PAGE_SIZE}
          />
        )}
      </div>

      <footer className="timeline-foot">
        <div className="timeline-progress">
          {Array.from({ length: pageCount }, (_, i) => (
            <button
              key={i}
              type="button"
              className={`timeline-dot${i === pageIndex ? ' is-active' : ''}`}
              aria-label={`第 ${i + 1} 页`}
              onClick={() => handleChange(i)}
            />
          ))}
        </div>
        <div className="timeline-step">
          <button
            type="button"
            className="timeline-btn"
            disabled={!canPrev}
            onClick={() => handleChange(Math.max(0, pageIndex - 1))}
          >
            ← 上一页
          </button>

          {/*
            末页不再放大按钮：入口已经改为"继续下滑"。
            这里只留一行小字，告诉用户下滑能进；键盘用户仍可点它。
          */}
          {introGate ? (
            <button
              type="button"
              className="timeline-btn timeline-btn--endgame"
              onClick={() => goIntro(introGate)}
            >
              继续下滑 · {introGate.label} ↓
            </button>
          ) : hasClosing && pageIndex === pageCount - 1 ? (
            <button type="button" className="timeline-btn timeline-btn--endgame" onClick={goFall}>
              继续下滑 · {closingLabel} ↓
            </button>
          ) : (
            <button
              type="button"
              className="timeline-btn"
              disabled={!canNext}
              onClick={() => handleChange(Math.min(pageCount - 1, pageIndex + 1))}
            >
              下一页 →
            </button>
          )}
        </div>
      </footer>
    </div>
  )
}
