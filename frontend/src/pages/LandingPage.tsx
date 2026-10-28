import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { fetchAuthFeatures } from '../api'
import { useAuth } from '../auth-context'
import Furigana from '../components/Furigana'
import { addDays, daysBetween, startOfDay } from '../goal-time'
import { isCorrect, romajiToKana } from '../kana'

/*
 * 没登录的人打开首页看到的那一页：一句日语走完 読 → 拆 → 記 → 到。
 *
 * 舞台没人碰就自己演一遍（滚到它才开演），一碰就停下，交给访客自己选、自己勾、自己打。
 * 演示的内容都写死在这里：拆解结果、卡片都不调后端，打开这一页不花模型的钱。
 * 句子取自体验账号里那篇 N4 短文（demo/n4.json「アルバイトを始めました」）。
 */

const SENTENCE =
  '最初[さいしょ]は敬語[けいご]が難[むずか]しくて、お客[きゃく]さんに話[はな]しかけられると緊張[きんちょう]してしまいました。'
const TRANSLATION = '一开始觉得敬语很难，客人一跟我搭话，我就紧张起来。'

const ITEMS = [
  { kind: '动词', word: '話[はな]しかけられる', note: '← 話しかける。被动形：被客人搭话' },
  { kind: '动词', word: '緊張[きんちょう]してしまう', note: '〜てしまう：控制不住地' },
  { kind: '名词', word: '敬語[けいご]', note: '敬语：尊敬语、谦让语、郑重语的总称' },
  { kind: '语法', word: '〜と', note: '一……就……：前项一发生，后项自然跟着来' },
]

const CARD = { front: '緊張', reading: 'きんちょう', romaji: 'kinchou', back: '名詞・サ変　紧张' }

const STEPS = [
  ['読', '读'],
  ['拆', '拆'],
  ['記', '记'],
  ['到', '到'],
]

const FEATURES = [
  ['読', '阅读', '存下读过的文章，全文注音；选中一段就地拆解，原文一个字不改。'],
  ['考', '应试', '导入真题，逐题对答案，AI 把每个选项讲一遍，还能给每题标难度。'],
  ['拆', '拆解', '翻译、动词活用、名词、语法点，勾选就是卡片，重复的自动跳过。'],
  ['記', '卡片', '间隔重复，打字考读音；打错要照着打对一遍。Anki 牌组也能导入。'],
  ['到', '彼岸', '立一个考试日，看还剩几周几天、经过哪些节气、每天做了多少。'],
]

const PRIMARY =
  'inline-flex items-center gap-2.5 rounded-sm bg-ai px-6 py-3 text-sm tracking-wider text-washi transition hover:opacity-85 disabled:opacity-40'

export default function LandingPage() {
  // null = 还没问到；问不到就当没开体验账号，只给注册
  const [demo, setDemo] = useState<boolean | null>(null)

  useEffect(() => {
    fetchAuthFeatures()
      .then((f) => setDemo(f.demo))
      .catch(() => setDemo(false))
  }, [])

  return (
    <div>
      <section className="pb-10 text-center">
        <h2 className="font-mincho text-[1.625rem] tracking-[0.08em] sm:text-4xl">一句话，从读到记住。</h2>
        <p className="mt-4 text-sm text-balance text-hai">
          这句来自一篇 N4 短文。跟着它把言葉走一遍，大约三十秒。
        </p>
      </section>

      <Stage cta={<Cta demo={demo} />} />

      <section className="grid grid-cols-1 gap-x-7 gap-y-9 pt-28 pb-10 sm:grid-cols-3 lg:grid-cols-5">
        {FEATURES.map(([jp, name, text]) => (
          <div key={jp} className="border-t border-usu pt-4">
            <p className="font-mincho text-2xl">
              {jp}
              <span className="ml-2 font-ui text-xs text-hai">{name}</span>
            </p>
            <p className="mt-2.5 text-[13px] leading-relaxed text-hai">{text}</p>
          </div>
        ))}
      </section>

      <section className="pt-16 pb-8 text-center">
        <h2 className="font-mincho text-2xl tracking-[0.08em] sm:text-3xl">你读过的，才是你的词汇表。</h2>
        <div className="mt-9">
          <Cta demo={demo} />
        </div>
      </section>
    </div>
  )
}

/** 进去看看：开了体验账号就是「用演示账号看看」，没开就只给注册和登录。 */
function Cta({ demo }: { demo: boolean | null }) {
  const { enterDemo } = useAuth()
  const [entering, setEntering] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 还没问到开没开：先占住位置，免得按钮先出「注册」再跳成「演示账号」
  if (demo === null) return <div className="h-11" />

  async function enter() {
    setEntering(true)
    setError(null)
    try {
      // 登录态一变，首页就从这一页换成真的首页，不用自己跳
      await enterDemo()
    } catch (e) {
      setError(e instanceof Error ? e.message : '进不去体验账号')
      setEntering(false)
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-center gap-x-7 gap-y-4">
        {demo ? (
          <button onClick={enter} disabled={entering} className={PRIMARY}>
            {entering ? '正在进去…' : '用演示账号看看'}
            <span aria-hidden>→</span>
          </button>
        ) : (
          <Link to="/login?mode=register" className={PRIMARY}>
            注册一个 <span aria-hidden>→</span>
          </Link>
        )}
        <Link
          to={demo ? '/login?mode=register' : '/login'}
          className="text-sm text-ai underline-offset-4 hover:underline"
        >
          {demo ? '注册一个' : '登录'}
        </Link>
      </div>
      {error && <p className="mt-3 text-center text-sm text-shu">{error}</p>}
    </div>
  )
}

/**
 * 舞台：宽屏上四幕叠在同一格里，容器高度跟着最高的那幕走，换幕时不跳；
 * 手机上「拆」那一幕太高，叠着放别的幕底下会空一大截，所以只留当前这一幕。
 * 不在当前的幕设成 inert，Tab 不会跳进看不见的输入框。
 */
function Stage({ cta }: { cta: ReactNode }) {
  const [step, setStep] = useState(0)
  const [auto, setAuto] = useState(true)
  const [visible, setVisible] = useState(false)
  const [selected, setSelected] = useState(false)
  const [ticked, setTicked] = useState(() => ITEMS.map(() => false))
  const [typed, setTyped] = useState('')
  const [lit, setLit] = useState(false)
  const ref = useRef<HTMLElement>(null)

  const right = isCorrect(typed, CARD.reading)
  const wrong = !right && /^[ぁ-ゖー]+$/.test(typed) && typed.length >= CARD.reading.length
  const count = ticked.filter(Boolean).length

  // 滚到舞台才开演，不然人还没看到就演完了
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          io.disconnect()
        }
      },
      { threshold: 0.4 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  // 自动演示：每一幕排好接下来几步；换幕、被接手时清掉
  useEffect(() => {
    if (!auto || !visible) return
    const timers: number[] = []
    const at = (ms: number, fn: () => void) => timers.push(window.setTimeout(fn, ms))
    const tick = (i: number) => setTicked((t) => t.map((v, j) => (j === i ? true : v)))

    if (step === 0) {
      at(2200, () => setSelected(true))
      at(3300, () => setStep(1))
    } else if (step === 1) {
      at(1300, () => tick(0))
      at(1900, () => tick(2))
      at(2900, () => setStep(2))
    } else if (step === 2) {
      ;[...CARD.romaji].forEach((_, i) =>
        at(1000 + i * 190, () => setTyped(romajiToKana(CARD.romaji.slice(0, i + 1)))),
      )
    }
    return () => timers.forEach(clearTimeout)
  }, [step, auto, visible])

  // 读音打对了，停一下让人看见背面，再去最后一幕；自动演示到这儿就演完了
  useEffect(() => {
    if (step !== 2 || !right) return
    const t = window.setTimeout(() => {
      setStep(3)
      setAuto(false)
    }, 1100)
    return () => clearTimeout(t)
  }, [step, right])

  // 到了最后一幕，今天那一格亮起来
  useEffect(() => {
    if (step !== 3) return
    const t = window.setTimeout(() => setLit(true), 500)
    return () => clearTimeout(t)
  }, [step])

  function replay() {
    setSelected(false)
    setTicked(ITEMS.map(() => false))
    setTyped('')
    setLit(false)
    setAuto(true)
    setStep(0)
  }

  // 真的去选中那句话：选中了就拆
  function onSentenceMouseUp() {
    const selection = window.getSelection()
    if (!selection?.toString().trim()) return
    selection.removeAllRanges()
    setSelected(true)
    window.setTimeout(() => setStep(1), 350)
  }

  const status = auto ? (visible ? '自动演示中 · 点任意处接手' : '') : step === 3 ? '走完了' : '轮到你了'

  return (
    <section
      ref={ref}
      // 一碰舞台就停下自动演示，交给访客；「从头再来」除外
      onPointerDownCapture={(e) => {
        if (auto && !(e.target as HTMLElement).closest('[data-replay]')) setAuto(false)
      }}
      className="border border-usu px-5 pt-8 pb-6 sm:px-14 sm:pt-10"
    >
      <ol className="mx-auto mb-2 flex max-w-md">
        {STEPS.map(([jp, zh], i) => (
          <li key={jp} className="relative flex-1">
            {i > 0 && (
              <span
                className={`absolute top-[18px] right-1/2 h-px w-full transition-colors duration-500 ${
                  i <= step ? 'bg-sumi' : 'bg-usu'
                }`}
              />
            )}
            <button
              onClick={() => setStep(i)}
              className={`relative z-10 flex w-full flex-col items-center gap-2 text-[11px] tracking-[0.2em] transition-colors ${
                i <= step ? 'text-sumi' : 'text-hai'
              }`}
            >
              <span
                className={`grid size-9 place-items-center rounded-full border font-mincho text-base tracking-normal transition-colors duration-500 ${
                  i === step
                    ? 'border-ai bg-ai text-washi'
                    : i < step
                      ? 'border-sumi bg-washi'
                      : 'border-usu bg-washi'
                }`}
              >
                {jp}
              </span>
              {zh}
            </button>
          </li>
        ))}
      </ol>

      <div className="grid sm:min-h-[25rem]">
        <Scene active={step === 0}>
          <p className="mb-6 text-xs tracking-[0.25em] text-hai">读一篇文章，振り仮名已经注好了</p>
          <p
            lang="ja"
            onMouseUp={onSentenceMouseUp}
            className="max-w-[16em] font-mincho text-[1.375rem] leading-[2.3] text-balance [overflow-wrap:anywhere] [word-break:auto-phrase] sm:text-[1.9rem]"
          >
            <span className={`transition-colors duration-500 [box-decoration-break:clone] ${selected ? 'bg-ai/15' : ''}`}>
              <Furigana text={SENTENCE} />
            </span>
          </p>
          <p className="mt-7 text-[13px] text-hai">
            看不懂？用鼠标选中这句 —— 或者
            <button onClick={() => setStep(1)} className="ml-1 text-ai underline-offset-4 hover:underline">
              直接拆开
            </button>
          </p>
        </Scene>

        <Scene active={step === 1} className="sm:justify-start sm:pt-4">
          <p lang="ja" className="font-mincho text-lg leading-[2.2]">
            <span className="bg-ai/15 [box-decoration-break:clone]">
              <Furigana text={SENTENCE} />
            </span>
          </p>
          <p className="mt-1.5 mb-5 text-sm text-hai">{TRANSLATION}</p>
          <div className="grid w-full max-w-lg gap-2.5 text-left">
            {ITEMS.map((item, i) => (
              <label
                key={item.word}
                style={{ animationDelay: `${i * 0.12}s` }}
                className={`flex cursor-pointer items-start gap-3 border px-4 py-3 transition-colors ${
                  ticked[i] ? 'border-ai/45 bg-ai/5' : 'border-usu'
                } ${step === 1 ? 'motion-safe:animate-[landing-rise_0.6s_cubic-bezier(0.22,1,0.36,1)_both]' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={ticked[i]}
                  onChange={() => setTicked((t) => t.map((v, j) => (j === i ? !v : v)))}
                  className="mt-1.5 size-3.5 shrink-0 accent-ai"
                />
                <span className="min-w-0 flex-1">
                  <span className="mr-2.5 text-[10px] tracking-[0.2em] text-hai">{item.kind}</span>
                  <span lang="ja" className="font-mincho text-base">
                    <Furigana text={item.word} />
                  </span>
                  <span className="mt-0.5 block text-[12.5px] leading-relaxed text-hai">{item.note}</span>
                </span>
              </label>
            ))}
          </div>
          <button onClick={() => setStep(2)} disabled={count === 0} className={`${PRIMARY} mt-6`}>
            {count === 0 ? '勾几条，建成卡片' : `建成 ${count} 张卡片`}
            {count > 0 && <span aria-hidden>→</span>}
          </button>
        </Scene>

        <Scene active={step === 2}>
          <p className="mb-6 text-xs tracking-[0.25em] text-hai">卡片到期了，看正面、打读音</p>
          <div className="w-[min(20rem,100%)] border border-usu bg-washi px-6 pt-11 pb-8 shadow-[8px_8px_0_-1px_var(--color-washi),8px_8px_0_0_var(--color-usu),16px_16px_0_-1px_var(--color-washi),16px_16px_0_0_var(--color-usu)]">
            <p lang="ja" className="font-mincho text-[3.5rem] leading-tight">
              {CARD.front}
            </p>
            <input
              value={typed}
              onChange={(e) =>
                setTyped(
                  (e.nativeEvent as InputEvent).isComposing ? e.target.value : romajiToKana(e.target.value),
                )
              }
              lang="ja"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              placeholder="打读音，罗马字也行"
              aria-label="打读音"
              className={`mt-7 w-full border-b bg-transparent pb-2 text-center font-mincho text-2xl placeholder:font-ui placeholder:text-sm placeholder:text-hai/50 focus:outline-none ${
                right ? 'border-ai text-ai' : wrong ? 'border-shu text-shu' : 'border-usu focus:border-ai'
              }`}
            />
            <p
              className={`overflow-hidden text-sm text-hai transition-all duration-500 ${
                right ? 'mt-4 max-h-20 opacity-100' : 'max-h-0 opacity-0'
              }`}
            >
              {CARD.back}　·　<span className="text-ai">記住了</span>
            </p>
          </div>
          <p className="mt-8 text-[13px] text-hai">
            罗马字边打边变成假名 —— 试试 <code className="font-mono text-sumi">{CARD.romaji}</code>
          </p>
        </Scene>

        <Scene active={step === 3}>
          <h3 className="font-mincho text-[1.375rem] tracking-[0.06em] sm:text-3xl">今天这一格，亮了。</h3>
          <Footprints lit={lit} />
          <Countdown />
          <div className="mt-8">{cta}</div>
        </Scene>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-usu pt-4 text-xs text-hai">
        <button
          onClick={() => setStep(Math.max(0, step - 1))}
          className={`transition hover:text-ai ${step === 0 ? 'invisible' : ''}`}
        >
          ← 上一步
        </button>
        <span className="flex items-center gap-2">
          {status && (
            <span
              className={`size-1.5 rounded-full ${auto ? 'bg-ai motion-safe:animate-[landing-blink_1.6s_infinite]' : 'bg-usu'}`}
            />
          )}
          {status}
        </span>
        <button data-replay onClick={replay} className="transition hover:text-ai">
          从头再来
        </button>
      </div>
    </section>
  )
}

function Scene({ active, className = '', children }: { active: boolean; className?: string; children: ReactNode }) {
  return (
    <div
      aria-hidden={!active}
      inert={!active}
      className={`col-start-1 row-start-1 flex flex-col items-center justify-start pt-6 text-center sm:justify-center sm:pt-0 motion-safe:transition motion-safe:duration-700 motion-safe:ease-[cubic-bezier(0.22,1,0.36,1)] ${
        active
          ? 'opacity-100 motion-safe:delay-150'
          : 'pointer-events-none invisible translate-y-3 opacity-0 max-sm:hidden'
      } ${className}`}
    >
      {children}
    </div>
  )
}

/** 按复习量分档的颜色，和彼岸页的足迹格子一样 */
const FILLS = ['border border-usu', 'bg-ai/30', 'bg-ai/50', 'bg-ai/70', 'bg-ai']
const WEEKS_BACK = 8
const WEEKS_AHEAD = 6

/** 足迹格子：一列一周，往回八周、往后六周。走过的日子是编的，每次打开都是同一幅 */
function Footprints({ lit }: { lit: boolean }) {
  const today = startOfDay(new Date())
  const start = addDays(today, -(WEEKS_BACK * 7 + today.getDay()))
  const passed = daysBetween(start, today)

  return (
    <div className="mx-auto mt-7 grid w-max grid-flow-col grid-rows-7 gap-1 sm:gap-[5px]" aria-hidden>
      {Array.from({ length: (WEEKS_BACK + WEEKS_AHEAD + 1) * 7 }, (_, i) => {
        if (i === passed) {
          return (
            <span
              key={i}
              className={`size-2.5 rounded-[2px] outline outline-1 outline-offset-2 outline-ai sm:size-3.5 ${
                lit ? 'bg-ai motion-safe:animate-[landing-pop_0.7s_cubic-bezier(0.34,1.56,0.64,1)]' : 'border border-usu'
              }`}
            />
          )
        }
        // 固定的伪随机：周末多做一点，偶尔歇一天
        const r = Math.abs(Math.sin(i * 12.9898 + 4.1) * 43758.5453) % 1
        const weekend = i % 7 === 0 || i % 7 === 6
        const level = i > passed || r < 0.12 ? 0 : Math.min(4, 1 + Math.floor(r * 3.2) + (weekend ? 1 : 0))
        return <span key={i} className={`size-2.5 rounded-[2px] sm:size-3.5 ${FILLS[level]}`} />
      })}
    </div>
  )
}

/** 下一次 JLPT：每年 7 月和 12 月的第一个星期日，和 demo/seed.py 给体验账号立的目标同一天 */
function nextJlpt(today: Date): Date {
  for (let year = today.getFullYear(); ; year++) {
    for (const month of [6, 11]) {
      const first = new Date(year, month, 1)
      const sunday = addDays(first, (7 - first.getDay()) % 7)
      if (sunday > today) return sunday
    }
  }
}

function Countdown() {
  const today = startOfDay(new Date())
  const days = daysBetween(today, nextJlpt(today))
  return (
    <p className="mt-6 text-[13px] text-hai">
      离 <span className="font-mincho text-sumi">JLPT</span> 还有
      <span className="mx-1 font-mincho text-2xl text-sumi tabular-nums">{Math.ceil(days / 7)}</span>周 ·
      <span className="mx-1 font-mincho text-2xl text-sumi tabular-nums">{days}</span>天
    </p>
  )
}
