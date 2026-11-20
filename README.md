# 账房

微微复古风的记账 App（iOS / Android）。需求见 [docs/需求.md](docs/需求.md)，接口见 [docs/api.md](docs/api.md)。

```
app/   手机端（Expo / React Native，说明见 app/README.md）
api/   后端 + 后台管理（Fastify + Drizzle + PostgreSQL）
docs/  需求、接口文档
```

## 启动后端

```bash
cp .env.example .env        # 改里面的密码和配置
docker compose up -d --build
```

- 接口：`http://localhost:3000`，健康检查 `/healthz`
- 后台管理：`http://localhost:3000/admin`，密码是 `.env` 里的 `ADMIN_PASSWORD`
- 启动时自动建表和升级；首次启动写入默认付费方案（月卡、年卡、3 年卡、iOS 连续包年），之后在后台改
- 测试环境要试购买流程：`.env` 里设 `ENABLE_MOCK_PAY=true`，正式环境必须是 `false`
- 照片存储：默认存在 docker 卷 `files` 里（`STORAGE_DRIVER=local`）；上线换成阿里云 OSS / 腾讯云 COS：`.env` 里设 `STORAGE_DRIVER=s3` 并填 `S3_ENDPOINT`、`S3_REGION`、`S3_BUCKET`、`S3_ACCESS_KEY_ID`、`S3_SECRET_ACCESS_KEY`（两家都兼容 S3 接口，不用改代码）
- 测试环境没接短信服务也想登录：`.env` 里设 `SMS_DEV_ECHO=true`，发验证码接口会把验证码直接返回给 App（App 弹出提示并自动填入）。**正式环境必须是 `false`**，否则任何人都能登录任何手机号

后台：概览（安装、活跃、注册、大掌柜、转化率、收入）、用户（搜索、开通或撤销大掌柜、冻结）、订单（补单、退款）、付费方案（原价、活动价、新人价）、版本更新。后台看不到任何账目内容。

## 后端分层（api/src）

```
controllers/  HTTP 层：校验参数 → 调 biz → 返回。不写业务规则，不碰数据库
biz/          业务规则：登录、账本权限、家庭邀请、同步冲突、定价、订单……抛 AppError
models/       数据层：drizzle 表定义 + 查询。唯一写 SQL 的地方
integrations/ 外部服务：短信、微信、Apple、一键登录（接口 + 实现，测试里可替换）
plugins/      鉴权、统一错误响应
config/ utils/
```

依赖方向只能是 controllers → biz → models。手机端相当于 View。

## 还没接入的外部服务

| 项目 | 现状 | 要做的事 |
|---|---|---|
| 短信验证码 | 验证码打印在 `docker compose logs api` 里，不会真发 | 开通阿里云或腾讯云短信，在 `integrations/sms.ts` 加一个实现，`server.ts` 里换上 |
| 本机号码一键登录 | 返回 501 | 开通阿里云号码认证，按 `integrations/onekey.ts` 的接口写实现 |
| 微信登录 | 填了 `WECHAT_APP_ID/SECRET` 就能用 | 开放平台创建移动应用并开通微信登录 |
| Apple 登录 | 填了 `APPLE_BUNDLE_ID` 就能用 | 苹果开发者账号开启 Sign in with Apple |
| 支付 | 只有模拟支付 | 拿到微信支付、支付宝商户号和苹果内购配置后，在 `biz/vip.biz.ts` 的 `createOrder` 和 `/api/pay/notify/:channel` 接入 |

## 开发与测试

```bash
cd api
npm install
npm test          # 内存 Postgres（PGlite），不需要 Docker
npm run typecheck
npm run dev       # 需要 api/.env 里有 DATABASE_URL 等配置
```

数据表改动：改 `api/src/models/schema.ts` 后运行 `npm run db:generate`，把生成的 `api/drizzle/` 一起提交。

## 上线前要准备

见 [docs/需求.md 第 20 节](docs/需求.md)。
