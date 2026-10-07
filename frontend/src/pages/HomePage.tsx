import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchDecks, fetchStats, saveDailyNewLimit } from '../api'
import type { Deck, Stats } from '../api'
import { QUOTES } from '../quotes'

export default function HomePage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [decks, setDecks] = useState<Deck[]>([])
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  function load() {
    return Promise.all([fetchStats(), fetchDecks()])
      .then(([nextStats, nextDecks]) => {
        setStats(nextStats)
        setDecks(nextDecks)
      })
      .catch((e) => setError(e instanceof Error ? e.message : '加载失败'))
  }

  useEffect(() => {
    load()
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
        {stats.totalCards > 0 && (
          <DailyNew
            stats={stats}
            onSave={async (limit) => {
              await saveDailyNewLimit(limit)
              await load()
            }}
          />
        )}
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

/**
 * 待复习下面那行：其中旧卡几张、新词几张，以及每天学多少新词（点数字就能改）。
 *
 * 旧卡不限量，到期了就该复习；限的是新卡往里放的速度 —— 不然导入一个
 * 200 张的包，当天待复习就是 200。
 */
function DailyNew({
  stats,
  onSave,
}: {
  stats: Stats
  onSave: (limit: number | null) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const limit = stats.dailyNewLimit
  // 名额用完之后还在排队的新卡
  const queued = stats.newWaiting - stats.newToday

  async function save(value: number | null) {
    if (value !== null && (!Number.isInteger(value) || value < 0 || value > 500)) {
      setError('填 0～500 之间的整数')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onSave(value)
      setEditing(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-4 text-xs text-hai">
      <p className="flex flex-wrap items-baseline gap-x-4 gap-y-1.5">
        {stats.dueToday > 0 && (
          <span>
            其中旧卡 <span className="tabular-nums text-sumi">{stats.dueReviews}</span>
            ，新词 <span className="tabular-nums text-sumi">{stats.newToday}</span>
          </span>
        )}
        {!editing ? (
          <span>
            每天学{' '}
            <button
              onClick={() => {
                setDraft(limit === null ? '' : String(limit))
                setEditing(true)
              }}
              title="改每天的新词数"
              aria-label={`每天学 ${limit === null ? '不限' : `${limit} 个`}新词，点击修改`}
              className="border-b border-dashed border-hai/60 tabular-nums text-sumi transition hover:border-ai hover:text-ai"
            >
              {limit === null ? '不限' : limit}
            </button>{' '}
            {limit === null ? '' : '个'}新词，今天已学{' '}
            <span className="tabular-nums text-sumi">{stats.learnedToday}</span>
          </span>
        ) : (
          <span className="flex flex-wrap items-baseline gap-2">
            每天学
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value.replace(/\D/g, ''))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') save(draft === '' ? null : Number(draft))
                if (e.key === 'Escape') setEditing(false)
              }}
              inputMode="numeric"
              autoFocus
              placeholder="20"
              aria-label="每天新词数"
              className="w-12 border-b border-ai bg-transparent text-center text-sm tabular-nums text-sumi focus:outline-none"
            />
            个新词
            <button
              onClick={() => save(draft === '' ? null : Number(draft))}
              disabled={saving}
              className="rounded-sm bg-ai px-2.5 py-0.5 text-washi transition hover:opacity-85 disabled:opacity-30"
            >
              保存
            </button>
            <button
              onClick={() => save(null)}
              disabled={saving}
              className="transition hover:text-sumi"
            >
              不限
            </button>
            <button onClick={() => setEditing(false)} className="transition hover:text-sumi">
              取消
            </button>
          </span>
        )}
        {queued > 0 && !editing && <span>还有 {queued} 张新卡在排队</span>}
      </p>
      {editing && (
        <p className="mt-1.5 text-hai/80">设成 0 就只复习旧卡；到期的旧卡不受这个数限制</p>
      )}
      {error && <p className="mt-1.5 text-shu">{error}</p>}
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
