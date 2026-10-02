import { Fragment } from 'react'
import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'
import type { Essay } from '../api'
import { cnNumber, termFinder, WEEKDAYS } from './season'
import { formatTime, groupByMonth, monthAnchor, paragraphs } from './essays'
import type { Day, Month } from './essays'
import { useMasonry } from './masonry'

/**
 * 极光：几条很大的柔光色带在天上慢慢飘、互相叠。
 * 打头那条是今天节气的颜色，其余是极光常见的绿、蓝、紫、粉。
 */
export function Sky({ color }: { color: string }) {
  return (
    <div className="self-sky" aria-hidden style={{ '--term': color } as React.CSSProperties}>
      <div className="self-aurora is-term" />
      <div className="self-aurora is-mint" />
      <div className="self-aurora is-violet" />
      <div className="self-aurora is-blue" />
      <div className="self-aurora is-rose" />
      <div className="self-grain" />
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

/** 按换行分段；出处行（——《某某》）靠右、小一号。 */
export function Paragraphs({ body }: { body: string }) {
  return paragraphs(body).map((paragraph, i) => (
    <p key={i} className={paragraph.attribution ? 'self-attribution' : undefined}>
      {paragraph.text}
    </p>
  ))
}

/**
 * 展示页：一条随笔一张卡片。日期单独一行横跨整排，下面是这一天写的几条，
 * 按落笔先后瀑布流排开。
 * hasMore 时最老的那个月可能还没取全，篇数先不标。
 */
export function NoteWall({ essays, hasMore }: { essays: Essay[]; hasMore: boolean }) {
  const grid = useMasonry<HTMLElement>([essays])
  if (essays.length === 0) return null

  const months = groupByMonth(essays)
  const termOf = termFinder(new Date(essays[essays.length - 1].writtenAt), new Date())

  return (
    <section className="self-masonry" ref={grid}>
      {months.map((month, i) => (
        <Fragment key={month.key}>
          <MonthSep month={month} partial={hasMore && i === months.length - 1} />
          {month.days.map((day) => {
            const term = termOf(day.date)
            return (
              <Fragment key={day.key}>
                <div className="self-day" style={{ '--c': term.color } as React.CSSProperties}>
                  <DayDate date={day.date} />
                  <span className="self-tag">{term.name}</span>
                </div>
                {day.essays.map((essay) => (
                  <article key={essay.id} className="self-card self-note">
                    <Paragraphs body={essay.body} />
                    <div className="self-time">{formatTime(essay.writtenAt)}</div>
                  </article>
                ))}
              </Fragment>
            )
          })}
        </Fragment>
      ))}
    </section>
  )
}

/**
 * 写作页：一天一张卡片，同一天的几条叠在里面，每条挂上编辑、删除。
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
  const termOf = termFinder(new Date(essays[essays.length - 1].writtenAt), new Date())

  return (
    <section className="self-grid">
      {months.map((month, i) => (
        // 月份分隔和卡片都是同一个 grid 的直接子元素，分隔线才能横跨整行
        <Fragment key={month.key}>
          <MonthSep month={month} partial={hasMore && i === months.length - 1} />
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
  return (
    <article className="self-card" style={{ '--c': term.color } as React.CSSProperties}>
      <header className="self-card-top">
        <DayDate date={day.date} />
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

function MonthSep({ month, partial }: { month: Month; partial: boolean }) {
  return (
    <div className="self-sep" id={monthAnchor(month)}>
      <b>
        {month.year !== new Date().getFullYear() && <small>{month.year} · </small>}
        {cnNumber(month.month)}月
      </b>
      {!partial && <span>{month.count} 篇</span>}
    </div>
  )
}

/** 10.02 周五 */
function DayDate({ date }: { date: Date }) {
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return (
    <span className="self-card-date">
      {m}.{d}
      <small>周{WEEKDAYS[date.getDay()]}</small>
    </span>
  )
}
