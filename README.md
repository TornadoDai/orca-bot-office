# Bot Office — Orca Plugin

An ultra-lightweight **2.5D Isometric AI HQ & Grouped Workbench** for Orca's right sidebar. Track every Bot team, their Worker robots, gliding mail dispatches, stall alerts, and native **Needs-You** decisions with near-zero GPU/CPU overhead.

[中文说明](#中文说明)

![Bot Office Preview](assets/screenshot.png)

## Features

- **True 2.5D Isometric `<canvas>` Office**: Architectural cutaway diorama with distinct glass-partitioned **Team Studio Pods**, executive desks, multi-row Worker bays (auto-expanding with zero truncation), panoramic night-city windows, and a cozy **Open Workspace & Coffee Lounge** (with velvet sofas, espresso bar, and an office cat).
- **Live Mail Envelopes (`✉️`)**: Crisp miniature envelopes glide smoothly between Lead Bots and active Workers (and across teams during handoffs) to visualize real task dispatches and alerts — zero messy wires.
- **Synced 1:1 with Orca Native `Needs you` Items**: Red dots strictly track real non-snoozed Bot `Needs you` decisions and Worker approval blockers. Click a **red dot** to jump straight to that Bot; click a character for a crisp preview card with `★` recommended options, PR/Issue links, and recent activity timeline.
- **Built for Daily Speed**: Search & engine filters (`Claude`, `Antigravity`, `Codex`, `Pi`), running duration & **>10m no-progress stall alerts**, auto-collapse for stale `24h+` idle Workers, wheel zoom / drag pan, hover team highlighting, and an **Office | List** grouped workbench toggle.
- **Ultra-Lightweight Architecture**: Zero `backdrop-filter` blur passes, zero infinite 60 FPS CSS animations, offscreen static canvas caching, adaptive 0–10 FPS tick (auto-pauses when hidden), and hash-diffed event-driven worker polling.

## Install

```bash
orca plugin install TornadoDai/orca-bot-office
```

Or in Orca: **Settings → Plugins → Install from Git** with `https://github.com/TornadoDai/orca-bot-office`.

## Settings

| Setting | Default | Description |
| --- | --- | --- |
| `refreshIntervalSeconds` | `25` | Background fallback refresh interval (8–120s) |
| `soloBotsInLounge` | `true` | Group solo Bots (0 Workers) in the Open Workspace & Coffee Lounge |
| `hideStaleIdleHours` | `24` | Auto-collapse idle Workers older than N hours (`0` = show all) |
| `showStandaloneWorkspaces` | `true` | Show non-Bot workspaces in the collapsible B1 Hot-Desk bar |
| `language` | `auto` | UI language (`auto`, `en`, `zh`) |

---

## 中文说明

挂在 Orca 右侧栏的**超轻量 2.5D 等距立体「AI 总部大楼」+ 分组工作台插件（Bot 工位）**。

- **真 2.5D 等距立体 `<canvas>` 办公室**：每个带 Worker 的 Bot 拥有独立配色与玻璃隔断的团队工区（支持 Worker 数量无上限自动扩排、超过 24 小时旧闲置自动折叠），单兵 Bot 自动入驻咖啡茶水间与开放工区（带沙发、咖啡吧台和办公室小猫）。
- **信件传递可视化（✉️）**：主管与活跃 Worker 之间、或跨 Bot 交接时，小信封沿立体空间平滑飞递（蓝=派活 / 绿=回报 / 红=紧急审批），干净直观、无杂乱线条。
- **红点严格对齐原生 `Needs you` 决策事件**：点红点一步直跳对应 Bot 原生界面直接选；单击角色看完整决策摘要、PR/Issue 链接、最近多条动态与运行耗时（超过 10 分钟无新进展自动标黄预警）。
- **极度轻量**：零 `backdrop-filter` 模糊、零 60 FPS 死循环 CSS 动画、静态建筑离屏缓存 + 静止时 0 FPS / 活跃时 ≤10 FPS + 后台哈希去重与事件驱动刷新。

### 安装方式

```bash
orca plugin install TornadoDai/orca-bot-office
```

## License

MIT
