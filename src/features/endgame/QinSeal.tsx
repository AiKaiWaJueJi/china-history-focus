/**
 * QinSeal —— 终局印章
 * ===========================================================================
 * 六国尽墨后，一枚巨大的「秦」字印从上方砸下：
 *   · 印章本体：scale 3.2 → 1、旋转 -12° → 0、opacity 0 → 1
 *   · 冲击环：scale 0.6 → 2.6、opacity 0.9 → 0，模拟落印的冲击波
 *   · 1.4s 后整体淡为 0.1 的水印，把视觉焦点让给下方的入口卡片
 *
 * 全部只动 transform / opacity（合成器属性），不做 blur / box-shadow 动画。
 */
export function QinSeal() {
  return (
    <div className="qin-seal" aria-hidden="true">
      <span className="qin-seal-ring" />
      <span className="qin-seal-ring qin-seal-ring--delay" />
      <span className="qin-seal-char">秦</span>
    </div>
  )
}
