/**
 * L3 · 史事面板
 * ---------------------------------------------------------------------------
 * 作用域收敛顺序（见 selectors.resolveEventScope）：
 *   选中帝王 → 该帝王参与的事件；选中人物 → 该人物参与的事件；否则按上下文朝代。
 * 点击事件 = 焦点推进到 event 层；底部芯片可跃迁到出场人物（多对多关联的体现）。
 */
import { resolveContextDynastyId, resolveEventScope, resolveOutboundLinks } from '../../core/selectors'
import { dynastyById, formatYear } from '../../data'
import { useFocusScope, useFocusStore } from '../../store/useFocusStore'
import { EntityRow } from './EntityRow'
import { PanelShell } from './PanelShell'
import { RelatedChips } from './RelatedChips'

export function EventPanel() {
  const scope = useFocusScope()
  const focus = useFocusStore((s) => s.focus)

  const rows = resolveEventScope(scope)
  const outbound = resolveOutboundLinks(scope.selectedId)
  const contextId = resolveContextDynastyId(scope)
  const contextName = contextId ? dynastyById.get(contextId)?.name : null

  return (
    <PanelShell
      level="event"
      title="史事经纬"
      caption={`${contextName ?? '全部朝代'} · 共 ${rows.length} 条`}
      count={rows.length}
      footer={
        <RelatedChips
          level={outbound.level ?? 'character'}
          ids={outbound.level === 'character' ? outbound.ids : []}
          hint="选择一条史事，以查看其中的登场人物"
        />
      }
    >
      {rows.length === 0 ? (
        <p className="px-2 py-6 text-center text-[12px] text-zinc-600">暂无关联史事</p>
      ) : (
        <ul className="space-y-1.5">
          {rows.map((ev) => (
            <li key={ev.id}>
              <EntityRow
                title={ev.name}
                subtitle={formatYear(ev.year)}
                summary={ev.summary}
                accent={dynastyById.get(ev.dynastyId)?.accent}
                selected={scope.selectedId === ev.id}
                onClick={() => focus('event', ev.id)}
              />
            </li>
          ))}
        </ul>
      )}
    </PanelShell>
  )
}
