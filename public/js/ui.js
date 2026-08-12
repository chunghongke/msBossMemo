/**
 * ui.js
 * 複製自 index.html 主 <script> 區塊（L3203–3896）與第三個 <script>（L4200–4220）
 * 涵蓋：togglePlayerCollapse、toggleAllPlayers、getPrimaryUser、changePrimaryUser、
 *       updateUserSelectOptions、handleOverlayClick、角色新增/重新命名、玩家新增/頭像、
 *       主題切換（applyThemeImmediately/toggleTheme）、updatePartyCheckboxStates、
 *       getPlayerOrder/savePlayerOrder、getCollapsedPlayerKeys/saveCollapsedPlayerKeys、
 *       initDragAndDrop、updateResetTimer、checkWeeklyResetPeriodically、
 *       setupModalScrollLock IIFE
 *
 * ⚠️  目前 index.html 仍保留原本的 script，此檔案僅為備份/拆分準備。
 *
 * 依賴（未來切換時需在此檔案之前載入）：
 *   - app-core.js（checkAndPerformWeeklyReset、saveStoreToCloud、renderApp 等）
 *   - schedule.js（initNotificationSystem）
 */

// ==========================================
// 玩家區塊收合 / 展開
// ==========================================
function togglePlayerCollapse(playerId) {
  const card = document.getElementById(`player-card-${playerId}`);
  const icon = document.getElementById(`collapse-icon-${playerId}`);

  if (!card) return;
  const isCollapsed = card.classList.toggle("is-collapsed");
  if (icon) {
    icon.innerText = isCollapsed ? "▲ 展開" : "▼ 收合";
  }

  const collapseKey = card.dataset.collapseKey;
  if (collapseKey) {
    const collapsedKeys = getCollapsedPlayerKeys().filter(k => k !== collapseKey);
    if (isCollapsed) collapsedKeys.push(collapseKey);
    saveCollapsedPlayerKeys(collapsedKeys);
  }
}

function toggleAllPlayers(shouldCollapse) {
  const cards = document.querySelectorAll('.player-card');
  const collapsedKeys = [];
  cards.forEach(card => {
    if (shouldCollapse) {
      card.classList.add('is-collapsed');
    } else {
      card.classList.remove('is-collapsed');
    }

    const icon = card.querySelector('.collapse-icon');
    if (icon) {
      icon.innerText = shouldCollapse ? "▲ 展開" : "▼ 收合";
    }

    if (shouldCollapse && card.dataset.collapseKey) {
      collapsedKeys.push(card.dataset.collapseKey);
    }
  });

  saveCollapsedPlayerKeys(collapsedKeys);
}

// ==========================================
// 主要玩家選擇
// ==========================================
function getPrimaryUser() {
  return localStorage.getItem("preferred_primary_user") || "";
}

function changePrimaryUser(userName) {
  localStorage.setItem("preferred_primary_user", userName);
  renderApp();
}

function updateUserSelectOptions() {
  const select = document.getElementById("userSelect");
  if (!select) return;

  const currentPrimary = getPrimaryUser();
  select.innerHTML = `<option value="">-- 不排序 (預設) --</option>`;

  if (window.config.players && Array.isArray(window.config.players)) {
    window.config.players.forEach(p => {
      if (p && p.name) {
        const isSelected = p.name === currentPrimary ? 'selected' : '';
        const avatar = p.avatarEmoji || '👤';
        select.innerHTML += `<option value="${p.name}" ${isSelected}>${avatar} ${p.name}</option>`;
      }
    });
  }
}

function handleOverlayClick(event, closeFunction) {
  if (event.target === event.currentTarget) {
    if (typeof closeFunction === 'function') {
      closeFunction();
    }
  }
}

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
// 主題切換
// ==========================================
(function applyThemeImmediately() {
  const savedTheme = localStorage.getItem("theme");
  const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;

  if (savedTheme === "dark" || (!savedTheme && prefersDark)) {
    document.documentElement.classList.add("dark-mode");
  } else {
    document.documentElement.classList.remove("dark-mode");
  }
})();

window.toggleTheme = function() {
  const isDark = document.documentElement.classList.toggle("dark-mode");
  localStorage.setItem("theme", isDark ? "dark" : "light");
  updateThemeButton(isDark);
};

function updateThemeButton(isDark) {
  const iconEl = document.getElementById("themeIcon");
  const textEl = document.getElementById("themeText");
  if (iconEl && textEl) {
    iconEl.innerText = isDark ? "☀️" : "🌙";
    textEl.innerText = isDark ? "淺色模式" : "深色模式";
  }
}

document.addEventListener("DOMContentLoaded", function() {
  const isDark = document.documentElement.classList.contains("dark-mode");
  updateThemeButton(isDark);
  initNotificationSystem();
});

// ==========================================
// 玩家管理（新增玩家 / 頭像）
// ==========================================
function openAddPlayerModal() {
  document.getElementById("newPlayerName").value = "";
  document.getElementById("addPlayerModal").style.display = "flex";
}

function closeAddPlayerModal() {
  document.getElementById("addPlayerModal").style.display = "none";
}

function isSingleEmoji(str) {
  const trimmed = (str || "").trim();
  if (!trimmed) return false;

  const emojiCharPattern = /^(\p{Extended_Pictographic}|\p{Emoji_Presentation}|[\u200D\uFE0F\u{1F3FB}-\u{1F3FF}\u2640\u2642])+$/u;
  if (!emojiCharPattern.test(trimmed)) return false;

  if (typeof Intl !== "undefined" && Intl.Segmenter) {
    const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
    return Array.from(segmenter.segment(trimmed)).length === 1;
  }

  return true;
}

const DEFAULT_AVATAR_EMOJIS = [
  '⚔️', '🛡️', '🏹', '🔮', '👑', '🧙', '🧙‍♀️', '🥷', '🐉', '🦄',
  '🐱', '🦊', '🗡️', '🏆', '💎', '🔥', '⭐', '🌙', '🍀', '🎯', '🎮'
];

function renderAvatarEmojiGrid() {
  const grid = document.getElementById("avatarEmojiGrid");
  if (!grid) return;

  const allEmojis = [...DEFAULT_AVATAR_EMOJIS, ...getCustomAvatarEmojis()];

  grid.innerHTML = allEmojis
    .map(emoji => `<button type="button" class="avatar-emoji-option" onclick="selectAvatarEmoji('${emoji}')">${emoji}</button>`)
    .join("");
}

let editingAvatarPlayerName = null;

function openAvatarPickerModal(playerName) {
  editingAvatarPlayerName = playerName;
  renderAvatarEmojiGrid();
  const player = window.config.players.find(p => p.name === playerName);
  const input = document.getElementById("avatarEmojiInput");
  input.value = (player && player.avatarEmoji) || "";
  document.getElementById("avatarEmojiError").innerText = "";
  document.getElementById("avatarSaveAsDefaultCheckbox").checked = false;
  document.getElementById("avatarSaveBtn").disabled = !isSingleEmoji(input.value);
  document.getElementById("avatarPickerModal").style.display = "flex";
}

function closeAvatarPickerModal() {
  document.getElementById("avatarPickerModal").style.display = "none";
  editingAvatarPlayerName = null;
}

function selectAvatarEmoji(emoji) {
  const input = document.getElementById("avatarEmojiInput");
  input.value = emoji;
  validateAvatarInput();
}

function validateAvatarInput() {
  const input = document.getElementById("avatarEmojiInput");
  const errorEl = document.getElementById("avatarEmojiError");
  const saveBtn = document.getElementById("avatarSaveBtn");
  const value = input.value;

  if (!value.trim()) {
    errorEl.innerText = "";
    saveBtn.disabled = true;
    return;
  }

  if (isSingleEmoji(value)) {
    errorEl.innerText = "";
    saveBtn.disabled = false;
  } else {
    errorEl.innerText = "⚠️ 請輸入剛好一個表情符號（不能是文字或多個字元）";
    saveBtn.disabled = true;
  }
}

function useDefaultAvatarEmoji() {
  const input = document.getElementById("avatarEmojiInput");
  input.value = "";
  document.getElementById("avatarEmojiError").innerText = "";
  document.getElementById("avatarSaveAsDefaultCheckbox").checked = false;
  document.getElementById("avatarSaveBtn").disabled = false;
}

async function saveAvatarEmoji() {
  const input = document.getElementById("avatarEmojiInput");
  const value = input.value.trim();

  if (value && !isSingleEmoji(value)) return;

  const player = window.config.players.find(p => p.name === editingAvatarPlayerName);
  if (!player) return;

  if (value) {
    player.avatarEmoji = value;
    const saveAsDefault = document.getElementById("avatarSaveAsDefaultCheckbox").checked;
    if (saveAsDefault) {
      addCustomAvatarEmoji(value);
    }
  } else {
    delete player.avatarEmoji;
  }

  try {
    const playersRef = window.dbRef(window.db, '/players');
    await window.dbSet(playersRef, window.config.players);
    closeAvatarPickerModal();
    renderApp();
  } catch (error) {
    console.error("寫入 Firebase 失敗：", error);
    alert("儲存頭像失敗，請稍後再試！");
  }
}

async function submitAddPlayer() {
  const playerName = document.getElementById("newPlayerName").value.trim();

  if (!playerName) {
    alert("請輸入玩家名稱！");
    return;
  }

  const currentPlayers = window.config.players || [];

  const isExist = currentPlayers.some(p => p.name === playerName);
  if (isExist) {
    alert("該玩家名稱已存在！");
    return;
  }

  const newPlayer = {
    name: playerName,
    characters: []
  };

  const updatedPlayers = [...currentPlayers, newPlayer];

  try {
    const playersRef = window.dbRef(window.db, '/players');
    await window.dbSet(playersRef, updatedPlayers);
    closeAddPlayerModal();
  } catch (error) {
    console.error("寫入 Firebase 失敗：", error);
    alert("新增玩家失敗，請稍後再試！");
  }
}

// ==========================================
// 組隊 modal 勾選狀態更新（達到上限時鎖定）
// ==========================================
function updatePartyCheckboxStates() {
  const boss = window.config.bosses.find(b => b.id === editingBossId);
  const maxPartySize = boss ? boss.maxPartySize : 1;

  const checkboxes = Array.from(document.querySelectorAll('input[name="partyChar"]'));
  const checkedCount = checkboxes.filter(cb => cb.checked).length;

  const warningEl = document.getElementById("partyLimitWarning");
  if (warningEl) {
    if (checkedCount >= maxPartySize) {
      warningEl.style.display = "inline-block";
    } else {
      warningEl.style.display = "none";
    }
  }

  checkboxes.forEach(cb => {
    const isSelf = cb.getAttribute('data-is-self') === 'true';

    if (isSelf) {
      cb.disabled = true;
      return;
    }

    const label = cb.closest('label');

    if (checkedCount >= maxPartySize) {
      if (!cb.checked) {
        cb.disabled = true;
        if (label) {
          label.style.opacity = '0.4';
          label.style.cursor = 'not-allowed';
        }
      } else {
        cb.disabled = false;
        if (label) {
          label.style.opacity = '1';
          label.style.cursor = 'pointer';
        }
      }
    } else {
      cb.disabled = false;
      if (label) {
        label.style.opacity = '1';
        label.style.cursor = 'pointer';
      }
    }
  });
}

// ==========================================
// LocalStorage 工具
// ==========================================
function getPlayerOrder() {
  const saved = localStorage.getItem("player_custom_order");
  return saved ? JSON.parse(saved) : [];
}

function savePlayerOrder(orderArray) {
  localStorage.setItem("player_custom_order", JSON.stringify(orderArray));
}

function getCustomAvatarEmojis() {
  const saved = localStorage.getItem("custom_avatar_emojis");
  return saved ? JSON.parse(saved) : [];
}

function addCustomAvatarEmoji(emoji) {
  const custom = getCustomAvatarEmojis();
  if (DEFAULT_AVATAR_EMOJIS.includes(emoji) || custom.includes(emoji)) return;
  custom.push(emoji);
  localStorage.setItem("custom_avatar_emojis", JSON.stringify(custom));
}

function getCharacterOrder(playerName) {
  const saved = localStorage.getItem(`character_custom_order_${playerName}`);
  return saved ? JSON.parse(saved) : [];
}

function saveCharacterOrder(playerName, orderArray) {
  localStorage.setItem(`character_custom_order_${playerName}`, JSON.stringify(orderArray));
}

function getCollapsedPlayerKeys() {
  const saved = localStorage.getItem("collapsed_player_cards");
  if (saved === null) {
    return ["guests"];
  }
  return JSON.parse(saved);
}

function saveCollapsedPlayerKeys(keysArray) {
  localStorage.setItem("collapsed_player_cards", JSON.stringify(keysArray));
}

// ==========================================
// 拖曳排序（玩家卡 / 角色卡）
// ==========================================
function initDragAndDrop() {
  const container = document.getElementById("characterList");
  if (!container || container.dataset.dragInited) return;

  let draggedCard = null;
  let draggedType = null; // "player" | "character"

  container.addEventListener("dragstart", (e) => {
    if (['BUTTON', 'INPUT', 'SELECT', 'OPTION'].includes(e.target.tagName)) {
      e.preventDefault();
      return;
    }

    const charCard = e.target.closest(".character-card");
    if (charCard) {
      draggedCard = charCard;
      draggedType = "character";
      charCard.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", "character-card");
      return;
    }

    const playerCard = e.target.closest(".player-card");
    if (!playerCard) return;

    draggedCard = playerCard;
    draggedType = "player";
    playerCard.classList.add("dragging");
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", "player-card");
  });

  container.addEventListener("dragend", () => {
    if (draggedCard) draggedCard.classList.remove("dragging");
    draggedCard = null;
    draggedType = null;
  });

  container.addEventListener("dragenter", (e) => {
    e.preventDefault();
  });

  container.addEventListener("dragover", (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";

    if (draggedType === "character") {
      const targetCard = e.target.closest(".character-card");
      if (!targetCard || targetCard === draggedCard) return;
      if (targetCard.parentElement !== draggedCard.parentElement) return;

      const rect = targetCard.getBoundingClientRect();
      const next = (e.clientY - rect.top) / (rect.bottom - rect.top) > 0.5;
      targetCard.parentElement.insertBefore(draggedCard, next ? targetCard.nextSibling : targetCard);
      return;
    }

    if (draggedType === "player") {
      const targetCard = e.target.closest(".player-card");
      if (!targetCard || targetCard === draggedCard) return;

      const rect = targetCard.getBoundingClientRect();
      const next = (e.clientY - rect.top) / (rect.bottom - rect.top) > 0.5;
      container.insertBefore(draggedCard, next ? targetCard.nextSibling : targetCard);
    }
  });

  container.addEventListener("drop", (e) => {
    e.preventDefault();

    if (draggedType === "character" && draggedCard) {
      persistCharacterOrder(draggedCard);
      return;
    }

    if (draggedType === "player") {
      persistPlayerOrder();
    }
  });

  function persistCharacterOrder(cardEl) {
    const playerName = cardEl.dataset.playerName;
    const parentContainer = cardEl.parentElement;
    const newOrder = Array.from(parentContainer.querySelectorAll(".character-card"))
      .map(card => card.dataset.charId)
      .filter(Boolean);
    saveCharacterOrder(playerName, newOrder);
  }

  function persistPlayerOrder() {
    const cards = container.querySelectorAll(".player-card");
    const newOrder = Array.from(cards)
      .map(card => card.dataset.playerName)
      .filter(Boolean);
    savePlayerOrder(newOrder);
  }

  container.dataset.dragInited = "true";

  if (!window.__dragDropWindowGuardInited) {
    window.addEventListener("dragover", (e) => e.preventDefault());
    window.addEventListener("drop", (e) => e.preventDefault());
    window.__dragDropWindowGuardInited = true;
  }
}

// ==========================================
// 倒數計時器 / 週重置偵測
// ==========================================
function updateResetTimer() {
  const timerEl = document.getElementById("reset-timer");
  if (!timerEl) return;

  const now = new Date();
  const day = now.getDay();

  let daysUntilThursday = (4 - day + 7) % 7;
  if (daysUntilThursday === 0 && (now.getHours() > 0 || now.getMinutes() > 0)) {
    daysUntilThursday = 7;
  }

  let nextThursday = new Date();
  nextThursday.setDate(now.getDate() + daysUntilThursday);
  nextThursday.setHours(0, 0, 0, 0);

  const diff = nextThursday - now;

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  timerEl.innerText = `⏳ 距離重置：${days}天 ${hours}時 ${minutes}分`;
}

function checkWeeklyResetPeriodically() {
  if (checkAndPerformWeeklyReset()) {
    saveStoreToCloud();
    renderApp();
  }
}

setInterval(() => {
  updateResetTimer();
  checkWeeklyResetPeriodically();
}, 60000);

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

// ==========================================
// Modal scroll lock（原 L4200–4219 第三個 <script>）
// ==========================================

(function setupModalScrollLock() {
  function init() {
    if (!document.body) return;
    function isAnyModalOpen() {
      return Array.from(document.querySelectorAll(".modal")).some(m => {
        const displayValue = m.style.display || getComputedStyle(m).display;
        return displayValue && displayValue !== "none";
      });
    }

    function updateBodyScrollLock() {
      document.body.classList.toggle("modal-open-lock", isAnyModalOpen());
    }

    const observer = new MutationObserver(updateBodyScrollLock);
    observer.observe(document.body, { attributes: true, attributeFilter: ["style"], subtree: true });

    updateBodyScrollLock();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
