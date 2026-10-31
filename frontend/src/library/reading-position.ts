/** 阅读器记在这台设备上的「读到哪儿」：0 到 1。阅读器边读边写，资料页的卡片拿来显示「接着读」。 */
export const POSITION_KEY = 'kotoba:reader-pos:'

/** 没读过（或者无痕窗口读不到）是 null */
export function readingPosition(storageKey: string): number | null {
  try {
    const value = Number(localStorage.getItem(POSITION_KEY + storageKey))
    return Number.isFinite(value) && value > 0 ? value : null
  } catch {
    return null
  }
}
