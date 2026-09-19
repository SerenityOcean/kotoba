import { useState } from 'react'
import { createDeck, deleteDeck, renameDeck } from '../api'
import type { Deck } from '../api'

/**
 * 包的选择条 + 管理。选中某个包时，新建和导入的卡片都会进这个包；
 * 「全部」只是一个浏览视角，此时新卡进默认包。
 */
export default function DeckBar({
  decks,
  deckId,
  onSelect,
  onChanged,
  onError,
}: {
  decks: Deck[]
  deckId: number | null
  onSelect: (id: number | null) => void
  onChanged: () => void
  onError: (message: string) => void
}) {
  const [renaming, setRenaming] = useState(false)
  const [draftName, setDraftName] = useState('')
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')

  const selected = decks.find((d) => d.id === deckId) ?? null
  const totalCards = decks.reduce((sum, d) => sum + d.cardCount, 0)

  function reset() {
    setRenaming(false)
    setConfirmingDelete(false)
    setCreating(false)
    setNewName('')
  }

  async function run(action: () => Promise<unknown>, fallback: string) {
    try {
      await action()
      reset()
      onChanged()
    } catch (e) {
      onError(e instanceof Error ? e.message : fallback)
    }
  }

  return (
    <div className="mb-6 border-b border-usu pb-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-xs tracking-wider text-hai">包</span>

        <Chip active={deckId === null} onClick={() => { onSelect(null); reset() }}>
          全部 <Count>{totalCards}</Count>
        </Chip>

        {decks.map((deck) => (
          <Chip
            key={deck.id}
            active={deck.id === deckId}
            onClick={() => { onSelect(deck.id); reset() }}
          >
            {deck.name} <Count>{deck.cardCount}</Count>
          </Chip>
        ))}

        <button
          onClick={() => { setCreating(!creating); setRenaming(false); setConfirmingDelete(false) }}
          className="px-1 text-xs text-hai transition hover:text-sumi"
          title="新建一个空包"
        >
          ＋
        </button>
      </div>

      {creating && (
        <InlineForm
          value={newName}
          onChange={setNewName}
          placeholder="新包名"
          submitLabel="新建"
          onSubmit={() => run(async () => {
            const deck = await createDeck(newName)
            onSelect(deck.id)
          }, '新建失败')}
          onCancel={reset}
        />
      )}

      {selected && !creating && (
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
          {renaming ? (
            <InlineForm
              value={draftName}
              onChange={setDraftName}
              placeholder="新的包名"
              submitLabel="保存"
              onSubmit={() => run(() => renameDeck(selected.id, draftName), '改名失败')}
              onCancel={reset}
            />
          ) : confirmingDelete ? (
            <>
              <span className="text-shu">
                删除「{selected.name}」连同里面 {selected.cardCount} 张卡片？不可撤销
              </span>
              <button
                onClick={() => run(async () => {
                  await deleteDeck(selected.id)
                  onSelect(null)
                }, '删除失败')}
                className="rounded-sm bg-shu px-3 py-1 text-washi transition hover:opacity-85"
              >
                确认删除
              </button>
              <button onClick={reset} className="text-hai transition hover:text-sumi">
                取消
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => { setDraftName(selected.name); setRenaming(true) }}
                className="text-hai transition hover:text-ai"
              >
                重命名
              </button>
              <button
                onClick={() => setConfirmingDelete(true)}
                className="text-hai transition hover:text-shu"
              >
                删除这个包
              </button>
              <span className="text-hai">
                新卡片和导入都会进「{selected.name}」
              </span>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function InlineForm({
  value,
  onChange,
  placeholder,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
  submitLabel: string
  onSubmit: () => void
  onCancel: () => void
}) {
  return (
    <div className="mt-3 flex items-center gap-2">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSubmit()
          if (e.key === 'Escape') onCancel()
        }}
        placeholder={placeholder}
        autoFocus
        className="border-b border-usu bg-transparent pb-1 text-sm focus:border-ai focus:outline-none"
      />
      <button
        onClick={onSubmit}
        disabled={value.trim() === ''}
        className="rounded-sm bg-ai px-3 py-1 text-xs text-washi transition hover:opacity-85 disabled:opacity-30"
      >
        {submitLabel}
      </button>
      <button onClick={onCancel} className="text-xs text-hai transition hover:text-sumi">
        取消
      </button>
    </div>
  )
}

function Chip({
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
          ? 'rounded-sm border border-ai bg-ai px-2.5 py-1 text-xs text-washi'
          : 'rounded-sm border border-usu px-2.5 py-1 text-xs text-hai transition hover:border-sumi hover:text-sumi'
      }
    >
      {children}
    </button>
  )
}

function Count({ children }: { children: React.ReactNode }) {
  return <span className="tabular-nums opacity-60">{children}</span>
}
