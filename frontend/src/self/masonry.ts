import { useLayoutEffect, useRef } from 'react'

/**
 * 瀑布流：网格的行切得很细（grid-auto-rows 几个像素），每个格子按自己的实际高度
 * 占若干行。网格默认的自动摆放会把下一张放进最早空出来的位置 —— 也就是最矮的那一列，
 * 所以卡片之间不留空洞，阅读顺序还是先左后右、先上后下。
 *
 * 量的是格子的自然高度加下边距，所以格子要 align-self: start、只用 margin-bottom 留白。
 * 卡片换行（窗口变宽变窄、字体晚到）都会改变高度，用 ResizeObserver 盯着重排。
 */
export function useMasonry<T extends HTMLElement>(deps: unknown[]) {
  const ref = useRef<T>(null)

  useLayoutEffect(() => {
    const grid = ref.current
    if (!grid) return

    const layout = () => {
      const rowHeight = parseFloat(getComputedStyle(grid).gridAutoRows) || 1
      for (const item of Array.from(grid.children) as HTMLElement[]) {
        const height = item.getBoundingClientRect().height + parseFloat(getComputedStyle(item).marginBottom)
        item.style.gridRowEnd = `span ${Math.max(1, Math.ceil(height / rowHeight))}`
      }
    }
    layout()

    // 网格自己的高度会随着上面的 span 变，只在宽度变了的时候才需要重排，免得来回触发
    let width = grid.clientWidth
    const observer = new ResizeObserver((entries) => {
      const gridResized = entries.some((entry) => entry.target === grid)
      if (gridResized && grid.clientWidth === width && entries.length === 1) return
      width = grid.clientWidth
      layout()
    })
    observer.observe(grid)
    for (const item of Array.from(grid.children)) observer.observe(item)
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return ref
}
