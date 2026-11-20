import { createReadStream } from 'node:fs'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { dirname, join, normalize, sep } from 'node:path'
import type { Readable } from 'node:stream'
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'

/** 文件存储的唯一接缝：本地磁盘（开发/单机）或 S3 兼容存储（阿里云 OSS、腾讯云 COS） */
export interface Storage {
  put(key: string, bytes: Buffer, contentType: string): Promise<void>
  get(key: string): Promise<Readable>
  delete(key: string): Promise<void>
}

export class LocalDiskStorage implements Storage {
  constructor(private root: string) {}

  /** key 只允许本服务生成的形式，这里再挡一次路径穿越 */
  private path(key: string) {
    const p = normalize(join(this.root, key))
    if (!p.startsWith(normalize(this.root) + sep)) throw new Error(`bad storage key: ${key}`)
    return p
  }

  async put(key: string, bytes: Buffer) {
    const p = this.path(key)
    await mkdir(dirname(p), { recursive: true })
    await writeFile(p, bytes)
  }

  async get(key: string) {
    return createReadStream(this.path(key))
  }

  async delete(key: string) {
    await rm(this.path(key), { force: true })
  }
}

export interface S3Config {
  endpoint?: string
  region: string
  bucket: string
  accessKeyId: string
  secretAccessKey: string
  forcePathStyle: boolean
}

export class S3Storage implements Storage {
  private client: S3Client
  constructor(private cfg: S3Config) {
    this.client = new S3Client({
      endpoint: cfg.endpoint,
      region: cfg.region,
      forcePathStyle: cfg.forcePathStyle,
      credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey },
    })
  }

  async put(key: string, bytes: Buffer, contentType: string) {
    await this.client.send(new PutObjectCommand({ Bucket: this.cfg.bucket, Key: key, Body: bytes, ContentType: contentType }))
  }

  async get(key: string) {
    const r = await this.client.send(new GetObjectCommand({ Bucket: this.cfg.bucket, Key: key }))
    return r.Body as Readable
  }

  async delete(key: string) {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.cfg.bucket, Key: key }))
  }
}
