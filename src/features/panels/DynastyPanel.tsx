/**
 * L1 · 朝代面板（时间轴）
 * ---------------------------------------------------------------------------
 * 交互语义：点击朝代 = 在「朝代层」内选中它（focusLevel 保持 dynasty）。
 * 选中后底部出现该朝代的帝王芯片，点击芯片才会把焦点推进到 emperor 层。
 * 这样"平级浏览"与"逐层钻取"互不干扰。
 */
import { resolveOutboundLinks, resolveContextDynastyId } from '../../core/selectors'
import { dataset, dynastyById } from '../../data'
import { useFocusScope, useFocusStore } from '../../store/useFocusStore'
import { EntityRow } from './EntityRow'
import { PanelShell } from './PanelShell'
import { RelatedChips } from './RelatedChips'

export function DynastyPanel() {
  const scope = useFocusScope()
  const focus = useFocusStore((s) => s.focus)

  const rows = dataset.dynasties
  const outbound = resolveOutboundLinks(scope.selectedId)
  const contextId = resolveContextDynastyId(scope)
  const contextName = contextId ? dynastyById.get(contextId)?.name : null

  return (
    <PanelShell
      level="dynasty"
      title="朝代时间轴"
      caption={`${contextName ?? '全部朝代'} · 共 ${rows.length} 个断代`}
      count={rows.length}
      footer={
        <RelatedChips
          level={outbound.level ?? 'emperor'}
          ids={outbound.level === 'emperor' ? outbound.ids : []}
          hint="选择一个朝代，以展开它的帝王"
        />
      }
    >
      <ul className="space-y-1.5">
        {rows.map((d) => (
          <li key={d.id}>
            <EntityRow
              title={d.name}
              subtitle={d.period}
              summary={d.summary}
              accent={d.accent}
              selected={scope.selectedId === d.id}
              onClick={() => focus('dynasty', d.id)}
            />
          </li>
        ))}
      </ul>
    </PanelShell>
  )
}
