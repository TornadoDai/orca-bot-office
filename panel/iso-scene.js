/* Bot Office — Ultra-Lightweight 2.5D Isometric Canvas Engine (v0.3.0)
 * Architectural light-walled diorama with offscreen static caching,
 * zero-collision pill layout, gliding mail envelopes, and <=6 FPS low-power animation.
 */
(function (global) {
  "use strict";

  const TW = 28;
  const TH = 14;

  const TEAM_PALETTES = [
    { name: "sky",     accent: "#38bdf8", rug: "#13293f", rugEdge: "#38bdf8" },
    { name: "violet",  accent: "#c084fc", rug: "#261b3f", rugEdge: "#c084fc" },
    { name: "emerald", accent: "#34d399", rug: "#10322a", rugEdge: "#34d399" },
    { name: "amber",   accent: "#fbbf24", rug: "#332514", rugEdge: "#fbbf24" },
    { name: "indigo",  accent: "#818cf8", rug: "#192045", rugEdge: "#818cf8" },
    { name: "rose",    accent: "#fb7185", rug: "#381827", rugEdge: "#fb7185" },
  ];

  const ENG_COLORS = {
    claude: "#f59e0b",
    antigravity: "#38bdf8",
    codex: "#a78bfa",
    pi: "#94a3b8",
  };

  function hashStr(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return Math.abs(h);
  }

  function pickPalette(bot) {
    return TEAM_PALETTES[hashStr(String(bot.id || bot.name || "bot")) % TEAM_PALETTES.length];
  }

  function engColor(agent) {
    return ENG_COLORS[String(agent || "").toLowerCase()] || "#94a3b8";
  }

  function roundRectPath(ctx, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  function truncate(str, max) {
    const s = String(str || "");
    return s.length > max ? s.slice(0, max - 1) + "…" : s;
  }

  function fmtDur(ms) {
    const mins = Math.max(0, Math.floor(ms / 60000));
    if (mins < 1) return "<1m";
    if (mins < 60) return `${mins}m`;
    const h = Math.floor(mins / 60);
    return `${h}h${mins % 60 ? (mins % 60) + "m" : ""}`;
  }

  function latestTouch(entity) {
    return Math.max(Number(entity.lastActivityAt || 0), Number(entity.stateStartedAt || 0));
  }

  class IsoOfficeEngine {
    constructor(canvas, callbacks) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d", { alpha: false });
      this.cb = callbacks || {};
      this.bgCanvas = document.createElement("canvas");
      this.bgCtx = this.bgCanvas.getContext("2d");
      this.bgDirty = true;

      this.dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.cssW = 640;
      this.cssH = 540;

      this.zoom = 1;
      this.panX = 0;
      this.panY = 0;
      this.autoFitted = false;

      this.layout = null;
      this.hitActors = [];
      this.hitRedDots = [];
      this.hitArchives = [];
      this.avatarImgs = new Map();
      this.hoveredActorKey = null;
      this.hoveredTeamId = null;

      this.phase = 0;
      this.tickTimer = null;
      this.needsAnim = false;
      this.isDragging = false;
      this.dragMoved = false;
      this.dragStartX = 0;
      this.dragStartY = 0;
      this.dragPanX = 0;
      this.dragPanY = 0;

      this._bindEvents();
    }

    setAvatars(map) {
      let changed = false;
      for (const [k, url] of Object.entries(map || {})) {
        if (!url || this.avatarImgs.has(k)) continue;
        const img = new Image();
        img.onload = () => this.drawNow();
        img.src = url;
        this.avatarImgs.set(k, img);
        changed = true;
      }
      if (changed) this.drawNow();
    }

    resize() {
      const rect = this.canvas.parentElement?.getBoundingClientRect();
      if (!rect || rect.width < 80) return;
      const w = Math.round(rect.width);
      const h = Math.max(440, Math.min(720, Math.round(rect.height || 560)));
      if (w === this.cssW && h === this.cssH) return;
      this.cssW = w;
      this.cssH = h;
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.canvas.width = Math.round(w * this.dpr);
      this.canvas.height = Math.round(h * this.dpr);
      this.canvas.style.width = `${w}px`;
      this.canvas.style.height = `${h}px`;
      this.bgCanvas.width = this.canvas.width;
      this.bgCanvas.height = this.canvas.height;
      this.bgDirty = true;
      if (this.layout) this.fitCamera();
      this.drawNow();
    }

    fitCamera() {
      if (!this.layout) return;
      const { cols, rows } = this.layout;
      const worldW = (cols + rows) * TW + 36;
      const worldH = (cols + rows) * TH + 118;
      const fitZ = Math.min((this.cssW - 14) / worldW, (this.cssH - 18) / worldH);
      this.zoom = Math.max(0.62, Math.min(1.65, fitZ));
      const cxRaw = ((cols - rows) * TW) / 2;
      const cyRaw = ((cols + rows) * TH) / 2 - 22;
      this.panX = this.cssW / 2 - cxRaw * this.zoom;
      this.panY = this.cssH / 2 - cyRaw * this.zoom + 16;
      this.bgDirty = true;
      this.autoFitted = true;
    }

    iso(gx, gy, gz = 0) {
      return {
        x: this.panX + (gx - gy) * TW * this.zoom,
        y: this.panY + ((gx + gy) * TH - gz) * this.zoom,
      };
    }

    setData(model) {
      const prevCols = this.layout?.cols;
      const prevRows = this.layout?.rows;
      this.layout = this._buildLayout(model);
      this.bgDirty = true;
      if (!this.autoFitted || prevCols !== this.layout.cols || prevRows !== this.layout.rows) {
        this.fitCamera();
      }
      this.needsAnim = this.layout.hasLiveMotion;
      this.drawNow();
      this._syncLoop();
    }

    _buildLayout(model) {
      const { teamBots, soloBots, mailLinks, expandedStaleTeams, staleHours, lang } = model;
      const now = Date.now();
      const staleMs = staleHours > 0 ? staleHours * 3600 * 1000 : 0;

      const teams = teamBots.map((bot) => {
        const allW = bot.workers || [];
        let visibleW = allW;
        let staleCount = 0;
        if (staleMs > 0 && !expandedStaleTeams.has(bot.id)) {
          const fresh = [];
          for (const w of allW) {
            const touch = latestTouch(w);
            const isStaleIdle = !w.needsDecision && w.state !== "working" && touch > 0 && now - touch > staleMs;
            if (isStaleIdle) staleCount++;
            else fresh.push(w);
          }
          visibleW = fresh;
        }
        const workerRows = Math.max(1, Math.ceil(Math.max(visibleW.length, 1) / 2));
        const podH = Math.max(4.5, 2.2 + workerRows * 2.3);
        return { bot, visibleW, staleCount, totalW: allW.length, podW: 6.8, podH, palette: pickPalette(bot) };
      });

      const showLounge = soloBots.length > 0 || teams.length === 0;
      const activeSolos = soloBots.filter((b) => b.needsDecision || b.state === "working");
      const idleSolos = soloBots.filter((b) => !b.needsDecision && b.state !== "working");
      const loungeRows = Math.max(1, Math.ceil(activeSolos.length / 2), Math.ceil(idleSolos.length / 3));
      const loungeH = Math.max(4.7, 2.3 + loungeRows * 2.45);

      const pods = [];
      const pad = 0.55;
      const hallGap = 1.05;
      const colW = 6.8;
      const twoCols = teams.length >= 2;
      let leftY = pad;
      let rightY = pad;

      teams.forEach((tm, idx) => {
        const putRight = twoCols && rightY < leftY;
        const x0 = putRight ? pad + colW + hallGap : pad;
        const y0 = putRight ? rightY : leftY;
        if (putRight) rightY += tm.podH + 0.65;
        else leftY += tm.podH + 0.65;
        pods.push({ ...tm, x0, y0, idx });
      });

      const contentW = twoCols ? pad * 2 + colW * 2 + hallGap : pad * 2 + Math.max(colW + 4.8, 12.2);
      const teamBottomY = Math.max(leftY, rightY, pad);

      let lounge = null;
      let totalH = teamBottomY + 0.45;
      if (showLounge) {
        lounge = {
          x0: pad,
          y0: teamBottomY + (teams.length ? 0.35 : 0),
          w: contentW - pad * 2,
          h: loungeH,
          activeSolos,
          idleSolos,
        };
        totalH = lounge.y0 + lounge.h + pad;
      }

      const cols = Math.ceil(contentW);
      const rows = Math.ceil(totalH);

      const actorNodes = new Map();
      const actors = [];
      const archives = [];

      for (const pod of pods) {
        const b = pod.bot;
        const bx = pod.x0 + 1.5;
        const by = pod.y0 + 1.85;
        const bossNode = {
          key: `bot:${b.id}`,
          refId: b.id,
          teamId: b.id,
          kind: "bot",
          gx: bx,
          gy: by,
          isExecutive: true,
          bot: b,
          palette: pod.palette,
        };
        actors.push(bossNode);
        actorNodes.set(b.id, bossNode);

        pod.visibleW.forEach((w, i) => {
          const r = Math.floor(i / 2);
          const c = i % 2;
          const wx = pod.x0 + 3.95 + c * 1.95;
          const wy = pod.y0 + 1.7 + r * 2.3;
          const wNode = {
            key: `worker:${w.worktreeId}`,
            refId: w.worktreeId,
            teamId: b.id,
            kind: "worker",
            gx: wx,
            gy: wy,
            isExecutive: false,
            worker: w,
            bot: b,
            palette: pod.palette,
          };
          actors.push(wNode);
          actorNodes.set(w.worktreeId, wNode);
        });

        // Place stale-archive badge cleanly at bottom-right of pod (never near Boss!)
        if (pod.staleCount > 0) {
          archives.push({
            botId: b.id,
            count: pod.staleCount,
            gx: pod.x0 + pod.podW - 1.15,
            gy: pod.y0 + pod.podH - 0.38,
            accent: pod.palette.accent,
          });
        }
      }

      if (lounge) {
        lounge.activeSolos.forEach((b, i) => {
          const r = Math.floor(i / 2);
          const c = i % 2;
          const sx = lounge.x0 + 1.45 + c * 2.05;
          const sy = lounge.y0 + 1.75 + r * 2.3;
          const node = {
            key: `bot:${b.id}`,
            refId: b.id,
            teamId: b.id,
            kind: "bot",
            gx: sx,
            gy: sy,
            isExecutive: false,
            inLounge: true,
            bot: b,
            palette: pickPalette(b),
          };
          actors.push(node);
          actorNodes.set(b.id, node);
        });

        const sofaBaseX = lounge.x0 + Math.max(5.5, lounge.w * 0.45);
        lounge.idleSolos.forEach((b, i) => {
          const r = Math.floor(i / 3);
          const c = i % 3;
          const sx = sofaBaseX + 0.8 + c * 1.5;
          const sy = lounge.y0 + 1.65 + r * 2.45;
          const node = {
            key: `bot:${b.id}`,
            refId: b.id,
            teamId: b.id,
            kind: "bot",
            gx: sx,
            gy: sy,
            onSofa: true,
            inLounge: true,
            bot: b,
            palette: pickPalette(b),
          };
          actors.push(node);
          actorNodes.set(b.id, node);
        });
      }

      const envelopes = [];
      (mailLinks || []).forEach((ml, idx) => {
        const a = actorNodes.get(ml.from);
        const b = actorNodes.get(ml.to);
        if (!a || !b) return;
        envelopes.push({
          fromX: a.gx, fromY: a.gy,
          toX: b.gx, toY: b.gy,
          kind: ml.kind,
          offset: (idx * 0.29) % 1,
          speed: ml.kind === "alert" ? 0.045 : 0.032,
        });
      });

      const hasLiveMotion =
        envelopes.length > 0 ||
        actors.some((a) => {
          const d = a.kind === "bot" ? a.bot : a.worker;
          return d.state === "working" || d.needsDecision;
        });

      return { cols, rows, pods, lounge, actors, archives, envelopes, hasLiveMotion, lang };
    }

    _tile(ctx, gx, gy, gw, gh, fill, stroke = null, lw = 1) {
      const p0 = this.iso(gx, gy);
      const p1 = this.iso(gx + gw, gy);
      const p2 = this.iso(gx + gw, gy + gh);
      const p3 = this.iso(gx, gy + gh);
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.lineTo(p3.x, p3.y);
      ctx.closePath();
      if (fill) { ctx.fillStyle = fill; ctx.fill(); }
      if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
    }

    _box(ctx, gx, gy, gz, gw, gh, dz, cTop, cLeft, cRight, edge = null) {
      const z1 = gz + dz;
      const t0 = this.iso(gx, gy, z1);
      const t1 = this.iso(gx + gw, gy, z1);
      const t2 = this.iso(gx + gw, gy + gh, z1);
      const t3 = this.iso(gx, gy + gh, z1);
      const b1 = this.iso(gx + gw, gy, gz);
      const b2 = this.iso(gx + gw, gy + gh, gz);
      const b3 = this.iso(gx, gy + gh, gz);

      ctx.beginPath();
      ctx.moveTo(t3.x, t3.y); ctx.lineTo(t2.x, t2.y); ctx.lineTo(b2.x, b2.y); ctx.lineTo(b3.x, b3.y);
      ctx.closePath();
      ctx.fillStyle = cLeft; ctx.fill();
      if (edge) { ctx.strokeStyle = edge; ctx.lineWidth = 0.65; ctx.stroke(); }

      ctx.beginPath();
      ctx.moveTo(t2.x, t2.y); ctx.lineTo(t1.x, t1.y); ctx.lineTo(b1.x, b1.y); ctx.lineTo(b2.x, b2.y);
      ctx.closePath();
      ctx.fillStyle = cRight; ctx.fill();
      if (edge) { ctx.strokeStyle = edge; ctx.lineWidth = 0.65; ctx.stroke(); }

      ctx.beginPath();
      ctx.moveTo(t0.x, t0.y); ctx.lineTo(t1.x, t1.y); ctx.lineTo(t2.x, t2.y); ctx.lineTo(t3.x, t3.y);
      ctx.closePath();
      ctx.fillStyle = cTop; ctx.fill();
      if (edge) { ctx.strokeStyle = edge; ctx.lineWidth = 0.65; ctx.stroke(); }
    }

    _drawStaticBg() {
      const ctx = this.bgCtx;
      ctx.save();
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

      // Rich deep twilight studio backdrop with subtle soft radial ambient glow
      const bgGrad = ctx.createRadialGradient(this.cssW * 0.5, this.cssH * 0.48, 40, this.cssW * 0.5, this.cssH * 0.5, Math.max(this.cssW, this.cssH) * 0.72);
      bgGrad.addColorStop(0, "#151e34");
      bgGrad.addColorStop(0.55, "#0d1322");
      bgGrad.addColorStop(1, "#080c15");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, this.cssW, this.cssH);

      // Subtle deterministic starfield dots in background space (drawn ONCE!)
      ctx.fillStyle = "rgba(226, 232, 240, 0.25)";
      for (let i = 0; i < 36; i++) {
        const sx = ((i * 197 + 53) % 997) / 997 * this.cssW;
        const sy = ((i * 311 + 89) % 991) / 991 * this.cssH;
        const sr = (i % 3 === 0) ? 1.3 : 0.85;
        ctx.fillRect(sx, sy, sr, sr);
      }

      if (!this.layout) { ctx.restore(); return; }
      const { cols, rows, pods, lounge } = this.layout;

      // Floating island soft shadow
      ctx.save();
      ctx.globalAlpha = 0.5;
      this._tile(ctx, 0.4, 0.55, cols, rows, "#02040a");
      ctx.restore();

      // Thick 3D Architectural Floor Slab Base
      this._box(ctx, 0, 0, -11, cols, rows, 11, "#1e2738", "#131927", "#0d121d", "rgba(148,163,184,0.16)");

      // Sleek Dark Slate Architectural Grid Tiles
      for (let x = 0; x < cols; x++) {
        for (let y = 0; y < rows; y++) {
          const alt = (x + y) % 2 === 0;
          this._tile(ctx, x, y, 1, 1, alt ? "#222b3e" : "#1d2536", "rgba(255,255,255,0.03)", 0.6);
        }
      }

      // CRISP LIGHT ARCHITECTURAL WALLS (Magpie / Monument Valley high-contrast studio look!)
      const wallH = 52;
      this._box(ctx, 0, -0.32, 0, cols, 0.32, wallH, "#f1f5f9", "#cbd5e1", "#94a3b8", "rgba(15,23,42,0.18)");
      this._box(ctx, -0.32, -0.32, 0, 0.32, rows + 0.32, wallH, "#f1f5f9", "#b8c4d6", "#dce4f0", "rgba(15,23,42,0.18)");
      // Dark architectural baseboard trim along both walls
      this._box(ctx, 0, -0.02, 0, cols, 0.06, 4.5, "#334155", "#1e293b", "#0f172a");
      this._box(ctx, -0.02, 0, 0, 0.06, rows, 4.5, "#334155", "#1e293b", "#0f172a");

      // Panoramic Night-City Windows recessed into Back-Right Wall (gy = 0)
      const winCount = Math.max(2, Math.floor((cols - 1.5) / 3.2));
      for (let i = 0; i < winCount; i++) {
        const wx = 1.0 + i * 3.15;
        if (wx + 2.35 > cols - 0.4) break;
        const p0 = this.iso(wx, 0.02, 42);
        const p1 = this.iso(wx + 2.35, 0.02, 42);
        const p2 = this.iso(wx + 2.35, 0.02, 14);
        const p3 = this.iso(wx, 0.02, 14);
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.lineTo(p3.x, p3.y);
        ctx.closePath();
        ctx.fillStyle = "#0b1635"; ctx.fill();
        ctx.strokeStyle = "#334155"; ctx.lineWidth = Math.max(1.2, 2.2 * this.zoom); ctx.stroke();

        // Distant skyline lights inside dark window
        const ds = Math.max(1.6, 2.4 * this.zoom);
        const l1 = this.iso(wx + 0.5, 0.03, 20);
        const l2 = this.iso(wx + 1.45, 0.03, 25);
        const l3 = this.iso(wx + 1.85, 0.03, 19);
        ctx.fillStyle = "#fde68a"; ctx.fillRect(l1.x, l1.y, ds, ds); ctx.fillRect(l2.x, l2.y, ds, ds);
        ctx.fillStyle = "#38bdf8"; ctx.fillRect(l3.x, l3.y, ds, ds);

        // Crescent moon in first window
        if (i === 0) {
          const mp = this.iso(wx + 0.55, 0.03, 35);
          ctx.beginPath(); ctx.arc(mp.x, mp.y, 3.3 * this.zoom, 0, Math.PI * 2);
          ctx.fillStyle = "#fef08a"; ctx.fill();
        }
        // Subtle window mullion
        const mt = this.iso(wx + 1.18, 0.03, 42);
        const mb = this.iso(wx + 1.18, 0.03, 14);
        ctx.beginPath(); ctx.moveTo(mt.x, mt.y); ctx.lineTo(mb.x, mb.y);
        ctx.strokeStyle = "#475569"; ctx.lineWidth = Math.max(1, 1.4 * this.zoom); ctx.stroke();
      }

      // Wall Whiteboards & Telemetry Displays along Back-Left Wall (gx = 0)
      const leftPanels = Math.max(1, Math.floor((rows - 1.5) / 4.2));
      for (let i = 0; i < leftPanels; i++) {
        const wy = 1.2 + i * 4.1;
        if (wy + 2.4 > rows - 0.5) break;
        const p0 = this.iso(0.03, wy, 40);
        const p1 = this.iso(0.03, wy + 2.4, 40);
        const p2 = this.iso(0.03, wy + 2.4, 16);
        const p3 = this.iso(0.03, wy, 16);
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.lineTo(p3.x, p3.y);
        ctx.closePath();
        ctx.fillStyle = i % 2 === 0 ? "#0f172a" : "#f8fafc"; ctx.fill();
        ctx.strokeStyle = i % 2 === 0 ? "#38bdf8" : "#64748b";
        ctx.lineWidth = Math.max(1.1, 1.6 * this.zoom); ctx.stroke();

        const colors = ["#fbbf24", "#38bdf8", "#f472b6", "#4ade80"];
        for (let k = 0; k < 4; k++) {
          const sp = this.iso(0.05, wy + 0.4 + k * 0.46, 32 - (k % 2) * 6);
          ctx.fillStyle = colors[k];
          ctx.fillRect(sp.x - 2.2 * this.zoom, sp.y - 2.2 * this.zoom, 4.4 * this.zoom, 4.4 * this.zoom);
        }
      }

      // Studio Name Sign mounted on Back-Right Wall ("AI HQ")
      const signP0 = this.iso(cols - 2.6, 0.04, 48);
      const signP1 = this.iso(cols - 0.3, 0.04, 48);
      const signP2 = this.iso(cols - 0.3, 0.04, 39);
      const signP3 = this.iso(cols - 2.6, 0.04, 39);
      ctx.beginPath();
      ctx.moveTo(signP0.x, signP0.y); ctx.lineTo(signP1.x, signP1.y); ctx.lineTo(signP2.x, signP2.y); ctx.lineTo(signP3.x, signP3.y);
      ctx.closePath();
      ctx.fillStyle = "#0f172a"; ctx.fill();
      ctx.strokeStyle = "#38bdf8"; ctx.lineWidth = 1; ctx.stroke();

      // Team Studio Pod Carpets & Frosted Glass Dividers
      for (const pod of pods) {
        const pal = pod.palette;
        this._tile(ctx, pod.x0, pod.y0, pod.podW, pod.podH, pal.rug, pal.rugEdge + "66", Math.max(1.1, 1.5 * this.zoom));
        // Subtle Lead Executive corner rug inlay
        this._tile(ctx, pod.x0 + 0.3, pod.y0 + 0.35, 2.35, 2.7, "rgba(255,255,255,0.045)", pal.accent + "44", 0.8);
        // Frosted glass partition between Lead Bot & Worker Bay
        this._drawGlassDivider(ctx, pod.x0 + 2.85, pod.y0 + 0.25, 0.08, Math.min(2.7, pod.podH - 0.65), 22, pal.accent);

        // Pod Floor Label (clean corner inlay)
        const lbl = this.iso(pod.x0 + 0.3, pod.y0 + pod.podH - 0.22, 1);
        ctx.save();
        ctx.font = `800 ${Math.max(8, Math.round(9.5 * this.zoom))}px -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif`;
        ctx.fillStyle = pal.accent;
        ctx.globalAlpha = 0.92;
        ctx.fillText(`${truncate(pod.bot.name, 14).toUpperCase()} · ${pod.bot.workingWorkerCount}/${pod.totalW}`, lbl.x + 2, lbl.y - 2);
        ctx.restore();
      }

      // Open Workspace & Cozy Coffee Lounge Zone
      if (lounge) {
        this._tile(ctx, lounge.x0, lounge.y0, lounge.w, lounge.h, "#3c2c20", "rgba(251,191,36,0.32)", Math.max(1, 1.3 * this.zoom));
        for (let px = lounge.x0 + 0.85; px < lounge.x0 + lounge.w; px += 0.85) {
          const a = this.iso(px, lounge.y0);
          const b = this.iso(px, lounge.y0 + lounge.h);
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = "rgba(12,6,2,0.28)"; ctx.lineWidth = 0.8; ctx.stroke();
        }
        // Cozy Deep Indigo Lounge Rug under warm Caramel Sofas
        const rugX = lounge.x0 + Math.max(4.8, lounge.w * 0.42);
        const rugW = Math.min(5.6, lounge.x0 + lounge.w - rugX - 1.3);
        if (rugW > 2) {
          this._tile(ctx, rugX, lounge.y0 + 0.6, rugW, lounge.h - 1.15, "#241d42", "rgba(192,132,252,0.45)", 1.1);
        }
        const ll = this.iso(lounge.x0 + 0.3, lounge.y0 + lounge.h - 0.22, 1);
        ctx.save();
        ctx.font = `800 ${Math.max(8, Math.round(9.5 * this.zoom))}px -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif`;
        ctx.fillStyle = "#fde68a";
        ctx.globalAlpha = 0.88;
        ctx.fillText(this.layout.lang === "zh" ? "咖啡茶水间 · 开放工区" : "COFFEE LOUNGE · HOT DESKS", ll.x + 2, ll.y - 2);
        ctx.restore();
      }

      ctx.restore();
      this.bgDirty = false;
    }

    _drawGlassDivider(ctx, gx, gy, gw, gh, dz, accent) {
      const t0 = this.iso(gx, gy, dz);
      const t1 = this.iso(gx + gw, gy, dz);
      const t2 = this.iso(gx + gw, gy + gh, dz);
      const t3 = this.iso(gx, gy + gh, dz);
      const b1 = this.iso(gx + gw, gy, 0);
      const b2 = this.iso(gx + gw, gy + gh, 0);

      ctx.save();
      ctx.fillStyle = "rgba(186, 230, 253, 0.16)";
      ctx.beginPath();
      ctx.moveTo(t2.x, t2.y); ctx.lineTo(t1.x, t1.y); ctx.lineTo(b1.x, b1.y); ctx.lineTo(b2.x, b2.y);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = accent + "77"; ctx.lineWidth = Math.max(0.9, 1.2 * this.zoom); ctx.stroke();

      ctx.beginPath(); ctx.moveTo(t0.x, t0.y); ctx.lineTo(t3.x, t3.y); ctx.lineTo(t2.x, t2.y);
      ctx.strokeStyle = "#cbd5e1"; ctx.lineWidth = Math.max(1.1, 1.6 * this.zoom); ctx.stroke();
      ctx.restore();
    }

    _drawIsoDesk(ctx, gx, gy, isExec, isLit, glowCol, highlighted) {
      const w = isExec ? 1.44 : 1.22;
      const d = isExec ? 0.8 : 0.7;
      const x0 = gx - w / 2;
      const y0 = gy - d / 2;

      this._tile(ctx, x0 - 0.08, y0 - 0.06, w + 0.16, d + 0.16, "rgba(0,0,0,0.36)");
      if (isLit || highlighted) {
        this._tile(ctx, x0 - 0.16, y0 - 0.14, w + 0.32, d + 0.32, glowCol + (highlighted ? "2d" : "1c"));
      }

      // Matte charcoal desk legs
      this._box(ctx, x0 + 0.06, y0 + 0.06, 0, 0.1, 0.1, 11.5, "#334155", "#1e293b", "#0f172a");
      this._box(ctx, x0 + w - 0.16, y0 + 0.06, 0, 0.1, 0.1, 11.5, "#334155", "#1e293b", "#0f172a");
      this._box(ctx, x0 + 0.06, y0 + d - 0.16, 0, 0.1, 0.1, 11.5, "#334155", "#1e293b", "#0f172a");
      this._box(ctx, x0 + w - 0.16, y0 + d - 0.16, 0, 0.1, 0.1, 11.5, "#334155", "#1e293b", "#0f172a");

      // Bright Warm Honey-Oak Tabletop (pops crisply against dark slate floor!)
      this._box(
        ctx, x0, y0, 11.5, w, d, 3.0,
        isExec ? "#eab676" : "#dba668",
        "#b57d42", "#875a2b",
        highlighted ? "#ffffff88" : "rgba(255,255,255,0.14)"
      );

      // Sleek Glowing Monitor
      const monW = isExec ? 0.66 : 0.52;
      this._box(
        ctx, gx - monW / 2 + 0.12, y0 + 0.12, 14.8, monW, 0.12, 10.5,
        "#475569",
        isLit ? glowCol : "#1e293b",
        "#0f172a",
        isLit ? glowCol : "#475569"
      );
      this._box(ctx, gx + 0.06, y0 + 0.16, 14.5, 0.14, 0.14, 1.5, "#64748b", "#334155", "#1e293b");

      // Crisp miniature white keyboard + coffee mug
      this._tile(ctx, gx - 0.24, y0 + 0.42, 0.44, 0.18, isLit ? "#e2e8f0" : "#64748b");
      this._box(ctx, x0 + 0.14, y0 + d - 0.24, 14.5, 0.14, 0.14, 3.4, "#ffffff", "#cbd5e1", "#94a3b8");
    }

    _drawIsoChair(ctx, gx, gy) {
      this._box(ctx, gx - 0.24, gy - 0.24, 5, 0.48, 0.48, 2.5, "#475569", "#293548", "#1a2232");
      this._box(ctx, gx - 0.24, gy - 0.26, 7.5, 0.48, 0.12, 11.5, "#64748b", "#334155", "#1e293b");
      this._box(ctx, gx - 0.07, gy - 0.07, 0, 0.14, 0.14, 5, "#94a3b8", "#475569", "#1e293b");
    }

    // Warm Cozy Caramel/Amber Modern Lounge Sofa with Teal & Pink Throw Pillows!
    _drawIsoSofa(ctx, gx, gy, width) {
      this._tile(ctx, gx - 0.1, gy - 0.1, width + 0.2, 1.05, "rgba(0,0,0,0.36)");
      this._box(ctx, gx, gy, 1.8, width, 0.88, 7.2, "#e89c46", "#c9792a", "#9c591a", "rgba(255,255,255,0.1)");
      this._box(ctx, gx, gy, 9, width, 0.22, 10.5, "#f3ad58", "#d48431", "#a35e1d");
      this._box(ctx, gx, gy, 5, 0.22, 0.88, 7.2, "#d48431", "#b0651d", "#7d4512");
      this._box(ctx, gx + width - 0.22, gy, 5, 0.22, 0.88, 7.2, "#d48431", "#b0651d", "#7d4512");
      // Throw pillows
      this._box(ctx, gx + 0.26, gy + 0.24, 9, 0.3, 0.22, 4.8, "#38bdf8", "#0284c7", "#0369a1");
      this._box(ctx, gx + width - 0.58, gy + 0.24, 9, 0.3, 0.22, 4.8, "#f472b6", "#db2777", "#9d174d");
    }

    _drawCoffeeTable(ctx, gx, gy) {
      this._tile(ctx, gx - 0.58, gy - 0.42, 1.16, 0.84, "rgba(0,0,0,0.32)");
      this._box(ctx, gx - 0.1, gy - 0.1, 0, 0.2, 0.2, 6, "#5c3d24", "#442c19", "#2e1c0e");
      this._box(ctx, gx - 0.52, gy - 0.36, 6, 1.04, 0.72, 2.2, "#e0b078", "#b57d42", "#875a2b");
      this._box(ctx, gx - 0.22, gy - 0.1, 8.2, 0.14, 0.14, 3.0, "#ffffff", "#cbd5e1", "#94a3b8");
      this._box(ctx, gx + 0.16, gy + 0.02, 8.2, 0.14, 0.14, 3.0, "#fde68a", "#f59e0b", "#b45309");
    }

    _drawEspressoBar(ctx, gx, gy) {
      this._tile(ctx, gx - 0.1, gy - 0.1, 1.35, 0.9, "rgba(0,0,0,0.35)");
      this._box(ctx, gx, gy, 0, 1.25, 0.78, 14.5, "#d8a46c", "#9c6b3b", "#6e4724");
      this._box(ctx, gx + 0.28, gy + 0.15, 14.5, 0.64, 0.44, 10.5, "#e2e8f0", "#64748b", "#334155");
      const led = this.iso(gx + 0.62, gy + 0.6, 20.5);
      ctx.fillStyle = "#fbbf24";
      ctx.beginPath(); ctx.arc(led.x, led.y, Math.max(1.8, 2.2 * this.zoom), 0, Math.PI * 2); ctx.fill();
    }

    _drawBookshelf(ctx, gx, gy) {
      this._tile(ctx, gx - 0.05, gy - 0.05, 1.3, 0.55, "rgba(0,0,0,0.3)");
      this._box(ctx, gx, gy, 0, 1.2, 0.45, 28, "#b88454", "#8a5c34", "#5c3b1e");
      const bookCols = ["#f87171", "#38bdf8", "#fbbf24", "#4ade80", "#c084fc"];
      for (let shelf = 0; shelf < 2; shelf++) {
        for (let b = 0; b < 5; b++) {
          this._box(ctx, gx + 0.12 + b * 0.19, gy + 0.1, 7 + shelf * 10, 0.14, 0.28, 6.5, bookCols[(b + shelf * 2) % 5], bookCols[(b + shelf * 2) % 5], "#1e293b");
        }
      }
    }

    _drawPlant(ctx, gx, gy) {
      this._tile(ctx, gx - 0.34, gy - 0.34, 0.68, 0.68, "rgba(0,0,0,0.32)");
      this._box(ctx, gx - 0.24, gy - 0.24, 0, 0.48, 0.48, 9.5, "#d4845a", "#a85c38", "#753c21");
      const top = this.iso(gx, gy, 15);
      const r = 8 * this.zoom;
      ctx.fillStyle = "#15803d";
      ctx.beginPath(); ctx.ellipse(top.x - r * 0.55, top.y, r * 0.82, r * 0.46, -0.4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#22c55e";
      ctx.beginPath(); ctx.ellipse(top.x + r * 0.55, top.y - r * 0.15, r * 0.82, r * 0.46, 0.4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#4ade80";
      ctx.beginPath(); ctx.ellipse(top.x, top.y - r * 0.68, r * 0.56, r * 0.78, 0, 0, Math.PI * 2); ctx.fill();
    }

    _drawOfficeCat(ctx, gx, gy) {
      const p = this.iso(gx, gy, 2);
      const s = this.zoom;
      ctx.save();
      ctx.fillStyle = "rgba(0,0,0,0.28)";
      ctx.beginPath(); ctx.ellipse(p.x, p.y + 2 * s, 7.5 * s, 3.6 * s, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#fb923c";
      ctx.beginPath(); ctx.ellipse(p.x, p.y, 6.2 * s, 4 * s, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#fdba74";
      ctx.beginPath(); ctx.arc(p.x + 4.2 * s, p.y - 1.5 * s, 3.3 * s, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#ea580c";
      ctx.fillRect(p.x + 2 * s, p.y - 5.4 * s, 1.9 * s, 2.3 * s);
      ctx.fillRect(p.x + 5.2 * s, p.y - 5.4 * s, 1.9 * s, 2.3 * s);
      ctx.restore();
    }

    _drawCharacter(ctx, node, isWorking, needsDecision, isHovered, isTeamHighlighted) {
      const bob = isWorking ? Math.sin(this.phase * 2.0 + node.gx * 1.7) * 1.3 : 0;
      const gx = node.gx;
      const gy = node.onSofa ? node.gy + 0.1 : node.gy - 0.42;
      const baseZ = node.onSofa ? 7.2 : 6;
      const eng = node.kind === "bot" ? node.bot.agent : node.worker.agentType;
      const eCol = engColor(eng);

      if (node.kind === "bot") {
        const shirtTop = needsDecision ? "#ef4444" : isWorking ? "#0ea5e9" : "#64748b";
        const shirtL   = needsDecision ? "#b91c1c" : isWorking ? "#0369a1" : "#475569";
        const shirtR   = needsDecision ? "#7f1d1d" : isWorking ? "#0c4a6e" : "#334155";
        this._box(ctx, gx - 0.22, gy - 0.18, baseZ + bob, 0.44, 0.36, 10.5, shirtTop, shirtL, shirtR);

        const headP = this.iso(gx, gy, baseZ + 18.5 + bob);
        const r = Math.max(10.5, (node.isExecutive ? 14.5 : 12.6) * this.zoom);

        if (isHovered || isTeamHighlighted || needsDecision) {
          ctx.beginPath();
          ctx.arc(headP.x, headP.y, r + 3.2 * this.zoom, 0, Math.PI * 2);
          ctx.fillStyle = needsDecision ? "rgba(239,68,68,0.36)" : isHovered ? "rgba(56,189,248,0.36)" : "rgba(56,189,248,0.2)";
          ctx.fill();
        }

        const img = this.avatarImgs.get(node.bot.id) || this.avatarImgs.get(node.bot.name);
        ctx.save();
        ctx.beginPath(); ctx.arc(headP.x, headP.y, r, 0, Math.PI * 2); ctx.clip();
        if (img && img.complete && img.naturalWidth > 0) {
          ctx.drawImage(img, headP.x - r, headP.y - r, r * 2, r * 2);
        } else {
          ctx.fillStyle = "#1e293b";
          ctx.fillRect(headP.x - r, headP.y - r, r * 2, r * 2);
          ctx.fillStyle = "#f8fafc";
          ctx.font = `800 ${Math.round(r * 1.05)}px -apple-system, sans-serif`;
          ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.fillText(String(node.bot.name || "?").slice(0, 1).toUpperCase(), headP.x, headP.y + 1);
        }
        ctx.restore();

        ctx.beginPath(); ctx.arc(headP.x, headP.y, r, 0, Math.PI * 2);
        ctx.strokeStyle = needsDecision ? "#f87171" : isWorking ? "#38bdf8" : "#94a3b8";
        ctx.lineWidth = Math.max(1.6, 2.3 * this.zoom);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(headP.x + r * 0.72, headP.y + r * 0.72, Math.max(2.6, 3.3 * this.zoom), 0, Math.PI * 2);
        ctx.fillStyle = eCol; ctx.fill();
        ctx.strokeStyle = "#0f172a"; ctx.lineWidth = 1.2; ctx.stroke();

        return { headX: headP.x, headY: headP.y, r };
      } else {
        const trim = needsDecision ? "#ef4444" : eCol;
        this._box(ctx, gx - 0.19, gy - 0.16, baseZ + bob, 0.38, 0.32, 8.8, "#f1f5f9", "#cbd5e1", "#94a3b8", trim);
        this._box(ctx, gx - 0.24, gy - 0.21, baseZ + 8.8 + bob, 0.48, 0.42, 11, "#ffffff", "#e2e8f0", "#cbd5e1", trim);

        const v0 = this.iso(gx - 0.17, gy + 0.22, baseZ + 17.5 + bob);
        const v1 = this.iso(gx + 0.17, gy + 0.22, baseZ + 17.5 + bob);
        const v2 = this.iso(gx + 0.17, gy + 0.22, baseZ + 11 + bob);
        const v3 = this.iso(gx - 0.17, gy + 0.22, baseZ + 11 + bob);
        ctx.beginPath();
        ctx.moveTo(v0.x, v0.y); ctx.lineTo(v1.x, v1.y); ctx.lineTo(v2.x, v2.y); ctx.lineTo(v3.x, v3.y);
        ctx.closePath();
        ctx.fillStyle = "#0f172a"; ctx.fill();

        const eyeCol = needsDecision ? "#f87171" : isWorking ? "#4ade80" : "#64748b";
        const e1 = this.iso(gx - 0.06, gy + 0.23, baseZ + 14.2 + bob);
        const e2 = this.iso(gx + 0.08, gy + 0.23, baseZ + 14.2 + bob);
        ctx.fillStyle = eyeCol;
        const es = Math.max(1.6, 2.3 * this.zoom);
        if (isWorking || needsDecision) {
          ctx.fillRect(e1.x - es / 2, e1.y - es / 2, es, es * 1.35);
          ctx.fillRect(e2.x - es / 2, e2.y - es / 2, es, es * 1.35);
        } else {
          ctx.fillRect(e1.x - es / 2, e1.y, es * 1.15, Math.max(1, es * 0.45));
          ctx.fillRect(e2.x - es / 2, e2.y, es * 1.15, Math.max(1, es * 0.45));
        }

        const antB = this.iso(gx, gy, baseZ + 19.8 + bob);
        const antT = this.iso(gx, gy, baseZ + 25 + bob);
        ctx.beginPath(); ctx.moveTo(antB.x, antB.y); ctx.lineTo(antT.x, antT.y);
        ctx.strokeStyle = trim; ctx.lineWidth = Math.max(1.3, 1.8 * this.zoom); ctx.stroke();
        ctx.beginPath(); ctx.arc(antT.x, antT.y, Math.max(2.1, 2.8 * this.zoom), 0, Math.PI * 2);
        ctx.fillStyle = needsDecision ? "#ef4444" : isWorking ? "#4ade80" : trim; ctx.fill();

        const headP = this.iso(gx, gy, baseZ + 15.2 + bob);
        const r = Math.max(10.5, 12.8 * this.zoom);
        if (isHovered || isTeamHighlighted) {
          ctx.beginPath(); ctx.arc(headP.x, headP.y, r + 3 * this.zoom, 0, Math.PI * 2);
          ctx.strokeStyle = isHovered ? "#38bdf8" : "rgba(56,189,248,0.45)";
          ctx.lineWidth = 1.6; ctx.stroke();
        }
        return { headX: headP.x, headY: headP.y, r };
      }
    }

    _drawMailEnvelope(ctx, env) {
      const rawT = (this.phase * env.speed + env.offset) % 1;
      const u = env.kind === "dispatch" ? (rawT < 0.5 ? rawT * 2 : (1 - rawT) * 2) : rawT;
      const gx = env.fromX + (env.toX - env.fromX) * u;
      const gy = env.fromY + (env.toY - env.fromY) * u;
      const arcZ = 25 + Math.sin(u * Math.PI) * 19;

      const sh = this.iso(gx, gy, 1);
      ctx.fillStyle = "rgba(0,0,0,0.28)";
      ctx.beginPath(); ctx.ellipse(sh.x, sh.y, 5.8 * this.zoom, 2.9 * this.zoom, 0, 0, Math.PI * 2); ctx.fill();

      const p = this.iso(gx, gy, arcZ);
      const ew = Math.max(13, 16 * this.zoom);
      const eh = Math.max(9, 11 * this.zoom);
      const sealCol = env.kind === "alert" ? "#ef4444" : env.kind === "handoff" ? "#c084fc" : (rawT < 0.5 ? "#38bdf8" : "#4ade80");

      ctx.save();
      ctx.translate(p.x, p.y);
      roundRectPath(ctx, -ew / 2, -eh / 2, ew, eh, 2.4);
      ctx.fillStyle = env.kind === "alert" ? "#fef2f2" : "#ffffff";
      ctx.fill();
      ctx.strokeStyle = sealCol; ctx.lineWidth = 1.4; ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(-ew / 2 + 1, -eh / 2 + 1); ctx.lineTo(0, 1.2); ctx.lineTo(ew / 2 - 1, -eh / 2 + 1);
      ctx.strokeStyle = "#94a3b8"; ctx.lineWidth = 1; ctx.stroke();

      ctx.beginPath(); ctx.arc(0, 1.2, Math.max(2.1, 2.4 * this.zoom), 0, Math.PI * 2);
      ctx.fillStyle = sealCol; ctx.fill();
      ctx.restore();
    }

    // Smart Zero-Overlap Pill Layout & Rendering (NEVER clips subTag & NEVER covers heads/red dots!)
    _drawPillsResolved(ctx, pills, avoidBoxes = []) {
      if (!pills.length) return;
      const fs = Math.max(8.5, Math.min(10.5, Math.round(9.5 * this.zoom)));
      ctx.font = `600 ${fs}px -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif`;

      const boxes = pills.map((p) => {
        const subW = p.subTag ? ctx.measureText(` · ${p.subTag}`).width : 0;
        const capW = p.isHovered ? 172 : (p.tone === "attn" ? 132 : 108);
        const maxMainW = Math.max(46, capW - subW);
        let mainTxt = String(p.text || "");
        while (mainTxt.length > 4 && ctx.measureText(mainTxt).width > maxMainW) {
          mainTxt = mainTxt.slice(0, -2) + "…";
        }
        const mainW = ctx.measureText(mainTxt).width;
        const pw = Math.ceil(mainW + subW + 20);
        const ph = fs + 7;
        const x = Math.max(6, Math.min(this.cssW - pw - 6, p.cx - pw / 2));
        const y = Math.max(6, p.bottomY - ph);
        return { ...p, mainTxt, pw, ph, x, y, origY: y };
      });

      // Lift any pill that collides with another character's head or red dot, then resolve pill-vs-pill overlaps
      boxes.sort((a, b) => b.y - a.y);
      for (let i = 0; i < boxes.length; i++) {
        const a = boxes[i];
        let moved = true;
        let guard = 0;
        while (moved && guard < 10) {
          moved = false;
          guard++;
          for (const ob of avoidBoxes) {
            if (ob.key === a.ownerKey) continue;
            if (a.x < ob.x + ob.w && a.x + a.pw > ob.x && a.y < ob.y + ob.h && a.y + a.ph > ob.y) {
              a.y = Math.max(6, ob.y - a.ph - 3);
              moved = true;
            }
          }
          for (let j = 0; j < i; j++) {
            const b = boxes[j];
            if (a.x < b.x + b.pw + 4 && a.x + a.pw + 4 > b.x && a.y < b.y + b.ph + 3 && a.y + a.ph + 3 > b.y) {
              a.y = Math.max(6, b.y - a.ph - 3);
              moved = true;
            }
          }
        }
      }

      for (const b of boxes) {
        ctx.save();
        if (b.origY - b.y > 4) {
          ctx.beginPath();
          ctx.moveTo(b.cx, b.y + b.ph);
          ctx.lineTo(b.cx, b.origY + b.ph + 3);
          ctx.strokeStyle = b.tone === "attn" ? "rgba(248, 113, 113, 0.55)" : "rgba(148, 163, 184, 0.42)";
          ctx.lineWidth = 1;
          ctx.stroke();
        }
        roundRectPath(ctx, b.x, b.y, b.pw, b.ph, b.ph / 2);
        if (b.tone === "attn") {
          ctx.fillStyle = "rgba(127, 29, 29, 0.96)"; ctx.strokeStyle = "#f87171";
        } else if (b.tone === "stall") {
          ctx.fillStyle = "rgba(120, 53, 15, 0.95)"; ctx.strokeStyle = "#fbbf24";
        } else if (b.tone === "worker") {
          ctx.fillStyle = "rgba(6, 38, 30, 0.94)"; ctx.strokeStyle = "rgba(74, 222, 128, 0.8)";
        } else {
          ctx.fillStyle = "rgba(13, 19, 32, 0.94)"; ctx.strokeStyle = "rgba(56, 189, 248, 0.72)";
        }
        ctx.lineWidth = 1.15;
        ctx.fill(); ctx.stroke();

        ctx.beginPath();
        ctx.arc(b.x + 8, b.y + b.ph / 2, 2.6, 0, Math.PI * 2);
        ctx.fillStyle = b.tone === "attn" ? "#ffffff" : b.tone === "stall" ? "#fbbf24" : b.tone === "worker" ? "#4ade80" : "#38bdf8";
        ctx.fill();

        ctx.font = `600 ${fs}px -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif`;
        ctx.textAlign = "left"; ctx.textBaseline = "middle";
        ctx.fillStyle = b.tone === "attn" ? "#fef2f2" : b.tone === "stall" ? "#fef3c7" : "#f1f5f9";
        ctx.fillText(b.mainTxt, b.x + 14, b.y + b.ph / 2 + 0.5);

        if (b.subTag) {
          const mw = ctx.measureText(b.mainTxt).width;
          ctx.fillStyle = b.tone === "stall" ? "#fde047" : "#94a3b8";
          ctx.fillText(` · ${b.subTag}`, b.x + 14 + mw, b.y + b.ph / 2 + 0.5);
        }
        ctx.restore();
      }
    }

    _drawNameplate(ctx, cx, topY, name, tone) {
      ctx.save();
      const fs = Math.max(8.5, Math.min(10.5, Math.round(9.5 * this.zoom)));
      ctx.font = `700 ${fs}px -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif`;
      const label = truncate(name, 16);
      const tw = ctx.measureText(label).width;
      const pw = tw + 10;
      const ph = fs + 5;
      const x = cx - pw / 2;
      const y = topY;

      roundRectPath(ctx, x, y, pw, ph, 4);
      ctx.fillStyle = tone === "attn" ? "rgba(127,29,29,0.94)" : tone === "worker" ? "rgba(6,38,30,0.92)" : "rgba(11,15,24,0.9)";
      ctx.fill();
      ctx.strokeStyle = tone === "attn" ? "#f87171" : tone === "worker" ? "rgba(74,222,128,0.65)" : tone === "boss" ? "rgba(56,189,248,0.6)" : "rgba(255,255,255,0.18)";
      ctx.lineWidth = 0.9;
      ctx.stroke();

      ctx.fillStyle = tone === "attn" ? "#fecaca" : tone === "worker" ? "#86efac" : "#f1f5f9";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(label, cx, y + ph / 2 + 0.5);
      ctx.restore();
    }

    drawNow() {
      if (this.bgDirty) this._drawStaticBg();
      const ctx = this.ctx;
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(this.bgCanvas, 0, 0);
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

      if (!this.layout) { ctx.restore(); return; }
      const { cols, rows, pods, lounge, actors, archives, envelopes } = this.layout;
      const now = Date.now();

      const drawQueue = [];
      const nameOverlays = [];
      const redDotOverlays = [];
      const pillsToDraw = [];
      const avoidBoxes = [];
      this.hitActors = [];
      this.hitRedDots = [];
      this.hitArchives = [];

      // Potted plants + Bookshelf along back wall
      drawQueue.push({ depth: 0.9, draw: () => this._drawPlant(ctx, cols - 0.65, 0.72) });
      drawQueue.push({ depth: rows - 0.3, draw: () => this._drawPlant(ctx, 0.65, rows - 0.72) });
      if (cols >= 12) {
        drawQueue.push({ depth: cols * 0.52, draw: () => this._drawBookshelf(ctx, cols * 0.5 - 0.5, 0.28) });
      }

      if (lounge) {
        const sofaBaseX = lounge.x0 + Math.max(5.5, lounge.w * 0.45);
        const sofaRowCnt = Math.max(1, Math.ceil(lounge.idleSolos.length / 3));
        for (let r = 0; r < sofaRowCnt; r++) {
          const sy = lounge.y0 + 1.15 + r * 2.45;
          drawQueue.push({ depth: sofaBaseX + sy + 0.5, draw: () => this._drawIsoSofa(ctx, sofaBaseX, sy, 4.7) });
          drawQueue.push({ depth: sofaBaseX + sy + 2.5, draw: () => this._drawCoffeeTable(ctx, sofaBaseX + 2.3, sy + 1.42) });
        }
        const barX = lounge.x0 + lounge.w - 1.55;
        const barY = lounge.y0 + 0.95;
        drawQueue.push({ depth: barX + barY + 0.5, draw: () => this._drawEspressoBar(ctx, barX, barY) });
        drawQueue.push({ depth: sofaBaseX + lounge.y0 + 2.5, draw: () => this._drawOfficeCat(ctx, sofaBaseX - 0.55, lounge.y0 + 2.3) });

        for (let i = lounge.activeSolos.length; i < 2; i++) {
          const dx = lounge.x0 + 1.45 + i * 2.05;
          const dy = lounge.y0 + 1.75;
          drawQueue.push({ depth: dx + dy - 0.5, draw: () => this._drawIsoChair(ctx, dx, dy - 0.42) });
          drawQueue.push({ depth: dx + dy + 0.15, draw: () => this._drawIsoDesk(ctx, dx, dy + 0.12, false, false, "#38bdf8", false) });
        }
      }

      for (const pod of pods) {
        if (pod.visibleW.length === 0) {
          const wx = pod.x0 + 4.1;
          const wy = pod.y0 + 1.75;
          drawQueue.push({ depth: wx + wy - 0.5, draw: () => this._drawIsoChair(ctx, wx, wy - 0.42) });
          drawQueue.push({ depth: wx + wy + 0.15, draw: () => this._drawIsoDesk(ctx, wx, wy + 0.12, false, false, "#4ade80", false) });
        }
      }

      for (const node of actors) {
        const entity = node.kind === "bot" ? node.bot : node.worker;
        const isWorking = entity.state === "working" || (node.kind === "bot" && entity.workingWorkerCount > 0);
        const needsDec = Boolean(entity.needsDecision);
        const touch = latestTouch(entity);
        // Only flag stall if genuinely working AND untouched for > 12 minutes
        const isStalled = entity.state === "working" && touch > 0 && now - touch > 12 * 60 * 1000;
        const runDur = entity.state === "working" && entity.stateStartedAt ? fmtDur(now - entity.stateStartedAt) : "";
        const isHovered = this.hoveredActorKey === node.key;
        const isTeamHi = this.hoveredTeamId && this.hoveredTeamId === node.teamId;
        const glowCol = needsDec ? "#ef4444" : isStalled ? "#fbbf24" : node.kind === "worker" ? "#4ade80" : node.palette.accent;

        if (!node.onSofa) {
          drawQueue.push({ depth: node.gx + node.gy - 0.55, draw: () => this._drawIsoChair(ctx, node.gx, node.gy - 0.45) });
          drawQueue.push({ depth: node.gx + node.gy + 0.22, draw: () => this._drawIsoDesk(ctx, node.gx, node.gy + 0.12, node.isExecutive, isWorking || needsDec, glowCol, isTeamHi) });
        }

        drawQueue.push({
          depth: node.gx + node.gy - 0.15,
          draw: () => {
            const pos = this._drawCharacter(ctx, node, isWorking, needsDec, isHovered, isTeamHi);
            this.hitActors.push({ node, x: pos.headX, y: pos.headY + 6 * this.zoom, r: pos.r + 9 * this.zoom });
            avoidBoxes.push({
              key: node.key,
              x: pos.headX - pos.r - 2,
              y: pos.headY - pos.r - (needsDec ? 12 : 4),
              w: (pos.r + 4) * 2 + (needsDec ? 10 : 0),
              h: pos.r * 2 + 12,
            });

            const foot = this.iso(node.gx, node.gy + (node.onSofa ? 0.48 : 0.56), 0);
            const name = node.kind === "bot" ? node.bot.name : node.worker.displayName;
            const nameTone = needsDec ? "attn" : isWorking ? (node.kind === "worker" ? "worker" : "boss") : "idle";
            nameOverlays.push(() => this._drawNameplate(ctx, foot.x, foot.y + 1, name, nameTone));

            if (needsDec || isWorking || isHovered) {
              const pillTone = needsDec ? "attn" : isStalled ? "stall" : node.kind === "worker" ? "worker" : "boss";
              pillsToDraw.push({
                ownerKey: node.key,
                isHovered,
                cx: pos.headX,
                bottomY: pos.headY - pos.r - (needsDec ? 13 : 6),
                text: entity.activity || name,
                tone: pillTone,
                subTag: isStalled ? `⚠ ${runDur}` : runDur,
              });
            } else {
              nameOverlays.push(() => {
                ctx.save();
                ctx.font = `800 ${Math.max(8, Math.round(9 * this.zoom))}px -apple-system, sans-serif`;
                ctx.fillStyle = "rgba(216, 180, 254, 0.78)";
                ctx.fillText("zZ", pos.headX + pos.r * 0.72, pos.headY - pos.r * 0.65);
                ctx.restore();
              });
            }

            if (needsDec) {
              redDotOverlays.push(() => {
                const dx = pos.headX + pos.r * 0.85;
                const dy = pos.headY - pos.r * 0.72;
                const dr = Math.max(7.5, 8.8 * this.zoom);
                const ping = (this.phase * 0.9) % 1;
                ctx.save();
                ctx.beginPath(); ctx.arc(dx, dy, dr + ping * 6.5, 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(239, 68, 68, ${Math.max(0, 0.85 - ping)})`;
                ctx.lineWidth = 1.8; ctx.stroke();

                ctx.beginPath(); ctx.arc(dx, dy, dr, 0, Math.PI * 2);
                ctx.fillStyle = "#ef4444"; ctx.fill();
                ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 1.6; ctx.stroke();

                ctx.fillStyle = "#ffffff";
                ctx.font = `900 ${Math.round(dr * 1.15)}px -apple-system, sans-serif`;
                ctx.textAlign = "center"; ctx.textBaseline = "middle";
                const count = node.kind === "bot" ? node.bot.decisionCount : 1;
                ctx.fillText(count > 1 ? String(count) : "!", dx, dy + 0.5);
                ctx.restore();

                this.hitRedDots.push({ node, x: dx, y: dy, r: dr + 4 });
              });
            }
          },
        });
      }

      drawQueue.sort((a, b) => a.depth - b.depth);
      for (const item of drawQueue) item.draw();

      // Archive chips cleanly on outer pod corner
      for (const arc of archives) {
        const p = this.iso(arc.gx, arc.gy, 2);
        const txt = this.layout.lang === "zh" ? `+${arc.count} 旧闲置` : `+${arc.count} stale`;
        ctx.save();
        ctx.font = `700 ${Math.max(8.5, Math.round(9 * this.zoom))}px -apple-system, sans-serif`;
        const w = ctx.measureText(txt).width + 12;
        const h = 17;
        roundRectPath(ctx, p.x - w / 2, p.y - h / 2, w, h, 8.5);
        ctx.fillStyle = "rgba(15, 23, 42, 0.9)"; ctx.fill();
        ctx.strokeStyle = arc.accent + "88"; ctx.lineWidth = 1; ctx.stroke();
        ctx.fillStyle = "#e2e8f0"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(txt, p.x, p.y + 0.5);
        ctx.restore();
        this.hitArchives.push({ botId: arc.botId, x: p.x - w / 2, y: p.y - h / 2, w, h });
      }

      for (const env of envelopes) this._drawMailEnvelope(ctx, env);
      for (const fn of nameOverlays) fn();
      this._drawPillsResolved(ctx, pillsToDraw, avoidBoxes);
      for (const fn of redDotOverlays) fn();

      ctx.restore();
    }

    _syncLoop() {
      if (this.tickTimer) { clearTimeout(this.tickTimer); this.tickTimer = null; }
      if (!this.needsAnim || document.hidden) return;
      // Ultra-light ~6 FPS tick (165ms) — smooth mail envelopes with near-zero GPU load!
      this.tickTimer = setTimeout(() => {
        this.tickTimer = null;
        if (!this.needsAnim || document.hidden) return;
        this.phase += 0.22;
        this.drawNow();
        this._syncLoop();
      }, 165);
    }

    pause() { if (this.tickTimer) { clearTimeout(this.tickTimer); this.tickTimer = null; } }
    resume() { this._syncLoop(); }

    _hitTest(mx, my) {
      for (let i = this.hitRedDots.length - 1; i >= 0; i--) {
        const h = this.hitRedDots[i];
        if (Math.hypot(mx - h.x, my - h.y) <= h.r) return { type: "redDot", node: h.node };
      }
      for (let i = this.hitArchives.length - 1; i >= 0; i--) {
        const a = this.hitArchives[i];
        if (mx >= a.x && mx <= a.x + a.w && my >= a.y && my <= a.y + a.h) return { type: "archive", botId: a.botId };
      }
      for (let i = this.hitActors.length - 1; i >= 0; i--) {
        const h = this.hitActors[i];
        if (Math.hypot(mx - h.x, my - h.y) <= h.r) return { type: "actor", node: h.node };
      }
      return null;
    }

    _bindEvents() {
      const getPos = (e) => {
        const r = this.canvas.getBoundingClientRect();
        return { x: e.clientX - r.left, y: e.clientY - r.top };
      };

      this.canvas.addEventListener("mousedown", (e) => {
        const p = getPos(e);
        this.isDragging = true;
        this.dragMoved = false;
        this.dragStartX = p.x;
        this.dragStartY = p.y;
        this.dragPanX = this.panX;
        this.dragPanY = this.panY;
      });

      window.addEventListener("mousemove", (e) => {
        if (this.isDragging) {
          const p = getPos(e);
          const dx = p.x - this.dragStartX;
          const dy = p.y - this.dragStartY;
          if (Math.hypot(dx, dy) > 4) this.dragMoved = true;
          if (this.dragMoved) {
            this.panX = this.dragPanX + dx;
            this.panY = this.dragPanY + dy;
            this.bgDirty = true;
            this.drawNow();
          }
          return;
        }
        const r = this.canvas.getBoundingClientRect();
        if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) return;
        const p = { x: e.clientX - r.left, y: e.clientY - r.top };
        const hit = this._hitTest(p.x, p.y);
        const nextKey = hit?.node ? hit.node.key : null;
        const nextTeam = hit?.node ? hit.node.teamId : null;
        this.canvas.style.cursor = hit ? "pointer" : "grab";
        if (nextKey !== this.hoveredActorKey || nextTeam !== this.hoveredTeamId) {
          this.hoveredActorKey = nextKey;
          this.hoveredTeamId = nextTeam;
          this.drawNow();
        }
      });

      window.addEventListener("mouseup", () => { this.isDragging = false; });

      this.canvas.addEventListener("click", (e) => {
        if (this.dragMoved) return;
        const p = getPos(e);
        const hit = this._hitTest(p.x, p.y);
        if (!hit) return;
        if (hit.type === "redDot") this.cb.onRedDotClick?.(hit.node);
        else if (hit.type === "archive") this.cb.onArchiveClick?.(hit.botId);
        else if (hit.type === "actor") this.cb.onActorClick?.(hit.node);
      });

      this.canvas.addEventListener("dblclick", (e) => {
        const p = getPos(e);
        const hit = this._hitTest(p.x, p.y);
        if (hit?.node) this.cb.onActorDblClick?.(hit.node);
      });

      this.canvas.addEventListener("wheel", (e) => {
        e.preventDefault();
        const p = getPos(e);
        const factor = e.deltaY < 0 ? 1.1 : 0.91;
        const nextZ = Math.max(0.55, Math.min(2.2, this.zoom * factor));
        const ratio = nextZ / this.zoom;
        this.panX = p.x - (p.x - this.panX) * ratio;
        this.panY = p.y - (p.y - this.panY) * ratio;
        this.zoom = nextZ;
        this.bgDirty = true;
        this.drawNow();
      }, { passive: false });

      document.addEventListener("visibilitychange", () => {
        if (document.hidden) this.pause();
        else { this.drawNow(); this.resume(); }
      });
    }
  }

  global.IsoOfficeEngine = IsoOfficeEngine;
})(window);
