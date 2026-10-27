/**
 * 批量导入文章：从 .docx / .txt 里切出一篇篇阅读题。
 *
 * 认的是 JLPT 读解讲义那种排法 ——「本文（1）」「本文A」「本文」各起一篇，
 * 「本文B」接在「本文A」后面（对比阅读是一道题）；「問題10…」这种大题标题
 * 和文件开头的说明不要；读到【正解】就停，答案不放进正文。
 * 一个「本文」都没有的文件整个算一篇。
 */

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'

/** 「本文」「本文（2）」「本文 A」。字母留着，用来认出 B 要接在 A 后面 */
const PASSAGE = /^本文\s*(?:[（(]\s*\d+\s*[）)]|([A-ZＡ-Ｚ]))?$/

/** 大题标题，「問題10　短篇阅读（問55–59）」 */
const SECTION = /^問題\s*\d+/

const ANSWERS = /^【(?:正解|解答|答案)】/

export interface BatchFile {
  /** 去掉扩展名的文件名，拿来当标题 */
  name: string
  passages: string[]
}

export async function readBatchFile(file: File): Promise<BatchFile> {
  const name = file.name.replace(/\.(docx|txt)$/i, '')
  const lines = /\.docx$/i.test(file.name)
    ? await readDocxLines(file)
    : (await file.text()).split(/\r?\n/)
  return { name, passages: splitPassages(lines) }
}

/**
 * 每段一行。只要文字：w:t 拼起来，w:tab 当制表符，w:br 当换行。
 *
 * 给了 underline 就把带下划线的字用这对记号括起来 —— 真题里「下線部」
 * 是题目的一部分，光要文字就丢了。连着几个带下划线的 run 并成一对。
 */
export async function readDocxLines(
  file: File,
  underline?: readonly [string, string],
): Promise<string[]> {
  const { default: JSZip } = await import('jszip')
  const zip = await JSZip.loadAsync(file).catch(() => {
    throw new Error(`${file.name} 不是有效的 .docx 文件`)
  })
  const xml = await zip.file('word/document.xml')?.async('string')
  if (!xml) throw new Error(`${file.name} 里找不到正文`)

  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  return Array.from(doc.getElementsByTagNameNS(W, 'p'), (p) => {
    let text = ''
    let open = false
    const close = () => {
      if (open && underline) text += underline[1]
      open = false
    }
    for (const node of Array.from(p.getElementsByTagNameNS(W, '*'))) {
      if (node.localName === 't') {
        const value = node.textContent ?? ''
        if (underline && value !== '') {
          if (!isUnderlined(node.parentElement)) close()
          else if (!open) {
            text += underline[0]
            open = true
          }
        }
        text += value
      } else if (node.localName === 'tab') text += '\t'
      else if (node.localName === 'br' || node.localName === 'cr') {
        // 记号不跨行：换行前先收口
        close()
        text += '\n'
      }
    }
    close()
    return text
  }).flatMap((text) => text.split('\n'))
}

/** run 自己的格式里有 <w:u>，而且不是 w:val="none" */
function isUnderlined(run: Element | null): boolean {
  const props = run && Array.from(run.children).find((child) => child.localName === 'rPr')
  const u = props && Array.from(props.children).find((child) => child.localName === 'u')
  return !!u && u.getAttributeNS(W, 'val') !== 'none'
}

export function splitPassages(lines: string[]): string[] {
  const end = lines.findIndex((l) => ANSWERS.test(l.trim()))
  const kept = (end === -1 ? lines : lines.slice(0, end)).map((l) => l.trimEnd())
  if (!kept.some((l) => PASSAGE.test(l.trim()))) return tidy([kept])

  const passages: string[][] = []
  let current: string[] | null = null

  for (const line of kept) {
    const head = line.trim()
    const passage = head.match(PASSAGE)
    if (passage) {
      const letter = passage[1]?.normalize('NFKC')
      if (letter && letter !== 'A' && current) {
        current.push('', head)
        continue
      }
      // 对比阅读留着「本文A」「本文B」好分清两篇；单篇的标签标题里的编号已经有了
      current = letter ? [head] : []
      passages.push(current)
      continue
    }

    if (SECTION.test(head)) {
      current = null
      continue
    }
    current?.push(line)
  }

  return tidy(passages)
}

/** 拼成正文，去掉首尾空行，空的不要。 */
function tidy(passages: string[][]): string[] {
  return passages.map((p) => p.join('\n').replace(/^\n+|\n+$/g, '')).filter((p) => p.trim() !== '')
}

/** 一篇就用文件名；多篇在后面加两位编号：「…読解 01」。 */
export function passageTitle(name: string, index: number, total: number): string {
  return total === 1 ? name : `${name} ${String(index + 1).padStart(2, '0')}`
}
