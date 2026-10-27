import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { fetchExam, submitExam } from '../api'
import type { Exam, ExamAttempt } from '../api'
import { useAuth } from '../auth-context'
import ExamText from '../components/ExamText'
import AnalysisPanel from '../components/AnalysisPanel'
import { useSelectionAnalysis } from '../selection'
import type { SelectionAnalysis } from '../selection'
import { examQuestions, formatClock } from '../exam'
import type { ExamBlock, ExamPassage, ExamQuestion } from '../exam'

/** 振り仮名开着还是关着。默认关 —— 考场上没有注音 */
const FURIGANA_KEY = 'kotoba:exam-furigana'

/** 作答到一半的答案和用时，存在这台设备上：不小心关了页面回来还在 */
interface Draft {
  answers: Record<number, number>
  elapsed: number
}

function readDraft(key: string): Draft | null {
  try {
    const draft = JSON.parse(localStorage.getItem(key) ?? 'null')
    if (draft && typeof draft.elapsed === 'number' && typeof draft.answers === 'object') {
      return draft as Draft
    }
  } catch {
    // 读不出来就当没有
  }
  return null
}

function writeDraft(key: string, draft: Draft | null) {
  try {
    if (draft) localStorage.setItem(key, JSON.stringify(draft))
    else localStorage.removeItem(key)
  } catch {
    // 无痕窗口之类存不了，这次照样能做
  }
}

function readFurigana(): boolean {
  try {
    return localStorage.getItem(FURIGANA_KEY) === 'on'
  } catch {
    return false
  }
}

/** 这题判得怎么样。没答案的题不判 */
type Verdict = 'right' | 'wrong' | 'ungraded'

function verdict(question: ExamQuestion, attempt: ExamAttempt): Verdict {
  if (question.answer === null) return 'ungraded'
  return attempt.answers[question.number] === question.answer ? 'right' : 'wrong'
}

/**
 * 做一份卷子。换卷子时整个重来（key 是 id）：答案、计时、草稿都是这一份的。
 */
export default function ExamPage() {
  const { id } = useParams()
  return <ExamPaper key={id} examId={Number(id)} />
}

/**
 * 卷面按考场的顺序排：大题 → 本文 → 小题，选项点了就算选上。底下钉着一条
 * 答题卡：题号、已答几题、用时、交卷。交卷后后端判分，卷面换成对答案的样子，
 * 顶上是成绩和各大题的得分。
 *
 * 和阅读页一样，选中任意一段（本文、题干、选项都行）就能就地拆解。
 */
function ExamPaper({ examId }: { examId: number }) {
  const { user } = useAuth()
  const draftKey = `kotoba:exam-draft:${user?.id}:${examId}`
  const [exam, setExam] = useState<Exam | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [answers, setAnswers] = useState<Record<number, number>>(
    () => readDraft(draftKey)?.answers ?? {},
  )
  const [elapsed, setElapsed] = useState(() => readDraft(draftKey)?.elapsed ?? 0)
  // 正在看哪一次交卷的结果；null = 在作答
  const [review, setReview] = useState<ExamAttempt | null>(null)
  const [onlyWrong, setOnlyWrong] = useState(false)
  // 还有题没答就交卷，先问一句
  const [confirming, setConfirming] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [furigana, setFurigana] = useState(readFurigana)
  const selection = useSelectionAnalysis()
  const { showPanel } = selection

  useEffect(() => {
    window.scrollTo(0, 0)
    fetchExam(examId)
      .then(setExam)
      .catch((e) => setError(e instanceof Error ? e.message : '加载失败'))
  }, [examId])

  const answering = exam !== null && review === null

  // 只在作答、而且页面在前台时走表：切去别的标签页查东西不算时间
  useEffect(() => {
    if (!answering) return
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') setElapsed((s) => s + 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [answering])

  // 一题没答就不留草稿：只是点开看一眼，下次进来计时从零开始
  useEffect(() => {
    if (!answering) return
    writeDraft(draftKey, Object.keys(answers).length > 0 ? { answers, elapsed } : null)
  }, [answering, draftKey, answers, elapsed])

  const questions = useMemo(() => (exam ? examQuestions(exam.content) : []), [exam])

  if (error && !exam) return <p className="text-sm text-shu">{error}</p>
  if (!exam) return <p className="text-sm text-hai">加载中…</p>

  const answeredCount = questions.filter((q) => answers[q.number] !== undefined).length
  const hasDraft = answeredCount > 0

  function choose(number: number, choice: number) {
    setAnswers((prev) => ({ ...prev, [number]: choice }))
    setConfirming(false)
  }

  async function submit() {
    if (!exam) return
    if (answeredCount < questions.length && !confirming) {
      setConfirming(true)
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const attempt = await submitExam(exam.id, answers, elapsed)
      setExam({ ...exam, attempts: [attempt, ...exam.attempts] })
      setReview(attempt)
      setConfirming(false)
      setAnswers({})
      setElapsed(0)
      writeDraft(draftKey, null)
      window.scrollTo(0, 0)
    } catch (e) {
      setError(e instanceof Error ? e.message : '交卷失败')
    } finally {
      setSubmitting(false)
    }
  }

  function retry() {
    setReview(null)
    setOnlyWrong(false)
    setAnswers({})
    setElapsed(0)
    window.scrollTo(0, 0)
  }

  function toggleFurigana() {
    const next = !furigana
    setFurigana(next)
    try {
      localStorage.setItem(FURIGANA_KEY, next ? 'on' : 'off')
    } catch {
      // 存不了就只管这一次
    }
  }

  const last = exam.attempts[0] ?? null
  // 只看错题：整篇的题都对了（或者没答案）就不显示这篇
  const shown = (passage: ExamPassage) =>
    !review || !onlyWrong || passage.questions.some((q) => verdict(q, review) === 'wrong')

  return (
    <div
      className={
        showPanel ? 'xl:grid xl:grid-cols-[minmax(0,1fr)_26rem] xl:items-start xl:gap-12' : ''
      }
    >
      {/* 弹层盖住底部时给卷面留出余量，否则最后几题够不着。侧栏模式不需要 */}
      <div className={showPanel ? 'pb-[72vh] xl:pb-0' : ''}>
        <Link to="/exam" className="text-xs text-hai transition hover:text-sumi">
          ← 应试
        </Link>

        <h1 className="mt-5 font-mincho text-3xl leading-snug sm:text-4xl">{exam.title}</h1>
        {exam.content.preface.map((line, i) => (
          <p key={i} className="mt-2 text-xs text-hai">
            {line}
          </p>
        ))}
        <p className="mt-4 flex flex-wrap items-baseline gap-x-4 gap-y-2 text-xs text-hai">
          <span>
            {exam.questionCount} 题
            {exam.gradedCount < exam.questionCount &&
              `，${exam.questionCount - exam.gradedCount} 题没有答案不计分`}
          </span>
          <button onClick={toggleFurigana} className="transition hover:text-ai">
            {furigana ? '隐藏振り仮名' : '显示振り仮名'}
          </button>
          {!review && last && (
            <button onClick={() => setReview(last)} className="transition hover:text-ai">
              上次 {last.correct}/{last.graded}，看结果
            </button>
          )}
        </p>

        {review && (
          <ScoreCard
            exam={exam}
            attempt={review}
            onSelect={(attempt) => {
              setReview(attempt)
              setOnlyWrong(false)
            }}
          />
        )}

        {/* 关掉振り仮名要用 display: none —— 只是藏起来的话，读音比汉字长的词
            （学習者 がくしゅうしゃ）汉字之间还会被撑开。行高是固定的，切换时不会上下跳 */}
        <div className={furigana ? '' : '[&_rt]:hidden'}>
          {exam.content.sections.map((section, s) => {
            const passages = section.passages.filter(shown)
            if (passages.length === 0) return null
            const numbers = section.passages.flatMap((p) => p.questions.map((q) => q.number))
            return (
              <section key={s} className="mt-16">
                <h2 className="flex items-baseline gap-3 border-b border-usu pb-2">
                  {section.label && <span className="font-mincho text-xl">{section.label}</span>}
                  {section.name && <span className="text-sm text-hai">{section.name}</span>}
                  {numbers.length > 0 && (
                    <span className="ml-auto text-xs tabular-nums text-hai">
                      問{numbers[0]}
                      {numbers.length > 1 && `–${numbers[numbers.length - 1]}`}
                    </span>
                  )}
                </h2>
                {passages.map((passage, p) => (
                  <PassageView
                    key={p}
                    passage={passage}
                    answers={review ? review.answers : answers}
                    review={review}
                    onChoose={choose}
                  />
                ))}
              </section>
            )
          })}
        </div>

        <AnswerSheet
          exam={exam}
          answers={answers}
          answeredCount={answeredCount}
          elapsed={elapsed}
          review={review}
          selection={selection}
          onlyWrong={onlyWrong}
          onToggleOnlyWrong={() => setOnlyWrong((v) => !v)}
          confirming={confirming}
          submitting={submitting}
          error={error}
          onSubmit={submit}
          onCancelSubmit={() => setConfirming(false)}
          resumeLabel={hasDraft ? '回去接着做' : '再做一次'}
          onResume={hasDraft ? () => setReview(null) : retry}
        />
      </div>

      {showPanel && <AnalysisPanel selection={selection} />}
    </div>
  )
}

/** 交卷后顶上那一块：答对几题、正确率、用时，各大题的得分，历次成绩。 */
function ScoreCard({
  exam,
  attempt,
  onSelect,
}: {
  exam: Exam
  attempt: ExamAttempt
  onSelect: (attempt: ExamAttempt) => void
}) {
  const rate = attempt.graded > 0 ? Math.round((attempt.correct / attempt.graded) * 100) : 0
  const ordinal = exam.attempts.length - exam.attempts.findIndex((a) => a.id === attempt.id)
  const sections = exam.content.sections.map((section) => {
    const graded = section.passages
      .flatMap((p) => p.questions)
      .filter((q) => q.answer !== null)
    return {
      name: section.name || section.label,
      right: graded.filter((q) => verdict(q, attempt) === 'right').length,
      total: graded.length,
    }
  })

  return (
    <section className="mt-10 border-y border-usu py-6">
      <p className="text-xs text-hai">
        第 {ordinal} 次 ·{' '}
        {new Date(attempt.submittedAt).toLocaleString('zh-CN', {
          month: 'numeric',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })}
      </p>
      <div className="mt-3 flex flex-wrap items-end gap-x-10 gap-y-4">
        <div>
          <div className="font-mincho text-5xl tabular-nums">
            <span className="text-ai">{attempt.correct}</span>
            <span className="text-2xl text-hai"> / {attempt.graded}</span>
          </div>
          <div className="mt-1 text-xs tracking-wider text-hai">答对</div>
        </div>
        <div>
          <div className="font-mincho text-3xl tabular-nums">{rate}%</div>
          <div className="mt-1 text-xs tracking-wider text-hai">正确率</div>
        </div>
        <div>
          <div className="font-mincho text-3xl tabular-nums">
            {formatClock(attempt.elapsedSeconds)}
          </div>
          <div className="mt-1 text-xs tracking-wider text-hai">用时</div>
        </div>
      </div>

      <p className="mt-5 flex flex-wrap gap-x-6 gap-y-1 text-sm">
        {sections
          .filter((s) => s.total > 0)
          .map((s, i) => (
            <span key={i} className="whitespace-nowrap">
              <span className="text-hai">{s.name}</span>{' '}
              <span className={`tabular-nums ${s.right === s.total ? 'text-ai' : ''}`}>
                {s.right}/{s.total}
              </span>
            </span>
          ))}
      </p>

      {exam.attempts.length > 1 && (
        <p className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs text-hai">
          历次
          {exam.attempts.toReversed().map((a) => (
            <button
              key={a.id}
              onClick={() => onSelect(a)}
              className={`tabular-nums transition ${
                a.id === attempt.id ? 'text-sumi underline underline-offset-4' : 'hover:text-sumi'
              }`}
            >
              {a.correct}/{a.graded}
            </button>
          ))}
        </p>
      )}
    </section>
  )
}

/** 正文段落首行缩一个字；标题、署名、列表这些短行不缩。 */
function isParagraph(text: string): boolean {
  return text.length >= 40 && !/^[・「『（(［[\d０-９①-⑳＊※]/.test(text)
}

/** 一篇本文：正文，连着的几条注释并成一组，后面跟它的小题。 */
function PassageView({
  passage,
  answers,
  review,
  onChoose,
}: {
  passage: ExamPassage
  /** 作答时是正在填的答案，对答案时是那次交的 */
  answers: Record<number, number>
  review: ExamAttempt | null
  onChoose: (number: number, choice: number) => void
}) {
  const groups: (ExamBlock | ExamBlock[])[] = []
  for (const block of passage.blocks) {
    const previous = groups[groups.length - 1]
    if (block.kind === 'note' && Array.isArray(previous)) previous.push(block)
    else groups.push(block.kind === 'note' ? [block] : block)
  }

  return (
    <article className="mt-12">
      {passage.label && <p className="mb-4 text-xs tracking-widest text-hai">{passage.label}</p>}

      {/* 行高给振假名留空隙；正文限宽，一行的字数不至于读着累 */}
      <div className="max-w-[40rem] font-mincho text-lg leading-[2.3]">
        {groups.map((group, i) =>
          Array.isArray(group) ? (
            <div
              key={i}
              className="mt-4 border-t border-dashed border-usu pt-3 text-sm leading-[2.1] text-hai"
            >
              {group.map((note, j) => (
                <p key={j} className="pl-[2.5em] -indent-[2.5em]">
                  <span className="inline-block w-[2.5em] indent-0 font-ui text-xs">
                    {note.mark}
                  </span>
                  <ExamText text={note.text} />
                </p>
              ))}
            </div>
          ) : (
            <Block key={i} block={group} first={i === 0} />
          ),
        )}
      </div>

      <div className="mt-10 max-w-[40rem] space-y-9">
        {passage.questions.map((question) => (
          <QuestionView
            key={question.number}
            question={question}
            chosen={answers[question.number]}
            review={review}
            onChoose={(choice) => onChoose(question.number, choice)}
          />
        ))}
      </div>
    </article>
  )
}

function Block({ block, first }: { block: ExamBlock; first: boolean }) {
  switch (block.kind) {
    case 'part':
      return (
        <p className={`${first ? '' : 'mt-8'} mb-2`}>
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-hai/60 font-ui text-xs text-hai">
            {block.text}
          </span>
        </p>
      )
    case 'intro':
      return (
        <p className="mb-3 text-base text-hai">
          <ExamText text={block.text} />
        </p>
      )
    case 'source':
      return (
        <p className="mt-1 text-right text-sm text-hai">
          <ExamText text={block.text} />
        </p>
      )
    default:
      return (
        <p
          className={`mt-1.5 ${
            block.text.startsWith('・')
              ? 'pl-[1em] -indent-[1em]'
              : isParagraph(block.text)
                ? 'indent-[1em]'
                : ''
          }`}
        >
          <ExamText text={block.text} />
        </p>
      )
  }
}

function QuestionView({
  question,
  chosen,
  review,
  onChoose,
}: {
  question: ExamQuestion
  chosen: number | undefined
  review: ExamAttempt | null
  onChoose: (choice: number) => void
}) {
  const result = review ? verdict(question, review) : null

  return (
    <section id={`q-${question.number}`} className="scroll-mt-8">
      <p className="flex gap-3 font-mincho text-lg leading-[2.1]">
        <span data-skip className="shrink-0 font-ui text-sm leading-[2.6] tabular-nums text-hai">
          {result === 'right' ? (
            <span className="mr-1 text-ai">○</span>
          ) : result === 'wrong' ? (
            <span className="mr-1 text-shu">×</span>
          ) : null}
          問{question.number}
        </span>
        {/* 对话题的题干是好几行 A「…」B「…」 */}
        <span className="min-w-0 whitespace-pre-line">
          <ExamText text={question.stem} />
        </span>
      </p>

      {question.extra.length > 0 && (
        <div className="mt-3 border-l-2 border-usu pl-4 font-mincho text-base leading-[2.1]">
          {question.extra.map((line, i) => (
            <p key={i} className={line.startsWith('・') ? 'pl-[1em] -indent-[1em]' : ''}>
              <ExamText text={line} />
            </p>
          ))}
        </div>
      )}

      <div role="radiogroup" className="mt-3 flex flex-col gap-0.5">
        {question.choices.map((choice, i) => (
          <Choice
            key={i}
            name={`q-${question.number}`}
            number={i + 1}
            text={choice}
            chosen={chosen === i + 1}
            answer={question.answer}
            reviewing={review !== null}
            onChoose={() => onChoose(i + 1)}
          />
        ))}
      </div>

      {review && question.answer === null && (
        <p className="mt-2 pl-3 text-xs text-hai">这题讲义里没给答案，不计分</p>
      )}
    </section>
  )
}

function Choice({
  name,
  number,
  text,
  chosen,
  answer,
  reviewing,
  onChoose,
}: {
  name: string
  number: number
  text: string
  chosen: boolean
  answer: number | null
  reviewing: boolean
  onChoose: () => void
}) {
  const isAnswer = reviewing && answer === number
  const wrong = reviewing && chosen && answer !== null && !isAnswer

  const badge = isAnswer
    ? 'border-ai bg-ai text-washi'
    : wrong
      ? 'border-shu bg-shu text-washi'
      : chosen
        ? reviewing
          ? 'border-sumi text-sumi'
          : 'border-ai bg-ai text-washi'
        : 'border-usu text-hai group-hover:border-hai'
  const tone = isAnswer ? 'text-ai' : wrong ? 'text-shu' : reviewing ? 'text-hai' : ''

  return (
    <label
      // 拖着选文字（想拆解选项）时也会触发 click —— 有选区就不算选这个选项
      onClick={(e) => {
        if (window.getSelection()?.isCollapsed === false) e.preventDefault()
      }}
      className={`group flex items-baseline gap-3 rounded-sm px-3 py-1.5 transition has-[:focus-visible]:ring-1 has-[:focus-visible]:ring-ai ${
        reviewing ? '' : 'cursor-pointer hover:bg-usu/40'
      }`}
    >
      <input
        type="radio"
        name={name}
        checked={chosen}
        disabled={reviewing}
        onChange={onChoose}
        className="sr-only"
      />
      <span
        data-skip
        className={`relative top-[-0.1em] inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border font-ui text-xs tabular-nums transition ${badge}`}
      >
        {number}
      </span>
      <span className={`min-w-0 font-mincho text-base leading-[2.1] sm:text-[1.0625rem] ${tone}`}>
        <ExamText text={text} />
        {isAnswer && <span className="ml-2 font-ui text-xs">正解</span>}
        {wrong && <span className="ml-2 font-ui text-xs">你选的</span>}
      </span>
    </label>
  )
}

/**
 * 钉在底部的答题卡。作答时：题号（答过的涂上）、已答几题、用时、交卷；
 * 对答案时：题号按对错上色、只看错题、再做一次。选中了一段还没拆，
 * 拆解按钮也放在这一条上。
 */
function AnswerSheet({
  exam,
  answers,
  answeredCount,
  elapsed,
  review,
  selection,
  onlyWrong,
  onToggleOnlyWrong,
  confirming,
  submitting,
  error,
  onSubmit,
  onCancelSubmit,
  resumeLabel,
  onResume,
}: {
  exam: Exam
  answers: Record<number, number>
  answeredCount: number
  elapsed: number
  review: ExamAttempt | null
  selection: SelectionAnalysis
  onlyWrong: boolean
  onToggleOnlyWrong: () => void
  confirming: boolean
  submitting: boolean
  error: string | null
  onSubmit: () => void
  onCancelSubmit: () => void
  resumeLabel: string
  onResume: () => void
}) {
  const { pending, showPanel, analyze } = selection
  const total = exam.questionCount

  function jump(number: number) {
    document.getElementById(`q-${number}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  function chip(question: ExamQuestion): string {
    if (!review) {
      return answers[question.number] !== undefined
        ? 'border-ai bg-ai text-washi'
        : 'border-usu text-hai hover:border-hai'
    }
    const result = verdict(question, review)
    return result === 'right'
      ? 'border-ai text-ai'
      : result === 'wrong'
        ? 'border-shu bg-shu text-washi'
        : 'border-usu text-hai/60'
  }

  return (
    <div className="sticky bottom-0 z-10 -mx-4 mt-16 border-t border-usu bg-washi px-4 py-3 sm:-mx-8 sm:px-8">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        {/* 大题之间空开一点，一眼看出哪几题是一道大题 */}
        <ol className="flex min-w-0 flex-1 basis-full gap-1 overflow-x-auto py-0.5 [scrollbar-width:none] sm:basis-0">
          {exam.content.sections.map((section, s) =>
            section.passages
              .flatMap((p) => p.questions)
              .map((question, q, all) => (
                <li
                  key={question.number}
                  className={
                    q === all.length - 1 && s < exam.content.sections.length - 1 ? 'mr-2.5' : ''
                  }
                >
                  <button
                    onClick={() => jump(question.number)}
                    title={`問${question.number}`}
                    className={`flex h-7 min-w-7 items-center justify-center rounded-sm border px-1 text-[0.7rem] tabular-nums transition ${chip(question)}`}
                  >
                    {question.number}
                  </button>
                </li>
              )),
          )}
        </ol>

        <div className="ml-auto flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 text-xs text-hai">
          {pending !== '' && !showPanel && (
            <button
              onClick={() => analyze(pending)}
              className="rounded-sm bg-ai px-3 py-1.5 text-washi transition hover:opacity-85"
            >
              拆解选中的 {pending.length} 字
            </button>
          )}

          {review ? (
            <>
              <span>
                答对{' '}
                <span className="font-mincho text-base tabular-nums text-sumi">
                  {review.correct}
                </span>{' '}
                / {review.graded}
              </span>
              {review.correct < review.graded && (
                <button
                  onClick={onToggleOnlyWrong}
                  className={`transition hover:text-sumi ${onlyWrong ? 'text-sumi' : ''}`}
                >
                  {onlyWrong ? '显示全部' : '只看错题'}
                </button>
              )}
              <button
                onClick={onResume}
                className="rounded-sm border border-sumi px-3 py-1.5 text-sumi transition hover:bg-sumi hover:text-washi"
              >
                {resumeLabel}
              </button>
            </>
          ) : confirming ? (
            <>
              <span className="text-shu">还有 {total - answeredCount} 题没答</span>
              <button
                onClick={onSubmit}
                disabled={submitting}
                className="rounded-sm bg-shu px-3 py-1.5 text-washi transition hover:opacity-85 disabled:opacity-50"
              >
                {submitting ? '交卷中…' : '照样交卷'}
              </button>
              <button onClick={onCancelSubmit} className="transition hover:text-sumi">
                接着做
              </button>
            </>
          ) : (
            <>
              <span className="tabular-nums">
                已答 <span className="text-sumi">{answeredCount}</span> / {total}
              </span>
              <span className="font-mincho text-base tabular-nums text-sumi" title="用时">
                {formatClock(elapsed)}
              </span>
              <button
                onClick={onSubmit}
                disabled={submitting || answeredCount === 0}
                className="rounded-sm border border-sumi px-3 py-1.5 text-sumi transition hover:bg-sumi hover:text-washi disabled:cursor-not-allowed disabled:opacity-30"
              >
                {submitting ? '交卷中…' : '交卷'}
              </button>
            </>
          )}
        </div>
      </div>
      {error && <p className="mt-2 text-xs text-shu">{error}</p>}
    </div>
  )
}
