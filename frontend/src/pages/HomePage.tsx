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
 * 白板：一次只放一句话，刷新换一句。
 *
 * 这块地方原来写的是「有 N 张等着你」—— 待复习数上面那排统计里已经有了，
 * 中间再喊一遍只是加压，数字越大越不想点。换成一句安静的话，
 * 让人愿意在首页多停两秒。
 *
 * 不是纯随机，是「洗牌后走完一轮再洗」：纯随机在 44 句的规模下很容易
 * 连着撞到同一句，而且看全之前会反复重复。洗牌保证每句都轮得到，
 * 顺序又不可预测 —— 音乐播放器的随机播放也是这么做的。
 *
 * 进度记在 localStorage，读不到就重新洗一副：无痕窗口和清过站点数据的
 * 浏览器都可能读不到，这不是错误。
 */
const CYCLE_KEY = 'kotoba:quote-cycle'

interface Cycle {
  order: number[]
  cursor: number
}

/** Fisher-Yates。avoidFirst 是上一轮的最后一句，别让新一轮开头撞上它。 */
function shuffle(size: number, avoidFirst?: number): number[] {
  const order = Array.from({ length: size }, (_, i) => i)
  for (let i = size - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  // 新一轮第一句正好是上一轮最后一句的话，看着就像没换
  if (avoidFirst !== undefined && order.length > 1 && order[0] === avoidFirst) {
    ;[order[0], order[1]] = [order[1], order[0]]
  }
  return order
}

/** 走到头就重新洗一副，否则游标 +1。 */
function advance(cycle: Cycle): Cycle {
  const next = cycle.cursor + 1
  if (next < cycle.order.length) {
    return { ...cycle, cursor: next }
  }
  return { order: shuffle(QUOTES.length, cycle.order.at(-1)), cursor: 0 }
}

function loadCycle(): Cycle {
  try {
    const raw = localStorage.getItem(CYCLE_KEY)
    if (raw) {
      const saved = JSON.parse(raw) as Cycle
      // 句子增删过之后旧的排列就对不上了，重洗
      if (
        Array.isArray(saved.order) &&
        saved.order.length === QUOTES.length &&
        Number.isInteger(saved.cursor) &&
        saved.cursor >= 0 &&
        saved.cursor < saved.order.length
      ) {
        return saved
      }
    }
  } catch {
    // 读不到就当第一次来
  }
  return { order: shuffle(QUOTES.length), cursor: 0 }
}

function QuoteBoard() {
  const [cycle, setCycle] = useState(loadCycle)

  // 进来先把游标推一格存回去，下次刷新自然是下一句
  useEffect(() => {
    try {
      localStorage.setItem(CYCLE_KEY, JSON.stringify(advance(cycle)))
    } catch {
      // 存不了就算了，只是下次刷新还是这句
    }
  }, [cycle])

  const index = cycle.order[cycle.cursor] ?? 0
  const quote = QUOTES[index]

  return (
    <section className="py-16 sm:py-20">
      <figure key={index} className="animate-quote mx-auto max-w-xl">
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
          onClick={() => setCycle(advance)}
          className="text-xs tracking-wider text-hai transition hover:text-sumi"
        >
          换一句
        </button>
      </div>
    </section>
  )
}
