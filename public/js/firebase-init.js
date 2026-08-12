/**
 * firebase-init.js
 * 複製自 index.html <script type="module"> 區塊（L877–1077）
 * ⚠️  目前 index.html 仍保留原本的 script，此檔案僅為備份/拆分準備。
 *    待確認後再從 index.html 移除對應區塊。
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, onValue, set } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyC6_PrlBgVTbmpDCrWP7KMTAq8RHtNsI-M",
  authDomain: "msbossmemo-752e3.firebaseapp.com",
  databaseURL: "https://msbossmemo-752e3-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "msbossmemo-752e3",
  storageBucket: "msbossmemo-752e3.firebasestorage.app",
  messagingSenderId: "747420574318",
  appId: "1:747420574318:web:eff8bdb117a776264cfc7f"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

window.db = db;
window.dbRef = ref;
window.dbSet = set;

window.config = { bosses: [], players: [] };
window.store = { teams: {}, weeklyRecords: {} };

const rootRef = ref(db, '/');
onValue(rootRef, (snapshot) => {
  const data = snapshot.val();
  
  if (data) {
    let rawBosses = data.bosses || [];
    if (!Array.isArray(rawBosses)) rawBosses = Object.values(rawBosses);
    window.config.bosses = rawBosses.filter(b => b !== null && b !== undefined);

    let rawPlayers = data.players || [];
    if (!Array.isArray(rawPlayers)) rawPlayers = Object.values(rawPlayers);
    window.config.players = rawPlayers.filter(p => p !== null && p !== undefined);

    window.store = data.store || { teams: {}, weeklyRecords: {}, guests: [] };
    if (!window.store.guests) window.store.guests = [];
  }

  const weeklyResetHappened = checkAndPerformWeeklyReset();
  ensureDefaultSingleTeams();
  if (weeklyResetHappened) saveStoreToCloud();
  renderApp();
});

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
