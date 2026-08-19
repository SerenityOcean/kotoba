import { useEffect, useState } from 'react'
import { createCard, deleteCard, fetchCards } from './api'
import type { Card } from './api'

export default function App() {
  const [cards, setCards] = useState<Card[]>([])
  const [front, setFront] = useState('')
  const [back, setBack] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  async function load() {
    try {
      const data = await fetchCards()
      setCards(data)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function handleCreate() {
    if (front.trim() === '') {
      setError('正面不能为空')
      return
    }
    try {
      await createCard(front, back)
      setFront('')
      setBack('')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : '创建失败')
    }
  }

  async function handleDelete(id: number) {
    try {
      await deleteCard(id)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : '删除失败')
    }
  }

  return (
    <div style={{ padding: 40, fontFamily: 'system-ui', maxWidth: 700 }}>
      <h1>kotoba</h1>

      <div style={{ marginBottom: 24 }}>
        <input
          value={front}
          onChange={(e) => setFront(e.target.value)}
          placeholder="正面（日语）"
          style={{ marginRight: 8, padding: 6 }}
        />
        <input
          value={back}
          onChange={(e) => setBack(e.target.value)}
          placeholder="背面（中文）"
          style={{ marginRight: 8, padding: 6 }}
        />
        <button onClick={handleCreate} style={{ padding: '6px 12px' }}>
          添加
        </button>
      </div>

      {error && <p style={{ color: 'crimson' }}>{error}</p>}

      {loading ? (
        <p>加载中…</p>
      ) : cards.length === 0 ? (
        <p style={{ color: '#888' }}>还没有卡片</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {cards.map((card) => (
            <li
              key={card.id}
              style={{
                borderBottom: '1px solid #eee',
                padding: '10px 0',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <span style={{ fontSize: 18 }}>{card.front}</span>
              <span style={{ color: '#888' }}>{card.back}</span>
              <span style={{ marginLeft: 'auto', fontSize: 12, color: '#aaa' }}>
                复习 {card.repetitions} 次
              </span>
              <button onClick={() => handleDelete(card.id)}>删除</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}