/**
 * 楚汉九国疆域（前 206 年项羽分封之后）
 * ===========================================================================
 * 坐标由 scripts/gen-chuhan-geo.mjs 生成并自检：
 *   · 九块共用同一组顶点，相邻块严丝合缝（4000 点采样无重叠）
 *   · 每块国都落在自己的多边形内
 *
 * 相对方位依史：
 *   三秦据关中（雍、塞、翟），汉据巴蜀汉中隔秦岭相望，
 *   魏在河东，韩在颍川，赵在河北，燕在幽燕，齐在山东，
 *   西楚都彭城，九江王英布据淮南。
 *
 * 单独成文件，是为了把「楚汉」与「战国」两张图彻底解耦：
 * 改一张不会碰到另一张。
 */
import type { MapRegion, MapSpec } from './mapGeometry'

const REGIONS: MapRegion[] = [
  {
    id: 'han_base',
    name: '汉',
    points: '128,429 521,433 510,548 528,626 328,618 128,612 128,539',
    label: [324, 491],
    capital: { name: '南郑', x: 324, y: 548 },
    aliveFrom: -206,
    aliveTo: -202,
  },
  {
    id: 'sanqin',
    name: '三秦',
    points: '120,195 339,209 524,201 510,328 521,433 338,431 128,429 123,312',
    label: [319, 283],
    capital: { name: '废丘', x: 319, y: 338 },
    aliveFrom: -206,
    aliveTo: -205,
  },
  {
    id: 'wei',
    name: '魏',
    points: '524,201 692,192 693,326 510,328',
    label: [606, 229],
    capital: { name: '平阳', x: 606, y: 284 },
    aliveFrom: -206,
    aliveTo: -205,
  },
  {
    id: 'han',
    name: '韩',
    points: '510,328 693,326 710,435 521,433',
    label: [609, 347],
    capital: { name: '阳翟', x: 609, y: 402 },
    aliveFrom: -206,
    aliveTo: -205,
  },
  {
    id: 'yan',
    name: '燕',
    points: '706,65 907,62 983,64 972,208 904,205 692,192',
    label: [841, 118],
    capital: { name: '蓟', x: 841, y: 172 },
    aliveFrom: -206,
    aliveTo: -204,
  },
  {
    id: 'zhao',
    name: '赵',
    points: '323,70 514,74 706,65 692,192 524,201 339,209',
    label: [512, 121],
    capital: { name: '襄国', x: 512, y: 175 },
    aliveFrom: -206,
    aliveTo: -204,
  },
  {
    id: 'qi',
    name: '齐',
    points: '904,205 972,208 975,315 966,435 894,426 892,329',
    label: [934, 286],
    capital: { name: '临淄', x: 934, y: 341 },
    aliveFrom: -206,
    aliveTo: -203,
  },
  {
    id: 'xichu',
    name: '西楚',
    points: '693,326 892,329 894,426 907,554 702,548 710,435',
    label: [801, 406],
    capital: { name: '彭城', x: 801, y: 461 },
    aliveFrom: -206,
    aliveTo: -202,
  },
  {
    id: 'jiujiang',
    name: '九江',
    points: '510,548 907,554 895,619 709,613 528,626',
    label: [704, 578],
    capital: { name: '六', x: 760, y: 596 },
    aliveFrom: -206,
    aliveTo: -202,
  },
]

export const CHUHAN_REGIONS = REGIONS
export const HAN_BASE = REGIONS[0]

export const CHUHAN_MAP: MapSpec = {
  attacker: HAN_BASE,
  regions: REGIONS.filter((r) => r.id !== 'han_base'),
  rivers: [
    'M 80,268 C 200,250 280,232 360,254 C 450,278 520,262 600,278 C 700,298 820,276 960,300',
    'M 300,500 C 400,486 470,502 560,514 C 660,528 740,516 850,530',
  ],
}
