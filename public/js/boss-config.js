/**
 * boss-config.js
 * BOSS 重置券設定模組（圖片卡片 + 圓形難度選擇器 + 跨難度 🎟️ 票券標記）
 *
 * 涵蓋：
 *   - openResetConfigModal()
 *   - selectResetCharTab(charId)
 *   - toggleResetDifficulty(charId, bossId, groupKey)
 *   - closeResetConfigModal()
 */

let currentResetCharId = null;

// 取得難度色彩輔助函式（優先使用全域 window.getDifficultyColor）
function getDiffColor(difficulty) {
  if (typeof window.getDifficultyColor === 'function') {
    return window.getDifficultyColor(difficulty);
  }
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

window.openResetConfigModal = function() {
  const primaryUser = getPrimaryUser();
  const allChars = getAllCharacters();
  let targetChars = allChars.filter(c => c.playerName === primaryUser);

  if (targetChars.length === 0 && window.config.players && window.config.players.length > 0) {
    const firstPlayerName = window.config.players[0].name;
    targetChars = allChars.filter(c => c.playerName === firstPlayerName);
  }

  if (targetChars.length > 0) {
    const exists = targetChars.some(c => c.id === currentResetCharId);
    if (!exists) {
      currentResetCharId = targetChars[0].id;
    }
  } else {
    currentResetCharId = null;
  }

  renderResetModalBody();
  document.getElementById("resetModal").style.display = "flex";
};

window.selectResetCharTab = function(charId) {
  currentResetCharId = charId;
  renderResetModalBody();
};

function renderResetModalBody() {
  const modalBody = document.getElementById("modalBody");
  if (!modalBody) return;

  const resetableBosses = (window.config.bosses || []).filter(b => b.allowReset);
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
    modalBody.innerHTML = `<div style="text-align:center; padding: 30px; color: var(--text-muted);">⚠️ 尚未選擇主要玩家或該玩家尚無任何角色</div>`;
    return;
  }

  // 確保 currentResetCharId 有效
  let currentChar = targetChars.find(c => c.id === currentResetCharId);
  if (!currentChar) {
    currentChar = targetChars[0];
    currentResetCharId = currentChar.id;
  }

  // 1. 頂部玩家提示與角色 Tab 切換列
  const hintText = isFallback
    ? `⚠️ 尚未選擇主要玩家（或該玩家無角色），目前顯示的是「${displayedPlayerName}」的角色`
    : `目前顯示的是主要玩家「${displayedPlayerName}」的角色`;
  const hintColor = isFallback ? "#b45309" : "var(--text-muted)";

  let tabsHtml = `
    <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; align-items: center;">
  `;

  targetChars.forEach(c => {
    const isTabActive = c.id === currentResetCharId;
    const rCount = c.resetBossIds ? c.resetBossIds.length : 0;
    const tabActiveStyle = `background: #3b82f6; color: #fff; border: 1px solid #3b82f6; font-weight: bold; box-shadow: 0 2px 6px rgba(59, 130, 246, 0.3);`;
    const tabInactiveStyle = `background: var(--card-bg); color: var(--text-main); border: 1px solid var(--border-color); opacity: 0.85;`;

    tabsHtml += `
      <button type="button"
        onclick="selectResetCharTab('${c.id}')"
        style="padding: 6px 14px; border-radius: 20px; font-size: 13px; cursor: pointer; transition: all 0.2s; ${isTabActive ? tabActiveStyle : tabInactiveStyle}">
        👤 ${c.name} ${rCount > 0 ? `<span style="background: ${isTabActive ? '#1e3a8a' : '#f59e0b'}; color:#fff; font-size: 10px; padding: 1px 6px; border-radius: 10px; margin-left: 4px;">🎟️ ${rCount}</span>` : ''}
      </button>
    `;
  });
  tabsHtml += `</div>`;

  // 2. 當前角色的攻略額度資訊列
  const normalCount = currentChar.bossIds ? currentChar.bossIds.length : 0;
  const resetCount = currentChar.resetBossIds ? currentChar.resetBossIds.length : 0;
  const totalCount = normalCount + resetCount;
  const isFull = totalCount >= 12;

  const quotaHtml = `
    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; padding: 8px 12px; background: var(--char-card-bg, rgba(0,0,0,0.03)); border-radius: 8px; border: 1px solid var(--border-color);">
      <div style="font-size: 12px; color: ${hintColor};">
        ${hintText}
      </div>
      <div style="font-size: 13px; font-weight: bold; color: ${isFull ? '#ef4444' : 'var(--text-main)'};">
        📊 攻略額度：常態 ${normalCount} 隻 ＋ 重置券 ${resetCount} 隻 ＝ 總計 ${totalCount} / 12 隻 ${isFull ? '(已達上限)' : `<span style="color:#10b981; font-weight:normal;">(尚可選 ${12 - totalCount} 隻)</span>`}
      </div>
    </div>
  `;

  // 3. 篩選該角色有排定且支援重置的 BOSS 卡片
  const ownGroupKeys = new Set((currentChar.bossIds || []).map(bId => getBossGroupKey(bId)));
  const availableResetBosses = resetableBosses.filter(b => ownGroupKeys.has(getBossGroupKey(b.id)));

  let cardsGridHtml = "";

  if (availableResetBosses.length === 0) {
    cardsGridHtml = `
      <div style="text-align: center; padding: 40px 20px; color: var(--text-muted); border: 1px dashed var(--border-color); border-radius: 8px;">
        <div style="font-size: 28px; margin-bottom: 8px;">🎫</div>
        <div>該角色目前排定的 BOSS 清單中，沒有支援重置券的王怪。</div>
        <div style="font-size: 12px; margin-top: 4px; opacity: 0.7;">（請先在「編輯 BOSS」中設定該角色要攻略的王怪）</div>
      </div>
    `;
  } else {
    // 依據 group 分組
    const groupMap = new Map();
    availableResetBosses.forEach(b => {
      const gKey = getBossGroupKey(b.id);
      if (!groupMap.has(gKey)) {
        const cleanName = b.name.replace(/^\([^)]+\)\s*/, "");
        groupMap.set(gKey, { id: gKey, name: cleanName, bosses: [] });
      }
      groupMap.get(gKey).bosses.push(b);
    });

    let cardsHtml = "";
    groupMap.forEach((group, groupKey) => {
      // 找出該角色原本常態打的難度 bossId
      const normalBossId = (currentChar.bossIds || []).find(bId => getBossGroupKey(bId) === groupKey);
      const normalBossObj = (window.config.bosses || []).find(b => b.id === normalBossId);
      const normalDiff = normalBossObj ? (normalBossObj.difficulty || "normal") : null;

      // 找出當前角色選了哪一個難度的重置券
      const selectedResetBossId = (currentChar.resetBossIds || []).find(bId => getBossGroupKey(bId) === groupKey);
      const selectedResetBossObj = selectedResetBossId ? (window.config.bosses || []).find(b => b.id === selectedResetBossId) : null;
      const hasResetTicket = !!selectedResetBossId;

      let buttonsHtml = "";
      group.bosses.forEach(boss => {
        const diff = boss.difficulty || "normal";
        const dc = getDiffColor(diff);
        const isSelected = (currentChar.resetBossIds || []).includes(boss.id);
        const isNormal = (boss.id === normalBossId);
        const isCross = isSelected && !isNormal;

        // 圓形按鈕樣式 (選中：實心底色；未選中：半透明+邊框)
        const activeStyle = `background: ${dc.bg}; color: ${dc.textColor}; border: 2px solid ${dc.border}; box-shadow: 0 0 8px ${dc.shadow}; transform: scale(1.1);`;
        const inactiveStyle = `background: ${dc.bg}; color: ${dc.textColor}; border: 2px solid ${dc.border}; opacity: 0.35;`;

        // 方案 A 視覺元素：
        // 1. 跨難度 🎟️ 票券角標（右上角）
        const crossBadgeHtml = isCross
          ? `<span style="position: absolute; top: -7px; right: -7px; font-size: 11px; line-height: 1; pointer-events: none; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.8));" title="跨難度重置">🎟️</span>`
          : '';

        // 2. 常態難度指示點（正下方）
        const normalDotHtml = isNormal
          ? `<span style="position: absolute; bottom: -5px; width: 5px; height: 5px; border-radius: 50%; background: #38bdf8; box-shadow: 0 0 4px #38bdf8; pointer-events: none;" title="本週常規攻略難度"></span>`
          : '';

        buttonsHtml += `
          <div style="position: relative; display: inline-flex; flex-direction: column; align-items: center;">
            <button type="button"
              class="reset-diff-btn"
              data-boss-id="${boss.id}"
              data-group-key="${groupKey}"
              data-active="${isSelected ? 'true' : 'false'}"
              style="width: 32px; height: 32px; border-radius: 50%; cursor: pointer; font-size: 11px; font-weight: bold; transition: all 0.2s; ${isSelected ? activeStyle : inactiveStyle}"
              onclick="toggleResetDifficulty('${currentChar.id}', '${boss.id}', '${groupKey}')"
              title="${boss.name}${isNormal ? ' (本週常態難度)' : ' (跨難度重置)'}">
              ${dc.text}
            </button>
            ${crossBadgeHtml}
            ${normalDotHtml}
          </div>
        `;
      });

      // 卡片底部提示文字
      let footerHtml = "";
      if (hasResetTicket) {
        if (selectedResetBossId === normalBossId) {
          footerHtml = `<div style="font-size: 11px; color: #10b981; font-weight: bold; background: rgba(16, 185, 129, 0.1); border-radius: 4px; padding: 2px 6px; text-align: center;">🔄 同難度重置</div>`;
        } else {
          const fromText = normalDiff ? getDiffColor(normalDiff).text : "原";
          const toText = selectedResetBossObj ? getDiffColor(selectedResetBossObj.difficulty || "normal").text : "新";
          footerHtml = `<div style="font-size: 11px; color: #f59e0b; font-weight: bold; background: rgba(245, 158, 11, 0.12); border-radius: 4px; padding: 2px 6px; border: 1px solid rgba(245, 158, 11, 0.3); text-align: center;">🎟️ 跨難度 (${fromText} ➔ ${toText})</div>`;
        }
      } else {
        footerHtml = `<div style="font-size: 11px; color: var(--text-muted); opacity: 0.6; padding: 2px 6px; text-align: center;">未設定重置</div>`;
      }

      cardsHtml += `
        <div class="boss-card" style="display: flex; flex-direction: column; background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 10px; align-items: center; gap: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); transition: border-color 0.2s;">
          <div style="width: 100%; height: 70px; display: flex; justify-content: center; align-items: center; background: #0f172a; border-radius: 6px; overflow: hidden; position: relative;">
            <img src="./images/bosses/${groupKey}.png?v=1" onerror="this.src='./icon.png'" id="img_reset_${groupKey}"
              style="max-width: 100%; max-height: 100%; object-fit: contain; filter: ${hasResetTicket ? 'none' : 'grayscale(80%)'}; opacity: ${hasResetTicket ? '1' : '0.5'}; transition: all 0.25s;" />
            <span style="position: absolute; bottom: 3px; font-size: 10px; font-weight: bold; color: #fff; text-shadow: 0 1px 3px rgba(0,0,0,0.9); white-space: nowrap; max-width: 95%; overflow: hidden; text-overflow: ellipsis;">${group.name}</span>
          </div>
          <div style="display: flex; gap: 8px; width: 100%; justify-content: center; align-items: center; flex-wrap: wrap; min-height: 38px;">
            ${buttonsHtml}
          </div>
          <div style="width: 100%;">
            ${footerHtml}
          </div>
        </div>
      `;
    });

    cardsGridHtml = `
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 14px; max-height: 480px; overflow-y: auto; padding: 4px 6px 12px 2px;">
        ${cardsHtml}
      </div>
    `;
  }

  // 組合整體 HTML
  modalBody.innerHTML = `
    ${tabsHtml}
    ${quotaHtml}
    <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 8px; display: flex; align-items: center; gap: 12px;">
      <span>💡 點選難度按鈕設定重置券</span>
      <span style="display: inline-flex; align-items: center; gap: 4px;"><span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #38bdf8;"></span> 常態攻略難度</span>
      <span style="display: inline-flex; align-items: center; gap: 4px;">🎟️ 跨難度重置</span>
    </div>
    ${cardsGridHtml}
  `;
}

window.toggleResetDifficulty = function(charId, bossId, groupKey) {
  let targetChar = null;
  if (window.config.players) {
    for (const player of window.config.players) {
      if (player.characters) {
        const found = player.characters.find(c => c.id === charId);
        if (found) { targetChar = found; break; }
      }
    }
  }

  if (!targetChar) {
    alert("找不到該角色資料！");
    return;
  }

  if (!targetChar.resetBossIds) {
    targetChar.resetBossIds = [];
  }

  const isCurrentlySelected = targetChar.resetBossIds.includes(bossId);

  if (isCurrentlySelected) {
    // 取消重置券
    targetChar.resetBossIds = targetChar.resetBossIds.filter(id => id !== bossId);
  } else {
    // 檢查同 group 是否已有選取的難度（同 group 切換難度，不消耗額外 quota）
    const existingGroupResetIndex = targetChar.resetBossIds.findIndex(bId => getBossGroupKey(bId) === groupKey);

    if (existingGroupResetIndex > -1) {
      // 直接切換難度
      targetChar.resetBossIds[existingGroupResetIndex] = bossId;
    } else {
      // 全新 BOSS 重置券：檢查 12 隻上限
      const normalCount = targetChar.bossIds ? targetChar.bossIds.length : 0;
      const resetCount = targetChar.resetBossIds.length;
      if (normalCount + resetCount >= 12) {
        alert(`角色 [${targetChar.name}] 的 BOSS 攻略數量已達 12 隻上限（常態 ${normalCount} 隻 + 重置 ${resetCount} 隻），無法再選擇重置券！`);
        return;
      }
      targetChar.resetBossIds.push(bossId);
    }
  }

  // 寫入 Firebase
  if (window.db && window.dbRef && window.dbSet) {
    const playersRef = window.dbRef(window.db, '/players');
    window.dbSet(playersRef, window.config.players);
  }

  // 更新主頁面與彈窗
  if (typeof renderApp === 'function') renderApp();
  renderResetModalBody();
};

window.closeResetConfigModal = function() {
  document.getElementById("resetModal").style.display = "none";
};
