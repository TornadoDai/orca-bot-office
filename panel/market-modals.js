/**
 * Talent Market Modals:
 * 1. Bot Resume Detail Modal (full pitch, safety notice, copy share link, report, like & 1-click Hire)
 * 2. 10-Second Publish Modal (auto-fill from local Orca Bots + live share link validation)
 */
(function () {
  const SHARE_ID_RE = /^[A-Za-z0-9_-]{1,128}$/;
  const ORCA_HOSTS = new Set(["app.orca.dev", "share.orca.dev", "share.onorca.dev"]);
  const MASCOT_IDS = [
    "A1", "B1", "D1", "E1", "F1", "G1", "H1", "H2", "I1", "J1",
    "K2", "L2", "M1", "N1", "O1", "P3", "Q1", "R3", "S2", "T1",
  ];
  const COLORS = ["#b3dbf4", "#c5dfb5", "#f8cfa8", "#c9b8e8", "#f4c4cf", "#f6e3a1", "#1f2126", "#3a3f4b"];
  const CATS = [
    { id: "dev", zh: "研发与审查", en: "Dev & Review" },
    { id: "ops", zh: "运维与排障", en: "Ops & Debug" },
    { id: "release", zh: "发布与自动化", en: "Release & Auto" },
    { id: "productivity", zh: "效率与日常", en: "Productivity" },
    { id: "research", zh: "调研与内容", en: "Research" },
    { id: "general", zh: "通用岗位", en: "General" },
  ];

  function esc(s) {
    return String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function parseShareId(raw) {
    const v = String(raw || "").trim();
    if (!v) return null;
    if (SHARE_ID_RE.test(v)) return v;
    try {
      const u = new URL(v);
      const re = /^\/?bots\/share\/([A-Za-z0-9_-]{1,128})\/?$/;
      if (u.protocol === "orca:") return `${u.host}${u.pathname}`.match(re)?.[1] ?? null;
      if (u.protocol === "https:" && ORCA_HOSTS.has(u.hostname)) return u.pathname.match(re)?.[1] ?? null;
    } catch {}
    return null;
  }

  function renderMarketDetailModal(ctx) {
    const { bot, lang, liveWritable, engPillHtml, onLike, onHire, onReport, showToast, onClose } = ctx;
    const root = document.getElementById("modalRoot");
    if (!root || !bot) return;
    const zh = lang === "zh";
    const isVer = bot.trust === "verified";
    const tagsHtml = (bot.tags || []).map((tg) => `<span class="mkt-tag">#${esc(tg)}</span>`).join("");

    root.innerHTML = `
      <div class="card-backdrop" id="cardBackdrop">
        <div class="inspector-card om-card" data-modal-kind="marketDetail">
          <div class="ic-head">
            <img class="mkt-av" src="${esc(bot.avatarDataUrl)}" alt="" />
            <div class="ic-title-wrap">
              <div class="mkt-name-row">
                <span class="ic-name">${esc(bot.name)}</span>
                <span class="mkt-trust ${isVer ? "verified" : "community"}">${isVer ? (zh ? "✓ 官方精选" : "✓ Verified") : (zh ? "社区分享" : "Community")}</span>
              </div>
              <div class="ic-meta" style="margin-top:4px">
                ${engPillHtml(bot.agentHint || "claude")}
                <span class="ic-pill">by ${esc(bot.authorName || "Community")}</span>
                <span class="ic-pill">👥 ${zh ? `已招 ${bot.hiresCount || 0} 次` : `${bot.hiresCount || 0} hires`}</span>
              </div>
            </div>
            <button class="ic-close" id="icCloseBtn">×</button>
          </div>

          <div class="mkt-safety">
            <span>🛡️</span>
            <span>${zh
              ? "点击「立即招聘」将直接唤起 Orca 原生审核窗口，你可以完整查看该 Bot 的 SOUL、Skills、工具与权限后再确认入职。"
              : "Clicking Hire opens Orca's native Share Review dialog so you inspect its SOUL, skills, tools & permissions before creating."}</span>
          </div>

          <div class="om-form" style="margin-top:10px">
            <div class="ic-section-title">${zh ? "岗位职责" : "Role & Purpose"}</div>
            <div style="font-size:12.5px;line-height:1.55;color:var(--fg)">${esc(bot.purpose)}</div>
            ${bot.description ? `<div style="font-size:11.5px;line-height:1.6;color:var(--fg-soft);white-space:pre-wrap;margin-top:6px">${esc(bot.description)}</div>` : ""}
            ${tagsHtml ? `<div class="mkt-tags" style="margin-top:8px">${tagsHtml}</div>` : ""}
            <div style="display:flex;align-items:center;gap:6px;margin-top:10px;flex-wrap:wrap">
              <button type="button" class="mkt-btn-ghost" id="mktCopyShareBtn">🔗 ${zh ? "复制 Orca 分享链接" : "Copy Share Link"}</button>
              ${liveWritable ? `<button type="button" class="mkt-btn-ghost" id="mktReportBtn">🚩 ${zh ? "举报失效/垃圾" : "Report Broken/Spam"}</button>` : ""}
            </div>
          </div>

          <div class="ic-actions om-actions">
            <button type="button" class="ic-btn secondary" id="icDismissBtn">${zh ? "关闭" : "Close"}</button>
            <button type="button" class="mkt-like-btn ${bot.liked ? "liked" : ""}" id="mktDetailLikeBtn">👍 <span>${bot.likesCount || 0}</span></button>
            <button type="button" class="mkt-btn-primary" id="mktDetailHireBtn">⚡ ${zh ? "立即招聘入职" : "Hire into Orca"}</button>
          </div>
        </div>
      </div>`;

    document.getElementById("cardBackdrop")?.addEventListener("click", (e) => { if (e.target.id === "cardBackdrop") onClose(); });
    document.getElementById("icCloseBtn")?.addEventListener("click", onClose);
    document.getElementById("icDismissBtn")?.addEventListener("click", onClose);
    document.getElementById("mktCopyShareBtn")?.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(bot.shareUrl || bot.deepLink);
        showToast(zh ? "✓ 已复制 Orca 分享链接" : "✓ Copied Orca share link", false);
      } catch {}
    });
    document.getElementById("mktDetailLikeBtn")?.addEventListener("click", async () => {
      await onLike(bot);
      const btn = document.getElementById("mktDetailLikeBtn");
      if (btn) {
        btn.classList.toggle("liked", Boolean(bot.liked));
        const sp = btn.querySelector("span");
        if (sp) sp.textContent = String(bot.likesCount || 0);
      }
    });
    document.getElementById("mktDetailHireBtn")?.addEventListener("click", async () => {
      await onHire(bot);
    });
    document.getElementById("mktReportBtn")?.addEventListener("click", async () => {
      await onReport(bot);
      onClose();
    });
  }

  function renderMarketPublishModal(ctx) {
    const { localBots, lang, liveWritable, apiConfigured, onPublish, showToast, onClose } = ctx;
    const root = document.getElementById("modalRoot");
    if (!root || root.querySelector('[data-modal-kind="marketPublish"]')) return;
    const zh = lang === "zh";
    const bots = Array.isArray(localBots) ? localBots : [];

    root.innerHTML = `
      <div class="card-backdrop" id="cardBackdrop">
        <div class="inspector-card om-card" data-modal-kind="marketPublish">
          <div class="ic-head">
            <div class="ic-av om-av">🚀</div>
            <div class="ic-title-wrap">
              <div class="ic-name">${zh ? "分享我的 Bot 到人才市场" : "Publish Bot to Talent Market"}</div>
              <div class="ic-meta"><span class="ic-pill">${zh ? "只需粘贴 Orca 分享链接 · 10 秒上架" : "Paste your Orca Share Bot link · live in seconds"}</span></div>
            </div>
            <button class="ic-close" id="icCloseBtn">×</button>
          </div>

          ${!liveWritable ? `<div class="mkt-safety"><span>⚠️</span><span>${zh
            ? (apiConfigured ? "当前处于 CDN 离线镜像只读模式（无法连通实时 API），请检查网络或代理后再发布。" : "尚未配置人才市场实时 API 地址（请在插件设置填入 marketApiUrl，部署完 Cloudflare Worker 即可一键发布）。")
            : (apiConfigured ? "Currently in read-only CDN mirror mode. Check network/proxy to publish." : "Market API URL not configured yet (set marketApiUrl in plugin settings after deploying your Worker).")}</span></div>` : ""}

          <div class="om-form" style="margin-top:8px">
            ${bots.length ? `
              <div class="om-field">
                <label class="om-lbl">${zh ? "⚡ 一键从本机 Bot 自动回填信息（可选）" : "⚡ Auto-fill from a local Bot (optional)"}</label>
                <select class="om-input" id="mktLocalPick">
                  <option value="">${zh ? "— 手动填写 —" : "— Fill manually —"}</option>
                  ${bots.map((b, i) => `<option value="${i}">${esc(b.name)} (${esc(b.agentHint)})</option>`).join("")}
                </select>
              </div>` : ""}

            <div class="om-field">
              <label class="om-lbl">${zh ? "Orca 分享链接 *" : "Orca Share Bot Link *"}</label>
              <input class="om-input" id="mktShareInput" type="text" placeholder="https://app.orca.dev/bots/share/... 或 orca://bots/share/..." />
              <div class="mkt-link-status" id="mktLinkStatus"></div>
            </div>

            <div class="om-field">
              <label class="om-lbl">${zh ? "Bot 名称 *" : "Bot Name *"}</label>
              <input class="om-input" id="mktNameInput" type="text" maxlength="48" placeholder="${zh ? "例如：PR 审查专家 / 线上排障小助手" : "e.g. PR Reviewer Pro / Incident Triage"}" />
            </div>

            <div class="om-field">
              <label class="om-lbl">${zh ? "一句话职责亮点 *" : "One-Line Pitch *"}</label>
              <input class="om-input" id="mktPurposeInput" type="text" maxlength="160" placeholder="${zh ? "说明它最擅长解决什么问题…" : "What problem does this Bot nail?"}" />
            </div>

            <div class="om-field">
              <label class="om-lbl">${zh ? "岗位分类" : "Category"}</label>
              <div class="om-chips" id="mktCatChips">
                ${CATS.map((c, i) => `<button type="button" class="om-chip ${i === 0 ? "active" : ""}" data-mcat="${c.id}">${esc(c[lang])}</button>`).join("")}
              </div>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
              <div class="om-field">
                <label class="om-lbl">${zh ? "标签（逗号分隔）" : "Tags (comma-separated)"}</label>
                <input class="om-input" id="mktTagsInput" type="text" placeholder="pr, ci, k8s" />
              </div>
              <div class="om-field">
                <label class="om-lbl">${zh ? "作者署名" : "Author Name"}</label>
                <input class="om-input" id="mktAuthorInput" type="text" maxlength="36" placeholder="${zh ? "你的昵称 / GitHub ID" : "Your name or @handle"}" />
              </div>
            </div>

            <details class="ic-collapse">
              <summary class="ic-collapse-sum">${zh ? "更多外观与详细介绍（吉祥物 / Agent / 说明）" : "Appearance & Detailed Notes (Mascot / Agent / Bio)"}</summary>
              <div class="om-adv-body">
                <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px">
                  <div class="om-field">
                    <label class="om-lbl">${zh ? "推荐 Agent" : "Agent"}</label>
                    <select class="om-input" id="mktAgentSelect">
                      <option value="claude">Claude</option>
                      <option value="antigravity">Antigravity</option>
                      <option value="codex">Codex</option>
                      <option value="pi">Pi</option>
                      <option value="gemini">Gemini</option>
                    </select>
                  </div>
                  <div class="om-field">
                    <label class="om-lbl">${zh ? "吉祥物" : "Mascot"}</label>
                    <select class="om-input" id="mktMascotSelect">
                      ${MASCOT_IDS.map((m) => `<option value="${m}">${m}</option>`).join("")}
                    </select>
                  </div>
                  <div class="om-field">
                    <label class="om-lbl">${zh ? "底色" : "Color"}</label>
                    <select class="om-input" id="mktColorSelect">
                      ${COLORS.map((c) => `<option value="${c}">${c}</option>`).join("")}
                    </select>
                  </div>
                </div>
                <div class="om-field">
                  <label class="om-lbl">${zh ? "详细使用说明（可选）" : "Detailed Setup / Usage Notes (optional)"}</label>
                  <textarea class="om-textarea" id="mktDescInput" rows="3" maxlength="1200" placeholder="${zh ? "适配仓库类型、依赖的连接器或 Skills 说明…" : "Best suited workflows, required connectors or skills…"}"></textarea>
                </div>
              </div>
            </details>
          </div>

          <div class="ic-actions om-actions">
            <button type="button" class="ic-btn secondary" id="icDismissBtn">${zh ? "取消" : "Cancel"}</button>
            <button type="button" class="mkt-btn-primary" id="mktSubmitPubBtn" ${liveWritable ? "" : "disabled"}>🚀 ${zh ? "立即上架到人才市场" : "Publish Now"}</button>
          </div>
        </div>
      </div>`;

    let selectedCat = "dev";
    let pickedAvatarType = "mascot";
    let pickedAvatarValue = "A1";

    document.getElementById("cardBackdrop")?.addEventListener("click", (e) => { if (e.target.id === "cardBackdrop") onClose(); });
    document.getElementById("icCloseBtn")?.addEventListener("click", onClose);
    document.getElementById("icDismissBtn")?.addEventListener("click", onClose);

    root.querySelectorAll("[data-mcat]").forEach((btn) => {
      btn.addEventListener("click", () => {
        selectedCat = btn.getAttribute("data-mcat") || "general";
        root.querySelectorAll("[data-mcat]").forEach((b) => b.classList.toggle("active", b === btn));
      });
    });

    const shareInp = document.getElementById("mktShareInput");
    const statusEl = document.getElementById("mktLinkStatus");
    shareInp?.addEventListener("input", () => {
      const val = shareInp.value.trim();
      if (!val) { statusEl.textContent = ""; statusEl.className = "mkt-link-status"; return; }
      const sid = parseShareId(val);
      if (sid) {
        statusEl.textContent = zh ? `✓ 识别到有效 Orca 分享 ID：${sid}` : `✓ Valid Orca share ID: ${sid}`;
        statusEl.className = "mkt-link-status ok";
      } else {
        statusEl.textContent = zh ? "✕ 请粘贴 Orca 的 Share Bot 链接（app.orca.dev/bots/share/...）" : "✕ Paste a valid Orca Share Bot link (app.orca.dev/bots/share/...)";
        statusEl.className = "mkt-link-status bad";
      }
    });

    document.getElementById("mktLocalPick")?.addEventListener("change", (e) => {
      const idx = e.target.value;
      if (idx === "") return;
      const b = bots[Number(idx)];
      if (!b) return;
      const nameEl = document.getElementById("mktNameInput");
      const purpEl = document.getElementById("mktPurposeInput");
      const agEl = document.getElementById("mktAgentSelect");
      const msEl = document.getElementById("mktMascotSelect");
      const clEl = document.getElementById("mktColorSelect");
      if (nameEl) nameEl.value = b.name || "";
      if (purpEl && b.purpose) purpEl.value = b.purpose;
      if (agEl && [...agEl.options].some((o) => o.value === b.agentHint)) agEl.value = b.agentHint;
      pickedAvatarType = b.avatarType || "mascot";
      pickedAvatarValue = b.avatarValue || "A1";
      if (msEl && pickedAvatarType === "mascot" && MASCOT_IDS.includes(pickedAvatarValue)) msEl.value = pickedAvatarValue;
      if (clEl && COLORS.includes(b.avatarColor)) clEl.value = b.avatarColor;
    });

    document.getElementById("mktSubmitPubBtn")?.addEventListener("click", async () => {
      const shareUrl = String(shareInp?.value || "").trim();
      const shareId = parseShareId(shareUrl);
      const name = String(document.getElementById("mktNameInput")?.value || "").trim();
      const purpose = String(document.getElementById("mktPurposeInput")?.value || "").trim();
      if (!shareId) { showToast(zh ? "请先粘贴有效的 Orca 分享链接" : "Please enter a valid Orca share link", true); shareInp?.focus(); return; }
      if (name.length < 2) { showToast(zh ? "请填写 Bot 名称（至少 2 个字）" : "Enter a Bot name (min 2 chars)", true); return; }
      if (purpose.length < 4) { showToast(zh ? "请填写一句话职责亮点" : "Enter a one-line purpose", true); return; }

      const btn = document.getElementById("mktSubmitPubBtn");
      if (btn) btn.disabled = true;
      try {
        await onPublish({
          shareUrl,
          name,
          purpose,
          description: String(document.getElementById("mktDescInput")?.value || "").trim(),
          category: selectedCat,
          tags: String(document.getElementById("mktTagsInput")?.value || "").trim(),
          agentHint: String(document.getElementById("mktAgentSelect")?.value || "claude"),
          avatarType: pickedAvatarType,
          avatarValue: pickedAvatarType === "mascot" ? String(document.getElementById("mktMascotSelect")?.value || "A1") : pickedAvatarValue,
          avatarColor: String(document.getElementById("mktColorSelect")?.value || "#b3dbf4"),
          authorName: String(document.getElementById("mktAuthorInput")?.value || "").trim() || "Community",
        });
        showToast(zh ? `✓「${name}」已成功上架到人才市场！` : `✓ "${name}" published to Talent Market!`, false);
        onClose();
      } catch (err) {
        showToast(String(err?.message || err), true);
        if (btn) btn.disabled = false;
      }
    });

    shareInp?.focus();
  }

  window.OfficeMarketModals = { renderMarketDetailModal, renderMarketPublishModal };
})();
