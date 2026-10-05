/**
 * 页码条：← 上一页  1 … 4 5 6 … 20  下一页 →
 *
 * 只管画和点，换页之后做什么（改地址栏、回到列表顶上）由调用方决定 ——
 * 阅读页的页码在地址栏里，卡片页的在组件状态里。一页都不满时不显示。
 */
export default function Pagination({
  page,
  totalPages,
  onSelect,
}: {
  /** 从 1 数 */
  page: number
  totalPages: number
  onSelect: (page: number) => void
}) {
  if (totalPages <= 1) return null

  const step = 'px-2 py-1 text-hai transition hover:text-sumi disabled:text-hai/40 disabled:hover:text-hai/40'

  return (
    <nav className="mt-10 flex flex-wrap items-baseline justify-center gap-x-1 gap-y-2 text-sm">
      <button onClick={() => onSelect(page - 1)} disabled={page <= 1} className={`${step} mr-3`}>
        ← 上一页
      </button>

      {pageWindow(page, totalPages).map((p, i) =>
        p === null ? (
          <span key={`gap-${i}`} className="px-1 text-hai/60">
            …
          </span>
        ) : p === page ? (
          <span
            key={p}
            aria-current="page"
            className="min-w-8 border-b border-sumi px-2 py-1 text-center tabular-nums text-sumi"
          >
            {p}
          </span>
        ) : (
          <button
            key={p}
            onClick={() => onSelect(p)}
            className="min-w-8 border-b border-transparent px-2 py-1 text-center tabular-nums text-hai transition hover:text-sumi"
          >
            {p}
          </button>
        ),
      )}

      <button
        onClick={() => onSelect(page + 1)}
        disabled={page >= totalPages}
        className={`${step} ml-3`}
      >
        下一页 →
      </button>
    </nav>
  )
}

/**
 * 头尾、当前页和左右各一页，其余折成省略号。
 * 只隔着一页时直接把那页写出来 —— 省略号占的地方一样，还看不出是哪页。
 */
function pageWindow(current: number, total: number): (number | null)[] {
  const kept = [...new Set([1, current - 1, current, current + 1, total])]
    .filter((p) => p >= 1 && p <= total)
    .sort((a, b) => a - b)

  const result: (number | null)[] = []
  kept.forEach((p, i) => {
    const gap = i === 0 ? 1 : p - kept[i - 1]
    if (gap === 2) result.push(p - 1)
    else if (gap > 2) result.push(null)
    result.push(p)
  })
  return result
}
