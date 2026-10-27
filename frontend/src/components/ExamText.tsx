import type { ReactNode } from 'react'
import Furigana from './Furigana'
import { UNDERLINE_CLOSE, UNDERLINE_OPEN } from '../exam'

/**
 * ⟦…⟧ 是下线部；（注1）是本文里的注释记号 ——「注」是汉字，注音之后
 * 变成了（注[ちゅう]1），两种都认，半角括号也认；【50】是文章の文法里
 * 要填的空；＿＿ 和 ★ 是排列题的四个空格。
 */
const MARKS = new RegExp(
  [
    `${UNDERLINE_OPEN}([^${UNDERLINE_CLOSE}]*)${UNDERLINE_CLOSE}`,
    '[（(]注(?:\\[[^\\]]*\\])?(\\d*)[）)]',
    '【(\\d+)】',
    '(_{2,}|＿+|★)',
  ].join('|'),
  'g',
)

/** 有空格的才是排列题；别处的 ★ 是普通符号（读解里拿它标注意事项） */
const BLANK = /_{2,}|＿/

/**
 * 卷面上的一段文字：振り仮名、下线部、注释记号、填空的空格。
 *
 * 注释记号、空格都标了 data-skip，选中拆解时不会混进送去的句子里。
 */
export default function ExamText({ text }: { text: string }) {
  return render(text)
}

function render(text: string): ReactNode {
  if (!/[⟦（(【_＿★]/.test(text)) return <Furigana text={text} />

  const blanks = BLANK.test(text)
  const parts: ReactNode[] = []
  let cursor = 0
  for (const match of text.matchAll(MARKS)) {
    const [whole, underlined, note, gap, slot] = match
    // 不是排列题的 ★：当普通文字，留给下一段一起出
    if (slot === '★' && !blanks) continue
    if (match.index > cursor) {
      parts.push(<Furigana key={cursor} text={text.slice(cursor, match.index)} />)
    }
    parts.push(
      underlined !== undefined ? (
        // 下线部里可能夹着注释记号，接着往里拆
        <span key={match.index} className="underline decoration-1 underline-offset-[0.35em]">
          {render(underlined)}
        </span>
      ) : note !== undefined ? (
        <sup
          key={match.index}
          data-skip
          className="mx-px font-ui text-[0.55em] tracking-normal text-hai select-none"
        >
          注{note}
        </sup>
      ) : gap !== undefined ? (
        <span
          key={match.index}
          data-skip
          className="mx-0.5 inline-block min-w-[2.4em] border border-sumi/50 px-1 text-center font-ui text-xs leading-[1.8] tabular-nums text-hai select-none"
        >
          {gap}
        </span>
      ) : (
        <span
          key={match.index}
          data-skip
          className="inline-block w-[3em] border-b border-sumi/60 text-center font-ui text-xs leading-[1.4] text-hai select-none"
        >
          {slot === '★' ? '★' : ' '}
        </span>
      ),
    )
    cursor = match.index + whole.length
  }
  if (cursor < text.length) {
    parts.push(<Furigana key={cursor} text={text.slice(cursor)} />)
  }
  return <>{parts}</>
}
