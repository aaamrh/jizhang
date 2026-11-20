import type { Readable } from 'node:stream'
import type { Storage } from '../integrations/storage.js'
import type { Models } from '../models/index.js'
import type { FileRow } from '../models/schema.js'
import { AppError } from '../utils/errors.js'
import { sniffImage } from '../utils/image.js'

export const MAX_FILE_BYTES = 5 * 1024 * 1024

const keyOf = (f: Pick<FileRow, 'id' | 'ledgerId'>) => `files/${f.ledgerId}/${f.id}`
const notFound = () => new AppError(404, 'not_found', '照片不存在或你没有权限查看')

type Membership = (userId: string, ledgerId: string) => Promise<{ member: { role: string } }>

/** 图片：只能传到自己是成员的账本；同账本成员都能看；上传者或账本管理员能删 */
export function createFileBiz(models: Models, storage: Storage, requireMember: Membership, logger: { error: (o: unknown, m?: string) => void }) {
  return {
    async upload(userId: string, ledgerId: string, bytes: Buffer) {
      await requireMember(userId, ledgerId)
      if (bytes.length > MAX_FILE_BYTES) throw new AppError(413, 'file_too_large', '照片太大了，请换一张或压缩后再传')
      const contentType = sniffImage(bytes)
      if (!contentType) throw new AppError(400, 'unsupported_type', '只支持 JPG、PNG、WebP 格式的图片')
      const row = await models.files.insert({ ownerUserId: userId, ledgerId, contentType, size: bytes.length })
      try {
        await storage.put(keyOf(row), bytes, contentType)
      } catch (e) {
        await models.files.deleteRows([row.id])
        logger.error(e, 'storage put failed')
        throw new AppError(502, 'storage_failed', '照片上传失败，请稍后再试')
      }
      return { id: row.id }
    },

    async open(userId: string, id: string): Promise<{ stream: Readable; contentType: string; size: number }> {
      const f = await models.files.find(id)
      if (!f) throw notFound()
      await requireMember(userId, f.ledgerId).catch(() => {
        throw notFound()
      })
      return { stream: await storage.get(keyOf(f)), contentType: f.contentType, size: f.size }
    },

    async remove(userId: string, id: string) {
      const f = await models.files.find(id)
      if (!f) throw notFound()
      const { member } = await requireMember(userId, f.ledgerId).catch(() => {
        throw notFound()
      })
      if (f.ownerUserId !== userId && member.role !== 'admin') throw new AppError(403, 'forbidden', '只有上传的人或账本管理员可以删除')
      await models.files.softDelete(id)
      await storage.delete(keyOf(f)).catch((e) => logger.error(e, 'storage delete failed'))
    },

    /** 账本删除/解散、账号注销后调用：删掉这些账本的全部文件（存储里的和表里的） */
    async purgeLedgers(ledgerIds: string[]) {
      const rows = await models.files.listByLedgers(ledgerIds)
      for (const f of rows) await storage.delete(keyOf(f)).catch((e) => logger.error(e, 'storage delete failed'))
      await models.files.deleteRows(rows.map((r) => r.id))
    },
  }
}
