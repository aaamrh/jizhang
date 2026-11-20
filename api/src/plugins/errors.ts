import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify'
import { ZodError } from 'zod'
import { AppError } from '../utils/errors.js'

/** 所有错误统一成 {error: code, message}，message 是中文，可直接展示给用户 */
export function errorHandler(err: FastifyError | Error, req: FastifyRequest, reply: FastifyReply) {
  if (err instanceof AppError) return reply.code(err.status).send({ error: err.code, message: err.message })
  if (err instanceof ZodError) return reply.code(400).send({ error: 'invalid_input', message: '请求参数不正确' })
  const status = (err as FastifyError).statusCode
  if (status === 429) return reply.code(429).send({ error: 'rate_limited', message: '请求太频繁，请稍后再试' })
  if (status && status < 500) return reply.code(status).send({ error: 'bad_request', message: '请求不正确' })
  req.log.error(err)
  return reply.code(500).send({ error: 'internal', message: '服务器开小差了，请稍后再试' })
}
