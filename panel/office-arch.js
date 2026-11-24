/**
 * Real-Illustrated Office Building Backdrop Compositor (2-Slice Wall + Floor Plate Renderer)
 * - Loads tiny pre-rendered cozy modern 2.5D office plates (bg-queue / bg-studio / bg-lounge)
 * - Splits upper wall (0..46%) and lower open floor (46%..100%) so multi-row floors expand with ZERO distortion
 * - Renders once into offscreen bgCanvas cache -> 0.0% runtime CPU/GPU cost!
 */
(function () {
  const ENG_STYLES = {
    claude: { key: "claude", label: "Claude", short: "Claude", sym: "✦", color: "#f59e0b", light: "#fef3c7", bg: "#2b1b0a", border: "rgba(245,158,11,0.72)", coatTop: "#d97706", coatBot: "#92400e", trim: "#fbbf24" },
    antigravity: { key: "antigravity", label: "Antigravity", short: "agy", sym: "◈", color: "#38bdf8", light: "#e0f2fe", bg: "#0a2236", border: "rgba(56,189,248,0.72)", coatTop: "#0ea5e9", coatBot: "#0369a1", trim: "#7dd3fc" },
    codex: { key: "codex", label: "Codex", short: "Codex", sym: "⬡", color: "#a78bfa", light: "#ede9fe", bg: "#1e1536", border: "rgba(167,139,250,0.72)", coatTop: "#8b5cf6", coatBot: "#5b21b6", trim: "#c4b5fd" },
    pi: { key: "pi", label: "Pi", short: "Pi", sym: "π", color: "#34d399", light: "#d1fae5", bg: "#0a2921", border: "rgba(52,211,153,0.72)", coatTop: "#10b981", coatBot: "#047857", trim: "#6ee7b7" },
    other: { key: "other", label: "Agent", short: "Agent", sym: "•", color: "#94a3b8", light: "#e2e8f0", bg: "#1e293b", border: "rgba(148,163,184,0.48)", coatTop: "#64748b", coatBot: "#334155", trim: "#cbd5e1" },
  };

  // Subtle ambient mood tints so multiple team floors stay distinct yet cohesive
  const TEAM_TINTS = [
    { tint: "rgba(56, 189, 248, 0.05)", accent: "#38bdf8", rug: "rgba(15, 23, 42, 0.22)" },
    { tint: "rgba(167, 139, 250, 0.06)", accent: "#a78bfa", rug: "rgba(30, 20, 48, 0.22)" },
    { tint: "rgba(52, 211, 153, 0.05)", accent: "#34d399", rug: "rgba(12, 34, 30, 0.22)" },
    { tint: "rgba(251, 191, 36, 0.05)", accent: "#fbbf24", rug: "rgba(42, 28, 16, 0.22)" },
  ];

  const ROSE = {
    dot: "#fb7185",
    stroke: "#fda4af",
    tint: "rgba(244, 63, 94, 0.14)",
    border: "rgba(251, 113, 133, 0.54)",
    text: "#ffe4e6",
    bubbleBg: "rgba(34, 17, 26, 0.94)",
  };

  const INK = "#18141c";

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

  /* ── 2-Slice Illustrated Office Plate Compositor ── */

  function drawTwoSliceBackdrop(ctx, img, W, wallH, H, splitRatio = 0.57, fallbackWall = "#2c3442", fallbackFloor = "#272424") {
    if (img && img.complete && img.naturalWidth > 0) {
      const iw = img.naturalWidth;
      const ih = img.naturalHeight;
      const wallSrcH = Math.round(ih * splitRatio);
      const floorSrcH = ih - wallSrcH;

      // Full-width crisp cutaway wall (preserves elevator on right & glass office on left!)
      ctx.drawImage(img, 0, 0, iw, wallSrcH, 0, 0, W, wallH);
      // Lower open floor stretches smoothly down to any multi-row height H with ZERO wall distortion
      ctx.drawImage(img, 0, wallSrcH, iw, floorSrcH, 0, wallH, W, H - wallH);

      // Subtle architectural lighting vignette so foreground desks & human characters ground naturally
      const topShade = ctx.createLinearGradient(0, 0, 0, 14);
      topShade.addColorStop(0, "rgba(10, 14, 24, 0.45)");
      topShade.addColorStop(1, "rgba(10, 14, 24, 0)");
      ctx.fillStyle = topShade;
      ctx.fillRect(0, 0, W, 14);

      const floorShade = ctx.createLinearGradient(0, wallH, 0, H);
      floorShade.addColorStop(0, "rgba(10, 14, 22, 0.06)");
      floorShade.addColorStop(1, "rgba(10, 14, 22, 0.24)");
      ctx.fillStyle = floorShade;
      ctx.fillRect(0, wallH, W, H - wallH);
    } else {
      // Graceful instant warm fallback while image decodes
      const wg = ctx.createLinearGradient(0, 0, 0, wallH);
      wg.addColorStop(0, fallbackWall); wg.addColorStop(1, "#394152");
      ctx.fillStyle = wg; ctx.fillRect(0, 0, W, wallH);
      const fg = ctx.createLinearGradient(0, wallH, 0, H);
      fg.addColorStop(0, fallbackFloor); fg.addColorStop(1, "#1f1d1f");
      ctx.fillStyle = fg; ctx.fillRect(0, wallH, W, H - wallH);
    }

    // Subtle architectural slab framing at left, right & top
    ctx.fillStyle = "rgba(15, 20, 30, 0.72)";
    ctx.fillRect(0, 0, W, 4);
    ctx.fillRect(0, 0, 5, H);
    ctx.fillRect(W - 5, 0, 5, H);
    ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
    ctx.fillRect(5, 4, W - 10, 1);
  }

  function drawGlassPartitionOverlay(ctx, px, wallH, H) {
    // Sleek translucent architectural glass divider separating Lead office & Team bay
    const g = ctx.createLinearGradient(px - 2, 0, px + 6, 0);
    g.addColorStop(0, "rgba(15, 23, 42, 0.5)");
    g.addColorStop(0.35, "rgba(224, 242, 254, 0.24)");
    g.addColorStop(0.65, "rgba(186, 230, 253, 0.12)");
    g.addColorStop(1, "rgba(15, 23, 42, 0.45)");
    ctx.fillStyle = g;
    ctx.fillRect(px, 6, 5, H - 10);
    ctx.fillStyle = "rgba(255, 255, 255, 0.32)";
    ctx.fillRect(px + 1, wallH - 22, 3, 18);
    ctx.fillStyle = "#e2e8f0";
    ctx.fillRect(px + 1.5, wallH + 6, 2, 11);
  }

  function drawFloorElevatorBadge(ctx, W, wallH, floorLabel, hasSync, lang) {
    // Subtle digital floor sign near right-side elevator
    const bx = W - 44;
    const by = 10;
    roundRect(ctx, bx, by, 32, 13, 3);
    ctx.fillStyle = "rgba(12, 17, 28, 0.84)"; ctx.fill();
    ctx.strokeStyle = hasSync ? "rgba(56, 189, 248, 0.72)" : "rgba(251, 191, 36, 0.45)";
    ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = hasSync ? "#7dd3fc" : "#fde68a";
    ctx.font = "800 8px ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.fillText(floorLabel, bx + 16, by + 9.5);

    if (hasSync) {
      const lbl = lang === "zh" ? "⇄协同" : "⇄Sync";
      ctx.font = "700 8.5px -apple-system, 'PingFang SC', sans-serif";
      roundRect(ctx, bx - 6, by + 16, 44, 13, 4);
      ctx.fillStyle = "rgba(14, 116, 144, 0.92)"; ctx.fill();
      ctx.fillStyle = "#e0f2fe";
      ctx.fillText(lbl, bx + 16, by + 25.2);
    }
  }

  /* ── Executive Briefing Suite Decor (Baked once into offscreen bgCanvas -> 0% CPU!) ── */

  function drawDecisionFloorDecor(ctx, W, wallH, H) {
    ctx.save();
    // 1) Warm ceiling recessed spotlight cones over the center desk & briefing walkway
    const spot = ctx.createRadialGradient(W / 2, 10, 8, W / 2, wallH + 38, Math.min(230, W * 0.36));
    spot.addColorStop(0, "rgba(255, 243, 214, 0.14)");
    spot.addColorStop(0.6, "rgba(255, 232, 186, 0.05)");
    spot.addColorStop(1, "rgba(255, 232, 186, 0)");
    ctx.fillStyle = spot;
    ctx.fillRect(0, 4, W, wallH + 90);

    // 2) Executive woven navy-and-brass area rug grounding the center walnut desk
    const rugW = Math.min(268, Math.max(180, W * 0.4));
    const rugH = 44;
    const rx = Math.round((W - rugW) / 2);
    const ry = wallH + 8;
    ctx.fillStyle = "rgba(0, 0, 0, 0.22)";
    roundRect(ctx, rx + 2, ry + 3, rugW, rugH, 6); ctx.fill();
    const rg = ctx.createLinearGradient(rx, ry, rx, ry + rugH);
    rg.addColorStop(0, "rgba(30, 41, 66, 0.86)");
    rg.addColorStop(1, "rgba(20, 28, 48, 0.92)");
    roundRect(ctx, rx, ry, rugW, rugH, 6);
    ctx.fillStyle = rg; ctx.fill();
    ctx.strokeStyle = "rgba(217, 169, 98, 0.55)"; ctx.lineWidth = 1.4; ctx.stroke();
    roundRect(ctx, rx + 5, ry + 4.5, rugW - 10, rugH - 9, 3.5);
    ctx.strokeStyle = "rgba(245, 208, 138, 0.32)"; ctx.lineWidth = 0.9; ctx.stroke();

    // 3) Upper-left corner: tall indoor monstera plant + cozy waiting armchair & brass side table
    if (W >= 420) {
      // Ceramic planter & leafy indoor tree (far left)
      const px = 30, py = wallH + 16;
      ctx.fillStyle = "rgba(0,0,0,0.32)";
      ctx.beginPath(); ctx.ellipse(px, py + 12, 12, 4, 0, 0, Math.PI * 2); ctx.fill();
      const potG = ctx.createLinearGradient(px - 8, py - 2, px + 8, py + 12);
      potG.addColorStop(0, "#e7e0d2"); potG.addColorStop(1, "#a89f8d");
      roundRect(ctx, px - 8, py - 2, 16, 14, 3);
      ctx.fillStyle = potG; ctx.fill();
      ctx.strokeStyle = INK; ctx.lineWidth = 1.1; ctx.stroke();
      ctx.strokeStyle = "#3f2e21"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(px, py - 2); ctx.lineTo(px, py - 22); ctx.stroke();
      const leaves = [
        [-8, -19, 8.5, 5, -0.45, "#2f855a"],
        [8, -21, 8.5, 5, 0.4, "#276749"],
        [-6, -29, 7.5, 4.5, -0.3, "#38a169"],
        [6, -30, 7.5, 4.5, 0.35, "#2f855a"],
        [0, -34, 7, 5, 0, "#48bb78"],
      ];
      for (const [dx, dy, lr1, lr2, rot, col] of leaves) {
        ctx.fillStyle = col; ctx.strokeStyle = "#163b2a"; ctx.lineWidth = 0.9;
        ctx.beginPath(); ctx.ellipse(px + dx, py + dy, lr1, lr2, rot, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }

      // Cozy caramel-leather lounge waiting chair + mini brass side table
      const ax = 76, ay = wallH + 18;
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.beginPath(); ctx.ellipse(ax, ay + 12, 20, 5.5, 0, 0, Math.PI * 2); ctx.fill();
      const chBack = ctx.createLinearGradient(0, ay - 14, 0, ay + 6);
      chBack.addColorStop(0, "#b46238"); chBack.addColorStop(1, "#72361a");
      roundRect(ctx, ax - 15, ay - 14, 30, 18, 6);
      ctx.fillStyle = chBack; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.stroke();
      roundRect(ctx, ax - 13, ay + 1, 26, 9, 3.5);
      ctx.fillStyle = "#c97445"; ctx.fill(); ctx.stroke();
      roundRect(ctx, ax - 18, ay - 6, 6, 15, 2.5); ctx.fillStyle = chBack; ctx.fill(); ctx.stroke();
      roundRect(ctx, ax + 12, ay - 6, 6, 15, 2.5); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#3b2314";
      ctx.fillRect(ax - 14, ay + 9, 3, 4); ctx.fillRect(ax + 11, ay + 9, 3, 4);

      // Small round walnut & brass coffee table with teacup
      const tx = 114, ty = wallH + 22;
      ctx.fillStyle = "rgba(0,0,0,0.26)";
      ctx.beginPath(); ctx.ellipse(tx, ty + 7, 11, 3.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#b58b4c"; ctx.fillRect(tx - 1.2, ty - 2, 2.4, 9);
      ctx.beginPath(); ctx.ellipse(tx, ty - 3, 11, 4.5, 0, 0, Math.PI * 2);
      ctx.fillStyle = "#8c5b34"; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.stroke();
      // White teacup on saucer
      ctx.fillStyle = "#f8fafc";
      roundRect(ctx, tx - 3, ty - 7.5, 5.5, 4.2, 1.2); ctx.fill();
      ctx.strokeStyle = INK; ctx.lineWidth = 0.7; ctx.stroke();
    }

    // 4) Upper-right executive walnut credenza with glowing ambient lamp & brass trophy (left of elevator plant)
    if (W >= 460) {
      const cx = W - 166, cy = wallH + 4;
      const cw = 68, ch = 22;
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.beginPath(); ctx.ellipse(cx + cw / 2, cy + ch + 3, cw * 0.52, 4.5, 0, 0, Math.PI * 2); ctx.fill();
      const cg = ctx.createLinearGradient(0, cy, 0, cy + ch);
      cg.addColorStop(0, "#754829"); cg.addColorStop(1, "#452815");
      roundRect(ctx, cx, cy, cw, ch, 3);
      ctx.fillStyle = cg; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.stroke();
      // Top bevel & 3 cabinet doors with brass knobs
      ctx.fillStyle = "#a36c40"; ctx.fillRect(cx + 2, cy + 1, cw - 4, 3);
      ctx.strokeStyle = "rgba(0,0,0,0.35)"; ctx.lineWidth = 0.9;
      ctx.beginPath(); ctx.moveTo(cx + cw / 3, cy + 5); ctx.lineTo(cx + cw / 3, cy + ch - 2);
      ctx.moveTo(cx + (cw * 2) / 3, cy + 5); ctx.lineTo(cx + (cw * 2) / 3, cy + ch - 2); ctx.stroke();
      ctx.fillStyle = "#fbbf24";
      [cx + cw / 6, cx + cw / 2, cx + (cw * 5) / 6].forEach((kx) => {
        ctx.beginPath(); ctx.arc(kx, cy + 12, 1.3, 0, Math.PI * 2); ctx.fill();
      });
      // Warm table lamp on credenza left
      const lx = cx + 15, ly = cy;
      const lg = ctx.createRadialGradient(lx, ly - 10, 2, lx, ly - 6, 20);
      lg.addColorStop(0, "rgba(254, 240, 138, 0.36)"); lg.addColorStop(1, "rgba(254, 240, 138, 0)");
      ctx.fillStyle = lg; ctx.beginPath(); ctx.arc(lx, ly - 8, 20, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#d97706"; ctx.fillRect(lx - 1.5, ly - 8, 3, 8);
      ctx.beginPath(); ctx.moveTo(lx - 7, ly - 7); ctx.lineTo(lx - 4.5, ly - 16); ctx.lineTo(lx + 4.5, ly - 16); ctx.lineTo(lx + 7, ly - 7); ctx.closePath();
      ctx.fillStyle = "#fef3c7"; ctx.fill(); ctx.strokeStyle = "#b45309"; ctx.lineWidth = 0.9; ctx.stroke();
      // Books & small brass award on credenza right
      ctx.fillStyle = "#38bdf8"; ctx.fillRect(cx + 34, cy - 8, 3.5, 8);
      ctx.fillStyle = "#fb7185"; ctx.fillRect(cx + 38, cy - 9.5, 3.5, 9.5);
      ctx.fillStyle = "#f59e0b"; ctx.fillRect(cx + 42, cy - 7, 3.5, 7);
      // Tiny gold trophy
      ctx.fillStyle = "#fbbf24"; ctx.strokeStyle = "#92400e"; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.arc(cx + 55, cy - 7, 3.5, 0, Math.PI, false); ctx.fill(); ctx.stroke();
      ctx.fillRect(cx + 54, cy - 3.5, 2, 3.5); ctx.fillRect(cx + 52, cy - 1, 6, 1.5);
    }

    // 5) Subtle warm brass floor trim line separating desk zone & briefing queue zone
    const lineY = wallH + 59;
    const lgLine = ctx.createLinearGradient(W * 0.16, lineY, W * 0.84, lineY);
    lgLine.addColorStop(0, "rgba(217, 169, 98, 0)");
    lgLine.addColorStop(0.5, "rgba(245, 208, 138, 0.36)");
    lgLine.addColorStop(1, "rgba(217, 169, 98, 0)");
    ctx.strokeStyle = lgLine; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(W * 0.16, lineY); ctx.lineTo(W * 0.84, lineY); ctx.stroke();
    ctx.restore();
  }

  /* ── Live Real-Time Analog Wall Clock over TOP Floor Center Pillar (True 1:1 Circle!) ── */

  function drawLiveWallClock(ctx, W, wallH) {
    const cx = W * 0.4996;
    const cy = wallH * 0.41;
    // Perfect circular radius large enough to cleanly cover the painted oval while sitting well above the chair
    const R = Math.min(21, Math.max(14, W * 0.0305));

    const now = new Date();
    const sec = now.getSeconds();
    const min = now.getMinutes() + sec / 60;
    const hr = (now.getHours() % 12) + min / 60;

    ctx.save();
    ctx.translate(cx, cy);
    // Soft wall drop shadow
    ctx.fillStyle = "rgba(0, 0, 0, 0.36)";
    ctx.beginPath(); ctx.arc(0.8, 2, R + 2.2, 0, Math.PI * 2); ctx.fill();

    // Outer espresso-bronze round clock bezel
    const rimG = ctx.createLinearGradient(0, -R - 2, 0, R + 2);
    rimG.addColorStop(0, "#6b5544"); rimG.addColorStop(1, "#261d17");
    ctx.fillStyle = rimG;
    ctx.beginPath(); ctx.arc(0, 0, R + 2.2, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.stroke();

    // Cream porcelain circular clock dial
    const dialG = ctx.createRadialGradient(-R * 0.25, -R * 0.25, 1, 0, 0, R);
    dialG.addColorStop(0, "#fffdf8");
    dialG.addColorStop(0.85, "#efe8da");
    dialG.addColorStop(1, "#d8cebc");
    ctx.fillStyle = dialG;
    ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "rgba(120, 96, 72, 0.45)"; ctx.lineWidth = 0.8; ctx.stroke();

    // 12 crisp hour markers (thicker at 12, 3, 6, 9)
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6;
      const major = i % 3 === 0;
      const r1 = R * (major ? 0.72 : 0.8);
      const r2 = R * 0.91;
      ctx.strokeStyle = major ? "#1e293b" : "#64748b";
      ctx.lineWidth = major ? 1.5 : 0.85;
      ctx.beginPath();
      ctx.moveTo(Math.sin(a) * r1, -Math.cos(a) * r1);
      ctx.lineTo(Math.sin(a) * r2, -Math.cos(a) * r2);
      ctx.stroke();
    }

    // Real-time Hour Hand
    const ha = (hr * Math.PI) / 6;
    ctx.strokeStyle = "#18141c"; ctx.lineWidth = 2.1; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.sin(ha) * R * 0.5, -Math.cos(ha) * R * 0.5); ctx.stroke();

    // Real-time Minute Hand
    const ma = (min * Math.PI) / 30;
    ctx.strokeStyle = "#1e293b"; ctx.lineWidth = 1.4; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.sin(ma) * R * 0.75, -Math.cos(ma) * R * 0.75); ctx.stroke();

    // Real-time Subtle Crimson Second Hand
    const sa = (sec * Math.PI) / 30;
    ctx.strokeStyle = "#e11d48"; ctx.lineWidth = 0.85; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(-Math.sin(sa) * R * 0.16, Math.cos(sa) * R * 0.16);
    ctx.lineTo(Math.sin(sa) * R * 0.82, -Math.cos(sa) * R * 0.82); ctx.stroke();

    // Brass center pin
    ctx.fillStyle = "#b45309";
    ctx.beginPath(); ctx.arc(0, 0, 1.7, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  window.OFFICE_ENG_STYLES = ENG_STYLES;
  window.OfficeArch = {
    ENG_STYLES, TEAM_TINTS, ROSE, INK, engStyle, hashStr, trimText, roundRect,
    fmtDur, isStalled, drawTwoSliceBackdrop, drawGlassPartitionOverlay, drawFloorElevatorBadge,
    drawDecisionFloorDecor, drawLiveWallClock,
  };
})();
