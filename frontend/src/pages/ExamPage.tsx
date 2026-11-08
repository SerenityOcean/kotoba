import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  explainQuestion,
  fetchExam,
  fetchExamProgress,
  markQuestion,
  saveExamProgress,
  submitExam,
} from '../api'
import type { Exam, ExamAttempt, ExplanationChoice, MarkLevel, QuestionExplanation } from '../api'
import { useAuth } from '../auth-context'
import ExamText from '../components/ExamText'
import Furigana from '../components/Furigana'
import AnalysisPanel from '../components/AnalysisPanel'
import { useSelectionAnalysis } from '../selection'
import type { SelectionAnalysis } from '../selection'
import { examQuestions, formatClock } from '../exam'
import {
  fromProgress,
  draftKey as keyFor,
  localIsNewer,
  readDraft,
  sameDraft,
  writeDraft,
} from '../exam-draft'
import type { Draft } from '../exam-draft'
import type { ExamBlock, ExamPassage, ExamQuestion } from '../exam'

/** 振り仮名开着还是关着。默认关 —— 考场上没有注音 */
const FURIGANA_KEY = 'kotoba:exam-furigana'

/** 三档难度。颜色只用在选中的那一档和底部题号的小点上 */
const LEVELS: { level: MarkLevel; label: string; on: string; dot: string }[] = [
  { level: 1, label: '简单', on: 'border-ai bg-ai text-washi', dot: 'bg-ai' },
  {
    level: 2,
    label: '一般',
    on: 'border-hai bg-hai text-washi',
    dot: 'bg-hai',
  },
  { level: 3, label: '难', on: 'border-shu bg-shu text-washi', dot: 'bg-shu' },
]

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

/** 停手多久把进度存到后端；一直在做的话，用时最多隔这么久跟一次 */
const SAVE_DELAY = 800
const SAVE_EVERY = 30_000

/** server 那份给 localIsNewer 比的样子 */
function stamp(draft: Draft | null) {
  return draft && { answered: Object.keys(draft.answers).length, updatedAt: draft.updatedAt }
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
 * 逐题练：选项点下去马上对答案，再点一下选中的那项是撤回。每道题下面都能标难度
 * （简单 / 一般 / 难，一点就存到后端，重做也还在）、看解析。全做完自动记一次成绩。
 *
 * 卷面还是按原卷的顺序排：大题 → 本文 → 小题。底下钉着一条题号，
 * 对错和难度一眼看得到，可以只看错题或某一档难度的题。
 *
 * 和阅读页一样，选中任意一段（本文、题干、选项都行）就能就地拆解。
 */
function ExamPaper({ examId }: { examId: number }) {
  const { user } = useAuth()
  const draftKey = keyFor(user?.id, examId)
  const [exam, setExam] = useState<Exam | null>(null)
  const [error, setError] = useState<string | null>(null)
  // 答案、用时、记下的成绩：卷子到了以后，从后端的进度和本机草稿里挑新的那份填进来
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [elapsed, setElapsed] = useState(0)
  const [recorded, setRecorded] = useState<number | null>(null)
  // 后端手里的那份进度（最后一次存上或取到的），没有是 null；眼下这一遍和它一样就不用再存
  const saved = useRef<Draft | null>(null)
  // 眼下这一遍，给定时器、切走页面时那一下用
  const current = useRef<Draft | null>(null)
  const saving = useRef(false)
  const saveAgain = useRef(false)
  const [marks, setMarks] = useState<Record<number, MarkLevel>>({})
  const [filter, setFilter] = useState<Filter>(null)
  const [explanations, setExplanations] = useState<Record<number, QuestionExplanation>>({})
  // 解析展开着的题、正在生成解析的题、生成失败的原因
  const [expanded, setExpanded] = useState<ReadonlySet<number>>(new Set())
  const [explaining, setExplaining] = useState<ReadonlySet<number>>(new Set())
  const [explainErrors, setExplainErrors] = useState<Record<number, string>>({})
  const [furigana, setFurigana] = useState(readFurigana)
  const selection = useSelectionAnalysis()
  const { showPanel } = selection

  // 卷子连同后端的进度一起换上。本机草稿更新就用本机的（随后会存上去），不然用后端的
  const load = useCallback(
    (exam: Exam) => {
      const remote = exam.progress ? fromProgress(exam.progress) : null
      const local = readDraft(draftKey)
      const draft = local && localIsNewer(local, stamp(remote)) ? local : remote
      saved.current = remote
      setExam(exam)
      setMarks(exam.marks)
      setExplanations(exam.explanations)
      setAnswers(draft?.answers ?? {})
      setElapsed(draft?.elapsed ?? 0)
      setRecorded(draft?.recorded ?? null)
    },
    [draftKey],
  )

  useEffect(() => {
    window.scrollTo(0, 0)
    fetchExam(examId)
      .then(load)
      .catch((e) => setError(e instanceof Error ? e.message : '加载失败'))
  }, [examId, load])

  const loaded = exam !== null
  const practising = loaded && recorded === null

  // 做完之前、页面在前台时走表：切去别的标签页查东西不算时间。表不显示，只记进成绩
  useEffect(() => {
    if (!practising) return
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') setElapsed((s) => s + 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [practising])

  // 一题没做就不记用时：只是点开看一眼，下次进来计时从零开始。
  // 和后端那份一样就沿用它的时间，有变化才算是这台设备上刚改的
  useEffect(() => {
    if (!exam) return
    const empty = Object.keys(answers).length === 0
    const next: Draft = empty
      ? { answers: {}, elapsed: 0, recorded: null, updatedAt: 0 }
      : { answers, elapsed, recorded, updatedAt: 0 }
    const same = [saved.current, current.current].find((d) => sameDraft(next, d))
    next.updatedAt = same?.updatedAt ?? Date.now()
    current.current = next
    // 后端也没有的空卷不留草稿
    writeDraft(draftKey, empty && saved.current === null ? null : next)
  }, [exam, draftKey, answers, elapsed, recorded])

  // 存到后端。和后端那份一样就不发；正在存就等这次回来再存一遍最新的。
  // keepalive 是切走、关页面时那一下，不排队，直接发
  const save = useCallback(
    async (keepalive = false) => {
      const draft = current.current
      if (draft === null || sameDraft(draft, saved.current)) return
      if (saved.current === null && Object.keys(draft.answers).length === 0) return
      if (saving.current && !keepalive) {
        saveAgain.current = true
        return
      }
      if (!keepalive) saving.current = true
      try {
        const progress = await saveExamProgress(
          examId,
          draft.answers,
          draft.elapsed,
          draft.recorded,
          keepalive,
        )
        // 记成发出去的这份、后端的时间：下次打开不会当成本机更新又存一遍
        saved.current = { ...draft, updatedAt: Date.parse(progress.updatedAt) }
        if (current.current === draft) {
          current.current = saved.current
          writeDraft(draftKey, saved.current)
        }
      } catch {
        // 存不上（断网之类）就等下一次，本机草稿还在
      } finally {
        if (!keepalive) {
          saving.current = false
          if (saveAgain.current) {
            saveAgain.current = false
            void save()
          }
        }
      }
    },
    [examId, draftKey],
  )

  // 选了、撤回、记下成绩、重做：停手一下就存
  useEffect(() => {
    if (!exam) return
    const timer = setTimeout(() => void save(), SAVE_DELAY)
    return () => clearTimeout(timer)
  }, [exam, answers, recorded, save])

  // 一直在做的话用时隔一阵跟一次；切走、关页面、离开这页时把最新的发出去。
  // 切回来时看一眼后端：别的设备在这之后接着做过，就换成那边的
  useEffect(() => {
    if (!loaded) return
    const timer = setInterval(() => void save(), SAVE_EVERY)
    const flush = () => void save(true)
    const onVisibility = async () => {
      if (document.visibilityState === 'hidden') {
        flush()
        return
      }
      try {
        const progress = await fetchExamProgress(examId)
        if (!progress) return
        const remote = fromProgress(progress)
        if (saved.current && remote.updatedAt <= saved.current.updatedAt) return
        if (current.current && localIsNewer(current.current, stamp(remote))) return
        load(await fetchExam(examId))
      } catch {
        // 看不了就先接着用这台的
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', flush)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', flush)
      flush()
    }
  }, [loaded, examId, save, load])

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

  // 选下去马上对答案。再点一下选中的那项是撤回，这题回到没做的样子；
  // 其余选项在撤回前点不动 —— 不然看着正解改答案，对错就没意义了
  function choose(number: number, choice: number) {
    const current = answers[number]
    if (current === choice) {
      setAnswers(({ [number]: _, ...rest }) => rest)
      return
    }
    if (current !== undefined) return
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

  // 生成过的点一下就是展开 / 收起；没生成过的先去要，到了再展开。
  // 选项上还没有例句的旧解析，展开时重新要一份，要不到就先看旧的
  async function explain(number: number) {
    if (!exam || explaining.has(number)) return
    const saved = explanations[number]
    const current = saved?.choices.every((c) => c.example != null)
    if (saved && (current || expanded.has(number))) {
      setExpanded((current) => toggled(current, number, !current.has(number)))
      return
    }
    setExplaining((current) => toggled(current, number, true))
    setExplainErrors(({ [number]: _, ...rest }) => rest)
    try {
      const explanation = await explainQuestion(exam.id, number)
      setExplanations((current) => ({ ...current, [number]: explanation }))
      setExpanded((current) => toggled(current, number, true))
    } catch (e) {
      if (saved) setExpanded((current) => toggled(current, number, true))
      setExplainErrors((current) => ({
        ...current,
        [number]: e instanceof Error ? e.message : '解析没生成出来',
      }))
    } finally {
      setExplaining((current) => toggled(current, number, false))
    }
  }

  function restart() {
    setAnswers({})
    setElapsed(0)
    setRecorded(null)
    setFilter(null)
    setExpanded(new Set())
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
                    explanations={explanations}
                    expanded={expanded}
                    explaining={explaining}
                    explainErrors={explainErrors}
                    onChoose={choose}
                    onMark={mark}
                    onExplain={explain}
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
    const graded = section.passages.flatMap((p) => p.questions).filter((q) => q.answer !== null)
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
  explanations,
  expanded,
  explaining,
  explainErrors,
  onChoose,
  onMark,
  onExplain,
}: {
  passage: ExamPassage
  questions: ExamQuestion[]
  answers: Record<number, number>
  marks: Record<number, MarkLevel>
  explanations: Record<number, QuestionExplanation>
  expanded: ReadonlySet<number>
  explaining: ReadonlySet<number>
  explainErrors: Record<number, string>
  onChoose: (number: number, choice: number) => void
  onMark: (number: number, level: MarkLevel) => void
  onExplain: (number: number) => void
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
      <div lang="ja" className="max-w-[40rem] font-mincho text-lg leading-[2.3]">
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
            explanation={expanded.has(question.number) ? explanations[question.number] : undefined}
            explaining={explaining.has(question.number)}
            explainError={explainErrors[question.number]}
            onChoose={(choice) => onChoose(question.number, choice)}
            onMark={(level) => onMark(question.number, level)}
            onExplain={() => onExplain(question.number)}
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
  explanation,
  explaining,
  explainError,
  onChoose,
  onMark,
  onExplain,
}: {
  question: ExamQuestion
  chosen: number | undefined
  result: Verdict
  level: MarkLevel | undefined
  /** 展开着才有 */
  explanation: QuestionExplanation | undefined
  explaining: boolean
  explainError: string | undefined
  onChoose: (choice: number) => void
  onMark: (level: MarkLevel) => void
  onExplain: () => void
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
        <span lang="ja" className="min-w-0 whitespace-pre-line">
          <ExamText text={question.stem} />
        </span>
      </p>

      {question.extra.length > 0 && (
        <div
          lang="ja"
          className="mt-3 border-l-2 border-usu pl-4 font-mincho text-base leading-[2.1]"
        >
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

      {result === 'ungraded' && <p className="mt-2 pl-3 text-xs text-hai">这题讲义里没给答案</p>}

      {/* 难度和解析每题都有，不用先做：想先看解析再做也行 */}
      <div data-skip className="mt-3 flex flex-wrap items-center gap-2 pl-3 text-xs text-hai">
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
        <button
          onClick={onExplain}
          disabled={explaining}
          aria-expanded={explanation !== undefined}
          className={`ml-3 transition hover:text-ai disabled:cursor-wait ${
            explanation ? 'text-ai' : ''
          }`}
        >
          {explaining ? '解析生成中…' : explanation ? '收起解析' : '解析'}
        </button>
      </div>

      {explainError && <p className="mt-2 pl-3 text-xs text-shu">{explainError}</p>}
      {explanation && (
        <ExplanationView explanation={explanation} answer={question.answer} chosen={chosen} />
      )}
    </section>
  )
}

/**
 * 一道题的解析：考点、为什么选正解，然后四个选项逐个讲。
 * 正解标蓝、选错的那项标红，和上面选项的颜色对得上。
 */
function ExplanationView({
  explanation,
  answer,
  chosen,
}: {
  explanation: QuestionExplanation
  answer: number | null
  chosen: number | undefined
}) {
  return (
    <div className="mt-3 ml-3 border-l-2 border-ai/40 pl-4 text-sm leading-relaxed">
      {explanation.point && <p className="text-xs tracking-wider text-hai">{explanation.point}</p>}
      {explanation.reason && <p className="mt-1.5">{explanation.reason}</p>}
      <ol className="mt-3 space-y-2.5">
        {explanation.choices.map((choice) => {
          const tone =
            choice.number === answer
              ? 'border-ai bg-ai text-washi'
              : choice.number === chosen
                ? 'border-shu bg-shu text-washi'
                : 'border-usu text-hai'
          return (
            <li key={choice.number} className="flex gap-3">
              <span
                className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[0.65rem] tabular-nums ${tone}`}
              >
                {choice.number}
              </span>
              <span className="min-w-0">
                <span>{choice.meaning}</span>
                {choice.verdict && <span className="block text-hai">{choice.verdict}</span>}
                <Example choice={choice} right={choice.number === answer} />
              </span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

/**
 * 这个选项另造的一个例句和中文翻译，挂在它下面。正解那项用蓝底，其余用灰底。
 * 例句的振り仮名一直显示 —— 卷面的振り仮名开关只管题目，
 * 例句是拿来学词的，读音不能藏（!important 压过卷面外层的 rt:hidden）
 */
function Example({ choice, right }: { choice: ExplanationChoice; right: boolean }) {
  if (!choice.example) return null
  return (
    <span
      className={`mt-1.5 block rounded px-2.5 py-1.5 [&_rt]:[display:ruby-text]! ${
        right ? 'bg-ai/5' : 'bg-usu/40'
      }`}
    >
      <span className={`mr-2 text-xs ${right ? 'text-ai' : 'text-hai'}`}>例</span>
      <span className="leading-loose">
        <Furigana text={choice.example} />
      </span>
      {choice.exampleTranslation && (
        <span className="block text-hai">{choice.exampleTranslation}</span>
      )}
    </span>
  )
}

/** 往集合里加一个或拿掉一个，回新的集合（state 不能原地改） */
function toggled(set: ReadonlySet<number>, value: number, on: boolean): ReadonlySet<number> {
  const next = new Set(set)
  if (on) next.add(value)
  else next.delete(value)
  return next
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
  /** 这题做过了：亮出正解。选中的那项再点是撤回，其余的点不动 */
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
      title={chosen ? '再点一下撤回' : undefined}
      className={`group flex items-baseline gap-3 rounded-sm px-3 py-1.5 transition has-[:focus-visible]:ring-1 has-[:focus-visible]:ring-ai ${
        revealed && !chosen ? '' : 'cursor-pointer hover:bg-usu/40'
      }`}
    >
      {/* 用 click 不用 change：点已经选中的单选框不触发 change，撤回就收不到 */}
      <input
        type="radio"
        name={name}
        checked={chosen}
        disabled={revealed && !chosen}
        onClick={onChoose}
        readOnly
        className="sr-only"
      />
      <span
        data-skip
        className={`relative top-[-0.1em] inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border font-ui text-xs tabular-nums transition ${badge}`}
      >
        {number}
      </span>
      <span
        lang="ja"
        className={`min-w-0 font-mincho text-base leading-[2.1] sm:text-[1.0625rem] ${tone}`}
      >
        <ExamText text={text} />
        {isAnswer && <span className="ml-2 font-ui text-xs">正解</span>}
        {wrong && (
          <span lang="zh-CN" className="ml-2 font-ui text-xs">
            你选的
          </span>
        )}
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
                <span>难度标记会留着</span>
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
