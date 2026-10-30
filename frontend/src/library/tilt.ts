import { useCallback, useRef } from 'react'

/** 只在有鼠标、没要求减少动效时倾斜；触屏上手指按着卡片晃来晃去只会碍事 */
const canTilt = () =>
  window.matchMedia('(hover: hover) and (pointer: fine)').matches &&
  !window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * 卡片跟着指针微微倾斜，最多 maxDeg 度。写的是 CSS 变量 --rx / --ry，
 * 真正的 transform 在 index.css 的 .pack-card 里 —— 不走 state，指针一动就重渲染太浪费。
 */
export function useTilt<T extends HTMLElement>(maxDeg = 5) {
  const ref = useRef<T>(null)

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const el = ref.current
      if (!el || !canTilt()) return
      const r = el.getBoundingClientRect()
      const x = (e.clientX - r.left) / r.width - 0.5
      const y = (e.clientY - r.top) / r.height - 0.5
      el.style.setProperty('--ry', `${(x * maxDeg).toFixed(2)}deg`)
      el.style.setProperty('--rx', `${(-y * maxDeg).toFixed(2)}deg`)
    },
    [maxDeg],
  )

  const onPointerLeave = useCallback(() => {
    ref.current?.style.setProperty('--rx', '0deg')
    ref.current?.style.setProperty('--ry', '0deg')
  }, [])

  return { ref, onPointerMove, onPointerLeave }
}
