// 同步：本地优先。规则见 docs/需求.md §14、docs/api.md「同步」
import { and, count, eq, getTableColumns, inArray, isNull, ne, or, type SQL } from 'drizzle-orm'
import { memberRowOf } from '../mapper/member'
import { fromSyncRecord, toSyncRecord } from '../mapper/sync'
import { ENTITIES, type Entity, type RemoteLedger, type SyncRecord, type SyncRequest, type SyncResponse } from '../types/api'
import { exportLedger, importLedger } from './backup'
import { newId, now, type DB } from './core'
import { getLedger, listLedgers } from './ledgerRepo'
import { ledgers, members, SYNC_TABLES } from './schema'

export const MAX_PUSH = 500 // 服务器每次最多收 500 条
const MAX_ROUNDS = 50

type Sent = { entity: Entity; id: string; updatedAt: number }
const table = (e: Entity) => SYNC_TABLES[e] as (typeof SYNC_TABLES)['wallets'] // 公共列一致，按同一形状操作
const COLUMNS = Object.fromEntries(ENTITIES.map((e) => [e, Object.keys(getTableColumns(SYNC_TABLES[e]))])) as Record<Entity, string[]>

const remoteIds = (db: DB) =>
  db.select({ id: ledgers.id }).from(ledgers).where(eq(ledgers.remote, true)).all().map((r) => r.id)

/** 有没有待上传的改动（只看服务器上已有的账本） */
export function hasDirty(db: DB) {
  const ids = remoteIds(db)
  if (!ids.length) return false
  return ENTITIES.some(
    (e) => (db.select({ n: count() }).from(table(e)).where(and(eq(table(e).dirty, true), inArray(table(e).ledgerId, ids))).get()?.n ?? 0) > 0,
  )
}

/** 取出待上传的行，最多 limit 条 */
export function collectDirty(db: DB, limit = MAX_PUSH): { changes: SyncRequest['changes']; sent: Sent[] } {
  const ids = remoteIds(db)
  const changes: SyncRequest['changes'] = {}
  const sent: Sent[] = []
  if (!ids.length) return { changes, sent }
  for (const e of ENTITIES) {
    const left = limit - sent.length
    if (left <= 0) break
    const rows = db.select().from(table(e)).where(and(eq(table(e).dirty, true), inArray(table(e).ledgerId, ids))).limit(left).all()
    if (!rows.length) continue
    changes[e] = rows.map((r) => toSyncRecord(r as never))
    rows.forEach((r) => sent.push({ entity: e, id: r.id, updatedAt: r.updatedAt }))
  }
  return { changes, sent }
}

export function cursorsOf(db: DB): Record<string, number> {
  return Object.fromEntries(
    db.select({ id: ledgers.id, cursor: ledgers.cursor }).from(ledgers).where(eq(ledgers.remote, true)).all().map((r) => [r.id, r.cursor]),
  )
}

/** 删掉本机上一个账本的全部数据（被移出、解散、退出登录时的家庭账本） */
export function purgeLedger(db: DB, ledgerId: string) {
  db.transaction((tx) => {
    for (const e of ENTITIES) tx.delete(table(e)).where(eq(table(e).ledgerId, ledgerId)).run()
    tx.delete(members).where(eq(members.ledgerId, ledgerId)).run()
    tx.delete(ledgers).where(eq(ledgers.id, ledgerId)).run()
  })
}

/** 服务器的账本信息写到本地（不补默认数据，数据随同步下来）；内容没变就不写，避免无谓的界面刷新 */
export function upsertRemoteLedger(db: DB, l: RemoteLedger) {
  const cur = db.select().from(ledgers).where(eq(ledgers.id, l.id)).get()
  if (!cur) {
    const createdAt = Date.parse(l.createdAt) || now()
    db.insert(ledgers).values({ id: l.id, name: l.name, type: l.type, createdAt, updatedAt: now(), remote: true, myRole: l.myRole, cover: l.cover ?? null }).run()
  } else if (cur.name !== l.name || !cur.remote || cur.myRole !== l.myRole || (cur.cover ?? null) !== (l.cover ?? null)) {
    db.update(ledgers).set({ name: l.name, remote: true, myRole: l.myRole, cover: l.cover ?? null, updatedAt: now() }).where(eq(ledgers.id, l.id)).run()
  }
  const rows = l.members.map((m) => memberRowOf(l.id, m))
  const old = db.select().from(members).where(eq(members.ledgerId, l.id)).all()
  const key = (rs: typeof rows) => JSON.stringify([...rs].sort((a, b) => a.id.localeCompare(b.id)))
  if (key(old) !== key(rows)) {
    db.delete(members).where(eq(members.ledgerId, l.id)).run()
    if (rows.length) db.insert(members).values(rows).run()
  }
}

/**
 * 应用一次同步的结果（一个事务）：
 * 1. 账本列表：更新账本和成员；服务器上已不在的家庭账本从本机删除；
 * 2. 记录：服务器版本覆盖本地，除非本地改过还没传（dirty）且更新；
 * 3. 游标前移；
 * 4. 本次上传的行，上传后没再改过的清掉 dirty（被拒绝为 forbidden 的保留，以后再试）。
 * 返回：我是否在某个账本里刚被开启长辈模式、哪些账本被删除。
 */
export function applyResponse(db: DB, res: SyncResponse, sent: Sent[]) {
  let elderOn = false
  const removed: string[] = []
  db.transaction((tx) => {
    const wasElder = new Map(
      tx.select({ ledgerId: members.ledgerId, elder: members.elderMode }).from(members).where(eq(members.isMe, true)).all().map((r) => [r.ledgerId, r.elder]),
    )
    for (const l of res.ledgers) {
      upsertRemoteLedger(tx, l)
      if (l.members.some((m) => m.isMe && m.elderMode) && !wasElder.get(l.id)) elderOn = true
    }
    const listed = new Set(res.ledgers.map((l) => l.id))
    for (const l of listLedgers(tx).filter((l) => l.remote && !listed.has(l.id))) {
      if (l.type !== 'personal') {
        // 家庭账本被移出或解散、多账本在别的手机上删了：本机也删
        purgeLedger(tx, l.id)
        removed.push(l.id)
      } else {
        // 主账本不删数据，只是不再同步
        tx.update(ledgers).set({ remote: false, cursor: 0, myRole: null }).where(eq(ledgers.id, l.id)).run()
      }
    }

    for (const e of ENTITIES) {
      const t = table(e)
      for (const rec of res.changes[e] ?? []) {
        if (!listed.has(rec.ledgerId)) continue
        const local = tx.select({ dirty: t.dirty, updatedAt: t.updatedAt }).from(t).where(eq(t.id, rec.id)).get()
        if (local?.dirty && local.updatedAt > rec.updatedAt) continue
        const row = fromSyncRecord(rec, COLUMNS[e]) as typeof t.$inferInsert
        try {
          tx.insert(t).values(row).onConflictDoUpdate({ target: t.id, set: row }).run()
        } catch (err) {
          console.warn(`[sync] 跳过无法写入的 ${e}/${rec.id}`, err) // 缺字段的脏数据，不影响其他记录
        }
      }
    }

    for (const [id, cursor] of Object.entries(res.cursors)) {
      tx.update(ledgers).set({ cursor }).where(and(eq(ledgers.id, id), ne(ledgers.cursor, cursor))).run()
    }

    const forbidden = new Set(res.rejected.filter((r) => r.reason === 'forbidden').map((r) => `${r.entity}:${r.id}`))
    for (const s of sent) {
      if (forbidden.has(`${s.entity}:${s.id}`)) continue
      const t = table(s.entity)
      tx.update(t).set({ dirty: false }).where(and(eq(t.id, s.id), eq(t.updatedAt, s.updatedAt), eq(t.dirty, true))).run()
    }
  })
  return { elderOn, removed }
}

/** 一次完整同步：推送 → 拉取，直到没有待推送的改动、服务器也没有更多数据 */
export async function runSync(db: DB, send: (req: SyncRequest) => Promise<SyncResponse>) {
  let elderOn = false
  const removed: string[] = []
  for (let round = 0; round < MAX_ROUNDS; round++) {
    const { changes, sent } = collectDirty(db)
    const res = await send({ cursors: cursorsOf(db), changes })
    const r = applyResponse(db, res, sent)
    elderOn ||= r.elderOn
    removed.push(...r.removed)
    if (!res.hasMore && sent.length < MAX_PUSH) break
  }
  return { elderOn, removed }
}

// ───────── 登录、退出时的本地处理 ─────────

/** 本机这个账本里有没有用户自己记的东西（只有默认数据的新装 App 返回 false） */
export function hasUserData(db: DB, ledgerId: string) {
  const n = (e: Entity, extra?: SQL) =>
    db
      .select({ n: count() })
      .from(table(e))
      .where(and(eq(table(e).ledgerId, ledgerId), isNull(table(e).deletedAt), extra))
      .get()?.n ?? 0
  const { wallets: W, categories: C } = SYNC_TABLES
  return (
    n('transactions') +
      n('assets') +
      n('budgets') +
      n('dayMarks') +
      n('templates') +
      n('goals') +
      n('recurrings') +
      n('wallets', or(isNull(W.key), ne(W.initialCents, 0))) + // 自建的钱袋，或填过余额
      n('categories', isNull(C.key)) > // 自建的分类
    0
  )
}

/** 把本账本的全部记录标记为待上传（第一次绑定到账号时） */
export function markAllDirty(db: DB, ledgerId: string) {
  for (const e of ENTITIES) db.update(table(e)).set({ dirty: true }).where(eq(table(e).ledgerId, ledgerId)).run()
}

export function setRemote(db: DB, ledgerId: string, remote: boolean) {
  db.update(ledgers).set({ remote, ...(remote ? {} : { cursor: 0, myRole: null }) }).where(eq(ledgers.id, ledgerId)).run()
}

/**
 * 合并：把本机账本 fromId 的记录搬到 toId（云端已有的个人账本）。
 * 复用导入逻辑：默认分类、钱袋、预算、“今天没花钱”按新账本 id 重算，其余记录换新 id，引用一并替换；全部标记待上传。
 */
export function rehomeLedger(db: DB, fromId: string, toId: string) {
  const from = getLedger(db, fromId)
  if (!from) return
  db.insert(ledgers)
    .values({ id: toId, name: from.name, type: from.type, createdAt: now(), updatedAt: now() })
    .onConflictDoNothing()
    .run()
  importLedger(db, toId, exportLedger(db, fromId, { keepLocalPhotos: true }), { keepLocalPhotos: true })
  purgeLedger(db, fromId)
}

export interface BindDeps {
  listRemote: () => Promise<RemoteLedger[]>
  createRemote: (v: { id: string; name: string; type: 'personal' }) => Promise<RemoteLedger>
  /** 云端已有个人账本、本机也记过账时，问用户：合并，还是用云端覆盖本机 */
  choose: () => Promise<'merge' | 'overwrite'>
  /** 创建账本时 id 已被别的账号占用（这台手机以前登过别的账号） */
  isIdTaken: (e: unknown) => boolean
}

/**
 * 登录后把本机个人账本和账号的个人账本对上，返回之后的个人账本 id：
 * - 云端没有：用本机账本的 id 在云端创建，全部记录待上传（id 被占用时先换个新 id）；
 * - 云端有、id 相同：直接同步；
 * - 云端有、id 不同：本机没记过账就直接用云端的；记过账让用户选合并或覆盖。
 */
export async function bindPersonalLedger(db: DB, localId: string, deps: BindDeps): Promise<string> {
  const remote = (await deps.listRemote()).find((l) => l.type === 'personal')
  if (!remote) {
    const name = getLedger(db, localId)?.name ?? '我的账本'
    let id = localId
    let created: RemoteLedger
    try {
      created = await deps.createRemote({ id, name, type: 'personal' })
    } catch (e) {
      if (!deps.isIdTaken(e)) throw e
      id = newId()
      rehomeLedger(db, localId, id)
      created = await deps.createRemote({ id, name, type: 'personal' })
    }
    markAllDirty(db, id)
    upsertRemoteLedger(db, created)
    return id
  }
  if (remote.id === localId) {
    upsertRemoteLedger(db, remote)
    return localId
  }
  const choice = hasUserData(db, localId) ? await deps.choose() : 'overwrite'
  if (choice === 'merge') rehomeLedger(db, localId, remote.id)
  upsertRemoteLedger(db, remote) // 覆盖：先建好云端账本（数据随后同步下来），再删本机的
  if (choice === 'overwrite') purgeLedger(db, localId)
  return remote.id
}

/** 退出登录：删掉本机的家庭账本（和旧版的多账本，数据在服务器上）；我的账本保留，但不再和这个账号同步 */
export function resetForLogout(db: DB) {
  db.transaction((tx) => {
    for (const l of listLedgers(tx)) {
      if (l.type !== 'personal') purgeLedger(tx, l.id)
      else setRemote(tx, l.id, false)
    }
    tx.delete(members).run()
  })
}

export type { SyncRecord }
