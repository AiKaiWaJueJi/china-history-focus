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
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom'
import { DynastyGallery } from './features/gallery/DynastyGallery'
import { DynastyDetail } from './features/emperor-timeline/DynastyDetail'
import { NanBeiTimeline } from './features/emperor-timeline/NanBeiTimeline'
import { WuDaiTimeline } from './features/emperor-timeline/WuDaiTimeline'
import { EndgameStage } from './features/endgame/EndgameStage'
import { JinChronicleStage } from './features/endgame/JinChronicleStage'
import { FallStage } from './features/fall/FallStage'
import { CodexDrawer } from './features/codex/CodexDrawer'
import { CodexIndex } from './features/codex/CodexIndex'
import { RouterBridge } from './router/RouterBridge'
import { ErrorBoundary } from './lib/ErrorBoundary'
import { useCodexStore } from './store/useCodexStore'

/** 南北朝、五代十国都是多行并行时间轴，不复用单行帝王分页 */
function DynastyRoute() {
  const { dynastyId } = useParams<{ dynastyId: string }>()
  if (dynastyId === 'southern_northern') return <NanBeiTimeline />
  if (dynastyId === 'five_dynasties') return <WuDaiTimeline />
  return <DynastyDetail />
}

/** 晋末用「十六国势力变迁图」，不是灭国战沙盘，单独分流 */
function EndgameRoute() {
  const { dynastyId } = useParams<{ dynastyId: string }>()
  if (dynastyId === 'jin') return <JinChronicleStage />
  return <EndgameStage />
}

function Shell() {
  const location = useLocation()
  const atGallery = location.pathname === '/'
  const atCodex = location.pathname === '/codex'
  /*
    顶栏的两行小字要跟着页面走：
    过渡页与沙盘的 ESC 只退到本朝时间轴（过渡页还会先弹确认），
    早先所有页都写「ESC 返回朝代主页」，是把用户往沟里带。
  */
  const phase = atCodex
    ? 'codex index'
    : /\/fall(\/|$)/.test(location.pathname)
      ? 'fall / transition'
      : /\/endgame$/.test(location.pathname)
        ? 'endgame / sandbox'
        : atGallery
          ? 'dynasty gallery / phase 1'
          : 'emperor timeline / phase 2'
  const hint = atCodex
    ? '输入即检索 · ESC 先清空再返回主页'
    : atGallery
      ? '悬停查看挤压 · 点击进入朝代'
      : phase === 'fall / transition'
        ? 'ESC 返回帝王时间轴（先确认）'
        : phase === 'endgame / sandbox'
          ? 'ESC 返回帝王时间轴'
          : 'ESC 返回朝代主页'

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
    <>
      <div className="app-shell">
      <header className="app-bar">
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
          <h1 className="app-title">中国历史 · 多维学习</h1>
          <span className="app-sub">{phase}</span>
        </div>
        <span className="app-hint">
          <Link className="app-nav" to="/codex">
            档案总目
          </Link>
          {hint}
        </span>
      </header>

      <main className="app-main">
        {/* 页面级兜底：某一页 render 抛错时，只牺牲这一页，顶栏与抽屉仍在；
            key 用路径，换页即自动重挂（不需要用户手动点重试） */}
        <ErrorBoundary key={location.pathname} scope="当前页面">
          <Routes>
            <Route path="/" element={<DynastyGallery />} />
            <Route path="/dynasty/:dynastyId" element={<DynastyRoute />} />
            <Route path="/dynasty/:dynastyId/fall/:chapter?" element={<FallStage />} />
            <Route path="/dynasty/:dynastyId/endgame" element={<EndgameRoute />} />
            <Route path="/codex" element={<CodexIndex />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ErrorBoundary>
      </main>
      </div>

      {/* 历史档案抽屉：浮在任意页面之上，压暗 .app-shell 但不遮黑 */}
      <ErrorBoundary
        scope="历史档案"
        resetLabel="关闭档案"
        floating
        onReset={() => useCodexStore.getState().close()}
      >
        <CodexDrawer />
      </ErrorBoundary>
    </>
  )
}

// GitHub Pages 部署在 /<repo>/ 子路径下，BrowserRouter 必须知道这个前缀，
// 否则 /china-history-focus/dynasty/tang 匹配不上 /dynasty/:dynastyId 这条路由。
// dev 时 BASE_URL 是 '/'，去掉尾斜杠后为空字符串，退回 undefined（即根路径）。
const BASENAME = import.meta.env.BASE_URL.replace(/\/+$/, '')

export default function App() {
  return (
    <BrowserRouter basename={BASENAME || undefined}>
      <RouterBridge />
      <Shell />
    </BrowserRouter>
  )
}
