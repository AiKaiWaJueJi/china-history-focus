/**
 * RichText —— 把带 `[[显示名|id]]` 标记的纯文本渲染成可下钻的段落
 * ===========================================================================
 * 抽屉里所有「正文」共用这一份实现：
 *   · 战役 / 人物 / 典制条目的 body（生成物，链由 build-codex 织好）；
 *   · 帝王生平、事件注解（运行时手写数据，链由 data/archive.ts 的 linkify 织）。
 * 早先这段渲染写在 CodexDrawer 内部，现在抽出来，免得两份实现慢慢跑偏。
 */
import { parseBody } from '../../core/codex'
import { codexById } from '../../data/codex'

interface RichTextProps {
  text: string
  onDrill: (id: string) => void
  className?: string
}

export function RichText({ text, onDrill, className = 'codex-body' }: RichTextProps) {
  return (
    <div className={className}>
      {parseBody(text).map((block, i) => (
        <p key={i} className={`codex-line${block.bullet ? ' codex-line--bullet' : ''}`}>
          {block.segments.map((seg, k) =>
            seg.type === 'link' ? (
              <button
                key={k}
                type="button"
                className="codex-link"
                onClick={() => onDrill(seg.id)}
                data-dead={codexById.has(seg.id) ? undefined : ''}
              >
                {codexById.get(seg.id)?.name ?? seg.text}
              </button>
            ) : (
              <span key={k}>{seg.text}</span>
            ),
          )}
        </p>
      ))}
    </div>
  )
}
