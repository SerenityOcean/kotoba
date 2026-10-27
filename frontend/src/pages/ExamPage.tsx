import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { fetchExam, markQuestion, submitExam } from '../api'
import type { Exam, ExamAttempt, MarkLevel } from '../api'
import { useAuth } from '../auth-context'
import ExamText from '../components/ExamText'
import AnalysisPanel from '../components/AnalysisPanel'
import { useSelectionAnalysis } from '../selection'
import type { SelectionAnalysis } from '../selection'
import { examQuestions, formatClock } from '../exam'
import type { ExamBlock, ExamPassage, ExamQuestion } from '../exam'

/** 振り仮名开着还是关着。默认关 —— 考场上没有注音 */
const FURIGANA_KEY = 'kotoba:exam-furigana'

/** 三档难度。颜色只用在选中的那一档和底部题号的小点上 */
const LEVELS: { level: MarkLevel; label: string; on: string; dot: string }[] = [
  { level: 1, label: '简单', on: 'border-ai bg-ai text-washi', dot: 'bg-ai' },
  { level: 2, label: '一般', on: 'border-hai bg-hai text-washi', dot: 'bg-hai' },
  { level: 3, label: '难', on: 'border-shu bg-shu text-washi', dot: 'bg-shu' },
]

/**
 * 做到一半的答案和用时，存在这台设备上：不小心关了页面回来还在。
 * recorded 是做完一遍后记下的那次成绩，有了就不再重复记。
 */
interface Draft {
  answers: Record<number, number>
  elapsed: number
  recorded: number | null
}

function readDraft(key: string): Draft | null {
  try {
    const draft = JSON.parse(localStorage.getItem(key) ?? 'null')
    if (draft && typeof draft.elapsed === 'number' && typeof draft.answers === 'object') {
      return { ...draft, recorded: typeof draft.recorded === 'number' ? draft.recorded : null }
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

/** 这题判得怎么样。没答案的题不判，没做的题还没有结果 */
type Verdict = 'right' | 'wrong' | 'ungraded' | 'open'

function verdict(question: ExamQuestion, answers: Record<number, number>): Verdict {
  const chosen = answers[question.number]
  if (chosen === undefined) return 'open'
  if (question.answer === null) return 'ungraded'
  return chosen === question.answer ? 'right' : 'wrong'
}

/** 只看哪些题：错题，或者标了某一档难度的 */
type Filter = 'wrong' | MarkLevel | null

/**
 * 做一份卷子。换卷子时整个重来（key 是 id）：答案、计时、草稿都是这一份的。
 */
export default function ExamPage() {
  const { id } = useParams()
  return <ExamPaper key={id} examId={Number(id)} />
}

/**
 * 逐题练：选项点下去马上对答案，这题就定下了。做过的题下面可以标难度
 * （简单 / 一般 / 难），一点就存到后端，重做也还在。全做完自动记一次成绩。
 *
 * 卷面还是按原卷的顺序排：大题 → 本文 → 小题。底下钉着一条题号，
 * 对错和难度一眼看得到，可以只看错题或某一档难度的题。
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
  const [recorded, setRecorded] = useState<number | null>(
    () => readDraft(draftKey)?.recorded ?? null,
  )
  const [marks, setMarks] = useState<Record<number, MarkLevel>>({})
  const [filter, setFilter] = useState<Filter>(null)
  const [furigana, setFurigana] = useState(readFurigana)
  const selection = useSelectionAnalysis()
  const { showPanel } = selection

  useEffect(() => {
    window.scrollTo(0, 0)
    fetchExam(examId)
      .then((exam) => {
        setExam(exam)
        setMarks(exam.marks)
      })
      .catch((e) => setError(e instanceof Error ? e.message : '加载失败'))
  }, [examId])

  const practising = exam !== null && recorded === null

  // 做完之前、页面在前台时走表：切去别的标签页查东西不算时间。表不显示，只记进成绩
  useEffect(() => {
    if (!practising) return
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') setElapsed((s) => s + 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [practising])

  // 一题没做就不留草稿：只是点开看一眼，下次进来计时从零开始
  useEffect(() => {
    if (!exam) return
    writeDraft(
      draftKey,
      Object.keys(answers).length > 0 ? { answers, elapsed, recorded } : null,
    )
  }, [exam, draftKey, answers, elapsed, recorded])

  const questions = useMemo(() => (exam ? examQuestions(exam.content) : []), [exam])

  if (error && !exam) return <p className="text-sm text-shu">{error}</p>
  if (!exam) return <p className="text-sm text-hai">加载中…</p>

  const answeredCount = questions.filter((q) => answers[q.number] !== undefined).length
  const finished = answeredCount === questions.length
  const attempt = recorded === null ? null : (exam.attempts.find((a) => a.id === recorded) ?? null)

  const counts = {
    right: questions.filter((q) => verdict(q, answers) === 'right').length,
    wrong: questions.filter((q) => verdict(q, answers) === 'wrong').length,
    levels: LEVELS.map(({ level }) => questions.filter((q) => marks[q.number] === level).length),
  }
  // 筛到一题都不剩（最后一道标记去掉了）就回到全部
  const active =
    filter === 'wrong'
      ? counts.wrong > 0
        ? filter
        : null
      : filter !== null && counts.levels[filter - 1] > 0
        ? filter
        : null
  const matches = (question: ExamQuestion) =>
    active === null ||
    (active === 'wrong'
      ? verdict(question, answers) === 'wrong'
      : marks[question.number] === active)

  async function record(final: Record<number, number>) {
    if (!exam) return
    setError(null)
    try {
      const attempt = await submitExam(exam.id, final, elapsed)
      setExam((current) => current && { ...current, attempts: [attempt, ...current.attempts] })
      setRecorded(attempt.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : '成绩没记上')
    }
  }

  // 选下去就定了：马上对答案，不能再改
  function choose(number: number, choice: number) {
    if (answers[number] !== undefined) return
    const next = { ...answers, [number]: choice }
    setAnswers(next)
    if (questions.every((q) => next[q.number] !== undefined)) void record(next)
  }

  // 再点一下选中的那档就是去掉。先改界面，存失败了再改回来
  function mark(number: number, level: MarkLevel) {
    if (!exam) return
    const previous = marks[number]
    const next = previous === level ? null : level
    setMarks((current) => {
      const updated = { ...current }
      if (next === null) delete updated[number]
      else updated[number] = next
      return updated
    })
    setError(null)
    markQuestion(exam.id, number, next).catch((e) => {
      setMarks((current) => {
        const restored = { ...current }
        if (previous === undefined) delete restored[number]
        else restored[number] = previous
        return restored
      })
      setError(e instanceof Error ? e.message : '难度没存上')
    })
  }

  function restart() {
    setAnswers({})
    setElapsed(0)
    setRecorded(null)
    setFilter(null)
    setError(null)
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
              `，${exam.questionCount - exam.gradedCount} 题没有答案`}
          </span>
          {last && (
            <span className="tabular-nums">
              做完过 {exam.attempts.length} 遍，上次 {last.correct}/{last.graded}
            </span>
          )}
          <button onClick={toggleFurigana} className="transition hover:text-ai">
            {furigana ? '隐藏振り仮名' : '显示振り仮名'}
          </button>
        </p>

        {/* 关掉振り仮名要用 display: none —— 只是藏起来的话，读音比汉字长的词
            （学習者 がくしゅうしゃ）汉字之间还会被撑开。行高是固定的，切换时不会上下跳 */}
        <div className={furigana ? '' : '[&_rt]:hidden'}>
          {exam.content.sections.map((section, s) => {
            const passages = section.passages.filter((p) => p.questions.some(matches))
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
                    questions={passage.questions.filter(matches)}
                    answers={answers}
                    marks={marks}
                    onChoose={choose}
                    onMark={mark}
                  />
                ))}
              </section>
            )
          })}
        </div>

        {attempt && <ScoreCard exam={exam} attempt={attempt} />}

        <PracticeBar
          exam={exam}
          answers={answers}
          marks={marks}
          answeredCount={answeredCount}
          counts={counts}
          filter={active}
          matches={matches}
          onFilter={(next) => setFilter(next === active ? null : next)}
          selection={selection}
          error={error}
          onRetryRecord={finished && recorded === null ? () => record(answers) : null}
          onRestart={restart}
        />
      </div>

      {showPanel && <AnalysisPanel selection={selection} />}
    </div>
  )
}

/** 做完一遍后接在卷面最后：答对几题、正确率、用时，各大题的得分，历次成绩。 */
function ScoreCard({ exam, attempt }: { exam: Exam; attempt: ExamAttempt }) {
  const rate = attempt.graded > 0 ? Math.round((attempt.correct / attempt.graded) * 100) : 0
  const ordinal = exam.attempts.length - exam.attempts.findIndex((a) => a.id === attempt.id)
  const sections = exam.content.sections.map((section) => {
    const graded = section.passages
      .flatMap((p) => p.questions)
      .filter((q) => q.answer !== null)
    return {
      name: section.name || section.label,
      right: graded.filter((q) => verdict(q, attempt.answers) === 'right').length,
      total: graded.length,
    }
  })

  return (
    <section className="mt-16 border-y border-usu py-6">
      <p className="text-xs text-hai">
        做完了 · 第 {ordinal} 遍 ·{' '}
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
            <span
              key={a.id}
              className={`tabular-nums ${
                a.id === attempt.id ? 'text-sumi underline underline-offset-4' : ''
              }`}
            >
              {a.correct}/{a.graded}
            </span>
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

/** 一篇本文：正文，连着的几条注释并成一组，后面跟它的小题（筛选时只有筛中的那几题）。 */
function PassageView({
  passage,
  questions,
  answers,
  marks,
  onChoose,
  onMark,
}: {
  passage: ExamPassage
  questions: ExamQuestion[]
  answers: Record<number, number>
  marks: Record<number, MarkLevel>
  onChoose: (number: number, choice: number) => void
  onMark: (number: number, level: MarkLevel) => void
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
        {questions.map((question) => (
          <QuestionView
            key={question.number}
            question={question}
            chosen={answers[question.number]}
            result={verdict(question, answers)}
            level={marks[question.number]}
            onChoose={(choice) => onChoose(question.number, choice)}
            onMark={(level) => onMark(question.number, level)}
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
  result,
  level,
  onChoose,
  onMark,
}: {
  question: ExamQuestion
  chosen: number | undefined
  result: Verdict
  level: MarkLevel | undefined
  onChoose: (choice: number) => void
  onMark: (level: MarkLevel) => void
}) {
  const revealed = result !== 'open'

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
            revealed={revealed}
            onChoose={() => onChoose(i + 1)}
          />
        ))}
      </div>

      {result === 'ungraded' && (
        <p className="mt-2 pl-3 text-xs text-hai">这题讲义里没给答案</p>
      )}

      {/* 做过的、或者以前标过的题才显示：没做的题还谈不上难不难 */}
      {(revealed || level !== undefined) && (
        <div data-skip className="mt-3 flex items-center gap-2 pl-3 text-xs text-hai">
          <span className="mr-1">难度</span>
          {LEVELS.map(({ level: value, label, on }) => (
            <button
              key={value}
              onClick={() => onMark(value)}
              aria-pressed={level === value}
              title={level === value ? '再点一下去掉' : `标成${label}，会保存`}
              className={`rounded-sm border px-2.5 py-0.5 transition ${
                level === value ? on : 'border-usu hover:border-hai hover:text-sumi'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
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
  revealed,
  onChoose,
}: {
  name: string
  number: number
  text: string
  chosen: boolean
  answer: number | null
  /** 这题做过了：亮出正解，不能再改 */
  revealed: boolean
  onChoose: () => void
}) {
  const isAnswer = revealed && answer === number
  const wrong = revealed && chosen && answer !== null && !isAnswer

  const badge = isAnswer
    ? 'border-ai bg-ai text-washi'
    : wrong
      ? 'border-shu bg-shu text-washi'
      : chosen
        ? 'border-sumi text-sumi'
        : revealed
          ? 'border-usu text-hai'
          : 'border-usu text-hai group-hover:border-hai'
  const tone = isAnswer ? 'text-ai' : wrong ? 'text-shu' : revealed ? 'text-hai' : ''

  return (
    <label
      // 拖着选文字（想拆解选项）时也会触发 click —— 有选区就不算选这个选项
      onClick={(e) => {
        if (window.getSelection()?.isCollapsed === false) e.preventDefault()
      }}
      className={`group flex items-baseline gap-3 rounded-sm px-3 py-1.5 transition has-[:focus-visible]:ring-1 has-[:focus-visible]:ring-ai ${
        revealed ? '' : 'cursor-pointer hover:bg-usu/40'
      }`}
    >
      <input
        type="radio"
        name={name}
        checked={chosen}
        disabled={revealed}
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
 * 钉在底部的一条：题号按对错上色、标了难度的带个小点；做了几题、对了几题；
 * 只看错题 / 某档难度；重做。选中了一段还没拆，拆解按钮也放在这一条上。
 */
function PracticeBar({
  exam,
  answers,
  marks,
  answeredCount,
  counts,
  filter,
  matches,
  onFilter,
  selection,
  error,
  onRetryRecord,
  onRestart,
}: {
  exam: Exam
  answers: Record<number, number>
  marks: Record<number, MarkLevel>
  answeredCount: number
  counts: { right: number; wrong: number; levels: number[] }
  filter: Filter
  matches: (question: ExamQuestion) => boolean
  onFilter: (filter: Filter) => void
  selection: SelectionAnalysis
  error: string | null
  /** 做完了但成绩没记上，给个重试；其余时候是 null */
  onRetryRecord: (() => void) | null
  onRestart: () => void
}) {
  const { pending, showPanel, analyze } = selection
  // 重做会清掉这一遍的答案，先问一句
  const [confirming, setConfirming] = useState(false)

  function jump(number: number) {
    document.getElementById(`q-${number}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  function chip(question: ExamQuestion): string {
    const tone = {
      right: 'border-ai text-ai',
      wrong: 'border-shu bg-shu text-washi',
      ungraded: 'border-sumi text-sumi',
      open: 'border-usu text-hai hover:border-hai',
    }[verdict(question, answers)]
    return matches(question) ? tone : `${tone} opacity-30`
  }

  const filterButton = (value: Filter, label: string, count: number) =>
    count > 0 && (
      <button
        key={String(value)}
        onClick={() => onFilter(value)}
        className={`tabular-nums transition hover:text-sumi ${
          filter === value ? 'text-sumi underline underline-offset-4' : ''
        }`}
      >
        {label} {count}
      </button>
    )

  return (
    <div className="sticky bottom-0 z-10 -mx-4 mt-16 border-t border-usu bg-washi px-4 py-3 sm:-mx-8 sm:px-8">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        {/* 大题之间空开一点，一眼看出哪几题是一道大题 */}
        <ol className="flex min-w-0 flex-1 basis-full gap-1 overflow-x-auto py-1 [scrollbar-width:none] sm:basis-0">
          {exam.content.sections.map((section, s) =>
            section.passages
              .flatMap((p) => p.questions)
              .map((question, q, all) => {
                const dot = LEVELS.find((l) => l.level === marks[question.number])?.dot
                return (
                  <li
                    key={question.number}
                    className={
                      q === all.length - 1 && s < exam.content.sections.length - 1 ? 'mr-2.5' : ''
                    }
                  >
                    <button
                      onClick={() => jump(question.number)}
                      title={`問${question.number}`}
                      className={`relative flex h-7 min-w-7 items-center justify-center rounded-sm border px-1 text-[0.7rem] tabular-nums transition ${chip(question)}`}
                    >
                      {question.number}
                      {dot && (
                        <span
                          className={`absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full ring-1 ring-washi ${dot}`}
                        />
                      )}
                    </button>
                  </li>
                )
              }),
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

          <span className="tabular-nums">
            做了 <span className="text-sumi">{answeredCount}</span> / {exam.questionCount}
            {counts.right + counts.wrong > 0 && (
              <>
                ，对 <span className="text-ai">{counts.right}</span>
              </>
            )}
          </span>

          {filterButton('wrong', '错题', counts.wrong)}
          {LEVELS.map(({ level, label }) => filterButton(level, label, counts.levels[level - 1]))}

          {onRetryRecord && (
            <button onClick={onRetryRecord} className="text-shu transition hover:opacity-85">
              重新记成绩
            </button>
          )}

          {answeredCount > 0 &&
            (confirming ? (
              <>
                <button
                  onClick={() => {
                    setConfirming(false)
                    onRestart()
                  }}
                  className="rounded-sm bg-shu px-3 py-1.5 text-washi transition hover:opacity-85"
                >
                  清掉答案重做
                </button>
                <button onClick={() => setConfirming(false)} className="transition hover:text-sumi">
                  算了
                </button>
              </>
            ) : (
              <button
                onClick={() => setConfirming(true)}
                title="难度标记会留着"
                className="rounded-sm border border-sumi px-3 py-1.5 text-sumi transition hover:bg-sumi hover:text-washi"
              >
                重做
              </button>
            ))}
        </div>
      </div>
      {error && <p className="mt-2 text-xs text-shu">{error}</p>}
    </div>
  )
}
