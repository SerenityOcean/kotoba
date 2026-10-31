import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { UNFILED, deleteExam, fetchExams, fetchFolders, moveExams } from '../api'
import type { ExamSummary, FolderListing } from '../api'
import { useAuth } from '../auth-context'
import ExamImport from '../components/ExamImport'
import FolderBar from '../components/FolderBar'
import MoveBar from '../components/MoveBar'
import { draftKey, readDraft } from '../exam-draft'

/** 「2015年7月」排在「2015年12月」前面：数字按大小比，不按字符 */
const byTitle = new Intl.Collator('zh-CN', { numeric: true })

/** 列表里难的排前面：最该回头看的是它们 */
const LEVEL_NAMES: [string, string][] = [
  ['3', '难'],
  ['2', '一般'],
  ['1', '简单'],
]

/**
 * 应试：导进来的真题。排版和阅读列表一个样 —— 一份一行，标题、题数，
 * 下面一行是做到哪儿、标了几道难题，再下面是导入日期。
 * 按标题排：一套真题按年份月份排下来，比按导入时间好找。
 * 选中的集放在地址栏里（`?folder=2`，0 是未归档）。卷子不多，按集筛在前端做。
 */
export default function ExamsPage() {
  const { user } = useAuth()
  const [params, setParams] = useSearchParams()
  const folderParam = params.get('folder')
  const scope = folderParam !== null && /^\d+$/.test(folderParam) ? Number(folderParam) : null
  // 选中的是某个真的集：新导入的卷子进它；全部、未归档就不归档
  const targetFolder = scope !== null && scope !== UNFILED ? scope : undefined
  const [exams, setExams] = useState<ExamSummary[] | null>(null)
  const [folders, setFolders] = useState<FolderListing | null>(null)
  const [error, setError] = useState<string | null>(null)
  // 导入完的提醒（有几块没注上音）。单放：导入完列表会重新取，取成功会清掉 error
  const [notice, setNotice] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  // 正在确认删除的那份。删除要点两下：第一下只是问一句
  const [confirming, setConfirming] = useState<number | null>(null)
  // 多选挪集：null 是没在选，否则是选中的卷子 id
  const [picked, setPicked] = useState<Set<number> | null>(null)
  // 存、删之后加一，列表重新取
  const [version, setVersion] = useState(0)
  const [query, setQuery] = useState('')

  useEffect(() => {
    fetchExams()
      .then((list) => {
        setExams(list.toSorted((a, b) => byTitle.compare(a.title, b.title)))
        setError(null)
      })
      .catch((e) => setError(e instanceof Error ? e.message : '加载失败'))
  }, [version])

  useEffect(() => {
    fetchFolders('EXAM')
      .then(setFolders)
      .catch(() => {})
  }, [version])

  const titles = useMemo(() => new Set(exams?.map((exam) => exam.title)), [exams])

  function togglePick(id: number) {
    setPicked((current) => {
      const next = new Set(current)
      if (!next.delete(id)) next.add(id)
      return next
    })
  }

  async function handleDelete(id: number) {
    try {
      await deleteExam(id)
      setConfirming(null)
      setVersion((v) => v + 1)
    } catch (e) {
      setError(e instanceof Error ? e.message : '删除失败')
    }
  }

  const keyword = query.trim()
  // 当前集里的卷子：统计、搜索都只看它们
  const inScope = exams?.filter(
    (exam) =>
      scope === null || (scope === UNFILED ? exam.folderId === null : exam.folderId === scope),
  )
  const shown = inScope?.filter((exam) => exam.title.includes(keyword)) ?? []
  const folderNames = new Map(folders?.folders.map((f) => [f.id, f.name]))
  const latest = inScope?.reduce<string | null>(
    (max, exam) => (max === null || exam.createdAt > max ? exam.createdAt : max),
    null,
  )

  return (
    <div>
      {folders && (folders.total > 0 || folders.folders.length > 0) && (
        <FolderBar
          kind="EXAM"
          listing={folders}
          scope={scope}
          onSelect={(next) => {
            setQuery('')
            setParams(next === null ? {} : { folder: String(next) })
          }}
          onChanged={() => setVersion((v) => v + 1)}
          onError={setError}
        />
      )}

      {inScope && inScope.length > 0 && (
        <section className="mb-8 border-b border-usu pb-6">
          <div className="flex items-end gap-10">
            <Stat label="卷子" value={inScope.length} accent />
            <Stat label="题目" value={inScope.reduce((sum, exam) => sum + exam.questionCount, 0)} />
            {latest && (
              <div>
                <div className="font-mincho text-2xl tabular-nums text-sumi">
                  {new Date(latest).toLocaleDateString('zh-CN', {
                    month: 'numeric',
                    day: 'numeric',
                  })}
                </div>
                <div className="mt-1 text-xs tracking-wider text-hai">最近导入</div>
              </div>
            )}
          </div>
        </section>
      )}

      <section className="mb-8 border-b border-usu pb-8">
        {importing ? (
          <ExamImport
            existingTitles={titles}
            folderId={targetFolder}
            onImported={(count, plain) => {
              setNotice(
                plain > 0 ? `导入了 ${count} 份，但有 ${plain} 块没能注音，那几块是原样存的` : null,
              )
              setVersion((v) => v + 1)
            }}
            onCancel={() => setImporting(false)}
          />
        ) : (
          <button
            onClick={() => {
              setImporting(true)
              setError(null)
              setNotice(null)
            }}
            className="rounded-sm border border-sumi px-5 py-2.5 text-sm transition hover:bg-sumi hover:text-washi"
          >
            导入真题
          </button>
        )}
        {!importing && picked === null && exams && exams.length > 0 && folders && (
          <button
            onClick={() => setPicked(new Set())}
            className="ml-4 text-sm text-hai transition hover:text-sumi"
          >
            多选挪集
          </button>
        )}

        {notice && <p className="mt-3 text-sm text-shu">{notice}</p>}
        {error && <p className="mt-3 text-sm text-shu">{error}</p>}
      </section>

      {inScope && inScope.length > 1 && (
        <div className="mb-2 flex items-baseline gap-4 border-b border-usu pb-1.5 focus-within:border-ai">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="按标题搜索"
            className="min-w-0 flex-1 bg-transparent text-sm placeholder:text-hai/40 focus:outline-none"
          />
          {keyword !== '' && shown.length > 0 && (
            <span className="shrink-0 text-xs tabular-nums text-hai">找到 {shown.length} 份</span>
          )}
        </div>
      )}

      {picked !== null && folders && (
        <MoveBar
          kind="EXAM"
          listing={folders}
          count={picked.size}
          pageSize={shown.length}
          onSelectAll={() => setPicked(new Set(shown.map((e) => e.id)))}
          onMove={async (folderId) => {
            try {
              await moveExams([...picked], folderId)
              setPicked(null)
              setError(null)
              setVersion((v) => v + 1)
            } catch (e) {
              setError(e instanceof Error ? e.message : '挪动失败')
            }
          }}
          onCancel={() => setPicked(null)}
        />
      )}

      {!exams ? (
        !error && <p className="text-sm text-hai">加载中…</p>
      ) : exams.length === 0 ? (
        <p className="py-10 text-center text-sm leading-relaxed text-hai">
          还没有卷子。把读解、言語知識真题的 .docx
          导进来，就能逐题练：选完马上对答案，还能给每道题标难度。
        </p>
      ) : inScope?.length === 0 ? (
        <p className="py-10 text-center text-sm text-hai">这个集里还没有卷子。</p>
      ) : shown.length === 0 ? (
        <p className="py-10 text-center text-sm text-hai">没有标题包含「{keyword}」的卷子。</p>
      ) : (
        <ul>
          {shown.map((exam) => (
            <li key={exam.id} className="group border-b border-usu py-4">
              <div className="flex items-baseline gap-3">
                {picked !== null && (
                  <input
                    type="checkbox"
                    checked={picked.has(exam.id)}
                    onChange={() => togglePick(exam.id)}
                    aria-label={`选中「${exam.title}」`}
                    className="shrink-0 accent-ai"
                  />
                )}
                <Link
                  to={`/exam/${exam.id}`}
                  className="min-w-0 flex-1 font-mincho text-lg transition hover:text-ai"
                >
                  {exam.title}
                </Link>
                <span className="shrink-0 text-xs tabular-nums text-hai">
                  {exam.questionCount} 题
                </span>
                {confirming === exam.id ? (
                  <span className="flex shrink-0 items-baseline gap-3 text-xs">
                    <button
                      onClick={() => handleDelete(exam.id)}
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
                  <button
                    onClick={() => setConfirming(exam.id)}
                    className="shrink-0 text-xs text-hai transition hover:text-shu sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
                  >
                    删除
                  </button>
                )}
              </div>
              {confirming === exam.id ? (
                <p className="mt-1 text-sm text-shu">
                  删除「{exam.title}」？做过的记录也一起删掉，找不回来。
                </p>
              ) : (
                <p className="mt-1 truncate text-sm text-hai">
                  {progress(exam, readDraft(draftKey(user?.id, exam.id)))}
                </p>
              )}
              <p className="mt-1 text-xs text-hai/70">
                {new Date(exam.createdAt).toLocaleDateString('zh-CN')}
                {scope === null && exam.folderId !== null && folderNames.has(exam.folderId) && (
                  <span className="ml-3">{folderNames.get(exam.folderId)}</span>
                )}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/**
 * 标题下面那一行：做到第几题（这台设备上的进度）、各档难度标了几题、做完过几遍。
 * 一样都没有就是「还没开始」。
 */
function progress(exam: ExamSummary, draft: ReturnType<typeof readDraft>): string {
  const parts: string[] = []
  const answered = draft ? Object.keys(draft.answers).length : 0
  if (answered > 0) parts.push(`做到 ${answered} / ${exam.questionCount}`)
  const marked = LEVEL_NAMES.flatMap(([level, name]) =>
    exam.markCounts[level] ? [`${name} ${exam.markCounts[level]}`] : [],
  )
  if (marked.length > 0) parts.push(`标了 ${marked.join('、')}`)
  const last = exam.lastAttempt
  if (last) parts.push(`做完过 ${exam.attemptCount} 遍，上次 ${last.correct}/${last.graded}`)
  return parts.length > 0 ? parts.join(' · ') : '还没开始'
}

/** 和阅读页的统计块同一套观感 —— 大字号数字 + 小字标签。 */
function Stat({
  label,
  value,
  accent = false,
}: {
  label: string
  value: number
  accent?: boolean
}) {
  return (
    <div>
      <div className={`font-mincho text-4xl tabular-nums ${accent ? 'text-ai' : 'text-sumi'}`}>
        {value.toLocaleString('zh-CN')}
      </div>
      <div className="mt-1 text-xs tracking-wider text-hai">{label}</div>
    </div>
  )
}
