import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { deleteExam, fetchExams } from '../api'
import type { ExamSummary } from '../api'
import ExamImport from '../components/ExamImport'
import { formatMinutes } from '../exam'

/** 「2015年7月」排在「2015年12月」前面：数字按大小比，不按字符 */
const byTitle = new Intl.Collator('zh-CN', { numeric: true })

/**
 * 应试：导进来的读解真题。一份一行，做过的带上次成绩。
 * 按标题排 —— 一套真题按年份月份排下来，比按导入时间好找。
 */
export default function ExamsPage() {
  const [exams, setExams] = useState<ExamSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  // 导入完的提醒（有几块没注上音）。单放：导入完列表会重新取，取成功会清掉 error
  const [notice, setNotice] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  // 正在确认删除的那份。删除要点两下：第一下只是问一句
  const [confirming, setConfirming] = useState<number | null>(null)
  // 存、删之后加一，列表重新取
  const [version, setVersion] = useState(0)

  useEffect(() => {
    fetchExams()
      .then((list) => {
        setExams(list.toSorted((a, b) => byTitle.compare(a.title, b.title)))
        setError(null)
      })
      .catch((e) => setError(e instanceof Error ? e.message : '加载失败'))
  }, [version])

  const titles = useMemo(() => new Set(exams?.map((exam) => exam.title)), [exams])

  async function handleDelete(id: number) {
    try {
      await deleteExam(id)
      setConfirming(null)
      setVersion((v) => v + 1)
    } catch (e) {
      setError(e instanceof Error ? e.message : '删除失败')
    }
  }

  const done = exams?.filter((exam) => exam.attemptCount > 0) ?? []

  return (
    <div>
      {exams && exams.length > 0 && (
        <section className="mb-8 border-b border-usu pb-6">
          <div className="flex items-end gap-10">
            <Stat label="卷子" value={String(exams.length)} accent />
            <Stat label="做过" value={String(done.length)} />
            {done.length > 0 && <Stat label="最近一次的平均正确率" value={averageRate(done)} />}
          </div>
        </section>
      )}

      <section className="mb-8 border-b border-usu pb-8">
        {importing ? (
          <ExamImport
            existingTitles={titles}
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

        {notice && <p className="mt-3 text-sm text-shu">{notice}</p>}
        {error && <p className="mt-3 text-sm text-shu">{error}</p>}
      </section>

      {!exams ? (
        !error && <p className="text-sm text-hai">加载中…</p>
      ) : exams.length === 0 ? (
        <p className="py-10 text-center text-sm leading-relaxed text-hai">
          还没有卷子。把读解、言語知識真题的 .docx 导进来，就能逐题练：选完马上对答案，还能给每道题标难度。
        </p>
      ) : (
        <ul>
          {exams.map((exam) => {
            const last = exam.lastAttempt
            return (
              <li key={exam.id} className="group border-b border-usu py-4">
                <div className="flex items-baseline gap-3">
                  <Link
                    to={`/exam/${exam.id}`}
                    className="min-w-0 flex-1 font-mincho text-lg transition hover:text-ai"
                  >
                    {exam.title}
                  </Link>
                  {last && (
                    <span className="shrink-0 font-mincho text-lg tabular-nums">
                      <span className={last.correct === last.graded ? 'text-ai' : ''}>
                        {last.correct}
                      </span>
                      <span className="text-sm text-hai"> / {last.graded}</span>
                    </span>
                  )}
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
                  <p className="mt-1 text-xs text-hai">
                    {exam.questionCount} 题
                    {exam.gradedCount < exam.questionCount &&
                      `（${exam.questionCount - exam.gradedCount} 题没有答案）`}
                    {last
                      ? ` · 做过 ${exam.attemptCount} 次，上次 ${new Date(
                          last.submittedAt,
                        ).toLocaleDateString('zh-CN')}，用时 ${formatMinutes(last.elapsedSeconds)}`
                      : ' · 还没做过'}
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

/** 每份卷子最近一次的正确率，取平均 —— 看的是现在的水平，不是历史总账。 */
function averageRate(exams: ExamSummary[]): string {
  const rates = exams.flatMap((exam) =>
    exam.lastAttempt && exam.lastAttempt.graded > 0
      ? [exam.lastAttempt.correct / exam.lastAttempt.graded]
      : [],
  )
  if (rates.length === 0) return '—'
  return `${Math.round((rates.reduce((a, b) => a + b, 0) / rates.length) * 100)}%`
}

/** 和阅读页的统计块同一套观感 —— 大字号数字 + 小字标签。 */
function Stat({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <div className={`font-mincho text-4xl tabular-nums ${accent ? 'text-ai' : 'text-sumi'}`}>
        {value}
      </div>
      <div className="mt-1 text-xs tracking-wider text-hai">{label}</div>
    </div>
  )
}
