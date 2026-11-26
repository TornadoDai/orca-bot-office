import { spawn } from "node:child_process";
import { collectOfficeAnalytics } from "./orca-analytics.mjs";
import { collectBotAvatars } from "./orca-avatars.mjs";
import {
  fetchMarketCatalog,
  getOrCreateClientId,
  openOrcaBotShareDeepLink,
  postMarketAction,
} from "./orca-market.mjs";
import { buildRandomMascotAvatar, prepareLocalBotShareDraft } from "./orca-sanitizer.mjs";
import {
  buildExecEnv,
  collectOfficeSnapshot,
  computeSnapshotHash,
  locateOrcaBinary,
  runOrcaJson,
} from "./orca-data.mjs";

let pollTimer = null;
let debounceTimer = null;

function formatStatusBar(summary) {
  const activeBots = summary.workingBots || 0;
  const totalBots = summary.totalBots || 0;
  const workers = summary.workingWorkers || 0;
  const decisions = summary.decisionCount || 0;

  const parts = [`${activeBots}/${totalBots}`];
  if (workers > 0) parts.push(`${workers}w`);
  if (decisions > 0) parts.push(`🔴 ${decisions}`);

  let tone = "neutral";
  if (decisions > 0) tone = "danger";
  else if (activeBots > 0 || workers > 0) tone = "accent";

  return {
    id: "bot-office-status",
    icon: "bot",
    text: parts.join(" · "),
    tone,
    tooltip: `Bot Office: ${activeBots}/${totalBots} active, ${workers}/${summary.totalWorkers || 0} workers running, ${decisions} decisions waiting`,
    visible: true,
  };
}

export default function activate(orca) {
  const orcaBin = locateOrcaBinary(process.env);
  let latestSnapshot = null;
  let lastBroadcastHash = "";
  let refreshing = null;
  let resolvedPluginKey = null;

  async function readOptions() {
    const interval = Number((await orca.settings?.get?.("refreshIntervalSeconds").catch(() => 25)) || 25);
    const showStandalone = (await orca.settings?.get?.("showStandaloneWorkspaces").catch(() => true)) !== false;
    const soloBotsInLounge = (await orca.settings?.get?.("soloBotsInLounge").catch(() => true)) !== false;
    const hideStaleIdleHours = Number((await orca.settings?.get?.("hideStaleIdleHours").catch(() => 24)) ?? 24);
    const language = String((await orca.settings?.get?.("language").catch(() => "auto")) || "auto");
    const ownerAvatarMode = String((await orca.settings?.get?.("ownerAvatarMode").catch(() => "empty")) || "empty");
    const ownerAvatarPath = String((await orca.settings?.get?.("ownerAvatarPath").catch(() => "")) || "");
    const hrBotName = String((await orca.settings?.get?.("hrBotName").catch(() => "")) || "");
    const marketApiUrl = String((await orca.settings?.get?.("marketApiUrl").catch(() => "")) || "");
    const dashModules = {
      tokenDetails: (await orca.settings?.get?.("dashShowTokenDetails").catch(() => true)) !== false,
      branchChats: (await orca.settings?.get?.("dashShowBranchChats").catch(() => true)) !== false,
      automations: (await orca.settings?.get?.("dashShowAutomations").catch(() => true)) !== false,
      linkedRefs: (await orca.settings?.get?.("dashShowLinkedRefs").catch(() => true)) !== false,
      diagnostics: (await orca.settings?.get?.("dashShowDiagnostics").catch(() => true)) !== false,
    };
    return {
      intervalMs: Math.max(8, Math.min(120, interval)) * 1000,
      showStandalone,
      soloBotsInLounge,
      hideStaleIdleHours: Math.max(0, Math.min(168, hideStaleIdleHours)),
      language,
      ownerAvatarMode,
      ownerAvatarPath,
      hrBotName,
      marketApiUrl,
      dashModules,
    };
  }

  async function resolveOwnPluginKey() {
    if (resolvedPluginKey) return resolvedPluginKey;
    try {
      const res = await runOrcaJson(orcaBin, ["plugin", "list"]);
      const plugins = Array.isArray(res?.plugins) ? res.plugins : [];
      const match =
        plugins.find(
          (p) =>
            p?.status === "running" &&
            typeof p?.pluginKey === "string" &&
            p.pluginKey.endsWith(".bot-office")
        ) ||
        plugins.find((p) => typeof p?.pluginKey === "string" && p.pluginKey.endsWith(".bot-office"));
      if (match?.pluginKey) {
        resolvedPluginKey = match.pluginKey;
        return resolvedPluginKey;
      }
    } catch {
      // Fallback below
    }
    return "tornadodai.bot-office";
  }

  async function refresh(broadcast = true, { forceItems = false } = {}) {
    if (refreshing) return refreshing;
    refreshing = (async () => {
      try {
        const opts = await readOptions();
        const snap = await collectOfficeSnapshot(orcaBin, {
          showStandalone: opts.showStandalone,
          forceItems,
        });
        snap.settings = {
          soloBotsInLounge: opts.soloBotsInLounge,
          showStandalone: opts.showStandalone,
          hideStaleIdleHours: opts.hideStaleIdleHours,
          language: opts.language,
          ownerAvatarMode: opts.ownerAvatarMode,
          hrBotName: opts.hrBotName,
          marketApiUrl: opts.marketApiUrl,
          dashModules: opts.dashModules,
        };
        const hash = computeSnapshotHash(snap);
        const changed = hash !== lastBroadcastHash;
        latestSnapshot = snap;

        if (changed || forceItems) {
          lastBroadcastHash = hash;
          await orca.host.call("statusBar.update", formatStatusBar(snap.summary)).catch(() => {});
          if (broadcast) {
            orca.panels.post("office.snapshot", snap);
          }
        }
        return snap;
      } catch (err) {
        orca.log?.(`bot-office refresh failed: ${err?.message || err}`);
        return latestSnapshot;
      } finally {
        refreshing = null;
      }
    })();
    return refreshing;
  }

  function scheduleRefresh(delayMs = 650, forceItems = false) {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      void refresh(true, { forceItems });
    }, delayMs);
  }

  async function resetPollTimer() {
    if (pollTimer) clearInterval(pollTimer);
    const { intervalMs } = await readOptions();
    pollTimer = setInterval(() => {
      void refresh(true, { forceItems: false });
    }, intervalMs);
  }

  orca.panels.handle("office.getSnapshot", async (input = {}) => {
    if (!input.force && latestSnapshot && Date.now() - latestSnapshot.updatedAt < 5000) {
      return latestSnapshot;
    }
    return await refresh(false, { forceItems: Boolean(input.force) });
  });

  orca.panels.handle("office.getAvatars", async () => {
    const opts = await readOptions();
    const extraBotPaths = Array.isArray(latestSnapshot?.bots)
      ? latestSnapshot.bots.map((b) => b.path).filter(Boolean)
      : [];
    const avs = await collectBotAvatars({
      orcaBin,
      ownerAvatarPath: opts.ownerAvatarPath,
      extraBotPaths,
    });
    const storedOwner = await orca.storage?.get?.("ownerAvatarDataUrl").catch(() => null);
    if (typeof storedOwner === "string" && storedOwner.startsWith("data:image/")) {
      avs.__owner__ = storedOwner;
    }
    return avs;
  });

  const VALID_OWNER_MODES = new Set([
    "empty", "custom", "silhouette",
    "preset:exec-m", "preset:exec-f", "preset:hoodie",
    "preset:cat", "preset:shiba", "preset:astro", "preset:robot",
  ]);
  orca.panels.handle("office.setOwnerAvatar", async (input = {}) => {
    const mode = VALID_OWNER_MODES.has(input.mode) ? input.mode : "empty";
    await orca.settings?.set?.("ownerAvatarMode", mode);
    if (input.clearImage) {
      await orca.storage?.delete?.("ownerAvatarDataUrl").catch(() => {});
    } else if (typeof input.dataUrl === "string" && input.dataUrl.startsWith("data:image/") && input.dataUrl.length < 180000) {
      await orca.storage?.set?.("ownerAvatarDataUrl", input.dataUrl);
    }
    scheduleRefresh(150, true);
    return { ok: true, mode };
  });

  orca.panels.handle("office.hireBot", async (input = {}) => {
    const hrBotName = String(input.hrBotName || "").trim();
    const hrWorktreeId = String(input.hrWorktreeId || "").trim();
    const mode = input.mode === "discuss" ? "discuss" : "offer";
    const name = String(input.name || "").trim();
    const purpose = String(input.purpose || "").trim();
    const template = String(input.template || "").trim();
    const worktree = String(input.worktree || "").trim();
    const watches = String(input.watches || "").trim();
    const doesText = String(input.doesText || "").trim();
    const reports = String(input.reports || "").trim();
    const soulMd = String(input.soulMd || "").trim().slice(0, 3500);
    const bundle = input.bundle && typeof input.bundle === "object" ? input.bundle : null;
    const isZh = input.lang === "zh";
    if (!hrBotName) throw new Error("hrBotName is required");

    const lines = [];
    if (mode === "offer") {
      lines.push(isZh ? "【Owner 在 Bot Office 发起了新 Bot 创建请求（直接出创建卡）】" : "[Owner requested a new Bot from Bot Office — Direct Create Card]");
      if (name) lines.push(`${isZh ? "名称" : "Name"}: ${name}`);
      if (purpose) lines.push(`${isZh ? "一句话职责" : "Purpose"}: ${purpose}`);
      if (template) lines.push(`${isZh ? "模板" : "Template"}: ${template}`);
      if (worktree) lines.push(`${isZh ? "绑定工作区" : "Worktree"}: ${worktree}`);
      if (watches) lines.push(`${isZh ? "关注/监听" : "Watches"}: ${watches}`);
      if (doesText) lines.push(`${isZh ? "负责执行" : "Does"}: ${doesText}`);
      if (reports) lines.push(`${isZh ? "汇报方式" : "Reports"}: ${reports}`);
      if (bundle?.automations?.length) {
        lines.push(`${isZh ? "附带定时任务" : "Included Automations"}: ${bundle.automations.map((a) => `${a.name} (${a.rrule})`).join("; ")}`);
      }
      if (bundle?.skills?.length) {
        lines.push(`${isZh ? "附带技能" : "Included Skills"}: ${bundle.skills.map((s) => s.name).join(", ")}`);
      }
      if (bundle?.tools?.length) {
        lines.push(`${isZh ? "附带工具/MCP" : "Included Tools"}: ${bundle.tools.map((t) => t.name).join(", ")}`);
      }
      if (bundle?.memory?.length) {
        lines.push(`${isZh ? "附带脱敏记忆参考" : "Included Memory Playbooks"}: ${bundle.memory.map((m) => m.topic).join(", ")}`);
      }
      if (bundle?.settings?.setupNote) {
        lines.push(`${isZh ? "配置说明" : "Setup Note"}: ${bundle.settings.setupNote}`);
      }
      if (soulMd) {
        lines.push("");
        lines.push(isZh ? "参考 SOUL.md（已脱敏）：" : "Reference SOUL.md (sanitized):");
        lines.push(soulMd);
      }
      lines.push("");
      lines.push(
        isZh
          ? "请直接按以上信息执行 `orca bot create --offer` 弹出 Orca 原生建 Bot 确认卡片（补全必要参数即可，无需用 orchestration reply 回复 Bot Office）。"
          : "Please directly run `orca bot create --offer` with the details above to show the native Create Bot confirmation card (do not run orchestration reply back to Bot Office)."
      );
    } else {
      lines.push(isZh ? "【Owner 在 Bot Office 想先和你沟通新建 Bot 的需求】" : "[Owner wants to discuss creating a new Bot from Bot Office]");
      if (name) lines.push(`${isZh ? "暂定名称" : "Draft name"}: ${name}`);
      if (template) lines.push(`${isZh ? "意向类型" : "Template hint"}: ${template}`);
      if (purpose) lines.push(`${isZh ? "初步想法" : "Idea"}: ${purpose}`);
      if (worktree) lines.push(`${isZh ? "可能关联工作区" : "Related worktree"}: ${worktree}`);
      lines.push("");
      lines.push(
        isZh
          ? "请先在本聊天里和 Owner 对齐这个新 Bot 的职责边界、SOUL 和权限方案，对齐后再发 `orca bot create --offer` 卡片（无需用 orchestration reply 回复 Bot Office）。"
          : "Please align on scope, SOUL, and permissions with the owner in this chat first, then send the `orca bot create --offer` card once agreed (do not run orchestration reply back to Bot Office)."
      );
    }

    const subject = `${mode === "offer" ? "Hire Bot" : "Discuss New Bot"}: ${name || template || "New Bot"}`.slice(0, 120);
    await runOrcaJson(
      orcaBin,
      [
        "orchestration", "send",
        "--from", "plugin:bot-office",
        "--to", `bot:${hrBotName}`,
        "--type", "status",
        "--subject", subject,
        "--body", lines.join("\n"),
      ],
      12000
    );
    if (hrWorktreeId) {
      await orca.host.call("workspace.open", { workspaceId: hrWorktreeId }).catch(() => {});
    }
    scheduleRefresh(1500, true);
    return { sent: true, hrBotName, mode };
  });

  orca.panels.handle("office.getAnalytics", async (input = {}) => {
    const opts = await readOptions();
    const snap = latestSnapshot || (await refresh(false, { forceItems: false }));
    return await collectOfficeAnalytics(orcaBin, orca.host, snap, {
      force: Boolean(input.force),
      modules: input.modules || opts.dashModules,
      log: (msg) => orca.log?.(msg),
    });
  });

  const ALLOWED_DASH_KEYS = new Set([
    "dashShowTokenDetails",
    "dashShowBranchChats",
    "dashShowAutomations",
    "dashShowLinkedRefs",
    "dashShowDiagnostics",
  ]);
  orca.panels.handle("office.setDashModule", async (input = {}) => {
    const key = String(input.key || "");
    if (!ALLOWED_DASH_KEYS.has(key)) throw new Error("Unsupported module setting");
    const val = Boolean(input.value);
    await orca.settings?.set?.(key, val);
    return { ok: true, key, value: val };
  });

  orca.panels.handle("office.openWorkspace", async (input = {}) => {
    if (!input.workspaceId) throw new Error("workspaceId is required");
    const result = await orca.host.call("workspace.open", { workspaceId: input.workspaceId });
    if (input.focusAttention && orca.host.has?.("agents.list") && orca.host.has?.("terminal.focus")) {
      try {
        const list = await orca.host.call("agents.list", { workspaceId: input.workspaceId });
        const target =
          (list?.agents || []).find((a) => a.terminalId && (a.state === "blocked" || a.state === "waiting")) ||
          (list?.agents || []).find((a) => a.terminalId);
        if (target?.terminalId) {
          await orca.host.call("terminal.focus", { terminalId: target.terminalId }).catch(() => {});
        }
      } catch {
        // workspace.open already succeeded
      }
    }
    return result;
  });

  orca.panels.handle("office.openTasksView", async () => {
    if (orca.host.has?.("commands.run")) {
      return await orca.host.call("commands.run", { action: "view.tasks" });
    }
    return { ran: false };
  });

  orca.panels.handle("office.getMarket", async (input = {}) => {
    const opts = await readOptions();
    const clientId = await getOrCreateClientId(orca.storage);
    const extraBotPaths = Array.isArray(latestSnapshot?.bots)
      ? latestSnapshot.bots.map((b) => b.path).filter(Boolean)
      : [];
    return await fetchMarketCatalog({
      apiUrl: opts.marketApiUrl,
      clientId,
      orcaBin,
      force: Boolean(input.force),
      extraBotPaths,
    });
  });

  orca.panels.handle("office.marketPublish", async (input = {}) => {
    const opts = await readOptions();
    const clientId = await getOrCreateClientId(orca.storage);
    return await postMarketAction({
      apiUrl: opts.marketApiUrl,
      clientId,
      pathSuffix: "/api/bots",
      body: input,
    });
  });

  orca.panels.handle("office.marketLike", async (input = {}) => {
    const opts = await readOptions();
    const clientId = await getOrCreateClientId(orca.storage);
    const id = encodeURIComponent(String(input.id || ""));
    return await postMarketAction({ apiUrl: opts.marketApiUrl, clientId, pathSuffix: `/api/bots/${id}/like` });
  });

  orca.panels.handle("office.marketRandomAvatar", async () => {
    return buildRandomMascotAvatar(orcaBin);
  });

  orca.panels.handle("office.marketPrepareLocal", async (input = {}) => {
    const extraBotPaths = Array.isArray(latestSnapshot?.bots)
      ? latestSnapshot.bots.map((b) => b.path).filter(Boolean)
      : [];
    return await prepareLocalBotShareDraft({
      botId: input.botId,
      orcaBin,
      extraBotPaths,
    });
  });

  orca.panels.handle("office.marketHire", async (input = {}) => {
    const opts = await readOptions();
    const hasOrcaShare = Boolean(input.shareId);
    const opened = hasOrcaShare ? openOrcaBotShareDeepLink(input.shareId) : { ok: true, mode: "recipe" };
    if (input.id) {
      const clientId = await getOrCreateClientId(orca.storage);
      const id = encodeURIComponent(String(input.id));
      void postMarketAction({ apiUrl: opts.marketApiUrl, clientId, pathSuffix: `/api/bots/${id}/hire` }).catch(() => {});
    }
    return opened;
  });

  orca.panels.handle("office.marketReport", async (input = {}) => {
    const opts = await readOptions();
    const clientId = await getOrCreateClientId(orca.storage);
    const id = encodeURIComponent(String(input.id || ""));
    return await postMarketAction({
      apiUrl: opts.marketApiUrl,
      clientId,
      pathSuffix: `/api/bots/${id}/report`,
      body: { reason: input.reason || "broken_or_spam" },
    });
  });

  orca.panels.handle("office.sendDecision", async (input = {}) => {
    const botName = String(input.botName || "").trim();
    const body = String(input.body || "").trim();
    const subject = String(input.subject || "Owner decision reply").trim().slice(0, 140);
    const itemNumber = input.itemNumber ? Number(input.itemNumber) : null;
    if (!botName) throw new Error("botName is required");
    if (!body) throw new Error("reply body is required");

    const args = [
      "orchestration",
      "send",
      "--from",
      "plugin:bot-office",
      "--to",
      `bot:${botName}`,
      "--type",
      "status",
      "--subject",
      subject,
      "--body",
      body,
    ];
    if (itemNumber && Number.isFinite(itemNumber)) {
      args.splice(6, 0, "--item", String(itemNumber));
    }
    const result = await runOrcaJson(orcaBin, args, 12000);
    scheduleRefresh(1500, true);
    return { sent: true, result };
  });

  orca.commands.register("bot-office.show", async () => {
    const key = await resolveOwnPluginKey();
    const child = spawn(orcaBin, ["plugin", "open", key, "--panel", "office"], {
      stdio: "ignore",
      detached: true,
      env: buildExecEnv(),
    });
    child.unref();
  });

  orca.commands.register("bot-office.refresh", async () => {
    await refresh(true, { forceItems: true });
  });

  const eventNames = [
    "agent.status.changed",
    "workspace.created",
    "workspace.removed",
    "workspace.changed",
  ];
  for (const ev of eventNames) {
    orca.events?.on?.(ev, () => scheduleRefresh(650, ev === "agent.status.changed"));
  }

  orca.settings?.onDidChange?.(() => {
    void resetPollTimer();
    scheduleRefresh(200, true);
  });

  void refresh(true, { forceItems: true });
  void resetPollTimer();
}

export function deactivate() {
  if (pollTimer) clearInterval(pollTimer);
  if (debounceTimer) clearTimeout(debounceTimer);
  pollTimer = null;
  debounceTimer = null;
}
