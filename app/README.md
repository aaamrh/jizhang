# 账房 · 手机端

Expo（React Native）+ TypeScript，iOS / Android。需求见 [../docs/需求.md](../docs/需求.md)，接口见 [../docs/api.md](../docs/api.md)。

账目先存在手机本地的 SQLite 里（expo-sqlite + Drizzle），不登录也能完整使用。登录并同意云同步后，账目同步到服务器（换手机恢复、家庭账本共享）。

## 运行

```bash
npm install
cp .env.example .env     # 改 EXPO_PUBLIC_API_URL（后端地址）
npx expo run:android     # 需要开发构建：用到了通知、生物识别、桌面小组件等原生模块
npx expo run:ios         # 需要 macOS；或用 EAS 云构建（先在 app.json 填 ios.appleTeamId，见“桌面小组件”）
```

- 安卓模拟器访问电脑上的后端：`http://10.0.2.2:3000`
- 真机：填电脑的局域网 IP，比如 `http://192.168.1.5:3000`
- 后端没启动也能正常用：上报、版本检查、同步失败时静默跳过，下次再试。

### 连本地后端调试

```bash
# 仓库根目录：.env 里设 ENABLE_MOCK_PAY=true
docker compose up -d --build
# app/.env：EXPO_PUBLIC_API_URL=http://10.0.2.2:3000（模拟器）、EXPO_PUBLIC_MOCK_PAY=true
```

短信验证码不会真发，看 `docker compose logs api` 里的 `[sms:console]`。开通大掌柜可以走模拟支付，或在后台（`http://localhost:3000/admin`）手动开通。

## 测试与检查

```bash
npm test             # vitest：工具函数、mapper、数据库 repo（sql.js 跑同一套迁移）、同步
                     # e2e/ 在进程内启动 ../api 的真实后端（PGlite），两台"手机"互相同步；需要先在 api/ 里 npm install
npm run typecheck
npx expo export --platform android   # 验证能打包
npx expo-doctor
```

## 目录与分层

```
src/
  pages/       页面（View）。一个页面一个文件夹。不写 SQL，不发请求
  components/  通用 UI 组件（每种元素只有一个组件，页面不自造样式）：
               Txt、Icon/FeatureIcon、Button、TextField、Chip/Segmented、ListRow、Section、
               Sheet、Picker、DateField、NavBar、Keypad、CategoryGrid/CategoryIcon、TxnItem/TxnRow（列表账目：左滑删除、长按菜单）、SwipeRow（左滑删除，react-native-gesture-handler）、Overlays 里的 ActionSheet（底部操作菜单，`useUi().showActions`）、Bars、Misc（EmptyState、Stat、PeriodSwitcher、MonthHeading）
               RetroGlyph 画自绘复古图标（assets/icons/retro.ts）；icons/ui.ts 只放界面控件用的 Lucide 图标
  hooks/       页面用的数据和操作（Controller）：data.ts 读、actions.ts 写，其余是启动、应用锁、导出导入
  store/       zustand：设置、当前账本、当前月份、登录状态与同步状态、应用锁、更新弹窗。账目数据不进 store
  db/          数据层（Model）：schema、迁移、各 repo。唯一接触 Drizzle 的地方
  mapper/      数据库行 → 领域对象（收窄类型、处理脏数据），一个实体一个文件
  api/         HTTP 请求（client 自动带 token）；nativeLogin.ts 是微信、Apple、一键登录的原生 SDK 封装（延迟加载）
  widgets/     桌面小组件：安卓小组件界面、系统回调、记账后刷新（iOS 只负责写共享数据）
  types/       领域类型、接口类型、导航参数
  utils/       纯函数：金额、日期、记账键盘算式、家当成本、财富分布、名句、图标目录、uuid v5。不依赖 RN
  navigation/  导航器、导航 ref、深链和通知点击的跳转
  theme.ts     设计令牌：颜色、间距、圆角、图标尺寸、控件高度、字号、阴影。页面里的尺寸只从这里取
targets/widget/  iOS 小组件（SwiftUI），prebuild 时由 @bacons/apple-targets 加进 Xcode 工程
```

**依赖方向**：`pages → hooks / store / components → db / api → mapper / types / utils`，不能反过来。
`pages` 不直接引用 `db`；`utils` 不引用 React Native，保证能在 Node 里测试。

MVC 对应：pages = View，hooks + store = Controller，db + mapper = Model。

### 数据规则

- 金额一律整数“分”，日期是本地时区的 `'YYYY-MM-DD'`。
- 同步表（钱袋、分类、账目、家当、预算、“今天没花钱”标记）都有 `ledger_id`、`updated_at`、`deleted_at`、`dirty`：
  - 删除只打标记（软删除）；
  - 每次写入都更新 `updated_at` 并置 `dirty = 1`，同步时把 `dirty` 的记录推上去。
- 默认分类和钱袋的 id = uuid v5（账本 id，稳定标识如 `expense.dining`），同一账本在任何设备上生成的 id 都一样。
  预算 id 用 `budget:<分类 id 或 total>`，“今天没花钱”用 `nospend:<日期>`（只记在个人账本）。
- 所有查询都按账本过滤。
- 界面自动刷新：`hooks/useLive.ts` 订阅 expo-sqlite 的变更事件，任何写入后相关查询重新执行。

## 习惯与回顾

- **连续记账**：某天有任何账本、任何类型、日期是这一天的账，或点了“今天没花钱”，就算记过。今天还没记时，连续天数算到昨天，不立刻算断。纯计算在 `utils/streak.ts`。
- **预算**：每个账本一个总预算 + 可选的分类预算。花费按月度统计口径（退款冲减，买家当也算）。记一笔保存后，当月花到 80%、超过 100% 各弹一次轻提示，已提醒的档位记在本机 settings 表。
- **周报 / 年度报告**：`db/reportRepo.ts`。周一到周日；年报按月汇总、家当日均最低一件、记账天数与最长连续。
- **长辈模式**：`useSettings().setElderMode` 是唯一开关（以后家庭账本管理员远程开启也调它）。开启后字号和按钮放大 1.3 倍，导航只剩“这个月”和“记一笔”。

### 通知怎么排

`hooks/notifications.ts` 统一排期：数据库有变化（防抖 0.5 秒）、回到前台、设置改变时重算一次，只有“今天、今天记没记、提醒开关和时间、周报开关”变了才真正重排。

- 记账提醒：按具体日期排未来 30 天，今天已经记过就跳过今天（每天的重复提醒做不到“记过就不提醒”）。连续 30 天不打开 App 会停止提醒。
- 周报：每周日 20:00 重复提醒，点通知打开周报页（`navigation/useExternalRoutes.ts`）。
- 首次打开问“你一般几点有空记账？”（`components/Overlays.tsx` 的 `ReminderAsk`）。

## 登录与同步

### 登录方式

| 方式 | 现状 | 要做的事 |
|---|---|---|
| 短信验证码 | 可用（后端没接短信服务时，验证码在后端日志里） | 后端接入短信服务 |
| 微信 | 已接 `expo-wechat`（Expo 原生模块，零原生代码配置）。没配置或在 Expo Go 里时，登录页显示"当前环境不支持微信登录" | 见下方"接入微信登录" |
| Sign in with Apple | 已接 `expo-apple-authentication`，只在 iOS 显示；`app.json` 已开 `usesAppleSignIn` | 苹果开发者后台给 App ID 开启 Sign in with Apple；后端配 `APPLE_BUNDLE_ID` |
| 本机号码一键登录 | 只留了入口（`api/nativeLogin.ts` 的 `onekeyAvailable` 返回 false） | 开通阿里云号码认证，选定运营商 SDK 后在这里返回 token |

**接入微信登录**
1. open.weixin.qq.com 创建移动应用：安卓填包名 `com.zhangfang.app` 和签名 MD5，iOS 填 Bundle ID 和通用链接。
2. `app/.env` 填 `EXPO_PUBLIC_WECHAT_APP_ID`、`EXPO_PUBLIC_WECHAT_UNIVERSAL_LINK`；后端 `.env` 填 `WECHAT_APP_ID`、`WECHAT_APP_SECRET`。
3. `app.json`：`scheme` 改成数组并加上 `wx` 开头的 AppID（如 `["zhangfang", "wx1234567890"]`）；`ios.associatedDomains` 加 `applinks:你的域名`，并在该域名部署 `apple-app-site-association`。
4. 安卓混淆规则已在 `expo-build-properties` 里配好；`expo-wechat` 的 `enablePay` 设为 false（第一版不用微信支付，iOS 审核更省事）。
5. 重新 `npx expo prebuild` 并做开发构建（Expo Go 里没有这个原生模块）。

### 同步（`db/sync.ts`）

- **本地优先**：先写本地；同步只推 `remote = true` 的账本（服务器上已有）里 `dirty` 的行，一次最多 500 条。
- **一次请求同时推和拉**：服务器返回各账本游标之后的改动、我的全部账本和成员。
- **合并规则**：服务器的记录覆盖本地，除非本地改过还没传（dirty）且修改时间更新。推送成功后，只对"上传后没再改过"的行清掉 dirty。
- **账本列表**：不在列表里的家庭账本（被移出、解散）从本机删除；个人账本只停止同步，数据保留。
- **长辈模式**：服务器上我的成员身份从关到开时，调用 `setElderMode(true)`。
- **时机**（`hooks/sync.ts`）：打开 App、本地写入后约 2 秒（只在真有 dirty 时）、回到前台、前台每 30 秒、首页下拉。没登录或没同意云同步时不同步。
- **首次登录**（`bindPersonalLedger`）：云端没有个人账本 → 用本机账本 id 创建并全部上传（id 被别的账号占用时先换新 id）；云端已有 → 本机没记过账就直接用云端的，记过账让用户选"合并"或"用云端覆盖本机"。合并复用导入逻辑：默认分类、钱袋、预算、"今天没花钱"按云端账本 id 重算，引用一并替换。
- **退出登录**：先尽量同步一次；家庭账本从本机删除；个人账本保留但不再同步。token 失效（过期、冻结、注销）只清登录信息，不动本机数据。
- 开启同步前单独征得同意（账目属于敏感个人信息），拒绝后只在本机记，可以在「账号与同步」里再打开。

### 家庭账本与大掌柜

- 新建家庭账本需要大掌柜（服务器校验，App 里先引导到大掌柜页）。创建成功后本地写入默认钱袋、分类，再同步上去。
- 邀请：邀请码 + 二维码 + 系统分享；链接 `zhangfang://invite/<邀请码>` 打开"加入家庭账本"页，没登录先登录。
- **账本只有两本**：本机数据（记账、钱袋、分类、预算、心愿……）永远用"我的账本"（`settings.currentLedgerId`）。家庭账本是一家人账的汇总，**不在本机存别人的账**：首页、盘账看家庭账本时（`settings.familyView`）用 `hooks/familyFeed` 从服务器取，纯计算在 `utils/familyFeed`。每次同步完自动重新取。
- 家庭账本只认"谁记的"：首页家人头像和盘账统计的是每人记了多少；自己记的那几笔能编辑、左滑删除，别人的只能看。不做家人档案、不做专项账本，只邀请有账号的家人。
- 大掌柜页：价格由服务器按活动价、新人价算好。`EXPO_PUBLIC_MOCK_PAY=true` 时走模拟支付；否则下单时服务器返回"支付暂未开通"。下单后订单 id 记在本机，回到前台时再查一次是否到账。

## 桌面小组件

显示个人账本的今日已花、本月已花，点“记一笔”打开 `zhangfang://add`（长辈模式下打开长辈版记一笔）。App 里每次记账后（防抖 0.8 秒）刷新。

- **安卓**：`react-native-android-widget`。界面在 `src/widgets/SpendWidget.tsx`，系统回调在 `index.ts` 注册。配置在 `app.json` 的插件参数里（名字 `Spend`、3×2 格，每 30 分钟系统自动刷新一次）。
- **iOS**：`@bacons/apple-targets` 生成 WidgetKit 扩展，代码在 `targets/widget/index.swift`（iOS 17+）。主 App 通过 App Group `group.com.zhangfang.app` 写入 `day`、`todayCents`、`monthCents`，小组件读取；日期过期的数字按 0 显示。
  - 上架前要在 `app.json` 填 `ios.appleTeamId`，并在苹果开发者后台给主 App 和小组件都开启这个 App Group。
  - 没有 Mac 时用 EAS 云构建；本仓库还没在 iOS 上编译验证过。

## 常见改动

- **改表结构**：改 `src/db/schema.ts`，运行 `npm run db:generate`，把 `drizzle/` 下新生成的文件一起提交。App 启动时自动执行迁移。
- **加分类图标**：在 `src/assets/icons/retro.ts` 里画一个（24×24、只描边），写上 group 和 keywords；图标目录和按名称推荐会自动带上。
- **加页面**：`src/pages/Xxx/index.tsx`，在 `types/navigation.ts` 加参数类型，在 `navigation/RootNavigator.tsx` 注册。

## 字体

只打包思源宋体（Noto Serif SC）Regular 一个字重，约 15MB，启动时用 `useFonts` 加载。
注意从 `@expo-google-fonts/noto-serif-sc/400Regular` 引入，从包根目录引入会把 8 个字重（约 120MB）全打进去。

## 界面规范

- 颜色：页面底 `bg`、纸面 `surface`、弱填充 `fill`；文字 `ink / ink2 / ink3`；朱红 `seal` 只用于主操作、选中和小点缀；收入用黛青。
- 字体：衬线（思源宋体）只用于标题、月份、金额；正文、标签、按钮、胶囊、底栏用系统字体。
- 尺寸：按钮 48/40/32、输入框 48、胶囊 32、列表行 56/64、底栏 56 + 安全区、导航栏 52；页面左右 20，组间 24。
- 图标：分类、底栏、功能入口用 `assets/icons/retro.ts` 的自绘复古图标（`RetroGlyph`），在 40px 圆底里画 22px；Lucide 只用于返回、关闭、搜索、箭头、加号、更多、勾、日历、退格。
- 分类图标存储为 `retro:<名字>` 或 `char:<字>`；旧版本的 `lucide:*` 在启动时由 `migrateLegacyIcons` 改成最接近的复古图标，读取时 `parseIcon` 也兼容。
