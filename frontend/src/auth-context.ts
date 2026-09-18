import { createContext, useContext } from 'react'
import type { User } from './api'

export interface AuthContextValue {
  user: User | null
  /** 首次向后端确认身份还没回来。这期间别渲染页面，免得登录页闪一下。 */
  ready: boolean
  login: (username: string, password: string) => Promise<void>
  register: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

// 和 AuthProvider 分开放：同一个文件里既导出组件又导出 hook，
// Vite 的 fast refresh 会失效（oxlint 也会报）。
export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (!value) {
    throw new Error('useAuth 必须在 <AuthProvider> 里用')
  }
  return value
}
