/**
 * ui.js
 * Contains: togglePlayerCollapse, toggleAllPlayers, getPrimaryUser, changePrimaryUser, updateUserSelectOptions, handleOverlayClick, updatePartyCheckboxStates, getCollapsedPlayerKeys, saveCollapsedPlayerKeys, updateResetTimer, checkWeeklyResetPeriodically, setupModalScrollLock
 */

// ==========================================
// 玩家區塊收合 / 展開
// ==========================================
function togglePlayerCollapse(playerId) {
  const card = document.getElementById(`player-card-${playerId}`);
  const icon = document.getElementById(`collapse-icon-${playerId}`);

  if (!card) return;
  const isCollapsed = card.classList.toggle("is-collapsed");
  if (icon) {
    icon.innerText = isCollapsed ? "▲ 展開" : "▼ 收合";
  }

  const collapseKey = card.dataset.collapseKey;
  if (collapseKey) {
    const collapsedKeys = getCollapsedPlayerKeys().filter(k => k !== collapseKey);
    if (isCollapsed) collapsedKeys.push(collapseKey);
    saveCollapsedPlayerKeys(collapsedKeys);
  }
}

function toggleAllPlayers(shouldCollapse) {
  const cards = document.querySelectorAll('.player-card');
  const collapsedKeys = [];
  cards.forEach(card => {
    if (shouldCollapse) {
      card.classList.add('is-collapsed');
    } else {
      card.classList.remove('is-collapsed');
    }

    const icon = card.querySelector('.collapse-icon');
    if (icon) {
      icon.innerText = shouldCollapse ? "▲ 展開" : "▼ 收合";
    }

    if (shouldCollapse && card.dataset.collapseKey) {
      collapsedKeys.push(card.dataset.collapseKey);
    }
  });

  saveCollapsedPlayerKeys(collapsedKeys);
}

// ==========================================
// 主要玩家選擇
// ==========================================
function getPrimaryUser() {
  if (typeof window.getAuthenticatedPlayer === 'function') {
    return window.getAuthenticatedPlayer() || "";
  }
  return "";
}

function changePrimaryUser(userName) {
  localStorage.setItem("preferred_primary_user", userName);
  if (typeof window.updateAuthHeaderUI === 'function') {
    window.updateAuthHeaderUI();
  }
  renderApp();
}

function updateUserSelectOptions() {
  if (typeof window.updateAuthHeaderUI === 'function') {
    window.updateAuthHeaderUI();
  }
}

function handleOverlayClick(event, closeFunction) {
  if (event.target === event.currentTarget) {
    if (typeof closeFunction === 'function') {
      closeFunction();
    }
  }
}
// ==========================================
// 組隊 modal 勾選狀態更新（達到上限時鎖定）
// ==========================================
function updatePartyCheckboxStates() {
  const boss = window.config.bosses.find(b => b.id === editingBossId);
  const maxPartySize = boss ? boss.maxPartySize : 1;

  const checkboxes = Array.from(document.querySelectorAll('input[name="partyChar"]'));
  const checkedCount = checkboxes.filter(cb => cb.checked).length;

  const warningEl = document.getElementById("partyLimitWarning");
  if (warningEl) {
    if (checkedCount >= maxPartySize) {
      warningEl.style.display = "inline-block";
    } else {
      warningEl.style.display = "none";
    }
  }

  checkboxes.forEach(cb => {
    const isSelf = cb.getAttribute('data-is-self') === 'true';

    if (isSelf) {
      cb.disabled = true;
      return;
    }

    const label = cb.closest('label');

    if (checkedCount >= maxPartySize) {
      if (!cb.checked) {
        cb.disabled = true;
        if (label) {
          label.style.opacity = '0.4';
          label.style.cursor = 'not-allowed';
        }
      } else {
        cb.disabled = false;
        if (label) {
          label.style.opacity = '1';
          label.style.cursor = 'pointer';
        }
      }
    } else {
      cb.disabled = false;
      if (label) {
        label.style.opacity = '1';
        label.style.cursor = 'pointer';
      }
    }
  });
}
function getCollapsedPlayerKeys() {
  const saved = localStorage.getItem("collapsed_player_cards");
  if (saved === null) {
    return ["guests"];
  }
  return JSON.parse(saved);
}

function saveCollapsedPlayerKeys(keysArray) {
  localStorage.setItem("collapsed_player_cards", JSON.stringify(keysArray));
}
// ==========================================
// 倒數計時器 / 週重置偵測
// ==========================================
function updateResetTimer() {
  const timerEl = document.getElementById("reset-timer");
  if (!timerEl) return;

  const now = new Date();
  const day = now.getDay();

  let daysUntilThursday = (4 - day + 7) % 7;
  if (daysUntilThursday === 0 && (now.getHours() > 0 || now.getMinutes() > 0)) {
    daysUntilThursday = 7;
  }

  let nextThursday = new Date();
  nextThursday.setDate(now.getDate() + daysUntilThursday);
  nextThursday.setHours(0, 0, 0, 0);

  const diff = nextThursday - now;

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  timerEl.innerText = `⏳ 距離重置：${days}天 ${hours}時 ${minutes}分`;
}

function checkWeeklyResetPeriodically() {
  if (checkAndPerformWeeklyReset()) {
    saveStoreToCloud();
    renderApp();
  }
}

setInterval(() => {
  updateResetTimer();
  checkWeeklyResetPeriodically();
}, 60000);
// ==========================================
// Modal scroll lock（原 L4200–4219 第三個 <script>）
// ==========================================

(function setupModalScrollLock() {
  function init() {
    if (!document.body) return;
    function isAnyModalOpen() {
      return Array.from(document.querySelectorAll(".modal")).some(m => {
        const displayValue = m.style.display || getComputedStyle(m).display;
        return displayValue && displayValue !== "none";
      });
    }

    function updateBodyScrollLock() {
      document.body.classList.toggle("modal-open-lock", isAnyModalOpen());
    }

    const observer = new MutationObserver(updateBodyScrollLock);
    observer.observe(document.body, { attributes: true, attributeFilter: ["style"], subtree: true });

    updateBodyScrollLock();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
