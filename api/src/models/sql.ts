import { sql, type SQL, type SQLWrapper } from 'drizzle-orm'

// 统计按北京时间划分“今天”
export const cnToday = sql`(now() at time zone 'Asia/Shanghai')::date`

/** timestamptz 列 → 北京时间的 'YYYY-MM-DD' 字符串 */
export const cnDay = (col: SQLWrapper): SQL<string> =>
  sql<string>`to_char((${col} at time zone 'Asia/Shanghai')::date, 'YYYY-MM-DD')`
