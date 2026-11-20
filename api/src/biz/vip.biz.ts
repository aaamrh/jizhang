import type { Models } from '../models/index.js'
import type { Order, Product, User } from '../models/schema.js'
import type { ProductPatch } from '../models/vip.model.js'
import { AppError } from '../utils/errors.js'

const NEW_USER_DAYS = 7
export type Channel = 'wechat' | 'alipay' | 'apple' | 'mock'
export type Platform = 'ios' | 'android'

/** 当前价格：活动价在有效期内取活动价；注册 7 天内且没付过费的新用户，有新人价时取更低者 */
export function priceOf(p: Product, user: User | null, hasPaid: boolean, now = new Date()) {
  let priceCents = p.priceCents
  let badge: string | null = null
  const promoOn =
    p.promoPriceCents != null && (!p.promoStart || p.promoStart <= now) && (!p.promoEnd || p.promoEnd > now)
  if (promoOn) {
    priceCents = p.promoPriceCents!
    badge = p.badge
  }
  const isNewUser = !!user && !hasPaid && now.getTime() - user.createdAt.getTime() < NEW_USER_DAYS * 86_400_000
  if (isNewUser && p.newUserPriceCents != null && p.newUserPriceCents < priceCents) {
    priceCents = p.newUserPriceCents
    badge = '新人价'
  }
  return { priceCents, badge }
}

const orderDto = (o: Order) => ({
  id: o.id,
  productId: o.productId,
  channel: o.channel,
  amountCents: o.amountCents,
  status: o.status,
  paidAt: o.paidAt?.toISOString() ?? null,
})

export function createVipBiz(models: Models, opts: { mockPay: boolean }) {
  /** 订单变成已支付并加会员天数，在一个事务里；重复调用只生效一次 */
  async function fulfil(orderId: string, from: string[], extra: { channelTxnId?: string; note?: string } = {}) {
    return models.transaction(async (m) => {
      const o = await m.vip.markPaid(orderId, from, extra)
      if (o?.userId) await m.users.extendVip(o.userId, o.days)
      return o
    })
  }

  async function ownOrder(userId: string, id: string) {
    const o = await models.vip.findOrder(id)
    if (!o || o.userId !== userId) throw new AppError(404, 'not_found', '订单不存在')
    return o
  }

  return {
    async products(user: User | null, platform: Platform | undefined) {
      const hasPaid = user ? await models.vip.hasPaid(user.id) : false
      return (await models.vip.products())
        .filter((p) => p.active && (p.platform === 'all' || p.platform === platform))
        .map((p) => {
          const { priceCents, badge } = priceOf(p, user, hasPaid)
          return {
            id: p.id,
            name: p.name,
            days: p.days,
            priceCents,
            originalPriceCents: p.priceCents,
            badge,
            appleProductId: p.appleProductId,
          }
        })
    },

    async createOrder(user: User, productId: string, channel: Channel) {
      const p = await models.vip.findProduct(productId)
      if (!p || !p.active) throw new AppError(404, 'not_found', '这个方案已下架')
      if (channel !== 'mock' || !opts.mockPay) {
        // shortcut: 真实支付渠道需要商户号和证书，拿到后在这里接入微信支付/支付宝/苹果内购
        throw new AppError(501, 'not_configured', '支付暂未开通')
      }
      const { priceCents } = priceOf(p, user, await models.vip.hasPaid(user.id))
      const o = await models.vip.insertOrder({ userId: user.id, productId, channel, amountCents: priceCents, days: p.days })
      return { orderId: o.id, amountCents: o.amountCents, status: o.status, payParams: null }
    },

    async getOrder(userId: string, id: string) {
      return orderDto(await ownOrder(userId, id))
    },

    /** 仅测试环境：模拟支付成功 */
    async mockPay(userId: string, id: string) {
      if (!opts.mockPay) throw new AppError(404, 'not_found', '接口不存在')
      await ownOrder(userId, id)
      await fulfil(id, ['pending'])
      return orderDto((await models.vip.findOrder(id))!)
    },

    // ── 后台 ──

    /** 手动补单：回调丢失时客服确认到账后使用 */
    async adminMarkPaid(id: string, note: string) {
      const o = await fulfil(id, ['pending', 'closed'], { note })
      if (!o) throw new AppError(400, 'invalid_input', '只有待支付或已关闭的订单可以补单')
      return orderDto(o)
    },

    /** 退款：订单标记已退款并扣回天数（最多扣到现在） */
    async adminRefund(id: string, note: string) {
      return models.transaction(async (m) => {
        const o = await m.vip.markRefunded(id, note)
        if (!o) throw new AppError(400, 'invalid_input', '只有已支付的订单可以退款')
        if (o.userId) await m.users.shortenVip(o.userId, o.days)
        return orderDto(o)
      })
    },

    async adminOrders(q: { status?: string; page: number; pageSize: number }) {
      const { items, total } = await models.vip.listOrders({
        status: q.status,
        limit: q.pageSize,
        offset: (q.page - 1) * q.pageSize,
      })
      return {
        total,
        items: items.map((o) => ({ ...orderDto(o), userId: o.userId, note: o.note, createdAt: o.createdAt.toISOString() })),
      }
    },

    adminProducts: () => models.vip.products(),

    async adminUpdateProduct(id: string, patch: ProductPatch) {
      const p = await models.vip.updateProduct(id, patch)
      if (!p) throw new AppError(404, 'not_found', '方案不存在')
      return p
    },
  }
}
