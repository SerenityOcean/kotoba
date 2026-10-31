import { useState } from 'react'
import { createExam } from '../api'
import { annotateExam, readExamFile } from '../exam'
import type { ParsedExam } from '../exam'

/** 和后端 ExamRequest 的上限一致 */
const MAX_TITLE = 200

interface Item {
  file: string
  parsed: ParsedExam | null
  /** 已经有同名的卷子了：默认不勾，免得同一份导两遍 */
  exists: boolean
  /** 解析不出来、标题太长之类存不进去的原因 */
  invalid: string | null
  selected: boolean
  status: 'pending' | 'done' | 'failed'
  error?: string
}

/**
 * 一次选几份真题（.docx / .txt），每份解析成一张卷子。先列出来看一眼
 * 读到几道题、有没有答案，勾掉不要的，再一份份注音、存进去。
 */
export default function ExamImport({
  existingTitles,
  folderId,
  onImported,
  onCancel,
}: {
  existingTitles: Set<string>
  /** 存进哪个集，不传就是未归档 */
  folderId?: number
  /** 存进去至少一份就会调；plain 是所有卷子加起来没注上音的块数 */
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
    // 一份读不出来不连累别的：各自报各自的错
    const results = await Promise.allSettled(files.map(readExamFile))
    setItems(
      results.map((result, i): Item => {
        if (result.status === 'rejected') {
          const reason = result.reason instanceof Error ? result.reason.message : '读不出来'
          return {
            file: files[i].name,
            parsed: null,
            exists: false,
            invalid: reason,
            selected: false,
            status: 'pending',
          }
        }
        const parsed = result.value
        const exists = existingTitles.has(parsed.title)
        const invalid = parsed.title.length > MAX_TITLE ? '标题太长' : null
        return {
          file: files[i].name,
          parsed,
          exists,
          invalid,
          selected: !exists && !invalid,
          status: 'pending',
        }
      }),
    )
    setParsing(false)
  }

  function toggle(index: number) {
    setItems(
      (list) =>
        list?.map((item, i) => (i === index ? { ...item, selected: !item.selected } : item)) ??
        null,
    )
  }

  function update(index: number, patch: Partial<Item>) {
    setItems((list) => list?.map((item, i) => (i === index ? { ...item, ...patch } : item)) ?? null)
  }

  async function handleImport() {
    if (!items) return
    const queue = items.flatMap((item, i) => (item.selected && item.status !== 'done' ? [i] : []))
    if (queue.length === 0) return

    setImporting(true)
    setError(null)
    let saved = 0
    let plainTotal = 0
    for (const index of queue) {
      const { parsed } = items[index]
      if (!parsed) continue
      try {
        const { content, plain } = await annotateExam(parsed.content, (done, total) =>
          setCurrent({ title: parsed.title, done, total }),
        )
        await createExam(parsed.title, content, folderId)
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
    if (saved < queue.length) setError(`${queue.length - saved} 份没存进去，可以再点一次重试`)
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
        一个文件是一份卷子，读解、言語知識都行：「問題10」起一道大题，「本文（1）」「本文A」起一篇
        （言語知識没有本文也行），「問55」起一道题，下面「1. …」是选项；【正解】后面
        「問題10　55-59 ：3，4，4，1，2」是答案，「—」那题不计分。第一行当标题。.docx
        里的下划线会原样保留。
      </p>

      {items && (
        <ul className="max-h-96 overflow-y-auto border-y border-usu">
          {items.map((item, i) => {
            const disabled = !!item.invalid || item.status === 'done' || importing
            const warnings = item.parsed?.warnings ?? []
            return (
              <li key={item.file + i} className="border-b border-usu last:border-b-0">
                <label
                  className={`flex items-baseline gap-3 py-2.5 ${disabled ? '' : 'cursor-pointer'}`}
                >
                  <input
                    type="checkbox"
                    checked={item.selected}
                    disabled={disabled}
                    onChange={() => toggle(i)}
                    className="accent-ai"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-mincho text-base">
                      {item.parsed?.title ?? item.file}
                    </span>
                    {item.parsed && (
                      <span className="block truncate text-xs text-hai">
                        {item.parsed.content.sections.length} 道大题 · {item.parsed.questionCount}{' '}
                        题
                        {warnings.length > 0 && (
                          <span className="text-shu"> · {warnings.join('，')}</span>
                        )}
                      </span>
                    )}
                  </span>
                  <span className="w-20 shrink-0 text-right text-xs">
                    {item.status === 'done' ? (
                      <span className="text-ai">已存</span>
                    ) : item.status === 'failed' ? (
                      <span className="text-shu" title={item.error}>
                        失败
                      </span>
                    ) : item.invalid ? (
                      <span className="text-shu" title={item.invalid}>
                        {item.parsed ? item.invalid : '读不出来'}
                      </span>
                    ) : item.exists ? (
                      <span className="text-hai">已存在</span>
                    ) : null}
                  </span>
                </label>
                {!item.parsed && item.invalid && (
                  <p className="-mt-1 pb-2.5 pl-6 text-xs text-shu">{item.invalid}</p>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {items && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
          <button
            onClick={handleImport}
            disabled={importing || selectedCount === 0}
            className="rounded-sm bg-ai px-5 py-2.5 text-sm text-washi transition hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-30"
          >
            {importing ? '导入中…' : `导入 ${selectedCount} 份`}
          </button>
          <span className="min-w-0 truncate text-xs text-hai">
            {current
              ? `${current.title} · 注音中… ${current.done}/${current.total}`
              : '每份都会先加上振假名再保存'}
          </span>
        </div>
      )}

      {error && <p className="text-sm text-shu">{error}</p>}
    </div>
  )
}
