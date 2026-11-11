/**
 * L4 · 人物面板
 * ---------------------------------------------------------------------------
 * 作用域收敛顺序：选中事件 → 该事件出场人物；选中皇帝 → 其事件涉及的人物；
 * 否则按上下文朝代。点击人物 = 焦点推进到 character 层（最"深"的一层）。
 * 此时底部芯片反向往回跃迁到事件，形成可回溯的环路，而不是死胡同。
 */
import {
  resolveCharacterScope,
  resolveContextDynastyId,
  resolveOutboundLinks,
} from '../../core/selectors'
import { dynastyById } from '../../data'
import { useFocusScope, useFocusStore } from '../../store/useFocusStore'
import { EntityRow } from './EntityRow'
import { PanelShell } from './PanelShell'
import { RelatedChips } from './RelatedChips'

export function CharacterPanel() {
  const scope = useFocusScope()
  const focus = useFocusStore((s) => s.focus)

  const rows = resolveCharacterScope(scope)
  const outbound = resolveOutboundLinks(scope.selectedId)
  const contextId = resolveContextDynastyId(scope)
  const contextName = contextId ? dynastyById.get(contextId)?.name : null

  return (
    <PanelShell
      level="character"
      title="人物星图"
      caption={`${contextName ?? '全部朝代'} · 共 ${rows.length} 人`}
      count={rows.length}
      footer={
        <RelatedChips
          level={outbound.level ?? 'event'}
          ids={outbound.level === 'event' ? outbound.ids : []}
          hint="选择一个人物，以回溯其参与的历史事件"
        />
      }
    >
      {rows.length === 0 ? (
        <p className="px-2 py-6 text-center text-[12px] text-zinc-600">暂无关联人物</p>
      ) : (
        <ul className="space-y-1.5">
          {rows.map((c) => (
            <li key={c.id}>
              <EntityRow
                title={c.name}
                subtitle={c.role}
                summary={c.summary}
                accent={dynastyById.get(c.dynastyId)?.accent}
                selected={scope.selectedId === c.id}
                onClick={() => focus('character', c.id)}
              />
            </li>
          ))}
        </ul>
      )}
    </PanelShell>
  )
}
