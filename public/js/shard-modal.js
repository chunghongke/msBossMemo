/**
 * shard-modal.js
 * Extracted shard share modal logic.
 * Functions: openShardShareModal, renderShardShareEditor, updateShardMemberValue, applySuggestedShare, updateShardEditorTotal, closeShardShareModal, confirmShardShare
 */

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
