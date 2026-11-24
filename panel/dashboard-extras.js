/**
 * Categorized Dashboard Controls + Magpie-Inspired Visual Charts (Pure-SVG, Theme-Aware)
 * - Category Tabs (All | Delivery | Token Usage | Runtime) + Collapsible 12-Module Switch Drawer
 * - Magpie-Style 28-Day Activity Heatmap (4x7) + 24-Hour Peak Usage Bar Chart
 * - Visual Ratio Bars on Automations, Branch Chats, and Linked PR/MR/Issues
 * - Orca Memory Sparkline & Process Breakdown
 */
(function () {
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

  const MODULE_GROUPS = [
    {
      cat: "delivery",
      titleKey: "catDelivery",
      items: [
        { key: "teamChart", labelKey: "modTeamChart" },
        { key: "dailyTrend", labelKey: "modDailyTrend" },
        { key: "workloadList", labelKey: "modWorkload" },
        { key: "dispatchCard", labelKey: "modDispatch" },
        { key: "linkedRefs", setting: "dashShowLinkedRefs", labelKey: "modLinkedRefs" },
      ],
    },
    {
      cat: "usage",
      titleKey: "catUsage",
      items: [
        { key: "usageHeatmap", labelKey: "modHeatmap" },
        { key: "tokenTeams", labelKey: "modTokenTeams" },
        { key: "tokenDetails", setting: "dashShowTokenDetails", labelKey: "modTokenDetails" },
      ],
    },
    {
      cat: "runtime",
      titleKey: "catRuntime",
      items: [
        { key: "engineMix", labelKey: "modEngineMix" },
        { key: "branchChats", setting: "dashShowBranchChats", labelKey: "modBranchChats" },
        { key: "automations", setting: "dashShowAutomations", labelKey: "modAutomations" },
        { key: "diagnostics", setting: "dashShowDiagnostics", labelKey: "modDiagnostics" },
      ],
    },
  ];

  function renderCategoryAndSwitchBar(activeCat, mods, switchOpen, tr) {
    const allItems = MODULE_GROUPS.flatMap((g) => g.items);
    const onCount = allItems.filter((it) => mods[it.key] !== false).length;
    const cats = [
      { id: "all", label: tr.catAll },
      { id: "delivery", label: tr.catDelivery },
      { id: "usage", label: tr.catUsage },
      { id: "runtime", label: tr.catRuntime },
    ];

    const drawerHtml = switchOpen
      ? `<div class="db-sw-drawer">
          ${MODULE_GROUPS.map((g) => `
            <div class="db-sw-grp">
              <div class="db-sw-gtitle">${esc(tr[g.titleKey])}</div>
              <div class="db-mod-pills">
                ${g.items.map((it) => {
                  const on = mods[it.key] !== false;
                  return `<button type="button" class="db-mod-pill ${on ? "on" : ""}" data-toggle-dash-mod="${it.key}" data-setting-key="${it.setting || ""}" data-mod-val="${on ? "1" : "0"}">${on ? "✓ " : ""}${esc(tr[it.labelKey])}</button>`;
                }).join("")}
              </div>
            </div>`).join("")}
        </div>`
      : "";

    return `
      <div class="db-nav-wrap">
        <div class="db-nav-bar">
          <div class="db-cat-tabs">
            ${cats.map((c) => `<button type="button" class="db-cat-btn ${activeCat === c.id ? "active" : ""}" data-dash-cat="${c.id}">${esc(c.label)}</button>`).join("")}
          </div>
          <button type="button" class="db-sw-btn ${switchOpen ? "active" : ""}" data-toggle-switch-panel="1">⚙ ${esc(tr.modBarTitle)} ${onCount}/${allItems.length}</button>
        </div>
        ${drawerHtml}
      </div>`;
  }

  /* ── Magpie-Inspired 28-Day Token Heatmap & 24-Hour Peak Usage Chart ── */

  function renderUsageHeatmapCard(tok, fmtTokens, tr) {
    if (!tok?.available) return "";
    const days = Array.isArray(tok.heatmap28d) ? tok.heatmap28d : [];
    const hours = Array.isArray(tok.hourly24) ? tok.hourly24 : [];
    if (!days.length && !hours.length) return "";

    const maxDayVal = Math.max(1, ...days.map((d) => d.tokens || d.messages || 0));
    const activeDays = days.filter((d) => (d.tokens || d.messages || 0) > 0).length;
    const peakDay = days.reduce((best, d) => ((d.tokens || 0) > (best?.tokens || 0) ? d : best), null);

    // 4 rows (weeks) x 7 cols (days) pure SVG heatmap
    const cell = 18, gap = 4, padX = 2, padY = 4;
    const hmW = padX * 2 + 7 * cell + 6 * gap;
    const hmH = padY * 2 + 4 * cell + 3 * gap;
    const fills = ["var(--svg-track)", "rgba(16,185,129,0.28)", "rgba(16,185,129,0.52)", "rgba(16,185,129,0.78)", "#10b981"];

    const cellsSvg = days.slice(0, 28).map((d, idx) => {
      const r = Math.floor(idx / 7);
      const c = idx % 7;
      const val = d.tokens || d.messages || 0;
      const ratio = val > 0 ? val / maxDayVal : 0;
      const lvl = val <= 0 ? 0 : ratio < 0.2 ? 1 : ratio < 0.48 ? 2 : ratio < 0.78 ? 3 : 4;
      const x = padX + c * (cell + gap);
      const y = padY + r * (cell + gap);
      return `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="4" fill="${fills[lvl]}"><title>${esc(d.label)}: ${esc(fmtTokens(d.tokens))} tokens · ${d.sessions} sessions</title></rect>`;
    }).join("");

    // 24-Hour Peak Usage Bar Chart
    const hrW = 240, hrH = 88, hPadL = 6, hPadR = 6, hPadT = 10, hPadB = 18;
    const hPlotW = hrW - hPadL - hPadR, hPlotH = hrH - hPadT - hPadB;
    const maxHrVal = Math.max(1, ...hours.map((h) => h.tokens || h.messages || 0));
    let peakHr = -1, peakHrV = 0;
    hours.forEach((h) => {
      const v = h.tokens || h.messages || 0;
      if (v > peakHrV) { peakHrV = v; peakHr = h.hour; }
    });
    const bw = hPlotW / 24;
    const hrBars = hours.map((h, i) => {
      const v = h.tokens || h.messages || 0;
      const bh = v > 0 ? Math.max(3, (v / maxHrVal) * hPlotH) : 2;
      const x = hPadL + i * bw + 1;
      const y = hPadT + hPlotH - bh;
      const col = v <= 0 ? "var(--svg-track)" : (i === peakHr ? "#f59e0b" : "#0ea5e9");
      return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${Math.max(2, bw - 2).toFixed(1)}" height="${bh.toFixed(1)}" rx="1.8" fill="${col}" opacity="${v > 0 ? 0.9 : 0.7}"><title>${String(i).padStart(2, "0")}:00 — ${esc(fmtTokens(h.tokens))} tokens (${h.sessions})</title></rect>`;
    }).join("");
    const hrTicks = [0, 6, 12, 18, 23].map((h) => {
      const x = hPadL + h * bw + bw / 2;
      return `<text x="${x.toFixed(1)}" y="${hrH - 4}" text-anchor="middle" fill="var(--muted)" font-size="8" font-family="ui-monospace,monospace">${String(h).padStart(2, "0")}h</text>`;
    }).join("");

    return `
      <div class="db-two-col">
        <div class="db-card">
          <div class="db-card-head">
            <span class="db-card-title">🟩 ${esc(tr.dbSecHeatmap)}</span>
            <span class="db-scope-note">${activeDays}/28 ${esc(tr.dbDayUnit)}</span>
          </div>
          <div class="db-hm-wrap">
            <svg class="db-hm-svg" viewBox="0 0 ${hmW} ${hmH}" width="${hmW}" height="${hmH}">${cellsSvg}</svg>
            <div class="db-hm-foot">
              <span>${peakDay && peakDay.tokens > 0 ? `${esc(tr.dbPeakDay)} ${esc(peakDay.label)} (${esc(fmtTokens(peakDay.tokens))})` : esc(tr.dbNoTokens)}</span>
              <span class="db-hm-scale">${esc(tr.dbLow)} ${fills.map((f) => `<i style="background:${f}"></i>`).join("")} ${esc(tr.dbHigh)}</span>
            </div>
          </div>
        </div>
        <div class="db-card">
          <div class="db-card-head">
            <span class="db-card-title">🕒 ${esc(tr.dbSecPeakHours)}</span>
            <span class="db-scope-note">${peakHr >= 0 ? `${esc(tr.dbPeakHr)} ${String(peakHr).padStart(2, "0")}:00` : "24h"}</span>
          </div>
          <svg class="db-hr-svg" viewBox="0 0 ${hrW} ${hrH}">${hrBars}${hrTicks}</svg>
        </div>
      </div>`;
  }

  /* ── 7-Day Daily Token Bar Chart & Top Heavy Sessions ── */

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

  /* ── Bot Branch Chats & Activity Card (with visual meter bars!) ── */

  function renderBranchActivityCard(branchActivity, engPillHtml, relTime, tr, filterTeamIds = null) {
    const raw = branchActivity || { totalOpen: 0, totalActive15m: 0, byBot: [] };
    const rows = filterTeamIds ? (raw.byBot || []).filter((b) => filterTeamIds.has(b.id)) : (raw.byBot || []);
    const openSum = rows.reduce((a, b) => a + (b.total || 0), 0);
    const actSum = rows.reduce((a, b) => a + (b.active15m || 0), 0);
    const maxB = Math.max(1, ...rows.map((b) => b.total || 0));

    const body = rows.length
      ? rows.map((b) => {
          const pct = Math.min(100, Math.max(14, Math.round((b.total / maxB) * 100)));
          return `
            <div class="db-branch-bot" data-card-bot="${esc(b.id)}">
              <div class="db-branch-head">
                <span class="db-branch-name">${esc(b.name)} ${engPillHtml(b.agent)}</span>
                <span class="db-branch-cnt ${b.active15m > 0 ? "active" : ""}">⑂ ${b.total}${b.active15m > 0 ? ` · ${b.active15m} ${esc(tr.dbActiveShort)}` : ""}</span>
              </div>
              <div class="db-meter-track sm"><div class="db-meter-fill teal" style="width:${pct}%"></div></div>
              <div class="db-branch-chats">
                ${(b.chats || []).map((c) => `
                  <div class="db-branch-item">
                    <span class="db-b-dot ${c.isRecent ? "hot" : ""}"></span>
                    <span class="db-b-title">${esc(c.title)}</span>
                    ${c.lastActivityAt ? `<span class="db-muted">${esc(relTime(c.lastActivityAt))}</span>` : ""}
                  </div>`).join("")}
              </div>
            </div>`;
        }).join("")
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

  /* ── Automations Schedule & Recent Runs Card (with outcome ratio bar!) ── */

  function renderAutomationsCard(autoData, relTime, tr, filterTeamIds = null) {
    const raw = autoData || { total: 0, enabled: 0, items: [], recentRuns: [] };
    const items = filterTeamIds ? (raw.items || []).filter((a) => !a.botId || filterTeamIds.has(a.botId)) : (raw.items || []);
    const runs = filterTeamIds ? (raw.recentRuns || []).filter((r) => !r.botId || filterTeamIds.has(r.botId)) : (raw.recentRuns || []);

    const okCnt = runs.filter((r) => r.status === "completed").length;
    const skipCnt = runs.filter((r) => String(r.status || "").includes("skip")).length;
    const failCnt = runs.filter((r) => r.status === "failed" || r.status === "error").length;
    const runTot = Math.max(1, okCnt + skipCnt + failCnt);

    const outcomeBar = runs.length > 0
      ? `<div class="db-mem-bar" title="OK / Skipped / Failed">
           ${okCnt ? `<i style="width:${Math.round((okCnt / runTot) * 100)}%;background:#10b981"></i>` : ""}
           ${skipCnt ? `<i style="width:${Math.round((skipCnt / runTot) * 100)}%;background:#f59e0b"></i>` : ""}
           ${failCnt ? `<i style="width:${Math.round((failCnt / runTot) * 100)}%;background:#f43f5e"></i>` : ""}
         </div>
         <div class="db-mini-legend">
           <span><i style="background:#10b981"></i>${esc(tr.dbRunOk)} ${okCnt}</span>
           <span><i style="background:#f59e0b"></i>${esc(tr.dbRunSkip)} ${skipCnt}</span>
           ${failCnt ? `<span><i style="background:#f43f5e"></i>${esc(tr.dbRunFail)} ${failCnt}</span>` : ""}
         </div>`
      : "";

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
        ${outcomeBar}
        <div class="db-auto-list">${schedHtml}</div>
        ${runsHtml}
      </div>`;
  }

  /* ── Linked PR / MR / Issue Rollup Card (with kind ratio bar!) ── */

  function renderLinkedRefsCard(refs, tr, filterTeamIds = null) {
    const list = Array.isArray(refs) ? refs : [];
    const filtered = filterTeamIds ? list.filter((r) => !r.teamId || filterTeamIds.has(r.teamId)) : list;
    const prCnt = filtered.filter((r) => r.kind === "pr").length;
    const mrCnt = filtered.filter((r) => r.kind === "mr").length;
    const issCnt = Math.max(0, filtered.length - prCnt - mrCnt);
    const tot = Math.max(1, filtered.length);

    const kindBar = filtered.length > 0
      ? `<div class="db-mem-bar">
           ${prCnt ? `<i style="width:${Math.round((prCnt / tot) * 100)}%;background:#10b981"></i>` : ""}
           ${mrCnt ? `<i style="width:${Math.round((mrCnt / tot) * 100)}%;background:#f59e0b"></i>` : ""}
           ${issCnt ? `<i style="width:${Math.round((issCnt / tot) * 100)}%;background:#38bdf8"></i>` : ""}
         </div>
         <div class="db-mini-legend">
           ${prCnt ? `<span><i style="background:#10b981"></i>PR ${prCnt}</span>` : ""}
           ${mrCnt ? `<span><i style="background:#f59e0b"></i>MR ${mrCnt}</span>` : ""}
           ${issCnt ? `<span><i style="background:#38bdf8"></i>Issue ${issCnt}</span>` : ""}
         </div>`
      : "";

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
        ${kindBar}
        <div class="db-ref-list">${body}</div>
      </div>`;
  }

  /* ── Orca Memory & Process Diagnostics Card ── */

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
    renderCategoryAndSwitchBar,
    renderUsageHeatmapCard,
    renderTokenDetailsCard,
    renderBranchActivityCard,
    renderAutomationsCard,
    renderLinkedRefsCard,
    renderDiagnosticsCard,
  };
})();
