/**
 * L2 · 帝王面板
 * ---------------------------------------------------------------------------
 * 数据作用域由「上下文朝代」决定：只要上层选中了某个朝代（或选中了属于该朝代的
 * 皇帝/事件/人物），这里就只显示该朝代的帝王，形成四块面板的时代联动。
 * 点击帝王 = 把焦点推进到 emperor 层；底部芯片可继续跃迁到其史事。
 */
import { resolveContextDynastyId, resolveEmperorScope, resolveOutboundLinks } from '../../core/selectors'
import { dynastyById } from '../../data'
import { useFocusScope, useFocusStore } from '../../store/useFocusStore'
import { EntityRow } from './EntityRow'
import { PanelShell } from './PanelShell'
import { RelatedChips } from './RelatedChips'

export function EmperorPanel() {
  const scope = useFocusScope()
  const focus = useFocusStore((s) => s.focus)

  const rows = resolveEmperorScope(scope)
  const outbound = resolveOutboundLinks(scope.selectedId)
  const contextId = resolveContextDynastyId(scope)
  const contextName = contextId ? dynastyById.get(contextId)?.name : null

  return (
    <PanelShell
      level="emperor"
      title="帝王本纪"
      caption={`${contextName ?? '全部朝代'} · 共 ${rows.length} 位`}
      count={rows.length}
      footer={
        <RelatedChips
          level={outbound.level ?? 'event'}
          ids={outbound.level === 'event' ? outbound.ids : []}
          hint="选择一位帝王，以展开他参与或主导的史事"
        />
      }
    >
      {rows.length === 0 ? (
        <p className="px-2 py-6 text-center text-[12px] text-zinc-600">该朝代暂无帝王数据</p>
      ) : (
        <ul className="space-y-1.5">
          {rows.map((e) => (
            <li key={e.id}>
              <EntityRow
                title={e.title}
                subtitle={e.reign}
                summary={`${e.name} · ${e.summary}`}
                accent={dynastyById.get(e.dynastyId)?.accent}
                selected={scope.selectedId === e.id}
                onClick={() => focus('emperor', e.id)}
              />
            </li>
          ))}
        </ul>
      )}
    </PanelShell>
  )
}
