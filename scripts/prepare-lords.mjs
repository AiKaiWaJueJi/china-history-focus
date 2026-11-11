/**
 * 阶段三数据准备：
 *   1. 给周朝 37 位君主补 segmentId（西周 / 东周），供布局切换使用
 *   2. 生成 12 位诸侯（春秋五霸 / 战国七雄）的画像占位图
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(fileURLToPath(import.meta.url))
const PROJECT = join(ROOT, '..')

/* ---------- 1) 给帝王补 segmentId ---------- */
const FILE = join(PROJECT, 'src/data/emperors.zhou.json')
const data = JSON.parse(readFileSync(FILE, 'utf8'))
const segments = JSON.parse(readFileSync(join(PROJECT, 'src/data/segments.zhou.json'), 'utf8')).segments

/** 解析单个年份片段：「前1046」→ -1046 */
const parseYear = (text) => {
  const trimmed = text.trim()
  const match = /^前?\s*(\d+)$/.exec(trimmed)
  if (!match) return null
  const value = Number(match[1])
  return trimmed.startsWith('前') ? -value : value
}

/** 解析纪年：「前1046 — 前1043」→ { startYear, endYear }；单年则两者相同 */
const parseReign = (reign) => {
  const parts = reign.split(/[—–-]/).map((s) => s.trim()).filter(Boolean)
  const startYear = parseYear(parts[0])
  const endYear = parts.length > 1 ? parseYear(parts[parts.length - 1]) : startYear
  return { startYear, endYear: endYear ?? startYear }
}

let missing = 0
for (const emperor of data.emperors) {
  const { startYear, endYear } = parseReign(emperor.reign)
  const year = startYear
  const segment = segments.find((s) => year !== null && year >= s.startYear && year <= s.endYear)
  if (!segment) {
    missing++
    console.log(`  未匹配朝代分段：${emperor.posthumousTitle} (${emperor.reign})`)
    continue
  }
  // 字段顺序：把 segmentId 放在 reign 之后
  const { id, posthumousTitle, personalName, reign, portrait, events } = emperor
  Object.assign(emperor, { id, posthumousTitle, personalName, reign, startYear: year, endYear, segmentId: segment.id, portrait, events })
}

writeFileSync(FILE, JSON.stringify(data, null, 2) + '\n', 'utf8')
const west = data.emperors.filter((e) => e.segmentId === 'seg_xizhou').length
const east = data.emperors.filter((e) => e.segmentId === 'seg_dongzhou').length
console.log(`君主分段：西周 ${west} 位，东周 ${east} 位，未匹配 ${missing} 位`)

/* ---------- 2) 诸侯画像 ---------- */
const lords = JSON.parse(readFileSync(join(PROJECT, 'src/data/lords.zhou.json'), 'utf8')).lords

const hash = (s) => {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return Math.abs(h)
}
const hexToRgb = (hex) => {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
const rgba = (hex, a) => {
  const [r, g, b] = hexToRgb(hex)
  return `rgba(${r},${g},${b},${a})`
}
const lighten = (hex, amount = 0.45) => {
  const [r, g, b] = hexToRgb(hex)
  const mix = (c) => Math.round(c + (255 - c) * amount)
  return `#${[mix(r), mix(g), mix(b)].map((v) => v.toString(16).padStart(2, '0')).join('')}`
}

/**
 * 诸侯画像：与帝王画像区分开——用"城邑 + 旗"的意象，
 * 而不是人像，避免把诸侯当成又一位天子。
 */
const lordPortrait = (lord) => {
  const h = hash(lord.id)
  const accent = lord.accent
  const soft = lighten(accent, 0.5)
  const towers = 3 + (h % 3)

  let walls = ''
  for (let i = 0; i < towers; i++) {
    const x = -120 + i * (240 / Math.max(towers - 1, 1))
    const height = 64 + ((h >> (i * 3)) % 40)
    walls += `<rect x="${x - 20}" y="${300 - height}" width="40" height="${height}" rx="3" fill="${rgba(soft, 0.22)}"/>
              <rect x="${x - 26}" y="${300 - height - 12}" width="52" height="14" rx="3" fill="${rgba(soft, 0.34)}"/>`
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 520" width="420" height="520">
  <defs>
    <linearGradient id="lbg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0b0d11"/>
      <stop offset="55%" stop-color="${rgba(accent, 0.3)}"/>
      <stop offset="100%" stop-color="#07090b"/>
    </linearGradient>
    <radialGradient id="lglow" cx="50%" cy="38%" r="52%">
      <stop offset="0%" stop-color="${rgba(soft, 0.4)}"/>
      <stop offset="100%" stop-color="${rgba(soft, 0)}"/>
    </radialGradient>
    <linearGradient id="fade2" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="rgba(6,8,10,0)"/>
      <stop offset="100%" stop-color="rgba(6,8,10,0.9)"/>
    </linearGradient>
  </defs>

  <rect width="420" height="520" fill="url(#lbg)"/>
  <ellipse cx="210" cy="200" rx="200" ry="180" fill="url(#lglow)"/>

  <!-- 城郭 -->
  <g transform="translate(210 0)">
    <rect x="-150" y="300" width="300" height="6" fill="${rgba(soft, 0.3)}"/>
    ${walls}
    <!-- 旗杆与旗 -->
    <path d="M0 300 L0 150" stroke="${rgba(soft, 0.6)}" stroke-width="3"/>
    <path d="M0 152 L68 172 L0 192 Z" fill="${rgba(soft, 0.5)}"/>
  </g>

  <rect y="360" width="420" height="160" fill="url(#fade2)"/>
</svg>`
}

const dir = join(PROJECT, 'public/portraits')
for (const lord of lords) {
  const file = join(dir, `${lord.id.replace(/_/g, '-')}.svg`)
  writeFileSync(file, lordPortrait(lord), 'utf8')
}
console.log(`诸侯画像：${lords.length} 张`)
