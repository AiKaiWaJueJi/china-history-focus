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
    左右两侧**各自分摊一半的收缩量**，而不是所有模块等量收缩。
    因为激活项左右两侧的模块数量通常不等（如 13 块里第 8 块，左 7 右 5）：
    若等量收缩，左侧总让位比右侧多，激活项中心会向一侧漂移约 20px，
    面板就会在光标下轻微滑动。
    平分收缩量后，激活项的左右边缘等量外扩，**中心严格不动**，
    在视觉上依然是"从中心向两边展开"。
  */
  const totalShrink = target - base
  const leftCount = activeIndex
  const rightCount = count - 1 - activeIndex
  const half = totalShrink / 2

  let leftPer = leftCount > 0 ? half / leftCount : 0
  let rightPer = rightCount > 0 ? half / rightCount : 0
  // 一侧没有邻居时，全部收缩量由另一侧承担
  if (leftCount === 0 && rightCount > 0) rightPer = totalShrink / rightCount
  if (rightCount === 0 && leftCount > 0) leftPer = totalShrink / leftCount

  // 防止极端尺寸下把邻居压到不可用
  const minWidth = Math.max(base * 0.35, 28)
  leftPer = Math.min(leftPer, base - minWidth)
  rightPer = Math.min(rightPer, base - minWidth)

  const widths = Array.from({ length: count }, (_, i) => {
    if (i === activeIndex) return target
    return i < activeIndex ? base - leftPer : base - rightPer
  })

  return { base, target, collapse: base - (leftPer + rightPer) / 2, widths }
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
