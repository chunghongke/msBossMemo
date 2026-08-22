/**
 * party-modal.js
 * Extracted party modal main logic.
 * Functions: handleCellTouchStart, handleCellTouchMove, handleCellTouchEnd, openPartyModal, savePartyTeam, closePartyModal
 */

let editingCharId = null;
let editingBossId = null;
let editingEntry = 1;
let coveredByOtherTeams = new Set(); // 「現有隊伍快速加入」清單裡，屬於別隊（不是正在編輯這隊）的成員，這些人如果還沒被勾選，個別清單就不重複列出
let originalTeamTargets = []; // modal 開啟時的原始隊員清單，用來識別使用者主動移除的人

// ==========================================
// 手機長按 (Long Press) 模擬右鍵 —— 開啟組隊編輯 modal
// ==========================================
let longPressTimer = null;
let longPressFired = false;
let longPressStartPos = null;
let longPressCellEl = null;
window.handleCellTouchStart = function(event, charId, bossId, entryIndex, cellEl) {
  if (event.touches.length !== 1) return;
  longPressFired = false;
  longPressStartPos = { x: event.touches[0].clientX, y: event.touches[0].clientY };
  longPressCellEl = cellEl || event.currentTarget || (event.target ? event.target.closest('.boss-cell') : null);

  clearTimeout(longPressTimer);
  longPressTimer = setTimeout(() => {
    longPressFired = true;
    if (longPressCellEl) longPressCellEl.classList.add('long-press-active');
    if (window.navigator && window.navigator.vibrate) window.navigator.vibrate(15);
    openPartyModal(event, charId, bossId, entryIndex);
  }, LONG_PRESS_DURATION);
};

window.handleCellTouchMove = function(event) {
  if (!longPressStartPos || event.touches.length !== 1) return;
  const dx = Math.abs(event.touches[0].clientX - longPressStartPos.x);
  const dy = Math.abs(event.touches[0].clientY - longPressStartPos.y);
  if (dx > LONG_PRESS_MOVE_TOLERANCE || dy > LONG_PRESS_MOVE_TOLERANCE) {
    clearTimeout(longPressTimer);
  }
};

window.handleCellTouchEnd = function(event) {
  clearTimeout(longPressTimer);
  if (longPressCellEl) longPressCellEl.classList.remove('long-press-active');
  longPressCellEl = null;
  longPressStartPos = null;
};

window.isLongPressFired = function() {
  return longPressFired;
};

window.clearLongPressFired = function() {
  longPressFired = false;
};

window.openPartyModal = function(event, charId, bossId, entryIndex) {
  if (event && event.preventDefault) event.preventDefault();
  editingCharId = charId;
  editingBossId = bossId;
  editingEntry = entryIndex;

  const boss = window.config.bosses.find(b => b.id === bossId);
  document.getElementById("partyModalTitle").innerText = `組隊設定：${getCharName(charId)} - ${boss.name}`;
  document.getElementById("partyModalSubtitle").innerText = `該 BOSS 人數上限為 ${boss.maxPartySize} 人 (預設為單人)`;

  const recordKey = `rec_${charId}_${bossId}_${entryIndex}`;
  const record = window.store.weeklyRecords[recordKey];
  let currentTargets = [{ charId: charId, entryIndex: entryIndex }];
  let currentSchedule = null;

  if (record && record.teamId && window.store.teams[record.teamId]) {
    const team = window.store.teams[record.teamId];
    if (team.memberTargets) {
      currentTargets = team.memberTargets;
    } else if (team.memberCharIds) {
      currentTargets = team.memberCharIds.map(id => ({ charId: id, entryIndex: entryIndex }));
    }
    currentSchedule = team.schedule || null;
  }

  renderExistingTeamsQuickJoin();
  renderPartySelectList(currentTargets, null, true);
  loadPartyScheduleIntoForm(currentSchedule);

  // 記住開啟時的原始隊員，savePartyTeam 用來辨識「使用者主動取消」的成員
  originalTeamTargets = currentTargets.slice();

  document.getElementById("partyModal").style.display = "flex";
}

function savePartyTeam() {
  const boss = window.config.bosses.find(b => b.id === editingBossId);
  const checkboxes = document.querySelectorAll('input[name="partyChar"]:checked');

  // 解析勾選的 "charId_entryIndex" —— 這是使用者在這個 modal 裡「親眼看到並主動勾選」的成員
  let selectedTargets = Array.from(checkboxes).map(cb => {
    const parts = cb.value.split("_");
    const entryIdx = parseInt(parts.pop(), 10);
    const cId = parts.join("_");
    return { charId: cId, entryIndex: entryIdx };
  });

  if (selectedTargets.length === 0) {
    selectedTargets = [{ charId: editingCharId, entryIndex: editingEntry }];
  }

  const targetKey = (t) => `${t.charId}:${t.entryIndex}`;

  // 找出「選取清單中每一位成員」各自原本所屬的隊伍（正式角色才有自己的 record，Guest 沒有）
  const oldTeamsByTarget = new Map(); // key -> members[]
  selectedTargets.forEach(sel => {
    if (sel.charId.startsWith("guest_")) return;
    const recKey = `rec_${sel.charId}_${editingBossId}_${sel.entryIndex}`;
    const rec = window.store.weeklyRecords[recKey];
    if (rec && rec.teamId && window.store.teams[rec.teamId]) {
      const oldTeam = window.store.teams[rec.teamId];
      const members = oldTeam.memberTargets || (oldTeam.memberCharIds || []).map(id => ({ charId: id, entryIndex: sel.entryIndex }));
      oldTeamsByTarget.set(targetKey(sel), members);
    }
  });

  // 1. 自動合併：這次新勾選的成員（不含正在編輯的 editingCharId 自己），
  //    如果原本就在其他隊伍，把該隊隊友一併拉進來（editingCharId 自己的舊隊伍成員已經是這個 modal 一開始就顯示、可被使用者親自勾/取消的清單，不強制合併，尊重使用者的明確取消勾選）
  const finalMap = new Map();
  selectedTargets.forEach(t => finalMap.set(targetKey(t), t));

  // 💡 找出「使用者明確取消勾選」的成員：原本就在這支隊伍、但這次存檔時沒有出現在 selectedTargets 裡
  //    這些人不應被自動合併邏輯偷偷補回來（否則「移除成員」的操作會失效）
  const explicitlyRemovedKeys = new Set(
    originalTeamTargets
      .filter(orig => !finalMap.has(targetKey(orig)))
      .map(orig => targetKey(orig))
  );

  const autoMergedNames = [];
  selectedTargets.forEach(sel => {
    if (sel.charId === editingCharId) return;
    const oldMembers = oldTeamsByTarget.get(targetKey(sel)) || [];
    oldMembers.forEach(m => {
      // 💡 Guest 在這個組隊視窗裡永遠都是可見、可以自己勾/取消的選項（不像正式角色可能因為沒排定這隻 BOSS 而完全不會出現），
      //    所以不強制把 Guest 合併回來，尊重使用者當下實際的勾選狀態，避免明明取消勾選了、存檔後又被偷偷加回去
      if (m.charId.startsWith("guest_")) return;
      if (finalMap.has(targetKey(m))) return;

      // 💡 這個成員是使用者在這次編輯中「主動取消勾選」的人，不要強制合併回來
      if (explicitlyRemovedKeys.has(targetKey(m))) return;

      // 💡 這個人已經用「另一個身份」（不同 entryIndex）出現在目前名單裡了，不要再合併回來，
      //    避免形成同一人同時佔用首刷+重置兩個身份的無效狀態（也避免跟下面的重複檢查形成死結）
      const alreadyPresentAtOtherEntry = Array.from(finalMap.values()).some(existing => existing.charId === m.charId);
      if (alreadyPresentAtOtherEntry) return;

      finalMap.set(targetKey(m), m);
      autoMergedNames.push(getCharName(m.charId));
    });
  });

  const finalTargets = Array.from(finalMap.values());

  // 💡 同一個角色不能同時以「首刷」跟「重置刷」的身份出現在同一隊裡——
  //    這會讓兩筆本該獨立的紀錄共用同一個 teamId，導致切換完成狀態時兩邊被綁在一起同步
  const charIdCounts = new Map();
  finalTargets.forEach(t => {
    charIdCounts.set(t.charId, (charIdCounts.get(t.charId) || 0) + 1);
  });
  const duplicatedCharIds = Array.from(charIdCounts.entries()).filter(([, cnt]) => cnt > 1).map(([id]) => id);
  if (duplicatedCharIds.length > 0) {
    const names = duplicatedCharIds.map(id => getCharName(id)).join("、");
    alert(`「${names}」不能同時以「首次刷」跟「重置刷」的身份出現在同一個隊伍裡，這樣兩邊的完成狀態會被綁在一起、沒辦法分開紀錄。\n請確認每個角色只勾選其中一個身份。`);
    return;
  }

  if (finalTargets.length > boss.maxPartySize) {
    const mergedNote = autoMergedNames.length > 0 ? `（含自動合併的隊友：${autoMergedNames.join(", ")}）` : "";
    alert(`該 BOSS 人數上限為 ${boss.maxPartySize} 人，合併後共 ${finalTargets.length} 人${mergedNote}，請手動調整勾選！`);
    return;
  }

  // 2. 建立新隊伍與儲存出團時間排程
  const sortedKey = finalTargets.map(t => `${t.charId}:${t.entryIndex}`).sort().join("_");
  const sharedTeamId = `team_${editingBossId}_${sortedKey}`;
  const schedule = readPartyScheduleFromForm();

  if (!window.store.teams) window.store.teams = {};
  window.store.teams[sharedTeamId] = { 
    id: sharedTeamId, 
    memberTargets: finalTargets,
    memberCharIds: finalTargets.map(t => t.charId), // 相容保留
    schedule: schedule
  };

  // 3. 更新最終隊伍成員各自輪次的記錄
  finalTargets.forEach(target => {
    if (target.charId.startsWith("guest_")) return;
    const recKey = `rec_${target.charId}_${editingBossId}_${target.entryIndex}`;
    const oldRecord = window.store.weeklyRecords ? window.store.weeklyRecords[recKey] : null;
    window.store.weeklyRecords[recKey] = {
      charId: target.charId,
      bossId: editingBossId,
      entryIndex: target.entryIndex,
      teamId: sharedTeamId,
      isCompleted: oldRecord ? oldRecord.isCompleted : false,
      shardMode: (oldRecord && oldRecord.shardMode !== undefined) ? oldRecord.shardMode : 'shares',
      shardShares: (oldRecord && oldRecord.shardShares !== undefined) ? oldRecord.shardShares : null,
      lastWeekShardShares: (oldRecord && oldRecord.lastWeekShardShares !== undefined) ? oldRecord.lastWeekShardShares : null,
      shardQuantity: (oldRecord && oldRecord.shardQuantity !== undefined) ? oldRecord.shardQuantity : null,
      lastWeekShardQuantity: (oldRecord && oldRecord.lastWeekShardQuantity !== undefined) ? oldRecord.lastWeekShardQuantity : null
    };
  });

  // 4. 清理：這次牽涉到的所有舊隊伍成員（聯集），如果最後沒有留在新隊伍裡，恢復成他們的單人預設隊伍
  //    （用聯集而非只看 editingCharId 自己的舊隊伍，才不會漏掉像 B 這種「被間接牽連但沒被看到」的成員）
  const unionOldMap = new Map();
  oldTeamsByTarget.forEach(members => {
    members.forEach(m => unionOldMap.set(targetKey(m), m));
  });

  const removedTargets = Array.from(unionOldMap.values()).filter(oldT => !finalMap.has(targetKey(oldT)));

  removedTargets.forEach(target => {
    if (target.charId.startsWith("guest_")) return;
    const defaultTeamId = `single_${target.charId}_${editingBossId}_${target.entryIndex}`;
    const recKey = `rec_${target.charId}_${editingBossId}_${target.entryIndex}`;
    const oldRecord = window.store.weeklyRecords[recKey];

    window.store.teams[defaultTeamId] = {
      id: defaultTeamId,
      memberTargets: [{ charId: target.charId, entryIndex: target.entryIndex }],
      memberCharIds: [target.charId]
    };

    window.store.weeklyRecords[recKey] = {
      charId: target.charId,
      bossId: editingBossId,
      entryIndex: target.entryIndex,
      teamId: defaultTeamId,
      isCompleted: oldRecord ? oldRecord.isCompleted : false,
      shardMode: (oldRecord && oldRecord.shardMode !== undefined) ? oldRecord.shardMode : 'shares',
      shardShares: (oldRecord && oldRecord.shardShares !== undefined) ? oldRecord.shardShares : null,
      lastWeekShardShares: (oldRecord && oldRecord.lastWeekShardShares !== undefined) ? oldRecord.lastWeekShardShares : null,
      shardQuantity: (oldRecord && oldRecord.shardQuantity !== undefined) ? oldRecord.shardQuantity : null,
      lastWeekShardQuantity: (oldRecord && oldRecord.lastWeekShardQuantity !== undefined) ? oldRecord.lastWeekShardQuantity : null
    };
  });

  saveStoreToCloud();
  renderApp();
  closePartyModal();

  if (autoMergedNames.length > 0) {
    alert(`已自動將以下隊友一併加入隊伍：${autoMergedNames.join(", ")}`);
  }
}

function closePartyModal() {
  document.getElementById("partyModal").style.display = "none";
  const listContainer = document.getElementById("partySelectList");
  if (listContainer) listContainer.innerHTML = "";
  const guestContainer = document.getElementById("guestSelectList");
  if (guestContainer) guestContainer.innerHTML = "";
  const teamsContainer = document.getElementById("existingTeamsList");
  if (teamsContainer) teamsContainer.innerHTML = "";
}
