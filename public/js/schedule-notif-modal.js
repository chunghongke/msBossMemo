/**
 * schedule-notif-modal.js
 * 通知設定彈窗、出團排程表單讀取與 UI 互動
 * 
 * 依賴 schedule-core.js 中宣告的 NOTIF_... 等常數
 */

const NOTIF_SOUND_TYPE_KEY = "maple_notif_sound_type";
const NOTIF_VOLUME_KEY = "maple_notif_volume";

// 初始化 IndexedDB 本地大容量資料庫，用以避開 localStorage 的 5MB 限制
function initIndexedDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("BossPartyDB", 1);
    request.onupgradeneeded = function(e) {
      const db = e.target.result;
      if (!db.objectStoreNames.contains("assets")) {
        db.createObjectStore("assets");
      }
    };
    request.onsuccess = function(e) {
      resolve(e.target.result);
    };
    request.onerror = function(e) {
      reject(e.target.error);
    };
  });
}

// 儲存本地音效 Blob 數據，並記錄檔案名稱
async function saveCustomAudioBlob(file) {
  const db = await initIndexedDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["assets"], "readwrite");
    const store = transaction.objectStore("assets");
    
    // 封裝 Blob 與檔案名稱
    const record = {
      blob: file,
      name: file.name,
      size: file.size,
      updatedAt: Date.now()
    };
    
    const request = store.put(record, "customChime");
    request.onsuccess = () => resolve();
    request.onerror = (e) => reject(e.target.error);
  });
}

// 獲取本地音效
async function getCustomAudioBlob() {
  const db = await initIndexedDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["assets"], "readonly");
    const store = transaction.objectStore("assets");
    const request = store.get("customChime");
    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject(e.target.error);
  });
}

// 刪除自訂音效
async function deleteCustomAudioBlob() {
  const db = await initIndexedDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["assets"], "readwrite");
    const store = transaction.objectStore("assets");
    const request = store.delete("customChime");
    request.onsuccess = () => resolve();
    request.onerror = (e) => reject(e.target.error);
  });
}

function populateTimeSelects() {
  const recurringHour = document.getElementById("partyScheduleRecurringHour");
  const recurringMin = document.getElementById("partyScheduleRecurringMin");
  const tempHour = document.getElementById("partyScheduleTempHour");
  const tempMin = document.getElementById("partyScheduleTempMin");

  // 💡 加上安全 Null-check 防呆，防止瀏覽器快取 HTML 導致元素抓不到而崩潰
  if (recurringHour && recurringMin && tempHour && tempMin) {
    if (recurringHour.options.length === 0) {
      // 填充小時 00-23
      for (let h = 0; h < 24; h++) {
        const val = String(h).padStart(2, "0");
        recurringHour.add(new Option(val, val));
        tempHour.add(new Option(val, val));
      }
      // 填充分鐘 00-59
      for (let m = 0; m < 60; m++) {
        const val = String(m).padStart(2, "0");
        recurringMin.add(new Option(val, val));
        tempMin.add(new Option(val, val));
      }
    }
  }
}

function setSelectTimeValue(hourEl, minEl, timeStr) {
  populateTimeSelects();
  if (!hourEl || !minEl) return; // 💡 安全防呆

  if (!timeStr) {
    hourEl.value = "21";
    minEl.value = "00";
    return;
  }
  const [h, m] = timeStr.split(":");
  hourEl.value = String(h).padStart(2, "0");
  minEl.value = String(m).padStart(2, "0");
}

function getSelectTimeValue(hourEl, minEl) {
  if (!hourEl || !minEl) return "21:00"; // 💡 安全防呆
  return `${hourEl.value}:${minEl.value}`;
}

function loadPartyScheduleIntoForm(schedule) {
  const recurringDayEl = document.getElementById("partyScheduleRecurringDay");
  const recurringHourEl = document.getElementById("partyScheduleRecurringHour");
  const recurringMinEl = document.getElementById("partyScheduleRecurringMin");
  const tempCheckEl = document.getElementById("partyScheduleTempCheck");
  const tempDayEl = document.getElementById("partyScheduleTempDay");
  const tempHourEl = document.getElementById("partyScheduleTempHour");
  const tempMinEl = document.getElementById("partyScheduleTempMin");
  const tempContainer = document.getElementById("partyScheduleTempInputs");

  if (!recurringDayEl) return;
  const currentWeek = getCurrentResetWeekKey();

  if (schedule && schedule.recurring && schedule.recurring.dayOfWeek !== null && schedule.recurring.dayOfWeek !== undefined) {
    recurringDayEl.value = String(schedule.recurring.dayOfWeek);
    setSelectTimeValue(recurringHourEl, recurringMinEl, schedule.recurring.time || "21:00");
  } else {
    recurringDayEl.value = "";
    setSelectTimeValue(recurringHourEl, recurringMinEl, "21:00");
  }

  if (
    schedule && schedule.tempOverride &&
    schedule.tempOverride.weekKey === currentWeek &&
    schedule.tempOverride.dayOfWeek !== null &&
    schedule.tempOverride.dayOfWeek !== undefined
  ) {
    tempCheckEl.checked = true;
    tempDayEl.value = String(schedule.tempOverride.dayOfWeek);
    setSelectTimeValue(tempHourEl, tempMinEl, schedule.tempOverride.time || "21:00");
    if (tempContainer) tempContainer.style.display = "flex";
  } else {
    tempCheckEl.checked = false;
    tempDayEl.value = recurringDayEl.value || "6";
    setSelectTimeValue(tempHourEl, tempMinEl, getSelectTimeValue(recurringHourEl, recurringMinEl));
    if (tempContainer) tempContainer.style.display = "none";
  }
}

window.togglePartyScheduleTempInputs = function(isChecked) {
  const tempContainer = document.getElementById("partyScheduleTempInputs");
  if (tempContainer) {
    tempContainer.style.display = isChecked ? "flex" : "none";
  }
};

function readPartyScheduleFromForm() {
  const recurringDay = document.getElementById("partyScheduleRecurringDay").value;
  const recurringTime = getSelectTimeValue(
    document.getElementById("partyScheduleRecurringHour"),
    document.getElementById("partyScheduleRecurringMin")
  );
  const hasTemp = document.getElementById("partyScheduleTempCheck").checked;
  const tempDay = document.getElementById("partyScheduleTempDay").value;
  const tempTime = getSelectTimeValue(
    document.getElementById("partyScheduleTempHour"),
    document.getElementById("partyScheduleTempMin")
  );

  let recurring = null;
  if (recurringDay !== "") {
    recurring = { dayOfWeek: parseInt(recurringDay, 10), time: recurringTime };
  }

  let tempOverride = null;
  if (hasTemp && tempDay !== "") {
    tempOverride = {
      weekKey: getCurrentResetWeekKey(),
      dayOfWeek: parseInt(tempDay, 10),
      time: tempTime
    };
  }

  if (!recurring && !tempOverride) return null;
  return { recurring, tempOverride };
}

window.openNotificationModal = function() {
  updateNotificationUI();
  renderNotificationScheduleList();
  if (window.updateCustomAudioStatusUI) {
    window.updateCustomAudioStatusUI();
  }
  document.getElementById("notificationModal").style.display = "flex";
};

window.closeNotificationModal = function() {
  document.getElementById("notificationModal").style.display = "none";
  if (window.stopNotificationChime) {
    window.stopNotificationChime();
  }
};

window.handleNotificationToggle = async function(checked) {
  if (checked) {
    if (!("Notification" in window)) {
      alert("很抱歉，此瀏覽器不支援 Web Notifications 推播通知功能。");
      document.getElementById("notifEnabledToggle").checked = false;
      return;
    }
    if (Notification.permission === "denied") {
      alert("您先前封鎖了此網站的通知權限。若要接收出團推播，請點擊網址列左側的「鎖頭 🔒」或網站設定圖示，手動將「通知」改為「允許」。");
      document.getElementById("notifEnabledToggle").checked = false;
      return;
    }
    if (Notification.permission !== "granted") {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        alert("未獲得通知授權，推播提醒未啟用。");
        document.getElementById("notifEnabledToggle").checked = false;
        return;
      }
    }
    localStorage.setItem(NOTIF_ENABLED_KEY, "true");
  } else {
    localStorage.setItem(NOTIF_ENABLED_KEY, "false");
  }
  updateNotificationUI();
};

window.saveNotificationPreferences = function() {
  const leadTime = document.getElementById("notifLeadTimeSelect").value;
  const soundEnabled = document.getElementById("notifSoundToggle").checked;
  const scopeRadio = document.querySelector('input[name="notifScope"]:checked');
  const scope = scopeRadio ? scopeRadio.value : "primary";
  const volume = document.getElementById("notifVolumeSlider").value;

  localStorage.setItem(NOTIF_LEAD_KEY, leadTime);
  localStorage.setItem(NOTIF_SOUND_KEY, soundEnabled ? "true" : "false");
  localStorage.setItem(NOTIF_SCOPE_KEY, scope);
  localStorage.setItem(NOTIF_VOLUME_KEY, volume);

  renderNotificationScheduleList();
};

window.handleVolumeChange = function(val) {
  const valueSpan = document.getElementById("notifVolumeValue");
  if (valueSpan) {
    valueSpan.textContent = `${Math.round(val * 100)}%`;
  }
};

function updateNotificationUI() {
  const isEnabled = localStorage.getItem(NOTIF_ENABLED_KEY) === "true";
  const leadTime = localStorage.getItem(NOTIF_LEAD_KEY) || "15";
  const soundEnabled = localStorage.getItem(NOTIF_SOUND_KEY) !== "false";
  const scope = localStorage.getItem(NOTIF_SCOPE_KEY) || "primary";
  const volume = localStorage.getItem(NOTIF_VOLUME_KEY) || "0.5";

  const toggle = document.getElementById("notifEnabledToggle");
  if (toggle) toggle.checked = isEnabled;

  const leadSelect = document.getElementById("notifLeadTimeSelect");
  if (leadSelect) leadSelect.value = leadTime;

  const soundToggle = document.getElementById("notifSoundToggle");
  if (soundToggle) soundToggle.checked = soundEnabled;

  const volSlider = document.getElementById("notifVolumeSlider");
  if (volSlider) volSlider.value = volume;

  const volValue = document.getElementById("notifVolumeValue");
  if (volValue) volValue.textContent = `${Math.round(volume * 100)}%`;

  const scopeRadios = document.querySelectorAll('input[name="notifScope"]');
  scopeRadios.forEach(r => { r.checked = (r.value === scope); });

  const statusEl = document.getElementById("notifPermissionStatus");
  if (statusEl) {
    if (!("Notification" in window)) {
      statusEl.innerText = "⚠️ 瀏覽器不支援通知";
      statusEl.style.color = "#ef4444";
    } else if (Notification.permission === "denied") {
      statusEl.innerText = "❌ 權限已被瀏覽器封鎖，請在網址列允許通知";
      statusEl.style.color = "#ef4444";
    } else if (isEnabled && Notification.permission === "granted") {
      statusEl.innerText = "✅ 推播通知運作中（視窗開著即會自動提醒）";
      statusEl.style.color = "#10b981";
    } else {
      statusEl.innerText = "⚪ 目前已關閉提醒";
      statusEl.style.color = "var(--text-muted)";
    }
  }

  const indicator = document.getElementById("notifHeaderIndicator");
  if (indicator) {
    indicator.classList.toggle("active", isEnabled && ("Notification" in window) && Notification.permission === "granted");
  }
}

window.currentChimeAudio = null;

window.stopNotificationChime = function() {
  if (window.currentChimeAudio) {
    try {
      window.currentChimeAudio.pause();
      window.currentChimeAudio.currentTime = 0; // 重設播放進度
      console.log("出團提醒音樂已停止。");
    } catch (e) {
      console.warn("停止音樂失敗:", e);
    }
    window.currentChimeAudio = null;
  }
};

window.playNotificationChime = async function() {
  // 播放前，如果上一次的歌還在播，先停止，防止聲音重疊
  window.stopNotificationChime();

  const soundType = localStorage.getItem(NOTIF_SOUND_TYPE_KEY) || "short";
  const volume = parseFloat(localStorage.getItem(NOTIF_VOLUME_KEY) || "0.5");

  if (soundType === "custom") {
    try {
      // 1. 嘗試從 IndexedDB 讀取本地自訂音效
      const record = await getCustomAudioBlob();
      if (record && record.blob) {
        console.log("偵測到本地自訂音效，嘗試播放:", record.name);
        const audioUrl = URL.createObjectURL(record.blob);
        const customAudio = new Audio(audioUrl);
        customAudio.volume = volume;
        
        window.currentChimeAudio = customAudio;
        
        customAudio.onerror = function() {
          console.warn("本地自訂音訊播放出錯，Fallback 到預設短音檔。");
          window.currentChimeAudio = null;
          URL.revokeObjectURL(audioUrl); // 釋放記憶體
          playServerChime("chime_short.mp3");
        };
        
        const playPromise = customAudio.play();
        if (playPromise !== undefined) {
          playPromise.catch(e => {
            window.currentChimeAudio = null;
            URL.revokeObjectURL(audioUrl);
            playServerChime("chime_short.mp3");
          });
        }
        return; // 成功播放本地，直接返回
      } else {
        console.warn("未上傳自訂本地鈴聲，Fallback 到預設短音檔。");
        playServerChime("chime_short.mp3");
      }
    } catch (err) {
      console.warn("讀取 IndexedDB 本地音效失敗，將使用預設短音效:", err);
      playServerChime("chime_short.mp3");
    }
  } else if (soundType === "long") {
    playServerChime("chime_long.mp3");
  } else {
    playServerChime("chime_short.mp3");
  }
};

function playServerChime(fileName) {
  try {
    const serverAudio = new Audio(fileName);
    const volume = parseFloat(localStorage.getItem(NOTIF_VOLUME_KEY) || "0.5");
    serverAudio.volume = volume;
    
    window.currentChimeAudio = serverAudio;
    
    serverAudio.onerror = function() {
      console.warn(`載入伺服器音檔 ${fileName} 失敗，使用預設水晶提示音。`);
      window.currentChimeAudio = null;
      playDefaultSynthesizedChime();
    };

    const playPromise = serverAudio.play();
    if (playPromise !== undefined) {
      playPromise.catch(e => {
        window.currentChimeAudio = null;
        playDefaultSynthesizedChime();
      });
    }
  } catch (err) {
    window.currentChimeAudio = null;
    playDefaultSynthesizedChime();
  }
}

// 變更鈴聲類型 Radio 處理
window.handleSoundTypeChange = function(type) {
  localStorage.setItem(NOTIF_SOUND_TYPE_KEY, type);
  const uploadArea = document.getElementById("customAudioUploadArea");
  if (uploadArea) {
    uploadArea.style.display = (type === "custom") ? "block" : "none";
  }
};

// 檔案選擇上傳處理
window.handleCustomAudioUpload = async function(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (!file.type.match('audio.*') && !file.name.endsWith('.mp3')) {
    alert("請選擇 MP3 格式的音訊檔案！");
    return;
  }
  
  const statusText = document.getElementById("customAudioStatusText");
  if (statusText) statusText.textContent = "正在將音檔寫入瀏覽器本地資料庫...";
  
  try {
    await saveCustomAudioBlob(file);
    await window.updateCustomAudioStatusUI();
    alert(`自訂鈴聲設定成功！\n音檔已安全儲存在您的瀏覽器本地資料庫。`);
  } catch (err) {
    console.error("儲存自訂音效失敗:", err);
    if (statusText) statusText.textContent = "儲存自訂音效失敗。";
    alert("儲存自訂音效失敗，請重試！");
  }
};

// 清除自訂鈴聲
window.handleClearCustomAudio = async function() {
  if (!confirm("確定要清除自訂鈴聲，還原為預設音效嗎？")) return;
  try {
    await deleteCustomAudioBlob();
    await window.updateCustomAudioStatusUI();
    document.getElementById("customAudioFileInput").value = "";
    alert("已還原為預設音效！");
  } catch (err) {
    console.error("清除自訂音效失敗:", err);
    alert("清除自訂音效失敗，請重試。");
  }
};

// 更新 UI 上的自訂鈴聲狀態
window.updateCustomAudioStatusUI = async function() {
  const statusText = document.getElementById("customAudioStatusText");
  const clearBtn = document.getElementById("clearCustomAudioBtn");
  
  // 1. 同步 Radio 的勾選與展開狀態
  const soundType = localStorage.getItem(NOTIF_SOUND_TYPE_KEY) || "short";
  const radio = document.querySelector(`input[name="notifSoundType"][value="${soundType}"]`);
  if (radio) radio.checked = true;
  
  const uploadArea = document.getElementById("customAudioUploadArea");
  if (uploadArea) {
    uploadArea.style.display = (soundType === "custom") ? "block" : "none";
  }

  if (!statusText) return;
  
  // 2. 顯示本地音效檔案大小狀態
  try {
    const record = await getCustomAudioBlob();
    if (record && record.blob) {
      statusText.textContent = `🎵 已啟用本地鈴聲：${record.name} (${formatBytes(record.size)})`;
      if (clearBtn) clearBtn.style.display = "inline-block";
    } else {
      statusText.textContent = "目前狀態：未上傳本地自訂鈴聲 (選取此項前請先上傳)";
      if (clearBtn) clearBtn.style.display = "none";
    }
  } catch (err) {
    console.warn("無法取得自訂音效狀態:", err);
  }
};

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function playDefaultSynthesizedChime() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    
    // 讀取音量比率
    const volume = parseFloat(localStorage.getItem(NOTIF_VOLUME_KEY) || "0.5");
    
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + i * 0.1);
      // 原本預設水晶音量為 0.18，在此乘上使用者調整的音量比率
      gain.gain.setValueAtTime(0.18 * volume, now + i * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.1 + 0.5);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.1);
      osc.stop(now + i * 0.1 + 0.5);
    });
  } catch (e) {
    console.warn("Audio play error:", e);
  }
}

window.testSendNotification = async function() {
  if (!("Notification" in window)) {
    alert("此瀏覽器不支援 Web Notifications。");
    return;
  }
  if (Notification.permission !== "granted") {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      alert("請先允許通知權限！");
      return;
    }
  }

  const notif = new Notification("🔔 BossParty 出團推播測試成功！", {
    body: "當有隊伍即將開打時，Windows 將會在此處跳出通知並播放鈴聲。",
    icon: "notification.png",
    requireInteraction: true // 保持通知常駐在右下角，直到使用者手動關閉或點擊
  });
  
  // 點擊通知橫幅時，立刻關閉通知並停止音樂
  notif.onclick = function() { 
    window.focus(); 
    window.stopNotificationChime();
    notif.close(); 
  };

  // 從 Windows 系統通知點擊「X」手動關閉時，也立刻停止音樂
  notif.onclose = function() {
    window.stopNotificationChime();
  };

  if (document.getElementById("notifSoundToggle").checked) {
    playNotificationChime();
  }
};

function renderNotificationScheduleList() {
  const container = document.getElementById("notifScheduleList");
  if (!container) return;

  if (!window.store || !window.store.teams || Object.keys(window.store.teams).length === 0) {
    container.innerHTML = `<div style="text-align:center; color:var(--text-muted); padding:10px;">目前尚無任何隊伍</div>`;
    return;
  }

  const now = new Date();
  const primaryUser = getPrimaryUser();
  const scope = localStorage.getItem(NOTIF_SCOPE_KEY) || "primary";
  const allChars = getAllCharacters();
  const primaryCharIds = new Set(allChars.filter(c => c.playerName === primaryUser).map(c => c.id));

  const scheduledTeams = [];

  Object.values(window.store.teams).forEach(team => {
    const schedule = getTeamEffectiveSchedule(team);
    if (!schedule) return;

    const members = team.memberTargets || (team.memberCharIds || []).map(id => ({ charId: id, entryIndex: 1 }));
    const hasPrimary = members.some(m => primaryCharIds.has(m.charId));
    if (scope === "primary" && !hasPrimary) return;

    const raidDate = getTeamRaidDateTimeThisWeek(schedule, now);
    if (!raidDate) return;

    const isCompleted = checkIfTeamCompletedThisWeek(team);

    let bossName = "BOSS 隊伍";
    const records = Object.values(window.store.weeklyRecords || {});
    const sampleRec = records.find(r => r && r.teamId === team.id);
    if (sampleRec) {
      const b = window.config.bosses.find(bb => bb.id === sampleRec.bossId);
      if (b) bossName = b.name;
    }

    const memberNames = members.map(m => getCharName(m.charId)).join("、");
    const diffMs = raidDate.getTime() - now.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    let countdownText = "";
    if (isCompleted) {
      countdownText = "✔️ 本週已完成";
    } else if (diffMs < 0) {
      countdownText = "⏳ 本週時間已過";
    } else if (diffHours > 24) {
      const days = Math.floor(diffHours / 24);
      countdownText = `還有 ${days} 天 ${diffHours % 24} 小時`;
    } else if (diffHours > 0) {
      countdownText = `還有 ${diffHours} 小時 ${diffMins} 分鐘`;
    } else {
      countdownText = `還有 ${Math.max(0, diffMins)} 分鐘`;
    }

    scheduledTeams.push({ team, bossName, memberNames, schedule, raidDate, isCompleted, countdownText, diffMs });
  });

  if (scheduledTeams.length === 0) {
    const scopeDesc = scope === "primary" ? `「${primaryUser}」參與且有設定時間` : "有設定出團時間";
    container.innerHTML = `<div style="text-align:center; color:var(--text-muted); padding:10px;">目前沒有${scopeDesc}的隊伍</div>`;
    return;
  }

  scheduledTeams.sort((a, b) => {
    if (a.isCompleted !== b.isCompleted) return a.isCompleted ? 1 : -1;
    return a.raidDate - b.raidDate;
  });

  container.innerHTML = scheduledTeams.map(item => `
    <div class="notif-schedule-card ${item.isCompleted ? 'completed' : ''}">
      <div>
        <div style="font-weight:bold; display:flex; align-items:center; gap:4px;">
          <span>${item.bossName}</span>
          <span class="team-schedule-badge ${item.schedule.isTemp ? 'temp' : ''}" style="margin:0;">${formatScheduleDisplay(item.schedule)}</span>
        </div>
        <div style="font-size:11px; color:var(--text-muted); margin-top:2px;">隊員：${item.memberNames}</div>
      </div>
      <div style="text-align:right; font-weight:bold; font-size:11px; color:${item.isCompleted ? 'var(--text-muted)' : (item.diffMs > 0 && item.diffMs <= 30 * 60000 ? '#ef4444' : '#0284c7')};">
        ${item.countdownText}
      </div>
    </div>
  `).join("");
}
