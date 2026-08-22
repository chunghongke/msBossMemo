/**
 * ui-auth.js
 * 玩家身分驗證與安全卡控模組 (HongLedger 風格)
 * 包含：SHA-256 密碼雜湊、登入/註冊/初次設定密碼、LocalStorage 身分憑證管理、權限檢查
 */

// 密碼雜湊函式 (使用瀏覽器標準 Web Crypto API)
async function hashPassword(password, salt = 'msbossmemo_secure_salt_2026') {
  if (!password) return '';
  const encoder = new TextEncoder();
  const data = encoder.encode(password + ':' + salt);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

let cachedAuthPlayer = null;
let lastAuthCacheKey = '';
let lastAuthHeaderHtml = '';

// 取得當前已驗證通過的玩家名稱
window.getAuthenticatedPlayer = function() {
  const savedPlayer = localStorage.getItem("boss_auth_player");
  const savedToken = localStorage.getItem("boss_auth_token");
  if (!savedPlayer || !savedToken) {
    cachedAuthPlayer = "";
    return "";
  }

  const cacheKey = `${savedPlayer}:${savedToken}:${window.config && window.config.players ? window.config.players.length : 0}`;
  if (lastAuthCacheKey === cacheKey && cachedAuthPlayer !== null) {
    return cachedAuthPlayer;
  }

  if (!window.config || !window.config.players) {
    cachedAuthPlayer = savedPlayer;
    lastAuthCacheKey = cacheKey;
    return savedPlayer;
  }

  const player = window.config.players.find(p => p.name === savedPlayer);
  if (!player) {
    cachedAuthPlayer = "";
    lastAuthCacheKey = cacheKey;
    return "";
  }

  // 若玩家有密碼，校驗 token 是否匹配
  if (player.passwordHash && player.passwordHash !== savedToken) {
    cachedAuthPlayer = "";
    lastAuthCacheKey = cacheKey;
    return "";
  }

  cachedAuthPlayer = savedPlayer;
  lastAuthCacheKey = cacheKey;
  return savedPlayer;
};

// 設定當前已驗證的玩家
window.setAuthenticatedPlayer = function(playerName, passwordHash) {
  lastAuthCacheKey = '';
  cachedAuthPlayer = null;
  localStorage.setItem("boss_auth_player", playerName);
  localStorage.setItem("boss_auth_token", passwordHash);
  localStorage.setItem("preferred_primary_user", playerName);
  updateAuthHeaderUI();
};

// 登出 / 清除身分
window.logoutPlayer = function() {
  lastAuthCacheKey = '';
  cachedAuthPlayer = null;
  localStorage.removeItem("boss_auth_player");
  localStorage.removeItem("boss_auth_token");
  localStorage.removeItem("preferred_primary_user");
  renderApp();
  updateAuthHeaderUI();
  // 清除身分後強制重新顯示登入視窗（不可關閉）
  openAuthModal('login');
};

// 初始化並檢查身分狀態
window.checkAuthAndInit = function() {
  updateAuthHeaderUI();
  const authPlayer = getAuthenticatedPlayer();
  if (!authPlayer) {
    openAuthModal('login');
  } else {
    closeAuthModal();
  }
};

// 檢查當前登入者是否為 Super User (管理員)
window.isSuperUser = function() {
  const authPlayer = getAuthenticatedPlayer();
  if (!authPlayer || !window.config || !window.config.players) return false;
  const player = window.config.players.find(p => p.name === authPlayer);
  return !!(player && player.isAdmin);
};

// 檢查當前登入者是否有權限操作目標玩家 (本人 或 管理員)
window.canManagePlayer = function(targetPlayerName) {
  const authPlayer = getAuthenticatedPlayer();
  if (!authPlayer) return false;
  return authPlayer === targetPlayerName || isSuperUser();
};

// 更新頂部工具列身分資訊
window.updateAuthHeaderUI = function() {
  const container = document.getElementById("authHeaderProfile");
  if (!container) return;

  const authPlayerName = getAuthenticatedPlayer();
  let newHtml = "";
  if (authPlayerName) {
    const player = (window.config.players || []).find(p => p.name === authPlayerName);
    const emoji = player && player.avatarEmoji ? player.avatarEmoji : '👤';
    const isAdmin = isSuperUser();

    const badgeHtml = isAdmin
      ? `<span style="font-size: 10px; background: linear-gradient(135deg, #f59e0b, #d97706); color: #fff; padding: 1px 7px; border-radius: 10px; font-weight: bold; box-shadow: 0 1px 4px rgba(245, 158, 11, 0.4);">👑 管理員</span>`
      : `<span style="font-size: 10px; background: #3b82f6; color: #fff; padding: 1px 6px; border-radius: 10px;">主要玩家</span>`;

    newHtml = `
      <div style="display: flex; align-items: center; gap: 8px; background: var(--char-card-bg, #f1f5f9); padding: 4px 10px; border-radius: 20px; border: 1px solid var(--border-color); font-size: 13px;">
        <span style="font-size: 16px;">${emoji}</span>
        <strong style="color: var(--text-main);">${authPlayerName}</strong>
        ${badgeHtml}
        <button type="button" onclick="openChangePasswordModal()" style="background: none; border: none; font-size: 11px; color: var(--text-muted); cursor: pointer; text-decoration: underline; padding: 0 2px;">修改密碼</button>
        <span style="color: var(--border-color); font-size: 11px;">|</span>
        <button type="button" onclick="openAuthModal('login')" style="background: none; border: none; font-size: 11px; color: var(--text-muted); cursor: pointer; text-decoration: underline; padding: 0 2px;">切換玩家</button>
      </div>
    `;
  } else {
    newHtml = `
      <button class="btn" onclick="openAuthModal('login')" style="background: #e11d48; border-color: #e11d48; font-size: 13px;">
        🔑 選擇/登入主要玩家
      </button>
    `;
  }

  if (lastAuthHeaderHtml !== newHtml) {
    lastAuthHeaderHtml = newHtml;
    container.innerHTML = newHtml;
  }
};

// ==========================================
// 彈窗操作
// ==========================================
window.openAuthModal = function(mode = 'login') {
  const modal = document.getElementById("authModal");
  const tabHeader = document.getElementById("authTabHeader");
  const titleText = document.getElementById("authModalTitleText");
  const titleIcon = document.getElementById("authModalTitleIcon");
  const closeBtn = document.getElementById("authModalCloseBtn");
  const loginCancelBtn = document.getElementById("authLoginCancelBtn");
  const regCancelBtn = document.getElementById("authRegCancelBtn");
  if (!modal) return;

  // 清除註冊表單輸入
  const nameInput = document.getElementById("authRegName");
  const pwdInput = document.getElementById("authRegPassword");
  const confirmInput = document.getElementById("authRegPasswordConfirm");
  if (nameInput) nameInput.value = "";
  if (pwdInput) pwdInput.value = "";
  if (confirmInput) confirmInput.value = "";

  const currentAuth = getAuthenticatedPlayer();
  const canClose = !!currentAuth;

  // ✕ 按鈕：只有已登入才顯示
  if (closeBtn) closeBtn.style.display = canClose ? "block" : "none";
  // 登入表單取消按鈕：只有已登入才顯示
  if (loginCancelBtn) loginCancelBtn.style.display = canClose ? "inline-block" : "none";
  // 建立玩家取消按鈕：已登入顯示「取消」；未登入顯示「← 返回登入」
  if (regCancelBtn) {
    regCancelBtn.textContent = canClose ? "取消" : "← 返回登入";
  }

  if (mode === 'register_only') {
    if (tabHeader) tabHeader.style.display = "none";
    if (titleText) titleText.textContent = "新增玩家";
    if (titleIcon) titleIcon.textContent = "➕";
    switchAuthTab('register');
  } else {
    if (tabHeader) tabHeader.style.display = "flex";
    if (titleText) titleText.textContent = "玩家身分驗證";
    if (titleIcon) titleIcon.textContent = "🔐";
    switchAuthTab(mode);
  }

  const logoutBtn = document.getElementById("authModalLogoutBtn");
  if (logoutBtn) {
    logoutBtn.style.display = (currentAuth && mode !== 'register_only') ? "inline-block" : "none";
  }

  modal.style.display = "flex";
};

window.closeAuthModal = function() {
  // 若未登入，禁止關閉（強制必須完成登入）
  const currentAuth = getAuthenticatedPlayer();
  if (!currentAuth) return;
  const modal = document.getElementById("authModal");
  if (modal) modal.style.display = "none";
};

// 建立新玩家表單的取消按鈕：
// - 已登入（切換玩家 → 建立新玩家 Tab）→ 關閉 Modal
// - 未登入（強制登入模式）→ 切回登入 Tab（不能關閉）
window.authRegCancel = function() {
  const currentAuth = getAuthenticatedPlayer();
  if (currentAuth) {
    closeAuthModal();
  } else {
    switchAuthTab('login');
  }
};

window.switchAuthTab = function(tab) {
  const tabLogin = document.getElementById("authTabLogin");
  const tabRegister = document.getElementById("authTabRegister");
  const formLogin = document.getElementById("authFormLogin");
  const formRegister = document.getElementById("authFormRegister");
  const errorMsg = document.getElementById("authErrorMsg");
  if (errorMsg) errorMsg.style.display = "none";

  if (tab === 'login') {
    if (tabLogin) {
      tabLogin.style.borderBottom = "2px solid #3b82f6";
      tabLogin.style.fontWeight = "bold";
      tabLogin.style.color = "var(--text-main)";
    }
    if (tabRegister) {
      tabRegister.style.borderBottom = "2px solid transparent";
      tabRegister.style.fontWeight = "normal";
      tabRegister.style.color = "var(--text-muted)";
    }
    if (formLogin) formLogin.style.display = "block";
    if (formRegister) formRegister.style.display = "none";
    renderAuthPlayerSelect();
  } else {
    if (tabLogin) {
      tabLogin.style.borderBottom = "2px solid transparent";
      tabLogin.style.fontWeight = "normal";
      tabLogin.style.color = "var(--text-muted)";
    }
    if (tabRegister) {
      tabRegister.style.borderBottom = "2px solid #3b82f6";
      tabRegister.style.fontWeight = "bold";
      tabRegister.style.color = "var(--text-main)";
    }
    if (formLogin) formLogin.style.display = "none";
    if (formRegister) formRegister.style.display = "block";
  }
};

function showAuthError(msg) {
  const errorBox = document.getElementById("authErrorMsg");
  if (errorBox) {
    errorBox.textContent = msg;
    errorBox.style.display = "block";
  } else {
    alert(msg);
  }
}

// 渲染登入彈窗中的玩家下拉選單
window.renderAuthPlayerSelect = function() {
  const select = document.getElementById("authPlayerSelect");
  if (!select) return;

  select.innerHTML = "";
  const players = window.config.players || [];

  if (players.length === 0) {
    select.innerHTML = `<option value="">-- 目前無玩家，請切換至註冊 --</option>`;
    handleAuthPlayerChange();
    return;
  }

  const currentAuth = getAuthenticatedPlayer();
  players.forEach(p => {
    const isSelected = p.name === currentAuth ? "selected" : "";
    const emoji = p.avatarEmoji || "👤";
    select.innerHTML += `<option value="${p.name}" ${isSelected}>${emoji} ${p.name}</option>`;
  });

  handleAuthPlayerChange();
};

// 當登入選取的玩家改變時
window.handleAuthPlayerChange = function() {
  const select = document.getElementById("authPlayerSelect");
  const pwdInput = document.getElementById("authLoginPassword");
  const submitBtn = document.getElementById("authLoginSubmitBtn");
  const errorMsg = document.getElementById("authErrorMsg");
  if (errorMsg) errorMsg.style.display = "none";
  if (pwdInput) pwdInput.value = "";

  if (select && submitBtn) {
    submitBtn.disabled = !select.value;
  }
};

// 處理登入提交
window.handleLoginSubmit = async function(event) {
  if (event) event.preventDefault();
  const select = document.getElementById("authPlayerSelect");
  const playerName = select ? select.value : "";
  if (!playerName) {
    showAuthError("請先選擇要登入的玩家！");
    return;
  }

  const player = (window.config.players || []).find(p => p.name === playerName);
  if (!player) {
    showAuthError("找不到該玩家資料！");
    return;
  }

  const pwdInput = document.getElementById("authLoginPassword");
  const password = pwdInput ? pwdInput.value : "";
  if (!password) {
    showAuthError("請輸入密碼！");
    return;
  }

  const submitBtn = document.getElementById("authLoginSubmitBtn");
  if (submitBtn) submitBtn.disabled = true;

  try {
    const inputHash = await hashPassword(password);
    if (!player.passwordHash || inputHash !== player.passwordHash) {
      showAuthError("密碼錯誤，請重新輸入！");
      if (submitBtn) submitBtn.disabled = false;
      return;
    }

    // 驗證通過
    setAuthenticatedPlayer(playerName, inputHash);
    closeAuthModal();
    renderApp();
    alert(`歡迎回來，${playerName}！已切換為主要玩家。`);
  } catch (err) {
    console.error("登入錯誤：", err);
    showAuthError("登入過程發生錯誤，請稍後再試！");
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
};

// 處理建立新玩家提交
window.handleRegisterSubmit = async function(event) {
  if (event) event.preventDefault();

  const nameInput = document.getElementById("authRegName");
  const pwdInput = document.getElementById("authRegPassword");
  const confirmInput = document.getElementById("authRegPasswordConfirm");
  const emojiInput = document.getElementById("authRegEmoji");

  const name = nameInput ? nameInput.value.trim() : "";
  const pwd = pwdInput ? pwdInput.value : "";
  const confirmPwd = confirmInput ? confirmInput.value : "";
  const emoji = emojiInput ? emojiInput.value.trim() : "👤";

  if (!name) {
    showAuthError("請輸入玩家名稱！");
    return;
  }

  const currentPlayers = window.config.players || [];
  if (currentPlayers.some(p => p.name === name)) {
    showAuthError("該玩家名稱已存在，請使用不同名稱或切換至登入！");
    return;
  }

  if (!pwd) {
    showAuthError("請輸入密碼！");
    return;
  }
  if (pwd.length < 3) {
    showAuthError("密碼長度至少需 3 碼！");
    return;
  }
  if (pwd !== confirmPwd) {
    showAuthError("兩次輸入的密碼不一致！");
    return;
  }

  const submitBtn = document.getElementById("authRegSubmitBtn");
  if (submitBtn) submitBtn.disabled = true;

  try {
    const newHash = await hashPassword(pwd);
    const newPlayer = {
      name: name,
      avatarEmoji: emoji || "👤",
      passwordHash: newHash,
      characters: []
    };

    const updatedPlayers = [...currentPlayers, newPlayer];

    if (window.db && window.dbRef && window.dbSet) {
      const playersRef = window.dbRef(window.db, '/players');
      await window.dbSet(playersRef, updatedPlayers);
    }

    setAuthenticatedPlayer(name, newHash);
    closeAuthModal();
    renderApp();
    alert(`成功建立玩家【${name}】並已登入！`);
  } catch (err) {
    console.error("建立玩家錯誤：", err);
    showAuthError("建立玩家失敗，請檢查網路連線或權限！");
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
};

// ==========================================
// 修改密碼功能
// ==========================================
window.openChangePasswordModal = function() {
  const authPlayer = getAuthenticatedPlayer();
  if (!authPlayer) {
    alert("⚠️ 請先選擇/登入主要玩家！");
    openAuthModal();
    return;
  }

  const modal = document.getElementById("changePasswordModal");
  const playerLabel = document.getElementById("changePwdPlayerLabel");
  const errBox = document.getElementById("changePwdErrorMsg");
  const currInput = document.getElementById("changePwdCurrent");
  const newInput = document.getElementById("changePwdNew");
  const confirmInput = document.getElementById("changePwdConfirm");

  if (playerLabel) playerLabel.textContent = `目前玩家：👤 ${authPlayer}`;
  if (errBox) errBox.style.display = "none";
  if (currInput) currInput.value = "";
  if (newInput) newInput.value = "";
  if (confirmInput) confirmInput.value = "";

  if (modal) modal.style.display = "flex";
};

window.closeChangePasswordModal = function() {
  const modal = document.getElementById("changePasswordModal");
  if (modal) modal.style.display = "none";
};

window.handleChangePasswordSubmit = async function(event) {
  if (event) event.preventDefault();

  const authPlayer = getAuthenticatedPlayer();
  if (!authPlayer) {
    alert("⚠️ 請先選擇/登入主要玩家！");
    closeChangePasswordModal();
    openAuthModal();
    return;
  }

  const player = (window.config.players || []).find(p => p.name === authPlayer);
  if (!player) {
    alert("找不到該玩家資料！");
    return;
  }

  const currInput = document.getElementById("changePwdCurrent");
  const newInput = document.getElementById("changePwdNew");
  const confirmInput = document.getElementById("changePwdConfirm");
  const errBox = document.getElementById("changePwdErrorMsg");
  const submitBtn = document.getElementById("changePwdSubmitBtn");

  const currentPwd = currInput ? currInput.value : "";
  const newPwd = newInput ? newInput.value : "";
  const confirmPwd = confirmInput ? confirmInput.value : "";

  function showPwdErr(msg) {
    if (errBox) {
      errBox.textContent = msg;
      errBox.style.display = "block";
    } else {
      alert(msg);
    }
  }

  if (player.passwordHash) {
    if (!currentPwd) {
      showPwdErr("請輸入目前密碼！");
      return;
    }
    const currentHash = await hashPassword(currentPwd);
    if (currentHash !== player.passwordHash) {
      showPwdErr("目前密碼不正確！");
      return;
    }
  }

  if (!newPwd) {
    showPwdErr("請輸入新密碼！");
    return;
  }
  if (newPwd.length < 3) {
    showPwdErr("新密碼長度至少需 3 碼！");
    return;
  }
  if (newPwd !== confirmPwd) {
    showPwdErr("兩次輸入的新密碼不一致！");
    return;
  }

  if (submitBtn) submitBtn.disabled = true;

  try {
    const newHash = await hashPassword(newPwd);
    player.passwordHash = newHash;

    if (window.db && window.dbRef && window.dbSet) {
      const playersRef = window.dbRef(window.db, '/players');
      await window.dbSet(playersRef, window.config.players);
    }

    setAuthenticatedPlayer(authPlayer, newHash);
    closeChangePasswordModal();
    alert(`成功更新【${authPlayer}】的密碼！`);
  } catch (err) {
    console.error("更新密碼失敗：", err);
    showPwdErr("更新密碼失敗，請檢查網路連線或權限！");
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
};

// ==========================================
// 管理員重設他人密碼功能
// ==========================================
let adminResetTargetPlayer = null;

window.openAdminResetPasswordModal = function(targetPlayerName) {
  if (!isSuperUser()) {
    alert("⚠️ 只有管理員可以重設其他玩家的密碼！");
    return;
  }

  adminResetTargetPlayer = targetPlayerName;
  const modal = document.getElementById("adminResetPasswordModal");
  const label = document.getElementById("adminResetPlayerLabel");
  const input = document.getElementById("adminResetNewPwd");
  const errBox = document.getElementById("adminResetErrorMsg");

  if (label) label.innerHTML = `正在為玩家：<strong style="color: #f59e0b;">👤 ${targetPlayerName}</strong> 重設密碼`;
  if (errBox) errBox.style.display = "none";
  if (input) {
    // 預設產生一組隨機 6 碼數字
    input.value = Math.floor(100000 + Math.random() * 900000).toString();
  }

  if (modal) modal.style.display = "flex";
};

window.closeAdminResetPasswordModal = function() {
  const modal = document.getElementById("adminResetPasswordModal");
  if (modal) modal.style.display = "none";
  adminResetTargetPlayer = null;
};

window.generateRandomResetPassword = function() {
  const input = document.getElementById("adminResetNewPwd");
  if (input) {
    input.value = Math.floor(100000 + Math.random() * 900000).toString();
  }
};

window.handleAdminResetPasswordSubmit = async function(event) {
  if (event) event.preventDefault();

  if (!isSuperUser()) {
    alert("⚠️ 權限不足！只有管理員可執行此操作。");
    closeAdminResetPasswordModal();
    return;
  }

  if (!adminResetTargetPlayer) {
    alert("未指定目標玩家！");
    return;
  }

  const player = (window.config.players || []).find(p => p.name === adminResetTargetPlayer);
  if (!player) {
    alert(`找不到玩家【${adminResetTargetPlayer}】！`);
    return;
  }

  const input = document.getElementById("adminResetNewPwd");
  const newPwd = input ? input.value.trim() : "";
  const errBox = document.getElementById("adminResetErrorMsg");
  const submitBtn = document.getElementById("adminResetSubmitBtn");

  if (!newPwd || newPwd.length < 3) {
    if (errBox) {
      errBox.textContent = "請輸入至少 3 碼的新密碼！";
      errBox.style.display = "block";
    } else {
      alert("請輸入至少 3 碼的新密碼！");
    }
    return;
  }

  if (submitBtn) submitBtn.disabled = true;

  try {
    const newHash = await hashPassword(newPwd);
    player.passwordHash = newHash;

    if (window.db && window.dbRef && window.dbSet) {
      const playersRef = window.dbRef(window.db, '/players');
      await window.dbSet(playersRef, window.config.players);
    }

    const resetName = adminResetTargetPlayer;
    closeAdminResetPasswordModal();
    alert(`🎉 成功將【${resetName}】的密碼重設為：\n\n👉 ${newPwd}\n\n請將此新密碼告知該玩家進行登入！`);
  } catch (err) {
    console.error("管理員重設密碼失敗：", err);
    if (errBox) {
      errBox.textContent = "重設密碼失敗，請檢查網路連線！";
      errBox.style.display = "block";
    } else {
      alert("重設密碼失敗，請檢查網路連線！");
    }
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
};

