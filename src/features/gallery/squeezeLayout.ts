/**
 * 挤压布局计算（居中对称展开）
 * ===========================================================================
 * 交互语义：激活的模块**从自身中心向两边展开**，左右邻居等量收缩。
 * （早前尝试过按中轴线做单侧锚定展开，实际手感不如对称展开自然，已回退。）
 *
 * 为什么用 width 而不是 flex-grow 做动画：
 *   flex 的宽度是 `可用宽度 × grow_i / Σgrow`，13 个 grow 同时变化时，
 *   宽度与时间是强非线性的：实测 360ms 的曲线里，前 140ms 就走完了大部分位移、
 *   尾巴拖得很长 —— 这就是"看起来展开慢"的根源。
 *   改成对 width（长度属性）插值后，位移随时间近似线性，观感匀速且利落。
 *
 * 为什么首次激活需要一次 FLIP：
 *   默认布局是 `flex: 1 1 0`（宽度 auto），从 auto 到具体像素值无法插值，
 *   会直接跳变。所以先把每块的"当前像素宽度"钉下来（禁用过渡 + 强制重排），
 *   再恢复过渡并写入目标宽度。
 */

export interface SqueezeMetrics {
  /** 每块模块的默认等分宽度 */
  base: number
  /** 激活项的目标宽度 */
  target: number
  /** 其余模块的收缩宽度 */
  collapse: number
  /** 期望宽度数组（像素） */
  widths: number[]
}

export function computeSqueeze(
  available: number,
  count: number,
  activeIndex: number,
): SqueezeMetrics | null {
  if (count <= 0 || available <= 0) return null
  const base = available / count

  if (activeIndex < 0 || activeIndex >= count) {
    return {
      base,
      target: base,
      collapse: base,
      widths: Array.from({ length: count }, () => base),
    }
  }

  // 目标宽度：约 23.5% 可用宽度，不小于等分的 2.2 倍、不超过 34%
  const target = Math.min(Math.max(available * 0.235, base * 2.2), available * 0.34)

  /*
    其余模块**平均分摊**收缩量。

    这里曾尝试过"让激活项中心严格不动"（左右两侧各承担一半收缩量），
    但那在靠近两端时会失效：例如聚焦「明」（第 12 块），右侧只有「清」1 块，
    却要独自吞掉一半收缩量（约 116px），超过它自身的宽度 —— 被压到下限后
    总宽度又对不上容器，flex 直接溢出，把「清」顶出了屏幕。

    平均分摊则天然安全：widths 之和恒等于 available，
    容器永不溢出，邻居宽度也统一。代价是激活项靠近两端时中心会有所漂移，
    这是"均匀分摊"的几何必然，视觉上可以接受（且有指针意图控制兜底，
    面板不会因为漂移而抢走焦点）。
  */
  const collapse = count > 1 ? (available - target) / (count - 1) : base

  const widths = Array.from({ length: count }, (_, i) => (i === activeIndex ? target : collapse))

  return { base, target, collapse, widths }
}

/** 记录哪些容器已经被"钉"成像素宽度布局 */
const pinned = new WeakSet<HTMLElement>()

export function applySqueeze(
  root: HTMLElement,
  panels: HTMLElement[],
  activeIndex: number,
): SqueezeMetrics | null {
  const style = getComputedStyle(root)
  const gap = Number.parseFloat(style.columnGap) || 0
  const padL = Number.parseFloat(style.paddingLeft) || 0
  const padR = Number.parseFloat(style.paddingRight) || 0
  const available = root.clientWidth - padL - padR - gap * (panels.length - 1)

  const metrics = computeSqueeze(available, panels.length, activeIndex)
  if (!metrics) return null

  if (!pinned.has(root)) {
    const current = panels.map((p) => p.getBoundingClientRect().width)
    panels.forEach((p, i) => {
      p.style.transitionProperty = 'none'
      p.style.flex = '0 0 auto'
      p.style.width = `${current[i]}px`
    })
    void root.offsetWidth // 强制重排，锁定起始宽度
    panels.forEach((p) => {
      p.style.transitionProperty = ''
    })
    pinned.add(root)
  }

  panels.forEach((p, i) => {
    p.style.width = `${metrics.widths[i]}px`
  })
  return metrics
}
