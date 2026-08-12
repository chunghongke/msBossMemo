/**
 * firebase-init.js
 * 複製自 index.html <script type="module"> 區塊（L877–1077）
 * ⚠️  目前 index.html 仍保留原本的 script，此檔案僅為備份/拆分準備。
 *    待確認後再從 index.html 移除對應區塊。
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, onValue, set } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyC6_PrlBgVTbmpDCrWP7KMTAq8RHtNsI-M",
  authDomain: "msbossmemo-752e3.firebaseapp.com",
  databaseURL: "https://msbossmemo-752e3-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "msbossmemo-752e3",
  storageBucket: "msbossmemo-752e3.firebasestorage.app",
  messagingSenderId: "747420574318",
  appId: "1:747420574318:web:eff8bdb117a776264cfc7f"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

window.db = db;
window.dbRef = ref;
window.dbSet = set;

window.config = { bosses: [], players: [] };
window.store = { teams: {}, weeklyRecords: {} };

const rootRef = ref(db, '/');
onValue(rootRef, (snapshot) => {
  const data = snapshot.val();
  
  if (data) {
    let rawBosses = data.bosses || [];
    if (!Array.isArray(rawBosses)) rawBosses = Object.values(rawBosses);
    window.config.bosses = rawBosses.filter(b => b !== null && b !== undefined);

    let rawPlayers = data.players || [];
    if (!Array.isArray(rawPlayers)) rawPlayers = Object.values(rawPlayers);
    window.config.players = rawPlayers.filter(p => p !== null && p !== undefined);

    window.store = data.store || { teams: {}, weeklyRecords: {}, guests: [] };
    if (!window.store.guests) window.store.guests = [];
  }

  const weeklyResetHappened = checkAndPerformWeeklyReset();
  ensureDefaultSingleTeams();
  if (weeklyResetHappened) saveStoreToCloud();
  renderApp();
});

