import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  UNAUTHORIZED_EVENT,
  fetchMe,
  login as loginApi,
  logout as logoutApi,
  register as registerApi,
} from './api'
import type { User } from './api'
import { AuthContext } from './auth-context'
import type { AuthContextValue } from './auth-context'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [ready, setReady] = useState(false)

  // 刷新页面后靠 cookie 恢复登录态：问一次 /api/auth/me
  useEffect(() => {
    let cancelled = false
    fetchMe()
      .then((me) => !cancelled && setUser(me))
      .catch(() => !cancelled && setUser(null))
      .finally(() => !cancelled && setReady(true))
    return () => {
      cancelled = true
    }
  }, [])

  // 会话过期后任何请求都会撞 401，撞上就当场退回未登录
  useEffect(() => {
    const onUnauthorized = () => setUser(null)
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      ready,
      login: async (username, password) => setUser(await loginApi(username, password)),
      register: async (username, password) => setUser(await registerApi(username, password)),
      logout: async () => {
        try {
          await logoutApi()
        } finally {
          // 后端没删成也把本地清掉，别让人卡在"看起来还登着"
          setUser(null)
        }
      },
    }),
    [user, ready],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
