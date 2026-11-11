/**
 * EntityRow —— 面板内的实体行
 * ---------------------------------------------------------------------------
 * 刻意做成"受控纯展示组件"：不自己读 store、不自己派发事件，
 * 点击行为由父级面板决定。这样阶段 2 加入编辑/拖拽时，只需在外层包一层，
 * 不必改动行的内部实现。
 */
interface EntityRowProps {
  title: string
  subtitle: string
  summary?: string
  /** 左侧色条（朝代主题色） */
  accent?: string
  selected?: boolean
  onClick: () => void
}

export function EntityRow({ title, subtitle, summary, accent, selected, onClick }: EntityRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`group relative w-full overflow-hidden rounded-xl border px-3 py-2.5 text-left transition-colors duration-200 ${
        selected
          ? 'border-gold/45 bg-gold/[0.07]'
          : 'border-white/[0.05] bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.045]'
      }`}
    >
      {accent ? (
        <span
          aria-hidden="true"
          className="absolute inset-y-0 left-0 w-[3px] opacity-80"
          style={{ backgroundColor: accent }}
        />
      ) : null}

      <div className="flex items-baseline justify-between gap-2 pl-1.5">
        <span className="font-serif text-[15px] text-zinc-100">{title}</span>
        <span className="shrink-0 font-mono text-[10px] text-zinc-500">{subtitle}</span>
      </div>

      {summary ? (
        <p className="mt-1 line-clamp-2 pl-1.5 text-[11.5px] leading-relaxed text-zinc-400/80">
          {summary}
        </p>
      ) : null}
    </button>
  )
}
