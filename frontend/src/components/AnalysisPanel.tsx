import AnalysisResults, { SaveBar } from './AnalysisResults'
import type { SelectionAnalysis } from '../selection'

/**
 * 拆解面板。窄屏上是底部弹层，宽屏上变成右侧栏（xl 断点）：
 * 弹层会盖掉大半个屏幕，而宽屏本来就有空地方，没必要挡着正文。
 * 选区和拆解状态来自 useSelectionAnalysis；外层要配好两栏的 grid，见阅读页。
 */
export default function AnalysisPanel({ selection }: { selection: SelectionAnalysis }) {
  const { analysis, pending, analyze, close } = selection

  return (
    <aside className="fixed inset-x-0 bottom-0 z-20 max-h-[72vh] overflow-y-auto border-t border-usu bg-washi px-4 pb-4 shadow-[0_-4px_24px_rgba(0,0,0,0.06)] sm:px-8 xl:sticky xl:inset-auto xl:top-8 xl:max-h-[calc(100vh-4rem)] xl:border-t-0 xl:border-l xl:px-6 xl:pt-1 xl:shadow-none">
      <div className="sticky top-0 z-10 mb-3 flex items-baseline justify-between gap-3 bg-washi pt-4 pb-2 xl:pt-3">
        {/* 面板开着时又选了新的一段 —— 按钮放这儿，不用先收起再选 */}
        {pending !== '' ? (
          <button
            onClick={() => analyze(pending)}
            className="rounded-sm bg-ai px-3 py-1.5 text-xs text-washi transition hover:opacity-85"
          >
            拆解新选中的 {pending.length} 字
          </button>
        ) : (
          <span className="text-xs tracking-widest text-hai">拆解</span>
        )}
        <button onClick={close} className="shrink-0 text-xs text-hai transition hover:text-sumi">
          收起
        </button>
      </div>

      {analysis.error && <p className="mb-3 text-sm text-shu">{analysis.error}</p>}
      <AnalysisResults analysis={analysis} />
      {analysis.hasResults && <SaveBar analysis={analysis} sticky={false} />}
    </aside>
  )
}
