import { runOrcaJson } from "./orca-data.mjs";

const ANALYTICS_TTL_MS = 60 * 1000;
let cachedAnalytics = null;
let cachedAt = 0;

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

async function fetchAutomationsSummary(orcaBin) {
  try {
    const res = await runOrcaJson(orcaBin, ["automations", "list"], 6000);
    const list = Array.isArray(res?.automations) ? res.automations : [];
    const enabled = list.filter((a) => a?.enabled !== false && !a?.paused).length;
    return { total: list.length, enabled };
  } catch {
    return { total: 0, enabled: 0 };
  }
}

async function fetchSessionUsage(orcaHost, bots, log = null) {
  if (!orcaHost?.has?.("agent.listSessions")) {
    log?.("agent.listSessions not reported by orca.host.has()");
    return {
      available: false,
      excludesAntigravity: true,
      totalTokens: 0,
      totalMessages: 0,
      sessionCount: 0,
      runningSessions: 0,
      byEngine: [],
      byTeamMap: new Map(),
      otherTeam: { tokens: 0, messages: 0, sessions: 0 },
    };
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

    // Map workspaceId -> botId
    const wsToBot = new Map();
    for (const b of bots) {
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
    }

    const byEngine = [...engineAgg.values()].sort((a, b) => b.tokens - a.tokens || b.messages - a.messages);
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
    };
  } catch (err) {
    log?.(`agent.listSessions failed: ${err?.code || ""} ${err?.message || err}`);
    return {
      available: false,
      excludesAntigravity: true,
      totalTokens: 0,
      totalMessages: 0,
      sessionCount: 0,
      runningSessions: 0,
      byEngine: [],
      byTeamMap: new Map(),
      otherTeam: { tokens: 0, messages: 0, sessions: 0 },
    };
  }
}

export async function collectOfficeAnalytics(orcaBin, orcaHost, snapshot, { force = false, log = null } = {}) {
  const now = Date.now();
  if (!force && cachedAnalytics && now - cachedAt < ANALYTICS_TTL_MS) {
    return cachedAnalytics;
  }

  const bots = Array.isArray(snapshot?.bots) ? snapshot.bots : [];
  const [itemSummaries, automations, sessionUsage] = await Promise.all([
    mapWithConcurrency(bots, 3, async (b) => [b.id, await fetchBotItemsSummary(orcaBin, b.name)]),
    fetchAutomationsSummary(orcaBin),
    fetchSessionUsage(orcaHost, bots, log),
  ]);
  const itemsByBot = new Map(itemSummaries);

  const dailyTrend = buildLast7Days(now);
  const trendMap = new Map(dailyTrend.map((d) => [d.key, d]));
  const sevenDaysAgo = now - 7 * 86400000;

  let totalItems = 0;
  let totalDone = 0;
  let totalDone7d = 0;
  let totalDispatches = 0;
  let totalDispatchDurMs = 0;
  let totalDispatchWithDur = 0;
  let stalledTotal = 0;
  let liveTerminals = 0;
  let linkedRefs = 0;

  const engineCounts = new Map();
  const addEng = (raw) => {
    const k = String(raw || "").toLowerCase();
    const norm = ["claude", "antigravity", "codex", "pi"].includes(k) ? k : "other";
    engineCounts.set(norm, (engineCounts.get(norm) || 0) + 1);
  };

  const teams = bots.map((b) => {
    addEng(b.agent);
    linkedRefs += (b.links || []).length;
    if (isStalled(b, now)) stalledTotal += 1;

    let teamStalled = isStalled(b, now) ? 1 : 0;
    const workerEngines = new Set();
    for (const w of b.workers || []) {
      if (w.agentType) {
        addEng(w.agentType);
        workerEngines.add(String(w.agentType).toLowerCase());
      }
      liveTerminals += Number(w.liveTerminalCount || 0);
      linkedRefs += (w.links || []).length;
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
    let done7d = 0;
    let dispatchCount = 0;
    let teamDurMs = 0;
    let teamDurCount = 0;
    const teamDays = buildLast7Days(now);
    const teamTrendMap = new Map(teamDays.map((d) => [d.key, d]));

    for (const it of entry.items) {
      if (it.createdAt) {
        const key = dayKeyLocal(it.createdAt);
        const dk = trendMap.get(key);
        if (dk) dk.created += 1;
        const tdk = teamTrendMap.get(key);
        if (tdk) tdk.created += 1;
      }
      if (it.status === "done") {
        const doneTs = it.closedAt || it.updatedAt || it.lastActivityAt;
        if (doneTs) {
          if (Number(doneTs) >= sevenDaysAgo) done7d += 1;
          const key = dayKeyLocal(doneTs);
          const dk = trendMap.get(key);
          if (dk) dk.done += 1;
          const tdk = teamTrendMap.get(key);
          if (tdk) tdk.done += 1;
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
      stalledCount: teamStalled,
      isWorking: b.state === "working" || (b.workingWorkerCount || 0) > 0,
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
      linkedRefs,
      automationsTotal: automations.total,
      automationsEnabled: automations.enabled,
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
    },
  };

  cachedAnalytics = result;
  cachedAt = now;
  return result;
}
