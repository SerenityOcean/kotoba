import { toKana, toRomaji } from 'wanakana'

/**
 * 输入框里的罗马字实时转假名：modosu → もどす。
 *
 * IMEMode 下结尾单独一个 n 先不转 —— 可能是「な」行的开头，
 * 敲 nn 或者接辅音才变成「ん」。已经是假名的原样留着，所以用系统
 * 日语输入法直接打假名也照样能用。
 */
export function romajiToKana(text: string): string {
  return toKana(text, { IMEMode: true })
}

/**
 * 打完了、要交的时候：结尾等着的那个 n 也转成「ん」（hon → ほん）。
 * 边打边转时它得先留着，交上去显示的时候不该露出半个罗马字。
 */
export function finishKana(text: string): string {
  return toKana(text.trim())
}

/** 片假名 → 平假名。长音、中点不动。 */
function katakanaToHiragana(text: string): string {
  return text.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
}

const VOWEL_KANA: Record<string, string> = { a: 'あ', i: 'い', u: 'う', e: 'え', o: 'お' }

/**
 * 比较用的形式：全角半角统一、去空白、结尾没转完的 n 补成 ん、
 * 片假名转平假名、长音「ー」换成前一个假名的元音。
 *
 * 最后一步是因为「スーパー」有人敲 su-pa-（すーぱー），有人敲 suupaa（すうぱあ），
 * 两种都该算对。
 */
export function normalizeAnswer(text: string): string {
  const kana = katakanaToHiragana(toKana(text.normalize('NFKC').replace(/\s+/g, '')))
  let out = ''
  for (const c of kana) {
    if (c === 'ー' && out !== '') {
      const vowel = toRomaji(out.slice(-1)).slice(-1)
      out += VOWEL_KANA[vowel] ?? c
    } else {
      out += c
    }
  }
  return out
}

/** 读音里可能有好几个（きょう／こんにち），对上任意一个都算对。 */
export function readingsOf(reading: string): string[] {
  return reading
    .split(/[／/]/)
    .map((r) => r.trim())
    .filter((r) => r !== '')
}

export function isCorrect(answer: string, reading: string): boolean {
  const given = normalizeAnswer(answer)
  return given !== '' && readingsOf(reading).some((r) => normalizeAnswer(r) === given)
}

/**
 * 把写错的字标出来：answer 里不在最长公共子序列上的字就是错的。
 * 读音很短，O(n·m) 的表格完全没压力。
 */
export function markMistakes(answer: string, expected: string): { char: string; wrong: boolean }[] {
  const a = [...answer]
  const b = [...expected]
  const table = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0))
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      table[i][j] =
        normalizeAnswer(a[i]) === normalizeAnswer(b[j])
          ? table[i + 1][j + 1] + 1
          : Math.max(table[i + 1][j], table[i][j + 1])
    }
  }

  const marks: { char: string; wrong: boolean }[] = []
  let i = 0
  let j = 0
  while (i < a.length) {
    if (j < b.length && normalizeAnswer(a[i]) === normalizeAnswer(b[j])) {
      marks.push({ char: a[i], wrong: false })
      i++
      j++
    } else if (j < b.length && table[i][j + 1] > table[i + 1][j]) {
      j++
    } else {
      marks.push({ char: a[i], wrong: true })
      i++
    }
  }
  return marks
}

/** 几个读音里和 answer 最接近的那个，答错时拿它来对比。 */
export function closestReading(answer: string, reading: string): string {
  const options = readingsOf(reading)
  const score = (r: string) => markMistakes(answer, r).filter((m) => !m.wrong).length
  return options.reduce((best, r) => (score(r) > score(best) ? r : best), options[0] ?? reading)
}
