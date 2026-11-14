/**
 * chuhanMap.ts —— 楚汉沙盘的地图配置
 * ---------------------------------------------------------------------------
 * 疆域数据放在 src/data/chuhan.geo.json，由 check-chuhan-geo.mjs 校验：
 *   面积守恒（无空洞）、两两不重叠、国都在境内。
 *
 * 这套坐标直接继承战国图的手工剖分，只把『秦』拆成『三秦』+『汉』、
 * 『楚』改名『西楚』，所以整块大陆依然严丝合缝。
 */
import geo from '../../data/chuhan.geo.json'
import type { MapRegion, MapSpec } from './mapGeometry'

export const CHUHAN_REGIONS: MapRegion[] = geo.regions.map((r) => ({
  id: r.id,
  name: r.name,
  points: r.points,
  label: r.label as [number, number],
  capital: r.capital,
  aliveFrom: r.aliveFrom,
  aliveTo: r.aliveTo,
}))

export const HAN_BASE = CHUHAN_REGIONS.find((r) => r.id === geo.attacker)!

export const CHUHAN_MAP: MapSpec = {
  attacker: HAN_BASE,
  regions: CHUHAN_REGIONS.filter((r) => r.id !== HAN_BASE.id),
  rivers: [
    'M 80,268 C 200,250 280,232 360,254 C 450,278 520,262 600,278 C 700,298 820,276 960,300',
    'M 300,500 C 400,486 470,502 560,514 C 660,528 740,516 850,530',
  ],
}
