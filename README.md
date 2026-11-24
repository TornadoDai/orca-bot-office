# Bot Office — Orca Plugin

An ultra-lightweight **2.5D Side-Scrolling Stacked Office Tower & Grouped Workbench** for Orca's right sidebar. Bots needing your decision ride upstairs to queue in the **Decision & Report Queue**, while every team gets its own bright modern studio floor with crisp full-bodied sprites, unmistakable agent engine badges (`Claude`, `agy`, `Codex`, `Pi`), sleek luminous message streams, and near-zero GPU/CPU overhead.

[中文说明](#中文说明)

![Bot Office Preview](assets/screenshot.png)

## Features

- **Illustrated 2.5D Modern Office Tower (`<canvas>`)**: Warm painted high-rise office backdrops (wood-slat reception hallway, glass-partitioned startup studios with twilight skylines, whiteboards, water coolers, printers, bookshelves, and a cozy `1F` espresso café lounge) cached offscreen with 3D-shaded oak workstations.
- **Clean Decision & Report Queue (`TOP`)**: Any Bot or teammate synced with Orca's native `Needs you` items (or approval blockers) queues neatly across the top reception hallway holding a report clipboard — click its soft-rose badge to jump straight to that Bot in Orca.
- **Human-Styled Teammates & Agent Engine Identity**: Expressive human-styled colleagues (unique hairstyles, glasses/headphones, 3D-shaded outfits) and Lead Bots display color-coded engine badges (`✦ Claude`, `◈ agy`, `⬡ Codex`, `π Pi`) everywhere at a glance.
- **Sleek Luminous Message Streams**: Minimalist glowing paper-dart packets with fading light trails glide smoothly between Lead Bots and active Workers — clean, airy, and readable.
- **Ultra-Lightweight Architecture**: Zero `backdrop-filter` blur passes, zero infinite CSS animations, offscreen static floor background cache, 0 FPS on idle floors / ≤6 FPS only on active floors (auto-pauses when hidden), and hash-diffed event-driven worker updates.

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

挂在 Orca 右侧栏的**超轻量 2.5D 横版平面分层「AI 总部大楼」+ 分组工作台插件（Bot 工位）**。

- **真实立体感现代写字楼插画分层**：采用 2.5D 精绘暖光写字楼室内实景底图（原木格栅走廊、玻璃隔断研发工作室、落地幕墙夜景、白板/饮水机/打印机/绿植书架、1F 意式咖啡吧台）+ 立体木纹工位，离屏缓存零渲染负担。
- **纯净顶层「决策汇报区」排队**：去掉多余办公桌，凡是有原生 `Needs you` 待决策事件或终端等待审批的 Bot / Worker 自动上楼横向整齐排队汇报，楼下工位同步标示 `▲ 排队汇报中`；点柔和红标直达原生界面决策。
- **拟人化团队成员 & 代理一眼分辨**：Worker 升级为带不同发型、眼镜/耳机与立体光影穿搭的研发同事形象，搭配高辨识度配色代理徽章（`✦ Claude` 琥珀、`◈ agy` 天蓝、`⬡ Codex` 紫罗兰、`π Pi` 翠绿）。
- **轻量流光消息传递 & 柔和提醒**：用极简流光纸箭 + 渐隐光点轨迹替代厚重信封；全界面改用柔和珊瑚粉/玫瑰红提醒，醒目不刺眼。
- **极度轻量低占用**：零 `backdrop-filter`、零 60 FPS CSS 动画、静态背景离屏缓存 + 静止楼层 0 FPS / 活跃楼层 ≤6 FPS + 后台哈希去重。

### 安装方式

```bash
orca plugin install TornadoDai/orca-bot-office
```

## License

MIT
