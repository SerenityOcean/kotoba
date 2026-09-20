import { useCallback, useEffect, useMemo, useState } from 'react'
import { analyzeText, fetchDecks, importCards, splitSentences } from './api'
import type { AnalyzedSentence, Deck, ImportResult } from './api'

/** 一次最多切这么多句，免得一口气打出去几十个请求。 */
export const MAX_SENTENCES = 20

/** 同时在飞的请求数。并行是为了快，但也别把限流撞了。 */
const CONCURRENCY = 4

export type Slot =
  | { status: 'pending'; source: string }
  | { status: 'done'; source: string; sentences: AnalyzedSentence[] }
  | { status: 'error'; source: string; message: string }

/**
 * 拆解一段日语、勾选、建卡这一整套状态。
 *
 * 抽成 hook 是因为两个地方都要用：拆解页（自己粘文本）和阅读页
 * （在文章里选中一段就地拆）。UI 长得不一样，这套逻辑是同一份。
 */
export function useAnalysis() {
  const [slots, setSlots] = useState<Slot[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [decks, setDecks] = useState<Deck[]>([])
  // 空串 = 交给后端塞进默认包
  const [deckName, setDeckName] = useState('')

  // 包列表只是给下拉框用的，拿不到就算了 —— 不配包也能建卡
  useEffect(() => {
    fetchDecks()
      .then(setDecks)
      .catch(() => {})
  }, [])

  const analyzing = slots.some((s) => s.status === 'pending')
  const hasResults = slots.some((s) => s.status === 'done')

  /** key → 这一项建成卡片长什么样。勾选存的是 key，交卡时按这张表翻译回去。 */
  const picks = useMemo(() => {
    const map = new Map<string, { front: string; back: string }>()
    slots.forEach((slot, i) => {
      if (slot.status !== 'done') return
      slot.sentences.forEach((s, k) => {
        map.set(`${i}-${k}`, { front: s.original, back: s.translation })
        s.verbs?.forEach((v, j) =>
          map.set(`${i}-${k}v${j}`, {
            front: v.surface,
            back: `${v.dictionaryForm}（${v.reading}）｜${v.form}｜${v.meaning}`,
          }),
        )
        s.grammarPoints?.forEach((g, j) =>
          map.set(`${i}-${k}g${j}`, {
            front: g.pattern,
            back: `${g.meaning}｜${g.explanation}`,
          }),
        )
      })
    })
    return map
  }, [slots])

  const toggle = useCallback((key: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (!next.delete(key)) next.add(key)
      return next
    })
  }, [])

  const reset = useCallback(() => {
    setSlots([])
    setSelected(new Set())
    setResult(null)
    setError(null)
  }, [])

  const run = useCallback(async (text: string) => {
    const parts = splitSentences(text)
    if (parts.length === 0) return
    if (parts.length > MAX_SENTENCES) {
      setError(`一次最多拆 ${MAX_SENTENCES} 句，这段有 ${parts.length} 句，分几次来吧`)
      return
    }

    setError(null)
    setResult(null)
    setSelected(new Set())
    setSlots(parts.map((source) => ({ status: 'pending', source })))

    function settle(index: number, slot: Slot) {
      setSlots((prev) => prev.map((s, i) => (i === index ? slot : s)))
    }

    // 定量的并发池：跑完一个接下一个，不用等整批
    let next = 0
    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, parts.length) }, async () => {
        while (next < parts.length) {
          const index = next++
          const source = parts[index]
          try {
            const analysis = await analyzeText(source)
            settle(index, { status: 'done', source, sentences: analysis.sentences })
            // 词和语法点默认勾上；整句留给用户自己点 —— 大部分句子不值得单独背
            setSelected((prev) => {
              const nextSelected = new Set(prev)
              analysis.sentences.forEach((s, k) => {
                s.verbs?.forEach((_, j) => nextSelected.add(`${index}-${k}v${j}`))
                s.grammarPoints?.forEach((_, j) => nextSelected.add(`${index}-${k}g${j}`))
              })
              return nextSelected
            })
          } catch (e) {
            settle(index, {
              status: 'error',
              source,
              message: e instanceof Error ? e.message : '拆解失败',
            })
          }
        }
      }),
    )
  }, [])

  const save = useCallback(async () => {
    const cards = [...picks.entries()]
      .filter(([key]) => selected.has(key))
      .map(([, card]) => card)
    if (cards.length === 0) return

    setSaving(true)
    setError(null)
    try {
      setResult(await importCards(cards, deckName === '' ? undefined : deckName))
    } catch (e) {
      setError(e instanceof Error ? e.message : '建卡失败')
    } finally {
      setSaving(false)
    }
  }, [picks, selected, deckName])

  return {
    slots,
    analyzing,
    hasResults,
    selected,
    toggle,
    run,
    reset,
    save,
    saving,
    result,
    error,
    setError,
    decks,
    deckName,
    setDeckName,
    selectedCount: selected.size,
  }
}

export type Analysis = ReturnType<typeof useAnalysis>
