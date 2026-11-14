import { useCallback, useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import type { HighlightColor, HighlightRange } from './api'

/**
 * 卷面上涂重点。按 ⇧⌘S（Windows 是 Ctrl+Shift+S）进学习模式，再按一下退出；
 * 模式里用鼠标选中一段，选区下面那条浮条（components/SentenceBar）上多出几支颜色的笔，
 * 点一支就涂上，点橡皮擦掉。退出以后界面和原来一样，涂过的颜色也收起来 ——
 * 做题时卷面是干净的，再进学习模式又都在。
 *
 * 能涂的每段文字（一段本文、一道题的题干、一个选项、解析里的一句）在 DOM 上标了
 * data-hl="名字"。存的是「哪一段、从第几个字到第几个字、哪支笔」，字数按去掉振り仮名的算 ——
 * 和选中拆解取文本是同一个规矩，重新注音、开关振り仮名都不影响位置。
 *
 * 颜色用 CSS Custom Highlight API 画（index.css 里的 ::highlight(exam-mark-1…4)），
 * 不往 DOM 里塞元素：React 管着的节点不能动，<ruby> 中间也没法插 <mark>。
 */

/** 哪段文字 → 涂了哪几截。一截都没涂的段不在里面 */
export type Highlights = Record<string, HighlightRange[]>

/** 几支笔。各是什么颜色在 index.css 里 */
export const COLORS: readonly HighlightColor[] = [1, 2, 3, 4]

const NAME = (color: HighlightColor) => `exam-mark-${color}`

/** 振り仮名、选项编号、注释记号这些不算正文，数字数时跳过 */
const SKIPPED = 'rt, rp, [data-skip]'

/** 浏览器支不支持画。不支持的（很旧的浏览器）涂了也看不见，干脆不接快捷键 */
export const canHighlight = typeof CSS !== 'undefined' && 'highlights' in CSS

/** 一段文字里算数的文本节点，按顺序 */
function textNodes(container: Element): Text[] {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) =>
      node.parentElement?.closest(SKIPPED) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
  })
  const nodes: Text[] = []
  while (walker.nextNode()) nodes.push(walker.currentNode as Text)
  return nodes
}

function plainText(nodes: Text[]): string {
  return nodes.map((node) => node.data).join('')
}

/** 选区落在这段文字里的那一截，按字数；没碰到是 null */
function sliceOf(range: Range, nodes: Text[]): { start: number; end: number } | null {
  let offset = 0
  let start = -1
  let end = -1
  for (const node of nodes) {
    if (range.intersectsNode(node)) {
      const from = node === range.startContainer ? range.startOffset : 0
      const to = node === range.endContainer ? range.endOffset : node.length
      if (to > from) {
        if (start < 0) start = offset + from
        end = offset + to
      }
    }
    offset += node.length
  }
  return start < 0 ? null : { start, end }
}

/**
 * 存下的几截对着眼下的文字核一遍：字对得上的留着；对不上的（解析重新生成过）
 * 按涂上的字再找一次，找不到就不要了 —— 宁可少涂，不涂到别的字上。
 */
function settle(ranges: HighlightRange[], plain: string): HighlightRange[] {
  const settled: HighlightRange[] = []
  for (const range of ranges) {
    if (plain.slice(range.start, range.end) === range.text) {
      settled.push(range)
      continue
    }
    const found = plain.indexOf(range.text)
    if (found >= 0) settled.push({ ...range, start: found, end: found + range.text.length })
  }
  return settled
}

/** 这一截里有涂着的吗 */
export function touches(ranges: HighlightRange[], start: number, end: number): boolean {
  return ranges.some((range) => range.start < end && range.end > start)
}

/** 擦掉一截：只擦选中的部分，两头涂着的留下 */
export function erase(
  ranges: HighlightRange[],
  start: number,
  end: number,
  plain: string,
): HighlightRange[] {
  const left: HighlightRange[] = []
  for (const range of ranges) {
    if (range.end <= start || range.start >= end) {
      left.push(range)
      continue
    }
    if (range.start < start) {
      left.push({ ...range, end: start, text: plain.slice(range.start, start) })
    }
    if (range.end > end) {
      left.push({ ...range, start: end, text: plain.slice(end, range.end) })
    }
  }
  return left
}

/**
 * 涂上一截：底下原来涂着别的颜色的盖掉，和它挨着、搭着的同色并成一截。
 * 结果里各截互不重叠，按位置排好。
 */
export function paint(
  ranges: HighlightRange[],
  start: number,
  end: number,
  color: HighlightColor,
  plain: string,
): HighlightRange[] {
  const merged: HighlightRange[] = []
  const all = [...erase(ranges, start, end, plain), { start, end, color, text: '' }]
  for (const range of all.sort((a, b) => a.start - b.start)) {
    const previous = merged[merged.length - 1]
    if (previous && previous.color === range.color && previous.end >= range.start) {
      previous.end = Math.max(previous.end, range.end)
    } else {
      merged.push({ ...range })
    }
  }
  return merged.map((range) => ({ ...range, text: plain.slice(range.start, range.end) }))
}

/** 把存下的涂色画到 root 里眼下有的那几段上。筛选掉、收起来的段不在 DOM 里，跳过 */
function draw(root: Element, highlights: Highlights) {
  const drawn = new Map<HighlightColor, Range[]>()
  for (const [anchor, ranges] of Object.entries(highlights)) {
    const container = root.querySelector(`[data-hl="${anchor}"]`)
    if (!container) continue
    const nodes = textNodes(container)
    const settled = settle(ranges, plainText(nodes))
    let offset = 0
    for (const node of nodes) {
      for (const range of settled) {
        const from = Math.max(range.start, offset) - offset
        const to = Math.min(range.end, offset + node.length) - offset
        if (to > from) {
          // 一个文本节点一截：跨着 <ruby> 画一整截的话，读音也会被涂上
          const piece = document.createRange()
          piece.setStart(node, from)
          piece.setEnd(node, to)
          drawn.set(range.color, [...(drawn.get(range.color) ?? []), piece])
        }
      }
      offset += node.length
    }
  }
  for (const color of COLORS) {
    const pieces = drawn.get(color)
    if (pieces) CSS.highlights.set(NAME(color), new Highlight(...pieces))
    else CSS.highlights.delete(NAME(color))
  }
}

/** 选区碰到的每段文字，各自是哪一截 */
interface Touched {
  anchor: string
  start: number
  end: number
  plain: string
}

function touchedBy(root: Element, range: Range): Touched[] {
  const touched: Touched[] = []
  for (const container of root.querySelectorAll('[data-hl]')) {
    if (!range.intersectsNode(container)) continue
    const nodes = textNodes(container)
    const slice = sliceOf(range, nodes)
    const anchor = container.getAttribute('data-hl')
    if (slice && anchor) touched.push({ anchor, ...slice, plain: plainText(nodes) })
  }
  return touched
}

/** 选中了能涂的字时浮条上多出来的那排笔：选区里有涂着的才给橡皮 */
export interface Inks {
  canErase: boolean
}

/**
 * 接上涂重点。root 是卷面最外层的元素；initial 是卷子带来的涂色，换卷子时会跟着换；
 * save 把改了的那几段存到后端，失败了这边改回去、把原因交给 onError。
 */
export function useHighlights(
  root: RefObject<Element | null>,
  initial: Highlights | undefined,
  save: (changes: Highlights) => Promise<void>,
  onError: (message: string | null) => void,
) {
  const [highlights, setHighlights] = useState<Highlights>(initial ?? {})
  const [loaded, setLoaded] = useState(initial)
  if (loaded !== initial) {
    setLoaded(initial)
    setHighlights(initial ?? {})
  }
  const [studying, setStudying] = useState(false)

  // 给事件回调用：回调只挂一次，要读到最新的
  const latest = useRef(highlights)
  useEffect(() => {
    latest.current = highlights
  }, [highlights])

  // 画，只在学习模式里画。卷面自己变了（展开解析、换筛选）节点是新的，也要重画
  useEffect(() => {
    const element = root.current
    if (!canHighlight || !element || !studying) return
    let frame = 0
    const redraw = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => draw(element, latest.current))
    }
    draw(element, highlights)
    const observer = new MutationObserver(redraw)
    observer.observe(element, { childList: true, subtree: true, characterData: true })
    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
      for (const color of COLORS) CSS.highlights.delete(NAME(color))
    }
    // initial 一起看：卷子到了以后 root 才挂上
  }, [root, highlights, initial, studying])

  // ⇧⌘S 进出学习模式
  useEffect(() => {
    if (!canHighlight) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.code !== 'KeyS' || !e.shiftKey || !(e.metaKey || e.ctrlKey) || e.altKey) return
      // 有的浏览器这个键是「另存为」，在卷面上弹出来只会吓一跳
      e.preventDefault()
      if (!e.repeat) setStudying((on) => !on)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  /** 这段选区能不能涂：学习模式开着、碰到了能涂的字才给笔，其余是 null */
  const inks = useCallback(
    (range: Range): Inks | null => {
      const element = root.current
      if (!studying || !element) return null
      const touched = touchedBy(element, range)
      if (touched.length === 0) return null
      return {
        canErase: touched.some((t) =>
          touches(settle(latest.current[t.anchor] ?? [], t.plain), t.start, t.end),
        ),
      }
    },
    [root, studying],
  )

  /** 把选中的涂成这个颜色；color 为 null 是擦掉 */
  const apply = useCallback(
    (color: HighlightColor | null) => {
      const element = root.current
      const selection = window.getSelection()
      if (!element || !selection || selection.rangeCount === 0 || selection.isCollapsed) return
      const touched = touchedBy(element, selection.getRangeAt(0))
      if (touched.length === 0) return

      const before = latest.current
      const changes: Highlights = {}
      for (const t of touched) {
        const current = settle(before[t.anchor] ?? [], t.plain)
        changes[t.anchor] =
          color === null
            ? erase(current, t.start, t.end, t.plain)
            : paint(current, t.start, t.end, color, t.plain)
      }

      const merge = (all: Highlights, changed: Highlights) => {
        const next = { ...all }
        for (const [anchor, ranges] of Object.entries(changed)) {
          if (ranges.length > 0) next[anchor] = ranges
          else delete next[anchor]
        }
        return next
      }
      setHighlights((all) => merge(all, changes))
      // 选区的蓝底会盖住刚涂的颜色，收掉才看得见；浮条跟着选区一起收起
      selection.removeAllRanges()
      onError(null)
      save(changes).catch((e) => {
        const restored: Highlights = {}
        for (const anchor of Object.keys(changes)) restored[anchor] = before[anchor] ?? []
        setHighlights((all) => merge(all, restored))
        onError(e instanceof Error ? e.message : '涂色没存上')
      })
    },
    [root, save, onError],
  )

  return {
    /** 学习模式开着吗 */
    studying,
    inks,
    paint: apply as (color: HighlightColor) => void,
    erase: useCallback(() => apply(null), [apply]),
    leave: useCallback(() => setStudying(false), []),
  }
}

export type ExamHighlighter = ReturnType<typeof useHighlights>
