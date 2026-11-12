/**
 * 音效：战鼓与钟鸣（Web Audio 实时合成，无需音频文件）
 * ===========================================================================
 * 为什么不用 <audio src="...">：
 *   项目要求完全离线可用，也不想为了两声鼓点往仓库里塞 mp3。
 *   用 OscillatorNode 现场合成，体积极小、延迟为零，还能随节奏精确对齐。
 *
 * 浏览器自动播放策略：AudioContext 必须在用户手势中创建/恢复。
 * 因此第一次调用发生在「开启统一进程」按钮的点击回调里，符合规范。
 */

let ctx: AudioContext | null = null

const getContext = (): AudioContext | null => {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    ctx = new Ctor()
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

/**
 * 低沉战鼓：正弦从 110Hz 快速滑到 42Hz + 一段短噪声（鼓皮的"啪"）
 * @param volume 音量
 * @param semitones 半音偏移：每灭一国升高一点，形成"步步紧逼"的音高上行
 */
export function playDrum(volume = 1, semitones = 0) {
  const ac = getContext()
  if (!ac) return
  const t = ac.currentTime

  const base = 110 * Math.pow(2, semitones / 12)

  const osc = ac.createOscillator()
  const gain = ac.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(base, t)
  osc.frequency.exponentialRampToValueAtTime(base * 0.38, t + 0.45)
  gain.gain.setValueAtTime(0.0001, t)
  gain.gain.exponentialRampToValueAtTime(0.5 * volume, t + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.7)
  osc.connect(gain).connect(ac.destination)
  osc.start(t)
  osc.stop(t + 0.75)

  // 噪声层：让鼓点有"实体感"
  const length = Math.floor(ac.sampleRate * 0.18)
  const buffer = ac.createBuffer(1, length, ac.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < length; i++) {
    const decay = (1 - i / length) ** 3
    data[i] = (Math.random() * 2 - 1) * decay
  }
  const noise = ac.createBufferSource()
  noise.buffer = buffer
  const lowpass = ac.createBiquadFilter()
  lowpass.type = 'lowpass'
  lowpass.frequency.value = 1200
  const noiseGain = ac.createGain()
  noiseGain.gain.value = 0.22 * volume
  noise.connect(lowpass).connect(noiseGain).connect(ac.destination)
  noise.start(t)
}

/** 钟鸣：三个泛音叠加 + 缓慢衰减，用于"秦印落下"的终局时刻 */
export function playGong(volume = 1) {
  const ac = getContext()
  if (!ac) return
  const t = ac.currentTime

  const partials = [
    { freq: 110, gain: 0.34, decay: 2.8 },
    { freq: 165, gain: 0.2, decay: 2.2 },
    { freq: 247, gain: 0.12, decay: 1.8 },
  ]

  for (const p of partials) {
    const osc = ac.createOscillator()
    const gain = ac.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(p.freq, t)
    osc.frequency.exponentialRampToValueAtTime(p.freq * 0.98, t + p.decay)
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(p.gain * volume, t + 0.04)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + p.decay)
    osc.connect(gain).connect(ac.destination)
    osc.start(t)
    osc.stop(t + p.decay + 0.1)
  }
}

/** 预热 AudioContext（用户第一次交互时调用，避免首个鼓点被浏览器吞掉） */
export function warmUpAudio() {
  getContext()
}
