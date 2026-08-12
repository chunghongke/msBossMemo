/**
 * ui-drag-drop.js
 * Contains: initDragAndDrop, persistCharacterOrder, persistPlayerOrder, getPlayerOrder, savePlayerOrder, getCharacterOrder, saveCharacterOrder
 */

function getPlayerOrder() {
  const saved = localStorage.getItem("player_custom_order");
  return saved ? JSON.parse(saved) : [];
}

function savePlayerOrder(orderArray) {
  localStorage.setItem("player_custom_order", JSON.stringify(orderArray));
}
function getCharacterOrder(playerName) {
  const saved = localStorage.getItem(`character_custom_order_${playerName}`);
  return saved ? JSON.parse(saved) : [];
}

function saveCharacterOrder(playerName, orderArray) {
  localStorage.setItem(`character_custom_order_${playerName}`, JSON.stringify(orderArray));
}
// ==========================================
// 拖曳排序（玩家卡 / 角色卡）
// ==========================================
function initDragAndDrop() {
  const container = document.getElementById("characterList");
  if (!container || container.dataset.dragInited) return;

  let draggedCard = null;
  let draggedType = null; // "player" | "character"

  container.addEventListener("dragstart", (e) => {
    if (['BUTTON', 'INPUT', 'SELECT', 'OPTION'].includes(e.target.tagName)) {
      e.preventDefault();
      return;
    }

    const charCard = e.target.closest(".character-card");
    if (charCard) {
      draggedCard = charCard;
      draggedType = "character";
      charCard.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", "character-card");
      return;
    }

    const playerCard = e.target.closest(".player-card");
    if (!playerCard) return;

    draggedCard = playerCard;
    draggedType = "player";
    playerCard.classList.add("dragging");
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", "player-card");
  });

  container.addEventListener("dragend", () => {
    if (draggedCard) draggedCard.classList.remove("dragging");
    draggedCard = null;
    draggedType = null;
  });

  container.addEventListener("dragenter", (e) => {
    e.preventDefault();
  });

  container.addEventListener("dragover", (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";

    if (draggedType === "character") {
      const targetCard = e.target.closest(".character-card");
      if (!targetCard || targetCard === draggedCard) return;
      if (targetCard.parentElement !== draggedCard.parentElement) return;

      const rect = targetCard.getBoundingClientRect();
      const next = (e.clientY - rect.top) / (rect.bottom - rect.top) > 0.5;
      targetCard.parentElement.insertBefore(draggedCard, next ? targetCard.nextSibling : targetCard);
      return;
    }

    if (draggedType === "player") {
      const targetCard = e.target.closest(".player-card");
      if (!targetCard || targetCard === draggedCard) return;

      const rect = targetCard.getBoundingClientRect();
      const next = (e.clientY - rect.top) / (rect.bottom - rect.top) > 0.5;
      container.insertBefore(draggedCard, next ? targetCard.nextSibling : targetCard);
    }
  });

  container.addEventListener("drop", (e) => {
    e.preventDefault();

    if (draggedType === "character" && draggedCard) {
      persistCharacterOrder(draggedCard);
      return;
    }

    if (draggedType === "player") {
      persistPlayerOrder();
    }
  });

  function persistCharacterOrder(cardEl) {
    const playerName = cardEl.dataset.playerName;
    const parentContainer = cardEl.parentElement;
    const newOrder = Array.from(parentContainer.querySelectorAll(".character-card"))
      .map(card => card.dataset.charId)
      .filter(Boolean);
    saveCharacterOrder(playerName, newOrder);
  }

  function persistPlayerOrder() {
    const cards = container.querySelectorAll(".player-card");
    const newOrder = Array.from(cards)
      .map(card => card.dataset.playerName)
      .filter(Boolean);
    savePlayerOrder(newOrder);
  }

  container.dataset.dragInited = "true";

  if (!window.__dragDropWindowGuardInited) {
    window.addEventListener("dragover", (e) => e.preventDefault());
    window.addEventListener("drop", (e) => e.preventDefault());
    window.__dragDropWindowGuardInited = true;
  }
}
