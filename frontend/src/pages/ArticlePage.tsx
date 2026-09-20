import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { fetchArticle } from '../api'
import type { Article } from '../api'
import { useAnalysis } from '../analysis'
import Furigana from '../components/Furigana'
import AnalysisResults, { SaveBar } from '../components/AnalysisResults'

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
  const [selection, setSelection] = useState('')
  const analysis = useAnalysis()

  useEffect(() => {
    if (!id) return
    fetchArticle(Number(id))
      .then(setArticle)
      .catch((e) => setError(e instanceof Error ? e.message : '加载失败'))
  }, [id])

  /**
   * 选中了什么。用 selectionchange 而不是 mouseup：键盘选、触屏拖动
   * 调整选区这些都能跟上，mouseup 只认鼠标那一种。
   */
  useEffect(() => {
    function onSelectionChange() {
      setSelection(window.getSelection()?.toString().trim() ?? '')
    }
    document.addEventListener('selectionchange', onSelectionChange)
    return () => document.removeEventListener('selectionchange', onSelectionChange)
  }, [])

  if (error) return <p className="text-sm text-shu">{error}</p>
  if (!article) return <p className="text-sm text-hai">加载中…</p>

  const showPanel = analysis.slots.length > 0

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

        {/* 选中了但还没拆：浮一条出来，点了才花钱 */}
        {selection !== '' && !showPanel && (
          <div className="sticky bottom-0 -mx-4 mt-10 border-t border-usu bg-washi px-4 py-4 sm:-mx-8 sm:px-8">
            <button
              onClick={() => analysis.run(selection)}
              className="rounded-sm bg-ai px-5 py-2.5 text-sm text-washi transition hover:opacity-85"
            >
              拆解选中的 {selection.length} 字
            </button>
          </div>
        )}
      </div>

      {showPanel && (
        <aside
          className="fixed inset-x-0 bottom-0 z-10 max-h-[72vh] overflow-y-auto border-t border-usu bg-washi px-4 pb-4 shadow-[0_-4px_24px_rgba(0,0,0,0.06)] sm:px-8 xl:sticky xl:inset-auto xl:top-8 xl:max-h-[calc(100vh-4rem)] xl:border-t-0 xl:border-l xl:px-6 xl:pt-1 xl:shadow-none"
        >
          <div className="sticky top-0 z-10 mb-3 flex items-baseline justify-between bg-washi pt-4 pb-2 xl:pt-3">
            <span className="text-xs tracking-widest text-hai">拆解</span>
            <button
              onClick={() => {
                analysis.reset()
                setSelection('')
              }}
              className="text-xs text-hai transition hover:text-sumi"
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
