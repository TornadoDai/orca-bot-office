# Bot Office — Orca Plugin

An ultra-lightweight **2.5D Side-Scrolling Stacked Office Tower & Grouped Workbench** for Orca's right sidebar. Bots needing your decision ride upstairs to queue in the **Decision & Report Queue**, while every team gets its own bright modern studio floor with crisp full-bodied sprites, unmistakable agent engine badges (`Claude`, `agy`, `Codex`, `Pi`), sleek luminous message streams, and near-zero GPU/CPU overhead.

[中文说明](#中文说明)

![Bot Office Preview](assets/screenshot.png)

## Features

- **2.5D Modern Office Tower Cutaway (`<canvas>`)**: Full-width horizontal studio floors framed by structural columns, recessed LED ceiling bars, floor-to-ceiling skyline curtain walls, glass office partitions, water coolers, whiteboards, filing cabinets, printers, and a cozy `1F` Open Workspace & Coffee Lounge.
- **Top Decision & Report Queue (`TOP`)**: Any Bot or Worker synced with Orca's native `Needs you` items (or terminal approval blockers) leaves its desk and queues neatly in front of the Review Desk holding a report clipboard. Click its soft-rose badge to jump straight to that Bot in Orca, or click the character for a clean preview card.
- **Crisp Characters & Agent Engine Identity**: Clear dark-outlined Bot figures and articulated Worker robots display color-coded engine badges (`✦ Claude`, `◈ agy`, `⬡ Codex`, `π Pi`) across uniforms, chest cores, visors, desk trims, and floor headers.
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

- **现代写字楼横版 2.5D 分层剖面**：告别暗色调盒子与拥挤菱形斜角，每层铺满侧栏宽度——建筑结构立柱、嵌入式办公 LED 灯带、落地玻璃幕墙窗景、铝合金玻璃隔断、饮水机/白板/文件柜打印机与楼层电梯间一应俱全；1F 为开放工区与咖啡茶水间。
- **顶层「决策汇报区」排队汇报**：凡是有原生 `Needs you` 待决策事件或终端等待审批的 Bot / Worker，会自动离开工位上楼，在决策台前举着汇报板整齐排队；楼下工位同步标示 `▲ 排队汇报中`。轻点柔和珊瑚红标一步直跳对应 Bot 原生界面决策。
- **清晰全身角色 & 代理一眼分辨**：为 Bot 人物与关节机器人补全深色描边、工装衣领/胸口核心徽标与手臂动作，所有工位与列表均挂载高辨识度配色代理徽章（`✦ Claude` 琥珀、`◈ agy` 天蓝、`⬡ Codex` 紫罗兰、`π Pi` 翠绿）。
- **轻量流光消息传递 & 柔和提醒**：用极简流光纸箭 + 渐隐光点轨迹替代厚重信封；全界面改用柔和珊瑚粉/玫瑰红提醒，醒目不刺眼。
- **极度轻量低占用**：零 `backdrop-filter`、零 60 FPS CSS 动画、静态背景离屏缓存 + 静止楼层 0 FPS / 活跃楼层 ≤6 FPS + 后台哈希去重。

### 安装方式

```bash
orca plugin install TornadoDai/orca-bot-office
```

## License

MIT
