/**
 * 一份卷子做到一半的答案和用时，存在这台设备上：不小心关了页面回来还在。
 * recorded 是做完一遍后记下的那次成绩，有了就不再重复记。
 * 做题页读写，列表页只读（显示做到第几题）。
 */
export interface Draft {
  answers: Record<number, number>
  elapsed: number
  recorded: number | null
}

export function draftKey(userId: number | undefined, examId: number): string {
  return `kotoba:exam-draft:${userId}:${examId}`
}

export function readDraft(key: string): Draft | null {
  try {
    const draft = JSON.parse(localStorage.getItem(key) ?? 'null')
    if (draft && typeof draft.elapsed === 'number' && typeof draft.answers === 'object') {
      return {
        ...draft,
        recorded: typeof draft.recorded === 'number' ? draft.recorded : null,
      }
    }
  } catch {
    // 读不出来就当没有
  }
  return null
}

export function writeDraft(key: string, draft: Draft | null) {
  try {
    if (draft) localStorage.setItem(key, JSON.stringify(draft))
    else localStorage.removeItem(key)
  } catch {
    // 无痕窗口之类存不了，这次照样能做
  }
}
