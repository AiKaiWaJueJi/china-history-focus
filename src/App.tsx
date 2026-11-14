/**
 * App —— 应用外壳与路由
 * ---------------------------------------------------------------------------
 * 阶段二引入了真正的路由：
 *   /                     朝代主页（视图1，代码未改动）
 *   /dynasty/:dynastyId   帝王时间轴（视图2，本阶段新增的独立页面）
 *
 * 阶段一的主页组件依然通过 store.openDynasty(id) 触发跳转，
 * 由 store 内部调用 navigateTo 完成导航（见 store/useAppStore.ts），
 * 因此 DynastyGallery / DynastyPanel 一行都没改。
 */
import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom'
import { DynastyGallery } from './features/gallery/DynastyGallery'
import { DynastyDetail } from './features/emperor-timeline/DynastyDetail'
import { NanBeiTimeline } from './features/emperor-timeline/NanBeiTimeline'
import { EndgameStage } from './features/endgame/EndgameStage'
import { JinChronicleStage } from './features/endgame/JinChronicleStage'
import { NanBeiEndStage } from './features/endgame/NanBeiEndStage'
import { FallStage } from './features/fall/FallStage'
import { RouterBridge } from './router/RouterBridge'

/** 南北朝是四行并行时间轴，不复用单行帝王分页 */
function DynastyRoute() {
  const { dynastyId } = useParams<{ dynastyId: string }>()
  return dynastyId === 'southern_northern' ? <NanBeiTimeline /> : <DynastyDetail />
}

/** 晋末用「十六国势力变迁图」，不是灭国战沙盘，单独分流 */
function EndgameRoute() {
  const { dynastyId } = useParams<{ dynastyId: string }>()
  if (dynastyId === 'jin') return <JinChronicleStage />
  if (dynastyId === 'southern_northern') return <NanBeiEndStage />
  return <EndgameStage />
}

function Shell() {
  const location = useLocation()
  const atGallery = location.pathname === '/'

  // 主页侧只保留 R 复位；详情页的 ESC 由 DynastyDetail 自己处理
  useEffect(() => {
    if (!atGallery) return
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return
      if ((event.key === 'r' || event.key === 'R') && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [atGallery])

  return (
    <div className="app-shell">
      <header className="app-bar">
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
          <h1 className="app-title">中国历史 · 多维学习</h1>
          <span className="app-sub">
            {atGallery ? 'dynasty gallery / phase 1' : 'emperor timeline / phase 2'}
          </span>
        </div>
        <span className="app-hint">
          {atGallery ? '悬停查看挤压 · 点击进入朝代' : 'ESC 返回朝代主页'}
        </span>
      </header>

      <main className="app-main">
        <Routes>
          <Route path="/" element={<DynastyGallery />} />
          <Route path="/dynasty/:dynastyId" element={<DynastyRoute />} />
          <Route path="/dynasty/:dynastyId/fall/:chapter?" element={<FallStage />} />
          <Route path="/dynasty/:dynastyId/endgame" element={<EndgameRoute />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <RouterBridge />
      <Shell />
    </BrowserRouter>
  )
}
