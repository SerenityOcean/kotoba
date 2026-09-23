import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { clearGoal, fetchGoal, saveGoal } from './api'
import type { Goal } from './api'
import { useAuth } from './auth-context'
import { GoalContext } from './goal-context'
import type { GoalContextValue } from './goal-context'

export function GoalProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [goal, setGoal] = useState<Goal | null>(null)

  // 换了人（登录、登出、切账号）就重新问一次
  useEffect(() => {
    if (!user) {
      setGoal(null)
      return
    }
    let cancelled = false
    fetchGoal()
      .then((next) => !cancelled && setGoal(next))
      // 顶上那行只是锦上添花，拉不到就不显示，别打扰别的页面
      .catch(() => !cancelled && setGoal(null))
    return () => {
      cancelled = true
    }
  }, [user])

  const value = useMemo<GoalContextValue>(
    () => ({
      goal,
      save: async (title, targetDate) => setGoal(await saveGoal(title, targetDate)),
      clear: async () => {
        await clearGoal()
        setGoal(null)
      },
    }),
    [goal],
  )

  return <GoalContext.Provider value={value}>{children}</GoalContext.Provider>
}
