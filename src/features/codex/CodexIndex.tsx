/**
 * CodexIndex —— 档案总目（/codex）
 * ===========================================================================
 * 解决什么问题：359 条百科此前**只能顺着链子点**——用户想找「井陉」或「商鞅变法」，
 * 要么记得它在哪一朝的哪一条里，要么一路下钻碰运气。这一页把整个库摊平成一张可检索的表。
 *
 * 三条设计取舍：
 *   1. **纯前端检索**：359 条的内存文本索引，回车即出结果，不做后端、不加请求；
 *   2. **点行 = 开抽屉**：不在本页展开内容，保持「抽屉是唯一阅读界面」这一个心智模型
 *      （抽屉盖在本页之上，关掉就回到刚才的检索位置）；
 *   3. **按「命中位置」排序**：名字/别名命中优先于正文命中，避免搜「秦」时满屏都是正文里
 *      顺带提了一句秦的条目。
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { CodexEntry, CodexKind } from '../../core/codex'
import { KIND_LABEL } from '../../core/codex'
import { codexById, codexCounts, codexEntries } from '../../data/codex'
import { dataset } from '../../data'
import { useCodexStore } from '../../store/useCodexStore'
import './codex-index.css'

/** 类型筛选的展示顺序：先人（帝王/诸侯/人物），再事（战役），最后制度 */
const KIND_ORDER: CodexKind[] = ['emperor', 'lord', 'character', 'battle', 'extra']

const KIND_HINT: Record<CodexKind, string> = {
  emperor: '时间轴上的帝王',
  lord: '春秋诸侯',
  character: '战报里的人名',
  battle: '沙盘上的战役',
  extra: '典制与典故',
}

interface IndexedEntry {
  entry: CodexEntry
  /** 名字/别名/副标题/在位年 —— 命中这些算「高权重」 */
  head: string
  /** 正文 + 原文 + 译文 —— 命中算「低权重」 */
  body: string
}

/** 正文里的 [[显示名|id]] 标记在检索时要先去掉，否则搜「id」会命中每一条。
    注意标记的**第一段才是显示名、第二段是 id**（见 core/codex.ts 的解析规则）：
    写成 \`[[王翦|f_wangjian]]\` 时留在正文里的是「王翦」；
    光秃的 \`[[f_wangjian]]\` 才是 id，替换成条目名（取不到就丢掉）。 */
const stripMarkers = (text: string) =>
  text.replace(/\[\[([^\]|]+?)(?:\|([^\]]*))?\]\]/g, (_m: string, a: string, b?: string) =>
    b ? a : codexById.get(a)?.name ?? '',
  )

/**
 * 默认排序键：先按主页朝代顺序（周→清），朝代内**帝王 → 诸侯 → 战役 → 人物 → 典制**，
 * 同组内按条目在生成物里的先后（帝王即世系顺序）。这样一进页面读到的就是「一部通史」，
 * 而不是按拼音乱序的字典，也不会让读者先撞见一堆战役条目。
 * 无朝代的条目统一排在最后。
 */
function buildOrder(dynRank: Map<string, number>): Map<string, number> {
  const order = new Map<string, number>()
  codexEntries.forEach((entry, i) => {
    const kind = KIND_ORDER.indexOf(entry.kind)
    const rank = entry.dynastyId ? dynRank.get(entry.dynastyId) : undefined
    order.set(entry.id, (rank === undefined ? 1e6 : rank) * 1e6 + kind * 1e4 + i)
  })
  return order
}

function buildIndex(): IndexedEntry[] {
  return codexEntries.map((entry) => ({
    entry,
    head: [entry.name, ...(entry.alias ?? []), entry.subtitle ?? '', entry.years ?? '', ...(entry.tags ?? [])]
      .join(' ')
      .toLowerCase(),
    body: [
      stripMarkers(entry.body),
      ...entry.quotes.flatMap((q) => [q.text, q.translation, q.work]),
      entry.noQuote ?? '',
    ]
      .join(' ')
      .toLowerCase(),
  }))
}

/** 高亮命中片段：只切出窗口，不做 DOM 级高亮（几百条同时渲染时更省） */
function snippet(text: string, keyword: string): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  const at = flat.toLowerCase().indexOf(keyword)
  if (at < 0) return flat.slice(0, 42)
  const from = Math.max(0, at - 14)
  return `${from > 0 ? '…' : ''}${flat.slice(from, from + 46)}${from + 46 < flat.length ? '…' : ''}`
}

export function CodexIndex() {
  const navigate = useNavigate()
  const openEntry = useCodexStore((s) => s.open)
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState<CodexKind | 'all'>('all')
  const [dynasty, setDynasty] = useState<string>('all')
  const inputRef = useRef<HTMLInputElement | null>(null)

  const index = useMemo(buildIndex, [])
  const dynastyName = useMemo(() => {
    const map = new Map<string, string>()
    for (const d of dataset.dynasties) map.set(d.id, d.name)
    return map
  }, [])
  /* 主页朝代顺序 → 默认排序用（见 buildOrder） */
  const order = useMemo(() => {
    const rank = new Map<string, number>()
    dataset.dynasties.forEach((d, i) => rank.set(d.id, i))
    return buildOrder(rank)
  }, [])

  /** 库里真正出现过的朝代（按主页朝代顺序），避免筛选项里冒出空朝代 */
  const dynastyOptions = useMemo(() => {
    const seen = new Set<string>()
    for (const entry of codexEntries) if (entry.dynastyId) seen.add(entry.dynastyId)
    return dataset.dynasties.filter((d) => seen.has(d.id)).map((d) => ({ id: d.id, name: d.name }))
  }, [])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    const scored: { item: IndexedEntry; score: number }[] = []
    for (const item of index) {
      if (kind !== 'all' && item.entry.kind !== kind) continue
      if (dynasty !== 'all' && item.entry.dynastyId !== dynasty) continue
      if (!q) {
        scored.push({ item, score: 0 })
        continue
      }
      if (item.head.includes(q)) scored.push({ item, score: 2 })
      else if (item.body.includes(q)) scored.push({ item, score: 1 })
    }
    if (q) scored.sort((a, b) => b.score - a.score || (order.get(a.item.entry.id) ?? 0) - (order.get(b.item.entry.id) ?? 0))
    else scored.sort((a, b) => (order.get(a.item.entry.id) ?? 0) - (order.get(b.item.entry.id) ?? 0))
    return scored
  }, [index, kind, dynasty, query, order])

  /* ESC：先清搜索，再退主页；抽屉开着时不抢（抽屉自己有 listeners） */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (useCodexStore.getState().navigationStack.length) return
      const target = event.target as HTMLElement | null
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) {
        setQuery('')
        inputRef.current?.blur()
        event.preventDefault()
        return
      }
      navigate('/')
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [navigate])

  const total = codexEntries.length
  const shown = results.length
  const kindCounts = codexCounts as Record<string, number>

  return (
    <div className="codex-index">
      <header className="codex-index-head">
        <div>
          <h2 className="codex-index-title">档案总目</h2>
          <p className="codex-index-sub">
            全库 {total} 条 · 帝王 {kindCounts.emperor ?? 0} / 诸侯 {kindCounts.lord ?? 0} / 人物{' '}
            {kindCounts.character ?? 0} / 战役 {kindCounts.battle ?? 0} / 典制 {kindCounts.extra ?? 0}
          </p>
        </div>
        <div className="codex-index-search">
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜人名、事件、原文关键词…（如 井陉 / 商鞅 / 朕为始皇帝）"
            aria-label="检索百科库"
            spellCheck={false}
          />
          {query ? (
            <button type="button" className="codex-index-clear" onClick={() => setQuery('')}>
              清空
            </button>
          ) : null}
        </div>
      </header>

      <div className="codex-index-filters">
        <div className="codex-index-group" role="group" aria-label="按类型筛选">
          <button
            type="button"
            className={`codex-filter${kind === 'all' ? ' is-active' : ''}`}
            onClick={() => setKind('all')}
          >
            全部
          </button>
          {KIND_ORDER.map((k) => (
            <button
              key={k}
              type="button"
              className={`codex-filter${kind === k ? ' is-active' : ''}`}
              onClick={() => setKind(k)}
              title={KIND_HINT[k]}
            >
              {KIND_LABEL[k]}
              <em>{kindCounts[k] ?? 0}</em>
            </button>
          ))}
        </div>
        <div className="codex-index-group" role="group" aria-label="按朝代筛选">
          <button
            type="button"
            className={`codex-filter${dynasty === 'all' ? ' is-active' : ''}`}
            onClick={() => setDynasty('all')}
          >
            全部朝代
          </button>
          {dynastyOptions.map((d) => (
            <button
              key={d.id}
              type="button"
              className={`codex-filter${dynasty === d.id ? ' is-active' : ''}`}
              onClick={() => setDynasty(d.id)}
            >
              {d.name}
            </button>
          ))}
        </div>
      </div>

      <p className="codex-index-count" aria-live="polite">
        {query ? `「${query}」命中 ${shown} 条` : `共 ${shown} 条`}
        {shown === 0 ? ' · 换个关键词试试，或清空筛选' : ''}
      </p>

      <ul className="codex-index-list">
        {results.map(({ item }) => {
          const { entry } = item
          const q = query.trim().toLowerCase()
          const hitBody = q && !item.head.includes(q) ? snippet(stripMarkers(entry.body), q) : ''
          return (
            <li key={entry.id}>
              <button type="button" className="codex-row" onClick={() => openEntry(entry.id)}>
                <span className={`codex-row-kind is-${entry.kind}`}>{KIND_LABEL[entry.kind]}</span>
                <span className="codex-row-main">
                  <span className="codex-row-name">{entry.name}</span>
                  {entry.subtitle ? <span className="codex-row-sub">{entry.subtitle}</span> : null}
                  {hitBody ? <span className="codex-row-hit">…{hitBody}</span> : null}
                </span>
                <span className="codex-row-meta">
                  {entry.dynastyId ? <em>{dynastyName.get(entry.dynastyId) ?? ''}</em> : null}
                  {entry.years ? <span>{entry.years}</span> : null}
                  {entry.quotes.length ? <span className="codex-row-quote">原文</span> : null}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
