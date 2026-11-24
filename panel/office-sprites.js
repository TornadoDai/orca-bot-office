/**
 * 3D-Shaded Illustrated Human Colleagues, Lead Bots, Oak Workstations, Lounge Sofas & Luminous Message Streams
 * - Workers are expressive illustrated human engineers (unique hairstyles, warm skin shading, headphones/glasses, engine-colored outfits!)
 * - Rich multi-stop shading, soft ambient shadows, monitor desk glow, warm oak wood grain — ZERO flat programmer boxes
 */
(function () {
  const {
    ROSE, INK, engStyle, hashStr, trimText, roundRect,
  } = window.OfficeArch;

  const HAIR_PALETTES = [
    { base: "#281f20", hi: "#47383a" }, // espresso black
    { base: "#4d3326", hi: "#78533f" }, // warm chestnut
    { base: "#232a3b", hi: "#3e4a66" }, // ink slate
    { base: "#693b2a", hi: "#965840" }, // warm auburn
    { base: "#3d332f", hi: "#63544e" }, // ash brown
    { base: "#2f2436", hi: "#513f5c" }, // deep plum-black
  ];

  const SKIN_PALETTES = [
    { top: "#ffe4cc", bot: "#eab994", blush: "rgba(244, 114, 182, 0.24)" },
    { top: "#fbd6b8", bot: "#dfa880", blush: "rgba(244, 114, 182, 0.22)" },
    { top: "#f3c7a1", bot: "#d1986d", blush: "rgba(236, 72, 153, 0.18)" },
  ];

  /* ── Prominent Engine Badges & Softened Rose Alerts ── */

  function drawEngineBadge(ctx, cx, y, rawEng) {
    const es = engStyle(rawEng);
    const label = `${es.sym} ${es.short}`;
    ctx.font = "800 9px -apple-system, BlinkMacSystemFont, sans-serif";
    const tw = ctx.measureText(label).width;
    const pw = tw + 10;
    const ph = 14.5;
    roundRect(ctx, cx - pw / 2, y, pw, ph, 4.5);
    ctx.fillStyle = es.bg; ctx.fill();
    ctx.strokeStyle = es.border; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = es.light;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(label, cx, y + ph / 2 + 0.5);
    ctx.textBaseline = "alphabetic";
    return pw;
  }

  function drawNameAndEngine(ctx, cx, topY, name, rawEng, extraText = "", isStall = false, maxW = 112) {
    ctx.font = "700 10.5px -apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif";
    const shown = trimText(ctx, name, maxW);
    const nw = ctx.measureText(shown).width;
    const pillW = Math.max(50, nw + 13);
    // Soft shadow under nameplate for crisp legibility over painted wood/carpet
    ctx.fillStyle = "rgba(0, 0, 0, 0.34)";
    roundRect(ctx, cx - pillW / 2 + 1, topY + 1.5, pillW, 15.5, 5.5); ctx.fill();

    roundRect(ctx, cx - pillW / 2, topY, pillW, 15.5, 5.5);
    ctx.fillStyle = "rgba(13, 18, 30, 0.9)"; ctx.fill();
    ctx.strokeStyle = isStall ? "rgba(251, 191, 36, 0.72)" : "rgba(226, 232, 240, 0.24)";
    ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = "#f8fafc";
    ctx.textAlign = "center";
    ctx.fillText(shown, cx, topY + 11.2);

    const badgeY = topY + 17.5;
    if (extraText) {
      const es = engStyle(rawEng);
      const engLbl = `${es.sym} ${es.short}`;
      ctx.font = "800 8.5px -apple-system, sans-serif";
      const ew = ctx.measureText(engLbl).width + 10;
      ctx.font = "700 8.5px -apple-system, sans-serif";
      const xw = ctx.measureText(extraText).width + 9;
      const totalW = ew + 4 + xw;
      const sx = cx - totalW / 2;
      drawEngineBadge(ctx, sx + ew / 2, badgeY, rawEng);
      roundRect(ctx, sx + ew + 4, badgeY, xw, 14.5, 4.5);
      ctx.fillStyle = isStall ? "rgba(120, 53, 15, 0.92)" : "rgba(24, 33, 49, 0.92)"; ctx.fill();
      ctx.strokeStyle = isStall ? "rgba(251, 191, 36, 0.65)" : "rgba(148, 163, 184, 0.3)"; ctx.stroke();
      ctx.fillStyle = isStall ? "#fde68a" : "#cbd5e1";
      ctx.textAlign = "center";
      ctx.fillText(extraText, sx + ew + 4 + xw / 2, badgeY + 10.2);
    } else {
      drawEngineBadge(ctx, cx, badgeY, rawEng);
    }
  }

  function drawSoftRoseDot(ctx, x, y, count = 1, pulse = 0) {
    const r = count > 1 ? 8.2 : 7;
    ctx.fillStyle = `rgba(251, 113, 133, ${0.16 + 0.08 * Math.sin(pulse)})`;
    ctx.beginPath(); ctx.arc(x, y, r + 3.4, 0, Math.PI * 2); ctx.fill();
    const g = ctx.createRadialGradient(x - 2, y - 2, 1, x, y, r);
    g.addColorStop(0, "#fda4af"); g.addColorStop(0.55, ROSE.dot); g.addColorStop(1, "#e11d48");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 1.4; ctx.stroke();
    ctx.fillStyle = "#ffffff";
    ctx.font = "900 8.5px -apple-system, sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(count > 1 ? String(Math.min(count, 9)) : "!", x, y + 0.5);
    ctx.textBaseline = "alphabetic";
    return { x, y, r: r + 5 };
  }

  /* ── 3D-Shaded Illustrated Human Worker & Lead Bot Sprites ── */

  function drawShadedTorso(ctx, cx, waistY, es, skin, typing, phase, standing = false) {
    const bob = typing ? Math.sin(phase * 2.2) * 1.2 : 0;
    const y = waistY + bob;

    // Shaded neck
    ctx.fillStyle = skin.bot;
    roundRect(ctx, cx - 4, y - 25, 8, 7, 2); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.stroke();

    // 3D-shaded modern sweater / office jacket torso
    const tg = ctx.createLinearGradient(cx, y - 20, cx, y + 2);
    tg.addColorStop(0, es.coatTop);
    tg.addColorStop(1, es.coatBot);
    roundRect(ctx, cx - 15.5, y - 20, 31, 22, 9);
    ctx.fillStyle = tg; ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.stroke();

    // Soft shoulder lighting highlight
    ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
    roundRect(ctx, cx - 11.5, y - 18.5, 23, 4.5, 2.5); ctx.fill();

    // Crisp white inner crewneck / shirt collar + subtle vertical jacket crease + ID badge
    ctx.fillStyle = "#f8fafc";
    ctx.beginPath();
    ctx.moveTo(cx - 5.5, y - 20); ctx.lineTo(cx + 5.5, y - 20);
    ctx.lineTo(cx, y - 11.5); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "rgba(15,23,42,0.28)"; ctx.lineWidth = 0.8; ctx.stroke();
    // Subtle company lanyard badge
    ctx.fillStyle = "#fef9c3";
    roundRect(ctx, cx + 4.5, y - 11, 5.5, 6.5, 1.5); ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.35)"; ctx.stroke();

    // Shaded sleeves & natural hands
    const tapL = typing ? Math.sin(phase * 4.4) * 2.0 : 0;
    const tapR = typing ? Math.cos(phase * 4.4) * 2.0 : 0;
    ctx.fillStyle = tg; ctx.strokeStyle = INK; ctx.lineWidth = 1.4;
    if (!standing) {
      roundRect(ctx, cx - 21, y - 15 + tapL, 7.5, 13.5, 3.8); ctx.fill(); ctx.stroke();
      roundRect(ctx, cx + 13.5, y - 15 + tapR, 7.5, 13.5, 3.8); ctx.fill(); ctx.stroke();
      ctx.fillStyle = skin.top;
      ctx.beginPath(); ctx.arc(cx - 17, y - 1.5 + tapL, 3.4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx + 17, y - 1.5 + tapR, 3.4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    } else {
      // Standing pose: right arm relaxed, left arm holding report folder cleanly!
      roundRect(ctx, cx + 13.5, y - 15.5, 7, 15, 3.5); ctx.fill(); ctx.stroke();
      ctx.fillStyle = skin.top;
      ctx.beginPath(); ctx.arc(cx + 17, y - 0.5, 3.2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = tg;
      roundRect(ctx, cx - 20.5, y - 16.5, 7.5, 13, 3.5); ctx.fill(); ctx.stroke();
    }
    return y - 35.5;
  }

  function drawHumanWorkerHead(ctx, cx, cy, seed, es, state, phase) {
    const hair = HAIR_PALETTES[seed % HAIR_PALETTES.length];
    const skin = SKIN_PALETTES[(seed >> 2) % SKIN_PALETTES.length];
    const style = (seed >> 3) % 6;
    const hasGlasses = (seed % 5) === 1 || (seed % 5) === 3;
    const hasHeadphones = (seed % 4) === 0 || (seed % 4) === 2;
    const r = 13.5;

    ctx.save();
    // Back hair volume (for bob / ponytail styles)
    ctx.fillStyle = hair.base; ctx.strokeStyle = INK; ctx.lineWidth = 1.4;
    if (style === 2) {
      roundRect(ctx, cx - r - 2.5, cy - 8, (r + 2.5) * 2, 23, 8); ctx.fill(); ctx.stroke();
    } else if (style === 3) {
      ctx.beginPath(); ctx.arc(cx + 11, cy - 11, 6.2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }

    // Little ears
    ctx.fillStyle = skin.bot;
    ctx.beginPath(); ctx.arc(cx - r, cy + 1.5, 3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx + r, cy + 1.5, 3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

    // 3D-shaded human face
    const fg = ctx.createRadialGradient(cx - 3, cy - 4, 2, cx, cy + 1, r + 1);
    fg.addColorStop(0, skin.top); fg.addColorStop(1, skin.bot);
    ctx.fillStyle = fg;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.stroke();

    // Soft rosy cheeks
    ctx.fillStyle = skin.blush;
    ctx.beginPath(); ctx.ellipse(cx - 7, cy + 4, 3.2, 1.8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx + 7, cy + 4, 3.2, 1.8, 0, 0, Math.PI * 2); ctx.fill();

    // Expressive eyes & mouth
    if (state === "idle") {
      // Cozy closed sleepy eyes
      ctx.strokeStyle = "#33292a"; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(cx - 4.8, cy + 1, 2.5, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx + 4.8, cy + 1, 2.5, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, cy + 6.5, 1.6, 0, Math.PI * 2); ctx.fillStyle = "#c9856d"; ctx.fill();
    } else {
      const look = state === "working" ? Math.sin(phase * 1.1) * 0.9 + 0.6 : 0;
      ctx.fillStyle = "#1f1a24";
      ctx.beginPath(); ctx.ellipse(cx - 4.8 + look, cy + 1, 2.1, 2.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(cx + 4.8 + look, cy + 1, 2.1, 2.5, 0, 0, Math.PI * 2); ctx.fill();
      // Crisp white catchlight
      ctx.fillStyle = "#ffffff";
      ctx.beginPath(); ctx.arc(cx - 5.4 + look, cy - 0.1, 0.85, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + 4.2 + look, cy - 0.1, 0.85, 0, Math.PI * 2); ctx.fill();
      // Gentle smile
      ctx.strokeStyle = "#8c5342"; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(cx, cy + 5.2, 2.4, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
    }

    // Optional stylish glasses
    if (hasGlasses) {
      ctx.strokeStyle = "#334155"; ctx.lineWidth = 1.2;
      roundRect(ctx, cx - 9, cy - 2, 7.2, 5.5, 1.8); ctx.stroke();
      roundRect(ctx, cx + 1.8, cy - 2, 7.2, 5.5, 1.8); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx - 1.8, cy + 0.5); ctx.lineTo(cx + 1.8, cy + 0.5); ctx.stroke();
    }

    // Layered 3D-shaded front hair & bangs
    ctx.fillStyle = hair.base; ctx.strokeStyle = INK; ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(cx, cy - 2.5, r + 1.1, Math.PI * 0.96, Math.PI * 0.04);
    if (style === 1 || style === 5) {
      // Fluffy bangs
      ctx.lineTo(cx + 10, cy - 1); ctx.lineTo(cx + 5, cy - 5); ctx.lineTo(cx, cy - 1);
      ctx.lineTo(cx - 5, cy - 5); ctx.lineTo(cx - 10, cy - 1);
    } else if (style === 4) {
      // Side-swept fringe
      ctx.quadraticCurveTo(cx + 4, cy - 7, cx - 12, cy - 1);
    } else {
      // Clean curved bangs
      ctx.quadraticCurveTo(cx, cy - 8, cx - r - 1, cy - 2);
    }
    ctx.closePath(); ctx.fill(); ctx.stroke();

    // Soft glossy hair highlight arc
    ctx.strokeStyle = hair.hi; ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.arc(cx, cy - 3.5, r - 3.5, Math.PI * 1.22, Math.PI * 1.72); ctx.stroke();

    // Optional sleek Engine-colored studio headphones (subtly reinforces engine identity!)
    if (hasHeadphones) {
      ctx.strokeStyle = es.color; ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.arc(cx, cy - 2, r + 2.2, Math.PI * 1.08, Math.PI * 1.92); ctx.stroke();
      ctx.fillStyle = es.coatTop; ctx.strokeStyle = INK; ctx.lineWidth = 1.2;
      roundRect(ctx, cx - r - 4.5, cy - 4, 5, 10, 2.5); ctx.fill(); ctx.stroke();
      roundRect(ctx, cx + r - 0.5, cy - 4, 5, 10, 2.5); ctx.fill(); ctx.stroke();
    }
    ctx.restore();
  }

  function drawLeadAvatarHead(ctx, cx, cy, r, img, name, ringColor) {
    ctx.save();
    // Dimensional drop shadow
    ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
    ctx.beginPath(); ctx.arc(cx, cy + 2, r + 1.5, 0, Math.PI * 2); ctx.fill();

    // Dark outline + avatar medallion
    ctx.beginPath(); ctx.arc(cx, cy, r + 1.5, 0, Math.PI * 2);
    ctx.fillStyle = INK; ctx.fill();
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.closePath();
    ctx.fillStyle = "#1e293b"; ctx.fill();
    ctx.save(); ctx.clip();
    if (img && img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, cx - r, cy - r, r * 2, r * 2);
    } else {
      const g = ctx.createLinearGradient(cx, cy - r, cx, cy + r);
      g.addColorStop(0, "#475569"); g.addColorStop(1, "#1e293b");
      ctx.fillStyle = g; ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
      ctx.fillStyle = "#f8fafc";
      ctx.font = `800 ${Math.round(r * 0.9)}px -apple-system, sans-serif`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText((name || "?").slice(0, 1).toUpperCase(), cx, cy + 1);
      ctx.textBaseline = "alphabetic";
    }
    // Subtle 3D glass specular sheen across top of avatar
    const gloss = ctx.createLinearGradient(cx, cy - r, cx, cy);
    gloss.addColorStop(0, "rgba(255,255,255,0.22)");
    gloss.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gloss;
    ctx.fillRect(cx - r, cy - r, r * 2, r);
    ctx.restore();

    ctx.strokeStyle = ringColor; ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }

  function drawBranchBadge(ctx, x, y, count, active) {
    if (!count || count <= 0) return;
    const lbl = `⑂${count}`;
    ctx.save();
    ctx.font = "800 8.5px -apple-system, ui-monospace, sans-serif";
    const w = Math.max(20, ctx.measureText(lbl).width + 8);
    roundRect(ctx, x - w / 2, y - 7, w, 13.5, 999);
    ctx.fillStyle = active ? "#0284c7" : "rgba(15, 23, 42, 0.88)";
    ctx.fill();
    ctx.strokeStyle = active ? "#7dd3fc" : "rgba(148, 163, 184, 0.6)";
    ctx.lineWidth = 1.1;
    ctx.stroke();
    ctx.fillStyle = active ? "#f0f9ff" : "#cbd5e1";
    ctx.textAlign = "center";
    ctx.fillText(lbl, x, y + 2.5);
    ctx.restore();
  }

  /* ── 3D-Shaded Warm Oak Workstations & Ergonomic Office Chairs ── */

  function drawSeatedDeskStation(ctx, opts) {
    const { cx, baseY, isLead, isWorking, isStall, isUpstairs, eng, avatarImg, name, seedKey, phase, hovered, lang, durText, branchCount = 0, branchActive = false } = opts;
    const es = engStyle(eng);
    const seed = hashStr(seedKey || name || "w");
    const skin = SKIN_PALETTES[(seed >> 2) % SKIN_PALETTES.length];
    const deskW = isLead ? 114 : 98;
    const deskTopY = baseY - 22;

    // Rich multi-layered floor ambient shadow
    ctx.fillStyle = hovered ? "rgba(56, 189, 248, 0.24)" : "rgba(0, 0, 0, 0.42)";
    ctx.beginPath(); ctx.ellipse(cx, baseY + 4, deskW * 0.56, 9, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(0, 0, 0, 0.22)";
    ctx.beginPath(); ctx.ellipse(cx, baseY + 5, deskW * 0.62, 11, 0, 0, Math.PI * 2); ctx.fill();

    // 3D-shaded ergonomic office chair behind character
    const chG = ctx.createLinearGradient(cx - 18, deskTopY - 36, cx + 18, deskTopY);
    chG.addColorStop(0, isLead ? "#475569" : "#374151");
    chG.addColorStop(1, "#1e293b");
    roundRect(ctx, cx - 18, deskTopY - 36, 36, 36, 9);
    ctx.fillStyle = chG; ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 1.4; ctx.stroke();
    // Chair headrest highlight
    roundRect(ctx, cx - 10, deskTopY - 41, 20, 7, 3.5);
    ctx.fillStyle = "#334155"; ctx.fill(); ctx.stroke();

    // Character seated cleanly behind the desk!
    if (!isUpstairs) {
      const hy = drawShadedTorso(ctx, cx - 5, deskTopY + 3, es, skin, isWorking, phase, false);
      if (isLead) {
        const ring = isStall ? "#fbbf24" : (isWorking ? es.color : "#e2e8f0");
        drawLeadAvatarHead(ctx, cx - 5, hy, 15.5, avatarImg, name, ring);
        if (branchCount > 0) drawBranchBadge(ctx, cx + 13, hy - 11, branchCount, branchActive);
      } else {
        drawHumanWorkerHead(ctx, cx - 5, hy + 1, seed, es, isWorking ? "working" : "idle", phase);
      }
      if (!isWorking && !branchActive) {
        ctx.fillStyle = "rgba(241, 245, 249, 0.82)";
        ctx.font = "700 9.5px ui-monospace, monospace";
        ctx.textAlign = "left";
        ctx.fillText("zZ", cx + 14, deskTopY - 38);
      }
    }

    // Dimensional Warm Oak & Dark-Steel Office Desk
    const x0 = cx - deskW / 2;
    // Brushed steel legs with inner shadow
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(x0 + 5, deskTopY + 13, 5, 11);
    ctx.fillRect(x0 + deskW - 10, deskTopY + 13, 5, 11);
    ctx.fillStyle = "rgba(255,255,255,0.14)";
    ctx.fillRect(x0 + 6, deskTopY + 13, 1.5, 11);
    ctx.fillRect(x0 + deskW - 9, deskTopY + 13, 1.5, 11);

    // Front modesty apron with vertical 3D gradient
    const apG = ctx.createLinearGradient(0, deskTopY + 7, 0, deskTopY + 22);
    if (isLead) {
      apG.addColorStop(0, "#7c502e"); apG.addColorStop(1, "#4a2e19");
    } else {
      apG.addColorStop(0, "#3b475e"); apG.addColorStop(1, "#1e2636");
    }
    roundRect(ctx, x0, deskTopY + 7, deskW, 14, 2.5);
    ctx.fillStyle = apG; ctx.fill();
    ctx.strokeStyle = hovered ? "#7dd3fc" : INK; ctx.lineWidth = hovered ? 1.6 : 1.2; ctx.stroke();

    // Subtle LED engine accent trim under tabletop lip
    ctx.fillStyle = es.color;
    ctx.globalAlpha = isWorking ? 0.92 : 0.35;
    ctx.fillRect(x0 + 3, deskTopY + 8.5, deskW - 6, 2);
    ctx.globalAlpha = 1;

    // 3D Oblique Warm-Oak Tabletop with wood bevel highlight
    const topG = ctx.createLinearGradient(0, deskTopY, 0, deskTopY + 9);
    topG.addColorStop(0, isLead ? "#cfa06e" : "#c49a6c");
    topG.addColorStop(1, isLead ? "#9c6b3e" : "#8f6841");
    ctx.beginPath();
    ctx.moveTo(x0 + 4, deskTopY); ctx.lineTo(x0 + deskW - 4, deskTopY);
    ctx.lineTo(x0 + deskW, deskTopY + 8.5); ctx.lineTo(x0, deskTopY + 8.5); ctx.closePath();
    ctx.fillStyle = topG; ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = "rgba(255, 248, 232, 0.32)";
    ctx.fillRect(x0 + 5, deskTopY + 0.8, deskW - 10, 1.2);

    // Desk mat + tactile keyboard in front of character hands
    ctx.fillStyle = "rgba(15, 23, 42, 0.55)";
    roundRect(ctx, cx - 22, deskTopY + 1.2, 34, 5.5, 1.5); ctx.fill();
    ctx.fillStyle = "#e2e8f0";
    ctx.fillRect(cx - 18, deskTopY + 2.5, 22, 2.5);
    ctx.fillStyle = "#334155";
    ctx.fillRect(cx - 17, deskTopY + 3, 20, 1.3);

    // Side-mounted sleek monitor + real soft screen glow onto desk!
    const mx = cx + (isLead ? 35 : 29);
    const my = deskTopY - 13;
    if (isWorking) {
      const glow = ctx.createRadialGradient(mx, my + 8, 2, mx, my + 12, 26);
      glow.addColorStop(0, isStall ? "rgba(251, 191, 36, 0.28)" : "rgba(56, 189, 248, 0.25)");
      glow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(mx, my + 10, 26, 0, Math.PI * 2); ctx.fill();
    }
    // Aluminum stand
    ctx.fillStyle = "#94a3b8";
    ctx.fillRect(mx - 2, my + 13, 4, 4);
    ctx.fillRect(mx - 7, my + 16, 14, 2);
    // Bezel & glowing UI
    roundRect(ctx, mx - 14, my - 3, 28, 17, 3);
    ctx.fillStyle = "#0f172a"; ctx.fill();
    ctx.strokeStyle = isWorking ? es.color : "#64748b"; ctx.lineWidth = 1.4; ctx.stroke();
    if (isWorking) {
      const scan = Math.floor(phase * 3) % 3;
      ctx.fillStyle = isStall ? "#fbbf24" : es.light;
      ctx.fillRect(mx - 10.5, my + 0.5, 12 + (scan === 0 ? 5 : 0), 2.2);
      ctx.fillStyle = "#4ade80";
      ctx.fillRect(mx - 10.5, my + 4.4, 17 - (scan === 1 ? 5 : 0), 2.2);
      ctx.fillStyle = es.color;
      ctx.fillRect(mx - 10.5, my + 8.3, 14, 2.2);
    } else {
      ctx.fillStyle = "rgba(148,163,184,0.22)";
      ctx.fillRect(mx - 8, my + 3, 16, 2);
    }

    // Warm ceramic mug on left (+ tiny brass desk lamp on Lead Bot desk!)
    ctx.fillStyle = "#fff7ed"; ctx.strokeStyle = INK; ctx.lineWidth = 0.9;
    roundRect(ctx, x0 + 7, deskTopY - 3, 6.5, 6.5, 1.5); ctx.fill(); ctx.stroke();
    if (isLead) {
      ctx.strokeStyle = "#fbbf24"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(x0 + 17, deskTopY + 1); ctx.lineTo(x0 + 15, deskTopY - 8); ctx.lineTo(x0 + 22, deskTopY - 11); ctx.stroke();
      ctx.fillStyle = "#fef08a"; ctx.fillRect(x0 + 20, deskTopY - 11.5, 5, 2.5);
    }

    // Away note when character went upstairs to Decision & Report Queue
    if (isUpstairs) {
      const tag = lang === "zh" ? "▲ 排队汇报中" : "▲ In Report Queue";
      ctx.font = "700 9px -apple-system, 'PingFang SC', sans-serif";
      const tw = ctx.measureText(tag).width + 13;
      roundRect(ctx, cx - tw / 2, deskTopY - 40, tw, 16, 5.5);
      ctx.fillStyle = ROSE.bubbleBg; ctx.fill();
      ctx.strokeStyle = ROSE.border; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = ROSE.text; ctx.textAlign = "center";
      ctx.fillText(tag, cx, deskTopY - 28.8);
    }

    drawNameAndEngine(ctx, cx, baseY + 5, name, eng, durText, isStall, isLead ? 110 : 100);
  }

  function drawStandingQueueActor(ctx, opts) {
    const { cx, footY, isBot, eng, avatarImg, name, seedKey, snippet, count, phase, hovered } = opts;
    const es = engStyle(eng);
    const seed = hashStr(seedKey || name || "q");
    const skin = SKIN_PALETTES[(seed >> 2) % SKIN_PALETTES.length];
    const sway = Math.sin(phase * 1.5) * 0.8;

    // Soft dimensional floor shadow
    ctx.fillStyle = hovered ? "rgba(251, 113, 133, 0.28)" : "rgba(0, 0, 0, 0.42)";
    ctx.beginPath(); ctx.ellipse(cx, footY + 2, 20, 6.2, 0, 0, Math.PI * 2); ctx.fill();

    // Shaded office trousers & crisp modern sneakers
    const legG = ctx.createLinearGradient(0, footY - 15, 0, footY);
    legG.addColorStop(0, "#334155"); legG.addColorStop(1, "#1e293b");
    ctx.fillStyle = legG; ctx.strokeStyle = INK; ctx.lineWidth = 1.4;
    roundRect(ctx, cx - 9.5, footY - 14.5, 8, 13.5, 3); ctx.fill(); ctx.stroke();
    roundRect(ctx, cx + 1.5, footY - 14.5, 8, 13.5, 3); ctx.fill(); ctx.stroke();
    // Sneakers with white rubber sole
    ctx.fillStyle = "#1e293b";
    roundRect(ctx, cx - 11.5, footY - 4.5, 10, 5, 2.2); ctx.fill(); ctx.stroke();
    roundRect(ctx, cx + 0.5, footY - 4.5, 10, 5, 2.2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(cx - 10.5, footY - 1.3, 8, 1.3);
    ctx.fillRect(cx + 1.5, footY - 1.3, 8, 1.3);

    // Full shaded upper body + head
    const headY = drawShadedTorso(ctx, cx, footY - 12 + sway, es, skin, false, phase, true);
    if (isBot) {
      drawLeadAvatarHead(ctx, cx, headY, 15.5, avatarImg, name, ROSE.stroke);
    } else {
      drawHumanWorkerHead(ctx, cx, headY + 1, seed, es, "needs", phase);
    }

    // Crisp shaded Report Folder / Clipboard held neatly in left hand
    ctx.save();
    ctx.translate(cx - 19, footY - 26 + sway);
    ctx.rotate(-0.12);
    roundRect(ctx, -6.5, -8.5, 13, 16, 2.2);
    ctx.fillStyle = "#ffffff"; ctx.fill();
    ctx.strokeStyle = ROSE.dot; ctx.lineWidth = 1.3; ctx.stroke();
    ctx.fillStyle = "#94a3b8";
    ctx.fillRect(-4, -4.5, 8, 1.6); ctx.fillRect(-4, -1, 6.5, 1.6); ctx.fillRect(-4, 2.5, 5.5, 1.6);
    ctx.restore();

    // Soft rose clickable alert badge
    const dotHit = drawSoftRoseDot(ctx, cx + 15.5, headY - 12, count, phase);

    // Clean report speech bubble above head
    if (snippet) {
      ctx.font = "600 9.5px -apple-system, 'PingFang SC', sans-serif";
      const txt = trimText(ctx, snippet, 114);
      const bw = Math.min(126, Math.max(52, ctx.measureText(txt).width + 15));
      const bx = cx - bw / 2;
      const by = headY - 38;
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      roundRect(ctx, bx + 1, by + 2, bw, 16.5, 6); ctx.fill();
      roundRect(ctx, bx, by, bw, 16.5, 6);
      ctx.fillStyle = ROSE.bubbleBg; ctx.fill();
      ctx.strokeStyle = ROSE.border; ctx.lineWidth = 1; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx - 4, by + 16.5); ctx.lineTo(cx, by + 20.5); ctx.lineTo(cx + 4, by + 16.5);
      ctx.fillStyle = ROSE.bubbleBg; ctx.fill();
      ctx.fillStyle = ROSE.text; ctx.textAlign = "center";
      ctx.fillText(txt, cx, by + 11.5);
    }

    drawNameAndEngine(ctx, cx, footY + 6, name, eng, "", false, 112);
    return dotHit;
  }

  function drawLoungeSofaGroup(ctx, sx, sy, sw, rowBots, shared, hoveredId, hitNodes) {
    // Soft floor shadow
    ctx.fillStyle = "rgba(0,0,0,0.42)";
    ctx.beginPath(); ctx.ellipse(sx + sw / 2, sy + 15, sw * 0.52, 8.5, 0, 0, Math.PI * 2); ctx.fill();

    // Dimensional tufted caramel leather backrest
    const backG = ctx.createLinearGradient(0, sy - 28, 0, sy);
    backG.addColorStop(0, "#a85a32"); backG.addColorStop(1, "#6b3319");
    roundRect(ctx, sx, sy - 28, sw, 30, 9);
    ctx.fillStyle = backG; ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 1.4; ctx.stroke();
    ctx.fillStyle = "rgba(255, 224, 185, 0.18)";
    roundRect(ctx, sx + 4, sy - 26, sw - 8, 5, 3); ctx.fill();

    // Bots lounging on the sofa
    const step = sw / Math.max(rowBots.length, 1);
    rowBots.forEach((b, ci) => {
      const bx = sx + step * ci + step / 2;
      const es = engStyle(b.agent);
      const skin = SKIN_PALETTES[hashStr(b.id || b.name) % SKIN_PALETTES.length];
      const nodeId = `lounge:idle:${b.id}`;
      const hov = hoveredId === nodeId;
      const hy = drawShadedTorso(ctx, bx, sy + 2, es, skin, false, 0, false);
      drawLeadAvatarHead(ctx, bx, hy, 14.5, shared.getAvatarImg(b.id, b.name), b.name, hov ? "#7dd3fc" : es.color);
      if ((b.branchChatCount || 0) > 0) drawBranchBadge(ctx, bx + 15, hy - 10, b.branchChatCount, (b.activeBranchCount || 0) > 0);
      // Warm ceramic mug next to bot
      ctx.fillStyle = "#fff7ed"; ctx.strokeStyle = INK; ctx.lineWidth = 0.9;
      roundRect(ctx, bx + 15, sy - 3, 5.5, 5.5, 1.5); ctx.fill(); ctx.stroke();

      hitNodes.push({
        id: nodeId, kind: "bot", bot: b, dotHit: null,
        box: { x: bx - 42, y: sy - 56, w: 84, h: 100 },
      });
    });

    // Shaded sofa seat cushions & rounded armrests + wooden legs
    const seatG = ctx.createLinearGradient(0, sy - 3, 0, sy + 14);
    seatG.addColorStop(0, "#c26c3f"); seatG.addColorStop(1, "#7d3d1f");
    roundRect(ctx, sx + 6, sy - 3, sw - 12, 15, 5.5);
    ctx.fillStyle = seatG; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.3; ctx.stroke();
    roundRect(ctx, sx - 2, sy - 16, 12, 28, 4.5);
    ctx.fillStyle = backG; ctx.fill(); ctx.stroke();
    roundRect(ctx, sx + sw - 10, sy - 16, 12, 28, 4.5);
    ctx.fill(); ctx.stroke();
    // Solid oak sofa legs
    ctx.fillStyle = "#4a2c18";
    ctx.fillRect(sx + 6, sy + 12, 5, 5);
    ctx.fillRect(sx + sw - 11, sy + 12, 5, 5);

    rowBots.forEach((b, ci) => {
      const bx = sx + step * ci + step / 2;
      drawNameAndEngine(ctx, bx, sy + 15, b.name, b.agent, "", false, 90);
    });
  }

  /* ── Unlabeled Center Executive Workstation for TOP Decision & Report Queue ── */

  function drawCenterOwnerDesk(ctx, cx, baseY, phase, opts = {}) {
    const mode = opts.mode || "empty";
    const avatarImg = opts.avatarImg || null;
    const deskW = 148;
    const ty = baseY - 22;

    // Grounded soft floor shadow
    ctx.fillStyle = "rgba(0, 0, 0, 0.36)";
    ctx.beginPath(); ctx.ellipse(cx, baseY + 4, deskW * 0.56, 9.5, 0, 0, Math.PI * 2); ctx.fill();

    // Executive high-back leather swivel chair (slightly angled cushion detail when empty)
    const chG = ctx.createLinearGradient(cx - 20, ty - 42, cx + 20, ty);
    chG.addColorStop(0, "#43343f"); chG.addColorStop(1, "#1e1923");
    roundRect(ctx, cx - 21, ty - 42, 42, 42, 10);
    ctx.fillStyle = chG; ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 1.4; ctx.stroke();
    // Subtle tufted headrest & backrest seam
    ctx.fillStyle = "rgba(255,255,255,0.09)";
    roundRect(ctx, cx - 15, ty - 38, 30, 6.5, 3); ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.07)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(cx - 15, ty - 26); ctx.lineTo(cx + 15, ty - 26); ctx.stroke();

    // Optional figure: default "empty" (invisible/empty chair), or "custom" avatar, or "silhouette"
    if (mode === "custom" || mode === "silhouette") {
      const bob = Math.sin(phase * 0.85) * 0.5;
      if (mode === "custom" && avatarImg && avatarImg.complete && avatarImg.naturalWidth > 0) {
        const coatG = ctx.createLinearGradient(cx, ty - 19 + bob, cx, ty + 3 + bob);
        coatG.addColorStop(0, "#334155"); coatG.addColorStop(1, "#1e293b");
        roundRect(ctx, cx - 17, ty - 19 + bob, 34, 22, 9);
        ctx.fillStyle = coatG; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.4; ctx.stroke();
        drawLeadAvatarHead(ctx, cx, ty - 33 + bob, 14.5, avatarImg, "", "rgba(251, 191, 36, 0.72)");
      } else {
        // Subtle frosted minimalist silhouette
        ctx.save();
        ctx.globalAlpha = 0.52;
        ctx.fillStyle = "#64748b";
        roundRect(ctx, cx - 15, ty - 18 + bob, 30, 20, 9); ctx.fill();
        ctx.beginPath(); ctx.arc(cx, ty - 31 + bob, 10.5, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
    }

    // Rich 3D Walnut Executive Desk (completely clean front panel — ZERO text!)
    const x0 = cx - deskW / 2;
    ctx.fillStyle = "#1f1918";
    ctx.fillRect(x0 + 6, ty + 14, 6, 10);
    ctx.fillRect(x0 + deskW - 12, ty + 14, 6, 10);

    const apG = ctx.createLinearGradient(0, ty + 8, 0, ty + 24);
    apG.addColorStop(0, "#6e4228"); apG.addColorStop(1, "#3d2214");
    roundRect(ctx, x0, ty + 8, deskW, 16, 3);
    ctx.fillStyle = apG; ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 1.3; ctx.stroke();
    // Subtle recessed walnut trim frame (classy wood detail, no lettering)
    ctx.strokeStyle = "rgba(255, 224, 185, 0.16)"; ctx.lineWidth = 1;
    roundRect(ctx, x0 + 8, ty + 11.5, deskW - 16, 9, 2); ctx.stroke();

    // Oblique walnut desktop
    const topG = ctx.createLinearGradient(0, ty, 0, ty + 9);
    topG.addColorStop(0, "#b88252"); topG.addColorStop(1, "#855530");
    ctx.beginPath();
    ctx.moveTo(x0 + 5, ty); ctx.lineTo(x0 + deskW - 5, ty);
    ctx.lineTo(x0 + deskW, ty + 9); ctx.lineTo(x0, ty + 9); ctx.closePath();
    ctx.fillStyle = topG; ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = "rgba(255, 248, 232, 0.28)";
    ctx.fillRect(x0 + 6, ty + 1, deskW - 12, 1.2);

    // Warm architectural brass desk lamp on left
    const lampGlow = ctx.createRadialGradient(x0 + 22, ty - 4, 2, x0 + 22, ty + 4, 24);
    lampGlow.addColorStop(0, "rgba(254, 240, 138, 0.28)");
    lampGlow.addColorStop(1, "rgba(254, 240, 138, 0)");
    ctx.fillStyle = lampGlow;
    ctx.beginPath(); ctx.arc(x0 + 22, ty + 2, 24, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#d97706"; ctx.fillRect(x0 + 13, ty + 2, 11, 2.6);
    ctx.strokeStyle = "#fbbf24"; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(x0 + 18, ty + 2); ctx.lineTo(x0 + 16, ty - 8); ctx.lineTo(x0 + 24, ty - 11); ctx.stroke();
    ctx.fillStyle = "#fef08a"; ctx.fillRect(x0 + 21, ty - 11.5, 6.5, 2.6);

    // Sleek silver laptop in center-right + ceramic coffee mug with gentle steam
    ctx.fillStyle = "#cbd5e1"; ctx.fillRect(cx + 16, ty + 1.5, 24, 3);
    ctx.fillStyle = "#334155"; ctx.strokeStyle = INK; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx + 19, ty + 1.5); ctx.lineTo(cx + 37, ty + 1.5);
    ctx.lineTo(cx + 34, ty - 10); ctx.lineTo(cx + 16, ty - 10); ctx.closePath();
    ctx.fill(); ctx.stroke();

    ctx.fillStyle = "#fff7ed"; ctx.strokeStyle = INK; ctx.lineWidth = 0.9;
    roundRect(ctx, x0 + deskW - 22, ty - 3, 7, 7, 1.5); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.42)"; ctx.lineWidth = 1;
    const st = Math.sin(phase * 1.6) * 1.3;
    ctx.beginPath(); ctx.moveTo(x0 + deskW - 18.5, ty - 5); ctx.quadraticCurveTo(x0 + deskW - 18.5 + st, ty - 10, x0 + deskW - 18, ty - 14); ctx.stroke();
  }

  /* ── Sleek Luminous Message Stream (Paper-Dart + Fading Light Trail) ── */

  function drawMessageStream(ctx, x1, y1, x2, y2, progress, kind) {
    const color = kind === "alert" ? ROSE.dot : (kind === "reply" ? "#34d399" : "#38bdf8");
    const light = kind === "alert" ? "#ffe4e6" : (kind === "reply" ? "#d1fae5" : "#e0f2fe");
    const midX = (x1 + x2) / 2;
    const midY = Math.min(y1, y2) - 22;

    const pt = (t) => {
      const u = 1 - t;
      return { x: u * u * x1 + 2 * u * t * midX + t * t * x2, y: u * u * y1 + 2 * u * t * midY + t * t * y2 };
    };

    ctx.save();
    ctx.strokeStyle = kind === "alert" ? "rgba(251, 113, 133, 0.2)" : "rgba(56, 189, 248, 0.18)";
    ctx.lineWidth = 1.1; ctx.setLineDash([3, 5]);
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.quadraticCurveTo(midX, midY, x2, y2); ctx.stroke();
    ctx.setLineDash([]);

    for (let i = 4; i >= 1; i--) {
      const tp = progress - i * 0.045;
      if (tp < 0 || tp > 1) continue;
      const p = pt(tp);
      ctx.globalAlpha = (5 - i) * 0.16;
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(p.x, p.y, 1.7 + (4 - i) * 0.45, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;

    const head = pt(progress);
    const prev = pt(Math.max(0, progress - 0.03));
    const ang = Math.atan2(head.y - prev.y, head.x - prev.x);

    ctx.translate(head.x, head.y);
    ctx.rotate(ang);
    ctx.fillStyle = color; ctx.globalAlpha = 0.28;
    ctx.beginPath(); ctx.arc(0, 0, 7.5, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = light;
    ctx.beginPath();
    ctx.moveTo(6.8, 0); ctx.lineTo(-4.5, -3.8); ctx.lineTo(-2.2, 0); ctx.lineTo(-4.5, 3.8);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.stroke();
    ctx.restore();
  }

  window.OfficeSprites = {
    drawEngineBadge, drawNameAndEngine, drawSoftRoseDot, drawLeadAvatarHead,
    drawHumanWorkerHead, drawSeatedDeskStation, drawStandingQueueActor,
    drawLoungeSofaGroup, drawCenterOwnerDesk, drawMessageStream,
  };
})();
