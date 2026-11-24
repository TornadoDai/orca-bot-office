/**
 * Crisp DNF-Style Bot & Articulated Worker Robot Sprites, Desks & Message Streams
 */
(function () {
  const {
    ENG_STYLES, FLOOR_THEMES, ROSE, INK, engStyle, hashStr, trimText, roundRect,
    fmtDur, isStalled, drawBuildingShell, drawBuildingColumns, drawCeilingLightBar,
    drawWoodSlats, drawCurtainWallWindow, drawOfficeFloor, drawElevatorLobby,
    drawOfficeProp, drawPottedPlant,
  } = window.OfficeArch;

  /* ── Prominent Engine Badges & Softened Rose Alerts ── */

  function drawEngineBadge(ctx, cx, y, rawEng) {
    const es = engStyle(rawEng);
    const label = `${es.sym} ${es.short}`;
    ctx.font = "800 9px -apple-system, BlinkMacSystemFont, sans-serif";
    const tw = ctx.measureText(label).width;
    const pw = tw + 10;
    const ph = 14;
    roundRect(ctx, cx - pw / 2, y, pw, ph, 4);
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
    const pillW = Math.max(48, nw + 12);
    roundRect(ctx, cx - pillW / 2, topY, pillW, 15, 5);
    ctx.fillStyle = "rgba(11, 17, 30, 0.88)"; ctx.fill();
    ctx.strokeStyle = isStall ? "rgba(251, 191, 36, 0.68)" : "rgba(148, 163, 184, 0.3)";
    ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = "#f8fafc";
    ctx.textAlign = "center";
    ctx.fillText(shown, cx, topY + 11);

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
      ctx.fillStyle = isStall ? "rgba(120, 53, 15, 0.88)" : "rgba(30, 41, 59, 0.9)"; ctx.fill();
      ctx.strokeStyle = isStall ? "rgba(251, 191, 36, 0.6)" : "rgba(148, 163, 184, 0.25)"; ctx.stroke();
      ctx.fillStyle = isStall ? "#fde68a" : "#cbd5e1";
      ctx.textAlign = "center";
      ctx.fillText(extraText, sx + ew + 4 + xw / 2, badgeY + 10);
    } else {
      drawEngineBadge(ctx, cx, badgeY, rawEng);
    }
  }

  function drawSoftRoseDot(ctx, x, y, count = 1, pulse = 0) {
    const r = count > 1 ? 8 : 6.8;
    ctx.fillStyle = `rgba(251, 113, 133, ${0.14 + 0.08 * Math.sin(pulse)})`;
    ctx.beginPath(); ctx.arc(x, y, r + 3.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = ROSE.dot;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = "#ffffff";
    ctx.font = "900 8.5px -apple-system, sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(count > 1 ? String(Math.min(count, 9)) : "!", x, y + 0.5);
    ctx.textBaseline = "alphabetic";
    return { x, y, r: r + 5 };
  }

  /* ── Crisp, Full-Bodied Bot & Articulated Worker Robot Sprites ── */

  function drawBotHead(ctx, cx, cy, r, img, name, ringColor) {
    ctx.save();
    // Outer dark ink stroke for razor-sharp readability
    ctx.beginPath(); ctx.arc(cx, cy, r + 1.4, 0, Math.PI * 2);
    ctx.fillStyle = INK; ctx.fill();
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
    ctx.strokeStyle = ringColor; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }

  function drawBotUpperBody(ctx, cx, waistY, es, typing, phase) {
    // Crisp DNF-style tailored office jacket/hoodie + white shirt collar + ID badge + articulated arms!
    const bob = typing ? Math.sin(phase * 2.2) * 1.4 : 0;
    const y = waistY + bob;
    // Neck
    ctx.fillStyle = "#f5d0a9";
    ctx.fillRect(cx - 3.5, y - 24, 7, 5);
    // Jacket torso with crisp dark outline & shoulder highlight
    roundRect(ctx, cx - 15, y - 20, 30, 22, 8);
    ctx.fillStyle = es.coat; ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 1.6; ctx.stroke();
    // Subtle top shoulder highlight
    ctx.fillStyle = es.coatHi;
    ctx.globalAlpha = 0.45;
    roundRect(ctx, cx - 12, y - 18.5, 24, 5, 3); ctx.fill();
    ctx.globalAlpha = 1;
    // Crisp white inner collar V + badge lanyard
    ctx.fillStyle = "#f8fafc";
    ctx.beginPath();
    ctx.moveTo(cx - 5.5, y - 20); ctx.lineTo(cx + 5.5, y - 20);
    ctx.lineTo(cx, y - 11); ctx.closePath(); ctx.fill();
    ctx.fillStyle = es.light;
    roundRect(ctx, cx + 4, y - 11, 5, 6, 1.5); ctx.fill();
    // Articulated arms & hands resting forward on desk
    const tapL = typing ? Math.sin(phase * 4.5) * 2.2 : 0;
    const tapR = typing ? Math.cos(phase * 4.5) * 2.2 : 0;
    ctx.fillStyle = es.coat; ctx.strokeStyle = INK; ctx.lineWidth = 1.4;
    roundRect(ctx, cx - 20, y - 15 + tapL, 7, 13, 3.5); ctx.fill(); ctx.stroke();
    roundRect(ctx, cx + 13, y - 15 + tapR, 7, 13, 3.5); ctx.fill(); ctx.stroke();
    // Hands
    ctx.fillStyle = "#f5d0a9";
    ctx.beginPath(); ctx.arc(cx - 16.5, y - 2 + tapL, 3.2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx + 16.5, y - 2 + tapR, 3.2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    return y - 35; // head center Y
  }

  function drawRobotSprite(ctx, cx, waistY, es, state, phase, standing = false) {
    // Unmistakable full-bodied glossy office assistant robot with metallic armor, chest core emblem & jointed arms!
    const active = state === "working" || state === "needs";
    const bob = state === "working" ? Math.sin(phase * 2.4) * 1.4 : (state === "needs" ? Math.sin(phase * 1.6) * 0.9 : 0);
    const y = waistY + bob;
    const eyeCol = state === "needs" ? ROSE.dot : (state === "working" ? "#4ade80" : "#64748b");

    // Jointed silver neck
    ctx.fillStyle = "#64748b";
    ctx.fillRect(cx - 4, y - 23, 8, 5);
    ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.strokeRect(cx - 4, y - 23, 8, 5);

    // Metallic chest chassis with crisp dark outline + Engine chest plate
    roundRect(ctx, cx - 15, y - 19, 30, 21, 7);
    ctx.fillStyle = "#e2e8f0"; ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 1.6; ctx.stroke();
    // Colored chest core armor plate + Engine emblem
    roundRect(ctx, cx - 10, y - 15, 20, 13, 4);
    ctx.fillStyle = es.coat; ctx.fill();
    ctx.strokeStyle = es.color; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = es.light;
    ctx.font = "900 9px -apple-system, sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(es.sym, cx, y - 8);
    ctx.textBaseline = "alphabetic";

    // Jointed robot shoulders & arms
    const tapL = state === "working" ? Math.sin(phase * 4.8) * 2.2 : 0;
    const tapR = state === "working" ? Math.cos(phase * 4.8) * 2.2 : 0;
    ctx.fillStyle = "#cbd5e1"; ctx.strokeStyle = INK; ctx.lineWidth = 1.4;
    if (!standing) {
      roundRect(ctx, cx - 21, y - 15 + tapL, 7, 13, 3.5); ctx.fill(); ctx.stroke();
      roundRect(ctx, cx + 14, y - 15 + tapR, 7, 13, 3.5); ctx.fill(); ctx.stroke();
      ctx.fillStyle = es.color;
      ctx.beginPath(); ctx.arc(cx - 17.5, y - 2 + tapL, 3.2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx + 17.5, y - 2 + tapR, 3.2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    } else {
      // Standing pose: right arm relaxed, left arm raised holding report tablet!
      roundRect(ctx, cx + 14, y - 15, 6.5, 14, 3); ctx.fill(); ctx.stroke();
      roundRect(ctx, cx - 21, y - 16, 7, 12, 3); ctx.fill(); ctx.stroke();
    }

    // Glossy Robot Helmet Head
    const hy = y - 34;
    // Antenna
    ctx.strokeStyle = es.color; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.moveTo(cx, hy - 11); ctx.lineTo(cx, hy - 17); ctx.stroke();
    ctx.fillStyle = active ? es.light : es.color;
    ctx.beginPath(); ctx.arc(cx, hy - 18, 2.8, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.stroke();
    // Side ear headphones colored by Engine
    ctx.fillStyle = es.color; ctx.strokeStyle = INK; ctx.lineWidth = 1.3;
    roundRect(ctx, cx - 18, hy - 5, 4.5, 10, 2); ctx.fill(); ctx.stroke();
    roundRect(ctx, cx + 13.5, hy - 5, 4.5, 10, 2); ctx.fill(); ctx.stroke();
    // Helmet shell
    roundRect(ctx, cx - 14.5, hy - 11.5, 29, 22, 8);
    ctx.fillStyle = "#f8fafc"; ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 1.7; ctx.stroke();
    // Top glossy highlight band
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    roundRect(ctx, cx - 10, hy - 9.5, 20, 3, 1.5); ctx.fill();
    // Curved dark glass visor
    roundRect(ctx, cx - 11, hy - 5.5, 22, 11.5, 4);
    ctx.fillStyle = "#0f172a"; ctx.fill();
    ctx.strokeStyle = es.color; ctx.lineWidth = 1.1; ctx.stroke();
    // Expressive glowing eyes
    if (state === "idle") {
      ctx.strokeStyle = "#64748b"; ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.moveTo(cx - 7, hy + 0.5); ctx.lineTo(cx - 2.5, hy + 0.5);
      ctx.moveTo(cx + 2.5, hy + 0.5); ctx.lineTo(cx + 7, hy + 0.5); ctx.stroke();
    } else {
      const look = state === "working" ? Math.sin(phase * 1.4) * 1.2 : -1;
      ctx.fillStyle = eyeCol;
      ctx.beginPath(); ctx.arc(cx - 4.5 + look, hy + 0.2, 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + 4.5 + look, hy + 0.2, 2.5, 0, Math.PI * 2); ctx.fill();
      // Tiny eye sparkle
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(cx - 5.3 + look, hy - 1.2, 1.3, 1.3);
      ctx.fillRect(cx + 3.7 + look, hy - 1.2, 1.3, 1.3);
    }
    return hy;
  }

  function drawSeatedDeskStation(ctx, opts) {
    const { cx, baseY, isLead, isWorking, isStall, isUpstairs, eng, avatarImg, name, phase, hovered, lang, durText } = opts;
    const es = engStyle(eng);
    const deskW = isLead ? 108 : 92;
    const deskTopY = baseY - 21;

    // Ground contact shadow
    ctx.fillStyle = hovered ? "rgba(56, 189, 248, 0.2)" : "rgba(0, 0, 0, 0.34)";
    ctx.beginPath(); ctx.ellipse(cx, baseY + 3, deskW * 0.54, 8, 0, 0, Math.PI * 2); ctx.fill();

    // Ergonomic office chair behind character (mesh backrest + armrests)
    roundRect(ctx, cx - 18, deskTopY - 34, 36, 34, 8);
    ctx.fillStyle = isLead ? "#2c3648" : "#222c3c"; ctx.fill();
    ctx.strokeStyle = isLead ? "rgba(226, 232, 240, 0.28)" : es.border;
    ctx.lineWidth = 1.2; ctx.stroke();
    // Subtle mesh horizontal ribs on chair
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    for (let cy = deskTopY - 28; cy < deskTopY - 6; cy += 5) {
      ctx.beginPath(); ctx.moveTo(cx - 14, cy); ctx.lineTo(cx + 14, cy); ctx.stroke();
    }

    // Crisp full-upper-body Character sitting cleanly above desk!
    if (!isUpstairs) {
      if (isLead) {
        const hy = drawBotUpperBody(ctx, cx - 4, deskTopY + 3, es, isWorking, phase);
        const ring = isStall ? "#fbbf24" : (isWorking ? es.color : "#cbd5e1");
        drawBotHead(ctx, cx - 4, hy, 15.5, avatarImg, name, ring);
      } else {
        drawRobotSprite(ctx, cx - 4, deskTopY + 3, es, isWorking ? "working" : "idle", phase, false);
      }
      if (!isWorking) {
        ctx.fillStyle = "rgba(203, 213, 225, 0.72)";
        ctx.font = "700 9.5px ui-monospace, monospace";
        ctx.textAlign = "left";
        ctx.fillText("zZ", cx + 16, deskTopY - 36);
      }
    }

    // Modern 2.5D Office Desk (warm oak top + clean metal/wood apron + legs)
    const x0 = cx - deskW / 2;
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(x0 + 5, deskTopY + 13, 4.5, 10);
    ctx.fillRect(x0 + deskW - 9.5, deskTopY + 13, 4.5, 10);
    roundRect(ctx, x0, deskTopY + 7, deskW, 13, 2);
    ctx.fillStyle = isLead ? "#69452a" : "#334155"; ctx.fill();
    ctx.strokeStyle = hovered ? "#7dd3fc" : INK; ctx.lineWidth = hovered ? 1.5 : 1.1; ctx.stroke();
    // Engine accent trim strip
    ctx.fillStyle = es.color;
    ctx.globalAlpha = isWorking ? 0.9 : 0.4;
    ctx.fillRect(x0 + 3, deskTopY + 8, deskW - 6, 2.2);
    ctx.globalAlpha = 1;
    // Oblique wood tabletop
    ctx.beginPath();
    ctx.moveTo(x0 + 4, deskTopY); ctx.lineTo(x0 + deskW - 4, deskTopY);
    ctx.lineTo(x0 + deskW, deskTopY + 8); ctx.lineTo(x0, deskTopY + 8); ctx.closePath();
    ctx.fillStyle = isLead ? "#a6754b" : "#64748b"; ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.16)"; ctx.lineWidth = 0.8; ctx.stroke();

    // Compact keyboard in front of character hands
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(cx - 17, deskTopY + 2, 24, 3.5);
    ctx.fillStyle = "#94a3b8";
    ctx.fillRect(cx - 15, deskTopY + 3, 20, 1.5);

    // Side-mounted widescreen monitor (kept right so character torso stays 100% clear!)
    const mx = cx + (isLead ? 33 : 27);
    const my = deskTopY - 12;
    ctx.fillStyle = "#475569";
    ctx.fillRect(mx - 2, my + 12, 4, 4);
    ctx.fillRect(mx - 6, my + 15, 12, 2);
    roundRect(ctx, mx - 13, my - 3, 26, 16, 2.5);
    ctx.fillStyle = "#0f172a"; ctx.fill();
    ctx.strokeStyle = isWorking ? es.color : "#64748b"; ctx.lineWidth = 1.3; ctx.stroke();
    if (isWorking) {
      const scan = Math.floor(phase * 3) % 3;
      ctx.fillStyle = isStall ? "#fbbf24" : es.light;
      ctx.fillRect(mx - 9.5, my + 0.5, 11 + (scan === 0 ? 4 : 0), 2);
      ctx.fillStyle = "#4ade80";
      ctx.fillRect(mx - 9.5, my + 4.2, 16 - (scan === 1 ? 5 : 0), 2);
      ctx.fillStyle = es.color;
      ctx.fillRect(mx - 9.5, my + 7.9, 13, 2);
    } else {
      ctx.fillStyle = "rgba(148,163,184,0.25)";
      ctx.fillRect(mx - 8, my + 3, 16, 2);
    }

    // Ceramic coffee mug on far left
    ctx.fillStyle = "#f8fafc";
    roundRect(ctx, x0 + 7, deskTopY - 2, 6, 6, 1.5); ctx.fill();

    // Away note when character is upstairs in Decision & Report Queue
    if (isUpstairs) {
      const tag = lang === "zh" ? "▲ 排队汇报中" : "▲ In Report Queue";
      ctx.font = "700 9px -apple-system, 'PingFang SC', sans-serif";
      const tw = ctx.measureText(tag).width + 12;
      roundRect(ctx, cx - tw / 2, deskTopY - 38, tw, 15, 5);
      ctx.fillStyle = ROSE.bubbleBg; ctx.fill();
      ctx.strokeStyle = ROSE.border; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = ROSE.text; ctx.textAlign = "center";
      ctx.fillText(tag, cx, deskTopY - 27.5);
    }

    drawNameAndEngine(ctx, cx, baseY + 5, name, eng, durText, isStall, isLead ? 108 : 98);
  }

  function drawStandingQueueActor(ctx, opts) {
    const { cx, footY, isBot, eng, avatarImg, name, snippet, count, phase, hovered } = opts;
    const es = engStyle(eng);
    const sway = Math.sin(phase * 1.5) * 0.9;

    // Ground contact shadow
    ctx.fillStyle = hovered ? "rgba(251, 113, 133, 0.28)" : "rgba(0, 0, 0, 0.38)";
    ctx.beginPath(); ctx.ellipse(cx, footY + 2, 19, 6, 0, 0, Math.PI * 2); ctx.fill();

    let headY;
    if (isBot) {
      // Standing Bot legs & office shoes
      ctx.fillStyle = "#1e293b"; ctx.strokeStyle = INK; ctx.lineWidth = 1.4;
      roundRect(ctx, cx - 9, footY - 14, 7.5, 13, 3); ctx.fill(); ctx.stroke();
      roundRect(ctx, cx + 1.5, footY - 14, 7.5, 13, 3); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#0f172a";
      roundRect(ctx, cx - 11.5, footY - 4, 9.5, 4.5, 2); ctx.fill(); ctx.stroke();
      roundRect(ctx, cx + 0.5, footY - 4, 9.5, 4.5, 2); ctx.fill(); ctx.stroke();

      // Full tailored office jacket torso + crisp collar
      const wy = footY - 12 + sway;
      ctx.fillStyle = "#f5d0a9"; ctx.fillRect(cx - 3.5, wy - 24, 7, 5);
      roundRect(ctx, cx - 14, wy - 20, 28, 21, 7);
      ctx.fillStyle = es.coat; ctx.fill();
      ctx.strokeStyle = hovered ? "#fda4af" : INK; ctx.lineWidth = 1.6; ctx.stroke();
      ctx.fillStyle = "#f8fafc";
      ctx.beginPath(); ctx.moveTo(cx - 5, wy - 20); ctx.lineTo(cx + 5, wy - 20); ctx.lineTo(cx, wy - 12); ctx.closePath(); ctx.fill();
      // Right arm relaxed + left arm holding clipboard toward Decision Desk
      ctx.fillStyle = es.coat; ctx.strokeStyle = INK; ctx.lineWidth = 1.4;
      roundRect(ctx, cx + 12, wy - 16, 6.5, 13, 3); ctx.fill(); ctx.stroke();
      roundRect(ctx, cx - 19, wy - 17, 7, 12, 3); ctx.fill(); ctx.stroke();

      headY = wy - 35;
      drawBotHead(ctx, cx, headY, 15.5, avatarImg, name, ROSE.stroke);
    } else {
      // Standing Worker Robot articulated legs & boots
      ctx.fillStyle = "#94a3b8"; ctx.strokeStyle = INK; ctx.lineWidth = 1.4;
      roundRect(ctx, cx - 9, footY - 13, 6.5, 11, 2.5); ctx.fill(); ctx.stroke();
      roundRect(ctx, cx + 2.5, footY - 13, 6.5, 11, 2.5); ctx.fill(); ctx.stroke();
      ctx.fillStyle = es.coat;
      roundRect(ctx, cx - 11, footY - 4.5, 9, 5, 2); ctx.fill(); ctx.stroke();
      roundRect(ctx, cx + 1.5, footY - 4.5, 9, 5, 2); ctx.fill(); ctx.stroke();

      headY = drawRobotSprite(ctx, cx, footY - 12, es, "needs", phase, true);
    }

    // Crisp luminous Report Clipboard / Folder held forward toward Decision Desk!
    ctx.save();
    ctx.translate(cx - 19, footY - 26 + sway);
    ctx.rotate(-0.15);
    roundRect(ctx, -6, -8, 12, 15, 2);
    ctx.fillStyle = "#f8fafc"; ctx.fill();
    ctx.strokeStyle = ROSE.dot; ctx.lineWidth = 1.3; ctx.stroke();
    ctx.fillStyle = "#64748b";
    ctx.fillRect(-3.5, -4, 7, 1.5); ctx.fillRect(-3.5, -0.5, 6, 1.5); ctx.fillRect(-3.5, 3, 5, 1.5);
    ctx.restore();

    // Soft rose clickable alert dot
    const dotHit = drawSoftRoseDot(ctx, cx + 15, headY - 12, count, phase);

    // Compact Report Speech Bubble cleanly positioned above head
    if (snippet) {
      ctx.font = "600 9.5px -apple-system, 'PingFang SC', sans-serif";
      const txt = trimText(ctx, snippet, 98);
      const bw = Math.min(112, Math.max(48, ctx.measureText(txt).width + 14));
      const bx = cx - bw / 2;
      const by = headY - 37;
      roundRect(ctx, bx, by, bw, 16, 6);
      ctx.fillStyle = ROSE.bubbleBg; ctx.fill();
      ctx.strokeStyle = ROSE.border; ctx.lineWidth = 1; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx - 4, by + 16); ctx.lineTo(cx, by + 20); ctx.lineTo(cx + 4, by + 16);
      ctx.fillStyle = ROSE.bubbleBg; ctx.fill();
      ctx.fillStyle = ROSE.text; ctx.textAlign = "center";
      ctx.fillText(txt, cx, by + 11.2);
    }

    drawNameAndEngine(ctx, cx, footY + 6, name, eng, "", false, 100);
    return dotHit;
  }

  function drawDecisionDesk(ctx, x, footY, lang, phase) {
    // Sleek modern Decision / Review Desk (no "Boss" crown — clean architectural workstation!)
    ctx.fillStyle = "rgba(0, 0, 0, 0.36)";
    ctx.beginPath(); ctx.ellipse(x + 58, footY + 3, 64, 10, 0, 0, Math.PI * 2); ctx.fill();

    // Modern ergonomic chair
    roundRect(ctx, x + 28, footY - 58, 38, 36, 9);
    ctx.fillStyle = "#263144"; ctx.fill();
    ctx.strokeStyle = "rgba(148, 163, 184, 0.38)"; ctx.lineWidth = 1.3; ctx.stroke();

    // Reviewer / You seated cleanly behind the Decision Desk (crisp modern hoodie + glasses!)
    const bob = Math.sin(phase * 0.9) * 0.5;
    // Neck & smart slate-navy sweater + white collar
    ctx.fillStyle = "#f5d0a9"; ctx.fillRect(x + 43.5, footY - 39 + bob, 7, 5);
    roundRect(ctx, x + 31, footY - 35 + bob, 32, 18, 7);
    ctx.fillStyle = "#334155"; ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = "#f8fafc";
    ctx.beginPath(); ctx.moveTo(x + 42, footY - 35 + bob); ctx.lineTo(x + 52, footY - 35 + bob); ctx.lineTo(x + 47, footY - 27 + bob); ctx.closePath(); ctx.fill();
    // Head + clean hair + subtle modern glasses looking right toward the queue
    ctx.fillStyle = "#f5d0a9"; ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(x + 47, footY - 48 + bob, 12.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#1e293b";
    ctx.beginPath(); ctx.arc(x + 47, footY - 52.5 + bob, 12.6, Math.PI * 1.0, Math.PI * 0.0); ctx.fill();
    ctx.strokeStyle = "#334155"; ctx.lineWidth = 1.3;
    ctx.strokeRect(x + 42, footY - 50 + bob, 5, 4);
    ctx.strokeRect(x + 49, footY - 50 + bob, 5, 4);
    ctx.beginPath(); ctx.moveTo(x + 47, footY - 48 + bob); ctx.lineTo(x + 49, footY - 48 + bob); ctx.stroke();
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(x + 44, footY - 48.5 + bob, 1.8, 1.8);
    ctx.fillRect(x + 51, footY - 48.5 + bob, 1.8, 1.8);

    // Modern Warm-Oak & Matte-Steel Decision Desk
    const dw = 116;
    const ty = footY - 23;
    roundRect(ctx, x, ty + 8, dw, 19, 3);
    ctx.fillStyle = "#3b475c"; ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.fillStyle = "rgba(56, 189, 248, 0.35)";
    ctx.fillRect(x + 4, ty + 9, dw - 8, 2);
    // Crisp minimalist desk nameplate: 决策台 / REVIEW
    roundRect(ctx, x + dw / 2 - 22, ty + 13, 44, 11, 3);
    ctx.fillStyle = "#1e293b"; ctx.fill();
    ctx.strokeStyle = "rgba(148, 163, 184, 0.55)"; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = "#f1f5f9";
    ctx.font = "800 8px -apple-system, 'PingFang SC', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(lang === "zh" ? "决策台" : "REVIEW", x + dw / 2, ty + 21);

    // Warm oak oblique top
    ctx.beginPath();
    ctx.moveTo(x + 5, ty); ctx.lineTo(x + dw - 5, ty);
    ctx.lineTo(x + dw, ty + 9); ctx.lineTo(x, ty + 9); ctx.closePath();
    ctx.fillStyle = "#a6754b"; ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.18)"; ctx.lineWidth = 0.8; ctx.stroke();

    // Sleek architectural desk lamp on left
    ctx.fillStyle = "#cbd5e1"; ctx.fillRect(x + 11, ty + 2, 10, 2.5);
    ctx.strokeStyle = "#cbd5e1"; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(x + 15, ty + 2); ctx.lineTo(x + 12, ty - 7); ctx.lineTo(x + 20, ty - 11); ctx.stroke();
    ctx.fillStyle = "#fef08a"; ctx.fillRect(x + 18, ty - 11, 6, 2.5);

    // Laptop + steaming ceramic coffee mug on right
    ctx.fillStyle = "#cbd5e1"; ctx.fillRect(x + 70, ty + 1, 22, 3);
    ctx.fillStyle = "#1e293b";
    ctx.beginPath(); ctx.moveTo(x + 73, ty + 1); ctx.lineTo(x + 89, ty + 1); ctx.lineTo(x + 85, ty - 10); ctx.lineTo(x + 69, ty - 10); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#f8fafc";
    roundRect(ctx, x + 98, ty - 2, 7, 6.5, 1.5); ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.4)"; ctx.lineWidth = 1;
    const st = Math.sin(phase * 1.8) * 1.4;
    ctx.beginPath(); ctx.moveTo(x + 101, ty - 4); ctx.quadraticCurveTo(x + 101 + st, ty - 9, x + 102, ty - 13); ctx.stroke();
  }

  /* ── Sleek Luminous Message Stream (Paper-Dart + Fading Light Trail) ── */

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

    ctx.save();
    ctx.strokeStyle = kind === "alert" ? "rgba(251, 113, 133, 0.18)" : "rgba(56, 189, 248, 0.16)";
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 5]);
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.quadraticCurveTo(midX, midY, x2, y2); ctx.stroke();
    ctx.setLineDash([]);

    for (let i = 4; i >= 1; i--) {
      const tp = progress - i * 0.045;
      if (tp < 0 || tp > 1) continue;
      const p = pt(tp);
      ctx.globalAlpha = (5 - i) * 0.14;
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(p.x, p.y, 1.6 + (4 - i) * 0.45, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;

    const head = pt(progress);
    const prev = pt(Math.max(0, progress - 0.03));
    const ang = Math.atan2(head.y - prev.y, head.x - prev.x);

    ctx.translate(head.x, head.y);
    ctx.rotate(ang);
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.25;
    ctx.beginPath(); ctx.arc(0, 0, 7.5, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = light;
    ctx.beginPath();
    ctx.moveTo(6.5, 0); ctx.lineTo(-4.5, -3.8); ctx.lineTo(-2.2, 0); ctx.lineTo(-4.5, 3.8);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.stroke();
    ctx.restore();
  }

  window.OfficeSprites = {
    ENG_STYLES, FLOOR_THEMES, ROSE, engStyle, hashStr, trimText, roundRect,
    fmtDur, isStalled, drawBuildingShell, drawBuildingColumns, drawCeilingLightBar,
    drawWoodSlats, drawCurtainWallWindow, drawOfficeFloor, drawElevatorLobby,
    drawOfficeProp, drawPottedPlant, drawEngineBadge, drawNameAndEngine,
    drawSoftRoseDot, drawBotHead, drawBotUpperBody, drawRobotSprite,
    drawSeatedDeskStation, drawStandingQueueActor, drawDecisionDesk, drawMessageStream,
  };
})();
