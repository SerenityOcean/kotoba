import { useEffect, useState } from 'react'
import { fetchDueCards, reviewCard } from './api'
import type { Card, Rating } from './api'

interface Props {
  onFinish: () => void
}

export default function ReviewPanel({ onFinish }: Props) {
  const [queue, setQueue] = useState<Card[]>([])
  const [index, setIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchDueCards()
      .then((cards) => setQueue(cards))
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

  if (loading) return <p>加载中…</p>
  if (error) return <p style={{ color: 'crimson' }}>{error}</p>

  if (!current) {
    return (
      <div style={{ textAlign: 'center', padding: 40 }}>
        <p style={{ fontSize: 20 }}>
          {queue.length === 0 ? '今日已清空 🎉' : `复习完成，共 ${queue.length} 张`}
        </p>
        <button onClick={onFinish} style={{ padding: '8px 16px' }}>
          返回
        </button>
      </div>
    )
  }

  return (
    <div style={{ textAlign: 'center', padding: 20 }}>
      <p style={{ color: '#888', fontSize: 14 }}>
        {index + 1} / {queue.length}
      </p>

      <div
        style={{
          border: '1px solid #ddd',
          borderRadius: 8,
          padding: 40,
          margin: '20px 0',
          minHeight: 120,
        }}
      >
        <div style={{ fontSize: 32 }}>{current.front}</div>
        {revealed && (
          <div style={{ fontSize: 20, color: '#666', marginTop: 20 }}>
            {current.back || '（无背面）'}
          </div>
        )}
      </div>

      {!revealed ? (
        <button onClick={() => setRevealed(true)} style={{ padding: '10px 24px' }}>
          显示答案
        </button>
      ) : (
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button onClick={() => handleRate('AGAIN')} style={{ padding: '10px 20px' }}>
            忘了
          </button>
          <button onClick={() => handleRate('HARD')} style={{ padding: '10px 20px' }}>
            一般
          </button>
          <button onClick={() => handleRate('GOOD')} style={{ padding: '10px 20px' }}>
            记住了
          </button>
        </div>
      )}

      <div style={{ marginTop: 24 }}>
        <button onClick={onFinish} style={{ fontSize: 13, color: '#888' }}>
          退出复习
        </button>
      </div>
    </div>
  )
}