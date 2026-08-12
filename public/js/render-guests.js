/**
 * render-guests.js
 * 臨時 Guest 隊友清單渲染邏輯
 */

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
