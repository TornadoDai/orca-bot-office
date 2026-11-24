/**
 * Ultra-Lightweight DNF-Style 2.5D Oblique Side-View Stacked Floor Canvas Engine
 * - Full-width straight back wall + perspective walkable floor (zero wasted diamond corners)
 * - Top Penthouse Boss Office where Bots/Workers needing decisions queue up to report
 * - Prominent Agent Engine badges & matching visual accents (Claude / agy / Codex / Pi)
 * - Refined luminous data-dart trails (replaces clunky flying envelopes)
 * - Soft coral-rose alert accents (gentle, classy, non-fatiguing)
 * - Offscreen static background cache + 0 FPS idle / <= 6 FPS active + auto-pause when hidden
 */
(function () {
  const ENG_STYLES = {
    claude: { key: "claude", label: "Claude", short: "Claude", sym: "✦", color: "#f59e0b", light: "#fde68a", bg: "#2e1d0a", border: "rgba(245,158,11,0.68)", coat: "#b45309" },
    antigravity: { key: "antigravity", label: "Antigravity", short: "agy", sym: "◈", color: "#38bdf8", light: "#bae6fd", bg: "#0a2236", border: "rgba(56,189,248,0.68)", coat: "#0369a1" },
    codex: { key: "codex", label: "Codex", short: "Codex", sym: "⬡", color: "#a78bfa", light: "#ddd6fe", bg: "#1f1538", border: "rgba(167,139,250,0.68)", coat: "#6d28d9" },
    pi: { key: "pi", label: "Pi", short: "Pi", sym: "π", color: "#34d399", light: "#a7f3d0", bg: "#0a2921", border: "rgba(52,211,153,0.68)", coat: "#047857" },
    other: { key: "other", label: "Agent", short: "Agent", sym: "•", color: "#94a3b8", light: "#e2e8f0", bg: "#1e293b", border: "rgba(148,163,184,0.45)", coat: "#475569" },
  };

  const FLOOR_THEMES = [
    { wallTop: "#131e33", wallBot: "#1c2b47", floorA: "#162033", floorB: "#1a263b", accent: "#38bdf8", rug: "rgba(56,189,248,0.12)", prop: "wave" },
    { wallTop: "#1a1730", wallBot: "#262145", floorA: "#1a192e", floorB: "#201f38", accent: "#a78bfa", rug: "rgba(167,139,250,0.12)", prop: "server" },
    { wallTop: "#112426", wallBot: "#173438", floorA: "#132226", floorB: "#172a2f", accent: "#34d399", rug: "rgba(52,211,153,0.12)", prop: "board" },
    { wallTop: "#241b17", wallBot: "#33251e", floorA: "#1f1916", floorB: "#261f1b", accent: "#fbbf24", rug: "rgba(251,191,36,0.12)", prop: "books" },
    { wallTop: "#241724", wallBot: "#352136", floorA: "#1e1620", floorB: "#251c28", accent: "#f472b6", rug: "rgba(244,114,182,0.12)", prop: "chart" },
  ];

  // Softened coral-rose palette
  const ROSE = {
    dot: "#fb7185",
    stroke: "#fda4af",
    tint: "rgba(244, 63, 94, 0.16)",
    border: "rgba(251, 113, 133, 0.55)",
    text: "#ffe4e6",
    bubbleBg: "rgba(38, 19, 28, 0.94)",
  };

  function engStyle(raw) {
    const k = String(raw || "").toLowerCase();
    return ENG_STYLES[k] || ENG_STYLES.other;
  }

  function hashStr(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
    return Math.abs(h);
  }

  function trimText(ctx, text, maxW) {
    const str = String(text || "");
    if (!str) return "";
    if (ctx.measureText(str).width <= maxW) return str;
    let out = str;
    while (out.length > 1 && ctx.measureText(out + "…").width > maxW) out = out.slice(0, -1);
    return out + "…";
  }

  function roundRect(ctx, x, y, w, h, r) {
    const rad = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rad, y);
    ctx.arcTo(x + w, y, x + w, y + h, rad);
    ctx.arcTo(x + w, y + h, x, y + h, rad);
    ctx.arcTo(x, y + h, x, y, rad);
    ctx.arcTo(x, y, x + w, y, rad);
    ctx.closePath();
  }

  function fmtDur(ms) {
    const mins = Math.max(0, Math.floor(ms / 60000));
    if (mins < 1) return "<1m";
    if (mins < 60) return `${mins}m`;
    const h = Math.floor(mins / 60);
    return `${h}h${mins % 60 ? (mins % 60) + "m" : ""}`;
  }

  function isStalled(entity) {
    const touch = Math.max(Number(entity.lastActivityAt || 0), Number(entity.stateStartedAt || 0));
    return entity.state === "working" && touch > 0 && Date.now() - touch > 12 * 60 * 1000;
  }

  /* ── Shared Architectural Primitives (DNF 2.5D Oblique Side-View) ── */

  function drawSkylineWindow(ctx, x, y, w, h, isPenthouse = false) {
    roundRect(ctx, x, y, w, h, 4);
    const sky = ctx.createLinearGradient(x, y, x, y + h);
    sky.addColorStop(0, isPenthouse ? "#0c1428" : "#0b1324");
    sky.addColorStop(0.65, isPenthouse ? "#1b2847" : "#15233e");
    sky.addColorStop(1, isPenthouse ? "#2e3152" : "#1e3252");
    ctx.fillStyle = sky;
    ctx.fill();

    ctx.save();
    ctx.clip();
    // Subtle moon & stars
    ctx.fillStyle = "rgba(254, 249, 195, 0.85)";
    ctx.beginPath();
    ctx.arc(x + w * 0.84, y + h * 0.28, isPenthouse ? 5 : 3.5, 0, Math.PI * 2);
    ctx.fill();
    // Distant skyline silhouettes
    const bCount = Math.max(4, Math.floor(w / 18));
    for (let i = 0; i < bCount; i++) {
      const bw = Math.max(10, w / bCount - 2);
      const bx = x + 3 + i * (w / bCount);
      const bh = 10 + ((i * 19 + 7) % Math.max(12, Math.floor(h * 0.56)));
      ctx.fillStyle = i % 2 === 0 ? "rgba(15, 23, 42, 0.86)" : "rgba(30, 41, 59, 0.72)";
      ctx.fillRect(bx, y + h - bh, bw, bh);
      // Warm tiny city windows
      ctx.fillStyle = i % 3 === 0 ? "rgba(253, 224, 71, 0.45)" : "rgba(125, 211, 252, 0.35)";
      for (let wy = y + h - bh + 3; wy < y + h - 3; wy += 5) {
        if ((i + wy) % 2 === 0) ctx.fillRect(bx + 2, wy, 2.5, 2);
        if (bw > 9 && (i + wy) % 3 === 0) ctx.fillRect(bx + 6, wy, 2.5, 2);
      }
    }
    // Soft diagonal window reflection
    ctx.fillStyle = "rgba(255,255,255,0.045)";
    ctx.beginPath();
    ctx.moveTo(x + w * 0.14, y);
    ctx.lineTo(x + w * 0.34, y);
    ctx.lineTo(x + w * 0.18, y + h);
    ctx.lineTo(x, y + h);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Window frame & mullions
    ctx.strokeStyle = isPenthouse ? "rgba(251, 191, 36, 0.32)" : "rgba(148, 163, 184, 0.28)";
    ctx.lineWidth = 1.4;
    roundRect(ctx, x, y, w, h, 4);
    ctx.stroke();
    ctx.strokeStyle = "rgba(15, 23, 42, 0.55)";
    ctx.lineWidth = 1;
    const panes = isPenthouse ? 3 : 2;
    for (let i = 1; i < panes; i++) {
      const mx = x + (w * i) / panes;
      ctx.beginPath(); ctx.moveTo(mx, y + 1); ctx.lineTo(mx, y + h - 1); ctx.stroke();
    }
  }

  function drawElevatorDoors(ctx, x, wallH, hasSync, lang) {
    const w = 36, h = 54, y = wallH - h;
    // Frame
    roundRect(ctx, x, y, w, h, 3);
    ctx.fillStyle = "#1e293b";
    ctx.fill();
    ctx.strokeStyle = "rgba(148, 163, 184, 0.34)";
    ctx.lineWidth = 1.1;
    ctx.stroke();
    // Brushed metallic double doors
    const grad = ctx.createLinearGradient(x, y, x + w, y);
    grad.addColorStop(0, "#334155");
    grad.addColorStop(0.5, "#475569");
    grad.addColorStop(1, "#334155");
    ctx.fillStyle = grad;
    ctx.fillRect(x + 3, y + 8, w - 6, h - 8);
    // Center door seam
    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(x + w / 2, y + 8); ctx.lineTo(x + w / 2, y + h); ctx.stroke();
    // Floor LED bar above doors
    roundRect(ctx, x + 7, y + 2, w - 14, 4.5, 2);
    ctx.fillStyle = "#090d16";
    ctx.fill();
    ctx.fillStyle = hasSync ? "#38bdf8" : "#fbbf24";
    ctx.beginPath(); ctx.arc(x + w / 2, y + 4.2, 1.5, 0, Math.PI * 2); ctx.fill();
    if (hasSync) {
      ctx.font = "700 8.5px -apple-system, sans-serif";
      const lbl = lang === "zh" ? "⇄协同" : "⇄Sync";
      roundRect(ctx, x - 4, y - 12, w + 8, 12, 4);
      ctx.fillStyle = "rgba(14, 116, 144, 0.9)";
      ctx.fill();
      ctx.fillStyle = "#e0f2fe";
      ctx.textAlign = "center";
      ctx.fillText(lbl, x + w / 2, y - 3.5);
    }
  }

  function drawPendantLamp(ctx, cx, wallH, glowColor = "rgba(253, 224, 71, 0.08)") {
    ctx.strokeStyle = "rgba(148, 163, 184, 0.4)";
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, 12); ctx.stroke();
    // Soft light cone
    const cone = ctx.createLinearGradient(cx, 14, cx, wallH + 34);
    cone.addColorStop(0, glowColor);
    cone.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = cone;
    ctx.beginPath();
    ctx.moveTo(cx - 7, 15);
    ctx.lineTo(cx + 7, 15);
    ctx.lineTo(cx + 38, wallH + 34);
    ctx.lineTo(cx - 38, wallH + 34);
    ctx.closePath();
    ctx.fill();
    // Shade
    ctx.fillStyle = "#334155";
    ctx.beginPath();
    ctx.moveTo(cx - 9, 15); ctx.lineTo(cx + 9, 15);
    ctx.lineTo(cx + 5, 10); ctx.lineTo(cx - 5, 10);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#fef08a";
    ctx.fillRect(cx - 4, 15, 8, 2);
  }

  function drawPottedPlant(ctx, cx, groundY, scale = 1) {
    ctx.save();
    ctx.translate(cx, groundY);
    ctx.scale(scale, scale);
    // Floor shadow
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    ctx.beginPath(); ctx.ellipse(0, 2, 11, 4, 0, 0, Math.PI * 2); ctx.fill();
    // Terracotta / ceramic pot
    ctx.fillStyle = "#b45309";
    ctx.beginPath();
    ctx.moveTo(-7, -14); ctx.lineTo(7, -14); ctx.lineTo(5.5, 1); ctx.lineTo(-5.5, 1);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#d97706";
    roundRect(ctx, -8, -16, 16, 3.5, 1.5); ctx.fill();
    // Foliage leaves
    const leaves = [[-6, -24, -0.45, "#15803d"], [6, -23, 0.45, "#16a34a"], [0, -29, 0, "#22c55e"], [-9, -19, -0.75, "#166534"], [8, -19, 0.72, "#15803d"]];
    for (const [lx, ly, rot, col] of leaves) {
      ctx.save(); ctx.translate(lx, ly); ctx.rotate(rot);
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.ellipse(0, 0, 4.2, 8.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  function drawPerspectiveFloor(ctx, W, wallH, H, colA, colB, woodMode = false) {
    const floorH = H - wallH;
    const grad = ctx.createLinearGradient(0, wallH, 0, H);
    grad.addColorStop(0, colA);
    grad.addColorStop(1, colB);
    ctx.fillStyle = grad;
    ctx.fillRect(0, wallH, W, floorH);

    // Subtle horizontal plank / tile depth rows (expanding slightly toward foreground)
    ctx.strokeStyle = woodMode ? "rgba(255, 215, 170, 0.045)" : "rgba(148, 163, 184, 0.055)";
    ctx.lineWidth = 1;
    let y = wallH + 14;
    let step = 14;
    while (y < H - 4) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      step += 3.5;
      y += step;
    }

    // Subtle 1-point perspective floor seam lines (classic DNF depth feel)
    const cx = W / 2;
    const cols = woodMode ? 12 : 9;
    ctx.strokeStyle = woodMode ? "rgba(0, 0, 0, 0.16)" : "rgba(148, 163, 184, 0.045)";
    for (let i = 1; i < cols; i++) {
      const topX = (W * i) / cols;
      const botX = cx + (topX - cx) * 1.38;
      ctx.beginPath(); ctx.moveTo(topX, wallH); ctx.lineTo(botX, H); ctx.stroke();
    }

    // Wall-to-floor ambient occlusion shadow
    const ao = ctx.createLinearGradient(0, wallH, 0, wallH + 14);
    ao.addColorStop(0, "rgba(0, 0, 0, 0.42)");
    ao.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = ao;
    ctx.fillRect(0, wallH, W, 14);
  }

  function drawWallDecor(ctx, x, y, kind, accent) {
    if (kind === "board") {
      roundRect(ctx, x, y, 56, 34, 3);
      ctx.fillStyle = "#e2e8f0"; ctx.fill();
      ctx.strokeStyle = "#64748b"; ctx.lineWidth = 1.5; ctx.stroke();
      const stickies = [[6, 7, "#fde047"], [18, 7, "#7dd3fc"], [30, 7, "#fca5a5"], [42, 7, "#86efac"], [6, 19, "#c4b5fd"], [18, 19, "#fde047"]];
      for (const [sx, sy, col] of stickies) { ctx.fillStyle = col; ctx.fillRect(x + sx, y + sy, 9, 8); }
    } else if (kind === "server") {
      roundRect(ctx, x, y - 4, 32, 46, 3);
      ctx.fillStyle = "#0f172a"; ctx.fill();
      ctx.strokeStyle = "rgba(148,163,184,0.35)"; ctx.lineWidth = 1; ctx.stroke();
      for (let i = 0; i < 6; i++) {
        ctx.fillStyle = "#1e293b"; ctx.fillRect(x + 4, y + i * 6.5, 24, 4.5);
        ctx.fillStyle = i % 2 === 0 ? "#4ade80" : accent;
        ctx.fillRect(x + 23, y + i * 6.5 + 1.5, 3, 1.8);
      }
    } else if (kind === "books") {
      roundRect(ctx, x, y, 54, 36, 3);
      ctx.fillStyle = "#3b2416"; ctx.fill();
      ctx.fillStyle = "#26160c";
      ctx.fillRect(x + 3, y + 4, 48, 12); ctx.fillRect(x + 3, y + 20, 48, 12);
      const cols = ["#f59e0b", "#38bdf8", "#a78bfa", "#34d399", "#fb7185", "#94a3b8"];
      for (let i = 0; i < 8; i++) {
        ctx.fillStyle = cols[i % cols.length];
        ctx.fillRect(x + 5 + i * 5.8, y + 6, 4.2, 10);
        ctx.fillStyle = cols[(i + 2) % cols.length];
        ctx.fillRect(x + 5 + i * 5.8, y + 22, 4.2, 10);
      }
    } else {
      // Wall monitor with waveform / metrics
      roundRect(ctx, x, y, 56, 32, 3);
      ctx.fillStyle = "#0b1120"; ctx.fill();
      ctx.strokeStyle = "rgba(148,163,184,0.35)"; ctx.lineWidth = 1.2; ctx.stroke();
      ctx.strokeStyle = accent; ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x + 6, y + 22);
      ctx.lineTo(x + 15, y + 17); ctx.lineTo(x + 23, y + 23);
      ctx.lineTo(x + 33, y + 11); ctx.lineTo(x + 43, y + 15); ctx.lineTo(x + 50, y + 8);
      ctx.stroke();
    }
  }

  /* ── Character, Desk, Engine Badge & Soft-Rose Alert Drawing ── */

  function drawEngineBadge(ctx, cx, y, rawEng) {
    const es = engStyle(rawEng);
    const label = `${es.sym} ${es.short}`;
    ctx.font = "800 9px -apple-system, BlinkMacSystemFont, sans-serif";
    const tw = ctx.measureText(label).width;
    const pw = tw + 10;
    const ph = 14;
    roundRect(ctx, cx - pw / 2, y, pw, ph, 4);
    ctx.fillStyle = es.bg;
    ctx.fill();
    ctx.strokeStyle = es.border;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = es.light;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, cx, y + ph / 2 + 0.5);
    ctx.textBaseline = "alphabetic";
    return pw;
  }

  function drawNameAndEngine(ctx, cx, topY, name, rawEng, extraText = "", isStall = false, maxW = 112) {
    ctx.font = "700 10.5px -apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif";
    const shown = trimText(ctx, name, maxW);
    const nw = ctx.measureText(shown).width;
    const pillW = Math.max(46, nw + 12);
    roundRect(ctx, cx - pillW / 2, topY, pillW, 15, 5);
    ctx.fillStyle = "rgba(9, 13, 22, 0.86)";
    ctx.fill();
    ctx.strokeStyle = isStall ? "rgba(251, 191, 36, 0.65)" : "rgba(148, 163, 184, 0.28)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = "#f1f5f9";
    ctx.textAlign = "center";
    ctx.fillText(shown, cx, topY + 11);

    // Prominent Engine Badge directly underneath nameplate
    const badgeY = topY + 17;
    if (extraText) {
      const es = engStyle(rawEng);
      const engLbl = `${es.sym} ${es.short}`;
      ctx.font = "800 8.5px -apple-system, sans-serif";
      const ew = ctx.measureText(engLbl).width + 9;
      ctx.font = "700 8.5px -apple-system, sans-serif";
      const xw = ctx.measureText(extraText).width + 8;
      const totalW = ew + 4 + xw;
      const sx = cx - totalW / 2;
      drawEngineBadge(ctx, sx + ew / 2, badgeY, rawEng);
      roundRect(ctx, sx + ew + 4, badgeY, xw, 14, 4);
      ctx.fillStyle = isStall ? "rgba(120, 53, 15, 0.86)" : "rgba(30, 41, 59, 0.88)";
      ctx.fill();
      ctx.strokeStyle = isStall ? "rgba(251, 191, 36, 0.6)" : "rgba(148, 163, 184, 0.25)";
      ctx.stroke();
      ctx.fillStyle = isStall ? "#fde68a" : "#94a3b8";
      ctx.textAlign = "center";
      ctx.fillText(extraText, sx + ew + 4 + xw / 2, badgeY + 10);
    } else {
      drawEngineBadge(ctx, cx, badgeY, rawEng);
    }
  }

  function drawSoftRoseDot(ctx, x, y, count = 1, pulse = 0) {
    const r = count > 1 ? 8 : 6.8;
    // Gentle soft halo (no harsh flashing rings)
    ctx.fillStyle = `rgba(251, 113, 133, ${0.14 + 0.08 * Math.sin(pulse)})`;
    ctx.beginPath(); ctx.arc(x, y, r + 3.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = ROSE.dot;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#111827";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    ctx.font = "900 8.5px -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(count > 1 ? String(Math.min(count, 9)) : "!", x, y + 0.5);
    ctx.textBaseline = "alphabetic";
    return { x, y, r: r + 5 };
  }

  function drawAvatarHead(ctx, cx, cy, r, img, name, ringColor) {
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.closePath();
    ctx.fillStyle = "#1e293b"; ctx.fill();
    ctx.save(); ctx.clip();
    if (img && img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, cx - r, cy - r, r * 2, r * 2);
    } else {
      ctx.fillStyle = "#334155"; ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
      ctx.fillStyle = "#f8fafc";
      ctx.font = `800 ${Math.round(r * 0.9)}px -apple-system, sans-serif`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText((name || "?").slice(0, 1).toUpperCase(), cx, cy + 1);
      ctx.textBaseline = "alphabetic";
    }
    ctx.restore();
    ctx.strokeStyle = ringColor;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }

  function drawWorkerRobotHead(ctx, cx, cy, eng, state, phase) {
    const es = engStyle(eng);
    const eyeCol = state === "needs" ? ROSE.dot : (state === "working" ? "#4ade80" : "#64748b");
    // Antenna colored by engine
    ctx.strokeStyle = es.color; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(cx, cy - 11); ctx.lineTo(cx, cy - 16); ctx.stroke();
    ctx.fillStyle = state === "working" ? es.light : es.color;
    ctx.beginPath(); ctx.arc(cx, cy - 17, 2.3, 0, Math.PI * 2); ctx.fill();
    // Side ear pods in engine accent
    ctx.fillStyle = es.color;
    roundRect(ctx, cx - 15.5, cy - 4, 3.5, 8, 1.5); ctx.fill();
    roundRect(ctx, cx + 12, cy - 4, 3.5, 8, 1.5); ctx.fill();
    // Crisp white-silver robot helmet
    roundRect(ctx, cx - 13, cy - 11, 26, 21, 7);
    ctx.fillStyle = "#f1f5f9"; ctx.fill();
    ctx.strokeStyle = es.color; ctx.lineWidth = 1.7; ctx.stroke();
    // Dark visor
    roundRect(ctx, cx - 9.5, cy - 5.5, 19, 10, 3.5);
    ctx.fillStyle = "#0f172a"; ctx.fill();
    // Expressive eyes
    if (state === "idle") {
      ctx.strokeStyle = "#64748b"; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(cx - 6, cy - 0.5); ctx.lineTo(cx - 2.2, cy - 0.5);
      ctx.moveTo(cx + 2.2, cy - 0.5); ctx.lineTo(cx + 6, cy - 0.5); ctx.stroke();
    } else {
      const look = state === "working" ? Math.sin(phase * 1.4) * 1.2 : 0;
      ctx.fillStyle = eyeCol;
      ctx.beginPath(); ctx.arc(cx - 4 + look, cy - 0.5, 2.2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + 4 + look, cy - 0.5, 2.2, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawSeatedDeskStation(ctx, opts) {
    const { cx, baseY, isLead, isWorking, isStall, isUpstairs, eng, avatarImg, name, phase, hovered, lang, durText } = opts;
    const es = engStyle(eng);
    const deskW = isLead ? 104 : 84;
    const deskTopY = baseY - 22;
    const bob = isWorking && !isUpstairs ? Math.sin(phase * 2.2) * 1.5 : 0;

    // Ground shadow
    ctx.fillStyle = hovered ? "rgba(56, 189, 248, 0.16)" : "rgba(0, 0, 0, 0.34)";
    ctx.beginPath(); ctx.ellipse(cx, baseY + 3, deskW * 0.54, 8, 0, 0, Math.PI * 2); ctx.fill();

    // Swivel chair backrest behind desk
    roundRect(ctx, cx - 15, deskTopY - 25, 30, 26, 6);
    ctx.fillStyle = isLead ? "#28354d" : "#1e293b";
    ctx.fill();
    ctx.strokeStyle = isLead ? "rgba(251, 191, 36, 0.35)" : es.border;
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Character seated behind desk (unless upstairs at Boss Office)
    if (!isUpstairs) {
      // Engine-colored jacket / shoulders
      roundRect(ctx, cx - 13, deskTopY - 11 + bob, 26, 14, 6);
      ctx.fillStyle = es.coat;
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.2)";
      ctx.lineWidth = 1; ctx.stroke();

      if (isLead) {
        const ring = isStall ? "#fbbf24" : (isWorking ? es.color : "rgba(148,163,184,0.55)");
        drawAvatarHead(ctx, cx, deskTopY - 24 + bob, 14.5, avatarImg, name, ring);
      } else {
        drawWorkerRobotHead(ctx, cx, deskTopY - 21 + bob, eng, isWorking ? "working" : "idle", phase);
      }
      // Idle zZ
      if (!isWorking) {
        ctx.fillStyle = "rgba(148, 163, 184, 0.6)";
        ctx.font = "700 9px ui-monospace, monospace";
        ctx.textAlign = "left";
        ctx.fillText("zZ", cx + 15, deskTopY - 30);
      }
    }

    // 2.5D Oblique Desk (slanted top surface + front apron + steel legs)
    const x0 = cx - deskW / 2;
    // Legs
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(x0 + 5, deskTopY + 14, 4, 10);
    ctx.fillRect(x0 + deskW - 9, deskTopY + 14, 4, 10);
    // Front apron
    roundRect(ctx, x0, deskTopY + 7, deskW, 13, 2);
    ctx.fillStyle = isLead ? "#5c3a21" : "#253147";
    ctx.fill();
    ctx.strokeStyle = hovered ? "#7dd3fc" : "rgba(255,255,255,0.12)";
    ctx.lineWidth = hovered ? 1.5 : 1;
    ctx.stroke();
    // Engine color trim strip along desk front
    ctx.fillStyle = es.color;
    ctx.globalAlpha = isWorking ? 0.85 : 0.35;
    ctx.fillRect(x0 + 3, deskTopY + 8, deskW - 6, 2);
    ctx.globalAlpha = 1;
    // Oblique Top Surface
    ctx.beginPath();
    ctx.moveTo(x0 + 4, deskTopY);
    ctx.lineTo(x0 + deskW - 4, deskTopY);
    ctx.lineTo(x0 + deskW, deskTopY + 8);
    ctx.lineTo(x0, deskTopY + 8);
    ctx.closePath();
    ctx.fillStyle = isLead ? "#8a5a36" : "#3a4b68";
    ctx.fill();

    // Monitor (placed slightly right so character stays clearly visible!)
    const mx = cx + (isLead ? 22 : 16);
    const my = deskTopY - 12;
    // Stand
    ctx.fillStyle = "#475569";
    ctx.fillRect(mx - 2, my + 12, 4, 4);
    ctx.fillRect(mx - 6, my + 15, 12, 2);
    // Monitor frame
    roundRect(ctx, mx - 13, my - 3, 26, 16, 2.5);
    ctx.fillStyle = "#0f172a"; ctx.fill();
    ctx.strokeStyle = isWorking ? es.color : "#475569";
    ctx.lineWidth = 1.2; ctx.stroke();
    // Screen code lines
    if (isWorking) {
      const scan = Math.floor(phase * 3) % 3;
      ctx.fillStyle = isStall ? "#fbbf24" : es.light;
      ctx.fillRect(mx - 9.5, my + 0.5, 11 + (scan === 0 ? 4 : 0), 2);
      ctx.fillStyle = "#4ade80";
      ctx.fillRect(mx - 9.5, my + 4.2, 16 - (scan === 1 ? 5 : 0), 2);
      ctx.fillStyle = es.color;
      ctx.fillRect(mx - 9.5, my + 7.9, 13, 2);
    } else {
      ctx.fillStyle = "rgba(148,163,184,0.22)";
      ctx.fillRect(mx - 8, my + 3, 16, 2);
    }

    // Coffee mug on left of desk
    ctx.fillStyle = "#e2e8f0";
    roundRect(ctx, x0 + 9, deskTopY - 2, 6, 6, 1.5); ctx.fill();

    // If Bot/Worker went upstairs to Boss Office, show neat desk note
    if (isUpstairs) {
      const tag = lang === "zh" ? "▲ 老板房汇报中" : "▲ At Boss Office";
      ctx.font = "700 9px -apple-system, 'PingFang SC', sans-serif";
      const tw = ctx.measureText(tag).width + 12;
      roundRect(ctx, cx - tw / 2, deskTopY - 35, tw, 15, 5);
      ctx.fillStyle = ROSE.bubbleBg;
      ctx.fill();
      ctx.strokeStyle = ROSE.border;
      ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = ROSE.text;
      ctx.textAlign = "center";
      ctx.fillText(tag, cx, deskTopY - 24.5);
    }

    // Nameplate + Prominent Engine Badge cleanly below desk
    drawNameAndEngine(ctx, cx, baseY + 5, name, eng, durText, isStall, isLead ? 106 : 98);
  }

  function drawStandingQueueActor(ctx, opts) {
    const { cx, footY, isBot, eng, avatarImg, name, snippet, count, phase, hovered } = opts;
    const es = engStyle(eng);
    const sway = Math.sin(phase * 1.5) * 1.1;

    // Ground shadow
    ctx.fillStyle = hovered ? "rgba(251, 113, 133, 0.24)" : "rgba(0, 0, 0, 0.36)";
    ctx.beginPath(); ctx.ellipse(cx, footY + 2, 17, 5.5, 0, 0, Math.PI * 2); ctx.fill();

    // Little DNF chibi legs & shoes (facing slightly left toward Boss Desk)
    ctx.fillStyle = "#1e293b";
    roundRect(ctx, cx - 7, footY - 10, 5.5, 10, 2); ctx.fill();
    roundRect(ctx, cx + 1.5, footY - 10, 5.5, 10, 2); ctx.fill();
    ctx.fillStyle = "#0f172a";
    roundRect(ctx, cx - 9, footY - 3, 7, 3.5, 1.5); ctx.fill();
    roundRect(ctx, cx + 0.5, footY - 3, 7, 3.5, 1.5); ctx.fill();

    // Body / Engine-colored coat
    roundRect(ctx, cx - 10.5, footY - 25 + sway, 21, 17, 6);
    ctx.fillStyle = es.coat;
    ctx.fill();
    ctx.strokeStyle = hovered ? "#fda4af" : "rgba(255,255,255,0.22)";
    ctx.lineWidth = 1.2; ctx.stroke();

    // Holding a neat glowing report clipboard facing left toward the Boss!
    ctx.save();
    ctx.translate(cx - 14, footY - 19 + sway);
    ctx.rotate(-0.18);
    roundRect(ctx, -5, -7, 10, 13, 2);
    ctx.fillStyle = "#f8fafc"; ctx.fill();
    ctx.strokeStyle = ROSE.dot; ctx.lineWidth = 1.1; ctx.stroke();
    ctx.fillStyle = "#64748b";
    ctx.fillRect(-3, -3, 6, 1.4); ctx.fillRect(-3, 0, 5, 1.4); ctx.fillRect(-3, 3, 4, 1.4);
    ctx.restore();

    // Head
    const headY = footY - 37 + sway;
    if (isBot) {
      drawAvatarHead(ctx, cx, headY, 14, avatarImg, name, ROSE.stroke);
    } else {
      drawWorkerRobotHead(ctx, cx, headY + 2, eng, "needs", phase);
    }

    // Soft rose clickable badge on top-right of head
    const dotHit = drawSoftRoseDot(ctx, cx + 13, headY - 11, count, phase);

    // Compact Report Speech Bubble above head
    if (snippet) {
      ctx.font = "600 9.5px -apple-system, 'PingFang SC', sans-serif";
      const txt = trimText(ctx, snippet, 96);
      const bw = Math.min(108, Math.max(46, ctx.measureText(txt).width + 14));
      const bx = cx - bw / 2;
      const by = headY - 34;
      roundRect(ctx, bx, by, bw, 16, 6);
      ctx.fillStyle = ROSE.bubbleBg;
      ctx.fill();
      ctx.strokeStyle = ROSE.border;
      ctx.lineWidth = 1; ctx.stroke();
      // Little pointer tail
      ctx.beginPath();
      ctx.moveTo(cx - 4, by + 16); ctx.lineTo(cx, by + 20); ctx.lineTo(cx + 4, by + 16);
      ctx.fillStyle = ROSE.bubbleBg; ctx.fill();
      ctx.fillStyle = ROSE.text;
      ctx.textAlign = "center";
      ctx.fillText(txt, cx, by + 11.2);
    }

    // Nameplate + Engine badge neatly below feet
    drawNameAndEngine(ctx, cx, footY + 6, name, eng, "", false, 98);
    return dotHit;
  }

  function drawBossExecutiveDesk(ctx, x, footY, lang, phase) {
    // Ground shadow
    ctx.fillStyle = "rgba(0, 0, 0, 0.38)";
    ctx.beginPath(); ctx.ellipse(x + 56, footY + 3, 62, 10, 0, 0, Math.PI * 2); ctx.fill();

    // High-back leather Boss Chair
    roundRect(ctx, x + 28, footY - 56, 36, 36, 9);
    ctx.fillStyle = "#3b1d2a"; ctx.fill();
    ctx.strokeStyle = "rgba(251, 191, 36, 0.45)"; ctx.lineWidth = 1.4; ctx.stroke();

    // Owner / Boss figure seated comfortably behind executive desk
    const bob = Math.sin(phase * 0.9) * 0.6;
    roundRect(ctx, x + 31, footY - 34 + bob, 30, 16, 7);
    ctx.fillStyle = "#1e293b"; ctx.fill();
    ctx.strokeStyle = "rgba(251, 191, 36, 0.35)"; ctx.stroke();
    // Tie / collar
    ctx.fillStyle = "#fbbf24";
    ctx.beginPath(); ctx.moveTo(x + 44, footY - 33 + bob); ctx.lineTo(x + 48, footY - 33 + bob); ctx.lineTo(x + 46, footY - 23 + bob); ctx.closePath(); ctx.fill();
    // Head
    ctx.fillStyle = "#fde68a";
    ctx.beginPath(); ctx.arc(x + 46, footY - 45 + bob, 11, 0, Math.PI * 2); ctx.fill();
    // Hair
    ctx.fillStyle = "#1e293b";
    ctx.beginPath(); ctx.arc(x + 46, footY - 48 + bob, 11, Math.PI, 0); ctx.fill();
    // Calm eyes looking toward the queue (right)
    ctx.fillStyle = "#0f172a";
    ctx.beginPath(); ctx.arc(x + 45, footY - 44 + bob, 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + 51, footY - 44 + bob, 1.5, 0, Math.PI * 2); ctx.fill();
    // Tiny subtle gold crown above boss
    ctx.fillStyle = "#fbbf24";
    ctx.beginPath();
    ctx.moveTo(x + 40, footY - 57 + bob); ctx.lineTo(x + 42, footY - 62 + bob);
    ctx.lineTo(x + 46, footY - 59 + bob); ctx.lineTo(x + 50, footY - 62 + bob);
    ctx.lineTo(x + 52, footY - 57 + bob); ctx.closePath(); ctx.fill();

    // Executive Mahogany Desk (wide, 2.5D oblique)
    const dw = 112;
    const ty = footY - 24;
    // Front panel
    roundRect(ctx, x, ty + 8, dw, 19, 3);
    ctx.fillStyle = "#4a2518"; ctx.fill();
    ctx.strokeStyle = "rgba(251, 191, 36, 0.34)"; ctx.lineWidth = 1.2; ctx.stroke();
    // Recessed brass trim inset
    ctx.strokeStyle = "rgba(251, 191, 36, 0.25)";
    ctx.strokeRect(x + 6, ty + 12, dw - 12, 11);
    // Gold BOSS nameplate
    roundRect(ctx, x + dw / 2 - 20, ty + 13, 40, 10, 2.5);
    ctx.fillStyle = "#78350f"; ctx.fill();
    ctx.strokeStyle = "#fbbf24"; ctx.lineWidth = 0.9; ctx.stroke();
    ctx.fillStyle = "#fef3c7";
    ctx.font = "800 7.5px -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(lang === "zh" ? "老板" : "BOSS", x + dw / 2, ty + 20.5);

    // Oblique Mahogany Top
    ctx.beginPath();
    ctx.moveTo(x + 5, ty); ctx.lineTo(x + dw - 5, ty);
    ctx.lineTo(x + dw, ty + 9); ctx.lineTo(x, ty + 9); ctx.closePath();
    ctx.fillStyle = "#7c3f24"; ctx.fill();

    // Brass desk lamp on left
    ctx.fillStyle = "#d97706";
    ctx.fillRect(x + 12, ty + 2, 9, 2.5);
    ctx.strokeStyle = "#fbbf24"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(x + 16, ty + 2); ctx.lineTo(x + 16, ty - 8); ctx.stroke();
    ctx.fillStyle = "#15803d";
    roundRect(ctx, x + 10, ty - 12, 13, 5, 2); ctx.fill();

    // Sleek open laptop + steaming coffee mug on right
    ctx.fillStyle = "#cbd5e1";
    ctx.fillRect(x + 70, ty + 1, 20, 3);
    ctx.fillStyle = "#334155";
    ctx.beginPath(); ctx.moveTo(x + 73, ty + 1); ctx.lineTo(x + 87, ty + 1); ctx.lineTo(x + 84, ty - 9); ctx.lineTo(x + 70, ty - 9); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#fef3c7";
    roundRect(ctx, x + 96, ty - 2, 7, 6, 1.5); ctx.fill();
    // Subtle coffee steam
    ctx.strokeStyle = "rgba(255,255,255,0.35)"; ctx.lineWidth = 1;
    const st = Math.sin(phase * 1.8) * 1.5;
    ctx.beginPath(); ctx.moveTo(x + 99, ty - 4); ctx.quadraticCurveTo(x + 99 + st, ty - 9, x + 100, ty - 13); ctx.stroke();
  }

  /* ── Sleek Luminous Message Packet (Replaces Ugly Envelopes!) ── */

  function drawMessageStream(ctx, x1, y1, x2, y2, progress, kind) {
    const color = kind === "alert" ? ROSE.dot : (kind === "reply" ? "#34d399" : "#38bdf8");
    const light = kind === "alert" ? "#ffe4e6" : (kind === "reply" ? "#d1fae5" : "#e0f2fe");
    const midX = (x1 + x2) / 2;
    const midY = Math.min(y1, y2) - 22;

    const pt = (t) => {
      const u = 1 - t;
      return {
        x: u * u * x1 + 2 * u * t * midX + t * t * x2,
        y: u * u * y1 + 2 * u * t * midY + t * t * y2,
      };
    };

    // Ultra-delicate dashed arc guide (barely-there elegance)
    ctx.save();
    ctx.strokeStyle = kind === "alert" ? "rgba(251, 113, 133, 0.16)" : "rgba(56, 189, 248, 0.13)";
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 5]);
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.quadraticCurveTo(midX, midY, x2, y2); ctx.stroke();
    ctx.setLineDash([]);

    // Fading comet light trail (4 soft orbs)
    for (let i = 4; i >= 1; i--) {
      const tp = progress - i * 0.045;
      if (tp < 0 || tp > 1) continue;
      const p = pt(tp);
      ctx.globalAlpha = (5 - i) * 0.13;
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(p.x, p.y, 1.6 + (4 - i) * 0.45, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Streamlined glowing paper-dart / luminous packet head
    const head = pt(progress);
    const prev = pt(Math.max(0, progress - 0.03));
    const ang = Math.atan2(head.y - prev.y, head.x - prev.x);

    ctx.translate(head.x, head.y);
    ctx.rotate(ang);
    // Soft ambient halo
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.24;
    ctx.beginPath(); ctx.arc(0, 0, 7.5, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    // Sleek minimalist paper-plane dart
    ctx.fillStyle = light;
    ctx.beginPath();
    ctx.moveTo(6.5, 0);
    ctx.lineTo(-4.5, -3.8);
    ctx.lineTo(-2.2, 0);
    ctx.lineTo(-4.5, 3.8);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }

  window.OFFICE_ENG_STYLES = ENG_STYLES;
  window.OfficeSprites = {
    ENG_STYLES, FLOOR_THEMES, ROSE, engStyle, hashStr, trimText, roundRect,
    fmtDur, isStalled, drawSkylineWindow, drawElevatorDoors, drawPendantLamp,
    drawPottedPlant, drawPerspectiveFloor, drawWallDecor, drawEngineBadge,
    drawNameAndEngine, drawSoftRoseDot, drawAvatarHead, drawWorkerRobotHead,
    drawSeatedDeskStation, drawStandingQueueActor, drawBossExecutiveDesk,
    drawMessageStream,
  };
})();
