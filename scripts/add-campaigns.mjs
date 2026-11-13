/**
 * add-campaigns.mjs —— 给六个灭国战报补「战役序列」
 * ---------------------------------------------------------------------------
 * 每国三段：秦军进攻 → 敌国反击 → 秦军定局。
 * 坐标为**版图百分比**（0-100），运行时再换算成 viewBox（1000×640）。
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(fileURLToPath(import.meta.url))
const FILE = join(ROOT, '../src/data/endgame.zhou.json')

const CAMPAIGNS = {
  e_han: [
    {
      phase: 1, side: 'qin', general: '内史腾',
      from: '宛城', to: '新郑',
      startPoint: { x: 44, y: 52 }, endPoint: { x: 59, y: 64 },
      result: '秦军自南阳北上，直趋韩都',
    },
    {
      phase: 2, side: 'enemy', general: '韩王安',
      from: '新郑', to: '宛城',
      startPoint: { x: 59, y: 64 }, endPoint: { x: 44, y: 52 },
      result: '韩军出城邀击，接战即溃',
    },
    {
      phase: 3, side: 'qin', general: '内史腾',
      from: '宛城', to: '新郑',
      startPoint: { x: 46, y: 54 }, endPoint: { x: 59, y: 64 },
      result: '新郑城破，韩王安出降',
    },
  ],
  e_zhao: [
    {
      phase: 1, side: 'qin', general: '王翦',
      from: '井陉', to: '邯郸',
      startPoint: { x: 30, y: 20 }, endPoint: { x: 40, y: 35 },
      result: '大破赵军',
    },
    {
      phase: 2, side: 'enemy', general: '李牧',
      from: '邯郸', to: '井陉',
      startPoint: { x: 40, y: 35 }, endPoint: { x: 30, y: 20 },
      result: '赵军反击，秦军受挫',
    },
    {
      phase: 3, side: 'qin', general: '王翦',
      from: '井陉', to: '邯郸',
      startPoint: { x: 30, y: 20 }, endPoint: { x: 40, y: 35 },
      result: '赵军大败，赵国灭亡',
    },
  ],
  e_wei: [
    {
      phase: 1, side: 'qin', general: '王贲',
      from: '荥阳', to: '大梁',
      startPoint: { x: 52, y: 48 }, endPoint: { x: 64, y: 47 },
      result: '秦军东进，围大梁',
    },
    {
      phase: 2, side: 'enemy', general: '魏王假',
      from: '大梁', to: '荥阳',
      startPoint: { x: 64, y: 47 }, endPoint: { x: 52, y: 48 },
      result: '魏军突围不成，退守孤城',
    },
    {
      phase: 3, side: 'qin', general: '王贲',
      from: '荥阳', to: '大梁',
      startPoint: { x: 57, y: 44 }, endPoint: { x: 64, y: 47 },
      result: '决河堤灌城，魏亡',
    },
  ],
  e_chu: [
    {
      phase: 1, side: 'qin', general: '王翦',
      from: '陈', to: '寿春',
      startPoint: { x: 56, y: 66 }, endPoint: { x: 72, y: 78 },
      result: '六十万秦军南压',
    },
    {
      phase: 2, side: 'enemy', general: '项燕',
      from: '寿春', to: '陈',
      startPoint: { x: 72, y: 78 }, endPoint: { x: 56, y: 66 },
      result: '楚军反击，秦军坚壁不战',
    },
    {
      phase: 3, side: 'qin', general: '王翦',
      from: '陈', to: '寿春',
      startPoint: { x: 56, y: 66 }, endPoint: { x: 72, y: 78 },
      result: '破寿春，虏楚王负刍',
    },
  ],
  e_yan: [
    {
      phase: 1, side: 'qin', general: '王贲',
      from: '蓟', to: '辽东',
      startPoint: { x: 86, y: 20 }, endPoint: { x: 93, y: 13 },
      result: '秦军东追，燕室北遁',
    },
    {
      phase: 2, side: 'enemy', general: '燕王喜',
      from: '辽东', to: '蓟',
      startPoint: { x: 93, y: 13 }, endPoint: { x: 86, y: 20 },
      result: '燕军回援不及',
    },
    {
      phase: 3, side: 'qin', general: '王贲',
      from: '蓟', to: '辽东',
      startPoint: { x: 88, y: 17 }, endPoint: { x: 93, y: 13 },
      result: '追至辽东，虏燕王喜',
    },
  ],
  e_qi: [
    {
      phase: 1, side: 'qin', general: '王贲',
      from: '燕南', to: '临淄',
      startPoint: { x: 85, y: 38 }, endPoint: { x: 89, y: 52 },
      result: '秦军自燕南下，直取临淄',
    },
    {
      phase: 2, side: 'enemy', general: '齐王建',
      from: '临淄', to: '济西',
      startPoint: { x: 89, y: 52 }, endPoint: { x: 82, y: 50 },
      result: '齐军西守，不战自溃',
    },
    {
      phase: 3, side: 'qin', general: '王贲',
      from: '济西', to: '临淄',
      startPoint: { x: 82, y: 50 }, endPoint: { x: 89, y: 52 },
      result: '齐王建出降，六国尽亡',
    },
  ],
}

const data = JSON.parse(readFileSync(FILE, 'utf8'))
let count = 0

data.events = data.events.map((event) => {
  const campaigns = CAMPAIGNS[event.id]
  if (!campaigns) {
    console.log(`  没有战役数据：${event.id}`)
    return event
  }
  count++
  // 展开语法保留既有字段
  return { ...event, campaigns }
})

writeFileSync(FILE, JSON.stringify(data, null, 2) + '\n', 'utf8')
console.log(`已补 ${count}/${data.events.length} 组战役序列`)
