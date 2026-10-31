import qrcode from 'qrcode-generator'
import { parseEssay } from './essay-markup'
import type { EssayBlock } from './essay-markup'
import { splitTitle } from './essay-title'

/**
 * 随笔的分享图：一句话 + 题目 + 二维码，发朋友圈用。
 * 在浏览器里用 canvas 画，出的是 data: 地址 —— 页面的 CSP 只放行 'self' 和 data: 的图，blob: 不行。
 */

export const MAX_QUOTE = 120

const WIDTH = 1080
const PAD = 96
const PAPER = '#fbfaf8'
const INK = '#1a1a18'
const BLUE = '#26456e'
const GREY = '#8a8780'
const RULE = '#e8e5e0'
const MINCHO = '"Hiragino Mincho ProN", "Yu Mincho", "Noto Serif JP", "Songti SC", serif'
const SANS = 'ui-sans-serif, system-ui, "Hiragino Sans", "PingFang SC", sans-serif'

/** 行首不能出现的标点，和行尾不能出现的开括号 */
const NO_START = new Set('，。、；：！？）」』》”’…—·,.;:!?)]}')
const NO_END = new Set('（「『《“‘([{')

/** 去掉随笔标记：**粗体**、*斜体*、[^1] 旁注 */
function plain(text: string): string {
  return text
    .replace(/\[\^[^\]]+\]/g, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}

/** 候选金句的上限：再多就翻不过来了 */
const MAX_CANDIDATES = 24

/**
 * 从正文里挑出几句适合上图的话：引文和小标题一定有，其余是长度合适的整句。
 * 太多时均匀抽，保证前后都有。第一项是默认的。
 */
export function quoteCandidates(body: string): string[] {
  const { blocks } = parseEssay(body)
  const picked: string[] = []
  const sentences: string[] = []
  for (const block of blocks as EssayBlock[]) {
    if (block.kind === 'quote') picked.push(plain(block.text))
    else if (block.kind === 'h') picked.push(plain(block.text))
    else if (block.kind === 'p') {
      for (const s of plain(block.text).split(/(?<=[。！？!?])/)) {
        const sentence = s.trim()
        if (sentence.length >= 14 && sentence.length <= 60) sentences.push(sentence)
      }
    }
  }
  const room = Math.max(0, MAX_CANDIDATES - picked.length)
  const step = sentences.length > room && room > 0 ? sentences.length / room : 1
  const extra: string[] = []
  for (let at = 0; at < sentences.length && extra.length < room; at += step) extra.push(sentences[Math.floor(at)])
  const all = [...picked, ...extra].filter((s) => s !== '' && s.length <= MAX_QUOTE)
  return [...new Set(all)]
}

/** 一段文字按宽度折行：连着的英文数字当一个词，不在半个词上断；标点不出现在行首 */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = []
  for (const paragraph of text.split('\n')) {
    let line = ''
    for (const token of paragraph.match(/[A-Za-z0-9'’\-.]+|\s|[\s\S]/gu) ?? []) {
      const next = line + token
      if (line !== '' && ctx.measureText(next).width > maxWidth && !NO_START.has(token[0])) {
        // 行尾留着个开括号会孤零零的：带到下一行去
        const last = line[line.length - 1]
        if (NO_END.has(last)) {
          lines.push(line.slice(0, -1))
          line = last + token
        } else {
          lines.push(line.trimEnd())
          line = token === ' ' ? '' : token
        }
      } else {
        line = next
      }
    }
    if (line !== '') lines.push(line.trimEnd())
  }
  return lines
}

export interface PosterInput {
  title: string
  /** 「随笔 · 资料包名」之类的小字 */
  kicker: string
  quote: string
  url: string
}

/** 画出来，返回 PNG 的 data 地址 */
export function renderPoster({ title, kicker, quote, url }: PosterInput): string {
  const qr = qrcode(0, 'M')
  qr.addData(url)
  qr.make()

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!
  const inner = WIDTH - PAD * 2

  // 先量：字号和行距定下来，才知道图有多高
  const QUOTE_SIZE = quote.length > 70 ? 46 : quote.length > 36 ? 54 : 64
  const QUOTE_LEAD = Math.round(QUOTE_SIZE * 1.75)
  ctx.font = `${QUOTE_SIZE}px ${MINCHO}`
  const quoteLines = wrap(ctx, quote, inner)

  const { main, sub } = splitTitle(title)
  ctx.font = `600 40px ${MINCHO}`
  const mainLines = wrap(ctx, main, inner)
  ctx.font = `30px ${MINCHO}`
  const subLines = sub ? wrap(ctx, sub, inner) : []

  const QR = 232
  let y = PAD + 28 // 顶上的小字
  const kickerY = y
  y += 150
  const markY = y
  y += 40
  const quoteTop = y
  y += quoteLines.length * QUOTE_LEAD
  y += 64
  const ruleY = y
  y += 76
  const titleTop = y
  y += mainLines.length * 62 + (subLines.length ? 18 + subLines.length * 46 : 0)
  y += 96
  const footTop = y
  const height = footTop + QR + PAD

  canvas.width = WIDTH
  canvas.height = height
  // 改了尺寸之后上下文被重置，字体要重新设
  ctx.fillStyle = PAPER
  ctx.fillRect(0, 0, WIDTH, height)

  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = BLUE
  ctx.font = `28px ${SANS}`
  ctx.fillText(`言葉  ·  ${kicker}`, PAD, kickerY)

  ctx.fillStyle = BLUE
  ctx.globalAlpha = 0.28
  ctx.font = `200px ${MINCHO}`
  ctx.fillText('“', PAD - 8, markY + 70)
  ctx.globalAlpha = 1

  ctx.fillStyle = INK
  ctx.font = `${QUOTE_SIZE}px ${MINCHO}`
  quoteLines.forEach((line, i) => ctx.fillText(line, PAD, quoteTop + QUOTE_SIZE + i * QUOTE_LEAD - 14))

  ctx.fillStyle = INK
  ctx.fillRect(PAD, ruleY, 56, 2)

  ctx.font = `600 40px ${MINCHO}`
  ctx.fillStyle = INK
  mainLines.forEach((line, i) => ctx.fillText(line, PAD, titleTop + 40 + i * 62))
  if (subLines.length) {
    ctx.font = `30px ${MINCHO}`
    ctx.fillStyle = GREY
    const subTop = titleTop + mainLines.length * 62 + 18
    subLines.forEach((line, i) => ctx.fillText(line, PAD, subTop + 32 + i * 46))
  }

  // 底部：分隔线、二维码、一句提示
  ctx.fillStyle = RULE
  ctx.fillRect(PAD, footTop - 48, inner, 2)

  const count = qr.getModuleCount()
  const cell = Math.floor(QR / count)
  const size = cell * count
  const qrLeft = WIDTH - PAD - size
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(qrLeft - 16, footTop - 16, size + 32, size + 32)
  ctx.fillStyle = INK
  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      if (qr.isDark(r, c)) ctx.fillRect(qrLeft + c * cell, footTop + r * cell, cell, cell)
    }
  }

  ctx.fillStyle = INK
  ctx.font = `600 36px ${MINCHO}`
  ctx.fillText('长按识别二维码，读全文', PAD, footTop + 56)
  ctx.fillStyle = GREY
  ctx.font = `26px ${SANS}`
  ctx.fillText(url.replace(/^https?:\/\//, ''), PAD, footTop + 108)

  return canvas.toDataURL('image/png')
}
