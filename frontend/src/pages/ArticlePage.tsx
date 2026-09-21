import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { fetchArticle, fetchArticles } from '../api'
import type { Article, ArticleSummary } from '../api'
import { useAnalysis } from '../analysis'
import Furigana from '../components/Furigana'
import AnalysisResults, { SaveBar } from '../components/AnalysisResults'

/**
 * 取当前选区的纯文本。
 *
 * 不能直接用 selection.toString()：振假名是 <ruby><rt>，浏览器会把读音
 * 一起拼进字符串 ——「違って」变成「違ちがって」，送给模型就是一句
 * 根本不存在的日语。所以克隆选区、摘掉 <rt> 再取文本。
 */
function readSelection(): string {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
    return ''
  }
  const fragment = selection.getRangeAt(0).cloneContents()
  fragment.querySelectorAll('rt, rp').forEach((node) => node.remove())
  return (fragment.textContent ?? '').trim()
}

/**
 * 读文章。选中看不懂的一段就地拆解，勾一勾建成卡片 ——
 * 读、查、记在同一个页面里闭环。
 *
 * 拆解面板在窄屏上是底部弹层，宽屏上变成右侧栏（xl 断点）：
 * 弹层会盖掉大半个屏幕，而宽屏本来就有空地方，没必要挡着正文。
 */
export default function ArticlePage() {
  const { id } = useParams()
  const [article, setArticle] = useState<Article | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [siblings, setSiblings] = useState<ArticleSummary[]>([])
  const [selection, setSelection] = useState('')
  // 已经拆过的那段。选中它时不用再弹按钮 —— 没有新东西可拆
  const [analyzed, setAnalyzed] = useState('')
  const analysis = useAnalysis()
  // 单独取出来：analysis 每次渲染都是新对象，但 reset 被 useCallback 包过、
  // 身份稳定，effect 依赖它才不会无限重跑
  const { reset } = analysis

  function analyze(text: string) {
    setAnalyzed(text)
    analysis.run(text)
  }

  useEffect(() => {
    if (!id) return
    // 换文章时先清空：否则新的还没到，旧正文还挂在屏幕上，像是没跳转
    setArticle(null)
    setSelection('')
    setAnalyzed('')
    reset()
    window.scrollTo(0, 0)

    fetchArticle(Number(id))
      .then(setArticle)
      .catch((e) => setError(e instanceof Error ? e.message : '加载失败'))
  }, [id, reset])

  // 上一篇/下一篇要知道自己在整个列表里的位置。列表只有摘要，很轻，
  // 而且顺序（保存时间倒序）就是导航顺序，不用后端再算一次
  useEffect(() => {
    fetchArticles()
      .then(setSiblings)
      .catch(() => {})
  }, [])

  /**
   * 选中了什么。用 selectionchange 而不是 mouseup：键盘选、触屏拖动
   * 调整选区这些都能跟上，mouseup 只认鼠标那一种。
   */
  useEffect(() => {
    function onSelectionChange() {
      setSelection(readSelection())
    }
    document.addEventListener('selectionchange', onSelectionChange)
    return () => document.removeEventListener('selectionchange', onSelectionChange)
  }, [])

  if (error) return <p className="text-sm text-shu">{error}</p>
  if (!article) return <p className="text-sm text-hai">加载中…</p>

  // 列表是保存时间倒序，所以「上一篇」是列表里更靠上、也就是更新的那篇
  const index = siblings.findIndex((a) => a.id === article.id)
  const previous = index > 0 ? siblings[index - 1] : null
  const next = index >= 0 && index < siblings.length - 1 ? siblings[index + 1] : null

  const showPanel = analysis.slots.length > 0
  // 选中了新的一段（不是刚拆过那段）才值得提示
  const pending = selection !== '' && selection !== analyzed ? selection : ''

  return (
    <div
      className={
        showPanel ? 'xl:grid xl:grid-cols-[minmax(0,1fr)_26rem] xl:items-start xl:gap-12' : ''
      }
    >
      {/* 弹层盖住底部时给正文留出余量，否则最后几行够不着。侧栏模式不需要 */}
      <div className={showPanel ? 'pb-[72vh] xl:pb-0' : ''}>
        <Link to="/reading" className="text-xs text-hai transition hover:text-sumi">
          ← 阅读
        </Link>

        <article className="mt-5">
          <h1 className="font-mincho text-3xl leading-[1.9] sm:text-4xl">
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
          </p>

          {/* 行高给振假名留空隙，否则假名会贴到上一行；正文限宽保证一行的字数不至于读着累 */}
          <div className="mt-10 max-w-[38rem] font-mincho text-lg leading-[2.4] whitespace-pre-wrap sm:text-xl">
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
                  {previous.title}
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
                <span className="mt-1 block truncate font-mincho text-base">{next.title}</span>
              </Link>
            ) : (
              <span className="flex-1" />
            )}
          </nav>
        )}

        {/* 选中了但还没拆：浮一条出来，点了才花钱。面板开着时按钮挪到面板顶部 */}
        {pending !== '' && !showPanel && (
          <div className="sticky bottom-0 -mx-4 mt-10 border-t border-usu bg-washi px-4 py-4 sm:-mx-8 sm:px-8">
            <button
              onClick={() => analyze(pending)}
              className="rounded-sm bg-ai px-5 py-2.5 text-sm text-washi transition hover:opacity-85"
            >
              拆解选中的 {pending.length} 字
            </button>
          </div>
        )}
      </div>

      {showPanel && (
        <aside
          className="fixed inset-x-0 bottom-0 z-10 max-h-[72vh] overflow-y-auto border-t border-usu bg-washi px-4 pb-4 shadow-[0_-4px_24px_rgba(0,0,0,0.06)] sm:px-8 xl:sticky xl:inset-auto xl:top-8 xl:max-h-[calc(100vh-4rem)] xl:border-t-0 xl:border-l xl:px-6 xl:pt-1 xl:shadow-none"
        >
          <div className="sticky top-0 z-10 mb-3 flex items-baseline justify-between gap-3 bg-washi pt-4 pb-2 xl:pt-3">
            {/* 面板开着时又选了新的一段 —— 按钮放这儿，不用先收起再选 */}
            {pending !== '' ? (
              <button
                onClick={() => analyze(pending)}
                className="rounded-sm bg-ai px-3 py-1.5 text-xs text-washi transition hover:opacity-85"
              >
                拆解新选中的 {pending.length} 字
              </button>
            ) : (
              <span className="text-xs tracking-widest text-hai">拆解</span>
            )}
            <button
              onClick={() => {
                analysis.reset()
                setSelection('')
                setAnalyzed('')
              }}
              className="shrink-0 text-xs text-hai transition hover:text-sumi"
            >
              收起
            </button>
          </div>

          {analysis.error && <p className="mb-3 text-sm text-shu">{analysis.error}</p>}
          <AnalysisResults analysis={analysis} />
          {analysis.hasResults && <SaveBar analysis={analysis} sticky={false} />}
        </aside>
      )}
    </div>
  )
}
