import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { deleteArticle, fetchArticle, updateArticle } from '../api'
import type { Article } from '../api'
import ArticleForm from '../components/ArticleForm'
import { readingListPath, stripFurigana } from '../reading'

/**
 * 改一篇文章。编辑框里是剥掉注音的纯文本 —— 方括号满屏没法改；
 * 存的时候只有动过的行重新注音，没动的沿用原来的。
 *
 * 删除也放在这儿，和列表里一样要点两下。
 */
export default function ArticleEditPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [article, setArticle] = useState<Article | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!id) return
    fetchArticle(Number(id))
      .then(setArticle)
      .catch((e) => setError(e instanceof Error ? e.message : '加载失败'))
  }, [id])

  async function handleDelete() {
    if (!article) return
    setDeleting(true)
    try {
      await deleteArticle(article.id)
      navigate(readingListPath(), { replace: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : '删除失败')
      setDeleting(false)
    }
  }

  if (!article) {
    return error ? (
      <p className="text-sm text-shu">{error}</p>
    ) : (
      <p className="text-sm text-hai">加载中…</p>
    )
  }

  const articlePath = `/reading/${article.id}`

  return (
    <div>
      <Link to={articlePath} className="text-xs text-hai transition hover:text-sumi">
        ← 回到文章
      </Link>

      <div className="mt-6">
        <ArticleForm
          initial={{
            title: article.title,
            body: stripFurigana(article.body),
            sourceUrl: article.sourceUrl ?? '',
          }}
          previousBody={article.body}
          submitLabel="保存修改"
          hint="改过的段落会重新注音，没动的段落保留原来的注音"
          onSave={async (draft, plain) => {
            await updateArticle(article.id, draft.title, draft.body, draft.sourceUrl)
            navigate(articlePath, {
              replace: true,
              state: plain > 0 ? { notice: `改好了，但有 ${plain} 段没能注音，那几段是原样存的` } : null,
            })
          }}
          onCancel={() => navigate(articlePath)}
        />
      </div>

      <section className="mt-16 border-t border-usu pt-6 text-xs">
        {confirming ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-shu">删除「{article.title}」？删了就找不回来了</span>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="rounded-sm bg-shu px-3 py-1 text-washi transition hover:opacity-85 disabled:opacity-30"
            >
              {deleting ? '删除中…' : '确认删除'}
            </button>
            <button
              onClick={() => setConfirming(false)}
              disabled={deleting}
              className="text-hai transition hover:text-sumi"
            >
              取消
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirming(true)}
            className="text-hai transition hover:text-shu"
          >
            删除这篇文章
          </button>
        )}
        {error && <p className="mt-3 text-sm text-shu">{error}</p>}
      </section>
    </div>
  )
}
