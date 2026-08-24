import { useCallback, useEffect, useState } from 'react'
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

  const handleRate = useCallback(
    async (rating: Rating) => {
      if (!current) return
      try {
        await reviewCard(current.id, rating)
        setRevealed(false)
        setIndex((i) => i + 1)
      } catch (e) {
        setError(e instanceof Error ? e.message : '提交失败')
      }
    },
    [current],
  )

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!current) return

      if (!revealed) {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault()
          setRevealed(true)
        }
        return
      }

      if (e.key === '1') handleRate('AGAIN')
      if (e.key === '2') handleRate('HARD')
      if (e.key === '3' || e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        handleRate('GOOD')
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [current, revealed, handleRate])

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

      <div className="py-12 text-center sm:py-16">
        <div className="font-mincho text-5xl leading-tight sm:text-6xl">
          {current.front}
        </div>

        {revealed && (
          <>
            <div className="mx-auto my-8 h-px w-16 bg-usu" />
            <div className="text-xl text-hai sm:text-2xl">
              {current.back || '（无背面）'}
            </div>
          </>
        )}
      </div>

      {!revealed ? (
        <div className="text-center">
          <button
            onClick={() => setRevealed(true)}
            className="w-full rounded-sm bg-ai px-8 py-3.5 text-sm text-washi transition hover:opacity-85 sm:w-auto"
          >
            显示答案
          </button>
          <p className="mt-4 hidden text-xs text-hai sm:block">空格 / 回车</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <RateButton onClick={() => handleRate('AGAIN')} color="shu" hint="1">
              忘了
            </RateButton>
            <RateButton onClick={() => handleRate('HARD')} color="hai" hint="2">
              一般
            </RateButton>
            <RateButton onClick={() => handleRate('GOOD')} color="ai" hint="3">
              记住了
            </RateButton>
          </div>
          <p className="mt-4 hidden text-center text-xs text-hai sm:block">
            按数字键选择，空格 / 回车 = 记住了
          </p>
        </>
      )}
    </div>
  )
}

function RateButton({
  onClick,
  color,
  hint,
  children,
}: {
  onClick: () => void
  color: 'shu' | 'hai' | 'ai'
  hint: string
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
      className={`group rounded-sm border py-3.5 text-sm transition hover:text-washi ${styles}`}
    >
      {children}
      <span className="ml-1.5 hidden text-xs opacity-50 sm:inline">{hint}</span>
    </button>
  )
}