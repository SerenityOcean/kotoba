import { useEffect, useMemo, useState } from 'react'
import { MAX_QUOTE, quoteCandidates, renderPoster } from './share-poster'

/**
 * 随笔页的「分享」弹层：挑一句话，出一张带二维码的图，手机上长按存相册，再发朋友圈。
 * 图是浏览器里画的（见 share-poster.ts），不经过后端。
 */
export default function SharePoster({
  slug,
  title,
  kicker,
  body,
  onClose,
}: {
  slug: string
  title: string
  kicker: string
  body: string
  onClose: () => void
}) {
  const candidates = useMemo(() => quoteCandidates(body), [body])
  const [quote, setQuote] = useState(candidates[0] ?? title)
  const [image, setImage] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const url = `${window.location.origin}/essay/${slug}`

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // 改字时少画几次：停下 250ms 再重画
  useEffect(() => {
    const text = quote.trim() || title
    const timer = window.setTimeout(() => {
      try {
        setImage(renderPoster({ title, kicker, quote: text, url }))
        setFailed(false)
      } catch {
        setFailed(true)
      }
    }, 250)
    return () => window.clearTimeout(timer)
  }, [quote, title, kicker, url])

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/45 px-3 py-6 sm:py-10">
      <button aria-label="关闭" onClick={onClose} className="fixed inset-0 -z-10 cursor-default" />
      <div role="dialog" aria-label="生成分享图" className="w-full max-w-md rounded-2xl border border-usu bg-washi p-5 shadow-2xl">
        <div className="flex items-center justify-between">
          <p className="font-mincho text-lg">分享图</p>
          <button onClick={onClose} className="rounded-lg px-2 py-1 text-sm text-hai transition hover:bg-usu hover:text-sumi">
            关闭
          </button>
        </div>

        <div className="mt-4 overflow-hidden rounded-xl border border-usu bg-usu/40">
          {image ? (
            <img src={image} alt="分享图预览" className="block w-full" />
          ) : (
            <p className="py-20 text-center text-sm text-hai">{failed ? '这张图没画出来' : '生成中…'}</p>
          )}
        </div>
        <p className="mt-3 text-xs leading-relaxed text-hai">手机上长按图片存到相册，再发朋友圈；电脑上点「保存图片」。</p>

        <label className="mt-5 block text-xs tracking-wider text-hai" htmlFor="share-quote">
          图上的话（可以改）
        </label>
        <textarea
          id="share-quote"
          value={quote}
          maxLength={MAX_QUOTE}
          onChange={(e) => setQuote(e.target.value)}
          rows={3}
          className="mt-2 w-full resize-none rounded-lg border border-usu bg-washi px-3 py-2 font-mincho text-sm leading-relaxed outline-none focus:border-ai"
        />

        {candidates.length > 1 && (
          <>
            <p className="mt-3 text-xs tracking-wider text-hai">或者换一句</p>
            <ul className="mt-2 max-h-44 space-y-1 overflow-y-auto pr-1">
              {candidates.map((c) => (
                <li key={c}>
                  <button
                    onClick={() => setQuote(c)}
                    className={`w-full rounded-lg px-3 py-1.5 text-left font-mincho text-[0.82rem] leading-snug transition ${
                      c === quote ? 'bg-ai/10 text-sumi' : 'text-hai hover:bg-usu hover:text-sumi'
                    }`}
                  >
                    {c}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        <a
          href={image ?? undefined}
          download={`${slug}.png`}
          aria-disabled={!image}
          className={`mt-5 flex w-full items-center justify-center rounded-[10px] bg-ai px-6 py-3 text-sm tracking-wider text-washi transition hover:brightness-110 ${
            image ? '' : 'pointer-events-none opacity-50'
          }`}
        >
          保存图片
        </a>
      </div>
    </div>
  )
}
