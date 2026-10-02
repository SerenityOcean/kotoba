import { useEffect, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { deleteEssay, reviseEssay, writeEssay } from '../api'
import type { Essay } from '../api'
import { useAuth } from '../auth-context'
import { cnNumber, seasonOf, WEEKDAYS } from './season'
import { countChars, formatTime, useEssays } from './essays'
import { EssayWall, Paragraphs, SelfNav, Sky } from './parts'

/** 没落笔就关了页面，下次回来草稿还在。只存在这台设备上。 */
const DRAFT_KEY = 'self:draft'

/**
 * /self/write：只有主人能写。没登录先去登录，登录完回到这儿；
 * 登录了但不是主人，告诉一声就好，不报错。
 */
export default function SelfWritePage() {
  const { user, ready } = useAuth()
  const location = useLocation()

  if (!ready) return null
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  return <Writer />
}

function Writer() {
  const now = new Date()
  const season = seasonOf(now)
  const { list, error, loadingMore, loadMore, added, revised, removed } = useEssays()

  return (
    <div className="self-root" style={{ '--accent': season.color } as React.CSSProperties}>
      <Sky color={season.color} />
      <div className="self-wrap">
        <SelfNav>
          <Link to="/self" className="self-nav-link">
            回到 self
          </Link>
        </SelfNav>

        <header className="self-hero self-hero-small">
          <h1 className="self-today">
            {cnNumber(now.getMonth() + 1)}月{cnNumber(now.getDate())}日
          </h1>
          <div className="self-hero-line">
            星期{WEEKDAYS[now.getDay()]} · {season.name}第{cnNumber(season.day)}天 ·{' '}
            {season.pentads[season.pentad]}
          </div>
        </header>

        {error ? (
          <p className="self-quiet">{error}</p>
        ) : !list ? null : !list.canWrite ? (
          <p className="self-quiet">
            这里只有主人能写。
            <Link to="/self" className="self-inline-link">
              去读 self
            </Link>
          </p>
        ) : (
          <>
            <Composer onWritten={added} />
            <EssayWall
              essays={list.essays}
              hasMore={list.hasMore}
              renderEntry={(essay) => (
                <EditableEntry essay={essay} onRevised={revised} onRemoved={removed} />
              )}
            />
            {list.hasMore && (
              <div className="self-more">
                <button onClick={loadMore} disabled={loadingMore}>
                  {loadingMore ? '翻找中…' : '更早的'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function readDraft(): string {
  try {
    return localStorage.getItem(DRAFT_KEY) ?? ''
  } catch {
    return ''
  }
}

function keepDraft(text: string) {
  try {
    if (text) localStorage.setItem(DRAFT_KEY, text)
    else localStorage.removeItem(DRAFT_KEY)
  } catch {
    // 无痕窗口之类存不了，就不存
  }
}

/** ⌘/Ctrl + Enter 落笔，和按钮一样。 */
const isSubmitKey = (e: KeyboardEvent) => (e.metaKey || e.ctrlKey) && e.key === 'Enter'

function Composer({ onWritten }: { onWritten: (essay: Essay) => void }) {
  const [text, setText] = useState(readDraft)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [justSaved, setJustSaved] = useState(false)

  useEffect(() => keepDraft(text), [text])

  useEffect(() => {
    if (!justSaved) return
    const timer = setTimeout(() => setJustSaved(false), 2400)
    return () => clearTimeout(timer)
  }, [justSaved])

  async function submit() {
    if (!text.trim() || saving) return
    setSaving(true)
    setError(null)
    try {
      onWritten(await writeEssay(text))
      setText('')
      setJustSaved(true)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="self-composer">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (isSubmitKey(e)) {
            e.preventDefault()
            submit()
          }
        }}
        placeholder="此刻……"
        aria-label="写一条随笔"
        autoFocus
      />
      <div className="self-composer-foot">
        <span className={error ? 'is-error' : undefined}>
          {error ?? (justSaved ? '已落笔' : `${countChars(text)} 字`)}
        </span>
        <span className="self-composer-actions">
          <kbd>⌘ ↵</kbd>
          <button onClick={submit} disabled={saving || !text.trim()} className="self-button">
            {saving ? '落笔中…' : '落笔'}
          </button>
        </span>
      </div>
    </section>
  )
}

function EditableEntry({
  essay,
  onRevised,
  onRemoved,
}: {
  essay: Essay
  onRevised: (essay: Essay) => void
  onRemoved: (id: number) => void
}) {
  const [mode, setMode] = useState<'read' | 'edit' | 'confirm'>('read')
  const [draft, setDraft] = useState(essay.body)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await action()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const save = () =>
    run(async () => {
      onRevised(await reviseEssay(essay.id, draft))
      setMode('read')
    })

  // 删掉之后这个组件就卸载了，不用再改状态
  const remove = () => run(async () => {
    await deleteEssay(essay.id)
    onRemoved(essay.id)
  })

  if (mode === 'edit') {
    return (
      <>
        <textarea
          className="self-edit"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (isSubmitKey(e)) {
              e.preventDefault()
              save()
            }
          }}
          aria-label="修改这条随笔"
          autoFocus
        />
        <div className="self-entry-foot">
          <span className={error ? 'is-error' : undefined}>{error ?? `${countChars(draft)} 字`}</span>
          <span className="self-entry-actions">
            <button
              onClick={() => {
                setDraft(essay.body)
                setError(null)
                setMode('read')
              }}
            >
              取消
            </button>
            <button onClick={save} disabled={busy || !draft.trim()} className="is-strong">
              {busy ? '保存中…' : '保存'}
            </button>
          </span>
        </div>
      </>
    )
  }

  return (
    <>
      <Paragraphs body={essay.body} />
      <div className="self-entry-foot">
        <span className={error ? 'is-error' : undefined}>
          {error ?? (
            <>
              {formatTime(essay.writtenAt)}
              {essay.editedAt && ' · 改过'}
            </>
          )}
        </span>
        {mode === 'confirm' ? (
          <span className="self-entry-actions">
            <span>删掉这一条？</span>
            <button onClick={() => setMode('read')}>留着</button>
            <button onClick={remove} disabled={busy} className="is-danger">
              删除
            </button>
          </span>
        ) : (
          <span className="self-entry-actions is-quiet">
            <button onClick={() => setMode('edit')}>编辑</button>
            <button onClick={() => setMode('confirm')}>删除</button>
          </span>
        )}
      </div>
    </>
  )
}
