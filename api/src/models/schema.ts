import { sql } from 'drizzle-orm'
import {
  bigint,
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

const ts = (name: string) => timestamp(name, { withTimezone: true })

// ───────── 账号 ─────────

/** 一个账号可绑定多种登录方式：手机号、微信、Apple 各一列 */
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  nickname: text('nickname').notNull(),
  phone: text('phone').unique(),
  wechatId: text('wechat_id').unique(), // unionid 优先，没有则 openid
  appleId: text('apple_id').unique(),
  vipUntil: ts('vip_until'),
  frozenAt: ts('frozen_at'),
  createdAt: ts('created_at').notNull().defaultNow(),
  lastLoginAt: ts('last_login_at'),
})

/** 短信验证码，只存 HMAC，不存明文 */
export const smsCodes = pgTable('sms_codes', {
  phone: text('phone').primaryKey(),
  codeHash: text('code_hash').notNull(),
  expiresAt: ts('expires_at').notNull(),
  attempts: integer('attempts').notNull().default(0),
  sentAt: ts('sent_at').notNull().defaultNow(),
})

// ───────── 账本与家庭 ─────────

/** id 由客户端生成（本机账本的 id），这样本地数据不用改 id */
export const ledgers = pgTable('ledgers', {
  id: uuid('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type').notNull(), // 'personal' 主账本 | 'book' 会员的多账本 | 'family' 家庭账本
  cover: text('cover'), // 封面纸色 key（App 内 utils/ledgerCover），服务器不解析
  ownerId: uuid('owner_id').notNull(),
  seq: bigint('seq', { mode: 'number' }).notNull().default(0), // 同步版本号计数器，按账本递增
  createdAt: ts('created_at').notNull().defaultNow(),
  deletedAt: ts('deleted_at'),
})

/** 成员；userId 为空表示"家人档案"（没有账号）。removedAt 不为空表示已离开，历史保留 */
export const ledgerMembers = pgTable(
  'ledger_members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ledgerId: uuid('ledger_id')
      .notNull()
      .references(() => ledgers.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    nickname: text('nickname').notNull(),
    role: text('role').notNull(), // 'admin' | 'member' | 'profile'
    elderMode: boolean('elder_mode').notNull().default(false),
    joinedAt: ts('joined_at').notNull().defaultNow(),
    /** 共享开始日期（北京时间 YYYY-MM-DD，加入或创建时自己选）：这天起自己账本里的账汇进这个家庭账本。为空按加入那天（旧版） */
    shareFrom: date('share_from', { mode: 'string' }),
    removedAt: ts('removed_at'),
  },
  (t) => [
    uniqueIndex('ledger_members_active_user')
      .on(t.ledgerId, t.userId)
      .where(sql`${t.removedAt} is null and ${t.userId} is not null`),
    index('ledger_members_user').on(t.userId),
  ],
)

export const invites = pgTable('invites', {
  code: text('code').primaryKey(),
  ledgerId: uuid('ledger_id')
    .notNull()
    .references(() => ledgers.id, { onDelete: 'cascade' }),
  createdBy: uuid('created_by').notNull(),
  profileMemberId: uuid('profile_member_id'),
  expiresAt: ts('expires_at').notNull(),
  revokedAt: ts('revoked_at'),
  createdAt: ts('created_at').notNull().defaultNow(),
})

/** 同步记录：服务器把 data 当整体保存，不解析账目内容 */
export const syncRecords = pgTable(
  'sync_records',
  {
    entity: text('entity').notNull(),
    id: uuid('id').notNull(),
    ledgerId: uuid('ledger_id')
      .notNull()
      .references(() => ledgers.id, { onDelete: 'cascade' }),
    data: jsonb('data').$type<Record<string, unknown>>().notNull(),
    updatedAt: bigint('updated_at', { mode: 'number' }).notNull(),
    deletedAt: bigint('deleted_at', { mode: 'number' }),
    version: bigint('version', { mode: 'number' }).notNull(),
    updatedBy: uuid('updated_by'),
  },
  (t) => [primaryKey({ columns: [t.entity, t.id] }), index('sync_records_ledger_version').on(t.ledgerId, t.version)],
)

// ───────── 会员与订单 ─────────

export const products = pgTable('products', {
  id: text('id').primaryKey(), // 'month' | 'year' | 'three_year' | 'year_auto'
  name: text('name').notNull(),
  days: integer('days').notNull(),
  priceCents: integer('price_cents').notNull(), // 原价
  promoPriceCents: integer('promo_price_cents'), // 活动价；起止时间为空表示一直有效
  promoStart: ts('promo_start'),
  promoEnd: ts('promo_end'),
  badge: text('badge'),
  newUserPriceCents: integer('new_user_price_cents'), // 注册 7 天内、从未付费过的首单价
  appleProductId: text('apple_product_id'),
  platform: text('platform').notNull().default('all'), // 'all' | 'ios' | 'android'
  active: boolean('active').notNull().default(true),
  sort: integer('sort').notNull().default(0),
})

export const orders = pgTable(
  'orders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }), // 注销后保留订单（财务凭证）
    productId: text('product_id').notNull(),
    channel: text('channel').notNull(), // 'wechat' | 'alipay' | 'apple' | 'mock'
    amountCents: integer('amount_cents').notNull(),
    days: integer('days').notNull(), // 下单时的天数快照
    status: text('status').notNull().default('pending'), // 'pending' | 'paid' | 'closed' | 'refunded'
    channelTxnId: text('channel_txn_id').unique(),
    note: text('note'),
    createdAt: ts('created_at').notNull().defaultNow(),
    paidAt: ts('paid_at'),
    refundedAt: ts('refunded_at'),
  },
  (t) => [index('orders_user').on(t.userId), index('orders_status_created').on(t.status, t.createdAt)],
)

// ───────── 统计与版本 ─────────

/** 匿名安装：只记随机 id、平台、版本；登录后附带用户 id */
export const devices = pgTable('devices', {
  id: uuid('id').primaryKey(),
  platform: text('platform').notNull(),
  appVersion: text('app_version').notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  firstSeen: ts('first_seen').notNull().defaultNow(),
})

/** App 出错上报：只有出错信息和代码位置，不含账目。用于发现、修复闪退和白屏 */
export const clientErrors = pgTable(
  'client_errors',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    deviceId: uuid('device_id'),
    platform: text('platform').notNull(),
    appVersion: text('app_version').notNull(),
    message: text('message').notNull(),
    stack: text('stack').notNull(),
    fatal: boolean('fatal').notNull(),
    occurredAt: ts('occurred_at').notNull(),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [index('client_errors_created').on(t.createdAt)],
)

/** 每台设备每天一行，用来算日活 */
export const deviceDays = pgTable(
  'device_days',
  {
    deviceId: uuid('device_id')
      .notNull()
      .references(() => devices.id, { onDelete: 'cascade' }),
    day: date('day').notNull(),
  },
  (t) => [primaryKey({ columns: [t.deviceId, t.day] })],
)

/** 每个平台一行：最新版本、最低支持版本（低于它强制更新） */
export const appReleases = pgTable('app_releases', {
  platform: text('platform').primaryKey(),
  latestVersion: text('latest_version').notNull(),
  minVersion: text('min_version').notNull(),
  notes: text('notes').notNull().default(''),
  downloadUrl: text('download_url'),
  updatedAt: ts('updated_at').notNull().defaultNow(),
})

/** 用户上传的图片（家当、圆梦照片）。不加外键：账本删除后由 biz 层先删存储里的文件再删行 */
export const files = pgTable(
  'files',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerUserId: uuid('owner_user_id'),
    ledgerId: uuid('ledger_id').notNull(),
    contentType: text('content_type').notNull(),
    size: integer('size').notNull(),
    createdAt: ts('created_at').notNull().defaultNow(),
    deletedAt: ts('deleted_at'),
  },
  (t) => [index('files_ledger').on(t.ledgerId)],
)

export type User = typeof users.$inferSelect
export type Ledger = typeof ledgers.$inferSelect
export type Member = typeof ledgerMembers.$inferSelect
export type Invite = typeof invites.$inferSelect
export type SyncRow = typeof syncRecords.$inferSelect
export type Product = typeof products.$inferSelect
export type Order = typeof orders.$inferSelect
export type AppRelease = typeof appReleases.$inferSelect
export type FileRow = typeof files.$inferSelect
