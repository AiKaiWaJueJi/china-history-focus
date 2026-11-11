/**
 * App —— 应用外壳
 * ---------------------------------------------------------------------------
 * 只做三件事：标题区、舞台、键盘绑定。
 * 键盘映射直接映射到状态机事件（Esc → BACK，R → RESET），
 * 因为状态机是唯一真相来源，快捷键无需任何额外状态。
 */
import { useEffect } from 'react'
import { FocusHud } from './features/hud/FocusHud'
import { FocusStage } from './features/stage/FocusStage'
import { useFocusStore } from './store/useFocusStore'

export default function App() {
  const back = useFocusStore((s) => s.back)
  const reset = useFocusStore((s) => s.reset)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // 输入框内不劫持按键（为阶段 2 的编辑功能预留）
      const target = event.target as HTMLElement | null
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return

      if (event.key === 'Escape') {
        event.preventDefault()
        back()
        return
      }
      if ((event.key === 'r' || event.key === 'R') && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault()
        reset()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [back, reset])

  return (
    <div className="flex h-screen min-h-0 flex-col overflow-hidden bg-ink-950">
      {/* 顶部：标题 + 焦点导航 */}
      <header className="shrink-0 border-b border-white/[0.06] px-5 py-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-baseline gap-3">
            <h1 className="font-serif text-[17px] tracking-[0.18em] text-zinc-100">
              中国历史 · 多维学习
            </h1>
            <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-gold-dim">
              focus engine / phase 1
            </span>
          </div>
          <FocusHud />
        </div>
      </header>

      {/* 舞台：四块容器常驻，焦点由状态机决定 */}
      <main className="min-h-0 flex-1">
        <FocusStage />
      </main>

      {/* 底部：操作提示 */}
      <footer className="shrink-0 border-t border-white/[0.06] px-5 py-2">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[10px] text-zinc-600">
          <span>ESC 返回上一层</span>
          <span>R 复位</span>
          <span>底部芯片 = 向下一层聚焦</span>
          <span className="text-zinc-700">
            焦点层 opacity 1 / blur 0 / scale 1.10 · 背景层 0.4 / 8px / 0.95
          </span>
        </div>
      </footer>
    </div>
  )
}
