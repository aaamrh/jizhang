import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { Biz } from '../biz/index.js'
import { me, userGuard } from '../plugins/auth.js'
import { AppError } from '../utils/errors.js'
import { escapeHtml } from '../utils/html.js'

const name = z.string().trim().min(1).max(20)
/** 封面：复古图标名（kebab-case），null 表示恢复默认 */
const cover = z.string().regex(/^[a-z0-9-]{1,40}$/).nullable()
const ledgerParams = z.object({ id: z.uuid() })
const memberParams = z.object({ id: z.uuid(), memberId: z.uuid() })
const codeParams = z.object({ code: z.string().regex(/^[A-Za-z0-9]{8}$/) })

/** 家庭账本明细一次最多查一年零一周（闰年 366 天，按周看时前后补齐 7 天） */
const MAX_FEED_DAYS = 373
const feedQuery = z
  .object({ start: z.iso.date(), end: z.iso.date() }) // end 不含
  .refine(({ start, end }) => start < end && Date.parse(end) - Date.parse(start) <= MAX_FEED_DAYS * 86_400_000)

export function registerLedgerController(app: FastifyInstance, biz: Biz) {
  const auth = { preHandler: userGuard(biz) }

  app.get('/api/ledgers', auth, async (req) => biz.ledger.list(me(req).id))

  app.post('/api/ledgers', auth, async (req) => {
    const body = z
      .object({ id: z.uuid(), name, type: z.enum(['personal', 'book', 'family']), cover: cover.optional(), shareFrom: z.iso.date().optional() })
      .parse(req.body)
    return biz.ledger.create(me(req), body)
  })

  app.patch('/api/ledgers/:id', auth, async (req) => {
    const { id } = ledgerParams.parse(req.params)
    const patch = z.object({ name: name.optional(), cover: cover.optional() }).parse(req.body)
    return biz.ledger.update(me(req).id, id, patch)
  })

  app.delete('/api/ledgers/:id', auth, async (req, reply) => {
    await biz.ledger.dissolve(me(req).id, ledgerParams.parse(req.params).id)
    return reply.code(204).send()
  })

  app.get('/api/ledgers/:id/family-feed', auth, async (req) => {
    const { id } = ledgerParams.parse(req.params)
    const { start, end } = feedQuery.parse(req.query)
    return biz.ledger.familyFeed(me(req).id, id, start, end)
  })

  app.post('/api/ledgers/:id/leave', auth, async (req, reply) => {
    await biz.ledger.leave(me(req).id, ledgerParams.parse(req.params).id)
    return reply.code(204).send()
  })

  app.post('/api/ledgers/:id/members', auth, async (req) => {
    const { id } = ledgerParams.parse(req.params)
    return biz.ledger.addProfile(me(req).id, id, z.object({ nickname: name }).parse(req.body).nickname)
  })

  app.patch('/api/ledgers/:id/members/:memberId', auth, async (req) => {
    const { id, memberId } = memberParams.parse(req.params)
    const patch = z.object({ nickname: name.optional(), elderMode: z.boolean().optional() }).parse(req.body)
    return biz.ledger.updateMember(me(req).id, id, memberId, patch)
  })

  app.delete('/api/ledgers/:id/members/:memberId', auth, async (req, reply) => {
    const { id, memberId } = memberParams.parse(req.params)
    await biz.ledger.removeMember(me(req).id, id, memberId)
    return reply.code(204).send()
  })

  // ── 家庭邀请 ──

  app.post('/api/ledgers/:id/invites', auth, async (req) => {
    const { id } = ledgerParams.parse(req.params)
    const body = z.object({ profileMemberId: z.uuid().nullable().default(null) }).parse(req.body ?? {})
    return biz.ledger.createInvite(me(req), id, body.profileMemberId)
  })

  app.get('/api/ledgers/:id/invites', auth, async (req) => biz.ledger.listInvites(me(req).id, ledgerParams.parse(req.params).id))

  app.delete('/api/ledgers/:id/invites/:code', auth, async (req, reply) => {
    const { id, code } = ledgerParams.extend(codeParams.shape).parse(req.params)
    await biz.ledger.revokeInvite(me(req).id, id, code)
    return reply.code(204).send()
  })

  app.get('/api/invites/:code', async (req) => {
    const p = await biz.ledger.previewInvite(codeParams.parse(req.params).code)
    return { ledgerName: p.ledgerName, cover: p.cover, inviterNickname: p.inviterNickname, profileNickname: p.profileNickname, memberCount: p.memberCount, expiresAt: p.expiresAt }
  })

  app.post('/api/invites/:code/accept', auth, async (req) => {
    const { shareFrom } = z.object({ shareFrom: z.iso.date().optional() }).parse(req.body ?? {})
    return biz.ledger.acceptInvite(me(req), codeParams.parse(req.params).code, shareFrom)
  })

  // ── 落地页：微信里点开邀请链接看到的网页 ──
  app.get('/i/:code', async (req, reply) => {
    const parsed = codeParams.safeParse(req.params)
    let body: string
    try {
      if (!parsed.success) throw new AppError(404, 'invite_invalid', '')
      const p = await biz.ledger.previewInvite(parsed.data.code)
      const releases = await biz.release.list()
      const download = (platform: string) => releases.find((r) => r.platform === platform)?.downloadUrl
      const link = (href: string | null | undefined, text: string) =>
        href ? `<a class="btn ghost" href="${escapeHtml(href)}">${text}</a>` : ''
      body = `
        <p class="muted">${escapeHtml(p.inviterNickname)} 邀请你加入</p>
        <h1>「${escapeHtml(p.ledgerName)}」</h1>
        ${p.profileNickname ? `<p class="muted">以「${escapeHtml(p.profileNickname)}」的身份加入</p>` : ''}
        <p class="muted">已有 ${p.memberCount} 位成员，一起记账</p>
        <div class="code">${escapeHtml(p.code)}</div>
        <p class="muted small">邀请码 · 7 天内有效</p>
        <a class="btn" href="zhangfang://invite/${escapeHtml(p.code)}">打开账房加入</a>
        ${link(download('ios'), 'iPhone 下载')}${link(download('android'), '安卓下载')}
        <p class="muted small">还没装账房？下载后在「我的 → 加入家庭账本」里输入邀请码。<br>在微信里打不开 App 时，请点右上角，选择在浏览器打开。</p>`
    } catch (e) {
      if (!(e instanceof AppError)) throw e
      body = `<h1>邀请已失效</h1><p class="muted">请让家人重新发一个邀请。</p>`
    }
    return reply.type('text/html; charset=utf-8').send(landingPage(body))
  })
}

const landingPage = (body: string) => `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>账房 · 家庭账本邀请</title>
<style>
  body { margin:0; background:#F4EBD9; color:#2B2118; font:16px/1.6 "Songti SC","Noto Serif SC",serif; text-align:center; }
  main { max-width:420px; margin:0 auto; padding:56px 24px; }
  .seal { width:56px; height:56px; margin:0 auto 20px; background:#B5322B; color:#fff; display:grid; place-items:center; border-radius:6px; font-size:30px; }
  h1 { font-size:24px; margin:8px 0; }
  .muted { color:#7A6A58; } .small { font-size:13px; }
  .code { font-size:32px; letter-spacing:6px; margin:24px 0 4px; padding:12px; background:#FBF5E6; border:1px solid #D9CBB0; border-radius:6px; }
  .btn { display:block; margin:12px 0; padding:12px; border-radius:6px; background:#B5322B; color:#fff; text-decoration:none; }
  .btn.ghost { background:#FBF5E6; color:#2B2118; border:1px solid #D9CBB0; }
</style></head>
<body><main><div class="seal">账</div>${body}</main></body></html>`
