/**
 * 标签：跨分类的记号（如“云南旅行”“装修”“报销”），一笔账最多带 MAX_TAGS 个。
 * 存在账目 / 常记的 tags 列里，是标签名的 JSON 数组；没有单独的标签表（改名、删除时改每一笔）。
 */

export const MAX_TAGS = 3
export const TAG_MAX_LEN = 10

/** 去掉首尾空白、把中间连续空白压成一个；超长截断（按字算，不按字节） */
export function normalizeTag(s: string): string {
  return Array.from(s.trim().replace(/\s+/g, ' ')).slice(0, TAG_MAX_LEN).join('')
}

/** 规范化 + 去空 + 去重，保持原顺序 */
export function cleanTags(tags: readonly string[]): string[] {
  const out: string[] = []
  for (const t of tags) {
    const n = normalizeTag(t)
    if (n && !out.includes(n)) out.push(n)
  }
  return out
}

/** 数据库里的 JSON 文本 → 标签数组；坏数据（别的手机上传的、旧版本）当作没有标签 */
export function parseTags(json: string | null | undefined): string[] {
  if (!json) return []
  try {
    const v: unknown = JSON.parse(json)
    return Array.isArray(v) ? cleanTags(v.filter((x): x is string => typeof x === 'string')) : []
  } catch {
    return []
  }
}

export const tagsJson = (tags: readonly string[]) => JSON.stringify(cleanTags(tags))

/** 最近用过的标签：rows 按时间从新到旧排好，取不重复的前 limit 个 */
export function recentTagNames(rows: readonly { tags: readonly string[] }[], limit = 30): string[] {
  const out: string[] = []
  for (const r of rows) {
    for (const t of r.tags) {
      if (!out.includes(t)) out.push(t)
      if (out.length >= limit) return out
    }
  }
  return out
}

export interface TagTotal {
  name: string
  /** 花了多少：支出 − 退款（不会小于 0） */
  spendCents: number
  incomeCents: number
  count: number
}

/**
 * 按标签合计。一笔带两个标签，两个标签里都算（所以各标签加起来可能比总支出多）。
 * 转账不算钱，只计笔数。按花的钱从多到少，一样多按笔数
 */
export function tagTotals(rows: readonly { type: string; amountCents: number; tags: readonly string[] }[]): TagTotal[] {
  const map = new Map<string, TagTotal>()
  for (const r of rows) {
    for (const name of r.tags) {
      const t = map.get(name) ?? { name, spendCents: 0, incomeCents: 0, count: 0 }
      t.count++
      if (r.type === 'expense') t.spendCents += r.amountCents
      else if (r.type === 'refund') t.spendCents -= r.amountCents
      else if (r.type === 'income') t.incomeCents += r.amountCents
      map.set(name, t)
    }
  }
  return [...map.values()]
    .map((t) => ({ ...t, spendCents: Math.max(0, t.spendCents) }))
    .sort((a, b) => b.spendCents - a.spendCents || b.count - a.count || a.name.localeCompare(b.name))
}

/** 改名 / 删除一个标签后的新数组；to 为 null 是删除。改成已有的名字时合并（不重复） */
export function replaceTag(tags: readonly string[], from: string, to: string | null): string[] {
  return cleanTags(tags.flatMap((t) => (t === from ? (to === null ? [] : [to]) : [t])))
}

/** 一个标签按月花了多少（标签页：跨月的标签分月看），按月份从早到晚；只列花了钱的月份 */
export function spendByMonth(rows: readonly { type: string; amountCents: number; date: string }[]): { month: string; cents: number }[] {
  const map = new Map<string, number>()
  for (const r of rows) {
    const m = r.date.slice(0, 7)
    if (r.type === 'expense') map.set(m, (map.get(m) ?? 0) + r.amountCents)
    else if (r.type === 'refund') map.set(m, (map.get(m) ?? 0) - r.amountCents)
  }
  return [...map.entries()]
    .filter(([, c]) => c > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, cents]) => ({ month, cents }))
}
