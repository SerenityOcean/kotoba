import { useCallback, useEffect, useRef, useState } from 'react'
import { useAnalysis } from './analysis'
import { askAboutSelection } from './api'

/**
 * 读的时候选中一段日语，就地拆解、翻译、提问。
 *
 * 入口只有一个：选区下面弹出的浮条（components/SentenceBar）。拆解的结果和问答在
 * 侧栏里（components/AnalysisPanel），译文就在浮条上。阅读页、应试页、资料里的随笔共用。
 *
 * 哪些地方选了才算数，由页面在容器上标 data-quotable；想给模型多带点前后文的
 * （应试的一篇本文连同它的几道题），在外层标 data-context。
 */

/** 振假名、选项编号、注释记号这些不算正文 */
const SKIPPED = 'rt, rp, [data-skip]'

/** 带给模型的前后文最多这么长；原文更长就取选区前后的一截 */
const CONTEXT_MAX = 1200

/** 提问时摆在输入框下面的几个现成问题，点一下就问 */
export const SUGGESTIONS = ['这里是什么用法？', '逐词讲一下', '换个简单的说法'] as const

/** 接着问时带回去的问答最多这么多轮（后端也是这个数） */
const HISTORY_MAX = 8

const COARSE = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches

/** 浏览器能不能在原文上留底色（CSS Custom Highlight API） */
const canPin = typeof CSS !== 'undefined' && 'highlights' in CSS

/** 选中的一段 */
export interface Quote {
  /** 纯文本，不带振假名 */
  text: string
  /** 它所在那一段的文字，给模型弄清主语和指代；和 text 一样时是空串 */
  context: string
  /** 原文里的位置，留底色用 */
  range: Range
}

/** 浮条该出现在哪（整页坐标）：横向是中心，above 时 top 是浮条的下沿 */
export interface Bar {
  quote: Quote
  left: number
  top: number
  above: boolean
}

/** 一问一答。answer 和 error 都是 null 就是还在等 */
export interface Turn {
  question: string
  answer: string | null
  error: string | null
}

export type Tab = 'parse' | 'ask'

/** 侧栏里眼下这一段的全部：拆没拆过、问了些什么 */
interface Session {
  quote: Quote
  tab: Tab
  parsed: boolean
  thread: Turn[]
}

/**
 * 取一截 DOM 的纯文本。
 *
 * 不能直接用 selection.toString()：振假名是 <ruby><rt>，浏览器会把读音
 * 一起拼进字符串 ——「違って」变成「違ちがって」，送给模型就是一句
 * 根本不存在的日语。所以摘掉 <rt> 再取文本。
 * 标了 data-skip 的（选项编号、注释记号）也摘掉，它们不是正文。
 */
function plain(fragment: DocumentFragment | Element): string {
  fragment.querySelectorAll(SKIPPED).forEach((node) => node.remove())
  return fragment.textContent ?? ''
}

function contextOf(element: Element, text: string): string {
  const block =
    element.closest('[data-context]') ??
    element.closest('[data-hl], p, li, blockquote, [data-quotable]')
  if (!block) return ''
  const clone = block.cloneNode(true) as Element
  // 一段一行：不然几个选项、几段话连成一串，模型分不清哪句到哪儿
  clone.querySelectorAll('p, li, label, div, section, h1, h2, h3, br').forEach((n) => n.after('\n'))
  const whole = plain(clone)
    .replace(/[ \t　]*\n\s*/g, '\n')
    .trim()
  if (whole === '' || whole === text) return ''
  if (whole.length <= CONTEXT_MAX) return whole
  const at = whole.indexOf(text.split('\n')[0].slice(0, 24))
  const start = Math.max(
    0,
    Math.min(at - Math.max(0, CONTEXT_MAX - text.length) / 2, whole.length - CONTEXT_MAX),
  )
  return whole.slice(start, start + CONTEXT_MAX)
}

/** 眼下选中的一段；没选、选在不算数的地方（按钮、侧栏）是 null */
function currentQuote(): Quote | null {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null
  const range = selection.getRangeAt(0)
  const origin = range.commonAncestorContainer
  const element = origin instanceof Element ? origin : origin.parentElement
  if (!element?.closest('[data-quotable]')) return null
  const text = plain(range.cloneContents()).trim()
  if (text === '') return null
  return { text, context: contextOf(element, text), range: range.cloneRange() }
}

function locate(): Bar | null {
  const quote = currentQuote()
  if (!quote) return null
  const rects = [...quote.range.getClientRects()].filter((rect) => rect.width > 1)
  if (rects.length === 0) return null
  const top = Math.min(...rects.map((rect) => rect.top))
  const bottom = Math.max(...rects.map((rect) => rect.bottom))
  // 对着选区最后一行的中间。带振假名的一行是好几截（每个汉字、每段读音各一截），
  // 只看最后那一截的话浮条会偏到行尾去；读音那几截在行的上面，不算
  const last = rects[rects.length - 1]
  const line = rects.filter((rect) => {
    const middle = (rect.top + rect.bottom) / 2
    return middle > last.top && middle < last.bottom
  })
  const lineLeft = Math.min(...line.map((rect) => rect.left))
  const lineRight = Math.max(...line.map((rect) => rect.right))

  // 浮条展开成卡片时最宽这么多（见 SentenceBar），两边各留一点，别顶到屏幕外面
  const width = document.documentElement.clientWidth
  const half = Math.min(350, width - 16) / 2 + 8
  const center = Math.max(half, Math.min((lineLeft + lineRight) / 2, width - half))

  // 下面没地方了（贴着屏幕底、底栏）就放到选区上面。触屏上不翻：上面是系统自己的菜单
  const below = window.innerHeight - bottom
  const above = !COARSE && below < 240 && top > below
  // 触屏的选区两头有拖柄，往下多让一点
  const gap = COARSE ? 28 : 8
  return {
    quote,
    left: center + window.scrollX,
    top: (above ? top - gap : bottom + gap) + window.scrollY,
    above,
  }
}

/**
 * 在原文上给一段留底色，name 对着 index.css 里的 ::highlight(name)。
 * 一个文本节点一截：跨着 <ruby> 画一整截的话，读音也会被涂上。
 */
export function pin(name: string, range: Range | null) {
  if (!canPin) return
  if (!range) {
    CSS.highlights.delete(name)
    return
  }
  const root = range.commonAncestorContainer
  const pieces: Range[] = []
  if (root.nodeType === Node.TEXT_NODE) {
    pieces.push(range)
  } else {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) =>
        !node.parentElement?.closest(SKIPPED) && range.intersectsNode(node)
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_REJECT,
    })
    while (walker.nextNode()) {
      const node = walker.currentNode as Text
      const from = node === range.startContainer ? range.startOffset : 0
      const to = node === range.endContainer ? range.endOffset : node.length
      if (to > from) {
        const piece = document.createRange()
        piece.setStart(node, from)
        piece.setEnd(node, to)
        pieces.push(piece)
      }
    }
  }
  CSS.highlights.set(name, new Highlight(...pieces))
}

export function useSelectionAnalysis() {
  const analysis = useAnalysis()
  // 单独取出来：analysis 每次渲染都是新对象，但这两个被 useCallback 包过、
  // 身份稳定，下面的回调依赖它们才不会每次都换
  const { reset, run } = analysis
  const [bar, setBar] = useState<Bar | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  /** 第几段。换了一段、收起侧栏之后，上一段迟到的回答按这个数丢掉 */
  const epoch = useRef(0)

  /**
   * 选完一段，浮条出现在哪。拖着选的时候不弹，松开鼠标才弹；选区是键盘、双击、
   * 触屏拖柄改的，等它停下来再弹。松开那一刻选区不一定已经定了（点一下空白处，
   * 旧选区要下一拍才清掉），所以都晚一拍再看。
   */
  useEffect(() => {
    let pressed = false
    let timer = 0
    const later = (ms: number) => {
      clearTimeout(timer)
      timer = window.setTimeout(() => setBar(locate()), ms)
    }
    const onMouseDown = () => {
      pressed = true
    }
    const onMouseUp = () => {
      pressed = false
      later(0)
    }
    const onSelectionChange = () => {
      if (window.getSelection()?.isCollapsed !== false) {
        clearTimeout(timer)
        setBar(null)
      } else if (!pressed) {
        later(COARSE ? 300 : 120)
      }
    }
    // 窗口变宽变窄，字重新排过，原来的位置不对了
    const onResize = () => later(120)
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('mouseup', onMouseUp)
    document.addEventListener('selectionchange', onSelectionChange)
    window.addEventListener('resize', onResize)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('mouseup', onMouseUp)
      document.removeEventListener('selectionchange', onSelectionChange)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  // 侧栏开着时，它说的那段在原文上留一层底色
  const pinned = session?.quote.range ?? null
  useEffect(() => {
    pin('quote', pinned)
    return () => pin('quote', null)
  }, [pinned])

  /** 拆解这一段。同一段拆过了就只是切到拆解那一栏，不再花一次额度 */
  const analyze = useCallback(
    (quote: Quote) => {
      const same = session?.quote.text === quote.text
      if (!same) epoch.current += 1
      setSession({ quote, tab: 'parse', parsed: true, thread: same ? session.thread : [] })
      if (!same || !session.parsed) run(quote.text)
    },
    [session, run],
  )

  /** 就着这一段提问。换了一段的话，上一段的拆解和问答都不留 */
  const ask = useCallback(
    (quote: Quote, question: string) => {
      const same = session?.quote.text === quote.text
      if (!same) {
        epoch.current += 1
        reset()
      }
      const before = same ? session.thread : []
      const history = before.flatMap((turn) =>
        turn.answer === null ? [] : [{ question: turn.question, answer: turn.answer }],
      )
      const index = before.length
      setSession({
        quote,
        tab: 'ask',
        parsed: same && session.parsed,
        thread: [...before, { question, answer: null, error: null }],
      })

      const asked = epoch.current
      const settle = (patch: Partial<Turn>) => {
        if (epoch.current !== asked) return
        setSession(
          (now) =>
            now && {
              ...now,
              thread: now.thread.map((turn, i) => (i === index ? { ...turn, ...patch } : turn)),
            },
        )
      }
      askAboutSelection(quote.text, question, quote.context, history.slice(-HISTORY_MAX))
        .then((answer) => settle({ answer }))
        .catch((e) => settle({ error: e instanceof Error ? e.message : '没问上，再试一次' }))
    },
    [session, reset],
  )

  const setTab = useCallback((tab: Tab) => setSession((now) => now && { ...now, tab }), [])

  /** 收起侧栏，这一段的拆解和问答一起清掉。换文章、换卷子时也调它 */
  const close = useCallback(() => {
    epoch.current += 1
    reset()
    setSession(null)
  }, [reset])

  return {
    analysis,
    /** 选中了一段、还没动它：浮条的位置 */
    bar,
    /** 侧栏说的是哪一段；没开是 null */
    session,
    showPanel: session !== null,
    analyze,
    ask,
    setTab,
    close,
  }
}

export type SelectionAnalysis = ReturnType<typeof useSelectionAnalysis>
