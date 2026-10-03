import { createContext, useCallback, useContext, useEffect, useState } from 'react'

/**
 * self 的昼夜。默认跟着系统的深浅色走；手动切过就记在这台设备上。
 * 切回和系统一样的那一边时就把记录删掉 —— 以后系统换了，这里也跟着换。
 */

export type Theme = 'light' | 'dark'

const KEY = 'self:theme'
const darkQuery = () => window.matchMedia('(prefers-color-scheme: dark)')

function readStored(): Theme | null {
  try {
    const value = localStorage.getItem(KEY)
    return value === 'light' || value === 'dark' ? value : null
  } catch {
    return null
  }
}

function writeStored(value: Theme | null) {
  try {
    if (value) localStorage.setItem(KEY, value)
    else localStorage.removeItem(KEY)
  } catch {
    // 无痕窗口之类存不了，这次会话里照样能切
  }
}

export function useThemeState() {
  const [stored, setStored] = useState<Theme | null>(readStored)
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
    writeStored(value)
    setStored(value)
  }, [theme, system])

  return { theme, toggle }
}

export const ThemeContext = createContext<{ theme: Theme; toggle: () => void }>({
  theme: 'light',
  toggle: () => {},
})

export const useTheme = () => useContext(ThemeContext)
