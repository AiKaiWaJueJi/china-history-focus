/**
 * tenStates.ts —— 十国君主（五代十国里那 10 条政权带）
 * ===========================================================================
 * 为什么单独一层：十国的数据原本只到「政权」粒度（wudai.json 的 polities：
 * 都城 / 开国 / 亡国 / 与中原关系），**没有君主**。所以政权带只能看一张信息卡，
 * 读者想知道「南唐有哪几位、李煜之前是谁」就没有入口。
 *
 * 2026-11-21 起：ten_states.json 提供逐帝数据，这里建三张索引：
 *   tenStates            原样（按 wudai.json 的政权顺序）
 *   tenStatesByPolityId  政权 id → 该国君主（按在位年升序）
 *   tenMonarchById       君主 id → 君主（档案抽屉反查）
 *
 * 口径：十国君主**不入中原帝系**（与「十六国余部」同口径），所以在百科库里是 `ruler`（君主）
 * 而不是 `emperor`（帝王）——标签上就必须分开，不能为了少写一个 kind 把他们混进帝系。
 */
import raw from './ten_states.json'

export interface TenMonarchEvent {
  id: string
  name: string
  dimension: 'military' | 'political' | 'culture'
  year: number
}

export interface TenMonarch {
  id: string
  /** 庙号 + 谥号，或「后主」「末帝」这类通行称谓 */
  title: string
  name: string
  reign: string
  start: number
  end: number
  evaluation: 'good' | 'neutral' | 'bad'
  posthumousRule: string
  events: TenMonarchEvent[]
}

export interface TenState {
  polityId: string
  polityName: string
  monarchs: TenMonarch[]
}

interface TenStateDoc {
  _readme?: string
  states: TenState[]
}

const doc = raw as unknown as TenStateDoc

export const tenStates: TenState[] = doc.states ?? []

export const tenStatesByPolityId = new Map<string, TenState>()
export const tenMonarchById = new Map<string, TenMonarch>()
/** 君主 id → 所属政权（档案里要显示「南唐」这类归属） */
export const tenStateOfMonarch = new Map<string, TenState>()

for (const state of tenStates) {
  tenStatesByPolityId.set(state.polityId, state)
  for (const m of state.monarchs) {
    tenMonarchById.set(m.id, m)
    tenStateOfMonarch.set(m.id, state)
  }
}

/** 政权档案条目的 id：与 build-codex.mjs 的生成规则必须一致 */
export const regimeEntryId = (polityId: string) => `regime_${polityId}`
