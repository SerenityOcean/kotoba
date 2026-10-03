import { useEffect, useRef, useState } from 'react'
import { fetchEssay } from '../api'
import type { Essay } from '../api'
import { formatTime } from './essays'
import { Paragraphs } from './parts'
import { cnNumber, termFinder, WEEKDAYS } from './season'

/**
 * 读全文：在展示页上浮出来的一层，背后虚掉，正文放大、行距放松。
 * 关掉的方式有三种：Esc、点正文外面、浏览器的返回键（打开时在地址上加了 ?e=id）。
 *
 * 那一篇在已经取到的列表里就直接用；分享出去的链接可能指向更早的，没取到就单独去要。
 */
export default function Reader({
  id,
  loaded,
  onClose,
}: {
  id: number
  loaded: Essay | undefined
  onClose: () => void
}) {
  const [fetched, setFetched] = useState<{ id: number; essay: Essay | null } | null>(null)
  const closeButton = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (loaded) return
    let alive = true
    fetchEssay(id)
      .then((essay) => alive && setFetched({ id, essay }))
      .catch(() => alive && setFetched({ id, essay: null }))
    return () => {
      alive = false
    }
  }, [id, loaded])

  // 打开时背后的页面别跟着滚，焦点放到关闭按钮上，Esc 关掉
  useEffect(() => {
    const root = document.documentElement.style
    const previous = root.overflow
    root.overflow = 'hidden'
    closeButton.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    addEventListener('keydown', onKey)
    return () => {
      root.overflow = previous
      removeEventListener('keydown', onKey)
    }
  }, [onClose])

  const essay = loaded ?? (fetched?.id === id ? fetched.essay : undefined)

  return (
    <div
      className="self-reader"
      role="dialog"
      aria-modal="true"
      aria-label="读全文"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <article className="self-reader-page">
        <button ref={closeButton} onClick={onClose} className="self-reader-close" aria-label="关闭">
          ×
        </button>
        {essay === undefined ? (
          <p className="self-reader-quiet">翻找中…</p>
        ) : essay === null ? (
          <p className="self-reader-quiet">这一篇找不到了。</p>
        ) : (
          <>
            <Meta essay={essay} />
            <div className="self-reader-body">
              <Paragraphs body={essay.body} />
            </div>
          </>
        )}
      </article>
    </div>
  )
}

/** 十月二日 · 星期五 · 秋分 · 19:21 */
function Meta({ essay }: { essay: Essay }) {
  const at = new Date(essay.writtenAt)
  const term = termFinder(at, at)(at)
  return (
    <header className="self-reader-meta" style={{ '--c': term.color } as React.CSSProperties}>
      <span>
        {at.getFullYear() !== new Date().getFullYear() && `${at.getFullYear()}年`}
        {cnNumber(at.getMonth() + 1)}月{cnNumber(at.getDate())}日
      </span>
      <span>星期{WEEKDAYS[at.getDay()]}</span>
      <span className="self-tag">{term.name}</span>
      <span>
        {formatTime(essay.writtenAt)}
        {essay.editedAt && ' · 改过'}
      </span>
    </header>
  )
}
