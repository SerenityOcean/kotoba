import { KANA_TABLES } from './kana'
import type { KanaTable } from './kana'

/**
 * 资料随笔的标记。比 Markdown 小得多，只够写一篇讲学习方法的文章：
 *
 *   一行就是一段（空行可有可无）。第一段是导语，排得大一点。
 *   ## 小标题           自动编上「一 二 三」
 *   > 引文               连着几行算一段引文
 *   ::: 例               一块例句：第一行日语（方括号注音），第二行起是翻译，
 *   雨[あめ]が止[や]んだら。     「---」下面是讲解
 *   雨停了的话。
 *   ---
 *   「止む」是自动词……
 *   :::
 *   ::: 五十音 清音      一张五十音表，排成能翻面的卡片；表名是 清音、浊音、拗音，
 *   :::                  不写就是清音。块里不放内容
 *   正文里写 [^1]，     旁注：宽屏放在正文右边的空白里，窄屏跟在那一段后面
 *   [^1]: 旁注的内容     （定义写在哪儿都行）
 *
 * 后端 EssayText 按同一套规则摘纯文字算字数，两边改要一起改。
 */

export type EssayBlock =
  | { kind: 'p'; text: string; lead: boolean; notes: Footnote[] }
  | { kind: 'h'; text: string; n: number }
  | { kind: 'quote'; text: string }
  | { kind: 'example'; jp: string; zh: string; note: string }
  | { kind: 'kana'; table: KanaTable }

export interface Footnote {
  /** 读者看到的编号：按在正文里出现的先后从 1 数 */
  n: number
  text: string
}

const FOOTNOTE_DEF = /^\[\^([^\]]+)\]:\s*(.*)$/
export const FOOTNOTE_REF = /\[\^([^\]]+)\]/g

export interface ParsedEssay {
  blocks: EssayBlock[]
  /** 旁注 id → 读者看到的编号，正文里的 [^id] 渲染成这个数字 */
  footnotes: Map<string, number>
}

export function parseEssay(body: string): ParsedEssay {
  const lines = body.replace(/\r\n?/g, '\n').split('\n')

  // 旁注的定义先收起来，正文里引用到的时候再按出现顺序编号
  const definitions = new Map<string, string>()
  for (const line of lines) {
    const def = line.trim().match(FOOTNOTE_DEF)
    if (def) definitions.set(def[1], def[2].trim())
  }

  const blocks: EssayBlock[] = []
  const numbers = new Map<string, number>()
  let headings = 0
  let leadDone = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (line === '' || FOOTNOTE_DEF.test(line)) continue

    if (line.startsWith(':::')) {
      const label = line.slice(3).trim()
      const inside: string[] = []
      while (i + 1 < lines.length && lines[i + 1].trim() !== ':::') {
        inside.push(lines[++i].trim())
      }
      i++ // 跳过收尾的 :::
      if (label.startsWith('五十音')) {
        const table = label.slice(3).trim()
        blocks.push({ kind: 'kana', table: KANA_TABLES.find((t) => t === table) ?? '清音' })
        continue
      }
      const split = inside.indexOf('---')
      const head = (split < 0 ? inside : inside.slice(0, split)).filter((l) => l !== '')
      const tail = split < 0 ? [] : inside.slice(split + 1).filter((l) => l !== '')
      blocks.push({ kind: 'example', jp: head[0] ?? '', zh: head.slice(1).join('\n'), note: tail.join('\n') })
      continue
    }

    if (line.startsWith('## ')) {
      blocks.push({ kind: 'h', text: line.slice(3).trim(), n: ++headings })
      continue
    }

    if (line.startsWith('>')) {
      const quote = [line.replace(/^>\s*/, '')]
      while (i + 1 < lines.length && lines[i + 1].trim().startsWith('>')) {
        quote.push(lines[++i].trim().replace(/^>\s*/, ''))
      }
      blocks.push({ kind: 'quote', text: quote.join('\n') })
      continue
    }

    const notes: Footnote[] = []
    for (const [, id] of line.matchAll(FOOTNOTE_REF)) {
      if (!numbers.has(id)) numbers.set(id, numbers.size + 1)
      const text = definitions.get(id)
      if (text) notes.push({ n: numbers.get(id)!, text })
    }
    blocks.push({ kind: 'p', text: line, lead: !leadDone, notes })
    leadDone = true
  }

  return { blocks, footnotes: numbers }
}

/** 一 二 三 …… 十二 */
export function chineseNumeral(n: number): string {
  const digits = '〇一二三四五六七八九'
  if (n <= 10) return n === 10 ? '十' : digits[n]
  if (n < 20) return '十' + digits[n - 10]
  const tens = Math.floor(n / 10)
  return digits[tens] + '十' + (n % 10 === 0 ? '' : digits[n % 10])
}
