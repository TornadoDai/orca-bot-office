/**
 * Modular Extra Dashboard Sections (Pure-SVG, Theme-Aware, Toggleable)
 * 1. 7-Day Daily Token Trend & Top Heavy Sessions (from agent.listSessions)
 * 2. Bot Branch Chats & Activity (from bot chats)
 * 3. Automations Schedule & Recent Runs (from automations list + runs)
 * 4. Linked PR / MR / Issue Rollup (from worktree ps + item links)
 * 5. Orca Memory & Process Diagnostics (from diagnostics memory)
 */
(function () {
  const ENG_COLORS = {
    claude: { color: "#f59e0b", short: "Claude", sym: "✦" },
    antigravity: { color: "#38bdf8", short: "agy", sym: "◈" },
    codex: { color: "#a78bfa", short: "Codex", sym: "⬡" },
    pi: { color: "#34d399", short: "Pi", sym: "π" },
    other: { color: "#94a3b8", short: "Agent", sym: "•" },
  };

  function esc(s) {
    return String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function fmtBytes(b) {
    const v = Number(b || 0);
    if (v <= 0) return "0 MB";
    if (v >= 1073741824) return `${(v / 1073741824).toFixed(2)} GB`;
    return `${Math.round(v / 1048576)} MB`;
  }

  function fmtNextTime(ts, tr) {
    if (!ts) return "—";
    const diff = Number(ts) - Date.now();
    if (diff <= 0) return tr.dbAutoDue;
    const mins = Math.round(diff / 60000);
    if (mins < 60) return tr.dbInMins(mins);
    const hrs = Math.round(mins / 60);
    if (hrs < 48) return tr.dbInHrs(hrs);
    const d = new Date(Number(ts));
    return `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }

  function renderModuleToggleBar(mods, tr) {
    const defs = [
      { key: "tokenDetails", setting: "dashShowTokenDetails", label: tr.modTokenDetails, icon: "📊" },
      { key: "branchChats", setting: "dashShowBranchChats", label: tr.modBranchChats, icon: "⑂" },
      { key: "automations", setting: "dashShowAutomations", label: tr.modAutomations, icon: "⏰" },
      { key: "linkedRefs", setting: "dashShowLinkedRefs", label: tr.modLinkedRefs, icon: "🔀" },
      { key: "diagnostics", setting: "dashShowDiagnostics", label: tr.modDiagnostics, icon: "💻" },
    ];
    return `
      <div class="db-mod-bar">
        <span class="db-mod-lbl">⚙ ${esc(tr.modBarTitle)}</span>
        <div class="db-mod-pills">
          ${defs.map((d) => {
            const on = mods[d.key] !== false;
            return `<button type="button" class="db-mod-pill ${on ? "on" : ""}" data-toggle-dash-mod="${d.key}" data-setting-key="${d.setting}" data-mod-val="${on ? "1" : "0"}">${esc(d.icon)} ${esc(d.label)}</button>`;
          }).join("")}
        </div>
      </div>`;
  }

  /* ── 1) 7-Day Daily Token Bar Chart & Top Heavy Sessions ── */

  function renderDailyTokensSvg(days, fmtTokens) {
    if (!Array.isArray(days) || !days.length) return "";
    const W = 540, H = 96, padL = 42, padR = 10, padT = 14, padB = 20;
    const plotW = W - padL - padR, plotH = H - padT - padB;
    const maxVal = Math.max(1000, ...days.map((d) => d.tokens || 0));
    const step = plotW / days.length;

    const grid = [0, 0.5, 1].map((frac) => {
      const y = padT + plotH * (1 - frac);
      return `
        <line x1="${padL}" y1="${y.toFixed(1)}" x2="${W - padR}" y2="${y.toFixed(1)}" stroke="var(--svg-grid)" stroke-dasharray="2 3"/>
        <text x="${padL - 5}" y="${(y + 3).toFixed(1)}" text-anchor="end" fill="var(--muted)" font-size="8.5" font-family="ui-monospace,monospace">${frac === 0 ? "0" : esc(fmtTokens(maxVal * frac))}</text>`;
    });

    const bars = days.map((d, i) => {
      const cx = padL + step * i + step / 2;
      const bw = Math.min(28, step * 0.46);
      const h = ((d.tokens || 0) / maxVal) * plotH;
      const y = padT + plotH - h;
      return `
        <g>
          ${d.tokens > 0 ? `<rect x="${(cx - bw / 2).toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(2, h).toFixed(1)}" rx="3" fill="#f59e0b" opacity="0.88"/>` : ""}
          ${d.tokens > 0 ? `<text x="${cx.toFixed(1)}" y="${(y - 3).toFixed(1)}" text-anchor="middle" fill="var(--kpi-tok)" font-size="8" font-weight="700">${esc(fmtTokens(d.tokens))}</text>` : ""}
          <text x="${cx.toFixed(1)}" y="${H - 5}" text-anchor="middle" fill="var(--muted)" font-size="8.5" font-family="ui-monospace,monospace">${esc(d.label)}</text>
        </g>`;
    });

    return `<svg class="db-tok-trend-svg" viewBox="0 0 ${W} ${H}">${grid.join("")}${bars.join("")}</svg>`;
  }

  function renderTokenDetailsCard(tok, fmtTokens, engPillHtml, relTime, tr, filterTeamIds = null) {
    if (!tok?.available) return "";
    const days = tok.dailyTokens || [];
    let sessions = tok.topSessions || [];
    if (filterTeamIds) {
      sessions = sessions.filter((s) => s.teamId && filterTeamIds.has(s.teamId));
    }
    const hasTrend = days.some((d) => (d.tokens || 0) > 0);
    const maxTok = Math.max(1, ...sessions.map((s) => s.tokens || 0));

    const sessHtml = sessions.length
      ? sessions.map((s) => {
          const pct = Math.min(100, Math.max(5, Math.round(((s.tokens || 0) / maxTok) * 100)));
          const attr = s.teamId ? `data-card-bot="${esc(s.teamId)}"` : "";
          return `
            <div class="db-sess-row ${s.teamId ? "clickable" : ""}" ${attr}>
              <div class="db-sess-top">
                <span class="db-sess-title">${s.running ? `<span class="db-live-dot"></span>` : ""}${esc(s.title)}</span>
                <span class="db-meter-stat"><b>${esc(fmtTokens(s.tokens))}</b> · ${s.messages} ${esc(tr.dbMsgUnit)}</span>
              </div>
              <div class="db-sess-meta">
                ${engPillHtml(s.agent)}
                ${s.teamName ? `<span class="db-tag">${esc(s.teamName)}</span>` : ""}
                ${s.updatedAt ? `<span class="db-muted">${esc(relTime(s.updatedAt))}</span>` : ""}
              </div>
              <div class="db-meter-track sm"><div class="db-meter-fill amber" style="width:${pct}%"></div></div>
            </div>`;
        }).join("")
      : `<div class="db-empty" style="border:none;padding:10px">${esc(tr.dbNoTokens)}</div>`;

    return `
      <div class="db-card">
        <div class="db-card-head">
          <span class="db-card-title">📈 ${esc(tr.dbSecTokDetails)}</span>
          <span class="db-scope-note">${esc(tr.dbTokTopScope)}</span>
        </div>
        ${hasTrend ? renderDailyTokensSvg(days, fmtTokens) : ""}
        <div class="db-sub-head">${esc(tr.dbSecTopSessions)}</div>
        <div class="db-sess-list">${sessHtml}</div>
      </div>`;
  }

  /* ── 2) Bot Branch Chats & Activity Card ── */

  function renderBranchActivityCard(branchActivity, engPillHtml, relTime, tr, filterTeamIds = null) {
    const raw = branchActivity || { totalOpen: 0, totalActive15m: 0, byBot: [] };
    const rows = filterTeamIds ? (raw.byBot || []).filter((b) => filterTeamIds.has(b.id)) : (raw.byBot || []);
    const openSum = rows.reduce((a, b) => a + (b.total || 0), 0);
    const actSum = rows.reduce((a, b) => a + (b.active15m || 0), 0);

    const body = rows.length
      ? rows.map((b) => `
          <div class="db-branch-bot" data-card-bot="${esc(b.id)}">
            <div class="db-branch-head">
              <span class="db-branch-name">${esc(b.name)} ${engPillHtml(b.agent)}</span>
              <span class="db-branch-cnt ${b.active15m > 0 ? "active" : ""}">⑂ ${b.total}${b.active15m > 0 ? ` · ${b.active15m} ${esc(tr.dbActiveShort)}` : ""}</span>
            </div>
            <div class="db-branch-chats">
              ${(b.chats || []).map((c) => `
                <div class="db-branch-item">
                  <span class="db-b-dot ${c.isRecent ? "hot" : ""}"></span>
                  <span class="db-b-title">${esc(c.title)}</span>
                  ${c.lastActivityAt ? `<span class="db-muted">${esc(relTime(c.lastActivityAt))}</span>` : ""}
                </div>`).join("")}
            </div>
          </div>`).join("")
      : `<div class="db-empty" style="border:none;padding:12px">${esc(tr.dbNoBranches)}</div>`;

    return `
      <div class="db-card">
        <div class="db-card-head">
          <span class="db-card-title">⑂ ${esc(tr.dbSecBranches)}</span>
          <span class="db-scope-note">${esc(tr.dbBranchScope(openSum, actSum))}</span>
        </div>
        <div class="db-branch-list">${body}</div>
      </div>`;
  }

  /* ── 3) Automations Schedule & Recent Runs Card ── */

  function renderAutomationsCard(autoData, relTime, tr, filterTeamIds = null) {
    const raw = autoData || { total: 0, enabled: 0, items: [], recentRuns: [] };
    const items = filterTeamIds
      ? (raw.items || []).filter((a) => !a.botId || filterTeamIds.has(a.botId))
      : (raw.items || []);
    const runs = filterTeamIds
      ? (raw.recentRuns || []).filter((r) => !r.botId || filterTeamIds.has(r.botId))
      : (raw.recentRuns || []);

    const statusBadge = (st) => {
      const s = String(st || "");
      if (s === "completed") return `<span class="db-st ok">${esc(tr.dbRunOk)}</span>`;
      if (s === "running") return `<span class="db-st run">${esc(tr.dbRunLive)}</span>`;
      if (s === "failed" || s === "error") return `<span class="db-st fail">${esc(tr.dbRunFail)}</span>`;
      if (s.includes("skip")) return `<span class="db-st skip">${esc(tr.dbRunSkip)}</span>`;
      return `<span class="db-st">${esc(s || "—")}</span>`;
    };

    const schedHtml = items.length
      ? items.slice(0, 6).map((a) => `
          <div class="db-auto-row ${a.botId ? "clickable" : ""}" ${a.botId ? `data-card-bot="${esc(a.botId)}"` : ""}>
            <div class="db-auto-main">
              <span class="db-b-dot ${a.enabled ? "hot" : ""}"></span>
              <span class="db-auto-name">${esc(a.name)}</span>
              ${a.botName ? `<span class="db-tag">${esc(a.botName)}</span>` : ""}
            </div>
            <div class="db-auto-right">
              ${a.lastStatus ? statusBadge(a.lastStatus) : ""}
              <span class="db-muted">${a.enabled ? `${esc(tr.dbNextRun)} ${esc(fmtNextTime(a.nextRunAt, tr))}` : esc(tr.dbPaused)}</span>
            </div>
          </div>`).join("")
      : `<div class="db-empty" style="border:none;padding:10px">${esc(tr.dbNoAutos)}</div>`;

    const runsHtml = runs.length
      ? `<div class="db-sub-head">${esc(tr.dbSecAutoRuns)}</div>
         <div class="db-auto-runs">${runs.slice(0, 5).map((r) => `
           <div class="db-run-row">
             ${statusBadge(r.status)}
             <span class="db-run-name">${esc(r.name)}</span>
             ${r.botName ? `<span class="db-tag">${esc(r.botName)}</span>` : ""}
             <span class="db-muted">${r.startedAt ? esc(relTime(r.startedAt)) : ""}</span>
           </div>`).join("")}</div>`
      : "";

    return `
      <div class="db-card">
        <div class="db-card-head">
          <span class="db-card-title">⏰ ${esc(tr.dbSecAutos)}</span>
          <span class="db-scope-note">${raw.enabled}/${raw.total} ${esc(tr.dbEnabledUnit)}</span>
        </div>
        <div class="db-auto-list">${schedHtml}</div>
        ${runsHtml}
      </div>`;
  }

  /* ── 4) Linked PR / MR / Issue Rollup Card ── */

  function renderLinkedRefsCard(refs, tr, filterTeamIds = null) {
    const list = Array.isArray(refs) ? refs : [];
    const filtered = filterTeamIds ? list.filter((r) => !r.teamId || filterTeamIds.has(r.teamId)) : list;

    const body = filtered.length
      ? filtered.map((r) => {
          const icon = r.kind === "mr" ? "🦊" : r.kind === "pr" ? "🔀" : "🔖";
          const clickable = r.url ? `data-ext-url="${esc(r.url)}"` : (r.teamId ? `data-card-bot="${esc(r.teamId)}"` : "");
          return `
            <div class="db-ref-row ${clickable ? "clickable" : ""}" ${clickable}>
              <span class="db-ref-icon">${icon}</span>
              <span class="db-ref-lbl">${esc(r.label)}</span>
              <span class="db-tag">${esc(r.teamName)}</span>
              ${r.source && r.source !== r.teamName ? `<span class="db-muted">${esc(r.source)}</span>` : ""}
              ${r.url ? `<span class="db-ref-ext">↗</span>` : ""}
            </div>`;
        }).join("")
      : `<div class="db-empty" style="border:none;padding:10px">${esc(tr.dbNoLinks)}</div>`;

    return `
      <div class="db-card">
        <div class="db-card-head">
          <span class="db-card-title">🔀 ${esc(tr.dbSecLinks)}</span>
          <span class="db-scope-note">${filtered.length}</span>
        </div>
        <div class="db-ref-list">${body}</div>
      </div>`;
  }

  /* ── 5) Orca Memory & Process Diagnostics Card ── */

  function renderMemSparklineSvg(history) {
    if (!Array.isArray(history) || history.length < 2) return "";
    const W = 260, H = 44, pad = 4;
    const minV = Math.min(...history) * 0.92;
    const maxV = Math.max(minV + 1, Math.max(...history) * 1.04);
    const pts = history.map((v, i) => {
      const x = pad + (i / (history.length - 1)) * (W - pad * 2);
      const y = H - pad - ((v - minV) / (maxV - minV)) * (H - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    const area = `${pad},${H - pad} ${pts.join(" ")} ${W - pad},${H - pad}`;
    return `
      <svg class="db-spark-svg" viewBox="0 0 ${W} ${H}">
        <polygon points="${area}" fill="rgba(14,165,233,0.14)"/>
        <polyline points="${pts.join(" ")}" fill="none" stroke="#0ea5e9" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`;
  }

  function renderDiagnosticsCard(diag, tr) {
    if (!diag || diag.disabled) return "";
    if (!diag.available) {
      return `
        <div class="db-card">
          <div class="db-card-head"><span class="db-card-title">💻 ${esc(tr.dbSecDiag)}</span></div>
          <div class="db-empty" style="border:none;padding:10px">${esc(tr.dbDiagUnavail)}</div>
        </div>`;
    }
    const app = diag.app || {};
    const host = diag.host || {};
    const appTot = Math.max(1, app.memory || 1);
    const pMain = Math.round(((app.mainMem || 0) / appTot) * 100);
    const pRend = Math.round(((app.rendererMem || 0) / appTot) * 100);
    const pOther = Math.max(0, 100 - pMain - pRend);

    const wtsHtml = (diag.worktrees || []).length
      ? `<div class="db-sub-head">${esc(tr.dbDiagHeavyWs)}</div>
         <div class="db-diag-wts">${diag.worktrees.map((w) => `
           <div class="db-diag-wt">
             <span class="db-diag-wt-name">${esc(w.name)}${w.repo ? ` <span class="db-muted">(${esc(w.repo)})</span>` : ""}</span>
             <span class="db-meter-stat"><b>${esc(fmtBytes(w.memory))}</b> · CPU ${w.cpu.toFixed(1)}%</span>
           </div>`).join("")}</div>`
      : "";

    return `
      <div class="db-card">
        <div class="db-card-head">
          <span class="db-card-title">💻 ${esc(tr.dbSecDiag)}</span>
          <span class="db-scope-note">Orca ${esc(fmtBytes(diag.totalMemory))} · CPU ${Number(diag.totalCpu || 0).toFixed(1)}%</span>
        </div>
        <div class="db-diag-top">
          <div class="db-diag-stats">
            <div class="db-diag-kv"><span>App</span><b>${esc(fmtBytes(app.memory))}</b> <span class="db-muted">(${Number(app.cpu || 0).toFixed(1)}% CPU)</span></div>
            <div class="db-diag-kv"><span>Host RAM</span><b>${Math.round(host.memoryUsagePercent || 0)}%</b> <span class="db-muted">(${esc(fmtBytes(host.usedMemory))} / ${esc(fmtBytes(host.totalMemory))})</span></div>
            <div class="db-diag-kv"><span>Load 1m</span><b>${Number(host.loadAverage1m || 0).toFixed(2)}</b> <span class="db-muted">/ ${host.cpuCoreCount || 0} cores</span></div>
          </div>
          ${renderMemSparklineSvg(app.history)}
        </div>
        <div class="db-mem-bar" title="Main / Renderer / Other">
          <i style="width:${pMain}%;background:#38bdf8"></i>
          <i style="width:${pRend}%;background:#a78bfa"></i>
          <i style="width:${pOther}%;background:#f59e0b"></i>
        </div>
        <div class="db-mini-legend">
          <span><i style="background:#38bdf8"></i>Main ${esc(fmtBytes(app.mainMem))}</span>
          <span><i style="background:#a78bfa"></i>Renderer ${esc(fmtBytes(app.rendererMem))}</span>
          <span><i style="background:#f59e0b"></i>Other ${esc(fmtBytes(app.otherMem))}</span>
        </div>
        ${wtsHtml}
      </div>`;
  }

  window.OfficeDashboardExtras = {
    renderModuleToggleBar,
    renderTokenDetailsCard,
    renderBranchActivityCard,
    renderAutomationsCard,
    renderLinkedRefsCard,
    renderDiagnosticsCard,
  };
})();
