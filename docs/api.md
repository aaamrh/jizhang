# 账房 · 接口约定

手机端和后端都以本文为准。需求见 [需求.md](需求.md)。

## 通用

- Base URL：`EXPO_PUBLIC_API_URL`。请求和响应都是 JSON。
- 鉴权：`Authorization: Bearer <token>`，有效期 90 天。过期、注销、冻结返回 401 `unauthorized`（冻结时 message 为"账号已冻结，如有疑问请联系客服"）。
- 错误：HTTP 状态码 + `{ "error": "<code>", "message": "<中文，可直接展示>" }`。
- 时间：ISO 字符串；同步记录里的 `updatedAt` / `deletedAt` 是毫秒数。
- 金额：整数"分"。

常见错误码：`invalid_input` 400、`unauthorized` 401、`forbidden` 403、`not_found` 404、`vip_required` 403、`family_inactive` 403、`already_in_family` 409、`rate_limited` 429、`not_configured` 501。

## 类型

```ts
type User = {
  id: string
  nickname: string
  phone: string | null          // 打码：138****0000
  providers: ('wechat' | 'phone' | 'apple')[]
  vipUntil: string | null
  isVip: boolean
  createdAt: string
}

type Member = {
  id: string
  userId: string | null         // null = 旧版的“家人档案”（App 已不再创建、也不显示）
  nickname: string
  role: 'admin' | 'member' | 'profile'
  elderMode: boolean
  isMe: boolean
  removed: boolean              // 已离开：只用于显示历史账目的名字，不能再选
  isVip: boolean                // 是不是大掌柜（成员列表里的小金印）
  joinedAt: string
  shareFrom: string             // YYYY-MM-DD，这个人的账从哪天起汇进这个家庭账本（加入时自己选；旧数据按加入那天）
}

type Ledger = {
  id: string
  name: string
  type: 'personal' | 'book' | 'family' // 我的账本 / 旧版多账本（已不能新建，老数据照常返回）/ 家庭账本
  cover: string | null          // 封面纸色：dianlan / zheshi / songlv / ouhe / xiang / daiqing（App 的 utils/ledgerCover），null 或认不出的按类型默认；服务器不解析
  myRole: 'admin' | 'member'
  members: Member[]
  createdAt: string
}

type SyncRecord = {
  id: string                    // uuid，客户端生成
  ledgerId: string
  updatedAt: number             // 毫秒，客户端修改时间
  deletedAt: number | null
  data: Record<string, unknown> // 其余所有列，服务器不解析
  version?: number              // 仅服务器返回
  updatedBy?: string | null     // 仅服务器返回
}
type Entity = 'wallets' | 'categories' | 'transactions' | 'assets' | 'budgets' | 'dayMarks' | 'templates' | 'goals' | 'recurrings' // templates：常记；goals：攒钱目标；recurrings：周期记账
// transactions、templates 的 data 里有 tags：标签名的 JSON 数组文本（如 '["云南旅行"]'），服务器不解析
// transactions 的 data 里还有 recurringId（周期记账自动记的）、photoFileId（小票照片的云端文件 id，同家当照片）
```

各端约定（服务器不检查）：
- 账目 `data.review`：复盘标记 'necessary' | 'unnecessary' | null（旧值 worth/ok/regret/skip 由客户端迁移）。
- 账目 `data.createdBy`：记账人 userId，未登录时 null；`data.memberId`：谁花的，null 表示记账人自己。
- `dayMarks`（今天没花钱）只存在个人账本里，id = uuid v5(ledgerId, 'nospend:' + 日期)。
- 预算 id = uuid v5(ledgerId, 'budget:' + (categoryId ?? 'total'))。

## 登录与账号

| 方法 | 路径 | 请求 | 响应 |
|---|---|---|---|
| POST | `/api/auth/wechat` | `{code}` | `{token, user, isNew}` |
| POST | `/api/auth/onekey` | `{token}` | 同上 |
| POST | `/api/auth/sms/send` | `{phone}` | 204；`sms_too_soon` 429。**仅测试环境**（`SMS_DEV_ECHO=true`，非 production 默认开）返回 200 `{devCode}`，App 自动填入；正式环境必须关闭 |
| POST | `/api/auth/sms/login` | `{phone, code}` | 同上；`sms_invalid` 401、`sms_locked` 429 |
| POST | `/api/auth/apple` | `{identityToken, nickname?}` | 同上 |
| GET | `/api/me` | | `User` |
| PATCH | `/api/me` | `{nickname}` | `User` |
| DELETE | `/api/me` | | 204，注销并删除全部数据 |
| POST | `/api/me/bind/:provider` | 同对应登录接口 | `User`；`already_bound` 409 |
| DELETE | `/api/me/bind/:provider` | | `User`；`last_provider` 400 |

- 个人账本由客户端 `POST /api/ledgers` 创建，id 用本机账本 id。
- 登录方式未配置时返回 `not_configured` 501；微信、一键登录、Apple 校验失败返回 `auth_failed` 401。
- 新用户默认昵称"账友 + 4 位数字"。

## 账本、成员、家庭邀请

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/ledgers` | `Ledger[]` |
| POST | `/api/ledgers` | `{id, name, type, cover?, shareFrom?}`。主账本只能一个（`personal_exists` 409）；~~多账本 `book`~~ **已停用**，新建返回 `invalid_input` 400"不再支持多账本"；家庭账本需大掌柜（`vip_required`），可以建好几个；`shareFrom`（YYYY-MM-DD）是创建者自己的账从哪天起汇进来，不传按今天，晚于今天 400"开始日期不能晚于今天" |
| PATCH | `/api/ledgers/:id` | `{name?, cover?}`（cover 为 null 恢复默认），管理员 |
| DELETE | `/api/ledgers/:id` | 解散家庭账本或删除一本旧多账本，管理员；主账本不能删（400） |
| GET | `/api/ledgers/:id/family-feed?start=&end=` | 家庭账本的明细（汇总），见下文 |
| POST | `/api/ledgers/:id/leave` | 成员退出（管理员只能解散） |
| POST | `/api/ledgers/:id/members` | `{nickname}` 新建家人档案，管理员；上限 10 人（`ledger_full`）。**App 已不再使用**，接口暂留 |
| PATCH | `/api/ledgers/:id/members/:memberId` | `{nickname?, elderMode?}`；管理员可改任何人，成员只能改自己的昵称 |
| DELETE | `/api/ledgers/:id/members/:memberId` | 移除，管理员，不能移除自己 |
| POST | `/api/ledgers/:id/invites` | `{profileMemberId?}` → `{code, url, expiresAt, profileMemberId}`；创建者不是有效大掌柜时 `vip_required` |
| GET | `/api/ledgers/:id/invites` | 有效邀请列表 |
| DELETE | `/api/ledgers/:id/invites/:code` | 作废 |
| GET | `/api/invites/:code` | 预览（可不登录）：`{ledgerName, cover, inviterNickname, profileNickname, memberCount, expiresAt}`；无效 `invite_invalid` 404 |
| POST | `/api/invites/:code/accept` | `{shareFrom?}` 加入 → `Ledger`；`shareFrom` 同上（自己的账从哪天起汇进来，可早于今天，不能晚于今天）；已在这个账本里 `already_member` 409；`ledger_full` 400。可以同时在好几个家庭账本里 |
| GET | `/i/:code` | 网页落地页 |

App 深链：`zhangfang://invite/<code>`。

一个人可以同时在好几个家庭账本里（2026-11-20 起；原来的"一人一个家庭" `already_in_family` 409 已去掉）。

### 家庭账本的明细

家庭账本不单独记账：每人只记在自己的账本（`personal`）里，家庭账本是成员各自账本的**只读汇总**，由服务器算好返回。

`GET /api/ledgers/:id/family-feed?start=YYYY-MM-DD&end=YYYY-MM-DD`（end 不含；start < end，最多 373 天，即一年零一周；否则 `invalid_input` 400）

```ts
{
  active: boolean,               // 创建者的大掌柜现在是否有效
  frozenSince: string | null,    // active 为 false 时：创建者大掌柜到期那天 'YYYY-MM-DD'（北京时间）；从没开过时为 null
  items: {
    id: string, date: string, type: 'expense' | 'income' | 'refund', amountCents: number,
    note: string, review: string | null, createdAt: number,   // createdAt 取 data.createdAt（毫秒）
    userId: string | null,       // 谁记的
    category: { name: string, icon: string, color: string, tier: string | null } | null  // 分类已删除或找不到时 null
  }[]                            // 按 date 从新到旧，同一天按 createdAt 从新到旧
}
```

规则：
- 只有这个家庭账本的有效成员能查，否则 404；不是家庭账本 400。
- 汇总每位成员自己账本里、**在家期间**的账：账目日期 ≥ 他的 `shareFrom`（没有时按加入那天），离开过的 < 离开那天（都按北京时间）。退出又加入的人，每段各算各的；离开的人在家期间的账留着。
- 只汇收入、支出、退款，不汇转账；已删除的不算。
- 创建者的大掌柜到期：其他成员 403 `family_inactive`（"创建者的大掌柜到期了，暂时看不到家庭账本"）；创建者照常能看，自己的账照常汇进，**别人的账只到 `frozenSince` 那天（含）**。续费后不再截断，断档期间的账自动补上。
- 旧版直接记在家庭账本里的账也一并返回（记账人取 `data.createdBy`），不按在家期间过滤。
- 家人档案（没账号）没有自己的账本，不出现在汇总里。

## 同步

`POST /api/sync`

```ts
// 请求
{ cursors: { [ledgerId: string]: number }, changes: { [entity in Entity]?: SyncRecord[] } }   // 每次最多 500 条
// 响应
{
  ledgers: Ledger[],                             // 我当前参与的全部账本；不在列表里的，本地删除
  changes: { [entity in Entity]: SyncRecord[] }, // 各账本 version > cursor 的记录，每次最多 1000 条
  cursors: { [ledgerId: string]: number },
  hasMore: boolean,                              // true 时立即再同步一次
  rejected: { entity: Entity, id: string, reason: 'forbidden' | 'conflict' | 'invalid' }[]
}
```

规则：
- 只能写自己参与的账本，否则 `forbidden`；同一 id 已在别的账本 `conflict`；单条 `data` 超过 16KB `invalid`。
- 以 `updatedAt` 较新者为准。上传的比服务器旧时不写入，并把服务器版本放进本次响应，客户端直接覆盖。
- 收到自己刚上传的记录属正常，按 id 覆盖。

首次登录合并：云端已有个人账本时，把本地个人账本的记录改到云端账本 id 下；默认分类、预算、今天没花钱标记的 id 按新账本 id 重新算，账目里的 categoryId 一并替换。

## 大掌柜与订单

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/vip/products` | `[{id, name, days, priceCents, originalPriceCents, badge, appleProductId}]`，价格已按当前活动和新用户价算好 |
| POST | `/api/orders` | `{productId, channel: 'wechat'\|'alipay'\|'apple'\|'mock'}` → `{orderId, amountCents, status, payParams}`；真实渠道未配置 `not_configured` 501 |
| GET | `/api/orders/:id` | `{id, productId, channel, amountCents, status: 'pending'\|'paid'\|'closed'\|'refunded', paidAt}` |
| POST | `/api/orders/:id/mock-pay` | 仅测试环境，模拟支付成功 |
| POST | `/api/pay/notify/:channel` | 支付渠道回调；未配置返回 501 |

## 照片（家当、圆梦）

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/files` | multipart/form-data，**先** `ledgerId` 字段、**再** `file`。必须是该账本成员；只收 JPEG/PNG/WebP（按文件头判断，不看声明），≤5MB → `{id}`。`unsupported_type` 400、`file_too_large` 413、不是成员 404 |
| GET | `/api/files/:id` | 图片内容（`Cache-Control: private, max-age=31536000, immutable`）。账本成员才能看，否则 404 |
| DELETE | `/api/files/:id` | 上传者或账本管理员 → 204；别人 403 |

- 账目里只同步照片的云端 id：家当、目标的 `data.photoFileId`。本机路径不上传。
- 解散账本、删除多账本、注销账号时，对应账本的照片一并从存储里删除。
- 存储：`STORAGE_DRIVER=local`（服务器磁盘，docker 卷 `files`）或 `s3`（阿里云 OSS / 腾讯云 COS 的 S3 兼容接口，填 `S3_*`）。

## 其他

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/devices/ping` | `{deviceId, platform, appVersion}` → 204；带 token 时记录用户 |
| POST | `/api/client-errors` | `{deviceId, platform, appVersion, reports: [{message ≤500, stack ≤4000, fatal, at}]}`（1–20 条）→ 204；不需要登录，每台每分钟 10 次。App 只在用户同意隐私政策后发；后台 `GET /admin/api/errors` 看最近 200 条 |
| GET | `/api/app/version?platform=&current=` | `{update: 'none'\|'optional'\|'force', latest, notes, downloadUrl}` |
| GET | `/healthz` | `{ok: true}` |

## 后台 `/admin/api/*`（管理员 token）

| 模块 | 接口 |
|---|---|
| 登录、概览 | `POST /login`、`GET /stats` |
| 用户 | `GET /users?q=&page=`、`POST /users/:id/vip {days}`、`DELETE /users/:id/vip`、`POST /users/:id/freeze`、`DELETE /users/:id/freeze` |
| 订单 | `GET /orders?status=&page=`、`POST /orders/:id/mark-paid {note}`、`POST /orders/:id/refund {note}` |
| 付费方案 | `GET /products`、`PATCH /products/:id` |
| 版本 | `GET /releases`、`PUT /releases/:platform` |
