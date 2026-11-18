/**
 * data/codex.ts —— 百科库的读取层
 * ===========================================================================
 * 由 scripts/build-codex.mjs 从已有数据生成（战役 49 / 人物 59 / 帝王 176 / 诸侯 12）。
 * 这里只建三张索引，全部 O(1)：
 *   codexById        条目 id → 条目
 *   codexBySourceId  原始数据 id → 条目（战报按事件 id、战报人名、帝王卡按帝王 id 反查）
 *   codexByKind      按类型分组（将来的检索/目录页用）
 */
import raw from './codex.entries.json'
import type { CodexEntry, CodexKind } from '../core/codex'

/**
 * 形状兜底：JSON 是生成物（scripts/build-codex.mjs），但生成器漏字段时前端不能跟着崩。
 * 渲染层把 quotes / related 直接 .map()，缺一个就是「整棵树卸载 → 黑屏」，
 * 所以**在读取层补齐**，不指望每个调用方都记得 ?? []。
 */
const normalizeEntry = (entry: CodexEntry): CodexEntry => ({
  ...entry,
  body: typeof entry.body === 'string' ? entry.body : '',
  quotes: Array.isArray(entry.quotes)
    ? entry.quotes
        .filter((q) => q && typeof q.text === 'string')
        /* tier 缺省 = 一手；写成别的值也降级成一手，不让脏数据影响「层级小签」的判断 */
        .map((q) => ({ ...q, tier: q.tier === 'secondary' ? 'secondary' : 'primary' }))
    : [],
  related: Array.isArray(entry.related) ? entry.related.filter((id) => typeof id === 'string') : [],
  alias: Array.isArray(entry.alias) ? entry.alias : undefined,
  tags: Array.isArray(entry.tags) ? entry.tags : undefined,
})

export const codexEntries = (raw.entries as unknown as CodexEntry[]).map(normalizeEntry)
export const codexCounts = raw.counts

export const codexById = new Map<string, CodexEntry>()
export const codexBySourceId = new Map<string, CodexEntry>()
export const codexByKind = new Map<CodexKind, CodexEntry[]>()

for (const entry of codexEntries) {
  codexById.set(entry.id, entry)
  if (entry.sourceId) codexBySourceId.set(entry.sourceId, entry)
  const list = codexByKind.get(entry.kind) ?? []
  list.push(entry)
  codexByKind.set(entry.kind, list)
}

export const getEntry = (id: string): CodexEntry | undefined => codexById.get(id)

/**
 * 原始数据 id → 条目。
 * 战报事件 id 只在各自文件内唯一（楚汉与战国都有 e_han / e_wei…），
 * 所以战役的 sourceId 是「朝代:事件 id」；调用方把 dynastyId 一起传进来即可。
 * 人物 / 帝王 / 诸侯的 sourceId 就是原 id，不带前缀。
 */
export const getEntryBySource = (sourceId: string, dynastyId?: string): CodexEntry | undefined => {
  if (dynastyId) {
    const hit = codexBySourceId.get(`${dynastyId}:${sourceId}`)
    if (hit) return hit
  }
  return codexBySourceId.get(sourceId) ?? codexById.get(sourceId)
}

/** 关联列表：过滤掉不存在的 id，避免渲染空链接 */
export const relatedEntries = (entry: CodexEntry): CodexEntry[] =>
  entry.related.map((id) => codexById.get(id)).filter((x): x is CodexEntry => Boolean(x))
