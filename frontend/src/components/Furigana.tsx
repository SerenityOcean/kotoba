import type { ReactNode } from 'react'

/**
 * 把 `諦[あきら]める` 这种记法渲染成真正的振り仮名 —— 假名排在汉字上方，
 * 而不是挤在括号里。记法沿用 Anki 自己的方括号写法，手动建卡也能用。
 *
 * 底字只认汉字：`これは諦[あきら]める` 里只有「諦」会被注音，
 * 前面的假名不会被卷进去。
 */
const RUBY = /([一-鿿々〆ヶ]+)\[([^[\]]+)\]/g

export default function Furigana({ text }: { text: string }) {
  if (!text.includes('[')) {
    return <>{text}</>
  }

  const parts: ReactNode[] = []
  let cursor = 0

  for (const match of text.matchAll(RUBY)) {
    const [whole, base, reading] = match
    const start = match.index

    if (start > cursor) {
      parts.push(text.slice(cursor, start))
    }
    parts.push(
      <ruby key={start}>
        {base}
        <rt>{reading}</rt>
      </ruby>,
    )
    cursor = start + whole.length
  }

  if (cursor < text.length) {
    parts.push(text.slice(cursor))
  }

  return <>{parts}</>
}
