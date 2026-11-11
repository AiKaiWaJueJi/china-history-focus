/**
 * App —— 应用外壳
 * ---------------------------------------------------------------------------
 * 只做视图分发与全局快捷键。视图切换由状态机决定，这里不做任何"猜测"。
 */
import { useEffect } from 'react'
import { DynastyGallery } from './features/gallery/DynastyGallery'
import { PhaseStub } from './features/phase-stub/PhaseStub'
import { useAppStore, useView } from './store/useAppStore'

export default function App() {
  const view = useView()
  const back = useAppStore((s) => s.back)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // 输入态不劫持（为阶段二的编辑功能预留）
      const target = event.target as HTMLElement | null
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return
      if (event.key === 'Escape') {
        event.preventDefault()
        back()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [back])

  return (
    <div className="app-shell">
      <header className="app-bar">
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
          <h1 className="app-title">中国历史 · 多维学习</h1>
          <span className="app-sub">dynasty gallery / phase 1</span>
        </div>
        <span className="app-hint">
          {view === 'gallery' ? '悬停查看挤压 · 点击进入朝代' : 'ESC 返回'}
        </span>
      </header>

      <main className="app-main">
        {view === 'gallery' ? <DynastyGallery /> : <PhaseStub />}
      </main>
    </div>
  )
}
