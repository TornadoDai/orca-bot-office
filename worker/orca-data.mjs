import { execFile } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const AVATAR_CACHE_DIR = path.join(os.tmpdir(), "orca-bot-office-avatars");

const STATE_PRIORITY = {
  blocked: 0,
  permission: 0,
  waiting: 1,
  working: 2,
  active: 3,
  done: 4,
  idle: 5,
  inactive: 5,
};

export function locateOrcaBinary(env = process.env) {
  const isWin = process.platform === "win32";
  const exe = isWin ? "orca.exe" : "orca";
  // Orca starts plugin workers with a trimmed environment (no LOCALAPPDATA on
  // Windows), so derive the install dir from homedir and from the worker's own
  // executable (the worker runs inside Orca.exe with ELECTRON_RUN_AS_NODE=1).
  const localAppData = env.LOCALAPPDATA || (isWin ? path.join(os.homedir(), "AppData", "Local") : null);
  const candidates = [
    env.ORCA_CLI_COMMAND,
    process.platform === "darwin" ? "/Applications/Orca.app/Contents/Resources/bin/orca" : null,
    process.platform === "darwin" ? path.join(os.homedir(), "Applications/Orca.app/Contents/Resources/bin/orca") : null,
    isWin ? path.join(path.dirname(process.execPath), "resources", "bin", exe) : null,
    "/usr/local/bin/orca",
    "/opt/homebrew/bin/orca",
    path.join(os.homedir(), ".local", "bin", exe),
    isWin && localAppData ? path.join(localAppData, "Programs", "Orca", "resources", "bin", exe) : null,
    // Resolve PATH ourselves: a bare "orca.exe" makes Windows search the parent
    // process's directory first, which finds the Orca.exe app, not the CLI.
    ...String(env.PATH || env.Path || "")
      .split(path.delimiter)
      .filter(Boolean)
      .map((dir) => path.join(dir, exe)),
  ].filter(Boolean);
  for (const bin of candidates) {
    if (fs.existsSync(bin)) return bin;
  }
  return exe;
}

export function buildExecEnv() {
  const sep = path.delimiter;
  const basePath = process.env.PATH || "";
  const extra =
    process.platform === "win32"
      ? []
      : ["/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/bin", "/usr/sbin", "/sbin"];
  const parts = [...basePath.split(sep).filter(Boolean), ...extra];
  const env = {
    ...process.env,
    PATH: [...new Set(parts)].join(sep),
    HOME: process.env.HOME || os.homedir(),
  };
  if (process.platform === "win32") {
    // The worker env has no APPDATA, and without it the orca CLI cannot find
    // the runtime ("APPDATA is not set ... runtime metadata path").
    env.APPDATA = env.APPDATA || path.join(os.homedir(), "AppData", "Roaming");
    env.LOCALAPPDATA = env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");
  }
  return env;
}

export async function runOrcaJson(orcaBin, args, timeoutMs = 9000) {
  let stdout;
  try {
    ({ stdout } = await execFileAsync(orcaBin, [...args, "--json"], {
      timeout: timeoutMs,
      maxBuffer: 8 * 1024 * 1024,
      env: buildExecEnv(),
    }));
  } catch (err) {
    // With --json the CLI reports its error on stdout and exits non-zero.
    let cliError = null;
    try {
      cliError = JSON.parse(err?.stdout || "")?.error;
    } catch {
      // not JSON; keep the exec error
    }
    if (cliError?.message) {
      throw new Error(`orca ${args.join(" ")}: ${cliError.code ? `${cliError.code}: ` : ""}${cliError.message}`);
    }
    throw err;
  }
  const parsed = JSON.parse(stdout);
  if (!parsed?.ok) {
    throw new Error(parsed?.error?.message || `orca ${args.join(" ")} failed`);
  }
  return parsed.result || {};
}

function cleanText(raw, maxLen = 120) {
  if (!raw) return "";
  const text = String(raw)
    .replace(/────[\s\S]*?Subject:\s*/g, "")
    .replace(/You have \d+ orchestration message[\s\S]*/gi, "")
    .replace(/You are working inside Orca[\s\S]*?=== TASK ===\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > maxLen ? `${text.slice(0, maxLen - 1)}…` : text;
}

function normalizeBranch(branch) {
  return String(branch || "").replace(/^refs\/heads\//, "");
}

function isBlockingState(state) {
  return state === "blocked" || state === "permission" || state === "waiting";
}

function pickAgentState(agents, fallbackStatus) {
  const list = Array.isArray(agents) ? agents : [];
  let best = null;
  for (const a of list) {
    const s = String(a?.state || "done").toLowerCase();
    const score = STATE_PRIORITY[s] ?? 4;
    if (!best || score < best.score) best = { state: s, score, agent: a };
  }
  const st = best?.state || String(fallbackStatus || "idle").toLowerCase();
  if (isBlockingState(st)) return { state: st, agent: best?.agent || null };
  if (st === "working" || fallbackStatus === "working") return { state: "working", agent: best?.agent || null };
  if (fallbackStatus === "active") return { state: "active", agent: best?.agent || null };
  return { state: "idle", agent: best?.agent || null };
}

function extractActivity(agent, fallback, maxLen = 84) {
  if (agent?.toolName && (agent?.state === "working" || isBlockingState(agent?.state))) {
    const detail = cleanText(agent.toolInput, Math.max(40, maxLen - 24));
    return detail ? `${agent.toolName}: ${detail}` : `${agent.toolName}`;
  }
  if (agent?.taskTitle) return cleanText(agent.taskTitle, maxLen);
  if (agent?.prompt) return cleanText(agent.prompt, maxLen);
  if (agent?.lastAssistantMessage) return cleanText(agent.lastAssistantMessage, maxLen);
  return cleanText(fallback, maxLen);
}

function extractTimeline(agents, fallback) {
  const list = Array.isArray(agents) ? agents : [];
  const entries = [];
  const seen = new Set();
  const push = (label, text, at) => {
    const clean = cleanText(text, 240);
    if (!clean || seen.has(clean)) return;
    seen.add(clean);
    entries.push({ label, text: clean, at: at || null });
  };
  for (const a of list.slice(0, 3)) {
    const eng = a.agentType || "agent";
    if (a.taskTitle) push("task", a.taskTitle, a.stateStartedAt);
    if (a.toolName && (a.state === "working" || isBlockingState(a.state))) {
      const inp = cleanText(a.toolInput, 180);
      push("tool", inp ? `[${a.toolName}] ${inp}` : `[${a.toolName}]`, a.stateStartedAt);
    }
    if (a.prompt) push(`prompt (${eng})`, a.prompt, a.stateStartedAt);
    if (a.lastAssistantMessage) push(`reply (${eng})`, a.lastAssistantMessage, a.stateStartedAt);
  }
  if (!entries.length && fallback) push("status", fallback, null);
  return entries.slice(0, 5);
}

function extractLinkedRefs(rawLinks, linkedPR = null, linkedGitLabMR = null) {
  const list = Array.isArray(rawLinks) ? [...rawLinks] : [];
  const out = [];
  const seen = new Set();
  const push = (kind, label, url) => {
    const cleanLabel = cleanText(label || "Link", 40);
    const key = url || `${kind}:${cleanLabel}`;
    if (!cleanLabel && !url) return;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ kind, label: cleanLabel, url: url || "" });
  };
  for (const item of list.slice(0, 8)) {
    if (!item) continue;
    if (typeof item === "string") {
      const kind = /\/pull\/|\/merge_requests\//.test(item) ? "pr" : "issue";
      push(kind, item.replace(/^https?:\/\/[^/]+\//, "").slice(0, 36), item);
      continue;
    }
    const url = item.url || item.href || "";
    const provider = String(item.provider || "").toLowerCase();
    const rawType = String(item.type || item.kind || "").toLowerCase();
    const kind =
      rawType === "mr" || rawType === "pr" || /\/pull\/|\/merge_requests\//.test(url)
        ? (rawType === "mr" || provider === "gitlab" || /\/merge_requests\//.test(url) ? "mr" : "pr")
        : "issue";
    const numPrefix = kind === "mr" ? "MR !" : kind === "pr" ? "PR #" : "#";
    const label =
      item.label ||
      item.key ||
      item.title ||
      (item.number ? `${numPrefix}${item.number}` : url.replace(/^https?:\/\/[^/]+\//, "").slice(0, 36));
    push(kind, label, url);
  }
  if (linkedPR && typeof linkedPR === "object") {
    push("pr", linkedPR.title || `PR #${linkedPR.number || ""}`, linkedPR.url || "");
  } else if (typeof linkedPR === "number" || typeof linkedPR === "string") {
    push("pr", `PR #${linkedPR}`, "");
  }
  if (linkedGitLabMR && typeof linkedGitLabMR === "object") {
    push("mr", linkedGitLabMR.title || `MR !${linkedGitLabMR.number || linkedGitLabMR.iid || ""}`, linkedGitLabMR.url || "");
  } else if (typeof linkedGitLabMR === "number" || typeof linkedGitLabMR === "string") {
    push("mr", `MR !${linkedGitLabMR}`, "");
  }
  return out;
}

// Low-CPU throttled cache for bot list, branch chats & native needs-you items
const itemListCache = new Map(); // botName -> { fetchedAt, items }
const itemDetailCache = new Map(); // "num:ver:qev" -> ask
const branchChatsCache = new Map(); // botName -> { fetchedAt, chats }
let botListCache = { fetchedAt: 0, bots: [] };

function normalizeAskObject(ask, fallbackText, eventId) {
  const questions = Array.isArray(ask?.questions)
    ? ask.questions.map((q) => ({
        prompt: String(q.prompt || ""),
        multi: Boolean(q.multi),
        recommended: typeof q.recommended === "number" ? q.recommended : null,
        options: Array.isArray(q.options)
          ? q.options.map((o) =>
              typeof o === "string"
                ? { label: o, detail: "" }
                : { label: String(o.label || ""), detail: String(o.detail || "") }
            )
          : [],
      }))
    : [];
  return {
    eventId: eventId || null,
    context: String(ask?.context || fallbackText || "").slice(0, 1200),
    questions,
  };
}

function parseAskFromEvents(events, itemQuestion) {
  const list = Array.isArray(events) ? events : [];
  const qObj = itemQuestion && typeof itemQuestion === "object" ? itemQuestion : null;
  const targetEventId = qObj?.eventId || null;
  const qText = qObj ? String(qObj.text || qObj.gist || "") : (typeof itemQuestion === "string" ? itemQuestion : "");

  // 1) Authoritative match: if Orca's item.question names a specific eventId, ONLY use that exact event!
  // Never fall back to an older already-answered `ask` event when the active question is plain text (e.g. #89).
  if (targetEventId) {
    const exact = list.find((ev) => ev?.id === targetEventId);
    if (exact) {
      if (exact.data?.ask) {
        return normalizeAskObject(exact.data.ask, exact.data.text || qText, exact.id);
      }
      return {
        eventId: exact.id,
        context: String(exact.data?.text || qText || "").slice(0, 1200),
        questions: [],
      };
    }
    if (qText) {
      return { eventId: targetEventId, context: qText.slice(0, 1200), questions: [] };
    }
  }

  // 2) Fallback when item.question has text without eventId
  if (qText) {
    return { eventId: null, context: qText.slice(0, 1200), questions: [] };
  }

  // 3) Last resort: collect answered requestIds so we never surface an already-answered ask
  const answeredIds = new Set(
    list.map((ev) => ev?.data?.requestId).filter(Boolean)
  );
  for (let i = list.length - 1; i >= 0; i--) {
    const ev = list[i];
    if (ev?.kind === "commented" && ev?.actor?.kind === "bot") {
      if (ev.data?.ask && !answeredIds.has(ev.id)) {
        return normalizeAskObject(ev.data.ask, ev.data.text, ev.id);
      }
      if (ev.data?.text) {
        return { eventId: ev.id || null, context: String(ev.data.text).slice(0, 1200), questions: [] };
      }
    }
  }
  return { eventId: null, context: "", questions: [] };
}

async function fetchItemEventsForQuestion(orcaBin, itemNumber, targetEventId) {
  let cursor = null;
  let allEvents = [];
  let itemMeta = null;
  for (let page = 0; page < 6; page++) {
    const args = ["bot", "item", "show", String(itemNumber)];
    if (cursor) args.push("--after", cursor);
    const detail = await runOrcaJson(orcaBin, args, 6500);
    if (!itemMeta && detail?.item) itemMeta = detail.item;
    const evs = Array.isArray(detail?.events) ? detail.events : [];
    allEvents = allEvents.concat(evs);
    const effectiveTarget = targetEventId || itemMeta?.question?.eventId || null;
    if (effectiveTarget && evs.some((ev) => ev?.id === effectiveTarget)) {
      break;
    }
    if (!detail?.nextCursor || !effectiveTarget) break;
    cursor = String(detail.nextCursor);
  }
  return { events: allEvents, item: itemMeta };
}

async function fetchBotBranchChats(orcaBin, botName, force = false) {
  const now = Date.now();
  const cached = branchChatsCache.get(botName);
  if (!force && cached && now - cached.fetchedAt < 45000) {
    return cached.chats;
  }
  try {
    const res = await runOrcaJson(orcaBin, ["bot", "chats", "--bot", botName], 6000);
    const raw = Array.isArray(res?.chats) ? res.chats : [];
    const dayMs = 24 * 3600 * 1000;
    const activeMs = 15 * 60 * 1000;
    const chats = raw
      .filter((c) => {
        if (c.home || c.closed) return false;
        const hasContent = Boolean(String(c.title || "").trim() || String(c.lastAsked || "").trim() || String(c.lastSaid || "").trim());
        if (!hasContent) return false;
        const age = c.lastActivityAt ? now - Number(c.lastActivityAt) : Infinity;
        return age <= dayMs || Boolean(String(c.title || "").trim());
      })
      .sort((a, b) => (b.lastActivityAt || 0) - (a.lastActivityAt || 0))
      .slice(0, 8)
      .map((c) => {
        const ts = c.lastActivityAt ? Number(c.lastActivityAt) : null;
        return {
          id: c.id,
          title: cleanText(c.title || c.lastAsked || "Branch chat", 72),
          lastAsked: cleanText(c.lastAsked || "", 90),
          lastSaid: cleanText(c.lastSaid || "", 100),
          lastActivityAt: ts,
          isRecent: Boolean(ts && now - ts <= activeMs),
          isFresh24h: Boolean(ts && now - ts <= dayMs),
        };
      });
    branchChatsCache.set(botName, { fetchedAt: now, chats });
    return chats;
  } catch {
    return cached?.chats || [];
  }
}

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

async function fetchBotNeedsYouItems(orcaBin, botName, forceItems = false) {
  const now = Date.now();
  const cached = itemListCache.get(botName);
  // Reuse cached needs-you items for 22s unless forced, dramatically slashing CLI subprocess spikes
  if (!forceItems && cached && now - cached.fetchedAt < 22000) {
    return cached.items;
  }
  try {
    const res = await runOrcaJson(
      orcaBin,
      ["bot", "item", "list", "--bot", botName, "--status", "needs-you", "--limit", "15"],
      6500
    );
    const rawItems = (Array.isArray(res?.items) ? res.items : []).filter(
      (it) => !it.snoozedUntil || Number(it.snoozedUntil) <= now
    );
    const enriched = await mapWithConcurrency(rawItems, 2, async (it) => {
      const targetEvId = it.question?.eventId || "";
      const cacheKey = `${it.number}:${it.version || it.lastEventId || it.updatedAt}:${targetEvId}`;
      let ask = itemDetailCache.get(cacheKey);
      if (!ask) {
        try {
          const detail = await fetchItemEventsForQuestion(orcaBin, it.number, targetEvId);
          ask = parseAskFromEvents(detail.events, detail.item?.question || it.question);
          itemDetailCache.set(cacheKey, ask);
          if (itemDetailCache.size > 120) {
            itemDetailCache.delete(itemDetailCache.keys().next().value);
          }
        } catch {
          const fallbackTxt = it.question?.text || it.question?.gist || it.description || it.doneMeans || "";
          ask = { eventId: targetEvId || null, context: cleanText(fallbackTxt, 520), questions: [] };
        }
      }
      return {
        number: it.number,
        title: String(it.title || `#${it.number}`),
        doneMeans: String(it.doneMeans || ""),
        status: it.status,
        updatedAt: it.updatedAt || it.lastActivityAt || null,
        ask,
      };
    });
    itemListCache.set(botName, { fetchedAt: now, items: enriched });
    return enriched;
  } catch {
    return cached?.items || [];
  }
}

function buildWorkerItem(w) {
  const picked = pickAgentState(w.agents, w.status);
  const needsDecision = isBlockingState(picked.state);
  const stateStartedAt = picked.agent?.stateStartedAt || w.lastActivityAt || null;
  return {
    worktreeId: w.worktreeId,
    displayName: w.displayName || path.basename(w.path || ""),
    repo: w.repo || "",
    branch: normalizeBranch(w.branch),
    path: w.path || "",
    state: picked.state,
    needsDecision,
    decisionReason: needsDecision ? picked.state : null,
    agentType: picked.agent?.agentType || "",
    toolName: picked.agent?.toolName || "",
    activity: extractActivity(picked.agent, w.preview || w.comment || "", 84),
    timeline: extractTimeline(w.agents, w.preview || w.comment || ""),
    links: extractLinkedRefs(w.linkedItems, w.linkedPR, w.linkedGitLabMR),
    unread: Boolean(w.unread),
    liveTerminalCount: Number(w.liveTerminalCount || 0),
    stateStartedAt,
    lastActivityAt: w.lastActivityAt || stateStartedAt || null,
  };
}

function compareWorkers(a, b) {
  if (a.needsDecision !== b.needsDecision) return a.needsDecision ? -1 : 1;
  const pa = STATE_PRIORITY[a.state] ?? 9;
  const pb = STATE_PRIORITY[b.state] ?? 9;
  if (pa !== pb) return pa - pb;
  return (b.lastActivityAt || 0) - (a.lastActivityAt || 0);
}

function compareBots(a, b) {
  const rank = (bot) => {
    if (bot.needsDecision) return 0;
    if (bot.state === "working") return 1;
    if (bot.workingWorkerCount > 0) return 2;
    if (bot.workers.length > 0) return 3;
    return 4;
  };
  const ra = rank(a);
  const rb = rank(b);
  if (ra !== rb) return ra - rb;
  return (b.lastActivityAt || 0) - (a.lastActivityAt || 0);
}

export function computeSnapshotHash(snap) {
  const payload = {
    summary: snap.summary,
    settings: snap.settings,
    bots: (snap.bots || []).map((b) => ({
      id: b.id,
      name: b.name,
      state: b.state,
      needsDecision: b.needsDecision,
      decisionCount: b.decisionCount,
      activity: b.activity,
      lastActivityAt: b.lastActivityAt,
      branchChatCount: b.branchChatCount || 0,
      activeBranchCount: b.activeBranchCount || 0,
      items: (b.needsYouItems || []).map((i) => `${i.number}:${i.updatedAt}`),
      workers: (b.workers || []).map((w) => ({
        id: w.worktreeId,
        state: w.state,
        needsDecision: w.needsDecision,
        activity: w.activity,
        lastActivityAt: w.lastActivityAt,
      })),
    })),
    standalone: (snap.standalone || []).map((w) => `${w.worktreeId}:${w.state}:${w.lastActivityAt}`),
  };
  return crypto.createHash("sha1").update(JSON.stringify(payload)).digest("hex");
}

export async function collectOfficeSnapshot(orcaBin, { showStandalone = true, forceItems = false } = {}) {
  const errors = [];
  const now = Date.now();

  // Bot roster rarely changes — cache for 60s unless forced
  const botPromise =
    !forceItems && botListCache.bots.length && now - botListCache.fetchedAt < 60000
      ? Promise.resolve({ bots: botListCache.bots })
      : runOrcaJson(orcaBin, ["bot", "list"])
          .then((res) => {
            if (Array.isArray(res?.bots)) {
              botListCache = { fetchedAt: Date.now(), bots: res.bots };
            }
            return res;
          })
          .catch((err) => {
            errors.push(`bot list: ${err?.message || err}`);
            return { bots: botListCache.bots || [] };
          });

  const [botRes, wtRes] = await Promise.all([
    botPromise,
    runOrcaJson(orcaBin, ["worktree", "ps", "--since", "7d"]).catch((err) => {
      errors.push(`worktree ps: ${err?.message || err}`);
      return { worktrees: [] };
    }),
  ]);

  const rawBots = Array.isArray(botRes.bots) ? botRes.bots : [];
  const rawWts = Array.isArray(wtRes.worktrees) ? wtRes.worktrees : [];

  // Concurrency-capped (3 at a time) + cached native Needs-You items & active branch chats
  const [needsYouList, branchChatsList] = await Promise.all([
    mapWithConcurrency(rawBots, 3, async (b) => [
      b.name,
      await fetchBotNeedsYouItems(orcaBin, b.name, forceItems),
    ]),
    mapWithConcurrency(rawBots, 3, async (b) => [
      b.name,
      await fetchBotBranchChats(orcaBin, b.name, forceItems),
    ]),
  ]);
  const needsYouByBot = new Map(needsYouList);
  const branchChatsByBot = new Map(branchChatsList);

  const homeByBot = new Map();
  const workersByBot = new Map();
  const standalone = [];

  for (const w of rawWts) {
    if (w.isArchived) continue;
    if (w.bot && w.botHome) {
      homeByBot.set(w.bot, w);
    } else if (w.bot && !w.botHome) {
      const list = workersByBot.get(w.bot) || [];
      list.push(buildWorkerItem(w));
      workersByBot.set(w.bot, list);
    } else if (showStandalone && ((w.agents && w.agents.length > 0) || w.status === "working")) {
      standalone.push(buildWorkerItem(w));
    }
  }

  const bots = rawBots.map((b) => {
    const home = homeByBot.get(b.name) || null;
    const workers = (workersByBot.get(b.name) || []).sort(compareWorkers);
    const needsYouItems = needsYouByBot.get(b.name) || [];
    const picked = home ? pickAgentState(home.agents, home.status) : { state: "idle", agent: null };

    const workingWorkerCount = workers.filter((w) => w.state === "working").length;
    const decisionWorkers = workers.filter((w) => w.needsDecision);
    const decisionWorkerCount = decisionWorkers.length;

    const selfNeedsDecision = needsYouItems.length > 0 || isBlockingState(picked.state);
    const needsDecision = selfNeedsDecision || decisionWorkerCount > 0;
    const decisionCount =
      needsYouItems.length +
      (needsYouItems.length === 0 && isBlockingState(picked.state) ? 1 : 0) +
      decisionWorkerCount;

    let activity = "";
    if (needsYouItems.length > 0) {
      const firstQ = needsYouItems[0].ask?.questions?.[0]?.prompt;
      activity = cleanText(firstQ || needsYouItems[0].title, 84);
    } else if (home) {
      activity = extractActivity(picked.agent, "", 84);
    }
    if (!activity && decisionWorkerCount > 0) {
      activity = decisionWorkers[0].activity || decisionWorkers[0].displayName;
    }
    if (!activity && workingWorkerCount > 0) {
      activity = workers[0].activity || workers[0].displayName;
    }
    if (!activity) activity = cleanText(b.specialty, 84);

    const timeline = home ? extractTimeline(home.agents, "") : [];
    if (!timeline.length && b.specialty) {
      timeline.push({ label: "role", text: cleanText(b.specialty, 220), at: null });
    }

    const stateStartedAt = picked.agent?.stateStartedAt || home?.lastActivityAt || null;
    const branchChats = branchChatsByBot.get(b.name) || [];
    const activeBranchCount = branchChats.filter((c) => c.isRecent).length;
    const branchChatCount = branchChats.filter((c) => c.isFresh24h).length || branchChats.length;
    if (!activity && activeBranchCount > 0) {
      activity = `⑂ ${branchChats[0].title}`;
    }

    return {
      id: b.id,
      name: b.name,
      agent: b.agent || "unknown",
      paused: Boolean(b.paused),
      specialty: cleanText(b.specialty, 160),
      worktreeId: home?.worktreeId || null,
      path: home?.path || "",
      state: picked.state,
      unread: Boolean(home?.unread),
      needsYouItems,
      selfNeedsDecision,
      needsDecision,
      decisionCount,
      decisionWorkerCount,
      activity,
      timeline,
      links: extractLinkedRefs(home?.linkedItems, home?.linkedPR, home?.linkedGitLabMR),
      toolName: picked.agent?.toolName || "",
      stateStartedAt,
      lastActivityAt: Math.max(
        Number(home?.lastActivityAt || 0),
        Number(workers[0]?.lastActivityAt || 0),
        Number(branchChats[0]?.lastActivityAt || 0)
      ) || null,
      workingWorkerCount,
      branchChats,
      branchChatCount,
      activeBranchCount,
      workers,
    };
  });

  bots.sort(compareBots);
  standalone.sort(compareWorkers);

  // Derive active mail / envelope traffic between Lead Bots & Workers (and cross-bot references)
  const mailLinks = [];
  for (const b of bots) {
    for (const w of b.workers) {
      if (w.needsDecision) {
        mailLinks.push({ from: w.worktreeId, to: b.id, kind: "alert", label: w.activity || "Needs approval" });
      } else if (w.state === "working") {
        // Boss dispatching to active worker + worker reporting back
        mailLinks.push({ from: b.id, to: w.worktreeId, kind: "dispatch", label: w.toolName || w.activity || "Working" });
      }
    }
    // Cross-bot handoff/mail hint when a working bot mentions another bot in its active task/reply
    if (b.state === "working" && b.activity) {
      for (const other of bots) {
        if (other.id !== b.id && other.name.length >= 2 && b.activity.includes(other.name)) {
          mailLinks.push({ from: b.id, to: other.id, kind: "handoff", label: b.activity });
          break;
        }
      }
    }
  }

  const decisionList = [];
  for (const b of bots) {
    if (b.selfNeedsDecision) {
      decisionList.push({
        kind: "bot",
        id: b.id,
        worktreeId: b.worktreeId,
        name: b.name,
        title: b.needsYouItems[0]?.title || b.activity,
        itemNumber: b.needsYouItems[0]?.number || null,
      });
    }
    for (const w of b.workers) {
      if (w.needsDecision) {
        decisionList.push({
          kind: "worker",
          worktreeId: w.worktreeId,
          botId: b.id,
          name: w.displayName,
          title: w.activity,
          itemNumber: null,
        });
      }
    }
  }

  const summary = {
    totalBots: bots.length,
    workingBots: bots.filter((b) => b.state === "working" || b.workingWorkerCount > 0).length,
    decisionCount: bots.reduce((acc, b) => acc + b.decisionCount, 0),
    workingWorkers: bots.reduce((acc, b) => acc + b.workingWorkerCount, 0),
    totalWorkers: bots.reduce((acc, b) => acc + b.workers.length, 0),
    idleTotal:
      bots.filter((b) => !b.needsDecision && b.state !== "working" && b.workingWorkerCount === 0).length +
      bots.reduce((acc, b) => acc + b.workers.filter((w) => !w.needsDecision && w.state !== "working").length, 0),
    standaloneWorking: standalone.filter((w) => w.state === "working").length,
  };

  return { updatedAt: Date.now(), errors, summary, decisionList, mailLinks, bots, standalone };
}

const avatarMemoryCache = new Map();

async function toTinyAvatarDataUrl(imgPath, cacheKey, mtimeMs) {
  const cached = avatarMemoryCache.get(cacheKey);
  if (cached && cached.mtimeMs === mtimeMs) return cached.dataUrl;

  if (process.platform === "darwin") {
    try {
      fs.mkdirSync(AVATAR_CACHE_DIR, { recursive: true });
      const outJpg = path.join(AVATAR_CACHE_DIR, `${cacheKey}.jpg`);
      await execFileAsync(
        "sips",
        ["-s", "format", "jpeg", "-s", "formatOptions", "76", "-Z", "128", imgPath, "--out", outJpg],
        { timeout: 4000, env: buildExecEnv() }
      );
      const dataUrl = `data:image/jpeg;base64,${fs.readFileSync(outJpg).toString("base64")}`;
      avatarMemoryCache.set(cacheKey, { mtimeMs, dataUrl });
      return dataUrl;
    } catch {
      // Fall through to raw check
    }
  }

  try {
    const raw = fs.readFileSync(imgPath);
    if (raw.length > 320 * 1024) return null;
    const ext = path.extname(imgPath).toLowerCase();
    const mime = ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : ext === ".webp" ? "image/webp" : "image/png";
    const dataUrl = `data:${mime};base64,${raw.toString("base64")}`;
    avatarMemoryCache.set(cacheKey, { mtimeMs, dataUrl });
    return dataUrl;
  } catch {
    return null;
  }
}

export async function collectBotAvatars(ownerAvatarPath = "") {
  const orcaHome = process.env.ORCA_HOME || path.join(os.homedir(), ".orca");
  const botsRoot = path.join(orcaHome, "bots");
  const avatars = {};
  if (fs.existsSync(botsRoot)) {
    const dirs = fs.readdirSync(botsRoot, { withFileTypes: true }).filter((d) => d.isDirectory());
    await mapWithConcurrency(dirs, 3, async (dir) => {
      const folder = path.join(botsRoot, dir.name);
      const metaPath = path.join(folder, "bot.json");
      if (!fs.existsSync(metaPath)) return;
      const imgPath = ["avatar.png", "avatar.jpg", "avatar.jpeg", "avatar.webp"]
        .map((f) => path.join(folder, f))
        .find((p) => fs.existsSync(p));
      if (!imgPath) return;
      try {
        const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
        const stat = fs.statSync(imgPath);
        const key = String(meta.id || dir.name).replace(/[^a-zA-Z0-9_-]/g, "_");
        const dataUrl = await toTinyAvatarDataUrl(imgPath, key, stat.mtimeMs);
        if (dataUrl && meta.id) avatars[meta.id] = dataUrl;
        if (dataUrl && meta.name) avatars[meta.name] = dataUrl;
      } catch {
        // Ignore unreadable folder
      }
    });
  }
  const custom = String(ownerAvatarPath || "").trim().replace(/^~(?=\/)/, os.homedir());
  if (custom && fs.existsSync(custom)) {
    try {
      const stat = fs.statSync(custom);
      const dataUrl = await toTinyAvatarDataUrl(custom, "__owner_custom__", stat.mtimeMs);
      if (dataUrl) avatars.__owner__ = dataUrl;
    } catch {
      // Ignore unreadable custom avatar
    }
  }
  return avatars;
}
