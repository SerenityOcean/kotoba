import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { fetchArticle, fetchArticleNeighbors, markArticlesRead } from '../api'
import type { Article, ArticleNeighbors } from '../api'
import Furigana from '../components/Furigana'
import AnalysisPanel from '../components/AnalysisPanel'
import SentenceBar from '../components/SentenceBar'
import { useSelectionAnalysis } from '../selection'
import { readingListPath } from '../reading'

/**
 * 读文章。选中看不懂的一段，选区下面弹出浮条：就地拆解、翻译、提问；
 * 拆出来的勾一勾建成卡片 —— 读、查、记在同一个页面里闭环。
 */
export default function ArticlePage() {
  const { id } = useParams()
  // 编辑页存完跳回来时带的话，比如有几段没注上音
  const notice = (useLocation().state as { notice?: string } | null)?.notice
  const [article, setArticle] = useState<Article | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [neighbors, setNeighbors] = useState<ArticleNeighbors | null>(null)
  const selection = useSelectionAnalysis()
  const { showPanel, close } = selection

  useEffect(() => {
    if (!id) return
    // 换文章时先清空：否则新的还没到，旧正文还挂在屏幕上，像是没跳转
    setArticle(null)
    setNeighbors(null)
    close()
    window.scrollTo(0, 0)

    fetchArticle(Number(id))
      .then((loaded) => {
        setArticle(loaded)
        // 打开就算读过；标不上也不碍着看
        if (!loaded.read) markArticlesRead([loaded.id], true).catch(() => {})
      })
      .catch((e) => setError(e instanceof Error ? e.message : '加载失败'))
  }, [id, close])

  // 上一篇/下一篇由后端按列表顺序找 —— 列表分页了，前端手里没有整张表
  useEffect(() => {
    if (!id) return
    fetchArticleNeighbors(Number(id))
      .then(setNeighbors)
      .catch(() => {})
  }, [id])

  if (error) return <p className="text-sm text-shu">{error}</p>
  if (!article) return <p className="text-sm text-hai">加载中…</p>

  // 列表是保存时间倒序，所以「上一篇」是列表里更靠上、也就是更新的那篇
  const previous = neighbors?.previous ?? null
  const next = neighbors?.next ?? null

  return (
    <div
      className={
        showPanel ? 'xl:grid xl:grid-cols-[minmax(0,1fr)_26rem] xl:items-start xl:gap-12' : ''
      }
    >
      {/* 弹层盖住底部时给正文留出余量，否则最后几行够不着。侧栏模式不需要 */}
      <div className={showPanel ? 'pb-[72vh] xl:pb-0' : ''}>
        <Link to={readingListPath()} className="text-xs text-hai transition hover:text-sumi">
          ← 阅读
        </Link>

        {notice && <p className="mt-3 text-sm text-shu">{notice}</p>}

        <article className="mt-5">
          <h1 lang="ja" data-quotable className="font-mincho text-3xl leading-[1.9] sm:text-4xl">
            <Furigana text={article.title} />
          </h1>
          <p className="mt-4 text-xs text-hai">
            {new Date(article.createdAt).toLocaleDateString('zh-CN')}
            {article.sourceUrl && (
              <>
                {' · '}
                <a
                  href={article.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-ai hover:underline"
                >
                  原文
                </a>
              </>
            )}
            {' · '}
            <Link to={`/reading/${article.id}/edit`} className="transition hover:text-ai">
              编辑
            </Link>
          </p>

          {/* 行高给振假名留空隙，否则假名会贴到上一行；正文限宽保证一行的字数不至于读着累 */}
          <div
            lang="ja"
            data-quotable
            className="mt-10 max-w-[38rem] font-mincho text-lg leading-[2.4] whitespace-pre-wrap sm:text-xl"
          >
            <Furigana text={article.body} />
          </div>
        </article>

        {(previous || next) && (
          <nav className="mt-16 flex items-stretch gap-4 border-t border-usu pt-6 text-sm">
            {previous ? (
              <Link
                to={`/reading/${previous.id}`}
                className="group min-w-0 flex-1 transition hover:text-ai"
              >
                <span className="block text-xs text-hai">← 上一篇</span>
                <span className="mt-1 block truncate font-mincho text-base">
                  <Furigana text={previous.title} />
                </span>
              </Link>
            ) : (
              <span className="flex-1" />
            )}

            {next ? (
              <Link
                to={`/reading/${next.id}`}
                className="min-w-0 flex-1 text-right transition hover:text-ai"
              >
                <span className="block text-xs text-hai">下一篇 →</span>
                <span className="mt-1 block truncate font-mincho text-base"><Furigana text={next.title} /></span>
              </Link>
            ) : (
              <span className="flex-1" />
            )}
          </nav>
        )}
      </div>

      {showPanel && <AnalysisPanel selection={selection} />}
      <SentenceBar selection={selection} />
    </div>
  )
}
