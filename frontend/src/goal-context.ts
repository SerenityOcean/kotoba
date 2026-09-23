import { createContext, useContext } from 'react'
import type { Goal } from './api'

export interface GoalContextValue {
  /** 没立目标就是 null */
  goal: Goal | null
  save: (title: string, targetDate: string) => Promise<void>
  clear: () => Promise<void>
}

// 和 GoalProvider 分开放，理由同 auth-context.ts
export const GoalContext = createContext<GoalContextValue | null>(null)

/** 顶上的倒计时和彼岸页要看同一份目标：一边改了另一边立刻跟着变。 */
export function useGoal(): GoalContextValue {
  const value = useContext(GoalContext)
  if (!value) {
    throw new Error('useGoal 必须在 <GoalProvider> 里用')
  }
  return value
}
