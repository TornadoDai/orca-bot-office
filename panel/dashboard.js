/**
 * Ultra-Lightweight Pure-SVG Team Workload & Token Analytics Dashboard
 * - Zero external chart libraries, zero backdrop-filter, zero infinite animations
 * - Renders KPI strip, Team Workload Stacked Bar Chart, 7-Day Delivery Trend, Engine Mix Donut,
 *   Worker Dispatch Volume & Efficiency Bars, and CLI Token Usage Ranking
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
        <rect x="0" y="0" width="${W}" height="${H}" rx="4" fill="rgba(148,163,184,0.12)"/>
        <g clip-path="url(#rbar)">${rects.join("")}</g>
      </svg>`;
  }

  function renderTrendSvg(days, tr) {
    const W = 310;
    const H = 112;
    const padL = 22;
    const padR = 8;
    const padT = 14;
    const padB = 20;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;
    const maxVal = Math.max(2, ...days.map((d) => Math.max(d.created || 0, d.done || 0)));
    const step = plotW / Math.max(1, days.length);

    // Horizontal gridlines (0, mid, max)
    const gridLines = [0, 0.5, 1].map((frac) => {
      const y = padT + plotH * (1 - frac);
      const val = Math.round(maxVal * frac);
      return `
        <line x1="${padL}" y1="${y.toFixed(1)}" x2="${W - padR}" y2="${y.toFixed(1)}" stroke="rgba(148,163,184,0.12)" stroke-dasharray="2 3"/>
        <text x="${padL - 4}" y="${(y + 3).toFixed(1)}" text-anchor="end" fill="#64748b" font-size="8.5" font-family="ui-monospace,monospace">${val}</text>`;
    });

    const bars = [];
    const donePts = [];
    const labels = [];

    days.forEach((d, i) => {
      const cx = padL + step * i + step / 2;
      const bw = Math.min(13, step * 0.34);
      const hCreate = ((d.created || 0) / maxVal) * plotH;
      const hDone = ((d.done || 0) / maxVal) * plotH;
      const yCreate = padT + plotH - hCreate;
      const yDone = padT + plotH - hDone;

      if (d.created > 0) {
        bars.push(`<rect x="${(cx - bw - 1).toFixed(1)}" y="${yCreate.toFixed(1)}" width="${bw.toFixed(1)}" height="${hCreate.toFixed(1)}" rx="2" fill="rgba(56,189,248,0.45)"/>`);
      }
      if (d.done > 0) {
        bars.push(`<rect x="${(cx + 1).toFixed(1)}" y="${yDone.toFixed(1)}" width="${bw.toFixed(1)}" height="${hDone.toFixed(1)}" rx="2" fill="#34d399"/>`);
      }
      donePts.push(`${(cx + 1 + bw / 2).toFixed(1)},${yDone.toFixed(1)}`);
      labels.push(`<text x="${cx.toFixed(1)}" y="${H - 5}" text-anchor="middle" fill="#8e9db5" font-size="8.5" font-family="ui-monospace,monospace">${esc(d.label.slice(3))}</text>`);
    });

    const poly = donePts.length > 1
      ? `<polyline points="${donePts.join(" ")}" fill="none" stroke="#6ee7b7" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" opacity="0.85"/>`
      : "";

    return `
      <svg class="db-chart-svg" viewBox="0 0 ${W} ${H}">
        ${gridLines.join("")}
        ${bars.join("")}
        ${poly}
        ${labels.join("")}
      </svg>`;
  }

  function renderDonutSvg(engineMix, tr) {
    const total = engineMix.reduce((a, e) => a + e.count, 0);
    const R = 34;
    const C = 2 * Math.PI * R;
    let offset = 0;

    const slices = engineMix.map((e) => {
      const meta = ENG_COLORS[e.key] || ENG_COLORS.other;
      const len = total > 0 ? (e.count / total) * C : 0;
      const seg = `<circle cx="48" cy="48" r="${R}" fill="none" stroke="${meta.color}" stroke-width="12" stroke-dasharray="${Math.max(1.5, len - 1.5).toFixed(1)} ${C.toFixed(1)}" stroke-dashoffset="${(-offset).toFixed(1)}" transform="rotate(-90 48 48)"/>`;
      offset += len;
      return seg;
    });

    const legend = engineMix.map((e) => {
      const meta = ENG_COLORS[e.key] || ENG_COLORS.other;
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
          <circle cx="48" cy="48" r="${R}" fill="none" stroke="rgba(148,163,184,0.14)" stroke-width="12"/>
          ${slices.join("")}
          <text x="48" y="45" text-anchor="middle" fill="#f8fafc" font-size="16" font-weight="800">${total}</text>
          <text x="48" y="58" text-anchor="middle" fill="#8e9db5" font-size="8.5" font-weight="700">${esc(tr.dbUnits)}</text>
        </svg>
        <div class="db-donut-legend">${legend || `<div class="db-muted">—</div>`}</div>
      </div>`;
  }

  function renderDashboardHtml(analytics, avatars, engPillHtml, tr) {
    if (!analytics) {
      return `<div class="db-loading">${esc(tr.dbLoading)}</div>`;
    }

    const kpi = analytics.kpi || {};
    const teams = analytics.teams || [];
    const trend = analytics.dailyTrend || [];
    const mix = analytics.engineMix || [];
    const tok = analytics.tokenUsage || {};

    // 1) Top 4 KPI Cards
    const tokDisplay = tok.available ? fmtTokens(tok.totalTokens) : "—";
    const tokSub = tok.available
      ? tr.dbKpiMsgSub(tok.totalMessages || 0, tok.sessionCount || 0)
      : tr.dbTokUnavail;

    const kpiHtml = `
      <div class="db-kpi-grid">
        <div class="db-kpi">
          <div class="db-kpi-lbl">✅ ${esc(tr.dbKpiDone)}</div>
          <div class="db-kpi-val" style="color:#6ee7b7">${kpi.totalDone || 0}</div>
          <div class="db-kpi-sub">${esc(tr.dbKpiDoneSub(kpi.totalDone7d || 0, kpi.totalItems || 0))}</div>
        </div>
        <div class="db-kpi">
          <div class="db-kpi-lbl">🚀 ${esc(tr.dbKpiDispatch)}</div>
          <div class="db-kpi-val" style="color:#7dd3fc">${kpi.totalDispatches || 0}</div>
          <div class="db-kpi-sub">${esc(tr.dbKpiDispatchSub(fmtDurMins(kpi.avgDispatchMins)))}</div>
        </div>
        <div class="db-kpi">
          <div class="db-kpi-lbl">🔥 ${esc(tr.dbKpiTokens)}</div>
          <div class="db-kpi-val" style="color:#fcd34d">${esc(tokDisplay)}</div>
          <div class="db-kpi-sub">${esc(tokSub)}</div>
        </div>
        <div class="db-kpi ${kpi.decisionCount > 0 ? "is-attn" : ""}">
          <div class="db-kpi-lbl">⚡ ${esc(tr.dbKpiLive)}</div>
          <div class="db-kpi-val" style="color:${kpi.decisionCount > 0 ? "#fda4af" : "#e2e8f0"}">${kpi.workingNow || 0}<span class="db-kpi-slash"> / ${kpi.decisionCount || 0}</span></div>
          <div class="db-kpi-sub">${esc(tr.dbKpiLiveSub(kpi.automationsEnabled || 0, kpi.stalledTotal || 0))}</div>
        </div>
      </div>`;

    // 2) Team Workload Stacked Bar Card
    const maxItems = Math.max(1, ...teams.map((t) => t.totalItems || 0));
    const teamRowsHtml = teams.length
      ? teams.map((tm) => {
          const av = avatars[tm.id] || avatars[tm.name];
          const avEl = av
            ? `<img src="${av}" alt=""/>`
            : `<span>${esc((tm.name || "?").slice(0, 1).toUpperCase())}</span>`;
          const c = tm.counts || {};
          const pending = (c.in_progress || 0) + (c.needs_you || 0) + (c.planned || 0) + (c.waiting || 0);
          return `
            <div class="db-team-row" data-card-bot="${esc(tm.id)}" data-dblopen="${esc(tm.worktreeId || "")}">
              <div class="db-t-left">
                <div class="db-t-av">${avEl}</div>
                <div class="db-t-info">
                  <div class="db-t-name">${esc(tm.name)} ${engPillHtml(tm.agent)}</div>
                  <div class="db-t-sub">
                    <span style="color:#6ee7b7">${c.done || 0} ${esc(tr.dbStDone)}</span>
                    ${pending > 0 ? ` · <span style="color:#7dd3fc">${pending} ${esc(tr.dbStOpen)}</span>` : ""}
                    ${tm.done7d > 0 ? ` · +${tm.done7d} (7d)` : ""}
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

    const workloadCard = `
      <div class="db-card">
        <div class="db-card-head">
          <span class="db-card-title">📊 ${esc(tr.dbSecWorkload)}</span>
          <span class="db-mini-legend">
            <span><i style="background:#34d399"></i>${esc(tr.dbStDone)}</span>
            <span><i style="background:#38bdf8"></i>${esc(tr.dbStProg)}</span>
            <span><i style="background:#fb7185"></i>${esc(tr.dbStNeed)}</span>
            <span><i style="background:#fbbf24"></i>${esc(tr.dbStPlan)}</span>
          </span>
        </div>
        <div class="db-team-list">${teamRowsHtml}</div>
      </div>`;

    // 3) 2-Col Mid Row: 7-Day Trend + Engine Mix Donut
    const midGrid = `
      <div class="db-two-col">
        <div class="db-card">
          <div class="db-card-head">
            <span class="db-card-title">📈 ${esc(tr.dbSecTrend)}</span>
            <span class="db-mini-legend">
              <span><i style="background:#38bdf8"></i>${esc(tr.dbTrCreated)}</span>
              <span><i style="background:#34d399"></i>${esc(tr.dbTrDone)}</span>
            </span>
          </div>
          ${renderTrendSvg(trend, tr)}
        </div>
        <div class="db-card">
          <div class="db-card-head">
            <span class="db-card-title">🧩 ${esc(tr.dbSecEngine)}</span>
          </div>
          ${renderDonutSvg(mix, tr)}
        </div>
      </div>`;

    // 4) Worker Dispatch Volume & Efficiency Card
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
        <div class="db-card-head">
          <span class="db-card-title">🚀 ${esc(tr.dbSecDispatch)}</span>
        </div>
        <div class="db-meter-list">${dispatchHtml}</div>
      </div>`;

    // 5) Token Usage & Messages Card (history:read — explicitly labeled CLI sessions / excludes agy)
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

      tokenBody = `
        ${engChips ? `<div class="db-eng-tok-bar">${engChips}</div>` : ""}
        <div class="db-meter-list">${rowsHtml}</div>
        ${otherHtml}`;
    }

    const tokenCard = `
      <div class="db-card">
        <div class="db-card-head">
          <span class="db-card-title">🔥 ${esc(tr.dbSecTokens)}</span>
          <span class="db-scope-note">${esc(tr.dbTokScope)}</span>
        </div>
        ${tokenBody}
      </div>`;

    return `<div class="dashboard">${kpiHtml}${workloadCard}${midGrid}${dispatchCard}${tokenCard}</div>`;
  }

  window.OfficeDashboard = { renderDashboardHtml, fmtTokens };
})();
