import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import AnalysisResults, { SaveBar } from './AnalysisResults'
import { Chip, SendButton } from './SentenceBar'
import { SUGGESTIONS } from '../selection'
import type { SelectionAnalysis, Tab } from '../selection'

const TABS: readonly (readonly [Tab, string])[] = [
  ['parse', '拆解'],
  ['ask', '问答'],
]

/**
 * 侧栏：选中那一段的拆解和问答，各一栏。窄屏上是底部弹层，宽屏上变成右侧栏（xl 断点）：
 * 弹层会盖掉大半个屏幕，而宽屏本来就有空地方，没必要挡着正文。
 *
 * 这里只管显示结果，入口全在选区下面的浮条上（components/SentenceBar）——
 * 想拆别的、问别的，选中它就行。状态来自 useSelectionAnalysis；外层要配好两栏的 grid，见阅读页。
 */
export default function AnalysisPanel({ selection }: { selection: SelectionAnalysis }) {
  const { analysis, session, setTab, close, analyze } = selection
  if (!session) return null

  return (
    <aside className="fixed inset-x-0 bottom-0 z-20 max-h-[72vh] overflow-y-auto border-t border-usu bg-washi px-4 pb-4 shadow-[0_-4px_24px_rgba(0,0,0,0.06)] sm:px-8 xl:sticky xl:inset-auto xl:top-8 xl:max-h-[calc(100vh-4rem)] xl:border-t-0 xl:border-l xl:px-6 xl:pt-1 xl:shadow-none">
      <div className="sticky top-0 z-10 mb-3 flex items-baseline justify-between gap-3 bg-washi pt-4 pb-2 xl:pt-3">
        <div role="tablist" className="flex gap-5">
          {TABS.map(([tab, label]) => (
            <button
              key={tab}
              role="tab"
              aria-selected={session.tab === tab}
              onClick={() => setTab(tab)}
              className={`border-b pb-1 text-xs tracking-widest transition hover:text-sumi ${
                session.tab === tab ? 'border-sumi text-sumi' : 'border-transparent text-hai'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <button onClick={close} className="shrink-0 text-xs text-hai transition hover:text-sumi">
          收起
        </button>
      </div>

      {session.tab === 'parse' ? (
        session.parsed ? (
          <>
            {analysis.error && <p className="mb-3 text-sm text-shu">{analysis.error}</p>}
            <AnalysisResults analysis={analysis} />
            {analysis.hasResults && <SaveBar analysis={analysis} sticky={false} />}
          </>
        ) : (
          // 是从「提问」进来的，这段还没拆过。拆要花一次额度，点了才拆
          <>
            <Quote text={session.quote.text} />
            <p className="mt-5 text-sm text-hai">
              这段还没拆解。
              <button
                onClick={() => analyze(session.quote)}
                className="text-ai transition hover:opacity-75"
              >
                拆解这段
              </button>
            </p>
          </>
        )
      ) : (
        <Thread selection={selection} />
      )}
    </aside>
  )
}

/** 问答那一栏：问的是哪段、一问一答、接着问的输入框 */
function Thread({ selection }: { selection: SelectionAnalysis }) {
  const { session, ask } = selection
  const [question, setQuestion] = useState('')
  const end = useRef<HTMLFormElement>(null)

  const thread = session?.thread ?? []
  const waiting = thread.some((turn) => turn.answer === null && turn.error === null)
  const settled = thread.filter((turn) => turn.answer !== null || turn.error !== null).length

  // 新问了一句、回答到了：滚到最下面，输入框别被顶出去
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'nearest' })
  }, [thread.length, settled])

  if (!session) return null

  function send(text: string) {
    const asked = text.trim()
    if (asked === '' || waiting || !session) return
    ask(session.quote, asked)
    setQuestion('')
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    send(question)
  }

  return (
    <>
      <Quote text={session.quote.text} />

      {thread.length > 0 && (
        <div className="mt-5 space-y-4">
          {thread.map((turn, i) => (
            <div
              key={i}
              className="grid grid-cols-[1.6rem_minmax(0,1fr)] gap-y-2.5 border-b border-usu pb-4 text-sm leading-[1.8] last:border-b-0"
            >
              <span className="font-mincho text-xs leading-[2.1] text-shu">問</span>
              <p>{turn.question}</p>
              <span className="font-mincho text-xs leading-[2.1] text-ai">答</span>
              {turn.answer !== null ? (
                <p className="animate-rise-sm whitespace-pre-line">{turn.answer}</p>
              ) : turn.error !== null ? (
                <p className="text-shu">{turn.error}</p>
              ) : (
                <p className="animate-pulse text-hai">想一想…</p>
              )}
            </div>
          ))}
        </div>
      )}

      {thread.length === 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {SUGGESTIONS.map((suggestion) => (
            <Chip key={suggestion} onClick={() => send(suggestion)}>
              {suggestion}
            </Chip>
          ))}
        </div>
      )}

      <form
        ref={end}
        onSubmit={onSubmit}
        className="sticky bottom-0 mt-4 flex items-center gap-2 border-t border-usu bg-washi pt-2 pb-1"
      >
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          maxLength={500}
          placeholder={thread.length > 0 ? '接着问…' : '想问这段的什么？'}
          aria-label="接着问"
          autoComplete="off"
          className="min-w-0 flex-1 bg-transparent py-1.5 text-sm placeholder:text-hai/75 focus:outline-none"
        />
        <SendButton disabled={waiting || question.trim() === ''} />
      </form>
    </>
  )
}

/** 侧栏说的是哪一段 */
function Quote({ text }: { text: string }) {
  return (
    <p
      lang="ja"
      className="max-h-[9.5em] overflow-y-auto border-l-2 border-ai/55 pl-3 font-mincho text-base leading-[1.9] whitespace-pre-line text-hai"
    >
      {text}
    </p>
  )
}
