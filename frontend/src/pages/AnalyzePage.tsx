import { useEffect, useMemo, useState } from 'react'
import { analyzeText, fetchDecks, importCards } from '../api'
import type { Analysis, Deck, ImportResult } from '../api'

/**
 * 粘一段日语，让模型逐句讲清楚：翻译、动词活用、语法点。
 * 拆解结果不落库 —— 勾中的那些走 /api/cards/import 变成卡片，其余看完就丢。
 */
export default function AnalyzePage() {
  const [text, setText] = useState('')
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
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

  /** key → 这一项建成卡片长什么样。勾选存的是 key，交卡时按这张表翻译回去。 */
  const picks = useMemo(() => {
    const map = new Map<string, { front: string; back: string }>()
    analysis?.sentences.forEach((s, i) => {
      map.set(`s${i}`, { front: s.original, back: s.translation })
      s.verbs.forEach((v, j) =>
        map.set(`s${i}v${j}`, {
          front: v.surface,
          back: `${v.dictionaryForm}（${v.reading}）｜${v.form}｜${v.meaning}`,
        }),
      )
      s.grammarPoints.forEach((g, j) =>
        map.set(`s${i}g${j}`, {
          front: g.pattern,
          back: `${g.meaning}｜${g.explanation}`,
        }),
      )
    })
    return map
  }, [analysis])

  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (!next.delete(key)) next.add(key)
      return next
    })
  }

  async function handleAnalyze() {
    if (text.trim() === '') return
    setAnalyzing(true)
    setError(null)
    setResult(null)
    try {
      const a = await analyzeText(text)
      setAnalysis(a)
      // 词和语法点默认勾上；整句留给用户自己点 —— 大部分句子不值得单独背
      setSelected(
        new Set(
          a.sentences.flatMap((s, i) => [
            ...s.verbs.map((_, j) => `s${i}v${j}`),
            ...s.grammarPoints.map((_, j) => `s${i}g${j}`),
          ]),
        ),
      )
    } catch (e) {
      setAnalysis(null)
      setError(e instanceof Error ? e.message : '拆解失败')
    } finally {
      setAnalyzing(false)
    }
  }

  async function handleSave() {
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
  }

  return (
    <div>
      <section className="mb-8 border-b border-usu pb-8">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={5}
          placeholder="把读到的日语粘在这里，比如：&#10;彼は宿題をやってしまったので、遊びに行かせてもらえた。"
          className="w-full resize-y border border-usu bg-transparent p-3 font-mincho text-base leading-relaxed placeholder:font-ui placeholder:text-sm placeholder:text-hai/40 focus:border-ai focus:outline-none"
        />
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
          <button
            onClick={handleAnalyze}
            disabled={text.trim() === '' || analyzing}
            className="rounded-sm bg-ai px-5 py-2.5 text-sm text-washi transition hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-30"
          >
            {analyzing ? '拆解中…' : '拆解'}
          </button>
          <span className="text-xs text-hai">
            逐句给出翻译、动词用法和语法点。一次最多 1500 字
          </span>
        </div>
        {error && <p className="mt-3 text-sm text-shu">{error}</p>}
      </section>

      {analyzing && (
        <p className="py-10 text-center text-sm text-hai">
          模型正在读这段话，通常要十几秒…
        </p>
      )}

      {!analyzing && analysis && analysis.sentences.length === 0 && (
        <p className="py-10 text-center text-sm text-hai">这段话没拆出什么东西。</p>
      )}

      {!analyzing &&
        analysis?.sentences.map((s, i) => (
          <section key={i} className="mb-10">
            <Row checked={selected.has(`s${i}`)} onToggle={() => toggle(`s${i}`)}>
              <p className="font-mincho text-xl leading-relaxed sm:text-2xl">
                {s.original}
              </p>
              <p className="mt-1.5 text-sm text-hai">{s.translation}</p>
            </Row>

            {s.verbs.length > 0 && (
              <>
                <Heading>动词</Heading>
                {s.verbs.map((v, j) => (
                  <Row
                    key={j}
                    checked={selected.has(`s${i}v${j}`)}
                    onToggle={() => toggle(`s${i}v${j}`)}
                  >
                    <p className="flex flex-wrap items-baseline gap-x-2">
                      <span className="font-mincho text-lg">{v.surface}</span>
                      <span className="text-xs text-hai">←</span>
                      <span className="font-mincho text-base text-hai">
                        {v.dictionaryForm}
                      </span>
                      <span className="text-xs text-hai">{v.reading}</span>
                      <span className="rounded-sm bg-usu px-1.5 py-0.5 text-xs text-sumi">
                        {v.form}
                      </span>
                      <span className="text-xs text-hai">{v.meaning}</span>
                    </p>
                    <p className="mt-1.5 text-sm leading-relaxed">{v.explanation}</p>
                  </Row>
                ))}
              </>
            )}

            {s.grammarPoints.length > 0 && (
              <>
                <Heading>语法</Heading>
                {s.grammarPoints.map((g, j) => (
                  <Row
                    key={j}
                    checked={selected.has(`s${i}g${j}`)}
                    onToggle={() => toggle(`s${i}g${j}`)}
                  >
                    <p className="flex flex-wrap items-baseline gap-x-2">
                      <span className="font-mincho text-lg">{g.pattern}</span>
                      <span className="text-xs text-hai">{g.meaning}</span>
                    </p>
                    <p className="mt-1.5 text-sm leading-relaxed">{g.explanation}</p>
                    {g.example && (
                      <p className="mt-1.5 border-l-2 border-usu pl-3 text-sm text-hai">
                        {g.example}
                      </p>
                    )}
                  </Row>
                ))}
              </>
            )}
          </section>
        ))}

      {!analyzing && analysis && analysis.sentences.length > 0 && (
        <div className="sticky bottom-0 -mx-4 border-t border-usu bg-washi px-4 py-4 sm:-mx-6 sm:px-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
            <button
              onClick={handleSave}
              disabled={selected.size === 0 || saving}
              className="rounded-sm border border-sumi px-5 py-2.5 text-sm transition hover:bg-sumi hover:text-washi disabled:cursor-not-allowed disabled:opacity-30"
            >
              {saving ? '建卡中…' : `加入卡片（${selected.size}）`}
            </button>

            <label className="flex items-baseline gap-2 text-xs text-hai">
              存到
              <select
                value={deckName}
                onChange={(e) => setDeckName(e.target.value)}
                className="border-b border-usu bg-transparent pb-0.5 text-sm text-sumi focus:border-ai focus:outline-none"
              >
                <option value="">默认包</option>
                {decks.map((d) => (
                  <option key={d.id} value={d.name}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>

            {result && (
              <span className="text-sm">
                建了 <span className="text-ai">{result.imported}</span> 张到「
                {result.deckName}」
                {result.skipped > 0 && (
                  <span className="text-hai">，跳过 {result.skipped} 张（已存在）</span>
                )}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/** 一条可勾选的内容。勾选框靠上对齐，免得多行文字把它推到中间。 */
function Row({
  checked,
  onToggle,
  children,
}: {
  checked: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 border-b border-usu py-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        className="mt-1.5 h-3.5 w-3.5 shrink-0 accent-ai"
      />
      <span className="min-w-0 flex-1">{children}</span>
    </label>
  )
}

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mt-5 mb-1 text-xs tracking-widest text-hai">{children}</h2>
  )
}
