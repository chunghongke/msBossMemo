/**
 * core-reset.js
 * Contains: getCurrentResetWeekKey, checkAndPerformWeeklyReset, ensureDefaultSingleTeams
 */

// 算出「目前這一週」的識別 key，用最近一次週四 00:00（本地時間）當基準，格式 YYYY-MM-DD
// 這個 key 在同一週內（週四到下週三）都會是同一個值，跨過週四 00:00 就會變成新的值
function getCurrentResetWeekKey() {
  const now = new Date();
  const day = now.getDay(); // 0=週日 ... 4=週四 ... 6=週六
  const daysSinceThursday = (day - 4 + 7) % 7;
  const lastThursday = new Date(now);
  lastThursday.setDate(now.getDate() - daysSinceThursday);
  lastThursday.setHours(0, 0, 0, 0);

  const y = lastThursday.getFullYear();
  const m = String(lastThursday.getMonth() + 1).padStart(2, "0");
  const d = String(lastThursday.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// 偵測是否已經跨過週四重置點：跨了就把「完成狀態」打回未完成，但保留隊伍的指向關係，
// 這樣隊伍名單會自動延續到下一週，不用每週重組。（team id 已改成不含時間戳記的固定值，
// 同一批隊員不會每週疊出一筆新資料，不會有幽靈隊伍問題）
function checkAndPerformWeeklyReset() {
  const currentWeekKey = getCurrentResetWeekKey();

  if (!window.store.lastResetWeekKey) {
    // 第一次套用這個機制：只記錄基準週，不動既有資料，避免部署當下就把當週資料洗掉
    window.store.lastResetWeekKey = currentWeekKey;
    return true;
  }

  if (window.store.lastResetWeekKey !== currentWeekKey) {
    if (window.store.weeklyRecords) {
      Object.values(window.store.weeklyRecords).forEach(rec => {
        if (!rec) return;
        // 💡 艾里溫碎片：如果上週有完成且有選份數（包含選 0 份），先存成 lastWeekShardShares 當提示，
        // 再把本週的選擇清空，讓這週要重新選一次（避免沿用上週的份數造成誤判）
        if (rec.isCompleted && rec.shardShares !== null && rec.shardShares !== undefined) {
          rec.lastWeekShardShares = rec.shardShares;
        }
        rec.shardShares = null;
        rec.isCompleted = false;
      });
    }
    // 💡 隊伍出團時間：新的一週到來時，自動清除所有隊伍的「本週臨時時間」，恢復為常態時間
    if (window.store.teams) {
      Object.values(window.store.teams).forEach(t => {
        if (t && t.schedule && t.schedule.tempOverride && t.schedule.tempOverride.weekKey !== currentWeekKey) {
          t.schedule.tempOverride = null;
        }
      });
    }
    window.store.lastResetWeekKey = currentWeekKey;
    console.log(`🗓️ 偵測到新的一週（${currentWeekKey}），已將所有 BOSS 完成狀態重置為未完成（隊伍名單保留，臨時時間已恢復常態）`);
    return true;
  }

  return false;
}

function ensureDefaultSingleTeams() {
  const allChars = getAllCharacters();
  let updated = false;

  if (!window.config.bosses || window.config.bosses.length === 0) return;

  window.config.bosses.forEach(boss => {
    const maxEntries = boss.allowReset ? 2 : 1;
    for (let entry = 1; entry <= maxEntries; entry++) {
      allChars.forEach(c => {
        // entry 1（首次刷）只有角色本來排定要打的 BOSS 才建立紀錄，不是每隻 BOSS 都要建
        const hasBossAssigned = !c.bossIds || c.bossIds.length === 0 || c.bossIds.includes(boss.id);
        if (entry === 1 && !hasBossAssigned) {
          return;
        }

        if (entry === 2 && (!c.resetBossIds || !c.resetBossIds.includes(boss.id))) {
          return;
        }

        const defaultTeamId = `single_${c.id}_${boss.id}_${entry}`;
        const recordKey = `rec_${c.id}_${boss.id}_${entry}`;

        if (!window.store.weeklyRecords) window.store.weeklyRecords = {};
        if (!window.store.teams) window.store.teams = {};

        if (!window.store.weeklyRecords[recordKey]) {
          window.store.teams[defaultTeamId] = {
            id: defaultTeamId,
            memberTargets: [{ charId: c.id, entryIndex: entry }]
          };
          window.store.weeklyRecords[recordKey] = {
            charId: c.id,
            bossId: boss.id,
            entryIndex: entry,
            teamId: defaultTeamId,
            isCompleted: false
          };
          updated = true;
        } else if (!window.store.weeklyRecords[recordKey].charId) {
          // 💡 資料搬遷：舊資料沒有 charId 欄位，這裡本來就已經知道正確的 c.id 是誰，直接補上，不需要用字串猜
          window.store.weeklyRecords[recordKey].charId = c.id;
          updated = true;
        }
      });
    }
  });

  if (updated) {
    saveStoreToCloud();
  }
}
