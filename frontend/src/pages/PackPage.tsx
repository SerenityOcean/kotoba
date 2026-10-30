import { useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { checkoutPack, fetchOrder, fetchPack, formatPrice, importPack, redeemCode } from '../api'
import type { Checkout, PackDetail, PackImport } from '../api'
import Furigana from '../components/Furigana'

/**
 * 一个资料包：封面、里面有什么（卡片能翻、第一篇文章能试读、随笔看得到题目），和解锁。
 *
 * 解锁之后由这一页调导入：付完钱的那一刻、兑换码兑完、或者之前付了钱没导完再进来时。
 * 从支付宝跳回来时地址上带着 ?order=，只是开始轮询订单 —— 付没付以后端为准。
 */
export default function PackPage() {
  const { slug = '' } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const [pack, setPack] = useState<PackDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sheet, setSheet] = useState<SheetStart | null>(null)

  const load = useCallback(() => {
    fetchPack(slug)
      .then(setPack)
      .catch((e) => setError(e instanceof Error ? e.message : '加载失败'))
  }, [slug])

  useEffect(() => {
    setPack(null)
    setError(null)
    load()
  }, [load])

  // 支付宝付完跳回来：?order=KB… 接着等结果，然后把地址上的参数去掉，刷新时不再弹
  const returnedOrder = searchParams.get('order')
  useEffect(() => {
    if (!returnedOrder) return
    setSheet({ kind: 'confirm', orderNo: returnedOrder })
    setSearchParams({}, { replace: true })
  }, [returnedOrder, setSearchParams])

  if (error) return <p className="text-sm text-shu">{error}</p>
  if (!pack) return <p className="text-sm text-hai">加载中…</p>

  const { card } = pack
  const owned = card.owned

  return (
    <div className={`tint-${card.tint}`}>
      <Link to="/library" className="text-xs text-hai transition hover:text-sumi">
        ← 资料
      </Link>

      <section className="animate-rise relative mt-5 overflow-hidden rounded-[22px] border border-[var(--edge)] bg-[var(--tint)] px-6 pt-8 pb-7 sm:px-12 sm:pt-11 sm:pb-10">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-6 -right-2 font-mincho text-[13rem] leading-none text-[var(--ink)] opacity-[0.13] sm:top-[-1rem] sm:right-8 sm:text-[17rem] sm:opacity-90"
        >
          {card.glyph}
        </div>

        <p className="relative text-xs tracking-[0.3em] text-[var(--ink)]">{card.level}</p>
        <h1 className="relative mt-2.5 font-mincho text-[2.1rem] leading-snug tracking-[0.2em] sm:text-[2.6rem]">
          {card.title}
        </h1>
        <p className="relative mt-4 max-w-[30em] text-[0.92rem] leading-[1.95] text-sumi/80">{pack.intro}</p>

        <div className="relative mt-7 flex gap-8">
          <Big n={card.cardCount} unit="张卡片" />
          <Big n={card.articleCount} unit="篇阅读" />
          {card.essayCount > 0 && <Big n={card.essayCount} unit="篇随笔" />}
        </div>

        <div className="relative mt-8 border-t border-[var(--edge)] pt-6">
          <BuyRow pack={pack} onStart={setSheet} />
        </div>
      </section>

      <Section title="卡片" count={`${card.cardCount} 张`} hint={owned && pack.importedAt ? `在你的「${pack.deckName}」包里` : `碰一下翻面 · 先给你看 ${pack.cards.length} 张`} delay={0.1}>
        <div className="-mx-1 flex snap-x gap-3.5 overflow-x-auto px-1 pt-2 pb-5 [scrollbar-width:thin]">
          {pack.cards.map((c) => (
            <FlipCard key={c.front} front={c.front} reading={c.reading} back={c.back} />
          ))}
          {card.cardCount > pack.cards.length && (
            <div className="flex h-40 w-30 shrink-0 snap-start items-center justify-center rounded-xl border border-dashed border-usu text-sm text-hai">
              还有 {card.cardCount - pack.cards.length} 张
            </div>
          )}
        </div>
      </Section>

      {pack.articles.length > 0 && (
        <Section title="阅读" count={`${pack.articles.length} 篇`} hint={owned ? '在你的阅读列表里，带注音' : '第一篇可以先读'} delay={0.18}>
          <div className="grid gap-3.5 sm:grid-cols-2">
            {pack.articles.map((a) => {
              const to = owned ? (a.articleId ? `/reading/${a.articleId}` : null) : a.index === 0 ? `/library/${pack.card.slug}/trial` : null
              const badge = owned
                ? a.articleId ? <Badge>已导入</Badge> : <Badge muted>还没导入</Badge>
                : a.index === 0 ? <Badge outline>试读</Badge> : <Badge muted lock>解锁后可读</Badge>
              return (
                <Tile key={a.index} to={to}>
                  {badge}
                  <p lang="ja" className="pr-20 font-mincho text-[1.15rem] leading-[1.9]">
                    <Furigana text={a.title} />
                  </p>
                  <p className="mt-0.5 text-xs text-hai">约 {a.chars} 字</p>
                  <p lang="ja" className={`fade-out mt-2.5 max-h-[3.8em] overflow-hidden font-mincho text-sm leading-[1.9] text-sumi/75 ${to ? '' : 'blur-[3px]'}`}>
                    {a.peek}
                  </p>
                </Tile>
              )
            })}
          </div>
        </Section>
      )}

      {pack.essays.length > 0 && (
        <Section title="随笔" count={`${pack.essays.length} 篇`} hint={owned ? '以后写了新的，也会出现在这里' : '解锁后在这里读'} delay={0.26}>
          <div className="grid gap-3.5 sm:grid-cols-2">
            {pack.essays.map((e) => (
              <Tile key={e.slug} to={owned ? `/essay/${e.slug}` : null}>
                {!owned && <Badge muted lock />}
                <p className="pr-10 font-mincho text-[1.25rem] leading-[1.7] tracking-[0.05em]">{e.title}</p>
                <p className="mt-0.5 text-xs text-hai">约 {e.minutes} 分钟</p>
                <p className={`fade-out mt-2.5 max-h-[3.8em] overflow-hidden font-mincho text-sm leading-[1.9] text-sumi/75 ${owned ? '' : 'blur-[3px]'}`}>
                  {e.peek}
                </p>
              </Tile>
            ))}
          </div>
        </Section>
      )}

      <p className="mt-14 border-l-2 border-ai pl-4 text-xs leading-[1.9] text-hai">
        虚拟内容，解锁后不退款。卡片和文章是复制进你账号的：之后怎么改、怎么删都随你，包里更新了也不会覆盖你改过的。
      </p>

      {sheet && (
        <UnlockSheet
          pack={pack}
          start={sheet}
          onClose={(changed) => {
            setSheet(null)
            if (changed) load()
          }}
        />
      )}
    </div>
  )
}

// ---- 封面上的买 / 已解锁 ------------------------------------------------------

/** 弹层从哪一步开始 */
type SheetStart =
  | { kind: 'pay'; checkout: Checkout }
  | { kind: 'confirm'; orderNo: string }
  | { kind: 'import'; source: string }

function BuyRow({ pack, onStart }: { pack: PackDetail; onStart: (start: SheetStart) => void }) {
  const { card } = pack
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [redeeming, setRedeeming] = useState(false)
  const [code, setCode] = useState('')

  if (card.owned) {
    if (!pack.importedAt) {
      return (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <Owned since={pack.grantedAt} />
          <button onClick={() => onStart({ kind: 'import', source: '已解锁' })} className={PRIMARY}>
            导入到我的账号
          </button>
          <small className="basis-full text-xs text-sumi/55">卡片进「{pack.deckName}」包，文章进阅读</small>
        </div>
      )
    }
    return (
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <Owned since={pack.grantedAt} />
        <Link to={pack.deckId ? `/review?deck=${pack.deckId}` : '/review'} className={PRIMARY}>
          复习这 {card.cardCount} 张
        </Link>
        <Link to="/reading" className={GHOST}>
          在阅读里打开
        </Link>
        <button
          onClick={() => onStart({ kind: 'import', source: '再导一次' })}
          className="text-xs text-sumi/55 underline-offset-4 transition hover:text-[var(--ink)] hover:underline"
          title="包里加了新卡、新文章时用；已有的会跳过，你改过的不会被覆盖"
        >
          同步新增的
        </button>
      </div>
    )
  }

  if (card.status !== 'ON_SALE') {
    return <p className="text-sm text-sumi/60">{card.note ?? '还在写'}，写好了就能解锁。</p>
  }

  async function pay() {
    setBusy(true)
    setError(null)
    // 手机上直接跳支付宝 App；电脑上在弹层里放二维码
    const mobile = window.matchMedia('(max-width: 767px)').matches
    try {
      const checkout = await checkoutPack(card.slug, mobile)
      if (mobile) {
        window.location.href = checkout.payUrl
        return
      }
      onStart({ kind: 'pay', checkout })
    } catch (e) {
      setError(e instanceof Error ? e.message : '下单失败')
    } finally {
      setBusy(false)
    }
  }

  async function redeem(e: FormEvent) {
    e.preventDefault()
    if (!code.trim()) return
    setBusy(true)
    setError(null)
    try {
      const redeemed = await redeemCode(code)
      if (redeemed.slug === card.slug) {
        onStart({ kind: 'import', source: '兑换码已确认' })
      } else {
        // 这张码是别的包的：去那个包，那边会显示「导入到我的账号」
        navigate(`/library/${redeemed.slug}`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '兑换失败')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        {card.priceCents != null && <span className="font-mincho text-[2rem] text-[var(--ink)]">{formatPrice(card.priceCents)}</span>}
        {pack.payable && (
          <button onClick={pay} disabled={busy} className={PRIMARY}>
            用支付宝解锁
          </button>
        )}
        {!redeeming && (
          <button
            onClick={() => setRedeeming(true)}
            className="text-xs text-sumi/55 underline-offset-4 transition hover:text-[var(--ink)] hover:underline"
          >
            有兑换码？
          </button>
        )}
      </div>

      {redeeming && (
        <form onSubmit={redeem} className="mt-4 flex max-w-sm gap-2">
          <input
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="K7QM-3XRP-WN9D"
            aria-label="兑换码"
            className="min-w-0 flex-1 rounded-lg border border-[var(--edge)] bg-washi px-3 py-2 font-mono text-sm tracking-wider outline-none focus:border-[var(--ink)]"
          />
          <button type="submit" disabled={busy || !code.trim()} className={`${GHOST} disabled:opacity-40`}>
            兑换
          </button>
        </form>
      )}

      <p className="mt-3 text-xs text-sumi/55">
        {pack.payable
          ? `付完自动导入：卡片进「${pack.deckName}」包，文章进阅读`
          : '在线支付还没开通，现在可以用兑换码解锁'}
      </p>
      {error && <p className="mt-2 text-sm text-shu">{error}</p>}
    </div>
  )
}

const PRIMARY =
  'inline-flex items-center rounded-[10px] bg-ai px-6 py-3 text-sm tracking-wider text-washi transition hover:brightness-110 active:scale-[0.98] disabled:opacity-50'
const GHOST =
  'inline-flex items-center rounded-[10px] border border-[var(--ink)]/40 px-5 py-2.5 text-sm text-[var(--ink)] transition hover:bg-[var(--ink)]/5'

function Owned({ since }: { since: string | null }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-[var(--ink)]">
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      已解锁
      {since && ` · ${new Date(since).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })}`}
    </span>
  )
}

// ---- 解锁弹层：付款 → 确认 → 导入 ----------------------------------------------

type Step =
  | { kind: 'pay'; checkout: Checkout }
  | { kind: 'confirm'; orderNo: string; slow: boolean }
  | { kind: 'import'; source: string }
  | { kind: 'done'; source: string; result: PackImport }
  | { kind: 'error'; message: string }

/** 轮询订单的间隔，和后端查支付宝的限频（两秒一次）配着 */
const POLL_MS = 2500
/** 跳回来以后等这么多轮还没结果，就提示一句，但接着等 */
const SLOW_AFTER = 24

function UnlockSheet({
  pack,
  start,
  onClose,
}: {
  pack: PackDetail
  start: SheetStart
  onClose: (changed: boolean) => void
}) {
  const [step, setStep] = useState<Step>(() =>
    start.kind === 'pay'
      ? { kind: 'pay', checkout: start.checkout }
      : start.kind === 'confirm'
        ? { kind: 'confirm', orderNo: start.orderNo, slow: false }
        : { kind: 'import', source: start.source },
  )
  const changed = useRef(start.kind !== 'pay')

  // 等付款：电脑上扫码时、从支付宝跳回来时，都隔一会儿问一次后端
  const orderNo = step.kind === 'pay' ? step.checkout.orderNo : step.kind === 'confirm' ? step.orderNo : null
  useEffect(() => {
    if (!orderNo) return
    let rounds = 0
    let alive = true
    const timer = window.setInterval(async () => {
      rounds++
      try {
        const state = await fetchOrder(orderNo)
        if (!alive) return
        if (state.status === 'PAID') {
          changed.current = true
          setStep({ kind: 'import', source: '付款已确认' })
        } else if (rounds === SLOW_AFTER) {
          setStep((s) => (s.kind === 'confirm' ? { ...s, slow: true } : s))
        }
      } catch {
        // 网络抖一下，下一轮再问
      }
    }, POLL_MS)
    return () => {
      alive = false
      window.clearInterval(timer)
    }
  }, [orderNo])

  // 付款确认了（或者本来就解锁了）：导入
  const importing = step.kind === 'import' ? step.source : null
  useEffect(() => {
    if (importing === null) return
    let alive = true
    importPack(pack.card.slug)
      .then((result) => alive && setStep({ kind: 'done', source: importing, result }))
      .catch((e) => alive && setStep({ kind: 'error', message: e instanceof Error ? e.message : '导入失败' }))
    return () => {
      alive = false
    }
  }, [importing, pack.card.slug])

  // Esc 关；导入进行中不让关，免得以为没导完
  const closable = step.kind !== 'import'
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && closable) onClose(changed.current)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [closable, onClose])

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 sm:items-center"
      onClick={(e) => e.target === e.currentTarget && closable && onClose(changed.current)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`解锁「${pack.card.title}」`}
        className="animate-rise w-full max-w-[26rem] rounded-t-[20px] bg-washi px-6 pt-7 pb-8 sm:rounded-[20px]"
      >
        <div className="flex items-baseline justify-between">
          <p className="font-mincho text-xl tracking-[0.1em]">
            {step.kind === 'done' ? '已经放进你的账号' : step.kind === 'import' ? '正在放进你的账号' : `解锁 ${pack.card.title}`}
          </p>
          {closable && (
            <button onClick={() => onClose(changed.current)} className="text-sm text-hai transition hover:text-sumi">
              关闭
            </button>
          )}
        </div>

        {step.kind === 'pay' && (
          <>
            {pack.card.priceCents != null && (
              <p className="mt-4 text-center font-mincho text-[2.4rem]">{formatPrice(pack.card.priceCents)}</p>
            )}
            {step.checkout.qrUrl && (
              // 支付宝的「嵌入式二维码」：一个只有二维码的页面，宽度下单时定好了
              <iframe
                title="支付宝付款二维码"
                src={step.checkout.qrUrl}
                className="mx-auto mt-3 block h-[200px] w-[200px] rounded-xl bg-white"
              />
            )}
            <p className="mt-4 text-center text-sm leading-relaxed text-hai">
              用支付宝扫一扫
              <br />
              付完这里会自己往下走，不用刷新
            </p>
            <p className="mt-4 text-center">
              <a href={step.checkout.payUrl} className="text-xs text-ai underline-offset-4 hover:underline">
                扫不了？去支付宝收银台付 →
              </a>
            </p>
          </>
        )}

        {step.kind === 'confirm' && (
          <p className="mt-6 text-sm leading-relaxed text-hai">
            {step.slow
              ? '还没收到支付宝的结果。付过了的话稍等一下，这里会自己往下走；没付的话可以关掉重来。'
              : '正在等支付宝确认这笔付款…'}
          </p>
        )}

        {(step.kind === 'import' || step.kind === 'done') && (
          <ImportRows pack={pack} source={step.source} result={step.kind === 'done' ? step.result : null} />
        )}

        {step.kind === 'done' && (
          <button onClick={() => onClose(true)} className={`${PRIMARY} mt-6 w-full justify-center`}>
            好了
          </button>
        )}

        {step.kind === 'error' && (
          <>
            <p className="mt-6 text-sm text-shu">{step.message}</p>
            <button
              onClick={() => setStep({ kind: 'import', source: '再试一次' })}
              className={`${PRIMARY} mt-6 w-full justify-center`}
            >
              再导一次
            </button>
          </>
        )}
      </div>
    </div>
  )
}

/** 一行一行亮起来：哪样东西放到了哪儿。数字从 0 数上去，看得见东西真的进来了。 */
function ImportRows({ pack, source, result }: { pack: PackDetail; source: string; result: PackImport | null }) {
  const cards = useCountUp(result?.cardsImported ?? 0, result !== null, 0)
  const articles = useCountUp(result?.articlesImported ?? 0, result !== null, 500)
  const rows: { label: string; value: ReactNode; ready: boolean }[] = [
    { label: source, value: '✓', ready: true },
    {
      label: '卡片',
      value: result ? `${cards} 张 → 「${result.deckName}」${result.cardsSkipped ? `，${result.cardsSkipped} 张已有` : ''}` : '…',
      ready: result !== null,
    },
    {
      label: '阅读',
      value: result ? `${articles} 篇 → 阅读${result.articlesSkipped ? `，${result.articlesSkipped} 篇已有` : ''}` : '…',
      ready: result !== null,
    },
  ]
  if (pack.essays.length > 0) {
    rows.push({ label: '随笔', value: result ? `${pack.essays.length} 篇 → 在资料包里读` : '…', ready: result !== null })
  }
  return (
    <ul className="mt-6">
      {rows.map((row) => (
        <li
          key={row.label}
          className={`flex items-baseline justify-between gap-4 border-t border-usu py-3.5 text-sm transition-opacity duration-500 ${row.ready ? '' : 'opacity-40'}`}
        >
          {row.label}
          <span className={`text-right text-xs ${row.ready ? 'text-ai' : 'text-hai'}`}>{row.value}</span>
        </li>
      ))}
    </ul>
  )
}

function useCountUp(target: number, run: boolean, delayMs: number): number {
  const [value, setValue] = useState(0)
  useEffect(() => {
    if (!run) return
    let frame = 0
    const begin = performance.now() + delayMs
    const tick = (now: number) => {
      const t = Math.max(0, Math.min(1, (now - begin) / 600))
      setValue(Math.round(target * (1 - (1 - t) ** 3)))
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [target, run, delayMs])
  return value
}

// ---- 小零件 --------------------------------------------------------------

function Big({ n, unit }: { n: number; unit: string }) {
  return (
    <div className="text-xs text-sumi/60">
      <span className="block font-mincho text-[2rem] leading-tight text-sumi">{n}</span>
      {unit}
    </div>
  )
}

function Section({
  title,
  count,
  hint,
  delay,
  children,
}: {
  title: string
  count: string
  hint: string
  delay: number
  children: ReactNode
}) {
  return (
    <section style={{ animationDelay: `${delay}s` }} className="animate-rise mt-14">
      <div className="mb-4 flex items-baseline justify-between gap-4">
        <h2 className="font-mincho text-xl tracking-[0.25em]">
          {title}
          <span className="ml-2.5 font-ui text-xs tracking-normal text-hai">{count}</span>
        </h2>
        <p className="text-right text-xs text-hai">{hint}</p>
      </div>
      {children}
    </section>
  )
}

/** 卡片：正面是词，背面是读音和背面的头两行（词性、意思）。悬停翻，触屏点一下翻。 */
function FlipCard({ front, reading, back }: { front: string; reading: string | null; back: string | null }) {
  const [flipped, setFlipped] = useState(false)
  const lines = (back ?? '').split('\n').map((l) => l.trim()).filter((l) => l !== '' && l !== reading)
  return (
    <button
      type="button"
      onClick={() => setFlipped(!flipped)}
      data-flipped={flipped || undefined}
      className="flip-card h-40 w-30 shrink-0 snap-start text-left"
      aria-label={`${front}，点一下翻面`}
    >
      <div className="relative h-full w-full">
        <div lang="ja" className="flip-face absolute inset-0 flex items-center justify-center rounded-xl border border-usu bg-washi p-3 text-center font-mincho text-[1.6rem] leading-tight">
          <Furigana text={front} />
        </div>
        <div className="flip-face flip-back absolute inset-0 flex flex-col items-center justify-center gap-1.5 rounded-xl border border-usu bg-washi p-3 text-center">
          {reading && <span lang="ja" className="text-[0.95rem] text-ai">{reading}</span>}
          {lines.slice(0, 2).map((l) => (
            <span key={l} className="line-clamp-2 text-xs text-hai">
              <Furigana text={l} />
            </span>
          ))}
        </div>
      </div>
    </button>
  )
}

function Tile({ to, children }: { to: string | null; children: ReactNode }) {
  const className =
    'relative block overflow-hidden rounded-[14px] border border-usu bg-washi px-5 pt-4.5 pb-4 transition duration-300'
  if (!to) return <div className={className}>{children}</div>
  return (
    <Link to={to} className={`${className} hover:-translate-y-0.5 hover:shadow-[0_10px_28px_-16px_rgb(0_0_0/0.3)]`}>
      {children}
    </Link>
  )
}

function Badge({
  children,
  muted = false,
  outline = false,
  lock = false,
}: {
  children?: ReactNode
  muted?: boolean
  outline?: boolean
  lock?: boolean
}) {
  return (
    <span
      className={`absolute top-4 right-4 inline-flex items-center gap-1 rounded-full text-[0.7rem] tracking-wider ${
        outline ? 'border border-ai/40 px-2.5 py-0.5 text-ai' : muted ? 'text-hai' : 'text-[var(--ink)]'
      }`}
    >
      {lock && (
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" className="h-3 w-3" aria-hidden>
          <rect x="3" y="7" width="10" height="7" rx="1.5" />
          <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
        </svg>
      )}
      {children}
    </span>
  )
}
