const orcaApi = window.orca;
let snapshot = null;
let avatars = {};
let viewMode = "office";
let activeOnly = false;
let searchQuery = "";
let engineFilter = "all";
let guestExpanded = false;
let openCard = null;
let decisionCursor = 0;
let seenDecisionKeys = new Set();
let hasLoadedOnce = false;
const expandedStaleTeams = new Set();

const I18N = window.OFFICE_I18N;

function getLang() {
  const pref = snapshot?.settings?.language || "auto";
  if (pref === "zh" || pref === "en") return pref;
  const loc = String(orcaApi?.locale || navigator.language || "en").toLowerCase();
  return loc.startsWith("zh") ? "zh" : "en";
}
function t() { return I18N[getLang()] || I18N.en; }
function esc(s) {
  return String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function engMeta(raw) {
  const k = String(raw || "").toLowerCase();
  const styles = window.OFFICE_ENG_STYLES || {};
  return styles[k] || styles.other || { key: "other", short: raw || "agent", sym: "•", color: "#94a3b8" };
}
function engPillHtml(raw) {
  const m = engMeta(raw);
  return `<span class="eng-pill ${esc(m.key)}">${esc(m.sym)} ${esc(m.short)}</span>`;
}
function fmtDur(ms) {
  const mins = Math.max(0, Math.floor(ms / 60000));
  if (mins < 1) return "<1m";
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  return `${h}h${mins % 60 ? (mins % 60) + "m" : ""}`;
}
function relTime(ts) {
  if (!ts) return "";
  const sec = Math.max(0, Math.floor((Date.now() - Number(ts)) / 1000));
  const tr = t();
  if (sec < 60) return tr.justNow;
  const min = Math.floor(sec / 60);
  if (min < 60) return tr.minsAgo(min);
  const hr = Math.floor(min / 60);
  if (hr < 24) return tr.hrsAgo(hr);
  return tr.daysAgo(Math.floor(hr / 24));
}
function isStalled(entity) {
  const touch = Math.max(Number(entity.lastActivityAt || 0), Number(entity.stateStartedAt || 0));
  return entity.state === "working" && touch > 0 && Date.now() - touch > 12 * 60 * 1000;
}

function showToast(msg, isAttn = false, onClick = null) {
  const wrap = document.getElementById("toastWrap");
  const el = document.createElement("div");
  el.className = `toast ${isAttn ? "attn" : ""}`;
  el.textContent = msg;
  el.addEventListener("click", () => { if (onClick) onClick(); el.remove(); });
  wrap.appendChild(el);
  setTimeout(() => el.remove(), 5500);
}

async function openWorkspace(worktreeId, focusAttention = false) {
  if (!worktreeId || !orcaApi?.plugin?.request) return;
  try { await orcaApi.plugin.request("office.openWorkspace", { workspaceId: worktreeId, focusAttention }); }
  catch (err) { console.error("openWorkspace failed:", err); }
}
async function openTasksView() {
  if (!orcaApi?.plugin?.request) return;
  try { await orcaApi.plugin.request("office.openTasksView", {}); }
  catch (err) { console.error("openTasksView failed:", err); }
}
async function openExternalUrl(url) {
  if (url && orcaApi?.shell?.openExternal) {
    await orcaApi.shell.openExternal(url).catch(() => {});
  }
}
function jumpToBotDecision(bot) {
  if (bot.selfNeedsDecision && bot.worktreeId) { void openWorkspace(bot.worktreeId, true); return; }
  const blockedW = (bot.workers || []).find((w) => w.needsDecision);
  if (blockedW?.worktreeId) { void openWorkspace(blockedW.worktreeId, true); return; }
  if (bot.worktreeId) void openWorkspace(bot.worktreeId, true);
  else void openTasksView();
}

const towerMgr = new window.OfficeTowerEngine({
  onRedDotClick(node) {
    if (node.kind === "bot") jumpToBotDecision(node.bot);
    else if (node.worker?.worktreeId) void openWorkspace(node.worker.worktreeId, true);
  },
  onActorClick(node) {
    openCard = node.kind === "bot"
      ? { kind: "bot", id: node.bot.id }
      : { kind: "worker", worktreeId: node.worker.worktreeId };
    renderModal();
  },
  onActorDblClick(node) {
    const wid = node.kind === "bot" ? node.bot.worktreeId : node.worker.worktreeId;
    if (wid) void openWorkspace(wid, true);
  },
});

function filterBots(rawBots) {
  const q = searchQuery.trim().toLowerCase();
  const eng = engineFilter;
  return rawBots
    .map((b) => {
      const matchBotEng = eng === "all" || String(b.agent || "").toLowerCase() === eng;
      const matchBotQ = !q || b.name.toLowerCase().includes(q) || (b.activity || "").toLowerCase().includes(q);
      const filteredWorkers = (b.workers || []).filter((w) => {
        const wEng = eng === "all" || String(w.agentType || "").toLowerCase() === eng;
        const wQ = !q || w.displayName.toLowerCase().includes(q) || (w.activity || "").toLowerCase().includes(q) || (w.branch || "").toLowerCase().includes(q);
        const wAct = !activeOnly || w.needsDecision || w.state === "working";
        return wEng && wQ && wAct;
      });
      const botActive = !activeOnly || b.needsDecision || b.state === "working" || b.workingWorkerCount > 0;
      const keep = (matchBotEng && matchBotQ && botActive) || filteredWorkers.length > 0;
      if (!keep) return null;
      return { ...b, workers: q || eng !== "all" || activeOnly ? filteredWorkers : b.workers };
    })
    .filter(Boolean);
}

function miniRobotBadgeHtml(w) {
  const m = engMeta(w.agentType);
  const eye = w.needsDecision ? "#fb7185" : (w.state === "working" ? "#4ade80" : "#64748b");
  return `<svg viewBox="0 0 28 28" width="22" height="22">
    <rect x="4" y="6" width="20" height="16" rx="5" fill="#f8fafc" stroke="${m.color}" stroke-width="2"/>
    <rect x="7" y="10" width="14" height="8" rx="3" fill="#0f172a"/>
    <circle cx="11.5" cy="14" r="1.8" fill="${eye}"/><circle cx="16.5" cy="14" r="1.8" fill="${eye}"/>
  </svg>`;
}

function buildBossQueue(bots) {
  const queue = [];
  for (const b of bots) {
    if (b.selfNeedsDecision) {
      const firstItem = (b.needsYouItems || [])[0];
      const snippet = firstItem ? `#${firstItem.number} ${firstItem.title}` : (b.activity || t().stateNeed);
      queue.push({
        kind: "bot",
        bot: b,
        worker: null,
        snippet,
        count: Math.max(1, (b.needsYouItems || []).length),
      });
    }
    for (const w of (b.workers || [])) {
      if (w.needsDecision) {
        queue.push({
          kind: "worker",
          bot: b,
          worker: w,
          snippet: w.activity || t().stateNeedPerm,
          count: 1,
        });
      }
    }
  }
  return queue;
}

function renderTower(bots) {
  const tr = t();
  const root = document.getElementById("towerRoot");
  if (!bots.length) {
    towerMgr.pause();
    const hasAny = (snapshot?.bots || []).length > 0;
    root.innerHTML = `<div class="empty-card"><div class="empty-title">${esc(hasAny ? tr.emptyFilter : tr.emptyTitle)}</div><div class="empty-sub">${esc(hasAny ? "" : tr.emptySub)}</div></div>`;
    return;
  }

  const soloInLounge = snapshot.settings?.soloBotsInLounge !== false;
  const staleHours = Number(snapshot.settings?.hideStaleIdleHours ?? 24);
  const staleMs = staleHours > 0 ? staleHours * 3600 * 1000 : 0;
  const now = Date.now();
  const handoffs = (snapshot.mailLinks || []).filter((m) => m.kind === "handoff");

  // 1) Top Penthouse: Boss Office with Queueing Bots & Workers
  const bossQueue = buildBossQueue(bots);
  const specs = [];
  let html = "";

  const bossBadgeCls = bossQueue.length > 0 ? "attn" : "";
  const bossBadgeHtml = bossQueue.length > 0
    ? `<span class="f-badge attn"><span class="f-badge-dot"></span>${esc(tr.bossBadgeQueue(bossQueue.length))}</span>`
    : `<span class="f-badge">${esc(tr.bossBadgeCalm)}</span>`;

  html += `
    <div class="floor-card is-boss ${bossQueue.length > 0 ? "has-queue" : ""}">
      <div class="floor-bar">
        <div class="floor-bar-left">
          <span class="f-num boss">TOP</span>
          <span class="f-title">👑 ${esc(tr.bossTitle)}</span>
        </div>
        <div class="floor-bar-right">${bossBadgeHtml}</div>
      </div>
      <div class="floor-canvas-wrap"><canvas class="floor-canvas" id="dnf_floor_boss"></canvas></div>
    </div>`;

  specs.push({ canvasId: "dnf_floor_boss", kind: "boss", queue: bossQueue, lang: getLang() });

  // 2) Team Floors + Ground Floor Lounge
  const teamBots = [];
  const soloBots = [];
  for (const b of bots) {
    if (!soloInLounge || (b.workers && b.workers.length > 0)) teamBots.push(b);
    else soloBots.push(b);
  }
  teamBots.sort((a, b) => {
    const sc = (x) => (x.needsDecision ? 1000 : 0) + (x.workingWorkerCount * 20) + (x.state === "working" ? 10 : 0) + (x.workers.length > 0 ? 2 : 0);
    return sc(b) - sc(a);
  });

  const showLounge = soloBots.length > 0;
  const totalFloors = teamBots.length + (showLounge ? 1 : 0);

  teamBots.forEach((b, idx) => {
    const floorNum = totalFloors - idx;
    const canvasId = `dnf_floor_team_${idx}`;
    const allW = b.workers || [];
    const isExpanded = expandedStaleTeams.has(b.id);
    let visibleWorkers = allW;
    let staleCount = 0;

    if (staleMs > 0) {
      const fresh = [];
      for (const w of allW) {
        const touch = Math.max(Number(w.lastActivityAt || 0), Number(w.stateStartedAt || 0));
        const stale = !w.needsDecision && w.state !== "working" && touch > 0 && now - touch > staleMs;
        if (stale) staleCount++;
        else fresh.push(w);
      }
      if (!isExpanded) visibleWorkers = fresh;
    }

    const isHot = b.state === "working" || b.workingWorkerCount > 0 || b.needsDecision;
    const badgeCls = b.needsDecision ? "attn" : (isHot ? "hot" : "");
    const badgeTxt = allW.length ? tr.teamBadge(b.workingWorkerCount, allW.length, b.decisionCount) : (isHot ? tr.stateWorking : tr.stateIdle);
    const staleBtn = staleCount > 0
      ? `<button class="f-stale-btn" data-toggle-stale="${esc(b.id)}">${esc(isExpanded ? tr.staleHide : tr.staleShow(staleCount))}</button>`
      : "";

    html += `
      <div class="floor-card ${b.needsDecision ? "is-attn" : ""}">
        <div class="floor-bar">
          <div class="floor-bar-left">
            <span class="f-num">${floorNum}F</span>
            <span class="f-title">${esc(b.name)}</span>
            ${engPillHtml(b.agent)}
          </div>
          <div class="floor-bar-right">
            ${staleBtn}
            <span class="f-badge ${badgeCls}">${b.needsDecision ? `<span class="f-badge-dot"></span>` : ""}${esc(badgeTxt)}</span>
          </div>
        </div>
        <div class="floor-canvas-wrap"><canvas class="floor-canvas" id="${canvasId}"></canvas></div>
      </div>`;

    specs.push({
      canvasId,
      kind: "team",
      bot: b,
      visibleWorkers,
      crossHandoffs: handoffs.filter((h) => h.from === b.id || h.to === b.id),
      lang: getLang(),
    });
  });

  if (showLounge) {
    const canvasId = "dnf_floor_lounge";
    const activeSolos = soloBots.filter((b) => b.needsDecision || b.state === "working");
    const idleSolos = soloBots.filter((b) => !b.needsDecision && b.state !== "working");
    const decCount = soloBots.reduce((acc, b) => acc + (b.decisionCount || 0), 0);
    const badgeCls = decCount > 0 ? "attn" : (activeSolos.length > 0 ? "hot" : "");
    const soloIds = new Set(soloBots.map((b) => b.id));

    html += `
      <div class="floor-card ${decCount > 0 ? "is-attn" : ""}">
        <div class="floor-bar">
          <div class="floor-bar-left">
            <span class="f-num">1F</span>
            <span class="f-title">${esc(tr.loungeTitle)}</span>
          </div>
          <div class="floor-bar-right">
            <span class="f-badge ${badgeCls}">${decCount > 0 ? `<span class="f-badge-dot"></span>` : ""}${esc(tr.loungeBadge(activeSolos.length, idleSolos.length, decCount))}</span>
          </div>
        </div>
        <div class="floor-canvas-wrap"><canvas class="floor-canvas" id="${canvasId}"></canvas></div>
      </div>`;

    specs.push({
      canvasId,
      kind: "lounge",
      activeSolos,
      idleSolos,
      crossHandoffs: handoffs.filter((h) => soloIds.has(h.from) || soloIds.has(h.to)),
      lang: getLang(),
    });
  }

  root.innerHTML = html;
  root.querySelectorAll("[data-toggle-stale]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-toggle-stale");
      if (expandedStaleTeams.has(id)) expandedStaleTeams.delete(id);
      else expandedStaleTeams.add(id);
      render();
    });
  });

  towerMgr.mount(specs);
}

function renderListView(bots) {
  const tr = t();
  const now = Date.now();
  const needRows = [], workRows = [], idleRows = [];

  for (const b of bots) {
    const av = avatars[b.id] || avatars[b.name];
    const avHtml = av ? `<img src="${av}" alt=""/>` : `<span style="font-weight:800">${esc((b.name || "?").slice(0, 1).toUpperCase())}</span>`;
    const bStall = isStalled(b);
    const bDur = b.state === "working" && b.stateStartedAt ? fmtDur(now - b.stateStartedAt) : "";
    const bRow = {
      attr: `data-card-bot="${esc(b.id)}" data-dblopen="${esc(b.worktreeId || "")}"`,
      jumpAttr: `data-jump-bot="${esc(b.id)}"`,
      avHtml, name: b.name, role: tr.roleBot, engRaw: b.agent,
      sub: b.needsYouItems?.length ? `#${b.needsYouItems[0].number} ${b.needsYouItems[0].title}` : (b.activity || tr.stateIdle),
      attnCount: b.decisionCount || 0, needs: b.needsDecision,
      working: b.state === "working" || b.workingWorkerCount > 0,
      stall: bStall, dur: bDur, time: relTime(b.lastActivityAt),
    };
    if (bRow.needs) needRows.push(bRow);
    else if (bRow.working) workRows.push(bRow);
    else idleRows.push(bRow);

    for (const w of (b.workers || [])) {
      const wStall = isStalled(w);
      const wDur = w.state === "working" && w.stateStartedAt ? fmtDur(now - w.stateStartedAt) : "";
      const wRow = {
        attr: `data-card-worker="${esc(w.worktreeId)}" data-dblopen="${esc(w.worktreeId)}"`,
        jumpAttr: `data-jump-ws="${esc(w.worktreeId)}"`,
        avHtml: miniRobotBadgeHtml(w),
        name: w.displayName, role: tr.roleWorker(b.name), engRaw: w.agentType,
        sub: w.activity || tr.stateIdle,
        attnCount: w.needsDecision ? 1 : 0, needs: w.needsDecision,
        working: w.state === "working", stall: wStall, dur: wDur, time: relTime(w.lastActivityAt),
      };
      if (wRow.needs) needRows.push(wRow);
      else if (wRow.working) workRows.push(wRow);
      else idleRows.push(wRow);
    }
  }

  const renderGrp = (title, dot, rows, attn = false) => {
    if (!rows.length) return "";
    return `
      <div class="wb-group ${attn ? "attn" : ""}">
        <div class="wb-g-head"><span class="left"><span class="cnt-dot ${dot}"></span>${esc(title)}</span><span>${rows.length}</span></div>
        ${rows.map((r) => `
          <div class="wb-row ${r.needs ? "attn" : ""}" ${r.attr}>
            <div class="wb-av">${r.avHtml}${r.needs ? `<span class="wb-av-dot">${r.attnCount > 1 ? r.attnCount : "!"}</span>` : ""}</div>
            <div class="wb-body">
              <div class="wb-top">
                <span class="wb-name">${esc(r.name)}</span>
                ${engPillHtml(r.engRaw)}
                <span class="wb-tag">${esc(r.role)}</span>
                ${r.stall ? `<span class="wb-tag stall">⚠ ${esc(r.dur)}</span>` : (r.dur ? `<span class="wb-tag">${esc(r.dur)}</span>` : "")}
              </div>
              <div class="wb-sub">${esc(r.sub)}</div>
            </div>
            ${r.needs ? `<button class="wb-go-btn" ${r.jumpAttr}>${esc(tr.listGoDecide)}</button>` : `<span class="wb-time">${esc(r.time || "↗")}</span>`}
          </div>`).join("")}
      </div>`;
  };

  const html = renderGrp(tr.grpNeed, "rose", needRows, true) + renderGrp(tr.grpWork, "blue", workRows) + renderGrp(tr.grpIdle, "gray", idleRows);
  const listEl = document.getElementById("listView");
  listEl.innerHTML = `<div class="workbench">${html || `<div style="text-align:center;color:var(--muted);padding:32px">${esc(tr.emptyFilter)}</div>`}</div>`;
  bindDomClickHandlers(listEl);
}

function findCardTarget() {
  if (!openCard || !snapshot) return null;
  const bots = snapshot.bots || [];
  if (openCard.kind === "bot") {
    const bot = bots.find((b) => b.id === openCard.id);
    return bot ? { kind: "bot", bot } : null;
  }
  if (openCard.kind === "worker") {
    for (const bot of bots) {
      const worker = (bot.workers || []).find((w) => w.worktreeId === openCard.worktreeId);
      if (worker) return { kind: "worker", worker, bot };
    }
    return null;
  }
  if (openCard.kind === "standalone") {
    const worker = (snapshot.standalone || []).find((w) => w.worktreeId === openCard.worktreeId);
    return worker ? { kind: "standalone", worker } : null;
  }
  return null;
}

function renderModal() {
  const root = document.getElementById("modalRoot");
  const target = findCardTarget();
  if (!target) { root.innerHTML = ""; return; }
  const tr = t();
  const now = Date.now();

  let title = "", roleText = "", engRaw = "", repo = "", branch = "";
  let statusCls = "idle", statusText = "", needsDec = false, lastAt = null;
  let timeline = [], links = [], avatarHtml = "", primaryWsId = null, attnWorkerWsId = null;
  let workersHtml = "", decisionsHtml = "", hasItems = false;

  if (target.kind === "bot") {
    const b = target.bot;
    title = b.name; roleText = tr.roleBot; engRaw = b.agent;
    needsDec = b.needsDecision; lastAt = b.lastActivityAt;
    timeline = b.timeline || []; links = b.links || []; primaryWsId = b.worktreeId;
    const firstDecW = (b.workers || []).find((w) => w.needsDecision);
    if (!b.selfNeedsDecision && firstDecW) attnWorkerWsId = firstDecW.worktreeId;

    const stall = isStalled(b);
    const dur = b.state === "working" && b.stateStartedAt ? fmtDur(now - b.stateStartedAt) : "";
    if (needsDec) {
      statusCls = "attn";
      statusText = `● ${(b.needsYouItems || []).length ? tr.stateNeedItem(b.needsYouItems.length) : (b.selfNeedsDecision ? tr.stateNeedPerm : tr.stateNeedWorker)}`;
    } else if (stall) { statusCls = "stall"; statusText = tr.stateStall(dur); }
    else if (b.state === "working" || b.workingWorkerCount > 0) { statusCls = "working"; statusText = `● ${tr.stateWorking}${dur ? ` · ${tr.stateRunDur(dur)}` : ""}`; }
    else { statusCls = "idle"; statusText = `💤 ${tr.stateIdle}`; }

    const av = avatars[b.id] || avatars[b.name];
    avatarHtml = av ? `<img src="${av}" alt=""/>` : `<span style="font-weight:800;font-size:16px">${esc((b.name || "?").slice(0, 1).toUpperCase())}</span>`;

    const items = b.needsYouItems || [];
    hasItems = items.length > 0;
    if (hasItems) {
      decisionsHtml = `
        <div class="ic-section-title">${esc(tr.secDecisions)}</div>
        ${items.map((it) => {
          const qs = it.ask?.questions || [];
          return `
            <div class="ic-decision-box">
              <div class="ic-dec-title"><span class="ic-dec-num">#${it.number}</span><span>${esc(it.title)}</span></div>
              ${it.ask?.context ? `<div class="ic-dec-ctx">${esc(it.ask.context)}</div>` : ""}
              ${qs.length ? `<div class="ic-q-list">${qs.map((q, qi) => `
                <div class="ic-q-item">
                  <div class="ic-q-prompt">${qi + 1}. ${esc(q.prompt)}</div>
                  ${(q.options || []).length ? `<div class="ic-q-opts">${q.options.map((opt, oi) => {
                    const isRec = q.recommended === oi;
                    return `<span class="ic-q-chip ${isRec ? "rec" : ""}">${isRec ? "★ " : ""}${esc(opt.label)}</span>`;
                  }).join("")}</div>` : ""}
                </div>`).join("")}</div>` : ""}
            </div>`;
        }).join("")}`;
    }

    if ((b.workers || []).length > 0) {
      workersHtml = `
        <div class="ic-section-title">${esc(tr.secWorkers(b.workingWorkerCount, b.workers.length))}</div>
        <div class="ic-workers">
          ${b.workers.map((w) => {
            const mode = w.needsDecision ? "attn" : (w.state === "working" ? "working" : "idle");
            const wd = w.state === "working" && w.stateStartedAt ? fmtDur(now - w.stateStartedAt) : "";
            return `
              <div class="ic-worker-row ${mode === "attn" ? "attn" : ""}" data-modal-switch-worker="${esc(w.worktreeId)}">
                <span class="ic-w-dot ${mode}"></span>
                <div class="ic-w-main">
                  <div class="ic-w-name">${esc(w.displayName)} ${engPillHtml(w.agentType)}${wd ? ` · ${esc(wd)}` : ""}</div>
                  <div class="ic-w-act">${esc(w.activity || tr.stateIdle)}</div>
                </div>
                <span class="ic-w-go ${w.needsDecision ? "attn" : ""}" data-modal-jump="${esc(w.worktreeId)}" data-modal-attn="${w.needsDecision ? "1" : "0"}">${w.needsDecision ? "● ↗" : "↗"}</span>
              </div>`;
          }).join("")}
        </div>`;
    }
  } else {
    const w = target.worker;
    title = w.displayName;
    roleText = target.kind === "worker" ? tr.roleWorker(target.bot.name) : tr.roleStandalone;
    engRaw = w.agentType; repo = w.repo; branch = w.branch;
    needsDec = w.needsDecision; lastAt = w.lastActivityAt;
    timeline = w.timeline || []; links = w.links || [];
    primaryWsId = w.worktreeId; avatarHtml = miniRobotBadgeHtml(w);

    const stall = isStalled(w);
    const dur = w.state === "working" && w.stateStartedAt ? fmtDur(now - w.stateStartedAt) : "";
    if (needsDec) { statusCls = "attn"; statusText = `● ${tr.stateNeedPerm}`; }
    else if (stall) { statusCls = "stall"; statusText = tr.stateStall(dur); }
    else if (w.state === "working") { statusCls = "working"; statusText = `● ${tr.stateWorking}${dur ? ` · ${tr.stateRunDur(dur)}` : ""}`; }
    else { statusCls = "idle"; statusText = `💤 ${tr.stateIdle}`; }
  }

  const linksHtml = links.length
    ? `<div class="ic-links">${links.map((lk) => `<button class="ic-link-chip" data-ext-url="${esc(lk.url)}">${lk.kind === "pr" ? "🔀 " : "🔗 "}${esc(lk.label)} ↗</button>`).join("")}</div>`
    : "";
  const timelineHtml = timeline.length
    ? timeline.map((row) => `<div class="ic-tl-row"><span class="ic-tl-lbl">${esc(row.label)}</span>${esc(row.text)}</div>`).join("")
    : `<div class="ic-tl-row" style="color:#94a3b8">${esc(tr.noActivity)}</div>`;
  const primaryLabel = needsDec && !attnWorkerWsId ? (target.kind === "bot" ? tr.btnGoDecide : tr.btnGoWorker) : tr.btnOpenWs;
  const primaryBtn = primaryWsId ? `<button class="ic-btn ${needsDec && !attnWorkerWsId ? "primary-attn" : ""}" id="icOpenBtn">${esc(primaryLabel)}</button>` : "";
  const jumpAttnWorkerBtn = attnWorkerWsId ? `<button class="ic-btn primary-attn" id="icJumpAttnWorkerBtn">${esc(tr.btnGoWorker)}</button>` : "";
  const tasksBtn = hasItems ? `<button class="ic-btn secondary" id="icTasksBtn">${esc(tr.btnOpenTasks)}</button>` : "";

  root.innerHTML = `
    <div class="card-backdrop" id="cardBackdrop">
      <div class="inspector-card ${needsDec ? "is-attn" : ""}">
        <div class="ic-head">
          <div class="ic-av">${avatarHtml}${needsDec ? `<span class="ic-av-dot"></span>` : ""}</div>
          <div class="ic-title-wrap">
            <div class="ic-name">${esc(title)}</div>
            <div class="ic-meta">
              ${engPillHtml(engRaw)}
              <span class="ic-pill">${esc(roleText)}</span>
              ${repo ? `<span class="ic-pill">${esc(repo)}</span>` : ""}
              ${branch ? `<span class="ic-pill branch" id="icCopyBranch" title="Click to copy branch">${esc(branch)}</span>` : ""}
            </div>
          </div>
          <button class="ic-close" id="icCloseBtn">×</button>
        </div>
        <div class="ic-status-bar ${statusCls}">
          <span>${esc(statusText)}</span>
          ${lastAt ? `<span class="ic-time">${esc(relTime(lastAt))}</span>` : ""}
        </div>
        ${linksHtml}
        ${decisionsHtml}
        <div class="ic-section-title">${esc(tr.secTimeline)}</div>
        <div class="ic-timeline">${timelineHtml}</div>
        ${workersHtml}
        <div class="ic-actions">
          <button class="ic-btn secondary" id="icDismissBtn">${esc(tr.btnClose)}</button>
          ${tasksBtn}
          ${jumpAttnWorkerBtn}
          ${primaryBtn}
        </div>
      </div>
    </div>`;

  const close = () => { openCard = null; renderModal(); };
  document.getElementById("cardBackdrop")?.addEventListener("click", (e) => { if (e.target.id === "cardBackdrop") close(); });
  document.getElementById("icCloseBtn")?.addEventListener("click", close);
  document.getElementById("icDismissBtn")?.addEventListener("click", close);
  document.getElementById("icOpenBtn")?.addEventListener("click", () => { if (primaryWsId) void openWorkspace(primaryWsId, needsDec); close(); });
  document.getElementById("icJumpAttnWorkerBtn")?.addEventListener("click", () => { if (attnWorkerWsId) void openWorkspace(attnWorkerWsId, true); close(); });
  document.getElementById("icTasksBtn")?.addEventListener("click", () => { void openTasksView(); close(); });
  document.getElementById("icCopyBranch")?.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(branch); showToast(tr.copiedBranch(branch)); } catch {}
  });
  document.querySelectorAll("[data-ext-url]").forEach((el) => {
    el.addEventListener("click", () => void openExternalUrl(el.getAttribute("data-ext-url")));
  });
  document.querySelectorAll("[data-modal-switch-worker]").forEach((el) => {
    el.addEventListener("click", () => { openCard = { kind: "worker", worktreeId: el.getAttribute("data-modal-switch-worker") }; renderModal(); });
  });
  document.querySelectorAll("[data-modal-jump]").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      const wid = el.getAttribute("data-modal-jump");
      if (wid) void openWorkspace(wid, el.getAttribute("data-modal-attn") === "1");
      close();
    });
  });
}

function bindDomClickHandlers(container) {
  container.querySelectorAll("[data-jump-bot]").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      const bot = (snapshot?.bots || []).find((b) => b.id === el.getAttribute("data-jump-bot"));
      if (bot) jumpToBotDecision(bot);
    });
  });
  container.querySelectorAll("[data-jump-ws]").forEach((el) => {
    el.addEventListener("click", (e) => { e.stopPropagation(); const wid = el.getAttribute("data-jump-ws"); if (wid) void openWorkspace(wid, true); });
  });
  container.querySelectorAll("[data-card-bot]").forEach((el) => {
    el.addEventListener("click", (e) => { e.stopPropagation(); openCard = { kind: "bot", id: el.getAttribute("data-card-bot") }; renderModal(); });
    el.addEventListener("dblclick", (e) => { e.stopPropagation(); const w = el.getAttribute("data-dblopen"); if (w) void openWorkspace(w, true); });
  });
  container.querySelectorAll("[data-card-worker]").forEach((el) => {
    el.addEventListener("click", (e) => { e.stopPropagation(); openCard = { kind: "worker", worktreeId: el.getAttribute("data-card-worker") }; renderModal(); });
    el.addEventListener("dblclick", (e) => { e.stopPropagation(); const w = el.getAttribute("data-dblopen"); if (w) void openWorkspace(w, true); });
  });
  container.querySelectorAll("[data-card-standalone]").forEach((el) => {
    el.addEventListener("click", (e) => { e.stopPropagation(); openCard = { kind: "standalone", worktreeId: el.getAttribute("data-card-standalone") }; renderModal(); });
    el.addEventListener("dblclick", (e) => { e.stopPropagation(); const w = el.getAttribute("data-dblopen"); if (w) void openWorkspace(w, true); });
  });
}

function detectNewDecisions(snap) {
  const tr = t();
  const currentKeys = new Set();
  for (const item of (snap.decisionList || [])) {
    const key = `${item.kind}:${item.id || item.worktreeId}:${item.itemNumber || ""}`;
    currentKeys.add(key);
    if (hasLoadedOnce && !seenDecisionKeys.has(key)) {
      showToast(tr.toastNewDecision(item.name, item.title || tr.stateNeed), true, () => {
        if (item.worktreeId) void openWorkspace(item.worktreeId, true);
      });
    }
  }
  seenDecisionKeys = currentKeys;
  hasLoadedOnce = true;
}

function render() {
  const tr = t();
  document.getElementById("brandTitle").textContent = tr.title;
  document.getElementById("liveLabel").textContent = tr.live;
  document.getElementById("cntNeedLbl").textContent = tr.needLbl;
  document.getElementById("cntWorkLbl").textContent = tr.workLbl;
  document.getElementById("cntIdleLbl").textContent = tr.idleLbl;
  document.getElementById("viewOfficeBtn").textContent = tr.tabOffice;
  document.getElementById("viewListBtn").textContent = tr.tabList;
  document.getElementById("searchInput").placeholder = tr.searchPh;
  document.getElementById("engFilter").options[0].textContent = tr.allEng;
  document.getElementById("activeOnlyBtn").textContent = tr.activeOnly;
  document.getElementById("refreshBtn").textContent = tr.refresh;
  document.getElementById("viewOfficeBtn").classList.toggle("active", viewMode === "office");
  document.getElementById("viewListBtn").classList.toggle("active", viewMode === "list");

  if (!snapshot) return;
  const s = snapshot.summary || {};
  const needCount = s.decisionCount || 0;
  const workCount = (s.workingBots || 0) + (s.workingWorkers || 0);
  const idleCount = s.idleTotal || 0;

  document.getElementById("cntNeedVal").textContent = needCount;
  document.getElementById("cntWorkVal").textContent = workCount;
  document.getElementById("cntIdleVal").textContent = idleCount;
  document.getElementById("cntNeed").classList.toggle("has-need", needCount > 0);

  const bots = filterBots(snapshot.bots || []);
  const officeWrap = document.getElementById("officeView");
  const listWrap = document.getElementById("listView");

  if (viewMode === "list") {
    officeWrap.style.display = "none";
    listWrap.style.display = "block";
    towerMgr.pause();
    renderListView(bots);
  } else {
    officeWrap.style.display = "block";
    listWrap.style.display = "none";
    renderTower(bots);
  }

  document.getElementById("legendBar").innerHTML = `
    <div class="legend-grp">
      <span class="lg-item"><span class="lg-dot" style="background:#fb7185"></span>${esc(tr.legendNeed)}</span>
      <span class="lg-item"><span class="lg-dot" style="background:#38bdf8"></span>${esc(tr.legendWork)}</span>
      <span class="lg-item"><span class="lg-dot" style="background:#fbbf24"></span>${esc(tr.legendStall)}</span>
      <span class="lg-item">➤ ${esc(tr.legendStream)}</span>
    </div>
    <div class="legend-grp">
      ${engPillHtml("claude")}
      ${engPillHtml("antigravity")}
      ${engPillHtml("codex")}
      ${engPillHtml("pi")}
    </div>`;

  const standalone = snapshot.standalone || [];
  const guestBar = document.getElementById("guestBar");
  if (!standalone.length) {
    guestBar.style.display = "none";
  } else {
    guestBar.style.display = "block";
    const activeG = standalone.filter((w) => w.state === "working" || w.needsDecision).length;
    const listHtml = guestExpanded
      ? `<div class="guest-list">${standalone.map((w) => `
          <span class="guest-chip ${w.needsDecision ? "attn" : ""}" data-card-standalone="${esc(w.worktreeId)}" data-dblopen="${esc(w.worktreeId)}">
            ${w.needsDecision ? "●" : (w.state === "working" ? "🟢" : "🪑")} ${esc(w.displayName)} ${engPillHtml(w.agentType)}
          </span>`).join("")}</div>`
      : "";
    guestBar.innerHTML = `
      <div class="guest-head" id="guestToggle">
        <span>${esc(tr.guestBar(activeG, standalone.length))}</span>
        <span>${esc(guestExpanded ? tr.collapse : tr.expand)}</span>
      </div>${listHtml}`;
    document.getElementById("guestToggle")?.addEventListener("click", () => { guestExpanded = !guestExpanded; render(); });
    bindDomClickHandlers(guestBar);
  }

  if (openCard) renderModal();
}

async function loadAll(force = false) {
  if (!orcaApi?.plugin?.request) return;
  try {
    const [snap, avs] = await Promise.all([
      orcaApi.plugin.request("office.getSnapshot", { force }),
      Object.keys(avatars).length ? Promise.resolve(avatars) : orcaApi.plugin.request("office.getAvatars", {}),
    ]);
    if (avs) { avatars = avs; towerMgr.setAvatars(avs); }
    if (snap) { snapshot = snap; detectNewDecisions(snap); }
    render();
  } catch (err) {
    console.error("loadAll failed:", err);
  }
}

document.getElementById("viewOfficeBtn").addEventListener("click", () => { viewMode = "office"; render(); });
document.getElementById("viewListBtn").addEventListener("click", () => { viewMode = "list"; render(); });
document.getElementById("refreshBtn").addEventListener("click", () => void loadAll(true));
document.getElementById("activeOnlyBtn").addEventListener("click", (e) => {
  activeOnly = !activeOnly;
  e.currentTarget.classList.toggle("active", activeOnly);
  render();
});
document.getElementById("searchInput").addEventListener("input", (e) => { searchQuery = e.target.value; render(); });
document.getElementById("engFilter").addEventListener("change", (e) => { engineFilter = e.target.value; render(); });
document.getElementById("cntNeed").addEventListener("click", () => {
  const list = snapshot?.decisionList || [];
  if (!list.length) return;
  const item = list[decisionCursor % list.length];
  decisionCursor += 1;
  openCard = item.kind === "bot"
    ? { kind: "bot", id: item.id }
    : { kind: "worker", worktreeId: item.worktreeId };
  renderModal();
});
window.addEventListener("keydown", (e) => { if (e.key === "Escape" && openCard) { openCard = null; renderModal(); } });
let resizeTimer = null;
window.addEventListener("resize", () => {
  if (viewMode !== "office") return;
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => towerMgr.resizeAll(), 120);
});

if (orcaApi?.plugin?.on) {
  orcaApi.plugin.on("office.snapshot", (snap) => {
    if (snap) { snapshot = snap; detectNewDecisions(snap); render(); }
  });
}
if (orcaApi?.on) { orcaApi.on("theme", () => render()); }

window.__botOfficeInjectMock = (mockSnap, mockAvatars = {}) => {
  snapshot = mockSnap;
  avatars = mockAvatars;
  towerMgr.setAvatars(mockAvatars);
  render();
};
window.__botOfficeOpenCard = (cardSpec) => { openCard = cardSpec; renderModal(); };
window.__botOfficeSetView = (mode) => { viewMode = mode; render(); };

void loadAll(false);
