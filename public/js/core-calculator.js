/**
 * core-calculator.js
 * Contains: calculateCharacterCrystal, formatCrystal, calculateCharacterShard, formatShardNumber, getCharacterCompletedCount, getRemovedCompletedBosses
 */

function getCharacterCompletedCount(charId) {
  let count = 0;
  if (!window.store.weeklyRecords) return 0;
  
  Object.values(window.store.weeklyRecords).forEach(record => {
    if (record && record.charId === charId && record.isCompleted) {
      count++;
    }
  });
  return count;
}

// 找出角色「本週已完成，但已經被移出 BOSS 清單」的紀錄（只顯示、不可再互動切換）
function getRemovedCompletedBosses(c) {
  const removed = [];
  if (!window.store.weeklyRecords) return removed;

  Object.values(window.store.weeklyRecords).forEach(record => {
    if (!record || record.charId !== c.id || !record.isCompleted) return;

    const stillAssigned = record.entryIndex === 2
      ? (c.resetBossIds && c.resetBossIds.includes(record.bossId))
      : (!c.bossIds || c.bossIds.length === 0 || c.bossIds.includes(record.bossId));

    if (stillAssigned) return;

    const boss = window.config.bosses.find(b => b.id === record.bossId);
    if (!boss) return;

    removed.push(record.entryIndex === 2 ? `${boss.name}(重置)` : boss.name);
  });

  return removed;
}

// 把原始結晶錢數值格式化成「萬」，保留一位小數（例：3333333 -> "333.3萬"）
// 把原始結晶錢數值格式化成「億萬」，超過 1 億會拆成 X億Y.Y萬，沒到 1 億就只顯示 Y.Y萬
function formatCrystal(rawValue) {
  const manValue = rawValue / 10000; // 換算成「萬」為單位
  const yi = Math.floor(manValue / 10000);
  const remainderMan = manValue - yi * 10000;

  if (yi > 0) {
    return `${yi}億${remainderMan.toFixed(1)}萬`;
  }
  return `${manValue.toFixed(1)}萬`;
}

// 計算角色本週的結晶錢：已收入（只算完成的）、預計收入（不管完成與否，全部排定的都算）
// 邏輯跟角色卡片實際渲染 boss-cell 的判斷條件完全一致，確保數字跟畫面上顯示的格子永遠對得上
function calculateCharacterCrystal(c) {
  let earned = 0;
  let expected = 0;

  window.config.bosses.forEach(boss => {
    if (!boss.crystalValue) return;

    const inBossIds = !c.bossIds || c.bossIds.length === 0 || c.bossIds.includes(boss.id);
    const inResetBossIds = c.resetBossIds && c.resetBossIds.includes(boss.id);
    if (!inBossIds && !inResetBossIds) return;

    const maxEntries = boss.allowReset ? 2 : 1;

    for (let entry = 1; entry <= maxEntries; entry++) {
      if (entry === 1 && !inBossIds) continue;
      if (entry === 2 && !inResetBossIds) continue;

      const recordKey = `rec_${c.id}_${boss.id}_${entry}`;
      const record = window.store.weeklyRecords ? window.store.weeklyRecords[recordKey] : null;
      const team = record && window.store.teams ? window.store.teams[record.teamId] : null;
      if (!record || !team) continue;

      const rawMembers = team.memberTargets || (team.memberCharIds || []).map(id => ({ charId: id, entryIndex: entry }));
      // Guest 也算一份，均分人數用實際還存在的隊員數（跟畫面上「隊伍成員」顯示邏輯一致）
      const validMembers = rawMembers.filter(m => {
        if (!m.charId.startsWith("guest_")) return true;
        return window.store.guests && window.store.guests.some(g => g.id === m.charId);
      });

      const teamSize = validMembers.length > 0 ? validMembers.length : 1;
      const share = boss.crystalValue / teamSize;

      expected += share;
      if (record.isCompleted) earned += share;
    }
  });

  return { earned, expected };
}

// 把艾里溫碎片數量格式化成整數（碎片數量通常不大，不需要像結晶錢那樣換算成萬/億）
function formatShardNumber(rawValue) {
  return Math.round(rawValue).toLocaleString("zh-TW");
}

// 計算角色本週的艾里溫碎片：
// - 碎片的「每份」固定是 boss.erionVestiges / boss.maxPartySize（跟實際到場人數無關，是 BOSS 固定掉落的份數）
// - 單人隊伍（實際到場只有自己）：視為撿走全部（maxPartySize 份），跟結晶錢一樣自動算滿額
// - 多人隊伍：預計金額固定用「1 份」當基準（因為實際會撿幾份要等使用者手動選擇），
//   已完成的部分則改用使用者實際選擇的份數（record.shardShares），還沒選就先當 1 份
function calculateCharacterShard(c) {
  let earned = 0;
  let expected = 0;

  window.config.bosses.forEach(boss => {
    if (!boss.erionVestiges) return;

    const inBossIds = !c.bossIds || c.bossIds.length === 0 || c.bossIds.includes(boss.id);
    const inResetBossIds = c.resetBossIds && c.resetBossIds.includes(boss.id);
    if (!inBossIds && !inResetBossIds) return;

    const maxEntries = boss.allowReset ? 2 : 1;
    const maxPartySize = boss.maxPartySize || 1;
    const unitShare = boss.erionVestiges / maxPartySize;

    for (let entry = 1; entry <= maxEntries; entry++) {
      if (entry === 1 && !inBossIds) continue;
      if (entry === 2 && !inResetBossIds) continue;

      const recordKey = `rec_${c.id}_${boss.id}_${entry}`;
      const record = window.store.weeklyRecords ? window.store.weeklyRecords[recordKey] : null;
      const team = record && window.store.teams ? window.store.teams[record.teamId] : null;
      if (!record || !team) continue;

      const rawMembers = team.memberTargets || (team.memberCharIds || []).map(id => ({ charId: id, entryIndex: entry }));
      const validMembers = rawMembers.filter(m => {
        if (!m.charId.startsWith("guest_")) return true;
        return window.store.guests && window.store.guests.some(g => g.id === m.charId);
      });

      const isSolo = validMembers.length <= 1;

      expected += isSolo ? boss.erionVestiges : unitShare;

      if (record.isCompleted) {
        if (record.shardMode === 'quantity') {
          const hasChosenQty = record.shardQuantity !== null && record.shardQuantity !== undefined;
          earned += isSolo ? boss.erionVestiges : (hasChosenQty ? record.shardQuantity : unitShare);
        } else {
          const hasChosen = record.shardShares !== null && record.shardShares !== undefined;
          const shares = isSolo ? maxPartySize : (hasChosen ? record.shardShares : 1);
          earned += unitShare * shares;
        }
      }
    }
  });

  return { earned, expected };
}
