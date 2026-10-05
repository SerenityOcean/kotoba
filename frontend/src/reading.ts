import { annotateFurigana, splitForFurigana } from './api'
import type { Piece } from './api'

/**
 * 注音记法 `諦[あきら]める`。底字只认汉字 —— 和后端 FuriganaNotation 的规则
 * 必须一致，两边改要一起改。
 */
export const RUBY = /([一-鿿々〆ヶ]+)\[([^[\]]+)\]/g

/** 去掉注音，留下底字。改文章时编辑框里放的是这个。 */
export function stripFurigana(text: string): string {
  return text.replace(RUBY, '$1')
}

/** 注音时同时在飞的请求数。 */
const CONCURRENCY = 4

/**
 * 给整篇正文注音：按块并行，每块回来填回原位。plain 是没注上音、原样留下的块数。
 *
 * 某一块注不上（模型改了正文、或者请求失败）就用原文，不让整篇存不下来 ——
 * 文章是你的东西，注音只是锦上添花，不该因为它丢了正文。
 *
 * 改文章时传 previous（原来带注音的正文）：没动过的行直接用原来的注音，
 * 不再跑模型 —— 改一个错字不该把整篇重注一遍。
 */
export async function annotateArticle(
  body: string,
  previous: string | null,
  onProgress: (done: number, total: number) => void,
): Promise<{ text: string; plain: number }> {
  const reuse = new Map<string, string>()
  for (const line of previous?.split('\n') ?? []) {
    reuse.set(stripFurigana(line), line)
  }

  const pieces: Piece[] = []
  body.split('\n').forEach((line, index) => {
    if (index > 0) pieces.push({ text: '\n', annotate: false })
    const kept = reuse.get(line)
    if (kept !== undefined) {
      pieces.push({ text: kept, annotate: false })
    } else {
      pieces.push(...splitForFurigana(line))
    }
  })

  const targets = pieces.flatMap((p, i) => (p.annotate ? [i] : []))
  const annotated = pieces.map((p) => p.text)
  let done = 0
  let plain = 0
  let cursor = 0
  onProgress(0, targets.length)

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, targets.length) }, async () => {
      while (cursor < targets.length) {
        const index = targets[cursor++]
        try {
          const result = await annotateFurigana(pieces[index].text)
          annotated[index] = result.text
          if (!result.annotated) plain += 1
        } catch {
          plain += 1
        }
        onProgress(++done, targets.length)
      }
    }),
  )

  return { text: annotated.join(''), plain }
}

/**
 * 列表最后停在哪一页、搜的什么（`?page=3&q=…`）。从文章、编辑页回列表时
 * 回到原处，而不是每次都掉回第一页。只记在内存里，刷新就忘，够用了。
 */
let listSearch = ''

export function rememberListSearch(search: string) {
  listSearch = search
}

export function readingListPath(): string {
  return `/reading${listSearch}`
}
