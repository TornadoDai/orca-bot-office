/**
 * In-Panel Modals for:
 * 1. Universal Bot Hiring / Creation (works with ANY existing Bot — no dedicated HR Bot required! Includes 0-Bot copy-command fallback)
 * 2. TOP Floor Executive Chair Customizer (7 Built-In Illustrated Presets + Empty + Silhouette + Local Image Upload)
 */
(function () {
  function esc(s) {
    return String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  const TEMPLATES = [
    { id: "", zh: "自定义岗位", en: "Custom Role" },
    { id: "pr-review", zh: "代码审查", en: "PR Review" },
    { id: "release", zh: "版本发布", en: "Release" },
    { id: "support", zh: "问题排障", en: "Support" },
  ];

  function detectDefaultCreatorBot(bots, configuredName) {
    const list = Array.isArray(bots) ? bots : [];
    if (!list.length) return null;
    if (configuredName) {
      const exact = list.find((b) => b.name.toLowerCase() === configuredName.toLowerCase());
      if (exact) return exact;
    }
    const creatorMatch = list.find((b) =>
      /creator|hr|recruit|人力|招聘|创建/i.test(`${b.name || ""} ${b.specialty || ""}`)
    );
    return creatorMatch || list.find((b) => b.state === "working") || list[0];
  }

  function compressImageToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error("Invalid image file"));
        img.onload = () => {
          const size = 128;
          const c = document.createElement("canvas");
          c.width = size;
          c.height = size;
          const ctx = c.getContext("2d");
          const s = Math.min(img.width, img.height);
          const sx = (img.width - s) / 2;
          const sy = (img.height - s) / 2;
          ctx.drawImage(img, sx, sy, s, s, 0, 0, size, size);
          resolve(c.toDataURL("image/jpeg", 0.84));
        };
        img.src = String(reader.result || "");
      };
      reader.readAsDataURL(file);
    });
  }

  function buildCliOfferCommand({ name, purpose, template, worktree, watches, doesText, reports }) {
    const q = (s) => JSON.stringify(String(s || "").trim());
    const parts = ["orca bot create --offer"];
    if (name) parts.push(`--name ${q(name)}`);
    if (purpose) parts.push(`--purpose ${q(purpose)}`);
    if (template) parts.push(`--template ${q(template)}`);
    if (worktree) parts.push(`--worktree ${q(worktree)}`);
    if (watches) parts.push(`--watches ${q(watches)}`);
    if (doesText) parts.push(`--does ${q(doesText)}`);
    if (reports) parts.push(`--reports ${q(reports)}`);
    return parts.join(" ");
  }

  function renderHireModal(ctx) {
    const { snapshot, tr, hireBot, showToast, onOpenMarket, prefill, onClose } = ctx;
    const root = document.getElementById("modalRoot");
    if (root?.querySelector('[data-modal-kind="hire"]')) return;
    const bots = snapshot?.bots || [];
    const pf = prefill || {};
    const defaultBot = detectDefaultCreatorBot(bots, snapshot?.settings?.hrBotName || "");
    const lang = tr.title === "AI 总部大楼" ? "zh" : "en";

    const worktreeOpts = [];
    for (const w of snapshot?.standalone || []) {
      worktreeOpts.push({ id: w.worktreeId, label: `${w.displayName}${w.repo ? ` (${w.repo})` : ""}` });
    }
    for (const b of bots) {
      for (const w of b.workers || []) {
        worktreeOpts.push({ id: w.worktreeId, label: `${w.displayName} · ${b.name}` });
      }
    }

    const botSelectSection = bots.length
      ? `<div class="om-field">
           <label class="om-lbl">${esc(tr.hireHrLbl)}</label>
           <select class="om-input" id="hireHrSelect">
             ${bots.map((b) => `<option value="${esc(b.name)}" data-wid="${esc(b.worktreeId || "")}" ${defaultBot && b.id === defaultBot.id ? "selected" : ""}>${esc(b.name)}${b.specialty ? ` — ${esc(b.specialty.slice(0, 26))}` : ""}</option>`).join("")}
           </select>
         </div>`
      : `<div class="om-zero-tip">${esc(tr.hireNoBot)}</div>`;

    root.innerHTML = `
      <div class="card-backdrop" id="cardBackdrop">
        <div class="inspector-card om-card" data-modal-kind="hire">
          <div class="ic-head">
            <div class="ic-av om-av">🧑‍💼</div>
            <div class="ic-title-wrap">
              <div class="ic-name">${esc(tr.hireTitle)}</div>
              <div class="ic-meta"><span class="ic-pill">${esc(tr.hireSub)}</span></div>
            </div>
            <button class="ic-close" id="icCloseBtn">×</button>
          </div>

          <div class="om-form">
            ${onOpenMarket ? `
              <button type="button" class="om-market-bridge" id="hireOpenMarketBtn">
                <div>
                  <div class="om-mb-title">💡 ${lang === "zh" ? "提示：可以直接从「Bot 人才市场」一键招聘！" : "Tip: You can 1-click hire ready-made Bots from Talent Market!"}</div>
                  <div class="om-mb-sub">${lang === "zh" ? "已内置 24 套 Orca 官方岗位模板 + 社区现成 Bot，不用从零写职责" : "24 official Orca role templates + community shared Bots ready to hire"}</div>
                </div>
                <span class="om-mb-go">🏪 ${lang === "zh" ? "去人才市场 →" : "Talent Market →"}</span>
              </button>` : ""}
            ${botSelectSection}

            <div class="om-field">
              <label class="om-lbl">${esc(tr.hireTplLbl)}</label>
              <div class="om-chips" id="hireTplChips">
                ${TEMPLATES.map((tp, i) => `<button type="button" class="om-chip ${i === 0 ? "active" : ""}" data-tpl="${esc(tp.id)}">${esc(tp[lang])}</button>`).join("")}
              </div>
            </div>

            <div class="om-field">
              <label class="om-lbl">${esc(tr.hireNameLbl)} <span class="om-hint">${esc(tr.hireNameHint)}</span></label>
              <input class="om-input" id="hireNameInput" type="text" placeholder="${esc(tr.hireNamePh)}" />
            </div>

            <div class="om-field">
              <label class="om-lbl">${esc(tr.hirePurposeLbl)}</label>
              <textarea class="om-textarea" id="hirePurposeInput" rows="3" placeholder="${esc(tr.hirePurposePh)}"></textarea>
            </div>

            <details class="ic-collapse">
              <summary class="ic-collapse-sum">${esc(tr.hireAdvTitle)}</summary>
              <div class="om-adv-body">
                ${worktreeOpts.length ? `
                  <div class="om-field">
                    <label class="om-lbl">${esc(tr.hireWtLbl)}</label>
                    <select class="om-input" id="hireWtSelect">
                      <option value="">${esc(tr.hireWtNone)}</option>
                      ${worktreeOpts.slice(0, 20).map((w) => `<option value="id:${esc(w.id)}">${esc(w.label)}</option>`).join("")}
                    </select>
                  </div>` : ""}
                <div class="om-field">
                  <label class="om-lbl">${esc(tr.hireWatchesLbl)}</label>
                  <input class="om-input" id="hireWatchesInput" type="text" placeholder="${esc(tr.hireWatchesPh)}" />
                </div>
                <div class="om-field">
                  <label class="om-lbl">${esc(tr.hireDoesLbl)}</label>
                  <input class="om-input" id="hireDoesInput" type="text" placeholder="${esc(tr.hireDoesPh)}" />
                </div>
                <div class="om-field">
                  <label class="om-lbl">${esc(tr.hireReportsLbl)}</label>
                  <input class="om-input" id="hireReportsInput" type="text" placeholder="${esc(tr.hireReportsPh)}" />
                </div>
              </div>
            </details>
          </div>

          <div class="ic-actions om-actions">
            <button type="button" class="ic-btn secondary" id="icDismissBtn">${esc(tr.btnClose)}</button>
            ${bots.length
              ? `<button type="button" class="ic-btn secondary" id="hireDiscussBtn">💬 ${esc(tr.hireBtnDiscuss)}</button>
                 <button type="button" class="ic-btn om-primary" id="hireOfferBtn">✨ ${esc(tr.hireBtnOffer)}</button>`
              : `<button type="button" class="ic-btn om-primary" id="hireCopyCmdBtn">📋 ${esc(tr.hireCopyCmd)}</button>`}
          </div>
        </div>
      </div>`;

    let selectedTpl = pf.template || "";
    if (pf.name) { const el = document.getElementById("hireNameInput"); if (el) el.value = pf.name; }
    if (pf.purpose) { const el = document.getElementById("hirePurposeInput"); if (el) el.value = pf.purpose; }
    if (pf.watches) { const el = document.getElementById("hireWatchesInput"); if (el) el.value = pf.watches; }
    if (pf.doesText) { const el = document.getElementById("hireDoesInput"); if (el) el.value = pf.doesText; }
    if (pf.reports) { const el = document.getElementById("hireReportsInput"); if (el) el.value = pf.reports; }
    if (selectedTpl) {
      root.querySelectorAll("[data-tpl]").forEach((b) => b.classList.toggle("active", (b.getAttribute("data-tpl") || "") === selectedTpl));
    }
    document.getElementById("cardBackdrop")?.addEventListener("click", (e) => { if (e.target.id === "cardBackdrop") onClose(); });
    document.getElementById("icCloseBtn")?.addEventListener("click", onClose);
    document.getElementById("icDismissBtn")?.addEventListener("click", onClose);
    document.getElementById("hireOpenMarketBtn")?.addEventListener("click", () => { onClose(); onOpenMarket?.(); });

    root.querySelectorAll("[data-tpl]").forEach((btn) => {
      btn.addEventListener("click", () => {
        selectedTpl = btn.getAttribute("data-tpl") || "";
        root.querySelectorAll("[data-tpl]").forEach((b) => b.classList.toggle("active", b === btn));
      });
    });

    const readForm = () => ({
      name: String(document.getElementById("hireNameInput")?.value || "").trim(),
      purpose: String(document.getElementById("hirePurposeInput")?.value || "").trim(),
      template: selectedTpl,
      worktree: String(document.getElementById("hireWtSelect")?.value || "").trim(),
      watches: String(document.getElementById("hireWatchesInput")?.value || "").trim(),
      doesText: String(document.getElementById("hireDoesInput")?.value || "").trim(),
      reports: String(document.getElementById("hireReportsInput")?.value || "").trim(),
    });

    document.getElementById("hireCopyCmdBtn")?.addEventListener("click", async () => {
      const f = readForm();
      const cmd = buildCliOfferCommand(f);
      try {
        await navigator.clipboard.writeText(cmd);
        showToast(tr.hireCopiedCmd, false);
      } catch {
        showToast(cmd, false);
      }
    });

    const submitHire = async (mode) => {
      const sel = document.getElementById("hireHrSelect");
      const hrBotName = sel?.value || "";
      const hrWorktreeId = sel?.selectedOptions?.[0]?.getAttribute("data-wid") || "";
      const f = readForm();

      if (!hrBotName) { showToast(tr.hireNoBot, true); return; }
      if (mode === "offer" && !f.name && !f.template) {
        showToast(tr.hireNeedName, true);
        document.getElementById("hireNameInput")?.focus();
        return;
      }
      if (!f.purpose && !f.template) {
        showToast(tr.hireNeedPurpose, true);
        document.getElementById("hirePurposeInput")?.focus();
        return;
      }

      const offerBtn = document.getElementById("hireOfferBtn");
      const discBtn = document.getElementById("hireDiscussBtn");
      if (offerBtn) offerBtn.disabled = true;
      if (discBtn) discBtn.disabled = true;

      try {
        await hireBot({ hrBotName, hrWorktreeId, mode, ...f, lang });
        showToast(tr.hireSentToast(hrBotName, mode === "offer"), false);
        onClose();
      } catch (err) {
        showToast(tr.decSendFail(err?.message || err), true);
        if (offerBtn) offerBtn.disabled = false;
        if (discBtn) discBtn.disabled = false;
      }
    };

    document.getElementById("hireOfferBtn")?.addEventListener("click", () => void submitHire("offer"));
    document.getElementById("hireDiscussBtn")?.addEventListener("click", () => void submitHire("discuss"));
    document.getElementById("hireNameInput")?.focus();
  }

  const thumbCache = new Map();
  function getThumb(presetId) {
    if (thumbCache.has(presetId)) return thumbCache.get(presetId);
    const url = window.OfficePresets ? window.OfficePresets.renderPresetThumbDataUrl(presetId) : "";
    thumbCache.set(presetId, url);
    return url;
  }

  function renderOwnerAvatarModal(ctx) {
    const { snapshot, avatars, tr, saveOwnerAvatar, showToast, onClose } = ctx;
    const root = document.getElementById("modalRoot");
    if (root?.querySelector('[data-modal-kind="ownerDesk"]')) return;
    const lang = tr.title === "AI 总部大楼" ? "zh" : "en";
    let currentMode = snapshot?.settings?.ownerAvatarMode || "empty";
    let previewUrl = avatars?.__owner__ || "";

    const drawCard = () => {
      const presets = window.OfficePresets ? window.OfficePresets.PRESET_LIST : [];
      const headPreview = currentMode === "custom" && previewUrl
        ? `<img src="${previewUrl}" alt="" />`
        : `<img src="${getThumb(currentMode === "custom" ? "empty" : currentMode)}" alt="" />`;

      root.innerHTML = `
        <div class="card-backdrop" id="cardBackdrop">
          <div class="inspector-card om-card om-wide" data-modal-kind="ownerDesk">
            <div class="ic-head">
              <div class="ic-av om-av">${headPreview}</div>
              <div class="ic-title-wrap">
                <div class="ic-name">${esc(tr.ownerModalTitle)}</div>
                <div class="ic-meta"><span class="ic-pill">${esc(tr.ownerModalSub)}</span></div>
              </div>
              <button class="ic-close" id="icCloseBtn">×</button>
            </div>

            <div class="om-preset-grid">
              ${presets.map((p) => {
                const isCustom = p.id === "custom";
                const thumb = isCustom
                  ? (previewUrl ? `<img class="om-p-img" src="${previewUrl}" alt=""/>` : `<span class="om-p-plus">🖼️</span>`)
                  : `<img class="om-p-img" src="${getThumb(p.id)}" alt=""/>`;
                return `
                  <button type="button" class="om-preset-card ${currentMode === p.id ? "active" : ""}" data-owner-mode="${esc(p.id)}">
                    <span class="om-p-thumb">${thumb}</span>
                    <span class="om-p-lbl">${esc(p[lang])}</span>
                  </button>`;
              }).join("")}
            </div>

            <div class="om-upload-box">
              <input type="file" id="ownerImgFile" accept="image/*" style="display:none" />
              <button type="button" class="ic-btn" id="ownerPickImgBtn">📁 ${esc(tr.ownerPickImg)}</button>
              ${previewUrl ? `<button type="button" class="ic-btn secondary" id="ownerClearImgBtn">${esc(tr.ownerClearImg)}</button>` : ""}
              <span class="om-hint">${esc(tr.ownerImgHint)}</span>
            </div>

            <div class="ic-actions">
              <button type="button" class="ic-btn secondary" id="icDismissBtn">${esc(tr.btnClose)}</button>
            </div>
          </div>
        </div>`;

      document.getElementById("cardBackdrop")?.addEventListener("click", (e) => { if (e.target.id === "cardBackdrop") onClose(); });
      document.getElementById("icCloseBtn")?.addEventListener("click", onClose);
      document.getElementById("icDismissBtn")?.addEventListener("click", onClose);

      root.querySelectorAll("[data-owner-mode]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const nextMode = btn.getAttribute("data-owner-mode");
          if (nextMode === "custom" && !previewUrl) {
            document.getElementById("ownerImgFile")?.click();
            return;
          }
          currentMode = nextMode;
          try {
            await saveOwnerAvatar({ mode: currentMode });
            showToast(tr.ownerSavedToast, false);
            drawCard();
          } catch (err) {
            showToast(tr.decSendFail(err?.message || err), true);
          }
        });
      });

      document.getElementById("ownerPickImgBtn")?.addEventListener("click", () => {
        document.getElementById("ownerImgFile")?.click();
      });

      document.getElementById("ownerImgFile")?.addEventListener("change", async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
          const dataUrl = await compressImageToDataUrl(file);
          previewUrl = dataUrl;
          currentMode = "custom";
          await saveOwnerAvatar({ mode: "custom", dataUrl });
          showToast(tr.ownerSavedToast, false);
          drawCard();
        } catch (err) {
          showToast(tr.decSendFail(err?.message || err), true);
        }
      });

      document.getElementById("ownerClearImgBtn")?.addEventListener("click", async () => {
        previewUrl = "";
        currentMode = "empty";
        try {
          await saveOwnerAvatar({ mode: "empty", clearImage: true });
          showToast(tr.ownerSavedToast, false);
          drawCard();
        } catch (err) {
          showToast(tr.decSendFail(err?.message || err), true);
        }
      });
    };

    drawCard();
  }

  window.OfficeModals = { renderHireModal, renderOwnerAvatarModal };
})();
