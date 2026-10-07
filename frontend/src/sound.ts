/**
 * 打字音。全部用 Web Audio 现场合成，不带音频文件，有好几种音色可选。
 *
 * 每一下的音高、响度都随机抖一点 —— 同一个声音反复播放听起来像机关枪，
 * 真键盘每一下都不太一样。所有声音先过一个总音量和压缩器再出去，
 * 几种音色之间响度差不多，连着敲也不会爆音。
 */

export type KeySound = 'key' | 'delete' | 'enter'

export type SoundPreset = 'wood' | 'bubble' | 'bamboo' | 'drop' | 'kalimba' | 'musicbox' | 'tink' | 'pop'

/** 一种音色：在 time 时刻往 out 里放一下 kind 的声音。 */
type Voice = (ac: BaseAudioContext, out: AudioNode, kind: KeySound, time: number) => void

/**
 * level 是这种音色整体的音量倍数：几种音色的音量天差地别（高频的短「叮」听着响、
 * 能量却很小），按离线渲染量出来的响度对齐过 —— 普通键前 150 毫秒都在 -35.5 dB 上下，
 * 偏高频的水滴耳朵听着更响，再压低 1.5 dB。换音色不会觉得忽大忽小。改了音色要重新量一遍。
 */
export const PRESETS: { id: SoundPreset; name: string; hint: string; level: number; voice: Voice }[] = [
  { id: 'wood', name: '木鱼', hint: '空心木头的「笃」', level: 1.7, voice: wood },
  { id: 'bubble', name: '泡泡', hint: '轻轻的「啵」', level: 2, voice: bubble },
  { id: 'bamboo', name: '竹筒', hint: '空竹管的「空」，回车像鹿威し', level: 1.19, voice: bamboo },
  { id: 'drop', name: '水滴', hint: '短短的「滴」，回车带涟漪', level: 2.58, voice: drop },
  { id: 'kalimba', name: '拇指琴', hint: '钢片拨响，五声音阶，打字成调', level: 0.52, voice: kalimba },
  { id: 'musicbox', name: '八音盒', hint: '一键一个音，连起来是《さくら さくら》', level: 0.43, voice: musicbox },
  { id: 'tink', name: 'Tink', hint: '像 Mac 的提示音，干净的一声「叮」', level: 2.52, voice: tink },
  { id: 'pop', name: 'Pop', hint: '像 Mac 的提示音，往上一挑的「啵」', level: 2.24, voice: pop },
]

export const DEFAULT_PRESET: SoundPreset = 'wood'

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
 * 读上次选的音色，null = 关掉。默认开着木鱼。
 * 老版本存的是 on / off，on 按默认音色算；存的是已经去掉的音色（闷声、琴之类）
 * 也按默认算。存储读不了就当默认。
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

/** 一个会滑音的单音：木鱼、竹筒、泡泡、水滴都是它。 */
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

/** 一组固定频率的正弦泛音，每个有自己的倍数、响度、衰减：琴片、八音盒都用它。 */
function partials(ac: BaseAudioContext, out: AudioNode, time: number, base: number, peak: number, list: [ratio: number, gain: number, decay: number][]) {
  for (const [ratio, gain, decay] of list) {
    tone(ac, out, time, { type: 'sine', from: base * ratio, to: base * ratio, slide: 0.01, peak: peak * gain, decay })
  }
}

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)]
}

// ---- 各种音色 ------------------------------------------------------------

/** 木鱼：空心木头。基音加一个不和谐的泛音（约 2.7 倍），很快就停。 */
function wood(ac: BaseAudioContext, out: AudioNode, kind: KeySound, time: number) {
  const base = { key: 640, delete: 520, enter: 420 }[kind] * jitter(0.04)
  const peak = 0.6 * jitter(0.15)
  const decay = kind === 'enter' ? 0.14 : 0.08
  tone(ac, out, time, { type: 'sine', from: base * 1.06, to: base, slide: 0.01, peak, decay })
  tone(ac, out, time, { type: 'sine', from: base * 2.72, to: base * 2.7, slide: 0.01, peak: peak * 0.25, decay: decay * 0.5 })
  noiseHit(ac, out, time, { type: 'bandpass', freq: 3000, q: 1, peak: peak * 0.15, decay: 0.006 })
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

/**
 * 竹筒：粗竹管被敲。一头堵住的管子只有奇次泛音（3 倍、5 倍），「空、空」的，
 * 比木鱼低沉。回车像鹿威し那一声，低一些、响得久一些。
 */
function bamboo(ac: BaseAudioContext, out: AudioNode, kind: KeySound, time: number) {
  const base = { key: 360, delete: 300, enter: 220 }[kind] * jitter(0.05)
  const peak = 0.6 * jitter(0.15)
  const decay = kind === 'enter' ? 0.32 : 0.12
  tone(ac, out, time, { type: 'sine', from: base * 1.12, to: base, slide: 0.015, peak, decay })
  tone(ac, out, time, { type: 'sine', from: base * 3.1, to: base * 3, slide: 0.01, peak: peak * 0.3, decay: decay * 0.45 })
  tone(ac, out, time, { type: 'sine', from: base * 5.1, to: base * 5, slide: 0.01, peak: peak * 0.1, decay: decay * 0.25 })
  noiseHit(ac, out, time, { type: 'bandpass', freq: 1800, q: 1.2, peak: peak * 0.2, decay: 0.012 })
}

/** 水滴：比泡泡高、更短的「滴」，往上一挑。退格往下落，回车多两圈涟漪。 */
function drop(ac: BaseAudioContext, out: AudioNode, kind: KeySound, time: number) {
  const peak = 0.5 * jitter(0.15)
  const f = (kind === 'delete' ? 700 : 1000) * jitter(0.12)
  if (kind === 'delete') {
    tone(ac, out, time, { type: 'sine', from: f * 2, to: f, slide: 0.03, peak, decay: 0.05 })
    return
  }
  const one = (t: number, p: number, k: number) => {
    tone(ac, out, t, { type: 'sine', from: f * k, to: f * k * 2.1, slide: 0.018, peak: p, decay: 0.045 })
    noiseHit(ac, out, t, { type: 'highpass', freq: 6000, q: 0.7, peak: p * 0.08, decay: 0.004 })
  }
  one(time, peak, 1)
  if (kind === 'enter') {
    one(time + 0.09, peak * 0.45, 0.9)
    one(time + 0.18, peak * 0.2, 0.82)
  }
}

/**
 * 拇指琴：钢片被拨，大调五声音阶。每敲一下在音阶上走一两步，听起来像在弹一段
 * 明快的小调子而不是乱响；退格往下走，回车弹一个分解和弦收尾。
 */
const PENTA = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.51]
let kalimbaStep = 2

function kalimba(ac: BaseAudioContext, out: AudioNode, kind: KeySound, time: number) {
  if (kind === 'enter') {
    tine(ac, out, time, PENTA[0], 0.32)
    tine(ac, out, time + 0.04, PENTA[2], 0.28)
    tine(ac, out, time + 0.08, PENTA[4], 0.28)
    kalimbaStep = 2
    return
  }
  if (kind === 'delete') {
    kalimbaStep = Math.max(0, kalimbaStep - 1)
  } else {
    kalimbaStep = Math.min(PENTA.length - 1, Math.max(0, kalimbaStep + pick([-2, -1, 1, 1, 2])))
  }
  tine(ac, out, time, PENTA[kalimbaStep], 0.45 * jitter(0.12))
}

/** 拨一下钢片：基音响得久，约 6 倍处有一个很快就没的金属泛音。 */
function tine(ac: BaseAudioContext, out: AudioNode, time: number, freq: number, peak: number) {
  partials(ac, out, time, freq, peak, [[1, 1, 0.38], [5.95, 0.12, 0.05], [3.0, 0.04, 0.06]])
  noiseHit(ac, out, time, { type: 'bandpass', freq: 4000, q: 2, peak: peak * 0.08, decay: 0.004 })
}

/**
 * 八音盒：每敲一下走一个音，打完一遍就是一首《さくら さくら》。
 * 退格退一个音，回车弹个低音收住、从头开始。
 */
const A5 = 880, B5 = 987.77, C6 = 1046.5, F5 = 698.46, E5 = 659.25, C5 = 523.25, B4 = 493.88
const SAKURA = [
  A5, A5, B5, A5, A5, B5,
  A5, B5, C6, B5, A5, B5, A5, F5,
  E5, C5, E5, F5, E5, E5, C5, B4,
  A5, B5, C6, B5, A5, B5, A5, F5,
  E5, C5, E5, F5, E5, E5, C5, B4,
  A5, A5, B5, A5, A5, B5,
  E5, F5, B5, A5, F5, E5,
]
let sakuraStep = 0

function musicbox(ac: BaseAudioContext, out: AudioNode, kind: KeySound, time: number) {
  if (kind === 'enter') {
    comb(ac, out, time, E5, 0.3, 0.8)
    comb(ac, out, time + 0.02, A5 / 2, 0.25, 0.8)
    sakuraStep = 0
    return
  }
  if (kind === 'delete') {
    sakuraStep = Math.max(0, sakuraStep - 1)
    comb(ac, out, time, SAKURA[sakuraStep] / 2, 0.3, 0.2)
    return
  }
  comb(ac, out, time, SAKURA[sakuraStep], 0.4 * jitter(0.1), 0.5)
  sakuraStep = (sakuraStep + 1) % SAKURA.length
}

/** 八音盒的一根梳齿：基音加 3 倍、5.8 倍的泛音，起头带一下拨片的「嚓」。 */
function comb(ac: BaseAudioContext, out: AudioNode, time: number, freq: number, peak: number, decay: number) {
  partials(ac, out, time, freq, peak, [[1, 1, decay], [3.0, 0.15, decay * 0.25], [5.8, 0.06, 0.03]])
  noiseHit(ac, out, time, { type: 'highpass', freq: 5000, q: 0.7, peak: peak * 0.06, decay: 0.003 })
}

// 下面两种照 Mac 系统音（/System/Library/Sounds）的频谱和包络重新合成，不是原文件。
// 原声拖得长，连着敲会糊，所以普通键只取起音那一下。

/** Tink：一个干净的 F5 正弦，50 毫秒就没了。退格低一个全音，回车往上叮两下。 */
function tink(ac: BaseAudioContext, out: AudioNode, kind: KeySound, time: number) {
  const peak = 0.6 * jitter(0.12)
  const f = (kind === 'delete' ? 587.33 : 698.46) * jitter(0.006)
  tone(ac, out, time, { type: 'sine', from: f, to: f, slide: 0.01, peak, decay: 0.05 })
  if (kind === 'enter') tone(ac, out, time + 0.09, { type: 'sine', from: 1046.5, to: 1046.5, slide: 0.01, peak, decay: 0.09 })
}

/** Pop：500 往 700 一挑的短「啵」，比泡泡快、比泡泡亮。退格往下挑，回车连啵两下。 */
function pop(ac: BaseAudioContext, out: AudioNode, kind: KeySound, time: number) {
  const peak = 0.6 * jitter(0.12)
  const k = jitter(0.04)
  const one = (t: number, from: number, to: number) =>
    tone(ac, out, t, { type: 'sine', from: from * k, to: to * k, slide: 0.03, peak, decay: 0.06 })
  if (kind === 'delete') {
    one(time, 700, 480)
    return
  }
  one(time, 500, 700)
  if (kind === 'enter') one(time + 0.06, 500, 700)
}
