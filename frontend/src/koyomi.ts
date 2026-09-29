/**
 * 暦：彼岸那条河上标的节气和满月。
 *
 * 不查表，按天文公式现算，精度到几十分钟 —— 画在一条几百像素的线上足够了。
 * 只有事件刚好落在半夜前后时，日期才可能差一天。
 */

const DAY_MS = 24 * 60 * 60 * 1000
/** 1970-01-01T00:00Z 的儒略日 */
const UNIX_EPOCH_JD = 2440587.5
/** J2000.0 */
const J2000 = 2451545
const RAD = Math.PI / 180

const toJd = (date: Date) => date.getTime() / DAY_MS + UNIX_EPOCH_JD
const fromJd = (jd: number) => new Date((jd - UNIX_EPOCH_JD) * DAY_MS)
const sin = (deg: number) => Math.sin(deg * RAD)
const mod360 = (deg: number) => ((deg % 360) + 360) % 360

/** 本地零点，和 goal-time 一样，只比日期不比钟点。 */
const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate())

// ---- 节气 ----------------------------------------------------------------

/** 从春分（黄经 0°）起，每 15° 一个 */
const TERM_NAMES = [
  '春分', '清明', '谷雨', '立夏', '小满', '芒种',
  '夏至', '小暑', '大暑', '立秋', '处暑', '白露',
  '秋分', '寒露', '霜降', '立冬', '小雪', '大雪',
  '冬至', '小寒', '大寒', '立春', '雨水', '惊蛰',
]

/**
 * 太阳视黄经，天文年历的简化公式：2000 年前后两百年内误差约 1 角分，
 * 太阳一天走 1°，折成时间也就二十多分钟。
 */
function sunLongitude(jd: number): number {
  const n = jd - J2000
  const meanLongitude = 280.46 + 0.9856474 * n
  const meanAnomaly = 357.528 + 0.9856003 * n
  return mod360(meanLongitude + 1.915 * sin(meanAnomaly) + 0.02 * sin(2 * meanAnomaly))
}

/** 太阳走到 longitude 的时刻。从 guess 出发牛顿迭代，几步就收敛。 */
function whenSunAt(longitude: number, guess: number): number {
  let jd = guess
  for (let i = 0; i < 5; i++) {
    const diff = mod360(longitude - sunLongitude(jd) + 180) - 180
    jd += diff / 0.9856474
  }
  return jd
}

export interface SolarTerm {
  name: string
  /** 本地零点 */
  date: Date
  /**
   * 分量级，河太长时按它挑着标：
   * 3 = 立春（一年一个），2 = 另外三立，1 = 二分二至，0 = 其余
   */
  rank: 0 | 1 | 2 | 3
}

/** from、to 之间（都含）的节气。 */
export function solarTerms(from: Date, to: Date): SolarTerm[] {
  const first = startOfDay(from)
  const last = startOfDay(to)
  const terms: SolarTerm[] = []

  // 从起点前一天开始找下一个 15° 的整数倍，免得漏掉起点当天的
  let jd = toJd(first) - 1
  let index = Math.floor(sunLongitude(jd) / 15) + 1
  for (;;) {
    const longitude = (index % 24) * 15
    jd = whenSunAt(longitude, jd + mod360(longitude - sunLongitude(jd)) / 0.9856474)
    const date = termDate(jd)
    if (date > last) break
    if (date >= first) {
      terms.push({ name: TERM_NAMES[index % 24], date, rank: termRank(longitude) })
    }
    index++
  }
  return terms
}

/**
 * 节气是哪一天，按北京时间算 —— 日历上印的就是这个日子，
 * 人在别的时区看，寒露也还是 10 月 8 日。
 */
function termDate(jd: number): Date {
  const beijing = fromJd(jd + 8 / 24)
  return new Date(beijing.getUTCFullYear(), beijing.getUTCMonth(), beijing.getUTCDate())
}

function termRank(longitude: number): SolarTerm['rank'] {
  if (longitude === 315) return 3
  if (longitude % 90 === 45) return 2
  if (longitude % 90 === 0) return 1
  return 0
}

// ---- 满月 ----------------------------------------------------------------

const SYNODIC_MONTH = 29.530588861

/**
 * 第 k 个满月的时刻（k 取 x.5），Meeus《天文算法》第 49 章，
 * 平均时刻加上最大的几项周期修正，误差几分钟。
 */
function fullMoon(k: number): number {
  const t = k / 1236.85
  const e = 1 - 0.002516 * t - 0.0000074 * t * t
  const m = 2.5534 + 29.1053567 * k - 0.0000014 * t * t
  const mPrime = 201.5643 + 385.81693528 * k + 0.0107582 * t * t
  const f = 160.7108 + 390.67050284 * k - 0.0016118 * t * t
  const mean = 2451550.09766 + SYNODIC_MONTH * k + 0.00015437 * t * t
  return (
    mean -
    0.40614 * sin(mPrime) +
    0.17302 * e * sin(m) +
    0.01614 * sin(2 * mPrime) +
    0.01043 * sin(2 * f) +
    0.00734 * e * sin(mPrime - m) -
    0.00515 * e * sin(mPrime + m) +
    0.00209 * e * e * sin(2 * m) -
    0.00111 * sin(mPrime - 2 * f) -
    0.00057 * sin(mPrime + 2 * f) +
    0.00056 * e * sin(2 * mPrime + m)
  )
}

/** from、to 之间（都含）的满月，本地日期 —— 月亮是抬头就看得见的，按人在哪儿算。 */
export function fullMoons(from: Date, to: Date): Date[] {
  const first = startOfDay(from)
  const last = startOfDay(to)
  const moons: Date[] = []

  let k = Math.floor((toJd(first) - 2451550.09766) / SYNODIC_MONTH) - 0.5
  for (;;) {
    const date = startOfDay(fromJd(fullMoon(k)))
    if (date > last) break
    if (date >= first) moons.push(date)
    k++
  }
  return moons
}
