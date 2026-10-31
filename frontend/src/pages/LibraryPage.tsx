import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchShelf, formatPrice } from '../api'
import type { LibraryEssayCard, PackCard, Shelf } from '../api'
import { useTilt } from '../library/tilt'
import { splitTitle } from '../library/essay-title'
import { readingPosition } from '../library/reading-position'

/**
 * 资料页：上面是送给所有读者的随笔（题目竖排，像一本书的扉页），下面是一个个资料包，一行三个，
 * 最后一格是「敬请期待」。资料包是带颜色的卡片，封面一个大字，右上角露出几张里面的卡 —— 不点进去也知道里面是什么。
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
          <div className="space-y-6">
            {shelf.essays.map((essay, i) => (
              <FeaturedEssay key={essay.slug} essay={essay} delay={i * 0.08} />
            ))}
          </div>
        </section>
      )}

      <section className={shelf.essays.length > 0 ? 'mt-16' : ''}>
        <SectionHead title="资料包" note="解锁后卡片和文章自动放进你的账号" />
        <div className="grid gap-5 sm:grid-cols-2 md:gap-6 lg:grid-cols-3">
          {shelf.packs.map((pack, i) => (
            <PackTile key={pack.slug} pack={pack} delay={0.08 + i * 0.08} />
          ))}
          <ComingTile delay={0.08 + shelf.packs.length * 0.08} />
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

/**
 * 送给读者的那篇：冒号前的主标题竖排在左边，像书的扉页；右边是副题和开头几行，往下淡出去。
 * 主标题太长竖不下（超过 7 个字），就整个横排在上面。读过一半的，右下角换成「接着读」。
 */
function FeaturedEssay({ essay, delay }: { essay: LibraryEssayCard; delay: number }) {
  const { main, sub } = splitTitle(essay.title)
  const vertical = [...main].length <= 7
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
    <Link
      to={`/essay/${essay.slug}`}
      style={{ animationDelay: `${delay}s` }}
      className={`group animate-rise relative grid overflow-hidden rounded-[18px] border border-usu bg-washi px-5 pt-8 pb-7 shadow-[0_1px_2px_rgb(0_0_0/0.03),0_10px_28px_-16px_rgb(0_0_0/0.2)] transition-[border-color,box-shadow] duration-300 hover:border-ai/40 hover:shadow-[0_1px_2px_rgb(0_0_0/0.03),0_18px_40px_-18px_rgb(0_0_0/0.28)] sm:px-10 sm:pt-11 sm:pb-9 ${
        vertical ? 'grid-cols-[auto_minmax(0,1fr)] gap-x-7 sm:gap-x-12' : 'grid-cols-1'
      }`}
    >
      {/* 右上角一枚朱印：像一封信落了款 */}
      <span
        aria-hidden
        className="absolute top-7 right-8 hidden h-11 w-11 rotate-[-6deg] items-center justify-center rounded-[5px] border-[1.5px] border-shu/70 font-mincho text-[1.3rem] text-shu/80 transition-transform duration-500 group-hover:rotate-[-2deg] sm:flex"
      >
        葉
      </span>

      {vertical && (
        <div className="flex items-start gap-3 font-mincho [writing-mode:vertical-rl]">
          <span className="pt-1 font-ui text-[0.7rem] tracking-[0.5em] text-ai">随笔</span>
          <span className="text-[2rem] leading-none tracking-[0.22em] sm:text-[2.5rem]">{main}</span>
        </div>
      )}

      <div className="flex min-w-0 flex-col sm:pr-14">
        {!vertical && (
          <>
            <span className="text-[0.7rem] tracking-[0.5em] text-ai">随笔</span>
            <h3 className="mt-2 font-mincho text-[1.7rem] leading-snug tracking-[0.1em] sm:text-[2rem]">{main}</h3>
          </>
        )}
        {sub && (
          <p className={`font-mincho text-[1.02rem] leading-snug tracking-[0.04em] sm:text-[1.35rem] sm:tracking-[0.08em] ${vertical ? '' : 'mt-2'}`}>
            {sub}
          </p>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs tracking-wider text-hai">
          <span className="rounded-full border border-ai/40 px-2.5 py-0.5 text-ai">免费</span>
          {!essay.publishedAt && <span className="text-shu">草稿</span>}
          <span>约 {essay.minutes} 分钟</span>
          <span>{essay.chars.toLocaleString()} 字</span>
          {date && <span>{date}</span>}
        </div>
        <p className="fade-out mt-5 max-h-[8.2em] overflow-hidden font-mincho text-[1rem] leading-[2.05] text-sumi/85 sm:text-[1.08rem]">
          {essay.excerpt}
        </p>
        <div className="mt-auto flex items-center justify-end pt-4">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-ai/30 px-4 py-1.5 text-xs tracking-wider text-ai transition-colors duration-300 group-hover:border-ai/60 group-hover:bg-ai/[0.04]">
            {action}
            <span className="inline-block transition-transform duration-300 group-hover:translate-x-1">→</span>
          </span>
        </div>
      </div>
    </Link>
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
 * 架子最后一格：下一个包还在写。和 SOON 的包一样是虚线框，右上角露出几张还没写字的空卡。
 * 不靠后端数据，永远在最后。
 */
function ComingTile({ delay }: { delay: number }) {
  return (
    <div style={{ animationDelay: `${delay}s` }} className="animate-rise">
      <div className="relative flex h-full min-h-[19rem] flex-col overflow-hidden rounded-[18px] border border-dashed border-usu p-6 pb-5">
        <div className="relative h-[7.5rem]">
          <div lang="ja" className="font-mincho text-[5.5rem] leading-none text-usu">
            続
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
          つづく
        </span>
        <h3 className="mt-1.5 font-mincho text-[1.45rem] tracking-[0.12em] text-hai">敬请期待</h3>
        <p className="mt-2.5 text-sm leading-relaxed text-sumi/70">下一个资料包还在写。写好了，它会出现在这里。</p>

        <div className="mt-auto flex items-baseline justify-between pt-4">
          <span className="text-xs text-hai">还在写</span>
        </div>
      </div>
    </div>
  )
}

function Count({ n, unit }: { n: number; unit: string }) {
  return (
    <span>
      <span className="mr-0.5 font-mincho text-lg text-sumi">{n}</span>
      {unit}
    </span>
  )
}
