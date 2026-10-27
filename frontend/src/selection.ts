import { useCallback, useEffect, useState } from 'react'
import { useAnalysis } from './analysis'

/**
 * 取当前选区的纯文本。
 *
 * 不能直接用 selection.toString()：振假名是 <ruby><rt>，浏览器会把读音
 * 一起拼进字符串 ——「違って」变成「違ちがって」，送给模型就是一句
 * 根本不存在的日语。所以克隆选区、摘掉 <rt> 再取文本。
 * 标了 data-skip 的（选项编号、注释记号）也摘掉，它们不是正文。
 */
function readSelection(): string {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
    return ''
  }
  const fragment = selection.getRangeAt(0).cloneContents()
  fragment.querySelectorAll('rt, rp, [data-skip]').forEach((node) => node.remove())
  return (fragment.textContent ?? '').trim()
}

/**
 * 读的时候选中一段就地拆解：选了什么、拆过哪段、拆解结果。
 * 阅读页和应试页共用，面板是 components/AnalysisPanel。
 */
export function useSelectionAnalysis() {
  const [selection, setSelection] = useState('')
  // 已经拆过的那段。选中它时不用再弹按钮 —— 没有新东西可拆
  const [analyzed, setAnalyzed] = useState('')
  const analysis = useAnalysis()
  // 单独取出来：analysis 每次渲染都是新对象，但这两个被 useCallback 包过、
  // 身份稳定，effect 依赖它们才不会无限重跑
  const { reset, run } = analysis

  /**
   * 选中了什么。用 selectionchange 而不是 mouseup：键盘选、触屏拖动
   * 调整选区这些都能跟上，mouseup 只认鼠标那一种。
   */
  useEffect(() => {
    function onSelectionChange() {
      setSelection(readSelection())
    }
    document.addEventListener('selectionchange', onSelectionChange)
    return () => document.removeEventListener('selectionchange', onSelectionChange)
  }, [])

  const analyze = useCallback(
    (text: string) => {
      setAnalyzed(text)
      run(text)
    },
    [run],
  )

  /** 收起面板，连选区记录一起清掉。换文章、换卷子时也调它 */
  const close = useCallback(() => {
    reset()
    setSelection('')
    setAnalyzed('')
  }, [reset])

  return {
    analysis,
    /** 选中了新的一段（不是刚拆过那段）才值得提示；没有就是空串 */
    pending: selection !== '' && selection !== analyzed ? selection : '',
    showPanel: analysis.slots.length > 0,
    analyze,
    close,
  }
}

export type SelectionAnalysis = ReturnType<typeof useSelectionAnalysis>
