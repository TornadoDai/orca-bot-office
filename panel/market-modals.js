/**
 * Talent Market Modals:
 * 1. Bot Resume Detail Modal (full pitch, sanitized SOUL + optional skills/automations/tools/memory/settings preview)
 * 2. 1-Click Auto-Fill, Selectable Parts & Auto-Sanitize Publish Modal
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
    const blocked = (redactions.blockedMemoryFiles || []).length;
    const blockNote = blocked ? (zh ? `，已硬拦截 ${blocked} 个凭据文件` : `, blocked ${blocked} credential file(s)`) : "";
    if (parts.length) {
      return zh
        ? `已自动脱敏 ${redactions.total} 处敏感信息（${parts.join("、")}）${blockNote}；记忆默认不勾选。`
        : `Auto-redacted ${redactions.total} sensitive items (${parts.join(", ")})${blockNote}; memory is off by default.`;
    }
    return zh
      ? `未检测到敏感凭据${blockNote}；记忆默认不勾选，所有勾选内容均自动脱敏。`
      : `No secrets detected${blockNote}; memory is off by default and all checked items are auto-sanitized.`;
  }

  function renderBundlePreviewHtml(bot, zh) {
    const b = bot.bundle || {};
    const blocks = [];
    if (bot.soulMd) {
      blocks.push(`<details class="ic-collapse"><summary class="ic-collapse-sum">📄 ${zh ? "SOUL.md（已脱敏）" : "SOUL.md (sanitized)"}</summary><pre class="mkt-soul-pre">${esc(bot.soulMd)}</pre></details>`);
    }
    if ((b.automations || []).length) {
      blocks.push(`<details class="ic-collapse"><summary class="ic-collapse-sum">⏰ ${zh ? `定时任务 / 自动化 (${b.automations.length})` : `Automations (${b.automations.length})`}</summary><div class="mkt-tpl-specs">${b.automations.map((a) => `<div><b>${esc(a.name)}</b> ${a.rrule ? `<code>${esc(a.rrule)}</code>` : ""}<div style="margin-top:2px;color:var(--muted)">${esc(a.prompt)}</div></div>`).join("")}</div></details>`);
    }
    if ((b.skills || []).length) {
      blocks.push(`<details class="ic-collapse"><summary class="ic-collapse-sum">🧩 ${zh ? `技能 Skills (${b.skills.length})` : `Skills (${b.skills.length})`}</summary>${b.skills.map((s) => `<pre class="mkt-soul-pre"><b>${esc(s.name)}</b>\n${esc(s.content || "")}</pre>`).join("")}</details>`);
    }
    if ((b.tools || []).length) {
      blocks.push(`<details class="ic-collapse"><summary class="ic-collapse-sum">🔧 ${zh ? `工具 / MCP (${b.tools.length})` : `Tools / MCP (${b.tools.length})`}</summary><div class="mkt-tpl-specs">${b.tools.map((t) => `<div><b>${esc(t.name)}</b> [${esc(t.scope || "own")}] ${t.url ? esc(t.url) : ""}</div>`).join("")}</div></details>`);
    }
    if ((b.memory || []).length) {
      blocks.push(`<details class="ic-collapse"><summary class="ic-collapse-sum">🧠 ${zh ? `精选脱敏记忆 (${b.memory.length})` : `Sanitized Memory (${b.memory.length})`}</summary>${b.memory.map((m) => `<pre class="mkt-soul-pre"><b>${esc(m.topic)}</b>\n${esc(m.content)}</pre>`).join("")}</details>`);
    }
    if (b.settings && ((b.settings.connectors || []).length || b.settings.setupNote)) {
      blocks.push(`<div class="mkt-tpl-specs">${(b.settings.connectors || []).length ? `<div><b>${zh ? "建议连接器：" : "Connectors:"}</b>${esc(b.settings.connectors.join(", "))}</div>` : ""}${b.settings.setupNote ? `<div><b>${zh ? "配置说明：" : "Setup Note:"}</b>${esc(b.settings.setupNote)}</div>` : ""}</div>`);
    }
    return blocks.length ? `<div style="display:flex;flex-direction:column;gap:6px;margin-top:8px">${blocks.join("")}</div>` : "";
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
              ? (zh ? "这是 Orca 内置官方岗位模板。点击「直接弹出创建卡」将唤起 Orca 原生创建确认卡。" : "Official Orca template. Clicking Hire pops Orca's native Create Bot card.")
              : (zh ? "所有内容均已自动脱敏，可先展开下方各模块审查后再点击「立即招聘入职」。" : "Auto-sanitized bundle. Audit included parts below before hiring.")}</span>
          </div>

          <div class="om-form" style="margin-top:10px">
            <div class="ic-section-title">${zh ? "岗位职责" : "Role & Purpose"}</div>
            <div style="font-size:12.5px;line-height:1.55;color:var(--fg)">${esc(pitch)}</div>
            ${bot.description ? `<div style="font-size:11.5px;line-height:1.6;color:var(--fg-soft);white-space:pre-wrap;margin-top:6px">${esc(bot.description)}</div>` : ""}
            ${specsHtml}
            ${renderBundlePreviewHtml(bot, zh)}
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
    document.getElementById("mktDetailHireBtn")?.addEventListener("click", async () => { await onHire(bot); onClose(); });
    document.getElementById("mktReportBtn")?.addEventListener("click", async () => { await onReport(bot); onClose(); });
  }

  function renderBundleChecklist(container, parts, zh) {
    if (!container) return;
    const p = parts || {};
    const skills = p.skills || [];
    const autos = p.automations || [];
    const tools = p.tools || [];
    const mems = p.memory || [];
    const blocked = p.blockedMemoryFiles || [];
    const sets = p.settings || {};

    const groups = [];
    groups.push(`
      <div class="mkt-bundle-grp">
        <div class="mkt-bundle-hdr"><span>⏰ ${zh ? "定时任务 & 自动化" : "Schedules & Automations"}</span><small>${autos.length ? (zh ? `共 ${autos.length} 条 · 默认全选` : `${autos.length} found`) : (zh ? "该 Bot 暂无" : "None")}</small></div>
        ${autos.length ? `<div class="mkt-chk-list">${autos.map((a, i) => `
          <label class="mkt-chk-row">
            <input type="checkbox" data-b-auto="${i}" ${a.defaultChecked ? "checked" : ""} />
            <span class="mkt-chk-main">${esc(a.name)}</span>
            <span class="mkt-chk-meta">${esc(a.rrule || (zh ? "事件触发" : "event"))}</span>
          </label>`).join("")}</div>` : ""}
      </div>`);

    groups.push(`
      <div class="mkt-bundle-grp">
        <div class="mkt-bundle-hdr"><span>🧩 ${zh ? "技能 (Skills)" : "Skills"}</span><small>${skills.length ? (zh ? `共 ${skills.length} 个 · 默认全选` : `${skills.length} found`) : (zh ? "该 Bot 暂无" : "None")}</small></div>
        ${skills.length ? `<div class="mkt-chk-list">${skills.map((s, i) => `
          <label class="mkt-chk-row">
            <input type="checkbox" data-b-skill="${i}" ${s.defaultChecked ? "checked" : ""} />
            <span class="mkt-chk-main">${esc(s.name)}</span>
            <span class="mkt-chk-meta">${s.chars} ${zh ? "字" : "ch"}</span>
          </label>`).join("")}</div>` : ""}
      </div>`);

    groups.push(`
      <div class="mkt-bundle-grp">
        <div class="mkt-bundle-hdr"><span>🔧 ${zh ? "工具 / MCP" : "Tools / MCP"}</span><small>${tools.length ? (zh ? `共 ${tools.length} 个（仅保留名称与地址，剥离密钥）` : `${tools.length} found (secrets stripped)`) : (zh ? "该 Bot 暂无" : "None")}</small></div>
        ${tools.length ? `<div class="mkt-chk-list">${tools.map((t, i) => `
          <label class="mkt-chk-row">
            <input type="checkbox" data-b-tool="${i}" ${t.defaultChecked ? "checked" : ""} />
            <span class="mkt-chk-main">${esc(t.name)}</span>
            <span class="mkt-chk-meta">${t.scope === "inherited" ? (zh ? "继承 MCP" : "inherited") : (zh ? "自有工具" : "own")}</span>
          </label>`).join("")}</div>` : ""}
      </div>`);

    groups.push(`
      <div class="mkt-bundle-grp">
        <div class="mkt-bundle-hdr"><span>🧠 ${zh ? "记忆文件（默认不选，按需勾选）" : "Memory Files (Off by default)"}</span><small>${mems.length ? (zh ? `可选 ${mems.length} 份 · 勾选后自动脱敏` : `${mems.length} selectable`) : (zh ? "无非空记忆" : "None")}</small></div>
        ${blocked.map((f) => `<div class="mkt-blocked-row">🔒 ${zh ? `已自动拦截敏感凭据文件：${esc(f)}（禁止分享）` : `Blocked credential file: ${esc(f)}`}</div>`).join("")}
        ${mems.length ? `<div class="mkt-chk-list">${mems.map((m, i) => `
          <label class="mkt-chk-row">
            <input type="checkbox" data-b-mem="${i}" />
            <span class="mkt-chk-main">${esc(m.topic)}</span>
            <span class="mkt-chk-meta">${m.chars}${zh ? "字" : "ch"}${m.redactionsCount ? ` · 🛡️-${m.redactionsCount}` : ""}</span>
          </label>`).join("")}</div>` : ""}
      </div>`);

    const connText = (sets.connectors || []).length ? sets.connectors.join(", ") : (zh ? "无额外连接器" : "none");
    groups.push(`
      <div class="mkt-bundle-grp">
        <div class="mkt-bundle-hdr"><span>⚙️ ${zh ? "设置与连接器提示" : "Settings & Connectors"}</span></div>
        <label class="mkt-chk-row">
          <input type="checkbox" id="mktIncludeSettings" checked />
          <span class="mkt-chk-main">${zh ? `包含推荐 Agent (${esc(sets.agent || "claude")}) 与连接器提示 (${esc(connText)})` : `Include Agent (${esc(sets.agent || "claude")}) & connectors (${esc(connText)})`}</span>
        </label>
        <input class="om-input" id="mktSetupNoteInput" type="text" maxlength="1500" placeholder="${zh ? "可选：给招聘者的配置说明（如：需先配置 GitHub / Slack 连接器）" : "Optional setup note for anyone hiring this Bot…"}" />
      </div>`);

    container.innerHTML = groups.join("");
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
            <span>${zh ? "所选模块已全部自动脱敏并上架到 Bot 人才市场，你可以把下方链接直接发给同事或社区：" : "Selected parts sanitized & published! Share this link directly:"}</span>
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
    const { localBots, lang, liveWritable, apiConfigured, onPrepareLocal, onRandomAvatar, onPublish, onOpenExternal, showToast, onClose } = ctx;
    const root = document.getElementById("modalRoot");
    if (!root || root.querySelector('[data-modal-kind="marketPublish"]')) return;
    const zh = lang === "zh";
    const bots = Array.isArray(localBots) ? localBots : [];

    root.innerHTML = `
      <div class="card-backdrop" id="cardBackdrop">
        <div class="inspector-card om-card" data-modal-kind="marketPublish">
          <div class="ic-head">
            <div style="display:flex;flex-direction:column;align-items:center;gap:4px;flex-shrink:0">
              <img class="mkt-pub-av-prev" id="mktPubAvPrev" src="${esc(bots[0]?.avatarDataUrl || "")}" style="${bots[0]?.avatarDataUrl ? "" : "display:none"}" alt="" />
              <button type="button" class="mkt-btn-ghost" id="mktShuffleAvBtn" style="padding:1px 6px;font-size:10px" title="${zh ? "随机换一个官方吉祥物头像" : "Shuffle random mascot"}">🎲 ${zh ? "换头像" : "Shuffle"}</button>
            </div>
            <div class="ic-title-wrap">
              <div class="ic-name">${zh ? "一键分享我的 Bot" : "1-Click Share My Bot"}</div>
              <div class="ic-meta"><span class="ic-pill">${zh ? "自动识别 · 可勾选技能/定时任务/工具/记忆/设置 · 自动脱敏出链" : "Auto-fill · Pick skills/schedules/tools/memory/settings · Auto-sanitized link"}</span></div>
            </div>
            <button class="ic-close" id="icCloseBtn">×</button>
          </div>

          ${!liveWritable ? `<div class="mkt-safety"><span>⚠️</span><span>${zh
            ? (apiConfigured ? "当前处于 CDN 离线镜像只读模式，请检查网络或代理后再发布。" : "尚未配置人才市场 API 地址。")
            : (apiConfigured ? "Read-only CDN mirror mode — check network/proxy to publish." : "Market API URL not configured.")}</span></div>` : ""}

          <div class="om-form" style="margin-top:8px">
            ${bots.length ? `
              <div class="om-field">
                <label class="om-lbl">${zh ? "⚡ 选择要分享的本机 Bot（自动识别全部模块并脱敏）" : "⚡ Pick a local Bot (auto-detects & sanitizes all parts)"}</label>
                <select class="om-input" id="mktLocalPick">
                  ${bots.map((b, i) => `<option value="${esc(b.id)}" ${i === 0 ? "selected" : ""}>${esc(b.name)} (${esc(b.agentHint)})</option>`).join("")}
                  <option value="__manual__">${zh ? "— 手动空白填写 —" : "— Fill manually —"}</option>
                </select>
              </div>` : ""}

            <div class="mkt-redact-ok" id="mktRedactBanner">
              <span>🛡️</span>
              <span id="mktRedactText">${zh ? "正在扫描 SOUL、技能、定时任务、MCP 工具与记忆…" : "Scanning SOUL, skills, automations, tools & memory…"}</span>
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
              <label class="om-lbl">${zh ? "勾选要一起打包分享的模块（均自动脱敏）" : "Select parts to include in share package (all auto-sanitized)"}</label>
              <div class="mkt-bundle-box" id="mktBundleBox"></div>
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
              <summary class="ic-collapse-sum">🛡️ ${zh ? "预览 / 微调脱敏后的 SOUL.md、外观与可选 Orca 链接" : "Preview / edit sanitized SOUL.md, look & optional Orca link"}</summary>
              <div class="om-adv-body">
                <div class="om-field">
                  <label class="om-lbl">${zh ? "脱敏后的 SOUL.md（可再删改）" : "Sanitized SOUL.md (editable)"}</label>
                  <textarea class="om-textarea" id="mktSoulInput" rows="5" maxlength="12000"></textarea>
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
    let activeDraft = null;

    const setCat = (catId) => {
      selectedCat = catId || "general";
      root.querySelectorAll("[data-mcat]").forEach((b) => b.classList.toggle("active", b.getAttribute("data-mcat") === selectedCat));
    };

    const applyDraft = (draft) => {
      if (!draft) return;
      activeDraft = draft;
      const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || ""; };
      setVal("mktNameInput", draft.name);
      setVal("mktPurposeInput", draft.purpose);
      setVal("mktTagsInput", (draft.tags || []).join(", "));
      setVal("mktSoulInput", draft.soulMd);
      setCat(draft.category || "general");
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
      if (redEl) {
        const avNote = draft.randomizedAvatar
          ? (zh ? "自定义头像已自动替换为随机官方吉祥物。" : "Custom avatar replaced with a random Orca mascot. ")
          : "";
        redEl.textContent = `${avNote}${formatRedactionSummary(draft.redactions, zh)}`;
      }
      renderBundleChecklist(document.getElementById("mktBundleBox"), draft.parts, zh);
    };

    const loadBotDraft = async (botId) => {
      if (!botId || botId === "__manual__") {
        activeDraft = null;
        renderBundleChecklist(document.getElementById("mktBundleBox"), {}, zh);
        const redEl = document.getElementById("mktRedactText");
        if (redEl) redEl.textContent = zh ? "手动填写模式：提交时服务端仍会自动检查并脱敏敏感信息。" : "Manual mode: server still redacts sensitive data on publish.";
        return;
      }
      if (!onPrepareLocal) return;
      try {
        applyDraft(await onPrepareLocal(botId));
      } catch (err) {
        const redEl = document.getElementById("mktRedactText");
        if (redEl) redEl.textContent = String(err?.message || err);
      }
    };

    const collectSelectedBundle = () => {
      const p = activeDraft?.parts || {};
      const pick = (attr, list) =>
        [...root.querySelectorAll(`[${attr}]:checked`)]
          .map((el) => list[Number(el.getAttribute(attr))])
          .filter(Boolean);
      const skills = pick("data-b-skill", p.skills || []).map(({ name, content }) => ({ name, content }));
      const automations = pick("data-b-auto", p.automations || []).map(({ name, rrule, prompt, resultsTo }) => ({ name, rrule, prompt, resultsTo }));
      const tools = pick("data-b-tool", p.tools || []).map(({ name, scope, url, headerNames }) => ({ name, scope, url, headerNames }));
      const memory = pick("data-b-mem", p.memory || []).map(({ topic, content }) => ({ topic, content }));
      const incSettings = document.getElementById("mktIncludeSettings")?.checked !== false;
      const setupNote = String(document.getElementById("mktSetupNoteInput")?.value || "").trim();
      const settings = incSettings
        ? {
            agent: String(document.getElementById("mktAgentSelect")?.value || "claude"),
            outfit: p.settings?.outfit || "",
            connectors: p.settings?.connectors || [],
            setupNote,
          }
        : { agent: "", outfit: "", connectors: [], setupNote };
      return { skills, automations, tools, memory, settings };
    };

    document.getElementById("cardBackdrop")?.addEventListener("click", (e) => { if (e.target.id === "cardBackdrop") onClose(); });
    document.getElementById("icCloseBtn")?.addEventListener("click", onClose);
    document.getElementById("icDismissBtn")?.addEventListener("click", onClose);
    root.querySelectorAll("[data-mcat]").forEach((btn) => btn.addEventListener("click", () => setCat(btn.getAttribute("data-mcat"))));
    document.getElementById("mktLocalPick")?.addEventListener("change", (e) => void loadBotDraft(e.target.value));
    document.getElementById("mktShuffleAvBtn")?.addEventListener("click", async () => {
      if (!onRandomAvatar) return;
      try {
        const av = await onRandomAvatar();
        if (!av) return;
        pickedAvatarType = av.avatarType || "mascot";
        pickedAvatarValue = av.avatarValue || "A1";
        const msEl = document.getElementById("mktMascotSelect");
        const clEl = document.getElementById("mktColorSelect");
        const prevEl = document.getElementById("mktPubAvPrev");
        if (msEl && MASCOT_IDS.includes(pickedAvatarValue)) msEl.value = pickedAvatarValue;
        if (clEl && COLORS.includes(av.avatarColor)) clEl.value = av.avatarColor;
        if (prevEl && av.avatarDataUrl) { prevEl.src = av.avatarDataUrl; prevEl.style.display = "block"; }
      } catch {}
    });

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

      const bundle = collectSelectedBundle();
      const btn = document.getElementById("mktSubmitPubBtn");
      if (btn) { btn.disabled = true; btn.textContent = zh ? "⏳ 正在脱敏打包并生成链接…" : "⏳ Sanitizing & generating link…"; }
      try {
        const res = await onPublish({
          shareUrl,
          name,
          purpose,
          soulMd: String(document.getElementById("mktSoulInput")?.value || "").trim(),
          skills: bundle.skills.map((s) => s.name),
          bundle,
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

    if (bots.length) void loadBotDraft(bots[0].id);
    else renderBundleChecklist(document.getElementById("mktBundleBox"), {}, zh);
  }

  window.OfficeMarketModals = { renderMarketDetailModal, renderMarketPublishModal };
})();
