import Furigana from './Furigana'
import type { Analysis } from '../analysis'

/**
 * 拆解结果的渲染 + 勾选 + 建卡条。拆解页和阅读页共用 ——
 * 状态都在 useAnalysis 里，这边只管画。
 */
export default function AnalysisResults({ analysis }: { analysis: Analysis }) {
  const { slots, selected, toggle } = analysis

  return (
    <>
      {slots.map((slot, i) =>
        slot.status === 'pending' ? (
          <section key={i} className="mb-10 animate-pulse">
            <p className="font-mincho text-xl leading-relaxed text-hai/50 sm:text-2xl">
              {slot.source}
            </p>
            <p className="mt-1.5 text-sm text-hai">拆解中…</p>
          </section>
        ) : slot.status === 'error' ? (
          <section key={i} className="mb-10">
            <p className="font-mincho text-xl leading-relaxed sm:text-2xl">{slot.source}</p>
            <p className="mt-1.5 text-sm text-shu">{slot.message}</p>
          </section>
        ) : (
          <section key={i} className="mb-10">
            {slot.sentences.map((s, k) => (
              <div key={k}>
                <Row checked={selected.has(`${i}-${k}`)} onToggle={() => toggle(`${i}-${k}`)}>
                  <p className="font-mincho text-xl leading-loose sm:text-2xl">
                    <Furigana text={s.original} />
                  </p>
                  <p className="mt-1.5 text-sm text-hai">{s.translation}</p>
                </Row>

                {s.verbs?.length > 0 && (
                  <>
                    <Heading>动词・形容词</Heading>
                    {s.verbs.map((v, j) => (
                      <Row
                        key={j}
                        checked={selected.has(`${i}-${k}v${j}`)}
                        onToggle={() => toggle(`${i}-${k}v${j}`)}
                      >
                        <p className="flex flex-wrap items-baseline gap-x-2 leading-loose">
                          <span className="font-mincho text-lg">
                            <Furigana text={v.surface} />
                          </span>
                          <span className="text-xs text-hai">←</span>
                          <span className="font-mincho text-base text-hai">
                            {/* 模型给辞书形也注音，不套 Furigana 方括号就露出来了 */}
                            <Furigana text={v.dictionaryForm} />
                          </span>
                          <span className="text-xs text-hai">{v.reading}</span>
                          <span className="rounded-sm bg-usu px-1.5 py-0.5 text-xs text-sumi">
                            {v.form}
                          </span>
                          <span className="text-xs text-hai">{v.meaning}</span>
                        </p>
                        <p className="mt-1.5 text-sm leading-relaxed">{v.explanation}</p>
                      </Row>
                    ))}
                  </>
                )}

                {s.grammarPoints?.length > 0 && (
                  <>
                    <Heading>语法</Heading>
                    {s.grammarPoints.map((g, j) => (
                      <Row
                        key={j}
                        checked={selected.has(`${i}-${k}g${j}`)}
                        onToggle={() => toggle(`${i}-${k}g${j}`)}
                      >
                        <p className="flex flex-wrap items-baseline gap-x-2">
                          <span className="font-mincho text-lg">{g.pattern}</span>
                          <span className="text-xs text-hai">{g.meaning}</span>
                        </p>
                        <p className="mt-1.5 text-sm leading-relaxed">{g.explanation}</p>
                        {g.example && (
                          <p className="mt-1.5 border-l-2 border-usu pl-3 text-sm leading-loose text-hai">
                            <Furigana text={g.example} />
                          </p>
                        )}
                      </Row>
                    ))}
                  </>
                )}
              </div>
            ))}
          </section>
        ),
      )}
    </>
  )
}

/** 建卡条。拆解页钉在页底，阅读页跟在结果后面。 */
export function SaveBar({ analysis, sticky = true }: { analysis: Analysis; sticky?: boolean }) {
  const { selectedCount, save, saving, result, decks, deckName, setDeckName } = analysis

  return (
    <div
      className={
        sticky
          ? 'sticky bottom-0 -mx-4 border-t border-usu bg-washi px-4 py-4 sm:-mx-6 sm:px-6'
          : 'border-t border-usu py-4'
      }
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
        <button
          onClick={save}
          disabled={selectedCount === 0 || saving}
          className="rounded-sm border border-sumi px-5 py-2.5 text-sm transition hover:bg-sumi hover:text-washi disabled:cursor-not-allowed disabled:opacity-30"
        >
          {saving ? '建卡中…' : `加入卡片（${selectedCount}）`}
        </button>

        <label className="flex items-baseline gap-2 text-xs text-hai">
          存到
          <select
            value={deckName}
            onChange={(e) => setDeckName(e.target.value)}
            className="border-b border-usu bg-transparent pb-0.5 text-sm text-sumi focus:border-ai focus:outline-none"
          >
            <option value="">默认包</option>
            {decks.map((d) => (
              <option key={d.id} value={d.name}>
                {d.name}
              </option>
            ))}
          </select>
        </label>

        {result && (
          <span className="text-sm">
            建了 <span className="text-ai">{result.imported}</span> 张到「{result.deckName}」
            {result.skipped > 0 && (
              <span className="text-hai">，跳过 {result.skipped} 张（已存在）</span>
            )}
          </span>
        )}
      </div>
    </div>
  )
}

/** 一条可勾选的内容。勾选框靠上对齐，免得多行文字把它推到中间。 */
function Row({
  checked,
  onToggle,
  children,
}: {
  checked: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 border-b border-usu py-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        className="mt-1.5 h-3.5 w-3.5 shrink-0 accent-ai"
      />
      <span className="min-w-0 flex-1">{children}</span>
    </label>
  )
}

function Heading({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-5 mb-1 text-xs tracking-widest text-hai">{children}</h2>
}
