import { and, asc, count, desc, eq, inArray, sql } from 'drizzle-orm'
import type { DB } from './index.js'
import { orders, products, type Product } from './schema.js'
import { cnToday } from './sql.js'

export type ProductPatch = Partial<Omit<Product, 'id'>>

/** 第一次启动时写入的默认付费方案，之后在后台改 */
const DEFAULT_PRODUCTS: (typeof products.$inferInsert)[] = [
  { id: 'month', name: '月卡', days: 30, priceCents: 800, sort: 1 },
  { id: 'year', name: '年卡', days: 365, priceCents: 4500, promoPriceCents: 3800, badge: '限时', newUserPriceCents: 2800, sort: 2 },
  { id: 'three_year', name: '3 年卡', days: 1095, priceCents: 11900, promoPriceCents: 9900, badge: '最划算', sort: 3 },
  { id: 'year_auto', name: '连续包年', days: 365, priceCents: 3800, newUserPriceCents: 2800, platform: 'ios', sort: 0 },
]

export const vipModel = (db: DB) => ({
  // ── 付费方案 ──
  async seedProducts() {
    await db.insert(products).values(DEFAULT_PRODUCTS).onConflictDoNothing()
  },

  async products() {
    return db.select().from(products).orderBy(asc(products.sort))
  },

  async findProduct(id: string) {
    return (await db.select().from(products).where(eq(products.id, id)).limit(1))[0]
  },

  async updateProduct(id: string, patch: ProductPatch) {
    return (await db.update(products).set(patch).where(eq(products.id, id)).returning())[0]
  },

  // ── 订单 ──
  async insertOrder(v: { userId: string; productId: string; channel: string; amountCents: number; days: number }) {
    return (await db.insert(orders).values(v).returning())[0]!
  },

  async findOrder(id: string) {
    return (await db.select().from(orders).where(eq(orders.id, id)).limit(1))[0]
  },

  /** 只把指定状态的订单改成已支付；重复回调时返回 undefined，保证只生效一次 */
  async markPaid(id: string, from: string[], extra: { channelTxnId?: string; note?: string } = {}) {
    const rows = await db
      .update(orders)
      .set({ status: 'paid', paidAt: new Date(), ...extra })
      .where(and(eq(orders.id, id), inArray(orders.status, from)))
      .returning()
    return rows[0]
  },

  async markRefunded(id: string, note: string) {
    const rows = await db
      .update(orders)
      .set({ status: 'refunded', refundedAt: new Date(), note })
      .where(and(eq(orders.id, id), eq(orders.status, 'paid')))
      .returning()
    return rows[0]
  },

  async hasPaid(userId: string) {
    const [r] = await db
      .select({ n: count() })
      .from(orders)
      .where(and(eq(orders.userId, userId), inArray(orders.status, ['paid', 'refunded'])))
    return (r?.n ?? 0) > 0
  },

  async listOrders(opts: { status?: string; limit: number; offset: number }) {
    const where = opts.status ? eq(orders.status, opts.status) : undefined
    const items = await db
      .select()
      .from(orders)
      .where(where)
      .orderBy(desc(orders.createdAt))
      .limit(opts.limit)
      .offset(opts.offset)
    const [{ total = 0 } = {}] = await db.select({ total: count() }).from(orders).where(where)
    return { items, total }
  },

  /** 已支付订单的收入，按方案和渠道汇总；sinceToday=true 只算今天，否则算本月（北京时间） */
  async revenue(range: 'today' | 'month') {
    const from =
      range === 'today'
        ? sql`(${orders.paidAt} at time zone 'Asia/Shanghai')::date = ${cnToday}`
        : sql`date_trunc('month', ${orders.paidAt} at time zone 'Asia/Shanghai') = date_trunc('month', now() at time zone 'Asia/Shanghai')`
    return db
      .select({
        productId: orders.productId,
        channel: orders.channel,
        cents: sql<number>`sum(${orders.amountCents})::int`,
        n: sql<number>`count(*)::int`,
      })
      .from(orders)
      .where(and(eq(orders.status, 'paid'), from))
      .groupBy(orders.productId, orders.channel)
  },

  async payingUsers() {
    const [r] = await db
      .select({ n: sql<number>`count(distinct ${orders.userId})::int` })
      .from(orders)
      .where(inArray(orders.status, ['paid', 'refunded']))
    return r?.n ?? 0
  },
})
