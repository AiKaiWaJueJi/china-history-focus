/**
 * LordsRow —— 诸侯层（春秋五霸 / 战国七雄）
 * ===========================================================================
 * 一屏横向排布 5-7 个诸侯卡片，悬浮时该卡片放大、其余收窄（挤压效果），
 * 与阶段一"朝代主页"的交互语言保持一致，用户不需要重新学习。
 *
 * 用 flex-grow 而不是固定宽度：卡片数量会随时代变化（5 或 7），
 * 让 flex 自己分配宽度，比在 JS 里算百分比更稳。
 */
import type { Lord } from '../../core/emperorTypes'
import { LordCard } from './LordCard'

interface LordsRowProps {
  lords: Lord[]
  era: string
}

export function LordsRow({ lords, era }: LordsRowProps) {
  if (lords.length === 0) return null

  return (
    <section className="lords-block" aria-label={`诸侯 · ${era}`}>
      <header className="lords-head">
        <span className="lords-title">诸侯 · {era}</span>
        <span className="lords-count">{lords.length} 国并立</span>
        <span className="lords-hint">悬停查看事迹</span>
      </header>

      <div className="lords-row">
        {lords.map((lord) => (
          <LordCard key={lord.id} lord={lord} />
        ))}
      </div>
    </section>
  )
}
