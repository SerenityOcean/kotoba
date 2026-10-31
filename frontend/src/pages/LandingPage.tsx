import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { fetchAuthFeatures } from '../api'
import { useAuth } from '../auth-context'
import { isCorrect, romajiToKana } from '../kana'

/*
 * 没登录的人打开首页看到的那一页：先读一小段故事，再讲读 → 存 → 考，最后是资料包。
 *
 * 故事借资料包《リンの東京ノート》的人物：中国留学生小林和总偷吃早饭的白猫大福。
 * 演示的内容都写死在这里，不调后端，打开这一页不花模型的钱。
 */

/** 一个词：w 底字、r 读音（只给汉字）、g 释义。没释义的是标点、助词，不能点 */
type Token = { w: string; r?: string; g?: string }

const STORY: Token[][] = [
  [{ w: '朝', r: 'あさ', g: '早上' }, { w: '、' }, { w: 'テーブル', g: '桌子' }, { w: 'に' }, { w: 'パン', g: '面包' }, { w: 'が' }, { w: 'ありました', g: '有（过去式）' }, { w: '。' }],
  [{ w: 'シャワー', g: '淋浴' }, { w: 'の' }, { w: 'あと', g: '……之后' }, { w: '、' }, { w: 'パン', g: '面包' }, { w: 'が' }, { w: 'ありません', g: '没有' }, { w: '。' }],
  [{ w: '猫', r: 'ねこ', g: '猫' }, { w: 'の' }, { w: '大福', r: 'だいふく', g: '猫的名字，本来是一种糯米点心' }, { w: 'も', g: '也' }, { w: '、' }, { w: 'いません', g: '不在（人、动物）' }, { w: '。' }],
  [{ w: '「' }, { w: '大福', r: 'だいふく', g: '猫的名字，本来是一种糯米点心' }, { w: '！' }, { w: 'また', g: '又、再一次' }, { w: '？」' }],
]
const STORY_ZH = '早上，桌上放着面包。洗完澡回来，面包没了。猫大福也不见了。「大福！又是你？」'

/** 没人碰时自己挨个点的词：[行, 第几个] */
const AUTO_PICKS = [
  [2, 2],
  [2, 0],
  [0, 0],
  [3, 3],
]

const CARD = { front: '猫', reading: 'ねこ', romaji: 'neko', back: '名詞　猫' }

/** 「存」那一格默认的三张卡；在上面的故事里加过的词会换上来 */
const STACK = ['朝', 'また', '猫']

const PACK = {
  slug: 'tokyo-note-n5',
  title: 'リンの東京ノート',
  level: 'N5 · 入门',
  summary: '100 个 N5 核心词，配 20 个连载小故事：中国留学生小林和一只总偷吃早饭的猫，在东京的第一年。',
  fan: ['先生', '友達', '学生'],
  cards: 100,
  articles: 20,
  price: '¥0.99',
}

/** 每个功能：一句话，再加三条具体怎么用 —— 只说网站真的做得到的 */
const FEATURES: [jp: string, name: string, line: string, how: string[]][] = [
  ['読', '阅读', '存下读过的文章，全文注音，选中一段就地拆解。', [
    '粘贴一篇文章，或一次导入 .docx / .txt 的读解讲义，保存时自动注好振假名',
    '读到看不懂的地方，用鼠标选中那一句，旁边就出翻译和语法，不用离开页面',
    '拆出来的词和句子，勾一下就进卡片，下次复习就会考到',
  ]],
  ['拆', '拆解', '翻译、动词活用、语法点，勾选就是卡片。', [
    '粘贴一段日语，一次最多 20 句一起拆',
    '每句给出翻译、动词的原形和活用、名词、外来语和用到的语法点',
    '想记的条目打勾就生成卡片，已经有的自动跳过',
  ]],
  ['記', '卡片', '按记忆曲线复习，打字考读音。', [
    '复习时把读音打出来，罗马字自动变成假名；打错了要照着答案打对一遍才放行',
    '到期的旧卡按时出现，每天放多少新卡在首页自己定',
    'Anki 牌组直接导入，牌组自带的录音一起带进来，打对读音就播放',
  ]],
  ['考', '应试', '导入 JLPT 真题，逐题对答案，每个选项都讲一遍。', [
    '导入 .docx / .txt 的真题卷，自动切成一道道题',
    '点下选项马上对答案，再点一下可以撤回；每个选项为什么对、为什么错都讲清楚',
    '每道题能标难度，之后只练错题，或只看某一档难度的题',
  ]],
  ['到', '彼岸', '立一个考试日，看还剩几周几天、每天做了多少。', [
    '首页顶上一直写着离考试还剩几周几天',
    '从今天到考试那天画成一条河，沿途标出要经过的节气和满月',
    '一天一格，那天读了多少、背了多少，格子的颜色就有多深',
  ]],
]

const PRIMARY =
  'inline-flex items-center gap-2.5 rounded-sm bg-ai px-6 py-3 text-sm tracking-wider text-washi transition hover:opacity-85 disabled:opacity-40'

export default function LandingPage() {
  // null = 还没问到；问不到就当没开体验账号，只给注册
  const [demo, setDemo] = useState<boolean | null>(null)
  // 在故事里点「+ 卡片」加过的词，下面「存」那一格拿来用
  const [saved, setSaved] = useState<string[]>([])

  useEffect(() => {
    fetchAuthFeatures()
      .then((f) => setDemo(f.demo))
      .catch(() => setDemo(false))
  }, [])

  return (
    <div>
      <section className="grid items-end gap-7 md:grid-cols-[1fr_auto]">
        <div>
          <p className="flex items-center gap-2 text-xs tracking-[0.12em] text-hai">
            <span className="size-1.5 rounded-full bg-ai" />
            零基础也能读
          </p>
          <h2 className="mt-4 font-mincho text-[1.9rem] leading-[1.4] tracking-[0.05em] sm:text-5xl">
            五十音背完了，
            <br />
            下一步，读个故事。
          </h2>
          <p className="mt-5 max-w-[30em] text-[15px] leading-[1.9] text-hai">
            中国留学生<span className="text-sumi">小林</span>和她那只总偷吃早饭的白猫
            <span className="text-sumi">大福</span>，在东京的第一年。每个词都注了读音，点一下就知道意思。
          </p>
        </div>
        <Cta demo={demo} />
      </section>

      <StoryBook onSave={(w) => setSaved((s) => (s.includes(w) ? s : [...s, w]))} />

      <section className="pt-24 text-center">
        <h3 className="font-mincho text-[1.375rem] tracking-[0.08em] text-balance sm:text-3xl">大福偷吃的是早饭，你留下的是词。</h3>
        <p className="mt-2.5 text-[13px] text-hai">每天就三件事</p>
      </section>
      <Komas stack={[...STACK, ...saved].slice(-3)} />

      <section className="mt-24 grid gap-7 border-t border-usu pt-7 md:grid-cols-[1fr_1.3fr] md:gap-14">
        <div>
          <h3 className="font-mincho text-2xl leading-relaxed tracking-[0.08em]">
            读完小林的第一年，
            <br />
            还有 N4、N3 的路。
          </h3>
          <p className="mt-2.5 text-[13.5px] leading-[1.85] text-hai">
            言葉不只给初学者。存自己的文章、拆长难句、背自己的卡片、做真题，一直用到考试那天。
          </p>
        </div>
        <ul>
          {FEATURES.map(([jp, name, line, how]) => (
            <li
              key={jp}
              className="grid grid-cols-[2.4rem_1fr] items-baseline gap-x-2 border-b border-usu py-4 text-[13.5px] text-hai sm:grid-cols-[2.75rem_4.5rem_1fr]"
            >
              <span className="font-mincho text-2xl text-sumi">{jp}</span>
              <span className="text-sumi">{name}</span>
              <div className="col-start-2 sm:col-start-auto">
                <p className="text-sumi/80">{line}</p>
                <ul className="mt-2 space-y-1 text-[12.5px] leading-[1.75]">
                  {how.map((h) => (
                    <li key={h} className="relative pl-3 before:absolute before:left-0 before:text-hai/60 before:content-['·']">
                      {h}
                    </li>
                  ))}
                </ul>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-24 grid items-center gap-9 md:grid-cols-[1.1fr_1fr] md:gap-14">
        <div>
          <p className="text-xs tracking-[0.25em] text-hai">资料包</p>
          <h3 className="mt-3 font-mincho text-2xl leading-normal tracking-[0.06em] sm:text-[2rem]">
            作者亲手做的学习包。
          </h3>
          <p className="mt-4 text-sm leading-[1.9] text-hai">
            词挑好了、卡片做好了、配套的文章也写好了。解锁后整包放进你的账号，接着读、接着背。
            不同级别、不同主题会陆续出，第一本是给零基础的《<span lang="ja">リンの東京ノート</span>》。
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-x-7 gap-y-4">
            <Link to="/login?mode=register" state={{ from: `/library/${PACK.slug}/trial` }} className={PRIMARY}>
              注册，先试读 <span aria-hidden>→</span>
            </Link>
            <Link to="/library" className="text-sm text-ai underline-offset-4 hover:underline">
              看看都有什么
            </Link>
          </div>
        </div>
        <PackCover />
      </section>

      <section className="pt-28 pb-6 text-center">
        <p className="font-mincho text-[1.375rem] tracking-[0.08em]">大福还在等下一顿早饭。</p>
        <p className="mt-2 text-[13px] text-hai">小林的东京第一年，在资料包里接着写。</p>
        <div className="mt-9 flex justify-center">
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
      <div className="flex flex-wrap items-center gap-x-7 gap-y-4">
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
      {error && <p className="mt-3 text-sm text-shu">{error}</p>}
    </div>
  )
}

/**
 * 翻开的那一页：左边是资料包的书脊，右边是故事。词都能点，点了在底下一行出读音和释义，
 * 可以「+ 卡片」。没人碰时自己挨个点几个词；一碰就停。
 */
function StoryBook({ onSave }: { onSave: (word: string) => void }) {
  const [picked, setPicked] = useState<[number, number] | null>(null)
  const [touched, setTouched] = useState(false)
  const [added, setAdded] = useState<string[]>([])
  const [zh, setZh] = useState(false)

  useEffect(() => {
    if (touched) return
    let k = 0
    const pick = () => setPicked(AUTO_PICKS[k++ % AUTO_PICKS.length] as [number, number])
    const first = window.setTimeout(pick, 700)
    const every = window.setInterval(pick, 2000)
    return () => {
      clearTimeout(first)
      clearInterval(every)
    }
  }, [touched])

  const token = picked && STORY[picked[0]][picked[1]]

  function add(w: string) {
    setTouched(true)
    setAdded((a) => [...a, w])
    onSave(w)
  }

  return (
    <div className="relative mt-16">
      <Daifuku />
      <div className="tint-take grid overflow-hidden rounded-[20px] border border-[var(--edge)] bg-[var(--tint)] md:grid-cols-[15rem_1fr]">
        <div className="flex items-center gap-6 border-b border-[var(--edge)] px-6 py-5 text-[var(--ink)] md:flex-col md:items-stretch md:justify-between md:border-r md:border-b-0 md:py-6">
          <span className="font-mincho text-[4rem] leading-none md:text-[6rem]">猫</span>
          <div>
            <p className="text-[0.7rem] tracking-[0.25em]">{PACK.level}</p>
            <p lang="ja" className="mt-1.5 font-mincho text-xl tracking-[0.12em] text-sumi">
              {PACK.title}
            </p>
          </div>
          <ol className="hidden flex-wrap gap-1.5 md:flex" aria-hidden>
            {Array.from({ length: PACK.articles }, (_, i) => (
              <li
                key={i}
                className={`grid size-[26px] place-items-center rounded-md border text-[11px] ${
                  i === 0
                    ? 'border-[var(--ink)] bg-[var(--ink)] text-[var(--tint)]'
                    : 'border-[var(--edge)] bg-washi/50 text-[var(--ink)]/55'
                }`}
              >
                {i + 1}
              </li>
            ))}
          </ol>
        </div>

        <div className="bg-washi px-5 pt-6 pb-5 sm:px-11 sm:pt-9 sm:pb-7">
          <p className="flex items-baseline gap-3.5 text-xs text-hai">
            <span lang="ja" className="font-mincho text-[1.375rem] tracking-[0.1em] text-sumi">
              <ruby>
                朝<rt>あさ</rt>
              </ruby>
              ご
              <ruby>
                飯<rt>はん</rt>
              </ruby>
              がない
            </span>
            试读 · 早饭不见了
          </p>
          <div lang="ja" className="mt-3.5 font-mincho text-xl leading-[2.3] sm:text-2xl">
            {STORY.map((line, li) => (
              <p key={li}>
                {chunks(line).map((chunk, ci) => (
                  <span key={ci} className="whitespace-nowrap">
                    {chunk.map(({ token: t, i }) =>
                      t.g ? (
                        <button
                          key={i}
                          type="button"
                          onClick={() => {
                            setTouched(true)
                            setPicked([li, i])
                          }}
                          className={`rounded-[2px] px-px underline decoration-ai/50 decoration-dotted decoration-[1.5px] underline-offset-[0.32em] transition-colors ${
                            picked?.[0] === li && picked[1] === i ? 'bg-ai/15 text-ai' : 'hover:bg-ai/8'
                          }`}
                        >
                          <Word token={t} />
                        </button>
                      ) : (
                        <Word key={i} token={t} />
                      ),
                    )}
                  </span>
                ))}
              </p>
            ))}
          </div>
          <p
            className={`overflow-hidden text-[13px] leading-relaxed text-hai transition-all duration-500 ${
              zh ? 'mt-2.5 max-h-16 opacity-100' : 'max-h-0 opacity-0'
            }`}
          >
            {STORY_ZH}
          </p>

          <div className="mt-4 flex min-h-12 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-dashed border-usu pt-3.5">
            <p className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
              {token ? (
                <>
                  <span lang="ja" className="font-mincho text-xl">
                    {token.w}
                  </span>
                  {token.r && (
                    <span lang="ja" className="font-mincho text-[13px] text-ai">
                      {token.r}
                    </span>
                  )}
                  <span>{token.g}</span>
                  <button
                    type="button"
                    disabled={added.includes(token.w)}
                    onClick={() => add(token.w)}
                    className="rounded-full border border-usu px-2.5 py-0.5 text-xs text-ai transition hover:border-ai disabled:border-usu disabled:text-hai"
                  >
                    {added.includes(token.w) ? '✓ 已加入' : '+ 卡片'}
                  </button>
                </>
              ) : (
                <span className="text-[13px] text-hai">点一个带下划线的词</span>
              )}
            </p>
            <button type="button" onClick={() => setZh(!zh)} className="text-xs text-ai">
              {zh ? '收起中文' : '看中文'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/** 标点跟着前面的词，不让「。」一个人掉到下一行；「「」跟着后面的词 */
function chunks(line: Token[]) {
  const out: { token: Token; i: number }[][] = []
  let pending: { token: Token; i: number }[] = []
  line.forEach((token, i) => {
    if (token.g) {
      out.push([...pending, { token, i }])
      pending = []
    } else if (/^[「『（]/.test(token.w) || out.length === 0) {
      pending.push({ token, i })
    } else {
      out[out.length - 1].push({ token, i })
    }
  })
  if (pending.length) out.push(pending)
  return out
}

function Word({ token }: { token: Token }) {
  if (!token.r) return <>{token.w}</>
  return (
    <ruby>
      {token.w}
      <rt>{token.r}</rt>
    </ruby>
  )
}

/** 大福：一团糯米似的白猫，趴在那一页的右上角，摇尾巴、偶尔眨眼 */
function Daifuku() {
  const line = 'fill-none stroke-sumi [stroke-linecap:round] [stroke-width:1.6]'
  return (
    <svg
      viewBox="0 0 100 70"
      aria-hidden
      className="absolute -top-[50px] right-5 z-10 w-24 sm:-top-[62px] sm:right-10 sm:w-29"
    >
      <path
        className={`${line} origin-[82px_60px] motion-safe:animate-[landing-wag_3.2s_ease-in-out_infinite]`}
        d="M82 58 C 96 54, 98 40, 90 34"
      />
      <path
        className="fill-washi stroke-sumi [stroke-width:1.6]"
        d="M14 64 C 8 50, 12 30, 22 22 L 24 8 L 36 18 C 44 15, 56 15, 64 18 L 76 8 L 78 22 C 88 30, 92 50, 86 64 Z"
      />
      <g className="origin-[50px_36px] motion-safe:animate-[landing-wink_5s_infinite]">
        <path className={line} d="M36 36 q 4 3 8 0" />
        <path className={line} d="M56 36 q 4 3 8 0" />
      </g>
      <ellipse className="fill-shu/35" cx="32" cy="44" rx="4" ry="2.2" />
      <ellipse className="fill-shu/35" cx="68" cy="44" rx="4" ry="2.2" />
      <path className={line} d="M48 42 q 2 2 4 0" />
      <path className={line} d="M20 44 h -10 M21 48 l -9 3 M80 44 h 10 M79 48 l 9 3" />
    </svg>
  )
}

/** 三格：读 → 存 → 考 */
function Komas({ stack }: { stack: string[] }) {
  return (
    <section className="mt-6 grid gap-3.5 md:grid-cols-3">
      <Koma no="其の一" title="读" text="全文注好振り仮名，不认识的词点一下。">
        <div className="text-center">
          <p lang="ja" className="mb-3.5 font-mincho text-[2.5rem]">
            <ruby>
              大福<rt>だいふく</rt>
            </ruby>
          </p>
          <span className="relative inline-block rounded-xl border border-usu bg-washi px-4 py-2.5 text-[13px] after:absolute after:-bottom-[6px] after:left-5 after:size-2.5 after:rotate-45 after:border-r after:border-b after:border-usu after:bg-washi">
            猫的名字 · 本来是一种糯米点心
          </span>
        </div>
      </Koma>
      <Koma no="其の二" title="存" text="想记住的，加成卡片，一个词一张。">
        <div className="relative size-30">
          {stack.map((w, i) => (
            <span
              key={`${i}-${w}`}
              lang="ja"
              className={`absolute inset-0 grid place-items-center rounded-[10px] border border-usu bg-washi font-mincho text-3xl shadow-[0_8px_18px_-12px_rgb(0_0_0/0.35)] transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-safe:animate-[landing-rise_0.6s_cubic-bezier(0.22,1,0.36,1)_both] ${
                [
                  '-translate-x-5 translate-y-1.5 -rotate-10 group-hover:-translate-x-9 group-hover:-rotate-16',
                  'translate-x-5 translate-y-0.5 rotate-6 group-hover:translate-x-9 group-hover:rotate-11',
                  '',
                ][i]
              }`}
            >
              {w}
            </span>
          ))}
        </div>
      </Koma>
      <Koma no="其の三" title="考" text="隔几天它回来考你：看字，打读音。">
        <TypingCard />
      </Koma>
    </section>
  )
}

function Koma({ no, title, text, children }: { no: string; title: string; text: string; children: ReactNode }) {
  return (
    <div className="group flex min-h-[17.5rem] flex-col rounded-[4px] border-[1.5px] border-sumi p-5.5">
      <span className="font-mincho text-[13px] tracking-[0.2em] text-hai">{no}</span>
      <h4 className="mt-1.5 font-mincho text-[1.3rem] tracking-[0.08em]">{title}</h4>
      <p className="mt-2 text-[13px] leading-relaxed text-hai">{text}</p>
      <div className="grid flex-1 place-items-center pt-5">{children}</div>
    </div>
  )
}

/** 打字卡：滚到它就自己打一遍 neko；访客一点输入框就清空，交给他打 */
function TypingCard() {
  const [typed, setTyped] = useState('')
  const [mine, setMine] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const right = isCorrect(typed, CARD.reading)
  const wrong = !right && /^[ぁ-ゖー]+$/.test(typed) && typed.length >= CARD.reading.length

  useEffect(() => {
    const el = ref.current
    if (!el || mine) return
    const timers: number[] = []
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        io.disconnect()
        ;[...CARD.romaji].forEach((_, i) =>
          timers.push(
            window.setTimeout(() => setTyped(romajiToKana(CARD.romaji.slice(0, i + 1))), 900 + i * 220),
          ),
        )
      },
      { threshold: 0.6 },
    )
    io.observe(el)
    return () => {
      io.disconnect()
      timers.forEach(clearTimeout)
    }
  }, [mine])

  return (
    <div ref={ref} className="w-[min(14rem,100%)] text-center">
      <p lang="ja" className="font-mincho text-[3.5rem] leading-tight">
        {CARD.front}
      </p>
      <input
        value={typed}
        onFocus={() => {
          if (mine) return
          setMine(true)
          setTyped('')
        }}
        onChange={(e) =>
          setTyped((e.nativeEvent as InputEvent).isComposing ? e.target.value : romajiToKana(e.target.value))
        }
        lang="ja"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        placeholder={`试试打 ${CARD.romaji}`}
        aria-label="打读音"
        className={`mt-4 w-full border-b bg-transparent pb-1.5 text-center font-mincho text-[1.375rem] placeholder:font-ui placeholder:text-xs placeholder:text-hai/60 focus:outline-none ${
          right ? 'border-ai text-ai' : wrong ? 'border-shu text-shu' : 'border-usu focus:border-ai'
        }`}
      />
      <p
        className={`overflow-hidden text-[13px] text-hai transition-all duration-500 ${
          right ? 'mt-3 max-h-10 opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        {CARD.back} · <span className="text-ai">記住了</span>
      </p>
    </div>
  )
}

/**
 * 资料包封面，和资料页的 PackTile 一个样子（竹色那组）。
 * 右上角那叠卡错开得多一点、字竖着写在露出来的那一条上，叠着也看得见是什么词。
 */
function PackCover() {
  return (
    <Link
      to={`/library/${PACK.slug}`}
      className="tint-take group flex flex-col rounded-[18px] border border-[var(--edge)] bg-[var(--tint)] p-6 pb-5 transition hover:shadow-[0_10px_28px_-14px_rgb(0_0_0/0.25)]"
    >
      <div className="relative h-[7.5rem]">
        <span className="inline-block font-mincho text-[5.5rem] leading-none text-[var(--ink)] transition-transform duration-700 group-hover:-translate-y-1 group-hover:-rotate-3">
          猫
        </span>
        <span className="absolute top-1 right-1 h-28 w-36" aria-hidden>
          {PACK.fan.map((front, i) => (
            <span
              key={front}
              lang="ja"
              className={`absolute top-0 right-0 h-[5.8rem] w-[4.4rem] origin-[50%_120%] rounded-[9px] border border-[var(--edge)] bg-washi shadow-[0_6px_16px_-10px_rgb(0_0_0/0.35)] transition-transform duration-600 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                [
                  '-translate-x-[4.3rem] -rotate-12 group-hover:-translate-x-[4.8rem] group-hover:-rotate-16',
                  '-translate-x-[2.15rem] -rotate-4 group-hover:-translate-x-[2.5rem] group-hover:-rotate-6',
                  'rotate-5 group-hover:rotate-8',
                ][i]
              }`}
            >
              <span className="absolute top-2.5 left-2 font-mincho text-[0.95rem] [writing-mode:vertical-rl]">
                {front}
              </span>
            </span>
          ))}
        </span>
      </div>

      <span className="text-[0.7rem] tracking-[0.25em] text-[var(--ink)]">{PACK.level}</span>
      <span lang="ja" className="mt-1.5 font-mincho text-[1.45rem] tracking-[0.12em]">
        {PACK.title}
      </span>
      <p className="mt-2.5 text-sm leading-relaxed text-sumi/70">{PACK.summary}</p>
      <div className="mt-4 flex gap-4 text-xs text-sumi/60">
        <span>
          <span className="mr-0.5 font-mincho text-lg text-sumi">{PACK.cards}</span>张卡
        </span>
        <span>
          <span className="mr-0.5 font-mincho text-lg text-sumi">{PACK.articles}</span>篇阅读
        </span>
      </div>
      <div className="mt-4 flex items-baseline justify-between border-t border-[var(--edge)] pt-4">
        <span className="font-mincho text-xl text-[var(--ink)]">{PACK.price}</span>
        <span className="text-xs text-[var(--ink)]">
          看看里面{' '}
          <span className="inline-block transition-transform duration-300 group-hover:translate-x-1">→</span>
        </span>
      </div>
    </Link>
  )
}
