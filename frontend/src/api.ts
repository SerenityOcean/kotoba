import type { ExamContent } from './exam'

export interface Card {
  id: number
  deckId: number
  front: string
  back: string | null
  /** 读音，打字复习时对答案用。几个读音用 ／ 隔开；null = 不考读音 */
  reading: string | null
  /** 值得考读音、但还没有读音 */
  readingMissing: boolean
  /** 牌组自带的录音：单词读音、例句。没有就不出声 */
  wordAudio: boolean
  sentenceAudio: boolean
  dueAt: string
  intervalDays: number
  repetitions: number
  easeFactor: number
  lapses: number
  createdAt: string
}

export type Rating = 'AGAIN' | 'HARD' | 'GOOD'

export interface Stats {
  totalCards: number
  /** 这一轮要复习的总数 = 到期旧卡 + 今天还能放的新卡 */
  dueToday: number
  reviewedToday: number
  dueReviews: number
  /** 今天还能放出的新卡 */
  newToday: number
  /** 所有还没学过、等着被放出来的卡 */
  newWaiting: number
  /** 今天已经学了几张新卡 */
  learnedToday: number
  /** 每天新卡上限，null = 不限 */
  dailyNewLimit: number | null
}

/** 浏览器所在的时区。「今天」都从这里的零点算，和服务器在哪儿无关。 */
function browserZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}

export interface ImportResult {
  deckId: number
  deckName: string
  imported: number
  skipped: number
  skippedFronts: string[]
  /** 正面 → 卡片 id，新建的和包里已有的都在。录音按它往上传 */
  cardIds: Record<string, number>
}

export interface Deck {
  id: number
  name: string
  cardCount: number
  dueCount: number
  createdAt: string
}

export interface VerbUsage {
  surface: string
  dictionaryForm: string
  reading: string
  form: string
  explanation: string
  meaning: string
  /** 自动词 / 他动词 / 自他两用；形容词是 い形容词 / な形容词 */
  transitivity: string
  /** 这个词本身怎么用：带的助词、固定搭配、自他对应 */
  usage: string
}

/** 名词、副词这些：动词形容词、外来语以外值得学的词 */
export interface Word {
  surface: string
  reading: string
  /** 名词 / サ变名词 / 副词 / 连体词 / 接续词 */
  partOfSpeech: string
  meaning: string
  /** 搭配、美化语、和中文同形词的区别；没什么好说的是空串 */
  note: string
}

export interface Loanword {
  surface: string
  english: string
  /** 来源语言；非英语来源、和製英語会在这里说明 */
  origin: string
  meaning: string
}

export interface GrammarPoint {
  pattern: string
  meaning: string
  explanation: string
  example: string
}

export interface AnalyzedSentence {
  original: string
  translation: string
  verbs: VerbUsage[]
  /** 新字段：改版前的结果里没有，读的时候按可能缺省处理 */
  words?: Word[]
  /** 新字段：改版前的结果里没有，读的时候按可能缺省处理 */
  loanwords?: Loanword[]
  grammarPoints: GrammarPoint[]
}

export interface Analysis {
  sentences: AnalyzedSentence[]
}

/** 会话过期时所有请求都会撞 401，AuthProvider 听这个事件把登录态清掉。 */
export const UNAUTHORIZED_EVENT = 'kotoba:unauthorized'

export class UnauthorizedError extends Error {
  constructor(message = '登录已过期，请重新登录') {
    super(message)
    this.name = 'UnauthorizedError'
  }
}

/**
 * 所有请求都走这里。写请求（POST/PUT/PATCH/DELETE）要带 CSRF 令牌：
 * 后端把它放在 XSRF-TOKEN cookie 里（JS 能读），这边抄进 X-XSRF-TOKEN 头。
 * 别的网站能让浏览器带上 cookie，但读不到 cookie 的值，也就凑不出这个头。
 */
export async function apiFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const method = (init.method ?? 'GET').toUpperCase()
  if (method === 'GET' || method === 'HEAD') {
    return fetch(url, init)
  }
  const headers = new Headers(init.headers)
  const token = readCookie('XSRF-TOKEN')
  if (token) {
    headers.set('X-XSRF-TOKEN', token)
  }
  return fetch(url, { ...init, headers })
}

function readCookie(name: string): string | null {
  const match = document.cookie.split('; ').find((c) => c.startsWith(`${name}=`))
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null
}

/** 后端失败时回的是 { message }，能读到就用它，读不到才退回状态码。 */
async function toError(res: Response, fallback: string, silent401 = false): Promise<Error> {
  let message = fallback
  try {
    const body = await res.json()
    if (body && typeof body.message === 'string') {
      message = body.message
    }
  } catch {
    // 不是 JSON（比如 Spring 直接回的 401 空体），用兜底文案
  }

  if (res.status === 401) {
    // 登录接口自己会显示错误，别让它顺手把页面踢回登录页
    if (!silent401) {
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT))
    }
    return new UnauthorizedError(message === fallback ? undefined : message)
  }
  return new Error(message)
}

async function handle<T>(res: Response, silent401 = false): Promise<T> {
  if (!res.ok) {
    throw await toError(res, `请求失败：${res.status}`, silent401)
  }
  return res.json() as Promise<T>
}

/** deckId 不传就是全部包。 */
export async function fetchCards(deckId?: number): Promise<Card[]> {
  const res = await apiFetch(deckId ? `/api/cards?deckId=${deckId}` : '/api/cards')
  return handle<Card[]>(res)
}

/**
 * 这一轮要复习的卡：到期的旧卡全部 + 今天名额内的新卡。
 * extraNew 是今天名额用完后「再来几张」。
 */
export async function fetchDueCards(deckId?: number, extraNew = 0): Promise<Card[]> {
  const params = new URLSearchParams({ tz: browserZone() })
  if (deckId) params.set('deckId', String(deckId))
  if (extraNew > 0) params.set('extraNew', String(extraNew))
  const res = await apiFetch(`/api/cards/due?${params}`)
  return handle<Card[]>(res)
}

/** null = 不限 */
export async function saveDailyNewLimit(limit: number | null): Promise<number | null> {
  const res = await apiFetch('/api/study-settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dailyNewLimit: limit }),
  })
  return (await handle<{ dailyNewLimit: number | null }>(res)).dailyNewLimit
}

export async function createCard(front: string, back: string, deckId?: number): Promise<Card> {
  const res = await apiFetch(deckId ? `/api/cards?deckId=${deckId}` : '/api/cards', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ front, back }),
  })
  return handle<Card>(res)
}

/** reading 留空，后端就按正反面重新猜。 */
export async function updateCard(
  id: number,
  front: string,
  back: string,
  reading: string,
): Promise<Card> {
  const res = await apiFetch(`/api/cards/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ front, back, reading }),
  })
  return handle<Card>(res)
}

/** 补读音一批的结果。nextAfterId 是 null 就翻完了。 */
export interface ReadingFill {
  filled: number
  /** 词典里查不到、没补上的张数 */
  missed: number
  nextAfterId: number | null
}

export interface CardReadings {
  readings: { id: number; reading: string }[]
}

/** 只给指定的卡补读音，一次最多 50 张。复习页开场给到期的卡用。 */
export async function fillReadingsFor(ids: number[]): Promise<CardReadings> {
  const res = await apiFetch('/api/cards/readings/fill-cards', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
  })
  return handle<CardReadings>(res)
}

export async function fillReadings(afterId?: number): Promise<ReadingFill> {
  const query = afterId === undefined ? '' : `?afterId=${afterId}`
  const res = await apiFetch(`/api/cards/readings/fill${query}`, { method: 'POST' })
  return handle<ReadingFill>(res)
}

export async function deleteCard(id: number): Promise<void> {
  const res = await apiFetch(`/api/cards/${id}`, { method: 'DELETE' })
  if (!res.ok) {
    throw await toError(res, `删除失败：${res.status}`)
  }
}

export async function reviewCard(id: number, rating: Rating): Promise<Card> {
  const res = await apiFetch(`/api/cards/${id}/review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rating }),
  })
  return handle<Card>(res)
}

/** 带上浏览器的时区：「今天复习了几张」要从你那里的零点算，不是 UTC 零点。 */
export async function fetchStats(): Promise<Stats> {
  const res = await apiFetch(`/api/stats?${new URLSearchParams({ tz: browserZone() })}`)
  return handle<Stats>(res)
}

/** 一批请求体最多这么大：nginx 只收 1 MB 以内的，留一半余量。 */
const IMPORT_BATCH_BYTES = 512 * 1024
/** 一批最多这么多张，后端上限 5000。 */
const IMPORT_BATCH_CARDS = 2000

/**
 * deckName 留空进默认包；包不存在会按这个名字新建。
 *
 * 带例句的 Anki 包一千多张就超过 1 MB 了，所以按大小分批发，结果加起来。
 * 中途哪批失败了，前面几批已经存下了 —— 重新导入时包里已有的会被跳过，不会重复。
 */
export async function importCards(
  cards: { front: string; back: string }[],
  deckName?: string,
): Promise<ImportResult> {
  const encoder = new TextEncoder()
  const batches: { front: string; back: string }[][] = []
  let batch: { front: string; back: string }[] = []
  let size = 0
  for (const card of cards) {
    const bytes = encoder.encode(JSON.stringify(card)).length + 1
    if (batch.length > 0 && (size + bytes > IMPORT_BATCH_BYTES || batch.length >= IMPORT_BATCH_CARDS)) {
      batches.push(batch)
      batch = []
      size = 0
    }
    batch.push(card)
    size += bytes
  }
  if (batch.length > 0) batches.push(batch)

  const results: ImportResult[] = []
  for (const part of batches) {
    const res = await apiFetch('/api/cards/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cards: part, deckName }),
    })
    results.push(await handle<ImportResult>(res))
  }
  if (results.length === 0) throw new Error('没有要导入的卡片')
  return results.reduce((total, result) => ({
    ...result,
    imported: total.imported + result.imported,
    skipped: total.skipped + result.skipped,
    skippedFronts: [...total.skippedFronts, ...result.skippedFronts],
    cardIds: { ...total.cardIds, ...result.cardIds },
  }))
}

export type AudioKind = 'word' | 'sentence'

/** 一段录音最大多少，和后端 CardAudioService.MAX_BYTES 一致。 */
export const MAX_AUDIO_BYTES = 1024 * 1024
/** 一批录音最多多大、多少段：nginx 一个请求只收 2 MB，Tomcat 最多 50 个 part，各留余量。 */
const AUDIO_BATCH_BYTES = 1.5 * 1024 * 1024
const AUDIO_BATCH_FILES = 40

/** 卡片自带的一段录音的地址，复习时直接拿来放。 */
export function cardAudioUrl(cardId: number, kind: AudioKind): string {
  return `/api/cards/${cardId}/audio/${kind}`
}

/**
 * 把牌组自带的录音传到对应的卡上。用到才读（read），攒够一批发一次 ——
 * 上千段录音一段一个请求，跨境来回的等待比传的时间还长。
 *
 * 读不到的（包里缺文件、不认识的格式）和超过 1 MB 的跳过，不算失败。
 * 中途哪批失败就停下抛错，前面几批已经存下了；同一个牌组再导一次会补上。
 */
export async function uploadCardAudio(
  items: { cardId: number; kind: AudioKind; read: () => Promise<Blob | null> }[],
  onProgress: (done: number, total: number) => void,
): Promise<{ stored: number; skipped: number }> {
  let stored = 0
  let skipped = 0
  let done = 0
  let batch: { name: string; file: Blob }[] = []
  let size = 0

  async function flush() {
    if (batch.length === 0) return
    const form = new FormData()
    for (const { name, file } of batch) form.append(name, file, name)
    const res = await apiFetch('/api/cards/audio', { method: 'POST', body: form })
    stored += (await handle<{ stored: number }>(res)).stored
    done += batch.length
    onProgress(done + skipped, items.length)
    batch = []
    size = 0
  }

  onProgress(0, items.length)
  for (const item of items) {
    const file = await item.read()
    if (!file || file.size === 0 || file.size > MAX_AUDIO_BYTES) {
      skipped += 1
      continue
    }
    if (batch.length >= AUDIO_BATCH_FILES || size + file.size > AUDIO_BATCH_BYTES) {
      await flush()
    }
    batch.push({ name: `${item.cardId}.${item.kind}`, file })
    size += file.size
  }
  await flush()
  onProgress(items.length, items.length)
  return { stored, skipped }
}

// ---- 包 ------------------------------------------------------------------

/** 带时区：包列表上的「复习 N」里新卡按今天的名额折算。 */
export async function fetchDecks(): Promise<Deck[]> {
  const res = await apiFetch(`/api/decks?${new URLSearchParams({ tz: browserZone() })}`)
  return handle<Deck[]>(res)
}

export async function createDeck(name: string): Promise<Deck> {
  const res = await apiFetch('/api/decks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  })
  return handle<Deck>(res)
}

export async function renameDeck(id: number, name: string): Promise<Deck> {
  const res = await apiFetch(`/api/decks/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  })
  return handle<Deck>(res)
}

/** 删包会连里面的卡片一起删。 */
export async function deleteDeck(id: number): Promise<void> {
  const res = await apiFetch(`/api/decks/${id}`, { method: 'DELETE' })
  if (!res.ok) {
    throw await toError(res, `删除失败：${res.status}`)
  }
}

// ---- 彼岸 ----------------------------------------------------------------

export interface Goal {
  title: string
  /** 不带时区的日期，形如 2026-12-06 */
  targetDate: string
  /** 立下目标的时刻，周格子从这里数起 */
  startedAt: string
}

/** 还没立目标时后端回 204，这里给 null。 */
export async function fetchGoal(): Promise<Goal | null> {
  const res = await apiFetch('/api/goal')
  if (res.status === 204) return null
  return handle<Goal>(res)
}

export async function saveGoal(title: string, targetDate: string): Promise<Goal> {
  const res = await apiFetch('/api/goal', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, targetDate }),
  })
  return handle<Goal>(res)
}

export async function clearGoal(): Promise<void> {
  const res = await apiFetch('/api/goal', { method: 'DELETE' })
  if (!res.ok) {
    throw await toError(res, `清除失败：${res.status}`)
  }
}

/** 某一天做了什么。日期按传过去的时区算。 */
export interface DailyActivity {
  /** 形如 2026-09-23 */
  date: string
  /** 复习了几次 */
  reviews: number
  /** 其中头一回复习的卡（新学） */
  learned: number
  /** 读了几篇文章（按存进来的时间算） */
  articles: number
}

/** from、to 都含，形如 2026-09-23。什么都没做的日子不在列表里。 */
export async function fetchActivity(from: string, to: string): Promise<DailyActivity[]> {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
  const query = new URLSearchParams({ from, to, tz })
  const res = await apiFetch(`/api/activity?${query}`)
  return handle<DailyActivity[]>(res)
}

/**
 * 把粘进来的文本切成句子。逐句并行拆解，哪句先回来先显示 ——
 * 等待时间就从「所有句子之和」变成「最慢的那一句」。
 *
 * 切法：句号/问号/叹号断句，右引号和右括号跟着前一句走；剩下没有标点
 * 收尾的那一段也算一句（很多复制来的文本最后一句是秃的）。
 */
export function splitSentences(text: string): string[] {
  return text
    .split(/\n+/)
    .flatMap((line) => line.match(/[^。！？!?]*[。！？!?]+[」』）)]*|[^。！？!?]+$/g) ?? [])
    .map((s) => s.trim())
    .filter((s) => s !== '')
}

/**
 * 把一段日语交给后端拆解。模型要想一会儿，前端这边等着就行 ——
 * 没配 key 的服务端会回 503，文案由后端给。
 */
export async function analyzeText(text: string): Promise<Analysis> {
  const res = await apiFetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })
  return handle<Analysis>(res)
}

// ---- 阅读 ----------------------------------------------------------------

export interface ArticleSummary {
  id: number
  title: string
  excerpt: string
  length: number
  sourceUrl: string | null
  /** 所在的集，null 是未归档 */
  folderId: number | null
  createdAt: string
}

export interface Article {
  id: number
  title: string
  body: string
  sourceUrl: string | null
  folderId: number | null
  createdAt: string
}

export interface FuriganaResult {
  /** 注好音的文本。后端查词典注音，词典里没有的词原样留着 */
  text: string
}

/** 列表的一页。page 从 0 数；totalPages、total 都是按当前搜索词算的。 */
export interface ArticleList {
  articles: ArticleSummary[]
  page: number
  totalPages: number
  total: number
}

/** 阅读页顶上那几个数，不受搜索和翻页影响。 */
export interface ArticleStats {
  count: number
  chars: number
  /** 最近一次保存，一篇都没有时是 null */
  latest: string | null
}

export interface ArticleLink {
  id: number
  title: string
}

/** 列表顺序（保存时间倒序）里的前后两篇：previous 更新，next 更旧。 */
export interface ArticleNeighbors {
  previous: ArticleLink | null
  next: ArticleLink | null
}

/**
 * folder 不传是全部，{@link UNFILED} 是没进任何集的，其余是那个集的 id。
 * 和后端 ArticleService.UNFILED 是同一个值。
 */
export const UNFILED = 0

export async function fetchArticles(
  page: number,
  query = '',
  size = 20,
  folder?: number,
): Promise<ArticleList> {
  const params = new URLSearchParams({ page: String(page), size: String(size) })
  if (query.trim() !== '') params.set('q', query.trim())
  if (folder !== undefined) params.set('folder', String(folder))
  const res = await apiFetch(`/api/articles?${params}`)
  return handle<ArticleList>(res)
}

export async function fetchArticleStats(folder?: number): Promise<ArticleStats> {
  const res = await apiFetch(
    folder === undefined ? '/api/articles/stats' : `/api/articles/stats?folder=${folder}`,
  )
  return handle<ArticleStats>(res)
}

export async function fetchArticleNeighbors(id: number): Promise<ArticleNeighbors> {
  const res = await apiFetch(`/api/articles/${id}/neighbors`)
  return handle<ArticleNeighbors>(res)
}

export async function fetchArticle(id: number): Promise<Article> {
  const res = await apiFetch(`/api/articles/${id}`)
  return handle<Article>(res)
}

export async function createArticle(
  title: string,
  body: string,
  sourceUrl?: string,
  folderId?: number,
): Promise<Article> {
  const res = await apiFetch('/api/articles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, body, sourceUrl, folderId }),
  })
  return handle<Article>(res)
}

export async function updateArticle(
  id: number,
  title: string,
  body: string,
  sourceUrl?: string,
): Promise<Article> {
  const res = await apiFetch(`/api/articles/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, body, sourceUrl }),
  })
  return handle<Article>(res)
}

export async function deleteArticle(id: number): Promise<void> {
  const res = await apiFetch(`/api/articles/${id}`, { method: 'DELETE' })
  if (!res.ok) {
    throw await toError(res, `删除失败：${res.status}`)
  }
}

/** 给一段日语加注音。后端查本地词典，只插注音，正文一个字不动。 */
export async function annotateFurigana(text: string): Promise<FuriganaResult> {
  const res = await apiFetch('/api/furigana', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })
  return handle<FuriganaResult>(res)
}

/** 注音时的一小块：annotate=false 的原样穿过去（空行、换行符）。 */
export interface Piece {
  text: string
  annotate: boolean
}

/**
 * 把正文切成送去注音的块，并且保住原来的行结构 —— 换行和空行都作为
 * 不注音的块留在原位，拼回来时一个字符都不差。
 *
 * 块切小一点有三个好处：后端一次只收 2000 字、并行起来更快、某一块
 * 失败时重来的代价也小。
 */
export function splitForFurigana(text: string, maxLength = 800): Piece[] {
  const pieces: Piece[] = []
  const lines = text.split('\n')

  lines.forEach((line, index) => {
    if (index > 0) pieces.push({ text: '\n', annotate: false })

    if (line.trim() === '') {
      pieces.push({ text: line, annotate: false })
      return
    }
    if (line.length <= maxLength) {
      pieces.push({ text: line, annotate: true })
      return
    }

    // 超长的一行按句子攒，攒到接近上限就断一块
    let current = ''
    for (const sentence of splitSentences(line)) {
      if (current !== '' && current.length + sentence.length > maxLength) {
        pieces.push({ text: current, annotate: true })
        current = ''
      }
      current += sentence
    }
    if (current !== '') pieces.push({ text: current, annotate: true })
  })

  return pieces
}

// ---- 应试 ----------------------------------------------------------------

/** 一次交卷。answers 的键是题号；correct / graded 是答对的题数 / 有答案的题数。 */
export interface ExamAttempt {
  id: number
  answers: Record<string, number>
  correct: number
  graded: number
  elapsedSeconds: number
  submittedAt: string
}

export interface ExamSummary {
  id: number
  title: string
  questionCount: number
  gradedCount: number
  createdAt: string
  folderId: number | null
  attemptCount: number
  /** 最近一次做完记下的成绩，没做完过是 null */
  lastAttempt: ExamAttempt | null
  /** 每档难度标了几题：1 简单、2 一般、3 难 → 题数，没标的档不在里面 */
  markCounts: Record<string, number>
}

export interface Exam {
  id: number
  title: string
  content: ExamContent
  questionCount: number
  gradedCount: number
  createdAt: string
  folderId: number | null
  /** 历次交卷，最近的在前 */
  attempts: ExamAttempt[]
  /** 自己标的难度：题号 → 1 简单、2 一般、3 难。没标的题不在里面 */
  marks: Record<string, MarkLevel>
  /** 已经生成过的解析：题号 → 解析 */
  explanations: Record<string, QuestionExplanation>
}

export type MarkLevel = 1 | 2 | 3

/** 一道题的解析：考点、为什么选正解、每个选项的意思和对错 */
export interface QuestionExplanation {
  point: string
  reason: string
  choices: { number: number; meaning: string; verdict: string }[]
}

/** 要一道题的解析。生成过的直接回来；没有的现调模型，要十几秒。 */
export async function explainQuestion(id: number, number: number): Promise<QuestionExplanation> {
  const res = await apiFetch(`/api/exams/${id}/questions/${number}/explanation`, {
    method: 'POST',
  })
  return handle<QuestionExplanation>(res)
}

export async function fetchExams(): Promise<ExamSummary[]> {
  return handle<ExamSummary[]>(await apiFetch('/api/exams'))
}

export async function fetchExam(id: number): Promise<Exam> {
  return handle<Exam>(await apiFetch(`/api/exams/${id}`))
}

export async function createExam(
  title: string,
  content: ExamContent,
  folderId?: number,
): Promise<Exam> {
  const res = await apiFetch('/api/exams', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, content, folderId }),
  })
  return handle<Exam>(res)
}

export async function deleteExam(id: number): Promise<void> {
  const res = await apiFetch(`/api/exams/${id}`, { method: 'DELETE' })
  if (!res.ok) {
    throw await toError(res, `删除失败：${res.status}`)
  }
}

/** 做完一遍记一次成绩。判分在后端，按卷子里存的答案算。 */
export async function submitExam(
  id: number,
  answers: Record<number, number>,
  elapsedSeconds: number,
): Promise<ExamAttempt> {
  const res = await apiFetch(`/api/exams/${id}/attempts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ answers, elapsedSeconds }),
  })
  return handle<ExamAttempt>(res)
}

/** 给一道题标难度；level 为 null 是去掉标记。 */
export async function markQuestion(
  id: number,
  number: number,
  level: MarkLevel | null,
): Promise<void> {
  const res = await apiFetch(
    `/api/exams/${id}/marks/${number}`,
    level === null
      ? { method: 'DELETE' }
      : {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ level }),
        },
  )
  if (!res.ok) {
    throw await toError(res, `保存失败：${res.status}`)
  }
}

// ---- 登录 ----------------------------------------------------------------

export interface User {
  id: number
  username: string
  /** 大家共用的体验账号：只能看不能改，复习的评分也不往后端存 */
  demo: boolean
}

/** 这台服务器上配好了哪些可选功能。没配的按钮前端就不显示。 */
export interface AuthFeatures {
  email: boolean
  github: boolean
  /** 开了体验账号，展示页上才显示「用演示账号看看」 */
  demo: boolean
}

export interface Account {
  username: string
  email: string | null
  /** false = GitHub 建的号，还没设过密码。 */
  hasPassword: boolean
  githubLogin: string | null
}

export interface LoginSession {
  /** 不是真的 session id，只是它的哈希，用来点名"退出这台"。 */
  id: string
  createdAt: string
  lastAccessedAt: string
  userAgent: string | null
  ip: string | null
  current: boolean
}

/** GitHub 登录/绑定都是整页跳转，不是 fetch。 */
export const GITHUB_LOGIN_URL = '/api/oauth2/authorization/github'
export const GITHUB_LINK_URL = '/api/account/github/link'

/** 问后端"我是谁"。没登录不是错误，是起始状态，所以回 null 而不是抛。 */
export async function fetchMe(): Promise<User | null> {
  const res = await apiFetch('/api/auth/me')
  if (res.status === 401) {
    return null
  }
  return handle<User>(res)
}

export async function fetchAuthFeatures(): Promise<AuthFeatures> {
  const res = await apiFetch('/api/auth/features')
  return handle<AuthFeatures>(res)
}

export async function login(username: string, password: string): Promise<User> {
  const res = await apiFetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  return handle<User>(res, true)
}

export async function register(username: string, password: string): Promise<User> {
  const res = await apiFetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  return handle<User>(res, true)
}

/** 不要密码，登进共用的体验账号。 */
export async function enterDemo(): Promise<User> {
  const res = await apiFetch('/api/auth/demo', { method: 'POST' })
  return handle<User>(res, true)
}

export async function logout(): Promise<void> {
  const res = await apiFetch('/api/auth/logout', { method: 'POST' })
  if (!res.ok) {
    throw await toError(res, `登出失败：${res.status}`, true)
  }
}

/** 成功只看状态码、不读响应体的那些接口（202 / 204）。 */
async function expectOk(res: Response, fallback: string, silent401 = false): Promise<void> {
  if (!res.ok) {
    throw await toError(res, fallback, silent401)
  }
}

function postJson(url: string, body: unknown): Promise<Response> {
  return apiFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export async function requestPasswordReset(email: string): Promise<void> {
  await expectOk(await postJson('/api/auth/password-reset/request', { email }), '发送失败', true)
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  await expectOk(
    await postJson('/api/auth/password-reset/confirm', { token, newPassword }),
    '重置失败',
    true,
  )
}

export async function verifyEmail(token: string): Promise<void> {
  await expectOk(await postJson('/api/auth/email/verify', { token }), '验证失败', true)
}

// ---- 账号 ----------------------------------------------------------------

export async function fetchAccount(): Promise<Account> {
  return handle<Account>(await apiFetch('/api/account'))
}

/** 没有密码的账号 currentPassword 传 null。 */
export async function changePassword(
  currentPassword: string | null,
  newPassword: string,
): Promise<void> {
  await expectOk(
    await postJson('/api/account/password', { currentPassword, newPassword }),
    '修改失败',
  )
}

/** 只是发验证邮件，点了邮件里的链接才算绑上。 */
export async function requestEmailChange(
  email: string,
  currentPassword: string | null,
): Promise<void> {
  await expectOk(await postJson('/api/account/email', { email, currentPassword }), '发送失败')
}

export async function removeEmail(): Promise<void> {
  await expectOk(await apiFetch('/api/account/email', { method: 'DELETE' }), '解绑失败')
}

export async function unlinkGithub(): Promise<void> {
  await expectOk(await apiFetch('/api/account/github', { method: 'DELETE' }), '解绑失败')
}

export async function fetchSessions(): Promise<LoginSession[]> {
  return handle<LoginSession[]>(await apiFetch('/api/account/sessions'))
}

export async function revokeSession(id: string): Promise<void> {
  await expectOk(
    await apiFetch(`/api/account/sessions/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    '操作失败',
  )
}

export async function revokeOtherSessions(): Promise<void> {
  await expectOk(await postJson('/api/account/sessions/revoke-others', {}), '操作失败')
}

// ---- self：随笔 ------------------------------------------------------------

export interface Essay {
  id: number
  body: string
  writtenAt: string
  editedAt: string | null
}

export interface EssayList {
  essays: Essay[]
  hasMore: boolean
  total: number
  /** 看的人是不是 self 的主人，是才露出「写」的入口 */
  canWrite: boolean
}

/** 不用登录也能读。before 是上一页最老那条的 id，不传就从最新的开始。 */
export async function fetchEssays(before?: number): Promise<EssayList> {
  const res = await apiFetch(before ? `/api/self/essays?before=${before}` : '/api/self/essays')
  // 没登录的访客撞到 401 也别把人送去登录页 —— 这一页本来就不用登录
  return handle<EssayList>(res, true)
}

/** 单独一篇，同样不用登录。分享出去的链接打开时，那篇可能不在第一页里。 */
export async function fetchEssay(id: number): Promise<Essay> {
  return handle<Essay>(await apiFetch(`/api/self/essays/${id}`), true)
}

export async function writeEssay(body: string): Promise<Essay> {
  return handle<Essay>(await postJson('/api/self/essays', { body }))
}

export async function reviseEssay(id: number, body: string): Promise<Essay> {
  const res = await apiFetch(`/api/self/essays/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ body }),
  })
  return handle<Essay>(res)
}

export async function deleteEssay(id: number): Promise<void> {
  await expectOk(await apiFetch(`/api/self/essays/${id}`, { method: 'DELETE' }), '删除失败')
}

/** 把粘贴的文本解析成卡片数组。支持 Tab 或逗号分隔，一行一张。 */
export function parseImportText(text: string): { front: string; back: string }[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '')
    .map((line) => {
      const sep = line.includes('\t') ? '\t' : ','
      const [front, ...rest] = line.split(sep)
      return { front: front.trim(), back: rest.join(sep).trim() }
    })
    .filter((card) => card.front !== '')
}
// ---- 资料：随笔和资料包 ----------------------------------------------------

/** 资料包封面的颜色，样式在 index.css 的 .tint-* 里 */
export type PackTint = 'sakura' | 'take' | 'ai' | 'kin'

/** DRAFT 只有主人看得见；SOON 在书架上但还不能买 */
export type PackStatus = 'DRAFT' | 'SOON' | 'ON_SALE'

export interface LibraryEssayCard {
  slug: string
  title: string
  excerpt: string
  chars: number
  minutes: number
  /** 草稿（只有主人看得到）是 null */
  publishedAt: string | null
}

export interface PackCard {
  slug: string
  title: string
  level: string
  /** 封面上那个大字 */
  glyph: string
  tint: PackTint
  summary: string
  status: PackStatus
  /** 分；还在写的包可能没有 */
  priceCents: number | null
  note: string | null
  cardCount: number
  articleCount: number
  essayCount: number
  /** 封面右上角露出来的那几张卡 */
  fan: string[]
  owned: boolean
  /** 只有一篇随笔的包（没卡片、没文章）：那篇随笔的 slug，点开包直接进随笔 */
  entry: string | null
}

export interface Shelf {
  essays: LibraryEssayCard[]
  packs: PackCard[]
}

export interface PackRef {
  slug: string
  title: string
  tint: PackTint
  /** 见 PackCard.entry */
  entry: string | null
}

export interface PackDetail {
  card: PackCard
  intro: string
  deckName: string
  /** 用户自己那边的这个卡包，导入之后才有；复习页 ?deck= 用它 */
  deckId: number | null
  cards: { front: string; reading: string | null; back: string | null }[]
  /** articleId：解锁导入之后，阅读列表里对应的那篇 */
  articles: { index: number; title: string; chars: number; peek: string; articleId: number | null }[]
  essays: { slug: string; title: string; peek: string; minutes: number }[]
  /** 现在能用支付宝买：在卖、没解锁、后端配了支付宝 */
  payable: boolean
  grantedAt: string | null
  /** 解锁了但还没导入时是 null（付完钱就关了页面） */
  importedAt: string | null
}

export interface PackTrial {
  title: string
  body: string
  pack: PackRef
}

export interface LibraryEssay {
  slug: string
  title: string
  body: string
  publishedAt: string | null
  chars: number
  minutes: number
  /** 挂在哪个包上；谁都能读的是 null */
  pack: PackRef | null
  next: { slug: string; title: string } | null
}

export interface PackImport {
  deckId: number | null
  deckName: string
  cardsImported: number
  cardsSkipped: number
  articlesImported: number
  articlesSkipped: number
}

/** qrUrl：电脑上放进 iframe 的二维码；payUrl：整页跳去支付宝 */
export interface Checkout {
  orderNo: string
  qrUrl: string | null
  payUrl: string
}

export interface OrderState {
  status: 'CREATED' | 'PAID'
  pack: string | null
}

/** 分 → ¥0.99；0 是免费包 */
export function formatPrice(cents: number): string {
  if (cents === 0) return '免费'
  return `¥${(cents / 100).toFixed(2)}`
}

export async function fetchShelf(): Promise<Shelf> {
  return handle<Shelf>(await apiFetch('/api/library'))
}

export async function fetchPack(slug: string): Promise<PackDetail> {
  return handle<PackDetail>(await apiFetch(`/api/library/packs/${encodeURIComponent(slug)}`))
}

export async function fetchPackTrial(slug: string): Promise<PackTrial> {
  return handle<PackTrial>(await apiFetch(`/api/library/packs/${encodeURIComponent(slug)}/trial`))
}

/** 没登录也能调：谁都能读的随笔照样给，包里的回 403 和一句为什么 */
export async function fetchLibraryEssay(slug: string): Promise<LibraryEssay> {
  return handle<LibraryEssay>(await apiFetch(`/api/library/essays/${encodeURIComponent(slug)}`), true)
}

export async function importPack(slug: string): Promise<PackImport> {
  return handle<PackImport>(await postJson(`/api/library/packs/${encodeURIComponent(slug)}/import`, {}))
}

export async function redeemCode(code: string): Promise<{ slug: string; title: string }> {
  return handle(await postJson('/api/library/redeem', { code }))
}

export async function checkoutPack(slug: string, mobile: boolean): Promise<Checkout> {
  return handle<Checkout>(await postJson(`/api/library/packs/${encodeURIComponent(slug)}/orders`, { mobile }))
}

export async function fetchOrder(orderNo: string): Promise<OrderState> {
  return handle<OrderState>(await apiFetch(`/api/library/orders/${encodeURIComponent(orderNo)}`))
}

// ---- 集 ------------------------------------------------------------------

/** 阅读里的集装文章，应试里的集装真题，各管各的。 */
export type FolderKind = 'ARTICLE' | 'EXAM'

export interface Folder {
  id: number
  name: string
  /** 里面有几个 */
  count: number
  createdAt: string
}

/** 一类东西的全部集，连同每个集里有几个；没进任何集的单数一个 unfiled。 */
export interface FolderListing {
  folders: Folder[]
  unfiled: number
  total: number
}

export async function fetchFolders(kind: FolderKind): Promise<FolderListing> {
  return handle<FolderListing>(await apiFetch(`/api/folders?kind=${kind}`))
}

export async function createFolder(kind: FolderKind, name: string): Promise<Folder> {
  const res = await apiFetch('/api/folders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind, name }),
  })
  return handle<Folder>(res)
}

export async function renameFolder(id: number, name: string): Promise<Folder> {
  const res = await apiFetch(`/api/folders/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  })
  return handle<Folder>(res)
}

/** 删集不删里面的东西，它们退回未归档。 */
export async function deleteFolder(id: number): Promise<void> {
  const res = await apiFetch(`/api/folders/${id}`, { method: 'DELETE' })
  if (!res.ok) {
    throw await toError(res, `删除失败：${res.status}`)
  }
}
