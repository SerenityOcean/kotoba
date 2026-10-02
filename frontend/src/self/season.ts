import { solarTerms } from '../koyomi'
import type { SolarTerm } from '../koyomi'
import { addDays, daysBetween, startOfDay } from '../goal-time'

/**
 * self 的时令：今天在哪个节气、第几天、第几候，以及每个节气的颜色。
 *
 * 节气本身由 koyomi 现算；这里只配上颜色和七十二候（《逸周书·时训解》一系的通行说法）。
 */

interface TermInfo {
  /** 从立春数起第几个，1–24 */
  ordinal: number
  color: string
  /** 一候、二候、三候，各五天 */
  pentads: [string, string, string]
}

const TERMS: Record<string, TermInfo> = {
  立春: { ordinal: 1, color: '#8daa72', pentads: ['东风解冻', '蛰虫始振', '鱼陟负冰'] },
  雨水: { ordinal: 2, color: '#7fa59b', pentads: ['獭祭鱼', '候雁北', '草木萌动'] },
  惊蛰: { ordinal: 3, color: '#c98a9d', pentads: ['桃始华', '仓庚鸣', '鹰化为鸠'] },
  春分: { ordinal: 4, color: '#d4949f', pentads: ['玄鸟至', '雷乃发声', '始电'] },
  清明: { ordinal: 5, color: '#82a982', pentads: ['桐始华', '田鼠化为鴽', '虹始见'] },
  谷雨: { ordinal: 6, color: '#98a86e', pentads: ['萍始生', '鸣鸠拂其羽', '戴胜降于桑'] },
  立夏: { ordinal: 7, color: '#6fa186', pentads: ['蝼蝈鸣', '蚯蚓出', '王瓜生'] },
  小满: { ordinal: 8, color: '#b4a957', pentads: ['苦菜秀', '靡草死', '麦秋至'] },
  芒种: { ordinal: 9, color: '#c79b45', pentads: ['螳螂生', '鵙始鸣', '反舌无声'] },
  夏至: { ordinal: 10, color: '#d8874c', pentads: ['鹿角解', '蜩始鸣', '半夏生'] },
  小暑: { ordinal: 11, color: '#d27556', pentads: ['温风至', '蟋蟀居宇', '鹰始挚'] },
  大暑: { ordinal: 12, color: '#c45f48', pentads: ['腐草为萤', '土润溽暑', '大雨时行'] },
  立秋: { ordinal: 13, color: '#c6975a', pentads: ['凉风至', '白露降', '寒蝉鸣'] },
  处暑: { ordinal: 14, color: '#bfa05a', pentads: ['鹰乃祭鸟', '天地始肃', '禾乃登'] },
  白露: { ordinal: 15, color: '#8aa2b2', pentads: ['鸿雁来', '玄鸟归', '群鸟养羞'] },
  秋分: { ordinal: 16, color: '#d47f58', pentads: ['雷始收声', '蛰虫坯户', '水始涸'] },
  寒露: { ordinal: 17, color: '#b8734f', pentads: ['鸿雁来宾', '雀入大水为蛤', '菊有黄华'] },
  霜降: { ordinal: 18, color: '#a5604a', pentads: ['豺乃祭兽', '草木黄落', '蛰虫咸俯'] },
  立冬: { ordinal: 19, color: '#878ca3', pentads: ['水始冰', '地始冻', '雉入大水为蜃'] },
  小雪: { ordinal: 20, color: '#94a3b5', pentads: ['虹藏不见', '天气上升地气下降', '闭塞而成冬'] },
  大雪: { ordinal: 21, color: '#7c93aa', pentads: ['鹖鴠不鸣', '虎始交', '荔挺出'] },
  冬至: { ordinal: 22, color: '#6c7c98', pentads: ['蚯蚓结', '麋角解', '水泉动'] },
  小寒: { ordinal: 23, color: '#8883a0', pentads: ['雁北乡', '鹊始巢', '雉始雊'] },
  大寒: { ordinal: 24, color: '#78879e', pentads: ['鸡始乳', '征鸟厉疾', '水泽腹坚'] },
}

/** 两个节气最多隔 16 天，往前看这么远一定能碰到一个。 */
const LOOKBACK = 16

export interface Season {
  name: string
  ordinal: number
  color: string
  /** 进入这个节气的第几天，从 1 数 */
  day: number
  pentads: [string, string, string]
  /** 现在是第几候，0–2 */
  pentad: number
}

export function seasonOf(date: Date): Season {
  const today = startOfDay(date)
  const terms = solarTerms(addDays(today, -LOOKBACK), today)
  const term = terms[terms.length - 1]
  const info = TERMS[term.name]
  const day = daysBetween(term.date, today) + 1
  return { name: term.name, ...info, day, pentad: Math.min(2, Math.floor((day - 1) / 5)) }
}

/**
 * 一批日期各自落在哪个节气。随笔列表里每张卡片都要问一次，
 * 所以先把整段区间的节气一次算好，再逐个往回找。
 */
export function termFinder(from: Date, to: Date): (date: Date) => { name: string; color: string } {
  const terms: SolarTerm[] = solarTerms(addDays(startOfDay(from), -LOOKBACK), to)
  return (date) => {
    const day = startOfDay(date)
    let found = terms[0]
    for (const term of terms) {
      if (term.date > day) break
      found = term
    }
    return { name: found.name, color: TERMS[found.name].color }
  }
}

const DIGITS = ['〇', '一', '二', '三', '四', '五', '六', '七', '八', '九']

/** 1–99 的中文数字：十、十六、二十、三十一 */
export function cnNumber(n: number): string {
  if (n < 10) return DIGITS[n]
  const tens = Math.floor(n / 10)
  const ones = n % 10
  return `${tens === 1 ? '' : DIGITS[tens]}十${ones ? DIGITS[ones] : ''}`
}

export const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

/** 2026 · 十月二日 */
export function todayLabel(date: Date): string {
  return `${date.getFullYear()} · ${cnNumber(date.getMonth() + 1)}月${cnNumber(date.getDate())}日`
}
