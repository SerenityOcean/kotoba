import { useEffect, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import {
  UNFILED,
  createArticle,
  deleteArticle,
  fetchArticleStats,
  fetchArticles,
  fetchFolders,
  fileImportedArticles,
  moveArticles,
} from '../api'
import type { ArticleList, ArticleStats, FolderListing } from '../api'
import ArticleBatchImport from '../components/ArticleBatchImport'
import ArticleForm from '../components/ArticleForm'
import FolderBar from '../components/FolderBar'
import Furigana from '../components/Furigana'
import MoveBar from '../components/MoveBar'
import Pagination from '../components/Pagination'
import { rememberListSearch, stripFurigana } from '../reading'

const PAGE_SIZE = 20

/** 搜索框停手这么久才去查，免得每敲一个字发一次请求。 */
const SEARCH_DELAY = 300

/**
 * 读过的文章列表。翻页和搜索都交给后端，页码、搜索词和选中的集放在地址栏里
 * （`?folder=2&page=3&q=…`）—— 点进一篇再回来，还停在原来那一页。
 * folder 不写是全部，0 是没进任何集的。
 */
export default function ArticlesPage() {
  const location = useLocation()
  const [params, setParams] = useSearchParams()
  // 地址栏里的页码从 1 数，人看着顺；后端从 0 数
  const page = Math.max(1, Math.floor(Number(params.get('page'))) || 1)
  const q = params.get('q') ?? ''
  const folderParam = params.get('folder')
  const scope = folderParam !== null && /^\d+$/.test(folderParam) ? Number(folderParam) : null
  // 选中的是某个真的集：新存的文章进它；全部、未归档就不归档
  const targetFolder = scope !== null && scope !== UNFILED ? scope : undefined

  const [list, setList] = useState<ArticleList | null>(null)
  const [stats, setStats] = useState<ArticleStats | null>(null)
  const [folders, setFolders] = useState<FolderListing | null>(null)
  const [error, setError] = useState<string | null>(null)
  // 存、删之后加一，列表和统计跟着重新取
  const [version, setVersion] = useState(0)

  const [query, setQuery] = useState(q)
  // 正在存一篇，还是在批量导入
  const [adding, setAdding] = useState<'one' | 'batch' | null>(null)
  // 正在确认删除的那篇。删除要点两下：第一下只是问一句
  const [confirming, setConfirming] = useState<number | null>(null)
  // 多选挪集：null 是没在选，否则是选中的文章 id
  const [picked, setPicked] = useState<Set<number> | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    rememberListSearch(location.search)
  }, [location.search])

  useEffect(() => {
    // 搜索词变得快，先发的请求可能后回来 —— 过时的结果直接扔掉
    let stale = false
    fetchArticles(page - 1, q, PAGE_SIZE, scope ?? undefined)
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
  }, [page, q, scope, version])

  useEffect(() => {
    fetchArticleStats(scope ?? undefined)
      .then(setStats)
      .catch(() => {})
  }, [scope, version])

  useEffect(() => {
    fetchFolders('ARTICLE')
      .then(setFolders)
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
      () => setParams(withScope(scope, keyword === '' ? {} : { q: keyword }), { replace: true }),
      SEARCH_DELAY,
    )
    return () => clearTimeout(timer)
  }, [query, q, scope, setParams])

  // 页码超出了（比如删光了最后一页，或者手改了地址栏）就落到最后一页
  useEffect(() => {
    if (list && list.totalPages > 0 && page > list.totalPages) {
      setParams(pageParams(params, list.totalPages), { replace: true })
    }
  }, [list, page, params, setParams])

  function togglePick(id: number) {
    setPicked((current) => {
      const next = new Set(current)
      if (!next.delete(id)) next.add(id)
      return next
    })
  }

  async function handleFileImported() {
    try {
      const filed = await fileImportedArticles()
      setNotice(filed > 0 ? `整理了 ${filed} 篇，按资料包归进了对应的集` : '没有可整理的：没进集的文章都对不上已导入的资料包')
      setError(null)
      setVersion((v) => v + 1)
    } catch (e) {
      setError(e instanceof Error ? e.message : '整理失败')
    }
  }

  async function handleDelete(id: number) {
    try {
      await deleteArticle(id)
      setConfirming(null)
      setVersion((v) => v + 1)
    } catch (e) {
      setError(e instanceof Error ? e.message : '删除失败')
    }
  }

  const folderNames = new Map(folders?.folders.map((f) => [f.id, f.name]))

  return (
    <div>
      {folders && (folders.total > 0 || folders.folders.length > 0) && (
        <FolderBar
          kind="ARTICLE"
          listing={folders}
          scope={scope}
          onSelect={(next) => {
            setQuery('')
            setParams(withScope(next, {}))
          }}
          onChanged={() => setVersion((v) => v + 1)}
          onError={setError}
        />
      )}

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
        {adding === null ? (
          <div className="flex flex-wrap items-center gap-4">
            <button
              onClick={() => {
                setAdding('one')
                setError(null)
              }}
              className="rounded-sm border border-sumi px-5 py-2.5 text-sm transition hover:bg-sumi hover:text-washi"
            >
              存一篇文章
            </button>
            <button
              onClick={() => {
                setAdding('batch')
                setError(null)
              }}
              className="text-sm text-hai transition hover:text-sumi"
            >
              从文件批量导入
            </button>
            {folders && folders.unfiled > 0 && (
              <button
                onClick={handleFileImported}
                className="text-sm text-hai transition hover:text-sumi"
                title="把导入过的资料包里的文章，按包归进集里"
              >
                按资料包整理
              </button>
            )}
            {list && list.articles.length > 0 && folders && picked === null && (
              <button
                onClick={() => setPicked(new Set())}
                className="text-sm text-hai transition hover:text-sumi"
              >
                多选挪集
              </button>
            )}
          </div>
        ) : adding === 'batch' ? (
          <ArticleBatchImport
            folderId={targetFolder}
            onImported={(count, plain) => {
              setError(
                plain > 0 ? `导入了 ${count} 篇，但有 ${plain} 段没能注音，那几段是原样存的` : null,
              )
              setQuery('')
              setParams(withScope(scope, {}))
              setVersion((v) => v + 1)
            }}
            onCancel={() => setAdding(null)}
          />
        ) : (
          <ArticleForm
            submitLabel="保存"
            hint="保存时会给全文加上振假名，长文章要等一会儿"
            onSave={async (draft, plain) => {
              await createArticle(draft.title, draft.body, draft.sourceUrl, targetFolder)
              setAdding(null)
              setError(plain > 0 ? `存好了，但有 ${plain} 段没能注音，那几段是原样存的` : null)
              // 新存的排在最前面：回第一页、清掉搜索，才看得到它
              setQuery('')
              setParams(withScope(scope, {}))
              setVersion((v) => v + 1)
            }}
            onCancel={() => setAdding(null)}
          />
        )}

        {notice && <p className="mt-3 text-sm text-hai">{notice}</p>}
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

      {picked !== null && list && folders && (
        <MoveBar
          kind="ARTICLE"
          listing={folders}
          count={picked.size}
          pageSize={list.articles.length}
          onSelectAll={() => setPicked(new Set(list.articles.map((a) => a.id)))}
          onMove={async (folderId) => {
            try {
              await moveArticles([...picked], folderId)
              setPicked(null)
              setNotice(null)
              setError(null)
              setVersion((v) => v + 1)
            } catch (e) {
              setError(e instanceof Error ? e.message : '挪动失败')
            }
          }}
          onCancel={() => setPicked(null)}
        />
      )}

      {!list ? (
        <p className="text-sm text-hai">加载中…</p>
      ) : stats?.count === 0 ? (
        <p className="py-10 text-center text-sm text-hai">
          {scope === null ? '还没有文章。把你最近读的那篇存进来。' : '这个集里还没有文章。'}
        </p>
      ) : list.articles.length === 0 && q !== '' ? (
        <p className="py-10 text-center text-sm text-hai">没有标题包含「{q}」的文章。</p>
      ) : (
        <ul>
          {list.articles.map((article) => (
            <li key={article.id} className="group border-b border-usu py-4">
              <div className="flex items-baseline gap-3">
                {picked !== null && (
                  <input
                    type="checkbox"
                    checked={picked.has(article.id)}
                    onChange={() => togglePick(article.id)}
                    aria-label={`选中「${stripFurigana(article.title)}」`}
                    className="shrink-0 accent-ai"
                  />
                )}
                <Link
                  to={`/reading/${article.id}`}
                  className="min-w-0 flex-1 font-mincho text-lg transition hover:text-ai"
                >
                  <Furigana text={article.title} />
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
                <p className="mt-1 text-sm text-shu">删除「{stripFurigana(article.title)}」？删了就找不回来了。</p>
              ) : (
                <p className="mt-1 truncate text-sm text-hai">{article.excerpt}</p>
              )}
              <p className="mt-1 text-xs text-hai/70">
                {new Date(article.createdAt).toLocaleDateString('zh-CN')}
                {scope === null && article.folderId !== null && folderNames.has(article.folderId) && (
                  <span className="ml-3">{folderNames.get(article.folderId)}</span>
                )}
              </p>
            </li>
          ))}
        </ul>
      )}

      {list && (
        <Pagination
          page={page}
          totalPages={list.totalPages}
          onSelect={(n) => {
            setParams(pageParams(params, n))
            // 换页时回到顶上，不然新的一页是从底部开始看的
            window.scrollTo(0, 0)
          }}
        />
      )}
    </div>
  )
}

/** 带上选中的集。全部（null）不写进地址栏。 */
function withScope(scope: number | null, rest: Record<string, string>): Record<string, string> {
  return scope === null ? rest : { folder: String(scope), ...rest }
}

/** 换页码、留着搜索词。第 1 页不写进地址栏，`/reading` 就是第一页。 */
function pageParams(params: URLSearchParams, page: number): URLSearchParams {
  const next = new URLSearchParams(params)
  if (page <= 1) next.delete('page')
  else next.set('page', String(page))
  return next
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
