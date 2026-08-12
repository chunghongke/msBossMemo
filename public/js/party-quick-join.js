/**
 * party-quick-join.js
 * Extracted quick join logic.
 * Functions: renderExistingTeamsQuickJoin, joinExistingTeam
 */

// 列出「這隻 BOSS 目前已經組好、還有空位」的隊伍，供快速一鍵加入（不分首刷/重置輪次）
function renderExistingTeamsQuickJoin() {
  const container = document.getElementById("existingTeamsList");
  if (!container) return;

  const boss = window.config.bosses.find(b => b.id === editingBossId);
  const maxPartySize = boss ? boss.maxPartySize : 1;

  // 掃描這隻 BOSS 底下所有的 weeklyRecords，收集不重複的 teamId
  // 💡 用 record 自己存的 bossId 欄位精準比對，不要用 key 字串做 substring 判斷
  //    （否則像 "chaos" 跟 "chaos_hard" 這種一個是另一個子字串的情況，會被誤判成同一隻 BOSS）
  const teamIds = new Set();
  if (window.store.weeklyRecords) {
    Object.values(window.store.weeklyRecords).forEach(rec => {
      if (rec && rec.bossId === editingBossId && rec.teamId) {
        teamIds.add(rec.teamId);
      }
    });
  }

  const selfKey = `${editingCharId}:${editingEntry}`;
  const teamCards = [];

  teamIds.forEach(teamId => {
    const team = window.store.teams ? window.store.teams[teamId] : null;
    if (!team) return;

    const members = team.memberTargets || (team.memberCharIds || []).map(id => ({ charId: id, entryIndex: editingEntry }));

    // 排除單人的預設隊伍，只列出「真的組過」的隊伍
    if (members.length <= 1) return;

    const isSelfInTeam = members.some(m => `${m.charId}:${m.entryIndex}` === selfKey);
    const isFull = members.length >= maxPartySize;

    const memberNames = members.map(m => {
      const name = getCharName(m.charId);
      return m.entryIndex === 2 ? `${name}(重置)` : name;
    }).join("、");

    teamCards.push({ teamId, memberNames, count: members.length, disabled: isSelfInTeam || isFull, isSelfInTeam, isFull });
  });

  // 別隊（不是正在編輯這隊）的成員，個別角色清單要排除，避免跟這裡的快速加入按鈕重複列出
  coveredByOtherTeams = new Set();
  teamCards.forEach(t => {
    if (t.isSelfInTeam) return; // 正在編輯的這隊，成員要留在下面的清單裡讓使用者能勾/取消
    const team = window.store.teams[t.teamId];
    const members = team.memberTargets || (team.memberCharIds || []).map(id => ({ charId: id, entryIndex: editingEntry }));
    members.forEach(m => coveredByOtherTeams.add(`${m.charId}_${m.entryIndex}`));
  });

  if (teamCards.length === 0) {
    container.innerHTML = "";
    return;
  }

  let html = `<div style="font-weight: bold; font-size: 13px; margin-bottom: 6px; color: var(--title-color);">👥 現有隊伍快速加入：</div>`;
  html += `<div style="display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px;">`;

  teamCards.forEach(t => {
    const reasonTag = t.isSelfInTeam ? "（已在隊中）" : t.isFull ? "（已滿員）" : "";
    html += `
      <button type="button" class="btn btn-secondary" style="text-align:left; font-size:12px; padding:6px 10px; ${t.disabled ? 'opacity:0.5; cursor:not-allowed;' : ''}"
        ${t.disabled ? 'disabled' : `onclick="joinExistingTeam('${t.teamId}')"`}>
        ${t.memberNames}（${t.count}人）${reasonTag}
      </button>`;
  });

  html += `</div>`;
  container.innerHTML = html;
}

// 點擊「現有隊伍」時，把該隊成員疊加勾選到目前的清單上（不取代既有勾選）
function joinExistingTeam(teamId) {
  const team = window.store.teams ? window.store.teams[teamId] : null;
  if (!team) return;

  const members = team.memberTargets || (team.memberCharIds || []).map(id => ({ charId: id, entryIndex: editingEntry }));

  const existingCheckboxes = document.querySelectorAll('input[name="partyChar"]:checked');
  const checkedKeys = new Set(Array.from(existingCheckboxes).map(cb => cb.value));
  members.forEach(m => checkedKeys.add(`${m.charId}_${m.entryIndex}`));

  renderPartySelectList(Array.from(checkedKeys).map(k => {
    const parts = k.split("_");
    const entryIdx = parseInt(parts.pop(), 10);
    return { charId: parts.join("_"), entryIndex: entryIdx };
  }), null, true);

  updatePartyCheckboxStates();
}
