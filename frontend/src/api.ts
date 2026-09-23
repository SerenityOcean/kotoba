export interface Card {
  id: number
  deckId: number
  front: string
  back: string | null
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
  dueToday: number
  reviewedToday: number
}

export interface ImportResult {
  deckId: number
  deckName: string
  imported: number
  skipped: number
  skippedFronts: string[]
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
  const res = await fetch(deckId ? `/api/cards?deckId=${deckId}` : '/api/cards')
  return handle<Card[]>(res)
}

export async function fetchDueCards(deckId?: number): Promise<Card[]> {
  const res = await fetch(deckId ? `/api/cards/due?deckId=${deckId}` : '/api/cards/due')
  return handle<Card[]>(res)
}

export async function createCard(front: string, back: string, deckId?: number): Promise<Card> {
  const res = await fetch(deckId ? `/api/cards?deckId=${deckId}` : '/api/cards', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ front, back }),
  })
  return handle<Card>(res)
}

export async function updateCard(id: number, front: string, back: string): Promise<Card> {
  const res = await fetch(`/api/cards/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ front, back }),
  })
  return handle<Card>(res)
}

export async function deleteCard(id: number): Promise<void> {
  const res = await fetch(`/api/cards/${id}`, { method: 'DELETE' })
  if (!res.ok) {
    throw await toError(res, `删除失败：${res.status}`)
  }
}

export async function reviewCard(id: number, rating: Rating): Promise<Card> {
  const res = await fetch(`/api/cards/${id}/review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rating }),
  })
  return handle<Card>(res)
}

export async function fetchStats(): Promise<Stats> {
  const res = await fetch('/api/stats')
  return handle<Stats>(res)
}

/** deckName 留空进默认包；包不存在会按这个名字新建。 */
export async function importCards(
  cards: { front: string; back: string }[],
  deckName?: string,
): Promise<ImportResult> {
  const res = await fetch('/api/cards/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cards, deckName }),
  })
  return handle<ImportResult>(res)
}

// ---- 包 ------------------------------------------------------------------

export async function fetchDecks(): Promise<Deck[]> {
  const res = await fetch('/api/decks')
  return handle<Deck[]>(res)
}

export async function createDeck(name: string): Promise<Deck> {
  const res = await fetch('/api/decks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  })
  return handle<Deck>(res)
}

export async function renameDeck(id: number, name: string): Promise<Deck> {
  const res = await fetch(`/api/decks/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  })
  return handle<Deck>(res)
}

/** 删包会连里面的卡片一起删。 */
export async function deleteDeck(id: number): Promise<void> {
  const res = await fetch(`/api/decks/${id}`, { method: 'DELETE' })
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
  const res = await fetch('/api/goal')
  if (res.status === 204) return null
  return handle<Goal>(res)
}

export async function saveGoal(title: string, targetDate: string): Promise<Goal> {
  const res = await fetch('/api/goal', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, targetDate }),
  })
  return handle<Goal>(res)
}

export async function clearGoal(): Promise<void> {
  const res = await fetch('/api/goal', { method: 'DELETE' })
  if (!res.ok) {
    throw await toError(res, `清除失败：${res.status}`)
  }
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
  const res = await fetch('/api/analyze', {
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
  createdAt: string
}

export interface Article {
  id: number
  title: string
  body: string
  sourceUrl: string | null
  createdAt: string
}

export interface FuriganaResult {
  text: string
  /** false = 模型把正文改了，后端退回了原文。这段是没注音的。 */
  annotated: boolean
}

export async function fetchArticles(): Promise<ArticleSummary[]> {
  const res = await fetch('/api/articles')
  return handle<ArticleSummary[]>(res)
}

export async function fetchArticle(id: number): Promise<Article> {
  const res = await fetch(`/api/articles/${id}`)
  return handle<Article>(res)
}

export async function createArticle(
  title: string,
  body: string,
  sourceUrl?: string,
): Promise<Article> {
  const res = await fetch('/api/articles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, body, sourceUrl }),
  })
  return handle<Article>(res)
}

export async function deleteArticle(id: number): Promise<void> {
  const res = await fetch(`/api/articles/${id}`, { method: 'DELETE' })
  if (!res.ok) {
    throw await toError(res, `删除失败：${res.status}`)
  }
}

/** 给一段日语加注音。后端会校验模型没改正文，改了就退回原文。 */
export async function annotateFurigana(text: string): Promise<FuriganaResult> {
  const res = await fetch('/api/furigana', {
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

// ---- 登录 ----------------------------------------------------------------

export interface User {
  id: number
  username: string
}

/** 问后端"我是谁"。没登录不是错误，是起始状态，所以回 null 而不是抛。 */
export async function fetchMe(): Promise<User | null> {
  const res = await fetch('/api/auth/me')
  if (res.status === 401) {
    return null
  }
  return handle<User>(res)
}

export async function login(username: string, password: string): Promise<User> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  return handle<User>(res, true)
}

export async function register(username: string, password: string): Promise<User> {
  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  return handle<User>(res, true)
}

export async function logout(): Promise<void> {
  const res = await fetch('/api/auth/logout', { method: 'POST' })
  if (!res.ok) {
    throw await toError(res, `登出失败：${res.status}`, true)
  }
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