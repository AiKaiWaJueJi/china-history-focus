/**
 * LordsRow —— 诸侯层（随天子翻页动态增删）
 * ===========================================================================
 * 与上一版的区别：诸侯不再是"整个春秋/战国的固定名单"，
 * 而是由 DynastyDetail 用「在任区间 ∩ 当前页时间窗」筛出来的**当期在任诸侯**。
 * 于是翻页时诸侯会真实地增减，形成"此刻谁在称霸"的联动记忆。
 *
 * 布局稳定性：固定 3 个卡位。当期只有 1-2 家时用虚线空槽补齐，
 * 保证每页的卡片宽度一致，挤压动画的手感不会因数量变化而漂移。
 */
import type { Lord } from '../../core/emperorTypes'
import { LordCard } from './LordCard'

/** 一屏最多展示的诸侯数量（超出时按"在本页停留更久"取前三位） */
const SLOT_COUNT = 3

interface LordsRowProps {
  lords: Lord[]
}

export function LordsRow({ lords }: LordsRowProps) {
  const visible = lords.slice(0, SLOT_COUNT)
  const overflow = lords.length - visible.length
  const emptySlots = SLOT_COUNT - visible.length

  return (
    <section className="lords-block" aria-label="本期在任诸侯">
      <header className="lords-head">
        <span className="lords-title">诸侯</span>
        <span className="lords-count">
          {lords.length === 0 ? '本期无人称霸' : `本期在任 ${lords.length} 国`}
          {overflow > 0 ? ` · 另有 ${overflow} 国` : ''}
        </span>
        <span className="lords-hint">悬停查看事迹</span>
      </header>

      {visible.length === 0 ? (
        <div className="lords-empty">
          <span className="lords-empty-text">王室虽衰，诸侯未霸</span>
        </div>
      ) : (
        <div className="lords-row">
          {visible.map((lord) => (
            <LordCard key={lord.id} lord={lord} />
          ))}
          {Array.from({ length: emptySlots }, (_, i) => (
            <div key={`lord-slot-${i}`} className="lord-slot" aria-hidden="true" />
          ))}
        </div>
      )}
    </section>
  )
}
