/**
 * Decision-First Interactive Inspector Card
 * - Opens immediately to FULL untruncated pending decisions (zero cramped 100px scrollbox, clickable URLs)
 * - Clickable option chips + Enter-to-send reply box -> sends question & answer straight back to Bot's chat via office.sendDecision
 * - Collapses Timeline & Team Workers into clean expandable disclosures when pending decisions exist
 */
(function () {
  const selectionState = new Map(); // `${itemNumber}:${qIdx}` -> Set<number>
  const draftTextState = new Map(); // `${itemNumber}` -> string
  const sentItemState = new Map();  // `${botId}:${itemNumber}` -> { at, summary }

  function esc(s) {
    return String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function linkifyContext(raw) {
    const text = String(raw || "");
    const urlRe = /https?:\/\/[^\s<>"')\]。，、；：]+/g;
    let out = "";
    let last = 0;
    let m;
    while ((m = urlRe.exec(text)) !== null) {
      out += esc(text.slice(last, m.index));
      const url = m[0];
      out += `<a class="ic-ext-link" href="#" data-ext-url="${esc(url)}">${esc(url)} ↗</a>`;
      last = m.index + url.length;
    }
    out += esc(text.slice(last));
    return out;
  }

  function buildDecisionPayload(bot, item, customText, tr) {
    const qs = item.ask?.questions || [];
    const lines = [];
    const summaryParts = [];
    lines.push(tr.decMailHeader(item.number, item.title));

    qs.forEach((q, qi) => {
      const sel = selectionState.get(`${item.number}:${qi}`);
      const pickedLabels = sel && sel.size > 0
        ? [...sel].sort((a, b) => a - b).map((oi) => q.options?.[oi]?.label).filter(Boolean)
        : [];
      if (pickedLabels.length > 0) {
        lines.push(`Q${qi + 1}: ${q.prompt}`);
        lines.push(`A${qi + 1}: ${pickedLabels.join(" / ")}`);
        summaryParts.push(pickedLabels.join(" / "));
      } else if (qs.length === 1 && customText) {
        lines.push(`Q1: ${q.prompt}`);
      }
    });

    if (customText) {
      lines.push(`${tr.decMailReplyLbl}${customText}`);
      summaryParts.push(customText);
    }

    if (summaryParts.length === 0) return null;
    lines.push("");
    lines.push(tr.decMailFooter(item.number));

    return {
      botName: bot.name,
      itemNumber: item.number,
      subject: `Decision #${item.number}: ${item.title}`.slice(0, 120),
      body: lines.join("\n"),
      summary: summaryParts.join(" · ").slice(0, 90),
    };
  }

  function renderModal(ctx) {
    const {
      target, avatars, tr, now, engPillHtml, miniRobotBadgeHtml,
      isStalled, fmtDur, relTime, openWorkspace, openTasksView,
      openExternalUrl, sendDecision, showToast, onClose, onSwitchWorker, onRerender,
    } = ctx;

    const root = document.getElementById("modalRoot");
    if (!target) { root.innerHTML = ""; return; }

    let title = "", roleText = "", engRaw = "", repo = "", branch = "";
    let statusCls = "idle", statusText = "", needsDec = false, lastAt = null;
    let timeline = [], links = [], avatarHtml = "", primaryWsId = null, attnWorkerWsId = null;
    let workersHtml = "", decisionsHtml = "", hasItems = false, botRef = null;

    if (target.kind === "bot") {
      const b = target.bot;
      botRef = b;
      title = b.name; roleText = tr.roleBot; engRaw = b.agent;
      needsDec = b.needsDecision; lastAt = b.lastActivityAt;
      timeline = b.timeline || []; links = b.links || []; primaryWsId = b.worktreeId;
      const firstDecW = (b.workers || []).find((w) => w.needsDecision);
      if (!b.selfNeedsDecision && firstDecW) attnWorkerWsId = firstDecW.worktreeId;

      const stall = isStalled(b);
      const dur = b.state === "working" && b.stateStartedAt ? fmtDur(now - b.stateStartedAt) : "";
      if (needsDec) {
        statusCls = "attn";
        statusText = `● ${(b.needsYouItems || []).length ? tr.stateNeedItem(b.needsYouItems.length) : (b.selfNeedsDecision ? tr.stateNeedPerm : tr.stateNeedWorker)}`;
      } else if (stall) { statusCls = "stall"; statusText = tr.stateStall(dur); }
      else if (b.state === "working" || b.workingWorkerCount > 0) { statusCls = "working"; statusText = `● ${tr.stateWorking}${dur ? ` · ${tr.stateRunDur(dur)}` : ""}`; }
      else { statusCls = "idle"; statusText = `💤 ${tr.stateIdle}`; }

      const av = avatars[b.id] || avatars[b.name];
      avatarHtml = av ? `<img src="${av}" alt=""/>` : `<span style="font-weight:800;font-size:16px">${esc((b.name || "?").slice(0, 1).toUpperCase())}</span>`;

      const items = b.needsYouItems || [];
      hasItems = items.length > 0;
      if (hasItems) {
        decisionsHtml = `
          <div class="ic-section-title is-dec">${esc(tr.secDecisions)}</div>
          ${items.map((it) => {
            const qs = it.ask?.questions || [];
            const sentInfo = sentItemState.get(`${b.id}:${it.number}`);
            const draft = draftTextState.get(String(it.number)) || "";
            return `
              <div class="ic-decision-box" data-dec-item="${it.number}">
                <div class="ic-dec-title"><span class="ic-dec-num">#${it.number}</span><span>${esc(it.title)}</span></div>
                ${it.ask?.context ? `<div class="ic-dec-ctx">${linkifyContext(it.ask.context)}</div>` : ""}
                ${qs.length ? `<div class="ic-q-list">${qs.map((q, qi) => {
                  const sel = selectionState.get(`${it.number}:${qi}`) || new Set();
                  return `
                    <div class="ic-q-item">
                      <div class="ic-q-prompt">${qi + 1}. ${esc(q.prompt)}${q.multi ? ` <span class="ic-q-multi">${esc(tr.decMulti)}</span>` : ""}</div>
                      ${(q.options || []).length ? `<div class="ic-q-opts">${q.options.map((opt, oi) => {
                        const isRec = q.recommended === oi;
                        const isSel = sel.has(oi);
                        return `<button type="button" class="ic-q-chip clickable ${isRec ? "rec" : ""} ${isSel ? "selected" : ""}" data-opt-item="${it.number}" data-opt-q="${qi}" data-opt-i="${oi}" data-opt-multi="${q.multi ? "1" : "0"}">${isSel ? "✓ " : (isRec ? "★ " : "")}${esc(opt.label)}</button>`;
                      }).join("")}</div>` : ""}
                    </div>`;
                }).join("")}</div>` : ""}
                ${sentInfo ? `<div class="ic-sent-banner">✓ ${esc(tr.decSentBanner(b.name, sentInfo.summary))}</div>` : ""}
                <div class="ic-reply-row">
                  <input class="ic-reply-input" type="text" data-reply-input="${it.number}" value="${esc(draft)}" placeholder="${esc(tr.decInputPh(b.name))}" />
                  <button type="button" class="ic-send-btn" data-send-item="${it.number}">${esc(tr.decSendBtn)}</button>
                </div>
              </div>`;
          }).join("")}`;
      }

      if ((b.workers || []).length > 0) {
        const rows = b.workers.map((w) => {
          const mode = w.needsDecision ? "attn" : (w.state === "working" ? "working" : "idle");
          const wd = w.state === "working" && w.stateStartedAt ? fmtDur(now - w.stateStartedAt) : "";
          return `
            <div class="ic-worker-row ${mode === "attn" ? "attn" : ""}" data-modal-switch-worker="${esc(w.worktreeId)}">
              <span class="ic-w-dot ${mode}"></span>
              <div class="ic-w-main">
                <div class="ic-w-name">${esc(w.displayName)} ${engPillHtml(w.agentType)}${wd ? ` · ${esc(wd)}` : ""}</div>
                <div class="ic-w-act">${esc(w.activity || tr.stateIdle)}</div>
              </div>
              <span class="ic-w-go ${w.needsDecision ? "attn" : ""}" data-modal-jump="${esc(w.worktreeId)}" data-modal-attn="${w.needsDecision ? "1" : "0"}">${w.needsDecision ? "● ↗" : "↗"}</span>
            </div>`;
        }).join("");

        workersHtml = hasItems
          ? `<details class="ic-collapse"><summary class="ic-collapse-sum">${esc(tr.secWorkers(b.workingWorkerCount, b.workers.length))}</summary><div class="ic-workers">${rows}</div></details>`
          : `<div class="ic-section-title">${esc(tr.secWorkers(b.workingWorkerCount, b.workers.length))}</div><div class="ic-workers">${rows}</div>`;
      }
      const bChats = b.branchChats || [];
      if (bChats.length > 0) {
        const chatRows = bChats.map((ch) => `
          <div class="ic-tl-row">
            <span class="ic-tl-lbl ${ch.isRecent ? "hot" : ""}">⑂ ${ch.isRecent ? "LIVE" : "CHAT"}</span><b>${esc(ch.title)}</b>${ch.lastActivityAt ? ` <span class="ic-muted">· ${esc(relTime(ch.lastActivityAt))}</span>` : ""}
            ${ch.lastSaid || ch.lastAsked ? `<div class="ic-branch-sub">${esc(ch.lastSaid || ch.lastAsked)}</div>` : ""}
          </div>`).join("");
        workersHtml += `<details class="ic-collapse" ${hasItems ? "" : "open"}><summary class="ic-collapse-sum">${esc(tr.secBranchChats(bChats.length))}</summary><div class="ic-timeline">${chatRows}</div></details>`;
      }
    } else {
      const w = target.worker;
      title = w.displayName;
      roleText = target.kind === "worker" ? tr.roleWorker(target.bot.name) : tr.roleStandalone;
      engRaw = w.agentType; repo = w.repo; branch = w.branch;
      needsDec = w.needsDecision; lastAt = w.lastActivityAt;
      timeline = w.timeline || []; links = w.links || [];
      primaryWsId = w.worktreeId; avatarHtml = miniRobotBadgeHtml(w);

      const stall = isStalled(w);
      const dur = w.state === "working" && w.stateStartedAt ? fmtDur(now - w.stateStartedAt) : "";
      if (needsDec) { statusCls = "attn"; statusText = `● ${tr.stateNeedPerm}`; }
      else if (stall) { statusCls = "stall"; statusText = tr.stateStall(dur); }
      else if (w.state === "working") { statusCls = "working"; statusText = `● ${tr.stateWorking}${dur ? ` · ${tr.stateRunDur(dur)}` : ""}`; }
      else { statusCls = "idle"; statusText = `💤 ${tr.stateIdle}`; }
    }

    const linksHtml = links.length
      ? `<div class="ic-links">${links.map((lk) => `<button class="ic-link-chip" data-ext-url="${esc(lk.url)}">${lk.kind === "pr" ? "🔀 " : "🔗 "}${esc(lk.label)} ↗</button>`).join("")}</div>`
      : "";
    const timelineRows = timeline.length
      ? timeline.map((row) => `<div class="ic-tl-row"><span class="ic-tl-lbl">${esc(row.label)}</span>${esc(row.text)}</div>`).join("")
      : `<div class="ic-tl-row" style="color:#94a3b8">${esc(tr.noActivity)}</div>`;
    const timelineSection = hasItems
      ? `<details class="ic-collapse"><summary class="ic-collapse-sum">${esc(tr.secTimeline)} (${timeline.length})</summary><div class="ic-timeline">${timelineRows}</div></details>`
      : `<div class="ic-section-title">${esc(tr.secTimeline)}</div><div class="ic-timeline">${timelineRows}</div>`;

    const primaryLabel = target.kind === "bot" ? tr.btnGoDecide : (needsDec ? tr.btnGoWorker : tr.btnOpenWs);
    const primaryBtn = primaryWsId ? `<button class="ic-btn ${needsDec && !attnWorkerWsId && !hasItems ? "primary-attn" : ""}" id="icOpenBtn">${esc(primaryLabel)}</button>` : "";
    const jumpAttnWorkerBtn = attnWorkerWsId ? `<button class="ic-btn primary-attn" id="icJumpAttnWorkerBtn">${esc(tr.btnGoWorker)}</button>` : "";
    const tasksBtn = "";

    root.innerHTML = `
      <div class="card-backdrop" id="cardBackdrop">
        <div class="inspector-card ${needsDec ? "is-attn" : ""} ${hasItems ? "is-dec-focus" : ""}">
          <div class="ic-head">
            <div class="ic-av">${avatarHtml}${needsDec ? `<span class="ic-av-dot"></span>` : ""}</div>
            <div class="ic-title-wrap">
              <div class="ic-name">${esc(title)}</div>
              <div class="ic-meta">
                ${engPillHtml(engRaw)}
                <span class="ic-pill">${esc(roleText)}</span>
                ${repo ? `<span class="ic-pill">${esc(repo)}</span>` : ""}
                ${branch ? `<span class="ic-pill branch" id="icCopyBranch" title="Click to copy branch">${esc(branch)}</span>` : ""}
              </div>
            </div>
            <button class="ic-close" id="icCloseBtn">×</button>
          </div>
          ${hasItems ? "" : `<div class="ic-status-bar ${statusCls}"><span>${esc(statusText)}</span>${lastAt ? `<span class="ic-time">${esc(relTime(lastAt))}</span>` : ""}</div>`}
          ${decisionsHtml}
          ${linksHtml}
          ${timelineSection}
          ${workersHtml}
          <div class="ic-actions">
            <button class="ic-btn secondary" id="icDismissBtn">${esc(tr.btnClose)}</button>
            ${tasksBtn}
            ${jumpAttnWorkerBtn}
            ${primaryBtn}
          </div>
        </div>
      </div>`;

    // Bind standard card actions
    document.getElementById("cardBackdrop")?.addEventListener("click", (e) => { if (e.target.id === "cardBackdrop") onClose(); });
    document.getElementById("icCloseBtn")?.addEventListener("click", onClose);
    document.getElementById("icDismissBtn")?.addEventListener("click", onClose);
    document.getElementById("icOpenBtn")?.addEventListener("click", () => { if (primaryWsId) void openWorkspace(primaryWsId, needsDec); onClose(); });
    document.getElementById("icJumpAttnWorkerBtn")?.addEventListener("click", () => { if (attnWorkerWsId) void openWorkspace(attnWorkerWsId, true); onClose(); });
    document.getElementById("icTasksBtn")?.addEventListener("click", () => { void openTasksView(); onClose(); });
    document.getElementById("icCopyBranch")?.addEventListener("click", async () => {
      const ok = await window.officeCopyText(branch);
      if (ok) showToast(tr.copiedBranch(branch));
    });
    root.querySelectorAll("[data-ext-url]").forEach((el) => {
      el.addEventListener("click", (e) => { e.preventDefault(); void openExternalUrl(el.getAttribute("data-ext-url")); });
    });
    root.querySelectorAll("[data-modal-switch-worker]").forEach((el) => {
      el.addEventListener("click", () => onSwitchWorker(el.getAttribute("data-modal-switch-worker")));
    });
    root.querySelectorAll("[data-modal-jump]").forEach((el) => {
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        const wid = el.getAttribute("data-modal-jump");
        if (wid) void openWorkspace(wid, el.getAttribute("data-modal-attn") === "1");
        onClose();
      });
    });

    // Bind interactive option selection & Enter/Click decision submission
    if (botRef && hasItems) {
      root.querySelectorAll("[data-opt-item]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const itemNum = btn.getAttribute("data-opt-item");
          const qi = btn.getAttribute("data-opt-q");
          const oi = Number(btn.getAttribute("data-opt-i"));
          const multi = btn.getAttribute("data-opt-multi") === "1";
          const key = `${itemNum}:${qi}`;
          const set = selectionState.get(key) || new Set();
          if (multi) {
            if (set.has(oi)) set.delete(oi); else set.add(oi);
          } else {
            if (set.has(oi)) set.clear(); else { set.clear(); set.add(oi); }
          }
          selectionState.set(key, set);
          onRerender();
          root.querySelector(`[data-reply-input="${itemNum}"]`)?.focus();
        });
      });

      const doSubmit = async (itemNum) => {
        const item = (botRef.needsYouItems || []).find((x) => String(x.number) === String(itemNum));
        if (!item) return;
        const inp = root.querySelector(`[data-reply-input="${itemNum}"]`);
        const btn = root.querySelector(`[data-send-item="${itemNum}"]`);
        const text = String(inp?.value || "").trim();
        const payload = buildDecisionPayload(botRef, item, text, tr);
        if (!payload) {
          showToast(tr.decNeedChoice, false);
          inp?.focus();
          return;
        }
        if (btn) { btn.disabled = true; btn.textContent = tr.decSending; }
        try {
          await sendDecision(payload);
          sentItemState.set(`${botRef.id}:${item.number}`, { at: Date.now(), summary: payload.summary });
          draftTextState.delete(String(item.number));
          (item.ask?.questions || []).forEach((_, qi) => selectionState.delete(`${item.number}:${qi}`));
          showToast(tr.decSentToast(botRef.name, item.number), false);
          onRerender();
        } catch (err) {
          showToast(tr.decSendFail(err?.message || err), true);
          if (btn) { btn.disabled = false; btn.textContent = tr.decSendBtn; }
        }
      };

      root.querySelectorAll("[data-reply-input]").forEach((inp) => {
        const itemNum = inp.getAttribute("data-reply-input");
        inp.addEventListener("input", () => draftTextState.set(itemNum, inp.value));
        inp.addEventListener("keydown", (e) => {
          if (e.key === "Enter" && !e.isComposing) {
            e.preventDefault();
            void doSubmit(itemNum);
          }
        });
      });
      root.querySelectorAll("[data-send-item]").forEach((btn) => {
        btn.addEventListener("click", () => void doSubmit(btn.getAttribute("data-send-item")));
      });
    }
  }

  window.OfficeInspector = { renderModal };
})();
