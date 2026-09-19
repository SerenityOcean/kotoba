import { useMemo, useState } from 'react'
import { buildCards, guessMapping, parseApkg } from '../anki'
import type { AnkiNoteType, FieldMapping } from '../anki'
import { importCards } from '../api'
import Furigana from './Furigana'
import type { ImportResult } from '../api'

export default function AnkiImport({
  onImported,
}: {
  onImported: (result: ImportResult) => void
}) {
  const [fileName, setFileName] = useState<string | null>(null)
  // 卡片导进哪个包：默认就叫这个 .apkg 的名字，可以改
  const [deckName, setDeckName] = useState('')
  const [parsing, setParsing] = useState(false)
  const [noteTypes, setNoteTypes] = useState<AnkiNoteType[] | null>(null)
  const [typeIndex, setTypeIndex] = useState(0)
  const [mapping, setMapping] = useState<FieldMapping | null>(null)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const noteType = noteTypes?.[typeIndex] ?? null

  // 笔记可能上千条，映射一变就全量重算，缓存一下
  const cards = useMemo(
    () => (noteType && mapping ? buildCards(noteType, mapping) : []),
    [noteType, mapping],
  )

  async function handleFile(file: File) {
    setParsing(true)
    setError(null)
    setResult(null)
    setNoteTypes(null)
    setFileName(file.name)
    try {
      const types = await parseApkg(file)
      if (types.length === 0) {
        throw new Error('包里没有笔记')
      }
      setNoteTypes(types)
      setTypeIndex(0)
      setMapping(guessMapping(types[0]))
      setDeckName(file.name.replace(/\.(apkg|colpkg)$/i, ''))
    } catch (e) {
      setError(e instanceof Error ? e.message : '解析失败')
      setFileName(null)
    } finally {
      setParsing(false)
    }
  }

  function selectType(index: number) {
    if (!noteTypes) return
    setTypeIndex(index)
    setMapping(guessMapping(noteTypes[index]))
    setResult(null)
  }

  function toggleBack(index: number) {
    if (!mapping) return
    const has = mapping.backIndexes.includes(index)
    setMapping({
      ...mapping,
      // 保持字段原顺序，勾选顺序不影响拼接结果
      backIndexes: has
        ? mapping.backIndexes.filter((i) => i !== index)
        : [...mapping.backIndexes, index].sort((a, b) => a - b),
    })
  }

  async function handleImport() {
    if (cards.length === 0) return
    setImporting(true)
    setError(null)
    try {
      const imported = await importCards(cards, deckName.trim() || undefined)
      setResult(imported)
      onImported(imported)
    } catch (e) {
      setError(e instanceof Error ? e.message : '导入失败')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="mt-4">
      <label className="inline-block cursor-pointer rounded-sm border border-usu px-4 py-2 text-sm text-hai transition hover:border-sumi hover:text-sumi">
        {parsing ? '解析中…' : fileName ? `已选：${fileName}` : '选择 .apkg 文件'}
        <input
          type="file"
          accept=".apkg,.colpkg"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleFile(file)
            e.target.value = '' // 允许重复选同一个文件
          }}
        />
      </label>

      {error && <p className="mt-3 text-sm text-shu">{error}</p>}

      {noteType && mapping && (
        <div className="mt-5 space-y-5">
          {noteTypes && noteTypes.length > 1 && (
            <Row label="笔记类型">
              <div className="flex flex-wrap gap-2">
                {noteTypes.map((t, i) => (
                  <Chip key={t.name} active={i === typeIndex} onClick={() => selectType(i)}>
                    {t.name}（{t.notes.length}）
                  </Chip>
                ))}
              </div>
            </Row>
          )}

          <Row label={`正面 · 共 ${noteType.notes.length} 条笔记`}>
            <div className="flex flex-wrap gap-2">
              {noteType.fields.map((name, i) => (
                <Chip
                  key={name + i}
                  active={i === mapping.frontIndex}
                  onClick={() => setMapping({ ...mapping, frontIndex: i })}
                >
                  {name}
                </Chip>
              ))}
            </div>
          </Row>

          <Row label="背面（可多选，按字段顺序拼接）">
            <div className="flex flex-wrap gap-2">
              {noteType.fields.map((name, i) => (
                <Chip
                  key={name + i}
                  active={mapping.backIndexes.includes(i)}
                  onClick={() => toggleBack(i)}
                >
                  {name}
                </Chip>
              ))}
            </div>
          </Row>

          <Row label="选项">
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={mapping.keepRuby}
                  onChange={(e) => setMapping({ ...mapping, keepRuby: e.target.checked })}
                  className="accent-ai"
                />
                <span className="text-hai">保留注音</span>
                <span className="font-mincho">
                  {mapping.keepRuby ? <Furigana text="諦[あきら]める" /> : '諦める'}
                </span>
              </label>

              <span className="flex items-center gap-2">
                <span className="text-hai">分隔</span>
                <Chip
                  active={mapping.separator === ' · '}
                  onClick={() => setMapping({ ...mapping, separator: ' · ' })}
                >
                  ·
                </Chip>
                <Chip
                  active={mapping.separator === '\n'}
                  onClick={() => setMapping({ ...mapping, separator: '\n' })}
                >
                  换行
                </Chip>
              </span>
            </div>
          </Row>

          <Row label="导入到哪个包">
            <input
              value={deckName}
              onChange={(e) => setDeckName(e.target.value)}
              placeholder="包名"
              className="w-full max-w-sm border-b border-usu bg-transparent pb-1 text-base focus:border-ai focus:outline-none"
            />
            <p className="mt-1 text-xs text-hai">
              默认用文件名，之后在卡片页还能改
            </p>
          </Row>

          <Row label="预览">
            {cards.length === 0 ? (
              <p className="text-sm text-hai">按当前映射没有可导入的卡片</p>
            ) : (
              <ul className="space-y-2">
                {cards.slice(0, 3).map((card, i) => (
                  <li key={i} className="border-l-2 border-usu pl-3">
                    <div className="font-mincho text-lg">
                      <Furigana text={card.front} />
                    </div>
                    <div className="ruby-block whitespace-pre-line text-sm text-hai">
                      {card.back ? <Furigana text={card.back} /> : '（背面为空）'}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Row>

          <div className="flex flex-wrap items-center gap-4">
            <button
              onClick={handleImport}
              disabled={cards.length === 0 || importing || deckName.trim() === ''}
              className="rounded-sm bg-ai px-5 py-2.5 text-sm text-washi transition hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-30"
            >
              {importing ? '导入中…' : `导入 ${cards.length} 张`}
            </button>
            <span className="text-xs text-hai">
              已存在的词会自动跳过，音频和图片不会导入
            </span>
          </div>
        </div>
      )}

      {result && (
        <p className="mt-4 text-sm">
          导入 <span className="text-ai">{result.imported}</span> 张到「{result.deckName}」
          {result.skipped > 0 && (
            <span className="text-hai">
              ，跳过 {result.skipped} 张（已存在）：
              {result.skippedFronts.slice(0, 5).join('、')}
              {result.skippedFronts.length > 5 && ' …'}
            </span>
          )}
        </p>
      )}
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-xs tracking-wider text-hai">{label}</div>
      {children}
    </div>
  )
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? 'rounded-sm border border-ai bg-ai px-2.5 py-1 text-xs text-washi'
          : 'rounded-sm border border-usu px-2.5 py-1 text-xs text-hai transition hover:border-sumi hover:text-sumi'
      }
    >
      {children}
    </button>
  )
}
