import { createPortal } from 'react-dom'
import type { HighlightColor } from '../api'
import { COLORS } from '../highlight'
import type { ExamHighlighter } from '../highlight'

const WIDTH = 168

const NAMES: Record<HighlightColor, string> = { 1: '黄', 2: '绿', 3: '粉', 4: '蓝' }

const MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

/** 进出学习模式的那个键，按这台机器的写法 */
const STUDY_KEY = MAC ? '⇧⌘S' : 'Ctrl+Shift+S'

/**
 * 学习模式的界面，只在模式开着时有：顶上一枚小牌子说明现在在模式里、怎么退出；
 * 选中了能涂的字，选区末尾下面弹出一排笔。
 *
 * 笔挂在 body 上、用整页坐标定位，跟着卷面一起滚。按下时不让浏览器动选区 ——
 * 不然还没点到笔，选中的字先没了。
 */
export default function HighlightPicker({ highlighter }: { highlighter: ExamHighlighter }) {
  const { studying, picker } = highlighter
  if (!studying) return null

  return createPortal(
    <div data-skip className="font-ui select-none">
      <button
        onClick={highlighter.leave}
        title="点一下也能退出"
        className="fixed top-3 left-1/2 z-40 -translate-x-1/2 rounded-full border border-usu bg-washi/95 px-3.5 py-1 text-xs text-hai shadow-sm backdrop-blur transition hover:text-sumi"
      >
        <span className="text-sumi">学习模式</span>
        <span className="mx-2 text-usu">|</span>
        选中文字涂色，{STUDY_KEY} 退出
      </button>

      {picker && (
        <div
          role="toolbar"
          aria-label="涂色"
          onMouseDown={(e) => e.preventDefault()}
          style={{
            width: WIDTH,
            top: picker.y + 8,
            left: Math.max(
              window.scrollX + 8,
              Math.min(picker.x - WIDTH / 2, window.scrollX + window.innerWidth - WIDTH - 8),
            ),
          }}
          className="absolute z-40 flex items-center justify-between rounded-full border border-usu bg-washi px-2.5 py-1.5 shadow-md"
        >
          {COLORS.map((color) => (
            <button
              key={color}
              onClick={() => highlighter.paint(color)}
              title={`涂成${NAMES[color]}色`}
              aria-label={`涂成${NAMES[color]}色`}
              style={{ backgroundColor: `var(--mark-${color})` }}
              className="h-6 w-6 rounded-full border border-sumi/15 transition hover:scale-110 hover:border-sumi/40"
            />
          ))}
          <button
            onClick={highlighter.erase}
            disabled={!picker.canErase}
            title={picker.canErase ? '擦掉选中的涂色' : '选中的字没有涂色'}
            className="ml-1 rounded-full px-2 py-0.5 text-xs text-hai transition hover:text-shu disabled:opacity-35 disabled:hover:text-hai"
          >
            擦
          </button>
        </div>
      )}
    </div>,
    document.body,
  )
}
