import { useCallback, useEffect, useState } from 'react'
import { fetchEssays } from '../api'
import type { Essay, EssayList } from '../api'
import { formatLocalDate, startOfDay } from '../goal-time'

/** 一天一张卡片：一天写了好几条，就按时间顺序排在同一张里。 */
export interface Day {
  key: string
  date: Date
  essays: Essay[]
}

export interface Month {
  key: string
  year: number
  month: number
  days: Day[]
  count: number
}

/** 月份分隔的 id，展示页左栏的月份目录按它跳过去。 */
export const monthAnchor = (month: Month) => `self-${month.key}`

/** 进来的是从新到旧的列表；月、日都保持从新到旧，同一天里的几条从早到晚。 */
export function groupByMonth(essays: Essay[]): Month[] {
  const months: Month[] = []
  // 接口按 id 翻页，正常写的时候 id 和落笔时刻同序；这里再按时刻排一遍，万一有补录的也不会乱
  const newestFirst = [...essays].sort((a, b) => Date.parse(b.writtenAt) - Date.parse(a.writtenAt))
  for (const essay of newestFirst) {
    const at = new Date(essay.writtenAt)
    const date = startOfDay(at)
    const monthKey = `${date.getFullYear()}-${date.getMonth()}`
    let month = months[months.length - 1]
    if (!month || month.key !== monthKey) {
      month = { key: monthKey, year: date.getFullYear(), month: date.getMonth() + 1, days: [], count: 0 }
      months.push(month)
    }
    const dayKey = formatLocalDate(date)
    let day = month.days[month.days.length - 1]
    if (!day || day.key !== dayKey) {
      day = { key: dayKey, date, essays: [] }
      month.days.push(day)
    }
    day.essays.unshift(essay)
    month.count++
  }
  return months
}

/** 出处行：——《美国往事》、-- 某某。排在随笔末尾，靠右、小一号。 */
const ATTRIBUTION = /^(——|--|—|－－)/

export interface Paragraph {
  text: string
  attribution: boolean
}

/** 按换行分段，和写的时候一样。存的时候连续空行已经并掉了，这里只需要丢掉空行。 */
export function paragraphs(body: string): Paragraph[] {
  return body
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '')
    .map((text) => ({ text, attribution: ATTRIBUTION.test(text) }))
}

/** 字数：空白不算，标点算。展示页和写的时候用同一个数法。 */
export function countChars(text: string): number {
  return text.replace(/\s/g, '').length
}

export function formatTime(iso: string): string {
  const at = new Date(iso)
  return `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`
}

/** 随笔列表：第一页进来就取，往前翻一次取一页；写、改、删之后就地更新，不重新拉。 */
export function useEssays() {
  const [list, setList] = useState<EssayList | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)

  useEffect(() => {
    let alive = true
    fetchEssays()
      .then((page) => alive && setList(page))
      .catch((e: Error) => alive && setError(e.message))
    return () => {
      alive = false
    }
  }, [])

  const loadMore = useCallback(async () => {
    if (!list || !list.hasMore || loadingMore) return
    setLoadingMore(true)
    try {
      const page = await fetchEssays(list.essays[list.essays.length - 1].id)
      setList((current) => current && { ...page, essays: [...current.essays, ...page.essays] })
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoadingMore(false)
    }
  }, [list, loadingMore])

  const added = useCallback((essay: Essay) => {
    setList((current) => current && { ...current, essays: [essay, ...current.essays], total: current.total + 1 })
  }, [])

  const revised = useCallback((essay: Essay) => {
    setList((current) => current && {
      ...current,
      essays: current.essays.map((e) => (e.id === essay.id ? essay : e)),
    })
  }, [])

  const removed = useCallback((id: number) => {
    setList((current) => current && {
      ...current,
      essays: current.essays.filter((e) => e.id !== id),
      total: current.total - 1,
    })
  }, [])

  return { list, error, loadingMore, loadMore, added, revised, removed }
}
