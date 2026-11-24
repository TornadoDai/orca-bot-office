import { runOrcaJson } from "./orca-data.mjs";

const ANALYTICS_TTL_MS = 60 * 1000;
let cachedAnalytics = null;
let cachedAt = 0;
let cachedModulesSig = "";

async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const idx = cursor++;
      results[idx] = await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
  return results;
}

function dayKeyLocal(ts) {
  const d = new Date(Number(ts));
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function buildLast7Days(nowMs) {
  const days = [];
  const base = new Date(nowMs);
  base.setHours(0, 0, 0, 0);
  for (let i = 6; i >= 0; i--) {
    const d = new Date(base.getTime() - i * 86400000);
    const key = dayKeyLocal(d.getTime());
    days.push({
      key,
      label: `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
      created: 0,
      done: 0,
    });
  }
  return days;
}

function buildLast7TokenDays(nowMs) {
  return buildLast7Days(nowMs).map((d) => ({
    key: d.key,
    label: d.label,
    tokens: 0,
    messages: 0,
    sessions: 0,
  }));
}

function isStalled(entity, nowMs) {
  const touch = Math.max(Number(entity.lastActivityAt || 0), Number(entity.stateStartedAt || 0));
  return entity.state === "working" && touch > 0 && nowMs - touch > 12 * 60 * 1000;
}

function normCounts(rawCounts, items) {
  const c = {
    done: Number(rawCounts?.done || 0),
    in_progress: Number(rawCounts?.in_progress || rawCounts?.inProgress || 0),
    needs_you: Number(rawCounts?.needs_you || rawCounts?.needsYou || 0),
    waiting: Number(rawCounts?.waiting || 0),
    planned: Number(rawCounts?.planned || 0),
    canceled: Number(rawCounts?.canceled || rawCounts?.cancelled || 0),
  };
  const sum = c.done + c.in_progress + c.needs_you + c.waiting + c.planned + c.canceled;
  if (sum === 0 && items.length > 0) {
    for (const it of items) {
      const st = String(it.status || "").replace(/-/g, "_");
      if (st in c) c[st] += 1;
      else if (st === "cancelled") c.canceled += 1;
    }
  }
  return c;
}

async function fetchBotItemsSummary(orcaBin, botName) {
  try {
    const res = await runOrcaJson(
      orcaBin,
      ["bot", "item", "list", "--bot", botName, "--all", "--limit", "80"],
      8000
    );
    const items = Array.isArray(res?.items) ? res.items : [];
    const counts = normCounts(res?.counts, items);
    return { items, counts };
  } catch {
    return {
      items: [],
      counts: { done: 0, in_progress: 0, needs_you: 0, waiting: 0, planned: 0, canceled: 0 },
    };
  }
}

async function fetchAutomationsDetail(orcaBin, bots, includeRuns = true) {
  const botById = new Map((bots || []).map((b) => [b.id, b.name]));
  try {
    const [listRes, runsRes] = await Promise.all([
      runOrcaJson(orcaBin, ["automations", "list"], 6000),
      includeRuns
        ? runOrcaJson(orcaBin, ["automations", "runs", "--limit", "15"], 6000).catch(() => ({ runs: [] }))
        : Promise.resolve({ runs: [] }),
    ]);
    const list = Array.isArray(listRes?.automations) ? listRes.automations : [];
    const rawRuns = Array.isArray(runsRes?.runs) ? runsRes.runs : [];
    const autoMap = new Map(list.map((a) => [a.id, a]));
    const latestRunByAuto = new Map();
    for (const r of rawRuns) {
      if (r?.automationId && !latestRunByAuto.has(r.automationId)) {
        latestRunByAuto.set(r.automationId, r);
      }
    }

    const items = list
      .map((a) => {
        const botId = a?.bot?.botId || null;
        const latest = latestRunByAuto.get(a.id);
        return {
          id: a.id,
          name: String(a.name || "Automation"),
          botId,
          botName: botId ? botById.get(botId) || "" : "",
          enabled: a?.enabled !== false && !a?.paused,
          nextRunAt: a.nextRunAt || null,
          lastRunAt: a.lastRunAt || latest?.startedAt || null,
          lastStatus: latest?.status || null,
          schedule: a.schedule || null,
        };
      })
      .sort((a, b) => (a.nextRunAt || Infinity) - (b.nextRunAt || Infinity));

    const recentRuns = rawRuns.slice(0, 10).map((r) => {
      const a = autoMap.get(r.automationId);
      const botId = a?.bot?.botId || null;
      return {
        id: r.id,
        automationId: r.automationId,
        name: String(a?.name || r.title || "Automation run"),
        botId,
        botName: botId ? botById.get(botId) || "" : "",
        status: String(r.status || "unknown"),
        startedAt: r.startedAt || r.createdAt || null,
        error: r.error ? String(r.error).slice(0, 120) : "",
      };
    });

    const enabled = items.filter((a) => a.enabled).length;
    return { total: items.length, enabled, items, recentRuns };
  } catch {
    return { total: 0, enabled: 0, items: [], recentRuns: [] };
  }
}

async function fetchOrcaDiagnostics(orcaBin) {
  try {
    const res = await runOrcaJson(orcaBin, ["diagnostics", "memory"], 6000);
    const app = res?.app || {};
    const host = res?.host || {};
    const wts = Array.isArray(res?.worktrees) ? res.worktrees : [];
    const rawHist = Array.isArray(app.history) ? app.history : [];
    const history = rawHist.slice(-30).map((v) => Math.max(0, Number(v || 0)));
    return {
      available: true,
      collectedAt: res?.collectedAt || Date.now(),
      totalCpu: Number(res?.totalCpu || 0),
      totalMemory: Number(res?.totalMemory || 0),
      app: {
        cpu: Number(app.cpu || 0),
        memory: Number(app.memory || 0),
        mainMem: Number(app.main?.memory || 0),
        rendererMem: Number(app.renderer?.memory || 0),
        otherMem: Number(app.other?.memory || 0),
        history,
      },
      host: {
        totalMemory: Number(host.totalMemory || 0),
        usedMemory: Number(host.usedMemory || 0),
        memoryUsagePercent: Number(host.memoryUsagePercent || 0),
        cpuCoreCount: Number(host.cpuCoreCount || 0),
        loadAverage1m: Number(host.loadAverage1m || 0),
      },
      worktrees: wts
        .map((w) => ({
          worktreeId: w.worktreeId || "",
          name: String(w.worktreeName || w.repoName || "workspace"),
          repo: String(w.repoName || ""),
          cpu: Number(w.cpu || 0),
          memory: Number(w.memory || 0),
          sessions: Array.isArray(w.sessions) ? w.sessions.length : 0,
        }))
        .sort((a, b) => b.memory - a.memory)
        .slice(0, 5),
    };
  } catch {
    return { available: false };
  }
}

async function fetchSessionUsage(orcaHost, bots, nowMs, log = null) {
  const empty = {
    available: false,
    excludesAntigravity: true,
    totalTokens: 0,
    totalMessages: 0,
    sessionCount: 0,
    runningSessions: 0,
    byEngine: [],
    byTeamMap: new Map(),
    otherTeam: { tokens: 0, messages: 0, sessions: 0 },
    dailyTokens: buildLast7TokenDays(nowMs),
    topSessions: [],
  };
  if (!orcaHost?.has?.("agent.listSessions")) {
    log?.("agent.listSessions not reported by orca.host.has()");
    return empty;
  }

  try {
    let res;
    try {
      res = await orcaHost.call("agent.listSessions", { limit: 200 });
    } catch (firstErr) {
      log?.(`agent.listSessions(limit:200) failed: ${firstErr?.code || ""} ${firstErr?.message || firstErr}`);
      res = await orcaHost.call("agent.listSessions");
    }
    const sessions = Array.isArray(res?.sessions) ? res.sessions : [];

    const wsToBot = new Map();
    const botNameById = new Map();
    for (const b of bots) {
      botNameById.set(b.id, b.name);
      if (b.worktreeId) wsToBot.set(b.worktreeId, b.id);
      for (const w of b.workers || []) {
        if (w.worktreeId) wsToBot.set(w.worktreeId, b.id);
      }
    }

    let totalTokens = 0;
    let totalMessages = 0;
    let runningSessions = 0;
    const engineAgg = new Map();
    const byTeamMap = new Map();
    const otherTeam = { tokens: 0, messages: 0, sessions: 0 };
    const dailyTokens = buildLast7TokenDays(nowMs);
    const dailyMap = new Map(dailyTokens.map((d) => [d.key, d]));
    const heavyList = [];

    for (const s of sessions) {
      const tokens = Math.max(0, Number(s?.totalTokens || 0));
      const messages = Math.max(0, Number(s?.messageCount || 0));
      const agent = String(s?.agent || "other").toLowerCase();
      totalTokens += tokens;
      totalMessages += messages;
      if (s?.running) runningSessions += 1;

      const engRow = engineAgg.get(agent) || { agent, tokens: 0, messages: 0, sessions: 0 };
      engRow.tokens += tokens;
      engRow.messages += messages;
      engRow.sessions += 1;
      engineAgg.set(agent, engRow);

      const botId = s?.workspaceId ? wsToBot.get(s.workspaceId) : null;
      if (botId) {
        const tRow = byTeamMap.get(botId) || { tokens: 0, messages: 0, sessions: 0 };
        tRow.tokens += tokens;
        tRow.messages += messages;
        tRow.sessions += 1;
        byTeamMap.set(botId, tRow);
      } else {
        otherTeam.tokens += tokens;
        otherTeam.messages += messages;
        otherTeam.sessions += 1;
      }

      if (s?.updatedAt) {
        const dk = dailyMap.get(dayKeyLocal(s.updatedAt));
        if (dk) {
          dk.tokens += tokens;
          dk.messages += messages;
          dk.sessions += 1;
        }
      }

      if (tokens > 0 || messages > 0) {
        const rawTitle = String(s?.title || s?.branch || "Session").replace(/\s+/g, " ").trim();
        heavyList.push({
          sessionId: String(s?.sessionId || ""),
          title: rawTitle.length > 68 ? `${rawTitle.slice(0, 67)}…` : rawTitle,
          agent,
          teamId: botId || null,
          teamName: botId ? botNameById.get(botId) || "" : "",
          tokens,
          messages,
          updatedAt: s?.updatedAt || null,
          running: Boolean(s?.running),
        });
      }
    }

    const byEngine = [...engineAgg.values()].sort((a, b) => b.tokens - a.tokens || b.messages - a.messages);
    const topSessions = heavyList
      .sort((a, b) => b.tokens - a.tokens || b.messages - a.messages)
      .slice(0, 6);

    return {
      available: true,
      excludesAntigravity: true,
      totalTokens,
      totalMessages,
      sessionCount: sessions.length,
      runningSessions,
      byEngine,
      byTeamMap,
      otherTeam,
      dailyTokens,
      topSessions,
    };
  } catch (err) {
    log?.(`agent.listSessions failed: ${err?.code || ""} ${err?.message || err}`);
    return empty;
  }
}

function collectLinkedRefsRollup(snapshot, itemsByBot) {
  const out = [];
  const seen = new Set();
  const push = (entry) => {
    const key = entry.url || `${entry.teamId || "standalone"}:${entry.kind}:${entry.label}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(entry);
  };

  for (const b of snapshot?.bots || []) {
    for (const lk of b.links || []) {
      push({ teamId: b.id, teamName: b.name, agent: b.agent, kind: lk.kind, label: lk.label, url: lk.url, source: b.name });
    }
    for (const w of b.workers || []) {
      for (const lk of w.links || []) {
        push({ teamId: b.id, teamName: b.name, agent: w.agentType || b.agent, kind: lk.kind, label: lk.label, url: lk.url, source: w.displayName });
      }
    }
    const entry = itemsByBot.get(b.id);
    for (const it of entry?.items || []) {
      for (const lk of it.links || []) {
        const url = String(lk?.url || "");
        if (!url) continue;
        const kind = /\/merge_requests\//.test(url) ? "mr" : /\/pull\//.test(url) ? "pr" : lk.kind === "pr" || lk.kind === "issue" ? lk.kind : "";
        if (!kind) continue;
        const m = url.match(/(?:merge_requests|pull|issues)\/(\d+)/);
        const prefix = kind === "mr" ? "MR !" : kind === "pr" ? "PR #" : "Issue #";
        const label = lk.label || (m ? `${prefix}${m[1]} · ${String(it.title || "").slice(0, 26)}` : url.replace(/^https?:\/\/[^/]+\//, "").slice(0, 38));
        push({ teamId: b.id, teamName: b.name, agent: b.agent, kind, label, url, source: `#${it.number}` });
      }
    }
  }
  for (const w of snapshot?.standalone || []) {
    for (const lk of w.links || []) {
      push({ teamId: null, teamName: w.repo || w.displayName, agent: w.agentType || "other", kind: lk.kind, label: lk.label, url: lk.url, source: w.displayName });
    }
  }
  return out.slice(0, 16);
}

function collectBranchActivity(bots) {
  let totalOpen = 0;
  let totalActive15m = 0;
  const byBot = [];
  for (const b of bots || []) {
    const chats = Array.isArray(b.branchChats) ? b.branchChats : [];
    const active15m = chats.filter((c) => c.isRecent).length;
    totalOpen += chats.length;
    totalActive15m += active15m;
    if (chats.length > 0) {
      byBot.push({
        id: b.id,
        name: b.name,
        agent: b.agent || "other",
        total: chats.length,
        active15m,
        latestAt: chats[0]?.lastActivityAt || null,
        chats: chats.slice(0, 3),
      });
    }
  }
  byBot.sort((a, b) => b.active15m - a.active15m || b.total - a.total || (b.latestAt || 0) - (a.latestAt || 0));
  return { totalOpen, totalActive15m, byBot };
}

export async function collectOfficeAnalytics(
  orcaBin,
  orcaHost,
  snapshot,
  { force = false, modules = null, log = null } = {}
) {
  const mods = {
    linkedRefs: modules?.linkedRefs !== false,
    branchChats: modules?.branchChats !== false,
    automations: modules?.automations !== false,
    tokenDetails: modules?.tokenDetails !== false,
    diagnostics: modules?.diagnostics !== false,
  };
  const modSig = `${mods.automations ? 1 : 0}${mods.diagnostics ? 1 : 0}`;
  const now = Date.now();
  if (!force && cachedAnalytics && cachedModulesSig === modSig && now - cachedAt < ANALYTICS_TTL_MS) {
    return cachedAnalytics;
  }

  const bots = Array.isArray(snapshot?.bots) ? snapshot.bots : [];
  const [itemSummaries, automations, sessionUsage, diagnostics] = await Promise.all([
    mapWithConcurrency(bots, 3, async (b) => [b.id, await fetchBotItemsSummary(orcaBin, b.name)]),
    fetchAutomationsDetail(orcaBin, bots, mods.automations),
    fetchSessionUsage(orcaHost, bots, now, log),
    mods.diagnostics ? fetchOrcaDiagnostics(orcaBin) : Promise.resolve({ available: false, disabled: true }),
  ]);
  const itemsByBot = new Map(itemSummaries);

  const dailyTrend = buildLast7Days(now);
  const trendMap = new Map(dailyTrend.map((d) => [d.key, d]));
  const sevenDaysAgo = now - 7 * 86400000;

  let totalItems = 0, totalDone = 0, totalDone7d = 0;
  let totalDispatches = 0, totalDispatchDurMs = 0, totalDispatchWithDur = 0;
  let stalledTotal = 0, liveTerminals = 0;

  const engineCounts = new Map();
  const addEng = (raw) => {
    const k = String(raw || "").toLowerCase();
    const norm = ["claude", "antigravity", "codex", "pi"].includes(k) ? k : "other";
    engineCounts.set(norm, (engineCounts.get(norm) || 0) + 1);
  };

  const teams = bots.map((b) => {
    addEng(b.agent);
    if (isStalled(b, now)) stalledTotal += 1;

    let teamStalled = isStalled(b, now) ? 1 : 0;
    const workerEngines = new Set();
    for (const w of b.workers || []) {
      if (w.agentType) {
        addEng(w.agentType);
        workerEngines.add(String(w.agentType).toLowerCase());
      }
      liveTerminals += Number(w.liveTerminalCount || 0);
      if (isStalled(w, now)) {
        stalledTotal += 1;
        teamStalled += 1;
      }
    }

    const entry = itemsByBot.get(b.id) || {
      items: [],
      counts: { done: 0, in_progress: 0, needs_you: 0, waiting: 0, planned: 0, canceled: 0 },
    };
    const c = entry.counts;
    const teamTotalItems = c.done + c.in_progress + c.needs_you + c.waiting + c.planned + c.canceled;
    let done7d = 0, dispatchCount = 0, teamDurMs = 0, teamDurCount = 0;
    const teamDays = buildLast7Days(now);
    const teamTrendMap = new Map(teamDays.map((d) => [d.key, d]));

    for (const it of entry.items) {
      if (it.createdAt) {
        const key = dayKeyLocal(it.createdAt);
        const dk = trendMap.get(key); if (dk) dk.created += 1;
        const tdk = teamTrendMap.get(key); if (tdk) tdk.created += 1;
      }
      if (it.status === "done") {
        const doneTs = it.closedAt || it.updatedAt || it.lastActivityAt;
        if (doneTs) {
          if (Number(doneTs) >= sevenDaysAgo) done7d += 1;
          const key = dayKeyLocal(doneTs);
          const dk = trendMap.get(key); if (dk) dk.done += 1;
          const tdk = teamTrendMap.get(key); if (tdk) tdk.done += 1;
        }
      }
      for (const lk of it.links || []) {
        if (lk?.kind === "dispatch") {
          dispatchCount += 1;
          if (lk.startedAt && lk.settledAt && lk.settledAt > lk.startedAt) {
            const dur = lk.settledAt - lk.startedAt;
            if (dur >= 10000 && dur <= 24 * 3600000) {
              teamDurMs += dur;
              teamDurCount += 1;
            }
          }
        }
      }
    }

    totalItems += teamTotalItems;
    totalDone += c.done;
    totalDone7d += done7d;
    totalDispatches += dispatchCount;
    totalDispatchDurMs += teamDurMs;
    totalDispatchWithDur += teamDurCount;

    const tok = sessionUsage.byTeamMap.get(b.id) || { tokens: 0, messages: 0, sessions: 0 };
    return {
      id: b.id,
      name: b.name,
      agent: b.agent || "other",
      workerEngines: [...workerEngines],
      worktreeId: b.worktreeId || null,
      counts: c,
      totalItems: teamTotalItems,
      doneCount: c.done,
      done7d,
      dailyTrend: teamDays,
      activeWorkers: b.workingWorkerCount || 0,
      totalWorkers: (b.workers || []).length,
      dispatchCount,
      avgDispatchMins: teamDurCount > 0 ? Math.max(1, Math.round(teamDurMs / teamDurCount / 60000)) : null,
      dispatchDurTotalMs: teamDurMs,
      dispatchDurCount: teamDurCount,
      tokens: tok.tokens,
      messages: tok.messages,
      sessions: tok.sessions,
      branchCount: (b.branchChats || []).length,
      activeBranchCount: b.activeBranchCount || 0,
      stalledCount: teamStalled,
      isWorking: b.state === "working" || (b.workingWorkerCount || 0) > 0 || (b.activeBranchCount || 0) > 0,
      needsDecision: Boolean(b.needsDecision),
      decisionCount: b.decisionCount || 0,
    };
  });

  teams.sort(
    (a, b) =>
      b.totalItems - a.totalItems ||
      b.dispatchCount - a.dispatchCount ||
      b.tokens - a.tokens ||
      b.totalWorkers - a.totalWorkers
  );

  const engineMix = ["claude", "antigravity", "codex", "pi", "other"]
    .map((key) => ({ key, count: engineCounts.get(key) || 0 }))
    .filter((x) => x.count > 0);

  const avgDispatchMins =
    totalDispatchWithDur > 0 ? Math.max(1, Math.round(totalDispatchDurMs / totalDispatchWithDur / 60000)) : null;

  const linkedRefsList = collectLinkedRefsRollup(snapshot, itemsByBot);
  const branchActivity = collectBranchActivity(bots);

  const result = {
    updatedAt: now,
    kpi: {
      totalItems,
      totalDone,
      totalDone7d,
      totalDispatches,
      avgDispatchMins,
      workingNow: (snapshot?.summary?.workingBots || 0) + (snapshot?.summary?.workingWorkers || 0),
      decisionCount: snapshot?.summary?.decisionCount || 0,
      stalledTotal,
      liveTerminals,
      linkedRefs: linkedRefsList.length,
      automationsTotal: automations.total,
      automationsEnabled: automations.enabled,
      branchTotal: branchActivity.totalOpen,
      branchActive: branchActivity.totalActive15m,
    },
    teams,
    dailyTrend,
    engineMix,
    tokenUsage: {
      available: sessionUsage.available,
      excludesAntigravity: true,
      totalTokens: sessionUsage.totalTokens,
      totalMessages: sessionUsage.totalMessages,
      sessionCount: sessionUsage.sessionCount,
      runningSessions: sessionUsage.runningSessions,
      byEngine: sessionUsage.byEngine,
      otherTeam: sessionUsage.otherTeam,
      dailyTokens: sessionUsage.dailyTokens,
      topSessions: sessionUsage.topSessions,
    },
    linkedRefsList,
    branchActivity,
    automations,
    diagnostics,
  };

  cachedAnalytics = result;
  cachedAt = now;
  cachedModulesSig = modSig;
  return result;
}
