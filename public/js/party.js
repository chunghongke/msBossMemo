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
    const primaryUser = typeof getPrimaryUser === 'function' ? getPrimaryUser() : '';
    if (!primaryUser) {
      alert("⚠️ 請先選擇/登入主要玩家！");
      if (typeof openAuthModal === 'function') openAuthModal();
      return;
    }

    const allChars = typeof getAllCharacters === 'function' ? getAllCharacters() : [];
    const targetChar = allChars.find(c => recordKey.startsWith(`rec_${c.id}_`));
    if (targetChar && targetChar.playerName !== primaryUser) {
      alert("⚠️ 您只能修改自己角色的 BOSS 攻略狀態！");
      return;
    }

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

    renderApp(); // ⚡ 樂觀即時渲染：0ms 立即觸發卡片順序滑動動畫，無須等待雲端網路來回
    saveStoreToCloud();
  }
