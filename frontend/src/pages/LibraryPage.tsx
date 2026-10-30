import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchShelf, formatPrice } from '../api'
import type { LibraryEssayCard, PackCard, Shelf } from '../api'
import { useTilt } from '../library/tilt'

/**
 * 资料页：上面是谁都能读的随笔（题目竖排，像一本书的扉页），下面是一个个资料包。
 * 资料包是带颜色的卡片，封面一个大字，右上角露出几张里面的卡 —— 不点进去也知道里面是什么。
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
        <div className="space-y-6">
          {shelf.essays.map((essay, i) => (
            <FeaturedEssay key={essay.slug} essay={essay} delay={i * 0.08} />
          ))}
        </div>
      )}

      <div className="mt-14 mb-6 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="shrink-0 font-mincho text-2xl tracking-[0.3em]">资料包</h2>
        <p className="text-xs text-hai">解锁后卡片和文章自动放进你的账号</p>
      </div>

      {shelf.packs.length === 0 ? (
        <p className="py-10 text-center text-sm text-hai">还在准备第一个资料包。</p>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 md:gap-6">
          {shelf.packs.map((pack, i) => (
            <PackTile key={pack.slug} pack={pack} delay={0.08 + i * 0.08} />
          ))}
        </div>
      )}
    </div>
  )
}

/** 谁都能读的那篇：题目竖排在左边，右边是开头几行，往下淡出去。 */
function FeaturedEssay({ essay, delay }: { essay: LibraryEssayCard; delay: number }) {
  return (
    <Link
      to={`/essay/${essay.slug}`}
      style={{ animationDelay: `${delay}s` }}
      className="group animate-rise grid grid-cols-[auto_minmax(0,1fr)] gap-x-7 rounded-[18px] border border-usu bg-washi px-5 pt-8 pb-7 shadow-[0_1px_2px_rgb(0_0_0/0.03),0_10px_28px_-16px_rgb(0_0_0/0.2)] transition-colors duration-300 hover:border-ai/40 sm:gap-x-12 sm:px-9 sm:pt-11 sm:pb-10"
    >
      <div className="flex items-start gap-3 font-mincho [writing-mode:vertical-rl]">
        <span className="pt-1 font-ui text-[0.7rem] tracking-[0.5em] text-ai">随笔</span>
        <span className="text-[1.9rem] leading-none tracking-[0.3em] sm:text-[2.6rem]">{essay.title}</span>
      </div>

      <div className="flex min-w-0 flex-col">
        <div className="flex items-center gap-2 text-xs tracking-wider text-hai">
          <span className="rounded-full border border-ai/40 px-2.5 py-0.5 text-ai">免费</span>
          {!essay.publishedAt && <span className="text-shu">草稿</span>}
        </div>
        <p className="fade-out mt-5 max-h-[8.2em] overflow-hidden font-mincho text-[1.02rem] leading-[2.05] sm:text-[1.12rem]">
          {essay.excerpt}
        </p>
        <div className="mt-auto flex items-baseline justify-between pt-4 text-xs text-hai">
          <span>
            约 {essay.minutes} 分钟
            {essay.publishedAt && ` · ${new Date(essay.publishedAt).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })}`}
          </span>
          <span className="text-ai">
            开始读{' '}
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
          <Count n={pack.cardCount} unit="张卡" />
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
          to={`/library/${pack.slug}`}
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

function Count({ n, unit }: { n: number; unit: string }) {
  return (
    <span>
      <span className="mr-0.5 font-mincho text-lg text-sumi">{n}</span>
      {unit}
    </span>
  )
}
