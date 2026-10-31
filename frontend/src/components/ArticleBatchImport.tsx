import { useState } from 'react'
import { createArticle, fetchArticles } from '../api'
import { passageTitle, readBatchFile } from '../batch'
import { annotateArticle } from '../reading'

/** 和后端 ArticleRequest 的上限一致 */
const MAX_TITLE = 200
const MAX_BODY = 50000

interface Item {
  title: string
  body: string
  /** 已经有同名文章了：默认不勾，免得同一个文件导两遍 */
  exists: boolean
  /** 超长之类存不进去的原因 */
  invalid: string | null
  selected: boolean
  status: 'pending' | 'done' | 'failed'
  error?: string
}

/**
 * 一次选几个 .docx / .txt，每个文件按「本文」切成几篇，标题是文件名加编号。
 * 先列出来看一眼、勾掉不要的，再一篇篇注音、存进去。
 */
export default function ArticleBatchImport({
  folderId,
  onImported,
  onCancel,
}: {
  /** 存进哪个集，不传就是未归档 */
  folderId?: number
  /** 存进去至少一篇就会调；plain 是所有文章加起来没注上音的段数 */
  onImported: (count: number, plain: number) => void
  onCancel: () => void
}) {
  const [items, setItems] = useState<Item[] | null>(null)
  const [parsing, setParsing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [current, setCurrent] = useState<{ title: string; done: number; total: number } | null>(
    null,
  )
  const [error, setError] = useState<string | null>(null)

  async function handleFiles(files: File[]) {
    setParsing(true)
    setError(null)
    setItems(null)
    try {
      const parsed = await Promise.all(files.map(readBatchFile))
      // 同名的查一下：标题里含文件名的都拿回来比对
      const existing = new Set<string>()
      await Promise.all(
        parsed.map(async ({ name }) => {
          const found = await fetchArticles(0, name, 100)
          for (const article of found.articles) existing.add(article.title)
        }),
      )

      const next = parsed.flatMap(({ name, passages }) =>
        passages.map((body, i): Item => {
          const title = passageTitle(name, i, passages.length)
          const exists = existing.has(title)
          const invalid =
            title.length > MAX_TITLE
              ? '标题太长'
              : body.length > MAX_BODY
                ? '正文超过 5 万字'
                : null
          return { title, body, exists, invalid, selected: !exists && !invalid, status: 'pending' }
        }),
      )
      if (next.length === 0) throw new Error('文件里没有读到文字')
      setItems(next)
    } catch (e) {
      setError(e instanceof Error ? e.message : '解析失败')
    } finally {
      setParsing(false)
    }
  }

  function toggle(index: number) {
    setItems((list) =>
      list?.map((item, i) => (i === index ? { ...item, selected: !item.selected } : item)) ?? null,
    )
  }

  async function handleImport() {
    if (!items) return
    // 倒着存：列表按保存时间倒序，这样 01 排在最上面，「下一篇」是 02
    const queue = items.flatMap((item, i) => (item.selected && item.status !== 'done' ? [i] : []))
    queue.reverse()
    if (queue.length === 0) return

    setImporting(true)
    setError(null)
    let saved = 0
    let plainTotal = 0
    for (const index of queue) {
      const item = items[index]
      try {
        const { text, plain } = await annotateArticle(item.body, null, (done, total) =>
          setCurrent({ title: item.title, done, total }),
        )
        await createArticle(item.title, text, undefined, folderId)
        saved += 1
        plainTotal += plain
        update(index, { status: 'done', selected: false })
      } catch (e) {
        update(index, { status: 'failed', error: e instanceof Error ? e.message : '保存失败' })
      }
    }
    setCurrent(null)
    setImporting(false)
    if (saved > 0) onImported(saved, plainTotal)
    if (saved < queue.length) setError(`${queue.length - saved} 篇没存进去，可以再点一次重试`)
  }

  function update(index: number, patch: Partial<Item>) {
    setItems((list) => list?.map((item, i) => (i === index ? { ...item, ...patch } : item)) ?? null)
  }

  const selectedCount = items?.filter((item) => item.selected).length ?? 0

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-4">
        <label
          className={`inline-block rounded-sm border border-usu px-4 py-2 text-sm text-hai transition ${
            importing ? 'opacity-30' : 'cursor-pointer hover:border-sumi hover:text-sumi'
          }`}
        >
          {parsing ? '读取中…' : items ? '重新选择文件' : '选择 .docx / .txt 文件（可多选）'}
          <input
            type="file"
            accept=".docx,.txt"
            multiple
            disabled={importing}
            className="hidden"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? [])
              if (files.length > 0) handleFiles(files)
              e.target.value = '' // 允许重复选同一个文件
            }}
          />
        </label>
        <button
          onClick={onCancel}
          disabled={importing}
          className="text-xs text-hai transition hover:text-sumi disabled:opacity-30"
        >
          {items?.some((item) => item.status === 'done') ? '收起' : '取消'}
        </button>
      </div>

      <p className="text-xs leading-relaxed text-hai">
        每个文件按「本文（1）」「本文A」这样的标记切成几篇，标题用文件名加编号；
        「本文B」接在「本文A」后面，【正解】之后的答案不导入。没有标记的文件整个算一篇。
      </p>

      {items && (
        <ul className="max-h-96 overflow-y-auto border-y border-usu">
          {items.map((item, i) => (
            <li key={item.title + i} className="border-b border-usu last:border-b-0">
              <label
                className={`flex items-baseline gap-3 py-2.5 ${
                  item.invalid || item.status === 'done' || importing ? '' : 'cursor-pointer'
                }`}
              >
                <input
                  type="checkbox"
                  checked={item.selected}
                  disabled={!!item.invalid || item.status === 'done' || importing}
                  onChange={() => toggle(i)}
                  className="accent-ai"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-mincho text-base">{item.title}</span>
                  <span className="block truncate text-xs text-hai">
                    {item.body.split('\n', 1)[0]}
                  </span>
                </span>
                <span className="shrink-0 text-xs tabular-nums text-hai">
                  {item.body.length.toLocaleString('zh-CN')} 字
                </span>
                <span className="w-16 shrink-0 text-right text-xs">
                  {item.status === 'done' ? (
                    <span className="text-ai">已存</span>
                  ) : item.status === 'failed' ? (
                    <span className="text-shu" title={item.error}>
                      失败
                    </span>
                  ) : item.invalid ? (
                    <span className="text-shu">{item.invalid}</span>
                  ) : item.exists ? (
                    <span className="text-hai">已存在</span>
                  ) : null}
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}

      {items && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
          <button
            onClick={handleImport}
            disabled={importing || selectedCount === 0}
            className="rounded-sm bg-ai px-5 py-2.5 text-sm text-washi transition hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-30"
          >
            {importing ? '导入中…' : `导入 ${selectedCount} 篇`}
          </button>
          <span className="min-w-0 truncate text-xs text-hai">
            {current
              ? `${current.title} · 注音中… ${current.done}/${current.total} 段`
              : '每篇都会先加上振假名再保存，篇数多要等一会儿'}
          </span>
        </div>
      )}

      {error && <p className="text-sm text-shu">{error}</p>}
    </div>
  )
}
