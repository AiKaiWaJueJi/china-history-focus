/**
 * songParallel.ts —— 宋辽金西夏并立（960—1279）的读取层
 * ===========================================================================
 * 为什么另开一条并行视图、而不是改宋现有时间轴：
 *   · 宋那条单行时间轴已经被 verify-frame / verify-journey 钉住（分页、段间过渡、末页入口），
 *     把它改成四行并行，等于把一条验证过的链路推倒重来；
 *   · 读者要的是「同一时期还有谁」，不是「宋帝换成四行排」。所以另开一行视图，入口放在宋时间轴顶栏。
 *
 * 数据口径：
 *   · 宋的 18 位帝王**复用** emperors.song.json（他们的档案条目早已存在，kind = emperor）；
 *   · 辽 / 西夏 / 金 的三家君主在 song_parallel.json 的 rulers 里，kind = ruler（君主）——
 *     不入宋的帝系，与南北朝、十国的口径一致；
 *   · 每家的「政权」信息（都城 / 开国 / 亡国 / 与宋关系）在 polities 里，档案件由生成器建。
 */
import raw from './song_parallel.json'

export interface ParallelRow {
  id: string
  name: string
  note: string
  accent: string
  kind: 'dynasty' | 'regime'
}

export interface ParallelPolity {
  id: string
  name: string
  row: string
  start: number
  end: number
  capital?: string
  leader?: string
  fall?: string
  relation?: string
}

export interface ParallelPage {
  from: number
  to: number
}

export interface ParallelNode {
  year: number
  title: string
  subtitle?: string
}

export interface ParallelRulerEvent {
  id: string
  name: string
  dimension: 'military' | 'political' | 'culture'
  year: number
}

export interface ParallelRuler {
  id: string
  polityId: string
  title: string
  name: string
  reign: string
  start: number
  end: number
  evaluation: 'good' | 'neutral' | 'bad'
  posthumousRule: string
  events: ParallelRulerEvent[]
}

interface ParallelDoc {
  _readme?: string
  dynastyId: string
  name: string
  period: string
  rows: ParallelRow[]
  polities: ParallelPolity[]
  pages: ParallelPage[]
  nodes: ParallelNode[]
  rulers: ParallelRuler[]
}

const doc = raw as unknown as ParallelDoc

export const parallelRows = doc.rows ?? []
export const parallelPolities = doc.polities ?? []
export const parallelPages = doc.pages ?? []
export const parallelNodes = doc.nodes ?? []
export const parallelRulers: ParallelRuler[] = doc.rulers ?? []
export const parallelTitle = doc.name
export const parallelPeriod = doc.period

export const parallelPolityById = new Map(parallelPolities.map((p) => [p.id, p]))
export const parallelRulersByPolity = new Map<string, ParallelRuler[]>()
for (const r of parallelRulers) {
  const list = parallelRulersByPolity.get(r.polityId) ?? []
  list.push(r)
  parallelRulersByPolity.set(r.polityId, list)
}
for (const list of parallelRulersByPolity.values()) list.sort((a, b) => a.start - b.start)

/** 政权档案条目 id：与 build-codex.mjs 的生成规则必须一致 */
export const parallelRegimeEntryId = (polityId: string) => `regime_${polityId}`
