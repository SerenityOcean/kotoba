import { createPortal } from 'react-dom'
import type { ExamHighlighter } from '../highlight'

const MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

/** 进出学习模式的那个键，按这台机器的写法 */
const STUDY_KEY = MAC ? '⇧⌘S' : 'Ctrl+Shift+S'

/**
 * 学习模式开着时顶上的一枚小牌子：说明现在在模式里、怎么退出。
 * 涂色的笔不在这儿 —— 选中文字后，它们和拆解、翻译、提问并在同一条浮条上
 * （components/SentenceBar）。
 */
export default function StudyBadge({ highlighter }: { highlighter: ExamHighlighter }) {
  if (!highlighter.studying) return null

  return createPortal(
    <button
      data-skip
      onClick={highlighter.leave}
      title="点一下也能退出"
      className="fixed top-3 left-1/2 z-40 -translate-x-1/2 rounded-full border border-usu bg-washi/95 px-3.5 py-1 font-ui text-xs text-hai shadow-sm backdrop-blur transition select-none hover:text-sumi"
    >
      <span className="text-sumi">学习模式</span>
      <span className="mx-2 text-usu">|</span>
      选中文字涂色，{STUDY_KEY} 退出
    </button>,
    document.body,
  )
}
