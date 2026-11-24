/**
 * DNF-Style 2.5D Illustrated Office Tower Engine
 * - Clean Queue-Only Top Floor (决策汇报区 — NO unused desk, full width for queueing Bots/Colleagues!)
 * - Painted 2-slice high-rise office plates cached once into offscreen bgCanvas
 * - 0 FPS on idle floors, ~3.5 FPS setInterval only on active floors
 */
(function () {
  const {
    TEAM_TINTS, hashStr, roundRect, fmtDur, isStalled,
    drawTwoSliceBackdrop, drawGlassPartitionOverlay, drawFloorElevatorBadge,
  } = window.OfficeArch;

  const {
    drawSeatedDeskStation, drawStandingQueueActor, drawLoungeSofaGroup, drawCenterOwnerDesk, drawMessageStream,
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
        this.wallH = 104;
        const q = sp.queue || [];
        if (q.length === 0) {
          this.H = 178;
          this.needsAnimation = false;
        } else {
          const availW = Math.max(240, this.W - 76);
          this.queuePerRow = Math.max(2, Math.min(5, Math.floor(availW / 124)));
          const rows = Math.ceil(q.length / this.queuePerRow);
          this.H = 166 + rows * 98;
          this.needsAnimation = true;
        }
      } else if (sp.kind === "team") {
        this.wallH = 114;
        const workers = sp.visibleWorkers || [];
        const bayStart = Math.round(this.W * 0.29);
        const bayW = Math.max(170, this.W - bayStart - 20);
        this.teamPerRow = Math.max(2, Math.min(3, Math.floor(bayW / 132)));
        const rows = Math.max(1, Math.ceil(workers.length / this.teamPerRow));
        this.H = 132 + rows * 102;
        this.needsAnimation =
          sp.bot.state === "working" ||
          workers.some((w) => w.state === "working" || w.needsDecision);
      } else {
        this.wallH = 114;
        const active = sp.activeSolos || [];
        const idle = sp.idleSolos || [];
        const leftRows = Math.max(1, Math.ceil(active.length / 2));
        const rightRows = Math.max(1, Math.ceil(idle.length / 3));
        const rows = Math.max(leftRows, rightRows);
        this.H = 132 + rows * 102;
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
      drawTwoSliceBackdrop(ctx, this.shared.getBgPlate("queue"), W, wallH, H, 0.62, "#2d323e", "#382c25");
      drawFloorElevatorBadge(ctx, W, wallH, "TOP", false, this.spec.lang);
    }

    _bakeTeamBg(ctx) {
      const { W, H, wallH } = this;
      const tint = TEAM_TINTS[hashStr(this.spec.bot.name || this.spec.bot.id) % TEAM_TINTS.length];
      drawTwoSliceBackdrop(ctx, this.shared.getBgPlate("studio"), W, wallH, H, 0.56, "#293242", "#262d3a");

      // Super subtle floor mood tint (keeps painted office glass partition, whiteboard & plants 100% crisp!)
      ctx.fillStyle = tint.tint;
      ctx.fillRect(0, 0, W, H);
      drawFloorElevatorBadge(ctx, W, wallH, this.spec.floorLabel || "2F", (this.spec.crossHandoffs || []).length > 0, this.spec.lang);
    }

    _bakeLoungeBg(ctx) {
      const { W, H, wallH } = this;
      drawTwoSliceBackdrop(ctx, this.shared.getBgPlate("lounge"), W, wallH, H, 0.56, "#362b24", "#3d2f24");
      drawFloorElevatorBadge(ctx, W, wallH, "1F", (this.spec.crossHandoffs || []).length > 0, this.spec.lang);
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

      // Center unlabeled executive workstation beneath the wall clock (empty/invisible by default, or custom avatar!)
      drawCenterOwnerDesk(ctx, Math.round(W / 2), wallH + 26, this.phase, {
        mode: this.spec.ownerAvatarMode || "empty",
        avatarImg: this.shared.getAvatarImg("__owner__", "__owner__"),
      });

      if (queue.length === 0) {
        const msg = lang === "zh" ? "☕ 暂无排队汇报 · 各团队自主推进中" : "☕ Queue clear · All teams running autonomously";
        ctx.font = "600 10.5px -apple-system, 'PingFang SC', sans-serif";
        const tw = ctx.measureText(msg).width + 24;
        const cx = Math.round(W / 2);
        const cy = H - 22;
        roundRect(ctx, cx - tw / 2, cy - 12, tw, 24, 999);
        ctx.fillStyle = "rgba(13, 18, 30, 0.82)"; ctx.fill();
        ctx.strokeStyle = "rgba(226, 232, 240, 0.24)"; ctx.lineWidth = 1; ctx.stroke();
        ctx.fillStyle = "#f1f5f9"; ctx.textAlign = "center";
        ctx.fillText(msg, cx, cy + 3.5);
        return;
      }

      // Queueing Bots & teammates neatly centered in front of the center desk
      const perRow = this.queuePerRow || 4;
      const usableW = Math.max(240, W - 72);
      const cols = Math.min(queue.length, perRow);
      const stepX = Math.min(142, usableW / Math.max(1, cols));
      const rowTotalW = stepX * cols;
      const startX = Math.round((W - rowTotalW) / 2);

      queue.forEach((entry, i) => {
        const row = Math.floor(i / perRow);
        const col = i % perRow;
        const cx = startX + col * stepX + stepX / 2;
        const footY = wallH + 114 + row * 98 + (col % 2 === 1 ? 3 : 0);
        const isBot = entry.kind === "bot";
        const nodeId = isBot ? `decq:bot:${entry.bot.id}` : `decq:worker:${entry.worker.worktreeId}`;
        const avImg = isBot ? this.shared.getAvatarImg(entry.bot.id, entry.bot.name) : null;

        const dotHit = drawStandingQueueActor(ctx, {
          cx,
          footY,
          isBot,
          eng: isBot ? entry.bot.agent : entry.worker.agentType,
          avatarImg: avImg,
          name: isBot ? entry.bot.name : entry.worker.displayName,
          seedKey: isBot ? entry.bot.id : entry.worker.worktreeId,
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
          box: { x: cx - 50, y: footY - 82, w: 100, h: 120 },
        });
      });
    }

    _drawTeamDynamic(ctx) {
      const { W, wallH } = this;
      const b = this.spec.bot;
      const workers = this.spec.visibleWorkers || [];
      const lang = this.spec.lang;
      const now = Date.now();

      const leadX = Math.max(82, Math.round(W * 0.155));
      const leadY = wallH + 62;
      const leadId = `team:bot:${b.id}`;
      const bStall = isStalled(b);
      const bDur = b.state === "working" && b.stateStartedAt ? `${bStall ? "⚠ " : ""}${fmtDur(now - b.stateStartedAt)}` : "";
      drawSeatedDeskStation(ctx, {
        cx: leadX,
        baseY: leadY,
        isLead: true,
        isWorking: b.state === "working" || b.workingWorkerCount > 0 || (b.activeBranchCount || 0) > 0,
        isStall: bStall,
        isUpstairs: Boolean(b.selfNeedsDecision),
        eng: b.agent,
        avatarImg: this.shared.getAvatarImg(b.id, b.name),
        name: b.name,
        seedKey: b.id,
        phase: this.phase,
        hovered: this.hoveredId === leadId,
        lang,
        durText: bDur,
        branchCount: b.branchChatCount || 0,
        branchActive: (b.activeBranchCount || 0) > 0,
      });

      this.hitNodes.push({
        id: leadId,
        kind: "bot",
        bot: b,
        dotHit: null,
        box: { x: leadX - 58, y: leadY - 68, w: 116, h: 108 },
      });

      const perRow = this.teamPerRow || 3;
      const bayStartX = Math.max(176, Math.round(W * 0.29));
      const bayW = Math.max(160, W - bayStartX - 24);
      const workerCoords = [];

      if (workers.length === 0) {
        const txt = lang === "zh" ? "当前无活跃成员（闲置已收起或待派发）" : "No active teammates in bay";
        ctx.font = "600 11px -apple-system, 'PingFang SC', sans-serif";
        const tw = ctx.measureText(txt).width + 20;
        const cx = bayStartX + bayW / 2;
        roundRect(ctx, cx - tw / 2, wallH + 54, tw, 24, 999);
        ctx.fillStyle = "rgba(13, 18, 30, 0.72)"; ctx.fill();
        ctx.fillStyle = "rgba(226, 232, 240, 0.75)"; ctx.textAlign = "center";
        ctx.fillText(txt, cx, wallH + 69.5);
      } else {
        workers.forEach((w, idx) => {
          const row = Math.floor(idx / perRow);
          const col = idx % perRow;
          const gridCols = Math.min(perRow, workers.length);
          const cellW = bayW / Math.max(gridCols, 1);
          const wx = bayStartX + cellW * col + cellW / 2;
          const wy = wallH + 62 + row * 102;
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
            seedKey: w.worktreeId || w.displayName,
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
            box: { x: wx - 50, y: wy - 66, w: 100, h: 106 },
          });
        });
      }

      workerCoords.forEach(({ w, x, y }, idx) => {
        if (w.state !== "working" || w.needsDecision) return;
        const cycle = (this.phase * 0.22 + idx * 0.37) % 2;
        if (cycle < 1) {
          drawMessageStream(ctx, leadX + 48, leadY - 24, x - 40, y, cycle, "dispatch");
        } else {
          drawMessageStream(ctx, x - 40, y, leadX + 48, leadY - 24, cycle - 1, "reply");
        }
      });
    }

    _drawLoungeDynamic(ctx) {
      const { W, H, wallH } = this;
      const active = this.spec.activeSolos || [];
      const idle = this.spec.idleSolos || [];
      const lang = this.spec.lang;
      const now = Date.now();
      const splitX = Math.round(W * 0.44);

      if (active.length === 0) {
        const txt = lang === "zh" ? "开放工位空闲中" : "Hot desks open";
        ctx.font = "600 10.5px -apple-system, 'PingFang SC', sans-serif";
        const tw = ctx.measureText(txt).width + 18;
        roundRect(ctx, splitX / 2 - tw / 2, wallH + 54, tw, 22, 999);
        ctx.fillStyle = "rgba(13, 18, 30, 0.72)"; ctx.fill();
        ctx.fillStyle = "rgba(226, 232, 240, 0.72)"; ctx.textAlign = "center";
        ctx.fillText(txt, splitX / 2, wallH + 68.5);
      } else {
        active.forEach((b, i) => {
          const row = Math.floor(i / 2);
          const col = i % 2;
          const cols = Math.min(2, active.length - row * 2);
          const cellW = (splitX - 24) / cols;
          const bx = 14 + cellW * col + cellW / 2;
          const by = wallH + 62 + row * 102;
          const nodeId = `lounge:bot:${b.id}`;
          const bStall = isStalled(b);
          const bDur = b.state === "working" && b.stateStartedAt ? `${bStall ? "⚠ " : ""}${fmtDur(now - b.stateStartedAt)}` : "";

          drawSeatedDeskStation(ctx, {
            cx: bx,
            baseY: by,
            isLead: true,
            isWorking: b.state === "working" || (b.activeBranchCount || 0) > 0,
            isStall: bStall,
            isUpstairs: Boolean(b.selfNeedsDecision),
            eng: b.agent,
            avatarImg: this.shared.getAvatarImg(b.id, b.name),
            name: b.name,
            seedKey: b.id,
            phase: this.phase + i * 0.6,
            hovered: this.hoveredId === nodeId,
            lang,
            durText: bDur,
            branchCount: b.branchChatCount || 0,
            branchActive: (b.activeBranchCount || 0) > 0,
          });
          this.hitNodes.push({
            id: nodeId, kind: "bot", bot: b, dotHit: null,
            box: { x: bx - 54, y: by - 66, w: 108, h: 106 },
          });
        });
      }

      const rightStart = splitX + 12;
      const rightW = Math.max(140, W - rightStart - 54);
      const sofaRows = Math.max(1, Math.ceil(idle.length / 3));

      for (let r = 0; r < sofaRows; r++) {
        const sy = wallH + 54 + r * 102;
        const rowBots = idle.slice(r * 3, r * 3 + 3);
        const sw = Math.min(rightW - 10, Math.max(140, rowBots.length * 98 + 28));
        const sx = rightStart + (rightW - sw) / 2;
        drawLoungeSofaGroup(ctx, sx, sy, sw, rowBots, this.shared, this.hoveredId, this.hitNodes);
      }

      // Cozy curled-up ginger office cat resting on the woven lounge rug (bottom-right)
      const catX = W - 42;
      const catY = H - 22;
      ctx.fillStyle = "rgba(0,0,0,0.34)";
      ctx.beginPath(); ctx.ellipse(catX, catY + 4, 10.5, 3.8, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#f59e0b";
      ctx.beginPath(); ctx.ellipse(catX, catY, 8.8, 5.6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(catX - 5.5, catY - 2, 4.3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(catX - 8, catY - 4); ctx.lineTo(catX - 7, catY - 8); ctx.lineTo(catX - 5, catY - 5); ctx.fill();
      ctx.beginPath(); ctx.moveTo(catX - 5, catY - 5); ctx.lineTo(catX - 3, catY - 8); ctx.lineTo(catX - 2, catY - 4); ctx.fill();
    }
  }

  class OfficeTowerEngine {
    constructor(handlers) {
      this.handlers = handlers;
      this.avatarImgs = new Map();
      this.bgPlates = new Map();
      this.scenes = [];
      this.timerId = null;

      this._preloadBgPlates();

      this.shared = {
        getAvatarImg: (id, name) => this.avatarImgs.get(id) || this.avatarImgs.get(name) || null,
        getBgPlate: (key) => this.bgPlates.get(key) || null,
        onRedDotClick: (n) => this.handlers.onRedDotClick?.(n),
        onActorClick: (n) => this.handlers.onActorClick?.(n),
        onActorDblClick: (n) => this.handlers.onActorDblClick?.(n),
      };

      document.addEventListener("visibilitychange", () => {
        if (document.hidden) this.pause();
        else this._ensureLoop();
      });
    }

    _preloadBgPlates() {
      const files = {
        queue: "./bg-queue.jpg",
        studio: "./bg-studio.jpg",
        lounge: "./bg-lounge.jpg",
      };
      for (const [key, src] of Object.entries(files)) {
        const img = new Image();
        img.onload = () => this.scenes.forEach((s) => s.layoutAndBake());
        img.src = src;
        this.bgPlates.set(key, img);
      }
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
