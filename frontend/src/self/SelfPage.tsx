import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { cnNumber, seasonOf, todayLabel } from './season'
import { groupByMonth, monthAnchor, useEssays } from './essays'
import type { Month } from './essays'
import { NoteWall, SelfNav, Sky } from './parts'

/**
 * self：随笔的展示页，谁都能看。
 *
 * 宽屏上分两栏：左边固定不动的是「此刻」—— 今天的节气、第几天、走到第几候，
 * 下面是月份目录；右边往下滚的是「写过的」，一条一张卡片，瀑布流排开。
 * 窄屏上左栏回到顶部，月份目录收起来。
 */
export default function SelfPage() {
  const now = new Date()
  const season = seasonOf(now)
  const { list, error, loadingMore, loadMore } = useEssays()
  const months = useMemo(() => (list ? groupByMonth(list.essays) : []), [list])

  return (
    <div className="self-root" style={{ '--accent': season.color } as React.CSSProperties}>
      <Sky color={season.color} />
      <div className="self-wrap self-wide">
        <SelfNav>
          {list?.canWrite && (
            <Link to="/self/write" className="self-nav-link">
              写一条
            </Link>
          )}
          <span>{todayLabel(now)}</span>
        </SelfNav>

        <div className="self-layout">
          <aside className="self-aside">
            <header className="self-hero">
              <h1 className="self-term">{season.name}</h1>
              <div className="self-hero-line">
                <span>二十四节气之{cnNumber(season.ordinal)}</span>
                <span>第{cnNumber(season.day)}天</span>
              </div>
              <ol className="self-pentads" aria-label="三候">
                {season.pentads.map((pentad, i) => (
                  <li key={pentad} className={i === season.pentad ? 'is-now' : undefined}>
                    <small>{['一', '二', '三'][i]}候</small>
                    {pentad}
                  </li>
                ))}
              </ol>
            </header>

            {months.length > 0 && <MonthIndex months={months} partialLast={!!list?.hasMore} />}
            {list && list.total > 0 && <p className="self-total">共 {list.total} 篇</p>}
          </aside>

          <main className="self-main">
            {error ? (
              <p className="self-quiet">暂时读不到，过一会儿再来。</p>
            ) : list && list.essays.length === 0 ? (
              <p className="self-quiet">还没有写下什么。</p>
            ) : (
              list && <NoteWall essays={list.essays} hasMore={list.hasMore} />
            )}

            {list?.hasMore && (
              <div className="self-more">
                <button onClick={loadMore} disabled={loadingMore}>
                  {loadingMore ? '翻找中…' : '更早的'}
                </button>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  )
}

/** 左栏的月份目录：点一下滚到那个月，滚动时标出正在读的那个月。 */
function MonthIndex({ months, partialLast }: { months: Month[]; partialLast: boolean }) {
  const [current, setCurrent] = useState(months[0].key)

  useEffect(() => {
    // 正在读的月 = 分隔线已经越过屏幕上方三分之一的最后一个月
    const update = () => {
      let reading = months[0].key
      for (const month of months) {
        const sep = document.getElementById(monthAnchor(month))
        if (sep && sep.getBoundingClientRect().top < innerHeight / 3) reading = month.key
      }
      setCurrent(reading)
    }
    update()
    addEventListener('scroll', update, { passive: true })
    return () => removeEventListener('scroll', update)
  }, [months])

  const thisYear = new Date().getFullYear()
  return (
    <nav className="self-index" aria-label="按月份">
      {months.map((month, i) => (
        <a
          key={month.key}
          href={`#${monthAnchor(month)}`}
          className={month.key === current ? 'is-now' : undefined}
          onClick={(e) => {
            e.preventDefault()
            document.getElementById(monthAnchor(month))?.scrollIntoView({ behavior: 'smooth' })
          }}
        >
          <span>
            {month.year !== thisYear && `${month.year} · `}
            {cnNumber(month.month)}月
          </span>
          {/* 最老的那个月可能还没取全，篇数先不标 */}
          {!(partialLast && i === months.length - 1) && <b>{month.count}</b>}
        </a>
      ))}
    </nav>
  )
}
