import type { FastifyReply, FastifyRequest } from 'fastify'
import type { Biz } from '../biz/index.js'
import type { User } from '../models/schema.js'
import { AppError } from '../utils/errors.js'

type Claims = { role: 'admin' } | { role: 'user'; sub: string }

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: Claims
    user: Claims
  }
}

declare module 'fastify' {
  interface FastifyRequest {
    me?: User
  }
}

const unauthorized = () => new AppError(401, 'unauthorized', '请先登录')

async function claims(req: FastifyRequest): Promise<Claims | null> {
  try {
    await req.jwtVerify()
    return req.user
  } catch {
    return null
  }
}

/** 需要用户登录：token 有效、账号存在且未冻结，账号放到 req.me */
export const userGuard = (biz: Biz) => async (req: FastifyRequest) => {
  const c = await claims(req)
  if (c?.role !== 'user') throw unauthorized()
  req.me = await biz.user.getActive(c.sub)
}

/** controller 里取当前用户（路由已挂 userGuard） */
export const me = (req: FastifyRequest): User => {
  if (!req.me) throw unauthorized()
  return req.me
}

/** 可选登录：带了有效用户 token 返回 userId，否则 null */
export async function optionalUserId(req: FastifyRequest) {
  const c = await claims(req)
  return c?.role === 'user' ? c.sub : null
}

/** 后台接口：管理员 token；用户 token 和管理员 token 互不通用 */
export async function requireAdmin(req: FastifyRequest, reply: FastifyReply) {
  if ((await claims(req))?.role !== 'admin') return reply.code(401).send({ error: 'unauthorized', message: '请先登录' })
}
