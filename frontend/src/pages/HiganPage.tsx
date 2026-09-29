import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { fetchActivity } from '../api'
import type { DailyActivity, Goal } from '../api'
import { useGoal } from '../goal-context'
import {
  MAX_DAY_ROWS,
  addDays,
  countdown,
  dayGrid,
  daysBetween,
  formatLocalDate,
  parseLocalDate,
  startDate,
  startOfDay,
  weekGrid,
} from '../goal-time'
import { fullMoons, solarTerms } from '../koyomi'

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

/**
 * 彼岸：要抵达的那一天。
 *
 * 首页顶上只写着「还剩几周几天」，这里把同一段时间铺开：
 * 一条河从此岸画到彼岸，沿途是要经过的节气和满月；下面是一天一格，
 * 走过的格子按那天做了多少事上色 —— 数字说的是还剩多少，格子让人看见这些日子是怎么过的。
 */
export default function HiganPage() {
  const { goal } = useGoal()
  const [editing, setEditing] = useState(false)

  if (!goal || editing) {
    return (
      <GoalForm
        initial={goal}
        onDone={() => setEditing(false)}
        onCancel={goal ? () => setEditing(false) : undefined}
      />
    )
  }

  return <GoalView goal={goal} onEdit={() => setEditing(true)} />
}

function GoalView({ goal, onEdit }: { goal: Goal; onEdit: () => void }) {
  const { clear } = useGoal()
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { days, weeks } = countdown(goal)
  const target = parseLocalDate(goal.targetDate)

  async function handleClear() {
    try {
      await clear()
    } catch (e) {
      setConfirming(false)
      setError(e instanceof Error ? e.message : '清除失败')
    }
  }

  return (
    <div>
      <section className="border-y border-usu py-10 text-center">
        <p className="text-xs tracking-[0.3em] text-hai">距</p>
        <h2 className="mt-3 font-mincho text-2xl tracking-wider sm:text-3xl">{goal.title}</h2>

        <div className="mt-8 font-mincho">
          {days > 0 ? (
            <p className="flex items-baseline justify-center gap-4">
              <Figure value={weeks} unit="周" />
              <span className="text-usu">·</span>
              <Figure value={days} unit="天" />
            </p>
          ) : days === 0 ? (
            <p className="text-4xl text-ai">就是今天</p>
          ) : (
            <p className="text-2xl text-hai">已过去 {-days} 天</p>
          )}
        </div>

        <p className="mt-6 text-xs tracking-wider text-hai">
          {goal.targetDate.replaceAll('-', ' / ')}　星期{WEEKDAYS[target.getDay()]}
        </p>
      </section>

      <River goal={goal} />
      <Footprints goal={goal} />

      {days < 0 && (
        <p className="pb-6 text-center text-sm text-hai">这一程走完了。立下一个彼岸吧。</p>
      )}

      {error && <p className="pb-4 text-center text-sm text-shu">{error}</p>}

      <div className="flex justify-center gap-6 text-xs tracking-wider">
        {confirming ? (
          <>
            {/* 行内确认，和删卡片、删包一致 */}
            <button onClick={handleClear} className="text-shu transition hover:underline">
              确认清除
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="text-hai transition hover:text-sumi"
            >
              取消
            </button>
          </>
        ) : (
          <>
            <button onClick={onEdit} className="text-hai transition hover:text-sumi">
              {days < 0 ? '立新目标' : '修改'}
            </button>
            <button
              onClick={() => setConfirming(true)}
              className="text-hai transition hover:text-shu"
            >
              清除
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function Figure({ value, unit }: { value: number; unit: string }) {
  return (
    <span>
      <span className="text-5xl tabular-nums text-sumi sm:text-6xl">{value}</span>
      <span className="ml-1.5 font-ui text-sm text-hai">{unit}</span>
    </span>
  )
}

// ---- 河：此岸到彼岸 ---------------------------------------------------------

/**
 * 从立目标那天画到目标日，走过的那段描蓝，今天是线上的一个点。
 * 沿途标上节气和满月：「还剩 68 天」是个数，「还要经过霜降、立冬、小雪」是日子。
 *
 * 河太长时节气会挤成一团，按跨度只挑分量重的标，保证相邻两个至少隔开河长的十分之一；
 * 满月没有字，挤一点也无妨，一年多以内都标。
 */
function River({ goal }: { goal: Goal }) {
  const start = startDate(goal)
  const target = parseLocalDate(goal.targetDate)
  const today = startOfDay(new Date())
  const span = Math.max(1, daysBetween(start, target))

  const at = (date: Date) =>
    `${(Math.min(1, Math.max(0, daysBetween(start, date) / span)) * 100).toFixed(2)}%`
  // 两头有此岸、彼岸自己的字，离两头太近（河长的 4% 以内）的节气就不标了，免得字挤在一起
  const between = (date: Date) => date > start && date < target
  const clearOfShores = (date: Date) => {
    const offset = daysBetween(start, date)
    return offset > span * 0.04 && offset < span * 0.96
  }
  const minRank = span <= 152 ? 0 : span <= 456 ? 1 : span <= 913 ? 2 : 3
  const terms = solarTerms(start, target).filter((t) => t.rank >= minRank && clearOfShores(t.date))
  const moons = span <= 400 ? fullMoons(start, target).filter(between) : []
  const showYear = start.getFullYear() !== target.getFullYear()

  return (
    <section className="pt-12 pb-4" aria-hidden>
      <div className="mx-auto flex max-w-xl items-center gap-5 font-mincho">
        <Shore name="此岸" date={start} showYear={showYear} />

        <div className="relative h-24 flex-1">
          <div className="absolute inset-x-0 top-1/2 h-px bg-usu" />
          <div className="absolute top-1/2 left-0 h-0.5 -translate-y-1/2 bg-ai" style={{ width: at(today) }} />

          {moons.map((date) => (
            <span
              key={date.getTime()}
              title={`满月　${monthDay(date)}`}
              className={`absolute top-[calc(50%-1.25rem)] size-2 -translate-x-1/2 rounded-full ${
                date <= today ? 'bg-hai/35' : 'border border-hai'
              }`}
              style={{ left: at(date) }}
            />
          ))}

          {terms.map((term) => (
            <span
              key={term.date.getTime()}
              title={`${term.name}　${monthDay(term.date)}`}
              className={`absolute top-1/2 flex -translate-x-1/2 -translate-y-1 flex-col items-center gap-1.5 ${
                term.date <= today ? 'text-hai/50' : 'text-hai'
              }`}
              style={{ left: at(term.date) }}
            >
              <span className="h-2 w-px bg-current" />
              <span className="text-[11px] leading-none whitespace-nowrap">{term.name}</span>
            </span>
          ))}

          <span className="absolute top-1/2 right-0 size-2.5 translate-x-1/2 -translate-y-1/2 rounded-[2px] border border-sumi bg-washi" />

          {today <= target && (
            <span
              className="absolute top-0 flex h-1/2 -translate-x-1/2 flex-col items-center justify-between text-xs whitespace-nowrap text-ai"
              style={{ left: at(today) }}
            >
              今日
              <span className="size-2.5 translate-y-1/2 rounded-full bg-ai" />
            </span>
          )}
        </div>

        <Shore name="彼岸" date={target} showYear={showYear} far />
      </div>
    </section>
  )
}

function Shore({
  name,
  date,
  showYear,
  far = false,
}: {
  name: string
  date: Date
  showYear: boolean
  far?: boolean
}) {
  return (
    <p className={`shrink-0 text-center text-sm leading-relaxed ${far ? 'text-sumi' : 'text-hai'}`}>
      {name}
      <br />
      <span className="font-ui text-[11px] tracking-wider text-hai tabular-nums">
        {showYear && `${date.getFullYear()}/`}
        {date.getMonth() + 1}/{date.getDate()}
      </span>
    </p>
  )
}

// ---- 足迹：每天做了什么 --------------------------------------------------------

type Tally = Omit<DailyActivity, 'date'>

/** 格子上悬停时，底下那两行换成这一格的说明 */
interface Focus {
  title: string
  body: string
}

/** 按复习量分四档，自己最多的那天最深。只读了文章没复习也给最浅一档 —— 做了事的日子不该是空的。 */
const FILLS = ['', 'bg-ai/30', 'bg-ai/50', 'bg-ai/70', 'bg-ai']

function level(tally: Tally | undefined, max: number): number {
  if (!tally) return 0
  if (tally.reviews > 0) return Math.max(1, Math.ceil((4 * tally.reviews) / max))
  return tally.articles > 0 ? 1 : 0
}

function describe(tally: Tally): string {
  const parts: string[] = []
  if (tally.reviews > 0) {
    parts.push(
      `复习 ${tally.reviews} 张` + (tally.learned > 0 ? `，其中新学 ${tally.learned} 张` : ''),
    )
  }
  if (tally.articles > 0) parts.push(`读了 ${tally.articles} 篇`)
  return parts.join(' · ')
}

function sum(tallies: Iterable<Tally>): Tally {
  const total = { reviews: 0, learned: 0, articles: 0 }
  for (const t of tallies) {
    total.reviews += t.reviews
    total.learned += t.learned
    total.articles += t.articles
  }
  return total
}

const monthDay = (date: Date) => `${date.getMonth() + 1} 月 ${date.getDate()} 日`

/**
 * 从立目标那天到今天（目标日过了就到目标日）每天做了什么。
 * 拉不到就当什么都没做 —— 格子照样画，只是不上色，别为这个打扰人。
 */
function useActivity(goal: Goal): Map<string, DailyActivity> {
  const [activity, setActivity] = useState(new Map<string, DailyActivity>())
  const from = formatLocalDate(startDate(goal))
  const today = formatLocalDate(new Date())
  const to = today < goal.targetDate ? today : goal.targetDate

  useEffect(() => {
    if (to < from) return
    let cancelled = false
    fetchActivity(from, to)
      .then((days) => !cancelled && setActivity(new Map(days.map((d) => [d.date, d]))))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [from, to])

  return activity
}

/** 半年以内一天一格，更长的退回一周一格。 */
function Footprints({ goal }: { goal: Goal }) {
  const activity = useActivity(goal)
  const [focus, setFocus] = useState<Focus | null>(null)
  const byDay = dayGrid(goal).rows <= MAX_DAY_ROWS

  const start = startDate(goal)
  const target = parseLocalDate(goal.targetDate)
  const { days } = countdown(goal)
  const total = daysBetween(start, target)
  const walked = sum(activity.values())

  let summary: string
  if (byDay) {
    summary =
      days > 0
        ? `共 ${total} 天，已走过 ${total - days} 天，还剩 ${days} 天`
        : `共 ${total} 天，全部走完`
  } else {
    const grid = weekGrid(goal)
    const remaining = grid.total - grid.passed
    summary =
      remaining > 0
        ? `共 ${grid.total} 周，已走过 ${grid.passed} 周，还剩 ${remaining} 周`
        : `共 ${grid.total} 周，全部走完`
  }

  return (
    <section className="pt-8 pb-12">
      <div onMouseLeave={() => setFocus(null)}>
        {byDay ? (
          <DayCells goal={goal} activity={activity} onFocus={setFocus} />
        ) : (
          <WeekCells goal={goal} activity={activity} onFocus={setFocus} />
        )}
      </div>

      <div className="mt-6 h-12 text-center text-xs leading-6 tracking-wider text-hai">
        {focus ? (
          <>
            <p className="font-mincho text-sm text-sumi">{focus.title}</p>
            <p>{focus.body}</p>
          </>
        ) : (
          <>
            <p>{summary}</p>
            {walked.reviews + walked.articles > 0 && <p>至今{describe(walked)}</p>}
          </>
        )}
      </div>
    </section>
  )
}

interface CellsProps {
  goal: Goal
  activity: Map<string, DailyActivity>
  onFocus: (focus: Focus) => void
}

/**
 * 一天一格，一行一周，和周格子一样以目标日收尾。
 * 走过的按那天的复习量上色，什么都没做的填灰；今天描一圈蓝，目标日描一圈黑。
 */
function DayCells({ goal, activity, onFocus }: CellsProps) {
  const { first, rows } = dayGrid(goal)
  const startKey = formatLocalDate(startDate(goal))
  const today = startOfDay(new Date())
  const todayKey = formatLocalDate(today)
  const targetKey = goal.targetDate
  const target = parseLocalDate(targetKey)
  const max = Math.max(1, ...Array.from(activity.values(), (a) => a.reviews))

  function focusOn(date: Date, key: string) {
    const tally = activity.get(key)
    const weekday = `星期${WEEKDAYS[date.getDay()]}`
    let title = `${monthDay(date)}　${weekday}`
    let body: string
    if (key < todayKey) {
      body = tally ? describe(tally) : '这一天空着'
    } else if (key === todayKey) {
      title = `今天　${title}`
      body = tally ? describe(tally) : '还没开始'
    } else {
      body = `还有 ${daysBetween(today, date)} 天`
    }
    if (key === targetKey) {
      title = `${title}　${goal.title}`
    }
    onFocus({ title, body })
  }

  return (
    <div
      className="mx-auto grid w-fit grid-cols-[2.5rem_repeat(7,1.125rem)_2.5rem] gap-1.5 text-[11px] text-hai"
      aria-hidden
    >
      <span />
      {Array.from({ length: 7 }, (_, i) => (
        <span key={i} className="text-center">
          {WEEKDAYS[(target.getDay() + 1 + i) % 7]}
        </span>
      ))}
      <span />

      {Array.from({ length: rows }, (_, row) => {
        const week = Array.from({ length: 7 }, (_, i) => addDays(first, row * 7 + i))
        const monthStart = week.find((d) => d.getDate() === 1 && formatLocalDate(d) >= startKey)
        const label = row === 0 ? week.find((d) => formatLocalDate(d) >= startKey) : monthStart

        return [
          <span key={`m${row}`} className="self-center pr-1 text-right font-mincho">
            {label && `${label.getMonth() + 1}月`}
          </span>,
          ...week.map((date) => {
            const key = formatLocalDate(date)
            if (key < startKey) return <span key={key} />

            const fill = FILLS[level(activity.get(key), max)]
            let state: string
            if (key < todayKey) {
              state = fill || 'bg-usu'
            } else if (key === todayKey) {
              state = `${fill || 'border border-usu'} outline outline-offset-2 outline-ai`
            } else {
              state = key === targetKey ? 'border border-sumi' : 'border border-usu'
            }
            if (key === targetKey && key < todayKey) {
              state += ' outline outline-offset-2 outline-sumi'
            }

            return (
              <span
                key={key}
                onMouseEnter={() => focusOn(date, key)}
                onClick={() => focusOn(date, key)}
                className={`size-4.5 rounded-[3px] ${state}`}
              />
            )
          }),
          <span key={`e${row}`} />,
        ]
      })}
    </div>
  )
}

/**
 * 一周一格，给半年以上的目标用。格子怎么切和 weekGrid 一样：从目标日往回每 7 天一格。
 * 十年五百多格也排得下，按行自动折。
 */
function WeekCells({ goal, activity, onFocus }: CellsProps) {
  const { total, passed } = weekGrid(goal)
  const target = parseLocalDate(goal.targetDate)

  const weeks = Array.from({ length: total }, (_, i) => {
    const end = addDays(target, -7 * (total - 1 - i))
    const begin = addDays(end, -6)
    const tallies = Array.from({ length: 7 }, (_, d) => activity.get(formatLocalDate(addDays(begin, d))))
    return { begin, end, tally: sum(tallies.filter((t) => t !== undefined)) }
  })
  const max = Math.max(1, ...weeks.map((w) => w.tally.reviews))

  function focusOn(i: number) {
    const { begin, end, tally } = weeks[i]
    const range = `${begin.getMonth() + 1}/${begin.getDate()} – ${end.getMonth() + 1}/${end.getDate()}`
    let body: string
    if (i <= passed) {
      body = describe(tally) || (i < passed ? '这一周空着' : '这一周还没开始')
    } else {
      body = `${i - passed} 周后`
    }
    onFocus({ title: `第 ${i + 1} 周　${range}`, body })
  }

  return (
    <ol className="mx-auto flex max-w-xl flex-wrap justify-center gap-1.5" aria-hidden>
      {weeks.map((week, i) => {
        const fill = FILLS[level(week.tally, max)]
        const state =
          i < passed
            ? fill || 'bg-usu'
            : i === passed
              ? `${fill || 'border border-usu'} outline outline-offset-1 outline-ai`
              : i === total - 1
                ? 'border border-sumi'
                : 'border border-usu'
        return (
          <li
            key={i}
            onMouseEnter={() => focusOn(i)}
            onClick={() => focusOn(i)}
            className={`size-3 rounded-[2px] ${state}`}
          />
        )
      })}
    </ol>
  )
}

function GoalForm({
  initial,
  onDone,
  onCancel,
}: {
  initial: Goal | null
  onDone: () => void
  onCancel?: () => void
}) {
  const { save } = useGoal()
  const today = formatLocalDate(new Date())
  // 已经过期的目标拿来改，日期就别预填了，免得一提交就被拒
  const [title, setTitle] = useState(initial?.title ?? '')
  const [targetDate, setTargetDate] = useState(
    initial && initial.targetDate >= today ? initial.targetDate : '',
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (title.trim() === '') {
      setError('写下你的目标')
      return
    }
    if (targetDate === '') {
      setError('选一个日子')
      return
    }
    if (targetDate < today) {
      setError('这个日子已经过去了')
      return
    }
    setSaving(true)
    try {
      await save(title.trim(), targetDate)
      onDone()
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-sm py-8">
      {!initial && (
        <p className="mb-10 text-center font-mincho text-xl leading-loose">
          立一个彼岸。
          <br />
          <span className="text-base text-hai">要抵达哪里，哪一天。</span>
        </p>
      )}

      <label className="block">
        <span className="text-xs tracking-wider text-hai">目标</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={30}
          placeholder="JLPT N2"
          autoFocus
          className="mt-2 w-full border-b border-usu bg-transparent py-2 font-mincho text-lg outline-none transition placeholder:text-hai/50 focus:border-sumi"
        />
      </label>

      <label className="mt-8 block">
        <span className="text-xs tracking-wider text-hai">日期</span>
        <input
          type="date"
          value={targetDate}
          min={today}
          onChange={(e) => setTargetDate(e.target.value)}
          className="mt-2 w-full border-b border-usu bg-transparent py-2 font-mincho text-lg tabular-nums outline-none transition focus:border-sumi"
        />
      </label>

      {error && <p className="mt-6 text-sm text-shu">{error}</p>}

      <div className="mt-10 flex items-center justify-center gap-6">
        <button
          type="submit"
          disabled={saving}
          className="rounded-sm bg-ai px-8 py-2.5 text-sm text-washi transition hover:opacity-85 disabled:opacity-50"
        >
          {saving ? '保存中…' : '启程'}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="text-xs tracking-wider text-hai transition hover:text-sumi"
          >
            取消
          </button>
        )}
      </div>
    </form>
  )
}
