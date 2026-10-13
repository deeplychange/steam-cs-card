# CS 跨平台资料卡 v0.9.1

在 Steam 玩家的个人资料主页旁显示 CS 跨平台信息。本项目是浏览器扩展；在 Steam 客户端中使用，需要先安装 **Millennium → Extendium → 本资料卡扩展**。下面以 Windows 为例。

> **当前可用范围：**5E 封禁状态、字母段位、分数、Rating 和赛季战绩可免登录查询。完美公开搜索可匹配昵称；完美扫码登录与战绩属于试验功能，尚未完成真人登录验证，**完美封禁查询未接通**。安装成功不代表这些完美功能已经可用。“未知”不等于未封禁。

## 1. 需要先下载什么

| 使用方式 | 需要的东西 | 下载入口 |
|---|---|---|
| 在 Steam 客户端内显示 | Millennium：为 Steam 提供插件支持 | [项目安装文档](https://docs.steambrew.app/users/getting-started/installation) |
| 在 Steam 客户端内显示 | Extendium：让 Steam 加载浏览器扩展 | [SteamBrew 插件页](https://steambrew.app/plugin/788ed8554492) / [项目 Releases](https://github.com/BossSloth/Extendium/releases) |
| Steam / Chrome / Edge 都需要 | 本仓库的资料卡扩展 | 本页绿色 **Code → Download ZIP** |
| 仅尝试完美扫码功能时需要 | Node.js：运行本仓库的本机辅助程序 | [Node.js 官网](https://nodejs.org/)（选择当前 LTS；程序最低要求 18） |
| 仅尝试完美扫码功能时需要 | 完美世界电竞 App | 手机应用商店搜索“完美世界电竞”；扫码功能仍待验证 |

**只查询 5E 不需要 Node.js、辅助程序或完美登录。**在 Chrome / Edge 中使用，也不需要 Millennium 和 Extendium。Millennium、Extendium 是社区项目，不是 Steam 官方内置功能；本资料卡也不是完美或 5E 官方插件。

## 2. 下载并解压本资料卡

1. 在[仓库首页](https://github.com/deeplychange/steam-cs-card)点击 **Code → Download ZIP**，下载后解压。
2. 将解压后的目录放在固定位置，例如 `D:\Plugins\steam-cs-card-main`，使用期间不要删除或移动。
3. 找到其中的 `extension` 文件夹。**加载扩展时选择这个文件夹，不是 ZIP、仓库根目录或 helper 文件夹。**

应能看到以下结构：

```text
steam-cs-card-main/
├─ extension/               ← 加载这个目录
│  ├─ manifest.json         ← 选中的目录内必须有它
│  ├─ background.js
│  ├─ content.js
│  ├─ options.html
│  └─ vendor/               ← 保留整个目录
├─ helper/
│  ├─ Start.cmd             ← 完美试验功能的启动入口
│  ├─ Start.ps1
│  └─ bridge.cjs
└─ README.md
```

通过 GitHub 下载的文件名通常是 `steam-cs-card-main.zip`。目前没有发布 Release 安装包，不必寻找 `steam-cs-card-v0.9.1.zip`。扩展文件已可直接加载，首次安装不需要编译、Git 或 `npm install`。

## 3. 在 Steam 中首次安装

### 第一步：安装 Millennium

打开上面的[安装文档](https://docs.steambrew.app/users/getting-started/installation)，下载 Windows 安装器，按提示安装到实际的 Steam 目录，然后重启 Steam。已安装的用户跳过这一步。

### 第二步：安装并启用 Extendium

从上面的 [SteamBrew 插件页](https://steambrew.app/plugin/788ed8554492)安装 Extendium；手动安装可参考[项目说明](https://github.com/BossSloth/Extendium#installation)。在 Millennium 插件菜单启用 Extendium，保存更改并重启 Steam。

### 第三步：加载本资料卡

1. 点击 Steam 网页地址栏右侧的拼图图标，打开 **Manage extensions（管理扩展）**。
2. 点击 **Advanced extension management（高级扩展管理）**。
3. 在打开的扩展页面启用 **Developer mode（开发者模式）**。
4. 点击 **Load unpacked（加载已解压的扩展程序）**，选择第 2 节中的 `extension` 文件夹。
5. 确认列表里出现 **CS 跨平台资料卡**，版本为 **0.9.1**，并且处于启用状态。

找不到拼图图标时，可按 `Win + R`，输入 `steam://extendium/manager` 打开管理器。菜单位置可能随版本或皮肤变化，加载方法以 [Extendium 项目文档](https://github.com/BossSloth/Extendium#manual-extension-installation)为准。

### 第四步：打开玩家资料验证

在 Steam 内打开自己或他人的**个人资料主页**，刷新页面，右侧应出现“CS 跨平台资料”卡片。先查看 5E 数据即可，无需登录平台。

支持的主页地址为 `https://steamcommunity.com/profiles/玩家SteamID` 或 `https://steamcommunity.com/id/玩家自定义地址`。商店、库存、市场及资料子页面不显示。游戏中点击“查看 Steam 个人资料”时，只有打开的是该主页且所在网页环境加载了扩展，才会显示；游戏内覆盖层兼容性仍需按实际环境确认。

## 4. 在 Chrome / Edge 中安装

1. 按第 2 节下载、解压资料卡。
2. Chrome 打开 `chrome://extensions`；Edge 打开 `edge://extensions`。
3. 开启开发者模式，点击“加载已解压的扩展程序”，选择 `extension` 文件夹。
4. 在**同一个浏览器**打开 Steam 玩家个人资料主页并刷新。

浏览器里安装的扩展不会自动出现在 Steam 内；要在 Steam 使用，请按第 3 节另外加载。

## 5. 日常使用与更新

- **刷新**：重新查询当前玩家；**复制 ID**：复制当前玩家的 SteamID64；**设置**：打开插件设置页。
- **5E 赛季下拉菜单**：选择赛季后加载对应战绩；封禁状态始终是当前账号状态，不是所选赛季的历史处罚。
- `—` 表示没有可展示的数据，“未知”表示尚不能判断；不能据此判定账号没有封禁。
- **更新**：重新下载仓库，覆盖原目录内的扩展文件（包括 `vendor`），在原来的扩展管理页面点击重新加载，再刷新资料主页。不需要重装 Millennium / Extendium。
- 更新后关闭旧设置页再打开，确认版本为 0.9.1；若权限未更新，可移除旧资料卡后重新加载 `extension`。重新加载会清除插件会话，需要重新连接本机辅助程序。

## 6. 完美扫码试验功能（可选）

**这一节不是查询 5E 的必做步骤。**当前仅验证了二维码申请、等待状态与取消流程，尚未确认真实手机扫码后的登录和战绩查询能成功，完美封禁仍未接通。如果 App 提示二维码不可用，不要反复登录或发送手机号、验证码、Cookie、token；请在 Issue 中反馈脱敏后的报错。

1. 从 [Node.js 官网](https://nodejs.org/)安装当前 LTS 版本。
2. 双击解压目录中的 `helper/Start.cmd`，保持辅助程序窗口开启。
3. 复制窗口中显示的 64 位本机连接码。在资料卡点击“设置”，将它填入“本机连接码”，点击“连接本机辅助程序”。**这是随机配对码，不是完美账号 token，不需要抓包。**
4. 连接成功后，点击“生成登录二维码”。
5. 使用完美世界电竞 App 的扫一扫扫描，并在手机上确认本次登录；这条真实登录链路仍待验证。
6. 只有插件显示“战绩验证成功”才说明战绩接口验证通过；只显示“收到令牌”不能确认能查数据。回资料主页点击刷新查看结果。

程序关闭或电脑重启后，需要重新启动并填写新的连接码。插件无需手机号、短信验证码或 Steam 密码，也不会自动读取你在完美官网已有的网页登录凭证。

## 7. 常见问题

| 问题 | 检查方法 |
|---|---|
| Steam 没有拼图图标 | 确认 Extendium 已启用、保存后重启；尝试 `Win + R` → `steam://extendium/manager` |
| 提示找不到 manifest.json | 先解压 ZIP，再选择 `extension`，不要选择外层目录 |
| Chrome 能显示，Steam 不能显示 | 两个环境需要分别安装；确认 Steam 内加载的扩展已启用 |
| 页面没有资料卡 | 确认是个人资料主页，扩展已启用，安装后刷新；其他 Steam 页面不显示 |
| 5E 数据空白 | 可能未绑定 5E、无对应赛季对局或接口暂时不可用；查看卡片提示并刷新 |
| 完美封禁显示未知 | 当前未接通，安装或登录不能解决这一项 |
| 扫码接口 HTTP 403 | Steam 环境可尝试先连接本机辅助程序；连接成功也不保证 App 登录成功 |
| 辅助程序提示找不到 Node.js | 安装 Node.js LTS 后重新双击 `Start.cmd` |
| 无法连接本机辅助程序 | 确认窗口未关闭、使用本次新连接码，并检查端口 27843 是否被其他程序占用 |
| App 提示二维码不可用 | 当前真实扫码尚未验证；可反馈报错，不要把登录凭证贴到公开 Issue |

## 8. 开发与技术说明

以下为接口实现、测试范围与数据处理说明，普通安装用户无需操作。

在仓库根目录执行 `npm test` 可运行自动测试；`npm run preview` 启动界面预览，预览不代表已查到真实平台数据。

### v0.9.1 二维码修复

0.9.0 使用 URL.href 重新生成二维码内容，给官方 news.wmpvp.com? 地址额外插入了 /，变成 news.wmpvp.com/?。现在只用 URL 解析做校验，二维码原样编码官方返回的 accessUrl。使用独立 jsQR 解码器确认实际二维码与原始地址逐字符一致；尚未用真人 App 验证扫描登录。官方 type=upgrade 地址包含原生扫码参数，其网页回退提示不能单独证明票据无效。

## 本次测试和限制

用户 0.8.1 诊断显示新版后台和请求规则已加载，但 Steam 请求仍得到 HTTP 403 / Invalid CORS request。因此不继续把“规则存在”解释为已修复。

2026-09-30，已测试实际 Edge 扩展 → 已配对本机程序 → 官方二维码申请、等待状态、取消扫码的完整链路。测试关闭了浏览器直接请求 passport.pwesports.cn 的路径，本机链路仍能工作。没有执行真人扫码、手机确认或账号登录，尚不能保证确认后的 token 能查询战绩。Steam 用户端的本机连接仍需确认。

完美封禁仍未接通，不把登录成功解释为可以查封禁。

## 本机程序的数据处理

只监听 127.0.0.1:27843，不监听局域网地址。请求必须包含本次随机连接码；只有三个固定操作可访问官方服务，不接受任意目标 URL：

- qrStart：POST https://passport.pwesports.cn/qrAuth/applyToken，固定 appId=5、qrType=1、website=pvp、redirect=false。
- qrCheck：POST https://passport.pwesports.cn/qrAuth/check，提交本次二维码票据。
- stats：POST https://api.wmpvp.com/api/csgo/home/pvp/detailStats，提交已验证的 SteamID 和账号令牌。

程序使用 Node.js 的 HTTPS 请求，不附加浏览器 Origin，不关闭 TLS 校验。连接码、二维码票据和账号令牌不写入磁盘、不输出日志。辅助程序只在处理请求时转发令牌，不维护账号会话；插件仍将令牌保存在扩展 storage.session 中，不返回 Steam 内容脚本。所有二维码在本机编码，不调用第三方二维码服务。

本机服务允许跨域读取，但没有 Cookie 或其他自动附带的身份，每个 POST 都需要 256 位随机连接码。连接码只显示在你启动的窗口中，并在插件配对时保存到会话存储。不要把辅助程序窗口的连接码发给其他人。诊断按钮不会输出连接码或账号令牌。

## 完美登录判定

只接受官方返回的 https://news.wmpvp.com/ 二维码地址，并检查路径、票据及 website、qrType。每两秒查询状态，最多等待两分钟。确认响应必须包含有效令牌和绑定 SteamID；保存前会用 detailStats 验证绑定账号。只有 statusCode=0 且响应 steamId 精确匹配才显示战绩验证成功。

页面会区分“收到令牌”和“战绩验证成功”。失败时展示公开搜索资料，不伪造战绩；封禁保持未知。手机需要使用完美世界电竞 App，不是微信或 Steam 扫码。插件无需手机号、短信验证码、Steam 密码，也不跳转 partner.wmpvp.com。

## 5E 段位与赛季

字母段位依据官方接口的 level_id，并参考官网 LevelElo 组件及官方段位图片映射，保留 D、C/C+/C++、B/B+/B++、A/A+/A++、S、SS、SSS 和 TOP 标记。S 至 SSS 同时显示接口返回的星数。不会按 ELO 猜段位；未知等级显示 —，定级状态显示未定级。旧版段位编号按旧体系处理。

官方 2026 规则说明：https://csgo.5eplay.com/article/260107gf3a04 。官方图片目录：https://oss-arena.5eplay.com/ya_static/images/common/level_2026/ 。已核对官网脚本的 41–55 等级及相应图标。

当前资料和历史赛季分别使用对应 level_id、star_num。测试账号当前 2026s4 为 S · 4星，2026s3 为 S · 8星；分数仍保留作参考。赛季列表来自 season_list，历史来自 player/season，绑定确认的 UUID、赛季、CS2/CS:GO 类型及当前比赛模式。按选择加载，缓存 60 秒；无对局时不显示默认分数或默认段位。

历史接口没有死亡数时 KD 显示 —。封禁为当前账号状态，不是历史赛季处罚。快速切换赛季或离开主页，迟到响应不会覆盖当前显示。

## 查询结果

| 功能 | 状态 |
|---|---|
| 5E 账号封禁 | 免登录；已核验两个封禁账号和一个正常账号 |
| 5E 分数、Rating、段位、赛季菜单 | 免登录，已接入 |
| 完美昵称 | 可按 SteamID 精确匹配 |
| 完美天梯分、PW Rating、KD、场次 | 已实现令牌请求；真人扫码后能否查询待验证 |
| 完美指定玩家封禁 | 未接通 |

5E 封禁采用 userinterface/header 的 account_status 和有效限制时间，不采用 home 的比赛状态或空处罚记录。-4 显示作弊封禁；关联作弊、风控、违规、恶意行为分别标记。状态正常显示“未显示封禁”，不表示历史从未受罚。未知枚举保持未知。

76561199018531013、76561198992421492 返回 -4，与 https://csgo.5eplay.com/article/260909wjn5ox 官方公告一致；76561198098647336 返回正常状态。

## 验证与来源

21 项自动检查通过，包含本机鉴权、固定接口限制、登录页面权限隔离、令牌不回传、取消丢弃迟到结果、账号匹配、段位及赛季查询。浏览器测试验证本机二维码链路、字母段位、历史切换和资料主页限制。真实扫码后的登录与战绩尚未验证。

扫码接口参考：https://github.com/Agnes4m/CS2UID/blob/main/CS2UID/utils/api/login.py （社区源码，不是官方第三方授权文档）。战绩参考：https://github.com/Redamancy520/PerfectWorld-API-Collection 。二维码编码器为 qrcode-generator js2.0.4，MIT 许可证随 vendor 目录附带。

“未知”不等于未封禁。PW Rating 与 5E Rating 统计口径不同。

