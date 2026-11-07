import type { ExamProgress } from './api'

/**
 * 一份卷子这一遍做到哪儿了：答案、用时，recorded 是做完一遍后记下的那次成绩，有了就不再重复记。
 *
 * 进度存在后端，换台设备打开接着做；这台设备上也留一份，不小心关了页面、
 * 或者断网时存不上，回来还在。两份都有就看谁新：updatedAt 是这一份最后变的时候，
 * 和后端存下的时间比。老版本只存在本机的草稿没有时间（0），只在后端没有、
 * 或者本机答得比后端多的时候算新 —— 免得哪台设备先打开就拿旧草稿盖掉另一台的。
 */
export interface Draft {
  answers: Record<number, number>
  elapsed: number
  recorded: number | null
  updatedAt: number
}

export function draftKey(userId: number | undefined, examId: number): string {
  return `kotoba:exam-draft:${userId}:${examId}`
}

export function readDraft(key: string): Draft | null {
  try {
    const draft = JSON.parse(localStorage.getItem(key) ?? 'null')
    if (draft && typeof draft.elapsed === 'number' && typeof draft.answers === 'object') {
      return {
        answers: draft.answers,
        elapsed: draft.elapsed,
        recorded: typeof draft.recorded === 'number' ? draft.recorded : null,
        updatedAt: typeof draft.updatedAt === 'number' ? draft.updatedAt : 0,
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

/** 后端那份进度换成草稿的样子。题号在 JSON 里是字符串键，这里转回数字 */
export function fromProgress(progress: ExamProgress): Draft {
  const answers: Record<number, number> = {}
  for (const [number, choice] of Object.entries(progress.answers)) answers[Number(number)] = choice
  return {
    answers,
    elapsed: progress.elapsedSeconds,
    recorded: progress.recordedAttemptId,
    updatedAt: Date.parse(progress.updatedAt),
  }
}

/** 本机这份比后端那份新吗。server 是后端做到几题、什么时候存的，没存过是 null */
export function localIsNewer(
  local: Draft,
  server: { answered: number; updatedAt: number } | null,
): boolean {
  if (server === null) return true
  if (local.updatedAt === 0) return Object.keys(local.answers).length > server.answered
  return local.updatedAt > server.updatedAt
}

/** 内容一样吗（不看时间）：一样就不用再存一遍 */
export function sameDraft(a: Draft | null, b: Draft | null): boolean {
  if (a === null || b === null) return a === b
  const keys = Object.keys(a.answers)
  return (
    a.elapsed === b.elapsed &&
    a.recorded === b.recorded &&
    keys.length === Object.keys(b.answers).length &&
    keys.every((k) => a.answers[Number(k)] === b.answers[Number(k)])
  )
}
