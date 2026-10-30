/**
 * 放卡片自带的录音（导入 Anki 牌组时一起传上来的）。没有录音的卡不出声 ——
 * 不拿浏览器的合成语音凑，那个听着像机器人。
 *
 * 同一时间只放一段：念着单词又点了例句，先把单词停掉。
 */

let current: HTMLAudioElement | null = null
// 正在放的那段的地址，喇叭按它亮。null = 没在放
let playing: string | null = null
const listeners = new Set<() => void>()
// 这张卡提前加载好的录音：答对时不用再等网络，重听也不用重新下
const loaded = new Map<string, HTMLAudioElement>()

function notify() {
  listeners.forEach((listener) => listener())
}

function element(url: string): HTMLAudioElement {
  let audio = loaded.get(url)
  if (!audio) {
    audio = new Audio(url)
    audio.preload = 'auto'
    loaded.set(url, audio)
  }
  return audio
}

/** 提前把这段录音下好。换到一张卡时调。 */
export function preloadAudio(url: string) {
  element(url)
}

/**
 * 放一段录音。要在点击、按键的处理函数里直接调：
 * 浏览器只让用户操作当下发起的声音出声。
 */
export function playAudio(url: string) {
  stopAudio()
  const audio = element(url)
  audio.currentTime = 0
  // 被下一段打断时这段也会停，那时 current 已经换了，不能把新那段的喇叭灭掉
  const done = () => {
    if (current !== audio) return
    current = null
    playing = null
    notify()
  }
  audio.onended = done
  audio.onerror = done
  current = audio
  playing = url
  notify()
  audio.play().catch(done)
}

/** 停下正在放的。 */
export function stopAudio() {
  if (current === null) return
  current.pause()
  current = null
  playing = null
  notify()
}

/** 换卡、离开复习页时用：停下来，上一张的录音也不留着。 */
export function resetAudio() {
  stopAudio()
  loaded.clear()
}

/** 正在放哪段，null = 没在放。 */
export function playingAudio(): string | null {
  return playing
}

/** 开始或放完一段时通知。给 useSyncExternalStore 用。 */
export function subscribeAudio(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
