import { spawn } from "node:child_process";
import {
  buildExecEnv,
  collectBotAvatars,
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
    return {
      intervalMs: Math.max(8, Math.min(120, interval)) * 1000,
      showStandalone,
      soloBotsInLounge,
      hideStaleIdleHours: Math.max(0, Math.min(168, hideStaleIdleHours)),
      language,
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
    return "local.bot-office";
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
    return await collectBotAvatars();
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
