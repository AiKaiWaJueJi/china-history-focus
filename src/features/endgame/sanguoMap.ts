/**
 * sanguoMap.ts —— 三国沙盘的地图配置
 * ---------------------------------------------------------------------------
 * 疆域数据在 src/data/sanguo.geo.json，由 scripts/make-sandbox-geo.mjs 生成：
 *   第三轮起与七盘同一套「真实省界底板 + 史实归属」。
 *   各块带 aliveFrom / aliveTo：地图按当前年份决定渲染哪几块
 *   （蜀、吴按史实登场年份，辽东 238 年平）。
 *
 * 攻方 = 魏；其余为蜀、吴、辽东与背景势力（鲜卑、西域高原诸部）。
 */
import geo from '../../data/sanguo.geo.json'
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

export const WEI_BASE: MapRegion = toRegion(ATTACKER)
export const SANGUO_REGIONS: MapRegion[] = REGIONS.map(toRegion)

export const SANGUO_MAP: MapSpec = {
  attacker: WEI_BASE,
  regions: SANGUO_REGIONS,
  // 河流来自底板生成器（黄河 / 长江 / 淮河 / 汉水 / 湘江 / 赣江）
  rivers: (geo as { rivers?: string[] }).rivers ?? [],
  ariaLabel: '三国鼎立版图',
  resetHint: '三国复其疆',
  points: (geo as { points?: StrategicPoint[] }).points ?? [],
  // 265 年司马炎受魏禅，国号晋；280 年灭吴时攻方已是晋
  successor: { year: 265, name: '晋' },
}
