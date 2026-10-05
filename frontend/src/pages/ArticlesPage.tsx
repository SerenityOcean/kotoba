import { useEffect, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { createArticle, deleteArticle, fetchArticleStats, fetchArticles } from '../api'
import type { ArticleList, ArticleStats } from '../api'
import ArticleForm from '../components/ArticleForm'
import { rememberListSearch } from '../reading'

const PAGE_SIZE = 20

/** 搜索框停手这么久才去查，免得每敲一个字发一次请求。 */
const SEARCH_DELAY = 300

/**
 * 读过的文章列表。翻页和搜索都交给后端，页码和搜索词放在地址栏里
 * （`?page=3&q=…`）—— 点进一篇再回来，还停在原来那一页。
 */
export default function ArticlesPage() {
  const location = useLocation()
  const [params, setParams] = useSearchParams()
  // 地址栏里的页码从 1 数，人看着顺；后端从 0 数
  const page = Math.max(1, Math.floor(Number(params.get('page'))) || 1)
  const q = params.get('q') ?? ''

  const [list, setList] = useState<ArticleList | null>(null)
  const [stats, setStats] = useState<ArticleStats | null>(null)
  const [error, setError] = useState<string | null>(null)
  // 存、删之后加一，列表和统计跟着重新取
  const [version, setVersion] = useState(0)

  const [query, setQuery] = useState(q)
  const [adding, setAdding] = useState(false)
  // 正在确认删除的那篇。删除要点两下：第一下只是问一句
  const [confirming, setConfirming] = useState<number | null>(null)

  useEffect(() => {
    rememberListSearch(location.search)
  }, [location.search])

  useEffect(() => {
    // 搜索词变得快，先发的请求可能后回来 —— 过时的结果直接扔掉
    let stale = false
    fetchArticles(page - 1, q, PAGE_SIZE)
      .then((result) => {
        if (stale) return
        setList(result)
        setError(null)
      })
      .catch((e) => {
        if (!stale) setError(e instanceof Error ? e.message : '加载失败')
      })
    return () => {
      stale = true
    }
  }, [page, q, version])

  useEffect(() => {
    fetchArticleStats()
      .then(setStats)
      .catch(() => {})
  }, [version])

  // 地址栏的搜索词被前进/后退改了，输入框跟上。是自己刚写进去的就别动，
  // 不然打到一半的空格会被吃掉
  useEffect(() => {
    setQuery((current) => (current.trim() === q ? current : q))
  }, [q])

  // 停手一会儿才把搜索词写进地址栏；换了搜索词从第一页看起
  useEffect(() => {
    const keyword = query.trim()
    if (keyword === q) return
    const timer = setTimeout(
      () => setParams(keyword === '' ? {} : { q: keyword }, { replace: true }),
      SEARCH_DELAY,
    )
    return () => clearTimeout(timer)
  }, [query, q, setParams])

  // 页码超出了（比如删光了最后一页，或者手改了地址栏）就落到最后一页
  useEffect(() => {
    if (list && list.totalPages > 0 && page > list.totalPages) {
      setParams(pageParams(params, list.totalPages), { replace: true })
    }
  }, [list, page, params, setParams])

  async function handleDelete(id: number) {
    try {
      await deleteArticle(id)
      setConfirming(null)
      setVersion((v) => v + 1)
    } catch (e) {
      setError(e instanceof Error ? e.message : '删除失败')
    }
  }

  return (
    <div>
      {stats && stats.count > 0 && (
        <section className="mb-8 border-b border-usu pb-6">
          <div className="flex items-end gap-10">
            <Stat label="文章" value={stats.count} accent />
            <Stat label="总字数" value={stats.chars} />
            {stats.latest && (
              <div>
                <div className="font-mincho text-2xl tabular-nums text-sumi">
                  {new Date(stats.latest).toLocaleDateString('zh-CN', {
                    month: 'numeric',
                    day: 'numeric',
                  })}
                </div>
                <div className="mt-1 text-xs tracking-wider text-hai">最近保存</div>
              </div>
            )}
          </div>
        </section>
      )}

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
          <ArticleForm
            submitLabel="保存"
            hint="保存时会给全文加上振假名，长文章要等一会儿"
            onSave={async (draft, plain) => {
              await createArticle(draft.title, draft.body, draft.sourceUrl)
              setAdding(false)
              setError(plain > 0 ? `存好了，但有 ${plain} 段没能注音，那几段是原样存的` : null)
              // 新存的排在最前面：回第一页、清掉搜索，才看得到它
              setQuery('')
              setParams({})
              setVersion((v) => v + 1)
            }}
            onCancel={() => setAdding(false)}
          />
        )}

        {error && <p className="mt-3 text-sm text-shu">{error}</p>}
      </section>

      {stats && stats.count > 1 && (
        <div className="mb-2 flex items-baseline gap-4 border-b border-usu pb-1.5 focus-within:border-ai">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="按标题搜索"
            className="min-w-0 flex-1 bg-transparent text-sm placeholder:text-hai/40 focus:outline-none"
          />
          {q !== '' && list && list.total > 0 && (
            <span className="shrink-0 text-xs tabular-nums text-hai">找到 {list.total} 篇</span>
          )}
        </div>
      )}

      {!list ? (
        <p className="text-sm text-hai">加载中…</p>
      ) : stats?.count === 0 ? (
        <p className="py-10 text-center text-sm text-hai">
          还没有文章。把你最近读的那篇存进来。
        </p>
      ) : list.articles.length === 0 && q !== '' ? (
        <p className="py-10 text-center text-sm text-hai">没有标题包含「{q}」的文章。</p>
      ) : (
        <ul>
          {list.articles.map((article) => (
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
                {confirming === article.id ? (
                  <span className="flex shrink-0 items-baseline gap-3 text-xs">
                    <button
                      onClick={() => handleDelete(article.id)}
                      className="rounded-sm bg-shu px-2.5 py-1 text-washi transition hover:opacity-85"
                    >
                      确认删除
                    </button>
                    <button
                      onClick={() => setConfirming(null)}
                      className="text-hai transition hover:text-sumi"
                    >
                      取消
                    </button>
                  </span>
                ) : (
                  <span className="flex shrink-0 gap-3 text-xs sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100">
                    <Link
                      to={`/reading/${article.id}/edit`}
                      className="text-hai transition hover:text-ai"
                    >
                      编辑
                    </Link>
                    <button
                      onClick={() => setConfirming(article.id)}
                      className="text-hai transition hover:text-shu"
                    >
                      删除
                    </button>
                  </span>
                )}
              </div>
              {confirming === article.id ? (
                <p className="mt-1 text-sm text-shu">删除「{article.title}」？删了就找不回来了。</p>
              ) : (
                <p className="mt-1 truncate text-sm text-hai">{article.excerpt}</p>
              )}
              <p className="mt-1 text-xs text-hai/70">
                {new Date(article.createdAt).toLocaleDateString('zh-CN')}
              </p>
            </li>
          ))}
        </ul>
      )}

      {list && (
        <Pagination
          page={page}
          totalPages={list.totalPages}
          href={(n) => `?${pageParams(params, n)}`}
        />
      )}
    </div>
  )
}

/** 换页码、留着搜索词。第 1 页不写进地址栏，`/reading` 就是第一页。 */
function pageParams(params: URLSearchParams, page: number): URLSearchParams {
  const next = new URLSearchParams(params)
  if (page <= 1) next.delete('page')
  else next.set('page', String(page))
  return next
}

/**
 * 1 … 4 5 6 … 20：头尾、当前页和左右各一页，其余折成省略号。
 * 只隔着一页时直接把那页写出来 —— 省略号占的地方一样，还看不出是哪页。
 */
function pageWindow(current: number, total: number): (number | null)[] {
  const kept = [...new Set([1, current - 1, current, current + 1, total])]
    .filter((p) => p >= 1 && p <= total)
    .sort((a, b) => a - b)

  const result: (number | null)[] = []
  kept.forEach((p, i) => {
    const gap = i === 0 ? 1 : p - kept[i - 1]
    if (gap === 2) result.push(p - 1)
    else if (gap > 2) result.push(null)
    result.push(p)
  })
  return result
}

function Pagination({
  page,
  totalPages,
  href,
}: {
  page: number
  totalPages: number
  href: (page: number) => string
}) {
  if (totalPages <= 1) return null

  // 换页时回到列表顶上，不然新的一页是从底部开始看的
  const toTop = () => window.scrollTo(0, 0)
  const step = 'px-2 py-1 text-hai transition hover:text-sumi'

  return (
    <nav className="mt-10 flex flex-wrap items-baseline justify-center gap-x-1 gap-y-2 text-sm">
      {page > 1 ? (
        <Link to={href(page - 1)} onClick={toTop} className={`${step} mr-3`}>
          ← 上一页
        </Link>
      ) : (
        <span className="mr-3 px-2 py-1 text-hai/40">← 上一页</span>
      )}

      {pageWindow(page, totalPages).map((p, i) =>
        p === null ? (
          <span key={`gap-${i}`} className="px-1 text-hai/60">
            …
          </span>
        ) : p === page ? (
          <span
            key={p}
            aria-current="page"
            className="min-w-8 border-b border-sumi px-2 py-1 text-center tabular-nums text-sumi"
          >
            {p}
          </span>
        ) : (
          <Link
            key={p}
            to={href(p)}
            onClick={toTop}
            className="min-w-8 border-b border-transparent px-2 py-1 text-center tabular-nums text-hai transition hover:text-sumi"
          >
            {p}
          </Link>
        ),
      )}

      {page < totalPages ? (
        <Link to={href(page + 1)} onClick={toTop} className={`${step} ml-3`}>
          下一页 →
        </Link>
      ) : (
        <span className="ml-3 px-2 py-1 text-hai/40">下一页 →</span>
      )}
    </nav>
  )
}

/** 和首页的统计块同一套观感 —— 大字号数字 + 小字标签。 */
function Stat({ label, value, accent = false }: { label: string; value: number; accent?: boolean }) {
  return (
    <div>
      <div className={`font-mincho text-4xl tabular-nums ${accent ? 'text-ai' : 'text-sumi'}`}>
        {value.toLocaleString('zh-CN')}
      </div>
      <div className="mt-1 text-xs tracking-wider text-hai">{label}</div>
    </div>
  )
}
