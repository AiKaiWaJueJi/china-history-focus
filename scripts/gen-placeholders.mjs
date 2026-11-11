/**
 * 占位图生成器
 * ---------------------------------------------------------------------------
 * 为每个朝代（文物）与帝王（画像）生成一张确定性的抽象 SVG 占位图。
 * 目的：阶段一不需要真实文物照片，但**必须**让背景有"材质感"，
 * 否则 hover 时的 1.05 倍缩放与遮罩调整看不出效果。
 *
 * 设计取向：暗底 + 同类色系 + 一个几何母题（环 / 圭 / 格），
 * 每张图用 id 的哈希决定母线角度与偏移，因此每块面板都略有差异，
 * 但整体统一在同一套"博物馆暗调"里。
 *
 * 用户后续只需把 public/artifacts/<id>.svg 换成同名 jpg/png 并改数据即可。
 */
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(fileURLToPath(import.meta.url))
const PROJECT = join(ROOT, '..')
const data = JSON.parse(readFileSync(join(PROJECT, 'src/data/history.data.json'), 'utf8'))

/** 稳定哈希：同一个 id 永远得到同一张图 */
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

/**
 * 朝代文物占位图：竖向构图（面板是竖长条），
 * 中心一枚"器物轮廓"，外围同心环模拟灯光下的青铜/瓷器反光。
 */
function artifactSvg(d) {
  const h = hash(d.id)
  const tilt = (h % 18) - 9
  const cx = 200 + ((h >> 3) % 24) - 12
  const cy = 340 + ((h >> 7) % 40) - 20
  // 确定性斑点（铜锈/釉面质感），避免纯渐变看起来像色块
  let speckles = ''
  let seed = h
  for (let i = 0; i < 46; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    const x = (seed >> 8) % 400
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    const y = (seed >> 8) % 700
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    const r = 0.6 + ((seed >> 8) % 22) / 10
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    const o = 0.04 + ((seed >> 8) % 10) / 100
    speckles += `<circle cx="${x}" cy="${y}" r="${r.toFixed(1)}" fill="${rgba(d.accentSoft, o)}"/>`
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 700" width="400" height="700">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0.35" y2="1">
      <stop offset="0%" stop-color="#05070a"/>
      <stop offset="38%" stop-color="${rgba(d.accent, 0.42)}"/>
      <stop offset="72%" stop-color="${rgba(d.accent, 0.16)}"/>
      <stop offset="100%" stop-color="#040506"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="40%" r="52%">
      <stop offset="0%" stop-color="${rgba(d.accentSoft, 0.34)}"/>
      <stop offset="58%" stop-color="${rgba(d.accent, 0.10)}"/>
      <stop offset="100%" stop-color="${rgba(d.accent, 0)}"/>
    </radialGradient>
    <linearGradient id="vessel" x1="0.15" y1="0" x2="0.85" y2="1">
      <stop offset="0%" stop-color="${rgba(d.accentSoft, 0.72)}"/>
      <stop offset="42%" stop-color="${rgba(d.accent, 0.52)}"/>
      <stop offset="100%" stop-color="${rgba(d.accent, 0.10)}"/>
    </linearGradient>
    <radialGradient id="vig" cx="50%" cy="42%" r="66%">
      <stop offset="55%" stop-color="rgba(0,0,0,0)"/>
      <stop offset="100%" stop-color="rgba(0,0,0,0.88)"/>
    </radialGradient>
    <filter id="soft"><feGaussianBlur stdDeviation="16"/></filter>
    <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="rgba(5,7,10,0)"/>
      <stop offset="100%" stop-color="rgba(5,7,10,0.96)"/>
    </linearGradient>
  </defs>

  <rect width="400" height="700" fill="url(#bg)"/>
  <ellipse cx="${cx}" cy="${cy - 60}" rx="250" ry="280" fill="url(#glow)"/>
  ${speckles}

  <!-- 同心环：展柜灯光 -->
  <g fill="none" stroke="${rgba(d.accentSoft, 0.13)}" stroke-width="1">
    <circle cx="${cx}" cy="${cy}" r="118"/>
    <circle cx="${cx}" cy="${cy}" r="168"/>
    <circle cx="${cx}" cy="${cy}" r="232"/>
  </g>

  <!-- 器物剪影：鼎 / 罐 的抽象轮廓，强调边缘光 -->
  <!-- 缩放 0.62：面板只露出背景图中间的窄条（未悬浮时约 30% 宽度），
       器物必须在这么窄的裁切下依然完整可辨 -->
  <g transform="translate(${cx} ${cy}) rotate(${tilt / 5}) scale(0.62)">
    <ellipse cx="0" cy="128" rx="104" ry="18" fill="rgba(0,0,0,0.72)" filter="url(#soft)"/>

    <path d="M-80 -66 Q-96 44 -58 98 L58 98 Q96 44 80 -66 Z" fill="url(#vessel)"/>
    <path d="M-80 -66 Q-96 44 -58 98 L58 98 Q96 44 80 -66 Z" fill="none" stroke="${rgba(d.accentSoft, 0.72)}" stroke-width="1.8"/>
    <!-- 腹部高光：一条竖向反光，制造金属/釉面的立体感 -->
    <path d="M-40 -40 Q-30 30 -34 86" fill="none" stroke="${rgba(d.accentSoft, 0.38)}" stroke-width="7" stroke-linecap="round" filter="url(#soft)"/>

    <!-- 口沿 -->
    <rect x="-92" y="-84" width="184" height="20" rx="7" fill="${rgba(d.accentSoft, 0.42)}"/>
    <rect x="-92" y="-84" width="184" height="5" rx="2.5" fill="${rgba(d.accentSoft, 0.72)}"/>
    <!-- 立耳 -->
    <path d="M-56 -84 L-56 -124 Q-56 -132 -48 -132 M56 -84 L56 -124 Q56 -132 48 -132" fill="none" stroke="${rgba(d.accentSoft, 0.62)}" stroke-width="8" stroke-linecap="round"/>
    <!-- 三足 -->
    <path d="M-38 98 L-33 140 M38 98 L33 140 M0 98 L0 146" stroke="${rgba(d.accentSoft, 0.55)}" stroke-width="9" stroke-linecap="round"/>
  </g>

  <rect width="400" height="700" fill="url(#vig)"/>
  <rect y="430" width="400" height="270" fill="url(#fade)"/>
</svg>`
}
/**
 * 帝王画像占位图：横向构图（时间轴的每格是横向矩形），
 * 一个"人形轮廓" + 冠冕横线，避免纯色块。
 */
function portraitSvg(e, d) {
  const h = hash(e.id)
  const sway = (h % 20) - 10
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 520" width="420" height="520">
  <defs>
    <linearGradient id="pbg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0b0d11"/>
      <stop offset="55%" stop-color="${rgba(d.accent, 0.26)}"/>
      <stop offset="100%" stop-color="#07090b"/>
    </linearGradient>
    <radialGradient id="pglow" cx="50%" cy="34%" r="48%">
      <stop offset="0%" stop-color="${rgba(d.accentSoft, 0.42)}"/>
      <stop offset="100%" stop-color="${rgba(d.accentSoft, 0)}"/>
    </radialGradient>
    <linearGradient id="robe" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${rgba(d.accentSoft, 0.34)}"/>
      <stop offset="100%" stop-color="${rgba(d.accent, 0.12)}"/>
    </linearGradient>
  </defs>

  <rect width="420" height="520" fill="url(#pbg)"/>
  <ellipse cx="210" cy="170" rx="190" ry="170" fill="url(#pglow)"/>

  <g transform="translate(${210 + sway} 0)" opacity="0.9">
    <!-- 冠 -->
    <rect x="-58" y="96" width="116" height="16" rx="4" fill="${rgba(d.accentSoft, 0.5)}"/>
    <rect x="-34" y="80" width="68" height="18" rx="4" fill="${rgba(d.accentSoft, 0.34)}"/>
    <!-- 头 -->
    <ellipse cx="0" cy="152" rx="34" ry="42" fill="${rgba(d.accentSoft, 0.30)}"/>
    <!-- 肩与袍 -->
    <path d="M-96 300 Q-70 196 0 190 Q70 196 96 300 L104 520 L-104 520 Z" fill="url(#robe)"/>
    <path d="M-30 196 L0 300 L30 196" fill="none" stroke="${rgba(d.accentSoft, 0.35)}" stroke-width="2"/>
  </g>

  <rect y="380" width="420" height="140" fill="rgba(6,8,10,0.86)"/>
</svg>`
}

for (const d of data.dynasties) {
  const dir = join(PROJECT, 'public/artifacts')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, `${d.id.replace('d_', '')}.svg`), artifactSvg(d))
}

for (const e of data.emperors) {
  const d = data.dynasties.find((x) => x.id === e.dynastyId)
  const dir = join(PROJECT, 'public/portraits')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, `${e.id.replace('e_', '').replace(/_/g, '-')}.svg`), portraitSvg(e, d))
}

console.log(`artifacts: ${data.dynasties.length}, portraits: ${data.emperors.length}`)
