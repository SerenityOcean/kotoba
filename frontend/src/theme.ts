import { useCallback, useEffect, useState } from 'react'

/**
 * 昼夜。默认跟着系统的深浅色走；手动切过就记在这台设备上。
 * 切回和系统一样的那一边时就把记录删掉 —— 以后系统换了，这里也跟着换。
 *
 * Kotoba 和 self 各记各的（key 不同）：self 是另一个地方，夜色也是另一套。
 */

export type Theme = 'light' | 'dark'

/**
 * Kotoba 记在这个 key 下。public/theme-init.js 在 React 起来之前就读它，
 * 免得夜里先闪一下白 —— 两边改要一起改。
 */
export const KOTOBA_THEME_KEY = 'kotoba:theme'

const darkQuery = () => window.matchMedia('(prefers-color-scheme: dark)')

function readStored(key: string): Theme | null {
  try {
    const value = localStorage.getItem(key)
    return value === 'light' || value === 'dark' ? value : null
  } catch {
    return null
  }
}

function writeStored(key: string, value: Theme | null) {
  try {
    if (value) localStorage.setItem(key, value)
    else localStorage.removeItem(key)
  } catch {
    // 无痕窗口之类存不了，这次会话里照样能切
  }
}

export function useThemeState(key: string) {
  const [stored, setStored] = useState<Theme | null>(() => readStored(key))
  const [system, setSystem] = useState<Theme>(() => (darkQuery().matches ? 'dark' : 'light'))

  useEffect(() => {
    const query = darkQuery()
    const onChange = () => setSystem(query.matches ? 'dark' : 'light')
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  const theme = stored ?? system
  const toggle = useCallback(() => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    const value = next === system ? null : next
    writeStored(key, value)
    setStored(value)
  }, [key, theme, system])

  return { theme, toggle }
}
