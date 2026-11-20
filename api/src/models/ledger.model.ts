import { and, asc, count, eq, gt, inArray, isNull, ne, sql } from 'drizzle-orm'
import type { DB } from './index.js'
import { invites, ledgerMembers, ledgers, syncRecords, users } from './schema.js'

const activeMember = isNull(ledgerMembers.removedAt)
const liveLedger = isNull(ledgers.deletedAt)

export const ledgerModel = (db: DB) => ({
  // ── 账本 ──
  async find(id: string) {
    return (await db.select().from(ledgers).where(eq(ledgers.id, id)).limit(1))[0]
  },

  /** 我参与的、未解散的账本，带我的成员身份 */
  async listForUser(userId: string) {
    return db
      .select({ ledger: ledgers, member: ledgerMembers })
      .from(ledgerMembers)
      .innerJoin(ledgers, eq(ledgers.id, ledgerMembers.ledgerId))
      .where(and(eq(ledgerMembers.userId, userId), activeMember, liveLedger))
      .orderBy(asc(ledgers.createdAt))
  },

  /** 我在某个未解散账本里的有效成员身份 */
  async membership(ledgerId: string, userId: string) {
    return (
      await db
        .select({ ledger: ledgers, member: ledgerMembers })
        .from(ledgerMembers)
        .innerJoin(ledgers, eq(ledgers.id, ledgerMembers.ledgerId))
        .where(and(eq(ledgerMembers.ledgerId, ledgerId), eq(ledgerMembers.userId, userId), activeMember, liveLedger))
        .limit(1)
    )[0]
  },

  async insert(v: { id: string; name: string; type: string; ownerId: string; cover?: string | null }) {
    return (await db.insert(ledgers).values(v).onConflictDoNothing().returning())[0]
  },

  async update(id: string, patch: Partial<{ name: string; cover: string | null; ownerId: string; deletedAt: Date }>) {
    await db.update(ledgers).set(patch).where(eq(ledgers.id, id))
  },

  async ownedLive(userId: string) {
    return db.select().from(ledgers).where(and(eq(ledgers.ownerId, userId), liveLedger))
  },

  /** 这些人各自的主账本（家庭账本汇总用） */
  async personalOf(userIds: string[]) {
    if (!userIds.length) return []
    return db
      .select({ id: ledgers.id, ownerId: ledgers.ownerId })
      .from(ledgers)
      .where(and(inArray(ledgers.ownerId, userIds), eq(ledgers.type, 'personal'), liveLedger))
  },

  async countFamily() {
    const [r] = await db.select({ n: count() }).from(ledgers).where(and(eq(ledgers.type, 'family'), liveLedger))
    return r?.n ?? 0
  },

  /** 锁住账本行并返回当前版本号；同一账本的同步因此串行，版本号不会乱序 */
  async lockSeq(id: string) {
    const rows = await db.select({ seq: ledgers.seq }).from(ledgers).where(eq(ledgers.id, id)).for('update')
    return rows[0]?.seq ?? 0
  },

  async setSeq(id: string, seq: number) {
    await db.update(ledgers).set({ seq }).where(eq(ledgers.id, id))
  },

  async purgeData(id: string) {
    await db.delete(syncRecords).where(eq(syncRecords.ledgerId, id))
    await db.delete(invites).where(eq(invites.ledgerId, id))
  },

  async hardDelete(id: string) {
    await db.delete(ledgers).where(eq(ledgers.id, id))
  },

  // ── 成员 ──
  /** 含已离开的成员：历史账目要显示他们原来的名字 */
  async members(ledgerIds: string[]) {
    if (!ledgerIds.length) return []
    const rows = await db
      .select({ m: ledgerMembers, vipUntil: users.vipUntil })
      .from(ledgerMembers)
      .leftJoin(users, eq(users.id, ledgerMembers.userId))
      .where(inArray(ledgerMembers.ledgerId, ledgerIds))
      .orderBy(asc(ledgerMembers.joinedAt))
    return rows.map((r) => ({ ...r.m, vipUntil: r.vipUntil }))
  },

  async findMember(ledgerId: string, memberId: string) {
    return (
      await db
        .select()
        .from(ledgerMembers)
        .where(and(eq(ledgerMembers.id, memberId), eq(ledgerMembers.ledgerId, ledgerId), activeMember))
        .limit(1)
    )[0]
  },

  async countMembers(ledgerId: string) {
    const [r] = await db
      .select({ n: count() })
      .from(ledgerMembers)
      .where(and(eq(ledgerMembers.ledgerId, ledgerId), activeMember))
    return r?.n ?? 0
  },

  async insertMember(v: { ledgerId: string; userId: string | null; nickname: string; role: string; shareFrom?: string | null }) {
    return (await db.insert(ledgerMembers).values(v).returning())[0]!
  },

  async updateMember(id: string, patch: Partial<{ nickname: string; elderMode: boolean; role: string; userId: string; removedAt: Date; shareFrom: string | null }>) {
    return (await db.update(ledgerMembers).set(patch).where(eq(ledgerMembers.id, id)).returning())[0]
  },

  /** 账号注销：在所有账本里标记离开 */
  async leaveAll(userId: string) {
    await db
      .update(ledgerMembers)
      .set({ removedAt: new Date() })
      .where(and(eq(ledgerMembers.userId, userId), activeMember))
  },

  /** 除某人外、加入最早的有账号成员（用于转让管理员） */
  async earliestOtherUser(ledgerId: string, exceptUserId: string) {
    return (
      await db
        .select()
        .from(ledgerMembers)
        .where(
          and(
            eq(ledgerMembers.ledgerId, ledgerId),
            activeMember,
            ne(ledgerMembers.userId, exceptUserId),
            sql`${ledgerMembers.userId} is not null`,
          ),
        )
        .orderBy(asc(ledgerMembers.joinedAt))
        .limit(1)
    )[0]
  },

  // ── 邀请 ──
  async insertInvite(v: { code: string; ledgerId: string; createdBy: string; profileMemberId: string | null; expiresAt: Date }) {
    return (await db.insert(invites).values(v).onConflictDoNothing().returning())[0]
  },

  async findInvite(code: string) {
    return (await db.select().from(invites).where(eq(invites.code, code)).limit(1))[0]
  },

  async activeInvites(ledgerId: string) {
    return db
      .select()
      .from(invites)
      .where(and(eq(invites.ledgerId, ledgerId), isNull(invites.revokedAt), gt(invites.expiresAt, new Date())))
      .orderBy(asc(invites.createdAt))
  },

  async revokeInvite(ledgerId: string, code: string) {
    const rows = await db
      .update(invites)
      .set({ revokedAt: new Date() })
      .where(and(eq(invites.code, code), eq(invites.ledgerId, ledgerId)))
      .returning({ code: invites.code })
    return rows.length > 0
  },
})
