import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  annotateFurigana,
  createArticle,
  deleteArticle,
  fetchArticles,
  splitForFurigana,
} from '../api'
import type { ArticleSummary } from '../api'

/** 注音时同时在飞的请求数。 */
const CONCURRENCY = 4

export default function ArticlesPage() {
  const [articles, setArticles] = useState<ArticleSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [adding, setAdding] = useState(false)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)

  async function load() {
    try {
      setArticles(await fetchArticles())
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  /**
   * 存之前先给全文注音：按块并行，每块回来填回原位。
   *
   * 某一块注不上（模型改了正文、或者请求失败）就用原文，不让整篇存不下来 ——
   * 文章是你的东西，注音只是锦上添花，不该因为它丢了正文。
   */
  async function handleSave() {
    if (title.trim() === '' || body.trim() === '') {
      setError('标题和正文都不能为空')
      return
    }

    const pieces = splitForFurigana(body)
    const targets = pieces.flatMap((p, i) => (p.annotate ? [i] : []))
    const annotated = pieces.map((p) => p.text)

    setSaving(true)
    setError(null)
    setProgress({ done: 0, total: targets.length })

    let plain = 0
    let cursor = 0
    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, targets.length) }, async () => {
        while (cursor < targets.length) {
          const index = targets[cursor++]
          try {
            const result = await annotateFurigana(pieces[index].text)
            annotated[index] = result.text
            if (!result.annotated) plain += 1
          } catch {
            plain += 1
          }
          setProgress((p) => (p ? { ...p, done: p.done + 1 } : p))
        }
      }),
    )

    try {
      await createArticle(title, annotated.join(''), sourceUrl || undefined)
      setTitle('')
      setBody('')
      setSourceUrl('')
      setAdding(false)
      if (plain > 0) {
        setError(`存好了，但有 ${plain} 段没能注音，那几段是原样存的`)
      }
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存失败')
    } finally {
      setSaving(false)
      setProgress(null)
    }
  }

  async function handleDelete(id: number) {
    try {
      await deleteArticle(id)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : '删除失败')
    }
  }

  return (
    <div>
      <section className="mb-8 border-b border-usu pb-8">
        {!adding ? (
          <button
            onClick={() => {
              setAdding(true)
              setError(null)
            }}
            className="rounded-sm border border-sumi px-5 py-2.5 text-sm transition hover:bg-sumi hover:text-washi"
          >
            存一篇文章
          </button>
        ) : (
          <div className="flex flex-col gap-4">
            <label>
              <span className="mb-1 block text-xs tracking-wider text-hai">标题</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="台風25号 20日ごろ東日本に接近"
                autoFocus
                className="w-full border-b border-usu bg-transparent pb-1.5 font-mincho text-lg placeholder:font-ui placeholder:text-sm placeholder:text-hai/40 focus:border-ai focus:outline-none"
              />
            </label>

            <label>
              <span className="mb-1 block text-xs tracking-wider text-hai">正文</span>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={10}
                placeholder="把文章正文粘在这里。段落和换行会原样保留。"
                className="w-full resize-y border border-usu bg-transparent p-3 font-mincho text-base leading-relaxed placeholder:font-ui placeholder:text-sm placeholder:text-hai/40 focus:border-ai focus:outline-none"
              />
            </label>

            <label>
              <span className="mb-1 block text-xs tracking-wider text-hai">
                来源链接（可不填）
              </span>
              <input
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder="https://www3.nhk.or.jp/news/..."
                className="w-full border-b border-usu bg-transparent pb-1.5 text-sm placeholder:text-hai/40 focus:border-ai focus:outline-none"
              />
            </label>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded-sm bg-ai px-5 py-2.5 text-sm text-washi transition hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-30"
              >
                {saving ? '保存中…' : '保存'}
              </button>
              <button
                onClick={() => {
                  setAdding(false)
                  setError(null)
                }}
                disabled={saving}
                className="text-xs text-hai transition hover:text-sumi disabled:opacity-30"
              >
                取消
              </button>
              <span className="text-xs text-hai">
                {progress
                  ? `注音中… ${progress.done}/${progress.total} 段`
                  : '保存时会给全文加上振假名，长文章要等一会儿'}
              </span>
            </div>
          </div>
        )}

        {error && <p className="mt-3 text-sm text-shu">{error}</p>}
      </section>

      {loading ? (
        <p className="text-sm text-hai">加载中…</p>
      ) : articles.length === 0 ? (
        <p className="py-10 text-center text-sm text-hai">
          还没有文章。把你最近读的那篇存进来。
        </p>
      ) : (
        <ul>
          {articles.map((article) => (
            <li key={article.id} className="group border-b border-usu py-4">
              <div className="flex items-baseline gap-3">
                <Link
                  to={`/reading/${article.id}`}
                  className="min-w-0 flex-1 font-mincho text-lg transition hover:text-ai"
                >
                  {article.title}
                </Link>
                <span className="shrink-0 text-xs tabular-nums text-hai">
                  {article.length} 字
                </span>
                <button
                  onClick={() => handleDelete(article.id)}
                  className="shrink-0 text-xs text-hai transition hover:text-shu sm:opacity-0 sm:group-hover:opacity-100"
                >
                  删除
                </button>
              </div>
              <p className="mt-1 truncate text-sm text-hai">{article.excerpt}</p>
              <p className="mt-1 text-xs text-hai/70">
                {new Date(article.createdAt).toLocaleDateString('zh-CN')}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
