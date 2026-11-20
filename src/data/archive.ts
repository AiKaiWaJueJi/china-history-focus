/**
 * data/archive.ts —— 档案抽屉「帝王 / 诸侯」结构化档案的数据装配
 * ===========================================================================
 * 抽屉里的帝王档案早先只是一段纯文本（谥法 / 要事 / 同朝），读起来像目录。
 * 这里把同一批**已经核对过的数据**（emperors.*.json / lords.zhou.json）
 * 装配成可点击的时间线，并补三类真实上下文，一条新史实都不造：
 *
 *   1. 事件注解 —— 只收有把握的（src/data/event-notes.json），没写的退回元数据；
 *   2. 同期在任诸侯 —— 用称霸期求交，与时间轴联动同一口径；
 *   3. 相关档案 —— 事件名恰好命中百科条目时，给一个下钻入口（如「书同文」）。
 */
import type { EmperorEvent, Lord } from '../core/emperorTypes'
import type { CodexEntry } from '../core/codex'
import { codexEntries } from './codex'
import { getEmperorArchive, getLordArchive, lordsRulingAt } from './emperorData'
import eventNotes from './event-notes.json'
import emperorBios from './emperor-bios.json'
import emperorTaglines from './emperor-taglines.json'

const NOTES = eventNotes as Record<string, string>

/** 事件名 → 百科条目。先精确匹配；再退一步做「前缀匹配」（事件名以条目名开头） */
const entryByName = new Map<string, CodexEntry>()
for (const entry of codexEntries) {
  if (!entryByName.has(entry.name)) entryByName.set(entry.name, entry)
}

/**
 * 为什么允许前缀匹配：
 * 事件名常常是「书同文·车同轨」「北击匈奴·筑长城」这种并列写法，
 * 而百科条目叫「书同文」。要求精确相等会让这类事件永远链不出去。
 * 但只认「事件名以条目名开头」，且取最长的那个 ——
 * 「匈奴」不在条目里才不会误链。
 */
export function entryForEventName(name: string): CodexEntry | null {
  const trimmed = name.trim()
  const exact = entryByName.get(trimmed)
  if (exact) return exact
  let bestKey = ''
  let bestEntry: CodexEntry | null = null
  for (const [key, entry] of entryByName) {
    if (key.length < 2) continue
    if (!trimmed.startsWith(key)) continue
    if (key.length <= bestKey.length) continue
    bestKey = key
    bestEntry = entry
  }
  return bestEntry
}

export type EventDimensionLabel = '军事' | '政治' | '文教'

export const DIMENSION_LABEL: Record<string, EventDimensionLabel> = {
  military: '军事',
  political: '政治',
  culture: '文教',
}

export interface EventDetail {
  event: EmperorEvent
  /** 人工写的史实注解（可能没有） */
  note: string | null
  /** 事件名命中的百科条目 → 可下钻 */
  entry: CodexEntry | null
  /** 同年「在任称霸」的诸侯（西周那些年份没有这个数据，为空） */
  rulers: Lord[]
  /** 事件落在哪个时代分段（西周 / 春秋 / 战国…） */
  segment: string | null
}

/**
 * 单条事件的史实注解（没有则 null）。
 * 帝王与诸侯共用同一张 `event-notes.json`（键 = 事件 id），
 * 所以诸侯档案也必须走这里——早先诸侯那侧把 note 写死成 null，
 * 批次 3 补的 30 条诸侯注解一条都显示不出来（2026-11-20 修）。
 */
export function getEventNote(eventId: string): string | null {
  return NOTES[eventId] ?? null
}

/**
 * 把某位帝王的事件装配成时间线（按年份升序）。
 * 拿不到帝王记录（比如南北朝 / 五代的独立时间轴）时返回空数组，
 * 调用方退回纯文本正文 —— 档案不会因此变空。
 */
export function buildEventTimeline(emperorId: string): EventDetail[] {
  const ref = getEmperorArchive(emperorId)
  if (!ref) return []
  return [...ref.emperor.events]
    .sort((a, b) => a.year - b.year)
    .map((event) => ({
      event,
      note: getEventNote(event.id),
      entry: entryForEventName(event.name),
      rulers: lordsRulingAt(event.year),
      segment:
        ref.segments.find((seg) => event.year >= seg.startYear && event.year <= seg.endYear)?.name ??
        null,
    }))
}

/**
 * 这个条目能不能用结构化档案渲染。
 * 南北朝 / 五代十国是独立时间轴（nanbei.json / wudai.json），
 * 它们的君主不在 emperors.*.json 里 —— 拿不到记录就退回纯文本正文，档案不会变空。
 */
export function hasStructuredArchive(entry: CodexEntry): boolean {
  const id = entry.sourceId ?? entry.id
  if (entry.kind === 'emperor') return Boolean(getEmperorArchive(id))
  if (entry.kind === 'lord') return Boolean(getLordArchive(id))
  return false
}

/**
 * 一句话记忆点（`emperor-taglines.json`），显示在谥法旁。
 * 事实化写法：「煤山殉国」而不是「明君」——标签是记忆钩子，不是评价。
 */
export function getEmperorTagline(emperorId: string): string | null {
  const text = (emperorTaglines as Record<string, string>)[emperorId]
  return typeof text === 'string' && text.length > 0 ? text : null
}

/* -------------------------------------------------------------------------- */
/* 生平叙述与「运行时织链」                                                     */
/* -------------------------------------------------------------------------- */

/**
 * 帝王生平（`emperor-bios.json`）。
 * 只有重点帝王写了；没写的返回 null，档案里就不显示「生平」区块——
 * 不留一个「暂无」的空框，比假装完整好。
 */
export function getEmperorBio(emperorId: string): string | null {
  const text = (emperorBios as Record<string, string>)[emperorId]
  return typeof text === 'string' && text.length > 0 ? text : null
}

/*
  把文本里出现的**词条名**自动织成 [[名字|id]] 标记，长名优先。
  与 scripts/build-codex.mjs 的织链同一套规则，但放在运行时：
  生平、事件注解是手写数据，不该为了加一条链就跑一次生成器。

  只用 character / battle / extra 三类的 **name**，不用帝王称号——
  称号会撞语境（「秦王」既可能指嬴政也可能指子婴），错链比不链更糟。
*/
const linkTargets = new Map<string, string>()
for (const entry of codexEntries) {
  if (entry.kind !== 'character' && entry.kind !== 'battle' && entry.kind !== 'extra') continue
  if (!linkTargets.has(entry.name)) linkTargets.set(entry.name, entry.id)
}
const linkNames = [...linkTargets.keys()].sort((a, b) => b.length - a.length)
const linkRe =
  linkNames.length > 0
    ? new RegExp(linkNames.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g')
    : null

/** 已手写的 [[...]] 原样保留，其余片段做名字匹配 */
export function linkify(text: string, excludeId?: string): string {
  if (!linkRe) return text
  return text
    .split(/(\[\[[^\]]+\]\])/g)
    .map((part) => {
      if (part.startsWith('[[')) return part
      return part.replace(linkRe, (match) => {
        const target = linkTargets.get(match)
        if (!target || target === excludeId) return match
        return `[[${match}|${target}]]`
      })
    })
    .join('')
}
