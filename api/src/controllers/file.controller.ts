import multipart from '@fastify/multipart'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { MAX_FILE_BYTES } from '../biz/file.biz.js'
import type { Biz } from '../biz/index.js'
import { me, userGuard } from '../plugins/auth.js'
import { AppError } from '../utils/errors.js'

const idParams = z.object({ id: z.uuid() })

/** 照片上传/下载。multipart 字段顺序：先 ledgerId，再 file */
export async function registerFileController(app: FastifyInstance, biz: Biz) {
  await app.register(multipart, { limits: { fileSize: MAX_FILE_BYTES, files: 1, fields: 2 } })
  const auth = { preHandler: userGuard(biz) }

  app.post('/api/files', { ...auth, config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (req) => {
    const part = await req.file()
    if (!part) throw new AppError(400, 'invalid_input', '没有收到照片')
    const field = part.fields.ledgerId as { value?: unknown } | undefined
    const ledgerId = z.uuid().safeParse(field?.value)
    if (!ledgerId.success) throw new AppError(400, 'invalid_input', '缺少账本')
    let bytes: Buffer
    try {
      bytes = await part.toBuffer()
    } catch {
      throw new AppError(413, 'file_too_large', '照片太大了，请换一张或压缩后再传')
    }
    return biz.file.upload(me(req).id, ledgerId.data, bytes)
  })

  app.get('/api/files/:id', auth, async (req, reply) => {
    const f = await biz.file.open(me(req).id, idParams.parse(req.params).id)
    // 文件内容不会变（换照片就是新文件），可以长期缓存；但只给登录的本人看，所以是 private
    return reply
      .type(f.contentType)
      .header('content-length', f.size)
      .header('cache-control', 'private, max-age=31536000, immutable')
      .send(f.stream)
  })

  app.delete('/api/files/:id', auth, async (req, reply) => {
    await biz.file.remove(me(req).id, idParams.parse(req.params).id)
    return reply.code(204).send()
  })
}
