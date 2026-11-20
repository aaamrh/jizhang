import { and, asc, eq } from 'drizzle-orm'
import { toTemplate } from '../mapper/template'
import type { Template, TemplateInput, TemplateView } from '../types/domain'
import { today } from '../utils/dates'
import { COLOR_KEYS, parseIcon } from '../utils/iconCatalog'
import { oneOf } from '../mapper/narrow'
import { alive, DomainError, inLedger, newId, removed, restored, touched, type DB } from './core'
import { categories, templates as tp } from './schema'
import { createTxn, deleteTxn, getTxn } from './txnRepo'
import { tagsJson } from '../utils/tags'

/** 一个账本的常记，按排序；带上分类图标（分类被删掉的常记也显示，点了会提示） */
export function listTemplates(db: DB, ledgerId: string): TemplateView[] {
  return db
    .select({ tp, icon: categories.icon, name: categories.name, color: categories.color })
    .from(tp)
    .leftJoin(categories, and(eq(categories.id, tp.categoryId), alive(categories)))
    .where(inLedger(tp, ledgerId))
    .orderBy(asc(tp.sort), asc(tp.updatedAt))
    .all()
    .map((r) => ({
      ...toTemplate(r.tp),
      categoryIcon: r.icon ? parseIcon(r.icon, r.name ?? '') : null,
      categoryColor: oneOf(r.color, COLOR_KEYS, 'mo'),
    }))
}

export function getTemplate(db: DB, id: string): Template | undefined {
  const r = db.select().from(tp).where(and(alive(tp), eq(tp.id, id))).get()
  return r ? toTemplate(r) : undefined
}

function check(v: TemplateInput) {
  if (!v.name.trim()) throw new DomainError('请填写名称，比如“理发”')
  if (!(v.amountCents > 0)) throw new DomainError('请输入正确的金额')
  if (!v.categoryId) throw new DomainError('请选择分类')
  if (!v.walletId) throw new DomainError('请选择钱袋')
}

export function createTemplate(db: DB, ledgerId: string, v: TemplateInput) {
  check(v)
  const last = db.select({ sort: tp.sort }).from(tp).where(inLedger(tp, ledgerId)).orderBy(asc(tp.sort)).all().at(-1)?.sort ?? -1
  const id = newId()
  db.insert(tp)
    .values({ id, ledgerId, ...touched(), ...v, name: v.name.trim(), note: v.note.trim(), tags: tagsJson(v.tags ?? []), sort: last + 1 })
    .run()
  return id
}

export function updateTemplate(db: DB, id: string, v: TemplateInput) {
  check(v)
  const { tags, ...rest } = v
  db.update(tp)
    .set({ ...rest, name: v.name.trim(), note: v.note.trim(), ...(tags ? { tags: tagsJson(tags) } : {}), ...touched() })
    .where(eq(tp.id, id))
    .run()
}

export function deleteTemplate(db: DB, id: string) {
  db.update(tp).set(removed()).where(eq(tp.id, id)).run()
}

export const restoreTemplate = (db: DB, id: string) => db.update(tp).set(restored()).where(eq(tp.id, id)).run()

export function reorderTemplates(db: DB, ids: string[]) {
  db.transaction((tx) => {
    ids.forEach((id, i) => tx.update(tp).set({ sort: i, ...touched() }).where(eq(tp.id, id)).run())
  })
}

/** 点一下常记：按今天记一笔，返回账目 id（撤销时删掉它） */
export function recordTemplate(db: DB, id: string, createdBy: string | null): string {
  const t = getTemplate(db, id)
  if (!t) throw new DomainError('这条常记已经删除了')
  return createTxn(
    db,
    t.ledgerId,
    {
      type: t.type,
      amountCents: t.amountCents,
      categoryId: t.categoryId,
      walletId: t.walletId,
      toWalletId: null,
      date: today(),
      note: t.note || t.name,
      asset: null,
      memberId: t.memberId,
      tags: t.tags,
    },
    createdBy,
  )
}

/** 从一笔账存为常记的初始值（支出、收入才可以） */
export function templateFromTxn(db: DB, txnId: string): TemplateInput | undefined {
  const x = getTxn(db, txnId)
  if (!x || (x.type !== 'expense' && x.type !== 'income') || !x.categoryId) return undefined
  return { name: x.note || '', type: x.type, categoryId: x.categoryId, amountCents: x.amountCents, walletId: x.walletId, note: '', memberId: x.memberId, tags: x.tags }
}

/** 记账时勾了「存为常记」：同名（同类型）的常记就更新，否则新建 */
export function saveTemplateByName(db: DB, ledgerId: string, v: TemplateInput) {
  const name = v.name.trim()
  const hit = db
    .select({ id: tp.id })
    .from(tp)
    .where(and(inLedger(tp, ledgerId), eq(tp.name, name), eq(tp.type, v.type)))
    .get()
  if (hit) updateTemplate(db, hit.id, v)
  else createTemplate(db, ledgerId, v)
}

export const undoRecord = (db: DB, txnId: string) => deleteTxn(db, txnId)
