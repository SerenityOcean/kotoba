import type { ReactNode } from 'react'
import Furigana from '../components/Furigana'
import { chineseNumeral, EMPHASIS, FOOTNOTE_REF, parseEssay } from './essay-markup'
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
    // 不两端对齐：一行里碰上放不下的英文单词，两端对齐会把整行汉字拉散。中文字宽一样，左对齐右边照样齐。
    // text-pretty 不让最后一行只剩一两个字；text-autospace 在中英文之间自动留一点空（不支持的浏览器照常显示）
    <div className="font-[family-name:var(--body)] leading-[2.05] tracking-[0.02em] text-pretty [text-autospace:normal]">
      {blocks.map((block, i) => {
        switch (block.kind) {
          case 'h':
            return (
              <h2
                key={i}
                id={`s${block.n}`}
                className="mt-[3.2em] mb-[1.2em] flex scroll-mt-20 items-baseline gap-[0.9em] font-mincho text-[1.25em] tracking-[0.12em]"
              >
                <span className="text-[0.8em] tracking-normal text-ai">{chineseNumeral(block.n)}</span>
                <Inline text={block.text} footnotes={footnotes} />
              </h2>
            )
          case 'h3':
            return (
              <h3
                key={i}
                className="mt-[2.6em] mb-[0.9em] flex items-baseline gap-[0.7em] font-mincho text-[1.08em] tracking-[0.08em]"
              >
                <span aria-hidden className="h-px w-[1em] shrink-0 translate-y-[-0.3em] bg-ai/70" />
                <span>
                  <Inline text={block.text} footnotes={footnotes} />
                </span>
              </h3>
            )
          case 'list': {
            const List = block.ordered ? 'ol' : 'ul'
            return (
              <List key={i} className="my-[1.6em] space-y-[0.9em]">
                {block.items.map(([first, ...more], j) => (
                  <li key={j} className="relative pl-[1.6em]">
                    <span
                      aria-hidden
                      className={`absolute left-0 font-ui text-ai ${
                        block.ordered ? 'top-0 text-[0.82em] leading-[2.5] tabular-nums' : 'top-[0.95em] h-[0.3em] w-[0.3em] rounded-full bg-ai/70'
                      }`}
                    >
                      {block.ordered ? `${j + 1}.` : null}
                    </span>
                    <Inline text={first} footnotes={footnotes} />
                    {more.map((text, k) => (
                      <p key={k} className="mt-[0.35em] text-sumi/75">
                        <Inline text={text} footnotes={footnotes} />
                      </p>
                    ))}
                  </li>
                ))}
              </List>
            )
          }
          case 'figure':
            return (
              <figure key={i} className="my-[2.6em] text-center">
                {/* 漫画里有字：点开看原图，手机上能放大 */}
                <a href={block.src} target="_blank" rel="noreferrer" className="inline-block max-w-full">
                  {/* 写了尺寸：图还没下完就按比例占好位置，下面的字不会跳；高图按比例收窄，不超过一屏的 85% */}
                  <img
                    src={block.src}
                    alt={block.alt}
                    width={block.width}
                    height={block.height}
                    decoding="async"
                    style={
                      block.width && block.height
                        ? { maxWidth: `min(100%, calc(85vh * ${block.width} / ${block.height}))` }
                        : undefined
                    }
                    className={`mx-auto block h-auto rounded-[12px] border border-usu bg-usu/40 transition-[filter] [[data-theme=dark]_&]:brightness-[0.82] ${
                      block.width && block.height ? '' : 'max-h-[85vh] w-auto max-w-full'
                    }`}
                  />
                </a>
                {block.caption && (
                  <figcaption className="mt-[0.9em] font-ui text-[0.78em] tracking-[0.04em] text-hai">
                    <Inline text={block.caption} footnotes={footnotes} />
                  </figcaption>
                )}
              </figure>
            )
          case 'quote': {
            // 最后一行「—— 某某」是出处，小一号靠右
            const lines = block.text.split('\n')
            const source = lines.length > 1 && lines[lines.length - 1].startsWith('——') ? lines.pop() : null
            return (
              <blockquote
                key={i}
                className="my-[2.4em] border-l-2 border-ai pl-[1.4em] text-left font-mincho text-[1.2em] leading-[1.95] whitespace-pre-line"
              >
                <Inline text={lines.join('\n')} footnotes={footnotes} />
                {source && (
                  <footer className="mt-[0.6em] text-right font-ui text-[0.62em] tracking-[0.06em] text-hai">
                    {source}
                  </footer>
                )}
              </blockquote>
            )
          }
          case 'refs':
            return (
              <section key={i} className="mt-[3.2em] border-t border-usu pt-[1.6em] font-ui text-[0.78em] leading-[1.8] text-sumi/75">
                <h3 className="mb-[1em] text-[0.95em] tracking-[0.3em] text-hai">{block.title}</h3>
                <ol className="space-y-[0.7em]">
                  {block.items.map((item, j) => (
                    // 悬挂缩进：第二行起往里缩，一条一条分得清
                    <li key={j} className="pl-[2em] -indent-[2em] [text-autospace:no-autospace]">
                      <Inline text={item} footnotes={footnotes} />
                    </li>
                  ))}
                </ol>
              </section>
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

/** 一段里的文字：方括号注音渲染成振り仮名，[^id] 换成上标的旁注编号，**粗体**、*斜体*。 */
function Inline({ text, footnotes }: { text: string; footnotes: Map<string, number> }) {
  // 先切旁注再注音：「五十音[^1]」要是先交给 Furigana，会被当成「五十音」念作「^1」
  const parts: ReactNode[] = []
  let cursor = 0
  for (const match of text.matchAll(FOOTNOTE_REF)) {
    if (match.index > cursor) {
      parts.push(<Emphasis key={cursor} text={text.slice(cursor, match.index)} />)
    }
    parts.push(
      <sup key={`n${match.index}`} data-skip className="mx-[0.1em] font-ui text-[0.7em] text-ai">
        {footnotes.get(match[1]) ?? '?'}
      </sup>,
    )
    cursor = match.index + match[0].length
  }
  if (cursor < text.length) {
    parts.push(<Emphasis key={cursor} text={text.slice(cursor)} />)
  }
  return <>{parts}</>
}

function Emphasis({ text }: { text: string }) {
  const parts: ReactNode[] = []
  let cursor = 0
  for (const match of text.matchAll(EMPHASIS)) {
    if (match.index > cursor) parts.push(<Furigana key={cursor} text={text.slice(cursor, match.index)} />)
    parts.push(
      match[1] !== undefined ? (
        <strong key={`b${match.index}`} className="font-semibold text-sumi">
          <Furigana text={match[1]} />
        </strong>
      ) : (
        <em key={`i${match.index}`}>
          <Furigana text={match[2]} />
        </em>
      ),
    )
    cursor = match.index + match[0].length
  }
  if (cursor < text.length) parts.push(<Furigana key={cursor} text={text.slice(cursor)} />)
  return <>{parts}</>
}
