const fs = require('fs');
const content = fs.readFileSync('C:/Users/i5-12500/Desktop/BossParty/public/js/ui.js.bak', 'utf-8');

// The output pieces
let uiTheme = '/**\n * ui-theme.js\n * Contains: applyThemeImmediately, updateThemeButton, toggleTheme\n */\n\n';
let uiDragDrop = '/**\n * ui-drag-drop.js\n * Contains: initDragAndDrop, persistCharacterOrder, persistPlayerOrder, getPlayerOrder, savePlayerOrder, getCharacterOrder, saveCharacterOrder\n */\n\n';
let uiCharacter = '/**\n * ui-character.js\n * Contains: openAddCharacterModal, closeAddCharacterModal, submitNewCharacter, openRenameCharModal, closeRenameCharModal, submitRenameChar, openEditCharBossesModal, handleCharBossCheckboxLimit, updateCharBossCountDisplay, closeEditCharBossesModal, saveEditCharBosses\n */\n\n';
let uiPlayer = '/**\n * ui-player.js\n * Contains: openAddPlayerModal, closeAddPlayerModal, isSingleEmoji, renderAvatarEmojiGrid, openAvatarPickerModal, closeAvatarPickerModal, selectAvatarEmoji, validateAvatarInput, useDefaultAvatarEmoji, saveAvatarEmoji, submitAddPlayer, getCustomAvatarEmojis, addCustomAvatarEmoji\n */\n\n';
let uiRemain = '/**\n * ui.js\n * Contains: togglePlayerCollapse, toggleAllPlayers, getPrimaryUser, changePrimaryUser, updateUserSelectOptions, handleOverlayClick, updatePartyCheckboxStates, getCollapsedPlayerKeys, saveCollapsedPlayerKeys, updateResetTimer, checkWeeklyResetPeriodically, setupModalScrollLock\n */\n\n';

const lines = content.split(/\r?\n/);

function getLines(start, end) {
  return lines.slice(start - 1, end).join('\n') + '\n';
}

uiRemain += getLines(18, 98); // togglePlayerCollapse up to handleOverlayClick

uiCharacter += getLines(100, 249); // Character management (add/rename)

uiTheme += getLines(251, 284); // Theme logic

uiPlayer += getLines(286, 444); // Player management

uiRemain += getLines(446, 497); // updatePartyCheckboxStates

uiDragDrop += getLines(502, 509); // get/savePlayerOrder
uiPlayer += getLines(511, 521); // customAvatarEmojis
uiDragDrop += getLines(523, 530); // get/saveCharacterOrder

uiRemain += getLines(532, 542); // collapsedPlayerKeys

uiDragDrop += getLines(544, 652); // Drag and Drop

uiRemain += getLines(654, 692); // updateResetTimer, checkWeeklyResetPeriodically

uiCharacter += getLines(694, 806); // Edit Bosses Modal

uiRemain += getLines(808, 837); // setupModalScrollLock

fs.writeFileSync('C:/Users/i5-12500/Desktop/BossParty/public/js/ui-theme.js', uiTheme);
fs.writeFileSync('C:/Users/i5-12500/Desktop/BossParty/public/js/ui-drag-drop.js', uiDragDrop);
fs.writeFileSync('C:/Users/i5-12500/Desktop/BossParty/public/js/ui-character.js', uiCharacter);
fs.writeFileSync('C:/Users/i5-12500/Desktop/BossParty/public/js/ui-player.js', uiPlayer);
fs.writeFileSync('C:/Users/i5-12500/Desktop/BossParty/public/js/ui.js', uiRemain);
