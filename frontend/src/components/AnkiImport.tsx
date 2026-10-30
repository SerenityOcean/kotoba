import { useMemo, useState } from 'react'
import { buildCards, guessMapping, parseApkg, soundFields } from '../anki'
import type { AnkiCard, AnkiPackage, FieldMapping } from '../anki'
import { importCards, uploadCardAudio } from '../api'
import Furigana from './Furigana'
import type { AudioKind, ImportResult } from '../api'

export default function AnkiImport({
  onImported,
}: {
  onImported: (result: ImportResult) => void
}) {
  const [fileName, setFileName] = useState<string | null>(null)
  // 卡片导进哪个包：默认就叫这个 .apkg 的名字，可以改
  const [deckName, setDeckName] = useState('')
  const [parsing, setParsing] = useState(false)
  const [pkg, setPkg] = useState<AnkiPackage | null>(null)
  const [typeIndex, setTypeIndex] = useState(0)
  const [mapping, setMapping] = useState<FieldMapping | null>(null)
  const [importing, setImporting] = useState(false)
  // 传录音的进度，null = 没在传
  const [audioProgress, setAudioProgress] = useState<{ done: number; total: number } | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)
  // 录音传完的结果；传到一半失败时 error 里是原因
  const [audioResult, setAudioResult] = useState<{ stored: number; skipped: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const noteTypes = pkg?.noteTypes ?? null
  const noteType = noteTypes?.[typeIndex] ?? null
  const sounds = useMemo(() => (noteType ? soundFields(noteType) : []), [noteType])

  // 笔记可能上千条，映射一变就全量重算，缓存一下
  const cards = useMemo(
    () => (noteType && mapping ? buildCards(noteType, mapping) : []),
    [noteType, mapping],
  )

  async function handleFile(file: File) {
    setParsing(true)
    setError(null)
    setResult(null)
    setAudioResult(null)
    setPkg(null)
    setFileName(file.name)
    try {
      const parsed = await parseApkg(file)
      const types = parsed.noteTypes
      if (types.length === 0) {
        throw new Error('包里没有笔记')
      }
      setPkg(parsed)
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
    setAudioResult(null)
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
    if (cards.length === 0 || !pkg) return
    setImporting(true)
    setError(null)
    setAudioResult(null)
    try {
      const imported = await importCards(
        cards.map(({ front, back }) => ({ front, back })),
        deckName.trim() || undefined,
      )
      setResult(imported)

      // 卡片先建好，再按 id 把录音传上去。已有的卡也在 cardIds 里，重新导入能补上录音
      const audio = audioItems(cards, imported.cardIds, pkg)
      if (audio.length > 0) {
        setAudioProgress({ done: 0, total: audio.length })
        try {
          setAudioResult(
            await uploadCardAudio(audio, (done, total) => setAudioProgress({ done, total })),
          )
        } catch (e) {
          // 卡片已经存下了。这块别关，让人看到录音没传完
          const reason = e instanceof Error ? e.message : '上传失败'
          setError(`卡片导好了，录音没传完：${reason}。再导一次同一个牌组会补上`)
          return
        }
      }
      // 录音也传完了才交出去：卡片页一收到就把这块关掉，传到一半关掉就看不到进度了
      onImported(imported)
    } catch (e) {
      setError(e instanceof Error ? e.message : '导入失败')
    } finally {
      setImporting(false)
      setAudioProgress(null)
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

          {sounds.length > 0 && (
            <Row label="牌组自带的录音">
              <div className="space-y-2">
                {(
                  [
                    ['word', '单词', 'wordAudioIndex'],
                    ['sentence', '例句', 'sentenceAudioIndex'],
                  ] as const
                ).map(([kind, label, key]) => (
                  <div key={kind} className="flex flex-wrap items-center gap-2">
                    <span className="w-8 text-xs text-hai">{label}</span>
                    <Chip active={mapping[key] === null} onClick={() => setMapping({ ...mapping, [key]: null })}>
                      不要
                    </Chip>
                    {sounds.map(({ index, count }) => (
                      <Chip
                        key={index}
                        active={mapping[key] === index}
                        onClick={() => setMapping({ ...mapping, [key]: index })}
                      >
                        {noteType.fields[index]}（{count}）
                      </Chip>
                    ))}
                  </div>
                ))}
              </div>
              <p className="mt-1 text-xs text-hai">
                复习时单词录音在打对读音后自动放，例句录音点喇叭才放
              </p>
            </Row>
          )}

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
                    {(card.wordAudio || card.sentenceAudio) && (
                      <div className="mt-1 text-xs text-hai/70">
                        录音：{[card.wordAudio && '单词', card.sentenceAudio && '例句'].filter(Boolean).join(' · ')}
                      </div>
                    )}
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
              {audioProgress
                ? `传录音 ${audioProgress.done} / ${audioProgress.total}…`
                : importing
                  ? '导入中…'
                  : `导入 ${cards.length} 张`}
            </button>
            <span className="text-xs text-hai">
              已存在的词会自动跳过（录音照样补上），图片不会导入
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
          {audioResult && (
            <span className="text-hai">
              。录音 {audioResult.stored} 段
              {audioResult.skipped > 0 && `，${audioResult.skipped} 段包里缺文件或太大，没传`}
            </span>
          )}
        </p>
      )}
    </div>
  )
}

/**
 * 要传哪些录音：每个正面只取第一次出现的那条笔记的 —— 和后端导入时去重的规则一样。
 * 文件只记名字，传到那一批时才从包里读出来。
 */
function audioItems(cards: AnkiCard[], cardIds: Record<string, number>, pkg: AnkiPackage) {
  const items: { cardId: number; kind: AudioKind; read: () => Promise<Blob | null> }[] = []
  const seen = new Set<string>()
  for (const card of cards) {
    const cardId = cardIds[card.front]
    if (cardId === undefined || seen.has(card.front)) continue
    seen.add(card.front)
    if (card.wordAudio) {
      const name = card.wordAudio
      items.push({ cardId, kind: 'word', read: () => pkg.readMedia(name) })
    }
    if (card.sentenceAudio) {
      const name = card.sentenceAudio
      items.push({ cardId, kind: 'sentence', read: () => pkg.readMedia(name) })
    }
  }
  return items
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
