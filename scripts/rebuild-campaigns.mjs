/**
 * rebuild-campaigns.mjs —— 重建战役序列
 * ===========================================================================
 * 本版规则：
 *   1. 所有秦军路线一律从**咸阳**出发（percentage: 25, 62.8），
 *      经关隘/要地折向敌国都城，绝不凭空出现在敌国境内。
 *   2. 路径是折线（points ≥ 2 点），支持"咸阳 → 井陉 → 邯郸"这种多段。
 *   3. 敌国反击从都城出发，指向秦军来路 —— 起点同样在敌国境内，合理。
 *   4. allies：援军节点（国、将、兵、理由、路线）。
 *
 * 坐标全是**版图百分比**（0-100），运行时换算成 viewBox（1000×640）：
 *   咸阳   25.0 / 62.8      井陉  44.8 / 26.3      邯郸  50.0 / 36.3
 *   宛城   50.0 / 65.6      新郑  59.6 / 64.1      荥阳  56.0 / 46.9
 *   大梁   61.2 / 46.9      陈    56.0 / 78.1      寿春  72.0 / 78.1
 *   蓟     86.0 / 20.3      代    58.0 / 18.8      临淄  90.6 / 46.9
 *   济西   82.0 / 46.5      辽东  93.0 / 13.0
 * 想微调就把这些常量改掉，改完重跑本脚本。
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const FILE = join(dirname(fileURLToPath(import.meta.url)), '../src/data/endgame.zhou.json')

/* ---------------- 地名 → 百分比坐标（微调改这里） ---------------- */
const P = {
  咸阳: [25.0, 62.8],
  井陉: [44.8, 26.3],
  邯郸: [50.0, 36.3],
  宛城: [50.0, 65.6],
  新郑: [59.6, 64.1],
  荥阳: [56.0, 46.9],
  大梁: [61.2, 46.9],
  陈: [56.0, 78.1],
  寿春: [72.0, 78.1],
  蓟: [86.0, 20.3],
  代: [58.0, 18.8],
  临淄: [90.6, 46.9],
  济西: [82.0, 46.5],
  辽东: [93.0, 13.0],
}

const pt = (name) => ({ x: P[name][0], y: P[name][1] })

/** 折线：按地名依次取坐标 */
const route = (...names) => names.map(pt)

const CAMPAIGNS = {
  e_han: [
    {
      phase: 1, side: 'qin', general: '内史腾', from: '咸阳', to: '宛城',
      points: route('咸阳', '宛城', '新郑'),
      result: '秦军自咸阳出关，南下取宛，断韩之右臂',
    },
    {
      phase: 2, side: 'enemy', general: '韩王安', from: '新郑', to: '宛城',
      points: route('新郑', '宛城'),
      result: '韩军出城邀击，接战即溃',
    },
    {
      phase: 3, side: 'qin', general: '内史腾', from: '宛城', to: '新郑',
      points: route('宛城', '新郑'),
      result: '新郑城破，韩王安出降，韩亡',
    },
  ],
  e_zhao: [
    {
      phase: 1, side: 'qin', general: '王翦', from: '咸阳', to: '邯郸',
      points: route('咸阳', '井陉', '邯郸'),
      result: '秦军出井陉，直下邯郸',
    },
    {
      phase: 2, side: 'enemy', general: '李牧', from: '邯郸', to: '井陉',
      points: route('邯郸', '井陉'),
      result: '李牧据险反击，秦军受挫',
      allies: [
        {
          nation: '代', general: '公子嘉', troops: '五万',
          reason: '赵室北奔代地，收残部南下策应',
          points: route('代', '邯郸'),
        },
      ],
    },
    {
      phase: 3, side: 'qin', general: '王翦', from: '井陉', to: '邯郸',
      points: route('井陉', '邯郸'),
      result: '赵军大败，邯郸陷落，赵亡',
    },
  ],
  e_wei: [
    {
      phase: 1, side: 'qin', general: '王贲', from: '咸阳', to: '大梁',
      points: route('咸阳', '荥阳', '大梁'),
      result: '秦军东出荥阳，进围大梁',
    },
    {
      phase: 2, side: 'enemy', general: '魏王假', from: '大梁', to: '荥阳',
      points: route('大梁', '荥阳'),
      result: '魏军突围不成，退守孤城',
    },
    {
      phase: 3, side: 'qin', general: '王贲', from: '荥阳', to: '大梁',
      points: route('荥阳', '大梁'),
      result: '决河堤灌城，大梁城坏，魏亡',
    },
  ],
  e_chu: [
    {
      phase: 1, side: 'qin', general: '王翦', from: '咸阳', to: '寿春',
      points: route('咸阳', '陈', '寿春'),
      result: '六十万秦军自咸阳南压，屯于陈',
    },
    {
      phase: 2, side: 'enemy', general: '项燕', from: '寿春', to: '陈',
      points: route('寿春', '陈'),
      result: '项燕反攻，秦军坚壁不战',
    },
    {
      phase: 3, side: 'qin', general: '王翦', from: '陈', to: '寿春',
      points: route('陈', '寿春'),
      result: '破寿春，虏楚王负刍，楚亡',
    },
  ],
  e_yan: [
    {
      phase: 1, side: 'qin', general: '王贲', from: '咸阳', to: '蓟',
      points: route('咸阳', '代', '蓟'),
      result: '秦军北出，直趋燕都蓟城',
    },
    {
      phase: 2, side: 'enemy', general: '燕王喜', from: '辽东', to: '蓟',
      points: route('辽东', '蓟'),
      result: '燕军回援不及',
      allies: [
        {
          nation: '代', general: '公子嘉', troops: '残部数万',
          reason: '唇亡齿寒，代军东援燕室',
          points: route('代', '蓟'),
        },
      ],
    },
    {
      phase: 3, side: 'qin', general: '王贲', from: '蓟', to: '辽东',
      points: route('蓟', '辽东'),
      result: '追至辽东，虏燕王喜，燕亡',
    },
  ],
  e_qi: [
    {
      phase: 1, side: 'qin', general: '王贲', from: '咸阳', to: '临淄',
      points: route('咸阳', '济西', '临淄'),
      result: '秦军自燕南下，避实击虚，直取临淄',
    },
    {
      phase: 2, side: 'enemy', general: '齐王建', from: '临淄', to: '济西',
      points: route('临淄', '济西'),
      result: '齐军西守，不战自溃',
    },
    {
      phase: 3, side: 'qin', general: '王贲', from: '济西', to: '临淄',
      points: route('济西', '临淄'),
      result: '齐王建出降，六国尽亡',
    },
  ],
}

const data = JSON.parse(readFileSync(FILE, 'utf8'))

for (const event of data.events) {
  const rows = CAMPAIGNS[event.id]
  if (!rows) continue
  event.campaigns = rows.map((r) => ({
    ...r,
    points: r.points.map((p) => ({ x: Number(p.x.toFixed(1)), y: Number(p.y.toFixed(1)) })),
    ...(r.allies
      ? {
          allies: r.allies.map((a) => ({
            ...a,
            points: a.points.map((p) => ({ x: Number(p.x.toFixed(1)), y: Number(p.y.toFixed(1)) })),
          })),
        }
      : {}),
  }))
}

writeFileSync(FILE, JSON.stringify(data, null, 2) + '\n', 'utf8')
console.log('campaigns 已重建：' + data.events.filter((e) => e.campaigns?.length).length + ' 个事件')
