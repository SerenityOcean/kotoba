import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  createCard,
  deleteCard,
  fetchCards,
  fillReadings,
  fetchDecks,
  importCards,
  parseImportText,
  updateCard,
} from '../api'
import type { Card, Deck, ImportResult } from '../api'
import AnkiImport from '../components/AnkiImport'
import { romajiToKana } from '../kana'
import Furigana from '../components/Furigana'
import DeckBar from '../components/DeckBar'
import Pagination from '../components/Pagination'

/**
 * 一页多少张。卡片一行很矮，给多一点，一屏翻得快。
 *
 * 分页只在前端切：卡片很短，几百上千张一次拉下来也不重；而搜索要剥掉
 * 注音、正反面一起比，留在前端做最简单，结果也和以前一模一样。
 */
const PAGE_SIZE = 50

export default function CardsPage() {
  const [cards, setCards] = useState<Card[]>([])
  const [decks, setDecks] = useState<Deck[]>([])
  // null = 看全部包
  const [deckId, setDeckId] = useState<number | null>(null)
  const [front, setFront] = useState('')
  const [back, setBack] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const [showImport, setShowImport] = useState(false)
  const [showAnki, setShowAnki] = useState(false)
  const [importText, setImportText] = useState('')
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)

  const [query, setQuery] = useState('')
  // 从 1 数。换包、改搜索词都回到第一页
  const [page, setPage] = useState(1)
  // 换页后滚回列表开头（搜索框那一行），不是回到页面最顶上的添加表单
  const listTop = useRef<HTMLDivElement>(null)
  // 正在等待二次确认的那张卡。一次只允许一张，点了别张就把上一张收回去
  const [confirmingId, setConfirmingId] = useState<number | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editFront, setEditFront] = useState('')
  const [editBack, setEditBack] = useState('')
  const [editReading, setEditReading] = useState('')
  // 补读音：进行中时是已补张数，补完后换成一句结果
  const [filling, setFilling] = useState<number | null>(null)
  const [fillNote, setFillNote] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [nextDecks, nextCards] = await Promise.all([
        fetchDecks(),
        fetchCards(deckId ?? undefined),
      ])
      setDecks(nextDecks)
      setCards(nextCards)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [deckId])

  useEffect(() => {
    load()
  }, [load])

  const selectedDeck = decks.find((d) => d.id === deckId) ?? null
  const deckNames = new Map(decks.map((d) => [d.id, d.name]))

  async function handleCreate() {
    if (front.trim() === '') {
      setError('正面不能为空')
      return
    }
    try {
      await createCard(front, back, deckId ?? undefined)
      setFront('')
      setBack('')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : '创建失败')
    }
  }

  /**
   * 给还没读音的卡补读音。后端一次只做一批（规则先猜，剩下的问一次模型），
   * 这边接着往后翻，直到翻完 —— 几百张卡一个请求做完要等一两分钟，会超时。
   */
  async function handleFillReadings() {
    setFilling(0)
    setFillNote(null)
    let filled = 0
    let missed = 0
    let modelError: string | null = null
    try {
      let afterId: number | undefined
      do {
        const batch = await fillReadings(afterId)
        filled += batch.byRule + batch.byModel
        missed += batch.missed
        modelError = batch.modelError ?? modelError
        setFilling(filled)
        afterId = batch.nextAfterId ?? undefined
      } while (afterId !== undefined)

      setFillNote(
        `补上了 ${filled} 张` +
          (missed > 0 ? `，${missed} 张没补上，可以点「编辑」手动填` : '') +
          (modelError ? `（模型出错：${modelError}）` : ''),
      )
      await load()
    } catch (e) {
      setFillNote(e instanceof Error ? `补读音失败：${e.message}` : '补读音失败')
    } finally {
      setFilling(null)
    }
  }

  async function handleDelete(id: number) {
    try {
      setConfirmingId(null)
      await deleteCard(id)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : '删除失败')
    }
  }

  function startEdit(card: Card) {
    setConfirmingId(null)
    setEditingId(card.id)
    setEditFront(card.front)
    setEditBack(card.back ?? '')
    setEditReading(card.reading ?? '')
    setError(null)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditFront('')
    setEditBack('')
    setEditReading('')
  }

  async function saveEdit(id: number) {
    if (editFront.trim() === '') {
      setError('正面不能为空')
      return
    }
    try {
      await updateCard(id, editFront, editBack, editReading)
      cancelEdit()
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存失败')
    }
  }

  const visible = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    if (keyword === '') return cards
    // 剥掉注音再比：库里存的是「勉強[べんきょう]」，而你搜的是「勉強」
    const bare = (text: string | null) =>
      (text ?? '').replace(/\[[^[\]]+\]/g, '').toLowerCase()
    return cards.filter(
      (c) => bare(c.front).includes(keyword) || bare(c.back).includes(keyword),
    )
  }, [cards, query])

  // 删掉最后一页的最后一张之后，页码可能超出 —— 按现有的页数夹一下
  const totalPages = Math.ceil(visible.length / PAGE_SIZE)
  const currentPage = Math.min(page, Math.max(totalPages, 1))
  const shown = visible.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  function selectDeck(id: number | null) {
    setDeckId(id)
    setPage(1)
  }

  const missingReadings = cards.filter((c) => c.readingMissing).length

  const parsed = parseImportText(importText)

  async function handleImport() {
    if (parsed.length === 0) return
    setImporting(true)
    setResult(null)
    try {
      const r = await importCards(parsed, selectedDeck?.name)
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
      <DeckBar
        decks={decks}
        deckId={deckId}
        onSelect={selectDeck}
        onChanged={load}
        onError={setError}
      />

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

        <div className="mt-4 flex gap-4">
          <button
            onClick={() => {
              setShowImport(!showImport)
              setShowAnki(false)
              setResult(null)
            }}
            className="text-xs text-hai transition hover:text-sumi"
          >
            {showImport ? '收起批量导入' : '批量导入…'}
          </button>
          <button
            onClick={() => {
              setShowAnki(!showAnki)
              setShowImport(false)
              setResult(null)
            }}
            className="text-xs text-hai transition hover:text-sumi"
          >
            {showAnki ? '收起 Anki 导入' : '从 Anki 导入…'}
          </button>
        </div>

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

        {showAnki && (
          <AnkiImport
            onImported={(result) => {
              // 导完直接切到那个包，省得还要自己找
              selectDeck(result.deckId)
              load()
            }}
          />
        )}

        {result && (
          <p className="mt-3 text-sm">
            导入 <span className="text-ai">{result.imported}</span> 张到「{result.deckName}」
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

      {(missingReadings > 0 || filling !== null || fillNote) && (
        <p className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs text-hai">
          {filling !== null ? (
            <span>补读音中… 已补 {filling} 张</span>
          ) : (
            <>
              {fillNote && <span className="text-sumi">{fillNote}</span>}
              {missingReadings > 0 && (
                <>
                  <span>
                    {missingReadings} 张卡还没有读音，打字复习时会改成翻卡
                  </span>
                  <button
                    onClick={handleFillReadings}
                    className="text-ai transition hover:underline"
                  >
                    补读音
                  </button>
                </>
              )}
            </>
          )}
        </p>
      )}

      {cards.length > 0 && (
        <div ref={listTop} className="flex scroll-mt-4 items-baseline gap-4 border-b border-usu pb-2">
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setPage(1)
            }}
            placeholder="搜索正面或背面"
            className="min-w-0 flex-1 bg-transparent text-sm placeholder:text-hai/40 focus:outline-none"
          />
          <span className="shrink-0 text-xs tabular-nums text-hai">
            {query.trim() === ''
              ? `${cards.length} 张`
              : `${visible.length} / ${cards.length} 张`}
          </span>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-hai">加载中…</p>
      ) : cards.length === 0 ? (
        <p className="py-10 text-center text-sm text-hai">
          {selectedDeck
            ? `「${selectedDeck.name}」还是空的。`
            : '还没有卡片。在上面加一个你今天遇到的词。'}
        </p>
      ) : visible.length === 0 ? (
        <p className="py-10 text-center text-sm text-hai">
          没有包含「{query.trim()}」的卡片。
        </p>
      ) : (
        <ul>
          {shown.map((card) =>
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
                  {/* 读音：罗马字自动转假名，几个读音用 / 隔开；留空让后端重新猜 */}
                  <input
                    value={editReading}
                    onChange={(e) =>
                      setEditReading(
                        (e.nativeEvent as InputEvent).isComposing
                          ? e.target.value
                          : romajiToKana(e.target.value),
                      )
                    }
                    onKeyDown={(e) => {
                      if (e.nativeEvent.isComposing || e.keyCode === 229) return
                      if (e.key === 'Enter') saveEdit(card.id)
                      if (e.key === 'Escape') cancelEdit()
                    }}
                    placeholder="读音"
                    lang="ja"
                    autoComplete="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    className="border-b border-ai bg-transparent pb-1 font-mincho text-base placeholder:font-ui placeholder:text-xs placeholder:text-hai/40 focus:outline-none sm:w-32"
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
                <span className="font-mincho text-xl sm:text-2xl">
                  <Furigana text={card.front} />
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-hai">
                  {card.back && <Furigana text={card.back} />}
                </span>
                {deckId === null && (
                  <span className="hidden shrink-0 text-xs text-hai/70 sm:inline">
                    {deckNames.get(card.deckId)}
                  </span>
                )}
                <span className="text-xs tabular-nums text-hai">
                  {card.repetitions} 次
                </span>
                {confirmingId === card.id ? (
                  <>
                    {/* 行内确认，不弹窗 —— 和删包那套一致。只用两个控件，
                        宽度贴近原来的「编辑 删除」，这一行的其余内容不会被推动 */}
                    <button
                      onClick={() => handleDelete(card.id)}
                      className="shrink-0 text-xs text-shu transition hover:underline"
                    >
                      确认删除
                    </button>
                    <button
                      onClick={() => setConfirmingId(null)}
                      className="shrink-0 text-xs text-hai transition hover:text-sumi"
                    >
                      取消
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => startEdit(card)}
                      className="text-xs text-hai transition hover:text-ai sm:opacity-0 sm:group-hover:opacity-100"
                    >
                      编辑
                    </button>
                    <button
                      onClick={() => setConfirmingId(card.id)}
                      className="text-xs text-hai transition hover:text-shu sm:opacity-0 sm:group-hover:opacity-100"
                    >
                      删除
                    </button>
                  </>
                )}
              </li>
            ),
          )}
        </ul>
      )}

      <Pagination
        page={currentPage}
        totalPages={totalPages}
        onSelect={(n) => {
          setPage(n)
          setConfirmingId(null)
          cancelEdit()
          listTop.current?.scrollIntoView()
        }}
      />
    </div>
  )
}