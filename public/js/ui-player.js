/**
 * ui-player.js
 * Contains: openAddPlayerModal, closeAddPlayerModal, isSingleEmoji, renderAvatarEmojiGrid, openAvatarPickerModal, closeAvatarPickerModal, selectAvatarEmoji, validateAvatarInput, useDefaultAvatarEmoji, saveAvatarEmoji, submitAddPlayer, getCustomAvatarEmojis, addCustomAvatarEmoji
 */

// ==========================================
// 玩家管理（新增玩家 / 頭像）
// ==========================================
function openAddPlayerModal() {
  document.getElementById("newPlayerName").value = "";
  document.getElementById("addPlayerModal").style.display = "flex";
}

function closeAddPlayerModal() {
  document.getElementById("addPlayerModal").style.display = "none";
}

function isSingleEmoji(str) {
  const trimmed = (str || "").trim();
  if (!trimmed) return false;

  const emojiCharPattern = /^(\p{Extended_Pictographic}|\p{Emoji_Presentation}|[\u200D\uFE0F\u{1F3FB}-\u{1F3FF}\u2640\u2642])+$/u;
  if (!emojiCharPattern.test(trimmed)) return false;

  if (typeof Intl !== "undefined" && Intl.Segmenter) {
    const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
    return Array.from(segmenter.segment(trimmed)).length === 1;
  }

  return true;
}

const DEFAULT_AVATAR_EMOJIS = [
  '⚔️', '🛡️', '🏹', '🔮', '👑', '🧙', '🧙‍♀️', '🥷', '🐉', '🦄',
  '🐱', '🦊', '🗡️', '🏆', '💎', '🔥', '⭐', '🌙', '🍀', '🎯', '🎮'
];

function renderAvatarEmojiGrid() {
  const grid = document.getElementById("avatarEmojiGrid");
  if (!grid) return;

  const allEmojis = [...DEFAULT_AVATAR_EMOJIS, ...getCustomAvatarEmojis()];

  grid.innerHTML = allEmojis
    .map(emoji => `<button type="button" class="avatar-emoji-option" onclick="selectAvatarEmoji('${emoji}')">${emoji}</button>`)
    .join("");
}

let editingAvatarPlayerName = null;

function openAvatarPickerModal(playerName) {
  editingAvatarPlayerName = playerName;
  renderAvatarEmojiGrid();
  const player = window.config.players.find(p => p.name === playerName);
  const input = document.getElementById("avatarEmojiInput");
  input.value = (player && player.avatarEmoji) || "";
  document.getElementById("avatarEmojiError").innerText = "";
  document.getElementById("avatarSaveAsDefaultCheckbox").checked = false;
  document.getElementById("avatarSaveBtn").disabled = !isSingleEmoji(input.value);
  document.getElementById("avatarPickerModal").style.display = "flex";
}

function closeAvatarPickerModal() {
  document.getElementById("avatarPickerModal").style.display = "none";
  editingAvatarPlayerName = null;
}

function selectAvatarEmoji(emoji) {
  const input = document.getElementById("avatarEmojiInput");
  input.value = emoji;
  validateAvatarInput();
}

function validateAvatarInput() {
  const input = document.getElementById("avatarEmojiInput");
  const errorEl = document.getElementById("avatarEmojiError");
  const saveBtn = document.getElementById("avatarSaveBtn");
  const value = input.value;

  if (!value.trim()) {
    errorEl.innerText = "";
    saveBtn.disabled = true;
    return;
  }

  if (isSingleEmoji(value)) {
    errorEl.innerText = "";
    saveBtn.disabled = false;
  } else {
    errorEl.innerText = "⚠️ 請輸入剛好一個表情符號（不能是文字或多個字元）";
    saveBtn.disabled = true;
  }
}

function useDefaultAvatarEmoji() {
  const input = document.getElementById("avatarEmojiInput");
  input.value = "";
  document.getElementById("avatarEmojiError").innerText = "";
  document.getElementById("avatarSaveAsDefaultCheckbox").checked = false;
  document.getElementById("avatarSaveBtn").disabled = false;
}

async function saveAvatarEmoji() {
  const input = document.getElementById("avatarEmojiInput");
  const value = input.value.trim();

  if (value && !isSingleEmoji(value)) return;

  const player = window.config.players.find(p => p.name === editingAvatarPlayerName);
  if (!player) return;

  if (value) {
    player.avatarEmoji = value;
    const saveAsDefault = document.getElementById("avatarSaveAsDefaultCheckbox").checked;
    if (saveAsDefault) {
      addCustomAvatarEmoji(value);
    }
  } else {
    delete player.avatarEmoji;
  }

  try {
    const playersRef = window.dbRef(window.db, '/players');
    await window.dbSet(playersRef, window.config.players);
    closeAvatarPickerModal();
    renderApp();
  } catch (error) {
    console.error("寫入 Firebase 失敗：", error);
    alert("儲存頭像失敗，請稍後再試！");
  }
}

async function submitAddPlayer() {
  const playerName = document.getElementById("newPlayerName").value.trim();

  if (!playerName) {
    alert("請輸入玩家名稱！");
    return;
  }

  const currentPlayers = window.config.players || [];

  const isExist = currentPlayers.some(p => p.name === playerName);
  if (isExist) {
    alert("該玩家名稱已存在！");
    return;
  }

  const newPlayer = {
    name: playerName,
    characters: []
  };

  const updatedPlayers = [...currentPlayers, newPlayer];

  try {
    const playersRef = window.dbRef(window.db, '/players');
    await window.dbSet(playersRef, updatedPlayers);
    closeAddPlayerModal();
  } catch (error) {
    console.error("寫入 Firebase 失敗：", error);
    alert("新增玩家失敗，請稍後再試！");
  }
}
function getCustomAvatarEmojis() {
  const saved = localStorage.getItem("custom_avatar_emojis");
  return saved ? JSON.parse(saved) : [];
}

function addCustomAvatarEmoji(emoji) {
  const custom = getCustomAvatarEmojis();
  if (DEFAULT_AVATAR_EMOJIS.includes(emoji) || custom.includes(emoji)) return;
  custom.push(emoji);
  localStorage.setItem("custom_avatar_emojis", JSON.stringify(custom));
}
