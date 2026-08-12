/**
 * schedule.js
 * 複製自 index.html 主 <script> 區塊（L2622–3089）
 * 涵蓋：出團排程輔助、通知推播、音效、排程清單渲染
 *
 * ⚠️  目前 index.html 仍保留原本的 script，此檔案僅為備份/拆分準備。
 *    待確認後再從 index.html 移除對應區塊。
 *
 * 依賴（需在此檔案之前載入）：
 *   - getCurrentResetWeekKey()  ← app-core.js
 *   - getPrimaryUser()          ← ui.js
 *   - getAllCharacters()        ← app-core.js
 *   - getCharName()             ← app-core.js
 */

// ==========================================
// 隊伍出團時間排程與格式化輔助函式
// ==========================================
const DAY_NAMES = ["週日", "週一", "週二", "週三", "週四", "週五", "週六"];

function getTeamEffectiveSchedule(team) {
  if (!team || !team.schedule) return null;
  const currentWeekKey = getCurrentResetWeekKey();
  if (
    team.schedule.tempOverride &&
    team.schedule.tempOverride.weekKey === currentWeekKey &&
    team.schedule.tempOverride.dayOfWeek !== null &&
    team.schedule.tempOverride.dayOfWeek !== undefined
  ) {
    return {
      type: "temp",
      dayOfWeek: parseInt(team.schedule.tempOverride.dayOfWeek, 10),
      time: team.schedule.tempOverride.time || "21:00",
      isTemp: true
    };
  }
  if (
    team.schedule.recurring &&
    team.schedule.recurring.dayOfWeek !== null &&
    team.schedule.recurring.dayOfWeek !== undefined &&
    team.schedule.recurring.time
  ) {
    return {
      type: "recurring",
      dayOfWeek: parseInt(team.schedule.recurring.dayOfWeek, 10),
      time: team.schedule.recurring.time,
      isTemp: false
    };
  }
  return null;
}

function formatScheduleDisplay(effectiveSchedule) {
  if (!effectiveSchedule) return "";
  const dayName = DAY_NAMES[effectiveSchedule.dayOfWeek] || "";
  if (effectiveSchedule.isTemp) {
    return `⚡ 臨時改 ${dayName} ${effectiveSchedule.time}`;
  }
  return `⏰ ${dayName} ${effectiveSchedule.time}`;
}

function getTeamRaidDateTimeThisWeek(effectiveSchedule, now = new Date()) {
  if (
    !effectiveSchedule ||
    effectiveSchedule.dayOfWeek === null ||
    effectiveSchedule.dayOfWeek === undefined ||
    !effectiveSchedule.time
  ) {
    return null;
  }
  const [hours, minutes] = effectiveSchedule.time.split(":").map(Number);
  const currentDay = now.getDay();
  const daysSinceThursday = (currentDay - 4 + 7) % 7;
  const thursday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysSinceThursday, 0, 0, 0, 0);

  const targetDay = parseInt(effectiveSchedule.dayOfWeek, 10);
  const daysFromThursday = (targetDay - 4 + 7) % 7;

  const targetDate = new Date(thursday);
  targetDate.setDate(thursday.getDate() + daysFromThursday);
  targetDate.setHours(hours, minutes, 0, 0);
  return targetDate;
}

function checkIfTeamCompletedThisWeek(team) {
  if (!team || !window.store || !window.store.weeklyRecords) return false;
  const members = team.memberTargets || (team.memberCharIds || []).map(id => ({ charId: id, entryIndex: 1 }));
  const formalMembers = members.filter(m => !m.charId.startsWith("guest_"));
  if (formalMembers.length === 0) return false;

  return formalMembers.every(m => {
    const records = Object.values(window.store.weeklyRecords);
    const rec = records.find(r => r && r.charId === m.charId && r.entryIndex === m.entryIndex && r.teamId === team.id);
    return rec ? rec.isCompleted : false;
  });
}

function loadPartyScheduleIntoForm(schedule) {
  const recurringDayEl = document.getElementById("partyScheduleRecurringDay");
  const recurringTimeEl = document.getElementById("partyScheduleRecurringTime");
  const tempCheckEl = document.getElementById("partyScheduleTempCheck");
  const tempDayEl = document.getElementById("partyScheduleTempDay");
  const tempTimeEl = document.getElementById("partyScheduleTempTime");
  const tempContainer = document.getElementById("partyScheduleTempInputs");

  if (!recurringDayEl) return;
  const currentWeek = getCurrentResetWeekKey();

  if (schedule && schedule.recurring && schedule.recurring.dayOfWeek !== null && schedule.recurring.dayOfWeek !== undefined) {
    recurringDayEl.value = String(schedule.recurring.dayOfWeek);
    recurringTimeEl.value = schedule.recurring.time || "21:00";
  } else {
    recurringDayEl.value = "";
    recurringTimeEl.value = "21:00";
  }

  if (
    schedule && schedule.tempOverride &&
    schedule.tempOverride.weekKey === currentWeek &&
    schedule.tempOverride.dayOfWeek !== null &&
    schedule.tempOverride.dayOfWeek !== undefined
  ) {
    tempCheckEl.checked = true;
    tempDayEl.value = String(schedule.tempOverride.dayOfWeek);
    tempTimeEl.value = schedule.tempOverride.time || "21:00";
    if (tempContainer) tempContainer.style.display = "flex";
  } else {
    tempCheckEl.checked = false;
    tempDayEl.value = recurringDayEl.value || "6";
    tempTimeEl.value = recurringTimeEl.value || "21:00";
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
  const recurringTime = document.getElementById("partyScheduleRecurringTime").value || "21:00";
  const hasTemp = document.getElementById("partyScheduleTempCheck").checked;
  const tempDay = document.getElementById("partyScheduleTempDay").value;
  const tempTime = document.getElementById("partyScheduleTempTime").value || "21:00";

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

// ==========================================
// 個人化 Windows 出團推播提醒與音效
// ==========================================
const NOTIF_ENABLED_KEY = "maple_notif_enabled";
const NOTIF_LEAD_KEY = "maple_notif_lead_time";
const NOTIF_SOUND_KEY = "maple_notif_sound";
const NOTIF_SCOPE_KEY = "maple_notif_scope";

window.openNotificationModal = function() {
  updateNotificationUI();
  renderNotificationScheduleList();
  document.getElementById("notificationModal").style.display = "flex";
};

window.closeNotificationModal = function() {
  document.getElementById("notificationModal").style.display = "none";
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

  localStorage.setItem(NOTIF_LEAD_KEY, leadTime);
  localStorage.setItem(NOTIF_SOUND_KEY, soundEnabled ? "true" : "false");
  localStorage.setItem(NOTIF_SCOPE_KEY, scope);

  renderNotificationScheduleList();
};

function updateNotificationUI() {
  const isEnabled = localStorage.getItem(NOTIF_ENABLED_KEY) === "true";
  const leadTime = localStorage.getItem(NOTIF_LEAD_KEY) || "15";
  const soundEnabled = localStorage.getItem(NOTIF_SOUND_KEY) !== "false";
  const scope = localStorage.getItem(NOTIF_SCOPE_KEY) || "primary";

  const toggle = document.getElementById("notifEnabledToggle");
  if (toggle) toggle.checked = isEnabled;

  const leadSelect = document.getElementById("notifLeadTimeSelect");
  if (leadSelect) leadSelect.value = leadTime;

  const soundToggle = document.getElementById("notifSoundToggle");
  if (soundToggle) soundToggle.checked = soundEnabled;

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

function playNotificationChime() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + i * 0.1);
      gain.gain.setValueAtTime(0.18, now + i * 0.1);
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
    icon: "favicon.ico"
  });
  notif.onclick = function() { window.focus(); notif.close(); };

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

function checkRaidReminders() {
  const isEnabled = localStorage.getItem(NOTIF_ENABLED_KEY) === "true";
  if (!isEnabled || !("Notification" in window) || Notification.permission !== "granted") return;
  if (!window.store || !window.store.teams || !window.config || !window.config.bosses) return;

  const now = new Date();
  const currentWeekKey = getCurrentResetWeekKey();
  const leadMinutes = parseInt(localStorage.getItem(NOTIF_LEAD_KEY) || "15", 10);
  const soundEnabled = localStorage.getItem(NOTIF_SOUND_KEY) !== "false";
  const scope = localStorage.getItem(NOTIF_SCOPE_KEY) || "primary";

  const primaryUser = getPrimaryUser();
  const allChars = getAllCharacters();
  const primaryCharIds = new Set(allChars.filter(c => c.playerName === primaryUser).map(c => c.id));

  Object.values(window.store.teams).forEach(team => {
    const schedule = getTeamEffectiveSchedule(team);
    if (!schedule) return;

    const members = team.memberTargets || (team.memberCharIds || []).map(id => ({ charId: id, entryIndex: 1 }));
    if (scope === "primary" && !members.some(m => primaryCharIds.has(m.charId))) return;

    const isCompleted = checkIfTeamCompletedThisWeek(team);
    if (isCompleted) return;

    const raidDate = getTeamRaidDateTimeThisWeek(schedule, now);
    if (!raidDate) return;

    const diffMinutes = (raidDate.getTime() - now.getTime()) / 60000;

    if (diffMinutes <= leadMinutes && diffMinutes >= -30) {
      const notifyKey = `maple_notified_${team.id}_${currentWeekKey}_${schedule.isTemp ? 'temp_' : ''}${schedule.dayOfWeek}_${schedule.time}`;
      if (localStorage.getItem(notifyKey)) return;

      let bossName = "BOSS";
      const records = Object.values(window.store.weeklyRecords || {});
      const sampleRec = records.find(r => r && r.teamId === team.id);
      if (sampleRec) {
        const b = window.config.bosses.find(bb => bb.id === sampleRec.bossId);
        if (b) bossName = b.name;
      }

      const memberNames = members.map(m => getCharName(m.charId)).join("、");
      const remainingDesc = diffMinutes > 0 ? `還有約 ${Math.ceil(diffMinutes)} 分鐘（${schedule.time}）` : `現在（${schedule.time}）`;
      const tempPrefix = schedule.isTemp ? "【臨時改時間】" : "";

      try {
        const notif = new Notification(`⏰ ${tempPrefix}出團提醒：【${bossName}】即將開始！`, {
          body: `預定開打：${remainingDesc}\n隊伍成員：${memberNames}`,
          icon: "favicon.ico"
        });
        notif.onclick = function() { window.focus(); notif.close(); };

        if (soundEnabled) playNotificationChime();

        localStorage.setItem(notifyKey, String(Date.now()));
      } catch (err) {
        console.error("發送通知失敗:", err);
      }
    }
  });
}

function initNotificationSystem() {
  updateNotificationUI();
  // 每 30 秒巡檢一次出團時間
  setInterval(checkRaidReminders, 30000);
  // 首次立即檢查一次
  setTimeout(checkRaidReminders, 2000);
}
