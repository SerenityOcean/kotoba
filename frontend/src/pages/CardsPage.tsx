import { useEffect, useState } from 'react'
import {
  createCard,
  deleteCard,
  fetchCards,
  importCards,
  parseImportText,
  updateCard,
} from '../api'
import type { Card, ImportResult } from '../api'

export default function CardsPage() {
  const [cards, setCards] = useState<Card[]>([])
  const [front, setFront] = useState('')
  const [back, setBack] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const [showImport, setShowImport] = useState(false)
  const [importText, setImportText] = useState('')
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)

  const [editingId, setEditingId] = useState<number | null>(null)
  const [editFront, setEditFront] = useState('')
  const [editBack, setEditBack] = useState('')

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

  function startEdit(card: Card) {
    setEditingId(card.id)
    setEditFront(card.front)
    setEditBack(card.back ?? '')
    setError(null)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditFront('')
    setEditBack('')
  }

  async function saveEdit(id: number) {
    if (editFront.trim() === '') {
      setError('正面不能为空')
      return
    }
    try {
      await updateCard(id, editFront, editBack)
      cancelEdit()
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存失败')
    }
  }

  const parsed = parseImportText(importText)

  async function handleImport() {
    if (parsed.length === 0) return
    setImporting(true)
    setResult(null)
    try {
      const r = await importCards(parsed)
      setResult(r)
      setImportText('')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : '导入失败')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div>
      <section className="mb-8 border-b border-usu pb-8">
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
            className="rounded-sm border border-sumi px-5 py-2.5 text-sm transition hover:bg-sumi hover:text-washi"
          >
            添加
          </button>
        </div>

        <button
          onClick={() => {
            setShowImport(!showImport)
            setResult(null)
          }}
          className="mt-4 text-xs text-hai transition hover:text-sumi"
        >
          {showImport ? '收起批量导入' : '批量导入…'}
        </button>

        {showImport && (
          <div className="mt-4">
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              rows={6}
              placeholder={'勉強\t学习\n図書館\t图书馆\n静か\t安静'}
              className="w-full resize-y border border-usu bg-transparent p-3 font-mono text-sm placeholder:text-hai/40 focus:border-ai focus:outline-none"
            />
            <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
              <button
                onClick={handleImport}
                disabled={parsed.length === 0 || importing}
                className="rounded-sm bg-ai px-5 py-2.5 text-sm text-washi transition hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-30"
              >
                {importing ? '导入中…' : `导入 ${parsed.length} 张`}
              </button>
              <span className="text-xs text-hai">
                一行一张，正面和背面用 Tab 或逗号分隔
              </span>
            </div>
          </div>
        )}

        {result && (
          <p className="mt-3 text-sm">
            导入 <span className="text-ai">{result.imported}</span> 张
            {result.skipped > 0 && (
              <span className="text-hai">
                ，跳过 {result.skipped} 张（已存在）：
                {result.skippedFronts.slice(0, 5).join('、')}
                {result.skippedFronts.length > 5 && ' …'}
              </span>
            )}
          </p>
        )}

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
          {cards.map((card) =>
            editingId === card.id ? (
              <li key={card.id} className="border-b border-usu py-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <input
                    value={editFront}
                    onChange={(e) => setEditFront(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveEdit(card.id)
                      if (e.key === 'Escape') cancelEdit()
                    }}
                    autoFocus
                    className="flex-1 border-b border-ai bg-transparent pb-1 font-mincho text-xl focus:outline-none"
                  />
                  <input
                    value={editBack}
                    onChange={(e) => setEditBack(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveEdit(card.id)
                      if (e.key === 'Escape') cancelEdit()
                    }}
                    className="flex-1 border-b border-ai bg-transparent pb-1 text-base focus:outline-none"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => saveEdit(card.id)}
                      className="rounded-sm bg-ai px-4 py-1.5 text-xs text-washi transition hover:opacity-85"
                    >
                      保存
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="rounded-sm border border-usu px-4 py-1.5 text-xs text-hai transition hover:text-sumi"
                    >
                      取消
                    </button>
                  </div>
                </div>
              </li>
            ) : (
              <li
                key={card.id}
                className="group flex items-baseline gap-3 border-b border-usu py-4"
              >
                <span className="font-mincho text-xl sm:text-2xl">{card.front}</span>
                <span className="min-w-0 flex-1 truncate text-sm text-hai">
                  {card.back}
                </span>
                <span className="text-xs tabular-nums text-hai">
                  {card.repetitions} 次
                </span>
                <button
                  onClick={() => startEdit(card)}
                  className="text-xs text-hai transition hover:text-ai sm:opacity-0 sm:group-hover:opacity-100"
                >
                  编辑
                </button>
                <button
                  onClick={() => handleDelete(card.id)}
                  className="text-xs text-hai transition hover:text-shu sm:opacity-0 sm:group-hover:opacity-100"
                >
                  删除
                </button>
              </li>
            ),
          )}
        </ul>
      )}
    </div>
  )
}