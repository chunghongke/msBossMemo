/**
 * render-main.js
 * 主應用程式渲染 (renderApp) 與隊伍資訊彈窗
 *
 * 依賴：
 * - app-core.js
 * - schedule-core.js
 * - ui.js
 */

function renderApp() {
  updateUserSelectOptions();

  const container = document.getElementById("characterList");
  if (!container) return;

  const oldBossCellPositions = captureBossCellPositions(container);

  container.innerHTML = "";

  if (!window.config.players || !Array.isArray(window.config.players) || window.config.players.length === 0) {
    container.innerHTML = `<div style="text-align:center; padding: 40px; color: #64748b;">⚠️ 未讀取到玩家設定檔</div>`;
    return;
  }

  const primaryUser = getPrimaryUser();
  const savedOrder = getPlayerOrder();
  const collapsedKeys = getCollapsedPlayerKeys();

  // 排序邏輯：指定主要玩家置頂，其餘依照 localStorage 拖曳順序排列
  const sortedPlayers = [...window.config.players].sort((a, b) => {
    if (a.name === primaryUser) return -1;
    if (b.name === primaryUser) return 1;

    const indexA = savedOrder.indexOf(a.name);
    const indexB = savedOrder.indexOf(b.name);

    if (indexA !== -1 && indexB !== -1) return indexA - indexB;
    if (indexA !== -1) return -1;
    if (indexB !== -1) return 1;
    return 0;
  });

  sortedPlayers.forEach((p, pIdx) => {
    const playerId = `p_${pIdx}`;
    const isPrimary = p.name === primaryUser;
    const isCollapsed = collapsedKeys.includes(p.name);

    // 💡 關鍵修復：Firebase 取回的空陣列會變成 undefined，在此加上空值保護
    const rawCharacters = p.characters || [];

    // 依照該玩家儲存的自訂拖曳順序排序角色，未儲存過順序的角色維持原本順序
    const savedCharOrder = getCharacterOrder(p.name);
    const characters = [...rawCharacters].sort((a, b) => {
      const idxA = savedCharOrder.indexOf(a.id);
      const idxB = savedCharOrder.indexOf(b.id);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return 0;
    });

    // 先算出每個角色的結晶錢，順便加總成這個玩家的總計（header 要用到，所以要在 header 組出來之前先算）
    const crystalByCharId = new Map();
    const shardByCharId = new Map();
    let playerEarnedTotal = 0;
    let playerExpectedTotal = 0;
    characters.forEach(c => {
      const crystal = calculateCharacterCrystal(c);
      crystalByCharId.set(c.id, crystal);
      playerEarnedTotal += crystal.earned;
      playerExpectedTotal += crystal.expected;

      shardByCharId.set(c.id, calculateCharacterShard(c));
    });

    let playerHTML = `
      <div class="player-card ${isPrimary ? 'primary-player' : ''} ${isCollapsed ? 'is-collapsed' : ''}" 
          id="player-card-${playerId}" 
          draggable="true" 
          data-player-name="${p.name}"
          data-collapse-key="${p.name}">
        <div class="player-header" onclick="togglePlayerCollapse('${playerId}')">
          <span>
            ${isPrimary 
              ? `<span class="player-avatar-btn" onclick="event.stopPropagation(); openAvatarPickerModal('${p.name.replace(/'/g, "\\\\'")}')" title="點擊更換頭像">${p.avatarEmoji || '👤'}</span>`
              : `<span style="font-size: 16px; margin-right: 4px;">${p.avatarEmoji || '👤'}</span>`
            }
            玩家：${p.name} ${isPrimary ? ' ⭐ (自己)' : ''}
            ${playerExpectedTotal > 0 ? `<span style="font-size:12px; font-weight:normal; color:#eab308; margin-left:8px; display:inline-flex; align-items:center; gap:2px;"><img class="crystal-icon" src="./crystal-icon.png" alt="結晶" /> ${formatCrystal(playerEarnedTotal)} / ${formatCrystal(playerExpectedTotal)}</span>` : ''}
          </span>
          <span class="collapse-icon" id="collapse-icon-${playerId}">${isCollapsed ? '▲ 展開' : '▼ 收合'}</span>
        </div>
        <div class="player-characters">
    `;

    if (characters.length === 0) {
      playerHTML += `
        <div style="padding: 10px 20px; color: #94a3b8; font-size: 13px; font-style: italic;">
          尚無角色，請點擊上方「➕ 新增角色」來為 ${p.name} 建立角色。
        </div>
      `;
    } else {
      characters.forEach(c => {
        const count = getCharacterCompletedCount(c.id);
        const isFull = count >= 12;
        let selectedBossCount = c.bossIds ? c.bossIds.length : 0;
        selectedBossCount += c.resetBossIds ? c.resetBossIds.length : 0;
        const charCrystal = crystalByCharId.get(c.id) || { earned: 0, expected: 0 };
        const charShard = shardByCharId.get(c.id) || { earned: 0, expected: 0 };

        const isOwner = (p.name === primaryUser);

        playerHTML += `
          <div class="character-card" draggable="${isOwner ? 'true' : 'false'}" data-char-id="${c.id}" data-player-name="${p.name}">
            <div class="char-header">
              <div class="char-title" style="display: flex; align-items: center; gap: 6px;">
                ${c.characterImage
                  ? `<span class="char-avatar-wrap">
                      <img class="char-avatar" src="${c.characterImage}?width=100&height=100" alt="${c.name}" loading="lazy" onerror="this.closest('.char-avatar-wrap').outerHTML='⚔️';" />
                      <img class="char-avatar-preview" src="${c.characterImage}?width=320&height=320" alt="${c.name}" loading="lazy" />
                    </span>`
                  : '⚔️'}
                ${c.name}
                ${isOwner ? `
                  <button class="btn-icon" 
                          onclick="event.stopPropagation(); openEditCharBossesModal('${c.id}')" 
                          title="編輯角色的 BOSS 清單"
                          style="background: transparent; border: none; cursor: pointer; padding: 2px 4px; font-size: 12px; color: #64748b; border-radius: 4px; line-height: 1;"
                          onmouseover="this.style.background='#e2e8f0'" 
                          onmouseout="this.style.background='transparent'">
                    ✏️
                  </button>
                  <button class="btn-icon"
                          onclick="event.stopPropagation(); openRenameCharModal('${c.id}', '${c.name.replace(/'/g, "\\\\'")}')"
                          title="修改角色名稱"
                          style="background: transparent; border: none; cursor: pointer; padding: 2px 4px; font-size: 12px; color: #64748b; border-radius: 4px; line-height: 1;"
                          onmouseover="this.style.background='#e2e8f0'"
                          onmouseout="this.style.background='transparent'">
                    🖊️
                  </button>
                ` : ''}
                ${charCrystal.expected > 0 ? `<span style="font-size:11px; color:#eab308; font-weight:normal; display:inline-flex; align-items:center; gap:2px;"><img class="crystal-icon" src="./crystal-icon.png" alt="結晶" /> ${formatCrystal(charCrystal.earned)} / ${formatCrystal(charCrystal.expected)}</span>` : ''}
                ${charShard.expected > 0 ? `<span style="font-size:11px; color:#0ea5e9; font-weight:normal; display:inline-flex; align-items:center; gap:2px;" title="實際數量依你在多人 BOSS 選擇的撿取份數而定，這裡預計值先以「多人隊伍固定 1 份」估算"><img class="shard-icon" src="./shard-icon.png" alt="碎片" /> ${formatShardNumber(charShard.earned)} / ${formatShardNumber(charShard.expected)} 碎片</span>` : ''}
              </div>
              <span class="char-badge ${isFull ? 'full' : ''}">已完成 ${count} / ${selectedBossCount}</span>
            </div>
            ${(() => {
              const removedCompleted = getRemovedCompletedBosses(c);
              if (removedCompleted.length === 0) return '';
              return `<div class="removed-completed-note" title="這些 BOSS 已經從清單移除，本週完成紀錄仍會計入次數，但不能再切換攻略狀態">
                🗑️ 已完成但移出清單：${removedCompleted.join('、')}
              </div>`;
            })()}
            <div class="boss-grid">
        `;

        const bossCellEntries = [];

        window.config.bosses.forEach(boss => {
          const inBossIds = !c.bossIds || c.bossIds.length === 0 || c.bossIds.includes(boss.id);
          const inResetBossIds = c.resetBossIds && c.resetBossIds.includes(boss.id);

          // 這個 boss 既不是角色本來排定的難度，也沒有設定重置券打這裡，跟這個角色完全無關，略過
          if (!inBossIds && !inResetBossIds) return;

          const maxEntries = boss.allowReset ? 2 : 1;

          for (let entry = 1; entry <= maxEntries; entry++) {
            if (entry === 1 && !inBossIds) continue;   // entry 1（首次刷）只有角色本來排定的難度才顯示
            if (entry === 2 && !inResetBossIds) continue; // entry 2（重置刷）只有設定重置券打這個難度才顯示

            const recordKey = `rec_${c.id}_${boss.id}_${entry}`;
            const record = window.store.weeklyRecords ? window.store.weeklyRecords[recordKey] : null;
            const team = record && window.store.teams ? window.store.teams[record.teamId] : null;

            if (record && team) {
              const isCompleted = record.isCompleted;
              
              let rawMembers = team.memberTargets || (team.memberCharIds || []).map(id => ({ charId: id, entryIndex: entry }));
              
              const validMembers = rawMembers.filter(m => {
                if (!m.charId.startsWith("guest_")) return true;
                return window.store.guests && window.store.guests.some(g => g.id === m.charId);
              });

              const partyMembers = validMembers.filter(m => !(m.charId === c.id && m.entryIndex === entry));

              const allMemberNames = validMembers.map(m => {
                const name = getCharName(m.charId);
                return m.entryIndex === 2 ? `${name}(重置)` : name;
              }).join(", ");

              const displayTeamText = partyMembers.length > 0
                ? partyMembers.map(m => {
                    const name = getCharName(m.charId);
                    return m.entryIndex === 2 ? `${name}(重置)` : name;
                  }).join(", ")
                : '單人';

              // 判斷這個重置格是不是「跳難度」用的：角色本來排定的難度清單裡沒有這個 boss.id，
              // 代表這個重置券不是同難度多刷一次，而是拿去打了群組裡的另一個難度
              const isCrossDifficultyReset = entry === 2 && c.bossIds && !c.bossIds.includes(boss.id);

              let sourceBossLabel = "";
              if (isCrossDifficultyReset) {
                const groupKey = getBossGroupKey(boss.id);
                const sourceBoss = (c.bossIds || [])
                  .map(bId => window.config.bosses.find(b => b.id === bId))
                  .find(b => b && getBossGroupKey(b.id) === groupKey);
                sourceBossLabel = sourceBoss ? sourceBoss.name : "其他難度";
              }

              const bossDisplayName = entry === 2
                ? `🎟️ ${boss.name}(重置)`
                : boss.name;

              const cellTitle = isCrossDifficultyReset
                ? `隊伍成員: ${allMemberNames} (右鍵可編輯隊伍)\\n🎟️ 此次數來自重置券：${sourceBossLabel} → ${boss.name}`
                : (entry === 2
                  ? `隊伍成員: ${allMemberNames} (右鍵可編輯隊伍)\\n🎟️ 此次數來自重置券：${boss.name}(同難度)`
                  : `隊伍成員: ${allMemberNames} (右鍵可編輯隊伍)`);

              // 艾里溫碎片份數/數量標籤：只有這隻 BOSS 有設定 erionVestiges 才顯示
              // - 單人隊伍：固定顯示滿額（份數模式：6/6份；數量模式：60/60個），純顯示不可點擊
              // - 多人隊伍：顯示目前選了幾份或幾個，點擊可以打開分配彈窗
              const maxPartySize = boss.maxPartySize || 1;
              const totalShards = boss.erionVestiges || 0;
              const isSoloTeam = validMembers.length <= 1;
              const isQuantityMode = record.shardMode === 'quantity';
              let shardTagHtml = "";
              if (boss.erionVestiges) {
                if (isSoloTeam) {
                  shardTagHtml = isQuantityMode
                    ? `
                      <div class="shard-tag static" title="單人隊伍自動全拿">
                        <img class="shard-icon" src="./shard-icon.png" alt="碎片" />${totalShards}/${totalShards}個
                      </div>
                    `
                    : `
                      <div class="shard-tag static" title="單人隊伍自動全拿">
                        <img class="shard-icon" src="./shard-icon.png" alt="碎片" />${maxPartySize}/${maxPartySize}份
                      </div>
                    `;
                } else {
                  if (isQuantityMode) {
                    const hasChosen = record.shardQuantity !== null && record.shardQuantity !== undefined;
                    const currentQty = hasChosen ? record.shardQuantity : "?";
                    shardTagHtml = `
                      <div class="shard-tag ${hasChosen ? '' : 'unpicked'}"
                          ${isOwner ? `onclick="event.stopPropagation(); openShardShareModal('${recordKey}')"` : `onclick="event.stopPropagation(); alert('⚠️ 您只能修改自己角色的艾里溫碎片！')"`}
                          title="${isOwner ? '設定這次撿取的艾里溫碎片數量' : '艾里溫碎片數量（唯讀）'}">
                        <img class="shard-icon" src="./shard-icon.png" alt="碎片" />${currentQty}/${totalShards}個
                      </div>
                    `;
                  } else {
                    const hasChosen = record.shardShares !== null && record.shardShares !== undefined;
                    const currentShares = hasChosen ? record.shardShares : "?";
                    shardTagHtml = `
                      <div class="shard-tag ${hasChosen ? '' : 'unpicked'}"
                          ${isOwner ? `onclick="event.stopPropagation(); openShardShareModal('${recordKey}')"` : `onclick="event.stopPropagation(); alert('⚠️ 您只能修改自己角色的艾里溫碎片份數！')"`}
                          title="${isOwner ? '設定這次撿取的艾里溫碎片份數' : '艾里溫碎片份數（唯讀）'}">
                        <img class="shard-icon" src="./shard-icon.png" alt="碎片" />${currentShares}/${maxPartySize}份
                      </div>
                    `;
                  }
                }
              }

              const effectiveSchedule = getTeamEffectiveSchedule(team);
              let scheduleTagHtml = "";
              if (effectiveSchedule) {
                const isTemp = effectiveSchedule.isTemp;
                const tagIcon = isTemp ? "⚡" : "⏰";
                const scheduleFormatted = formatScheduleDisplay(effectiveSchedule);
                scheduleTagHtml = `
                  <div class="schedule-tag ${isTemp ? 'temp' : ''} ${isCompleted ? 'completed' : ''}"
                       onclick="event.stopPropagation(); showTeamScheduleInfo('${team.id}', '${boss.name}')"
                       title="${isTemp ? '⚡ 本週臨時時間' : '📅 常態出團時間'}：${scheduleFormatted}（點擊查看詳情）">
                    ${tagIcon}
                  </div>
                `;
              }

              bossCellEntries.push({
                isCompleted,
                html: `
                <div class="boss-cell ${isCompleted ? 'completed' : 'not-completed'} ${entry === 2 ? 'cross-diff-reset' : ''}"
                    data-record-key="${recordKey}"
                    style="${isOwner ? '' : 'cursor: default;'}"
                    onclick="${isOwner ? `toggleBossStatus('${recordKey}')` : `alert('⚠️ 您只能修改自己角色的 BOSS 攻略狀態！')`}"
                    oncontextmenu="${isOwner ? `openPartyModal(event, '${c.id}', '${boss.id}', ${entry})` : `event.preventDefault(); alert('⚠️ 只能由角色擁有者編輯隊伍成員！')`}"
                    ontouchstart="${isOwner ? `handleCellTouchStart(event, '${c.id}', '${boss.id}', ${entry})` : ``}"
                    ontouchmove="handleCellTouchMove(event)"
                    ontouchend="handleCellTouchEnd(event)"
                    ontouchcancel="handleCellTouchEnd(event)"
                    title="${cellTitle}${isOwner ? '' : ' (唯讀)'}">
                  ${shardTagHtml}
                  ${scheduleTagHtml}
                  <div class="boss-name">${bossDisplayName}</div>
                  <div class="party-members">${displayTeamText}</div>
                </div>
              `
              });
            }
          }
        });

        // 已完成的 BOSS 排到後面，未完成的排前面；同狀態內維持原本順序
        bossCellEntries
          .sort((a, b) => (a.isCompleted === b.isCompleted) ? 0 : (a.isCompleted ? 1 : -1))
          .forEach(entryItem => { playerHTML += entryItem.html; });

        playerHTML += `
            </div>
          </div>
        `;
      });
    }

    playerHTML += `
        </div>
      </div>
    `;

    container.innerHTML += playerHTML;
  });

  renderGuestSection();
  updateResetTimer();
  initDragAndDrop();
  playBossCellReorderAnimation(container, oldBossCellPositions);
}

window.showTeamScheduleInfo = function(teamId, bossName) {
  const team = window.store.teams[teamId];
  if (!team) return;
  const effectiveSchedule = getTeamEffectiveSchedule(team);
  if (!effectiveSchedule) return;

  const scheduleFormatted = formatScheduleDisplay(effectiveSchedule);
  const isTemp = effectiveSchedule.isTemp;
  const timeType = isTemp ? "⚡ 本週臨時時間" : "📅 常態固定時間";
  
  // 獲取隊友名字
  const memberNames = (team.memberTargets || [])
    .map(t => getCharName(t.charId))
    .join("、");

  // 建立動態 Modal
  const modalId = "tempScheduleInfoModal";
  let oldModal = document.getElementById(modalId);
  if (oldModal) oldModal.remove();

  const modal = document.createElement("div");
  modal.id = modalId;
  modal.className = "modal";
  modal.style.display = "flex"; // 直接 flex 居中顯示
  
  // 內容重用原專案的 modal-content 類別，使其 100% 完美支援深色模式切換
  modal.innerHTML = `
    <div class="modal-content" style="max-width: 380px; text-align: left; position: relative;">
      <h3 style="margin-top: 0; margin-bottom: 12px; font-size: 16px; display: flex; align-items: center; gap: 6px; color: var(--title-color);">
        ⏰ 出團時間資訊
      </h3>
      <div style="margin-bottom: 14px; font-size: 13px; line-height: 1.6; color: var(--text-main);">
        <div style="margin-bottom: 8px;">
          <strong>👾 BOSS 關卡：</strong><span>${bossName}</span>
        </div>
        <div style="margin-bottom: 8px;">
          <strong>⏱️ 出團時間：</strong><span style="color: #0284c7; font-weight: bold;">${scheduleFormatted}</span>
        </div>
        <div style="margin-bottom: 8px;">
          <strong>🏷️ 時間類型：</strong>
          <span style="font-size: 11px; padding: 2px 6px; border-radius: 4px; background: ${isTemp ? 'rgba(217, 119, 6, 0.12)' : 'rgba(2, 132, 199, 0.12)'}; color: ${isTemp ? '#d97706' : '#0284c7'}; border: 1px solid ${isTemp ? 'rgba(217, 119, 6, 0.3)' : 'rgba(2, 132, 199, 0.3)'}; font-weight: bold;">
            ${timeType}
          </span>
        </div>
        <div style="border-top: 1px solid var(--border-color); padding-top: 10px; margin-top: 10px;">
          <strong style="display: block; margin-bottom: 6px; color: var(--title-color);">👥 隊伍成員 (${team.memberTargets.length} 人)：</strong>
          <div style="background: var(--char-card-bg); padding: 8px 10px; border-radius: 6px; border: 1px solid var(--border-color); font-size: 12px; word-break: break-all; color: var(--text-main); max-height: 100px; overflow-y: auto;">
            ${memberNames}
          </div>
        </div>
      </div>
      <div style="display: flex; justify-content: flex-end; margin-top: 16px;">
        <button class="btn" id="closeTempScheduleBtn">關閉</button>
      </div>
    </div>
  `;

  // 點擊關閉按鈕或點擊背景即可關閉
  modal.querySelector("#closeTempScheduleBtn").onclick = () => modal.remove();
  modal.onclick = (e) => {
    if (e.target === modal) modal.remove();
  };

  document.body.appendChild(modal);
};
