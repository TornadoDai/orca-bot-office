# Bot Office — Orca Plugin

An architectural cutaway **Bot Office & Grouped Workbench** for Orca's right sidebar. See every Bot, their Workers, what everyone is doing, and every native **Needs-You** decision item at a glance.

[中文说明](#中文说明)

![Bot Office Preview](assets/screenshot.png)

## Features

- **Office & Grouped List Views**: Switch between the multi-story architectural cutaway office and a grouped workbench (`Needs Your Decision → Working → Idle`), with a live 3-bucket header and bottom status/engine legend.
- **Synced 1:1 with Orca Native `Needs you` Items**: Red notification dots and counters strictly track each Bot's active (non-snoozed) native `Needs you` decision items and real Worker approval blockers — no noisy unread-chat false alarms.
- **Interactive Decision & Inspector Card**: Click any Bot or Worker to view full task details, read every `Needs you` question with selectable options (`Recommended` badges included), copy your formatted decision, and jump straight to the Bot or Worker in one click (double-click to jump immediately).
- **Unlimited Multi-Row Team Scaling**: Teams with 4+ Workers automatically expand into clean multi-row open bays (3 wooden desks per row, no truncation), and 1F Open Workspace & Coffee Lounge automatically expands for solo Bots.
- **In-Panel Decision Toasts & Zero Config**: New `Needs you` items trigger a clickable toast in the bottom-right corner; 6 deterministic studio themes and automatic English / Chinese UI (`window.orca.locale`) work out of the box.

## Install

```bash
orca plugin install TornadoDai/orca-bot-office
```

Or in Orca: **Settings → Plugins → Install from Git** with `https://github.com/TornadoDai/orca-bot-office`.

## Settings

| Setting | Default | Description |
| --- | --- | --- |
| `refreshIntervalSeconds` | `8` | Background fallback refresh interval (3–120s) |
| `soloBotsInLounge` | `true` | Group solo Bots (0 Workers) on 1F Open Workspace & Lounge |
| `showStandaloneWorkspaces` | `true` | Show non-Bot workspaces in the collapsible B1 Hot-Desk bar |
| `language` | `auto` | UI language (`auto`, `en`, `zh`) |

---

## 中文说明

挂在 Orca 右侧栏的**立体剖面「Bot 办公室」+ 分组工作台插件**，一眼看清所有 Bot 主管、Worker 动态以及需要你拍板的原生决策事件。

- **「办公室 / 列表」双视图**：保留干净无杂线的多楼层剖面工作室（支持 Worker 数量无上限自动扩排、1F 开放工区与沙发茶水间），同时支持一键切到按 **需要你决策 → 工作中 → 待命中** 分组的列表工作台。
- **红点严格对齐 Orca 原生 `Needs you` 决策事件**：直接读取每个 Bot 的真实待决策事件（排除已延后项）与 Worker 真实审批阻塞，不再因普通未读消息误亮红点；有新决策到达时右下角弹出页内提醒。
- **点击卡片内预选决策 & 一键直达**：单击任意角色弹窗查看完整任务上下文、原生 `Needs you` 问题与推荐选项，在卡片里点选好决策后一键复制并直达该 Bot 提交确认（双击角色可直接秒跳工作区）。

### 安装方式

```bash
orca plugin install TornadoDai/orca-bot-office
```

## License

MIT
