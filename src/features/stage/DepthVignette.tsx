/**
 * DepthVignette —— 景深暗角
 * ---------------------------------------------------------------------------
 * 用一层固定的径向渐变模拟"镜头边缘失光"，强化焦点居中、四周后退的观感。
 *
 * 收敛说明：初版边缘压得很重，导致本已是 opacity:0.4 的背景层被二次压暗到几乎不可见。
 * 现在原点外扩、末端衰减放缓，只做轻微收边——既保留镜头感，
 * 又让"景深里的图层"仍然可被感知，用户才知道自己身处一个多层空间。
 *
 * 必须是 pointer-events:none；且不能加 filter（会与面板自身的 blur 重复计算）。
 */
export function DepthVignette() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-[60]"
      style={{
        background:
          'radial-gradient(130% 100% at 50% 48%, rgba(0,0,0,0) 52%, rgba(0,0,0,0.22) 82%, rgba(0,0,0,0.5) 100%)',
        mixBlendMode: 'multiply',
      }}
    />
  )
}
