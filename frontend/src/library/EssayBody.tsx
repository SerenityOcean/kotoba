import type { ReactNode } from 'react'
import Furigana from '../components/Furigana'
import { chineseNumeral, FOOTNOTE_REF, parseEssay } from './essay-markup'
import KanaCards from './KanaCards'

/**
 * 随笔正文。字号、字体从外面的 CSS 变量 --fs、--body 来（阅读器顶栏能调），
 * 所以这里的尺寸都用 em：调大字号时小标题、例句、旁注跟着一起放大。
 */
/** 宽屏右边空白里的旁注；拆解面板开着时右边被占了，旁注就跟在段落后面 */
const SIDE_NOTE =
  'min-[1180px]:absolute min-[1180px]:top-1 min-[1180px]:left-[calc(100%+3rem)] min-[1180px]:m-0 min-[1180px]:w-44 min-[1180px]:rounded-none min-[1180px]:border-l min-[1180px]:border-usu min-[1180px]:bg-transparent min-[1180px]:py-0 min-[1180px]:pr-0 min-[1180px]:pl-3'

export default function EssayBody({ body, wideNotes = true }: { body: string; wideNotes?: boolean }) {
  const { blocks, footnotes } = parseEssay(body)

  return (
    <div className="font-[family-name:var(--body)] leading-[2.05] tracking-[0.02em] [text-align:justify]">
      {blocks.map((block, i) => {
        switch (block.kind) {
          case 'h':
            return (
              <h2
                key={i}
                className="mt-[3.2em] mb-[1.2em] flex items-baseline gap-[0.9em] font-mincho text-[1.25em] tracking-[0.12em]"
              >
                <span className="text-[0.8em] tracking-normal text-ai">{chineseNumeral(block.n)}</span>
                <Inline text={block.text} footnotes={footnotes} />
              </h2>
            )
          case 'quote':
            return (
              <blockquote
                key={i}
                className="my-[2.4em] border-l-2 border-ai pl-[1.4em] text-left font-mincho text-[1.2em] leading-[1.95] whitespace-pre-line"
              >
                <Inline text={block.text} footnotes={footnotes} />
              </blockquote>
            )
          case 'example':
            return (
              <div
                key={i}
                className="my-[2em] rounded-[14px] border border-ai/15 bg-ai/[0.04] px-[1.4em] py-[1.3em] text-left"
              >
                <p lang="ja" className="font-mincho text-[1.18em] leading-[2.3] tracking-[0.06em]">
                  <Furigana text={block.jp} />
                </p>
                {block.zh && (
                  <p className="mt-[0.3em] font-ui text-[0.82em] whitespace-pre-line text-hai">{block.zh}</p>
                )}
                {block.note && (
                  <p className="mt-[0.9em] border-t border-ai/15 pt-[0.9em] font-ui text-[0.8em] leading-[1.9] whitespace-pre-line text-sumi/75">
                    <Inline text={block.note} footnotes={footnotes} />
                  </p>
                )}
              </div>
            )
          case 'kana':
            return <KanaCards key={i} table={block.table} />
          case 'p':
            return (
              <div key={i} className="relative">
                <p className={`mb-[1.35em] ${block.lead ? 'text-[1.12em] leading-[2] text-sumi/85' : ''}`}>
                  <Inline text={block.text} footnotes={footnotes} />
                </p>
                {block.notes.map((note) => (
                  // 宽屏：放进正文右边的空白，和引用它的那一段顶端对齐；窄屏：跟在这一段后面
                  <aside
                    key={note.n}
                    className={`-mt-[0.6em] mb-[1.4em] rounded-[10px] bg-usu/60 px-[0.9em] py-[0.7em] text-left font-ui text-[0.78em] leading-[1.8] text-hai ${wideNotes ? SIDE_NOTE : ''}`}
                  >
                    <span className="mr-1.5 text-ai">{note.n}</span>
                    {note.text}
                  </aside>
                ))}
              </div>
            )
        }
      })}
    </div>
  )
}

/** 一段里的文字：方括号注音渲染成振り仮名，[^id] 换成上标的旁注编号。 */
function Inline({ text, footnotes }: { text: string; footnotes: Map<string, number> }) {
  // 先切旁注再注音：「五十音[^1]」要是先交给 Furigana，会被当成「五十音」念作「^1」
  const parts: ReactNode[] = []
  let cursor = 0
  for (const match of text.matchAll(FOOTNOTE_REF)) {
    if (match.index > cursor) {
      parts.push(<Furigana key={cursor} text={text.slice(cursor, match.index)} />)
    }
    parts.push(
      <sup key={`n${match.index}`} data-skip className="mx-[0.1em] font-ui text-[0.7em] text-ai">
        {footnotes.get(match[1]) ?? '?'}
      </sup>,
    )
    cursor = match.index + match[0].length
  }
  if (cursor < text.length) {
    parts.push(<Furigana key={cursor} text={text.slice(cursor)} />)
  }
  return <>{parts}</>
}
