import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchDueCards, reviewCard } from '../api'
import type { Card, Rating } from '../api'

export default function ReviewPage() {
  const [queue, setQueue] = useState<Card[]>([])
  const [index, setIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    fetchDueCards()
      .then(setQueue)
      .catch((e) => setError(e instanceof Error ? e.message : '加载失败'))
      .finally(() => setLoading(false))
  }, [])

  const current = queue[index]

  async function handleRate(rating: Rating) {
    if (!current) return
    try {
      await reviewCard(current.id, rating)
      setRevealed(false)
      setIndex(index + 1)
    } catch (e) {
      setError(e instanceof Error ? e.message : '提交失败')
    }
  }

  if (loading) return <p className="text-sm text-hai">加载中…</p>
  if (error) return <p className="text-sm text-shu">{error}</p>

  if (!current) {
    return (
      <div className="py-24 text-center">
        <p className="font-mincho text-2xl">
          {queue.length === 0 ? '今日已清空' : `复习完了 ${queue.length} 张`}
        </p>
        <button
          onClick={() => navigate('/')}
          className="mt-8 rounded-sm border border-sumi px-6 py-2.5 text-sm transition hover:bg-sumi hover:text-washi"
        >
          返回首页
        </button>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-8 flex items-center gap-3">
        <span className="text-xs tabular-nums text-hai">
          {index + 1} / {queue.length}
        </span>
        <div className="h-px flex-1 bg-usu">
          <div
            className="h-px bg-ai transition-all duration-300"
            style={{ width: `${(index / queue.length) * 100}%` }}
          />
        </div>
        <button
          onClick={() => navigate('/')}
          className="text-xs text-hai transition hover:text-sumi"
        >
          退出
        </button>
      </div>

      <div className="py-16 text-center">
        <div className="font-mincho text-6xl leading-tight">{current.front}</div>

        {revealed && (
          <>
            <div className="mx-auto my-8 h-px w-16 bg-usu" />
            <div className="text-2xl text-hai">{current.back || '（无背面）'}</div>
          </>
        )}
      </div>

      {!revealed ? (
        <div className="text-center">
          <button
            onClick={() => setRevealed(true)}
            className="rounded-sm bg-ai px-8 py-3 text-sm text-washi transition hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ai"
          >
            显示答案
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          <RateButton onClick={() => handleRate('AGAIN')} color="shu">
            忘了
          </RateButton>
          <RateButton onClick={() => handleRate('HARD')} color="hai">
            一般
          </RateButton>
          <RateButton onClick={() => handleRate('GOOD')} color="ai">
            记住了
          </RateButton>
        </div>
      )}
    </div>
  )
}

function RateButton({
  onClick,
  color,
  children,
}: {
  onClick: () => void
  color: 'shu' | 'hai' | 'ai'
  children: React.ReactNode
}) {
  const styles = {
    shu: 'border-shu text-shu hover:bg-shu',
    hai: 'border-hai text-hai hover:bg-hai',
    ai: 'border-ai text-ai hover:bg-ai',
  }[color]

  return (
    <button
      onClick={onClick}
      className={`rounded-sm border py-3 text-sm transition hover:text-washi ${styles}`}
    >
      {children}
    </button>
  )
}