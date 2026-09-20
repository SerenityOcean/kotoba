import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { fetchArticle } from '../api'
import type { Article } from '../api'
import { useAnalysis } from '../analysis'
import Furigana from '../components/Furigana'
import AnalysisResults, { SaveBar } from '../components/AnalysisResults'

/**
 * 读文章。选中看不懂的一段，底部弹出拆解结果，勾一勾就建成卡片 ——
 * 读、查、记在同一个页面里闭环，不用来回切。
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
   * 选中了什么。用 selectionchange 而不是 mouseup：键盘选、触屏调整
   * 选区这些都能跟上，而 mouseup 只认鼠标那一种。
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
    <div>
      <Link to="/reading" className="text-xs text-hai transition hover:text-sumi">
        ← 阅读
      </Link>

      <article className="mt-4">
        <h1 className="font-mincho text-2xl leading-loose sm:text-3xl">
          <Furigana text={article.title} />
        </h1>
        <p className="mt-2 text-xs text-hai">
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

        {/* leading-loose 给振假名留出行间空隙，否则假名会贴到上一行 */}
        <div className="mt-8 font-mincho text-lg leading-loose whitespace-pre-wrap sm:text-xl">
          <Furigana text={article.body} />
        </div>
      </article>

      {/* 选中了东西但还没拆：底部浮一条，点了才花钱 */}
      {selection !== '' && !showPanel && (
        <div className="sticky bottom-0 -mx-4 border-t border-usu bg-washi px-4 py-4 sm:-mx-6 sm:px-6">
          <button
            onClick={() => analysis.run(selection)}
            className="rounded-sm bg-ai px-5 py-2.5 text-sm text-washi transition hover:opacity-85"
          >
            拆解选中的 {selection.length} 字
          </button>
        </div>
      )}

      {showPanel && (
        <div className="fixed inset-x-0 bottom-0 z-10 max-h-[70vh] overflow-y-auto border-t border-usu bg-washi shadow-[0_-4px_24px_rgba(0,0,0,0.06)]">
          <div className="mx-auto max-w-xl px-4 py-4 sm:px-6">
            <div className="mb-3 flex items-baseline justify-between">
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
          </div>
        </div>
      )}
    </div>
  )
}
