/**
 * Bot Office Talent Market ("Plugin-within-a-Plugin" Flagship Store View + Lobby Showcase Banner)
 */
(function () {
  const CATS = [
    { id: "all", zh: "全部岗位", en: "All Roles" },
    { id: "mine", zh: "👤 我发布的", en: "👤 Published by Me" },
    { id: "community", zh: "🌐 社区分享", en: "🌐 Community" },
    { id: "official", zh: "🏛️ Orca 官方模板", en: "🏛️ Orca Official" },
    { id: "dev", zh: "研发与审查", en: "Dev & Review" },
    { id: "ops", zh: "运维与排障", en: "Ops & Debug" },
    { id: "release", zh: "发布与自动化", en: "Release & Auto" },
    { id: "productivity", zh: "效率与日常", en: "Productivity" },
    { id: "research", zh: "规划与文档", en: "Planning & Docs" },
    { id: "general", zh: "客服与工单", en: "Support & Triage" },
  ];

  const ui = {
    q: "",
    category: "all",
    sort: "hot",
    lobbyCollapsed: (() => {
      try { return localStorage.getItem("botOffice.mktLobbyCollapsed") === "1"; } catch { return false; }
    })(),
  };

  function esc(s) {
    return String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function botTitle(b, lang) { return lang === "zh" ? (b.nameZh || b.name) : (b.nameEn || b.name); }
  function botPitch(b, lang) { return lang === "zh" ? (b.purposeZh || b.purpose) : (b.purposeEn || b.purpose); }

  function filterAndSort(bots, lang = "zh") {
    let list = Array.isArray(bots) ? [...bots] : [];
    if (ui.category !== "all") {
      if (ui.category === "mine") list = list.filter((b) => Boolean(b.isMine));
      else if (ui.category === "official") list = list.filter((b) => b.kind === "official" || b.trust === "official");
      else if (ui.category === "community") list = list.filter((b) => b.kind !== "official" && b.trust !== "official");
      else list = list.filter((b) => b.category === ui.category);
    }
    const q = ui.q.trim().toLowerCase();
    if (q) {
      list = list.filter((b) =>
        `${b.name} ${b.nameZh || ""} ${b.nameEn || ""} ${b.purpose} ${b.purposeZh || ""} ${b.purposeEn || ""} ${b.description || ""} ${b.authorName || ""} ${b.agentHint || ""} ${(b.tags || []).join(" ")}`
          .toLowerCase()
          .includes(q)
      );
    }
    list.sort((a, b) => {
      const aComm = a.kind !== "official" && a.trust !== "official";
      const bComm = b.kind !== "official" && b.trust !== "official";
      if (ui.sort === "newest") {
        if (aComm !== bComm) return aComm ? -1 : 1;
        return (b.createdAt || 0) - (a.createdAt || 0);
      }
      if (ui.sort === "likes") {
        if (aComm !== bComm) return aComm ? -1 : 1;
        return ((b.likesCount || 0) - (a.likesCount || 0)) || ((b.hiresCount || 0) - (a.hiresCount || 0));
      }
      const sa = (aComm ? 20 : 0) + (a.featured ? 12 : 0) + (a.trust === "verified" ? 6 : 0) + (a.hiresCount || 0) * 2 + (a.likesCount || 0) * 3;
      const sb = (bComm ? 20 : 0) + (b.featured ? 12 : 0) + (b.trust === "verified" ? 6 : 0) + (b.hiresCount || 0) * 2 + (b.likesCount || 0) * 3;
      return (sb - sa) || ((b.createdAt || 0) - (a.createdAt || 0));
    });
    return list;
  }

  function renderLobbyBanner(container, ctx) {
    if (!container) return;
    const { marketData, lang, onOpenMarket, onOpenPublish, onSelectBot } = ctx;
    const zh = lang === "zh";
    const bots = marketData?.bots || [];
    const stats = marketData?.stats || { totalBots: bots.length, totalHires: 0 };
    const top3 = filterAndSort(bots).slice(0, 3);

    if (ui.lobbyCollapsed) {
      container.innerHTML = `
        <div class="mkt-lobby collapsed">
          <div class="mkt-lobby-brand">
            <span class="mkt-lobby-badge">🏪 ${zh ? "Bot 人才市场" : "Talent Market"}</span>
            <span class="mkt-lobby-sub">${bots.length
              ? (zh ? `${stats.totalBots} 位在招 · 累计招聘 ${stats.totalHires} 次` : `${stats.totalBots} Bots listed · ${stats.totalHires} hires`)
              : (zh ? "分享你的 Orca Bot，或一键招聘社区现成专家" : "Share your Orca Bots or 1-click hire community specialists")}</span>
          </div>
          <div class="mkt-lobby-acts">
            <button type="button" class="mkt-lobby-go" id="mktLobbyGoBtn">${zh ? "逛市场 →" : "Explore →"}</button>
            <button type="button" class="mkt-lobby-toggle" id="mktLobbyToggleBtn" title="${zh ? "展开" : "Expand"}">▾</button>
          </div>
        </div>`;
    } else {
      const previewHtml = top3.length
        ? `<div class="mkt-lobby-preview">${top3.map((b) => `
            <button type="button" class="mkt-mini-card" data-lobby-bot="${esc(b.id)}">
              <img class="mkt-mini-av" src="${esc(b.avatarDataUrl)}" alt="" />
              <div class="mkt-mini-info">
                <div class="mkt-mini-name">${b.trust === "official" ? "🏛️ " : (b.trust === "verified" ? "✓ " : "")}${esc(botTitle(b, lang))}</div>
                <div class="mkt-mini-pitch">${esc(botPitch(b, lang))}</div>
              </div>
              <span style="font-size:10px;color:#6ee7b7;font-weight:800;flex-shrink:0">⚡</span>
            </button>`).join("")}</div>`
        : "";

      container.innerHTML = `
        <div class="mkt-lobby">
          <div class="mkt-lobby-top">
            <div class="mkt-lobby-brand">
              <span class="mkt-lobby-badge">🏪 ${zh ? "Bot 人才市场" : "Talent Market"}</span>
              <span class="mkt-lobby-sub">${bots.length
                ? (zh ? `在招 ${stats.totalBots} 位专家 · 累计入职 ${stats.totalHires} 次 · 原生安全审核` : `${stats.totalBots} ready to hire · ${stats.totalHires} hires · native Orca review`)
                : (zh ? "把你的好 Bot 分享出去，或一键招入社区现成专家直接进大楼上班" : "Share your best Bots or 1-click hire ready-made Orca specialists")}</span>
            </div>
            <div class="mkt-lobby-acts">
              <button type="button" class="mkt-lobby-pub" id="mktLobbyPubBtn">+ ${zh ? "分享我的 Bot" : "Publish Bot"}</button>
              <button type="button" class="mkt-lobby-go" id="mktLobbyGoBtn">${zh ? "逛全部人才市场 →" : "Open Talent Market →"}</button>
              <button type="button" class="mkt-lobby-toggle" id="mktLobbyToggleBtn" title="${zh ? "收起" : "Collapse"}">▴</button>
            </div>
          </div>
          ${previewHtml}
        </div>`;
    }

    container.querySelector("#mktLobbyGoBtn")?.addEventListener("click", onOpenMarket);
    container.querySelector("#mktLobbyPubBtn")?.addEventListener("click", onOpenPublish);
    container.querySelector("#mktLobbyToggleBtn")?.addEventListener("click", () => {
      ui.lobbyCollapsed = !ui.lobbyCollapsed;
      try { localStorage.setItem("botOffice.mktLobbyCollapsed", ui.lobbyCollapsed ? "1" : "0"); } catch {}
      renderLobbyBanner(container, ctx);
    });
    container.querySelectorAll("[data-lobby-bot]").forEach((el) => {
      el.addEventListener("click", () => {
        const b = bots.find((x) => x.id === el.getAttribute("data-lobby-bot"));
        if (b) onSelectBot(b);
      });
    });
  }

  function renderMarketView(container, ctx) {
    if (!container) return;
    const {
      marketData,
      loading,
      lang,
      engPillHtml,
      onBackOffice,
      onRefresh,
      onOpenPublish,
      onOpenLocalHire,
      onSelectBot,
      onLike,
      onHire,
      onDelete,
    } = ctx;
    const zh = lang === "zh";
    const bots = marketData?.bots || [];
    const myCount = bots.filter((b) => b.isMine).length;
    const liveWritable = Boolean(marketData?.liveWritable);
    const stats = marketData?.stats || { totalBots: bots.length, verifiedBots: 0, totalHires: 0, totalLikes: 0 };
    const filtered = filterAndSort(bots);
    const srcMode = marketData?.sourceMode || "offline";
    const srcLabel =
      srcMode === "live"
        ? (zh ? "● 实时市场在线" : "● Live Market")
        : srcMode === "mirror"
          ? (zh ? "◐ CDN 镜像（只读）" : "◐ CDN Mirror (Read-only)")
          : (zh ? "⚙ 待连接市场源" : "⚙ Market Offline");

    const gridHtml = loading && !marketData
      ? `<div class="mkt-empty"><div class="mkt-empty-icon">⏳</div><div class="mkt-empty-title">${zh ? "正在加载 Bot 人才市场…" : "Loading Talent Market…"}</div></div>`
      : filtered.length
        ? `<div class="mkt-grid">${filtered.map((b) => {
            const isOfficial = b.kind === "official" || b.trust === "official";
            const isVer = b.trust === "verified";
            const trustCls = isOfficial ? "official" : (isVer ? "verified" : "community");
            const trustLbl = isOfficial
              ? (zh ? "🏛️ 官方模板" : "🏛️ Official")
              : isVer ? (zh ? "✓ 官方精选" : "✓ Verified") : (zh ? "社区分享" : "Community");
            const tags = (b.tags || []).slice(0, 4).map((t) => `<span class="mkt-tag">#${esc(t)}</span>`).join("");
            const bd = b.bundle || {};
            const bpills = [
              (bd.automations || []).length ? `⏰ ${bd.automations.length}${zh ? "定时" : " auto"}` : "",
              (bd.skills || []).length ? `🧩 ${bd.skills.length}${zh ? "技能" : " skill"}` : "",
              (bd.tools || []).length ? `🔧 ${bd.tools.length}${zh ? "工具" : " tool"}` : "",
              (bd.memory || []).length ? `🧠 ${bd.memory.length}${zh ? "记忆" : " mem"}` : "",
            ].filter(Boolean).map((x) => `<span class="mkt-bpill">${x}</span>`).join("");
            return `
              <div class="mkt-card ${isVer ? "is-verified" : ""}" data-mkt-card="${esc(b.id)}">
                <div class="mkt-card-head">
                  <img class="mkt-av" src="${esc(b.avatarDataUrl)}" alt="" />
                  <div class="mkt-head-info">
                    <div class="mkt-name-row">
                      <span class="mkt-name">${esc(botTitle(b, lang))}</span>
                      <span class="mkt-trust ${trustCls}">${trustLbl}</span>
                      ${b.isMine ? `<span class="mkt-mine-pill">${zh ? "我发布" : "Mine"}</span>` : ""}
                    </div>
                    <div class="mkt-meta-row">
                      ${engPillHtml(b.agentHint || "claude")}
                      <span>by ${esc(b.authorName || "Community")}</span>
                    </div>
                  </div>
                </div>
                <div class="mkt-pitch">${esc(botPitch(b, lang))}</div>
                ${bpills ? `<div class="mkt-bundle-pills">${bpills}</div>` : ""}
                ${tags ? `<div class="mkt-tags">${tags}</div>` : ""}
                <div class="mkt-card-foot">
                  <div class="mkt-metrics">
                    ${isOfficial
                      ? `<span class="mkt-hire-cnt">🏛️ ${zh ? "Orca 原生内置" : "Built-in template"}</span>`
                      : `<button type="button" class="mkt-like-btn ${b.liked ? "liked" : ""}" data-mkt-like="${esc(b.id)}">👍 <span>${b.likesCount || 0}</span></button>
                         <span class="mkt-hire-cnt">👥 ${zh ? `已招 ${b.hiresCount || 0}` : `${b.hiresCount || 0} hires`}</span>`}
                  </div>
                  <div style="display:flex;align-items:center;gap:5px">
                    ${b.isMine && liveWritable && !isOfficial ? `<button type="button" class="mkt-del-btn" data-mkt-del="${esc(b.id)}" title="${zh ? "删除我分享的此 Bot" : "Delete my shared Bot"}">🗑️</button>` : ""}
                    <button type="button" class="mkt-hire-btn" data-mkt-hire="${esc(b.id)}">⚡ ${zh ? "一键招聘" : "Hire"}</button>
                  </div>
                </div>
              </div>`;
          }).join("")}</div>`
        : `<div class="mkt-empty">
            <div class="mkt-empty-icon">${bots.length ? "🔍" : "🏪"}</div>
            <div class="mkt-empty-title">${bots.length
              ? (zh ? "没有匹配的 Bot 简历" : "No matching Bots found")
              : (zh ? "成为 Bot 人才市场首批发布者" : "Be the First to List a Bot")}</div>
            <div class="mkt-empty-desc">${bots.length
              ? (zh ? "试试换个关键词或切换分类标签。" : "Try clearing your search or switching categories.")
              : (zh ? "在这里，每个人都可以把调教好的 Orca Bot 分享出来；别人点一下「一键招聘」即可通过 Orca 原生安全审核直接入职大楼。" : "Share your best Orca Bots with the community; anyone can 1-click hire them straight into Orca with native safety review.")}</div>
            ${!bots.length ? `
              <div class="mkt-steps">
                <div class="mkt-step"><b>1. ${zh ? "复制分享链接" : "Share in Orca"}</b>${zh ? "在 Orca 里打开你的 Bot，点 Share Bot 复制分享链接。" : "Open your Bot in Orca and click Share Bot to copy its link."}</div>
                <div class="mkt-step"><b>2. ${zh ? "10 秒极速上架" : "10-Second Publish"}</b>${zh ? "点下方「分享我的 Bot」，自动识别名称、吉祥物与简介。" : "Click Publish below — name, mascot & bio auto-fill locally."}</div>
                <div class="mkt-step"><b>3. ${zh ? "一键招聘入职" : "1-Click Native Hire"}</b>${zh ? "他人点击招聘即唤起 Orca 原生审核窗口，安全可控。" : "Others click Hire to launch Orca's native review & install dialog."}</div>
              </div>` : ""}
            <div style="display:flex;gap:8px;margin-top:6px;flex-wrap:wrap;justify-content:center">
              <button type="button" class="mkt-btn-primary" id="mktEmptyPubBtn">+ ${zh ? "分享我的 Bot" : "Publish My Bot"}</button>
              <button type="button" class="mkt-btn-ghost" id="mktEmptyLocalBtn">${zh ? "本地从零新建 Bot" : "Create Custom Bot Locally"}</button>
            </div>
          </div>`;

    container.innerHTML = `
      <div class="mkt-hero">
        <div class="mkt-hero-top">
          <div>
            <div class="mkt-hero-title">🏪 ${zh ? "Bot 人才市场" : "Bot Talent Market"} <span class="mkt-lobby-badge" style="font-size:10px">STORE</span></div>
            <div class="mkt-hero-sub">${zh ? "发现、点赞并一键招聘社区打造的 Orca Bot —— 原生审核入职，直接进大楼上班" : "Discover, upvote & 1-click hire community Orca Bots straight into your office tower"}</div>
          </div>
          <div class="mkt-hero-acts">
            <button type="button" class="mkt-btn-primary" id="mktHeroPubBtn">+ ${zh ? "分享我的 Bot" : "Publish My Bot"}</button>
            <button type="button" class="mkt-btn-ghost" id="mktHeroRefreshBtn">↻ ${zh ? "刷新" : "Refresh"}</button>
            <button type="button" class="mkt-btn-ghost" id="mktHeroBackBtn">← ${zh ? "返回大楼" : "Back to Office"}</button>
          </div>
        </div>
        <div class="mkt-hero-stats">
          <span class="mkt-stat-pill">🤖 ${zh ? "在招" : "Listed"} <b>${stats.totalBots || 0}</b></span>
          <span class="mkt-stat-pill">✓ ${zh ? "官方精选" : "Verified"} <b>${stats.verifiedBots || 0}</b></span>
          <span class="mkt-stat-pill">⚡ ${zh ? "累计招聘" : "Hires"} <b>${stats.totalHires || 0}</b></span>
          <span class="mkt-source-pill ${srcMode}">${esc(srcLabel)}</span>
        </div>
      </div>

      <div class="mkt-safety">
        <span>🛡️</span>
        <span>${zh
          ? "安全策略（对齐 Orca 插件规范）：所有 Bot 包均由 Orca 云端托管并自动扫描凭据；普通投稿标记为「社区分享」，点击「一键招聘」会先打开 Orca 原生审核弹窗确认 SOUL、Skills 与权限。"
          : "Orca-aligned Trust Policy: Bot packages stay hosted & secret-scanned by Orca Cloud. Community listings show an Unverified badge and always open Orca's native review modal before installing."}</span>
      </div>

      <div class="mkt-toolbar">
        <input class="mkt-search" id="mktSearchInput" type="search" value="${esc(ui.q)}" placeholder="${zh ? "搜索岗位、技能标签、作者或 Agent…" : "Search roles, tags, authors or agents…"}" />
        <div class="mkt-sort-seg">
          <button type="button" class="mkt-sort-btn ${ui.sort === "hot" ? "active" : ""}" data-msort="hot">🔥 ${zh ? "最热" : "Hot"}</button>
          <button type="button" class="mkt-sort-btn ${ui.sort === "likes" ? "active" : ""}" data-msort="likes">👍 ${zh ? "最多赞" : "Top Liked"}</button>
          <button type="button" class="mkt-sort-btn ${ui.sort === "newest" ? "active" : ""}" data-msort="newest">🆕 ${zh ? "最新" : "Newest"}</button>
        </div>
      </div>

      <div class="mkt-cats">
        ${CATS.map((c) => {
          const suffix = c.id === "mine" && myCount > 0 ? ` (${myCount})` : "";
          return `<button type="button" class="mkt-cat-chip ${ui.category === c.id ? "active" : ""}" data-mcat="${c.id}">${esc(c[lang] + suffix)}</button>`;
        }).join("")}
      </div>

      ${gridHtml}`;

    container.querySelector("#mktHeroPubBtn")?.addEventListener("click", onOpenPublish);
    container.querySelector("#mktEmptyPubBtn")?.addEventListener("click", onOpenPublish);
    container.querySelector("#mktEmptyLocalBtn")?.addEventListener("click", onOpenLocalHire);
    container.querySelector("#mktHeroRefreshBtn")?.addEventListener("click", onRefresh);
    container.querySelector("#mktHeroBackBtn")?.addEventListener("click", onBackOffice);

    const searchEl = container.querySelector("#mktSearchInput");
    searchEl?.addEventListener("input", (e) => {
      ui.q = e.target.value;
      const pos = e.target.selectionStart;
      renderMarketView(container, ctx);
      const next = container.querySelector("#mktSearchInput");
      if (next) { next.focus(); try { next.setSelectionRange(pos, pos); } catch {} }
    });

    container.querySelectorAll("[data-msort]").forEach((btn) => {
      btn.addEventListener("click", () => {
        ui.sort = btn.getAttribute("data-msort") || "hot";
        renderMarketView(container, ctx);
      });
    });
    container.querySelectorAll("[data-mcat]").forEach((btn) => {
      btn.addEventListener("click", () => {
        ui.category = btn.getAttribute("data-mcat") || "all";
        renderMarketView(container, ctx);
      });
    });
    container.querySelectorAll("[data-mkt-card]").forEach((card) => {
      card.addEventListener("click", () => {
        const b = bots.find((x) => x.id === card.getAttribute("data-mkt-card"));
        if (b) onSelectBot(b);
      });
    });
    container.querySelectorAll("[data-mkt-like]").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const b = bots.find((x) => x.id === btn.getAttribute("data-mkt-like"));
        if (b) await onLike(b);
      });
    });
    container.querySelectorAll("[data-mkt-hire]").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const b = bots.find((x) => x.id === btn.getAttribute("data-mkt-hire"));
        if (b) await onHire(b);
      });
    });
    container.querySelectorAll("[data-mkt-del]").forEach((btn) => {
      let armTimer = null;
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const b = bots.find((x) => x.id === btn.getAttribute("data-mkt-del"));
        if (!b || !onDelete) return;
        if (!btn.classList.contains("armed")) {
          btn.classList.add("armed");
          btn.textContent = zh ? "确认删除?" : "Confirm?";
          armTimer = setTimeout(() => {
            btn.classList.remove("armed");
            btn.textContent = "🗑️";
          }, 4000);
          return;
        }
        if (armTimer) clearTimeout(armTimer);
        btn.disabled = true;
        btn.textContent = "⏳";
        await onDelete(b);
      });
    });
  }

  function createController(deps) {
    const { orcaApi, getLang, getSnapshot, hireBot, engPillHtml, showToast, setViewMode, openLocalHire, setOpenCard, renderApp } = deps;
    let marketData = null;
    let loading = false;

    const updateTopBadge = () => {
      const zh = getLang() === "zh";
      const lbl = document.getElementById("viewMarketLbl");
      if (lbl) lbl.textContent = zh ? "人才市场" : "Talent Market";
      const cntEl = document.getElementById("viewMarketCnt");
      const total = marketData?.stats?.totalBots || 0;
      if (cntEl) {
        cntEl.textContent = String(total);
        cntEl.style.display = total > 0 ? "inline-flex" : "none";
      }
    };

    const load = async (force = false) => {
      if (!orcaApi?.plugin?.request || loading) return marketData;
      loading = true;
      try {
        const res = await orcaApi.plugin.request("office.getMarket", { force });
        if (res) marketData = res;
      } catch (err) {
        console.error("loadMarket failed:", err);
      } finally {
        loading = false;
        updateTopBadge();
        renderApp();
      }
      return marketData;
    };

    const handleLike = async (bot) => {
      const zh = getLang() === "zh";
      try {
        const res = await orcaApi.plugin.request("office.marketLike", { id: bot.id });
        if (res?.ok) {
          bot.liked = Boolean(res.liked);
          bot.likesCount = Number(res.likesCount ?? bot.likesCount);
          renderApp();
        }
      } catch (err) {
        showToast(zh ? `点赞失败：${err?.message || err}` : `Like failed: ${err?.message || err}`, true);
      }
    };

    const pickCreatorBot = () => {
      const snap = getSnapshot?.();
      const list = snap?.bots || [];
      if (!list.length) return null;
      const cfg = snap?.settings?.hrBotName || "";
      if (cfg) {
        const hit = list.find((b) => b.name.toLowerCase() === cfg.toLowerCase());
        if (hit) return hit;
      }
      return list.find((b) => /creator|hr|recruit|人力|招聘|创建/i.test(`${b.name || ""} ${b.specialty || ""}`))
        || list.find((b) => b.state === "working")
        || list[0];
    };

    const customizeOfficial = (bot) => {
      const lang = getLang();
      openLocalHire({
        template: bot.templateId || "",
        name: botTitle(bot, lang),
        purpose: botPitch(bot, lang),
        watches: bot.watches || "",
        doesText: bot.doesText || "",
        reports: bot.reports || "",
      });
    };

    const handleHire = async (bot) => {
      const lang = getLang();
      const zh = lang === "zh";
      const isOfficial = bot.kind === "official" || bot.trust === "official";
      const isRecipe = !isOfficial && (!bot.shareId || bot.shareMode === "recipe");
      if (isOfficial || isRecipe) {
        const creator = pickCreatorBot();
        if (!creator || !hireBot) {
          customizeOfficial(bot);
          return;
        }
        try {
          await hireBot({
            hrBotName: creator.name,
            hrWorktreeId: creator.worktreeId || "",
            mode: "offer",
            template: isOfficial ? (bot.templateId || "") : "",
            name: botTitle(bot, lang),
            purpose: botPitch(bot, lang),
            watches: bot.watches || "",
            doesText: bot.doesText || "",
            reports: bot.reports || "",
            soulMd: bot.soulMd || "",
            bundle: bot.bundle || null,
            lang,
          });
          if (isRecipe && bot.id) {
            void orcaApi.plugin.request("office.marketHire", { id: bot.id }).catch(() => {});
            bot.hiresCount = Number(bot.hiresCount || 0) + 1;
            if (marketData?.stats) marketData.stats.totalHires = Number(marketData.stats.totalHires || 0) + 1;
            renderApp();
          }
          showToast(zh ? `⚡ 已交由 ${creator.name} 弹出「${botTitle(bot, lang)}」原生创建卡` : `⚡ Asked ${creator.name} to pop Create Bot card for "${botTitle(bot, lang)}"`, false);
        } catch (err) {
          showToast(zh ? `发起创建失败：${err?.message || err}` : `Failed to launch create card: ${err?.message || err}`, true);
        }
        return;
      }
      try {
        await orcaApi.plugin.request("office.marketHire", { id: bot.id, shareId: bot.shareId, shareUrl: bot.shareUrl });
        bot.hiresCount = Number(bot.hiresCount || 0) + 1;
        if (marketData?.stats) marketData.stats.totalHires = Number(marketData.stats.totalHires || 0) + 1;
        showToast(zh ? `⚡ 已唤起 Orca 招聘「${bot.name}」，请在原生审核弹窗确认入职` : `⚡ Opening Orca Share Review for "${bot.name}"…`, false);
        renderApp();
      } catch (err) {
        showToast(zh ? `唤起失败：${err?.message || err}` : `Failed to open share link: ${err?.message || err}`, true);
      }
    };

    const handleReport = async (bot) => {
      const zh = getLang() === "zh";
      try {
        const res = await orcaApi.plugin.request("office.marketReport", { id: bot.id, reason: "broken_or_spam" });
        showToast(res?.autoHidden
          ? (zh ? "✓ 已举报，该条目已自动隐藏待复核" : "✓ Reported — listing auto-hidden pending review")
          : (zh ? "✓ 已记录举报，感谢反馈" : "✓ Report submitted, thank you"), false);
        if (res?.autoHidden) void load(true);
      } catch (err) {
        showToast(String(err?.message || err), true);
      }
    };

    const handleDelete = async (bot) => {
      const zh = getLang() === "zh";
      try {
        await orcaApi.plugin.request("office.marketDelete", { id: bot.id });
        if (marketData?.bots) {
          marketData.bots = marketData.bots.filter((x) => x.id !== bot.id);
          if (marketData.stats) {
            marketData.stats.totalBots = marketData.bots.length;
            marketData.stats.communityBots = Math.max(0, Number(marketData.stats.communityBots || 1) - 1);
          }
        }
        updateTopBadge();
        renderApp();
        showToast(zh ? `✓ 已彻底删除「${bot.name}」的分享，原链接已失效` : `✓ Deleted "${bot.name}" from Talent Market`, false);
        void load(true);
        return true;
      } catch (err) {
        showToast(zh ? `删除失败：${err?.message || err}` : `Delete failed: ${err?.message || err}`, true);
        return false;
      }
    };

    const handlePrepareLocal = async (botId) => {
      return await orcaApi.plugin.request("office.marketPrepareLocal", { botId });
    };
    const handleRandomAvatar = async () => {
      return await orcaApi.plugin.request("office.marketRandomAvatar", {});
    };

    const handlePublish = async (payload) => {
      const res = await orcaApi.plugin.request("office.marketPublish", payload);
      void load(true);
      return res;
    };

    const openDetail = (bot) => setOpenCard({ kind: "marketDetail", bot });
    const openPublish = () => {
      if (!marketData) void load(false);
      setOpenCard({ kind: "marketPublish" });
    };

    const renderLobby = () => {
      updateTopBadge();
      renderLobbyBanner(document.getElementById("marketLobbyBanner"), {
        marketData,
        lang: getLang(),
        onOpenMarket: () => { setViewMode("market"); if (!marketData) void load(false); },
        onOpenPublish: openPublish,
        onSelectBot: openDetail,
      });
    };

    const renderView = () => {
      updateTopBadge();
      renderMarketView(document.getElementById("marketView"), {
        marketData,
        loading,
        lang: getLang(),
        engPillHtml,
        onBackOffice: () => setViewMode("office"),
        onRefresh: () => void load(true),
        onOpenPublish: openPublish,
        onOpenLocalHire: openLocalHire,
        onSelectBot: openDetail,
        onLike: handleLike,
        onHire: handleHire,
        onDelete: handleDelete,
      });
    };

    const renderModalIfMatch = (openCard, onClose) => {
      const openExt = (u) => orcaApi?.shell?.openExternal?.(u)?.catch?.(() => {});
      if (openCard?.kind === "marketDetail") {
        window.OfficeMarketModals.renderMarketDetailModal({
          bot: openCard.bot,
          lang: getLang(),
          liveWritable: Boolean(marketData?.liveWritable),
          engPillHtml,
          onLike: handleLike,
          onHire: handleHire,
          onCustomizeOfficial: customizeOfficial,
          onReport: handleReport,
          onDelete: handleDelete,
          onOpenExternal: openExt,
          showToast,
          onClose,
        });
        return true;
      }
      if (openCard?.kind === "marketPublish") {
        window.OfficeMarketModals.renderMarketPublishModal({
          localBots: marketData?.localBots || [],
          lang: getLang(),
          liveWritable: Boolean(marketData?.liveWritable),
          apiConfigured: Boolean(marketData?.apiConfigured),
          onPrepareLocal: handlePrepareLocal,
          onRandomAvatar: handleRandomAvatar,
          onPublish: handlePublish,
          onOpenExternal: openExt,
          showToast,
          onClose,
        });
        return true;
      }
      return false;
    };

    const injectMock = (mockMarket) => { marketData = mockMarket; updateTopBadge(); };

    return { load, renderLobby, renderView, renderModalIfMatch, openPublish, updateTopBadge, injectMock };
  }

  window.OfficeMarket = { renderLobbyBanner, renderMarketView, createController };
})();
