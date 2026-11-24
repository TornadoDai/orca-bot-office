/**
 * DNF-Style 2.5D Oblique Stacked Floor Scenes & Ultra-Lightweight Engine
 * - Static background cached offscreen per floor
 * - 0 FPS on idle floors, ~3.5 FPS setInterval only on active floors (zero 60Hz rAF overhead)
 */
(function () {
  const {
    FLOOR_THEMES, engStyle, hashStr, roundRect, fmtDur, isStalled,
    drawSkylineWindow, drawElevatorDoors, drawPendantLamp, drawPottedPlant,
    drawPerspectiveFloor, drawWallDecor, drawNameAndEngine, drawAvatarHead,
    drawSeatedDeskStation, drawStandingQueueActor, drawBossExecutiveDesk,
    drawMessageStream,
  } = window.OfficeSprites;

  /* ── Single DNF 2.5D Floor View (Static BG Cache + Low-FPS Dynamic Overlay) ── */

  class FloorScene {
    constructor(canvas, spec, shared) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d");
      this.bgCanvas = document.createElement("canvas");
      this.bgCtx = this.bgCanvas.getContext("2d");
      this.spec = spec;
      this.shared = shared;
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.W = 640;
      this.H = 180;
      this.wallH = 72;
      this.hitNodes = [];
      this.hoveredId = null;
      this.phase = Math.random() * 6;
      this.needsAnimation = false;
      this._bindEvents();
      this.layoutAndBake();
    }

    _bindEvents() {
      this.canvas.addEventListener("mousemove", (e) => {
        const pt = this._pt(e);
        const hit = this._hitTest(pt.x, pt.y);
        const nextId = hit ? hit.id : null;
        this.canvas.style.cursor = hit ? "pointer" : "default";
        if (nextId !== this.hoveredId) {
          this.hoveredId = nextId;
          this.drawDynamic();
        }
      });
      this.canvas.addEventListener("mouseleave", () => {
        if (this.hoveredId) {
          this.hoveredId = null;
          this.canvas.style.cursor = "default";
          this.drawDynamic();
        }
      });
      this.canvas.addEventListener("click", (e) => {
        const pt = this._pt(e);
        const hit = this._hitTest(pt.x, pt.y);
        if (!hit) return;
        if (hit.isRoseDot) this.shared.onRedDotClick(hit);
        else this.shared.onActorClick(hit);
      });
      this.canvas.addEventListener("dblclick", (e) => {
        const pt = this._pt(e);
        const hit = this._hitTest(pt.x, pt.y);
        if (hit) this.shared.onActorDblClick(hit);
      });
    }

    _pt(e) {
      const r = this.canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    }

    _hitTest(x, y) {
      for (let i = this.hitNodes.length - 1; i >= 0; i--) {
        const n = this.hitNodes[i];
        if (n.dotHit) {
          const dx = x - n.dotHit.x, dy = y - n.dotHit.y;
          if (dx * dx + dy * dy <= n.dotHit.r * n.dotHit.r) return { ...n, isRoseDot: true };
        }
      }
      for (let i = this.hitNodes.length - 1; i >= 0; i--) {
        const n = this.hitNodes[i];
        if (x >= n.box.x && x <= n.box.x + n.box.w && y >= n.box.y && y <= n.box.y + n.box.h) {
          return { ...n, isRoseDot: false };
        }
      }
      return null;
    }

    layoutAndBake() {
      const parentW = this.canvas.parentElement?.clientWidth || 640;
      this.W = Math.max(360, Math.round(parentW));
      const sp = this.spec;

      if (sp.kind === "boss") {
        this.wallH = 64;
        const q = sp.queue || [];
        if (q.length === 0) {
          this.H = 142;
          this.needsAnimation = false;
        } else {
          const availW = Math.max(180, this.W - 210);
          this.bossPerRow = Math.max(2, Math.min(4, Math.floor(availW / 108)));
          const rows = Math.ceil(q.length / this.bossPerRow);
          this.H = 122 + rows * 94;
          this.needsAnimation = true;
        }
      } else if (sp.kind === "team") {
        this.wallH = 68;
        const workers = sp.visibleWorkers || [];
        const bayW = Math.max(170, this.W - 224);
        this.teamPerRow = Math.max(2, Math.min(3, Math.floor(bayW / 128)));
        const rows = Math.max(1, Math.ceil(workers.length / this.teamPerRow));
        this.H = 104 + rows * 98;
        this.needsAnimation =
          sp.bot.state === "working" ||
          workers.some((w) => w.state === "working" || w.needsDecision);
      } else {
        this.wallH = 68;
        const active = sp.activeSolos || [];
        const idle = sp.idleSolos || [];
        const leftRows = Math.max(1, Math.ceil(active.length / 2));
        const rightRows = Math.max(1, Math.ceil(idle.length / 3));
        const rows = Math.max(leftRows, rightRows);
        this.H = 104 + rows * 98;
        this.needsAnimation = active.length > 0;
      }

      this.canvas.width = Math.round(this.W * this.dpr);
      this.canvas.height = Math.round(this.H * this.dpr);
      this.canvas.style.width = `${this.W}px`;
      this.canvas.style.height = `${this.H}px`;

      this.bgCanvas.width = this.canvas.width;
      this.bgCanvas.height = this.canvas.height;
      const bg = this.bgCtx;
      bg.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      bg.clearRect(0, 0, this.W, this.H);

      if (sp.kind === "boss") this._bakeBossBg(bg);
      else if (sp.kind === "team") this._bakeTeamBg(bg);
      else this._bakeLoungeBg(bg);

      this.drawDynamic();
    }

    _bakeBossBg(ctx) {
      const { W, H, wallH } = this;
      // Warm walnut executive wall
      const wg = ctx.createLinearGradient(0, 0, 0, wallH);
      wg.addColorStop(0, "#1c1522");
      wg.addColorStop(1, "#2a1f2d");
      ctx.fillStyle = wg;
      ctx.fillRect(0, 0, W, wallH);
      // Subtle walnut vertical wainscoting slats
      ctx.strokeStyle = "rgba(251, 191, 36, 0.055)";
      ctx.lineWidth = 1;
      for (let sx = 16; sx < W; sx += 26) {
        ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx, wallH); ctx.stroke();
      }
      // Gold wainscot rail + baseboard
      ctx.fillStyle = "rgba(251, 191, 36, 0.24)";
      ctx.fillRect(0, wallH - 5, W, 2);
      ctx.fillStyle = "#140e16";
      ctx.fillRect(0, wallH - 3, W, 3);

      // Panoramic skyline window centered behind Boss & Queue
      const winW = Math.min(250, Math.max(140, W - 220));
      drawSkylineWindow(ctx, Math.round(W * 0.45 - winW / 2), 9, winW, 42, true);
      drawPendantLamp(ctx, 88, wallH, "rgba(251, 191, 36, 0.11)");
      drawPendantLamp(ctx, W - 110, wallH, "rgba(251, 191, 36, 0.08)");
      drawElevatorDoors(ctx, W - 46, wallH, false, this.spec.lang);

      // Hardwood perspective floor
      drawPerspectiveFloor(ctx, W, wallH, H, "#23191e", "#2d2026", true);

      // Plush burgundy/plum VIP runner carpet from elevator toward Boss Desk
      const carpY = wallH + 16;
      const carpH = Math.max(36, H - wallH - 34);
      roundRect(ctx, 134, carpY, W - 186, carpH, 6);
      ctx.fillStyle = "rgba(136, 19, 55, 0.26)";
      ctx.fill();
      ctx.strokeStyle = "rgba(251, 191, 36, 0.28)";
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // Executive potted plant beside elevator
      drawPottedPlant(ctx, W - 62, wallH + 14, 0.9);
    }

    _bakeTeamBg(ctx) {
      const { W, H, wallH } = this;
      const theme = FLOOR_THEMES[hashStr(this.spec.bot.name || this.spec.bot.id) % FLOOR_THEMES.length];

      // Straight back wall
      const wg = ctx.createLinearGradient(0, 0, 0, wallH);
      wg.addColorStop(0, theme.wallTop);
      wg.addColorStop(1, theme.wallBot);
      ctx.fillStyle = wg;
      ctx.fillRect(0, 0, W, wallH);
      ctx.fillStyle = "rgba(148, 163, 184, 0.2)";
      ctx.fillRect(0, wallH - 4, W, 4);

      // Windows & Wall Decor
      drawSkylineWindow(ctx, 20, 12, 112, 44, false);
      const midWinW = Math.min(130, Math.max(76, W - 360));
      drawSkylineWindow(ctx, 186, 12, midWinW, 44, false);
      if (W > 460) {
        drawWallDecor(ctx, 196 + midWinW + 18, 16, theme.prop, theme.accent);
      }

      // Warm pendant lights
      drawPendantLamp(ctx, 84, wallH, "rgba(253, 224, 71, 0.08)");
      drawPendantLamp(ctx, Math.round((180 + W - 56) / 2), wallH, "rgba(125, 211, 252, 0.07)");

      // Right-edge Elevator Doors
      drawElevatorDoors(ctx, W - 46, wallH, (this.spec.crossHandoffs || []).length > 0, this.spec.lang);

      // Perspective Studio Floor
      drawPerspectiveFloor(ctx, W, wallH, H, theme.floorA, theme.floorB, false);

      // Lead Bot Zone Rug (Left)
      roundRect(ctx, 14, wallH + 12, 142, H - wallH - 22, 8);
      ctx.fillStyle = theme.rug;
      ctx.fill();
      ctx.strokeStyle = theme.accent;
      ctx.globalAlpha = 0.28;
      ctx.lineWidth = 1; ctx.stroke();
      ctx.globalAlpha = 1;

      // Glass partition between Lead Bot office & Worker bay
      const px = 165;
      ctx.fillStyle = "rgba(148, 163, 184, 0.14)";
      ctx.fillRect(px, wallH - 40, 4, H - wallH + 34);
      ctx.strokeStyle = "rgba(186, 230, 253, 0.34)";
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(px + 2, wallH - 40); ctx.lineTo(px + 2, H - 6); ctx.stroke();

      // Potted plant near partition
      drawPottedPlant(ctx, px - 14, wallH + 12, 0.8);
    }

    _bakeLoungeBg(ctx) {
      const { W, H, wallH } = this;
      const wg = ctx.createLinearGradient(0, 0, 0, wallH);
      wg.addColorStop(0, "#1c1816");
      wg.addColorStop(1, "#2b221e");
      ctx.fillStyle = wg;
      ctx.fillRect(0, 0, W, wallH);
      ctx.fillStyle = "rgba(251, 191, 36, 0.2)";
      ctx.fillRect(0, wallH - 4, W, 4);

      drawSkylineWindow(ctx, 20, 12, 120, 44, false);
      drawWallDecor(ctx, 160, 15, "books", "#fbbf24");

      // Warm CAFÉ sign + Espresso counter on right back wall
      const barX = Math.max(240, W - 182);
      roundRect(ctx, barX + 18, 10, 44, 16, 4);
      ctx.fillStyle = "#1c120d"; ctx.fill();
      ctx.strokeStyle = "rgba(251, 191, 36, 0.55)"; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = "#fde68a";
      ctx.font = "800 9px -apple-system, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("CAFÉ", barX + 40, 21);

      // Espresso bar counter
      roundRect(ctx, barX, wallH - 22, 114, 24, 3);
      ctx.fillStyle = "#5c3a21"; ctx.fill();
      ctx.fillStyle = "#8a5a36"; ctx.fillRect(barX - 2, wallH - 24, 118, 5);
      // Espresso machine
      roundRect(ctx, barX + 14, wallH - 40, 26, 17, 2);
      ctx.fillStyle = "#cbd5e1"; ctx.fill();
      ctx.fillStyle = "#1e293b"; ctx.fillRect(barX + 18, wallH - 34, 18, 9);
      ctx.fillStyle = "#f59e0b"; ctx.fillRect(barX + 34, wallH - 38, 3, 2);
      // Cups on bar
      ctx.fillStyle = "#fef3c7";
      ctx.fillRect(barX + 54, wallH - 30, 6, 6);
      ctx.fillRect(barX + 64, wallH - 30, 6, 6);

      drawPendantLamp(ctx, 90, wallH, "rgba(253, 224, 71, 0.1)");
      drawPendantLamp(ctx, barX + 56, wallH, "rgba(251, 191, 36, 0.12)");
      drawElevatorDoors(ctx, W - 46, wallH, (this.spec.crossHandoffs || []).length > 0, this.spec.lang);

      // Warm oak floor
      drawPerspectiveFloor(ctx, W, wallH, H, "#1f1916", "#28201b", true);

      // Cozy lounge rug on right half
      const splitX = Math.round(W * 0.44);
      roundRect(ctx, splitX, wallH + 14, W - splitX - 54, H - wallH - 24, 9);
      ctx.fillStyle = "rgba(180, 83, 9, 0.14)";
      ctx.fill();
      ctx.strokeStyle = "rgba(251, 191, 36, 0.22)";
      ctx.lineWidth = 1; ctx.stroke();

      drawPottedPlant(ctx, splitX - 10, wallH + 14, 0.85);
    }

    drawDynamic() {
      const ctx = this.ctx;
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.clearRect(0, 0, this.W, this.H);
      ctx.drawImage(this.bgCanvas, 0, 0, this.W, this.H);
      this.hitNodes = [];

      if (this.spec.kind === "boss") this._drawBossDynamic(ctx);
      else if (this.spec.kind === "team") this._drawTeamDynamic(ctx);
      else this._drawLoungeDynamic(ctx);
    }

    _drawBossDynamic(ctx) {
      const { W, H, wallH } = this;
      const queue = this.spec.queue || [];
      const lang = this.spec.lang;

      // Owner's Executive Desk on the left
      const bossFootY = queue.length === 0 ? H - 22 : wallH + 74;
      drawBossExecutiveDesk(ctx, 18, bossFootY, lang, this.phase);

      if (queue.length === 0) {
        const msg = lang === "zh" ? "☕ 当前无人排队汇报 · 各团队自主推进中" : "☕ Queue clear · All teams running autonomously";
        ctx.font = "600 11px -apple-system, 'PingFang SC', sans-serif";
        const tw = ctx.measureText(msg).width + 24;
        const cx = Math.round((150 + W - 56) / 2);
        const cy = Math.round((wallH + H) / 2);
        roundRect(ctx, cx - tw / 2, cy - 14, tw, 28, 999);
        ctx.fillStyle = "rgba(15, 23, 42, 0.62)";
        ctx.fill();
        ctx.strokeStyle = "rgba(251, 191, 36, 0.22)";
        ctx.lineWidth = 1; ctx.stroke();
        ctx.fillStyle = "#cbd5e1";
        ctx.textAlign = "center";
        ctx.fillText(msg, cx, cy + 4);
        return;
      }

      // Queueing Bots & Workers standing along the velvet runner facing the Boss
      const perRow = this.bossPerRow || 3;
      const startX = 186;
      const usableW = Math.max(180, W - 246);
      const stepX = Math.min(122, usableW / Math.max(1, Math.min(queue.length, perRow)));

      queue.forEach((entry, i) => {
        const row = Math.floor(i / perRow);
        const col = i % perRow;
        const cx = startX + col * stepX + 36;
        const footY = wallH + 80 + row * 94 + (col % 2 === 1 ? 3 : 0);
        const nodeId = entry.kind === "bot" ? `bossq:bot:${entry.bot.id}` : `bossq:worker:${entry.worker.worktreeId}`;
        const avImg = entry.kind === "bot" ? this.shared.getAvatarImg(entry.bot.id, entry.bot.name) : null;

        const dotHit = drawStandingQueueActor(ctx, {
          cx,
          footY,
          isBot: entry.kind === "bot",
          eng: entry.kind === "bot" ? entry.bot.agent : entry.worker.agentType,
          avatarImg: avImg,
          name: entry.kind === "bot" ? entry.bot.name : entry.worker.displayName,
          snippet: entry.snippet,
          count: entry.count || 1,
          phase: this.phase + i * 0.7,
          hovered: this.hoveredId === nodeId,
        });

        this.hitNodes.push({
          id: nodeId,
          kind: entry.kind,
          bot: entry.bot,
          worker: entry.worker,
          dotHit,
          box: { x: cx - 44, y: footY - 68, w: 88, h: 102 },
        });
      });
    }

    _drawTeamDynamic(ctx) {
      const { W, wallH } = this;
      const b = this.spec.bot;
      const workers = this.spec.visibleWorkers || [];
      const lang = this.spec.lang;
      const now = Date.now();

      // Lead Bot Desk (Left Zone)
      const leadX = 86;
      const leadY = wallH + 54;
      const leadId = `team:bot:${b.id}`;
      const bStall = isStalled(b);
      const bDur = b.state === "working" && b.stateStartedAt ? `${bStall ? "⚠ " : ""}${fmtDur(now - b.stateStartedAt)}` : "";
      drawSeatedDeskStation(ctx, {
        cx: leadX,
        baseY: leadY,
        isLead: true,
        isWorking: b.state === "working" || b.workingWorkerCount > 0,
        isStall: bStall,
        isUpstairs: Boolean(b.selfNeedsDecision),
        eng: b.agent,
        avatarImg: this.shared.getAvatarImg(b.id, b.name),
        name: b.name,
        phase: this.phase,
        hovered: this.hoveredId === leadId,
        lang,
        durText: bDur,
      });

      this.hitNodes.push({
        id: leadId,
        kind: "bot",
        bot: b,
        dotHit: null,
        box: { x: leadX - 54, y: leadY - 56, w: 108, h: 94 },
      });

      // Workers in DNF Multi-Row Bay (Right Zone)
      const perRow = this.teamPerRow || 3;
      const bayStartX = 186;
      const bayW = Math.max(160, W - 242);
      const workerCoords = [];

      if (workers.length === 0) {
        const txt = lang === "zh" ? "当前无活跃 Worker（闲置已收起或待派发）" : "No active Workers in bay";
        ctx.fillStyle = "rgba(148, 163, 184, 0.55)";
        ctx.font = "600 11px -apple-system, 'PingFang SC', sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(txt, bayStartX + bayW / 2, wallH + 58);
      } else {
        workers.forEach((w, idx) => {
          const row = Math.floor(idx / perRow);
          const col = idx % perRow;
          const gridCols = Math.min(perRow, workers.length);
          const cellW = bayW / Math.max(gridCols, 1);
          const wx = bayStartX + cellW * col + cellW / 2;
          const wy = wallH + 58 + row * 98;
          const wId = `team:worker:${w.worktreeId}`;
          const wStall = isStalled(w);
          const wDur = w.state === "working" && w.stateStartedAt ? `${wStall ? "⚠ " : ""}${fmtDur(now - w.stateStartedAt)}` : "";

          drawSeatedDeskStation(ctx, {
            cx: wx,
            baseY: wy,
            isLead: false,
            isWorking: w.state === "working",
            isStall: wStall,
            isUpstairs: Boolean(w.needsDecision),
            eng: w.agentType,
            avatarImg: null,
            name: w.displayName,
            phase: this.phase + idx * 0.9,
            hovered: this.hoveredId === wId,
            lang,
            durText: wDur,
          });

          workerCoords.push({ w, x: wx, y: wy - 20 });
          this.hitNodes.push({
            id: wId,
            kind: "worker",
            worker: w,
            bot: b,
            dotHit: null,
            box: { x: wx - 46, y: wy - 54, w: 92, h: 92 },
          });
        });
      }

      // Sleek Luminous Message Streams between Lead Bot & Active Workers (NO ugly envelopes!)
      workerCoords.forEach(({ w, x, y }, idx) => {
        if (w.state !== "working" || w.needsDecision) return;
        const cycle = (this.phase * 0.22 + idx * 0.37) % 2;
        if (cycle < 1) {
          drawMessageStream(ctx, leadX + 42, leadY - 24, x - 34, y, cycle, "dispatch");
        } else {
          drawMessageStream(ctx, x - 34, y, leadX + 42, leadY - 24, cycle - 1, "reply");
        }
      });
    }

    _drawLoungeDynamic(ctx) {
      const { W, wallH } = this;
      const active = this.spec.activeSolos || [];
      const idle = this.spec.idleSolos || [];
      const lang = this.spec.lang;
      const now = Date.now();
      const splitX = Math.round(W * 0.44);

      // Left Zone: Hot desks for working solo Bots
      if (active.length === 0) {
        const txt = lang === "zh" ? "开放工位空闲中" : "Hot desks open";
        ctx.fillStyle = "rgba(148, 163, 184, 0.45)";
        ctx.font = "600 10.5px -apple-system, 'PingFang SC', sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(txt, splitX / 2, wallH + 58);
      } else {
        active.forEach((b, i) => {
          const row = Math.floor(i / 2);
          const col = i % 2;
          const cols = Math.min(2, active.length - row * 2);
          const cellW = (splitX - 24) / cols;
          const bx = 12 + cellW * col + cellW / 2;
          const by = wallH + 58 + row * 98;
          const nodeId = `lounge:bot:${b.id}`;
          const bStall = isStalled(b);
          const bDur = b.state === "working" && b.stateStartedAt ? `${bStall ? "⚠ " : ""}${fmtDur(now - b.stateStartedAt)}` : "";

          drawSeatedDeskStation(ctx, {
            cx: bx,
            baseY: by,
            isLead: true,
            isWorking: b.state === "working",
            isStall: bStall,
            isUpstairs: Boolean(b.selfNeedsDecision),
            eng: b.agent,
            avatarImg: this.shared.getAvatarImg(b.id, b.name),
            name: b.name,
            phase: this.phase + i * 0.6,
            hovered: this.hoveredId === nodeId,
            lang,
            durText: bDur,
          });
          this.hitNodes.push({
            id: nodeId,
            kind: "bot",
            bot: b,
            dotHit: null,
            box: { x: bx - 50, y: by - 54, w: 100, h: 92 },
          });
        });
      }

      // Right Zone: Cozy DNF Velvet Sofas for idle solo Bots + Ginger Cat
      const rightStart = splitX + 14;
      const rightW = Math.max(140, W - rightStart - 56);
      const sofaRows = Math.max(1, Math.ceil(idle.length / 3));

      for (let r = 0; r < sofaRows; r++) {
        const sy = wallH + 48 + r * 98;
        const rowBots = idle.slice(r * 3, r * 3 + 3);
        const sw = Math.min(rightW - 10, Math.max(130, rowBots.length * 94 + 28));
        const sx = rightStart + (rightW - sw) / 2;

        // Sofa shadow
        ctx.fillStyle = "rgba(0,0,0,0.34)";
        ctx.beginPath(); ctx.ellipse(sx + sw / 2, sy + 14, sw * 0.52, 7, 0, 0, Math.PI * 2); ctx.fill();
        // Sofa backrest
        roundRect(ctx, sx, sy - 24, sw, 26, 8);
        ctx.fillStyle = "#7c3a21"; ctx.fill();
        ctx.strokeStyle = "rgba(251, 191, 36, 0.25)"; ctx.lineWidth = 1; ctx.stroke();

        // Seated Bots on the sofa
        const step = sw / Math.max(rowBots.length, 1);
        rowBots.forEach((b, ci) => {
          const bx = sx + step * ci + step / 2;
          const es = engStyle(b.agent);
          const nodeId = `lounge:idle:${b.id}`;
          const hov = this.hoveredId === nodeId;
          // Cozy body
          roundRect(ctx, bx - 11, sy - 11, 22, 16, 6);
          ctx.fillStyle = es.coat; ctx.fill();
          drawAvatarHead(ctx, bx, sy - 23, 13.5, this.shared.getAvatarImg(b.id, b.name), b.name, hov ? "#7dd3fc" : es.color);

          // Tiny coffee cup next to bot
          ctx.fillStyle = "#fef3c7";
          roundRect(ctx, bx + 13, sy - 2, 5.5, 5.5, 1.5); ctx.fill();

          this.hitNodes.push({
            id: nodeId,
            kind: "bot",
            bot: b,
            dotHit: null,
            box: { x: bx - 38, y: sy - 42, w: 76, h: 86 },
          });
        });

        // Sofa seat cushions & armrests (in front of legs for depth!)
        roundRect(ctx, sx + 6, sy - 2, sw - 12, 14, 5);
        ctx.fillStyle = "#9a4a2a"; ctx.fill();
        roundRect(ctx, sx - 2, sy - 14, 11, 26, 4);
        ctx.fillStyle = "#6c311b"; ctx.fill();
        roundRect(ctx, sx + sw - 9, sy - 14, 11, 26, 4);
        ctx.fill();

        // Render nameplates + prominent engine badges cleanly in front of sofa
        rowBots.forEach((b, ci) => {
          const bx = sx + step * ci + step / 2;
          drawNameAndEngine(ctx, bx, sy + 14, b.name, b.agent, "", false, 88);
        });
      }

      // Curled-up sleeping ginger office cat on the lounge rug
      const catX = W - 74;
      const catY = wallH + 34;
      ctx.fillStyle = "rgba(0,0,0,0.26)";
      ctx.beginPath(); ctx.ellipse(catX, catY + 4, 10, 3.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#f59e0b";
      ctx.beginPath(); ctx.ellipse(catX, catY, 8.5, 5.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(catX - 5.5, catY - 2, 4.2, 0, Math.PI * 2); ctx.fill();
      // Cat ears
      ctx.beginPath(); ctx.moveTo(catX - 8, catY - 4); ctx.lineTo(catX - 7, catY - 8); ctx.lineTo(catX - 5, catY - 5); ctx.fill();
      ctx.beginPath(); ctx.moveTo(catX - 5, catY - 5); ctx.lineTo(catX - 3, catY - 8); ctx.lineTo(catX - 2, catY - 4); ctx.fill();
    }
  }

  /* ── Shared Low-FPS Multi-Floor Tower Manager ── */

  class OfficeTowerEngine {
    constructor(handlers) {
      this.handlers = handlers;
      this.avatarImgs = new Map();
      this.scenes = [];
      this.timerId = null;

      this.shared = {
        getAvatarImg: (id, name) => this.avatarImgs.get(id) || this.avatarImgs.get(name) || null,
        onRedDotClick: (n) => this.handlers.onRedDotClick?.(n),
        onActorClick: (n) => this.handlers.onActorClick?.(n),
        onActorDblClick: (n) => this.handlers.onActorDblClick?.(n),
      };

      document.addEventListener("visibilitychange", () => {
        if (document.hidden) this.pause();
        else this._ensureLoop();
      });
    }

    setAvatars(avatarsMap) {
      for (const [key, src] of Object.entries(avatarsMap || {})) {
        if (!src || this.avatarImgs.has(key)) continue;
        const img = new Image();
        img.onload = () => this.scenes.forEach((s) => s.drawDynamic());
        img.src = src;
        this.avatarImgs.set(key, img);
      }
    }

    mount(specs) {
      this.pause();
      this.scenes = [];
      for (const sp of specs) {
        const canvas = document.getElementById(sp.canvasId);
        if (!canvas) continue;
        this.scenes.push(new FloorScene(canvas, sp, this.shared));
      }
      this._ensureLoop();
    }

    resizeAll() {
      this.scenes.forEach((s) => s.layoutAndBake());
    }

    pause() {
      if (this.timerId) {
        clearInterval(this.timerId);
        this.timerId = null;
      }
    }

    _ensureLoop() {
      if (document.hidden || this.timerId) return;
      if (!this.scenes.some((s) => s.needsAnimation)) return;
      // Zero 60Hz rAF wakeups: quiet 280ms (~3.5 FPS) timer ONLY on floors with active motion
      this.timerId = setInterval(() => {
        if (document.hidden) { this.pause(); return; }
        for (const s of this.scenes) {
          if (s.needsAnimation) {
            s.phase += 0.36;
            s.drawDynamic();
          }
        }
      }, 280);
    }
  }

  window.OfficeTowerEngine = OfficeTowerEngine;
})();
