import { Fragment } from 'react'
import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'
import type { Essay } from '../api'
import { cnNumber, termFinder, WEEKDAYS } from './season'
import { formatTime, groupByMonth } from './essays'
import type { Day } from './essays'

/** 远处一颗慢慢呼吸的太阳和一片雾，太阳的颜色跟着节气走。 */
export function Sky({ color }: { color: string }) {
  return (
    <div className="self-sky" aria-hidden style={{ '--sun': color } as React.CSSProperties}>
      <div className="self-sun" />
      <div className="self-mist" />
    </div>
  )
}

export function SelfNav({ children }: { children?: ReactNode }) {
  return (
    <nav className="self-nav">
      <Link to="/self" className="self-mark">
        self
      </Link>
      <span className="self-nav-right">{children}</span>
    </nav>
  )
}

/** 正文按行分段。存的时候连续空行已经并掉了，这里只需要丢掉空行。 */
export function Paragraphs({ body }: { body: string }) {
  return body
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map((line, i) => <p key={i}>{line}</p>)
}

/**
 * 按月分组的卡片墙。renderEntry 不给就只读；写作页拿它给每条挂上编辑、删除。
 * hasMore 时最老的那个月可能还没取全，篇数先不标。
 */
export function EssayWall({
  essays,
  hasMore,
  renderEntry,
}: {
  essays: Essay[]
  hasMore: boolean
  renderEntry?: (essay: Essay) => ReactNode
}) {
  if (essays.length === 0) return null

  const months = groupByMonth(essays)
  const thisYear = new Date().getFullYear()
  const termOf = termFinder(new Date(essays[essays.length - 1].writtenAt), new Date())

  return (
    <section className="self-grid">
      {months.map((month, i) => (
        // 月份分隔和卡片都是同一个 grid 的直接子元素，分隔线才能横跨整行
        <Fragment key={month.key}>
          <div className="self-sep">
            <b>
              {month.year !== thisYear && <small>{month.year} · </small>}
              {cnNumber(month.month)}月
            </b>
            {!(hasMore && i === months.length - 1) && <span>{month.count} 篇</span>}
          </div>
          {month.days.map((day) => (
            <DayCard key={day.key} day={day} term={termOf(day.date)} renderEntry={renderEntry} />
          ))}
        </Fragment>
      ))}
    </section>
  )
}

function DayCard({
  day,
  term,
  renderEntry,
}: {
  day: Day
  term: { name: string; color: string }
  renderEntry?: (essay: Essay) => ReactNode
}) {
  const m = String(day.date.getMonth() + 1).padStart(2, '0')
  const d = String(day.date.getDate()).padStart(2, '0')
  return (
    <article className="self-card" style={{ '--c': term.color } as React.CSSProperties}>
      <header className="self-card-top">
        <span className="self-card-date">
          {m}.{d}
          <small>周{WEEKDAYS[day.date.getDay()]}</small>
        </span>
        <span className="self-tag">{term.name}</span>
      </header>
      {day.essays.map((essay) =>
        renderEntry ? (
          <div key={essay.id} className="self-entry">
            {renderEntry(essay)}
          </div>
        ) : (
          <div key={essay.id} className="self-entry">
            <Paragraphs body={essay.body} />
            <div className="self-time">{formatTime(essay.writtenAt)}</div>
          </div>
        ),
      )}
    </article>
  )
}
