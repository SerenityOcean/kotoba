import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchShelf, formatPrice } from '../api'
import type { LibraryEssayCard, PackCard, PackTint, Shelf } from '../api'
import { useTilt } from '../library/tilt'
import { splitTitle } from '../library/essay-title'
import { readingPosition } from '../library/reading-position'

/**
 * 资料页：上面是送给所有读者的随笔，下面是一个个资料包。两排是同一种卡片，一行三个，
 * 各自最后一格是「还在写」。资料包是带颜色的卡片，封面一个大字，右上角露出几张里面的卡 —— 不点进去也知道里面是什么。
 */
export default function LibraryPage() {
  const [shelf, setShelf] = useState<Shelf | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchShelf()
      .then(setShelf)
      .catch((e) => setError(e instanceof Error ? e.message : '加载失败'))
  }, [])

  if (error) return <p className="text-sm text-shu">{error}</p>
  if (!shelf) return <p className="text-sm text-hai">加载中…</p>

  return (
    <div>
      {shelf.essays.length > 0 && (
        <section>
          <SectionHead title="送给学语言的你" note="写给每一位读者的长文 · 免费" />
          <div className="grid gap-5 sm:grid-cols-2 md:gap-6 lg:grid-cols-3">
            {shelf.essays.map((essay, i) => (
              <EssayTile key={essay.slug} essay={essay} tint={ESSAY_TINTS[i % ESSAY_TINTS.length]} delay={i * 0.08} />
            ))}
            <ComingTile
              delay={shelf.essays.length * 0.08}
              glyph="綴"
              kana="つづる"
              title="下一篇"
              note="还在写。写好了，它会出现在这里。"
            />
          </div>
        </section>
      )}

      <section className={shelf.essays.length > 0 ? 'mt-16' : ''}>
        <SectionHead title="资料包" note="解锁后卡片、文章和真题自动放进你的账号" />
        <div className="grid gap-5 sm:grid-cols-2 md:gap-6 lg:grid-cols-3">
          {shelf.packs.map((pack, i) => (
            <PackTile key={pack.slug} pack={pack} delay={0.08 + i * 0.08} />
          ))}
          <ComingTile
            delay={0.08 + shelf.packs.length * 0.08}
            glyph="続"
            kana="つづく"
            title="敬请期待"
            note="下一个资料包还在写。写好了，它会出现在这里。"
          />
        </div>
      </section>
    </div>
  )
}

function SectionHead({ title, note }: { title: string; note: string }) {
  return (
    <div className="mb-6 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <h2 className="shrink-0 font-mincho text-2xl tracking-[0.3em]">{title}</h2>
      <p className="text-xs text-hai">{note}</p>
    </div>
  )
}

/** 随笔没有自己的颜色，按顺序轮着用资料包那几种，排在一行里不会撞成一片 */
const ESSAY_TINTS: PackTint[] = ['ai', 'kin', 'sakura', 'take']

/**
 * 送给读者的随笔：和资料包同一种卡片。封面的大字是主标题的头一个字，右上角露出几页竖排的稿纸，
 * 最上面那页写着开头几个字。冒号前是主标题，后面的副题放在标题下面。读过一半的，右下角换成「接着读」。
 */
function EssayTile({ essay, tint, delay }: { essay: LibraryEssayCard; tint: PackTint; delay: number }) {
  const tilt = useTilt<HTMLAnchorElement>()
  const { main, sub } = splitTitle(essay.title)
  const position = readingPosition(`essay:${essay.slug}`)
  const action =
    position === null || position < 0.08
      ? '开始读'
      : position < 0.95
        ? `接着读 · ${Math.round(position * 100)}%`
        : '再读一遍'
  const date = essay.publishedAt
    ? new Date(essay.publishedAt).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })
    : null

  return (
    <div style={{ animationDelay: `${delay}s` }} className="animate-rise">
      <Link
        ref={tilt.ref}
        to={`/essay/${essay.slug}`}
        onPointerMove={tilt.onPointerMove}
        onPointerLeave={tilt.onPointerLeave}
        className={`tint-${tint} group pack-card relative flex h-full min-h-[19rem] flex-col overflow-hidden rounded-[18px] border border-[var(--edge)] bg-[var(--tint)] p-6 pb-5`}
      >
        <div className="relative h-[7.5rem]">
          <div className="pack-glyph font-mincho text-[5.5rem] leading-none text-[var(--ink)]">{[...main][0]}</div>
          {/* 几页竖排的稿纸，最上面那页写着开头 */}
          <div aria-hidden className="pack-fan absolute top-1 right-1 h-28 w-34">
            {[0, 1, 2].map((n) => (
              <span
                key={n}
                className="absolute top-0 right-0 flex h-[5.8rem] w-[4.4rem] justify-center overflow-hidden rounded-[9px] border border-[var(--edge)] bg-washi px-1.5 py-2 font-mincho text-[0.62rem] leading-[1.7] text-sumi/60 shadow-[0_6px_16px_-10px_rgb(0_0_0/0.35)] [writing-mode:vertical-rl]"
              >
                {n === 2 ? [...essay.excerpt].slice(0, 30).join('') : ''}
              </span>
            ))}
          </div>
        </div>

        <span className="text-[0.7rem] tracking-[0.25em] text-[var(--ink)]">
          随笔 · 免费
          {!essay.publishedAt && <span className="ml-2 text-shu">草稿</span>}
        </span>
        <h3 className="mt-1.5 font-mincho text-[1.45rem] tracking-[0.12em]">{main}</h3>
        <p className="mt-2.5 text-sm leading-relaxed text-sumi/70">{sub ?? essay.excerpt}</p>

        <div className="mt-4 flex gap-4 text-xs text-sumi/60">
          <Count n={essay.minutes} unit="分钟" />
          <Count n={essay.chars.toLocaleString()} unit="字" />
        </div>

        <div className="mt-auto flex items-baseline justify-between border-t border-[var(--edge)] pt-4">
          <span className="text-xs text-sumi/60">{date ?? ''}</span>
          <span className="text-xs text-[var(--ink)]">
            {action}{' '}
            <span className="inline-block transition-transform duration-300 group-hover:translate-x-1">→</span>
          </span>
        </div>
      </Link>
    </div>
  )
}

function PackTile({ pack, delay }: { pack: PackCard; delay: number }) {
  const tilt = useTilt<HTMLAnchorElement>()
  const soon = pack.status === 'SOON'

  const body = (
    <>
      <div className="relative h-[7.5rem]">
        <div className={`pack-glyph font-mincho text-[5.5rem] leading-none ${soon ? 'text-usu' : 'text-[var(--ink)]'}`}>
          {pack.glyph}
        </div>
        {!soon && pack.fan.length > 0 && (
          <div className="pack-fan absolute top-1 right-1 h-28 w-34">
            {pack.fan.map((front) => (
              <span
                key={front}
                lang="ja"
                className="absolute top-0 right-0 flex h-[5.8rem] w-[4.4rem] items-center justify-center rounded-[9px] border border-[var(--edge)] bg-washi px-1 text-center font-mincho text-[1.05rem] leading-tight shadow-[0_6px_16px_-10px_rgb(0_0_0/0.35)]"
              >
                {front}
              </span>
            ))}
          </div>
        )}
      </div>

      <span className={`text-[0.7rem] tracking-[0.25em] ${soon ? 'text-hai' : 'text-[var(--ink)]'}`}>
        {pack.level}
        {pack.status === 'DRAFT' && <span className="ml-2 text-shu">草稿</span>}
      </span>
      <h3 className={`mt-1.5 font-mincho text-[1.45rem] tracking-[0.12em] ${soon ? 'text-hai' : ''}`}>
        {pack.title}
      </h3>
      <p className="mt-2.5 text-sm leading-relaxed text-sumi/70">{soon ? pack.note ?? '还在写。' : pack.summary}</p>

      {!soon && (
        <div className="mt-4 flex gap-4 text-xs text-sumi/60">
          {pack.cardCount > 0 && <Count n={pack.cardCount} unit="张卡" />}
          {pack.articleCount > 0 && <Count n={pack.articleCount} unit="篇阅读" />}
          {pack.examCount > 0 && <Count n={pack.examCount} unit="份真题" />}
          {pack.essayCount > 0 && <Count n={pack.essayCount} unit="篇随笔" />}
        </div>
      )}

      <div className={`mt-auto flex items-baseline justify-between pt-4 ${soon ? '' : 'border-t border-[var(--edge)]'}`}>
        {soon ? (
          <span className="text-xs text-hai">还不能解锁</span>
        ) : pack.owned ? (
          <span className="inline-flex items-center gap-1.5 text-sm text-[var(--ink)]">
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            {pack.priceCents === 0 ? '免费' : '已解锁'}
          </span>
        ) : (
          <span className="font-mincho text-xl text-[var(--ink)]">
            {pack.priceCents != null ? formatPrice(pack.priceCents) : ''}
          </span>
        )}
        {!soon && (
          <span className="text-xs text-[var(--ink)]">
            {pack.owned ? '打开' : '看看里面'}{' '}
            <span className="inline-block transition-transform duration-300 group-hover:translate-x-1">→</span>
          </span>
        )}
      </div>
    </>
  )

  const shell = `tint-${pack.tint} relative flex h-full min-h-[19rem] flex-col overflow-hidden rounded-[18px] p-6 pb-5`

  // 浮入的动画和倾斜都用 transform，放在同一个元素上动画结束后会把倾斜盖掉 —— 分两层
  return (
    <div style={{ animationDelay: `${delay}s` }} className="animate-rise">
      {soon ? (
        <div className={`${shell} border border-dashed border-usu`}>{body}</div>
      ) : (
        <Link
          ref={tilt.ref}
          to={pack.entry ? `/essay/${pack.entry}` : `/library/${pack.slug}`}
          onPointerMove={tilt.onPointerMove}
          onPointerLeave={tilt.onPointerLeave}
          className={`${shell} group pack-card border border-[var(--edge)] bg-[var(--tint)]`}
        >
          {body}
        </Link>
      )}
    </div>
  )
}

/**
 * 一排架子的最后一格：下一个还在写。和 SOON 的包一样是虚线框，右上角露出几张还没写字的空卡。
 * 不靠后端数据，永远在最后。随笔和资料包各一格，字不一样。
 */
function ComingTile({
  delay,
  glyph,
  kana,
  title,
  note,
}: {
  delay: number
  glyph: string
  kana: string
  title: string
  note: string
}) {
  return (
    <div style={{ animationDelay: `${delay}s` }} className="animate-rise">
      <div className="relative flex h-full min-h-[19rem] flex-col overflow-hidden rounded-[18px] border border-dashed border-usu p-6 pb-5">
        <div className="relative h-[7.5rem]">
          <div lang="ja" className="font-mincho text-[5.5rem] leading-none text-usu">
            {glyph}
          </div>
          <div aria-hidden className="pack-fan absolute top-1 right-1 h-28 w-34">
            {[0, 1, 2].map((n) => (
              <span
                key={n}
                className="absolute top-0 right-0 flex h-[5.8rem] w-[4.4rem] items-center justify-center rounded-[9px] border border-dashed border-usu bg-washi font-mincho text-[1.05rem] text-usu"
              >
                {n === 2 ? '？' : ''}
              </span>
            ))}
          </div>
        </div>

        <span lang="ja" className="text-[0.7rem] tracking-[0.25em] text-hai">
          {kana}
        </span>
        <h3 className="mt-1.5 font-mincho text-[1.45rem] tracking-[0.12em] text-hai">{title}</h3>
        <p className="mt-2.5 text-sm leading-relaxed text-sumi/70">{note}</p>

        <div className="mt-auto flex items-baseline justify-between pt-4">
          <span className="text-xs text-hai">还在写</span>
        </div>
      </div>
    </div>
  )
}

function Count({ n, unit }: { n: number | string; unit: string }) {
  return (
    <span>
      <span className="mr-0.5 font-mincho text-lg text-sumi">{n}</span>
      {unit}
    </span>
  )
}
