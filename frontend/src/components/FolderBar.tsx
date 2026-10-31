import { useState } from 'react'
import { UNFILED, createFolder, deleteFolder, renameFolder } from '../api'
import type { FolderKind, FolderListing } from '../api'
import { Chip, Count, InlineForm } from './chips'

const NOUN: Record<FolderKind, string> = { ARTICLE: '篇', EXAM: '份' }
const THING: Record<FolderKind, string> = { ARTICLE: '文章', EXAM: '卷子' }

/**
 * 阅读、应试列表上方的集选择条，样子和卡片的 DeckBar 一样。
 * scope：null 是全部，{@link UNFILED} 是没进任何集的，其余是集 id。
 * 选中某个集时，新存、新导入的东西都放进这个集。
 */
export default function FolderBar({
  kind,
  listing,
  scope,
  onSelect,
  onChanged,
  onError,
}: {
  kind: FolderKind
  listing: FolderListing
  scope: number | null
  onSelect: (scope: number | null) => void
  onChanged: () => void
  onError: (message: string) => void
}) {
  const [renaming, setRenaming] = useState(false)
  const [draftName, setDraftName] = useState('')
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')

  const selected = listing.folders.find((f) => f.id === scope) ?? null

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
    <div className="mb-6">
      <div className="flex flex-wrap items-baseline gap-x-5 gap-y-2">
        <Chip active={scope === null} onClick={() => { onSelect(null); reset() }}>
          全部 <Count>{listing.total}</Count>
        </Chip>

        {listing.folders.length > 0 && (
          <Chip active={scope === UNFILED} onClick={() => { onSelect(UNFILED); reset() }}>
            未归档 <Count>{listing.unfiled}</Count>
          </Chip>
        )}

        {listing.folders.map((folder) => (
          <Chip
            key={folder.id}
            active={folder.id === scope}
            onClick={() => { onSelect(folder.id); reset() }}
          >
            {folder.name} <Count>{folder.count}</Count>
          </Chip>
        ))}

        <button
          onClick={() => { setCreating(!creating); setRenaming(false); setConfirmingDelete(false) }}
          className="text-sm text-hai transition hover:text-sumi"
          title="新建一个集"
          aria-label="新建一个集"
        >
          ＋
        </button>
      </div>

      {creating && (
        <InlineForm
          value={newName}
          onChange={setNewName}
          placeholder="新集名"
          submitLabel="新建"
          onSubmit={() => run(async () => {
            const folder = await createFolder(kind, newName)
            onSelect(folder.id)
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
              placeholder="新的集名"
              submitLabel="保存"
              onSubmit={() => run(() => renameFolder(selected.id, draftName), '改名失败')}
              onCancel={reset}
            />
          ) : confirmingDelete ? (
            <>
              <span className="text-shu">
                删除集「{selected.name}」？里面的 {selected.count} {NOUN[kind]}
                {THING[kind]}不会删，退回未归档
              </span>
              <button
                onClick={() => run(async () => {
                  await deleteFolder(selected.id)
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
                删除这个集
              </button>
              <span className="text-hai">新存、新导入的{THING[kind]}都会进「{selected.name}」</span>
            </>
          )}
        </div>
      )}
    </div>
  )
}
