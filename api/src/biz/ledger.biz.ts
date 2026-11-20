import type { Models } from '../models/index.js'
import type { Invite, Ledger, Member, User } from '../models/schema.js'
import { AppError } from '../utils/errors.js'
import { inviteCode } from '../utils/random.js'
import { VIP_NAME } from '../utils/copy.js'
import { cnDayString } from '../utils/time.js'
import { isVip } from './user.biz.js'

/**
 * personal：我的账本，每人一个；family：家庭账本，不单独记账，汇总成员各自的账本。
 * book：旧版会员的多账本，已不能新建，已有的照常保留
 */
export type LedgerType = 'personal' | 'book' | 'family'

export const MAX_MEMBERS = 10
const INVITE_DAYS = 7

/** 汇进家庭账本的账目类型；转账是自己钱袋之间挪钱，不算 */
const FEED_TYPES = ['expense', 'income', 'refund'] as const
type FeedType = (typeof FEED_TYPES)[number]
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const notFound = () => new AppError(404, 'not_found', '账本不存在或你已不在其中')
const forbidden = (msg = '只有管理员可以这样做') => new AppError(403, 'forbidden', msg)
const inviteInvalid = () => new AppError(404, 'invite_invalid', '邀请已失效，请让家人重新发一个')
const familyInactive = () => new AppError(403, 'family_inactive', `创建者的${VIP_NAME}到期了，暂时看不到家庭账本`)

const str = (v: unknown) => (typeof v === 'string' ? v : '')
const strOrNull = (v: unknown) => (typeof v === 'string' ? v : null)
/** 北京时间的日期，和账目的 data.date 同一口径 */
const cnDay = (d: Date) => cnDayString(d.getTime())

export function createLedgerBiz(models: Models, publicUrl: string, purgeFiles: (ledgerIds: string[]) => Promise<void> = async () => {}) {
  const memberDto = (m: Member & { vipUntil?: Date | null }, meId: string) => ({
    id: m.id,
    userId: m.userId,
    nickname: m.nickname,
    role: m.role,
    elderMode: m.elderMode,
    isMe: !m.removedAt && m.userId === meId,
    removed: !!m.removedAt, // 已离开：只用于显示历史账目的名字，不能再选
    isVip: !m.removedAt && !!m.vipUntil && m.vipUntil > new Date(), // 成员列表里给大掌柜一个小金印
    joinedAt: m.joinedAt.toISOString(),
    shareFrom: m.shareFrom ?? cnDay(m.joinedAt), // 从哪天起的账汇进来
  })

  const inviteDto = (i: Invite) => ({
    code: i.code,
    url: `${publicUrl}/i/${i.code}`,
    expiresAt: i.expiresAt.toISOString(),
    profileMemberId: i.profileMemberId,
  })

  async function list(userId: string) {
    const rows = await models.ledgers.listForUser(userId)
    const members = await models.ledgers.members(rows.map((r) => r.ledger.id))
    return rows.map(({ ledger, member }) => ({
      id: ledger.id,
      name: ledger.name,
      type: ledger.type,
      cover: ledger.cover,
      myRole: member.role,
      members: members.filter((m) => m.ledgerId === ledger.id).map((m) => memberDto(m, userId)),
      createdAt: ledger.createdAt.toISOString(),
    }))
  }

  async function get(userId: string, ledgerId: string) {
    const l = (await list(userId)).find((x) => x.id === ledgerId)
    if (!l) throw notFound()
    return l
  }

  /** 我是这个账本的有效成员，否则 404（不暴露账本是否存在） */
  async function requireMember(userId: string, ledgerId: string) {
    const r = await models.ledgers.membership(ledgerId, userId)
    if (!r) throw notFound()
    return r
  }

  async function requireAdmin(userId: string, ledgerId: string) {
    const r = await requireMember(userId, ledgerId)
    if (r.member.role !== 'admin') throw forbidden()
    return r
  }

  const requireFamily = (l: Ledger) => {
    if (l.type !== 'family') throw new AppError(400, 'invalid_input', '只有家庭账本能这样做')
  }

  /** 邀请有效：未作废、未过期、账本未解散 */
  async function validInvite(code: string) {
    const inv = await models.ledgers.findInvite(code.toUpperCase())
    if (!inv || inv.revokedAt || inv.expiresAt < new Date()) throw inviteInvalid()
    const ledger = await models.ledgers.find(inv.ledgerId)
    if (!ledger || ledger.deletedAt) throw inviteInvalid()
    return { inv, ledger }
  }

  /** 共享开始日期：可以早于加入那天（把以前的账也汇进来），不能晚于今天。不传按加入那天 */
  function checkShareFrom(d: string | undefined) {
    if (d && d > cnDay(new Date())) throw new AppError(400, 'invalid_input', '开始日期不能晚于今天')
    return d ?? null
  }

  return {
    list,
    get,
    requireMember,

    /** 家庭账本可以建好几个（每个都要大掌柜）；shareFrom：创建者自己的账从哪天起汇进来 */
    async create(user: User, v: { id: string; name: string; type: LedgerType; cover?: string | null; shareFrom?: string }) {
      const owned = await models.ledgers.ownedLive(user.id)
      if (v.type === 'personal' && owned.some((l) => l.type === 'personal')) {
        throw new AppError(409, 'personal_exists', '你已经有个人账本了')
      }
      if (v.type === 'book') throw new AppError(400, 'invalid_input', '不再支持多账本')
      if (v.type === 'family' && !isVip(user)) throw new AppError(403, 'vip_required', `开通${VIP_NAME}后才能创建家庭账本`)
      const shareFrom = v.type === 'family' ? checkShareFrom(v.shareFrom) : null
      await models.transaction(async (m) => {
        const created = await m.ledgers.insert({ id: v.id, name: v.name, type: v.type, ownerId: user.id, cover: v.cover ?? null })
        if (!created) throw new AppError(409, 'conflict', '账本 id 已存在')
        await m.ledgers.insertMember({ ledgerId: v.id, userId: user.id, nickname: user.nickname, role: 'admin', shareFrom })
      })
      return get(user.id, v.id)
    },

    /** 改名、换封面：仅管理员 */
    async update(userId: string, ledgerId: string, patch: { name?: string; cover?: string | null }) {
      await requireAdmin(userId, ledgerId)
      if (patch.name !== undefined || patch.cover !== undefined) await models.ledgers.update(ledgerId, patch)
      return get(userId, ledgerId)
    },

    /** 解散家庭账本或删除多账本里的一本：标记删除，账目数据和邀请立刻清除。主账本不能删 */
    async dissolve(userId: string, ledgerId: string) {
      const { ledger } = await requireAdmin(userId, ledgerId)
      if (ledger.type === 'personal') throw new AppError(400, 'invalid_input', '主账本不能删除')
      await models.transaction(async (m) => {
        await m.ledgers.update(ledgerId, { deletedAt: new Date() })
        await m.ledgers.purgeData(ledgerId)
      })
      await purgeFiles([ledgerId])
    },

    async leave(userId: string, ledgerId: string) {
      const { member } = await requireMember(userId, ledgerId)
      if (member.role === 'admin') throw new AppError(400, 'invalid_input', '管理员不能退出，可以解散账本')
      await models.ledgers.updateMember(member.id, { removedAt: new Date() })
    },

    async addProfile(userId: string, ledgerId: string, nickname: string) {
      const { ledger } = await requireAdmin(userId, ledgerId)
      requireFamily(ledger)
      if ((await models.ledgers.countMembers(ledgerId)) >= MAX_MEMBERS) {
        throw new AppError(400, 'ledger_full', `每个家庭账本最多 ${MAX_MEMBERS} 人`)
      }
      const m = await models.ledgers.insertMember({ ledgerId, userId: null, nickname, role: 'profile' })
      return memberDto(m, userId)
    },

    /** 管理员可改任何人；普通成员只能改自己 */
    async updateMember(userId: string, ledgerId: string, memberId: string, patch: { nickname?: string; elderMode?: boolean }) {
      const { member: me } = await requireMember(userId, ledgerId)
      const target = await models.ledgers.findMember(ledgerId, memberId)
      if (!target) throw new AppError(404, 'not_found', '成员不存在')
      if (me.role !== 'admin' && target.id !== me.id) throw forbidden()
      return memberDto((await models.ledgers.updateMember(memberId, patch))!, userId)
    },

    async removeMember(userId: string, ledgerId: string, memberId: string) {
      const { member: me } = await requireAdmin(userId, ledgerId)
      const target = await models.ledgers.findMember(ledgerId, memberId)
      if (!target) throw new AppError(404, 'not_found', '成员不存在')
      if (target.id === me.id) throw new AppError(400, 'invalid_input', '不能移除自己')
      await models.ledgers.updateMember(memberId, { removedAt: new Date() })
    },

    // ── 家庭邀请 ──

    async createInvite(user: User, ledgerId: string, profileMemberId: string | null) {
      const { ledger } = await requireAdmin(user.id, ledgerId)
      requireFamily(ledger)
      const owner = ledger.ownerId === user.id ? user : await models.users.findById(ledger.ownerId)
      if (!owner || !isVip(owner)) throw new AppError(403, 'vip_required', `${VIP_NAME}已到期，续费后才能邀请新成员`)
      if (profileMemberId) {
        const p = await models.ledgers.findMember(ledgerId, profileMemberId)
        if (!p || p.role !== 'profile') throw new AppError(400, 'invalid_input', '这个家人档案不存在或已被认领')
      }
      const expiresAt = new Date(Date.now() + INVITE_DAYS * 86_400_000)
      for (let i = 0; i < 5; i++) {
        const inv = await models.ledgers.insertInvite({ code: inviteCode(), ledgerId, createdBy: user.id, profileMemberId, expiresAt })
        if (inv) return inviteDto(inv)
      }
      throw new AppError(500, 'internal', '生成邀请失败，请重试') // 31^8 的空间里连撞 5 次，基本不会发生
    },

    async listInvites(userId: string, ledgerId: string) {
      await requireAdmin(userId, ledgerId)
      return (await models.ledgers.activeInvites(ledgerId)).map(inviteDto)
    },

    async revokeInvite(userId: string, ledgerId: string, code: string) {
      await requireAdmin(userId, ledgerId)
      if (!(await models.ledgers.revokeInvite(ledgerId, code.toUpperCase()))) throw inviteInvalid()
    },

    /** 预览，不需要登录（落地页也用） */
    async previewInvite(code: string) {
      const { inv, ledger } = await validInvite(code)
      const [inviter, profile, memberCount] = await Promise.all([
        models.users.findById(inv.createdBy),
        inv.profileMemberId ? models.ledgers.findMember(ledger.id, inv.profileMemberId) : undefined,
        models.ledgers.countMembers(ledger.id),
      ])
      return {
        code: inv.code,
        ledgerName: ledger.name,
        cover: ledger.cover,
        inviterNickname: inviter?.nickname ?? '家人',
        profileNickname: profile?.role === 'profile' ? profile.nickname : null,
        memberCount,
        expiresAt: inv.expiresAt.toISOString(),
      }
    },

    /**
     * 加入（可以同时在好几个家庭里）；shareFrom：自己的账从哪天起汇进这个家庭。
     * 邀请指定了还没被认领的家人档案时，认领该档案（历史账目归他）
     */
    async acceptInvite(user: User, code: string, shareFrom?: string) {
      const { inv, ledger } = await validInvite(code)
      if (await models.ledgers.membership(ledger.id, user.id)) throw new AppError(409, 'already_member', '你已经在这个账本里了')
      const from = checkShareFrom(shareFrom)
      await models.transaction(async (m) => {
        const profile = inv.profileMemberId ? await m.ledgers.findMember(ledger.id, inv.profileMemberId) : undefined
        if (profile && profile.role === 'profile' && !profile.userId) {
          await m.ledgers.updateMember(profile.id, { userId: user.id, role: 'member', shareFrom: from })
          return
        }
        if ((await m.ledgers.countMembers(ledger.id)) >= MAX_MEMBERS) {
          throw new AppError(400, 'ledger_full', '这个家庭账本已经满员了')
        }
        await m.ledgers.insertMember({ ledgerId: ledger.id, userId: user.id, nickname: user.nickname, role: 'member', shareFrom: from })
      })
      return get(user.id, ledger.id)
    },

    // ── 家庭账本的明细 ──

    /**
     * 家庭账本不单独记账，汇总各成员自己账本里、在家期间的收支和退款（按账目日期，北京时间）：
     * 每段成员身份是 [共享开始日期, 离开那天)，共享开始日期是加入时自己选的（没选过的按加入那天），
     * 退出又加入的人有好几段；离开的人在家期间的账留着。
     * 创建者的大掌柜到期：其他人看不到（403）；创建者自己能看，但别人的账只到到期那天为止，
     * 他自己的账照常汇进。续费后不再截断，断档期间的账自然补上。
     * 旧版直接记在家庭账本里的账目照样算进来，不按在家期间过滤。end 不含。
     */
    async familyFeed(userId: string, ledgerId: string, start: string, end: string) {
      const { ledger } = await requireMember(userId, ledgerId)
      requireFamily(ledger)
      const owner = await models.users.findById(ledger.ownerId)
      const active = !!owner && isVip(owner)
      if (!active && userId !== ledger.ownerId) throw familyInactive()
      // 继承来的家庭账本、新创建者从没开过大掌柜时为 null：别人的账一条都不显示
      const frozenSince = !active && owner?.vipUntil ? cnDay(owner.vipUntil) : null
      const visible = (authorId: string | null, date: string) =>
        active || authorId === ledger.ownerId || (frozenSince !== null && date <= frozenSince)

      const windows = new Map<string, { from: string; to: string | null }[]>()
      for (const m of await models.ledgers.members([ledgerId])) {
        if (!m.userId) continue // 家人档案没有自己的账本
        const w = { from: m.shareFrom ?? cnDay(m.joinedAt), to: m.removedAt ? cnDay(m.removedAt) : null }
        windows.set(m.userId, [...(windows.get(m.userId) ?? []), w])
      }
      const atHome = (uid: string, date: string) =>
        (windows.get(uid) ?? []).some((w) => date >= w.from && (w.to === null || date < w.to))

      const ownerOf = new Map((await models.ledgers.personalOf([...windows.keys()])).map((l) => [l.id, l.ownerId]))
      const rows = await models.sync.transactionsBetween([ledgerId, ...ownerOf.keys()], FEED_TYPES, start, end)
      const picked = rows.flatMap((r) => {
        const date = str(r.data.date)
        const personalOwner = ownerOf.get(r.ledgerId)
        if (personalOwner) return atHome(personalOwner, date) && visible(personalOwner, date) ? [{ r, date, author: personalOwner }] : []
        const author = strOrNull(r.data.createdBy) // 旧版记在家庭账本里的
        return visible(author, date) ? [{ r, date, author }] : []
      })

      // 分类可能在任何人的账本里；只查这些账目用到的
      const catIds = [...new Set(picked.map(({ r }) => str(r.data.categoryId)).filter((id) => UUID_RE.test(id)))]
      const cats = new Map(
        (await models.sync.findMany('categories', catIds)).filter((c) => c.deletedAt === null).map((c) => [c.id, c.data]),
      )

      const items = picked.map(({ r, date, author }) => {
        const d = r.data
        const c = cats.get(str(d.categoryId))
        return {
          id: r.id,
          date,
          type: d.type as FeedType,
          amountCents: typeof d.amountCents === 'number' ? d.amountCents : 0,
          note: str(d.note),
          review: strOrNull(d.review),
          createdAt: typeof d.createdAt === 'number' ? d.createdAt : r.updatedAt,
          userId: author,
          category: c ? { name: str(c.name), icon: str(c.icon), color: str(c.color), tier: strOrNull(c.tier) } : null,
        }
      })
      items.sort((a, b) => (a.date !== b.date ? (a.date < b.date ? 1 : -1) : b.createdAt - a.createdAt))
      return { active, frozenSince, items }
    },
  }
}
