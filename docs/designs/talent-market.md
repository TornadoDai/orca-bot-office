# Bot Office Talent Market（人才市场）设计文档

## 1. 目标与范围
将「人才市场」打造为 Bot Office 内的旗舰子应用（插件里的插件），形成 **逛市场 → 一键招聘入职 Orca → 进入 2.5D 大楼上班 → 看板监控与决策** 的完整闭环。

- **Bot 包本体**：由 Orca 官方云端原生托管（用户在 Orca 点 Share Bot 后生成 `https://app.orca.dev/bots/share/<shareId>` / `orca://bots/share/<shareId>`），原生已完成凭据扫描与打包。
- **目录索引托管（方案 2A）**：
  - 主服务：独立仓库 `TornadoDai/orca-bot-market` 内的 **Cloudflare Worker + D1（SQLite）**，支持实时浏览、发布、一键点赞、招聘计数、举报和官方加精。
  - 兜底镜像：同仓库 `registry.json`（GitHub Action 定时同步），插件按 `Worker API → jsDelivr CDN → GitHub Pages → GitHub Raw` 自动降级，确保无代理直连环境也能逛市场与一键招聘。
- **不在范围内**：不托管用户 `SOUL.md` 全文或任何 Token/凭据；不绕过 Orca 原生共享 Bot 安全审查弹窗。

## 2. 醒目入口设计（三处联动）
1. **顶部旗舰胶囊按钮**：独立于 `楼层 | 仪表盘 | 列表` 灰色切换器之外，采用高辨识度渐变高亮胶囊 `🏪 人才市场` + 实时在招数量徽章，随时一键切入全屏商店界面。
2. **大楼首页可折叠「人才市场精选横条」**：位于 `TOP 决策汇报区` 正下方，平时展示最热门的 3 位在招 Bot（或首批上架引导）+「逛全部人才市场 →」按钮，支持一键折叠持久化，零侵入老用户日常工作区。
3. **TOP 招新前台 &「+ 招新」弹窗互通**：点击招新前台或打开招新弹窗时，顶部直接提供「逛人才市场，直接招现成 Bot」快捷入口。

## 3. 审核与信任策略（参考 Orca 插件机制）
- **自动准入校验**：
  - 严格校验 `shareId` 格式（`/^[A-Za-z0-9_-]{1,128}$/`），拒绝任意外部跳转 URL。
  - 发布时服务端探测 `https://app.orca.dev/bots/share/<shareId>` 存活性（无法访问/已停止分享则拦截），字段长度与敏感词校验，同 `shareId` 防重复上架。
- **分层信任标识**：
  - `community`（社区分享）：校验通过即上架，界面显示清晰「社区分享 · 招聘时将在 Orca 原生弹窗审查 SOUL / Skills / 权限」安全提示。
  - `verified`（官方精选）：管理员通过 `ADMIN_TOKEN` 核验后授予金色认证徽章并优先置顶。
- **风控与自动下架**：
  - 点赞按 `(bot_id, client_hash)` 唯一键去重；招聘计数按 `(bot_id, client_hash, day)` 去重；发布按 IP 限流（5 次/小时）。
  - 社区举报达到 3 个独立设备自动隐藏为 `flagged`，管理员可审核恢复或永久下架；支持定期巡检清理失效链接。

## 4. 接口契约（Cloudflare Worker）
- `GET /api/bots?q=&category=&sort=hot|likes|newest|verified&limit=60`：返回目录列表 + 统计汇总 + 当前 `client_hash` 已点赞 ID 集合。
- `POST /api/bots`：提交新 Bot（自动提取/校验 `shareId`、探测存活性、限流后入库）。
- `POST /api/bots/:id/like`：幂等切换点赞状态，返回 `{ liked, likesCount }`。
- `POST /api/bots/:id/hire`：记录一次招聘点击（按日去重），返回 `{ hiresCount }`。
- `POST /api/bots/:id/report`：举报失效或违规（`reason`），达到阈值自动隐藏。
- `POST /api/admin/bots/:id`（Bearer `ADMIN_TOKEN`）：设置 `trust`（`verified`/`community`）、`status`（`active`/`hidden`/`removed`）或 `featured`。

## 5. 客户端集成与一键招聘
- 新增 `worker/orca-market.mjs`：管理设备匿名 ID、API/镜像自动回退、读取本机 Bot 元数据（用于 10 秒自动回填发布表单）、以及 `openBotShareLink(shareId)`（系统唤起 `orca://bots/share/<shareId>`，失败时回退 `https://app.orca.dev/bots/share/<shareId>`）。
- 新增 `panel/market.css`、`panel/market.js`、`panel/market-modals.js`：独立视图渲染、卡片网格、详情弹窗与 10 秒发布弹窗，严格保持全项目单文件 ≤ 800 行、零 `backdrop-filter`、支持深浅双主题与中英双语。

## 6. 验收标准
- `orca-bot-market` 全部 API 单元测试通过（校验、去重、限流、自动隐藏、Admin 管理）。
- `orca-bot-office` 通过 `node --check`、`orca plugin validate .`、`orca plugin dev reload`，并在无头 Chromium 核对深/浅双主题渲染、搜索筛选、自动回填发布弹窗、点赞/招聘交互及 Cloudflare 不可达时自动降级 jsDelivr 镜像。
