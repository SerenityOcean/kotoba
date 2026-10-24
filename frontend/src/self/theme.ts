import { createContext, useContext } from 'react'
import { useThemeState as useStoredTheme } from '../theme'
import type { Theme } from '../theme'

/** self 的昼夜，和 Kotoba 分开记。怎么跟系统、怎么记见 ../theme。 */

export type { Theme }

const KEY = 'self:theme'

export function useThemeState() {
  return useStoredTheme(KEY)
}

export const ThemeContext = createContext<{ theme: Theme; toggle: () => void }>({
  theme: 'light',
  toggle: () => {},
})

export const useTheme = () => useContext(ThemeContext)
