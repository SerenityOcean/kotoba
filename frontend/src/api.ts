export interface Card {
  id: number
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
  imported: number
  skipped: number
  skippedFronts: string[]
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

export async function fetchCards(): Promise<Card[]> {
  const res = await fetch('/api/cards')
  return handle<Card[]>(res)
}

export async function fetchDueCards(): Promise<Card[]> {
  const res = await fetch('/api/cards/due')
  return handle<Card[]>(res)
}

export async function createCard(front: string, back: string): Promise<Card> {
  const res = await fetch('/api/cards', {
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

export async function importCards(
  cards: { front: string; back: string }[],
): Promise<ImportResult> {
  const res = await fetch('/api/cards/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cards }),
  })
  return handle<ImportResult>(res)
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