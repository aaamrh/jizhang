import { resolve } from 'node:path'
import type { Env } from '../config/env.js'
import { LocalDiskStorage, S3Storage, type Storage } from './storage.js'

export function createStorage(env: Env): Storage {
  if (env.STORAGE_DRIVER === 'local') return new LocalDiskStorage(resolve(env.STORAGE_DIR))
  if (!env.S3_BUCKET || !env.S3_ACCESS_KEY_ID || !env.S3_SECRET_ACCESS_KEY) {
    throw new Error('STORAGE_DRIVER=s3 需要 S3_BUCKET、S3_ACCESS_KEY_ID、S3_SECRET_ACCESS_KEY')
  }
  return new S3Storage({
    endpoint: env.S3_ENDPOINT,
    region: env.S3_REGION,
    bucket: env.S3_BUCKET,
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    forcePathStyle: env.S3_FORCE_PATH_STYLE,
  })
}
