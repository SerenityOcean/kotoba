import type { Goal } from './api'

/**
 * 彼岸的时间换算。全部按「本地日历日」算，不看钟点：
 * 晚上 11 点和早上 7 点看到的应该是同一个「还剩 76 天」。
 */

const DAY_MS = 24 * 60 * 60 * 1000

/** 本地零点。比较日期只用它，避免钟点掺进来。 */
function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

/** 2026-12-06 → 本地的 12 月 6 日零点。不能用 new Date(str)，那会被当成 UTC。 */
export function parseLocalDate(value: string): Date {
  const [y, m, d] = value.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function formatLocalDate(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${m}-${d}`
}

/** 两个日期隔了几天。四舍五入是为了吃掉夏令时那一小时的偏差。 */
function daysBetween(from: Date, to: Date): number {
  return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / DAY_MS)
}

export interface Countdown {
  /** 到目标日还有几天；当天是 0，过了是负数 */
  days: number
  /** 还剩几周，向上取整 —— 和周格子里没走完的格数一致 */
  weeks: number
}

export function countdown(goal: Goal, now = new Date()): Countdown {
  const days = daysBetween(now, parseLocalDate(goal.targetDate))
  return { days, weeks: Math.max(0, Math.ceil(days / 7)) }
}

export interface WeekGrid {
  /** 从立目标到目标日一共几格 */
  total: number
  /** 已经走完的格数 */
  passed: number
}

/**
 * 周格子从目标日往回数：最后一格是目标日前的 7 天，倒数第二格再往前 7 天……
 * 这样没走完的格数恰好等于 ceil(剩余天数 / 7)，和顶上写的周数对得上。
 * 最前面那格可能不满 7 天（立目标那天不一定落在格子边界上），无所谓。
 */
export function weekGrid(goal: Goal, now = new Date()): WeekGrid {
  const target = parseLocalDate(goal.targetDate)
  const span = daysBetween(new Date(goal.startedAt), target)
  const { weeks } = countdown(goal, now)
  // 改过日期后起点可能比「现在往后数」还晚，总格数至少要装得下剩下的
  const total = Math.max(1, Math.ceil(span / 7), weeks)
  return { total, passed: total - weeks }
}
