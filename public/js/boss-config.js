/**
 * boss-config.js
 * 複製自 index.html 主 <script> 區塊（L3091–3201）
 * 涵蓋：openResetConfigModal()、toggleResetConfig()、closeResetConfigModal()
 *
 * ⚠️  目前 index.html 仍保留原本的 script，此檔案僅為備份/拆分準備。
 *
 * 依賴（未來切換時需在此檔案之前載入）：
 *   - app-core.js（getPrimaryUser、getAllCharacters、getBossGroupKey、renderApp）
 */

window.openResetConfigModal = function() {
  const modalBody = document.getElementById("modalBody");
  if (!modalBody) return;
  modalBody.innerHTML = "";

  const resetableBosses = window.config.bosses.filter(b => b.allowReset);
  const primaryUser = getPrimaryUser();
  const allChars = getAllCharacters();
  let targetChars = allChars.filter(c => c.playerName === primaryUser);
  let displayedPlayerName = primaryUser;
  let isFallback = false;

  if (targetChars.length === 0 && window.config.players && window.config.players.length > 0) {
    const firstPlayerName = window.config.players[0].name;
    targetChars = allChars.filter(c => c.playerName === firstPlayerName);
    displayedPlayerName = firstPlayerName;
    isFallback = true;
  }

  if (targetChars.length === 0) {
    modalBody.innerHTML = `<div style="text-align:center; padding: 15px; color: #64748b;">⚠️ 尚未選擇主要玩家或該玩家無角色</div>`;
  } else {
    const hintText = isFallback
      ? `⚠️ 尚未選擇主要玩家（或該玩家無角色），目前顯示的是「${displayedPlayerName}」的角色`
      : `目前顯示的是主要玩家「${displayedPlayerName}」的角色`;
    const hintColor = isFallback ? "#b45309" : "#64748b";
    modalBody.innerHTML += `<div style="font-size:12px; color:${hintColor}; margin-bottom:8px;">${hintText}</div>`;

    let columnsHtml = `<div class="reset-char-columns">`;

    targetChars.forEach(c => {
      const ownGroupKeys = new Set((c.bossIds || []).map(bId => getBossGroupKey(bId)));
      const availableResetBosses = resetableBosses.filter(b => ownGroupKeys.has(getBossGroupKey(b.id)));

      columnsHtml += `<div class="reset-char-column"><div class="reset-char-column-header"><strong style="font-size:13px;">${c.name} (${c.playerName})</strong></div>`;

      if (availableResetBosses.length === 0) {
        columnsHtml += `<span style="font-size:12px; color:#94a3b8;">（該角色排定的 BOSS 群組中沒有支援重置券的難度）</span>`;
      } else {
        const groupedMap = new Map();
        availableResetBosses.forEach(b => {
          const key = getBossGroupKey(b.id);
          if (!groupedMap.has(key)) groupedMap.set(key, []);
          groupedMap.get(key).push(b);
        });

        groupedMap.forEach(bossesInGroup => {
          columnsHtml += `<div style="margin: 4px 0 6px 0;">`;
          bossesInGroup.forEach(b => {
            const isChecked = c.resetBossIds && c.resetBossIds.includes(b.id);
            const isOwnDifficulty = c.bossIds && c.bossIds.includes(b.id);
            const crossTag = isOwnDifficulty ? '' : ' <span style="font-size:10px; color:#d97706;" title="這個難度不在角色本來排定的清單裡，勾選代表把重置券拿來跳打這個難度">🎟️跳難度</span>';
            columnsHtml += `
              <label style="font-size:13px; cursor:pointer; display:flex; align-items:center; gap:2px;">
                <input type="checkbox" onchange="toggleResetConfig('${c.id}', '${b.id}')" ${isChecked ? 'checked' : ''}>
                ${b.name}${crossTag}
              </label>`;
          });
          columnsHtml += `</div>`;
        });
      }

      columnsHtml += `</div>`;
    });

    columnsHtml += `</div>`;
    modalBody.innerHTML += columnsHtml;
  }

  document.getElementById("resetModal").style.display = "flex";
};

function toggleResetConfig(charId, bossId) {
  window.config.players.forEach(p => {
    (p.characters || []).forEach(c => {
      if (c.id === charId) {
        if (!c.resetBossIds) c.resetBossIds = [];
        const index = c.resetBossIds.indexOf(bossId);
        if (index > -1) {
          c.resetBossIds.splice(index, 1);
        } else {
          const normalCount = c.bossIds ? c.bossIds.length : 0;
          const resetCount = c.resetBossIds.length;
          const totalAfterAdd = normalCount + resetCount + 1;

          if (totalAfterAdd > 12) {
            alert(`角色 [${c.name}] 的 BOSS 攻略數量已達 12 隻上限（一般 ${normalCount} 隻 + 重置 ${resetCount} 隻），無法再新增重置券！`);
            const checkboxes = document.querySelectorAll(`input[onchange*="${charId}"][onchange*="${bossId}"]`);
            checkboxes.forEach(cb => { cb.checked = false; });
            return;
          }
          c.resetBossIds.push(bossId);
        }
      }
    });
  });

  if (window.db && window.dbRef && window.dbSet) {
    const playersRef = window.dbRef(window.db, '/players');
    window.dbSet(playersRef, window.config.players);
  }
  renderApp();
}

function closeResetConfigModal() {
  document.getElementById("resetModal").style.display = "none";
}
