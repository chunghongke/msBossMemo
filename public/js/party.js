/**
 * party.js
 * 複製自 index.html 主 <script> 區塊（L1825–2620）
 * 涵蓋：toggleBossStatus()、艾裡溫碗片 shard modal、
 *       renderExistingTeamsQuickJoin()、joinExistingTeam()、renderPartySelectList()、
 *       addGuestMember()、deleteGuestMember()、openPartyModal()、savePartyTeam()、closePartyModal()、
 *       手機長按 (Long Press) 相關函式
 *
 * ⚠️  目前 index.html 仍保留原本的 script，此檔案僅為備份/拆分準備。
 *
 * 依賴（未來切換時需在此檔案之前載入）：
 *   - app-core.js（saveStoreToCloud、getCharName、getCurrentResetWeekKey 等）
 *   - schedule.js（loadPartyScheduleIntoForm、readPartyScheduleFromForm）
 */

  function toggleBossStatus(recordKey) {
    const record = window.store.weeklyRecords[recordKey];
    if (!record || !record.teamId) return;

    const team = window.store.teams[record.teamId];
    const members = team.memberTargets || (team.memberCharIds || []).map(id => ({ charId: id, entryIndex: record.entryIndex }));

    if (!record.isCompleted && team) {
      for (const m of members) {
        if (m.charId.startsWith("guest_")) continue;
        if (getCharacterCompletedCount(m.charId) >= 12) {
          alert(`角色 [${getCharName(m.charId)}] 本週攻略數量已達 12 隻上限！`);
          return;
        }
      }
    }

    const nextStatus = !record.isCompleted;

    // 💡 完成時，如果是多人隊伍又有設定艾里溫碎片、份數又除不盡，要先讓使用者選份數、
    //    按下「確定」才會一起寫入完成狀態跟份數；在那之前完全不動 isCompleted，
    //    不管使用者點 modal 旁邊、點關閉，都不會更新卡片狀態
    if (nextStatus) {
      const boss = window.config.bosses.find(b => b.id === record.bossId);
      const validMembers = members.filter(m => {
        if (!m.charId.startsWith("guest_")) return true;
        return window.store.guests && window.store.guests.some(g => g.id === m.charId);
      });
      const isSolo = validMembers.length <= 1;

      if (boss && boss.erionVestiges && !isSolo) {
        const actualTeamSize = validMembers.length;
        const dividesEvenly = boss.maxPartySize % actualTeamSize === 0;

        if (!dividesEvenly) {
          openShardShareModal(recordKey, true); // true = 完成狀態要等使用者按確定才一起寫入
          return;
        }
      }
    }

    Object.values(window.store.weeklyRecords).forEach(r => {
      if (r.teamId === record.teamId) {
        r.isCompleted = nextStatus;
      }
    });

    // 份數整除的情況，分配沒有爭議，直接自動平分寫入，不用另外詢問
    if (nextStatus) {
      const boss = window.config.bosses.find(b => b.id === record.bossId);
      const validMembers = members.filter(m => {
        if (!m.charId.startsWith("guest_")) return true;
        return window.store.guests && window.store.guests.some(g => g.id === m.charId);
      });
      const isSolo = validMembers.length <= 1;

      if (boss && boss.erionVestiges && !isSolo) {
        const actualTeamSize = validMembers.length;
        const dividesEvenly = boss.maxPartySize % actualTeamSize === 0;
        if (dividesEvenly) {
          const fairShare = boss.maxPartySize / actualTeamSize;
          Object.values(window.store.weeklyRecords).forEach(r => {
            if (r.teamId === record.teamId) {
              r.shardShares = fairShare;
            }
          });
        }
      }
    }

    saveStoreToCloud();
  }

  // ==================== 艾里溫碎片：份數選擇彈窗（一次填完整隊） ====================
  let editingShardRecordKey = null;
  let shardModalPendingComplete = false; // true 代表：按下確定時，除了寫份數，還要一起把完成狀態設為 true
  let shardModalMembers = []; // [{ charId, entryIndex, recordKey, name, value, lastWeek }] 正式角色清單，Guest 不在這裡面（份數用剩下的自動算）

  window.openShardShareModal = function(recordKey, pendingComplete) {
    const record = window.store.weeklyRecords ? window.store.weeklyRecords[recordKey] : null;
    if (!record) return;

    const boss = window.config.bosses.find(b => b.id === record.bossId);
    if (!boss || !boss.erionVestiges) return;

    editingShardRecordKey = recordKey;
    shardModalPendingComplete = !!pendingComplete;

    const maxPartySize = boss.maxPartySize || 1;
    const unitShare = boss.erionVestiges / maxPartySize;

    const titleEl = document.getElementById("shardShareTitle");
    if (titleEl) titleEl.innerText = `🔹 ${boss.name} - 分配這次撿取的艾里溫碎片份數`;

    const team = window.store.teams ? window.store.teams[record.teamId] : null;
    const rawMembers = team ? (team.memberTargets || (team.memberCharIds || []).map(id => ({ charId: id, entryIndex: record.entryIndex }))) : [];
    const validMembers = rawMembers.filter(m => {
      if (!m.charId.startsWith("guest_")) return true;
      return window.store.guests && window.store.guests.some(g => g.id === m.charId);
    });

    const formalMembers = validMembers.filter(m => !m.charId.startsWith("guest_"));
    const guestCount = validMembers.length - formalMembers.length;
    const fairAverage = maxPartySize / (validMembers.length || 1);

    // 每個正式角色的初始值：優先用他自己已經存的 shardShares，沒有的話用公平平均值（四捨五入）當起點
    shardModalMembers = formalMembers.map(m => {
      const memberRecKey = `rec_${m.charId}_${boss.id}_${m.entryIndex}`;
      const memberRec = window.store.weeklyRecords ? window.store.weeklyRecords[memberRecKey] : null;
      const currentValue = memberRec && memberRec.shardShares !== null && memberRec.shardShares !== undefined
        ? memberRec.shardShares
        : Math.round(fairAverage);
      const lastWeek = memberRec && memberRec.lastWeekShardShares !== null && memberRec.lastWeekShardShares !== undefined
        ? memberRec.lastWeekShardShares
        : null;
      // 建議份數：上週拿得比公平平均多的人，這週建議少拿一點；拿得比較少的人建議多拿一點（沒有上週紀錄就不給建議）
      const suggested = lastWeek !== null
        ? (lastWeek > fairAverage ? Math.floor(fairAverage) : Math.ceil(fairAverage))
        : null;
      return { charId: m.charId, entryIndex: m.entryIndex, recordKey: memberRecKey, name: getCharName(m.charId), value: currentValue, lastWeek, suggested };
    });

    renderShardShareEditor(boss, guestCount);

    const modal = document.getElementById("shardShareModal");
    if (modal) modal.style.display = "flex";
  };

  function renderShardShareEditor(boss, guestCount) {
    const maxPartySize = boss.maxPartySize || 1;
    const container = document.getElementById("shardShareOptions");
    if (!container) return;

    let html = `<div class="shard-editor-list">`;
    shardModalMembers.forEach((m, idx) => {
      const lastWeekLabel = m.lastWeek !== null ? `上週 ${m.lastWeek} 份` : "上週無紀錄";
      const suggestedTag = (m.suggested !== null && m.suggested !== m.value)
        ? `<span class="shard-suggested-tag" onclick="applySuggestedShare(${idx})" title="點一下套用建議份數">建議 ${m.suggested} 份</span>`
        : '';

      let optionsHtml = '';
      for (let i = 0; i <= maxPartySize; i++) {
        const isSelected = (m.value === i) ? 'selected' : '';
        optionsHtml += `<option value="${i}" ${isSelected}>${i} 份</option>`;
      }

      html += `
        <div class="shard-editor-row">
          <div class="shard-editor-name">${m.name}<span class="shard-editor-lastweek">${lastWeekLabel}</span>${suggestedTag}</div>
          <select class="shard-editor-select" onchange="updateShardMemberValue(${idx}, this.value)">
            ${optionsHtml}
          </select>
        </div>
      `;
    });

    if (guestCount > 0) {
      html += `
        <div class="shard-editor-row shard-editor-guest-row">
          <div class="shard-editor-name">Guest（共 ${guestCount} 位）<span class="shard-editor-lastweek">沒有自己的紀錄，拿剩下的份數</span></div>
          <div class="shard-editor-guest-value" id="shardGuestRemainder">-</div>
        </div>
      `;
    }

    html += `</div><div class="shard-editor-total" id="shardEditorTotal"></div>`;
    container.innerHTML = html;

    updateShardEditorTotal(boss, guestCount);
  }

  window.updateShardMemberValue = function(idx, rawValue) {
    if (!editingShardRecordKey) return;
    const record = window.store.weeklyRecords[editingShardRecordKey];
    if (!record) return;
    const boss = window.config.bosses.find(b => b.id === record.bossId);
    if (!boss) return;

    const n = parseInt(rawValue, 10);
    shardModalMembers[idx].value = isNaN(n) ? 0 : Math.max(0, n);

    const team = window.store.teams[record.teamId];
    const rawMembers = team.memberTargets || (team.memberCharIds || []).map(id => ({ charId: id }));
    const guestCount = rawMembers.filter(m => m.charId.startsWith("guest_")).length;

    updateShardEditorTotal(boss, guestCount);
  };

  // 點「建議」標籤：直接把該成員的份數改成建議值，並重繪整個編輯區（含輸入框顯示值跟總計）
  window.applySuggestedShare = function(idx) {
    if (!editingShardRecordKey) return;
    const record = window.store.weeklyRecords[editingShardRecordKey];
    if (!record) return;
    const boss = window.config.bosses.find(b => b.id === record.bossId);
    if (!boss) return;

    const m = shardModalMembers[idx];
    if (!m || m.suggested === null || m.suggested === undefined) return;
    m.value = m.suggested;

    const team = window.store.teams[record.teamId];
    const rawMembers = team.memberTargets || (team.memberCharIds || []).map(id => ({ charId: id }));
    const guestCount = rawMembers.filter(mm => mm.charId.startsWith("guest_")).length;

    renderShardShareEditor(boss, guestCount);
  };

  function updateShardEditorTotal(boss, guestCount) {
    const maxPartySize = boss.maxPartySize || 1;
    const formalTotal = shardModalMembers.reduce((sum, m) => sum + (m.value || 0), 0);
    const remainder = maxPartySize - formalTotal;

    const guestEl = document.getElementById("shardGuestRemainder");
    if (guestEl) guestEl.innerText = remainder >= 0 ? `${remainder} 份` : `⚠️ 超過`;

    const totalEl = document.getElementById("shardEditorTotal");
    let isValid;
    if (guestCount > 0) {
      isValid = remainder >= 0;
      if (totalEl) totalEl.innerText = `正式角色合計 ${formalTotal} 份 + Guest ${Math.max(remainder, 0)} 份 = ${formalTotal + Math.max(remainder, 0)} / ${maxPartySize} 份`;
    } else {
      isValid = formalTotal === maxPartySize;
      if (totalEl) totalEl.innerText = `目前合計 ${formalTotal} / ${maxPartySize} 份`;
    }
    if (totalEl) totalEl.className = "shard-editor-total " + (isValid ? "valid" : "invalid");

    const confirmBtn = document.getElementById("shardConfirmBtn");
    if (confirmBtn) confirmBtn.disabled = !isValid;
  }

  window.closeShardShareModal = function() {
    const modal = document.getElementById("shardShareModal");
    if (modal) modal.style.display = "none";
    editingShardRecordKey = null;
    shardModalPendingComplete = false;
    shardModalMembers = [];
  };

  // 按下「確定」才真的寫入：每個正式角色各自的份數，以及（如果是完成流程觸發的）一起把整隊的完成狀態設為 true
  window.confirmShardShare = function() {
    if (!editingShardRecordKey) return;
    const record = window.store.weeklyRecords[editingShardRecordKey];
    if (!record) return;

    const boss = window.config.bosses.find(b => b.id === record.bossId);
    if (!boss) return;

    const maxPartySize = boss.maxPartySize || 1;
    const formalTotal = shardModalMembers.reduce((sum, m) => sum + (m.value || 0), 0);

    const team = window.store.teams[record.teamId];
    const rawMembers = team.memberTargets || (team.memberCharIds || []).map(id => ({ charId: id }));
    const guestCount = rawMembers.filter(m => m.charId.startsWith("guest_")).length;

    if (guestCount > 0) {
      if (formalTotal > maxPartySize) {
        alert(`正式角色的份數加起來（${formalTotal}）已經超過總份數（${maxPartySize}）了，請調整！`);
        return;
      }
    } else if (formalTotal !== maxPartySize) {
      alert(`份數合計要剛好等於 ${maxPartySize} 份，目前是 ${formalTotal} 份，請調整！`);
      return;
    }

    // 有人這次選的份數跟自己上週一樣，二次確認一下
    const sameAsLastWeekNames = shardModalMembers
      .filter(m => m.lastWeek !== null && m.lastWeek === m.value)
      .map(m => m.name);

    if (sameAsLastWeekNames.length > 0) {
      const confirmed = confirm(`${sameAsLastWeekNames.join("、")} 這次選的份數跟上週一樣，連續兩週一樣可能會讓分配不公平，確定要維持嗎？`);
      if (!confirmed) return;
    }

    shardModalMembers.forEach(m => {
      const memberRec = window.store.weeklyRecords[m.recordKey];
      if (memberRec) memberRec.shardShares = m.value;
    });

    if (shardModalPendingComplete) {
      Object.values(window.store.weeklyRecords).forEach(r => {
        if (r.teamId === record.teamId) {
          r.isCompleted = true;
        }
      });
    }

    saveStoreToCloud();
    window.closeShardShareModal();
  };

  // ==================== Modal 與操控邏輯 (重點重構區) ====================
  let editingCharId = null;
  let editingBossId = null;
  let editingEntry = 1;
  let coveredByOtherTeams = new Set(); // 「現有隊伍快速加入」清單裡，屬於別隊（不是正在編輯這隊）的成員，這些人如果還沒被勾選，個別清單就不重複列出

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

  function renderPartySelectList(initialMemberTargets = [], autoCheckGuestId = null, isFreshOpen = false) {
      const listContainer = document.getElementById("partySelectList");
      const guestContainer = document.getElementById("guestSelectList");
      if (!listContainer || !guestContainer) return;

      const boss = window.config.bosses.find(b => b.id === editingBossId);
      const maxPartySize = boss ? boss.maxPartySize : 1;

      let checkedKeys = [];
      if (isFreshOpen) {
        checkedKeys = initialMemberTargets.map(m => `${m.charId}_${m.entryIndex}`);
      } else {
        const existingCheckboxes = document.querySelectorAll('input[name="partyChar"]:checked');
        if (existingCheckboxes.length > 0) {
          checkedKeys = Array.from(existingCheckboxes).map(cb => cb.value);
        } else {
          checkedKeys = initialMemberTargets.map(m => `${m.charId}_${m.entryIndex}`);
        }
      }

      if (autoCheckGuestId && !checkedKeys.includes(`${autoCheckGuestId}_1`)) {
        checkedKeys.push(`${autoCheckGuestId}_1`);
      }

      // 💡 在標題區塊新增紅字警告提示 (預設 display: none)
      let html = `
        <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 8px;">
          該 BOSS 人數上限為 <b style="color: var(--title-color);">${maxPartySize}</b> 人
          <span id="partyLimitWarning" style="display: none; color: #ef4444; font-weight: bold; margin-left: 6px; background: rgba(239, 68, 68, 0.1); padding: 2px 6px; border-radius: 4px; border: 1px solid rgba(239, 68, 68, 0.2);">
            ⚠️ 已達隊伍人數上限
          </span>
        </div>
        <div style="font-weight: bold; font-size: 13px; margin-bottom: 6px; color: var(--title-color);">⚔️ 正式角色與攻略輪次：</div>
      `;

      const allChars = getAllCharacters();
      
      allChars.forEach(c => {
        const hasNormal = c.bossIds && c.bossIds.includes(editingBossId);
        const hasReset = c.resetBossIds && c.resetBossIds.includes(editingBossId);
        if (!hasNormal && !hasReset) return;

        const availableEntries = [];
        if (hasNormal) availableEntries.push(1);
        if (hasReset) availableEntries.push(2);

        availableEntries.forEach(entryIdx => {
          const targetKey = `${c.id}_${entryIdx}`;
          const isSelf = (c.id === editingCharId && entryIdx === editingEntry);

          // 檢查該角色此卡片是否已屬於「其他已滿員的隊伍」
          if (!isSelf) {
            const targetRecKey = `rec_${c.id}_${editingBossId}_${entryIdx}`;
            const targetRec = window.store.weeklyRecords ? window.store.weeklyRecords[targetRecKey] : null;
            
            if (targetRec && targetRec.teamId) {
              const targetTeam = window.store.teams ? window.store.teams[targetRec.teamId] : null;
              if (targetTeam) {
                const members = targetTeam.memberTargets || (targetTeam.memberCharIds || []).map(id => ({ charId: id, entryIndex: entryIdx }));
                const isSelfInTargetTeam = members.some(m => m.charId === editingCharId && m.entryIndex === editingEntry);

                if (!isSelfInTargetTeam && members.length >= maxPartySize) {
                  return; // 跳過不渲染此選項
                }
              }
            }
          }

          const isChecked = isSelf || checkedKeys.includes(targetKey);

          // 這個人已經被「別隊」的快速加入按鈕涵蓋到了，而且目前還沒被勾選，個別清單就不重複列出
          // （已經勾選的人一律照常顯示，避免存檔時漏掉已經選取的成員）
          if (!isSelf && !isChecked && coveredByOtherTeams.has(targetKey)) {
            return;
          }

          const labelStyle = isSelf 
            ? 'cursor: not-allowed; font-size: 13px; display: flex; align-items: center; gap: 6px; opacity: 0.6; font-weight: bold;' 
            : 'cursor: pointer; font-size: 13px; display: flex; align-items: center; gap: 6px;';

          const entryTag = entryIdx === 2 ? ' (重置刷)' : ' (首次刷)';

          html += `
            <label style="${labelStyle}">
              <input type="checkbox" name="partyChar" value="${targetKey}" 
                    data-is-self="${isSelf}"
                    ${isChecked ? 'checked' : ''} 
                    ${isSelf ? 'disabled' : ''} 
                    onchange="updatePartyCheckboxStates()">
              ${c.name} (${c.playerName})${entryTag} ${isSelf ? '✨(隊長)' : ''}
            </label>`;
        });
      });

      listContainer.innerHTML = html;

      let guestHtml = `
        <div style="font-weight: bold; font-size: 13px; margin-bottom: 6px; color: var(--title-color);">👤 Guest 臨時隊友：</div>
        <div style="display: flex; gap: 6px; margin-bottom: 8px;">
          <input type="text" id="newGuestNameInput" placeholder="輸入 Guest 名字" style="flex: 1; padding: 5px 8px; font-size: 12px; border-radius: 6px; border: 1px solid var(--border-color); background: var(--input-bg); color: var(--text-main);" onkeypress="if(event.key==='Enter'){ event.preventDefault(); addGuestMember(); }" />
          <button class="btn" style="padding: 4px 10px; font-size: 12px; white-space: nowrap;" onclick="addGuestMember()">➕ 新增</button>
        </div>
        <div style="display: flex; flex-direction: column; gap: 6px;">
      `;

      if (window.store && window.store.guests && window.store.guests.length > 0) {
        window.store.guests.forEach(g => {
          const targetKey = `${g.id}_1`;
          const isChecked = checkedKeys.includes(targetKey);
          guestHtml += `
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <label style="cursor:pointer; font-size: 13px; display: flex; align-items: center; gap: 6px; color: #0284c7;">
                <input type="checkbox" name="partyChar" value="${targetKey}" 
                      data-is-self="false"
                      ${isChecked ? 'checked' : ''} 
                      onchange="updatePartyCheckboxStates()">
                ${g.name} <span style="font-size:11px; color:var(--text-muted);">(Guest)</span>
              </label>
              <button onclick="deleteGuestMember('${g.id}')" style="background: transparent; border: none; cursor: pointer; font-size: 12px; color: #ef4444;" title="刪除 Guest 隊友">🗑️</button>
            </div>`;
        });
      } else {
        guestHtml += `<div style="font-size: 12px; color: var(--text-muted); font-style: italic;">目前尚無 Guest 隊友，可在上方輸入新增。</div>`;
      }
      guestHtml += `</div>`;

      guestContainer.innerHTML = guestHtml;

      // 渲染完成後立刻刷新一次狀態
      updatePartyCheckboxStates();
    }

  window.addGuestMember = function() {
    const input = document.getElementById("newGuestNameInput");
    if (!input) return;
    const guestName = input.value.trim();
    if (!guestName) {
      alert("請輸入 Guest 名字！");
      return;
    }
    if (!window.store.guests) window.store.guests = [];
    
    let guestObj = window.store.guests.find(g => g.name === guestName);
    if (!guestObj) {
      guestObj = { id: `guest_${Date.now()}`, name: guestName };
      window.store.guests.push(guestObj);
      saveStoreToCloud();
    }
    input.value = "";
    renderPartySelectList([], guestObj.id);
  };

  window.deleteGuestMember = function(guestId) {
    if (!confirm("確定要刪除此 Guest 隊友嗎？(已存在該 Guest 的隊伍將會自動移除此隊友)")) return;
    if (window.store) {
      if (window.store.guests) {
        window.store.guests = window.store.guests.filter(g => g.id !== guestId);
      }
      if (window.store.teams) {
        Object.values(window.store.teams).forEach(team => {
          if (team) {
            if (team.memberTargets) {
              team.memberTargets = team.memberTargets.filter(m => m.charId !== guestId);
            }
            if (team.memberCharIds) {
              team.memberCharIds = team.memberCharIds.filter(id => id !== guestId);
            }
          }
        });
      }
      saveStoreToCloud();
      renderPartySelectList();
      renderApp();
    }
  };

  // ==========================================
  // 手機長按 (Long Press) 模擬右鍵 —— 開啟組隊編輯 modal
  // ==========================================
  let longPressTimer = null;
  let longPressFired = false;
  let longPressStartPos = null;
  let longPressCellEl = null;
  const LONG_PRESS_DURATION = 500; // ms
  const LONG_PRESS_MOVE_TOLERANCE = 10; // px

  function handleCellTouchStart(event, charId, bossId, entryIndex) {
    if (event.touches.length !== 1) return;
    longPressFired = false;
    longPressStartPos = { x: event.touches[0].clientX, y: event.touches[0].clientY };
    longPressCellEl = event.currentTarget;

    clearTimeout(longPressTimer);
    longPressTimer = setTimeout(() => {
      longPressFired = true;
      if (longPressCellEl) longPressCellEl.classList.add('long-press-active');
      if (window.navigator && window.navigator.vibrate) window.navigator.vibrate(15);
      openPartyModal(event, charId, bossId, entryIndex);
    }, LONG_PRESS_DURATION);
  }

  function handleCellTouchMove(event) {
    if (!longPressStartPos || event.touches.length !== 1) return;
    const dx = Math.abs(event.touches[0].clientX - longPressStartPos.x);
    const dy = Math.abs(event.touches[0].clientY - longPressStartPos.y);
    if (dx > LONG_PRESS_MOVE_TOLERANCE || dy > LONG_PRESS_MOVE_TOLERANCE) {
      clearTimeout(longPressTimer);
    }
  }

  function handleCellTouchEnd(event) {
    clearTimeout(longPressTimer);
    if (longPressCellEl) longPressCellEl.classList.remove('long-press-active');
    if (longPressFired) {
      // 長按已經開啟過 modal，阻止接下來的 click 事件觸發 toggleBossStatus
      event.preventDefault();
    }
    longPressCellEl = null;
    longPressStartPos = null;
  }

  function openPartyModal(event, charId, bossId, entryIndex) {
    event.preventDefault();
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

    const autoMergedNames = [];
    selectedTargets.forEach(sel => {
      if (sel.charId === editingCharId) return;
      const oldMembers = oldTeamsByTarget.get(targetKey(sel)) || [];
      oldMembers.forEach(m => {
        // 💡 Guest 在這個組隊視窗裡永遠都是可見、可以自己勾/取消的選項（不像正式角色可能因為沒排定這隻 BOSS 而完全不會出現），
        //    所以不強制把 Guest 合併回來，尊重使用者當下實際的勾選狀態，避免明明取消勾選了、存檔後又被偷偷加回去
        if (m.charId.startsWith("guest_")) return;
        if (finalMap.has(targetKey(m))) return;

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
      const oldRecord = window.store.weeklyRecords[recKey];
      window.store.weeklyRecords[recKey] = {
        charId: target.charId,
        bossId: editingBossId,
        entryIndex: target.entryIndex,
        teamId: sharedTeamId,
        isCompleted: oldRecord ? oldRecord.isCompleted : false,
        shardShares: (oldRecord && oldRecord.shardShares !== undefined) ? oldRecord.shardShares : null,
        lastWeekShardShares: (oldRecord && oldRecord.lastWeekShardShares !== undefined) ? oldRecord.lastWeekShardShares : null
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
        shardShares: (oldRecord && oldRecord.shardShares !== undefined) ? oldRecord.shardShares : null,
        lastWeekShardShares: (oldRecord && oldRecord.lastWeekShardShares !== undefined) ? oldRecord.lastWeekShardShares : null
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
