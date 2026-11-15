/**
 * codex.ts —— 百科库的类型与正文解析
 * ===========================================================================
 * 「无限下钻」的底座。这里只做两件事：
 *   1. 定义条目的形状（人物 / 战役 / 帝王 / 诸侯 / 补充词条）；
 *   2. 把正文里的 [[显示名|条目id]] 标记解析成可渲染的片段。
 *
 * 【为什么用标记而不是 rich text】
 * 正文要能让写数据的人（和生成脚本）自由织链，又不能让前端吃 HTML。
 * `[[显示名|id]]` 是纯文本，JSON 里可读可 diff；渲染时解析成 link 片段，
 * id 不存在时降级为普通文字——**数据没写完也不会崩**，这是"无限下钻"能放开点的前提。
 *
 * 【解析规则（故意宽松）】
 *   [[王翦|f_wangjian]]  → 显示「王翦」，跳 f_wangjian
 *   [[f_wangjian]]       → 显示条目名（渲染时由调用方补），跳 f_wangjian
 *   [[未闭合 或 [[x|]]     → 当普通文字，原样输出（不抛错）
 */

export type CodexKind = 'battle' | 'character' | 'emperor' | 'lord' | 'extra'

/** 一段史料：文言原文 + 白话译文 */
export interface CodexQuote {
  /** 出处，如《史记·白起王翦列传》 */
  work: string
  /** 文言原文 */
  text: string
  /** 白话译文 */
  translation: string
}

export interface CodexEntry {
  /** 全局唯一条目 id */
  id: string
  /** 原始数据 id（战报事件 id / 人物 id / 帝王 id），UI 用它反查条目 */
  sourceId?: string
  kind: CodexKind
  /** 展示名 */
  name: string
  /** 一句话定位，如「秦 · 频阳东乡人」 */
  subtitle?: string
  /** 别名 / 本名（织链与检索用） */
  alias?: string[]
  /** 生卒或在位，字符串（史实常不确定，不硬做结构化） */
  years?: string
  /** 所属朝代 id，用于配色与「回到时间轴」 */
  dynastyId?: string | null
  /** 正文，可含 [[显示名|id]] 标记 */
  body: string
  /** 史料原文 + 译文，可为空（帝王/诸侯多数只有正文） */
  quotes: CodexQuote[]
  /** 关联条目 id */
  related: string[]
  tags?: string[]
}

export type CodexSegment =
  | { type: 'text'; text: string }
  | { type: 'link'; text: string; id: string }

/** 正文的一个渲染块：段落或条目（以「— 」开头的行算条目） */
export interface CodexBlock {
  bullet: boolean
  segments: CodexSegment[]
}

const MARKER = /\[\[([^\]|]+?)(?:\|([^\]]*))?\]\]/g

/** 解析一段文字为一个渲染块 */
function parseLine(line: string): CodexBlock {
  const bullet = line.startsWith('— ')
  const source = bullet ? line.slice(2) : line
  const segments: CodexSegment[] = []
  let last = 0
  MARKER.lastIndex = 0
  for (let m = MARKER.exec(source); m; m = MARKER.exec(source)) {
    if (m.index > last) segments.push({ type: 'text', text: source.slice(last, m.index) })
    const id = m[2]
    if (!id) {
      // [[id]] 形式：先按 id 显示，渲染层会替换成条目名
      segments.push({ type: 'link', text: m[1], id: m[1] })
    } else {
      segments.push({ type: 'link', text: m[1], id })
    }
    last = m.index + m[0].length
  }
  if (last < source.length) segments.push({ type: 'text', text: source.slice(last) })
  return { bullet, segments }
}

/**
 * 正文 → 渲染块列表。
 * 空行分段；以「— 」开头的行渲染成条目；其余为普通段落。
 */
export function parseBody(body: string): CodexBlock[] {
  return body
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(parseLine)
}

export const KIND_LABEL: Record<CodexKind, string> = {
  battle: '战役',
  character: '人物',
  emperor: '帝王',
  lord: '诸侯',
  extra: '典制',
}
