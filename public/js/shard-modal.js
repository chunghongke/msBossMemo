/**
 * shard-modal.js
 * Extracted shard share modal logic.
 * Functions: openShardShareModal, switchShardMode, renderShardShareEditor,
 *            updateShardMemberValue, applySuggestedShare, updateShardEditorTotal,
 *            closeShardShareModal, confirmShardShare
 *
 * 支援：shardMode ('shares' | 'quantity') 與 shardQuantity（數量模式下的實際碎片數）
 * 防呆：無論份數或數量模式，全體成員分配合計不得超過 BOSS 掉落總量
 */

// ==================== 艾里溫碎片：份數/數量選擇彈窗 ====================
let editingShardRecordKey = null;
let shardModalPendingComplete = false;
let shardModalMembers = []; // [{ charId, entryIndex, recordKey, name, value, lastWeek, suggested, quantity, lastWeekQuantity, quantityCustomized }]
let currentShardMode = 'shares'; // 'shares' | 'quantity'
let currentShardBoss = null;
let currentShardGuestCount = 0;

window.openShardShareModal = function(recordKey, pendingComplete) {
  const record = window.store.weeklyRecords ? window.store.weeklyRecords[recordKey] : null;
  if (!record) return;

  const boss = window.config.bosses.find(b => b.id === record.bossId);
  if (!boss || !boss.erionVestiges) return;

  editingShardRecordKey = recordKey;
  shardModalPendingComplete = !!pendingComplete;
  currentShardBoss = boss;

  const maxPartySize = boss.maxPartySize || 1;
  const totalShards = boss.erionVestiges;
  const titleEl = document.getElementById("shardShareTitle");
  if (titleEl) titleEl.innerText = `🔹 ${boss.name} - 艾里溫碎片分配`;

  const team = window.store.teams ? window.store.teams[record.teamId] : null;
  const rawMembers = team ? (team.memberTargets || (team.memberCharIds || []).map(id => ({ charId: id, entryIndex: record.entryIndex }))) : [];
  const validMembers = rawMembers.filter(m => {
    if (!m.charId.startsWith("guest_")) return true;
    return window.store.guests && window.store.guests.some(g => g.id === m.charId);
  });

  const formalMembers = validMembers.filter(m => !m.charId.startsWith("guest_"));
  currentShardGuestCount = validMembers.length - formalMembers.length;
  const fairAvg = maxPartySize / (validMembers.length || 1);
  const unitShare = totalShards / maxPartySize;

  // 讀取隊伍當前的 shardMode（以 triggerRecord 為準，若無則預設 shares）
  currentShardMode = record.shardMode || 'shares';

  // 1. 檢查既有 shares 是否為合法分配
  let hasValidSharesSetup = true;
  let existingSharesSum = 0;
  formalMembers.forEach(m => {
    const memberRecKey = `rec_${m.charId}_${boss.id}_${m.entryIndex}`;
    const memberRec = window.store.weeklyRecords ? window.store.weeklyRecords[memberRecKey] : null;
    if (memberRec && memberRec.shardShares !== null && memberRec.shardShares !== undefined) {
      existingSharesSum += memberRec.shardShares;
    } else {
      hasValidSharesSetup = false;
    }
  });
  const isSharesSumValid = (currentShardGuestCount > 0)
    ? (hasValidSharesSetup && existingSharesSum <= maxPartySize)
    : (hasValidSharesSetup && existingSharesSum === maxPartySize);

  // 2. 檢查既有 quantity 是否為合法分配
  let hasValidQtySetup = true;
  let existingQtySum = 0;
  formalMembers.forEach(m => {
    const memberRecKey = `rec_${m.charId}_${boss.id}_${m.entryIndex}`;
    const memberRec = window.store.weeklyRecords ? window.store.weeklyRecords[memberRecKey] : null;
    if (memberRec && memberRec.shardQuantity !== null && memberRec.shardQuantity !== undefined) {
      existingQtySum += memberRec.shardQuantity;
    } else {
      hasValidQtySetup = false;
    }
  });
  const isQtySumValid = (currentShardGuestCount > 0)
    ? (hasValidQtySetup && existingQtySum <= totalShards)
    : (hasValidQtySetup && existingQtySum === totalShards);

  // 3. 預設份數分配計算（確保初始合計不超標）
  let defaultSharesList = [];
  if (isSharesSumValid) {
    defaultSharesList = formalMembers.map(m => {
      const rec = window.store.weeklyRecords[`rec_${m.charId}_${boss.id}_${m.entryIndex}`];
      return rec.shardShares;
    });
  } else {
    const baseShare = Math.floor(maxPartySize / (validMembers.length || 1));
    let remainingShares = maxPartySize - (baseShare * validMembers.length);
    defaultSharesList = formalMembers.map(() => {
      let s = baseShare;
      if (remainingShares > 0) {
        s += 1;
        remainingShares -= 1;
      }
      return s;
    });
  }

  // 4. 預設數量分配計算（若已有儲存紀錄則載入，否則一律依人數均分總碎片數，如 90 片 2 人各 45 片）
  let defaultQtyList = [];
  if (isQtySumValid) {
    defaultQtyList = formalMembers.map(m => {
      const rec = window.store.weeklyRecords[`rec_${m.charId}_${boss.id}_${m.entryIndex}`];
      return rec.shardQuantity;
    });
  } else {
    const baseQty = Math.floor(totalShards / (validMembers.length || 1));
    let remainingQty = totalShards - (baseQty * validMembers.length);
    defaultQtyList = formalMembers.map(() => {
      let q = baseQty;
      if (remainingQty > 0) {
        q += 1;
        remainingQty -= 1;
      }
      return q;
    });
  }

  shardModalMembers = formalMembers.map((m, idx) => {
    const memberRecKey = `rec_${m.charId}_${boss.id}_${m.entryIndex}`;
    const memberRec = window.store.weeklyRecords ? window.store.weeklyRecords[memberRecKey] : null;

    const currentShares = defaultSharesList[idx];
    const lastWeek = memberRec && memberRec.lastWeekShardShares !== null && memberRec.lastWeekShardShares !== undefined
      ? memberRec.lastWeekShardShares : null;
    const suggested = lastWeek !== null
      ? (lastWeek > fairAvg ? Math.floor(fairAvg) : Math.ceil(fairAvg))
      : null;

    const currentQuantity = defaultQtyList[idx];
    const lastWeekQuantity = memberRec && memberRec.lastWeekShardQuantity !== null && memberRec.lastWeekShardQuantity !== undefined
      ? memberRec.lastWeekShardQuantity : null;

    return {
      charId: m.charId,
      entryIndex: m.entryIndex,
      recordKey: memberRecKey,
      name: getCharName(m.charId),
      value: currentShares,       // 份數
      lastWeek,                   // 上週份數
      suggested,                  // 建議份數
      quantity: currentQuantity,  // 數量
      lastWeekQuantity,           // 上週數量
      quantityCustomized: isQtySumValid
    };
  });

  renderShardModeButtons();
  renderShardShareEditor(boss, currentShardGuestCount);

  const modal = document.getElementById("shardShareModal");
  if (modal) modal.style.display = "flex";
};

// ==================== 模式切換按鈕 ====================
function renderShardModeButtons() {
  const sharesBtn = document.getElementById("shardModeSharesBtn");
  const quantityBtn = document.getElementById("shardModeQuantityBtn");
  const activeStyle = "background: #3b82f6; color: #fff;";
  const inactiveStyle = "background: var(--card-bg); color: var(--text-muted);";
  if (sharesBtn) sharesBtn.style.cssText += currentShardMode === 'shares' ? activeStyle : inactiveStyle;
  if (quantityBtn) quantityBtn.style.cssText += currentShardMode === 'quantity' ? activeStyle : inactiveStyle;
}

window.switchShardMode = function(mode) {
  if (currentShardMode === mode) return;
  const boss = currentShardBoss;
  if (boss) {
    const totalShards = boss.erionVestiges;
    if (mode === 'quantity') {
      // 份數 -> 數量：若數量尚未自訂過，直接依人數均分總碎片數
      const isCustomized = shardModalMembers.some(m => m.quantityCustomized);
      if (!isCustomized) {
        const totalPeople = (currentShardGuestCount || 0) + shardModalMembers.length || 1;
        const baseQty = Math.floor(totalShards / totalPeople);
        let remainingQty = totalShards - (baseQty * totalPeople);
        shardModalMembers.forEach(m => {
          let q = baseQty;
          if (remainingQty > 0) {
            q += 1;
            remainingQty -= 1;
          }
          m.quantity = q;
        });
      }
    }
  }
  currentShardMode = mode;
  renderShardModeButtons();
  renderShardShareEditor(currentShardBoss, currentShardGuestCount);
};

// ==================== 渲染編輯器 ====================
function renderShardShareEditor(boss, guestCount) {
  const maxPartySize = boss.maxPartySize || 1;
  const totalShards = boss.erionVestiges;
  const container = document.getElementById("shardShareOptions");
  if (!container) return;

  let html = `<div class="shard-editor-list">`;

  if (currentShardMode === 'shares') {
    // ---- 份數模式 ----
    shardModalMembers.forEach((m, idx) => {
      const lastWeekLabel = m.lastWeek !== null ? `上週 ${m.lastWeek} 份` : "上週無紀錄";
      const suggestedTag = (m.suggested !== null && m.suggested !== m.value)
        ? `<span class="shard-suggested-tag" onclick="applySuggestedShare(${idx})" title="點一下套用建議份數">建議 ${m.suggested} 份</span>`
        : '';
      let optionsHtml = '';
      for (let i = 0; i <= maxPartySize; i++) {
        optionsHtml += `<option value="${i}" ${m.value === i ? 'selected' : ''}>${i} 份</option>`;
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
  } else {
    // ---- 數量模式 ----
    html += `
      <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 10px; padding: 8px 10px; background: rgba(59,130,246,0.08); border-radius: 6px; border-left: 3px solid #3b82f6;">
        💡 直接輸入本週各隊員實際取得的碎片數量（含交易後）。BOSS 總掉落碎片：<strong>${totalShards}</strong> 個
      </div>
    `;
    shardModalMembers.forEach((m, idx) => {
      const lastWeekLabel = m.lastWeekQuantity !== null ? `上週 ${m.lastWeekQuantity} 個` : "上週無紀錄";
      html += `
        <div class="shard-editor-row">
          <div class="shard-editor-name">${m.name}<span class="shard-editor-lastweek">${lastWeekLabel}</span></div>
          <div style="display: flex; align-items: center; gap: 6px;">
            <input type="number" min="0" max="${totalShards}" value="${m.quantity}"
              style="width: 75px; padding: 5px 8px; border-radius: 6px; border: 1px solid var(--border-color); background: var(--input-bg); color: var(--text-main); font-size: 14px; text-align: center;"
              onchange="updateShardMemberQuantity(${idx}, this.value)"
              oninput="updateShardMemberQuantity(${idx}, this.value)" />
            <span style="font-size: 12px; color: var(--text-muted);">/ ${totalShards} 個</span>
          </div>
        </div>
      `;
    });
    if (guestCount > 0) {
      html += `
        <div class="shard-editor-row shard-editor-guest-row">
          <div class="shard-editor-name">Guest（共 ${guestCount} 位）<span class="shard-editor-lastweek">沒有自己的紀錄，拿剩下的數量</span></div>
          <div class="shard-editor-guest-value" id="shardGuestQtyRemainder">-</div>
        </div>
      `;
    }
  }

  html += `</div><div class="shard-editor-total" id="shardEditorTotal"></div>`;
  container.innerHTML = html;
  updateShardEditorTotal(boss, guestCount);
}

// ==================== 更新值 ====================
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

window.updateShardMemberQuantity = function(idx, rawValue) {
  if (!currentShardBoss) return;
  const totalShards = currentShardBoss.erionVestiges;
  const n = parseInt(rawValue, 10);
  const clamped = isNaN(n) ? 0 : Math.max(0, Math.min(totalShards, n));
  shardModalMembers[idx].quantity = clamped;
  shardModalMembers[idx].quantityCustomized = true;
  updateShardEditorTotal(currentShardBoss, currentShardGuestCount);
};

// 點「建議」標籤
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

// ==================== 合計更新與防呆檢查 ====================
function updateShardEditorTotal(boss, guestCount) {
  const maxPartySize = boss.maxPartySize || 1;
  const totalShards = boss.erionVestiges;
  const totalEl = document.getElementById("shardEditorTotal");
  const confirmBtn = document.getElementById("shardConfirmBtn");

  if (currentShardMode === 'shares') {
    const formalTotal = shardModalMembers.reduce((sum, m) => sum + (m.value || 0), 0);
    const remainder = maxPartySize - formalTotal;
    const guestEl = document.getElementById("shardGuestRemainder");
    if (guestEl) guestEl.innerText = remainder >= 0 ? `${remainder} 份` : `⚠️ 超過`;
    let isValid;
    if (guestCount > 0) {
      isValid = remainder >= 0;
      if (totalEl) totalEl.innerText = `正式角色合計 ${formalTotal} 份 + Guest ${Math.max(remainder, 0)} 份 = ${formalTotal + Math.max(remainder, 0)} / ${maxPartySize} 份`;
    } else {
      isValid = formalTotal === maxPartySize;
      if (totalEl) totalEl.innerText = `目前合計 ${formalTotal} / ${maxPartySize} 份`;
    }
    if (totalEl) totalEl.className = "shard-editor-total " + (isValid ? "valid" : "invalid");
    if (confirmBtn) confirmBtn.disabled = !isValid;
  } else {
    // 數量模式防呆
    const formalQtyTotal = shardModalMembers.reduce((sum, m) => sum + (m.quantity || 0), 0);
    const remainderQty = totalShards - formalQtyTotal;
    const guestQtyEl = document.getElementById("shardGuestQtyRemainder");
    if (guestQtyEl) guestQtyEl.innerText = remainderQty >= 0 ? `${remainderQty} 個` : `⚠️ 超過`;

    let isValid;
    if (guestCount > 0) {
      isValid = remainderQty >= 0 && shardModalMembers.every(m => (m.quantity || 0) >= 0);
      if (totalEl) {
        if (isValid) {
          totalEl.innerText = `正式角色合計 ${formalQtyTotal} 個 + Guest ${remainderQty} 個 = ${totalShards} / ${totalShards} 個`;
        } else {
          totalEl.innerText = `⚠️ 正式角色合計 ${formalQtyTotal} 個，已超過總數 ${totalShards} 個！`;
        }
      }
    } else {
      // 無 Guest：兩人（或全員）合計必須剛好分配完總數 90 片
      isValid = formalQtyTotal === totalShards;
      if (totalEl) {
        if (formalQtyTotal === totalShards) {
          totalEl.innerText = `目前合計 ${formalQtyTotal} / ${totalShards} 個`;
        } else if (formalQtyTotal > totalShards) {
          totalEl.innerText = `⚠️ 目前合計 ${formalQtyTotal} 個，超過總數 ${totalShards} 個！`;
        } else {
          totalEl.innerText = `⚠️ 目前合計 ${formalQtyTotal} / ${totalShards} 個（尚有 ${totalShards - formalQtyTotal} 個未分配）`;
        }
      }
    }
    if (totalEl) totalEl.className = "shard-editor-total " + (isValid ? "valid" : "invalid");
    if (confirmBtn) confirmBtn.disabled = !isValid;
  }
}

// ==================== 關閉 ====================
window.closeShardShareModal = function() {
  const modal = document.getElementById("shardShareModal");
  if (modal) modal.style.display = "none";
  editingShardRecordKey = null;
  shardModalPendingComplete = false;
  shardModalMembers = [];
  currentShardBoss = null;
  currentShardMode = 'shares';
  currentShardGuestCount = 0;
};

// ==================== 確認寫入 ====================
window.confirmShardShare = function() {
  if (!editingShardRecordKey) return;
  const record = window.store.weeklyRecords[editingShardRecordKey];
  if (!record) return;
  const boss = window.config.bosses.find(b => b.id === record.bossId);
  if (!boss) return;
  const maxPartySize = boss.maxPartySize || 1;
  const totalShards = boss.erionVestiges;

  const team = window.store.teams[record.teamId];
  const rawMembers = team.memberTargets || (team.memberCharIds || []).map(id => ({ charId: id }));
  const guestCount = rawMembers.filter(m => m.charId.startsWith("guest_")).length;

  if (currentShardMode === 'shares') {
    const formalTotal = shardModalMembers.reduce((sum, m) => sum + (m.value || 0), 0);
    if (guestCount > 0) {
      if (formalTotal > maxPartySize) {
        alert(`正式角色的份數加起來（${formalTotal}）已經超過總份數（${maxPartySize}）了，請調整！`);
        return;
      }
    } else if (formalTotal !== maxPartySize) {
      alert(`份數合計要剛好等於 ${maxPartySize} 份，目前是 ${formalTotal} 份，請調整！`);
      return;
    }
    // 連兩週一樣的提示
    const sameAsLastWeekNames = shardModalMembers
      .filter(m => m.lastWeek !== null && m.lastWeek === m.value)
      .map(m => m.name);
    if (sameAsLastWeekNames.length > 0) {
      const confirmed = confirm(`${sameAsLastWeekNames.join("、")} 這次選的份數跟上週一樣，連續兩週一樣可能會讓分配不公平，確定要維持嗎？`);
      if (!confirmed) return;
    }
  } else {
    // 數量模式防呆
    const formalQtyTotal = shardModalMembers.reduce((sum, m) => sum + (m.quantity || 0), 0);
    if (guestCount > 0) {
      if (formalQtyTotal > totalShards) {
        alert(`正式角色碎片合計（${formalQtyTotal} 個）已經超過總數量（${totalShards} 個），請調整！`);
        return;
      }
    } else if (formalQtyTotal !== totalShards) {
      alert(`碎片數量合計要剛好等於 ${totalShards} 個，目前是 ${formalQtyTotal} 個，請調整！`);
      return;
    }
  }

  // 寫入每個成員的記錄，並同步 shardMode 給整隊所有正式成員
  shardModalMembers.forEach(m => {
    const memberRec = window.store.weeklyRecords[m.recordKey];
    if (memberRec) {
      memberRec.shardMode = currentShardMode;
      if (currentShardMode === 'shares') {
        memberRec.shardShares = m.value;
      } else {
        memberRec.shardQuantity = m.quantity;
      }
    }
  });

  if (shardModalPendingComplete) {
    Object.values(window.store.weeklyRecords).forEach(r => {
      if (r.teamId === record.teamId) {
        r.isCompleted = true;
      }
    });
  }

  saveStoreToCloud();
  renderApp();
  window.closeShardShareModal();
};
