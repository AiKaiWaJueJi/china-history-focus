/**
 * FocusHud —— 焦点导航条
 * ---------------------------------------------------------------------------
 * 展示状态机的完整轨迹（history + 当前站），并提供 BACK / RESET 两个出口。
 * 这是"状态可观测性"的落点：把内部 focusLevel/selectedId 可视化，
 * 便于调试，也让用户随时知道自己在第几层、怎么回去。
 */
import { getEntityLabel, getEntitySubtitle } from '../../data'
import { LEVEL_META } from '../../lib/motion/tokens'
import {
  useCanGoBack,
  useFocusLevel,
  useFocusStore,
  useSelectedId,
} from '../../store/useFocusStore'



export function FocusHud() {
  const focusLevel = useFocusLevel()
  const selectedId = useSelectedId()
  const history = useFocusStore((s) => s.history)
  const back = useFocusStore((s) => s.back)
  const reset = useFocusStore((s) => s.reset)
  const canGoBack = useCanGoBack()

  const trail = [...history, ...(selectedId ? [{ level: focusLevel, id: selectedId }] : [])]

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      {/* 焦点路径：祖先层级淡显，当前站高亮 */}
      <nav aria-label="焦点路径" className="flex flex-wrap items-center gap-1.5">
        {trail.length === 0 ? (
          <span className="font-mono text-[11px] text-zinc-600">未选中 · 焦点在朝代层</span>
        ) : (
          trail.map((stop, index) => {
            const isCurrent = index === trail.length - 1
            return (
              <span key={`${stop.level}:${stop.id}`} className="flex items-center gap-1.5">
                {index > 0 ? (
                  <span aria-hidden="true" className="text-zinc-700">
                    /
                  </span>
                ) : null}
                <span
                  title={`${LEVEL_META[stop.level].name} · ${getEntitySubtitle(stop.level, stop.id)}`}
                  className={`rounded-md border px-2 py-0.5 text-[11.5px] transition-colors ${
                    isCurrent
                      ? 'border-gold/40 bg-gold/10 text-gold-soft'
                      : 'border-white/[0.06] bg-white/[0.02] text-zinc-500'
                  }`}
                >
                  <span className="mr-1 font-mono text-[9px] uppercase tracking-widest opacity-60">
                    {LEVEL_META[stop.level].name}
                  </span>
                  {getEntityLabel(stop.level, stop.id)}
                </span>
              </span>
            )
          })
        )}
      </nav>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={back}
          disabled={!canGoBack}
          className="rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11.5px] text-zinc-300 transition-colors enabled:hover:border-gold/40 enabled:hover:text-gold-soft disabled:cursor-not-allowed disabled:opacity-35"
        >
          ← 返回
        </button>
        <button
          type="button"
          onClick={reset}
          className="rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11.5px] text-zinc-300 transition-colors hover:border-gold/40 hover:text-gold-soft"
        >
          复位
        </button>
      </div>
    </div>
  )
}
