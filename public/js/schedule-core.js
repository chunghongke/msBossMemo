/**
 * schedule-core.js
 * 隊伍出團時間排程與格式化輔助函式、背景通知巡檢
 */

const DAY_NAMES = ["週日", "週一", "週二", "週三", "週四", "週五", "週六"];

const NOTIF_ENABLED_KEY = "maple_notif_enabled";
const NOTIF_LEAD_KEY = "maple_notif_lead_time";
const NOTIF_SOUND_KEY = "maple_notif_sound";
const NOTIF_SCOPE_KEY = "maple_notif_scope";

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

      const records = Object.values(window.store.weeklyRecords || {});
      const sampleRec = records.find(r => r && r.teamId === team.id);
      if (!sampleRec) return; // 💡 幽靈/孤兒隊伍 (無 Boss 關聯)，不發送提醒

      let bossName = "BOSS";
      const b = window.config.bosses.find(bb => bb.id === sampleRec.bossId);
      if (b) bossName = b.name;

      const memberNames = members.map(m => getCharName(m.charId)).join("、");
      const remainingDesc = diffMinutes > 0 ? `還有約 ${Math.ceil(diffMinutes)} 分鐘（${schedule.time}）` : `現在（${schedule.time}）`;
      const tempPrefix = schedule.isTemp ? "【臨時改時間】" : "";

      try {
        const notif = new Notification(`⏰ ${tempPrefix}出團提醒：【${bossName}】即將開始！`, {
          body: `預定開打：${remainingDesc}\n隊伍成員：${memberNames}`,
          icon: "notification.png",
          requireInteraction: true // 保持通知常駐
        });
        notif.onclick = function() { 
          window.focus(); 
          if (window.stopNotificationChime) {
            window.stopNotificationChime();
          }
          notif.close(); 
        };
        // 系統上手動點 X 關閉通知時，也停止音樂
        notif.onclose = function() {
          if (window.stopNotificationChime) {
            window.stopNotificationChime();
          }
        };

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
