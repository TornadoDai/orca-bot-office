import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { renderEmojiAvatarDataUrl, renderMascotAvatarDataUrl } from "./orca-avatars.mjs";

const SHARE_ID_RE = /^[A-Za-z0-9_-]{1,128}$/;
const ORCA_SHARE_HOSTS = new Set(["app.orca.dev", "share.orca.dev", "share.onorca.dev"]);
const DEFAULT_MARKET_API_URL = "https://orca-bot-market.tornadodai.workers.dev";
const DEFAULT_MIRROR_URLS = [
  "https://cdn.jsdelivr.net/gh/TornadoDai/orca-bot-market@main/registry.json",
  "https://tornadodai.github.io/orca-bot-market/registry.json",
  "https://raw.githubusercontent.com/TornadoDai/orca-bot-market/main/registry.json",
];

let marketCache = { fetchedAt: 0, apiUrl: "", payload: null };

export function parseOrcaBotShareId(raw) {
  const value = String(raw || "").trim();
  if (!value) return null;
  if (SHARE_ID_RE.test(value)) return value;
  let url;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  const re = /^\/?bots\/share\/([A-Za-z0-9_-]{1,128})\/?$/;
  if (url.protocol === "orca:") {
    return `${url.host}${url.pathname}`.match(re)?.[1] ?? null;
  }
  if (url.protocol !== "https:" || !ORCA_SHARE_HOSTS.has(url.hostname)) {
    return null;
  }
  return url.pathname.match(re)?.[1] ?? null;
}

export async function getOrCreateClientId(storage) {
  try {
    const existing = await storage?.get?.("marketClientId");
    if (typeof existing === "string" && existing.length >= 16) return existing;
    const fresh = crypto.randomBytes(16).toString("hex");
    await storage?.set?.("marketClientId", fresh);
    return fresh;
  } catch {
    return crypto.createHash("sha256").update(os.homedir()).digest("hex").slice(0, 32);
  }
}

async function fetchJsonWithTimeout(url, options = {}, timeoutMs = 6000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: ctrl.signal });
    const text = await res.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch {}
    return { ok: res.ok, status: res.status, json, text };
  } finally {
    clearTimeout(timer);
  }
}

function enrichMarketBots(bots, orcaBin) {
  const list = Array.isArray(bots) ? bots : [];
  return list.map((b) => {
    const shareId = parseOrcaBotShareId(b.shareId || b.shareUrl) || "";
    let avatarDataUrl = "";
    if (b.avatarType === "emoji") {
      avatarDataUrl = renderEmojiAvatarDataUrl(b.avatarValue || "🤖", b.avatarColor || "#334155") || "";
    } else {
      avatarDataUrl =
        renderMascotAvatarDataUrl(b.avatarValue || "A1", b.avatarColor || "#b3dbf4", orcaBin) ||
        renderEmojiAvatarDataUrl("🤖", b.avatarColor || "#334155") ||
        "";
    }
    return {
      ...b,
      shareId,
      shareUrl: shareId ? `https://app.orca.dev/bots/share/${shareId}` : "",
      deepLink: shareId ? `orca://bots/share/${shareId}` : "",
      avatarDataUrl,
    };
  });
}

function readSoulSummary(folder) {
  const soulPath = path.join(folder, "SOUL.md");
  if (!fs.existsSync(soulPath)) return "";
  try {
    const lines = fs.readFileSync(soulPath, "utf8").split(/\r?\n/);
    for (const raw of lines) {
      const line = raw.trim();
      if (!line || line.startsWith("#") || line.startsWith("-") || line.startsWith(">")) continue;
      return line.replace(/\s+/g, " ").slice(0, 140);
    }
  } catch {
    return "";
  }
  return "";
}

export function collectLocalPublishProfiles(orcaBin, extraBotPaths = []) {
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

  const profiles = [];
  for (const folder of folders) {
    const metaPath = path.join(folder, "bot.json");
    if (!fs.existsSync(metaPath)) continue;
    try {
      const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
      if (!meta.name) continue;
      const rawAv = typeof meta.avatar === "string" ? meta.avatar.trim() : "";
      let avatarType = "mascot";
      let avatarValue = "A1";
      if (rawAv.startsWith("mascot:")) {
        avatarValue = rawAv.slice("mascot:".length) || "A1";
      } else if (rawAv && !rawAv.startsWith("upload:")) {
        avatarType = "emoji";
        avatarValue = rawAv;
      }
      const avatarColor =
        typeof meta.avatarColor === "string" && /^#[0-9a-f]{6}$/i.test(meta.avatarColor.trim())
          ? meta.avatarColor.trim().toLowerCase()
          : "#b3dbf4";
      const avatarDataUrl =
        avatarType === "emoji"
          ? renderEmojiAvatarDataUrl(avatarValue, avatarColor)
          : renderMascotAvatarDataUrl(avatarValue, avatarColor, orcaBin);
      profiles.push({
        id: meta.id || path.basename(folder),
        name: String(meta.name).slice(0, 48),
        agentHint: String(meta.agent || "claude").toLowerCase(),
        purpose: readSoulSummary(folder),
        avatarType,
        avatarValue,
        avatarColor,
        avatarDataUrl: avatarDataUrl || "",
      });
    } catch {
      // Ignore unreadable bot folder
    }
  }
  return profiles.sort((a, b) => a.name.localeCompare(b.name));
}

export async function fetchMarketCatalog({ apiUrl = "", clientId = "", orcaBin = "", force = false, extraBotPaths = [] }) {
  const cleanApi = (String(apiUrl || "").trim() || DEFAULT_MARKET_API_URL).replace(/\/+$/, "");
  const now = Date.now();
  if (!force && marketCache.payload && marketCache.apiUrl === cleanApi && now - marketCache.fetchedAt < 45000) {
    return { ...marketCache.payload, localBots: collectLocalPublishProfiles(orcaBin, extraBotPaths) };
  }

  let data = null;
  let sourceMode = "offline";
  let liveWritable = false;
  let error = "";

  if (cleanApi) {
    try {
      const r = await fetchJsonWithTimeout(
        `${cleanApi}/api/bots?limit=150`,
        { headers: { "X-Client-Id": clientId, Accept: "application/json" } },
        5500
      );
      if (r.ok && r.json && Array.isArray(r.json.bots)) {
        data = r.json;
        sourceMode = "live";
        liveWritable = true;
      } else {
        error = r.json?.error || `Market API HTTP ${r.status}`;
      }
    } catch (e) {
      error = e?.name === "AbortError" ? "Market API timed out" : String(e?.message || e);
    }
  }

  if (!data) {
    for (const mirrorUrl of DEFAULT_MIRROR_URLS) {
      try {
        const r = await fetchJsonWithTimeout(mirrorUrl, { headers: { Accept: "application/json" } }, 5000);
        if (r.ok && r.json && Array.isArray(r.json.bots)) {
          data = r.json;
          sourceMode = "mirror";
          liveWritable = false;
          break;
        }
      } catch {
        // Try next CDN mirror
      }
    }
  }

  const bots = enrichMarketBots(data?.bots || [], orcaBin);
  const stats = data?.stats || {
    totalBots: bots.length,
    verifiedBots: bots.filter((b) => b.trust === "verified").length,
    totalHires: bots.reduce((a, b) => a + Number(b.hiresCount || 0), 0),
    totalLikes: bots.reduce((a, b) => a + Number(b.likesCount || 0), 0),
  };

  const payload = {
    sourceMode,
    liveWritable,
    apiConfigured: Boolean(cleanApi),
    apiUrl: cleanApi,
    error: data ? "" : error,
    updatedAt: data?.updatedAt || now,
    stats,
    bots,
  };
  marketCache = { fetchedAt: now, apiUrl: cleanApi, payload };
  return { ...payload, localBots: collectLocalPublishProfiles(orcaBin, extraBotPaths) };
}

export async function postMarketAction({ apiUrl, clientId, pathSuffix, body = null }) {
  const cleanApi = (String(apiUrl || "").trim() || DEFAULT_MARKET_API_URL).replace(/\/+$/, "");
  if (!cleanApi) {
    throw new Error("Market API URL is not configured yet (set marketApiUrl in Bot Office settings).");
  }
  const r = await fetchJsonWithTimeout(
    `${cleanApi}${pathSuffix}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Client-Id": clientId,
      },
      body: body ? JSON.stringify(body) : "{}",
    },
    8000
  );
  if (!r.ok) {
    throw new Error(r.json?.error || `Request failed (${r.status})`);
  }
  marketCache.fetchedAt = 0;
  return r.json || { ok: true };
}

export function openOrcaBotShareDeepLink(shareId) {
  const cleanId = parseOrcaBotShareId(shareId);
  if (!cleanId) throw new Error("Invalid Orca share link");
  const deepLink = `orca://bots/share/${cleanId}`;
  const webUrl = `https://app.orca.dev/bots/share/${cleanId}`;

  if (process.platform === "darwin") {
    const child = spawn("open", [deepLink], { stdio: "ignore", detached: true });
    child.unref();
  } else if (process.platform === "win32") {
    const child = spawn("cmd", ["/c", "start", "", deepLink], { stdio: "ignore", detached: true });
    child.unref();
  } else {
    const child = spawn("xdg-open", [deepLink], { stdio: "ignore", detached: true });
    child.unref();
  }
  return { ok: true, shareId: cleanId, deepLink, webUrl };
}
