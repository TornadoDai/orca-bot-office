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

  window.OFFICE_ENG_STYLES = ENG_STYLES;
  window.OfficeArch = {
    ENG_STYLES, TEAM_TINTS, ROSE, INK, engStyle, hashStr, trimText, roundRect,
    fmtDur, isStalled, drawTwoSliceBackdrop, drawGlassPartitionOverlay, drawFloorElevatorBadge,
  };
})();
