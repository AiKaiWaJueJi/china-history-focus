/**
 * build-nanbei-fall.mjs —— 把南北朝的 8 个易代节点转成 FallStage 过渡章节
 * ---------------------------------------------------------------------------
 * 输入：src/data/nanbei.json 的 nodes[].acts（已写好三幕文本与出处）
 * 输出：src/data/fall.southern_northern.json（key = 节点 id，与 URL 的 chapter 段一致）
 *
 * 每个节点一页过渡：三幕逐字浮现，演完「进入下一段」回时间轴对应页；
 * 589 那章演完直接进收尾沙盘。配图 art 键与 FallStage 的 ART 表对应。
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(fileURLToPath(import.meta.url))
const PROJECT = join(ROOT, '..')
const data = JSON.parse(readFileSync(join(PROJECT, 'src/data/nanbei.json'), 'utf8'))

/** 每章的页头、三幕年份、配图键、出口 */
const META = {
  n439: {
    subtitle: '439 · 十六国终',
    lede: '拓跋焘三征，凉州入魏。十六国至此终局，北方一统，南北对峙的格局自此定型。',
    years: ['426 — 439 年', '439 年', '439 — 450 年'],
    enterLabel: '进入 439—479 年',
  },
  n479: {
    subtitle: '479 · 宋亡齐立',
    lede: '宋顺帝禅位于萧道成，刘宋六十年而亡，南朝入齐。',
    years: ['477 — 479 年', '479 年', '479 — 482 年'],
    enterLabel: '进入 479—502 年',
  },
  n502: {
    subtitle: '502 · 齐亡梁立',
    lede: '齐和帝禅位于萧衍，萧齐二十三年而亡，梁武帝开天监之治。',
    years: ['501 — 502 年', '502 年', '502 — 520 年'],
    enterLabel: '进入 502—534 年',
  },
  n534: {
    subtitle: '534 · 魏分东西',
    lede: '孝武帝西奔长安，高欢另立东魏，北魏一分为二。',
    years: ['528 — 534 年', '534 年', '534 — 550 年'],
    enterLabel: '进入 534—550 年',
  },
  n550: {
    subtitle: '550 · 东魏亡，北齐立',
    lede: '高洋受禅于东魏，国号齐。北齐代东魏，与西魏·北周隔河对峙。',
    years: ['547 — 550 年', '550 年', '550 — 577 年'],
    enterLabel: '进入 550—557 年',
  },
  n557: {
    subtitle: '557 · 梁亡陈立，周代西魏',
    lede: '侯景乱后梁室倾覆：陈霸先代梁建陈，宇文氏代西魏建周，南北同年易代。',
    years: ['548 — 552 年', '552 — 557 年', '557 年'],
    enterLabel: '进入 557—577 年',
  },
  n577: {
    subtitle: '577 · 周灭北齐',
    lede: '周武帝亲征，克晋阳、邺城，北齐亡。北方复归一统。',
    years: ['565 — 576 年', '575 — 577 年', '577 年'],
    enterLabel: '进入 577—589 年',
  },
  n589: {
    subtitle: '589 · 隋灭陈',
    lede: '隋军渡江，建康陷落，陈后主出降。自永嘉以来近三百年的分裂至此终结。',
    years: ['581 年', '588 — 589 年', '589 年'],
    enterLabel: '进入收尾沙盘 · 隋灭陈',
  },
}

/** 节点 → 时间轴页码（0 基）：节点 n 收在页 n，下一页是 n+1 */
const PAGES = [
  { from: 420, to: 439 },
  { from: 439, to: 479 },
  { from: 479, to: 502 },
  { from: 502, to: 534 },
  { from: 534, to: 550 },
  { from: 550, to: 557 },
  { from: 557, to: 577 },
  { from: 577, to: 589 },
]

const out = {}

for (const node of data.nodes) {
  const meta = META[node.id]
  const pageIndex = PAGES.findIndex((p) => p.to === node.year)
  if (!meta || pageIndex < 0) throw new Error(`节点 ${node.id} 缺少元信息或页码`)

  const isLast = pageIndex === PAGES.length - 1
  out[node.id] = {
    dynastyId: 'southern_northern',
    title: node.title,
    subtitle: meta.subtitle,
    lede: meta.lede,
    acts: node.acts.map((act, i) => ({
      id: `${node.id}_a${i + 1}`,
      art: `nb${node.id}_${i + 1}`,
      year: meta.years[i],
      heading: act.heading,
      lines: act.lines,
      source: act.source,
    })),
    enterLabel: meta.enterLabel,
    enterHint: isLast ? '隋灭陈' : '下一段帝王',
    next: isLast ? { kind: 'endgame' } : { kind: 'timeline', page: pageIndex + 1 },
    back: { page: pageIndex },
  }
}

const file = join(PROJECT, 'src/data/fall.southern_northern.json')
writeFileSync(file, JSON.stringify(out, null, 2) + '\n', 'utf8')
console.log(`写出 ${Object.keys(out).length} 章：${Object.keys(out).join(', ')}`)
