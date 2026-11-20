const DAY_MS = 86_400_000

/** 北京时间（UTC+8，无夏令时）的 'YYYY-MM-DD' */
export const cnDayString = (now = Date.now()) => new Date(now + 8 * 3_600_000).toISOString().slice(0, 10)

/** 以 end（'YYYY-MM-DD'）结尾的连续 n 天，从早到晚 */
export function lastDays(end: string, n: number): string[] {
  const t = Date.parse(`${end}T00:00:00Z`)
  return Array.from({ length: n }, (_, i) => new Date(t - (n - 1 - i) * DAY_MS).toISOString().slice(0, 10))
}
