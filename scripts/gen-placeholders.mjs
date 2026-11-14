/**
 * 占位图生成器 —— 每个朝代一张"贴合代表器物"的插图
 * ===========================================================================
 * 需求：下方文字写的是"青铜鼎"，背景就该是鼎；写"连弩"就该是弩。
 * 因此这里为 13 个朝代各画一个矢量母题（motif），而不是共用一张通用图形。
 *
 * 构图约束（很关键）：
 *   面板很窄（13 个模块并排时每块约 110px），背景图实际只露出中间约 23% 的宽度。
 *   所以母题必须画在**居中的窄幅区域**内（本文件用 180×220 的局部坐标系，
 *   再统一缩放 0.5），否则未悬浮时只能看到图形中间的一条竖线。
 *
 * 用户替换真实文物照片时，只要覆盖 public/artifacts/<id>.svg（或改成 jpg 并改
 * history.data.json 里的 artifact 字段），无需改任何组件代码。
 */
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(fileURLToPath(import.meta.url))
const PROJECT = join(ROOT, '..')
const data = JSON.parse(readFileSync(join(PROJECT, 'src/data/history.data.json'), 'utf8'))

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

/* ==========================================================================
   母题库：每个函数返回一段 SVG，坐标以 (0,0) 为中心，约 180 宽 × 220 高
   c.soft = 辅色（高光/釉面）  c.deep = 主色  c.line = 描边
   ========================================================================== */

const MOTIFS = {
  /** 周 · 青铜鼎 */
  ding: (c) => `
    <ellipse cx="0" cy="120" rx="86" ry="14" fill="rgba(0,0,0,0.65)" filter="url(#soft)"/>
    <path d="M-70 -50 Q-84 40 -50 86 L50 86 Q84 40 70 -50 Z" fill="url(#vessel)" stroke="${c.line}" stroke-width="1.6"/>
    <rect x="-80" y="-66" width="160" height="16" rx="6" fill="${c.soft}" opacity="0.55"/>
    <rect x="-80" y="-66" width="160" height="5" rx="2.5" fill="${c.soft}" opacity="0.9"/>
    <path d="M-48 -66 L-48 -98 Q-48 -106 -40 -106" fill="none" stroke="${c.soft}" stroke-width="7" stroke-linecap="round" opacity="0.8"/>
    <path d="M48 -66 L48 -98 Q48 -106 40 -106" fill="none" stroke="${c.soft}" stroke-width="7" stroke-linecap="round" opacity="0.8"/>
    <path d="M-32 86 L-28 124 M32 86 L28 124 M0 86 L0 130" stroke="${c.soft}" stroke-width="8" stroke-linecap="round" opacity="0.7"/>`,

  /** 秦 · 兵马俑 */
  warrior: (c) => `
    <ellipse cx="0" cy="118" rx="54" ry="10" fill="rgba(0,0,0,0.6)" filter="url(#soft)"/>
    <path d="M-26 -104 Q0 -126 26 -104 L26 -86 L-26 -86 Z" fill="${c.soft}" opacity="0.75"/>
    <ellipse cx="0" cy="-72" rx="19" ry="23" fill="${c.soft}" opacity="0.6"/>
    <path d="M-34 -50 Q0 -64 34 -50 L40 62 L-40 62 Z" fill="url(#vessel)" stroke="${c.line}" stroke-width="1.5"/>
    <path d="M-34 -44 L-54 26 M34 -44 L54 26" stroke="${c.soft}" stroke-width="9" stroke-linecap="round" opacity="0.55"/>
    <rect x="-48" y="62" width="96" height="13" rx="4" fill="${c.deep}" opacity="0.75"/>
    <path d="M-10 -46 L-10 58 M10 -46 L10 58" stroke="${c.line}" stroke-width="1" opacity="0.5"/>`,

  /** 汉 · 汉剑 */
  sword: (c) => `
    <ellipse cx="0" cy="122" rx="40" ry="9" fill="rgba(0,0,0,0.6)" filter="url(#soft)"/>
    <path d="M-9 -104 L9 -104 L11 34 L0 52 L-11 34 Z" fill="${c.soft}" opacity="0.55"/>
    <path d="M0 -104 L0 48" stroke="${c.soft}" stroke-width="1.6" opacity="0.9"/>
    <rect x="-30" y="34" width="60" height="11" rx="5" fill="${c.deep}" opacity="0.9"/>
    <rect x="-7" y="45" width="14" height="52" rx="6" fill="${c.deep}" opacity="0.7"/>
    <circle cx="0" cy="102" r="9" fill="${c.soft}" opacity="0.6"/>`,

  /** 三国 · 连弩（竖置，适配窄幅） */
  crossbow: (c) => `
    <rect x="-9" y="-72" width="18" height="150" rx="5" fill="${c.deep}" opacity="0.8" stroke="${c.line}" stroke-width="1.2"/>
    <path d="M-62 -74 Q0 -112 62 -74" fill="none" stroke="${c.soft}" stroke-width="8" stroke-linecap="round" opacity="0.75"/>
    <path d="M-62 -74 L0 -34 L62 -74" fill="none" stroke="${c.soft}" stroke-width="2" opacity="0.6"/>
    <path d="M0 -96 L0 24" stroke="${c.soft}" stroke-width="3" opacity="0.85"/>
    <path d="M0 24 L-14 34 L-2 42 Z" fill="${c.soft}" opacity="0.8"/>
    <path d="M-9 52 L-26 72 L-9 78" fill="none" stroke="${c.soft}" stroke-width="5" stroke-linecap="round" opacity="0.7"/>`,

  /** 晋 · 青瓷瓶（梅瓶） */
  vase: (c) => `
    <ellipse cx="0" cy="112" rx="52" ry="11" fill="rgba(0,0,0,0.6)" filter="url(#soft)"/>
    <rect x="-13" y="-108" width="26" height="42" rx="8" fill="${c.soft}" opacity="0.5"/>
    <path d="M-13 -68 Q-62 -48 -52 28 Q-44 82 0 90 Q44 82 52 28 Q62 -48 13 -68 Z" fill="url(#vessel)" stroke="${c.line}" stroke-width="1.5"/>
    <path d="M-13 -66 Q0 -58 13 -66" fill="none" stroke="${c.line}" stroke-width="1.4" opacity="0.7"/>
    <path d="M-30 -30 Q-38 20 -22 66" fill="none" stroke="${c.soft}" stroke-width="6" stroke-linecap="round" opacity="0.35" filter="url(#soft)"/>
    <rect x="-22" y="90" width="44" height="12" rx="4" fill="${c.deep}" opacity="0.7"/>`,

  /** 南北朝 · 石窟佛像 */
  buddha: (c) => `
    <circle cx="0" cy="-42" r="78" fill="none" stroke="${c.soft}" stroke-width="2" opacity="0.35"/>
    <circle cx="0" cy="-42" r="64" fill="none" stroke="${c.soft}" stroke-width="1" opacity="0.22"/>
    <circle cx="0" cy="-58" r="20" fill="${c.soft}" opacity="0.65"/>
    <path d="M-36 -10 Q-30 -36 0 -40 Q30 -36 36 -10 Z" fill="url(#vessel)" stroke="${c.line}" stroke-width="1.4"/>
    <path d="M-50 22 Q0 52 50 22 L56 40 Q0 72 -56 40 Z" fill="${c.deep}" opacity="0.6"/>
    <path d="M-64 54 Q0 82 64 54" fill="none" stroke="${c.soft}" stroke-width="3" opacity="0.5"/>
    <path d="M-20 26 L20 26" stroke="${c.soft}" stroke-width="2" opacity="0.4"/>`,

  /** 隋 · 科举卷轴 */
  scroll: (c) => `
    <rect x="-44" y="-96" width="88" height="192" fill="${c.soft}" opacity="0.16"/>
    <rect x="-56" y="-106" width="112" height="14" rx="7" fill="${c.deep}" opacity="0.85"/>
    <rect x="-56" y="92" width="112" height="14" rx="7" fill="${c.deep}" opacity="0.85"/>
    <path d="M-34 -78 L34 -78 M-34 -56 L34 -56 M-34 -34 L20 -34 M-34 -12 L34 -12 M-34 10 L34 10 M-34 32 L20 32 M-34 54 L34 54 M-34 76 L34 76"
          stroke="${c.soft}" stroke-width="2.2" opacity="0.45" stroke-linecap="round"/>
    <circle cx="26" cy="62" r="13" fill="none" stroke="${c.soft}" stroke-width="2" opacity="0.6"/>`,

  /** 唐 · 唐三彩马 */
  horse: (c) => `
    <ellipse cx="0" cy="108" rx="70" ry="10" fill="rgba(0,0,0,0.6)" filter="url(#soft)"/>
    <!-- 躯干 -->
    <ellipse cx="-6" cy="6" rx="58" ry="38" fill="url(#vessel)" stroke="${c.line}" stroke-width="1.4"/>
    <!-- 颈：短而粗，避免看起来像长颈动物 -->
    <path d="M30 -18 Q46 -30 48 -46" fill="none" stroke="${c.soft}" stroke-width="34" stroke-linecap="round" opacity="0.5"/>
    <!-- 头：加大并压低头部角度，形成马的口鼻轮廓 -->
    <path d="M38 -52 Q52 -66 66 -58 Q76 -50 66 -40 Q52 -34 40 -42 Z" fill="${c.soft}" opacity="0.85"/>
    <path d="M64 -44 Q74 -42 76 -34 Q70 -30 62 -34 Z" fill="${c.soft}" opacity="0.7"/>
    <circle cx="58" cy="-52" r="2.8" fill="rgba(0,0,0,0.65)"/>
    <!-- 耳：立在头顶后侧 -->
    <path d="M44 -62 L40 -76 M54 -62 L56 -76" stroke="${c.soft}" stroke-width="3.6" stroke-linecap="round" opacity="0.85"/>
    <!-- 鬃毛 -->
    <path d="M34 -44 L26 -16" stroke="${c.soft}" stroke-width="6" stroke-linecap="round" opacity="0.45"/>
    <!-- 尾 -->
    <path d="M-60 0 Q-88 10 -86 46" fill="none" stroke="${c.soft}" stroke-width="10" stroke-linecap="round" opacity="0.6"/>
    <!-- 四腿：短而粗，符合陶马造型 -->
    <path d="M-44 34 L-48 88 M-18 40 L-20 90 M18 40 L22 90 M44 34 L50 88"
          stroke="${c.soft}" stroke-width="12" stroke-linecap="round" opacity="0.62"/>`,

  /** 五代 · 秘色瓷（碗） */
  bowl: (c) => `
    <ellipse cx="0" cy="104" rx="46" ry="10" fill="rgba(0,0,0,0.6)" filter="url(#soft)"/>
    <path d="M-72 -34 Q0 52 72 -34 Z" fill="url(#vessel)" stroke="${c.line}" stroke-width="1.5"/>
    <ellipse cx="0" cy="-34" rx="72" ry="12" fill="${c.soft}" opacity="0.4"/>
    <ellipse cx="0" cy="-34" rx="72" ry="12" fill="none" stroke="${c.soft}" stroke-width="1.6" opacity="0.75"/>
    <rect x="-22" y="10" width="44" height="12" rx="4" fill="${c.deep}" opacity="0.7"/>
    <path d="M-44 -18 Q-20 6 -40 26" fill="none" stroke="${c.soft}" stroke-width="5" stroke-linecap="round" opacity="0.3" filter="url(#soft)"/>`,

  /** 宋 · 汝窑洗（浅盘 + 开片） */
  dish: (c) => `
    <ellipse cx="0" cy="96" rx="52" ry="10" fill="rgba(0,0,0,0.6)" filter="url(#soft)"/>
    <ellipse cx="0" cy="-20" rx="66" ry="20" fill="${c.soft}" opacity="0.28"/>
    <path d="M-66 -20 Q0 34 66 -20" fill="url(#vessel)" stroke="${c.line}" stroke-width="1.5"/>
    <ellipse cx="0" cy="-20" rx="66" ry="20" fill="none" stroke="${c.soft}" stroke-width="1.8" opacity="0.8"/>
    <path d="M-40 -24 L-24 -8 L-8 -26 L8 -6 L26 -24 L42 -10" fill="none" stroke="${c.soft}" stroke-width="1" opacity="0.45"/>
    <path d="M-26 -30 L-34 -6 M12 -32 L4 -8" fill="none" stroke="${c.soft}" stroke-width="0.9" opacity="0.3"/>
    <rect x="-20" y="8" width="40" height="11" rx="4" fill="${c.deep}" opacity="0.65"/>`,

  /** 元 · 青花瓷罐 */
  jar: (c) => `
    <ellipse cx="0" cy="110" rx="50" ry="10" fill="rgba(0,0,0,0.6)" filter="url(#soft)"/>
    <rect x="-17" y="-98" width="34" height="26" rx="6" fill="${c.soft}" opacity="0.5"/>
    <path d="M-17 -74 Q-54 -54 -50 18 Q-46 72 0 80 Q46 72 50 18 Q54 -54 17 -74 Z" fill="url(#vessel)" stroke="${c.line}" stroke-width="1.5"/>
    <path d="M-17 -72 Q0 -62 17 -72" fill="none" stroke="${c.line}" stroke-width="1.4" opacity="0.7"/>
    <ellipse cx="0" cy="-40" rx="42" ry="9" fill="none" stroke="${c.soft}" stroke-width="1.2" opacity="0.55"/>
    <ellipse cx="0" cy="34" rx="36" ry="8" fill="none" stroke="${c.soft}" stroke-width="1.2" opacity="0.45"/>
    <path d="M-24 -14 Q-12 -26 0 -14 Q12 -2 24 -14" fill="none" stroke="${c.soft}" stroke-width="2.4" opacity="0.6"/>
    <path d="M-24 6 Q-12 -6 0 6 Q12 18 24 6" fill="none" stroke="${c.soft}" stroke-width="2.4" opacity="0.45"/>`,

  /** 明 · 明式家具（圈椅） */
  chair: (c) => `
    <rect x="-38" y="-104" width="76" height="66" rx="8" fill="none" stroke="${c.soft}" stroke-width="7" opacity="0.65"/>
    <path d="M-20 -96 L-20 -46 M0 -96 L0 -46 M20 -96 L20 -46" stroke="${c.soft}" stroke-width="3" opacity="0.4"/>
    <rect x="-48" y="-38" width="96" height="12" rx="5" fill="${c.deep}" opacity="0.85"/>
    <path d="M-44 -26 L-40 108 M44 -26 L40 108 M-34 -26 L-30 108 M34 -26 L30 108"
          stroke="${c.soft}" stroke-width="7" stroke-linecap="round" opacity="0.6"/>
    <path d="M-48 -30 L-58 -44 M48 -30 L58 -44" stroke="${c.soft}" stroke-width="6" stroke-linecap="round" opacity="0.5"/>`,

  /** 清 · 珐琅彩瓶 */
  cloisonne: (c) => `
    <ellipse cx="0" cy="108" rx="44" ry="10" fill="rgba(0,0,0,0.6)" filter="url(#soft)"/>
    <rect x="-12" y="-104" width="24" height="30" rx="7" fill="${c.soft}" opacity="0.55"/>
    <path d="M-12 -74 Q-58 -40 -46 30 Q-40 80 0 88 Q40 80 46 30 Q58 -40 12 -74 Z" fill="url(#vessel)" stroke="${c.line}" stroke-width="1.5"/>
    <path d="M-46 6 Q0 20 46 6" fill="none" stroke="${c.soft}" stroke-width="5" opacity="0.5"/>
    <path d="M-42 30 Q0 44 42 30" fill="none" stroke="${c.soft}" stroke-width="2.5" opacity="0.65"/>
    <path d="M-34 -34 Q-20 -48 -6 -34 Q8 -20 22 -34" fill="none" stroke="${c.soft}" stroke-width="2.6" opacity="0.55"/>
    <circle cx="0" cy="56" r="12" fill="none" stroke="${c.soft}" stroke-width="2" opacity="0.5"/>`,
}

const motifFor = (id) =>
  ({
    zhou: MOTIFS.ding,
    qin: MOTIFS.warrior,
    han: MOTIFS.sword,
    three_kingdoms: MOTIFS.crossbow,
    jin: MOTIFS.vase,
    southern_northern: MOTIFS.buddha,
    sui: MOTIFS.scroll,
    tang: MOTIFS.horse,
    five_dynasties: MOTIFS.bowl,
    song: MOTIFS.dish,
    yuan: MOTIFS.jar,
    ming: MOTIFS.chair,
    qing: MOTIFS.cloisonne,
  })[id] ?? MOTIFS.ding

function artifactSvg(d) {
  const h = hash(d.id)
  const tilt = (h % 10) - 5
  const cx = 200
  const cy = 455
  const c = { soft: d.accentSoft, deep: d.accent, line: rgba(d.accentSoft, 0.72) }
  const motif = motifFor(d.id)(c)

  let speckles = ''
  let seed = h
  for (let i = 0; i < 42; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    const x = (seed >> 8) % 400
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    const y = (seed >> 8) % 700
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    const r = 0.6 + ((seed >> 8) % 20) / 10
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    const o = 0.04 + ((seed >> 8) % 9) / 100
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
    <radialGradient id="glow" cx="50%" cy="42%" r="48%">
      <stop offset="0%" stop-color="${rgba(d.accentSoft, 0.30)}"/>
      <stop offset="60%" stop-color="${rgba(d.accent, 0.10)}"/>
      <stop offset="100%" stop-color="${rgba(d.accent, 0)}"/>
    </radialGradient>
    <linearGradient id="vessel" x1="0.15" y1="0" x2="0.85" y2="1">
      <stop offset="0%" stop-color="${rgba(d.accentSoft, 0.70)}"/>
      <stop offset="45%" stop-color="${rgba(d.accent, 0.50)}"/>
      <stop offset="100%" stop-color="${rgba(d.accent, 0.10)}"/>
    </linearGradient>
    <radialGradient id="vig" cx="50%" cy="44%" r="62%">
      <stop offset="52%" stop-color="rgba(0,0,0,0)"/>
      <stop offset="100%" stop-color="rgba(0,0,0,0.86)"/>
    </radialGradient>
    <filter id="soft"><feGaussianBlur stdDeviation="14"/></filter>
    <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="rgba(5,7,10,0)"/>
      <stop offset="100%" stop-color="rgba(5,7,10,0.96)"/>
    </linearGradient>
  </defs>

  <rect width="400" height="700" fill="url(#bg)"/>
  <ellipse cx="${cx}" cy="${cy - 70}" rx="240" ry="280" fill="url(#glow)"/>
  ${speckles}

  <g fill="none" stroke="${rgba(d.accentSoft, 0.12)}" stroke-width="1">
    <circle cx="${cx}" cy="${cy}" r="112"/>
    <circle cx="${cx}" cy="${cy}" r="164"/>
  </g>

  <!-- 器物母题：缩放在 0.5 左右，保证窄幅裁切下仍能看全 -->
  <g transform="translate(${cx} ${cy}) rotate(${tilt}) scale(0.52)">
    ${motif}
  </g>

  <rect width="400" height="700" fill="url(#vig)"/>
  <rect y="560" width="400" height="140" fill="url(#fade)"/>
</svg>`
}

/** 颜色工具：让每位君主的画像有独立的色相，避免 37 张图长得一模一样 */
const hexToHsl = (hex) => {
  const n = parseInt(hex.slice(1), 16)
  const r = ((n >> 16) & 255) / 255
  const g = ((n >> 8) & 255) / 255
  const b = (n & 255) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  let h = 0
  let s = 0
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
    else if (max === g) h = ((b - r) / d + 2) / 6
    else h = ((r - g) / d + 4) / 6
  }
  return [h * 360, s, l]
}
const hslToHex = (h, s, l) => {
  const c = (1 - Math.abs(2 * l - 1)) * s
  const hp = (((h % 360) + 360) % 360) / 60
  const x = c * (1 - Math.abs((hp % 2) - 1))
  let rgb = [0, 0, 0]
  if (hp < 1) rgb = [c, x, 0]
  else if (hp < 2) rgb = [x, c, 0]
  else if (hp < 3) rgb = [0, c, x]
  else if (hp < 4) rgb = [0, x, c]
  else if (hp < 5) rgb = [x, 0, c]
  else rgb = [c, 0, x]
  const m = l - c / 2
  return (
    '#' +
    rgb
      .map((v) => Math.round((v + m) * 255).toString(16).padStart(2, '0'))
      .join('')
  )
}
const shiftHue = (hex, deg) => {
  const [h, s, l] = hexToHsl(hex)
  return hslToHex(h + deg, s, l)
}

/**
 * 帝王画像占位图
 * 每位君主按 id 哈希得到：独立色相（±35°）、三种冠制之一、不同的肩宽与袍纹，
 * 这样 37 位能一眼区分开，同时整体仍统一在同一套"博物馆暗调"里。
 */
function portraitSvg(e, d) {
  const h = hash(e.id)
  const sway = (h % 16) - 8
  const hueShift = ((h % 70) - 35)
  const accent = shiftHue(d.accent, hueShift)
  const soft = shiftHue(d.accentSoft, hueShift)
  const crown = h % 3
  const shoulderW = 88 + (h % 18)
  const headRy = 40 + (h % 6)

  // 三种冠制：平天冠 / 阶梯冠 / 尖顶冠
  const crownShape =
    crown === 0
      ? `<rect x="-58" y="92" width="116" height="15" rx="4" fill="${rgba(soft, 0.5)}"/>
         <rect x="-34" y="76" width="68" height="18" rx="4" fill="${rgba(soft, 0.34)}"/>`
      : crown === 1
        ? `<rect x="-52" y="88" width="104" height="12" rx="3" fill="${rgba(soft, 0.46)}"/>
           <rect x="-36" y="76" width="72" height="14" rx="3" fill="${rgba(soft, 0.36)}"/>
           <rect x="-18" y="64" width="36" height="14" rx="3" fill="${rgba(soft, 0.26)}"/>`
        : `<path d="M-54 100 L0 60 L54 100 Z" fill="${rgba(soft, 0.34)}"/>
           <rect x="-54" y="100" width="108" height="12" rx="3" fill="${rgba(soft, 0.46)}"/>`

  // 袍纹：竖条纹 / 交领 / 素面
  const robePattern =
    h % 3 === 0
      ? `<path d="M-40 220 L-40 480 M-14 220 L-14 480 M14 220 L14 480 M40 220 L40 480"
              stroke="${rgba(soft, 0.12)}" stroke-width="2"/>`
      : h % 3 === 1
        ? `<path d="M-30 200 L0 300 L30 200" fill="none" stroke="${rgba(soft, 0.3)}" stroke-width="2.5"/>
           <path d="M-14 196 L-14 300 M14 196 L14 300" stroke="${rgba(soft, 0.14)}" stroke-width="2"/>`
        : `<path d="M0 200 L0 480" stroke="${rgba(soft, 0.16)}" stroke-width="2"/>`

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 520" width="420" height="520">
  <defs>
    <linearGradient id="pbg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0b0d11"/>
      <stop offset="55%" stop-color="${rgba(accent, 0.28)}"/>
      <stop offset="100%" stop-color="#07090b"/>
    </linearGradient>
    <radialGradient id="pglow" cx="50%" cy="34%" r="48%">
      <stop offset="0%" stop-color="${rgba(soft, 0.44)}"/>
      <stop offset="100%" stop-color="${rgba(soft, 0)}"/>
    </radialGradient>
    <linearGradient id="robe" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${rgba(soft, 0.34)}"/>
      <stop offset="100%" stop-color="${rgba(accent, 0.12)}"/>
    </linearGradient>
    <linearGradient id="pbg2" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="rgba(6,8,10,0)"/>
      <stop offset="100%" stop-color="rgba(6,8,10,0.86)"/>
    </linearGradient>
  </defs>

  <rect width="420" height="520" fill="url(#pbg)"/>
  <ellipse cx="210" cy="170" rx="190" ry="170" fill="url(#pglow)"/>

  <g transform="translate(${210 + sway} 0)" opacity="0.92">
    ${crownShape}
    <ellipse cx="0" cy="152" rx="33" ry="${headRy}" fill="${rgba(soft, 0.3)}"/>
    <path d="M-${shoulderW} 300 Q-70 196 0 190 Q70 196 ${shoulderW} 300 L${shoulderW + 8} 520 L-${shoulderW + 8} 520 Z"
          fill="url(#robe)"/>
    ${robePattern}
  </g>

  <rect y="380" width="420" height="140" fill="url(#pbg2)"/>
</svg>`
}
const artDir = join(PROJECT, 'public/artifacts')
mkdirSync(artDir, { recursive: true })
for (const d of data.dynasties) writeFileSync(join(artDir, `${d.id}.svg`), artifactSvg(d))

const porDir = join(PROJECT, 'public/portraits')
mkdirSync(porDir, { recursive: true })
for (const e of data.emperors) {
  if (e.dynastyId === 'han') continue // 汉朝画像用历史影像 .webp，不生成占位 SVG
  const d = data.dynasties.find((x) => x.id === e.dynastyId)
  writeFileSync(join(porDir, `${e.id.replace('e_', '').replace(/_/g, '-')}.svg`), portraitSvg(e, d))
}

// ---- 阶段二：周朝 37 位君主的画像占位图 ----
const zhouFile = JSON.parse(readFileSync(join(PROJECT, 'src/data/emperors.zhou.json'), 'utf8'))
const zhouDynasty = data.dynasties.find((d) => d.id === zhouFile.dynastyId)
for (const emperor of zhouFile.emperors) {
  const fileName = `${emperor.id.replace(/_/g, '-')}.svg`
  writeFileSync(join(porDir, fileName), portraitSvg({ id: emperor.id }, zhouDynasty))
}
console.log(`zhou portraits: ${zhouFile.emperors.length}`)
// ---- 秦朝 3 位统治者的画像（终局推演的落地页需要）----
const qinFile = JSON.parse(readFileSync(join(PROJECT, 'src/data/emperors.qin.json'), 'utf8'))
const qinDynasty = data.dynasties.find((d) => d.id === qinFile.dynastyId)
for (const emperor of qinFile.emperors) {
  writeFileSync(join(porDir, `${emperor.id.replace(/_/g, '-')}.svg`), portraitSvg({ id: emperor.id }, qinDynasty))
}
console.log(`qin portraits: ${qinFile.emperors.length}`)
/* 汉朝不用程序化占位图：27 帝已换成 public/portraits/han-*.webp（历史画像）。
   若将来新增汉朝帝纪，请按同样规格补图，不要再生成 han-*.svg，避免两套画像并存。 */
console.log(`artifacts: ${data.dynasties.length} (${data.dynasties.map((d) => d.id).join(', ')})`)
console.log(`portraits: ${data.emperors.length}`)
