import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { fetchDecks, fetchDueCards, fetchStats, fillReadingsFor, reviewCard } from '../api'
import Furigana from '../components/Furigana'
import type { Card, Rating } from '../api'
import { closestReading, finishKana, isCorrect, markMistakes, romajiToKana } from '../kana'
import { stripFurigana } from '../reading'
import { loadSoundPreset, playKey, saveSoundPreset, soundFor } from '../sound'
import type { SoundPreset } from '../sound'
import SoundPicker from '../components/SoundPicker'

type Mode = 'type' | 'flip'

/**
 * 一张卡走到哪一步了：
 * - answer  打字模式下等你输入读音
 * - right   打对了，显示背面，等你评分（默认「记住了」）
 * - wrong   打错了或者点了「不会」，显示答案，要把正确读音打一遍才放行，放行即「忘了」
 * - hidden / revealed  翻卡模式（或者这张没有读音）
 */
type Phase = 'answer' | 'right' | 'wrong' | 'hidden' | 'revealed'

const MODE_KEY = 'kotoba:review-mode'

/** 答错的卡插回队列，中间隔这么多张再考一次 —— 太近了只是在背短期记忆。 */
const RETRY_GAP = 5

/** 今天的新词学完以后，「再来几张」一次给多少。 */
const EXTRA_NEW = 10

/** 记住上次用的模式。存储读不了（隐私模式之类）就默认打字。 */
function loadMode(): Mode {
  try {
    return localStorage.getItem(MODE_KEY) === 'flip' ? 'flip' : 'type'
  } catch {
    return 'type'
  }
}

function saveMode(mode: Mode) {
  try {
    localStorage.setItem(MODE_KEY, mode)
  } catch {
    // 记不住就算了，下次还是默认打字
  }
}

/** 这张卡在这个模式下要不要打字：打字模式、而且有读音。 */
function typing(mode: Mode, card: Card | undefined): boolean {
  return mode === 'type' && !!card?.reading
}

export default function ReviewPage() {
  const [queue, setQueue] = useState<Card[]>([])
  const [index, setIndex] = useState(0)
  const [mode, setMode] = useState<Mode>(loadMode)
  // 打字音的音色，null = 关
  const [sound, setSound] = useState<SoundPreset | null>(loadSoundPreset)
  const [phase, setPhase] = useState<Phase>('hidden')
  const [typed, setTyped] = useState('')
  // 第一次答错时写的是什么，答案旁边对比着显示
  const [attempt, setAttempt] = useState('')
  // 答错后重打还没打对
  const [retryWrong, setRetryWrong] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deckName, setDeckName] = useState<string | null>(null)
  // 开场给没读音的到期卡补读音：进行中 / 模型那边的失败原因
  const [filling, setFilling] = useState(false)
  const [fillError, setFillError] = useState<string | null>(null)
  const fillStarted = useRef(false)
  const navigate = useNavigate()

  // ?deck=3 表示只复习这个包，不带就是全部
  const [searchParams] = useSearchParams()
  const deckParam = searchParams.get('deck')
  const deckId = deckParam ? Number(deckParam) : undefined

  /**
   * 换到某张卡时把这张卡的状态一起摆好。必须和换卡在同一次更新里做：
   * 放进 effect 的话，新卡会先带着上一张的状态渲染一次 —— 上一张答错、
   * 这张又没有读音时就直接崩了。
   */
  const startCard = useCallback((card: Card | undefined, m: Mode) => {
    setPhase(typing(m, card) ? 'answer' : 'hidden')
    setTyped('')
    setAttempt('')
    setRetryWrong(false)
  }, [])

  /**
   * 到期的卡里还没读音的，按复习顺序一批批补上，补到一张换一张 ——
   * 不用先去卡片页点「补读音」。一次打开页面只做一次。
   */
  const fillMissing = useCallback(async (cards: Card[]) => {
    const ids = cards.filter((c) => c.readingMissing).map((c) => c.id)
    if (ids.length === 0 || fillStarted.current) return
    fillStarted.current = true
    setFilling(true)
    try {
      for (let i = 0; i < ids.length; i += 50) {
        const result = await fillReadingsFor(ids.slice(i, i + 50))
        const found = new Map(result.readings.map((r) => [r.id, r.reading]))
        setQueue((q) =>
          q.map((c) =>
            found.has(c.id) ? { ...c, reading: found.get(c.id)!, readingMissing: false } : c,
          ),
        )
        if (result.modelError) setFillError(result.modelError)
      }
    } catch (e) {
      setFillError(e instanceof Error ? e.message : '补读音失败')
    } finally {
      setFilling(false)
    }
  }, [])

  useEffect(() => {
    fetchDueCards(deckId)
      .then((cards) => {
        setQueue(cards)
        setIndex(0)
        startCard(cards[0], loadMode())
        if (loadMode() === 'type') fillMissing(cards)
      })
      .catch((e) => setError(e instanceof Error ? e.message : '加载失败'))
      .finally(() => setLoading(false))

    if (deckId) {
      // 只为了在顶上显示包名，失败就不显示，不影响复习
      fetchDecks()
        .then((decks) => setDeckName(decks.find((d) => d.id === deckId)?.name ?? null))
        .catch(() => setDeckName(null))
    }
  }, [deckId, startCard, fillMissing])

  const current = queue[index]

  // 正在看的这张刚补上读音（开场时还没有），从翻卡换成打字。
  // 只在还没翻开时换；已经点了「显示答案」就让它翻完
  if (mode === 'type' && current?.reading && phase === 'hidden') {
    setPhase('answer')
  }

  /**
   * 正在提交评分。评分要等服务器回来才翻到下一张，这期间再按一下回车
   * 会对同一张卡再评一次 —— 新卡连按两下「记住了」就从 1 天跳到 6 天。
   * 用 ref 不用 state：同一刻连着进来的两次按键，state 还来不及更新。
   */
  const submitting = useRef(false)
  // 这一轮里答错过的卡。它们会被插回队列再考一次
  const failed = useRef(new Set<number>())

  const handleRate = useCallback(
    async (rating: Rating) => {
      if (!current || submitting.current) return
      submitting.current = true
      try {
        // 同一轮里再考又错：第一次已经记过「忘了」，不再扣一遍难度系数和忘记次数，只是再排回去
        const againInRetry = rating === 'AGAIN' && failed.current.has(current.id)
        if (!againInRetry) {
          await reviewCard(current.id, rating)
        }

        let next = queue
        if (rating === 'AGAIN') {
          failed.current.add(current.id)
          // 插到后面隔 RETRY_GAP 张的位置；剩下的不够就排到最后
          const at = Math.min(index + 1 + RETRY_GAP, queue.length)
          next = [...queue.slice(0, at), current, ...queue.slice(at)]
          setQueue(next)
        }
        setIndex(index + 1)
        startCard(next[index + 1], mode)
      } catch (e) {
        setError(e instanceof Error ? e.message : '提交失败')
      } finally {
        submitting.current = false
      }
    },
    [current, index, queue, mode, startCard],
  )

  function submit() {
    if (!current?.reading) return
    const answer = finishKana(typed)
    if (phase === 'answer') {
      if (answer === '') return
      if (isCorrect(answer, current.reading)) {
        setTyped(answer)
        setPhase('right')
      } else {
        setAttempt(answer)
        setTyped('')
        setPhase('wrong')
      }
      return
    }
    if (phase === 'wrong') {
      if (isCorrect(answer, current.reading)) {
        handleRate('AGAIN')
      } else {
        // 清掉重来，不用先手动删掉打错的那串
        setTyped('')
        setRetryWrong(true)
      }
    }
  }

  /** 「不会」：不猜了，直接看答案，同样要打一遍才放行。 */
  function giveUp() {
    setAttempt('')
    setTyped('')
    setPhase('wrong')
  }

  function switchMode(next: Mode) {
    saveMode(next)
    setMode(next)
    startCard(current, next)
    if (next === 'type') fillMissing(queue.slice(index))
  }

  // 全局快捷键只管翻卡和评分；输入框里的按键归输入框自己处理
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // 输入框里的按键归输入框；在声音菜单里按的键也别拿来评分
      const target = e.target as HTMLElement
      if (!current || target instanceof HTMLInputElement || target.closest?.('[data-sound-picker]')) {
        return
      }
      // 按住不放时浏览器会自动重复发按键，那不是又按了一次。不挡的话，
      // 在输入框里按住回车：第一下交答案，后面重复的那些直接把这张评成「记住了」
      if (e.repeat) return

      if (phase === 'hidden') {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault()
          setPhase('revealed')
        }
        return
      }
      if (phase !== 'revealed' && phase !== 'right') return

      if (e.key === '1') handleRate('AGAIN')
      if (e.key === '2') handleRate('HARD')
      if (e.key === '3' || e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        handleRate('GOOD')
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [current, phase, handleRate])

  if (loading) return <p className="text-sm text-hai">加载中…</p>
  if (error) return <p className="text-sm text-shu">{error}</p>

  // 进度按卡片张数算：答错插回来再考的那几次不算进总数。
  // 数字是「看到第几张了」，进度条是「真正过关了几张」（等着再考的不算过关）
  const total = new Set(queue.map((c) => c.id)).size
  const seen = new Set(queue.slice(0, index + 1).map((c) => c.id)).size
  const done = total - new Set(queue.slice(index).map((c) => c.id)).size

  if (!current) {
    return (
      <Finished
        reviewed={total}
        deckId={deckId}
        onMore={(cards) => {
          failed.current = new Set()
          setQueue(cards)
          setIndex(0)
          startCard(cards[0], mode)
          if (mode === 'type') {
            fillStarted.current = false
            fillMissing(cards)
          }
        }}
        onHome={() => navigate('/')}
      />
    )
  }

  const isRetry = failed.current.has(current.id)

  const showBack = phase === 'revealed' || phase === 'right' || phase === 'wrong'
  // 打字时正面不能带注音，不然答案就印在题目上了
  const front = phase === 'answer' ? stripFurigana(current.front) : current.front

  return (
    <div>
      <div className="mb-8 flex items-center gap-3">
        {deckName && (
          <span className="max-w-[40%] truncate text-xs text-hai">{deckName}</span>
        )}
        <span className="text-xs tabular-nums text-hai">
          {seen} / {total}
        </span>
        {isRetry && <span className="text-xs text-shu">再考一次</span>}
        <div className="h-px flex-1 bg-usu">
          <div
            className="h-px bg-ai transition-all duration-300"
            style={{ width: `${(done / total) * 100}%` }}
          />
        </div>
        {mode === 'type' && (
          <SoundPicker
            value={sound}
            onChange={(preset) => {
              saveSoundPreset(preset)
              setSound(preset)
            }}
          />
        )}
        <ModeToggle mode={mode} onChange={switchMode} />
        <button
          onClick={() => navigate('/')}
          className="text-xs text-hai transition hover:text-sumi"
        >
          退出
        </button>
      </div>

      <div className="py-12 text-center sm:py-16">
        <div className="font-mincho text-5xl leading-tight sm:text-6xl">
          <Furigana text={front} />
        </div>

        {phase === 'right' && (
          <p className="mt-6 font-mincho text-2xl text-ai">
            {typed} <span className="text-base">✓</span>
          </p>
        )}

        {phase === 'wrong' && current.reading && (
          <div className="mt-6">
            {attempt !== '' && (
              <p className="font-mincho text-xl text-hai line-through decoration-hai/40">
                {markMistakes(attempt, closestReading(attempt, current.reading)).map((m, i) => (
                  <span key={i} className={m.wrong ? 'text-shu' : ''}>
                    {m.char}
                  </span>
                ))}
              </p>
            )}
            <p className="mt-2 font-mincho text-3xl text-sumi">{current.reading}</p>
          </div>
        )}

        {showBack && (
          <>
            <div className="mx-auto my-8 h-px w-16 bg-usu" />
            <div className="ruby-block whitespace-pre-line text-xl text-hai sm:text-2xl">
              {current.back ? <Furigana text={current.back} /> : '（无背面）'}
            </div>
          </>
        )}

        {mode === 'type' && !current.reading && phase === 'hidden' && (
          <p className="mt-6 text-xs text-hai">
            {!current.readingMissing
              ? '这张不考读音，翻卡就好'
              : filling
                ? '正在查这张的读音…'
                : fillError
                  ? `没查到读音（${fillError}），这张先翻卡`
                  : '没查到这张的读音，先翻卡；可以在卡片页「编辑」里填'}
          </p>
        )}
      </div>

      {(phase === 'answer' || phase === 'wrong') && (
        <AnswerInput
          key={`${current.id}-${phase}`}
          value={typed}
          onChange={(value) => {
            setTyped(value)
            setRetryWrong(false)
          }}
          onSubmit={submit}
          onGiveUp={phase === 'answer' ? giveUp : undefined}
          sound={sound}
          placeholder={phase === 'answer' ? '输入读音，罗马字会自动变成假名' : '照着答案打一遍才能继续'}
          hint={
            phase === 'wrong'
              ? retryWrong
                ? '还不对，照着上面的读音再打一遍'
                : '打对之后这张记为「忘了」'
              : undefined
          }
        />
      )}

      {phase === 'hidden' && (
        <div className="text-center">
          <button
            onClick={() => setPhase('revealed')}
            className="w-full rounded-sm bg-ai px-8 py-3.5 text-sm text-washi transition hover:opacity-85 sm:w-auto"
          >
            显示答案
          </button>
          <p className="mt-4 hidden text-xs text-hai sm:block">空格 / 回车</p>
        </div>
      )}

      {(phase === 'revealed' || phase === 'right') && (
        <>
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <RateButton onClick={() => handleRate('AGAIN')} color="shu" hint="1">
              忘了
            </RateButton>
            <RateButton onClick={() => handleRate('HARD')} color="hai" hint="2">
              一般
            </RateButton>
            <RateButton
              onClick={() => handleRate('GOOD')}
              color="ai"
              hint="3"
              suggested={phase === 'right'}
            >
              记住了
            </RateButton>
          </div>
          <p className="mt-4 hidden text-center text-xs text-hai sm:block">
            按数字键选择，空格 / 回车 = 记住了
          </p>
        </>
      )}
    </div>
  )
}

/**
 * 这一轮结束。今天的新词名额用完、还有新卡在排队的话，可以「再来 10 个」——
 * 不用为了多学一点去改每天的设置。
 */
function Finished({
  reviewed,
  deckId,
  onMore,
  onHome,
}: {
  reviewed: number
  deckId?: number
  onMore: (cards: Card[]) => void
  onHome: () => void
}) {
  const [waiting, setWaiting] = useState<number | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [note, setNote] = useState<string | null>(null)

  useEffect(() => {
    fetchStats()
      .then((s) => setWaiting(s.newWaiting))
      .catch(() => setWaiting(0))
  }, [])

  async function more() {
    setLoadingMore(true)
    setNote(null)
    try {
      const cards = await fetchDueCards(deckId, EXTRA_NEW)
      if (cards.length === 0) {
        setNote(deckId ? '这个包里的新卡都学过了' : '没有新卡了')
      } else {
        onMore(cards)
      }
    } catch (e) {
      setNote(e instanceof Error ? e.message : '加载失败')
    } finally {
      setLoadingMore(false)
    }
  }

  return (
    <div className="py-24 text-center">
      <p className="font-mincho text-2xl">
        {reviewed === 0 ? '今日已清空' : `复习完了 ${reviewed} 张`}
      </p>
      {waiting !== null && waiting > 0 && (
        <p className="mt-4 text-sm text-hai">今天的新词学完了，还有 {waiting} 张新卡在排队</p>
      )}
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        {waiting !== null && waiting > 0 && (
          <button
            onClick={more}
            disabled={loadingMore}
            className="rounded-sm bg-ai px-6 py-2.5 text-sm text-washi transition hover:opacity-85 disabled:opacity-30"
          >
            {loadingMore ? '加载中…' : `再来 ${EXTRA_NEW} 个`}
          </button>
        )}
        <button
          onClick={onHome}
          className="rounded-sm border border-sumi px-6 py-2.5 text-sm transition hover:bg-sumi hover:text-washi"
        >
          返回首页
        </button>
      </div>
      {note && <p className="mt-4 text-sm text-hai">{note}</p>}
    </div>
  )
}

/**
 * 答题框。罗马字边打边转成假名；用系统日语输入法时，选字过程中的回车
 * 是在确认候选，不能当成提交 —— 不然字还没选完答案就交上去了。
 */
function AnswerInput({
  value,
  onChange,
  onSubmit,
  onGiveUp,
  placeholder,
  hint,
  sound,
}: {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  onGiveUp?: () => void
  placeholder: string
  hint?: string
  /** 打字音的音色，null = 不出声 */
  sound: SoundPreset | null
}) {
  return (
    <div className="mx-auto max-w-sm text-center">
      <input
        value={value}
        onChange={(e) => {
          const composing = (e.nativeEvent as InputEvent).isComposing
          // 输入法选字时别动它的文字，选完再转
          onChange(composing ? e.target.value : romajiToKana(e.target.value))
        }}
        onKeyDown={(e) => {
          // 出声放在最前面：输入法选字时的按键也是在打字
          if (sound) {
            const kind = soundFor(e)
            if (kind) playKey(sound, kind)
          }
          if (e.nativeEvent.isComposing || e.keyCode === 229) return
          if (e.key === 'Enter') {
            e.preventDefault()
            // 按住回车只算一次
            if (!e.repeat) onSubmit()
          }
          if (e.key === 'Escape' && onGiveUp) {
            e.preventDefault()
            onGiveUp()
          }
        }}
        autoFocus
        lang="ja"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        enterKeyHint="done"
        placeholder={placeholder}
        className="w-full border-b border-usu bg-transparent pb-2 text-center font-mincho text-3xl placeholder:font-ui placeholder:text-sm placeholder:text-hai/40 focus:border-ai focus:outline-none"
      />
      <div className="mt-4 flex items-baseline justify-center gap-4 text-xs text-hai">
        {hint ? (
          <span className={hint.startsWith('还不对') ? 'text-shu' : ''}>{hint}</span>
        ) : (
          <span className="hidden sm:inline">回车提交</span>
        )}
        {onGiveUp && (
          <button onClick={onGiveUp} className="transition hover:text-sumi">
            不会<span className="ml-1 hidden opacity-50 sm:inline">Esc</span>
          </button>
        )}
      </div>
    </div>
  )
}

function ModeToggle({ mode, onChange }: { mode: Mode; onChange: (mode: Mode) => void }) {
  return (
    <span className="flex items-baseline gap-2 text-xs">
      {(['type', 'flip'] as const).map((m) => (
        <button
          key={m}
          onClick={() => onChange(m)}
          className={
            mode === m ? 'text-sumi' : 'text-hai transition hover:text-sumi'
          }
        >
          {m === 'type' ? '打字' : '翻卡'}
        </button>
      ))}
    </span>
  )
}

function RateButton({
  onClick,
  color,
  hint,
  suggested = false,
  children,
}: {
  onClick: () => void
  color: 'shu' | 'hai' | 'ai'
  hint: string
  /** 打字答对时「记住了」实心显示，提示回车就是它 */
  suggested?: boolean
  children: React.ReactNode
}) {
  const styles = {
    shu: 'border-shu text-shu hover:bg-shu',
    hai: 'border-hai text-hai hover:bg-hai',
    ai: 'border-ai text-ai hover:bg-ai',
  }[color]

  return (
    <button
      onClick={onClick}
      className={`group rounded-sm border py-3.5 text-sm transition hover:text-washi ${styles} ${
        suggested ? 'bg-ai text-washi' : ''
      }`}
    >
      {children}
      <span className="ml-1.5 hidden text-xs opacity-50 sm:inline">{hint}</span>
    </button>
  )
}
