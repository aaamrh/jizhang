import { and, asc, eq } from 'drizzle-orm'
import { toLedger, toMember } from '../mapper/member'
import type { LedgerType, Member } from '../types/domain'
import { DomainError, newId, now, type DB } from './core'
import { ledgers, members } from './schema'
import { seedLedger } from './seed'

export function listLedgers(db: DB) {
  // 主账本排第一，然后是自己的多账本，最后家庭账本；同类按创建时间
  const order = { personal: 0, book: 1, family: 2 } as const
  return db
    .select()
    .from(ledgers)
    .orderBy(asc(ledgers.createdAt))
    .all()
    .map(toLedger)
    .sort((a, b) => order[a.type] - order[b.type])
}

export function getLedger(db: DB, id: string) {
  const r = db.select().from(ledgers).where(eq(ledgers.id, id)).get()
  return r ? toLedger(r) : undefined
}

export function personalLedger(db: DB) {
  return listLedgers(db).find((l) => l.type === 'personal')
}

/** 本地建账本并写入默认钱袋、分类（新建家庭账本时，服务器创建成功后也走这里） */
export function createLedger(db: DB, v: { id?: string; name: string; type: LedgerType; remote?: boolean; cover?: string | null }) {
  const name = v.name.trim()
  if (!name) throw new DomainError('请填写账本名称')
  const id = v.id ?? newId()
  db.insert(ledgers)
    .values({ id, name, type: v.type, createdAt: now(), updatedAt: now(), remote: v.remote ?? false, cover: v.cover ?? null })
    .onConflictDoNothing()
    .run()
  seedLedger(db, id, v.type)
  return id
}

/**
 * 每次启动调用：没有个人账本就建一个；已有则只补缺的系统分类。
 * 服务器上的账本不在本地补默认数据：数据以服务器为准（同步还没拉下来时补，会用新的修改时间覆盖云端的同名分类）。
 */
export function ensurePersonalLedger(db: DB) {
  const p = personalLedger(db)
  if (!p) return createLedger(db, { name: '我的账本', type: 'personal' })
  if (!p.remote) seedLedger(db, p.id, 'personal')
  return p.id
}

export function listMembers(db: DB, ledgerId: string): Member[] {
  return db.select().from(members).where(eq(members.ledgerId, ledgerId)).orderBy(asc(members.joinedAt)).all().map(toMember)
}

/** 我在这个账本里的成员身份（没登录或本地账本时为 undefined） */
export function myMember(db: DB, ledgerId: string) {
  const r = db.select().from(members).where(and(eq(members.ledgerId, ledgerId), eq(members.isMe, true))).get()
  return r ? toMember(r) : undefined
}
