/**
 * app-core.js
 * 複製自 index.html 主 <script> 區塊（L1080–1417）
 * 涵蓋：saveStoreToCloud、getAllCharacters、getCharName、getBossGroupKey
 *
 * ⚠️  目前 index.html 仍保留原本的 script，此檔案僅為備份/拆分準備。
 *
 * 依賴（未來切換時需在此檔案之前載入）：無（此為最底層工具函式）
 */
(function() {
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

  window.saveStoreToCloud = saveStoreToCloud;
  window.getAllCharacters = getAllCharacters;
  window.getCharName = getCharName;
  window.getBossGroupKey = getBossGroupKey;
})();
