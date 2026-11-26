/**
 * Talent Market Modals:
 * 1. Bot Resume Detail Modal (full pitch, sanitized SOUL preview, copy share link, report, like & 1-click Hire)
 * 2. 1-Click Auto-Fill & Auto-Sanitize Publish Modal (generates live share link immediately!)
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
    { id: "research", zh: "规划与文档", en: "Planning & Docs" },
    { id: "general", zh: "客服与工单", en: "Support & Triage" },
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

  function formatRedactionSummary(redactions, zh) {
    if (!redactions) return "";
    const c = redactions.counts || {};
    const parts = [];
    if (c.secrets) parts.push(zh ? `密钥/Token ×${c.secrets}` : `secrets ×${c.secrets}`);
    if (c.paths) parts.push(zh ? `本机路径 ×${c.paths}` : `paths ×${c.paths}`);
    if (c.emails) parts.push(zh ? `邮箱 ×${c.emails}` : `emails ×${c.emails}`);
    if (c.ips) parts.push(zh ? `IP ×${c.ips}` : `IPs ×${c.ips}`);
    if (c.phones) parts.push(zh ? `手机号 ×${c.phones}` : `phones ×${c.phones}`);
    if (c.ssh) parts.push(zh ? `SSH 主机 ×${c.ssh}` : `SSH ×${c.ssh}`);
    if (parts.length) {
      return zh
        ? `已自动脱敏 ${redactions.total} 处敏感信息（${parts.join("、")}），并自动跳过 MEMORY.md、memory/ 与凭据文件。`
        : `Auto-redacted ${redactions.total} sensitive items (${parts.join(", ")}); skipped MEMORY.md, memory/ & credentials.`;
    }
    return zh
      ? "未检测到敏感凭据，已自动跳过 MEMORY.md、memory/ 与聊天记录。"
      : "No secrets detected. MEMORY.md, memory/ & chat history are always excluded.";
  }

  function renderMarketDetailModal(ctx) {
    const { bot, lang, liveWritable, engPillHtml, onLike, onHire, onCustomizeOfficial, onReport, onOpenExternal, showToast, onClose } = ctx;
    const root = document.getElementById("modalRoot");
    if (!root || !bot) return;
    const zh = lang === "zh";
    const isOfficial = bot.kind === "official" || bot.trust === "official";
    const isVer = bot.trust === "verified";
    const title = zh ? (bot.nameZh || bot.name) : (bot.nameEn || bot.name);
    const pitch = zh ? (bot.purposeZh || bot.purpose) : (bot.purposeEn || bot.purpose);
    const trustCls = isOfficial ? "official" : (isVer ? "verified" : "community");
    const trustTxt = isOfficial
      ? (zh ? "🏛️ Orca 官方模板" : "🏛️ Orca Official")
      : isVer ? (zh ? "✓ 官方精选" : "✓ Verified") : (zh ? "社区分享" : "Community");
    const tagsHtml = (bot.tags || []).map((tg) => `<span class="mkt-tag">#${esc(tg)}</span>`).join("");

    const specsHtml = (bot.watches || bot.doesText || bot.reports || (bot.connectors || []).length)
      ? `<div class="mkt-tpl-specs">
           ${bot.watches ? `<div><b>${zh ? "关注：" : "Watches:"}</b>${esc(bot.watches)}</div>` : ""}
           ${bot.doesText ? `<div><b>${zh ? "负责：" : "Does:"}</b>${esc(bot.doesText)}</div>` : ""}
           ${bot.reports ? `<div><b>${zh ? "汇报：" : "Reports:"}</b>${esc(bot.reports)}</div>` : ""}
           ${(bot.connectors || []).length ? `<div><b>${zh ? "建议连接器：" : "Connectors:"}</b>${esc(bot.connectors.join(", "))}</div>` : ""}
         </div>`
      : "";

    const soulPreviewHtml = bot.soulMd
      ? `<details class="ic-collapse" style="margin-top:8px">
           <summary class="ic-collapse-sum">📄 ${zh ? "预览脱敏后的 SOUL.md" : "Preview sanitized SOUL.md"}</summary>
           <pre class="mkt-soul-pre">${esc(bot.soulMd)}</pre>
         </details>`
      : "";

    const shareLink = bot.shareUrl || bot.marketShareUrl || bot.deepLink || "";

    root.innerHTML = `
      <div class="card-backdrop" id="cardBackdrop">
        <div class="inspector-card om-card" data-modal-kind="marketDetail">
          <div class="ic-head">
            <img class="mkt-av" src="${esc(bot.avatarDataUrl)}" alt="" />
            <div class="ic-title-wrap">
              <div class="mkt-name-row">
                <span class="ic-name">${esc(title)}</span>
                <span class="mkt-trust ${trustCls}">${trustTxt}</span>
              </div>
              <div class="ic-meta" style="margin-top:4px">
                ${engPillHtml(bot.agentHint || "claude")}
                <span class="ic-pill">by ${esc(bot.authorName || "Community")}</span>
                ${isOfficial
                  ? `<span class="ic-pill">template: ${esc(bot.templateId)}</span>`
                  : `<span class="ic-pill">👥 ${zh ? `已招 ${bot.hiresCount || 0} 次` : `${bot.hiresCount || 0} hires`}</span>`}
              </div>
            </div>
            <button class="ic-close" id="icCloseBtn">×</button>
          </div>

          <div class="mkt-safety">
            <span>🛡️</span>
            <span>${isOfficial
              ? (zh
                  ? "这是 Orca 内置官方岗位模板。点击「直接弹出创建卡」将唤起 Orca 原生创建确认卡，经你同意后才创建。"
                  : "Official Orca template. Clicking Hire pops Orca's native Create Bot confirmation card.")
              : (zh
                  ? "内容已自动脱敏。点击「立即招聘入职」会先弹出 Orca 原生审核/创建确认卡，你可以审查后再确认入职。"
                  : "Auto-sanitized Bot listing. Clicking Hire pops Orca's native review/create confirmation card.")}</span>
          </div>

          <div class="om-form" style="margin-top:10px">
            <div class="ic-section-title">${zh ? "岗位职责" : "Role & Purpose"}</div>
            <div style="font-size:12.5px;line-height:1.55;color:var(--fg)">${esc(pitch)}</div>
            ${bot.description ? `<div style="font-size:11.5px;line-height:1.6;color:var(--fg-soft);white-space:pre-wrap;margin-top:6px">${esc(bot.description)}</div>` : ""}
            ${specsHtml}
            ${soulPreviewHtml}
            ${tagsHtml ? `<div class="mkt-tags" style="margin-top:8px">${tagsHtml}</div>` : ""}
            ${!isOfficial && shareLink ? `
              <div style="display:flex;align-items:center;gap:6px;margin-top:10px;flex-wrap:wrap">
                <button type="button" class="mkt-btn-ghost" id="mktCopyShareBtn">🔗 ${zh ? "复制分享链接" : "Copy Share Link"}</button>
                ${bot.marketShareUrl ? `<button type="button" class="mkt-btn-ghost" id="mktOpenPageBtn">🌐 ${zh ? "网页预览" : "Web Preview"}</button>` : ""}
                ${liveWritable ? `<button type="button" class="mkt-btn-ghost" id="mktReportBtn">🚩 ${zh ? "举报失效/垃圾" : "Report"}</button>` : ""}
              </div>` : ""}
          </div>

          <div class="ic-actions om-actions">
            <button type="button" class="ic-btn secondary" id="icDismissBtn">${zh ? "关闭" : "Close"}</button>
            ${isOfficial
              ? `<button type="button" class="mkt-btn-ghost" id="mktCustomizeTplBtn">⚙️ ${zh ? "定制参数后招入" : "Customize First"}</button>
                 <button type="button" class="mkt-btn-primary" id="mktDetailHireBtn">⚡ ${zh ? "直接弹出创建卡" : "Hire Template"}</button>`
              : `<button type="button" class="mkt-like-btn ${bot.liked ? "liked" : ""}" id="mktDetailLikeBtn">👍 <span>${bot.likesCount || 0}</span></button>
                 <button type="button" class="mkt-btn-primary" id="mktDetailHireBtn">⚡ ${zh ? "立即招聘入职" : "Hire into Orca"}</button>`}
          </div>
        </div>
      </div>`;

    document.getElementById("cardBackdrop")?.addEventListener("click", (e) => { if (e.target.id === "cardBackdrop") onClose(); });
    document.getElementById("icCloseBtn")?.addEventListener("click", onClose);
    document.getElementById("icDismissBtn")?.addEventListener("click", onClose);
    document.getElementById("mktCustomizeTplBtn")?.addEventListener("click", () => { onClose(); onCustomizeOfficial?.(bot); });
    document.getElementById("mktCopyShareBtn")?.addEventListener("click", async () => {
      try { await navigator.clipboard.writeText(shareLink); showToast(zh ? "✓ 已复制分享链接" : "✓ Copied share link", false); } catch {}
    });
    document.getElementById("mktOpenPageBtn")?.addEventListener("click", () => { if (bot.marketShareUrl) onOpenExternal?.(bot.marketShareUrl); });
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
      onClose();
    });
    document.getElementById("mktReportBtn")?.addEventListener("click", async () => { await onReport(bot); onClose(); });
  }

  function renderPublishSuccess(root, { name, shareUrl, zh, onOpenExternal, onClose, showToast }) {
    root.innerHTML = `
      <div class="card-backdrop" id="cardBackdrop">
        <div class="inspector-card om-card" data-modal-kind="marketPublish">
          <div class="ic-head">
            <div class="ic-av om-av">🎉</div>
            <div class="ic-title-wrap">
              <div class="ic-name">${zh ? "分享链接已生成并上架！" : "Share Link Created & Listed!"}</div>
              <div class="ic-meta"><span class="ic-pill">${esc(name)}</span></div>
            </div>
            <button class="ic-close" id="icCloseBtn">×</button>
          </div>
          <div class="mkt-redact-ok">
            <span>🛡️</span>
            <span>${zh ? "已自动脱敏敏感信息并上架到 Bot 人才市场，你可以把下方链接直接发给同事或社区：" : "Sanitized and published to Talent Market! Share this link directly:"}</span>
          </div>
          <div class="mkt-share-box">
            <input class="om-input" id="mktGeneratedUrl" type="text" readonly value="${esc(shareUrl)}" />
            <button type="button" class="mkt-btn-primary" id="mktCopyGenBtn">📋 ${zh ? "复制链接" : "Copy"}</button>
          </div>
          <div class="ic-actions om-actions">
            <button type="button" class="mkt-btn-ghost" id="mktOpenGenBtn">🌐 ${zh ? "浏览器预览" : "Open Page"}</button>
            <button type="button" class="ic-btn secondary" id="icDismissBtn">${zh ? "完成" : "Done"}</button>
          </div>
        </div>
      </div>`;
    document.getElementById("cardBackdrop")?.addEventListener("click", (e) => { if (e.target.id === "cardBackdrop") onClose(); });
    document.getElementById("icCloseBtn")?.addEventListener("click", onClose);
    document.getElementById("icDismissBtn")?.addEventListener("click", onClose);
    document.getElementById("mktCopyGenBtn")?.addEventListener("click", async () => {
      try { await navigator.clipboard.writeText(shareUrl); showToast(zh ? "✓ 分享链接已复制到剪贴板" : "✓ Share link copied!", false); } catch {}
    });
    document.getElementById("mktOpenGenBtn")?.addEventListener("click", () => onOpenExternal?.(shareUrl));
  }

  function renderMarketPublishModal(ctx) {
    const { localBots, lang, liveWritable, apiConfigured, onPrepareLocal, onPublish, onOpenExternal, showToast, onClose } = ctx;
    const root = document.getElementById("modalRoot");
    if (!root || root.querySelector('[data-modal-kind="marketPublish"]')) return;
    const zh = lang === "zh";
    const bots = Array.isArray(localBots) ? localBots : [];

    root.innerHTML = `
      <div class="card-backdrop" id="cardBackdrop">
        <div class="inspector-card om-card" data-modal-kind="marketPublish">
          <div class="ic-head">
            <img class="mkt-pub-av-prev" id="mktPubAvPrev" src="${esc(bots[0]?.avatarDataUrl || "")}" style="${bots[0]?.avatarDataUrl ? "" : "display:none"}" alt="" />
            <div class="ic-title-wrap">
              <div class="ic-name">${zh ? "一键分享我的 Bot" : "1-Click Share My Bot"}</div>
              <div class="ic-meta"><span class="ic-pill">${zh ? "自动识别填写 · 自动脱敏敏感数据 · 直接生成分享链接" : "Auto-fills metadata · Auto-redacts secrets · Generates share link"}</span></div>
            </div>
            <button class="ic-close" id="icCloseBtn">×</button>
          </div>

          ${!liveWritable ? `<div class="mkt-safety"><span>⚠️</span><span>${zh
            ? (apiConfigured ? "当前处于 CDN 离线镜像只读模式，请检查网络或代理后再发布。" : "尚未配置人才市场 API 地址。")
            : (apiConfigured ? "Read-only CDN mirror mode — check network/proxy to publish." : "Market API URL not configured.")}</span></div>` : ""}

          <div class="om-form" style="margin-top:8px">
            ${bots.length ? `
              <div class="om-field">
                <label class="om-lbl">${zh ? "⚡ 选择要分享的本机 Bot（自动识别并脱敏）" : "⚡ Pick a local Bot (auto-fills & sanitizes)"}</label>
                <select class="om-input" id="mktLocalPick">
                  ${bots.map((b, i) => `<option value="${esc(b.id)}" ${i === 0 ? "selected" : ""}>${esc(b.name)} (${esc(b.agentHint)})</option>`).join("")}
                  <option value="__manual__">${zh ? "— 手动空白填写 —" : "— Fill manually —"}</option>
                </select>
              </div>` : ""}

            <div class="mkt-redact-ok" id="mktRedactBanner">
              <span>🛡️</span>
              <span id="mktRedactText">${zh ? "正在自动扫描并脱敏敏感数据（MEMORY.md 与凭据文件绝不读取）…" : "Auto-scanning & redacting sensitive data (MEMORY.md & secrets excluded)…"}</span>
            </div>

            <div class="om-field">
              <label class="om-lbl">${zh ? "Bot 名称 *" : "Bot Name *"}</label>
              <input class="om-input" id="mktNameInput" type="text" maxlength="48" placeholder="${zh ? "自动生成，可微调" : "Auto-filled, editable"}" />
            </div>

            <div class="om-field">
              <label class="om-lbl">${zh ? "一句话职责亮点 *" : "One-Line Pitch *"}</label>
              <input class="om-input" id="mktPurposeInput" type="text" maxlength="160" placeholder="${zh ? "自动提取，可微调…" : "Auto-extracted from SOUL.md…"}" />
            </div>

            <div class="om-field">
              <label class="om-lbl">${zh ? "岗位分类（已自动匹配）" : "Category (auto-matched)"}</label>
              <div class="om-chips" id="mktCatChips">
                ${CATS.map((c, i) => `<button type="button" class="om-chip ${i === 0 ? "active" : ""}" data-mcat="${c.id}">${esc(c[lang])}</button>`).join("")}
              </div>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
              <div class="om-field">
                <label class="om-lbl">${zh ? "标签（自动提取）" : "Tags (auto-extracted)"}</label>
                <input class="om-input" id="mktTagsInput" type="text" placeholder="pr, ci, k8s" />
              </div>
              <div class="om-field">
                <label class="om-lbl">${zh ? "作者署名" : "Author Name"}</label>
                <input class="om-input" id="mktAuthorInput" type="text" maxlength="36" placeholder="${zh ? "你的昵称 / GitHub ID" : "Your name or @handle"}" />
              </div>
            </div>

            <details class="ic-collapse">
              <summary class="ic-collapse-sum">🛡️ ${zh ? "预览 / 微调脱敏后的 SOUL.md 与可选配置" : "Preview / edit sanitized SOUL.md & options"}</summary>
              <div class="om-adv-body">
                <div class="om-field">
                  <label class="om-lbl">${zh ? "脱敏后的 SOUL.md（公开分享内容，可再删改）" : "Sanitized SOUL.md (public, editable)"}</label>
                  <textarea class="om-textarea" id="mktSoulInput" rows="6" maxlength="12000"></textarea>
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px">
                  <div class="om-field">
                    <label class="om-lbl">${zh ? "推荐 Agent" : "Agent"}</label>
                    <select class="om-input" id="mktAgentSelect">
                      <option value="claude">Claude</option><option value="antigravity">Antigravity</option>
                      <option value="codex">Codex</option><option value="pi">Pi</option><option value="gemini">Gemini</option>
                    </select>
                  </div>
                  <div class="om-field">
                    <label class="om-lbl">${zh ? "吉祥物" : "Mascot"}</label>
                    <select class="om-input" id="mktMascotSelect">${MASCOT_IDS.map((m) => `<option value="${m}">${m}</option>`).join("")}</select>
                  </div>
                  <div class="om-field">
                    <label class="om-lbl">${zh ? "底色" : "Color"}</label>
                    <select class="om-input" id="mktColorSelect">${COLORS.map((c) => `<option value="${c}">${c}</option>`).join("")}</select>
                  </div>
                </div>
                <div class="om-field">
                  <label class="om-lbl">${zh ? "关联 Orca 官方 Share 链接（可选，留空自动生成分享链接）" : "Optional Orca Share Link (leave blank to auto-generate)"}</label>
                  <input class="om-input" id="mktShareInput" type="text" placeholder="https://app.orca.dev/bots/share/..." />
                  <div class="mkt-link-status" id="mktLinkStatus"></div>
                </div>
              </div>
            </details>
          </div>

          <div class="ic-actions om-actions">
            <button type="button" class="ic-btn secondary" id="icDismissBtn">${zh ? "取消" : "Cancel"}</button>
            <button type="button" class="mkt-btn-primary" id="mktSubmitPubBtn" ${liveWritable ? "" : "disabled"}>⚡ ${zh ? "一键生成分享链接并上架" : "Generate Share Link & Publish"}</button>
          </div>
        </div>
      </div>`;

    let selectedCat = "dev";
    let pickedAvatarType = "mascot";
    let pickedAvatarValue = "A1";
    let pickedSkills = [];

    const setCat = (catId) => {
      selectedCat = catId || "general";
      root.querySelectorAll("[data-mcat]").forEach((b) => b.classList.toggle("active", b.getAttribute("data-mcat") === selectedCat));
    };

    const applyDraft = (draft) => {
      if (!draft) return;
      const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || ""; };
      setVal("mktNameInput", draft.name);
      setVal("mktPurposeInput", draft.purpose);
      setVal("mktTagsInput", (draft.tags || []).join(", "));
      setVal("mktSoulInput", draft.soulMd);
      setCat(draft.category || "general");
      pickedSkills = draft.skills || [];
      pickedAvatarType = draft.avatarType || "mascot";
      pickedAvatarValue = draft.avatarValue || "A1";
      const agEl = document.getElementById("mktAgentSelect");
      if (agEl && [...agEl.options].some((o) => o.value === draft.agentHint)) agEl.value = draft.agentHint;
      const msEl = document.getElementById("mktMascotSelect");
      if (msEl && pickedAvatarType === "mascot" && MASCOT_IDS.includes(pickedAvatarValue)) msEl.value = pickedAvatarValue;
      const clEl = document.getElementById("mktColorSelect");
      if (clEl && COLORS.includes(draft.avatarColor)) clEl.value = draft.avatarColor;
      const prevEl = document.getElementById("mktPubAvPrev");
      if (prevEl && draft.avatarDataUrl) { prevEl.src = draft.avatarDataUrl; prevEl.style.display = "block"; }
      const redEl = document.getElementById("mktRedactText");
      if (redEl) redEl.textContent = formatRedactionSummary(draft.redactions, zh);
    };

    const loadBotDraft = async (botId) => {
      if (!botId || botId === "__manual__") {
        const redEl = document.getElementById("mktRedactText");
        if (redEl) redEl.textContent = zh ? "手动填写模式：提交时服务端仍会自动检查并脱敏敏感信息。" : "Manual mode: server still redacts sensitive data on publish.";
        return;
      }
      if (!onPrepareLocal) return;
      try {
        const draft = await onPrepareLocal(botId);
        applyDraft(draft);
      } catch (err) {
        const redEl = document.getElementById("mktRedactText");
        if (redEl) redEl.textContent = String(err?.message || err);
      }
    };

    document.getElementById("cardBackdrop")?.addEventListener("click", (e) => { if (e.target.id === "cardBackdrop") onClose(); });
    document.getElementById("icCloseBtn")?.addEventListener("click", onClose);
    document.getElementById("icDismissBtn")?.addEventListener("click", onClose);
    root.querySelectorAll("[data-mcat]").forEach((btn) => btn.addEventListener("click", () => setCat(btn.getAttribute("data-mcat"))));
    document.getElementById("mktLocalPick")?.addEventListener("change", (e) => void loadBotDraft(e.target.value));

    const shareInp = document.getElementById("mktShareInput");
    const statusEl = document.getElementById("mktLinkStatus");
    shareInp?.addEventListener("input", () => {
      const val = shareInp.value.trim();
      if (!val) { statusEl.textContent = ""; statusEl.className = "mkt-link-status"; return; }
      const sid = parseShareId(val);
      statusEl.textContent = sid
        ? (zh ? `✓ 识别到 Orca 分享 ID：${sid}` : `✓ Valid Orca share ID: ${sid}`)
        : (zh ? "✕ 格式无效（留空可自动生成分享链接）" : "✕ Invalid format (leave empty to auto-generate)");
      statusEl.className = `mkt-link-status ${sid ? "ok" : "bad"}`;
    });

    document.getElementById("mktSubmitPubBtn")?.addEventListener("click", async () => {
      const shareUrl = String(shareInp?.value || "").trim();
      if (shareUrl && !parseShareId(shareUrl)) {
        showToast(zh ? "可选 Orca 分享链接格式无效，请修正或留空" : "Invalid optional Orca link — fix or leave blank", true);
        return;
      }
      const name = String(document.getElementById("mktNameInput")?.value || "").trim();
      const purpose = String(document.getElementById("mktPurposeInput")?.value || "").trim();
      if (name.length < 2) { showToast(zh ? "请填写 Bot 名称（至少 2 个字）" : "Enter a Bot name (min 2 chars)", true); return; }
      if (purpose.length < 4) { showToast(zh ? "请填写一句话职责亮点" : "Enter a one-line pitch", true); return; }

      const btn = document.getElementById("mktSubmitPubBtn");
      if (btn) { btn.disabled = true; btn.textContent = zh ? "⏳ 正在脱敏并生成链接…" : "⏳ Generating share link…"; }
      try {
        const res = await onPublish({
          shareUrl,
          name,
          purpose,
          soulMd: String(document.getElementById("mktSoulInput")?.value || "").trim(),
          skills: pickedSkills,
          category: selectedCat,
          tags: String(document.getElementById("mktTagsInput")?.value || "").trim(),
          agentHint: String(document.getElementById("mktAgentSelect")?.value || "claude"),
          avatarType: pickedAvatarType,
          avatarValue: pickedAvatarType === "mascot" ? String(document.getElementById("mktMascotSelect")?.value || "A1") : pickedAvatarValue,
          avatarColor: String(document.getElementById("mktColorSelect")?.value || "#b3dbf4"),
          authorName: String(document.getElementById("mktAuthorInput")?.value || "").trim() || "Community",
        });
        const generatedUrl = res?.shareUrl || res?.marketShareUrl || res?.bot?.shareUrl || "";
        if (generatedUrl) {
          renderPublishSuccess(root, { name, shareUrl: generatedUrl, zh, onOpenExternal, onClose, showToast });
        } else {
          showToast(zh ? `✓「${name}」已上架到人才市场！` : `✓ "${name}" published!`, false);
          onClose();
        }
      } catch (err) {
        showToast(String(err?.message || err), true);
        if (btn) { btn.disabled = false; btn.textContent = zh ? "⚡ 一键生成分享链接并上架" : "⚡ Generate Share Link & Publish"; }
      }
    });

    if (bots.length) {
      void loadBotDraft(bots[0].id);
    } else {
      const redEl = document.getElementById("mktRedactText");
      if (redEl) redEl.textContent = zh ? "填写信息后点击下方按钮，自动脱敏并直接生成公开分享链接。" : "Fill in details and click below to auto-sanitize and generate a share link.";
    }
  }

  window.OfficeMarketModals = { renderMarketDetailModal, renderMarketPublishModal };
})();
