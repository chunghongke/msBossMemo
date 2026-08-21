/**
 * ui-character.js
 * Contains: openAddCharacterModal, closeAddCharacterModal, submitNewCharacter,
 *           openRenameCharModal, closeRenameCharModal, submitRenameChar,
 *           openEditCharBossesModal, toggleBossSelection, updateCharBossCountDisplay,
 *           closeEditCharBossesModal, saveEditCharBosses
 */

// ==========================================
// 角色管理（新增 / 重新命名）
// ==========================================
window.openAddCharacterModal = function() {
  const primaryUser = typeof getPrimaryUser === 'function' ? getPrimaryUser() : '';
  if (!primaryUser) {
    alert("⚠️ 請先選擇/登入主要玩家！");
    if (typeof openAuthModal === 'function') openAuthModal();
    return;
  }

  const modal = document.getElementById("addCharacterModal");
  const playerSelect = document.getElementById("newCharPlayerSelect");
  const bossListContainer = document.getElementById("newCharBossList");
  const nameInput = document.getElementById("newCharNameInput");

  if (!modal || !playerSelect || !bossListContainer) return;

  nameInput.value = "";

  // 鎖定只能為當前登入的主要玩家新增角色
  playerSelect.innerHTML = `<option value="${primaryUser}" selected>👤 ${primaryUser} (自己)</option>`;
  playerSelect.disabled = true;

  bossListContainer.innerHTML = "";

  if (window.config.bosses && Array.isArray(window.config.bosses)) {
    // 依據 getBossGroupKey 進行分組
    const groupMap = new Map();
    window.config.bosses.forEach(boss => {
      const gKey = getBossGroupKey(boss.id);
      if (!groupMap.has(gKey)) {
        const cleanName = boss.name.replace(/^\([^)]+\)\s*/, "");
        groupMap.set(gKey, { id: gKey, name: cleanName, bosses: [] });
      }
      groupMap.get(gKey).bosses.push(boss);
    });

    // 渲染分組卡片
    groupMap.forEach((group, groupKey) => {
      let buttonsHtml = "";
      group.bosses.forEach(boss => {
        const difficulty = boss.difficulty || "normal";
        const dc = getDifficultyColor(difficulty);
        const inactiveStyle = `background: ${dc.bg}; color: ${dc.textColor}; border: 2px solid ${dc.border}; opacity: 0.35;`;

        buttonsHtml += `
          <button type="button"
            class="new-char-boss-btn"
            data-boss-id="${boss.id}"
            data-group-key="${groupKey}"
            data-active="false"
            style="width: 32px; height: 32px; border-radius: 50%; cursor: pointer; font-size: 11px; font-weight: bold; transition: all 0.2s; ${inactiveStyle}"
            onclick="toggleNewCharBossSelection(this, '${boss.id}', '${groupKey}')"
            title="${boss.name}">
            ${dc.text}
          </button>
        `;
      });

      const cardHtml = `
        <div class="boss-card" style="display: flex; flex-direction: column; background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 10px; align-items: center; gap: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); transition: border-color 0.2s;">
          <div style="width: 100%; height: 70px; display: flex; justify-content: center; align-items: center; background: #0f172a; border-radius: 6px; overflow: hidden; position: relative;">
            <img src="./images/bosses/${groupKey}.png?v=1" onerror="this.src='./icon.png'" id="newCharImg_${groupKey}"
              style="max-width: 100%; max-height: 100%; object-fit: contain; filter: grayscale(100%); opacity: 0.4; transition: all 0.25s;" />
            <span style="position: absolute; bottom: 3px; font-size: 10px; font-weight: bold; color: #fff; text-shadow: 0 1px 3px rgba(0,0,0,0.9); white-space: nowrap; max-width: 95%; overflow: hidden; text-overflow: ellipsis;">${group.name}</span>
          </div>
          <div style="display: flex; gap: 5px; width: 100%; justify-content: center; flex-wrap: wrap;">
            ${buttonsHtml}
          </div>
        </div>
      `;
      bossListContainer.innerHTML += cardHtml;
    });
  }

  updateNewCharBossCount();
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
  const activeButtons = document.querySelectorAll(".new-char-boss-btn[data-active='true']");
  activeButtons.forEach(btn => selectedBossIds.push(btn.getAttribute("data-boss-id")));

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
    const playersRef = window.dbRef(window.db, '/players');
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

// ==========================================
// 新增角色 BOSS 選取切換（圖片卡片版）
// ==========================================
window.toggleNewCharBossSelection = function(btn, bossId, groupKey) {
  const isActive = btn.getAttribute("data-active") === "true";

  function activateNewBtn(b) {
    const bid = b.getAttribute("data-boss-id");
    let diff = "normal";
    if (bid.endsWith("_easy")) diff = "easy";
    else if (bid.endsWith("_hard")) diff = "hard";
    else if (bid.endsWith("_extreme")) diff = "extreme";
    const dc = getDifficultyColor(diff);
    b.setAttribute("data-active", "true");
    b.style.cssText = `width: 32px; height: 32px; border-radius: 50%; cursor: pointer; font-size: 11px; font-weight: bold; transition: all 0.2s; background: ${dc.bg}; color: ${dc.textColor}; border: 2px solid ${dc.border}; box-shadow: 0 0 8px ${dc.shadow}; transform: scale(1.1);`;
  }

  function deactivateNewBtn(b) {
    const bid = b.getAttribute("data-boss-id");
    let diff = "normal";
    if (bid.endsWith("_easy")) diff = "easy";
    else if (bid.endsWith("_hard")) diff = "hard";
    else if (bid.endsWith("_extreme")) diff = "extreme";
    const dc = getDifficultyColor(diff);
    b.setAttribute("data-active", "false");
    b.style.cssText = `width: 32px; height: 32px; border-radius: 50%; cursor: pointer; font-size: 11px; font-weight: bold; transition: all 0.2s; background: ${dc.bg}; color: ${dc.textColor}; border: 2px solid ${dc.border}; opacity: 0.35;`;
  }

  if (!isActive) {
    // 同 group 內是否已有選取
    const sameGroupActiveBtns = document.querySelectorAll(`.new-char-boss-btn[data-group-key="${groupKey}"][data-active="true"]`);
    if (sameGroupActiveBtns.length > 0) {
      // 同 group 直接切換難度
      sameGroupActiveBtns.forEach(b => deactivateNewBtn(b));
      activateNewBtn(btn);
    } else {
      // 全新 group：檢查 12 隻上限
      const currentCount = document.querySelectorAll(".new-char-boss-btn[data-active='true']").length;
      if (currentCount >= 12) {
        alert("最多只能選擇 12 隻 BOSS！");
        return;
      }
      activateNewBtn(btn);
    }
  } else {
    deactivateNewBtn(btn);
  }

  // 圖片亮度連動
  const groupActiveBtns = document.querySelectorAll(`.new-char-boss-btn[data-group-key="${groupKey}"][data-active="true"]`);
  const img = document.getElementById(`newCharImg_${groupKey}`);
  if (img) {
    if (groupActiveBtns.length > 0) {
      img.style.filter = "none";
      img.style.opacity = "1";
    } else {
      img.style.filter = "grayscale(100%)";
      img.style.opacity = "0.4";
    }
  }

  updateNewCharBossCount();
};

window.updateNewCharBossCount = function() {
  const span = document.getElementById("newCharBossCount");
  if (!span) return;
  const count = document.querySelectorAll(".new-char-boss-btn[data-active='true']").length;
  span.innerText = `(已選 ${count} / 12)`;
  span.style.color = count >= 12 ? '#e11d48' : '#64748b';
};

// ==========================================
// 重新命名角色
// ==========================================
let renamingCharId = null;

window.openRenameCharModal = function(charId, currentName) {
  const primaryUser = typeof getPrimaryUser === 'function' ? getPrimaryUser() : '';
  const allChars = typeof getAllCharacters === 'function' ? getAllCharacters() : [];
  const char = allChars.find(c => c.id === charId);
  if (!char || char.playerName !== primaryUser) {
    alert("⚠️ 您只能修改自己角色的名稱！");
    return;
  }

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
    (p.characters || []).forEach(c => {
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
    const playersRef = window.dbRef(window.db, '/players');
    window.dbSet(playersRef, window.config.players)
      .then(() => { window.closeRenameCharModal(); })
      .catch(err => {
        console.error("Firebase 寫入失敗：", err);
        alert("更新失敗，請檢查權限或網路連線。");
      });
  }
};

// ==========================================
// 編輯角色 BOSS 清單（圖片卡片 + 圓形難度按鈕）
// ==========================================
let currentEditingCharId = null;

// 難度色彩輔助函式 (依遊戲難度配色)
function getDifficultyColor(difficulty) {
  switch (difficulty) {
    case 'easy':
      return { text: '簡', bg: '#4a9ec8', border: '#6bb8e0', textColor: '#fff', shadow: 'rgba(74, 158, 200, 0.6)' };
    case 'normal':
      return { text: '普', bg: '#2e4f6a', border: '#3d6a8a', textColor: '#fff', shadow: 'rgba(46, 79, 106, 0.6)' };
    case 'hard':
      return { text: '困', bg: '#7a1840', border: '#a02055', textColor: '#fff', shadow: 'rgba(122, 24, 64, 0.6)' };
    case 'extreme':
      return { text: '極', bg: '#0f0f1a', border: '#e84020', textColor: '#e84020', shadow: 'rgba(232, 64, 32, 0.7)' };
    default:
      return { text: '普', bg: '#2e4f6a', border: '#3d6a8a', textColor: '#fff', shadow: 'rgba(46, 79, 106, 0.6)' };
  }
}
window.getDifficultyColor = getDifficultyColor;

window.openEditCharBossesModal = function(charId) {
  const primaryUser = typeof getPrimaryUser === 'function' ? getPrimaryUser() : '';
  const allChars = typeof getAllCharacters === 'function' ? getAllCharacters() : [];
  const char = allChars.find(c => c.id === charId);
  if (!char || char.playerName !== primaryUser) {
    alert("⚠️ 您只能編輯自己角色的 BOSS 清單！");
    return;
  }

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

  if (titleEl) titleEl.innerText = `✏️ 編輯 ${targetChar.name} 的 BOSS 清單`;
  const reservedCount = targetChar.resetBossIds ? targetChar.resetBossIds.length : 0;

  bossListContainer.innerHTML = "";

  if (window.config.bosses && Array.isArray(window.config.bosses)) {
    // 依據 getBossGroupKey 進行分組
    const groupMap = new Map();
    window.config.bosses.forEach(boss => {
      const gKey = getBossGroupKey(boss.id);
      if (!groupMap.has(gKey)) {
        // 取 boss 名稱，移除難度前綴如 "(簡)"
        const cleanName = boss.name.replace(/^\([^)]+\)\s*/, "");
        groupMap.set(gKey, {
          id: gKey,
          name: cleanName,
          bosses: []
        });
      }
      groupMap.get(gKey).bosses.push(boss);
    });

    // 渲染分組卡片
    groupMap.forEach((group, groupKey) => {
      const hasCheckedBoss = group.bosses.some(boss =>
        targetChar.bossIds && targetChar.bossIds.includes(boss.id)
      );

      let buttonsHtml = "";
      group.bosses.forEach(boss => {
        const isChecked = targetChar.bossIds && targetChar.bossIds.includes(boss.id);
        const difficulty = boss.difficulty || "normal";
        const dc = getDifficultyColor(difficulty);

        // 圓形按鈕樣式 (選中：實心底色；未選中：半透明+邊框)
        const activeStyle = `background: ${dc.bg}; color: ${dc.textColor}; border: 2px solid ${dc.border}; box-shadow: 0 0 8px ${dc.shadow}; transform: scale(1.1);`;
        const inactiveStyle = `background: ${dc.bg}; color: ${dc.textColor}; border: 2px solid ${dc.border}; opacity: 0.35;`;

        buttonsHtml += `
          <button type="button"
            class="edit-char-boss-btn"
            data-boss-id="${boss.id}"
            data-group-key="${groupKey}"
            data-active="${isChecked ? 'true' : 'false'}"
            style="width: 32px; height: 32px; border-radius: 50%; cursor: pointer; font-size: 11px; font-weight: bold; transition: all 0.2s; ${isChecked ? activeStyle : inactiveStyle}"
            onclick="toggleBossSelection(this, '${boss.id}', '${groupKey}', ${reservedCount})"
            title="${boss.name}">
            ${dc.text}
          </button>
        `;
      });

      const cardHtml = `
        <div class="boss-card" style="display: flex; flex-direction: column; background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 10px; align-items: center; gap: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); transition: border-color 0.2s;">
          <div style="width: 100%; height: 70px; display: flex; justify-content: center; align-items: center; background: #0f172a; border-radius: 6px; overflow: hidden; position: relative;">
            <img src="./images/bosses/${groupKey}.png?v=1" onerror="this.src='./icon.png'" id="img_${groupKey}"
              style="max-width: 100%; max-height: 100%; object-fit: contain; filter: ${hasCheckedBoss ? 'none' : 'grayscale(100%)'}; opacity: ${hasCheckedBoss ? '1' : '0.4'}; transition: all 0.25s;" />
            <span style="position: absolute; bottom: 3px; font-size: 10px; font-weight: bold; color: #fff; text-shadow: 0 1px 3px rgba(0,0,0,0.9); white-space: nowrap; max-width: 95%; overflow: hidden; text-overflow: ellipsis;">${group.name}</span>
          </div>
          <div style="display: flex; gap: 5px; width: 100%; justify-content: center; flex-wrap: wrap;">
            ${buttonsHtml}
          </div>
        </div>
      `;
      bossListContainer.innerHTML += cardHtml;
    });
  }

  updateCharBossCountDisplay(reservedCount);
  modal.style.display = "flex";
};

window.toggleBossSelection = function(btn, bossId, groupKey, reservedCount) {
  reservedCount = reservedCount || 0;
  const isActive = btn.getAttribute("data-active") === "true";

  // 輔助：將按鈕設為啟用樣式
  function activateBtn(b) {
    const bid = b.getAttribute("data-boss-id");
    let diff = "normal";
    if (bid.endsWith("_easy")) diff = "easy";
    else if (bid.endsWith("_hard")) diff = "hard";
    else if (bid.endsWith("_extreme")) diff = "extreme";
    const dc = getDifficultyColor(diff);
    b.setAttribute("data-active", "true");
    b.style.cssText = `width: 32px; height: 32px; border-radius: 50%; cursor: pointer; font-size: 11px; font-weight: bold; transition: all 0.2s; background: ${dc.bg}; color: ${dc.textColor}; border: 2px solid ${dc.border}; box-shadow: 0 0 8px ${dc.shadow}; transform: scale(1.1);`;
  }

  // 輔助：將按鈕設為未啟用樣式
  function deactivateBtn(b) {
    const bid = b.getAttribute("data-boss-id");
    let diff = "normal";
    if (bid.endsWith("_easy")) diff = "easy";
    else if (bid.endsWith("_hard")) diff = "hard";
    else if (bid.endsWith("_extreme")) diff = "extreme";
    const dc = getDifficultyColor(diff);
    b.setAttribute("data-active", "false");
    b.style.cssText = `width: 32px; height: 32px; border-radius: 50%; cursor: pointer; font-size: 11px; font-weight: bold; transition: all 0.2s; background: ${dc.bg}; color: ${dc.textColor}; border: 2px solid ${dc.border}; opacity: 0.35;`;
  }

  if (!isActive) {
    // 檢查同 group 內是否已有選取的難度
    const sameGroupActiveBtns = document.querySelectorAll(`.edit-char-boss-btn[data-group-key="${groupKey}"][data-active="true"]`);

    if (sameGroupActiveBtns.length > 0) {
      // 同 group 難度切換：取消舊的，啟用新的，不計上限
      sameGroupActiveBtns.forEach(b => deactivateBtn(b));
      activateBtn(btn);
    } else {
      // 全新 group：檢查 12 隻上限
      const currentActiveCount = document.querySelectorAll(".edit-char-boss-btn[data-active='true']").length;
      if (currentActiveCount + reservedCount >= 12) {
        const reservedNote = reservedCount > 0 ? `（含已設定重置券的 ${reservedCount} 隻）` : "";
        alert(`最多只能選擇 12 隻 BOSS！${reservedNote}`);
        return;
      }
      activateBtn(btn);
    }
  } else {
    // 取消選取
    deactivateBtn(btn);
  }

  // 頭像亮度連動
  const groupBtns = document.querySelectorAll(`.edit-char-boss-btn[data-group-key="${groupKey}"][data-active="true"]`);
  const img = document.getElementById(`img_${groupKey}`);
  if (img) {
    if (groupBtns.length > 0) {
      img.style.filter = "none";
      img.style.opacity = "1";
    } else {
      img.style.filter = "grayscale(100%)";
      img.style.opacity = "0.4";
    }
  }

  updateCharBossCountDisplay(reservedCount);
};

// 原有 checkbox-limit 函式保留（供新增角色 Modal 使用）
window.handleCharBossCheckboxLimit = function(checkbox, selector, countSpanId, reservedCount) {
  reservedCount = reservedCount || 0;
  const checked = document.querySelectorAll(`${selector}:checked`);
  if (checked.length + reservedCount > 12) {
    const reservedNote = reservedCount > 0 ? `（含已設定重置券的 ${reservedCount} 隻）` : "";
    alert(`最多只能選擇 12 隻 BOSS！${reservedNote}`);
    checkbox.checked = false;
  }
  if (countSpanId) {
    const span = document.getElementById(countSpanId);
    if (span) {
      const checkedCount = document.querySelectorAll(`${selector}:checked`).length;
      span.innerText = `(已選 ${checkedCount} / 12)`;
    }
  }
};

window.updateCharBossCountDisplay = function(reservedCount) {
  reservedCount = reservedCount || 0;
  const span = document.getElementById("editCharBossCount");
  if (!span) return;
  const checkedCount = document.querySelectorAll(".edit-char-boss-btn[data-active='true']").length;
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
  const activeButtons = document.querySelectorAll(".edit-char-boss-btn[data-active='true']");
  activeButtons.forEach(btn => selectedBossIds.push(btn.getAttribute("data-boss-id")));

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
    const playersRef = window.dbRef(window.db, '/players');
    window.dbSet(playersRef, window.config.players)
      .then(() => {
        renderApp();
        closeEditCharBossesModal();
      })
      .catch(err => {
        console.error("Firebase 寫入失敗：", err);
        alert("更新失敗，請檢查權限或網路。");
      });
  } else {
    renderApp();
    closeEditCharBossesModal();
  }
};
