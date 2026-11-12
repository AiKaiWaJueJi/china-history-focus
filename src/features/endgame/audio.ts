/**
 * 音效：寺院钟声（真实音频）
 * ===========================================================================
 * 上一版用 Web Audio 现场合成鼓点与钟鸣；这一版改用你提供的
 * public/audio/temple-bell.mp3（寺院钟声·禅音）。
 *
 * 浏览器策略要求首次播放发生在用户手势中，因此 warmUpAudio() 在点击国家时调用。
 * 同一个 Audio 实例重复触发时回到 0s 重放，避免多个钟声叠在一起。
 */

const SRC = '/audio/temple-bell.mp3'

let bell: HTMLAudioElement | null = null

function getBell(): HTMLAudioElement | null {
  if (typeof window === 'undefined') return null
  if (!bell) {
    bell = new Audio(SRC)
    bell.preload = 'auto'
    bell.volume = 1
  }
  return bell
}

/** 预加载（用户第一次交互时调用） */
export function warmUpAudio() {
  getBell()
}

/** 撞钟一次 */
export function playBell(volume = 1) {
  const audio = getBell()
  if (!audio) return
  try {
    audio.volume = Math.max(0, Math.min(1, volume))
    audio.currentTime = 0
    void audio.play().catch(() => {
      /* 自动播放被拦截时静默失败，不影响交互 */
    })
  } catch {
    /* 忽略 */
  }
}
