import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

/** 账本：个人账本每人一个，家庭账本由服务器同步下来 */
export const ledgers = sqliteTable('ledgers', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type').notNull(), // personal | family
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  // 同步：remote = 服务器上已有这个账本（只推送 remote 账本的改动）；cursor = 已收到的最大版本号
  remote: integer('remote', { mode: 'boolean' }).notNull().default(false),
  cursor: integer('cursor').notNull().default(0),
  myRole: text('my_role'), // admin | member；本地账本为 null
  cover: text('cover'), // 封面纸色 key；null 或旧版本的图标名 = 按类型默认（见 utils/ledgerCover）
})

/** 账本成员（服务器的镜像，每次同步整体替换），用于显示是谁记的、家人列表 */
export const members = sqliteTable(
  'members',
  {
    id: text('id').primaryKey(),
    ledgerId: text('ledger_id').notNull(),
    userId: text('user_id'), // null = 家人档案
    nickname: text('nickname').notNull(),
    role: text('role').notNull(), // admin | member | profile
    elderMode: integer('elder_mode', { mode: 'boolean' }).notNull().default(false),
    isMe: integer('is_me', { mode: 'boolean' }).notNull().default(false),
    removed: integer('removed', { mode: 'boolean' }).notNull().default(false),
    isVip: integer('is_vip', { mode: 'boolean' }).notNull().default(false), // 成员是不是大掌柜（名字旁的小金印）
    joinedAt: integer('joined_at').notNull(),
  },
  (t) => [index('member_ledger_idx').on(t.ledgerId)],
)

// 同步表公共列：uuid 主键、所属账本、修改时间、删除标记（只打标记不真删）、
// dirty = 本地改过还没上传（每次写入都置为 true，同步成功后清掉）
const syncCols = () => ({
  id: text('id').primaryKey(),
  ledgerId: text('ledger_id').notNull(),
  updatedAt: integer('updated_at').notNull(),
  deletedAt: integer('deleted_at'),
  dirty: integer('dirty', { mode: 'boolean' }).notNull().default(true),
})

export const wallets = sqliteTable(
  'wallets',
  {
    ...syncCols(),
    key: text('key'), // 默认钱袋的稳定标识，如 'wallet.cash'；id = uuidv5(ledgerId, key)
    name: text('name').notNull(),
    kind: text('kind').notNull(),
    initialCents: integer('initial_cents').notNull().default(0),
    archived: integer('archived', { mode: 'boolean' }).notNull().default(false),
    sort: integer('sort').notNull().default(0),
  },
  (t) => [index('wallet_ledger_idx').on(t.ledgerId)],
)

export const categories = sqliteTable(
  'categories',
  {
    ...syncCols(),
    key: text('key'), // 默认分类的稳定标识，如 'expense.dining'、'income.sale'（系统分类：变卖）
    name: text('name').notNull(),
    type: text('type').notNull(), // expense | income
    tier: text('tier'), // need | flex | want，收入分类为 null
    icon: text('icon').notNull(), // 'retro:bowl-chopsticks' 或 'char:食'（旧版本存的 'lucide:*' 启动时迁移）
    color: text('color').notNull().default('mo'), // 8 个复古色的 key，见 utils/iconCatalog
    sort: integer('sort').notNull().default(0),
    hidden: integer('hidden', { mode: 'boolean' }).notNull().default(false),
  },
  (t) => [index('category_ledger_idx').on(t.ledgerId)],
)

export const transactions = sqliteTable(
  'transactions',
  {
    ...syncCols(),
    type: text('type').notNull(), // expense | income | transfer | refund
    amountCents: integer('amount_cents').notNull(),
    categoryId: text('category_id'), // 转账没有
    walletId: text('wallet_id').notNull(), // 转账时是转出钱袋
    toWalletId: text('to_wallet_id'), // 只有转账有
    date: text('date').notNull(), // 'YYYY-MM-DD'
    note: text('note').notNull().default(''),
    assetId: text('asset_id'), // 买入家当的支出 / 卖出家当的收入
    review: text('review'), // 复盘：necessary | unnecessary（旧版本的 worth/ok/regret/skip 启动时迁移）
    createdBy: text('created_by'), // 记账人 userId；未登录为 null
    memberId: text('member_id'), // 旧版的“谁花的”（家庭账本成员）；现在记账不再填，只保留旧数据；null = 记账人自己
    tags: text('tags').notNull().default('[]'), // 标签名的 JSON 数组，最多 3 个（utils/tags.ts）
    recurringId: text('recurring_id'), // 周期记账自动记的：哪一条周期；自动记的不算“今天记过账”
    // 小票、发票照片，同家当照片：photoFileId 同步，photo / photoCachedFor 只在本机
    photo: text('photo'),
    photoFileId: text('photo_file_id'),
    photoCachedFor: text('photo_cached_for'),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [
    index('txn_ledger_date_idx').on(t.ledgerId, t.date),
    index('txn_wallet_idx').on(t.walletId),
    index('txn_to_wallet_idx').on(t.toWalletId),
    index('txn_category_idx').on(t.categoryId),
    index('txn_asset_idx').on(t.assetId),
  ],
)

export const assets = sqliteTable(
  'assets',
  {
    ...syncCols(),
    name: text('name').notNull(),
    costCents: integer('cost_cents').notNull(),
    acquiredOn: text('acquired_on').notNull(),
    status: text('status').notNull().default('holding'), // holding | sold | lost | broken
    endedOn: text('ended_on'),
    soldCents: integer('sold_cents'),
    soldWalletId: text('sold_wallet_id'),
    useCount: integer('use_count').notNull().default(0),
    note: text('note').notNull().default(''),
    costMode: text('cost_mode').notNull().default('day'), // 计价：day 按天 | use 按次
    // 照片：photoFileId 是云端文件 id（随账目同步）；photo 是本机缓存路径、photoCachedFor 是这份缓存对应的云端 id（这两列只在本机，见 mapper/sync.ts LOCAL_ONLY）
    photo: text('photo'),
    photoFileId: text('photo_file_id'),
    photoCachedFor: text('photo_cached_for'),
  },
  (t) => [index('asset_ledger_idx').on(t.ledgerId)],
)

/** 预算：每个账本一个总预算（categoryId 为 null）+ 若干分类预算；id = uuidv5(ledgerId, 'budget:' + (categoryId ?? 'total')) */
export const budgets = sqliteTable(
  'budgets',
  {
    ...syncCols(),
    categoryId: text('category_id'),
    amountCents: integer('amount_cents').notNull(),
  },
  (t) => [index('budget_ledger_idx').on(t.ledgerId)],
)

/** "今天没花钱"标记，只记在个人账本里；id = uuidv5(ledgerId, 'nospend:' + date) */
export const dayMarks = sqliteTable(
  'day_marks',
  {
    ...syncCols(),
    date: text('date').notNull(),
  },
  (t) => [index('day_mark_date_idx').on(t.date)],
)

/** 常记：常用的一笔（如“理发 30”"上班交通 2"），点一下就按今天记上 */
export const templates = sqliteTable(
  'templates',
  {
    ...syncCols(),
    name: text('name').notNull(),
    type: text('type').notNull(), // expense | income
    categoryId: text('category_id').notNull(),
    amountCents: integer('amount_cents').notNull(),
    walletId: text('wallet_id').notNull(),
    note: text('note').notNull().default(''),
    memberId: text('member_id'), // 家庭账本里“谁花的”，null = 记账人自己
    tags: text('tags').notNull().default('[]'), // 记上时带的标签（JSON 数组）
    sort: integer('sort').notNull().default(0),
  },
  (t) => [index('template_ledger_idx').on(t.ledgerId)],
)

/**
 * 攒钱目标：每个目标自带一个专属储钱罐（钱袋 kind = 'jar'），进度 = 储钱罐余额。
 * 两步：第一次存满即“攒够”（achievedOn / achievedCents 冻结，之后取出也不撤销，牌匾挂上但未盖章）；
 * 用户点“圆梦”后盖上“圆梦”印章（fulfilledOn，可写一句话、配一张照片）。
 * 目标都建在主账本里
 */
export const goals = sqliteTable(
  'goals',
  {
    ...syncCols(),
    name: text('name').notNull(),
    targetCents: integer('target_cents').notNull(),
    deadline: text('deadline'), // 'YYYY-MM-DD'，可不设
    walletId: text('wallet_id').notNull(), // 储钱罐
    status: text('status').notNull().default('active'), // active | achieved（攒够）| archived（先收起来）
    createdOn: text('created_on').notNull(),
    achievedOn: text('achieved_on'), // 攒够那天
    achievedCents: integer('achieved_cents'),
    fulfilledOn: text('fulfilled_on'), // 圆梦那天：攒够之后，把钱用在了想做的事上
    wish: text('wish').notNull().default(''), // 圆梦时写的一句话
    // 圆梦照片，同家当照片：photoFileId 同步，photo / photoCachedFor 只在本机
    photo: text('photo'),
    photoFileId: text('photo_file_id'),
    photoCachedFor: text('photo_cached_for'),
  },
  (t) => [index('goal_ledger_idx').on(t.ledgerId)],
)

/**
 * 周期记账：房租、工资、会员续费这类固定的账，到日子自动记一笔（只在我的账本里）。
 * 从 startDate 起按 freq 重复：每天 / 每周同一天 / 每月同一号（没有这一号的月份记在月底）/ 每年同月同日；
 * 到 endDate（含）为止。doneThrough：已经记到哪天。自动记的账 id = uuidv5(周期 id, 'recurring:' + 日期)，
 * 两台手机同时补记也不会重复；删掉的不会再补回来
 */
export const recurrings = sqliteTable(
  'recurrings',
  {
    ...syncCols(),
    type: text('type').notNull(), // expense | income
    categoryId: text('category_id').notNull(),
    amountCents: integer('amount_cents').notNull(),
    walletId: text('wallet_id').notNull(),
    note: text('note').notNull().default(''),
    freq: text('freq').notNull(), // day | week | month | year
    startDate: text('start_date').notNull(), // 'YYYY-MM-DD'，从这天（含）起记
    endDate: text('end_date'), // 'YYYY-MM-DD'，不设就一直记
    day: integer('day'), // 每周：周几（1 = 周一 … 7 = 周日）；每月、每年：几号。空着跟开始日期
    month: integer('month'), // 每年：几月。空着跟开始日期
    doneThrough: text('done_through'), // 已经补记到哪天（含）
    paused: integer('paused', { mode: 'boolean' }).notNull().default(false),
  },
  (t) => [index('recurring_ledger_idx').on(t.ledgerId)],
)

/** 本机设置（提醒、应用锁、安装 id、当前账本等），不同步，也不导出 */
export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: integer('updated_at').notNull(),
})

/** 参与同步的表（键名与接口里的 Entity 一致） */
export const SYNC_TABLES = { wallets, categories, transactions, assets, budgets, dayMarks, templates, goals, recurrings } as const

export type LedgerRow = typeof ledgers.$inferSelect
export type MemberRow = typeof members.$inferSelect
export type WalletRow = typeof wallets.$inferSelect
export type CategoryRow = typeof categories.$inferSelect
export type TxnRow = typeof transactions.$inferSelect
export type AssetRow = typeof assets.$inferSelect
export type BudgetRow = typeof budgets.$inferSelect
export type DayMarkRow = typeof dayMarks.$inferSelect
export type TemplateRow = typeof templates.$inferSelect
export type GoalRow = typeof goals.$inferSelect
export type RecurringRow = typeof recurrings.$inferSelect
