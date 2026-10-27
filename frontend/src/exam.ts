/**
 * 应试：把一份真题（.docx / .txt）拆成「大题 → 本文 → 小题」，
 * 按卷面排出来作答。读解、言語知識都是这一套。
 *
 * 认的是和阅读批量导入同一种讲义排法：
 * 「問題10　短篇阅读（問55–59）」起一道大题，「本文（1）」「本文A」起一篇
 * （言語知識没有本文，题直接挂在大题下面），
 * 「問55　…」起一道小题，后面「1. …」是选项（一行挤两个、四个都认）；
 * 【正解】之后「問題10　55-59 ：3，4，4，1，2」是答案，「—」是没有答案，不计分。
 */
import { annotateFurigana } from './api'
import { readDocxLines } from './batch'
import { annotateArticle, stripFurigana } from './reading'

export interface ExamContent {
  /** 标题下面那几行说明，比如出处 */
  preface: string[]
  sections: ExamSection[]
}

export interface ExamSection {
  /** 「問題10」；没有大题标记的文件是空串 */
  label: string
  /** 「短篇阅读」 */
  name: string
  passages: ExamPassage[]
}

export interface ExamPassage {
  /** 「本文（1）」；没有标记是空串 */
  label: string
  blocks: ExamBlock[]
  questions: ExamQuestion[]
}

/**
 * text 正文的一段 / intro「以下は…である。」/ part 对比阅读的 A、B /
 * note 注释（mark 是「注1」）/ source 靠右的一行：出处「（…による）」、通知的落款
 */
export type ExamBlockKind = 'text' | 'intro' | 'part' | 'note' | 'source'

export interface ExamBlock {
  kind: ExamBlockKind
  text: string
  mark?: string | null
}

export interface ExamQuestion {
  number: number
  stem: string
  /** 题干和选项之间附的材料，比如信息检索题里的「メモ」 */
  extra: string[]
  choices: string[]
  /** 从 1 数；null = 答案缺失，不计分 */
  answer: number | null
}

/**
 * 下线部的记号。导入时按题干在本文里找到被问的那一句，用它括起来 ——
 * 存的时候就标好，后面注音是按偏移插的，记号原样留着。
 */
export const UNDERLINE_OPEN = '⟦'
export const UNDERLINE_CLOSE = '⟧'

const SECTION = /^問題\s*(\d+)\s*(.*)$/
/**
 * 「本文」「本文（2）」「本文 A」，言語知識的問題9 有的写「文章」。
 * 字母用来认出 B 要接在 A 后面
 */
const PASSAGE = /^(?:本文|文章)\s*(?:[（(]\s*\d+\s*[）)]|([A-ZＡ-Ｚ]))?$/
const QUESTION = /^問\s*(\d+)[\s.．、:：]*(.*)$/
/** 「1. …」，信息检索题里有时前面还带个「・」 */
const CHOICE = /^・?\s*([1-4１-４])\s*[.．、)）]\s*/
const ANSWERS = /^【(?:正解|解答|答案)】/
/** 「問題10　55-59 ：3，4，4，1，2」，前面的「問題10」可以没有 */
const ANSWER_LINE = /^(?:問題\s*\d+\s*)?(\d+)\s*[-–－~～]\s*(\d+)\s*[:：]\s*(.+)$/
const NOTE = /^（(注\d*)）\s*/
const SOURCE = /（[^（）]*(?:による|より)）$/
/** 有的讲义在本文第一行又写了一遍「（1）」 */
const LEADING_NUMBER = /^[（(]\d+[）)]\s*/
/** 本文前面的说明：「以下は…である。」「次のAとBの文章を読んで…」 */
const INTRO = /^(?:以下は|次の)/
/** 对比阅读的大题。这种题的 A、B 有时不单起一行，直接粘在段首：「A就職したばかりの…」 */
const COMPARATIVE = /对比|對比|対比|比較|統合/
const GLUED_PART = /^([AＡBＢ])\s*(?=[^A-Za-z0-9\s])/
const CIRCLED = /[①-⑳]/
/** 左边收件人、一串全角空格、右边落款 */
const LETTERHEAD = /^(\S.*?)　{4,}(\S.*)$/
/** 讲义转录时混进来的视频文件名：「*vocab-q4.mp4*（問20も本動画末尾）」 */
const MEDIA_NOTE = /^\*[^*]+\.(?:mp4|mov|mp3|m4a|wav)\*/i
/**
 * 漢字読み、漢字表記：被问的那个词注了音就等于把答案写出来了，
 * 下线部和选项不注音
 */
const KANJI_SECTION = /漢字/

export interface ParsedExam {
  title: string
  content: ExamContent
  questionCount: number
  /** 有答案的题数 */
  gradedCount: number
  /** 排得不太对的地方，导入前给人看一眼 */
  warnings: string[]
}

export async function readExamFile(file: File): Promise<ParsedExam> {
  const name = file.name.replace(/\.(docx|txt)$/i, '')
  const lines = /\.docx$/i.test(file.name)
    ? await readDocxLines(file, [UNDERLINE_OPEN, UNDERLINE_CLOSE])
    : (await file.text()).split(/\r?\n/)
  return parseExam(lines, name)
}

export function parseExam(lines: string[], fallbackTitle: string): ParsedExam {
  const head: string[] = []
  const sections: ExamSection[] = []
  const answers = new Map<number, number | null>()
  // 写成 as：下面的闭包会改它们，不让 TS 按初始值把类型收窄成 null
  let section = null as ExamSection | null
  let passage = null as ExamPassage | null
  let question: ExamQuestion | null = null
  let inAnswers = false

  function currentSection(): ExamSection {
    if (!section) {
      section = { label: '', name: '', passages: [] }
      sections.push(section)
    }
    return section
  }

  function startPassage(label: string): ExamPassage {
    passage = { label, blocks: [], questions: [] }
    currentSection().passages.push(passage)
    question = null
    return passage
  }

  for (const raw of lines) {
    // 「### 文章」「### 案内文」：讲义里混进来的 Markdown 标题记号
    const line = raw.trim().replace(/^#+\s*/, '')
    if (line === '' || MEDIA_NOTE.test(line)) continue

    if (ANSWERS.test(line)) {
      inAnswers = true
      continue
    }
    if (inAnswers) {
      readAnswerLine(line, answers)
      continue
    }

    const sectionMatch = line.match(SECTION)
    if (sectionMatch) {
      // 「問題5続き／言い換え」：同一道大题接着往下排
      if (section?.label === `問題${sectionMatch[1]}`) continue
      section = {
        label: `問題${sectionMatch[1]}`,
        // 「短篇阅读（問55–59）」：题号范围按小题现算，不要这半截
        name: sectionMatch[2].replace(/[（(]問[^）)]*[）)]\s*$/, '').trim(),
        passages: [],
      }
      sections.push(section)
      passage = null
      question = null
      continue
    }

    const passageMatch = line.match(PASSAGE)
    if (passageMatch) {
      const letter = passageMatch[1]?.normalize('NFKC')
      // 「本文B」接在「本文A」后面 —— 对比阅读是一篇两段、共用一组题
      if (letter && letter !== 'A' && passage && passage.questions.length === 0) {
        passage.blocks.push({ kind: 'part', text: letter })
        continue
      }
      // A、B 由 part 块标出来，标签只留「本文」
      const started = startPassage(letter ? '本文' : line.replace(/\s+/g, ''))
      if (letter) started.blocks.push({ kind: 'part', text: letter })
      continue
    }

    const questionMatch = line.match(QUESTION)
    if (questionMatch) {
      // 先开本文再建题：startPassage 会把 question 清掉
      const target = passage ?? startPassage('')
      question = {
        number: Number(questionMatch[1]),
        stem: questionMatch[2].trim(),
        extra: [],
        choices: [],
        answer: null,
      }
      target.questions.push(question)
      continue
    }

    if (question) {
      const q: ExamQuestion = question
      const choices = CHOICE.test(line) ? splitChoices(line) : null
      if (choices) {
        // 又从 1 数起：前面那串「・1. リーさん…」是题目给的材料，这串才是选项
        if (q.choices.length > 0 && !line.startsWith('・') && /^[1１]/.test(line)) {
          q.extra.push(...q.choices.map((c, i) => `・${i + 1}. ${c}`))
          q.choices = []
        }
        q.choices.push(...choices)
      } else if (q.choices.length > 0) {
        // 选项折行了：接到上一个选项后面
        q.choices[q.choices.length - 1] += line
      } else if (q.stem === '') {
        q.stem = line
      } else {
        q.extra.push(line)
      }
      continue
    }

    if (!passage && sections.length === 0) {
      head.push(line)
      continue
    }
    pushBlocks(passage ?? startPassage(''), line, COMPARATIVE.test(section?.name ?? ''))
  }

  const content: ExamContent = { preface: head.slice(1), sections }
  const title = head[0] ?? fallbackTitle
  // docx 里带着原卷的下划线就用原卷的；txt 没有，才按题干去本文里找
  const underlined = lines.some((line) => line.includes(UNDERLINE_OPEN))

  const warnings: string[] = []
  let questionCount = 0
  let gradedCount = 0
  // 一道题都没有的大题不要：只有标题的，或者讲义写着「未收录」的
  const answerable = sections.filter((s) => s.passages.some((p) => p.questions.length > 0))
  for (const s of sections) {
    if (!answerable.includes(s) && s.passages.length > 0) {
      warnings.push(`${s.label} 没有题目，略过了`)
    }
  }
  for (const s of answerable) {
    for (const p of s.passages) {
      if (COMPARATIVE.test(s.name)) labelParts(p)
      if (!underlined) markUnderlines(p)
      for (const q of p.questions) {
        // 对话题一问好几行（A「…」B「…」），都是题干；带「・」的才是题目附的材料
        if (q.extra.length > 0 && !q.extra.some((line) => line.startsWith('・'))) {
          q.stem = [q.stem, ...q.extra].filter((line) => line !== '').join('\n')
          q.extra = []
        }
        questionCount += 1
        q.answer = answers.get(q.number) ?? null
        if (q.answer !== null && q.answer > q.choices.length) q.answer = null
        if (q.answer !== null) gradedCount += 1
        if (q.choices.length !== 4) warnings.push(`問${q.number} 读到 ${q.choices.length} 个选项`)
      }
      if (p.questions.length === 0) {
        warnings.push(`${s.label}${p.label} 后面没有题目`)
      }
    }
  }
  if (questionCount === 0) throw new Error('没有读到「問55」这样的题目')
  const missing = questionCount - gradedCount
  if (missing > 0) warnings.push(`${missing} 题没有答案，不计分`)

  content.sections = answerable
  return { title, content, questionCount, gradedCount, warnings }
}

function readAnswerLine(line: string, answers: Map<number, number | null>) {
  const match = line.match(ANSWER_LINE)
  if (!match) return
  const first = Number(match[1])
  match[3]
    .split(/[，,、\s]+/)
    .filter((token) => token !== '')
    .forEach((token, i) => {
      const value = Number(token.normalize('NFKC'))
      answers.set(first + i, Number.isInteger(value) && value >= 1 && value <= 4 ? value : null)
    })
}

/** 「1. 甲　2. 乙」→ ["甲", "乙"]。只认下一个顺号，选项里的「2,000円」不会被切开。 */
function splitChoices(line: string): string[] {
  const first = line.match(CHOICE)
  if (!first) return []
  const out: string[] = []
  let n = Number(first[1].normalize('NFKC'))
  let rest = line.slice(first[0].length)
  for (;;) {
    const next = n + 1
    const wide = String.fromCharCode(0xff10 + next)
    const match = rest.match(new RegExp(`\\s+[${next}${wide}]\\s*[.．、)）]\\s*`))
    if (!match || match.index === undefined) break
    out.push(rest.slice(0, match.index).trim())
    rest = rest.slice(match.index + match[0].length)
    n = next
  }
  out.push(rest.trim())
  return out
}

/** 本文里的一行：注释一行可能挤着好几条，出处从段尾拆下来单放。 */
function pushBlocks(passage: ExamPassage, line: string, comparative: boolean) {
  const blocks = passage.blocks
  const first = !blocks.some((b) => b.kind !== 'part')
  let text = first ? line.replace(LEADING_NUMBER, '') : line

  // 只认顺着来的：还没有 A 时认 A，有了 A 才认 B ——「A社かB社か…」这种句子不会被当成标记
  const glued = comparative ? text.match(GLUED_PART) : null
  const letter = glued?.[1].normalize('NFKC')
  const parts = blocks.filter((b) => b.kind === 'part').map((b) => b.text).join('')
  if (glued && ((letter === 'A' && parts === '') || (letter === 'B' && parts === 'A'))) {
    blocks.push({ kind: 'part', text: letter })
    text = text.slice(glued[0].length)
  }

  if (NOTE.test(text)) {
    for (const piece of text.split(/(?=（注\d*）)/)) {
      const match = piece.match(NOTE)
      if (match) blocks.push({ kind: 'note', mark: match[1], text: piece.slice(match[0].length).trim() })
    }
    return
  }

  if (first && INTRO.test(text)) {
    blocks.push({ kind: 'intro', text })
    return
  }

  // 通知的抬头「9月1日マンション森村ご入居の皆様　　　　　　マンション森村管理会社」：
  // 原卷拿一串全角空格把落款推到右边，照排会撑出屏幕。拆开，落款靠右单放
  const letterhead = text.match(LETTERHEAD)
  if (letterhead) {
    blocks.push({ kind: 'text', text: letterhead[1] })
    blocks.push({ kind: 'source', text: letterhead[2] })
    return
  }

  const source = text.match(SOURCE)
  if (source && source.index !== undefined) {
    const body = text.slice(0, source.index).trim()
    if (body !== '') blocks.push({ kind: 'text', text: body })
    blocks.push({ kind: 'source', text: source[0] })
    return
  }

  // 「・冷蔵品は対象外です。・専用の箱で…」：OCR 把一条条的列表挤成了一行，
  // 在句号、右括号后面的「・」处拆开。词中间的「冷蔵・冷凍」不拆
  const items = text.startsWith('・') ? text.split(/(?<=[。）)])(?=・)/) : [text]
  for (const item of items) blocks.push({ kind: 'text', text: item })
}

/**
 * 对比阅读一个 A、B 标记都没有、正文正好两段的：那两段就是 A 和 B
 * （讲义只在说明里写了「次のAとBの文章を読んで」）。
 */
function labelParts(passage: ExamPassage) {
  if (passage.blocks.some((b) => b.kind === 'part')) return
  const texts = passage.blocks.filter((b) => b.kind === 'text')
  if (texts.length !== 2) return
  passage.blocks.splice(passage.blocks.indexOf(texts[0]), 0, { kind: 'part', text: 'A' })
  passage.blocks.splice(passage.blocks.indexOf(texts[1]), 0, { kind: 'part', text: 'B' })
}

/**
 * 找出题干问的是本文哪一句，两边都用记号括起来，卷面上画下划线。
 *
 * 带圈号的（①書くという表現をする場合…）：本文里同一个圈号后面那句和题干
 * 逐字比，取公共的开头；题干是「…とあるが」的，以它为准 —— 光比公共开头
 * 会把「見せている」后面那个「と」也吃进去。
 * 不带圈号的（そんな楽器とは…）：取「とあるが」「とは」前面那截，本文里
 * 原样出现才算；题干给它加了「」而本文没有的，去掉括号再找一次。
 */
function markUnderlines(passage: ExamPassage) {
  const texts = passage.blocks.filter((b) => b.kind === 'text')

  for (const q of passage.questions) {
    const circled = q.stem.match(CIRCLED)
    if (circled && circled.index !== undefined) {
      const stemRest = q.stem.slice(circled.index + 1)
      const block = texts.find((b) => b.text.includes(circled[0]))
      if (!block) continue
      const at = block.text.indexOf(circled[0]) + 1
      let phrase = commonPrefix(stemRest, block.text.slice(at))
      const quote = stemRest.indexOf('とあるが')
      if (quote > 0 && quote <= phrase.length) phrase = stemRest.slice(0, quote)
      phrase = phrase.replace(/[、，。]+$/, '')
      if (phrase.length < 2) continue
      block.text = wrapAt(block.text, at, phrase.length)
      q.stem = wrapAt(q.stem, circled.index + 1, phrase.length)
      continue
    }

    const quote = q.stem.search(/とあるが|とは/)
    if (quote < 2) continue
    const quoted = q.stem.slice(0, quote)
    const bare = quoted.match(/^「([^「」]+)」$/)?.[1]
    for (const [phrase, offset] of [[quoted, 0], ...(bare ? [[bare, 1] as const] : [])] as const) {
      const block = texts.find((b) => b.text.includes(phrase))
      if (!block) continue
      block.text = wrapAt(block.text, block.text.indexOf(phrase), phrase.length)
      q.stem = wrapAt(q.stem, offset, phrase.length)
      break
    }
  }
}

function commonPrefix(a: string, b: string): string {
  let i = 0
  while (i < a.length && i < b.length && a[i] === b[i]) i += 1
  return a.slice(0, i)
}

function wrapAt(text: string, start: number, length: number): string {
  return (
    text.slice(0, start) +
    UNDERLINE_OPEN +
    text.slice(start, start + length) +
    UNDERLINE_CLOSE +
    text.slice(start + length)
  )
}

/** 卷面上所有要注音的文字，按固定顺序过一遍，fn 的返回值写回去。 */
function mapTexts(content: ExamContent, fn: (text: string) => string): ExamContent {
  return {
    preface: content.preface,
    sections: content.sections.map((s) => ({
      ...s,
      passages: s.passages.map((p) => ({
        ...p,
        blocks: p.blocks.map((b) => (b.kind === 'part' ? b : { ...b, text: fn(b.text) })),
        questions: p.questions.map((q) => ({
          ...q,
          stem: fn(q.stem),
          extra: q.extra.map(fn),
          choices: q.choices.map(fn),
        })),
      })),
    })),
  }
}

/** 一次注音请求塞多少字。后端上限 2000 */
const CHUNK = 1800
const CONCURRENCY = 4

/**
 * 给整份卷子注音。卷面是几百行短句（选项十来个字一行），一行一个请求太碎，
 * 所以攒成一千多字一块、用换行隔开发过去，回来再按换行拆开 —— 注音按偏移插，
 * 换行原样留着。哪一块出错就退回逐行注音（超长的行会按句子切），还不行就用原文。
 */
export async function annotateExam(
  content: ExamContent,
  onProgress: (done: number, total: number) => void,
): Promise<{ content: ExamContent; plain: number }> {
  // 对话题的题干自己带换行：拆成几行发，回来再按原来的行数拼上
  const lines: string[] = []
  mapTexts(content, (text) => {
    lines.push(...text.split('\n'))
    return text
  })

  const chunks: string[][] = []
  let size = 0
  for (const line of lines) {
    const last = chunks[chunks.length - 1]
    if (!last || size + line.length + 1 > CHUNK) {
      chunks.push([line])
      size = line.length
    } else {
      last.push(line)
      size += line.length + 1
    }
  }

  const annotated: string[][] = chunks.map((chunk) => chunk)
  let plain = 0
  let done = 0
  let cursor = 0
  onProgress(0, chunks.length)

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, chunks.length) }, async () => {
      while (cursor < chunks.length) {
        const index = cursor++
        const chunk = chunks[index]
        const body = chunk.join('\n')
        try {
          // 空行注不了音，也没必要发
          if (body.trim() === '') throw new Error('empty')
          const parts = (await annotateFurigana(body)).text.split('\n')
          if (parts.length !== chunk.length) throw new Error('lines changed')
          annotated[index] = parts
        } catch {
          const result = await annotateArticle(body, null, () => {})
          const parts = result.text.split('\n')
          if (parts.length === chunk.length) {
            annotated[index] = parts
            plain += result.plain
          } else {
            plain += 1
          }
        }
        onProgress(++done, chunks.length)
      }
    }),
  )

  const flat = annotated.flat()
  let i = 0
  const rejoin = (text: string) => {
    const count = text.split('\n').length
    i += count
    return flat.slice(i - count, i).join('\n')
  }
  return { content: hideAnswerReadings(mapTexts(content, rejoin)), plain }
}

const UNDERLINED = new RegExp(`${UNDERLINE_OPEN}[^${UNDERLINE_CLOSE}]*${UNDERLINE_CLOSE}`, 'g')

/** 漢字题的下线部和选项：注上的音再去掉 */
function hideAnswerReadings(content: ExamContent): ExamContent {
  return {
    ...content,
    sections: content.sections.map((s) =>
      KANJI_SECTION.test(s.name)
        ? {
            ...s,
            passages: s.passages.map((p) => ({
              ...p,
              questions: p.questions.map((q) => ({
                ...q,
                stem: q.stem.replace(UNDERLINED, (marked) => stripFurigana(marked)),
                choices: q.choices.map(stripFurigana),
              })),
            })),
          }
        : s,
    ),
  }
}

/** 一份卷子里所有的小题，按卷面顺序。 */
export function examQuestions(content: ExamContent): ExamQuestion[] {
  return content.sections.flatMap((s) => s.passages.flatMap((p) => p.questions))
}

/** 计时器：「32:10」，过了一小时「1:02:03」。 */
export function formatClock(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = String(seconds % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`
}

/** 列表里说用时：「32 分钟」。不到一分钟也算一分钟 */
export function formatMinutes(seconds: number): string {
  return `${Math.max(1, Math.round(seconds / 60))} 分钟`
}
