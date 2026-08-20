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

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    throw new Error(`请求失败：${res.status}`)
  }
  return res.json() as Promise<T>
}

export async function fetchCards(): Promise<Card[]> {
  const res = await fetch('/api/cards')
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

export async function deleteCard(id: number): Promise<void> {
  const res = await fetch(`/api/cards/${id}`, { method: 'DELETE' })
  if (!res.ok) {
    throw new Error(`删除失败：${res.status}`)
  }
}

export type Rating = 'AGAIN' | 'HARD' | 'GOOD'

export interface Stats {
  totalCards: number
  dueToday: number
  reviewedToday: number
}

export async function fetchDueCards(): Promise<Card[]> {
  const res = await fetch('/api/cards/due')
  return handle<Card[]>(res)
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