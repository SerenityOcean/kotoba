import { useState } from 'react'
import type { FormEvent } from 'react'
import type { Goal } from '../api'
import { useGoal } from '../goal-context'
import { countdown, formatLocalDate, parseLocalDate, weekGrid } from '../goal-time'

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

/**
 * 彼岸：要抵达的那一天。
 *
 * 首页顶上只写着「还剩几周几天」，这里把同一段时间铺开成格子 ——
 * 数字说的是还剩多少，格子让人看见已经走了多少。
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
  const grid = weekGrid(goal)
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

      <WeekGrid total={grid.total} passed={grid.passed} />

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

/**
 * 一周一格。走过的填满，这一周用蓝色，还没到的留白，最后一格描一圈 —— 那就是彼岸。
 * 格子按行自动折，十年五百多格也排得下。
 */
function WeekGrid({ total, passed }: { total: number; passed: number }) {
  const remaining = total - passed

  return (
    <section className="py-12">
      <ol className="mx-auto flex max-w-xl flex-wrap justify-center gap-1.5" aria-hidden>
        {Array.from({ length: total }, (_, i) => {
          const state =
            i < passed
              ? 'bg-hai/45'
              : i === passed
                ? 'bg-ai'
                : i === total - 1
                  ? 'border border-sumi'
                  : 'border border-usu'
          return <li key={i} className={`size-3 rounded-[2px] ${state}`} />
        })}
      </ol>
      <p className="mt-6 text-center text-xs tracking-wider text-hai">
        {remaining > 0
          ? `共 ${total} 周，已走过 ${passed} 周，还剩 ${remaining} 周`
          : `共 ${total} 周，全部走完`}
      </p>
    </section>
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
