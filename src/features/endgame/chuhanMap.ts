/**
 * chuhanMap.ts —— 楚汉沙盘的地图配置
 * ---------------------------------------------------------------------------
 * 疆域数据在 src/data/chuhan.geo.json，由 scripts/make-sandbox-geo.mjs 生成：
 *   第三轮起与七盘同一套「真实省界底板 + 史实归属」，面积和 == 208736，
 *   相邻政权共用同一套省界，天然不重叠、无缺块。
 *
 * 攻方 = 漢（刘邦，巴蜀 + 汉中）；其余为三秦、西楚、魏、韩、赵、燕、齐
 * 与背景势力（临江、匈奴、月氏羌、南越闽越）。
 */
import geo from '../../data/chuhan.geo.json'
import type { MapRegion, MapSpec, StrategicPoint } from './mapGeometry'

/** geo JSON 各块的可选字段（登场年份区间、背景势力、字号） */
type GeoRegion = MapRegion & {
  aliveFrom?: number
  aliveTo?: number
  neutral?: boolean
  labelSize?: number
}

const toRegion = (r: GeoRegion): MapRegion => ({
  id: r.id,
  name: r.name,
  points: r.points,
  label: r.label as [number, number],
  labelSize: r.labelSize,
  capital: r.capital,
  aliveFrom: r.aliveFrom,
  aliveTo: r.aliveTo,
  neutral: r.neutral,
})

const ATTACKER = geo.attacker as unknown as GeoRegion
const REGIONS = geo.regions as unknown as GeoRegion[]

export const HAN_BASE: MapRegion = toRegion(ATTACKER)
export const CHUHAN_REGIONS: MapRegion[] = REGIONS.map(toRegion)

export const CHUHAN_MAP: MapSpec = {
  attacker: HAN_BASE,
  regions: CHUHAN_REGIONS,
  // 河流来自底板生成器（黄河 / 长江 / 淮河 / 汉水），与省界同一套投影
  rivers: (geo as { rivers?: string[] }).rivers ?? [],
  ariaLabel: '楚漢相争版图',
  // 点「漢」回到前 206 年项羽分封之局
  resetHint: '十八王复其疆',
  points: (geo as { points?: StrategicPoint[] }).points ?? [],
}
