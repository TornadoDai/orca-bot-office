/**
 * Bot Squad (Multi-Bot Team Pack) UI helpers for Talent Market Detail & Publish Modals.
 */
(function () {
  function esc(s) {
    return String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function renderTeamDetailSection(bot, zh, engPillHtml) {
    const b = bot.bundle || {};
    const members = Array.isArray(b.members) ? b.members : [];
    const collab = String(b.collaboration || "").trim();
    const collabHtml = collab
      ? `<div class="mkt-collab-box">
           <div class="ic-section-title" style="margin-bottom:4px">🤝 ${zh ? "小队协作分工与交接流程" : "Squad Collaboration & Handoff Flow"}</div>
           <div style="font-size:11.5px;line-height:1.55;color:var(--fg-soft);white-space:pre-wrap">${esc(collab)}</div>
         </div>`
      : "";

    const membersHtml = members.map((m, idx) => {
      const counts = [
        (m.automations || []).length ? `⏰ ${m.automations.length}` : "",
        (m.skills || []).length ? `🧩 ${m.skills.length}` : "",
        (m.tools || []).length ? `🔧 ${m.tools.length}` : "",
        (m.memory || []).length ? `🧠 ${m.memory.length}` : "",
      ].filter(Boolean).map((x) => `<span class="mkt-bpill">${x}</span>`).join("");

      const innerParts = [];
      if (m.soulMd) innerParts.push(`<pre class="mkt-soul-pre">${esc(m.soulMd)}</pre>`);
      if ((m.automations || []).length) {
        innerParts.push(`<div class="mkt-tpl-specs" style="margin-top:5px">${m.automations.map((a) => `<div><b>⏰ ${esc(a.name)}</b> ${a.rrule ? `<code>${esc(a.rrule)}</code>` : ""}<div style="color:var(--muted)">${esc(a.prompt)}</div></div>`).join("")}</div>`);
      }
      if ((m.skills || []).length) {
        innerParts.push(`<div class="mkt-tpl-specs" style="margin-top:5px"><b>🧩 ${zh ? "技能：" : "Skills:"}</b> ${esc(m.skills.map((s) => s.name).join(", "))}</div>`);
      }
      if ((m.tools || []).length) {
        innerParts.push(`<div class="mkt-tpl-specs" style="margin-top:5px"><b>🔧 ${zh ? "工具：" : "Tools:"}</b> ${esc(m.tools.map((t) => t.name).join(", "))}</div>`);
      }
      if ((m.memory || []).length) {
        innerParts.push(`<div class="mkt-tpl-specs" style="margin-top:5px"><b>🧠 ${zh ? "记忆：" : "Memory:"}</b> ${esc(m.memory.map((x) => x.topic).join(", "))}</div>`);
      }

      return `
        <div class="mkt-team-mcard">
          <div class="mkt-team-mhead">
            <label class="mkt-team-mchk">
              <input type="checkbox" data-team-hire-idx="${idx}" checked />
              <img class="mkt-mini-av" src="${esc(m.avatarDataUrl || "")}" alt="" />
              <div class="mkt-team-mtitle">
                <div class="mkt-name-row">
                  <span style="font-weight:800;font-size:12.5px;color:var(--fg-strong)">${esc(m.name)}</span>
                  ${m.role ? `<span class="ic-pill">${esc(m.role)}</span>` : ""}
                  ${engPillHtml ? engPillHtml(m.agentHint || "claude") : ""}
                </div>
                <div style="font-size:11px;color:var(--fg-soft);margin-top:2px">${esc(m.purpose)}</div>
              </div>
            </label>
          </div>
          ${counts ? `<div class="mkt-bundle-pills" style="margin-top:5px">${counts}</div>` : ""}
          ${innerParts.length ? `<details class="ic-collapse" style="margin-top:6px"><summary class="ic-collapse-sum">📄 ${zh ? "展开审查该成员脱敏配置" : "Audit sanitized member config"}</summary>${innerParts.join("")}</details>` : ""}
        </div>`;
    }).join("");

    return `
      ${collabHtml}
      <div style="margin-top:8px">
        <div class="mkt-bundle-hdr" style="margin-bottom:6px">
          <span>👥 ${zh ? `选择要招入的成员（默认全选，共 ${members.length} 位）` : `Select Squad Members to Hire (${members.length} total)`}</span>
          <small>${zh ? "可整队招入或只勾部分" : "Hire all or cherry-pick"}</small>
        </div>
        <div style="display:flex;flex-direction:column;gap:7px">${membersHtml}</div>
      </div>`;
  }

  function bindTeamDetailSelection(root, bot, zh, hireBtn) {
    const members = Array.isArray(bot?.bundle?.members) ? bot.bundle.members : [];
    const getSelected = () =>
      [...root.querySelectorAll("[data-team-hire-idx]:checked")]
        .map((el) => members[Number(el.getAttribute("data-team-hire-idx"))])
        .filter(Boolean);

    const syncBtn = () => {
      if (!hireBtn) return;
      const n = getSelected().length;
      hireBtn.disabled = n === 0;
      hireBtn.textContent = zh ? `⚡ 一键招入已选 ${n} 位` : `⚡ Hire Selected (${n})`;
    };
    root.querySelectorAll("[data-team-hire-idx]").forEach((cb) => cb.addEventListener("change", syncBtn));
    syncBtn();
    return getSelected;
  }

  function mountTeamPublisher(container, ctx) {
    const { localBots, zh, onPrepareLocal, onRandomAvatar, formatRedactionSummary, onSummaryChange } = ctx;
    const bots = Array.isArray(localBots) ? localBots : [];
    const draftCache = new Map();
    const memberState = new Map(); // botId -> { role, includeAuto, includeSkill, includeTool, includeMem, avatarOverride }
    const selectedIds = new Set(bots.slice(0, Math.min(2, bots.length)).map((b) => b.id));

    container.innerHTML = `
      <div class="om-field">
        <label class="om-lbl">${zh ? "👥 勾选 2–6 位本机 Bot 组成小队（全部自动脱敏，自定义头像自动随机）" : "👥 Pick 2–6 local Bots for this Squad (all auto-sanitized)"}</label>
        <div class="mkt-bundle-box">
          ${bots.length < 2
            ? `<div style="font-size:11.5px;color:var(--muted)">${zh ? "本机目前不足 2 个 Bot，至少需要 2 个 Bot 才能打包组合。" : "At least 2 local Bots are required to publish a Squad."}</div>`
            : `<div class="mkt-chk-list" id="mktTeamPickList" style="max-height:140px">
                ${bots.map((b) => `
                  <label class="mkt-chk-row">
                    <input type="checkbox" data-team-pick="${esc(b.id)}" ${selectedIds.has(b.id) ? "checked" : ""} />
                    <img class="mkt-mini-av" style="width:20px;height:20px" src="${esc(b.avatarDataUrl)}" alt="" />
                    <span class="mkt-chk-main">${esc(b.name)}</span>
                    <span class="mkt-chk-meta">${esc(b.agentHint)}</span>
                  </label>`).join("")}
              </div>`}
        </div>
      </div>
      <div class="om-field">
        <label class="om-lbl">${zh ? "已选成员配置与模块开关" : "Selected Members & Included Modules"}</label>
        <div id="mktTeamMembersWrap" style="display:flex;flex-direction:column;gap:7px"></div>
      </div>
      <div class="om-field">
        <label class="om-lbl">${zh ? "🤝 小队协作分工与交接流程（推荐填写）" : "🤝 Collaboration & Handoff Flow (recommended)"}</label>
        <textarea class="om-textarea" id="mktTeamCollabInput" rows="3" maxlength="2000" placeholder="${zh ? "例：PR审查官审核代码并盯 CI → 通过后交接给发布官打 Tag 写 Changelog → 助理整理团队播报" : "e.g. PR Reviewer audits diffs -> hands off to Release Pilot -> Ops Bot verifies rollout"}"></textarea>
      </div>`;

    const ensureDraft = async (botId) => {
      if (draftCache.has(botId)) return draftCache.get(botId);
      if (!onPrepareLocal) return null;
      const d = await onPrepareLocal(botId);
      draftCache.set(botId, d);
      if (!memberState.has(botId)) {
        memberState.set(botId, {
          role: "",
          includeAuto: true,
          includeSkill: true,
          includeTool: true,
          includeMem: false,
          avatar: null,
        });
      }
      return d;
    };

    const renderMembers = async () => {
      const wrap = container.querySelector("#mktTeamMembersWrap");
      if (!wrap) return;
      const ids = [...selectedIds];
      if (!ids.length) {
        wrap.innerHTML = `<div style="font-size:11px;color:var(--muted)">${zh ? "请先勾选至少 2 个本地 Bot。" : "Select at least 2 local Bots above."}</div>`;
        return;
      }
      wrap.innerHTML = `<div style="font-size:11px;color:var(--muted)">⏳ ${zh ? `正在扫描并脱敏 ${ids.length} 位成员…` : `Scanning & sanitizing ${ids.length} members…`}</div>`;
      const drafts = (await Promise.all(ids.map((id) => ensureDraft(id).catch(() => null)))).filter(Boolean);

      let totalRedacted = 0;
      const allBlocked = [];
      let randCount = 0;
      for (const d of drafts) {
        totalRedacted += Number(d.redactions?.total || 0);
        for (const bf of d.redactions?.blockedMemoryFiles || []) allBlocked.push(`${d.name}/${bf}`);
        if (d.randomizedAvatar) randCount += 1;
      }
      onSummaryChange?.({ drafts, totalRedacted, allBlocked, randCount });

      const collabEl = container.querySelector("#mktTeamCollabInput");
      if (collabEl && !collabEl.value.trim() && drafts.length >= 2) {
        collabEl.value = drafts.map((d) => d.name).join(" → ");
      }

      wrap.innerHTML = drafts.map((d) => {
        const st = memberState.get(d.botId) || { role: "", includeAuto: true, includeSkill: true, includeTool: true, includeMem: false, avatar: null };
        const avUrl = st.avatar?.avatarDataUrl || d.avatarDataUrl || "";
        const p = d.parts || {};
        const blocked = p.blockedMemoryFiles || [];
        return `
          <div class="mkt-team-mcard" data-tm-id="${esc(d.botId)}">
            <div class="mkt-team-mhead">
              <img class="mkt-mini-av" data-tm-av="${esc(d.botId)}" src="${esc(avUrl)}" alt="" />
              <div class="mkt-team-mtitle">
                <div class="mkt-name-row">
                  <span style="font-weight:800;font-size:12px;color:var(--fg-strong)">${esc(d.name)}</span>
                  <span class="ic-pill">${esc(d.agentHint || "claude")}</span>
                  <button type="button" class="mkt-btn-ghost" data-tm-shuf="${esc(d.botId)}" style="padding:1px 6px;font-size:10px">🎲</button>
                </div>
                <input class="om-input" data-tm-role="${esc(d.botId)}" type="text" maxlength="36" value="${esc(st.role)}" style="margin-top:4px;padding:3px 7px;font-size:11px" placeholder="${zh ? "可选角色标签（如：研发负责 / 审查把关 / 运维值守）" : "Optional role label (e.g. Code Gate, Ship Lead)"}" />
              </div>
            </div>
            <div class="mkt-team-toggles">
              <label><input type="checkbox" data-tm-opt="includeAuto" data-tm-for="${esc(d.botId)}" ${st.includeAuto ? "checked" : ""} /> ⏰ ${zh ? "定时" : "Auto"} (${(p.automations || []).length})</label>
              <label><input type="checkbox" data-tm-opt="includeSkill" data-tm-for="${esc(d.botId)}" ${st.includeSkill ? "checked" : ""} /> 🧩 ${zh ? "技能" : "Skills"} (${(p.skills || []).length})</label>
              <label><input type="checkbox" data-tm-opt="includeTool" data-tm-for="${esc(d.botId)}" ${st.includeTool ? "checked" : ""} /> 🔧 ${zh ? "工具" : "Tools"} (${(p.tools || []).filter((t) => t.defaultChecked).length})</label>
              <label><input type="checkbox" data-tm-opt="includeMem" data-tm-for="${esc(d.botId)}" ${st.includeMem ? "checked" : ""} /> 🧠 ${zh ? "记忆" : "Mem"} (${(p.memory || []).length})</label>
            </div>
            ${blocked.map((f) => `<div class="mkt-blocked-row" style="margin-top:4px">🔒 ${zh ? `已硬拦截：${esc(f)}` : `Blocked: ${esc(f)}`}</div>`).join("")}
          </div>`;
      }).join("");

      wrap.querySelectorAll("[data-tm-role]").forEach((inp) => {
        inp.addEventListener("input", () => {
          const st = memberState.get(inp.getAttribute("data-tm-role"));
          if (st) st.role = inp.value;
        });
      });
      wrap.querySelectorAll("[data-tm-opt]").forEach((cb) => {
        cb.addEventListener("change", () => {
          const st = memberState.get(cb.getAttribute("data-tm-for"));
          if (st) st[cb.getAttribute("data-tm-opt")] = cb.checked;
        });
      });
      wrap.querySelectorAll("[data-tm-shuf]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const bid = btn.getAttribute("data-tm-shuf");
          if (!onRandomAvatar) return;
          const av = await onRandomAvatar().catch(() => null);
          if (!av) return;
          const st = memberState.get(bid);
          if (st) st.avatar = av;
          const img = wrap.querySelector(`[data-tm-av="${bid}"]`);
          if (img && av.avatarDataUrl) img.src = av.avatarDataUrl;
        });
      });
    };

    container.querySelectorAll("[data-team-pick]").forEach((cb) => {
      cb.addEventListener("change", () => {
        const bid = cb.getAttribute("data-team-pick");
        if (cb.checked) {
          if (selectedIds.size >= 6) {
            cb.checked = false;
            return;
          }
          selectedIds.add(bid);
        } else {
          selectedIds.delete(bid);
        }
        void renderMembers();
      });
    });

    void renderMembers();

    return {
      getTeamPayload() {
        const ids = [...selectedIds];
        if (ids.length < 2 || ids.length > 6) {
          throw new Error(zh ? "Bot 组合需要勾选 2–6 位成员" : "Select 2–6 Bots to publish a Squad");
        }
        const members = ids.map((id) => {
          const d = draftCache.get(id);
          if (!d) throw new Error(zh ? "成员数据仍在扫描中，请稍候 1 秒重试" : "Still scanning members, try again in a second");
          const st = memberState.get(id) || {};
          const p = d.parts || {};
          const av = st.avatar || d;
          return {
            name: d.name,
            role: String(st.role || "").trim(),
            purpose: d.purpose,
            soulMd: d.soulMd || "",
            agentHint: d.agentHint || "claude",
            avatarType: av.avatarType || "mascot",
            avatarValue: av.avatarValue || "A1",
            avatarColor: av.avatarColor || "#b3dbf4",
            automations: st.includeAuto !== false ? (p.automations || []).map(({ name, rrule, prompt, resultsTo }) => ({ name, rrule, prompt, resultsTo })) : [],
            skills: st.includeSkill !== false ? (p.skills || []).map(({ name, content }) => ({ name, content })) : [],
            tools: st.includeTool !== false ? (p.tools || []).filter((t) => t.defaultChecked).map(({ name, scope, url, headerNames }) => ({ name, scope, url, headerNames })) : [],
            memory: st.includeMem ? (p.memory || []).map(({ topic, content }) => ({ topic, content })) : [],
            settings: p.settings || { agent: d.agentHint || "claude", connectors: [] },
          };
        });
        const first = members[0];
        const collab = String(container.querySelector("#mktTeamCollabInput")?.value || "").trim();
        return {
          packType: "team",
          avatarType: first.avatarType,
          avatarValue: first.avatarValue,
          avatarColor: first.avatarColor,
          agentHint: first.agentHint,
          skills: [...new Set(members.flatMap((m) => m.skills.map((s) => s.name)))].slice(0, 16),
          bundle: {
            packType: "team",
            collaboration: collab,
            members,
            settings: { connectors: [...new Set(members.flatMap((m) => m.settings?.connectors || []))] },
          },
        };
      },
    };
  }

  window.OfficeMarketTeam = { renderTeamDetailSection, bindTeamDetailSelection, mountTeamPublisher };
})();
