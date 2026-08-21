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

export interface ImportResult {
  imported: number
  skipped: number
  skippedFronts: string[]
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