/**
 * In-Panel Modals for:
 * 1. Hiring / Creating a New Bot (supports BOTH "Direct Offer Card" and "Discuss with HR First")
 * 2. Customizing the TOP Floor Executive Chair Appearance (Empty / Silhouette / Local Image Upload)
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

  function detectDefaultHrBot(bots, configuredName) {
    const list = Array.isArray(bots) ? bots : [];
    if (!list.length) return null;
    if (configuredName) {
      const exact = list.find((b) => b.name.toLowerCase() === configuredName.toLowerCase());
      if (exact) return exact;
    }
    const hrMatch = list.find((b) =>
      /creator|hr|recruit|人力|招聘|创建/i.test(`${b.name || ""} ${b.specialty || ""}`)
    );
    return hrMatch || list[0];
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

  function renderHireModal(ctx) {
    const { snapshot, tr, hireBot, showToast, onClose } = ctx;
    const root = document.getElementById("modalRoot");
    const bots = snapshot?.bots || [];
    const defaultHr = detectDefaultHrBot(bots, snapshot?.settings?.hrBotName || "");
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

    const botOptionsHtml = bots.length
      ? bots.map((b) => `<option value="${esc(b.name)}" data-wid="${esc(b.worktreeId || "")}" ${defaultHr && b.id === defaultHr.id ? "selected" : ""}>${esc(b.name)}${b.specialty ? ` — ${esc(b.specialty.slice(0, 26))}` : ""}</option>`).join("")
      : `<option value="">${esc(tr.hireNoBot)}</option>`;

    root.innerHTML = `
      <div class="card-backdrop" id="cardBackdrop">
        <div class="inspector-card om-card">
          <div class="ic-head">
            <div class="ic-av om-av">🧑‍💼</div>
            <div class="ic-title-wrap">
              <div class="ic-name">${esc(tr.hireTitle)}</div>
              <div class="ic-meta"><span class="ic-pill">${esc(tr.hireSub)}</span></div>
            </div>
            <button class="ic-close" id="icCloseBtn">×</button>
          </div>

          <div class="om-form">
            <div class="om-field">
              <label class="om-lbl">${esc(tr.hireHrLbl)}</label>
              <select class="om-input" id="hireHrSelect">${botOptionsHtml}</select>
            </div>

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
            <button type="button" class="ic-btn secondary" id="hireDiscussBtn" ${!bots.length ? "disabled" : ""}>💬 ${esc(tr.hireBtnDiscuss)}</button>
            <button type="button" class="ic-btn om-primary" id="hireOfferBtn" ${!bots.length ? "disabled" : ""}>✨ ${esc(tr.hireBtnOffer)}</button>
          </div>
        </div>
      </div>`;

    let selectedTpl = "";
    document.getElementById("cardBackdrop")?.addEventListener("click", (e) => { if (e.target.id === "cardBackdrop") onClose(); });
    document.getElementById("icCloseBtn")?.addEventListener("click", onClose);
    document.getElementById("icDismissBtn")?.addEventListener("click", onClose);

    root.querySelectorAll("[data-tpl]").forEach((btn) => {
      btn.addEventListener("click", () => {
        selectedTpl = btn.getAttribute("data-tpl") || "";
        root.querySelectorAll("[data-tpl]").forEach((b) => b.classList.toggle("active", b === btn));
      });
    });

    const submitHire = async (mode) => {
      const sel = document.getElementById("hireHrSelect");
      const hrBotName = sel?.value || "";
      const hrWorktreeId = sel?.selectedOptions?.[0]?.getAttribute("data-wid") || "";
      const name = String(document.getElementById("hireNameInput")?.value || "").trim();
      const purpose = String(document.getElementById("hirePurposeInput")?.value || "").trim();
      const worktree = String(document.getElementById("hireWtSelect")?.value || "").trim();
      const watches = String(document.getElementById("hireWatchesInput")?.value || "").trim();
      const doesText = String(document.getElementById("hireDoesInput")?.value || "").trim();
      const reports = String(document.getElementById("hireReportsInput")?.value || "").trim();

      if (!hrBotName) { showToast(tr.hireNoBot, true); return; }
      if (mode === "offer" && !name && !selectedTpl) {
        showToast(tr.hireNeedName, true);
        document.getElementById("hireNameInput")?.focus();
        return;
      }
      if (!purpose && !selectedTpl) {
        showToast(tr.hireNeedPurpose, true);
        document.getElementById("hirePurposeInput")?.focus();
        return;
      }

      const offerBtn = document.getElementById("hireOfferBtn");
      const discBtn = document.getElementById("hireDiscussBtn");
      if (offerBtn) offerBtn.disabled = true;
      if (discBtn) discBtn.disabled = true;

      try {
        await hireBot({ hrBotName, hrWorktreeId, mode, name, purpose, template: selectedTpl, worktree, watches, doesText, reports, lang });
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

  function renderOwnerAvatarModal(ctx) {
    const { snapshot, avatars, tr, saveOwnerAvatar, showToast, onClose } = ctx;
    const root = document.getElementById("modalRoot");
    let currentMode = snapshot?.settings?.ownerAvatarMode || "empty";
    let previewUrl = avatars?.__owner__ || "";

    const drawCard = () => {
      const modes = [
        { id: "empty", icon: "🪑", label: tr.ownerModeEmpty, desc: tr.ownerModeEmptyDesc },
        { id: "silhouette", icon: "👤", label: tr.ownerModeSil, desc: tr.ownerModeSilDesc },
        { id: "custom", icon: "🖼️", label: tr.ownerModeCustom, desc: tr.ownerModeCustomDesc },
      ];
      const previewEl = currentMode === "custom" && previewUrl
        ? `<img src="${previewUrl}" alt="" />`
        : currentMode === "silhouette"
          ? `<span style="font-size:22px;opacity:0.7">👤</span>`
          : `<span style="font-size:22px">🪑</span>`;

      root.innerHTML = `
        <div class="card-backdrop" id="cardBackdrop">
          <div class="inspector-card om-card">
            <div class="ic-head">
              <div class="ic-av om-av">${previewEl}</div>
              <div class="ic-title-wrap">
                <div class="ic-name">${esc(tr.ownerModalTitle)}</div>
                <div class="ic-meta"><span class="ic-pill">${esc(tr.ownerModalSub)}</span></div>
              </div>
              <button class="ic-close" id="icCloseBtn">×</button>
            </div>

            <div class="om-mode-grid">
              ${modes.map((m) => `
                <button type="button" class="om-mode-card ${currentMode === m.id ? "active" : ""}" data-owner-mode="${m.id}">
                  <span class="om-mode-ico">${m.icon}</span>
                  <span class="om-mode-lbl">${esc(m.label)}</span>
                  <span class="om-mode-desc">${esc(m.desc)}</span>
                </button>`).join("")}
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
