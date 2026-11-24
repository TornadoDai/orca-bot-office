/**
 * DNF-Style 2.5D Oblique Stacked Office Tower Engine
 * - Authentic multi-floor high-rise office cutaway (Decision & Report Queue, Team Studios, 1F Lounge)
 * - Static architectural background cached offscreen per floor
 * - 0 FPS on idle floors, ~3.5 FPS setInterval only on active floors (zero 60Hz rAF wakeups)
 */
(function () {
  const {
    FLOOR_THEMES, engStyle, hashStr, roundRect, fmtDur, isStalled,
    drawBuildingShell, drawBuildingColumns, drawCeilingLightBar, drawWoodSlats,
    drawCurtainWallWindow, drawOfficeFloor, drawElevatorLobby, drawOfficeProp,
    drawPottedPlant, drawNameAndEngine, drawBotHead, drawBotUpperBody,
    drawSeatedDeskStation, drawStandingQueueActor, drawDecisionDesk, drawMessageStream,
  } = window.OfficeSprites;

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
      this.H = 190;
      this.wallH = 74;
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

      if (sp.kind === "decision") {
        this.wallH = 72;
        const q = sp.queue || [];
        if (q.length === 0) {
          this.H = 152;
          this.needsAnimation = false;
        } else {
          const availW = Math.max(180, this.W - 216);
          this.queuePerRow = Math.max(2, Math.min(4, Math.floor(availW / 112)));
          const rows = Math.ceil(q.length / this.queuePerRow);
          this.H = 126 + rows * 102;
          this.needsAnimation = true;
        }
      } else if (sp.kind === "team") {
        this.wallH = 74;
        const workers = sp.visibleWorkers || [];
        const bayW = Math.max(170, this.W - 232);
        this.teamPerRow = Math.max(2, Math.min(3, Math.floor(bayW / 130)));
        const rows = Math.max(1, Math.ceil(workers.length / this.teamPerRow));
        this.H = 112 + rows * 104;
        this.needsAnimation =
          sp.bot.state === "working" ||
          workers.some((w) => w.state === "working" || w.needsDecision);
      } else {
        this.wallH = 74;
        const active = sp.activeSolos || [];
        const idle = sp.idleSolos || [];
        const leftRows = Math.max(1, Math.ceil(active.length / 2));
        const rightRows = Math.max(1, Math.ceil(idle.length / 3));
        const rows = Math.max(leftRows, rightRows);
        this.H = 112 + rows * 104;
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

      if (sp.kind === "decision") this._bakeDecisionBg(bg);
      else if (sp.kind === "team") this._bakeTeamBg(bg);
      else this._bakeLoungeBg(bg);

      this.drawDynamic();
    }

    _bakeDecisionBg(ctx) {
      const { W, H, wallH } = this;
      drawBuildingShell(ctx, W, wallH, H, "#282e3d", "#343c4f");

      // Warm oak acoustic wood-slat accent wall behind the Decision Desk
      drawWoodSlats(ctx, 14, 12, 134, wallH - 16);

      // Tall floor-to-ceiling panoramic glass curtain wall overlooking high-rise skyline
      const winX = 162;
      const winW = Math.min(280, Math.max(140, W - 260));
      drawCurtainWallWindow(ctx, winX, 13, winW, wallH - 19, 3);

      // Office wall clock beside curtain wall
      if (winX + winW + 24 < W - 76) {
        drawOfficeProp(ctx, winX + winW + 20, wallH, "clock", "#38bdf8");
      }

      // Recessed architectural ceiling LED panels
      drawCeilingLightBar(ctx, 82, wallH, 52, true);
      drawCeilingLightBar(ctx, Math.round(W * 0.56), wallH, 68, false);
      drawElevatorLobby(ctx, W - 52, wallH, "TOP", false, this.spec.lang);

      // Warm oak studio office floor
      drawOfficeFloor(ctx, W, wallH, H, "#272322", "#322c2a", true);

      // Clean architectural waiting-queue carpet runner from elevator to Decision Desk
      const carpY = wallH + 16;
      const carpH = Math.max(40, H - wallH - 32);
      roundRect(ctx, 148, carpY, W - 208, carpH, 6);
      ctx.fillStyle = "rgba(71, 85, 105, 0.28)"; ctx.fill();
      ctx.strokeStyle = "rgba(148, 163, 184, 0.32)"; ctx.lineWidth = 1.2; ctx.stroke();

      // Subtle floor queue directional chevrons pointing left toward Decision Desk
      ctx.strokeStyle = "rgba(251, 113, 133, 0.25)";
      ctx.lineWidth = 1.4;
      for (let qx = 200; qx < W - 96; qx += 92) {
        const qy = carpY + carpH / 2;
        ctx.beginPath(); ctx.moveTo(qx + 4, qy - 5); ctx.lineTo(qx - 2, qy); ctx.lineTo(qx + 4, qy + 5); ctx.stroke();
      }

      drawPottedPlant(ctx, W - 66, wallH + 14, 0.95);
      drawBuildingColumns(ctx, W, H);
    }

    _bakeTeamBg(ctx) {
      const { W, H, wallH } = this;
      const theme = FLOOR_THEMES[hashStr(this.spec.bot.name || this.spec.bot.id) % FLOOR_THEMES.length];
      drawBuildingShell(ctx, W, wallH, H, theme.wallTop, theme.wallBot);

      // Lead Bot corner office: warm wood-slat accent strip + tall glass curtain wall
      drawWoodSlats(ctx, 14, 13, 28, wallH - 18);
      drawCurtainWallWindow(ctx, 46, 13, 106, wallH - 19, hashStr(this.spec.bot.name || "a") % 5);

      // Open Worker bay: wide high-rise glass curtain wall + authentic office props
      const bayWinW = Math.min(168, Math.max(92, W - 388));
      drawCurtainWallWindow(ctx, 188, 13, bayWinW, wallH - 19, (hashStr(this.spec.bot.id || "b") + 2) % 6);

      // Real office props along back wall (whiteboard / water cooler / filing cabinet+printer / bookshelf)
      let propX = 188 + bayWinW + 18;
      if (propX + 68 < W - 64) {
        drawOfficeProp(ctx, propX, wallH, theme.props[0], theme.accent);
        propX += theme.props[0] === "whiteboard" ? 74 : (theme.props[0] === "bookshelf" ? 52 : 44);
      }
      if (propX + 26 < W - 60) {
        drawOfficeProp(ctx, propX, wallH, theme.props[1], theme.accent);
      }

      // Recessed LED ceiling light bars
      drawCeilingLightBar(ctx, 88, wallH, 52, true);
      drawCeilingLightBar(ctx, Math.round((190 + W - 60) / 2), wallH, 74, false);

      // Right-side Elevator Lobby with actual floor number
      drawElevatorLobby(ctx, W - 52, wallH, this.spec.floorLabel || "2F", (this.spec.crossHandoffs || []).length > 0, this.spec.lang);

      // Modern office carpet-tile perspective floor
      drawOfficeFloor(ctx, W, wallH, H, theme.floorA, theme.floorB, false);

      // Lead Bot Office Rug
      roundRect(ctx, 16, wallH + 12, 146, H - wallH - 22, 8);
      ctx.fillStyle = theme.rug; ctx.fill();
      ctx.strokeStyle = theme.accent; ctx.globalAlpha = 0.25; ctx.lineWidth = 1; ctx.stroke();
      ctx.globalAlpha = 1;

      // Architectural Aluminum-Framed Glass Partition + Frosted Privacy Stripe + Door Handle
      const px = 171;
      ctx.fillStyle = "rgba(186, 230, 253, 0.12)";
      ctx.fillRect(px, 12, 6, H - 18);
      ctx.strokeStyle = "#64748b"; ctx.lineWidth = 1.4;
      ctx.strokeRect(px, 12, 6, H - 18);
      // Frosted office glass mid-band
      ctx.fillStyle = "rgba(226, 232, 240, 0.22)";
      ctx.fillRect(px + 1, wallH - 24, 4, 16);
      // Steel door handle
      ctx.fillStyle = "#e2e8f0";
      ctx.fillRect(px + 2, wallH + 4, 2, 12);

      drawPottedPlant(ctx, px - 14, wallH + 14, 0.85);
      drawBuildingColumns(ctx, W, H);
    }

    _bakeLoungeBg(ctx) {
      const { W, H, wallH } = this;
      drawBuildingShell(ctx, W, wallH, H, "#2e2724", "#3d332e");

      // Tall curtain wall window on left hot-desk side
      drawCurtainWallWindow(ctx, 18, 13, 126, wallH - 19, 4);
      drawOfficeProp(ctx, 156, wallH, "bookshelf", "#fbbf24");

      // Pantry & Espresso Bar on right wall
      const barX = Math.max(220, W - 194);
      drawWoodSlats(ctx, barX - 4, 13, 128, wallH - 18);
      roundRect(ctx, barX + 34, 15, 48, 15, 4);
      ctx.fillStyle = "#1c120d"; ctx.fill();
      ctx.strokeStyle = "rgba(251, 191, 36, 0.65)"; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = "#fde68a";
      ctx.font = "800 9px -apple-system, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("CAFÉ", barX + 58, 25.5);

      // Bar counter + espresso machine + stacked ceramic mugs
      roundRect(ctx, barX, wallH - 22, 120, 24, 2);
      ctx.fillStyle = "#6e472b"; ctx.fill();
      ctx.fillStyle = "#a6754b"; ctx.fillRect(barX - 2, wallH - 24, 124, 5);
      roundRect(ctx, barX + 12, wallH - 41, 28, 18, 2);
      ctx.fillStyle = "#e2e8f0"; ctx.fill();
      ctx.fillStyle = "#1e293b"; ctx.fillRect(barX + 16, wallH - 34, 20, 9);
      ctx.fillStyle = "#f59e0b"; ctx.fillRect(barX + 34, wallH - 38, 3, 2);
      ctx.fillStyle = "#fef3c7";
      ctx.fillRect(barX + 52, wallH - 30, 6, 6);
      ctx.fillRect(barX + 61, wallH - 30, 6, 6);
      ctx.fillRect(barX + 70, wallH - 30, 6, 6);
      // Office water cooler next to café bar
      if (barX - 30 > 204) drawOfficeProp(ctx, barX - 28, wallH, "cooler", "#38bdf8");

      drawCeilingLightBar(ctx, 84, wallH, 52, true);
      drawCeilingLightBar(ctx, barX + 58, wallH, 62, true);
      drawElevatorLobby(ctx, W - 52, wallH, "1F", (this.spec.crossHandoffs || []).length > 0, this.spec.lang);

      // Warm oak flooring
      drawOfficeFloor(ctx, W, wallH, H, "#29221d", "#342b24", true);

      // Cozy lounge rug on right half
      const splitX = Math.round(W * 0.44);
      roundRect(ctx, splitX, wallH + 14, W - splitX - 60, H - wallH - 24, 9);
      ctx.fillStyle = "rgba(180, 83, 9, 0.16)"; ctx.fill();
      ctx.strokeStyle = "rgba(251, 191, 36, 0.25)"; ctx.lineWidth = 1; ctx.stroke();

      drawPottedPlant(ctx, splitX - 10, wallH + 14, 0.9);
      drawBuildingColumns(ctx, W, H);
    }

    drawDynamic() {
      const ctx = this.ctx;
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.clearRect(0, 0, this.W, this.H);
      ctx.drawImage(this.bgCanvas, 0, 0, this.W, this.H);
      this.hitNodes = [];

      if (this.spec.kind === "decision") this._drawDecisionDynamic(ctx);
      else if (this.spec.kind === "team") this._drawTeamDynamic(ctx);
      else this._drawLoungeDynamic(ctx);
    }

    _drawDecisionDynamic(ctx) {
      const { W, H, wallH } = this;
      const queue = this.spec.queue || [];
      const lang = this.spec.lang;

      const deskFootY = queue.length === 0 ? H - 22 : wallH + 84;
      drawDecisionDesk(ctx, 20, deskFootY, lang, this.phase);

      if (queue.length === 0) {
        const msg = lang === "zh" ? "☕ 当前无人排队汇报 · 各团队自主推进中" : "☕ Queue clear · All teams running autonomously";
        ctx.font = "600 11px -apple-system, 'PingFang SC', sans-serif";
        const tw = ctx.measureText(msg).width + 24;
        const cx = Math.round((154 + W - 60) / 2);
        const cy = Math.round((wallH + H) / 2);
        roundRect(ctx, cx - tw / 2, cy - 14, tw, 28, 999);
        ctx.fillStyle = "rgba(15, 23, 42, 0.68)"; ctx.fill();
        ctx.strokeStyle = "rgba(148, 163, 184, 0.3)"; ctx.lineWidth = 1; ctx.stroke();
        ctx.fillStyle = "#e2e8f0"; ctx.textAlign = "center";
        ctx.fillText(msg, cx, cy + 4);
        return;
      }

      const perRow = this.queuePerRow || 3;
      const startX = 194;
      const usableW = Math.max(180, W - 262);
      const stepX = Math.min(126, usableW / Math.max(1, Math.min(queue.length, perRow)));

      queue.forEach((entry, i) => {
        const row = Math.floor(i / perRow);
        const col = i % perRow;
        const cx = startX + col * stepX + 38;
        const footY = wallH + 92 + row * 102 + (col % 2 === 1 ? 3 : 0);
        const nodeId = entry.kind === "bot" ? `decq:bot:${entry.bot.id}` : `decq:worker:${entry.worker.worktreeId}`;
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
          box: { x: cx - 46, y: footY - 82, w: 92, h: 118 },
        });
      });
    }

    _drawTeamDynamic(ctx) {
      const { W, wallH } = this;
      const b = this.spec.bot;
      const workers = this.spec.visibleWorkers || [];
      const lang = this.spec.lang;
      const now = Date.now();

      const leadX = 90;
      const leadY = wallH + 66;
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
        box: { x: leadX - 56, y: leadY - 68, w: 112, h: 108 },
      });

      const perRow = this.teamPerRow || 3;
      const bayStartX = 192;
      const bayW = Math.max(160, W - 254);
      const workerCoords = [];

      if (workers.length === 0) {
        const txt = lang === "zh" ? "当前无活跃 Worker（闲置已收起或待派发）" : "No active Workers in bay";
        ctx.fillStyle = "rgba(203, 213, 225, 0.55)";
        ctx.font = "600 11px -apple-system, 'PingFang SC', sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(txt, bayStartX + bayW / 2, wallH + 66);
      } else {
        workers.forEach((w, idx) => {
          const row = Math.floor(idx / perRow);
          const col = idx % perRow;
          const gridCols = Math.min(perRow, workers.length);
          const cellW = bayW / Math.max(gridCols, 1);
          const wx = bayStartX + cellW * col + cellW / 2;
          const wy = wallH + 66 + row * 104;
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
            box: { x: wx - 48, y: wy - 66, w: 96, h: 106 },
          });
        });
      }

      workerCoords.forEach(({ w, x, y }, idx) => {
        if (w.state !== "working" || w.needsDecision) return;
        const cycle = (this.phase * 0.22 + idx * 0.37) % 2;
        if (cycle < 1) {
          drawMessageStream(ctx, leadX + 46, leadY - 24, x - 38, y, cycle, "dispatch");
        } else {
          drawMessageStream(ctx, x - 38, y, leadX + 46, leadY - 24, cycle - 1, "reply");
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

      if (active.length === 0) {
        const txt = lang === "zh" ? "开放工位空闲中" : "Hot desks open";
        ctx.fillStyle = "rgba(203, 213, 225, 0.5)";
        ctx.font = "600 10.5px -apple-system, 'PingFang SC', sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(txt, splitX / 2, wallH + 66);
      } else {
        active.forEach((b, i) => {
          const row = Math.floor(i / 2);
          const col = i % 2;
          const cols = Math.min(2, active.length - row * 2);
          const cellW = (splitX - 24) / cols;
          const bx = 14 + cellW * col + cellW / 2;
          const by = wallH + 66 + row * 104;
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
            box: { x: bx - 52, y: by - 66, w: 104, h: 106 },
          });
        });
      }

      const rightStart = splitX + 14;
      const rightW = Math.max(140, W - rightStart - 62);
      const sofaRows = Math.max(1, Math.ceil(idle.length / 3));

      for (let r = 0; r < sofaRows; r++) {
        const sy = wallH + 56 + r * 104;
        const rowBots = idle.slice(r * 3, r * 3 + 3);
        const sw = Math.min(rightW - 10, Math.max(136, rowBots.length * 96 + 28));
        const sx = rightStart + (rightW - sw) / 2;

        ctx.fillStyle = "rgba(0,0,0,0.34)";
        ctx.beginPath(); ctx.ellipse(sx + sw / 2, sy + 14, sw * 0.52, 7.5, 0, 0, Math.PI * 2); ctx.fill();
        roundRect(ctx, sx, sy - 26, sw, 28, 8);
        ctx.fillStyle = "#7c3a21"; ctx.fill();
        ctx.strokeStyle = "rgba(251, 191, 36, 0.28)"; ctx.lineWidth = 1.1; ctx.stroke();

        const step = sw / Math.max(rowBots.length, 1);
        rowBots.forEach((b, ci) => {
          const bx = sx + step * ci + step / 2;
          const es = engStyle(b.agent);
          const nodeId = `lounge:idle:${b.id}`;
          const hov = this.hoveredId === nodeId;
          const hy = drawBotUpperBody(ctx, bx, sy + 2, es, false, 0);
          drawBotHead(ctx, bx, hy, 14.5, this.shared.getAvatarImg(b.id, b.name), b.name, hov ? "#7dd3fc" : es.color);
          ctx.fillStyle = "#fef3c7";
          roundRect(ctx, bx + 15, sy - 3, 5.5, 5.5, 1.5); ctx.fill();

          this.hitNodes.push({
            id: nodeId,
            kind: "bot",
            bot: b,
            dotHit: null,
            box: { x: bx - 40, y: sy - 54, w: 80, h: 98 },
          });
        });

        roundRect(ctx, sx + 6, sy - 2, sw - 12, 14, 5);
        ctx.fillStyle = "#9a4a2a"; ctx.fill();
        roundRect(ctx, sx - 2, sy - 16, 11, 28, 4);
        ctx.fillStyle = "#6c311b"; ctx.fill();
        roundRect(ctx, sx + sw - 9, sy - 16, 11, 28, 4);
        ctx.fill();

        rowBots.forEach((b, ci) => {
          const bx = sx + step * ci + step / 2;
          drawNameAndEngine(ctx, bx, sy + 14, b.name, b.agent, "", false, 88);
        });
      }

      // Curled-up sleeping ginger office cat on the lounge rug
      const catX = W - 78;
      const catY = wallH + 34;
      ctx.fillStyle = "rgba(0,0,0,0.28)";
      ctx.beginPath(); ctx.ellipse(catX, catY + 4, 10, 3.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#f59e0b";
      ctx.beginPath(); ctx.ellipse(catX, catY, 8.5, 5.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(catX - 5.5, catY - 2, 4.2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(catX - 8, catY - 4); ctx.lineTo(catX - 7, catY - 8); ctx.lineTo(catX - 5, catY - 5); ctx.fill();
      ctx.beginPath(); ctx.moveTo(catX - 5, catY - 5); ctx.lineTo(catX - 3, catY - 8); ctx.lineTo(catX - 2, catY - 4); ctx.fill();
    }
  }

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
