/**
 * DNF-Style 2.5D Office Architecture & Crisp Character Sprite Primitives
 * - Authentic high-rise office building cutaway (concrete slabs, LED panels, tall glass curtain walls, real office props)
 * - Full-bodied, dark-outlined Bot & Articulated Worker Robot sprites (unmistakable torso, arms, hands, legs & engine accents)
 * - Prominent Agent Engine badges (Claude / agy / Codex / Pi) & softened coral-rose alerts
 */
(function () {
  const ENG_STYLES = {
    claude: { key: "claude", label: "Claude", short: "Claude", sym: "✦", color: "#f59e0b", light: "#fde68a", bg: "#2e1d0a", border: "rgba(245,158,11,0.72)", coat: "#c25e0a", coatHi: "#ea8a2c" },
    antigravity: { key: "antigravity", label: "Antigravity", short: "agy", sym: "◈", color: "#38bdf8", light: "#bae6fd", bg: "#0a2236", border: "rgba(56,189,248,0.72)", coat: "#0284c7", coatHi: "#38bdf8" },
    codex: { key: "codex", label: "Codex", short: "Codex", sym: "⬡", color: "#a78bfa", light: "#ddd6fe", bg: "#1f1538", border: "rgba(167,139,250,0.72)", coat: "#6d28d9", coatHi: "#8b5cf6" },
    pi: { key: "pi", label: "Pi", short: "Pi", sym: "π", color: "#34d399", light: "#a7f3d0", bg: "#0a2921", border: "rgba(52,211,153,0.72)", coat: "#059669", coatHi: "#10b981" },
    other: { key: "other", label: "Agent", short: "Agent", sym: "•", color: "#94a3b8", light: "#e2e8f0", bg: "#1e293b", border: "rgba(148,163,184,0.48)", coat: "#475569", coatHi: "#64748b" },
  };

  // Authentic modern studio office palettes (lit warm-neutral architectural tones, not dark caves!)
  const FLOOR_THEMES = [
    { wallTop: "#273142", wallBot: "#323f54", woodPanel: "#5c4330", floorA: "#222a38", floorB: "#2a3445", accent: "#38bdf8", rug: "rgba(56,189,248,0.11)", props: ["whiteboard", "cooler"] },
    { wallTop: "#2b2f40", wallBot: "#373c52", woodPanel: "#544032", floorA: "#242736", floorB: "#2d3144", accent: "#a78bfa", rug: "rgba(167,139,250,0.11)", props: ["cabinet", "cooler"] },
    { wallTop: "#223338", wallBot: "#2c4147", woodPanel: "#5c4632", floorA: "#1e2c30", floorB: "#25363b", accent: "#34d399", rug: "rgba(52,211,153,0.11)", props: ["bookshelf", "whiteboard"] },
    { wallTop: "#332c28", wallBot: "#423934", woodPanel: "#634730", floorA: "#292421", floorB: "#332c28", accent: "#fbbf24", rug: "rgba(251,191,36,0.11)", props: ["cabinet", "bookshelf"] },
  ];

  const ROSE = {
    dot: "#fb7185",
    stroke: "#fda4af",
    tint: "rgba(244, 63, 94, 0.14)",
    border: "rgba(251, 113, 133, 0.52)",
    text: "#ffe4e6",
    bubbleBg: "rgba(38, 19, 28, 0.94)",
  };

  const INK = "#0b1120";

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

  /* ── High-Rise Office Building Architectural Primitives ── */

  function drawBuildingShell(ctx, W, wallH, H, wallTop, wallBot) {
    // Back wall gradient
    const wg = ctx.createLinearGradient(0, 10, 0, wallH);
    wg.addColorStop(0, wallTop);
    wg.addColorStop(1, wallBot);
    ctx.fillStyle = wg;
    ctx.fillRect(0, 0, W, wallH);

    // Architectural concrete ceiling slab & shadow lip
    ctx.fillStyle = "#161d29";
    ctx.fillRect(0, 0, W, 9);
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.fillRect(0, 8, W, 1);
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    ctx.fillRect(0, 9, W, 3);

    // Baseboard trim along wall-floor junction
    ctx.fillStyle = "#4b5563";
    ctx.fillRect(0, wallH - 5, W, 1.5);
    ctx.fillStyle = "#1e2533";
    ctx.fillRect(0, wallH - 3.5, W, 3.5);
  }

  function drawBuildingColumns(ctx, W, H) {
    // Structural steel-clad skyscraper columns framing left & right edges
    for (const cx of [0, W - 8]) {
      ctx.fillStyle = "#18202e";
      ctx.fillRect(cx, 0, 8, H);
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.fillRect(cx === 0 ? 7 : cx, 0, 1, H);
    }
  }

  function drawCeilingLightBar(ctx, cx, wallH, width = 54, warm = false) {
    // Recessed modern linear LED office ceiling fixture
    const x = cx - width / 2;
    const cone = ctx.createLinearGradient(cx, 9, cx, wallH + 26);
    cone.addColorStop(0, warm ? "rgba(254, 240, 138, 0.13)" : "rgba(224, 242, 254, 0.11)");
    cone.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = cone;
    ctx.beginPath();
    ctx.moveTo(x, 9); ctx.lineTo(x + width, 9);
    ctx.lineTo(x + width + 24, wallH + 26); ctx.lineTo(x - 24, wallH + 26);
    ctx.closePath(); ctx.fill();

    // Fixture frame & bright diffuser strip
    ctx.fillStyle = "#334155";
    ctx.fillRect(x - 2, 7, width + 4, 4);
    ctx.fillStyle = warm ? "#fef9c3" : "#e0f2fe";
    ctx.fillRect(x, 8.5, width, 2.2);
  }

  function drawWoodSlats(ctx, x, y, w, h) {
    // Warm modern oak acoustic wall slats (classic contemporary office design)
    ctx.fillStyle = "#2b1e15";
    ctx.fillRect(x, y, w, h);
    for (let sx = x + 2; sx < x + w - 2; sx += 6) {
      ctx.fillStyle = "#6e4c32";
      ctx.fillRect(sx, y, 3.5, h);
      ctx.fillStyle = "rgba(255, 228, 196, 0.12)";
      ctx.fillRect(sx, y, 1, h);
    }
    ctx.strokeStyle = "rgba(0,0,0,0.28)";
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);
  }

  function drawCurtainWallWindow(ctx, x, y, w, h, skylineSeed = 1) {
    // Tall high-rise glass curtain wall showing neighboring city office towers
    roundRect(ctx, x, y, w, h, 2);
    const sky = ctx.createLinearGradient(x, y, x, y + h);
    sky.addColorStop(0, "#1c2d4a");
    sky.addColorStop(0.55, "#2b4269");
    sky.addColorStop(1, "#445473");
    ctx.fillStyle = sky;
    ctx.fill();

    ctx.save();
    ctx.clip();
    // Subtle dusk horizon glow
    const glow = ctx.createLinearGradient(x, y + h * 0.55, x, y + h);
    glow.addColorStop(0, "rgba(251, 191, 36, 0)");
    glow.addColorStop(1, "rgba(251, 146, 60, 0.2)");
    ctx.fillStyle = glow;
    ctx.fillRect(x, y + h * 0.55, w, h * 0.45);

    // Distant office towers silhouette + warm lit office grids
    const count = Math.max(4, Math.floor(w / 22));
    for (let i = 0; i < count; i++) {
      const bw = Math.max(14, w / count - 3);
      const bx = x + 3 + i * (w / count);
      const bh = 16 + (((i + skylineSeed) * 17 + 11) % Math.max(16, Math.floor(h * 0.65)));
      ctx.fillStyle = i % 2 === 0 ? "#1b263b" : "#24344d";
      ctx.fillRect(bx, y + h - bh, bw, bh);
      // Warm & cool office tower window rows
      for (let wy = y + h - bh + 4; wy < y + h - 4; wy += 5) {
        for (let wx = bx + 2.5; wx < bx + bw - 3; wx += 4.5) {
          const lit = ((i * 7 + wy + wx) % 3) !== 0;
          if (!lit) continue;
          ctx.fillStyle = (wy + i) % 4 === 0 ? "rgba(254, 240, 138, 0.65)" : "rgba(186, 230, 253, 0.42)";
          ctx.fillRect(wx, wy, 2.5, 2.2);
        }
      }
    }

    // Rolled office blinds valence at top of curtain wall
    ctx.fillStyle = "rgba(226, 232, 240, 0.14)";
    ctx.fillRect(x, y, w, 6);
    ctx.strokeStyle = "rgba(255,255,255,0.16)";
    ctx.beginPath(); ctx.moveTo(x, y + 6); ctx.lineTo(x + w, y + 6); ctx.stroke();

    // Soft glass reflection streak
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.beginPath();
    ctx.moveTo(x + w * 0.12, y); ctx.lineTo(x + w * 0.28, y);
    ctx.lineTo(x + w * 0.14, y + h); ctx.lineTo(x - 2, y + h);
    ctx.closePath(); ctx.fill();
    ctx.restore();

    // Aluminum curtain-wall mullions & sill
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 1.6;
    ctx.strokeRect(x, y, w, h);
    const panes = Math.max(2, Math.round(w / 56));
    ctx.strokeStyle = "rgba(30, 41, 59, 0.72)";
    ctx.lineWidth = 1.4;
    for (let i = 1; i < panes; i++) {
      const mx = x + (w * i) / panes;
      ctx.beginPath(); ctx.moveTo(mx, y); ctx.lineTo(mx, y + h); ctx.stroke();
    }
    // Window sill ledge
    ctx.fillStyle = "#64748b";
    ctx.fillRect(x - 2, y + h - 1, w + 4, 2.5);
  }

  function drawOfficeFloor(ctx, W, wallH, H, colA, colB, woodMode = false) {
    const grad = ctx.createLinearGradient(0, wallH, 0, H);
    grad.addColorStop(0, colA);
    grad.addColorStop(1, colB);
    ctx.fillStyle = grad;
    ctx.fillRect(0, wallH, W, H - wallH);

    // Subtle carpet tiles or wood planks in 1-point perspective
    ctx.strokeStyle = woodMode ? "rgba(255, 224, 185, 0.065)" : "rgba(203, 213, 225, 0.055)";
    ctx.lineWidth = 1;
    let y = wallH + 16;
    let step = 16;
    while (y < H - 4) {
      ctx.beginPath(); ctx.moveTo(8, y); ctx.lineTo(W - 8, y); ctx.stroke();
      step += 3.5;
      y += step;
    }
    const cx = W / 2;
    const cols = woodMode ? 11 : 8;
    ctx.strokeStyle = woodMode ? "rgba(0, 0, 0, 0.14)" : "rgba(203, 213, 225, 0.04)";
    for (let i = 1; i < cols; i++) {
      const topX = (W * i) / cols;
      const botX = cx + (topX - cx) * 1.32;
      ctx.beginPath(); ctx.moveTo(topX, wallH); ctx.lineTo(botX, H); ctx.stroke();
    }

    // Crisp wall-floor contact shadow
    const ao = ctx.createLinearGradient(0, wallH, 0, wallH + 12);
    ao.addColorStop(0, "rgba(0, 0, 0, 0.36)");
    ao.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = ao;
    ctx.fillRect(0, wallH, W, 12);
  }

  function drawElevatorLobby(ctx, x, wallH, floorLabel, hasSync, lang) {
    const w = 38, h = 58, y = wallH - h;
    // Brushed steel elevator portal
    roundRect(ctx, x, y, w, h, 2);
    ctx.fillStyle = "#1e293b"; ctx.fill();
    ctx.strokeStyle = "#64748b"; ctx.lineWidth = 1.2; ctx.stroke();
    const g = ctx.createLinearGradient(x, y, x + w, y);
    g.addColorStop(0, "#475569"); g.addColorStop(0.5, "#64748b"); g.addColorStop(1, "#475569");
    ctx.fillStyle = g;
    ctx.fillRect(x + 3, y + 10, w - 6, h - 10);
    // Center seam + metallic sheen
    ctx.strokeStyle = "#1e293b"; ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.moveTo(x + w / 2, y + 10); ctx.lineTo(x + w / 2, y + h); ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.fillRect(x + 5, y + 11, 5, h - 12);
    // Digital floor display header
    roundRect(ctx, x + 6, y + 2.5, w - 12, 6, 2);
    ctx.fillStyle = "#090d16"; ctx.fill();
    ctx.fillStyle = hasSync ? "#38bdf8" : "#fde047";
    ctx.font = "800 6.5px ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.fillText(floorLabel, x + w / 2, y + 7.5);
    // Call button panel on left of elevator
    ctx.fillStyle = "#334155";
    ctx.fillRect(x - 6, y + 28, 4, 10);
    ctx.fillStyle = hasSync ? "#38bdf8" : "#94a3b8";
    ctx.fillRect(x - 5, y + 30, 2, 2);
    ctx.fillRect(x - 5, y + 34, 2, 2);

    if (hasSync) {
      ctx.font = "700 8.5px -apple-system, 'PingFang SC', sans-serif";
      const lbl = lang === "zh" ? "⇄协同" : "⇄Sync";
      roundRect(ctx, x - 4, y - 12, w + 8, 12, 4);
      ctx.fillStyle = "rgba(14, 116, 144, 0.94)"; ctx.fill();
      ctx.fillStyle = "#e0f2fe";
      ctx.textAlign = "center";
      ctx.fillText(lbl, x + w / 2, y - 3.5);
    }
  }

  function drawOfficeProp(ctx, x, wallH, kind, accent) {
    if (kind === "whiteboard") {
      // Classic tech-office glass/magnetic whiteboard with flowchart & marker tray
      const y = wallH - 52;
      roundRect(ctx, x, y, 64, 36, 2);
      ctx.fillStyle = "#f1f5f9"; ctx.fill();
      ctx.strokeStyle = "#94a3b8"; ctx.lineWidth = 1.6; ctx.stroke();
      // Drawn architecture boxes + arrows + sticky notes
      ctx.strokeStyle = "#3b82f6"; ctx.lineWidth = 1.1;
      ctx.strokeRect(x + 7, y + 7, 15, 9);
      ctx.strokeRect(x + 30, y + 7, 15, 9);
      ctx.beginPath(); ctx.moveTo(x + 22, y + 11.5); ctx.lineTo(x + 30, y + 11.5); ctx.stroke();
      ctx.strokeStyle = "#10b981";
      ctx.strokeRect(x + 19, y + 21, 18, 8);
      ctx.fillStyle = "#fde047"; ctx.fillRect(x + 50, y + 6, 8, 7);
      ctx.fillStyle = "#fda4af"; ctx.fillRect(x + 50, y + 15, 8, 7);
      // Aluminum marker tray
      ctx.fillStyle = "#64748b"; ctx.fillRect(x + 6, y + 36, 52, 2.5);
      ctx.fillStyle = "#ef4444"; ctx.fillRect(x + 12, y + 34.5, 6, 1.8);
      ctx.fillStyle = "#3b82f6"; ctx.fillRect(x + 20, y + 34.5, 6, 1.8);
    } else if (kind === "cooler") {
      // Iconic office water cooler with translucent blue 5-gallon water jug!
      const y = wallH;
      ctx.fillStyle = "rgba(0,0,0,0.28)";
      ctx.beginPath(); ctx.ellipse(x + 9, y + 4, 11, 3.5, 0, 0, Math.PI * 2); ctx.fill();
      // White dispenser body
      roundRect(ctx, x, y - 24, 18, 28, 2);
      ctx.fillStyle = "#e2e8f0"; ctx.fill();
      ctx.strokeStyle = "#475569"; ctx.lineWidth = 1; ctx.stroke();
      // Drip recess + hot/cold spigots
      ctx.fillStyle = "#94a3b8"; ctx.fillRect(x + 3, y - 18, 12, 8);
      ctx.fillStyle = "#ef4444"; ctx.fillRect(x + 5, y - 16, 2.5, 2.5);
      ctx.fillStyle = "#38bdf8"; ctx.fillRect(x + 10.5, y - 16, 2.5, 2.5);
      // Blue 5-gallon water jug on top
      roundRect(ctx, x + 2, y - 42, 14, 18, 4);
      ctx.fillStyle = "rgba(56, 189, 248, 0.55)"; ctx.fill();
      ctx.strokeStyle = "#7dd3fc"; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = "rgba(224, 242, 254, 0.45)";
      ctx.fillRect(x + 4, y - 38, 3, 10);
    } else if (kind === "cabinet") {
      // Office steel filing cabinet + compact office printer on top
      const y = wallH;
      ctx.fillStyle = "rgba(0,0,0,0.28)";
      ctx.beginPath(); ctx.ellipse(x + 17, y + 4, 18, 4, 0, 0, Math.PI * 2); ctx.fill();
      roundRect(ctx, x, y - 24, 34, 28, 2);
      ctx.fillStyle = "#475569"; ctx.fill();
      ctx.strokeStyle = "#1e293b"; ctx.lineWidth = 1; ctx.stroke();
      // Two drawers + metallic handles
      ctx.strokeStyle = "#334155";
      ctx.strokeRect(x + 3, y - 21, 28, 10);
      ctx.strokeRect(x + 3, y - 9, 28, 10);
      ctx.fillStyle = "#cbd5e1";
      ctx.fillRect(x + 13, y - 17, 8, 2);
      ctx.fillRect(x + 13, y - 5, 8, 2);
      // Office printer on top with white paper tray
      roundRect(ctx, x + 4, y - 35, 26, 11, 2);
      ctx.fillStyle = "#cbd5e1"; ctx.fill();
      ctx.fillStyle = "#334155"; ctx.fillRect(x + 7, y - 32, 20, 4);
      ctx.fillStyle = "#f8fafc"; ctx.fillRect(x + 10, y - 39, 14, 5);
      ctx.fillStyle = "#22c55e"; ctx.fillRect(x + 25, y - 31, 2.5, 2);
    } else if (kind === "bookshelf") {
      // Tall modern oak office shelf with colorful binders & files
      const y = wallH;
      roundRect(ctx, x, y - 48, 42, 50, 2);
      ctx.fillStyle = "#6e4c32"; ctx.fill();
      ctx.strokeStyle = "#3b2416"; ctx.lineWidth = 1.2; ctx.stroke();
      const cols = ["#f59e0b", "#38bdf8", "#a78bfa", "#34d399", "#fb7185", "#e2e8f0"];
      for (let row = 0; row < 3; row++) {
        const sy = y - 44 + row * 15;
        ctx.fillStyle = "#2a1b11"; ctx.fillRect(x + 3, sy, 36, 12);
        for (let b = 0; b < 6; b++) {
          ctx.fillStyle = cols[(row * 2 + b) % cols.length];
          ctx.fillRect(x + 4.5 + b * 5.6, sy + 2, 4.2, 10);
        }
      }
    } else if (kind === "clock") {
      const cy = wallH - 44;
      ctx.fillStyle = "#f8fafc";
      ctx.beginPath(); ctx.arc(x, cy, 8, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#475569"; ctx.lineWidth = 1.8; ctx.stroke();
      ctx.strokeStyle = "#0f172a"; ctx.lineWidth = 1.3;
      ctx.beginPath(); ctx.moveTo(x, cy); ctx.lineTo(x, cy - 4.5);
      ctx.moveTo(x, cy); ctx.lineTo(x + 3.5, cy + 1.5); ctx.stroke();
    }
  }

  function drawPottedPlant(ctx, cx, groundY, scale = 1) {
    ctx.save();
    ctx.translate(cx, groundY);
    ctx.scale(scale, scale);
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.beginPath(); ctx.ellipse(0, 2, 12, 4, 0, 0, Math.PI * 2); ctx.fill();
    // Modern matte ceramic planter
    ctx.fillStyle = "#e2e8f0";
    ctx.beginPath();
    ctx.moveTo(-7.5, -14); ctx.lineTo(7.5, -14); ctx.lineTo(6, 1); ctx.lineTo(-6, 1);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "#475569"; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = "#5c3a21";
    ctx.fillRect(-6, -15, 12, 2.5);
    // Lush office fiddle-leaf fig leaves
    const leaves = [[-7, -25, -0.45, "#15803d"], [7, -24, 0.45, "#16a34a"], [0, -31, 0, "#22c55e"], [-10, -19, -0.75, "#166534"], [9, -19, 0.72, "#15803d"]];
    for (const [lx, ly, rot, col] of leaves) {
      ctx.save(); ctx.translate(lx, ly); ctx.rotate(rot);
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.ellipse(0, 0, 4.6, 9, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "rgba(11,17,32,0.45)"; ctx.lineWidth = 0.8; ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }

  window.OFFICE_ENG_STYLES = ENG_STYLES;
  window.OfficeArch = {
    ENG_STYLES, FLOOR_THEMES, ROSE, INK, engStyle, hashStr, trimText, roundRect,
    fmtDur, isStalled, drawBuildingShell, drawBuildingColumns, drawCeilingLightBar,
    drawWoodSlats, drawCurtainWallWindow, drawOfficeFloor, drawElevatorLobby,
    drawOfficeProp, drawPottedPlant,
  };
})();
