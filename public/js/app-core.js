/**
 * app-core.js
 * 複製自 index.html 主 <script> 區塊（L1080–1417）
 * 涵蓋：saveStoreToCloud、getAllCharacters、getCharName、getBossGroupKey、
 *       getCurrentResetWeekKey、checkAndPerformWeeklyReset、ensureDefaultSingleTeams、
 *       calculateCharacterCrystal/Shard、captureBossCellPositions、playBossCellReorderAnimation
 *
 * ⚠️  目前 index.html 仍保留原本的 script，此檔案僅為備份/拆分準備。
 *
 * 依賴（未來切換時需在此檔案之前載入）：無（此為最底層工具函式）
 */

  function saveStoreToCloud() {
    if (window.db && window.dbRef && window.dbSet) {
      const storeRef = window.dbRef(window.db, '/store');
      window.dbSet(storeRef, window.store)
        .then(() => console.log("☁️ 雲端同步成功！"))
        .catch((err) => console.error("❌ 雲端同步失敗:", err));
    }
  }

  function getAllCharacters() {
    const chars = [];
    if (!window.config.players) return chars;
    window.config.players.forEach(p => {
      if (p.characters) {
        p.characters.forEach(c => {
          chars.push({ ...c, playerName: p.name });
        });
      }
    });
    return chars;
  }

  function getCharName(charId) {
    const chars = getAllCharacters();
    const c = chars.find(item => item.id === charId);
    if (c) return c.name;
    if (window.store && window.store.guests) {
      const guest = window.store.guests.find(g => g.id === charId);
      if (guest) return `${guest.name} (G)`;
    }
    return charId;
  }

  // 依照 boss id 常見的難度後綴，算出「群組 key」，例如 kalos_hard / kalos_extreme 都屬於 "kalos" 群組
  const BOSS_DIFFICULTY_SUFFIXES = ["_easy", "_normal", "_hard", "_extreme"];
  function getBossGroupKey(bossId) {
    for (const suffix of BOSS_DIFFICULTY_SUFFIXES) {
      if (bossId.endsWith(suffix)) return bossId.slice(0, -suffix.length);
    }
    return bossId; // 沒有符合已知難度後綴的，自成一群
  }

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
          const hasChosen = record.shardShares !== null && record.shardShares !== undefined;
          const shares = isSolo ? maxPartySize : (hasChosen ? record.shardShares : 1);
          earned += unitShare * shares;
        }
      }
    });

    return { earned, expected };
  }

  // 記錄目前每個 boss-cell 的畫面位置（key 為 recordKey），供重繪後做滑動動畫比對用
  function captureBossCellPositions(container) {
    const positions = new Map();
    container.querySelectorAll(".boss-cell[data-record-key]").forEach(cell => {
      positions.set(cell.dataset.recordKey, cell.getBoundingClientRect());
    });
    return positions;
  }

  // FLIP 動畫：比對重繪前後的位置差異，用 transform 讓卡片「滑」到新位置，而不是瞬間跳過去
  function playBossCellReorderAnimation(container, oldPositions) {
    if (!oldPositions || oldPositions.size === 0) return;

    container.querySelectorAll(".boss-cell[data-record-key]").forEach(cell => {
      const key = cell.dataset.recordKey;
      const oldRect = oldPositions.get(key);
      if (!oldRect) return;

      const newRect = cell.getBoundingClientRect();
      const dx = oldRect.left - newRect.left;
      const dy = oldRect.top - newRect.top;

      if (dx === 0 && dy === 0) return;

      cell.style.transition = "none";
      cell.style.transform = `translate(${dx}px, ${dy}px)`;

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          cell.style.transition = "transform 0.3s ease";
          cell.style.transform = "";
        });
      });

      cell.addEventListener("transitionend", function cleanup() {
        cell.style.transition = "";
        cell.removeEventListener("transitionend", cleanup);
      });
    });
  }
