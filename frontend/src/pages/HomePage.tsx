import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchDecks, fetchStats } from '../api'
import type { Deck, Stats } from '../api'
import { QUOTES } from '../quotes'

export default function HomePage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [decks, setDecks] = useState<Deck[]>([])
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    Promise.all([fetchStats(), fetchDecks()])
      .then(([nextStats, nextDecks]) => {
        setStats(nextStats)
        setDecks(nextDecks)
      })
      .catch((e) => setError(e instanceof Error ? e.message : '加载失败'))
  }, [])

  if (error) return <p className="text-sm text-shu">{error}</p>
  if (!stats) return <p className="text-sm text-hai">加载中…</p>

  return (
    <div>
      <section className="border-y border-usu py-6">
        <div className="flex items-end gap-10">
          <Stat label="待复习" value={stats.dueToday} accent />
          <Stat label="今日已复习" value={stats.reviewedToday} />
          <Stat label="总卡片" value={stats.totalCards} />
        </div>
      </section>

      <QuoteBoard />

      <div className="pb-14 text-center">
        {stats.totalCards === 0 ? (
          <button
            onClick={() => navigate('/cards')}
            className="rounded-sm border border-sumi px-6 py-2.5 text-sm transition hover:bg-sumi hover:text-washi"
          >
            添加卡片
          </button>
        ) : stats.dueToday === 0 ? (
          <p className="text-sm text-hai">今日已清空，明天再来。</p>
        ) : (
          <button
            onClick={() => navigate('/review')}
            className="rounded-sm bg-ai px-8 py-3 text-sm text-washi transition hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ai"
          >
            开始复习
          </button>
        )}
      </div>

      {decks.length > 0 && stats.totalCards > 0 && (
        <section className="border-t border-usu pt-6">
          <h2 className="mb-3 text-xs tracking-wider text-hai">按包复习</h2>
          <ul>
            {decks.map((deck) => (
              <li
                key={deck.id}
                className="flex items-baseline gap-3 border-b border-usu/60 py-2.5 last:border-0"
              >
                <span className="min-w-0 flex-1 truncate">{deck.name}</span>
                <span className="text-xs tabular-nums text-hai">
                  {deck.cardCount} 张
                </span>
                {deck.dueCount > 0 ? (
                  <button
                    onClick={() => navigate(`/review?deck=${deck.id}`)}
                    className="text-sm text-ai transition hover:underline"
                  >
                    复习 {deck.dueCount}
                  </button>
                ) : (
                  <span className="text-sm text-hai/60">已清空</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function Stat({
  label,
  value,
  accent = false,
}: {
  label: string
  value: number
  accent?: boolean
}) {
  return (
    <div>
      <div
        className={`font-mincho text-4xl tabular-nums ${accent ? 'text-ai' : 'text-sumi'}`}
      >
        {value}
      </div>
      <div className="mt-1 text-xs tracking-wider text-hai">{label}</div>
    </div>
  )
}

/**
 * 白板：一次只放一句话，刷新换下一句。
 *
 * 这块地方原来写的是「有 N 张等着你」—— 待复习数上面那排统计里已经有了，
 * 中间再喊一遍只是加压，数字越大越不想点。换成一句安静的话，
 * 让人愿意在首页多停两秒。
 *
 * 顺序轮换而不是随机：随机会连着重复，而「刷新换下一句」本来就该是顺的。
 * 进度记在 localStorage，读不到就从头开始 —— 无痕窗口和清过站点数据的
 * 浏览器都可能读不到，这不是错误。
 */
const CURSOR_KEY = 'kotoba:quote-cursor'

function QuoteBoard() {
  const [cursor, setCursor] = useState(() => {
    try {
      const saved = Number(localStorage.getItem(CURSOR_KEY))
      return Number.isInteger(saved) ? saved : 0
    } catch {
      return 0
    }
  })

  // 进来先把游标往后推一格存回去，下次刷新自然是下一句
  useEffect(() => {
    try {
      localStorage.setItem(CURSOR_KEY, String((cursor + 1) % QUOTES.length))
    } catch {
      // 存不了就算了，只是下次刷新还是这句
    }
  }, [cursor])

  const quote = QUOTES[((cursor % QUOTES.length) + QUOTES.length) % QUOTES.length]

  return (
    <section className="py-16 sm:py-20">
      <figure key={cursor} className="animate-quote mx-auto max-w-xl">
        <blockquote className="font-mincho text-xl leading-[2.1] whitespace-pre-line text-sumi sm:text-2xl sm:leading-[2.2]">
          {quote.text}
        </blockquote>
        {quote.source && (
          <figcaption className="mt-6 text-right text-xs tracking-wider text-hai">
            —— {quote.source}
          </figcaption>
        )}
      </figure>

      <div className="mt-10 text-center">
        <button
          onClick={() => setCursor((c) => c + 1)}
          className="text-xs tracking-wider text-hai transition hover:text-sumi"
        >
          换一句
        </button>
      </div>
    </section>
  )
}
