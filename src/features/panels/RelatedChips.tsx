/**
 * RelatedChips —— 跨层跃迁芯片
 * ---------------------------------------------------------------------------
 * 存在的理由：背景容器的 pointer-events 必须是 none（需求明确要求），
 * 因此用户**无法点击被虚化的面板**去进入下一层。
 * 为了让"逐层钻取"仍然成立，当前焦点面板必须在内部提供通往下一层的入口，
 * 这组芯片就是该入口：点击即派发 FOCUS(目标层级, 目标ID)。
 */
import type { FocusLevel } from '../../core/types'
import { getEntityLabel, getEntitySubtitle } from '../../data'
import { useFocusStore } from '../../store/useFocusStore'

const CHIP_HINT: Record<FocusLevel, string> = {
  dynasty: '前往朝代',
  emperor: '聚焦帝王',
  event: '展开史事',
  character: '追踪人物',
}

interface RelatedChipsProps {
  level: FocusLevel
  ids: string[]
  /** 无候选时的占位提示（例如"先选择一个朝代"） */
  hint: string
}

export function RelatedChips({ level, ids, hint }: RelatedChipsProps) {
  const focus = useFocusStore((s) => s.focus)

  if (ids.length === 0) {
    return <p className="text-[11px] leading-relaxed text-zinc-600">{hint}</p>
  }

  return (
    <div>
      <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.22em] text-zinc-600">
        {CHIP_HINT[level]}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {ids.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => focus(level, id)}
            title={getEntitySubtitle(level, id)}
            className="group inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11.5px] text-zinc-300 transition-colors duration-200 hover:border-gold/40 hover:bg-gold/10 hover:text-gold-soft"
          >
            {getEntityLabel(level, id)}
            <span
              aria-hidden="true"
              className="text-zinc-600 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-gold-soft"
            >
              →
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
