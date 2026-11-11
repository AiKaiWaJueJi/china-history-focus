/**
 * PanelShell —— 面板外壳（标题 / 计数 / 焦点指示灯 / 可滚动主体 / 底部关联区）
 * ---------------------------------------------------------------------------
 * 四块容器共用同一外壳，保证视觉与结构一致；差异只体现在传入的数据列表上。
 */
import type { ReactNode } from 'react'
import type { FocusLevel } from '../../core/types'
import { LEVEL_META } from '../../lib/motion/tokens'
import { useIsFocused } from '../../store/useFocusStore'

interface PanelShellProps {
  level: FocusLevel
  title: string
  caption: string
  count: number
  children: ReactNode
  footer?: ReactNode
}

export function PanelShell({ level, title, caption, count, children, footer }: PanelShellProps) {
  const isFocused = useIsFocused(level)

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-white/[0.06] bg-gradient-to-b from-ink-800/95 via-ink-850/96 to-ink-900/[0.98] shadow-panel">
      <header className="relative shrink-0 border-b border-white/[0.06] px-5 pb-3.5 pt-4">
        <div className="flex items-center justify-between gap-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.32em] text-gold-dim">
            {`L${LEVEL_META[level].index} · ${LEVEL_META[level].name}`}
          </span>
          <span className="flex items-center gap-2">
            {/* 焦点指示灯：本层被对焦时亮起，提供除缩放/虚化之外的冗余状态提示 */}
            <span
              aria-hidden="true"
              className={`h-1.5 w-1.5 rounded-full transition-colors duration-300 ${
                isFocused ? 'bg-gold shadow-[0_0_8px_2px_rgba(201,162,39,0.55)]' : 'bg-zinc-700'
              }`}
            />
            <span className="rounded-full border border-white/10 px-2 py-0.5 font-mono text-[10px] text-zinc-500">
              {count}
            </span>
          </span>
        </div>
        <h2 className="mt-1.5 font-serif text-[17px] tracking-wide text-zinc-100">{title}</h2>
        <p className="mt-0.5 text-[11px] text-zinc-500">{caption}</p>
      </header>

      <div className="panel-scroll min-h-0 flex-1 overflow-y-auto px-2.5 py-2.5">{children}</div>

      {footer ? <div className="shrink-0 border-t border-white/[0.06] px-4 py-3">{footer}</div> : null}
    </div>
  )
}
