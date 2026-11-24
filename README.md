# Bot Office — Orca Plugin

An ultra-lightweight **2.5D Side-Scrolling Stacked Office Tower & Grouped Workbench** for Orca's right sidebar. Bots needing your decision ride upstairs to queue in the **Decision & Report Queue**, while every team gets its own bright modern studio floor with crisp full-bodied sprites, unmistakable agent engine badges (`Claude`, `agy`, `Codex`, `Pi`), sleek luminous message streams, and near-zero GPU/CPU overhead.

[中文说明](#中文说明)

![Bot Office Preview](assets/screenshot.png)

## Features

- **Illustrated 2.5D Modern Office Tower (`<canvas>`)**: Warm painted high-rise office backdrops (wood-slat reception hallway, glass-partitioned startup studios with twilight skylines, whiteboards, water coolers, printers, bookshelves, and a cozy `1F` espresso café lounge) cached offscreen with 3D-shaded oak workstations.
- **Interactive Decision-First Card (`TOP` Report Queue)**: Any Bot or teammate synced with Orca's native `Needs you` items queues in front of the unlabeled center workstation (empty chair by default, or optional custom avatar via `ownerAvatarMode` / `ownerAvatarPath`) holding a report clipboard. Click to view the **exact active decision context** (full pagination matching `item.question.eventId`, clickable URLs, zero scroll clutter, timeline, workers & active **Branch Chats** collapsible), pick options, and hit **Enter** to route your answer straight back to that Bot's item chat.
- **Native Light & Dark Themes**: Automatically follows Orca's Light and Dark color schemes across the floor cards, SVG analytics charts, tables, and inspector modal.
- **Human-Styled Teammates & Agent Engine Identity**: Expressive human-styled colleagues (unique hairstyles, glasses/headphones, 3D-shaded outfits) and Lead Bots display color-coded engine badges (`✦ Claude`, `◈ agy`, `⬡ Codex`, `π Pi`) everywhere at a glance.
- **Sleek Luminous Message Streams**: Minimalist glowing paper-dart packets with fading light trails glide smoothly between Lead Bots and active Workers — clean, airy, and readable.
- **Charts-First Team Workload & Token Dashboard (`Floors | Dashboard | List`)**: Pure-SVG right-sidebar data panel synced live with the Engine & Search filters — KPI cards, Team Key Metrics bar chart, 7-day delivery pace, Engine Mix donut, CLI Token/message rankings (`history:read`), followed by clickable team workload & dispatch tables.
- **Ultra-Lightweight Architecture**: Zero `backdrop-filter` blur passes, zero external chart libraries, zero infinite CSS animations, offscreen static floor background cache, 0 FPS on idle floors / ≤3.5 FPS only on active floors (auto-pauses when hidden), and hash-diffed event-driven worker updates.

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
| `ownerAvatarMode` | `empty` | Top-floor center chair display (`empty` invisible, `custom` image, `silhouette`) |
| `ownerAvatarPath` | `""` | Local image path used when `ownerAvatarMode` is `custom` |
| `language` | `auto` | UI language (`auto`, `en`, `zh`) |

---

## 中文说明

挂在 Orca 右侧栏的**超轻量 2.5D 横版平面分层「AI 总部大楼」+ 分组工作台插件（Bot 工位）**。

- **真实立体感现代写字楼插画分层**：采用 2.5D 精绘暖光写字楼室内实景底图（原木格栅走廊、玻璃隔断研发工作室、落地幕墙夜景、白板/饮水机/打印机/绿植书架、1F 意式咖啡吧台）+ 立体木纹工位，离屏缓存零渲染负担。
- **顶层「决策汇报区」+ 卡片内直接决策回复**：中央设置无文字原木工位（默认空椅隐形，可在插件设置里自定义头像 `ownerAvatarMode` / `ownerAvatarPath`），所有待决策 Bot 整齐在前方排队汇报；点开卡片精确匹配当前最新待决策事件（完整翻页，不串旧问题），完整呈现未截断上下文（外链可点，动态、团队与活跃**分支聊天**默认折叠），支持直接点选选项或按回车将答复发回对应 Bot 聊天继续推进。
- **原生浅色 / 深色双主题**：顶栏、楼层卡片、仪表盘 SVG 图表与详情卡片全部响应 Orca 浅色与深色主题切换。
- **拟人化团队成员 & 代理一眼分辨**：Worker 升级为带不同发型、眼镜/耳机与立体光影穿搭的研发同事形象，搭配高辨识度配色代理徽章（`✦ Claude` 琥珀、`◈ agy` 天蓝、`⬡ Codex` 紫罗兰、`π Pi` 翠绿）。
- **轻量流光消息传递 & 柔和提醒**：用极简流光纸箭 + 渐隐光点轨迹替代厚重信封；全界面改用柔和珊瑚粉/玫瑰红提醒，醒目不刺眼。
- **图表优先的团队工作量仪表盘（楼层 | 仪表盘 | 列表）**：顶栏代理/搜索/仅在忙筛选同步联动楼层、仪表盘与列表；图表前置（各团队核心指标对比柱图 + 近 7 天节奏 + 代理占比环图 + Token 排行），详细团队明细在后，纯 SVG 零依赖。
- **极度轻量低占用**：零 `backdrop-filter`、零 60 FPS CSS 动画、静态底图离屏缓存 + 静止楼层 0 FPS / 活跃楼层 ~3.5 FPS + 仪表盘按需 60s 缓存。

### 安装方式

```bash
orca plugin install TornadoDai/orca-bot-office
```

## License

MIT
