import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { fetchLibraryEssay, fetchPackTrial } from '../api'
import type { LibraryEssay, PackTint, PackTrial } from '../api'
import { useAuth } from '../auth-context'
import AnalysisPanel from '../components/AnalysisPanel'
import Furigana from '../components/Furigana'
import EssayBody from '../library/EssayBody'
import { useSelectionAnalysis } from '../selection'
import { KOTOBA_THEME_KEY, useThemeState } from '../theme'

/**
 * 读资料里的随笔。和 /self 一样不要 Kotoba 的页头：只留一条细顶栏，往下读时收起来、往回翻时出来，
 * 顶上一条进度线。字号、明朝 / 黑体、昼夜都能调，记在这台设备上；读到哪儿也记着，下次打开能接着读。
 *
 * 谁都能读的那几篇没登录也能打开（分享出去的链接）；登录了的话，选中日语可以就地拆解。
 */
export default function EssayPage() {
  const { slug = '' } = useParams()
  const { user } = useAuth()
  const [essay, setEssay] = useState<LibraryEssay | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setEssay(null)
    setError(null)
    fetchLibraryEssay(slug)
      .then(setEssay)
      .catch((e) => setError(e instanceof Error ? e.message : '加载失败'))
  }, [slug])

  // 只有这一篇随笔的包没有详情页（点开包就是这篇），回资料页
  const back = essay?.pack && !essay.pack.entry
    ? { to: `/library/${essay.pack.slug}`, label: `← ${essay.pack.title}` }
    : user
      ? { to: '/library', label: '← 资料' }
      : { to: '/', label: '言葉' }

  if (error || !essay) {
    return (
      <ReaderShell back={back} title="" storageKey={null}>
        {error ? <Locked message={error} signedIn={!!user} /> : <p className="text-sm text-hai">加载中…</p>}
      </ReaderShell>
    )
  }

  const date = essay.publishedAt
    ? new Date(essay.publishedAt).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })
    : '草稿'

  return (
    <ReaderShell
      back={back}
      title={essay.title}
      kicker={essay.pack ? `随笔 · ${essay.pack.title}` : '随笔 · 免费'}
      meta={[`约 ${essay.minutes} 分钟`, `${essay.chars.toLocaleString()} 字`, date]}
      storageKey={`essay:${essay.slug}`}
      after={
        <>
          {essay.next && (
            <AfterCard to={`/essay/${essay.next.slug}`} label="下一篇" title={essay.next.title} go="接着读" />
          )}
          {essay.pack && !essay.pack.entry ? (
            <AfterCard
              to={`/library/${essay.pack.slug}`}
              tint={essay.pack.tint}
              label="回到"
              title={essay.pack.title}
              go="卡片和阅读"
            />
          ) : user ? (
            <AfterCard to="/library" label="接下来" title="全部资料" go="资料包里有整理好的卡片和文章" />
          ) : (
            <AfterCard to="/login?mode=register" label="接下来" title="注册言葉" go="读原文、拆难句、把词变成卡片" />
          )}
        </>
      }
    >
      {(wideNotes) => <EssayBody body={essay.body} wideNotes={wideNotes} />}
    </ReaderShell>
  )
}

/** 资料包里的第一篇文章，没解锁也能读完。 */
export function PackTrialPage() {
  const { slug = '' } = useParams()
  const [trial, setTrial] = useState<PackTrial | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchPackTrial(slug)
      .then(setTrial)
      .catch((e) => setError(e instanceof Error ? e.message : '加载失败'))
  }, [slug])

  const back = { to: `/library/${slug}`, label: `← ${trial?.pack.title ?? '资料包'}` }
  if (error || !trial) {
    return (
      <ReaderShell back={back} title="" storageKey={null}>
        {error ? <p className="text-sm text-shu">{error}</p> : <p className="text-sm text-hai">加载中…</p>}
      </ReaderShell>
    )
  }

  return (
    <ReaderShell
      back={back}
      title={trial.title}
      kicker={`试读 · ${trial.pack.title}`}
      storageKey={`trial:${slug}`}
      japaneseTitle
      after={
        <AfterCard
          to={`/library/${trial.pack.slug}`}
          tint={trial.pack.tint}
          label="读完了"
          title={`解锁「${trial.pack.title}」`}
          go="剩下的文章和卡片"
        />
      }
    >
      {() => (
        <div lang="ja" className="font-mincho text-[1.08em] leading-[2.4] whitespace-pre-wrap">
          <Furigana text={trial.body} />
        </div>
      )}
    </ReaderShell>
  )
}

// ---- 阅读器的壳 ------------------------------------------------------------

const SIZE_KEY = 'kotoba:reader-size'
const FACE_KEY = 'kotoba:reader-face'
const POSITION_KEY = 'kotoba:reader-pos:'
const SIZES = [15, 16, 17, 18, 20, 22] as const
const DEFAULT_SIZE = 18

function readNumber(key: string): number | null {
  try {
    const value = Number(localStorage.getItem(key))
    return Number.isFinite(value) && value > 0 ? value : null
  } catch {
    return null
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // 无痕窗口存不了，这次照样能用
  }
}

/**
 * @param storageKey 记读到哪儿用的；还没加载出来时是 null，什么都不记
 * @param children   拿到「旁注能不能放进右边空白」再渲染正文：拆解面板开着时右边被占了
 */
function ReaderShell({
  back,
  title,
  kicker,
  meta,
  storageKey,
  japaneseTitle = false,
  after,
  children,
}: {
  back: { to: string; label: string }
  title: string
  kicker?: string
  meta?: string[]
  storageKey: string | null
  japaneseTitle?: boolean
  after?: ReactNode
  children: ReactNode | ((wideNotes: boolean) => ReactNode)
}) {
  const { user } = useAuth()
  const { theme, toggle } = useThemeState(KOTOBA_THEME_KEY)
  const [size, setSize] = useState(() => {
    const stored = readNumber(SIZE_KEY)
    return stored && (SIZES as readonly number[]).includes(stored) ? stored : DEFAULT_SIZE
  })
  const [sans, setSans] = useState(() => {
    try {
      return localStorage.getItem(FACE_KEY) === 'sans'
    } catch {
      return false
    }
  })
  const [progress, setProgress] = useState(0)
  const [scrolled, setScrolled] = useState(false)
  const [away, setAway] = useState(false)
  const [resumeAt, setResumeAt] = useState<number | null>(null)
  const lastY = useRef(0)

  // 页头之外的地方，昼夜要自己挂到 <html> 上（Kotoba 的壳不在了）
  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') root.dataset.theme = 'dark'
    else delete root.dataset.theme
  }, [theme])

  useEffect(() => {
    document.title = title ? `${title} · 言葉` : '言葉'
  }, [title])

  // 上次读到一半（8% 到 95% 之间）才提示接着读：刚开头、快读完的不打扰
  useEffect(() => {
    window.scrollTo(0, 0)
    lastY.current = 0
    setProgress(0)
    setAway(false)
    setScrolled(false)
    const saved = storageKey ? readNumber(POSITION_KEY + storageKey) : null
    setResumeAt(saved && saved > 0.08 && saved < 0.95 ? saved : null)
  }, [storageKey])

  useEffect(() => {
    let frame = 0
    function onScroll() {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const max = document.documentElement.scrollHeight - window.innerHeight
        const p = max > 0 ? Math.min(1, window.scrollY / max) : 0
        setProgress(p)
        setScrolled(window.scrollY > 220)
        setAway(window.scrollY > lastY.current && window.scrollY > 320)
        lastY.current = window.scrollY
        if (storageKey && window.scrollY > 0) write(POSITION_KEY + storageKey, p.toFixed(3))
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', onScroll)
    }
  }, [storageKey])

  const resize = useCallback((step: number) => {
    setSize((current) => {
      const at = SIZES.indexOf(current as (typeof SIZES)[number])
      const next = SIZES[Math.max(0, Math.min(SIZES.length - 1, at + step))]
      write(SIZE_KEY, String(next))
      return next
    })
  }, [])

  function resume() {
    if (resumeAt === null) return
    const max = document.documentElement.scrollHeight - window.innerHeight
    window.scrollTo({ top: resumeAt * max, behavior: 'smooth' })
    setResumeAt(null)
  }

  // 登录了才能拆：拆解要算在某个人的额度上
  const selection = useSelectionAnalysis()
  const canAnalyze = !!user
  const { pending, showPanel, analyze } = selection
  const panelOpen = canAnalyze && showPanel

  return (
    <div className="min-h-screen bg-washi font-ui text-sumi">
      <div
        className="fixed top-0 left-0 z-40 h-0.5 bg-ai transition-[width] duration-100"
        style={{ width: `${progress * 100}%` }}
      />
      <header
        className={`fixed inset-x-0 top-0 z-30 flex h-13 items-center justify-between gap-4 border-b bg-washi/90 px-4 backdrop-blur-sm transition-[transform,border-color] duration-300 sm:px-8 ${
          scrolled ? 'border-usu' : 'border-transparent'
        } ${away && !panelOpen ? '-translate-y-full' : ''}`}
      >
        <Link to={back.to} className="shrink-0 text-sm text-hai transition hover:text-sumi">
          {back.label}
        </Link>
        <p
          className={`min-w-0 flex-1 truncate text-center font-mincho text-sm transition-opacity duration-300 ${
            scrolled ? 'opacity-100' : 'opacity-0'
          }`}
        >
          {title}
        </p>
        <div className="flex shrink-0 items-center gap-1 text-[0.82rem] text-hai">
          <ToolButton label="字小一点" onClick={() => resize(-1)}>
            A−
          </ToolButton>
          <ToolButton label="字大一点" onClick={() => resize(1)}>
            A＋
          </ToolButton>
          <span className="mx-1 h-4 w-px bg-usu" />
          <ToolButton
            label={sans ? '换成明朝体' : '换成黑体'}
            onClick={() => {
              write(FACE_KEY, sans ? 'mincho' : 'sans')
              setSans(!sans)
            }}
          >
            <span className={sans ? 'font-ui' : 'font-mincho'}>{sans ? '黑' : '明'}</span>
          </ToolButton>
          <ToolButton label={theme === 'dark' ? '切到日间模式' : '切到夜间模式'} onClick={toggle}>
            <span className="font-mincho">{theme === 'dark' ? '昼' : '夜'}</span>
          </ToolButton>
        </div>
      </header>

      <div
        className={
          panelOpen
            ? 'mx-auto max-w-6xl px-5 sm:px-8 xl:grid xl:grid-cols-[minmax(0,1fr)_26rem] xl:items-start xl:gap-12'
            : ''
        }
      >
        <div className={panelOpen ? 'pb-[72vh] xl:pb-0' : ''}>
          <article
            style={{
              fontSize: `${size / 16}rem`,
              ['--body' as string]: sans ? 'var(--font-ui)' : 'var(--font-mincho)',
            }}
            className="mx-auto max-w-[34em] px-5 pt-28 pb-16 sm:px-8 sm:pt-36"
          >
            {kicker && <p className="font-ui text-xs tracking-[0.3em] text-ai">{kicker}</p>}
            {title && (
              <h1
                lang={japaneseTitle ? 'ja' : undefined}
                className="mt-4 font-mincho text-[2.1em] leading-[1.45] tracking-[0.1em]"
              >
                {japaneseTitle ? <Furigana text={title} /> : title}
              </h1>
            )}
            {meta && (
              <p className="mt-5 flex flex-wrap gap-x-4 font-ui text-xs text-hai">
                {meta.map((m) => (
                  <span key={m}>{m}</span>
                ))}
              </p>
            )}
            {resumeAt !== null && (
              <button
                onClick={resume}
                className="mt-6 rounded-full border border-ai/35 px-3.5 py-1 font-ui text-xs text-ai transition hover:bg-ai/5"
              >
                接着上次读 · {Math.round(resumeAt * 100)}% →
              </button>
            )}
            {title && <div className="mt-10 mb-11 h-px w-10 bg-sumi/50" />}

            {typeof children === 'function' ? children(!panelOpen) : children}

            {title && <p className="mt-[3.5em] text-center font-mincho text-[0.9em] tracking-[1em] text-hai">終</p>}
          </article>

          {/* 一张两张都居中：只有「回到资料」一张时别孤零零靠在左边 */}
          {after && (
            <div className="mx-auto flex max-w-2xl flex-wrap justify-center gap-4 px-5 pb-24 sm:px-8">{after}</div>
          )}
        </div>

        {panelOpen && <AnalysisPanel selection={selection} />}
      </div>

      {/* 选中了日语但还没拆：底部浮一条按钮，点了才花额度 */}
      {canAnalyze && pending !== '' && !showPanel && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-usu bg-washi/95 px-4 py-3 backdrop-blur-sm sm:px-8">
          <div className="mx-auto max-w-2xl">
            <button
              onClick={() => analyze(pending)}
              className="rounded-sm bg-ai px-5 py-2.5 text-sm text-washi transition hover:opacity-85"
            >
              拆解选中的 {pending.length} 字
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function ToolButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className="h-8 min-w-8 rounded-lg px-1.5 transition hover:bg-usu hover:text-sumi"
    >
      {children}
    </button>
  )
}

function AfterCard({
  to,
  label,
  title,
  go,
  tint,
}: {
  to: string
  label: string
  title: string
  go: string
  tint?: PackTint
}) {
  return (
    <Link
      to={to}
      className={`group block w-full rounded-2xl border px-5 py-5 transition sm:w-[calc(50%-0.5rem)] duration-300 hover:-translate-y-0.5 hover:shadow-[0_10px_28px_-16px_rgb(0_0_0/0.3)] ${
        tint ? `tint-${tint} border-[var(--edge)] bg-[var(--tint)]` : 'border-usu bg-washi'
      }`}
    >
      <p className="text-xs tracking-[0.2em] text-hai">{label}</p>
      <p className="mt-2 font-mincho text-xl tracking-[0.06em]">{title}</p>
      <p className={`mt-3 text-xs ${tint ? 'text-[var(--ink)]' : 'text-ai'}`}>
        {go} <span className="inline-block transition-transform duration-300 group-hover:translate-x-1">→</span>
      </p>
    </Link>
  )
}

/** 包里的随笔没解锁（或者没登录）。 */
function Locked({ message, signedIn }: { message: string; signedIn: boolean }) {
  return (
    <div className="py-16 text-center">
      <p className="font-mincho text-2xl">还读不了这篇</p>
      <p className="mt-4 text-sm leading-relaxed text-hai">{message}</p>
      <Link
        to={signedIn ? '/library' : '/login'}
        className="mt-8 inline-block text-sm text-ai underline-offset-4 hover:underline"
      >
        {signedIn ? '去资料页 →' : '登录 →'}
      </Link>
    </div>
  )
}
