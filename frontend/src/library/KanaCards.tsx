import { useEffect, useRef, useState } from 'react'
import { KANA } from './kana'
import type { Kana, KanaTable } from './kana'

/**
 * 一张五十音表，排成卡片。滚到眼前时一张张浮上来；点一下翻面，背面是另一种写法、
 * 罗马音和字源。右上角切换正面先看平假名还是片假名。
 *
 * 尺寸都用 em，跟着随笔阅读器的字号一起缩放。动效在 index.css 里（.kana-*），
 * 系统设了「减少动态效果」就不浮、不转，直接换面。
 */
export default function KanaCards({ table }: { table: KanaTable }) {
  const rows = KANA[table]
  const columns = rows[0].cells.length
  const [front, setFront] = useState<'hira' | 'kata'>('hira')
  const [flipped, setFlipped] = useState<Set<string>>(new Set())
  const [shown, setShown] = useState(false)
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = root.current
    if (!el || typeof IntersectionObserver === 'undefined') {
      setShown(true)
      return
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true)
          observer.disconnect()
        }
      },
      { threshold: 0.15 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  function toggle(key: string) {
    setFlipped((prev) => {
      const next = new Set(prev)
      if (!next.delete(key)) next.add(key)
      return next
    })
  }

  function switchFront(next: 'hira' | 'kata') {
    setFront(next)
    setFlipped(new Set())
  }

  let order = 0

  return (
    <div
      ref={root}
      data-skip
      className="my-[2.2em] rounded-[18px] border border-[var(--edge)] bg-[var(--tint)] px-[0.9em] pt-[1em] pb-[1.2em] text-left tint-take sm:px-[1.4em]"
    >
      <div className="mb-[0.9em] flex items-baseline justify-between gap-3 font-ui">
        <span className="text-[0.72em] tracking-[0.3em] text-[var(--ink)]">{table === '浊音' ? '浊音・半浊音' : table}</span>
        <span className="flex gap-[0.2em] text-[0.72em]" role="group" aria-label="正面先看">
          {(['hira', 'kata'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => switchFront(s)}
              aria-pressed={front === s}
              className={`rounded-full px-[0.8em] py-[0.15em] transition ${
                front === s ? 'bg-[var(--ink)] text-washi' : 'text-hai hover:text-sumi'
              }`}
            >
              {s === 'hira' ? 'ひらがな' : 'カタカナ'}
            </button>
          ))}
        </span>
      </div>

      <div className="space-y-[0.45em]">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center gap-[0.45em]">
            <span lang="ja" className="w-[2.4em] shrink-0 font-ui text-[0.62em] tracking-wider text-hai">
              {row.label}
            </span>
            <div
              className="grid flex-1 gap-[0.45em]"
              style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
            >
              {row.cells.map((kana, i) => {
                if (!kana) return <span key={i} aria-hidden="true" />
                const key = kana.hira
                return (
                  <Card
                    key={key}
                    kana={kana}
                    front={front}
                    flipped={flipped.has(key)}
                    onFlip={() => toggle(key)}
                    shown={shown}
                    delay={order++ * 22}
                    wide={columns === 3}
                  />
                )
              })}
            </div>
          </div>
        ))}
      </div>

      <p className="mt-[1em] font-ui text-[0.68em] text-hai">点卡片翻面，再点一下翻回来。</p>
    </div>
  )
}

function Card({
  kana,
  front,
  flipped,
  onFlip,
  shown,
  delay,
  wide,
}: {
  kana: Kana
  front: 'hira' | 'kata'
  flipped: boolean
  onFlip: () => void
  shown: boolean
  delay: number
  /** 拗音一行只有三张，卡片宽、字是两个假名 */
  wide: boolean
}) {
  const face = front === 'hira' ? kana.hira : kana.kata
  const other = front === 'hira' ? kana.kata : kana.hira

  return (
    <button
      type="button"
      onClick={onFlip}
      aria-pressed={flipped}
      aria-label={`${face}，读 ${kana.romaji}，点一下翻面`}
      style={{ animationDelay: `${delay}ms` }}
      // 卡片里的字按卡片自己的宽度定大小（cqw）：手机上一张卡只有三四十像素宽，固定字号会撑破。
      // 行高也要收紧，随笔正文的 2.05 继承过来同样会撑破
      className={`kana-card @container group relative block w-full leading-[1.15] [perspective:600px] ${shown ? 'kana-in' : 'opacity-0'} ${
        wide ? 'aspect-[5/3]' : 'aspect-[4/5]'
      }`}
    >
      <span className={`kana-flip absolute inset-0 block ${flipped ? 'kana-flipped' : ''}`}>
        <span
          lang="ja"
          className="kana-face absolute inset-0 flex flex-col items-center justify-center rounded-[10px] border border-[var(--edge)] bg-washi shadow-[0_1px_0_rgba(0,0,0,0.04)] transition-shadow group-hover:shadow-[0_6px_16px_rgba(0,0,0,0.08)]"
        >
          <span className={`font-mincho leading-none ${wide ? 'text-[34cqw]' : 'text-[56cqw]'}`}>{face}</span>
        </span>
        <span
          lang="ja"
          className="kana-face kana-back absolute inset-0 flex flex-col items-center justify-center rounded-[10px] bg-[var(--ink)] text-washi"
        >
          <span className={`font-mincho leading-none ${wide ? 'text-[28cqw]' : 'text-[42cqw]'}`}>{other}</span>
          <span className={`mt-[4cqw] font-ui tracking-wider ${wide ? 'text-[11cqw]' : 'text-[17cqw]'}`}>{kana.romaji}</span>
          {kana.from && (
            // 字源，固定「平假名的・片假名的」这个顺序，不跟着正面换
            <span className="mt-[3cqw] font-mincho text-[15cqw] opacity-80" title="字源：平假名・片假名">
              {kana.from.hira}・{kana.from.kata ?? '—'}
            </span>
          )}
        </span>
      </span>
    </button>
  )
}
