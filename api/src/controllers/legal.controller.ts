import { readFileSync } from 'node:fs'
import type { FastifyInstance } from 'fastify'
import { withVipName } from '../utils/copy.js'
import { markdownToHtml } from '../utils/markdown.js'

// 协议原文在 api/legal/*.md（App 内的同一份文本由 app 的测试比对，保证一致）
const read = (name: string) => withVipName(readFileSync(new URL(`../../legal/${name}.md`, import.meta.url), 'utf8'))

const page = (title: string, body: string) => `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>
  body { margin:0; background:#F7F3EA; color:#2B2118; font:16px/1.75 -apple-system, "PingFang SC", "Noto Sans SC", sans-serif; }
  main { max-width:720px; margin:0 auto; padding:32px 20px 64px; }
  h1 { font-size:24px; margin:0 0 8px; } h2 { font-size:18px; margin:28px 0 8px; }
  .note { color:#B5322B; } ul { padding-left:1.4em; } p, li { margin:6px 0; }
</style></head>
<body><main>${body}</main></body></html>`

/** 公开的协议页：App 里的链接、应用商店审核都用这两个地址 */
export function registerLegalController(app: FastifyInstance) {
  const docs = { privacy: ['账房隐私政策', read('privacy')], terms: ['账房用户协议', read('terms')] } as const
  for (const [path, [title, md]] of Object.entries(docs)) {
    const html = page(title, markdownToHtml(md))
    app.get(`/${path}`, async (_req, reply) => reply.type('text/html; charset=utf-8').send(html))
  }
}
