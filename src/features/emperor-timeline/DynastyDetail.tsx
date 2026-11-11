/**
 * DynastyDetail —— 阶段二独立页面：某朝代的帝王时间轴
 * ===========================================================================
 * 隔离原则：
 *   · 本文件与 features/emperor-timeline/* 全部新建，不改动阶段一的
 *     DynastyGallery / DynastyPanel / squeezeLayout 任何一行；
 *   · 页面只依赖 `dynastyById`（读朝代基本信息）与 `getDynastyEmperors`（读帝王数据）；
 *   · 入口由路由 /dynasty/:dynastyId 提供，阶段一主页的点击通过
 *     store.openDynasty → navigateTo 完成跳转（store 里只加了一行）。
 *
 * 交互：
 *   · 全局 wheel（带冷却）翻页，一页 3 位帝王，AnimatePresence 横向滑动；
 *   · 悬浮某位帝王：该模块聚焦、其余变暗，并上下延伸出事件浮层。
 */
import { useCallback, useMemo, useState } from 'react'
import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { dynastyById } from '../../data'
import { getDynastyEmperors } from '../../data/zhouEmperors'
import { EmperorPager } from './EmperorPager'
import { useWheelPaging } from './useWheelPaging'
import './emperor-timeline.css'

const PAGE_SIZE = 3

export function DynastyDetail() {
  const { dynastyId } = useParams<{ dynastyId: string }>()
  const navigate = useNavigate()

  const dynasty = dynastyId ? dynastyById.get(dynastyId) : undefined
  const data = getDynastyEmperors(dynastyId)

  const [pageIndex, setPageIndex] = useState(0)
  const [direction, setDirection] = useState(1)

  const pageCount = data ? Math.ceil(data.emperors.length / PAGE_SIZE) : 0

  const handleChange = useCallback((next: number) => {
    setPageIndex((current) => {
      setDirection(next >= current ? 1 : -1)
      return next
    })
  }, [])

  const { canPrev, canNext } = useWheelPaging({
    pageCount,
    pageIndex,
    onChange: handleChange,
  })

  // ESC 返回主页；切换朝代时重置页码
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

  const emperors = useMemo(() => data?.emperors ?? [], [data])

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

      <div className="timeline-stage">
        {emperors.length === 0 ? (
          <div className="timeline-empty">
            <p className="timeline-empty-text">
              「{dynasty.name}」的帝王数据尚未导入
            </p>
            <p className="timeline-empty-sub">
              阶段二目前只提供「周」作为样例，其余朝代将在批量导入后开放
            </p>
          </div>
        ) : (
          <EmperorPager
            emperors={emperors}
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
          <button
            type="button"
            className="timeline-btn"
            disabled={!canNext}
            onClick={() => handleChange(Math.min(pageCount - 1, pageIndex + 1))}
          >
            下一页 →
          </button>
        </div>
      </footer>
    </div>
  )
}
