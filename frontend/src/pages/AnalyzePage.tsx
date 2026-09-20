import { useState } from 'react'
import { useAnalysis, MAX_SENTENCES } from '../analysis'
import AnalysisResults, { SaveBar } from '../components/AnalysisResults'

/**
 * 粘一段日语，让模型逐句讲清楚：翻译、动词活用、语法点。
 * 拆解结果不落库：勾中的那些建成卡片，其余看完就丢。
 */
export default function AnalyzePage() {
  const [text, setText] = useState('')
  const analysis = useAnalysis()

  return (
    <div>
      <section className="mb-8 border-b border-usu pb-8">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={5}
          placeholder="把读到的日语粘在这里，比如：&#10;彼は宿題をやってしまったので、遊びに行かせてもらえた。"
          className="w-full resize-y border border-usu bg-transparent p-3 font-mincho text-base leading-relaxed placeholder:font-ui placeholder:text-sm placeholder:text-hai/40 focus:border-ai focus:outline-none"
        />
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
          <button
            onClick={() => analysis.run(text)}
            disabled={text.trim() === '' || analysis.analyzing}
            className="rounded-sm bg-ai px-5 py-2.5 text-sm text-washi transition hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-30"
          >
            {analysis.analyzing ? '拆解中…' : '拆解'}
          </button>
          <span className="text-xs text-hai">
            逐句并行，哪句先好先显示。一次最多 {MAX_SENTENCES} 句
          </span>
        </div>
        {analysis.error && <p className="mt-3 text-sm text-shu">{analysis.error}</p>}
      </section>

      <AnalysisResults analysis={analysis} />
      {analysis.hasResults && <SaveBar analysis={analysis} />}
    </div>
  )
}
