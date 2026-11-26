import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { renderEmojiAvatarDataUrl, renderMascotAvatarDataUrl } from "./orca-avatars.mjs";

const SKIPPED_PRIVATE_FILES = ["MEMORY.md", "memory/", ".env", "auth / credentials", "chat history"];

const RULES = [
  {
    bucket: "secrets",
    re: /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z0-9 ]*PRIVATE KEY-----/gi,
    rep: "[已脱敏私钥]",
  },
  {
    bucket: "secrets",
    re: /\b(?:sk-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9]{20,}|gho_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|xox[baprs]-[A-Za-z0-9-]{16,}|AKIA[0-9A-Z]{16}|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,})\b/g,
    rep: "[已脱敏凭据]",
  },
  {
    bucket: "secrets",
    re: /((?:api[_-]?key|access[_-]?token|refresh[_-]?token|secret|password|passwd|bearer)\s*[:=]\s*["']?)([^\s"'`,;]{8,})(["']?)/gi,
    rep: "$1[已脱敏]$3",
  },
  {
    bucket: "secrets",
    re: /(https?:\/\/)([^:\s/@]+):([^@\s/]+)@/gi,
    rep: "$1[已脱敏]@",
  },
  {
    bucket: "emails",
    re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
    rep: "[已脱敏邮箱]",
  },
  {
    bucket: "phones",
    re: /(?<!\d)(?:\+?86[- ]?)?1[3-9]\d{9}(?!\d)/g,
    rep: "[已脱敏手机号]",
  },
  {
    bucket: "ips",
    re: /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)(?::\d{1,5})?\b/g,
    rep: "[已脱敏IP]",
  },
  {
    bucket: "paths",
    re: /(?:\/Users\/|\/home\/)[^\s"'`),;:\]]+/g,
    rep: "<本机路径>",
  },
  {
    bucket: "paths",
    re: /[A-Za-z]:\\Users\\[^\s"'`),;:\]]+/g,
    rep: "<本机路径>",
  },
  {
    bucket: "paths",
    re: /~\/\.orca\/bots\/[^\s"'`),;:\]]+/g,
    rep: "<Bot目录>",
  },
  {
    bucket: "ssh",
    re: /\bssh\s+(?:-[A-Za-z0-9]+\s+)*[a-zA-Z0-9._@-]+/g,
    rep: "ssh <server>",
  },
];

export function sanitizeTextWithReport(rawText, counts = null) {
  const tally = counts || { secrets: 0, emails: 0, phones: 0, ips: 0, paths: 0, ssh: 0 };
  let text = String(rawText || "").replace(/\r\n/g, "\n");
  for (const rule of RULES) {
    text = text.replace(rule.re, (...args) => {
      tally[rule.bucket] = (tally[rule.bucket] || 0) + 1;
      if (typeof rule.rep === "string" && rule.rep.includes("$1")) {
        return rule.rep
          .replace("$1", args[1] || "")
          .replace("$3", args[3] || "");
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
  let best = "general";
  let bestScore = 0;
  for (const [cat, re] of scores) {
    const m = s.match(re);
    const sc = m ? m.length : 0;
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
  for (const sk of skills) add(sk);
  const kwPairs = [
    [/github|pr\b|pull request/i, "github"],
    [/k8s|kubernetes|pod\b/i, "k8s"],
    [/grafana|loki|prometheus|可观测/i, "observability"],
    [/docker|container/i, "docker"],
    [/feishu|lark|飞书/i, "feishu"],
    [/slack/i, "slack"],
    [/linear/i, "linear"],
    [/release|发版|发布/i, "release"],
    [/日报|周报|standup/i, "summary"],
    [/排障|debug|bug/i, "debug"],
    [/审查|review/i, "review"],
    [/助理|日常|效率/i, "assistant"],
  ];
  for (const [re, tag] of kwPairs) {
    if (re.test(haystack)) add(tag);
  }
  return tags;
}

function extractPurposeFromSoul(sanitizedSoul, fallbackName) {
  const lines = String(sanitizedSoul || "").split(/\n/);
  for (const raw of lines) {
    const l = raw.trim();
    if (!l || l.startsWith("#") || l.startsWith("```") || l.startsWith("---") || l.startsWith(">")) continue;
    const clean = l.replace(/^[-*•]\s*/, "").replace(/\*\*/g, "").replace(/\s+/g, " ").trim();
    if (clean.length >= 8) return clean.slice(0, 140);
  }
  return `${fallbackName} — Orca Bot`;
}

function readLocalBotSkills(folder) {
  const skDir = path.join(folder, "skills");
  if (!fs.existsSync(skDir)) return [];
  try {
    return fs
      .readdirSync(skDir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && !d.name.startsWith("."))
      .map((d) => d.name)
      .slice(0, 16);
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

export function prepareLocalBotShareDraft({ botId, orcaBin = "", extraBotPaths = [] }) {
  const found = findLocalBotFolder(botId, extraBotPaths);
  if (!found) throw new Error("Local Bot not found");
  const { folder, meta } = found;

  const counts = { secrets: 0, emails: 0, phones: 0, ips: 0, paths: 0, ssh: 0 };
  const soulPath = path.join(folder, "SOUL.md");
  const rawSoul = fs.existsSync(soulPath) ? fs.readFileSync(soulPath, "utf8").slice(0, 16000) : "";
  const sanitizedSoul = sanitizeTextWithReport(rawSoul, counts).text;
  const skills = readLocalBotSkills(folder);

  const cleanName = sanitizeTextWithReport(meta.name || path.basename(folder), counts).text.slice(0, 48);
  const purpose = extractPurposeFromSoul(sanitizedSoul, cleanName);
  const hay = `${cleanName}\n${purpose}\n${sanitizedSoul}\n${skills.join(" ")}`;
  const category = inferCategory(hay);
  const tags = inferTags(skills, hay);

  const rawAv = typeof meta.avatar === "string" ? meta.avatar.trim() : "";
  let avatarType = "mascot";
  let avatarValue = "A1";
  if (rawAv.startsWith("mascot:")) avatarValue = rawAv.slice("mascot:".length) || "A1";
  else if (rawAv && !rawAv.startsWith("upload:")) { avatarType = "emoji"; avatarValue = rawAv; }
  const avatarColor =
    typeof meta.avatarColor === "string" && /^#[0-9a-f]{6}$/i.test(meta.avatarColor.trim())
      ? meta.avatarColor.trim().toLowerCase()
      : "#b3dbf4";
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
    skills,
    agentHint: String(meta.agent || "claude").toLowerCase(),
    avatarType,
    avatarValue,
    avatarColor,
    avatarDataUrl: avatarDataUrl || "",
    soulMd: sanitizedSoul,
    redactions: { total: totalRedactions, counts, skippedFiles: SKIPPED_PRIVATE_FILES },
  };
}
