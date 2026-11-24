/**
 * Built-In Illustrated Preset Avatars for the TOP Floor Executive Chair
 * + Sleek Recruiting Reception Front Desk (+ Hire / + 招新)
 * - Shared single source of truth used by BOTH the live floor canvas AND the modal preview cards!
 */
(function () {
  const { INK, roundRect } = window.OfficeArch;

  const PRESET_LIST = [
    { id: "empty", zh: "空椅隐形", en: "Empty Chair" },
    { id: "silhouette", zh: "极淡剪影", en: "Silhouette" },
    { id: "preset:exec-m", zh: "西装主管", en: "Exec Lead" },
    { id: "preset:exec-f", zh: "知性总监", en: "Director" },
    { id: "preset:hoodie", zh: "极客卫衣", en: "Dev Hoodie" },
    { id: "preset:cat", zh: "橘猫总监", en: "Cat Boss" },
    { id: "preset:shiba", zh: "墨镜柴犬", en: "Shiba Boss" },
    { id: "preset:astro", zh: "太空指挥官", en: "Commander" },
    { id: "preset:robot", zh: "核心机甲", en: "AI Core" },
    { id: "custom", zh: "上传图片", en: "Custom Image" },
  ];

  function drawPresetFigure(ctx, cx, deskTopY, presetId, phase = 0) {
    const bob = Math.sin(phase * 0.85) * 0.5;
    const ty = deskTopY + bob;

    if (presetId === "silhouette") {
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = "#64748b";
      roundRect(ctx, cx - 15, ty - 18, 30, 20, 9); ctx.fill();
      ctx.beginPath(); ctx.arc(cx, ty - 31, 10.5, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      return;
    }

    const coatColors = {
      "preset:exec-m": ["#1e3a5f", "#0f172a", "#e11d48"],
      "preset:exec-f": ["#881337", "#4c0519", "#fef3c7"],
      "preset:hoodie": ["#0369a1", "#0c4a6e", "#38bdf8"],
      "preset:cat": ["#334155", "#1e293b", "#f43f5e"],
      "preset:shiba": ["#1f2937", "#111827", "#f59e0b"],
      "preset:astro": ["#e2e8f0", "#94a3b8", "#0ea5e9"],
      "preset:robot": ["#1e293b", "#0f172a", "#14b8a6"],
    };
    const [cTop, cBot, accent] = coatColors[presetId] || ["#334155", "#1e293b", "#38bdf8"];

    ctx.save();
    // Shoulders & tailored torso
    const tg = ctx.createLinearGradient(cx, ty - 20, cx, ty + 2);
    tg.addColorStop(0, cTop); tg.addColorStop(1, cBot);
    roundRect(ctx, cx - 17, ty - 19, 34, 22, 9);
    ctx.fillStyle = tg; ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 1.4; ctx.stroke();

    // Collar / Tie / Bowtie / Hoodie strings
    if (presetId === "preset:exec-m" || presetId === "preset:shiba") {
      ctx.fillStyle = "#f8fafc";
      ctx.beginPath(); ctx.moveTo(cx - 5, ty - 19); ctx.lineTo(cx, ty - 11); ctx.lineTo(cx + 5, ty - 19); ctx.closePath(); ctx.fill();
      ctx.fillStyle = accent;
      ctx.beginPath(); ctx.moveTo(cx - 1.8, ty - 16); ctx.lineTo(cx + 1.8, ty - 16); ctx.lineTo(cx + 2.4, ty - 5); ctx.lineTo(cx, ty - 2); ctx.lineTo(cx - 2.4, ty - 5); ctx.closePath(); ctx.fill();
    } else if (presetId === "preset:exec-f") {
      ctx.fillStyle = "#fff1f2";
      ctx.beginPath(); ctx.moveTo(cx - 6, ty - 19); ctx.lineTo(cx, ty - 10); ctx.lineTo(cx + 6, ty - 19); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#fde68a";
      ctx.beginPath(); ctx.arc(cx, ty - 12, 1.8, 0, Math.PI * 2); ctx.fill();
    } else if (presetId === "preset:hoodie") {
      ctx.strokeStyle = "#e0f2fe"; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(cx - 4, ty - 16); ctx.lineTo(cx - 4, ty - 7); ctx.moveTo(cx + 4, ty - 16); ctx.lineTo(cx + 4, ty - 7); ctx.stroke();
    } else if (presetId === "preset:cat") {
      // Cute red bowtie
      ctx.fillStyle = accent;
      ctx.beginPath(); ctx.moveTo(cx, ty - 15); ctx.lineTo(cx - 6, ty - 18); ctx.lineTo(cx - 6, ty - 12); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(cx, ty - 15); ctx.lineTo(cx + 6, ty - 18); ctx.lineTo(cx + 6, ty - 12); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#ffe4e6"; ctx.beginPath(); ctx.arc(cx, ty - 15, 1.6, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.fillStyle = accent;
      roundRect(ctx, cx - 6, ty - 14, 12, 4, 2); ctx.fill();
    }

    // Head at (cx, hy)
    const hy = ty - 32;
    const r = 13;

    if (presetId === "preset:exec-m" || presetId === "preset:exec-f" || presetId === "preset:hoodie") {
      // Back hair for exec-f
      if (presetId === "preset:exec-f") {
        ctx.fillStyle = "#3b2314"; ctx.strokeStyle = INK; ctx.lineWidth = 1.3;
        roundRect(ctx, cx - r - 2.5, hy - 8, (r + 2.5) * 2, 23, 8); ctx.fill(); ctx.stroke();
      }
      // Face
      const fg = ctx.createRadialGradient(cx - 3, hy - 4, 2, cx, hy, r);
      fg.addColorStop(0, "#ffe4cc"); fg.addColorStop(1, "#e6b38c");
      ctx.fillStyle = fg; ctx.strokeStyle = INK; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(cx, hy, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      // Eyes & smile
      ctx.fillStyle = "#18141c";
      ctx.beginPath(); ctx.arc(cx - 4.5, hy + 1, 1.8, 0, Math.PI * 2); ctx.arc(cx + 4.5, hy + 1, 1.8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.beginPath(); ctx.arc(cx - 5, hy + 0.3, 0.7, 0, Math.PI * 2); ctx.arc(cx + 4, hy + 0.3, 0.7, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#9a5b44"; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(cx, hy + 5, 2.5, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
      // Hair
      ctx.fillStyle = presetId === "preset:exec-f" ? "#3b2314" : presetId === "preset:hoodie" ? "#1e293b" : "#27272a";
      ctx.strokeStyle = INK; ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.arc(cx, hy - 2.5, r + 1, Math.PI * 0.96, Math.PI * 0.04);
      ctx.quadraticCurveTo(cx, hy - 8, cx - r - 1, hy - 2);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      // Accessories: glasses (exec-m) or studio headphones (hoodie)
      if (presetId === "preset:exec-m") {
        ctx.strokeStyle = "#334155"; ctx.lineWidth = 1.2;
        roundRect(ctx, cx - 8.5, hy - 1.5, 6.8, 5, 1.5); ctx.stroke();
        roundRect(ctx, cx + 1.7, hy - 1.5, 6.8, 5, 1.5); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx - 1.7, hy + 0.8); ctx.lineTo(cx + 1.7, hy + 0.8); ctx.stroke();
      } else if (presetId === "preset:hoodie") {
        ctx.strokeStyle = "#38bdf8"; ctx.lineWidth = 2.3;
        ctx.beginPath(); ctx.arc(cx, hy - 2, r + 2, Math.PI * 1.08, Math.PI * 1.92); ctx.stroke();
        ctx.fillStyle = "#0ea5e9"; ctx.strokeStyle = INK; ctx.lineWidth = 1.1;
        roundRect(ctx, cx - r - 4, hy - 4, 4.5, 9, 2); ctx.fill(); ctx.stroke();
        roundRect(ctx, cx + r - 0.5, hy - 4, 4.5, 9, 2); ctx.fill(); ctx.stroke();
      }
    } else if (presetId === "preset:cat") {
      // Ginger Cat Boss!
      ctx.fillStyle = "#f59e0b"; ctx.strokeStyle = INK; ctx.lineWidth = 1.3;
      // Pointy cat ears
      ctx.beginPath(); ctx.moveTo(cx - 11, hy - 5); ctx.lineTo(cx - 12, hy - 17); ctx.lineTo(cx - 3, hy - 11); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx + 11, hy - 5); ctx.lineTo(cx + 12, hy - 17); ctx.lineTo(cx + 3, hy - 11); ctx.closePath(); ctx.fill(); ctx.stroke();
      // Round cat head
      const cg = ctx.createRadialGradient(cx - 2, hy - 3, 2, cx, hy, r);
      cg.addColorStop(0, "#fcd34d"); cg.addColorStop(1, "#d97706");
      ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(cx, hy, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      // Cream muzzle & tabby forehead stripes
      ctx.fillStyle = "#fffbeb"; ctx.beginPath(); ctx.ellipse(cx, hy + 4.5, 6.5, 4.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#92400e"; ctx.lineWidth = 1.3;
      ctx.beginPath(); ctx.moveTo(cx, hy - 12); ctx.lineTo(cx, hy - 7); ctx.moveTo(cx - 3.5, hy - 11); ctx.lineTo(cx - 2.5, hy - 7.5); ctx.moveTo(cx + 3.5, hy - 11); ctx.lineTo(cx + 2.5, hy - 7.5); ctx.stroke();
      // Bright eyes & pink nose
      ctx.fillStyle = "#18141c";
      ctx.beginPath(); ctx.arc(cx - 4.8, hy, 2, 0, Math.PI * 2); ctx.arc(cx + 4.8, hy, 2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#fb7185"; ctx.beginPath(); ctx.arc(cx, hy + 3, 1.5, 0, Math.PI * 2); ctx.fill();
    } else if (presetId === "preset:shiba") {
      // Cool Sunglasses Shiba Inu!
      ctx.fillStyle = "#d97706"; ctx.strokeStyle = INK; ctx.lineWidth = 1.3;
      ctx.beginPath(); ctx.moveTo(cx - 11, hy - 4); ctx.lineTo(cx - 12, hy - 16); ctx.lineTo(cx - 3, hy - 11); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx + 11, hy - 4); ctx.lineTo(cx + 12, hy - 16); ctx.lineTo(cx + 3, hy - 11); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#f59e0b"; ctx.beginPath(); ctx.arc(cx, hy, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#fffbeb"; ctx.beginPath(); ctx.ellipse(cx, hy + 4.5, 9.5, 6.8, 0, 0, Math.PI * 2); ctx.fill();
      // Cool dark sunglasses
      ctx.fillStyle = "#0f172a"; ctx.strokeStyle = "#334155"; ctx.lineWidth = 1;
      roundRect(ctx, cx - 10, hy - 3, 8.8, 5.5, 1.5); ctx.fill(); ctx.stroke();
      roundRect(ctx, cx + 1.2, hy - 3, 8.8, 5.5, 1.5); ctx.fill(); ctx.stroke();
      ctx.fillRect(cx - 1.5, hy - 1.5, 3, 1.4);
      ctx.fillStyle = "#18141c"; ctx.beginPath(); ctx.ellipse(cx, hy + 4.5, 2.2, 1.5, 0, 0, Math.PI * 2); ctx.fill();
    } else if (presetId === "preset:astro") {
      // Space Commander Helmet
      const hg = ctx.createRadialGradient(cx - 3, hy - 4, 2, cx, hy, r + 1.5);
      hg.addColorStop(0, "#ffffff"); hg.addColorStop(1, "#cbd5e1");
      ctx.fillStyle = hg; ctx.strokeStyle = INK; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(cx, hy, r + 1, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      // Reflective visor
      const vg = ctx.createLinearGradient(cx - 9, hy - 6, cx + 9, hy + 6);
      vg.addColorStop(0, "#0284c7"); vg.addColorStop(0.5, "#0f172a"); vg.addColorStop(1, "#1e3a8a");
      roundRect(ctx, cx - 9.5, hy - 5.5, 19, 11.5, 5.5);
      ctx.fillStyle = vg; ctx.fill(); ctx.strokeStyle = "#38bdf8"; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      roundRect(ctx, cx - 6.5, hy - 3.5, 6, 2.2, 1); ctx.fill();
    } else if (presetId === "preset:robot") {
      // Sleek AI Core Robot
      ctx.strokeStyle = "#14b8a6"; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(cx, hy - r); ctx.lineTo(cx, hy - r - 5); ctx.stroke();
      ctx.fillStyle = "#5eead4"; ctx.beginPath(); ctx.arc(cx, hy - r - 6, 2, 0, Math.PI * 2); ctx.fill();
      const rg = ctx.createLinearGradient(cx, hy - r, cx, hy + r);
      rg.addColorStop(0, "#475569"); rg.addColorStop(1, "#1e293b");
      roundRect(ctx, cx - 13, hy - 11.5, 26, 22, 7.5);
      ctx.fillStyle = rg; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.4; ctx.stroke();
      roundRect(ctx, cx - 9.5, hy - 5.5, 19, 10, 4);
      ctx.fillStyle = "#090e1a"; ctx.fill();
      ctx.fillStyle = "#2dd4bf";
      ctx.beginPath(); ctx.arc(cx - 4.2, hy - 0.5, 2.2, 0, Math.PI * 2); ctx.arc(cx + 4.2, hy - 0.5, 2.2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  function renderPresetThumbDataUrl(presetId) {
    const c = document.createElement("canvas");
    const S = 72;
    c.width = S; c.height = S;
    const ctx = c.getContext("2d");
    const bg = ctx.createRadialGradient(S / 2, S / 2, 4, S / 2, S / 2, S / 2);
    bg.addColorStop(0, "#243045"); bg.addColorStop(1, "#111827");
    ctx.fillStyle = bg; ctx.fillRect(0, 0, S, S);
    if (presetId === "empty") {
      roundRect(ctx, 18, 16, 36, 40, 9);
      ctx.fillStyle = "#3b303a"; ctx.fill();
      ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.1)";
      roundRect(ctx, 23, 21, 26, 7, 3); ctx.fill();
    } else {
      ctx.save();
      ctx.translate(S / 2, 62);
      ctx.scale(1.12, 1.12);
      drawPresetFigure(ctx, 0, 0, presetId, 0);
      ctx.restore();
    }
    return c.toDataURL("image/png");
  }

  /* ── Sleek Recruiting Front Desk on TOP Floor Upper-Left (Always Visible, Clickable -> Hire Bot!) ── */

  function drawRecruitingFrontDesk(ctx, cx, baseY, lang, hovered) {
    const deskW = 78;
    const x0 = cx - deskW / 2;
    const ty = baseY - 18;

    ctx.save();
    // Grounded floor shadow
    ctx.fillStyle = hovered ? "rgba(20, 184, 166, 0.28)" : "rgba(0, 0, 0, 0.34)";
    ctx.beginPath(); ctx.ellipse(cx, baseY + 5, deskW * 0.56, 7, 0, 0, Math.PI * 2); ctx.fill();

    // Small welcoming counter body (warm oak + teal accent strip)
    const bodyG = ctx.createLinearGradient(0, ty + 4, 0, ty + 22);
    bodyG.addColorStop(0, "#6d452a"); bodyG.addColorStop(1, "#3f2414");
    roundRect(ctx, x0, ty + 4, deskW, 18, 3.5);
    ctx.fillStyle = bodyG; ctx.fill();
    ctx.strokeStyle = hovered ? "#5eead4" : INK; ctx.lineWidth = hovered ? 1.8 : 1.2; ctx.stroke();

    // Top walnut counter lip
    const topG = ctx.createLinearGradient(0, ty, 0, ty + 6);
    topG.addColorStop(0, "#d4a574"); topG.addColorStop(1, "#9c6b3e");
    roundRect(ctx, x0 - 2, ty, deskW + 4, 6, 2.5);
    ctx.fillStyle = topG; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.stroke();

    // Glowing teal reception inlay on front panel
    ctx.fillStyle = hovered ? "#2dd4bf" : "#14b8a6";
    ctx.fillRect(x0 + 4, ty + 6.5, deskW - 8, 2);

    // Mini recruiting tablet / brochure stand on counter
    roundRect(ctx, cx - 24, ty - 10, 14, 10, 2);
    ctx.fillStyle = "#0f172a"; ctx.fill(); ctx.strokeStyle = "#38bdf8"; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = "#5eead4"; ctx.fillRect(cx - 21, ty - 7, 8, 1.5); ctx.fillRect(cx - 21, ty - 4, 5, 1.5);

    // Crisp teal-glowing "+ 招新" / "+ Hire" reception sign standing neatly above counter
    const signTxt = lang === "zh" ? "+ 招新前台" : "+ Hire Desk";
    ctx.font = "800 9px -apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif";
    const sw = Math.max(58, ctx.measureText(signTxt).width + 14);
    const sx = cx - sw / 2;
    const sy = ty - 28;
    // Little brass stand legs
    ctx.fillStyle = "#d97706";
    ctx.fillRect(cx - 12, ty - 12, 2, 12);
    ctx.fillRect(cx + 10, ty - 12, 2, 12);
    roundRect(ctx, sx, sy, sw, 17, 6);
    ctx.fillStyle = hovered ? "#0f766e" : "rgba(13, 42, 46, 0.94)";
    ctx.fill();
    ctx.strokeStyle = hovered ? "#5eead4" : "rgba(45, 212, 191, 0.72)";
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.fillStyle = "#f0fdfa";
    ctx.textAlign = "center";
    ctx.fillText(signTxt, cx, sy + 11.5);
    ctx.restore();
  }

  window.OfficePresets = { PRESET_LIST, drawPresetFigure, renderPresetThumbDataUrl, drawRecruitingFrontDesk };
})();
