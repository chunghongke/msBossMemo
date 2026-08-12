/**
 * party-guest.js
 * Extracted guest teammate management.
 * Functions: window.addGuestMember, window.deleteGuestMember, renderPartySelectList
 */

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
