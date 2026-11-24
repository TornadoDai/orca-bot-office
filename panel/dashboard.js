/**
 * Ultra-Lightweight Pure-SVG Team Workload & Token Analytics Dashboard
 * - Charts FIRST (KPI -> 7-Day Trend & Engine Donut -> Team Key Metrics Chart), Detailed Lists AFTER
 * - Synced live with topbar Engine Filter, Search Query & Active-Only toggle!
 * - Zero external chart libraries, zero backdrop-filter, zero infinite animations
 */
(function () {
  const ENG_COLORS = {
    claude: { color: "#f59e0b", short: "Claude", sym: "✦" },
    antigravity: { color: "#38bdf8", short: "agy", sym: "◈" },
    codex: { color: "#a78bfa", short: "Codex", sym: "⬡" },
    pi: { color: "#34d399", short: "Pi", sym: "π" },
    gemini: { color: "#60a5fa", short: "Gemini", sym: "✧" },
    cursor: { color: "#2dd4bf", short: "Cursor", sym: "⌘" },
    copilot: { color: "#818cf8", short: "Copilot", sym: "◎" },
    opencode: { color: "#fb923c", short: "OpenCode", sym: "◇" },
    other: { color: "#94a3b8", short: "Agent", sym: "•" },
  };
  function engColorMeta(k) {
    const key = String(k || "").toLowerCase();
    if (ENG_COLORS[key]) return ENG_COLORS[key];
    return key && key !== "other" ? { color: "#94a3b8", short: key.slice(0, 10), sym: "•" } : ENG_COLORS.other;
  }

  function esc(s) {
    return String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function fmtTokens(n) {
    const v = Number(n || 0);
    if (v <= 0) return "0";
    if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(2)}B`;
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
    return String(Math.round(v));
  }

  function fmtDurMins(m) {
    if (!m) return "—";
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    const rem = m % 60;
    return rem ? `${h}h${rem}m` : `${h}h`;
  }

  /* ── Sync Dashboard Data with Engine / Search / Active-Only Filters ── */

  function filterAnalytics(raw, { engineFilter = "all", searchQuery = "", activeOnly = false } = {}) {
    if (!raw) return null;
    const q = String(searchQuery || "").trim().toLowerCase();
    const eng = String(engineFilter || "all").toLowerCase();
    const isFiltered = eng !== "all" || Boolean(q) || Boolean(activeOnly);
    if (!isFiltered) return { ...raw, isFiltered: false };

    const teams = (raw.teams || []).filter((tm) => {
      const botEng = String(tm.agent || "").toLowerCase();
      const wEngs = Array.isArray(tm.workerEngines) ? tm.workerEngines : [];
      const matchEng = eng === "all" || botEng === eng || wEngs.includes(eng);
      const matchQ = !q || String(tm.name || "").toLowerCase().includes(q);
      const matchAct = !activeOnly || tm.needsDecision || tm.isWorking || (tm.activeWorkers || 0) > 0;
      return matchEng && matchQ && matchAct;
    });

    // Aggregate KPIs dynamically from filtered teams
    let totalItems = 0, totalDone = 0, totalDone7d = 0, totalDispatches = 0;
    let durTotalMs = 0, durCount = 0, workingNow = 0, decisionCount = 0, stalledTotal = 0;
    let teamTokens = 0, teamMsgs = 0, teamSess = 0;

    // Rebuild 7-day trend from per-team dailyTrend if available
    const trendBase = (raw.dailyTrend || []).map((d) => ({ ...d, created: 0, done: 0 }));
    const trendIdx = new Map(trendBase.map((d, i) => [d.key, i]));

    for (const tm of teams) {
      totalItems += tm.totalItems || 0;
      totalDone += tm.doneCount || 0;
      totalDone7d += tm.done7d || 0;
      totalDispatches += tm.dispatchCount || 0;
      durTotalMs += tm.dispatchDurTotalMs || 0;
      durCount += tm.dispatchDurCount || 0;
      if (tm.isWorking) workingNow += Math.max(1, tm.activeWorkers || 0);
      decisionCount += tm.decisionCount || 0;
      stalledTotal += tm.stalledCount || 0;
      teamTokens += tm.tokens || 0;
      teamMsgs += tm.messages || 0;
      teamSess += tm.sessions || 0;
      for (const td of tm.dailyTrend || []) {
        const idx = trendIdx.get(td.key);
        if (idx != null) {
          trendBase[idx].created += td.created || 0;
          trendBase[idx].done += td.done || 0;
        }
      }
    }

    const avgDispatchMins = durCount > 0 ? Math.max(1, Math.round(durTotalMs / durCount / 60000)) : null;

    // Filter Engine Mix & Token Usage byEngine cleanly
    const rawMix = raw.engineMix || [];
    const engineMix = eng !== "all" ? rawMix.filter((e) => e.key === eng) : rawMix;
    const rawTok = raw.tokenUsage || {};
    const filteredByEng = eng !== "all"
      ? (rawTok.byEngine || []).filter((e) => String(e.agent || "").toLowerCase() === eng)
      : (rawTok.byEngine || []);

    // If filtered only by engine (no search/activeOnly), engine token total is authoritative; otherwise sum matched teams
    const useEngTotal = eng !== "all" && !q && !activeOnly && filteredByEng.length > 0;
    const tokTotal = useEngTotal ? filteredByEng.reduce((a, e) => a + (e.tokens || 0), 0) : teamTokens;
    const msgTotal = useEngTotal ? filteredByEng.reduce((a, e) => a + (e.messages || 0), 0) : teamMsgs;
    const sessTotal = useEngTotal ? filteredByEng.reduce((a, e) => a + (e.sessions || 0), 0) : teamSess;

    return {
      ...raw,
      isFiltered: true,
      kpi: {
        ...(raw.kpi || {}),
        totalItems,
        totalDone,
        totalDone7d,
        totalDispatches,
        avgDispatchMins,
        workingNow,
        decisionCount,
        stalledTotal,
      },
      teams,
      dailyTrend: trendBase,
      engineMix,
      tokenUsage: {
        ...rawTok,
        totalTokens: tokTotal,
        totalMessages: msgTotal,
        sessionCount: sessTotal,
        byEngine: filteredByEng,
        otherTeam: useEngTotal ? { tokens: Math.max(0, tokTotal - teamTokens), messages: Math.max(0, msgTotal - teamMsgs), sessions: Math.max(0, sessTotal - teamSess) } : { tokens: 0, messages: 0, sessions: 0 },
      },
    };
  }

  /* ── Pure-SVG Visual Charts (Displayed UP FRONT!) ── */

  function renderTeamMetricsChartSvg(teams, tr) {
    const top = teams.filter((tm) => (tm.totalItems || 0) > 0 || (tm.dispatchCount || 0) > 0 || (tm.tokens || 0) > 0).slice(0, 6);
    if (!top.length) return `<div class="db-empty" style="border:none;padding:14px">${esc(tr.dbNoData)}</div>`;

    const W = 560;
    const H = 132;
    const padL = 28;
    const padR = 12;
    const padT = 16;
    const padB = 26;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;
    const maxVal = Math.max(4, ...top.map((tm) => Math.max(tm.doneCount || 0, tm.dispatchCount || 0)));
    const slotW = plotW / top.length;

    const grid = [0, 0.5, 1].map((frac) => {
      const y = padT + plotH * (1 - frac);
      return `
        <line x1="${padL}" y1="${y.toFixed(1)}" x2="${W - padR}" y2="${y.toFixed(1)}" stroke="var(--svg-grid)" stroke-dasharray="2 3"/>
        <text x="${padL - 5}" y="${(y + 3).toFixed(1)}" text-anchor="end" fill="var(--muted)" font-size="9" font-family="ui-monospace,monospace">${Math.round(maxVal * frac)}</text>`;
    });

    const cols = top.map((tm, i) => {
      const cx = padL + slotW * i + slotW / 2;
      const bw = Math.min(20, slotW * 0.28);
      const hDone = ((tm.doneCount || 0) / maxVal) * plotH;
      const hDisp = ((tm.dispatchCount || 0) / maxVal) * plotH;
      const yDone = padT + plotH - hDone;
      const yDisp = padT + plotH - hDisp;
      const shortName = tm.name.length > 10 ? tm.name.slice(0, 9) + "…" : tm.name;
      const meta = ENG_COLORS[String(tm.agent || "").toLowerCase()] || ENG_COLORS.other;

      return `
        <g data-card-bot="${esc(tm.id)}" style="cursor:pointer">
          <rect x="${(cx - bw - 2).toFixed(1)}" y="${yDone.toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(2, hDone).toFixed(1)}" rx="3" fill="#10b981"/>
          ${tm.doneCount > 0 ? `<text x="${(cx - bw / 2 - 2).toFixed(1)}" y="${(yDone - 3).toFixed(1)}" text-anchor="middle" fill="var(--svg-val-done)" font-size="8.5" font-weight="700">${tm.doneCount}</text>` : ""}
          <rect x="${(cx + 2).toFixed(1)}" y="${yDisp.toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(2, hDisp).toFixed(1)}" rx="3" fill="#0ea5e9"/>
          ${tm.dispatchCount > 0 ? `<text x="${(cx + bw / 2 + 2).toFixed(1)}" y="${(yDisp - 3).toFixed(1)}" text-anchor="middle" fill="var(--svg-val-disp)" font-size="8.5" font-weight="700">${tm.dispatchCount}</text>` : ""}
          <rect x="${(cx - 14).toFixed(1)}" y="${H - 2.5}" width="28" height="2" rx="1" fill="${meta.color}" opacity="0.88"/>
          <text x="${cx.toFixed(1)}" y="${H - 6.5}" text-anchor="middle" fill="var(--fg)" font-size="9.5" font-weight="700">${esc(shortName)}</text>
        </g>`;
    });

    return `<svg class="db-team-chart-svg" viewBox="0 0 ${W} ${H}">${grid.join("")}${cols.join("")}</svg>`;
  }

  function renderStackedBarSvg(c, maxTotal) {
    const segs = [
      { v: c.done || 0, col: "#34d399" },
      { v: c.in_progress || 0, col: "#38bdf8" },
      { v: c.needs_you || 0, col: "#fb7185" },
      { v: (c.planned || 0) + (c.waiting || 0), col: "#fbbf24" },
      { v: c.canceled || 0, col: "#475569" },
    ];
    const total = segs.reduce((a, s) => a + s.v, 0);
    const denom = Math.max(1, maxTotal);
    const W = 240;
    const H = 10;
    let x = 0;
    const rects = [];
    for (const s of segs) {
      if (s.v <= 0) continue;
      const w = Math.max(3, (s.v / denom) * W);
      rects.push(`<rect x="${x.toFixed(1)}" y="0" width="${Math.min(w, W - x).toFixed(1)}" height="${H}" fill="${s.col}"/>`);
      x += w + 1;
      if (x >= W) break;
    }
    return `
      <svg class="db-bar-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-label="total ${total}">
        <defs><clipPath id="rbar"><rect x="0" y="0" width="${W}" height="${H}" rx="4"/></clipPath></defs>
        <rect x="0" y="0" width="${W}" height="${H}" rx="4" fill="var(--svg-track)"/>
        <g clip-path="url(#rbar)">${rects.join("")}</g>
      </svg>`;
  }

  function renderTrendSvg(days) {
    const W = 310, H = 112, padL = 22, padR = 8, padT = 14, padB = 20;
    const plotW = W - padL - padR, plotH = H - padT - padB;
    const maxVal = Math.max(2, ...days.map((d) => Math.max(d.created || 0, d.done || 0)));
    const step = plotW / Math.max(1, days.length);

    const gridLines = [0, 0.5, 1].map((frac) => {
      const y = padT + plotH * (1 - frac);
      return `
        <line x1="${padL}" y1="${y.toFixed(1)}" x2="${W - padR}" y2="${y.toFixed(1)}" stroke="var(--svg-grid)" stroke-dasharray="2 3"/>
        <text x="${padL - 4}" y="${(y + 3).toFixed(1)}" text-anchor="end" fill="var(--muted)" font-size="8.5" font-family="ui-monospace,monospace">${Math.round(maxVal * frac)}</text>`;
    });

    const bars = [], donePts = [], labels = [];
    days.forEach((d, i) => {
      const cx = padL + step * i + step / 2;
      const bw = Math.min(13, step * 0.34);
      const hCreate = ((d.created || 0) / maxVal) * plotH;
      const hDone = ((d.done || 0) / maxVal) * plotH;
      const yCreate = padT + plotH - hCreate;
      const yDone = padT + plotH - hDone;
      if (d.created > 0) bars.push(`<rect x="${(cx - bw - 1).toFixed(1)}" y="${yCreate.toFixed(1)}" width="${bw.toFixed(1)}" height="${hCreate.toFixed(1)}" rx="2" fill="rgba(14,165,233,0.45)"/>`);
      if (d.done > 0) bars.push(`<rect x="${(cx + 1).toFixed(1)}" y="${yDone.toFixed(1)}" width="${bw.toFixed(1)}" height="${hDone.toFixed(1)}" rx="2" fill="#10b981"/>`);
      donePts.push(`${(cx + 1 + bw / 2).toFixed(1)},${yDone.toFixed(1)}`);
      labels.push(`<text x="${cx.toFixed(1)}" y="${H - 5}" text-anchor="middle" fill="var(--muted)" font-size="8.5" font-family="ui-monospace,monospace">${esc(d.label.slice(3))}</text>`);
    });

    const poly = donePts.length > 1
      ? `<polyline points="${donePts.join(" ")}" fill="none" stroke="#10b981" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" opacity="0.85"/>`
      : "";

    return `<svg class="db-chart-svg" viewBox="0 0 ${W} ${H}">${gridLines.join("")}${bars.join("")}${poly}${labels.join("")}</svg>`;
  }

  function renderDonutSvg(engineMix, tr) {
    const total = engineMix.reduce((a, e) => a + e.count, 0);
    const R = 34, C = 2 * Math.PI * R;
    let offset = 0;

    const slices = engineMix.map((e) => {
      const meta = engColorMeta(e.key);
      const len = total > 0 ? (e.count / total) * C : 0;
      const seg = `<circle cx="48" cy="48" r="${R}" fill="none" stroke="${meta.color}" stroke-width="12" stroke-dasharray="${Math.max(1.5, len - 1.5).toFixed(1)} ${C.toFixed(1)}" stroke-dashoffset="${(-offset).toFixed(1)}" transform="rotate(-90 48 48)"/>`;
      offset += len;
      return seg;
    });

    const legend = engineMix.map((e) => {
      const meta = engColorMeta(e.key);
      const pct = total > 0 ? Math.round((e.count / total) * 100) : 0;
      return `
        <div class="db-donut-row">
          <span class="db-donut-lbl"><span class="lg-dot" style="background:${meta.color}"></span>${esc(meta.sym)} ${esc(meta.short)}</span>
          <span class="db-donut-val"><b>${e.count}</b> <span class="db-muted">${pct}%</span></span>
        </div>`;
    }).join("");

    return `
      <div class="db-donut-wrap">
        <svg class="db-donut-svg" viewBox="0 0 96 96" width="88" height="88">
          <circle cx="48" cy="48" r="${R}" fill="none" stroke="var(--svg-track)" stroke-width="12"/>
          ${slices.join("")}
          <text x="48" y="45" text-anchor="middle" fill="var(--fg-strong)" font-size="16" font-weight="800">${total}</text>
          <text x="48" y="58" text-anchor="middle" fill="var(--muted)" font-size="8.5" font-weight="700">${esc(tr.dbUnits)}</text>
        </svg>
        <div class="db-donut-legend">${legend || `<div class="db-muted">—</div>`}</div>
      </div>`;
  }

  function renderDashboardHtml(rawAnalytics, avatars, engPillHtml, tr, filters = {}, opts = {}) {
    if (!rawAnalytics) return `<div class="db-loading">${esc(tr.dbLoading)}</div>`;

    const data = filterAnalytics(rawAnalytics, filters);
    const kpi = data.kpi || {};
    const teams = data.teams || [];
    const trend = data.dailyTrend || [];
    const mix = data.engineMix || [];
    const tok = data.tokenUsage || {};
    const mods = opts.modules || {};
    const activeCat = opts.category || "all";
    const switchOpen = Boolean(opts.switchOpen);
    const relTime = opts.relTime || (() => "");
    const extras = window.OfficeDashboardExtras;
    const filterTeamIds = data.isFiltered ? new Set(teams.map((tm) => tm.id)) : null;
    const show = (cat, key) => (activeCat === "all" || activeCat === cat) && mods[key] !== false;

    const navBar = extras ? extras.renderCategoryAndSwitchBar(activeCat, mods, switchOpen, tr) : "";
    const filterBanner = data.isFiltered
      ? `<div class="db-filter-banner"><span>🔎 ${esc(tr.dbFilterActive(filters.engineFilter, filters.searchQuery, filters.activeOnly))}</span><span>${teams.length} ${esc(tr.dbTeamUnit)}</span></div>`
      : "";

    // 1) Top 4 KPI Cards
    const tokDisplay = tok.available ? fmtTokens(tok.totalTokens) : "—";
    const tokSub = tok.available ? tr.dbKpiMsgSub(tok.totalMessages || 0, tok.sessionCount || 0) : tr.dbTokUnavail;

    const kpiHtml = `
      <div class="db-kpi-grid">
        <div class="db-kpi">
          <div class="db-kpi-lbl">✅ ${esc(tr.dbKpiDone)}</div>
          <div class="db-kpi-val c-done">${kpi.totalDone || 0}</div>
          <div class="db-kpi-sub">${esc(tr.dbKpiDoneSub(kpi.totalDone7d || 0, kpi.totalItems || 0))}</div>
        </div>
        <div class="db-kpi">
          <div class="db-kpi-lbl">🚀 ${esc(tr.dbKpiDispatch)}</div>
          <div class="db-kpi-val c-disp">${kpi.totalDispatches || 0}</div>
          <div class="db-kpi-sub">${esc(tr.dbKpiDispatchSub(fmtDurMins(kpi.avgDispatchMins)))}</div>
        </div>
        <div class="db-kpi">
          <div class="db-kpi-lbl">🔥 ${esc(tr.dbKpiTokens)}</div>
          <div class="db-kpi-val c-tok">${esc(tokDisplay)}</div>
          <div class="db-kpi-sub">${esc(tokSub)}</div>
        </div>
        <div class="db-kpi ${kpi.decisionCount > 0 ? "is-attn" : ""}">
          <div class="db-kpi-lbl">⚡ ${esc(tr.dbKpiLive)}</div>
          <div class="db-kpi-val ${kpi.decisionCount > 0 ? "c-attn" : "c-norm"}">${kpi.workingNow || 0}<span class="db-kpi-slash"> / ${kpi.decisionCount || 0}</span></div>
          <div class="db-kpi-sub">${esc(tr.dbKpiLiveSub(kpi.automationsEnabled || 0, kpi.stalledTotal || 0))}</div>
        </div>
      </div>`;

    // 2) VISUAL CHARTS FIRST: Team Metrics Bar Chart + 7-Day Trend & Engine Mix Donut
    const teamMetricsChartCard = `
      <div class="db-card">
        <div class="db-card-head">
          <span class="db-card-title">📊 ${esc(tr.dbSecTeamChart)}</span>
          <span class="db-mini-legend">
            <span><i style="background:#34d399"></i>${esc(tr.dbKpiDone)}</span>
            <span><i style="background:#38bdf8"></i>${esc(tr.dbKpiDispatch)}</span>
          </span>
        </div>
        ${renderTeamMetricsChartSvg(teams, tr)}
      </div>`;

    const showTrend = show("delivery", "dailyTrend");
    const showEngine = show("runtime", "engineMix");
    const midChartsGrid = showTrend && showEngine
      ? `<div class="db-two-col">
          <div class="db-card">
            <div class="db-card-head">
              <span class="db-card-title">📈 ${esc(tr.dbSecTrend)}</span>
              <span class="db-mini-legend">
                <span><i style="background:#38bdf8"></i>${esc(tr.dbTrCreated)}</span>
                <span><i style="background:#34d399"></i>${esc(tr.dbTrDone)}</span>
              </span>
            </div>
            ${renderTrendSvg(trend)}
          </div>
          <div class="db-card">
            <div class="db-card-head"><span class="db-card-title">🧩 ${esc(tr.dbSecEngine)}</span></div>
            ${renderDonutSvg(mix, tr)}
          </div>
        </div>`
      : showTrend
        ? `<div class="db-card">
            <div class="db-card-head">
              <span class="db-card-title">📈 ${esc(tr.dbSecTrend)}</span>
              <span class="db-mini-legend">
                <span><i style="background:#38bdf8"></i>${esc(tr.dbTrCreated)}</span>
                <span><i style="background:#34d399"></i>${esc(tr.dbTrDone)}</span>
              </span>
            </div>
            ${renderTrendSvg(trend)}
          </div>`
        : showEngine
          ? `<div class="db-card">
              <div class="db-card-head"><span class="db-card-title">🧩 ${esc(tr.dbSecEngine)}</span></div>
              ${renderDonutSvg(mix, tr)}
            </div>`
          : "";

    // 3) Token & Messages Visual Ranking
    let tokenBody = "";
    if (!tok.available) {
      tokenBody = `<div class="db-empty">${esc(tr.dbTokHint)}</div>`;
    } else {
      const engChips = (tok.byEngine || []).map((e) => {
        const meta = ENG_COLORS[e.agent] || { color: "#94a3b8", short: e.agent || "Agent", sym: "•" };
        const valText = e.tokens > 0 ? `<b>${esc(fmtTokens(e.tokens))}</b> <span class="db-muted">(${e.messages})</span>` : `<span class="db-muted">${e.messages} ${esc(tr.dbMsgUnit)}</span>`;
        return `<span class="db-eng-tok" style="border-color:${meta.color}55;color:${meta.color}">${esc(meta.sym)} ${esc(meta.short)} ${valText}</span>`;
      }).join("");

      const tokRows = teams
        .filter((tm) => tm.tokens > 0 || tm.messages > 0)
        .map((tm) => ({ id: tm.id, name: tm.name, tokens: tm.tokens, messages: tm.messages, sessions: tm.sessions }))
        .sort((a, b) => b.tokens - a.tokens || b.messages - a.messages);
      const maxTok = Math.max(1, ...tokRows.map((r) => r.tokens || 0));

      const rowsHtml = tokRows.length
        ? tokRows.slice(0, 7).map((r) => {
            const pct = Math.min(100, Math.max(r.tokens > 0 ? 5 : 0, Math.round((r.tokens / maxTok) * 100)));
            return `
              <div class="db-meter-row clickable" data-card-bot="${esc(r.id)}">
                <div class="db-meter-top">
                  <span class="db-meter-name">${esc(r.name)} <span class="db-muted">(${r.sessions} ${esc(tr.dbSessUnit)})</span></span>
                  <span class="db-meter-stat"><b>${esc(fmtTokens(r.tokens))}</b> · ${r.messages} ${esc(tr.dbMsgUnit)}</span>
                </div>
                <div class="db-meter-track"><div class="db-meter-fill amber" style="width:${pct}%"></div></div>
              </div>`;
          }).join("")
        : `<div class="db-empty">${esc(tr.dbNoTokens)}</div>`;

      const otherHtml = (tok.otherTeam?.tokens || 0) > 0 || (tok.otherTeam?.messages || 0) > 0
        ? `<div class="db-other-note"><span>${esc(tr.dbOtherWs)} (${tok.otherTeam.sessions} ${esc(tr.dbSessUnit)})</span><span><b>${esc(fmtTokens(tok.otherTeam.tokens))}</b> · ${tok.otherTeam.messages} ${esc(tr.dbMsgUnit)}</span></div>`
        : "";

      tokenBody = `${engChips ? `<div class="db-eng-tok-bar">${engChips}</div>` : ""}<div class="db-meter-list">${rowsHtml}</div>${otherHtml}`;
    }

    const tokenCard = `
      <div class="db-card">
        <div class="db-card-head">
          <span class="db-card-title">🔥 ${esc(tr.dbSecTokens)}</span>
          <span class="db-scope-note">${esc(tr.dbTokScope)}</span>
        </div>
        ${tokenBody}
      </div>`;

    // 4) DETAILED LISTS AFTER CHARTS: Team Workload Breakdown + Worker Dispatch Efficiency
    const maxItems = Math.max(1, ...teams.map((tm) => tm.totalItems || 0));
    const teamRowsHtml = teams.length
      ? teams.map((tm) => {
          const av = avatars[tm.id] || avatars[tm.name];
          const avEl = av ? `<img src="${av}" alt=""/>` : `<span>${esc((tm.name || "?").slice(0, 1).toUpperCase())}</span>`;
          const c = tm.counts || {};
          const pending = (c.in_progress || 0) + (c.needs_you || 0) + (c.planned || 0) + (c.waiting || 0);
          return `
            <div class="db-team-row" data-card-bot="${esc(tm.id)}" data-dblopen="${esc(tm.worktreeId || "")}">
              <div class="db-t-left">
                <div class="db-t-av">${avEl}</div>
                <div class="db-t-info">
                  <div class="db-t-name">${esc(tm.name)} ${engPillHtml(tm.agent)}</div>
                  <div class="db-t-sub">
                    <span style="color:var(--kpi-done)">${c.done || 0} ${esc(tr.dbStDone)}</span>
                    ${pending > 0 ? ` · <span style="color:var(--kpi-disp)">${pending} ${esc(tr.dbStOpen)}</span>` : ""}
                    ${tm.dispatchCount > 0 ? ` · ${tm.dispatchCount} ${esc(tr.dbDispUnit)}` : ""}
                    ${tm.tokens > 0 ? ` · ${esc(fmtTokens(tm.tokens))}` : ""}
                  </div>
                </div>
              </div>
              <div class="db-t-bar">
                ${renderStackedBarSvg(c, maxItems)}
                <span class="db-t-tot">${tm.totalItems}</span>
              </div>
            </div>`;
        }).join("")
      : `<div class="db-empty">${esc(tr.dbNoData)}</div>`;

    const workloadListCard = `
      <div class="db-card">
        <div class="db-card-head">
          <span class="db-card-title">📋 ${esc(tr.dbSecWorkload)}</span>
          <span class="db-mini-legend">
            <span><i style="background:#34d399"></i>${esc(tr.dbStDone)}</span>
            <span><i style="background:#38bdf8"></i>${esc(tr.dbStProg)}</span>
            <span><i style="background:#fb7185"></i>${esc(tr.dbStNeed)}</span>
            <span><i style="background:#fbbf24"></i>${esc(tr.dbStPlan)}</span>
          </span>
        </div>
        <div class="db-team-list">${teamRowsHtml}</div>
      </div>`;

    const dispatchTeams = teams.filter((tm) => tm.dispatchCount > 0 || tm.totalWorkers > 0)
      .sort((a, b) => b.dispatchCount - a.dispatchCount || b.totalWorkers - a.totalWorkers);
    const maxDisp = Math.max(1, ...dispatchTeams.map((tm) => tm.dispatchCount || 0));
    const dispatchHtml = dispatchTeams.length
      ? dispatchTeams.map((tm) => {
          const pct = Math.min(100, Math.max(tm.dispatchCount > 0 ? 6 : 0, Math.round((tm.dispatchCount / maxDisp) * 100)));
          return `
            <div class="db-meter-row" data-card-bot="${esc(tm.id)}">
              <div class="db-meter-top">
                <span class="db-meter-name">${esc(tm.name)} <span class="db-muted">(${tm.activeWorkers}/${tm.totalWorkers} Worker)</span></span>
                <span class="db-meter-stat"><b>${tm.dispatchCount}</b> ${esc(tr.dbDispUnit)}${tm.avgDispatchMins ? ` · ${esc(tr.dbAvgDur(fmtDurMins(tm.avgDispatchMins)))}` : ""}${tm.stalledCount ? ` · <span style="color:#fbbf24">⚠${tm.stalledCount}</span>` : ""}</span>
              </div>
              <div class="db-meter-track"><div class="db-meter-fill cyan" style="width:${pct}%"></div></div>
            </div>`;
        }).join("")
      : `<div class="db-empty">${esc(tr.dbNoDispatch)}</div>`;

    const dispatchCard = `
      <div class="db-card">
        <div class="db-card-head"><span class="db-card-title">🚀 ${esc(tr.dbSecDispatch)}</span></div>
        <div class="db-meter-list">${dispatchHtml}</div>
      </div>`;

    const sections = [
      show("delivery", "teamChart") ? teamMetricsChartCard : "",
      midChartsGrid,
      extras && show("usage", "usageHeatmap") ? extras.renderUsageHeatmapCard(tok, fmtTokens, tr) : "",
      show("usage", "tokenTeams") ? tokenCard : "",
      extras && show("usage", "tokenDetails") ? extras.renderTokenDetailsCard(tok, fmtTokens, engPillHtml, relTime, tr, filterTeamIds) : "",
      show("delivery", "workloadList") ? workloadListCard : "",
      show("delivery", "dispatchCard") ? dispatchCard : "",
      extras && show("runtime", "branchChats") ? extras.renderBranchActivityCard(data.branchActivity, engPillHtml, relTime, tr, filterTeamIds) : "",
      extras && show("runtime", "automations") ? extras.renderAutomationsCard(data.automations, relTime, tr, filterTeamIds) : "",
      extras && show("delivery", "linkedRefs") ? extras.renderLinkedRefsCard(data.linkedRefsList, tr, filterTeamIds) : "",
      extras && show("runtime", "diagnostics") ? extras.renderDiagnosticsCard(data.diagnostics, tr) : "",
    ].filter(Boolean);

    const bodyHtml = sections.length ? sections.join("") : `<div class="db-empty">${esc(tr.dbAllHidden)}</div>`;
    return `<div class="dashboard">${kpiHtml}${navBar}${filterBanner}${bodyHtml}</div>`;
  }

  window.OfficeDashboard = { renderDashboardHtml, filterAnalytics, fmtTokens };
})();
