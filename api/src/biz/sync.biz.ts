import type { Models } from '../models/index.js'
import type { SyncRow } from '../models/schema.js'

export const ENTITIES = ['wallets', 'categories', 'transactions', 'assets', 'budgets', 'dayMarks', 'templates', 'goals', 'recurrings'] as const // recurrings：周期记账
export type Entity = (typeof ENTITIES)[number]

export const MAX_PUSH = 500
const MAX_PULL = 1000
const MAX_DATA_BYTES = 16 * 1024

export type InRecord = { id: string; ledgerId: string; updatedAt: number; deletedAt: number | null; data: Record<string, unknown> }
export type SyncRequest = { cursors: Record<string, number>; changes: Partial<Record<Entity, InRecord[]>> }
type Rejected = { entity: Entity; id: string; reason: 'forbidden' | 'conflict' | 'invalid' }

const outDto = (r: SyncRow) => ({
  id: r.id,
  ledgerId: r.ledgerId,
  updatedAt: r.updatedAt,
  deletedAt: r.deletedAt,
  data: r.data,
  version: r.version,
  updatedBy: r.updatedBy,
})

export function createSyncBiz<L extends { id: string }>(models: Models, listLedgers: (userId: string) => Promise<L[]>) {
  /**
   * 写入一个账本的改动。整个过程锁住该账本行：
   * 同一账本的并发同步按顺序拿版本号，拉取方不会因为乱序提交而漏掉记录。
   */
  async function pushLedger(userId: string, ledgerId: string, items: { entity: Entity; rec: InRecord }[], rejected: Rejected[]) {
    return models.transaction(async (m) => {
      let seq = await m.ledgers.lockSeq(ledgerId)
      const stale: SyncRow[] = []
      const toWrite: SyncRow[] = []
      for (const entity of ENTITIES) {
        const recs = items.filter((i) => i.entity === entity).map((i) => i.rec)
        if (!recs.length) continue
        const existing = new Map((await m.sync.findMany(entity, recs.map((r) => r.id))).map((r) => [r.id, r]))
        for (const rec of recs) {
          const ex = existing.get(rec.id)
          if (ex && ex.ledgerId !== ledgerId) rejected.push({ entity, id: rec.id, reason: 'conflict' })
          else if (ex && ex.updatedAt > rec.updatedAt) stale.push(ex) // 服务器的更新，回给客户端覆盖
          else toWrite.push({ entity, ...rec, ledgerId, version: ++seq, updatedBy: userId })
        }
      }
      await m.sync.upsert(toWrite)
      if (toWrite.length) await m.ledgers.setSeq(ledgerId, seq)
      return stale
    })
  }

  return {
    async sync(userId: string, req: SyncRequest) {
      const ledgers = await listLedgers(userId)
      const allowed = new Set(ledgers.map((l) => l.id))
      const rejected: Rejected[] = []
      const byLedger = new Map<string, { entity: Entity; rec: InRecord }[]>()

      for (const entity of ENTITIES) {
        for (const rec of req.changes[entity] ?? []) {
          if (!allowed.has(rec.ledgerId)) rejected.push({ entity, id: rec.id, reason: 'forbidden' })
          else if (JSON.stringify(rec.data).length > MAX_DATA_BYTES) rejected.push({ entity, id: rec.id, reason: 'invalid' })
          else byLedger.set(rec.ledgerId, [...(byLedger.get(rec.ledgerId) ?? []), { entity, rec }])
        }
      }

      const out = new Map<string, SyncRow>() // key = entity:id，去重
      for (const [ledgerId, items] of byLedger) {
        for (const row of await pushLedger(userId, ledgerId, items, rejected)) out.set(`${row.entity}:${row.id}`, row)
      }

      // 拉取：每个账本从游标之后取，总数不超过 MAX_PULL
      const cursors: Record<string, number> = {}
      let hasMore = false
      let budget = MAX_PULL
      for (const l of ledgers) {
        const from = req.cursors[l.id] ?? 0
        cursors[l.id] = from
        if (budget <= 0) {
          hasMore = true
          continue
        }
        const rows = await models.sync.since(l.id, from, budget + 1)
        if (rows.length > budget) hasMore = true
        for (const row of rows.slice(0, budget)) {
          out.set(`${row.entity}:${row.id}`, row)
          cursors[l.id] = row.version
        }
        budget -= Math.min(rows.length, budget)
      }

      const changes = Object.fromEntries(ENTITIES.map((e) => [e, [] as ReturnType<typeof outDto>[]])) as Record<
        Entity,
        ReturnType<typeof outDto>[]
      >
      for (const row of out.values()) changes[row.entity as Entity].push(outDto(row))
      return { ledgers, changes, cursors, hasMore, rejected }
    },
  }
}
