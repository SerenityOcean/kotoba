import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchStats } from '../api'
import type { Stats } from '../api'

export default function HomePage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    fetchStats()
      .then(setStats)
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

      <div className="py-14 text-center">
        {stats.totalCards === 0 ? (
          <>
            <p className="font-mincho text-xl">还没有卡片</p>
            <p className="mt-2 text-sm text-hai">
              先去添加几个你最近遇到的词。
            </p>
            <button
              onClick={() => navigate('/cards')}
              className="mt-8 rounded-sm border border-sumi px-6 py-2.5 text-sm transition hover:bg-sumi hover:text-washi"
            >
              添加卡片
            </button>
          </>
        ) : stats.dueToday === 0 ? (
          <>
            <p className="font-mincho text-2xl">今日已清空</p>
            <p className="mt-2 text-sm text-hai">明天再来。</p>
          </>
        ) : (
          <>
            <p className="font-mincho text-2xl">
              有 <span className="text-ai">{stats.dueToday}</span> 张等着你
            </p>
            <button
              onClick={() => navigate('/review')}
              className="mt-8 rounded-sm bg-ai px-8 py-3 text-sm text-washi transition hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ai"
            >
              开始复习
            </button>
          </>
        )}
      </div>
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