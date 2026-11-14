/**
 * sanguoMap.ts —— 三国沙盘的地图配置
 * ---------------------------------------------------------------------------
 * 疆域数据在 src/data/sanguo.geo.json，由 check-sanguo-geo.mjs 校验：
 *   面积守恒（与楚汉八块同底）、两两不重叠、国都在境内。
 *
 * 与楚汉图的关系：同一片大陆，重新剖成魏 / 蜀 / 吴 / 辽东四块。
 * 各块带 aliveFrom / aliveTo：地图按当前年份决定渲染哪几块
 * （蜀 221、吴 229 才登场，辽东 238 亡）。
 */
import geo from '../../data/sanguo.geo.json'
import type { MapRegion, MapSpec, StrategicPoint } from './mapGeometry'

export const SANGUO_REGIONS: MapRegion[] = geo.regions.map((r) => ({
  id: r.id,
  name: r.name,
  points: r.points,
  label: r.label as [number, number],
  capital: r.capital,
  aliveFrom: r.aliveFrom,
  aliveTo: r.aliveTo,
}))

export const WEI_BASE = SANGUO_REGIONS.find((r) => r.id === geo.attacker)!

export const SANGUO_MAP: MapSpec = {
  attacker: WEI_BASE,
  regions: SANGUO_REGIONS.filter((r) => r.id !== WEI_BASE.id),
  rivers: [
    'M 80,268 C 200,250 280,232 360,254 C 450,278 520,262 600,278 C 700,298 820,276 960,300',
    'M 300,500 C 400,486 470,502 560,514 C 660,528 740,516 850,530',
  ],
  ariaLabel: '三国鼎立版图',
  resetHint: '三国复其疆',
  points: ((geo as { points?: StrategicPoint[] }).points ?? []),
  // 265 年司马炎受魏禅，国号晋；280 年灭吴时攻方已是晋
  successor: { year: 265, name: '晋' },
}
