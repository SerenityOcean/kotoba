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