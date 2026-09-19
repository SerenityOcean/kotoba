/**
 * .apkg（Anki 导出包）解析。全部在浏览器里做：
 * 包里 6MB 的音频不用过网络，服务器也不用扛解压和 SQLite。
 *
 * 包的结构：一个 zip，里面有 collection.anki2（SQLite）、media（媒体名映射）
 * 和一堆以数字命名的媒体文件。卡片内容在 SQLite 的 notes 表里。
 */

import sqlWasmUrl from 'sql.js/dist/sql-wasm.wasm?url'

/** Anki 把一条笔记的各个字段用这个字符拼成一个字符串存。 */
const FIELD_SEPARATOR = '\x1f'

export interface AnkiNoteType {
  name: string
  /** 字段名，顺序和 notes 里的字段顺序一致 */
  fields: string[]
  /** 每条笔记的字段原文（未清洗，含 HTML） */
  notes: string[][]
}

export interface FieldMapping {
  frontIndex: number
  /** 背面由多个字段按顺序拼接 */
  backIndexes: number[]
  /** 汉字注音：true → 諦(あきら)める，false → 諦める */
  keepRuby: boolean
  separator: string
}

/** 解析一个 .apkg 文件，按笔记类型分组返回。 */
export async function parseApkg(file: File): Promise<AnkiNoteType[]> {
  // 两个库都只在这里用到，动态引入，不进主包
  const [{ default: JSZip }, { default: initSqlJs }] = await Promise.all([
    import('jszip'),
    import('sql.js'),
  ])

  const zip = await JSZip.loadAsync(file)
  const entry =
    zip.file('collection.anki2') ?? zip.file('collection.anki21') ?? null

  if (!entry) {
    // 2.1.50 之后导出的包用 zstd 压缩（collection.anki21b），浏览器里解不了
    if (zip.file('collection.anki21b')) {
      throw new Error(
        '这是新版压缩格式。请在 Anki 导出时勾选「支持旧版 Anki」后重新导出。',
      )
    }
    throw new Error('包里没找到 collection.anki2，可能不是 Anki 导出文件。')
  }

  const SQL = await initSqlJs({ locateFile: () => sqlWasmUrl })
  const db = new SQL.Database(await entry.async('uint8array'))

  try {
    const noteTypes = readNoteTypes(db)
    const grouped = new Map<string, string[][]>()

    for (const result of db.exec('select mid, flds from notes')) {
      for (const [mid, flds] of result.values) {
        const key = String(mid)
        const row = (grouped.get(key) ?? [])
        row.push(String(flds).split(FIELD_SEPARATOR))
        grouped.set(key, row)
      }
    }

    return [...grouped.entries()]
      .map(([mid, notes]) => {
        const type = noteTypes.get(mid)
        return {
          name: type?.name ?? `笔记类型 ${mid}`,
          // 兜底：拿不到字段名就按第一条笔记的字段数编号
          fields: type?.fields ?? notes[0].map((_, i) => `字段 ${i + 1}`),
          notes,
        }
      })
      .sort((a, b) => b.notes.length - a.notes.length)
  } finally {
    db.close()
  }
}

type SqlDatabase = { exec: (sql: string) => { values: unknown[][] }[] }

/**
 * 读笔记类型和字段名。老包存在 col.models 这个 JSON 里，
 * 新 schema（Anki 2.1.28+）拆成了 notetypes / fields 两张表。
 */
function readNoteTypes(db: SqlDatabase): Map<string, { name: string; fields: string[] }> {
  const types = new Map<string, { name: string; fields: string[] }>()

  try {
    const raw = db.exec('select models from col')[0]?.values[0]?.[0]
    if (typeof raw === 'string' && raw.length > 2) {
      const models = JSON.parse(raw) as Record<
        string,
        { name: string; flds: { name: string; ord: number }[] }
      >
      for (const [mid, model] of Object.entries(models)) {
        types.set(mid, {
          name: model.name,
          fields: [...model.flds].sort((a, b) => a.ord - b.ord).map((f) => f.name),
        })
      }
      if (types.size > 0) return types
    }
  } catch {
    // 老格式读不出来就试新格式
  }

  try {
    const byId = new Map<string, string[]>()
    for (const result of db.exec('select ntid, ord, name from fields order by ntid, ord')) {
      for (const [ntid, , name] of result.values) {
        const key = String(ntid)
        byId.set(key, [...(byId.get(key) ?? []), String(name)])
      }
    }
    for (const result of db.exec('select id, name from notetypes')) {
      for (const [id, name] of result.values) {
        const key = String(id)
        types.set(key, { name: String(name), fields: byId.get(key) ?? [] })
      }
    }
  } catch {
    // 两种都读不出来，调用方会用字段编号兜底
  }

  return types
}

/**
 * 把一个字段的 HTML 洗成纯文本：
 * 去掉音频/图片引用，ruby 注音按需保留，其余标签和实体交给浏览器解析。
 */
export function cleanField(raw: string, keepRuby: boolean): string {
  let s = raw
    .replace(/\[sound:[^\]]*\]/g, ' ')
    .replace(/<img[^>]*>/gi, ' ')
    .replace(/<rp>[\s\S]*?<\/rp>/gi, '')

  s = s.replace(/<ruby>([\s\S]*?)<\/ruby>/gi, (_, inner: string) => {
    const reading = [...inner.matchAll(/<rt>([\s\S]*?)<\/rt>/gi)]
      .map((m) => m[1])
      .join('')
    const base = inner.replace(/<rt>[\s\S]*?<\/rt>/gi, '').replace(/<\/?rb>/gi, '')
    return keepRuby && reading ? `${base}(${reading})` : base
  })

  s = s.replace(/<br\s*\/?>/gi, ' ').replace(/<\/(div|p|li|tr)>/gi, ' ')

  // 剩下的标签和 &nbsp; 之类的实体，用 DOMParser 解一遍最稳（不会执行任何脚本）
  const text = new DOMParser().parseFromString(s, 'text/html').body.textContent ?? ''
  return text.replace(/\s+/g, ' ').trim()
}

/** 按映射把笔记转成卡片。正面为空的直接丢掉。 */
export function buildCards(
  noteType: AnkiNoteType,
  mapping: FieldMapping,
): { front: string; back: string }[] {
  const cards: { front: string; back: string }[] = []

  for (const note of noteType.notes) {
    const front = cleanField(note[mapping.frontIndex] ?? '', mapping.keepRuby)
    if (front === '') continue

    const back = mapping.backIndexes
      .map((i) => cleanField(note[i] ?? '', mapping.keepRuby))
      .filter((v) => v !== '')
      .join(mapping.separator)

    cards.push({ front, back })
  }

  return cards
}

/** 常见的「答案类」字段名，用来猜一个默认映射，省得每次都从头勾。 */
const BACK_FIELD_NAMES = new Set([
  '意味', '意思', '中文', '翻译', '訳', '意义', 'meaning', 'back', '答え', '解释',
  '読み方', '読み', 'reading', '读音', '品詞', '词性',
])

/** 猜一个初始映射：第一个字段当正面，答案类字段拼成背面。 */
export function guessMapping(noteType: AnkiNoteType): FieldMapping {
  const backIndexes = noteType.fields
    .map((name, i) => ({ name: name.trim().toLowerCase(), i }))
    .filter(({ name }) => BACK_FIELD_NAMES.has(name))
    .map(({ i }) => i)

  return {
    frontIndex: 0,
    backIndexes: backIndexes.length > 0 ? backIndexes : [1],
    keepRuby: true,
    separator: ' · ',
  }
}
