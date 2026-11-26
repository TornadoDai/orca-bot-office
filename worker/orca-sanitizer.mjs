import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { renderEmojiAvatarDataUrl, renderMascotAvatarDataUrl } from "./orca-avatars.mjs";
import { runOrcaJson } from "./orca-data.mjs";

const BLOCKED_MEM_FILE_RE = /(?:credential|secret|token|password|passwd|cookie|auth|private[-_]?key|\.env)/i;

const RULES = [
  { bucket: "secrets", re: /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z0-9 ]*PRIVATE KEY-----/gi, rep: "[已脱敏私钥]" },
  { bucket: "secrets", re: /\b(?:sk-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9]{20,}|gho_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|xox[baprs]-[A-Za-z0-9-]{16,}|AKIA[0-9A-Z]{16}|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,})\b/g, rep: "[已脱敏凭据]" },
  { bucket: "secrets", re: /((?:api[_-]?key|access[_-]?token|refresh[_-]?token|secret|password|passwd|bearer)\s*[:=]\s*["']?)([^\s"'`,;]{8,})(["']?)/gi, rep: "$1[已脱敏]$3" },
  { bucket: "secrets", re: /(https?:\/\/)([^:\s/@]+):([^@\s/]+)@/gi, rep: "$1[已脱敏]@" },
  { bucket: "emails", re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, rep: "[已脱敏邮箱]" },
  { bucket: "phones", re: /(?<!\d)(?:\+?86[- ]?)?1[3-9]\d{9}(?!\d)/g, rep: "[已脱敏手机号]" },
  { bucket: "ips", re: /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)(?::\d{1,5})?\b/g, rep: "[已脱敏IP]" },
  { bucket: "paths", re: /(?:\/Users\/|\/home\/)[^\s"'`),;:\]]+/g, rep: "<本机路径>" },
  { bucket: "paths", re: /[A-Za-z]:\\Users\\[^\s"'`),;:\]]+/g, rep: "<本机路径>" },
  { bucket: "paths", re: /~\/\.orca\/bots\/[^\s"'`),;:\]]+/g, rep: "<Bot目录>" },
  { bucket: "ssh", re: /\bssh\s+(?:-[A-Za-z0-9]+\s+)*[a-zA-Z0-9._@-]+/g, rep: "ssh <server>" },
];

export function sanitizeTextWithReport(rawText, counts = null) {
  const tally = counts || { secrets: 0, emails: 0, phones: 0, ips: 0, paths: 0, ssh: 0 };
  let text = String(rawText || "").replace(/\r\n/g, "\n");
  for (const rule of RULES) {
    text = text.replace(rule.re, (...args) => {
      tally[rule.bucket] = (tally[rule.bucket] || 0) + 1;
      if (typeof rule.rep === "string" && rule.rep.includes("$1")) {
        return rule.rep.replace("$1", args[1] || "").replace("$3", args[3] || "");
      }
      return rule.rep;
    });
  }
  return { text: text.trim(), counts: tally };
}

function inferCategory(haystack) {
  const s = haystack.toLowerCase();
  const scores = [
    ["ops", /(k8s|kubernetes|grafana|loki|prometheus|oncall|incident|crashloop|5xx|运维|排障|监控|告警|日志|服务器|部署)/g],
    ["release", /(release|changelog|tag|deploy|ci\/cd|github actions|发版|发布|构建|回归)/g],
    ["dev", /(pr review|pull request|code review|refactor|bug|git|typescript|golang|python|研发|代码|架构|审查|测试|缺陷)/g],
    ["research", /(research|spec|design|docs|benchmark|调研|文档|方案|评测|竞品|分析)/g],
    ["productivity", /(daily|weekly|standup|email|calendar|meeting|assistant|日报|周报|助理|日常|杂务|效率|提醒|总结)/g],
  ];
  let best = "general", bestScore = 0;
  for (const [cat, re] of scores) {
    const sc = (s.match(re) || []).length;
    if (sc > bestScore) { bestScore = sc; best = cat; }
  }
  return best;
}

function inferTags(skills, haystack) {
  const tags = [];
  const seen = new Set();
  const add = (t) => {
    const c = String(t || "").trim().toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5_-]/g, "");
    if (!c || c.length < 2 || seen.has(c) || tags.length >= 5) return;
    seen.add(c);
    tags.push(c);
  };
  for (const sk of skills) add(typeof sk === "string" ? sk : sk.name);
  const kwPairs = [
    [/github|pr\b|pull request/i, "github"], [/k8s|kubernetes|pod\b/i, "k8s"],
    [/grafana|loki|prometheus|可观测/i, "observability"], [/docker|container/i, "docker"],
    [/feishu|lark|飞书/i, "feishu"], [/slack/i, "slack"], [/linear/i, "linear"],
    [/release|发版|发布/i, "release"], [/日报|周报|standup/i, "summary"],
    [/排障|debug|bug/i, "debug"], [/审查|review/i, "review"], [/助理|日常|效率/i, "assistant"],
  ];
  for (const [re, tag] of kwPairs) if (re.test(haystack)) add(tag);
  return tags;
}

function inferConnectors(haystack) {
  const out = [];
  const pairs = [
    [/\bgithub\b|\bgh\s+pr\b/i, "github"],
    [/\bslack\b/i, "slack"],
    [/\blinear\b/i, "linear"],
    [/\bgoogle\b|gmail|gdocs|gsheets/i, "google"],
    [/\blark\b|飞书/i, "lark"],
  ];
  for (const [re, name] of pairs) if (re.test(haystack)) out.push(name);
  return out;
}

function extractPurposeFromSoul(sanitizedSoul, fallbackName) {
  for (const raw of String(sanitizedSoul || "").split(/\n/)) {
    const l = raw.trim();
    if (!l || l.startsWith("#") || l.startsWith("```") || l.startsWith("---") || l.startsWith(">")) continue;
    const clean = l.replace(/^[-*•]\s*/, "").replace(/\*\*/g, "").replace(/\s+/g, " ").trim();
    if (clean.length >= 8) return clean.slice(0, 140);
  }
  return `${fallbackName} — Orca Bot`;
}

function collectSkillItems(folder, counts) {
  const skDir = path.join(folder, "skills");
  if (!fs.existsSync(skDir)) return [];
  const items = [];
  try {
    for (const d of fs.readdirSync(skDir, { withFileTypes: true })) {
      if (!d.isDirectory() || d.name.startsWith(".")) continue;
      const mdPath = path.join(skDir, d.name, "SKILL.md");
      const raw = fs.existsSync(mdPath) ? fs.readFileSync(mdPath, "utf8").slice(0, 6000) : "";
      const content = sanitizeTextWithReport(raw, counts).text;
      items.push({ name: d.name, content, chars: content.length, defaultChecked: true });
      if (items.length >= 16) break;
    }
  } catch {}
  return items;
}

function collectMemoryItems(folder) {
  const items = [];
  const blocked = [];
  const addFile = (topic, fullPath) => {
    if (BLOCKED_MEM_FILE_RE.test(topic)) {
      blocked.push(topic);
      return;
    }
    try {
      const raw = fs.readFileSync(fullPath, "utf8").slice(0, 5000).trim();
      if (!raw || raw.length < 16) return;
      const localCounts = { secrets: 0, emails: 0, phones: 0, ips: 0, paths: 0, ssh: 0 };
      const content = sanitizeTextWithReport(raw, localCounts).text;
      const redCount = Object.values(localCounts).reduce((a, b) => a + b, 0);
      items.push({ topic, content, chars: content.length, redactionsCount: redCount, defaultChecked: false });
    } catch {}
  };

  const mainMem = path.join(folder, "MEMORY.md");
  if (fs.existsSync(mainMem)) {
    const raw = fs.readFileSync(mainMem, "utf8");
    const nonHeaderLines = raw.split(/\r?\n/).filter((l) => l.trim() && !l.trim().startsWith("#") && !l.includes("One line per fact"));
    if (nonHeaderLines.length) addFile("MEMORY.md", mainMem);
  }
  const memDir = path.join(folder, "memory");
  if (fs.existsSync(memDir)) {
    try {
      const files = fs.readdirSync(memDir, { withFileTypes: true })
        .filter((f) => f.isFile() && f.name.endsWith(".md"))
        .map((f) => f.name)
        .sort();
      for (const name of files.slice(0, 20)) {
        addFile(`memory/${name}`, path.join(memDir, name));
      }
    } catch {}
  }
  return { items, blocked };
}

async function collectBotAutomations(orcaBin, botId, counts) {
  if (!orcaBin || !botId) return [];
  try {
    const res = await runOrcaJson(orcaBin, ["automations", "list"], 6000);
    const all = Array.isArray(res?.automations) ? res.automations : [];
    return all
      .filter((a) => a?.bot?.botId === botId)
      .slice(0, 16)
      .map((a) => {
        const cleanName = sanitizeTextWithReport(a.name || "Automation", counts).text.slice(0, 80);
        const cleanPrompt = sanitizeTextWithReport(a.prompt || "", counts).text.slice(0, 3000);
        return {
          id: a.id || cleanName,
          name: cleanName,
          rrule: String(a.rrule || "").slice(0, 140),
          prompt: cleanPrompt,
          resultsTo: String(a?.bot?.resultsTo || "chat"),
          enabled: a.enabled !== false,
          defaultChecked: true,
        };
      });
  } catch {
    return [];
  }
}

async function collectBotTools(orcaBin, botName, counts) {
  if (!orcaBin || !botName) return [];
  try {
    const res = await runOrcaJson(orcaBin, ["bot", "tools", "--bot", botName], 5000);
    const out = [];
    for (const t of Array.isArray(res?.own) ? res.own : []) {
      const name = typeof t === "string" ? t : t?.name;
      if (!name) continue;
      out.push({
        name: String(name).slice(0, 64),
        scope: "own",
        url: t?.url ? sanitizeTextWithReport(t.url, counts).text.slice(0, 200) : "",
        headerNames: Array.isArray(t?.headerNames) ? t.headerNames.slice(0, 12) : [],
        defaultChecked: true,
      });
    }
    for (const t of Array.isArray(res?.inherited) ? res.inherited : []) {
      const name = typeof t === "string" ? t : t?.name;
      if (!name || out.some((x) => x.name === name)) continue;
      out.push({ name: String(name).slice(0, 64), scope: "inherited", url: "", headerNames: [], defaultChecked: false });
    }
    return out.slice(0, 16);
  } catch {
    return [];
  }
}

export function findLocalBotFolder(botIdOrName, extraBotPaths = []) {
  const orcaHome = process.env.ORCA_HOME || path.join(os.homedir(), ".orca");
  const botsRoot = path.join(orcaHome, "bots");
  const folders = new Set();
  if (fs.existsSync(botsRoot)) {
    for (const d of fs.readdirSync(botsRoot, { withFileTypes: true })) {
      if (d.isDirectory()) folders.add(path.resolve(botsRoot, d.name));
    }
  }
  for (const p of Array.isArray(extraBotPaths) ? extraBotPaths : []) {
    if (typeof p === "string" && p.trim() && fs.existsSync(p)) folders.add(path.resolve(p));
  }
  const needle = String(botIdOrName || "").trim();
  for (const folder of folders) {
    const metaPath = path.join(folder, "bot.json");
    if (!fs.existsSync(metaPath)) continue;
    try {
      const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
      if (meta.id === needle || meta.name === needle || path.basename(folder) === needle) {
        return { folder, meta };
      }
    } catch {}
  }
  return null;
}

const PICKABLE_MASCOTS = [
  "A1", "B1", "D1", "E1", "F1", "G1", "H1", "H2", "I1", "J1",
  "K2", "L2", "M1", "N1", "O1", "P3", "Q1", "R3", "T1",
];
const PICKABLE_COLORS = ["#b3dbf4", "#c5dfb5", "#f8cfa8", "#c9b8e8", "#f4c4cf", "#f6e3a1", "#b5e3d8", "#1f2126"];

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function buildRandomMascotAvatar(orcaBin = "") {
  const avatarValue = pickRandom(PICKABLE_MASCOTS);
  const avatarColor = pickRandom(PICKABLE_COLORS);
  const avatarDataUrl = renderMascotAvatarDataUrl(avatarValue, avatarColor, orcaBin) || "";
  return { avatarType: "mascot", avatarValue, avatarColor, avatarDataUrl };
}

export async function prepareLocalBotShareDraft({ botId, orcaBin = "", extraBotPaths = [] }) {
  const found = findLocalBotFolder(botId, extraBotPaths);
  if (!found) throw new Error("Local Bot not found");
  const { folder, meta } = found;

  const counts = { secrets: 0, emails: 0, phones: 0, ips: 0, paths: 0, ssh: 0 };
  const soulPath = path.join(folder, "SOUL.md");
  const rawSoul = fs.existsSync(soulPath) ? fs.readFileSync(soulPath, "utf8").slice(0, 16000) : "";
  const sanitizedSoul = sanitizeTextWithReport(rawSoul, counts).text;

  const skillItems = collectSkillItems(folder, counts);
  const { items: memoryItems, blocked: blockedMemoryFiles } = collectMemoryItems(folder);
  const [automationItems, toolItems] = await Promise.all([
    collectBotAutomations(orcaBin, meta.id, counts),
    collectBotTools(orcaBin, meta.name, counts),
  ]);

  const cleanName = sanitizeTextWithReport(meta.name || path.basename(folder), counts).text.slice(0, 48);
  const purpose = extractPurposeFromSoul(sanitizedSoul, cleanName);
  const autoText = automationItems.map((a) => `${a.name} ${a.prompt}`).join(" ");
  const hay = `${cleanName}\n${purpose}\n${sanitizedSoul}\n${autoText}\n${skillItems.map((s) => s.name).join(" ")}`;
  const category = inferCategory(hay);
  const tags = inferTags(skillItems, hay);
  const connectors = inferConnectors(hay);

  const rawAv = typeof meta.avatar === "string" ? meta.avatar.trim() : "";
  const isCustomUpload = !rawAv || rawAv.startsWith("upload:");
  let avatarType = "mascot";
  let avatarValue = "";
  let avatarColor =
    typeof meta.avatarColor === "string" && /^#[0-9a-f]{6}$/i.test(meta.avatarColor.trim())
      ? meta.avatarColor.trim().toLowerCase()
      : "";
  let randomizedAvatar = false;

  if (rawAv.startsWith("mascot:")) {
    avatarValue = rawAv.slice("mascot:".length) || pickRandom(PICKABLE_MASCOTS);
    if (!avatarColor) avatarColor = "#b3dbf4";
  } else if (!isCustomUpload) {
    avatarType = "emoji";
    avatarValue = rawAv;
    if (!avatarColor) avatarColor = "#334155";
  } else {
    // Custom uploaded avatar is private/local -> replace with a random Orca mascot & swatch color
    avatarType = "mascot";
    avatarValue = pickRandom(PICKABLE_MASCOTS);
    if (!avatarColor) avatarColor = pickRandom(PICKABLE_COLORS);
    randomizedAvatar = true;
  }

  const avatarDataUrl =
    avatarType === "emoji"
      ? renderEmojiAvatarDataUrl(avatarValue, avatarColor)
      : renderMascotAvatarDataUrl(avatarValue, avatarColor, orcaBin);

  const totalRedactions = Object.values(counts).reduce((a, b) => a + b, 0);
  return {
    botId: meta.id || path.basename(folder),
    name: cleanName,
    purpose,
    category,
    tags,
    skills: skillItems.map((s) => s.name),
    agentHint: String(meta.agent || "claude").toLowerCase(),
    avatarType,
    avatarValue,
    avatarColor,
    avatarDataUrl: avatarDataUrl || "",
    randomizedAvatar,
    soulMd: sanitizedSoul,
    parts: {
      skills: skillItems,
      automations: automationItems,
      tools: toolItems,
      memory: memoryItems,
      blockedMemoryFiles,
      settings: {
        agent: String(meta.agent || "claude").toLowerCase(),
        outfit: String(meta.avatarOutfit || ""),
        connectors,
        setupNote: "",
        defaultChecked: true,
      },
    },
    redactions: { total: totalRedactions, counts, blockedMemoryFiles },
  };
}
