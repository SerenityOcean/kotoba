/**
 * 打字音。全部用 Web Audio 现场合成，不带音频文件，有好几种音色可选。
 *
 * 每一下的音高、响度都随机抖一点 —— 同一个声音反复播放听起来像机关枪，
 * 真键盘每一下都不太一样。所有声音先过一个总音量和压缩器再出去，
 * 几种音色之间响度差不多，连着敲也不会爆音。
 */

export type KeySound = 'key' | 'delete' | 'enter'

export type SoundPreset = 'thock' | 'clicky' | 'typewriter' | 'wood' | 'koto' | 'bubble'

/** 一种音色：在 time 时刻往 out 里放一下 kind 的声音。 */
type Voice = (ac: BaseAudioContext, out: AudioNode, kind: KeySound, time: number) => void

/**
 * level 是这种音色整体的音量倍数：几种音色的音量天差地别（高频的短「咔」听着响、
 * 能量却很小），按离线渲染量出来的响度对齐过 —— 普通键前 150 毫秒都在 -32 dB 上下，
 * 换音色不会觉得忽大忽小。改了音色要重新量一遍。
 */
export const PRESETS: { id: SoundPreset; name: string; hint: string; level: number; voice: Voice }[] = [
  { id: 'thock', name: '闷声', hint: '线性轴，低沉的「咚」', level: 1.5, voice: thock },
  { id: 'clicky', name: '清脆', hint: '青轴，两段式的「咔嗒」', level: 6, voice: clicky },
  { id: 'typewriter', name: '打字机', hint: '字锤敲纸，回车响铃', level: 2.9, voice: typewriter },
  { id: 'wood', name: '木鱼', hint: '空心木头的「笃」', level: 1.7, voice: wood },
  { id: 'koto', name: '琴', hint: '拨弦，都节音阶，打字成曲', level: 0.8, voice: koto },
  { id: 'bubble', name: '泡泡', hint: '轻轻的「啵」', level: 2, voice: bubble },
]

export const DEFAULT_PRESET: SoundPreset = 'thock'

/** 总音量。打字音是陪衬，不该盖过别的声音。 */
const MASTER = 0.5

// ---- 播放 ----------------------------------------------------------------

let ctx: AudioContext | null = null
let bus: AudioNode | null = null

/**
 * 浏览器要求音频在用户操作里才能启动，所以第一次按键时才建。
 * 建不了（老浏览器、被禁用）就返回 null，静默跳过 —— 声音坏了不能影响打字。
 */
function output(): { ac: AudioContext; out: AudioNode } | null {
  try {
    ctx ??= new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
    bus ??= masterBus(ctx)
    return { ac: ctx, out: bus }
  } catch {
    return null
  }
}

/** 总音量 → 压缩器 → 扬声器。离线渲染检查响度时也用同一条。 */
export function masterBus(ac: BaseAudioContext): AudioNode {
  const gain = ac.createGain()
  gain.gain.value = MASTER
  const limiter = ac.createDynamicsCompressor()
  limiter.threshold.value = -12
  limiter.ratio.value = 6
  limiter.attack.value = 0.002
  limiter.release.value = 0.1
  gain.connect(limiter).connect(ac.destination)
  return gain
}

export function playKey(preset: SoundPreset, kind: KeySound) {
  const o = output()
  if (!o) return
  try {
    play(o.ac, o.out, preset, kind, o.ac.currentTime)
  } catch {
    // 合成出错也不能打断打字
  }
}

/** 选音色时试听：三个键、一下退格、一下回车。 */
export function previewPreset(preset: SoundPreset) {
  const o = output()
  if (!o) return
  const kinds: KeySound[] = ['key', 'key', 'key', 'delete', 'enter']
  kinds.forEach((kind, i) => play(o.ac, o.out, preset, kind, o.ac.currentTime + 0.02 + i * 0.13))
}

/** 按这种音色的 level 过一道音量，再交给它的合成函数。 */
export function play(ac: BaseAudioContext, out: AudioNode, preset: SoundPreset, kind: KeySound, time: number) {
  const p = PRESETS.find((x) => x.id === preset) ?? PRESETS[0]
  const level = ac.createGain()
  level.gain.value = p.level
  level.connect(out)
  p.voice(ac, level, kind, time)
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

// ---- 设置 ----------------------------------------------------------------

const SOUND_KEY = 'kotoba:key-sound'

/**
 * 读上次选的音色，null = 关掉。默认开着闷声。
 * 老版本存的是 on / off，on 按默认音色算。存储读不了就当默认。
 */
export function loadSoundPreset(): SoundPreset | null {
  try {
    const stored = localStorage.getItem(SOUND_KEY)
    if (stored === 'off') return null
    return PRESETS.some((p) => p.id === stored) ? (stored as SoundPreset) : DEFAULT_PRESET
  } catch {
    return DEFAULT_PRESET
  }
}

export function saveSoundPreset(preset: SoundPreset | null) {
  try {
    localStorage.setItem(SOUND_KEY, preset ?? 'off')
  } catch {
    // 记不住就算了
  }
}

// ---- 合成用的小零件 ------------------------------------------------------

/** ±spread 的随机倍数，比如 jitter(0.1) 在 0.9～1.1 之间。 */
function jitter(spread: number): number {
  return 1 + (Math.random() * 2 - 1) * spread
}

const noiseBuffers = new WeakMap<BaseAudioContext, AudioBuffer>()

/** 0.2 秒白噪声，每个音频上下文生成一次。 */
function noiseOf(ac: BaseAudioContext): AudioBuffer {
  let buffer = noiseBuffers.get(ac)
  if (!buffer) {
    const length = Math.floor(ac.sampleRate * 0.2)
    buffer = ac.createBuffer(1, length, ac.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1
    noiseBuffers.set(ac, buffer)
  }
  return buffer
}

/** 起音、衰减的音量包络：attack 秒升到 peak，decay 秒内指数落到听不见。 */
function envelope(ac: BaseAudioContext, time: number, peak: number, attack: number, decay: number) {
  const gain = ac.createGain()
  gain.gain.setValueAtTime(0.0001, time)
  gain.gain.exponentialRampToValueAtTime(peak, time + attack)
  gain.gain.exponentialRampToValueAtTime(0.0001, time + attack + decay)
  return gain
}

/** 一段过滤过的噪声：「咔」「嚓」「沙」都是它。 */
function noiseHit(
  ac: BaseAudioContext,
  out: AudioNode,
  time: number,
  o: { type: BiquadFilterType; freq: number; q: number; peak: number; decay: number },
) {
  const src = ac.createBufferSource()
  src.buffer = noiseOf(ac)
  const filter = ac.createBiquadFilter()
  filter.type = o.type
  filter.frequency.value = o.freq
  filter.Q.value = o.q
  const env = envelope(ac, time, o.peak, 0.001, o.decay)
  src.connect(filter).connect(env).connect(out)
  src.start(time)
  src.stop(time + o.decay + 0.02)
}

/** 一个会滑音的单音：键帽落底的「哒」、木鱼、泡泡都是它。 */
function tone(
  ac: BaseAudioContext,
  out: AudioNode,
  time: number,
  o: { type: OscillatorType; from: number; to: number; slide: number; peak: number; decay: number },
) {
  const osc = ac.createOscillator()
  osc.type = o.type
  osc.frequency.setValueAtTime(o.from, time)
  osc.frequency.exponentialRampToValueAtTime(o.to, time + o.slide)
  const env = envelope(ac, time, o.peak, 0.002, o.decay)
  osc.connect(env).connect(out)
  osc.start(time)
  osc.stop(time + o.decay + 0.02)
}

// ---- 各种音色 ------------------------------------------------------------

/** 闷声：线性轴。低通过的噪声当底噪，叠一个往下沉的低音。 */
function thock(ac: BaseAudioContext, out: AudioNode, kind: KeySound, time: number) {
  const low = { key: 120, delete: 100, enter: 80 }[kind] * jitter(0.06)
  const peak = (kind === 'enter' ? 0.9 : 0.7) * jitter(0.15)
  noiseHit(ac, out, time, { type: 'lowpass', freq: 900 * jitter(0.15), q: 0.8, peak: peak * 0.8, decay: 0.035 })
  noiseHit(ac, out, time, { type: 'bandpass', freq: 2200, q: 1, peak: peak * 0.12, decay: 0.012 })
  tone(ac, out, time, { type: 'sine', from: low, to: low * 0.7, slide: 0.06, peak, decay: kind === 'enter' ? 0.11 : 0.07 })
}

/** 清脆：青轴。先是触发点的「咔」，十来毫秒后键帽落底的「嗒」。 */
function clicky(ac: BaseAudioContext, out: AudioNode, kind: KeySound, time: number) {
  const pitch = { key: 1, delete: 0.8, enter: 0.65 }[kind] * jitter(0.1)
  const peak = 0.55 * jitter(0.15)
  noiseHit(ac, out, time, { type: 'bandpass', freq: 5200 * pitch, q: 4, peak, decay: 0.008 })
  const second = time + 0.012 * jitter(0.2)
  noiseHit(ac, out, second, { type: 'bandpass', freq: 3000 * pitch, q: 2, peak: peak * 0.7, decay: 0.02 })
  tone(ac, out, second, { type: 'triangle', from: 260 * pitch, to: 200 * pitch, slide: 0.03, peak: peak * 0.35, decay: 0.03 })
}

/** 打字机：字锤敲在纸和滚筒上，带一点金属声；回车是换行的铃。 */
function typewriter(ac: BaseAudioContext, out: AudioNode, kind: KeySound, time: number) {
  const peak = 0.7 * jitter(0.15)
  if (kind === 'enter') {
    // 换行：滑架「嚓」一声，然后「叮」
    noiseHit(ac, out, time, { type: 'bandpass', freq: 1200, q: 0.7, peak: peak * 0.4, decay: 0.15 })
    const ding = time + 0.12
    tone(ac, out, ding, { type: 'sine', from: 2093, to: 2093, slide: 0.01, peak: 0.12, decay: 1.0 })
    tone(ac, out, ding, { type: 'sine', from: 5250, to: 5250, slide: 0.01, peak: 0.03, decay: 0.4 })
    return
  }
  const pitch = kind === 'delete' ? 0.75 : jitter(0.08)
  noiseHit(ac, out, time, { type: 'bandpass', freq: 1800 * pitch, q: 1.5, peak, decay: 0.03 })
  tone(ac, out, time, { type: 'square', from: 1150 * pitch, to: 1100 * pitch, slide: 0.01, peak: peak * 0.06, decay: 0.02 })
  tone(ac, out, time, { type: 'sine', from: 160, to: 110, slide: 0.04, peak: peak * 0.6, decay: 0.05 })
}

/** 木鱼：空心木头。基音加一个不和谐的泛音（约 2.7 倍），很快就停。 */
function wood(ac: BaseAudioContext, out: AudioNode, kind: KeySound, time: number) {
  const base = { key: 640, delete: 520, enter: 420 }[kind] * jitter(0.04)
  const peak = 0.6 * jitter(0.15)
  const decay = kind === 'enter' ? 0.14 : 0.08
  tone(ac, out, time, { type: 'sine', from: base * 1.06, to: base, slide: 0.01, peak, decay })
  tone(ac, out, time, { type: 'sine', from: base * 2.72, to: base * 2.7, slide: 0.01, peak: peak * 0.25, decay: decay * 0.5 })
  noiseHit(ac, out, time, { type: 'bandpass', freq: 3000, q: 1, peak: peak * 0.15, decay: 0.006 })
}

/**
 * 琴：Karplus–Strong 拨弦，音阶是都节（D E♭ G A B♭），日本的味道。
 * 每敲一下在音阶上走一两步，听起来像在弹一段旋律而不是乱响；
 * 退格往下走，回车弹一个空五度收尾。
 */
const MIYAKO = [293.66, 311.13, 392.0, 440.0, 466.16, 587.33, 622.25, 783.99]
let kotoStep = 2

function koto(ac: BaseAudioContext, out: AudioNode, kind: KeySound, time: number) {
  if (kind === 'enter') {
    pluck(ac, out, time, MIYAKO[0], 0.35)
    pluck(ac, out, time + 0.03, MIYAKO[3], 0.25)
    kotoStep = 2
    return
  }
  if (kind === 'delete') {
    kotoStep = Math.max(0, kotoStep - 1)
  } else {
    const move = [-2, -1, 1, 1, 2][Math.floor(Math.random() * 5)]
    kotoStep = Math.min(MIYAKO.length - 1, Math.max(0, kotoStep + move))
  }
  pluck(ac, out, time, MIYAKO[kotoStep], 0.5 * jitter(0.15))
}

const plucks = new WeakMap<BaseAudioContext, Map<number, AudioBuffer>>()

/** 拨一下弦：同一个音高的波形算一次缓存起来。 */
function pluck(ac: BaseAudioContext, out: AudioNode, time: number, freq: number, peak: number) {
  let cache = plucks.get(ac)
  if (!cache) {
    cache = new Map()
    plucks.set(ac, cache)
  }
  let buffer = cache.get(freq)
  if (!buffer) {
    buffer = karplusStrong(ac, freq, 0.9)
    cache.set(freq, buffer)
  }
  const src = ac.createBufferSource()
  src.buffer = buffer
  const gain = ac.createGain()
  gain.gain.value = peak
  src.connect(gain).connect(out)
  src.start(time)
}

/** 一段噪声在延迟线里来回、每圈取平均，高频慢慢磨掉 —— 就是弦被拨之后的声音。 */
function karplusStrong(ac: BaseAudioContext, freq: number, seconds: number): AudioBuffer {
  const length = Math.floor(ac.sampleRate * seconds)
  const buffer = ac.createBuffer(1, length, ac.sampleRate)
  const data = buffer.getChannelData(0)
  const period = Math.round(ac.sampleRate / freq)
  for (let i = 0; i < period; i++) data[i] = Math.random() * 2 - 1
  for (let i = period; i < length; i++) {
    // 这一圈的样本 = 上一圈相邻两个样本的平均，再乘一点衰减
    const before = i - period - 1 >= 0 ? data[i - period - 1] : data[i - period]
    data[i] = 0.992 * 0.5 * (data[i - period] + before)
  }
  // 起音太冲，前 2 毫秒淡入一下
  const fade = Math.floor(ac.sampleRate * 0.002)
  for (let i = 0; i < fade; i++) data[i] *= i / fade
  return buffer
}

/** 泡泡：正弦往上一滑。退格往下滑，回车连着两个。 */
function bubble(ac: BaseAudioContext, out: AudioNode, kind: KeySound, time: number) {
  const peak = 0.55 * jitter(0.15)
  const start = 260 * jitter(0.15)
  if (kind === 'delete') {
    tone(ac, out, time, { type: 'sine', from: start * 2.6, to: start, slide: 0.05, peak, decay: 0.06 })
    return
  }
  if (kind === 'enter') {
    tone(ac, out, time, { type: 'sine', from: start, to: start * 2.6, slide: 0.04, peak: peak * 0.6, decay: 0.06 })
    const later = time + 0.07
    tone(ac, out, later, { type: 'sine', from: start * 1.3, to: start * 3.6, slide: 0.05, peak: peak * 0.6, decay: 0.08 })
    return
  }
  tone(ac, out, time, { type: 'sine', from: start, to: start * (2.4 + Math.random()), slide: 0.04, peak, decay: 0.06 })
}
