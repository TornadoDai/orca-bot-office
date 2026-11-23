import { execFile } from "node:child_process";
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
  const candidates = [
    env.ORCA_CLI_COMMAND,
    process.platform === "darwin" ? "/Applications/Orca.app/Contents/Resources/bin/orca" : null,
    process.platform === "darwin" ? path.join(os.homedir(), "Applications/Orca.app/Contents/Resources/bin/orca") : null,
    "/usr/local/bin/orca",
    "/opt/homebrew/bin/orca",
    path.join(os.homedir(), ".local", "bin", exe),
    isWin && env.LOCALAPPDATA ? path.join(env.LOCALAPPDATA, "Programs", "Orca", "resources", "bin", exe) : null,
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
  return {
    ...process.env,
    PATH: [...new Set(parts)].join(sep),
    HOME: process.env.HOME || os.homedir(),
  };
}

export async function runOrcaJson(orcaBin, args, timeoutMs = 10000) {
  const { stdout } = await execFileAsync(orcaBin, [...args, "--json"], {
    timeout: timeoutMs,
    maxBuffer: 8 * 1024 * 1024,
    env: buildExecEnv(),
  });
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
  if (isBlockingState(st)) {
    return { state: st, agent: best?.agent || null };
  }
  if (st === "working" || fallbackStatus === "working") {
    return { state: "working", agent: best?.agent || null };
  }
  if (fallbackStatus === "active") return { state: "active", agent: best?.agent || null };
  return { state: "idle", agent: best?.agent || null };
}

function extractActivity(agent, fallback, maxLen = 88) {
  if (agent?.toolName && (agent?.state === "working" || isBlockingState(agent?.state))) {
    const detail = cleanText(agent.toolInput, Math.max(44, maxLen - 28));
    return detail ? `${agent.toolName}: ${detail}` : `${agent.toolName}`;
  }
  if (agent?.taskTitle) return cleanText(agent.taskTitle, maxLen);
  if (agent?.prompt) return cleanText(agent.prompt, maxLen);
  if (agent?.lastAssistantMessage) return cleanText(agent.lastAssistantMessage, maxLen);
  return cleanText(fallback, maxLen);
}

function extractDetailedContext(agent, fallback) {
  const lines = [];
  if (agent?.taskTitle) lines.push(cleanText(agent.taskTitle, 240));
  if (agent?.toolName && (agent?.state === "working" || isBlockingState(agent?.state))) {
    const inp = cleanText(agent.toolInput, 220);
    lines.push(inp ? `[${agent.toolName}] ${inp}` : `[${agent.toolName}]`);
  }
  if (agent?.prompt && cleanText(agent.prompt, 240) !== lines[0]) {
    lines.push(cleanText(agent.prompt, 280));
  }
  if (agent?.lastAssistantMessage) {
    const msg = cleanText(agent.lastAssistantMessage, 280);
    if (msg && !lines.includes(msg)) lines.push(msg);
  }
  if (!lines.length && fallback) lines.push(cleanText(fallback, 280));
  return lines.slice(0, 3);
}

// Cache item details by item number + version so we never re-fetch unchanged needs_you items
const itemDetailCache = new Map();

function parseAskFromEvents(events, fallbackQuestion) {
  const list = Array.isArray(events) ? events : [];
  for (let i = list.length - 1; i >= 0; i--) {
    const ev = list[i];
    if (ev?.kind === "commented" && ev?.data?.ask) {
      const ask = ev.data.ask;
      const questions = Array.isArray(ask.questions)
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
        eventId: ev.id || null,
        context: String(ask.context || ev.data.text || "").slice(0, 600),
        questions,
      };
    }
  }
  // Fallback: latest bot comment when item was set to needs_you without structured --ask
  for (let i = list.length - 1; i >= 0; i--) {
    const ev = list[i];
    if (ev?.kind === "commented" && ev?.actor?.kind === "bot" && ev?.data?.text) {
      return {
        eventId: ev.id || null,
        context: String(ev.data.text).slice(0, 600),
        questions: [],
      };
    }
  }
  return {
    eventId: null,
    context: typeof fallbackQuestion === "string" ? fallbackQuestion : "",
    questions: [],
  };
}

async function fetchBotNeedsYouItems(orcaBin, botName) {
  try {
    const res = await runOrcaJson(orcaBin, ["bot", "item", "list", "--bot", botName, "--status", "needs-you", "--limit", "20"], 7000);
    const now = Date.now();
    const rawItems = (Array.isArray(res?.items) ? res.items : []).filter(
      (it) => !it.snoozedUntil || Number(it.snoozedUntil) <= now
    );
    const enriched = await Promise.all(
      rawItems.map(async (it) => {
        const cacheKey = `${it.number}:${it.version || it.lastEventId || it.updatedAt}`;
        let ask = itemDetailCache.get(cacheKey);
        if (!ask) {
          try {
            const detail = await runOrcaJson(orcaBin, ["bot", "item", "show", String(it.number)], 7000);
            ask = parseAskFromEvents(detail?.events, it.question);
            itemDetailCache.set(cacheKey, ask);
            if (itemDetailCache.size > 120) {
              const firstKey = itemDetailCache.keys().next().value;
              itemDetailCache.delete(firstKey);
            }
          } catch {
            ask = { eventId: null, context: cleanText(it.description || it.doneMeans || "", 320), questions: [] };
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
      })
    );
    return enriched;
  } catch {
    return [];
  }
}

function buildWorkerItem(w) {
  const picked = pickAgentState(w.agents, w.status);
  // Strict: Worker only gets a red dot when genuinely blocked / waiting for permission/input
  const needsDecision = isBlockingState(picked.state);
  return {
    worktreeId: w.worktreeId,
    displayName: w.displayName || path.basename(w.path || ""),
    repo: w.repo || "",
    branch: normalizeBranch(w.branch),
    state: picked.state,
    needsDecision,
    decisionReason: needsDecision ? picked.state : null,
    agentType: picked.agent?.agentType || "",
    toolName: picked.agent?.toolName || "",
    activity: extractActivity(picked.agent, w.preview || w.comment || "", 88),
    details: extractDetailedContext(picked.agent, w.preview || w.comment || ""),
    unread: Boolean(w.unread),
    liveTerminalCount: Number(w.liveTerminalCount || 0),
    lastActivityAt: w.lastActivityAt || null,
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

export async function collectOfficeSnapshot(orcaBin, { showStandalone = true } = {}) {
  const errors = [];
  const [botRes, wtRes] = await Promise.all([
    runOrcaJson(orcaBin, ["bot", "list"]).catch((err) => {
      errors.push(`bot list: ${err?.message || err}`);
      return { bots: [] };
    }),
    runOrcaJson(orcaBin, ["worktree", "ps", "--since", "7d"]).catch((err) => {
      errors.push(`worktree ps: ${err?.message || err}`);
      return { worktrees: [] };
    }),
  ]);
  const rawBots = Array.isArray(botRes.bots) ? botRes.bots : [];
  const rawWts = Array.isArray(wtRes.worktrees) ? wtRes.worktrees : [];

  // Fetch every Bot's native Needs-You decision items in parallel
  const needsYouEntries = await Promise.all(
    rawBots.map(async (b) => [b.name, await fetchBotNeedsYouItems(orcaBin, b.name)])
  );
  const needsYouByBot = new Map(needsYouEntries);

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
    const picked = home
      ? pickAgentState(home.agents, home.status)
      : { state: "idle", agent: null };

    const workingWorkerCount = workers.filter((w) => w.state === "working").length;
    const decisionWorkers = workers.filter((w) => w.needsDecision);
    const decisionWorkerCount = decisionWorkers.length;

    // Strict alignment with Orca native Bot Items (`needs_you`) + real terminal approval blockers!
    const selfNeedsDecision = needsYouItems.length > 0 || isBlockingState(picked.state);
    const needsDecision = selfNeedsDecision || decisionWorkerCount > 0;
    const decisionCount = needsYouItems.length + (needsYouItems.length === 0 && isBlockingState(picked.state) ? 1 : 0) + decisionWorkerCount;

    let activity = "";
    if (needsYouItems.length > 0) {
      const firstQ = needsYouItems[0].ask?.questions?.[0]?.prompt;
      activity = cleanText(firstQ || needsYouItems[0].title, 88);
    } else if (home) {
      activity = extractActivity(picked.agent, "", 88);
    }
    if (!activity && decisionWorkerCount > 0) {
      activity = decisionWorkers[0].activity || decisionWorkers[0].displayName;
    }
    if (!activity && workingWorkerCount > 0) {
      activity = workers[0].activity || workers[0].displayName;
    }
    if (!activity) activity = cleanText(b.specialty, 84);

    const details = home ? extractDetailedContext(picked.agent, "") : [];
    if (!details.length && b.specialty) details.push(cleanText(b.specialty, 240));

    return {
      id: b.id,
      name: b.name,
      agent: b.agent || "unknown",
      paused: Boolean(b.paused),
      specialty: cleanText(b.specialty, 160),
      worktreeId: home?.worktreeId || null,
      state: picked.state,
      unread: Boolean(home?.unread),
      needsYouItems,
      selfNeedsDecision,
      needsDecision,
      decisionCount,
      decisionWorkerCount,
      activity,
      details,
      toolName: picked.agent?.toolName || "",
      lastActivityAt: home?.lastActivityAt || workers[0]?.lastActivityAt || null,
      workingWorkerCount,
      workers,
    };
  });

  bots.sort(compareBots);
  standalone.sort(compareWorkers);

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

  return { updatedAt: Date.now(), errors, summary, decisionList, bots, standalone };
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
      // Fall through to raw check below
    }
  }

  try {
    const raw = fs.readFileSync(imgPath);
    if (raw.length > 140 * 1024) return null;
    const ext = path.extname(imgPath).toLowerCase();
    const mime = ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : ext === ".webp" ? "image/webp" : "image/png";
    const dataUrl = `data:${mime};base64,${raw.toString("base64")}`;
    avatarMemoryCache.set(cacheKey, { mtimeMs, dataUrl });
    return dataUrl;
  } catch {
    return null;
  }
}

export async function collectBotAvatars() {
  const orcaHome = process.env.ORCA_HOME || path.join(os.homedir(), ".orca");
  const botsRoot = path.join(orcaHome, "bots");
  const avatars = {};
  if (!fs.existsSync(botsRoot)) return avatars;

  const dirs = fs.readdirSync(botsRoot, { withFileTypes: true }).filter((d) => d.isDirectory());
  await Promise.all(
    dirs.map(async (dir) => {
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
        // Ignore unreadable bot folder
      }
    })
  );
  return avatars;
}
