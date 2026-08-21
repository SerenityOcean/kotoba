import { useEffect, useState } from 'react'
import { createCard, deleteCard, fetchCards } from '../api'
import type { Card } from '../api'

export default function CardsPage() {
  const [cards, setCards] = useState<Card[]>([])
  const [front, setFront] = useState('')
  const [back, setBack] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  async function load() {
    try {
      setCards(await fetchCards())
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
    <div>
      <section className="mb-10 border-b border-usu pb-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <label className="flex-1">
            <span className="mb-1 block text-xs tracking-wider text-hai">正面</span>
            <input
              value={front}
              onChange={(e) => setFront(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              placeholder="勉強"
              className="w-full border-b border-usu bg-transparent pb-1.5 font-mincho text-xl placeholder:text-hai/40 focus:border-ai focus:outline-none"
            />
          </label>

          <label className="flex-1">
            <span className="mb-1 block text-xs tracking-wider text-hai">背面</span>
            <input
              value={back}
              onChange={(e) => setBack(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              placeholder="学习"
              className="w-full border-b border-usu bg-transparent pb-1.5 text-lg placeholder:text-hai/40 focus:border-ai focus:outline-none"
            />
          </label>

          <button
            onClick={handleCreate}
            className="rounded-sm border border-sumi px-5 py-2 text-sm transition hover:bg-sumi hover:text-washi"
          >
            添加
          </button>
        </div>

        {error && <p className="mt-3 text-sm text-shu">{error}</p>}
      </section>

      {loading ? (
        <p className="text-sm text-hai">加载中…</p>
      ) : cards.length === 0 ? (
        <p className="py-10 text-center text-sm text-hai">
          还没有卡片。在上面加一个你今天遇到的词。
        </p>
      ) : (
        <ul>
          {cards.map((card) => (
            <li
              key={card.id}
              className="group flex items-baseline gap-4 border-b border-usu py-4"
            >
              <span className="font-mincho text-2xl">{card.front}</span>
              <span className="text-sm text-hai">{card.back}</span>
              <span className="text-xs tabular-nums text-hai">
                {card.repetitions} 次
              </span>
              <button
                onClick={() => handleDelete(card.id)}
                className="ml-auto text-xs text-hai opacity-0 transition hover:text-shu focus-visible:opacity-100 group-hover:opacity-100"
              >
                删除
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}