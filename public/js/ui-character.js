/**
 * ui-character.js
 * Contains: openAddCharacterModal, closeAddCharacterModal, submitNewCharacter, openRenameCharModal, closeRenameCharModal, submitRenameChar, openEditCharBossesModal, handleCharBossCheckboxLimit, updateCharBossCountDisplay, closeEditCharBossesModal, saveEditCharBosses
 */

// ==========================================
// 角色管理（新增 / 重新命名）
// ==========================================
window.openAddCharacterModal = function() {
  const modal = document.getElementById("addCharacterModal");
  const playerSelect = document.getElementById("newCharPlayerSelect");
  const bossListContainer = document.getElementById("newCharBossList");
  const nameInput = document.getElementById("newCharNameInput");

  if (!modal || !playerSelect || !bossListContainer) return;

  nameInput.value = "";

  playerSelect.innerHTML = "";
  const primaryUser = getPrimaryUser();
  if (window.config.players && Array.isArray(window.config.players)) {
    window.config.players.forEach(p => {
      const isSelected = p.name === primaryUser ? "selected" : "";
      playerSelect.innerHTML += `<option value="${p.name}" ${isSelected}>👤 ${p.name}</option>`;
    });
  }

  bossListContainer.innerHTML = "";
  if (window.config.bosses && Array.isArray(window.config.bosses)) {
    const reversedBosses = window.config.bosses.slice().reverse();
    reversedBosses.forEach(boss => {
      bossListContainer.innerHTML += `
        <label style="font-size: 13px; display: flex; align-items: center; gap: 6px; cursor: pointer; color: #334155 !important;">
          <input type="checkbox" class="new-char-boss-checkbox" value="${boss.id}" onchange="handleCharBossCheckboxLimit(this, '.new-char-boss-checkbox', 'newCharBossCount')" />
          ${boss.name}
        </label>
      `;
    });
  }
  updateCharBossCountDisplay('.new-char-boss-checkbox', 'newCharBossCount');

  modal.style.display = "flex";
};

window.closeAddCharacterModal = function() {
  const modal = document.getElementById("addCharacterModal");
  if (modal) modal.style.display = "none";
};

window.submitNewCharacter = function() {
  const playerName = document.getElementById("newCharPlayerSelect").value;
  const charName = document.getElementById("newCharNameInput").value.trim();

  if (!charName) {
    alert("請輸入角色名稱！");
    return;
  }

  const selectedBossIds = [];
  const checkboxes = document.querySelectorAll(".new-char-boss-checkbox:checked");
  checkboxes.forEach(cb => selectedBossIds.push(cb.value));

  if (selectedBossIds.length > 12) {
    alert(`最多只能選擇 12 隻 BOSS！(目前勾選了 ${selectedBossIds.length} 隻)`);
    return;
  }

  const playerIndex = window.config.players.findIndex(p => p.name === playerName);
  if (playerIndex === -1) {
    alert("找不到對應的玩家！");
    return;
  }

  const newCharId = `char_p${playerIndex + 1}_${Date.now()}`;

  const newCharacter = {
    id: newCharId,
    name: charName,
    bossIds: selectedBossIds,
    resetBossIds: []
  };

  if (!window.config.players[playerIndex].characters) {
    window.config.players[playerIndex].characters = [];
  }
  window.config.players[playerIndex].characters.push(newCharacter);

  if (window.db && window.dbRef && window.dbSet) {
    const playersRef = window.dbRef(window.db, 'players');
    window.dbSet(playersRef, window.config.players)
      .then(() => {
        alert(`成功為 ${playerName} 新增角色：${charName}！`);
        window.closeAddCharacterModal();
      })
      .catch(err => {
        console.error("Firebase 寫入失敗：", err);
        alert("新增失敗，請檢查權限或網路連線。");
      });
  } else {
    console.error("Firebase 實例未成功初始化 (window.db/dbSet 未載入)");
    alert("資料庫連線失敗，請重新整理頁面。");
  }
};

let renamingCharId = null;

window.openRenameCharModal = function(charId, currentName) {
  renamingCharId = charId;
  const input = document.getElementById("renameCharInput");
  if (input) {
    input.value = currentName;
    input.select();
  }
  document.getElementById("renameCharModal").style.display = "flex";
  setTimeout(() => { if (input) input.focus(); }, 50);
};

window.closeRenameCharModal = function() {
  document.getElementById("renameCharModal").style.display = "none";
  renamingCharId = null;
};

window.submitRenameChar = function() {
  const newName = document.getElementById("renameCharInput").value.trim();
  if (!newName) {
    alert("請輸入新的角色名稱！");
    return;
  }
  if (!renamingCharId) return;

  let updated = false;
  window.config.players.forEach(p => {
    p.characters.forEach(c => {
      if (c.id === renamingCharId) {
        c.name = newName;
        updated = true;
      }
    });
  });

  if (!updated) {
    alert("找不到該角色，更新失敗！");
    return;
  }

  if (window.db && window.dbRef && window.dbSet) {
    const playersRef = window.dbRef(window.db, 'players');
    window.dbSet(playersRef, window.config.players)
      .then(() => { window.closeRenameCharModal(); })
      .catch(err => {
        console.error("Firebase 寫入失敗：", err);
        alert("更新失敗，請檢查權限或網路連線。");
      });
  }
};
// ==========================================
// 編輯角色 BOSS 清單邏輯
// ==========================================
let currentEditingCharId = null;

window.openEditCharBossesModal = function(charId) {
  currentEditingCharId = charId;
  const modal = document.getElementById("editCharBossesModal");
  const titleEl = document.getElementById("editCharTitle");
  const bossListContainer = document.getElementById("editCharBossList");
  if (!modal || !bossListContainer) return;

  let targetChar = null;
  if (window.config.players) {
    for (const player of window.config.players) {
      if (player.characters) {
        const found = player.characters.find(c => c.id === charId);
        if (found) { targetChar = found; break; }
      }
    }
  }
  if (!targetChar) { alert("找不到該角色資料！"); return; }

  titleEl.innerText = `✏️ 編輯 ${targetChar.name} 的 BOSS 清單`;
  const reservedCount = targetChar.resetBossIds ? targetChar.resetBossIds.length : 0;

  bossListContainer.innerHTML = "";
  if (window.config.bosses && Array.isArray(window.config.bosses)) {
    window.config.bosses.forEach(boss => {
      const isChecked = targetChar.bossIds && targetChar.bossIds.includes(boss.id);
      bossListContainer.innerHTML += `
        <label style="font-size: 13px; display: flex; align-items: center; gap: 6px; cursor: pointer; color: #334155 !important;">
          <input type="checkbox" class="edit-char-boss-checkbox" value="${boss.id}" ${isChecked ? 'checked' : ''} onchange="handleCharBossCheckboxLimit(this, '.edit-char-boss-checkbox', 'editCharBossCount', ${reservedCount})" />
          ${boss.name}
        </label>
      `;
    });
  }
  updateCharBossCountDisplay('.edit-char-boss-checkbox', 'editCharBossCount', reservedCount);
  modal.style.display = "flex";
};

window.handleCharBossCheckboxLimit = function(checkbox, selector, countSpanId, reservedCount) {
  reservedCount = reservedCount || 0;
  const checked = document.querySelectorAll(`${selector}:checked`);
  if (checked.length + reservedCount > 12) {
    const reservedNote = reservedCount > 0 ? `（含已設定重置券的 ${reservedCount} 隻）` : "";
    alert(`最多只能選擇 12 隻 BOSS！${reservedNote}`);
    checkbox.checked = false;
  }
  updateCharBossCountDisplay(selector, countSpanId, reservedCount);
};

window.updateCharBossCountDisplay = function(selector, countSpanId, reservedCount) {
  reservedCount = reservedCount || 0;
  const span = document.getElementById(countSpanId);
  if (!span) return;
  const checkedCount = document.querySelectorAll(`${selector}:checked`).length;
  const totalCount = checkedCount + reservedCount;
  const reservedNote = reservedCount > 0 ? `，含重置券 ${reservedCount}` : "";
  span.innerText = `(已選 ${checkedCount} / 12${reservedNote})`;
  span.style.color = totalCount >= 12 ? '#e11d48' : '#64748b';
};

window.closeEditCharBossesModal = function() {
  const modal = document.getElementById("editCharBossesModal");
  if (modal) modal.style.display = "none";
  currentEditingCharId = null;
};

window.saveEditCharBosses = function() {
  if (!currentEditingCharId) return;

  const selectedBossIds = [];
  const checkboxes = document.querySelectorAll(".edit-char-boss-checkbox:checked");
  checkboxes.forEach(cb => selectedBossIds.push(cb.value));

  let targetChar = null;
  if (window.config.players) {
    for (const player of window.config.players) {
      if (player.characters) {
        const found = player.characters.find(c => c.id === currentEditingCharId);
        if (found) { targetChar = found; break; }
      }
    }
  }

  const reservedCount = targetChar && targetChar.resetBossIds ? targetChar.resetBossIds.length : 0;
  if (selectedBossIds.length + reservedCount > 12) {
    const reservedNote = reservedCount > 0 ? `（含已設定重置券的 ${reservedCount} 隻）` : "";
    alert(`最多只能選擇 12 隻 BOSS！${reservedNote}(目前勾選了 ${selectedBossIds.length} 隻)`);
    return;
  }

  let updated = false;
  if (targetChar) {
    targetChar.bossIds = selectedBossIds;
    if (targetChar.resetBossIds) {
      const selectedGroupKeys = new Set(selectedBossIds.map(bId => getBossGroupKey(bId)));
      targetChar.resetBossIds = targetChar.resetBossIds.filter(bId => selectedGroupKeys.has(getBossGroupKey(bId)));
    }
    updated = true;
  }

  if (!updated) { alert("更新失敗，找不到該角色！"); return; }

  if (window.db && window.dbRef && window.dbSet) {
    const playersRef = window.dbRef(window.db, 'players');
    window.dbSet(playersRef, window.config.players)
      .then(() => { alert("BOSS 清單更新成功！"); window.closeEditCharBossesModal(); })
      .catch(err => { console.error("Firebase 寫入失敗：", err); alert("更新失敗，請檢查權限或網路。"); });
  }
};
