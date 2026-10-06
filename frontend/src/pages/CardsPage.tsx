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
import { stripFurigana } from '../reading'

/**
 * 一页多少张。卡片一行很矮，给多一点，一屏翻得快。
 *
 * 分页只在前端切：卡片很短，几百上千张一次拉下来也不重；而搜索要剥掉
 * 注音、正反面一起比，留在前端做最简单，结果也和以前一模一样。
 */
const PAGE_SIZE = 50

/** 工具条下面展开的那块：新建一张、粘贴导入、Anki 导入，一次只开一个。 */
type Panel = 'new' | 'paste' | 'anki' | null

/**
 * 卡片页。列表每行只放认得出这张卡的东西：正面、读音、背面的第一段、
 * 什么时候该复习。其余的（完整背面、复习记录、编辑删除）点开这一行再看 ——
 * 几百张卡排在一起，每行都摊开就是一面墙。
 */
export default function CardsPage() {
  const [cards, setCards] = useState<Card[]>([])
  const [decks, setDecks] = useState<Deck[]>([])
  // null = 看全部包
  const [deckId, setDeckId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const [panel, setPanel] = useState<Panel>(null)
  const [front, setFront] = useState('')
  const [back, setBack] = useState('')
  const [importText, setImportText] = useState('')
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)

  const [query, setQuery] = useState('')
  // 从 1 数。换包、改搜索词都回到第一页
  const [page, setPage] = useState(1)
  // 换页后滚回列表开头（工具条那一行），不是回到页面最顶上
  const listTop = useRef<HTMLDivElement>(null)

  // 点开看详情的那张；编辑、确认删除都只发生在点开的那张上
  const [openId, setOpenId] = useState<number | null>(null)
  const [editing, setEditing] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
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

  function togglePanel(next: Panel) {
    setPanel(panel === next ? null : next)
    setResult(null)
    setError(null)
  }

  async function handleCreate() {
    if (front.trim() === '') {
      setError('正面不能为空')
      return
    }
    try {
      await createCard(front, back, deckId ?? undefined)
      setFront('')
      setBack('')
      setError(null)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : '创建失败')
    }
  }

  const parsed = parseImportText(importText)

  async function handleImport() {
    if (parsed.length === 0) return
    setImporting(true)
    setResult(null)
    try {
      setResult(await importCards(parsed, selectedDeck?.name))
      setImportText('')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : '导入失败')
    } finally {
      setImporting(false)
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
          (missed > 0 ? `，${missed} 张没补上，点开那张卡「编辑」手动填` : '') +
          (modelError ? `（模型出错：${modelError}）` : ''),
      )
      await load()
    } catch (e) {
      setFillNote(e instanceof Error ? `补读音失败：${e.message}` : '补读音失败')
    } finally {
      setFilling(null)
    }
  }

  /** 点开 / 收起一张。换一张时把编辑、确认删除都收回去。 */
  function toggleOpen(id: number) {
    setOpenId(openId === id ? null : id)
    setEditing(false)
    setConfirmingDelete(false)
  }

  function startEdit(card: Card) {
    setEditing(true)
    setConfirmingDelete(false)
    setEditFront(card.front)
    setEditBack(card.back ?? '')
    setEditReading(card.reading ?? '')
    setError(null)
  }

  async function saveEdit(id: number) {
    if (editFront.trim() === '') {
      setError('正面不能为空')
      return
    }
    try {
      await updateCard(id, editFront, editBack, editReading)
      setEditing(false)
      setError(null)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存失败')
    }
  }

  async function handleDelete(id: number) {
    try {
      await deleteCard(id)
      setOpenId(null)
      setConfirmingDelete(false)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : '删除失败')
    }
  }

  const visible = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    if (keyword === '') return cards
    // 剥掉注音再比：库里存的是「勉強[べんきょう]」，而你搜的是「勉強」
    const bare = (text: string | null) => stripFurigana(text ?? '').toLowerCase()
    return cards.filter(
      (c) =>
        bare(c.front).includes(keyword) ||
        bare(c.back).includes(keyword) ||
        (c.reading ?? '').includes(keyword),
    )
  }, [cards, query])

  // 删掉最后一页的最后一张之后，页码可能超出 —— 按现有的页数夹一下
  const totalPages = Math.ceil(visible.length / PAGE_SIZE)
  const currentPage = Math.min(page, Math.max(totalPages, 1))
  const shown = visible.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  function selectDeck(id: number | null) {
    setDeckId(id)
    setPage(1)
    setOpenId(null)
  }

  const missingReadings = cards.filter((c) => c.readingMissing).length
  const now = Date.now()

  return (
    <div>
      <DeckBar
        decks={decks}
        deckId={deckId}
        onSelect={selectDeck}
        onChanged={load}
        onError={setError}
      />

      {/* 工具条：搜索在左，新建和导入在右 */}
      <div
        ref={listTop}
        className="flex scroll-mt-4 flex-wrap items-center gap-x-5 gap-y-3 border-b border-usu pb-3"
      >
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setPage(1)
          }}
          placeholder="搜索正面、背面或读音"
          className="min-w-0 flex-1 basis-48 bg-transparent text-sm placeholder:text-hai/40 focus:outline-none"
        />
        <span className="shrink-0 text-xs tabular-nums text-hai">
          {query.trim() === '' ? `${cards.length} 张` : `${visible.length} / ${cards.length} 张`}
        </span>
        <span className="ml-auto flex shrink-0 items-center gap-4 text-sm">
          <button
            onClick={() => togglePanel('paste')}
            className={`transition hover:text-sumi ${panel === 'paste' || panel === 'anki' ? 'text-sumi' : 'text-hai'}`}
          >
            导入
          </button>
          <button
            onClick={() => togglePanel('new')}
            className={`rounded-sm border px-3 py-1 transition ${
              panel === 'new'
                ? 'border-sumi bg-sumi text-washi'
                : 'border-sumi hover:bg-sumi hover:text-washi'
            }`}
          >
            ＋ 新卡片
          </button>
        </span>
      </div>

      {panel === 'new' && (
        <section className="border-b border-usu py-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <label className="flex-1">
              <span className="mb-1 block text-xs tracking-wider text-hai">正面</span>
              <input
                value={front}
                onChange={(e) => setFront(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                placeholder="勉強"
                autoFocus
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
              className="rounded-sm bg-ai px-5 py-2.5 text-sm text-washi transition hover:opacity-85"
            >
              添加
            </button>
          </div>
          <p className="mt-3 text-xs text-hai">
            存进「{selectedDeck?.name ?? '默认包'}」。正面写 勉強[べんきょう] 就带注音，读音会自动填上
          </p>
        </section>
      )}

      {(panel === 'paste' || panel === 'anki') && (
        <section className="border-b border-usu py-5">
          <div className="mb-4 flex gap-5 text-sm">
            <PanelTab active={panel === 'paste'} onClick={() => setPanel('paste')}>
              粘贴文本
            </PanelTab>
            <PanelTab active={panel === 'anki'} onClick={() => setPanel('anki')}>
              Anki 牌组
            </PanelTab>
          </div>

          {panel === 'paste' ? (
            <>
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
                  一行一张，正面和背面用 Tab 或逗号分隔，存进「{selectedDeck?.name ?? '默认包'}」
                </span>
              </div>
            </>
          ) : (
            <AnkiImport
              onImported={(imported) => {
                // 导完直接切到那个包，省得还要自己找
                selectDeck(imported.deckId)
                setPanel(null)
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
        </section>
      )}

      {error && <p className="mt-3 text-sm text-shu">{error}</p>}

      {(missingReadings > 0 || filling !== null || fillNote) && (
        <p className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs text-hai">
          {filling !== null ? (
            <span>补读音中… 已补 {filling} 张</span>
          ) : (
            <>
              {fillNote && <span className="text-sumi">{fillNote}</span>}
              {missingReadings > 0 && (
                <>
                  <span>{missingReadings} 张卡还没有读音，打字复习时会改成翻卡</span>
                  <button onClick={handleFillReadings} className="text-ai transition hover:underline">
                    补读音
                  </button>
                </>
              )}
            </>
          )}
        </p>
      )}

      {loading ? (
        <p className="mt-6 text-sm text-hai">加载中…</p>
      ) : cards.length === 0 ? (
        <p className="py-16 text-center text-sm text-hai">
          {selectedDeck
            ? `「${selectedDeck.name}」还是空的。`
            : '还没有卡片。读文章时选中一段拆解，勾一勾就能建卡；也可以点「＋ 新卡片」。'}
        </p>
      ) : visible.length === 0 ? (
        <p className="py-16 text-center text-sm text-hai">没有包含「{query.trim()}」的卡片。</p>
      ) : (
        <ul className="mt-1">
          {shown.map((card) => (
            <li key={card.id} className="border-b border-usu">
              <CardRow
                card={card}
                deckName={deckId === null ? deckNames.get(card.deckId) : undefined}
                open={openId === card.id}
                now={now}
                onToggle={() => toggleOpen(card.id)}
              />

              {openId === card.id &&
                (editing ? (
                  <EditForm
                    front={editFront}
                    back={editBack}
                    reading={editReading}
                    onFront={setEditFront}
                    onBack={setEditBack}
                    onReading={setEditReading}
                    onSave={() => saveEdit(card.id)}
                    onCancel={() => setEditing(false)}
                  />
                ) : (
                  <CardDetail
                    card={card}
                    deckName={deckNames.get(card.deckId)}
                    confirmingDelete={confirmingDelete}
                    onEdit={() => startEdit(card)}
                    onAskDelete={() => setConfirmingDelete(true)}
                    onDelete={() => handleDelete(card.id)}
                    onCancelDelete={() => setConfirmingDelete(false)}
                  />
                ))}
            </li>
          ))}
        </ul>
      )}

      <Pagination
        page={currentPage}
        totalPages={totalPages}
        onSelect={(n) => {
          setPage(n)
          setOpenId(null)
          listTop.current?.scrollIntoView()
        }}
      />
    </div>
  )
}

/**
 * 背面常是「意思｜用法｜例句」一长串，列表里只露第一段。
 * Anki 词汇包的背面开头就是读音（「のぞく 他動詞 除去」），读音已经写在正面旁边了，
 * 这里再出现一次就是重复，去掉。
 */
function gist(back: string | null, reading: string | null): string {
  if (!back) return ''
  let first = stripFurigana(back.split(/[｜|\n]/).find((part) => part.trim() !== '') ?? '').trim()
  for (const r of reading?.split('／') ?? []) {
    if (r !== '' && first.startsWith(r) && /^[\s　]/.test(first.slice(r.length))) {
      first = first.slice(r.length).trim()
      break
    }
  }
  return first
}

/** 这张卡什么时候该复习：新卡 / 待复习 / 还有几天。 */
function dueLabel(card: Card, now: number): { text: string; due: boolean } {
  const due = new Date(card.dueAt).getTime()
  if (card.repetitions === 0 && card.lapses === 0) return { text: '新卡', due: false }
  if (due <= now) return { text: '待复习', due: true }
  const days = Math.ceil((due - now) / 86_400_000)
  return { text: days === 1 ? '明天' : `${days} 天后`, due: false }
}

/** 列表里的一行。整行都能点，点了展开详情。 */
function CardRow({
  card,
  deckName,
  open,
  now,
  onToggle,
}: {
  card: Card
  /** 看「全部」时才给，标出这张在哪个包 */
  deckName?: string
  open: boolean
  now: number
  onToggle: () => void
}) {
  const status = dueLabel(card, now)
  return (
    <button
      onClick={onToggle}
      aria-expanded={open}
      aria-label={`${stripFurigana(card.front)}${card.reading ? ` ${card.reading}` : ''}，${status.text}`}
      className="group flex w-full items-center gap-4 py-3.5 text-left"
    >
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2.5">
          <span className="font-mincho text-xl transition group-hover:text-ai sm:text-2xl">
            {stripFurigana(card.front)}
          </span>
          {card.reading && (
            <span className="shrink-0 font-mincho text-sm text-hai">{card.reading}</span>
          )}
        </span>
        {/* 点开时下面的详情会把背面完整列出来，这一行就不重复了 */}
        {!open && (
          <span className="mt-0.5 block truncate text-sm text-hai">{gist(card.back, card.reading)}</span>
        )}
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1 text-xs">
        <span className={status.due ? 'text-ai' : 'text-hai'}>{status.text}</span>
        {deckName && (
          <span className="hidden max-w-[10em] truncate text-hai/60 sm:block">{deckName}</span>
        )}
      </span>
    </button>
  )
}

/** 点开之后：完整背面一段一行、读音、复习记录，还有编辑和删除。 */
function CardDetail({
  card,
  deckName,
  confirmingDelete,
  onEdit,
  onAskDelete,
  onDelete,
  onCancelDelete,
}: {
  card: Card
  deckName?: string
  confirmingDelete: boolean
  onEdit: () => void
  onAskDelete: () => void
  onDelete: () => void
  onCancelDelete: () => void
}) {
  const parts = (card.back ?? '').split(/[｜|\n]/).filter((p) => p.trim() !== '')
  return (
    <div className="mb-4 border-l-2 border-usu pl-4">
      {card.front.includes('[') && (
        <p className="mb-2 font-mincho text-lg leading-loose">
          <Furigana text={card.front} />
        </p>
      )}
      {parts.length > 0 ? (
        <ul className="space-y-1 text-sm leading-relaxed">
          {parts.map((part, i) => (
            <li key={i} className={i === 0 ? 'text-sumi' : 'text-hai'}>
              <Furigana text={part.trim()} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-hai">（无背面）</p>
      )}

      <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-hai">
        {deckName && <span>{deckName}</span>}
        <span>读音 {card.reading ?? '—'}</span>
        <span>复习 {card.repetitions} 次</span>
        {card.lapses > 0 && <span>忘过 {card.lapses} 次</span>}
        <span>下次 {new Date(card.dueAt).toLocaleDateString('zh-CN')}</span>
      </p>

      <div className="mt-3 flex items-center gap-4 text-xs">
        {confirmingDelete ? (
          <>
            <span className="text-shu">删除这张卡？复习记录也会一起删掉</span>
            <button
              onClick={onDelete}
              className="rounded-sm bg-shu px-3 py-1 text-washi transition hover:opacity-85"
            >
              确认删除
            </button>
            <button onClick={onCancelDelete} className="text-hai transition hover:text-sumi">
              取消
            </button>
          </>
        ) : (
          <>
            <button onClick={onEdit} className="text-ai transition hover:underline">
              编辑
            </button>
            <button onClick={onAskDelete} className="text-hai transition hover:text-shu">
              删除
            </button>
          </>
        )}
      </div>
    </div>
  )
}

/** 编辑：正面、背面、读音三栏竖着排，背面是多行的。 */
function EditForm({
  front,
  back,
  reading,
  onFront,
  onBack,
  onReading,
  onSave,
  onCancel,
}: {
  front: string
  back: string
  reading: string
  onFront: (v: string) => void
  onBack: (v: string) => void
  onReading: (v: string) => void
  onSave: () => void
  onCancel: () => void
}) {
  const field = 'mb-1 block text-xs tracking-wider text-hai'
  return (
    <div className="mb-4 flex flex-col gap-4 border-l-2 border-ai pl-4">
      <label>
        <span className={field}>正面</span>
        <input
          value={front}
          onChange={(e) => onFront(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && onCancel()}
          autoFocus
          className="w-full border-b border-usu bg-transparent pb-1 font-mincho text-xl focus:border-ai focus:outline-none"
        />
      </label>
      <label>
        <span className={field}>读音（罗马字会变成假名，几个读音用 / 隔开，留空自动猜）</span>
        <input
          value={reading}
          onChange={(e) =>
            onReading(
              (e.nativeEvent as InputEvent).isComposing ? e.target.value : romajiToKana(e.target.value),
            )
          }
          onKeyDown={(e) => e.key === 'Escape' && onCancel()}
          lang="ja"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          className="w-full border-b border-usu bg-transparent pb-1 font-mincho text-base focus:border-ai focus:outline-none"
        />
      </label>
      <label>
        <span className={field}>背面（「｜」或换行分段，列表里只显示第一段）</span>
        <textarea
          value={back}
          onChange={(e) => onBack(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && onCancel()}
          rows={4}
          className="w-full resize-y border border-usu bg-transparent p-2 text-sm leading-relaxed focus:border-ai focus:outline-none"
        />
      </label>
      <div className="flex gap-3">
        <button
          onClick={onSave}
          className="rounded-sm bg-ai px-4 py-1.5 text-xs text-washi transition hover:opacity-85"
        >
          保存
        </button>
        <button onClick={onCancel} className="text-xs text-hai transition hover:text-sumi">
          取消
        </button>
      </div>
    </div>
  )
}

function PanelTab({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={
        active
          ? 'border-b border-sumi pb-0.5 text-sumi'
          : 'border-b border-transparent pb-0.5 text-hai transition hover:text-sumi'
      }
    >
      {children}
    </button>
  )
}
