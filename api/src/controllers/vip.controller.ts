import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { Biz } from '../biz/index.js'
import { me, optionalUserId, userGuard } from '../plugins/auth.js'
import { AppError } from '../utils/errors.js'

const orderParams = z.object({ id: z.uuid() })

export function registerVipController(app: FastifyInstance, biz: Biz) {
  const auth = { preHandler: userGuard(biz) }

  // 不登录也能看价格；登录后会算上新人价
  app.get('/api/vip/products', async (req) => {
    const { platform } = z.object({ platform: z.enum(['ios', 'android']).optional() }).parse(req.query)
    const userId = await optionalUserId(req)
    const user = userId ? await biz.user.getActive(userId).catch(() => null) : null
    return biz.vip.products(user, platform)
  })

  app.post('/api/orders', auth, async (req) => {
    const body = z
      .object({ productId: z.string().min(1).max(32), channel: z.enum(['wechat', 'alipay', 'apple', 'mock']) })
      .parse(req.body)
    return biz.vip.createOrder(me(req), body.productId, body.channel)
  })

  app.get('/api/orders/:id', auth, async (req) => biz.vip.getOrder(me(req).id, orderParams.parse(req.params).id))

  app.post('/api/orders/:id/mock-pay', auth, async (req) => biz.vip.mockPay(me(req).id, orderParams.parse(req.params).id))

  // shortcut: 真实渠道的回调验签还没接，拿到商户号和证书后在这里按渠道处理
  app.post('/api/pay/notify/:channel', async () => {
    throw new AppError(501, 'not_configured', '支付暂未开通')
  })
}
