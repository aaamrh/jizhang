import { and, desc, eq, gte, lt, ne } from 'drizzle-orm'
import { normalizeTag, parseTags, recentTagNames, replaceTag, tagsJson, tagTotals, type TagTotal } from '../utils/tags'
import { DomainError, inLedger, touched, type DB } from './core'
import { templates as tp, transactions as t } from './schema'

/** 带标签的账（可限定日期 [start, end)），最近改过的在前 */
function tagged(db: DB, ledgerId: string, start?: string, end?: string) {
  return db
    .select({ id: t.id, type: t.type, amountCents: t.amountCents, tags: t.tags })
    .from(t)
    .where(and(inLedger(t, ledgerId), ne(t.tags, '[]'), start ? gte(t.date, start) : undefined, end ? lt(t.date, end) : undefined))
    .orderBy(desc(t.updatedAt))
    .all()
    .map((r) => ({ ...r, tags: parseTags(r.tags) }))
}

/** 选标签时列出来的：最近用过的在前 */
export const recentTags = (db: DB, ledgerId: string, limit = 30): string[] => recentTagNames(tagged(db, ledgerId), limit)

/** 一段时间里按标签合计（盘账“按标签”） */
export const tagTotalsIn = (db: DB, ledgerId: string, start: string, end: string): TagTotal[] => tagTotals(tagged(db, ledgerId, start, end))

/** 所有标签，不分时间（标签管理页） */
export const allTagTotals = (db: DB, ledgerId: string): TagTotal[] => tagTotals(tagged(db, ledgerId))

/**
 * 改名（to 为新名字）或删除（to 为 null）：改这个账本里每一笔带它的账和常记。
 * 改成已有的标签就是合并。删标签不删账
 */
/** 删掉一个标签前，记下哪些账、常记带着它（原来的标签顺序），撤销时原样放回 */
export type TagSnapshot = { txns: { id: string; tags: string[] }[]; templates: { id: string; tags: string[] }[] }

export function deleteTag(db: DB, ledgerId: string, name: string): TagSnapshot {
  const snap: TagSnapshot = {
    txns: tagged(db, ledgerId).filter((r) => r.tags.includes(name)).map(({ id, tags }) => ({ id, tags })),
    templates: db
      .select({ id: tp.id, tags: tp.tags })
      .from(tp)
      .where(and(inLedger(tp, ledgerId), ne(tp.tags, '[]')))
      .all()
      .map((r) => ({ id: r.id, tags: parseTags(r.tags) }))
      .filter((r) => r.tags.includes(name)),
  }
  renameTag(db, ledgerId, name, null)
  return snap
}

export function restoreTags(db: DB, snap: TagSnapshot) {
  db.transaction((tx) => {
    for (const r of snap.txns) tx.update(t).set({ tags: tagsJson(r.tags), ...touched() }).where(eq(t.id, r.id)).run()
    for (const r of snap.templates) tx.update(tp).set({ tags: tagsJson(r.tags), ...touched() }).where(eq(tp.id, r.id)).run()
  })
}

export function renameTag(db: DB, ledgerId: string, from: string, to: string | null) {
  const name = to === null ? null : normalizeTag(to)
  if (name === '') throw new DomainError('请写个标签名')
  if (name === from) return
  db.transaction((tx) => {
    for (const r of tagged(tx, ledgerId)) {
      if (r.tags.includes(from)) tx.update(t).set({ tags: tagsJson(replaceTag(r.tags, from, name)), ...touched() }).where(eq(t.id, r.id)).run()
    }
    const temps = tx.select({ id: tp.id, tags: tp.tags }).from(tp).where(and(inLedger(tp, ledgerId), ne(tp.tags, '[]'))).all()
    for (const r of temps) {
      const tags = parseTags(r.tags)
      if (tags.includes(from)) tx.update(tp).set({ tags: tagsJson(replaceTag(tags, from, name)), ...touched() }).where(eq(tp.id, r.id)).run()
    }
  })
}
