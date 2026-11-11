/**
 * PhaseStub —— 视图2 / 视图3 的阶段占位
 * ---------------------------------------------------------------------------
 * 阶段一只交付视图1。但"点击朝代"后必须有反馈，否则无法验证状态机真的在工作。
 * 这里用极简占位承接视图2，既证明跳转链路通，又不假装已经做完。
 * 阶段二会用真正的帝王时间轴替换它。
 */
import { dynastyById } from '../../data'
import { useAppStore } from '../../store/useAppStore'

export function PhaseStub() {
  const dynastyId = useAppStore((s) => s.dynastyId)
  const back = useAppStore((s) => s.back)
  const dynasty = dynastyId ? dynastyById.get(dynastyId) : null

  return (
    <div className="phase-stub">
      <p className="app-sub">VIEW 2 / 帝王时间轴</p>
      <h2 className="phase-stub-title" style={{ color: dynasty?.accentSoft ?? '#f2ece0' }}>
        {dynasty?.name ?? '—'}
      </h2>
      <p className="phase-stub-desc">
        {dynasty?.period} · 共 {dynasty?.emperorIds.length ?? 0} 位帝王
      </p>
      <p className="phase-stub-desc" style={{ opacity: 0.65, fontSize: 12 }}>
        帝王横向时间轴将在阶段二交付
      </p>
      <button type="button" className="phase-stub-btn" onClick={back}>
        ← 返回朝代主页（ESC）
      </button>
    </div>
  )
}
