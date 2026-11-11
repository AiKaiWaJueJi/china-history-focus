/**
 * 挤压布局计算（锚定式 + 像素宽度驱动）
 * ===========================================================================
 * 需求：激活的模块**从一侧展开**，另一侧保持不动（以整排中轴线为界）。
 *
 * 为什么不用 flex-grow 做动画：
 *   flex 的最终宽度是 `可用宽度 × grow_i / Σgrow`。
 *   动画时 13 个 grow 同时变化，**宽度与时间是强非线性的**。
 *   实测：时长 400ms 的曲线，前 140ms（35% 时间）就走完了 77% 的位移，
 *   尾巴拖得很长 —— 这就是"看起来展开很慢"的真正原因。
 *
 * 所以这里改成：算出每块模块的**目标像素宽度**，直接对 width 做过渡。
 *   · width 是长度属性，插值随时间是线性的，观感匀速；
 *   · 锚定侧的宽度是常量，整个动画期间真正一动不动；
 *   · 收缩侧与激活侧分担全部宽度变化。
 *
 * 锚定方向（按中轴线划分）：
 *   index ≤ 中线 → 锚左：左侧不动，激活项向右展开；
 *   index >  中线 → 锚右：右侧不动，激活项向左展开。
 *   两者都朝中轴线打开，像一本从中间翻开的书。
 */

export interface SqueezeMetrics {
  base: number
  target: number
  collapse: number
  anchorLeft: boolean
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
      anchorLeft: true,
      widths: Array.from({ length: count }, () => base),
    }
  }

  // 目标宽度 ≈ 可用宽度的 23.5%，但不小于等分的 2.2 倍、不超过 34%
  const target = Math.min(Math.max(available * 0.235, base * 2.2), available * 0.34)

  const center = (count - 1) / 2
  const anchorLeft = activeIndex <= center
  const anchorCount = anchorLeft ? activeIndex : count - 1 - activeIndex
  const collapseCount = count - 1 - anchorCount

  const remaining = available - target - anchorCount * base
  const collapse = collapseCount > 0 ? Math.max(remaining / collapseCount, base * 0.35) : base

  const widths = Array.from({ length: count }, (_, i) => {
    if (i === activeIndex) return target
    if (anchorLeft) return i < activeIndex ? base : collapse
    return i > activeIndex ? base : collapse
  })

  return { base, target, collapse, anchorLeft, widths }
}

/** 记录哪些容器已经被"钉"成像素宽度布局 */
const pinned = new WeakSet<HTMLElement>()

/**
 * 把布局写入 DOM。
 *
 * 首次运行需要一次 FLIP：先把每块面板按"当前实际像素宽度"固定下来
 * （此时禁用过渡），强制一次重排，再恢复过渡并写入目标宽度。
 * 否则从 `flex: 1`（宽度 auto）过渡到具体像素值是无法插值的，会直接跳变。
 */
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

    // 上面已经用 offsetWidth 强制过一次重排，起始宽度已被锁定；
    // 因此这里可以直接写入目标宽度，无需再等一帧
    // （早先用 requestAnimationFrame 会让动画起点整体后移约 16-30ms）。
    panels.forEach((p, i) => {
      p.style.width = `${metrics.widths[i]}px`
    })
    return metrics
  }

  panels.forEach((p, i) => {
    p.style.width = `${metrics.widths[i]}px`
  })
  return metrics
}
