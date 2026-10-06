/**
 * 打字音。全部用 Web Audio 现场合成，不带音频文件：一小段白噪声过带通滤波器
 * 当「咔」，再叠一个很短的低音当键帽落底的「哒」。
 *
 * 每一下的音高、响度都随机抖一点 —— 同一个采样反复播放听起来像机关枪，
 * 真键盘每一下都不太一样。
 */

export type KeySound = 'key' | 'delete' | 'enter'

const SOUND_KEY = 'kotoba:key-sound'

/** 各种按键的音色：带通的中心频率、底音频率、衰减时长（秒）、响度。 */
const TONES: Record<KeySound, { click: number; body: number; decay: number; gain: number }> = {
  key: { click: 3200, body: 190, decay: 0.045, gain: 0.5 },
  delete: { click: 1900, body: 140, decay: 0.05, gain: 0.45 },
  enter: { click: 1400, body: 95, decay: 0.09, gain: 0.7 },
}

/** 总音量。打字音是陪衬，不该盖过别的声音。 */
const MASTER = 0.35

let ctx: AudioContext | null = null
let noise: AudioBuffer | null = null

/**
 * 浏览器要求音频在用户操作里才能启动，所以第一次按键时才建。
 * 建不了（老浏览器、被禁用）就返回 null，静默跳过 —— 声音坏了不能影响打字。
 */
function audio(): AudioContext | null {
  try {
    ctx ??= new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
    if (!noise) {
      const length = Math.floor(ctx.sampleRate * 0.1)
      noise = ctx.createBuffer(1, length, ctx.sampleRate)
      const data = noise.getChannelData(0)
      for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1
    }
    return ctx
  } catch {
    return null
  }
}

/** ±spread 的随机倍数，比如 jitter(0.1) 在 0.9～1.1 之间。 */
function jitter(spread: number): number {
  return 1 + (Math.random() * 2 - 1) * spread
}

export function playKey(kind: KeySound) {
  const ac = audio()
  if (!ac || !noise) return

  const tone = TONES[kind]
  const now = ac.currentTime
  const peak = MASTER * tone.gain * jitter(0.2)
  const decay = tone.decay * jitter(0.15)

  // 「咔」：噪声 → 带通 → 很快起、很快落
  const click = ac.createBufferSource()
  click.buffer = noise
  const band = ac.createBiquadFilter()
  band.type = 'bandpass'
  band.frequency.value = tone.click * jitter(0.12)
  band.Q.value = 1.2
  const clickGain = ac.createGain()
  clickGain.gain.setValueAtTime(0, now)
  clickGain.gain.linearRampToValueAtTime(peak, now + 0.002)
  clickGain.gain.exponentialRampToValueAtTime(0.0001, now + decay)
  click.connect(band).connect(clickGain).connect(ac.destination)
  click.start(now)
  click.stop(now + decay + 0.01)

  // 「哒」：短促的低音，音高往下滑一点，像键帽撞到底
  const body = ac.createOscillator()
  body.type = 'triangle'
  const pitch = tone.body * jitter(0.08)
  body.frequency.setValueAtTime(pitch, now)
  body.frequency.exponentialRampToValueAtTime(pitch * 0.6, now + decay * 1.5)
  const bodyGain = ac.createGain()
  bodyGain.gain.setValueAtTime(0, now)
  bodyGain.gain.linearRampToValueAtTime(peak * 0.6, now + 0.003)
  bodyGain.gain.exponentialRampToValueAtTime(0.0001, now + decay * 1.5)
  body.connect(bodyGain).connect(ac.destination)
  body.start(now)
  body.stop(now + decay * 1.5 + 0.01)
}

/**
 * 这一下按键该出什么声，不该出声的（方向键、Shift、Tab 之类）给 null。
 *
 * Process 是输入法选字过程中的按键，Unidentified 是部分手机软键盘 ——
 * 都是在打字，照样出声。
 */
export function soundFor(e: { key: string; repeat: boolean }): KeySound | null {
  if (e.key === 'Backspace' || e.key === 'Delete') return 'delete'
  if (e.repeat) return null
  if (e.key === 'Enter') return 'enter'
  if (e.key.length === 1 || e.key === 'Process' || e.key === 'Unidentified') return 'key'
  return null
}

/** 默认开着。存储读不了就当开着，下次也不记。 */
export function loadSoundOn(): boolean {
  try {
    return localStorage.getItem(SOUND_KEY) !== 'off'
  } catch {
    return true
  }
}

export function saveSoundOn(on: boolean) {
  try {
    localStorage.setItem(SOUND_KEY, on ? 'on' : 'off')
  } catch {
    // 记不住就算了
  }
}
