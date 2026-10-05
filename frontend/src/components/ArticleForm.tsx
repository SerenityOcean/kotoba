import { useState } from 'react'
import { annotateArticle } from '../reading'

export interface ArticleDraft {
  title: string
  /** 已经注好音的正文 */
  body: string
  sourceUrl: string | undefined
}

/**
 * 存文章、改文章共用的表单：填完先给正文注音，再交给 onSave 去存。
 *
 * 改文章时 initial.body 是剥掉注音的纯文本（编辑框里看不到方括号），
 * previousBody 是原来带注音的正文 —— 没动过的行沿用原来的注音。
 *
 * onSave 抛错会显示在表单里，表单保持原样，可以改了再存。
 */
export default function ArticleForm({
  initial = { title: '', body: '', sourceUrl: '' },
  previousBody = null,
  submitLabel,
  hint,
  onSave,
  onCancel,
}: {
  initial?: { title: string; body: string; sourceUrl: string }
  previousBody?: string | null
  submitLabel: string
  hint: string
  /** plain：没注上音、原样存下的段数 */
  onSave: (draft: ArticleDraft, plain: number) => Promise<void>
  onCancel: () => void
}) {
  const [title, setTitle] = useState(initial.title)
  const [body, setBody] = useState(initial.body)
  const [sourceUrl, setSourceUrl] = useState(initial.sourceUrl)
  const [saving, setSaving] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    if (title.trim() === '' || body.trim() === '') {
      setError('标题和正文都不能为空')
      return
    }

    setSaving(true)
    setError(null)
    try {
      const { text, plain } = await annotateArticle(body, previousBody, (done, total) =>
        setProgress({ done, total }),
      )
      await onSave({ title, body: text, sourceUrl: sourceUrl || undefined }, plain)
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存失败')
    } finally {
      setSaving(false)
      setProgress(null)
    }
  }

  return (
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
          rows={previousBody === null ? 10 : 18}
          placeholder="把文章正文粘在这里。段落和换行会原样保留。"
          className="w-full resize-y border border-usu bg-transparent p-3 font-mincho text-base leading-relaxed placeholder:font-ui placeholder:text-sm placeholder:text-hai/40 focus:border-ai focus:outline-none"
        />
      </label>

      <label>
        <span className="mb-1 block text-xs tracking-wider text-hai">来源链接（可不填）</span>
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
          {saving ? '保存中…' : submitLabel}
        </button>
        <button
          onClick={onCancel}
          disabled={saving}
          className="text-xs text-hai transition hover:text-sumi disabled:opacity-30"
        >
          取消
        </button>
        <span className="text-xs text-hai">
          {progress && progress.total > 0
            ? `注音中… ${progress.done}/${progress.total} 段`
            : hint}
        </span>
      </div>

      {error && <p className="text-sm text-shu">{error}</p>}
    </div>
  )
}
