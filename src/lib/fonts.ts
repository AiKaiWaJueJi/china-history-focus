/**
 * 朝代字体映射（fontStyle → CSS font-family）
 * ===========================================================================
 * 需求的数据里带了 `fontStyle` 字段（毛笔/篆书、汉隶、瘦金体、魏碑…），
 * 期望前端按字段动态加载对应字体，让"字体演变"本身成为信息的一部分。
 *
 * 现实约束：方正瘦金书、汉仪篆书这类**商业字体**不能随项目分发。
 * 因此这里用四款可商用的开源中文字体做"字形气质"的近似映射，
 * 并把映射表集中在这一个文件里 —— 将来买到商业字体授权时，只需：
 *   1) 把 woff2 放进 public/fonts/
 *   2) 在 index.css 加一条 @font-face
 *   3) 改下面 MAP 里对应的 family
 * 组件与数据都不需要改动。
 *
 * 字体来源：Google Fonts，已用 text= 子集化（17 个朝代用字，四款共约 30KB）。
 */

export const DYNASTY_FONT_FAMILY = {
  /** 毛笔行楷：笔锋最足，用于篆/隶/魏碑这类"金石气"的替代 */
  brush: "'Ma Shan Zheng', 'STKaiti', 'KaiTi', serif",
  /** 细劲清瘦：最接近瘦金体的骨架 */
  thin: "'ZCOOL XiaoWei', 'STKaiti', 'KaiTi', serif",
  /** 行书：连笔但不狂放 */
  xingshu: "'Long Cang', 'STKaiti', 'KaiTi', serif",
  /** 行草：飞动连绵 */
  caoshu: "'Zhi Mang Xing', 'STKaiti', 'KaiTi', serif",
  /** 楷书：直接用系统楷体，零下载 */
  kaishu: "'KaiTi', 'STKaiti', 'Kaiti SC', serif",
} as const

type FontKey = keyof typeof DYNASTY_FONT_FAMILY

/**
 * 匹配规则按顺序命中，所以顺序即优先级。
 * 例如「瘦金体 / 颜体」必须落在 thin 而不是 brush；
 * 「台阁体 / 行书」按明代台阁体的实际面貌归到 thin，而不是行书。
 */
const RULES: ReadonlyArray<readonly [RegExp, FontKey]> = [
  [/瘦金|台阁|馆阁|汉隶|漢隶|隶书/, 'thin'],
  [/行草|草书/, 'caoshu'],
  [/行书|行楷/, 'xingshu'],
  [/楷书/, 'kaishu'],
  [/毛笔|篆|魏碑|颜体/, 'brush'],
]

/** 把数据里的 fontStyle 描述解析成可直接用于 CSS 的 font-family 栈 */
export function resolveDynastyFont(fontStyle: string | undefined): string {
  if (!fontStyle) return DYNASTY_FONT_FAMILY.brush
  for (const [pattern, key] of RULES) {
    if (pattern.test(fontStyle)) return DYNASTY_FONT_FAMILY[key]
  }
  return DYNASTY_FONT_FAMILY.brush
}

/**
 * 年代缩写：把「前1046年-前256年」压成「前1046–前256」。
 * 13 个模块并排时每块只有约 110px 宽，完整写法会折行，
 * 窄态必须用最紧凑的形式。
 */
export function shortPeriod(period: string): string {
  return period.replace(/年/g, '').replace(/\s/g, '').replace(/-/g, '–')
}
