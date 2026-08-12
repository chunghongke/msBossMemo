/**
 * render.js
 * 複製自 index.html 主 <script> 區塊（L1418–1824）
 * 涵蓋：renderApp()、scrollToGuests()、renderGuestSection()
 *
 * ⚠️  目前 index.html 仍保留原本的 script，此檔案僅為備份/拆分準備。
 *
 * 依賴（未来切換時需在此檔案之前載入）：
 *   - app-core.js（calculateCharacterCrystal、getBossGroupKey 等）
 *   - schedule.js（getTeamEffectiveSchedule、formatScheduleDisplay）
 *   - ui.js（getPrimaryUser、getPlayerOrder、getCollapsedPlayerKeys、initDragAndDrop 等）
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
              <span class="player-avatar-btn" onclick="event.stopPropagation(); openAvatarPickerModal('${p.name.replace(/'/g, "\\'")}')" title="點擊更換頭像">${p.avatarEmoji || '👤'}</span>
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

          playerHTML += `
            <div class="character-card" draggable="true" data-char-id="${c.id}" data-player-name="${p.name}">
              <div class="char-header">
                <div class="char-title" style="display: flex; align-items: center; gap: 6px;">
                  ${c.characterImage
                    ? `<span class="char-avatar-wrap">
                        <img class="char-avatar" src="${c.characterImage}?width=100&height=100" alt="${c.name}" loading="lazy" onerror="this.closest('.char-avatar-wrap').outerHTML='⚔️';" />
                        <img class="char-avatar-preview" src="${c.characterImage}?width=320&height=320" alt="${c.name}" loading="lazy" />
                      </span>`
                    : '⚔️'}
                  ${c.name}
                  <button class="btn-icon" 
                          onclick="event.stopPropagation(); openEditCharBossesModal('${c.id}')" 
                          title="編輯角色的 BOSS 清單"
                          style="background: transparent; border: none; cursor: pointer; padding: 2px 4px; font-size: 12px; color: #64748b; border-radius: 4px; line-height: 1;"
                          onmouseover="this.style.background='#e2e8f0'" 
                          onmouseout="this.style.background='transparent'">
                    ✏️
                  </button>
                  <button class="btn-icon"
                          onclick="event.stopPropagation(); openRenameCharModal('${c.id}', '${c.name.replace(/'/g, "\\'")}')"
                          title="修改角色名稱"
                          style="background: transparent; border: none; cursor: pointer; padding: 2px 4px; font-size: 12px; color: #64748b; border-radius: 4px; line-height: 1;"
                          onmouseover="this.style.background='#e2e8f0'"
                          onmouseout="this.style.background='transparent'">
                    🖊️
                  </button>
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
                  ? `隊伍成員: ${allMemberNames} (右鍵可編輯隊伍)\n🎟️ 此次數來自重置券：${sourceBossLabel} → ${boss.name}`
                  : (entry === 2
                    ? `隊伍成員: ${allMemberNames} (右鍵可編輯隊伍)\n🎟️ 此次數來自重置券：${boss.name}(同難度)`
                    : `隊伍成員: ${allMemberNames} (右鍵可編輯隊伍)`);

                // 艾里溫碎片份數標籤：只有這隻 BOSS 有設定 erionVestiges 才顯示
                // - 單人隊伍：固定顯示「滿額/滿額」（例如 6/6），純顯示不可點擊，因為單人自動全拿不用選
                // - 多人隊伍：顯示目前選了幾份，點擊可以打開選擇彈窗（0 份也是合法選項，例如兩人隊伍這週 A 全撿、下週換 B 全撿）
                const maxPartySize = boss.maxPartySize || 1;
                const isSoloTeam = validMembers.length <= 1;
                let shardTagHtml = "";
                if (boss.erionVestiges) {
                  if (isSoloTeam) {
                    shardTagHtml = `
                      <div class="shard-tag static" title="單人隊伍自動全拿">
                        <img class="shard-icon" src="./shard-icon.png" alt="碎片" />${maxPartySize}/${maxPartySize}份
                      </div>
                    `;
                  } else {
                    const hasChosen = record.shardShares !== null && record.shardShares !== undefined;
                    const currentShares = hasChosen ? record.shardShares : "?";
                    shardTagHtml = `
                      <div class="shard-tag ${hasChosen ? '' : 'unpicked'}"
                          onclick="event.stopPropagation(); openShardShareModal('${recordKey}')"
                          title="設定這次撿取的艾里溫碎片份數">
                        <img class="shard-icon" src="./shard-icon.png" alt="碎片" />${currentShares}/${maxPartySize}份
                      </div>
                    `;
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
                      onclick="toggleBossStatus('${recordKey}')"
                      oncontextmenu="openPartyModal(event, '${c.id}', '${boss.id}', ${entry})"
                      ontouchstart="handleCellTouchStart(event, '${c.id}', '${boss.id}', ${entry})"
                      ontouchmove="handleCellTouchMove(event)"
                      ontouchend="handleCellTouchEnd(event)"
                      ontouchcancel="handleCellTouchEnd(event)"
                      title="${cellTitle}">
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

  window.scrollToGuests = function() {
    const guestCard = document.getElementById("player-card-guests");
    const icon = document.getElementById("collapse-icon-guests");
    if (guestCard) {
      guestCard.classList.remove("is-collapsed");
      if (icon) icon.innerText = "▼ 收合";

      const collapsedKeys = getCollapsedPlayerKeys().filter(k => k !== "guests");
      saveCollapsedPlayerKeys(collapsedKeys);

      guestCard.scrollIntoView({ behavior: "smooth" });
    }
  };

  function renderGuestSection() {
    const container = document.getElementById("guestSectionContainer");
    if (!container) return;

    const isCollapsed = getCollapsedPlayerKeys().includes("guests");

    const guests = (window.store && window.store.guests) ? window.store.guests : [];
    const guestCount = guests.length;

    let guestSectionHTML = `
      <div class="player-card ${isCollapsed ? 'is-collapsed' : ''}" id="player-card-guests" data-collapse-key="guests" style="margin-top: 24px;">
        <div class="player-header" onclick="togglePlayerCollapse('guests')">
          <span>👤 臨時 Guest 隊友清單 (共 ${guestCount} 位)</span>
          <span class="collapse-icon" id="collapse-icon-guests">${isCollapsed ? '▲ 展開' : '▼ 收合'}</span>
        </div>
        <div class="player-characters">
    `;

    if (guestCount === 0) {
      guestSectionHTML += `
        <div style="text-align: center; padding: 20px; color: var(--text-muted); font-size: 13px;">
          目前尚無 Guest 隊友。點擊 BOSS 格子右鍵並於組隊彈窗中即可新增。
        </div>`;
    } else {
      guests.forEach(g => {
        let participatedBosses = [];
        const seenTeamIds = new Set(); // 💡 一個隊伍會被多個正式成員各自的 weeklyRecord 引用到，用 teamId 去重，避免同一隊重複顯示
        if (window.store && window.store.weeklyRecords && window.store.teams) {
          Object.keys(window.store.weeklyRecords).forEach(recordKey => {
            const rec = window.store.weeklyRecords[recordKey];
            if (rec && rec.teamId) {
              if (seenTeamIds.has(rec.teamId)) return; // 這隊已經加過了，跳過

              const team = window.store.teams[rec.teamId];
              const members = team.memberTargets || (team.memberCharIds || []).map(id => ({ charId: id, entryIndex: rec.entryIndex }));
              
              if (team && members.some(m => m.charId === g.id)) {
                const boss = window.config.bosses.find(b => b.id === rec.bossId);
                if (boss) {
                  seenTeamIds.add(rec.teamId);
                  participatedBosses.push({
                    recordKey: recordKey,
                    bossName: rec.entryIndex === 2 ? `${boss.name}(重置)` : boss.name,
                    isCompleted: rec.isCompleted,
                    team: team,
                    members: members
                  });
                }
              }
            }
          });
        }

        const participatedCount = participatedBosses.length;

        guestSectionHTML += `
          <div class="character-card">
            <div class="char-header">
              <div class="char-title" style="display: flex; align-items: center; gap: 8px;">
                👤 ${g.name}
                <button onclick="deleteGuestMember('${g.id}')" 
                        title="刪除 Guest 隊友"
                        style="background: transparent; border: none; cursor: pointer; padding: 2px 4px; font-size: 12px; color: #ef4444; border-radius: 4px; line-height: 1;">
                  🗑️
                </button>
              </div>
              <span class="char-badge">已參與 ${participatedCount} 隊</span>
            </div>
            <div class="boss-grid">
        `;

        if (participatedCount === 0) {
          guestSectionHTML += `<div style="grid-column: 1 / -1; font-size: 12px; color: var(--text-muted); font-style: italic; padding: 6px 0;">尚未參與任何 BOSS 隊伍</div>`;
        } else {
          participatedBosses.forEach(item => {
            const memberNames = item.members.map(m => getCharName(m.charId)).join(", ");
            guestSectionHTML += `
              <div class="boss-cell ${item.isCompleted ? 'completed' : 'not-completed'}"
                   onclick="toggleBossStatus('${item.recordKey}')"
                   title="隊伍成員: ${memberNames} (點擊可切換完成狀態)">
                <div class="boss-name">${item.bossName}</div>
                <div class="party-members">${memberNames}</div>
              </div>
            `;
          });
        }

        guestSectionHTML += `
            </div>
          </div>
        `;
      });
    }

    guestSectionHTML += `
        </div>
      </div>
    `;

    container.innerHTML = guestSectionHTML;
  }

  // ==========================================
  // 出團時間詳情彈窗
  // ==========================================
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

