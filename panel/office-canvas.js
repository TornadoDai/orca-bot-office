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
    drawDecisionFloorDecor, drawLiveWallClock,
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
        this.teamRows = rows;
        this.H = 144 + rows * 118;
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
        this.loungeRows = rows;
        this.H = 142 + rows * 116;
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
      drawDecisionFloorDecor(ctx, W, wallH, H);
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

      // Live real-time analog wall clock synced to local system time
      drawLiveWallClock(ctx, W, wallH);

      // Always-visible Recruiting Front Desk on upper-left of TOP floor (clickable -> Hire / Create Bot!)
      if (window.OfficePresets && W >= 400) {
        const rx = 98;
        const ry = wallH + 26;
        window.OfficePresets.drawRecruitingFrontDesk(ctx, rx, ry, lang, this.hoveredId === "hire:desk");
        this.hitNodes.push({
          id: "hire:desk",
          kind: "hireDesk",
          dotHit: null,
          box: { x: rx - 44, y: ry - 48, w: 88, h: 58 },
        });
      }

      // Center unlabeled executive workstation beneath the wall clock (clickable to customize avatar!)
      const deskX = Math.round(W / 2);
      const deskY = wallH + 26;
      drawCenterOwnerDesk(ctx, deskX, deskY, this.phase, {
        mode: this.spec.ownerAvatarMode || "empty",
        avatarImg: this.shared.getAvatarImg("__owner__", "__owner__"),
        hovered: this.hoveredId === "owner:desk",
      });
      this.hitNodes.push({
        id: "owner:desk",
        kind: "ownerDesk",
        dotHit: null,
        box: { x: deskX - 58, y: deskY - 54, w: 116, h: 70 },
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
          branchCount: isBot ? (entry.bot.branchChatCount || 0) : 0,
          branchActive: isBot ? (entry.bot.activeBranchCount || 0) > 0 : false,
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

      const perRow = this.teamPerRow || 3;
      const totalRows = this.teamRows || Math.max(1, Math.ceil(workers.length / perRow));
      const topRowY = wallH + 92; // Keeps back-row heads cleanly BELOW wall baseboard (never sitting on the wall!)
      const rowStep = 118;        // 13px clean gap between rows (zero overlapping engine pills!)
      const frontRowY = topRowY + (totalRows - 1) * rowStep;

      const leadX = Math.max(82, Math.round(W * 0.155));
      const leadY = frontRowY;
      const leadId = `team:bot:${b.id}`;
      const bStall = isStalled(b);
      const bDur = b.state === "working" && b.stateStartedAt ? `${bStall ? "⚠ " : ""}${fmtDur(now - b.stateStartedAt)}` : "";

      const bayStartX = Math.max(176, Math.round(W * 0.29));
      const bayW = Math.max(160, W - bayStartX - 24);
      const workerCoords = [];

      // Bottom-Up Stacking: Active Workers & Lead Bot anchor the front/bottom row; idle/new Workers stack UPWARD behind!
      // Render in painter's order (visualRow 0 -> totalRows - 1) so foreground desks cleanly sit in front of back rows.
      if (workers.length === 0) {
        const txt = lang === "zh" ? "当前无活跃成员（闲置已收起或待派发）" : "No active teammates in bay";
        ctx.font = "600 11px -apple-system, 'PingFang SC', sans-serif";
        const tw = ctx.measureText(txt).width + 20;
        const cx = bayStartX + bayW / 2;
        roundRect(ctx, cx - tw / 2, frontRowY - 12, tw, 24, 999);
        ctx.fillStyle = "rgba(13, 18, 30, 0.72)"; ctx.fill();
        ctx.fillStyle = "rgba(226, 232, 240, 0.75)"; ctx.textAlign = "center";
        ctx.fillText(txt, cx, frontRowY + 3.5);
      } else {
        const positioned = workers.map((w, idx) => {
          const rowFromBottom = Math.floor(idx / perRow);
          const visualRow = (totalRows - 1) - rowFromBottom;
          const col = idx % perRow;
          const gridCols = Math.min(perRow, workers.length);
          const cellW = bayW / Math.max(gridCols, 1);
          return {
            w,
            idx,
            visualRow,
            wx: bayStartX + cellW * col + cellW / 2,
            wy: topRowY + visualRow * rowStep,
          };
        }).sort((a, b) => a.visualRow - b.visualRow || a.idx - b.idx);

        positioned.forEach(({ w, idx, wx, wy }) => {
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

      // Draw Lead Bot cleanly in front/bottom-left (firmly on the floor, aligned with active front row!)
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

      const topRowY = wallH + 88;
      const rowStep = 116;
      const totalRows = this.loungeRows || 1;
      const frontRowY = topRowY + (totalRows - 1) * rowStep;

      if (active.length === 0) {
        const txt = lang === "zh" ? "开放工位空闲中" : "Hot desks open";
        ctx.font = "600 10.5px -apple-system, 'PingFang SC', sans-serif";
        const tw = ctx.measureText(txt).width + 18;
        roundRect(ctx, splitX / 2 - tw / 2, frontRowY - 12, tw, 22, 999);
        ctx.fillStyle = "rgba(13, 18, 30, 0.72)"; ctx.fill();
        ctx.fillStyle = "rgba(226, 232, 240, 0.72)"; ctx.textAlign = "center";
        ctx.fillText(txt, splitX / 2, frontRowY + 2.5);
      } else {
        const activeRows = Math.max(1, Math.ceil(active.length / 2));
        active.forEach((b, i) => {
          const rowFromBottom = Math.floor(i / 2);
          const visualRow = (totalRows - 1) - rowFromBottom;
          const col = i % 2;
          const cols = Math.min(2, active.length - rowFromBottom * 2);
          const cellW = (splitX - 24) / cols;
          const bx = 14 + cellW * col + cellW / 2;
          const by = topRowY + visualRow * rowStep;
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

      for (let r = sofaRows - 1; r >= 0; r--) {
        const visualRow = (totalRows - 1) - r;
        const sy = topRowY - 6 + visualRow * rowStep;
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
      this.clockTimerId = null;

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
      const map = avatarsMap || {};
      let removed = false;
      for (const key of [...this.avatarImgs.keys()]) {
        if (!map[key]) {
          this.avatarImgs.delete(key);
          removed = true;
        }
      }
      if (removed) this.scenes.forEach((s) => s.drawDynamic());
      for (const [key, src] of Object.entries(map)) {
        if (!src) continue;
        const prev = this.avatarImgs.get(key);
        if (prev && prev._src === src) continue;
        const img = new Image();
        img._src = src;
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
      if (this.clockTimerId) {
        clearInterval(this.clockTimerId);
        this.clockTimerId = null;
      }
    }

    _ensureLoop() {
      if (document.hidden) return;
      if (!this.timerId && this.scenes.some((s) => s.needsAnimation)) {
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
      // Ultra-lightweight 10s wall clock tick even when TOP floor queue is calm (0 active anims)
      if (!this.clockTimerId && this.scenes.some((s) => s.spec.kind === "decision" && !s.needsAnimation)) {
        this.clockTimerId = setInterval(() => {
          if (document.hidden) { this.pause(); return; }
          for (const s of this.scenes) {
            if (s.spec.kind === "decision" && !s.needsAnimation) s.drawDynamic();
          }
        }, 10000);
      }
    }
  }

  window.OfficeTowerEngine = OfficeTowerEngine;
})();
