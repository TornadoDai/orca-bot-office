# Bot Office — Orca Plugin

An architectural cutaway **AI Headquarters** panel for Orca's right sidebar. See every Bot, their Workers, what everyone is working on, and who needs your attention at a glance — click anyone to inspect and jump right in.

[中文说明](#中文说明)

![Bot Office Preview](assets/screenshot.png)

## Features

- **Cutaway Multi-Story Office**: Every Bot team with Workers gets its own studio floor (Lead Bot in a glass office on the left, Worker robots seated behind walnut wooden desks on the right with live dispatch wires and glowing screens).
- **Unlimited Multi-Row Scaling**: Teams with 4+ Workers automatically expand into clean multi-row open bays (3 desks per row, no truncation), always prioritizing Workers that need you or are actively running.
- **1F Open Workspace & Coffee Lounge**: Solo Bots (0 Workers) automatically gather on 1F — active ones at hot-desks, idle ones relaxing on plush velvet sofas (configurable to give every Bot its own floor).
- **Red Notification Dots**: Any Bot or Worker waiting for approval, blocked, or with unread updates gets a pulsing **red dot** above their head plus a quick-jump counter in the top bar.
- **Click-to-Inspect Card**: Click any Bot or Worker to pop open an inspector card showing full current task details, tool calls, team worker status, and a one-click **Handle Now / Open Workspace** button (double-click to jump immediately).
- **Zero Configuration & Bilingual**: Automatically adapts to any Orca setup with 6 deterministic studio themes and automatic English / Chinese UI (`window.orca.locale`).

## Install

### From GitHub (Orca CLI)

```bash
orca plugin install TornadoDai/orca-bot-office
```

Or in Orca: **Settings → Plugins → Install from Git** with:

```
https://github.com/TornadoDai/orca-bot-office
```

*(Also tagged with `orca-plugin` for automatic listing in Orca Community Plugins.)*

## Settings

| Setting | Default | Description |
| --- | --- | --- |
| `refreshIntervalSeconds` | `8` | Background fallback refresh interval (3–120s) |
| `soloBotsInLounge` | `true` | Group solo Bots (0 Workers) on 1F Open Workspace & Lounge |
| `showStandaloneWorkspaces` | `true` | Show non-Bot workspaces in the collapsible B1 Hot-Desk bar |
| `language` | `auto` | UI language (`auto`, `en`, `zh`) |

---

## 中文说明

挂在 Orca 右侧栏的**立体剖面「AI 总部大楼」插件**，一眼看清所有 Bot 主管和 Worker 正在干什么、谁需要你处理。

- **每组一层真实工作室**：带 Worker 的 Bot 自动拥有独立楼层（左侧玻璃隔断主管间 + 右侧多排开放木桌工位），支持 **Worker 数量无上限自动扩排**（每排 3 桌，永不截断，待处理/干活中优先排前排）。
- **1F 开放工区 & 咖啡茶水间**：未派 Worker 的单兵 Bot 自动归入 1F，干活坐工位、空闲躺沙发（也可在插件设置里切换为每个 Bot 独立一层）。
- **红点提醒 & 点击弹窗卡片**：需要你审批、卡住或有未读消息的 Bot / Worker 头上亮起**脉冲红点**；单击任意角色弹出详情卡片查看完整任务上下文，点「立即进去处理」直达对应工作区和终端（双击也可秒跳）。
- **开箱即用**：无任何硬编码配置，自动适配任意数量的 Bot / Worker，支持中英文自动切换。

### 安装方式

```bash
orca plugin install TornadoDai/orca-bot-office
```

## License

MIT
