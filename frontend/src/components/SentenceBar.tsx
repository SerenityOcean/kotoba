import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { translateSelection } from '../api'
import type { HighlightColor } from '../api'
import { COLORS } from '../highlight'
import type { ExamHighlighter } from '../highlight'
import { pin, SUGGESTIONS } from '../selection'
import type { Bar, SelectionAnalysis } from '../selection'

type Mode = 'menu' | 'ask' | 'translate'

type Translation =
  | { status: 'loading' }
  | { status: 'done'; text: string }
  | { status: 'error'; message: string }

const INK_NAMES: Record<HighlightColor, string> = { 1: '黄', 2: '绿', 3: '粉', 4: '蓝' }

const CARD = 'w-[min(348px,calc(100vw-1rem))] pt-3 pr-3 pb-2 pl-3.5'

/**
 * 选中一段日语，选区下面弹出的那条浮条：拆解、翻译、提问。读的时候和选中的字打交道，
 * 入口只有这一处。
 *
 * 一个东西三种形态：平时是一排按钮；点「翻译」就地展开成一张小卡片出译文，不开侧栏、
 * 不动版面；点「提问」展开成输入框，问出去以后回答在侧栏里。拆解的结果也在侧栏。
 * 应试页的学习模式里，涂色的几支笔并在这同一条上（传了 highlighter 才有）。
 *
 * 挂在 body 上、用整页坐标定位，跟着页面一起滚。按在上面时不让浏览器动选区 ——
 * 不然还没点到按钮，选中的字先没了。展开以后选区是这边主动收掉的：原文上换成一层
 * 淡藍（index.css 的 ::highlight(quote-draft)），不然输入框一聚焦，就看不出问的是哪句。
 */
export default function SentenceBar({
  selection,
  highlighter,
}: {
  selection: SelectionAnalysis
  highlighter?: ExamHighlighter
}) {
  const { bar } = selection
  // 展开成卡片以后选区没了，靠这个记着说的是哪段
  const [held, setHeld] = useState<{ bar: Bar; mode: 'ask' | 'translate' } | null>(null)
  // 收起时还要在原地、照原样淡出，记着上一次的位置、内容和是哪一面
  const [last, setLast] = useState<{ bar: Bar; mode: Mode } | null>(null)
  const [question, setQuestion] = useState('')
  const [translation, setTranslation] = useState<Translation>({ status: 'loading' })
  const [copied, setCopied] = useState(false)
  const [size, setSize] = useState<{ width: number; height: number } | null>(null)
  // 刚出现的那一拍不要宽高的过渡，不然每次都是从上一回的大小缩过来
  const [settled, setSettled] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const views = useRef<Partial<Record<Mode, HTMLElement | null>>>({})
  const input = useRef<HTMLInputElement>(null)
  // 同一段译过了就不再花一次额度
  const translated = useRef(new Map<string, string>())
  const request = useRef(0)

  const shown = held?.bar ?? bar
  const live: Mode = held?.mode ?? 'menu'
  if (shown && (shown !== last?.bar || live !== last.mode)) setLast({ bar: shown, mode: live })
  const at = shown ?? last?.bar ?? null
  const mode = shown ? live : (last?.mode ?? 'menu')
  const open = shown !== null

  const paintable = highlighter?.inks
  const inks = useMemo(
    () => (mode === 'menu' && bar && paintable ? paintable(bar.quote.range) : null),
    [mode, bar, paintable],
  )

  // 外框的大小跟着眼下那一面走；过渡写在 index.css 的 .sentence-bar 上
  useLayoutEffect(() => {
    const view = views.current[mode]
    if (!view) return
    const measure = () =>
      setSize((now) =>
        now && now.width === view.offsetWidth && now.height === view.offsetHeight
          ? now
          : { width: view.offsetWidth, height: view.offsetHeight },
      )
    measure()
    // 译文回来、字体换上之后内容会变高
    const observer = new ResizeObserver(measure)
    observer.observe(view)
    return () => observer.disconnect()
  }, [mode, inks, translation, at])

  useEffect(() => {
    if (!open) return
    const frame = requestAnimationFrame(() => setSettled(true))
    return () => {
      cancelAnimationFrame(frame)
      setSettled(false)
    }
  }, [open])

  useEffect(() => {
    if (mode === 'ask') input.current?.focus({ preventScroll: true })
  }, [mode])

  // 展开着：点别处、按 Esc 收起
  useEffect(() => {
    if (!held) return
    const onMouseDown = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setHeld(null)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setHeld(null)
    }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [held])

  const draft = held?.bar.quote.range ?? null
  useEffect(() => {
    pin('quote-draft', draft)
    return () => pin('quote-draft', null)
  }, [draft])

  if (!at) return null
  const quote = at.quote

  const dropSelection = () => window.getSelection()?.removeAllRanges()

  function parse() {
    selection.analyze(quote)
    setHeld(null)
    dropSelection()
  }

  function startAsking() {
    if (!at) return
    setQuestion('')
    setHeld({ bar: at, mode: 'ask' })
    dropSelection()
  }

  function translate() {
    if (!at) return
    setCopied(false)
    setHeld({ bar: at, mode: 'translate' })
    dropSelection()

    const key = `${quote.text}\n\n${quote.context}`
    const id = ++request.current
    const known = translated.current.get(key)
    if (known !== undefined) {
      setTranslation({ status: 'done', text: known })
      return
    }
    setTranslation({ status: 'loading' })
    translateSelection(quote.text, quote.context)
      .then((text) => {
        translated.current.set(key, text)
        if (request.current === id) setTranslation({ status: 'done', text })
      })
      .catch((e) => {
        if (request.current === id) {
          setTranslation({
            status: 'error',
            message: e instanceof Error ? e.message : '没译出来，再试一次',
          })
        }
      })
  }

  function send(text: string) {
    const asked = text.trim()
    if (asked === '') return
    selection.ask(quote, asked)
    setHeld(null)
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    send(question)
  }

  function copy() {
    if (translation.status !== 'done') return
    navigator.clipboard
      ?.writeText(translation.text)
      .then(() => setCopied(true))
      .catch(() => {})
  }

  return createPortal(
    <div
      ref={root}
      data-skip
      data-open={open}
      data-snap={!settled}
      onMouseDown={(e) => {
        if (!(e.target instanceof HTMLInputElement)) e.preventDefault()
      }}
      style={{
        left: at.left,
        top: at.top,
        width: size?.width,
        height: size?.height,
        translate: at.above ? '-50% -100%' : '-50% 0',
        transformOrigin: at.above ? '50% 100%' : '50% 0',
        borderRadius: mode === 'menu' ? 19 : 14,
      }}
      className="sentence-bar absolute z-40 box-content overflow-hidden border border-usu bg-kami font-ui text-sumi select-none"
    >
      <div
        ref={(el) => {
          views.current.menu = el
        }}
        data-view
        data-on={mode === 'menu'}
        role="toolbar"
        aria-label="选中的这段"
        className="flex w-max items-center p-1"
      >
        {inks && highlighter && (
          <div className="flex items-center gap-[7px] pr-1 pl-2">
            {COLORS.map((color) => (
              <button
                key={color}
                onClick={() => highlighter.paint(color)}
                title={`涂成${INK_NAMES[color]}色`}
                aria-label={`涂成${INK_NAMES[color]}色`}
                style={{ backgroundColor: `var(--mark-${color})` }}
                className="h-[18px] w-[18px] rounded-full border border-sumi/15 transition hover:scale-115 hover:border-sumi/40"
              />
            ))}
            <button
              onClick={highlighter.erase}
              disabled={!inks.canErase}
              title={inks.canErase ? '擦掉选中的涂色' : '选中的字没有涂色'}
              className="px-0.5 text-xs text-hai transition hover:text-shu disabled:opacity-35 disabled:hover:text-hai"
            >
              擦
            </button>
            <span className="ml-[3px] h-3.5 w-px bg-usu" />
          </div>
        )}
        <Action onClick={parse} label="拆解">
          <path d="M3 7h18" />
          <path d="M3 13v3h7v-3" />
          <path d="M14 13v3h7v-3" />
        </Action>
        <Action onClick={translate} label="翻译">
          <path d="m5 8 6 6" />
          <path d="m4 14 6-6 2-3" />
          <path d="M2 5h12" />
          <path d="M7 2h1" />
          <path d="m22 22-5-10-5 10" />
          <path d="M14 18h6" />
        </Action>
        <Action onClick={startAsking} label="提问">
          <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
          <path d="M12 17h.01" />
        </Action>
      </div>

      <form
        ref={(el) => {
          views.current.ask = el
        }}
        data-view
        data-on={mode === 'ask'}
        onSubmit={onSubmit}
        className={CARD}
      >
        <Quoted text={quote.text} />
        <div className="mt-2 flex items-center gap-2">
          <input
            ref={input}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            maxLength={500}
            placeholder="想问这句的什么？"
            aria-label="想问这句的什么"
            autoComplete="off"
            className="min-w-0 flex-1 bg-transparent py-1 text-sm placeholder:text-hai/75 focus:outline-none"
          />
          <SendButton disabled={question.trim() === ''} />
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5 border-t border-usu pt-2">
          {SUGGESTIONS.map((suggestion) => (
            <Chip key={suggestion} onClick={() => send(suggestion)}>
              {suggestion}
            </Chip>
          ))}
        </div>
      </form>

      <div
        ref={(el) => {
          views.current.translate = el
        }}
        data-view
        data-on={mode === 'translate'}
        className={CARD}
      >
        <Quoted text={quote.text} />
        <div className="mt-2 min-h-[1.75em] pr-0.5 text-sm leading-[1.75] select-text" aria-live="polite">
          {translation.status === 'loading' ? (
            <>
              <span className="skeleton my-2 block h-[9px] rounded-full" />
              <span className="skeleton my-2 block h-[9px] w-[58%] rounded-full" />
            </>
          ) : translation.status === 'error' ? (
            <p className="text-shu">{translation.message}</p>
          ) : (
            <p className="animate-rise-sm">{translation.text}</p>
          )}
        </div>
        <div className="mt-2 flex gap-3.5 border-t border-usu pt-1.5 text-xs text-hai">
          <button onClick={parse} className="py-0.5 transition hover:text-ai">
            拆解
          </button>
          <button onClick={startAsking} className="py-0.5 transition hover:text-ai">
            提问
          </button>
          {translation.status === 'error' ? (
            <button onClick={translate} className="ml-auto py-0.5 transition hover:text-ai">
              重试
            </button>
          ) : (
            <button
              onClick={copy}
              disabled={translation.status !== 'done'}
              className="ml-auto py-0.5 transition hover:text-ai disabled:opacity-0"
            >
              {copied ? '已复制' : '复制'}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}

function Action({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className="group flex h-7 items-center gap-1.5 rounded-full pr-3 pl-2.5 text-[13px] whitespace-nowrap transition hover:bg-usu/60 active:scale-[0.97]"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
        className="h-[15px] w-[15px] text-hai transition group-hover:text-ai"
      >
        {children}
      </svg>
      {label}
    </button>
  )
}

/** 问的、译的是哪一段：一行，太长就截断 */
export function Quoted({ text }: { text: string }) {
  return (
    <p
      lang="ja"
      className="truncate border-l-2 border-ai/55 pl-2.5 font-mincho text-[13px] leading-normal text-hai"
    >
      {text}
    </p>
  )
}

export function SendButton({ disabled }: { disabled: boolean }) {
  return (
    <button
      type="submit"
      disabled={disabled}
      aria-label="发送"
      className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-full bg-ai text-washi transition hover:scale-108 disabled:bg-usu disabled:text-hai disabled:hover:scale-100"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
        className="h-3.5 w-3.5"
      >
        <path d="M12 19V5" />
        <path d="m5 12 7-7 7 7" />
      </svg>
    </button>
  )
}

export function Chip({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border border-usu px-2.5 py-[5px] text-xs leading-none text-hai transition hover:border-hai hover:text-sumi"
    >
      {children}
    </button>
  )
}
