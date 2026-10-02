import { Link } from 'react-router-dom'
import { cnNumber, seasonOf, todayLabel } from './season'
import { useEssays } from './essays'
import { EssayWall, SelfNav, Sky } from './parts'

/**
 * self：随笔的展示页，谁都能看。
 *
 * 头上是今天所在的节气 —— 第几个、进来第几天、走到第几候；
 * 下面一天一张卡片，卡片的颜色是那天的节气。
 */
export default function SelfPage() {
  const now = new Date()
  const season = seasonOf(now)
  const { list, error, loadingMore, loadMore } = useEssays()

  return (
    <div className="self-root" style={{ '--accent': season.color } as React.CSSProperties}>
      <Sky color={season.color} />
      <div className="self-wrap">
        <SelfNav>
          {list?.canWrite && (
            <Link to="/self/write" className="self-nav-link">
              写一条
            </Link>
          )}
          <span>{todayLabel(now)}</span>
        </SelfNav>

        <header className="self-hero">
          <h1 className="self-term">{season.name}</h1>
          <div className="self-hero-line">
            二十四节气之{cnNumber(season.ordinal)} · 第{cnNumber(season.day)}天
          </div>
          <ol className="self-pentads" aria-label="三候">
            {season.pentads.map((pentad, i) => (
              <li key={pentad} className={i === season.pentad ? 'is-now' : undefined}>
                {pentad}
              </li>
            ))}
          </ol>
        </header>

        {error ? (
          <p className="self-quiet">暂时读不到，过一会儿再来。</p>
        ) : list && list.essays.length === 0 ? (
          <p className="self-quiet">还没有写下什么。</p>
        ) : (
          list && <EssayWall essays={list.essays} hasMore={list.hasMore} />
        )}

        {list?.hasMore && (
          <div className="self-more">
            <button onClick={loadMore} disabled={loadingMore}>
              {loadingMore ? '翻找中…' : '更早的'}
            </button>
          </div>
        )}

        {list && list.total > 0 && <footer className="self-footer">共 {list.total} 篇</footer>}
      </div>
    </div>
  )
}
