import { useState } from 'react'
import type { ReactNode } from 'react'
import type { FolderKind, FolderListing } from '../api'

const NOUN: Record<FolderKind, string> = { ARTICLE: '篇', EXAM: '份' }

/**
 * 多选之后出现的一条：选了几个、挪到哪个集（或者退回未归档）。
 * 阅读和应试列表共用。
 */
export default function MoveBar({
  kind,
  listing,
  count,
  pageSize,
  onSelectAll,
  onMove,
  onCancel,
  extra,
}: {
  kind: FolderKind
  listing: FolderListing
  count: number
  /** 当前列表一共几个，全选按钮要不要显示靠它 */
  pageSize: number
  onSelectAll: () => void
  /** folderId 为 null 是退回未归档 */
  onMove: (folderId: number | null) => Promise<void>
  onCancel: () => void
  /** 跟在「挪过去」后面的别的批量操作 */
  extra?: ReactNode
}) {
  // '' 是还没选，'none' 是未归档
  const [target, setTarget] = useState('')
  const [moving, setMoving] = useState(false)

  async function move() {
    setMoving(true)
    try {
      await onMove(target === 'none' ? null : Number(target))
    } finally {
      setMoving(false)
    }
  }

  return (
    <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-usu pb-3 text-sm">
      <span className="tabular-nums text-sumi">
        已选 {count} {NOUN[kind]}
      </span>
      {count < pageSize && (
        <button onClick={onSelectAll} className="text-xs text-hai transition hover:text-sumi">
          全选这一页
        </button>
      )}
      <select
        value={target}
        onChange={(e) => setTarget(e.target.value)}
        className="border-b border-usu bg-transparent pb-0.5 text-sm focus:border-ai focus:outline-none"
      >
        <option value="" disabled>
          挪到…
        </option>
        {listing.folders.map((f) => (
          <option key={f.id} value={f.id}>
            {f.name}
          </option>
        ))}
        <option value="none">未归档</option>
      </select>
      <button
        onClick={move}
        disabled={count === 0 || target === '' || moving}
        className="rounded-sm bg-ai px-3 py-1 text-xs text-washi transition hover:opacity-85 disabled:opacity-30"
      >
        挪过去
      </button>
      {extra}
      <button onClick={onCancel} className="text-xs text-hai transition hover:text-sumi">
        取消
      </button>
    </div>
  )
}
