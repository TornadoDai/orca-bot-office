import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const AVATAR_CACHE_DIR = path.join(os.tmpdir(), "orca-bot-office-avatars");
const DEFAULT_MASCOT_BG = "#b3dbf4";
const MAX_RAW_AVATAR_BYTES = 2 * 1024 * 1024;
const MASCOT_PREFIX = "mascot:";
const UPLOAD_PREFIX = "upload:";

const avatarMemoryCache = new Map();
let cachedMascotIndex = null;

function buildExecEnv() {
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

function isDarkHex(hex) {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex || "");
  if (!m) return false;
  const ch = (h) => {
    const c = parseInt(h, 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * ch(m[1]) + 0.7152 * ch(m[2]) + 0.0722 * ch(m[3]) < 0.18;
}

function normalizeHexColor(val, fallback = DEFAULT_MASCOT_BG) {
  const s = typeof val === "string" ? val.trim() : "";
  return /^#[0-9a-f]{6}$/i.test(s) ? s.toLowerCase() : fallback;
}

function escapeXml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function candidateOrcaAssetsDirs(orcaBin = "") {
  const dirs = [];
  const pushFromBin = (binPath) => {
    if (!binPath || !path.isAbsolute(binPath)) return;
    const binDir = path.dirname(binPath);
    dirs.push(path.resolve(binDir, "..", "app.asar.unpacked", "out", "renderer", "assets"));
    dirs.push(path.resolve(binDir, "..", "out", "renderer", "assets"));
  };
  pushFromBin(orcaBin);
  try {
    if (orcaBin && fs.existsSync(orcaBin)) pushFromBin(fs.realpathSync(orcaBin));
  } catch {
    // Ignore realpath failure
  }
  if (process.resourcesPath) {
    dirs.push(path.join(process.resourcesPath, "app.asar.unpacked", "out", "renderer", "assets"));
    dirs.push(path.join(process.resourcesPath, "out", "renderer", "assets"));
  }
  if (process.platform === "darwin") {
    dirs.push("/Applications/Orca.app/Contents/Resources/app.asar.unpacked/out/renderer/assets");
    dirs.push(path.join(os.homedir(), "Applications/Orca.app/Contents/Resources/app.asar.unpacked/out/renderer/assets"));
  } else if (process.platform === "win32" && process.env.LOCALAPPDATA) {
    dirs.push(path.join(process.env.LOCALAPPDATA, "Programs", "Orca", "resources", "app.asar.unpacked", "out", "renderer", "assets"));
  }
  return [...new Set(dirs)];
}

function loadMascotAssetIndex(orcaBin = "") {
  if (cachedMascotIndex && cachedMascotIndex.svgs.size + cachedMascotIndex.webps.size > 0) {
    return cachedMascotIndex;
  }
  const svgs = new Map();
  const webps = new Map();
  for (const dir of candidateOrcaAssetsDirs(orcaBin)) {
    if (!fs.existsSync(dir)) continue;
    let entries = [];
    try {
      entries = fs.readdirSync(dir);
    } catch {
      continue;
    }
    for (const file of entries) {
      if (file.includes("-cut-") || file.includes("-rim-")) continue;
      const ms = /^([A-Z][0-9]+)-[A-Za-z0-9_-]+\.svg$/.exec(file);
      if (ms && !svgs.has(ms[1])) {
        svgs.set(ms[1], path.join(dir, file));
        continue;
      }
      const mw = /^([A-Z][0-9]+)-[A-Za-z0-9_-]+\.webp$/.exec(file);
      if (mw && !webps.has(mw[1])) {
        webps.set(mw[1], path.join(dir, file));
      }
    }
    if (svgs.size > 0 || webps.size > 0) break;
  }
  cachedMascotIndex = { svgs, webps };
  return cachedMascotIndex;
}

function renderMascotAvatarDataUrl(mascotId, avatarColor, orcaBin = "") {
  const bg = normalizeHexColor(avatarColor, DEFAULT_MASCOT_BG);
  const cacheKey = `mascot:${mascotId}:${bg}`;
  const cached = avatarMemoryCache.get(cacheKey);
  if (cached) return cached.dataUrl;

  const { svgs, webps } = loadMascotAssetIndex(orcaBin);
  const svgPath = svgs.get(mascotId);
  if (svgPath && fs.existsSync(svgPath)) {
    try {
      const rim = isDarkHex(bg) ? "1" : "0";
      const rawSvg = fs.readFileSync(svgPath, "utf8");
      const themedSvg = rawSvg
        .replace(/var\(--avatar-bg,[^)]+\)/g, bg)
        .replace(/var\(--avatar-rim,[^)]+\)/g, rim);
      const dataUrl = `data:image/svg+xml;base64,${Buffer.from(themedSvg, "utf8").toString("base64")}`;
      avatarMemoryCache.set(cacheKey, { mtimeMs: 0, dataUrl });
      return dataUrl;
    } catch {
      // Fall through to webp fallback
    }
  }

  const webpPath = webps.get(mascotId);
  if (webpPath && fs.existsSync(webpPath)) {
    try {
      const b64 = fs.readFileSync(webpPath).toString("base64");
      const dataUrl = `data:image/webp;base64,${b64}`;
      avatarMemoryCache.set(cacheKey, { mtimeMs: 0, dataUrl });
      return dataUrl;
    } catch {
      return null;
    }
  }
  return null;
}

function renderEmojiAvatarDataUrl(emoji, avatarColor) {
  const bg = normalizeHexColor(avatarColor, "#334155");
  const cacheKey = `emoji:${emoji}:${bg}`;
  const cached = avatarMemoryCache.get(cacheKey);
  if (cached) return cached.dataUrl;

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">` +
    `<rect width="128" height="128" fill="${bg}"/>` +
    `<text x="64" y="68" text-anchor="middle" dominant-baseline="central" font-size="68" ` +
    `font-family="Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif">${escapeXml(emoji)}</text>` +
    `</svg>`;
  const dataUrl = `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`;
  avatarMemoryCache.set(cacheKey, { mtimeMs: 0, dataUrl });
  return dataUrl;
}

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
    if (raw.length > MAX_RAW_AVATAR_BYTES) return null;
    const ext = path.extname(imgPath).toLowerCase();
    const mime = ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : ext === ".webp" ? "image/webp" : "image/png";
    const dataUrl = `data:${mime};base64,${raw.toString("base64")}`;
    avatarMemoryCache.set(cacheKey, { mtimeMs, dataUrl });
    return dataUrl;
  } catch {
    return null;
  }
}

async function resolveUploadedFile(folder, key) {
  const imgPath = ["avatar.png", "avatar.jpg", "avatar.jpeg", "avatar.webp"]
    .map((f) => path.join(folder, f))
    .find((p) => fs.existsSync(p));
  if (!imgPath) return null;
  const stat = fs.statSync(imgPath);
  return await toTinyAvatarDataUrl(imgPath, key, stat.mtimeMs);
}

async function resolveBotAvatar(folder, meta, orcaBin) {
  const key = String(meta.id || path.basename(folder)).replace(/[^a-zA-Z0-9_-]/g, "_");
  const rawAvatar = typeof meta.avatar === "string" ? meta.avatar.trim() : "";

  if (rawAvatar.startsWith(MASCOT_PREFIX)) {
    const mascotId = rawAvatar.slice(MASCOT_PREFIX.length);
    const mascotUrl = mascotId ? renderMascotAvatarDataUrl(mascotId, meta.avatarColor, orcaBin) : null;
    if (mascotUrl) return mascotUrl;
    return await resolveUploadedFile(folder, key);
  }

  if (rawAvatar.startsWith(UPLOAD_PREFIX) || !rawAvatar) {
    return await resolveUploadedFile(folder, key);
  }

  // Legacy emoji avatar (from before Orca mascots)
  return renderEmojiAvatarDataUrl(rawAvatar, meta.avatarColor);
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

export async function collectBotAvatars({ orcaBin = "", ownerAvatarPath = "", extraBotPaths = [] } = {}) {
  const orcaHome = process.env.ORCA_HOME || path.join(os.homedir(), ".orca");
  const botsRoot = path.join(orcaHome, "bots");
  const folderSet = new Set();

  if (fs.existsSync(botsRoot)) {
    for (const dir of fs.readdirSync(botsRoot, { withFileTypes: true })) {
      if (dir.isDirectory()) folderSet.add(path.resolve(botsRoot, dir.name));
    }
  }
  for (const p of Array.isArray(extraBotPaths) ? extraBotPaths : []) {
    if (typeof p === "string" && p.trim() && fs.existsSync(p)) {
      folderSet.add(path.resolve(p));
    }
  }

  const avatars = {};
  await mapWithConcurrency([...folderSet], 3, async (folder) => {
    const metaPath = path.join(folder, "bot.json");
    if (!fs.existsSync(metaPath)) return;
    try {
      const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
      const dataUrl = await resolveBotAvatar(folder, meta, orcaBin);
      if (!dataUrl) return;
      if (meta.id) avatars[meta.id] = dataUrl;
      if (meta.name) avatars[meta.name] = dataUrl;
    } catch {
      // Ignore unreadable folder
    }
  });

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
