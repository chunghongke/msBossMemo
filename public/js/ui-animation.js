/**
 * ui-animation.js
 * Contains: captureBossCellPositions, playBossCellReorderAnimation
 */

// 記錄目前每個 boss-cell 的畫面位置（key 為 recordKey），供重繪後做滑動動畫比對用
function captureBossCellPositions(container) {
  const positions = new Map();
  container.querySelectorAll(".boss-cell[data-record-key]").forEach(cell => {
    positions.set(cell.dataset.recordKey, cell.getBoundingClientRect());
  });
  return positions;
}

// FLIP 動畫：比對重繪前後的位置差異，用 transform 讓卡片「滑」到新位置，而不是瞬間跳過去
function playBossCellReorderAnimation(container, oldPositions) {
  if (!oldPositions || oldPositions.size === 0) return;

  container.querySelectorAll(".boss-cell[data-record-key]").forEach(cell => {
    const key = cell.dataset.recordKey;
    const oldRect = oldPositions.get(key);
    if (!oldRect) return;

    const newRect = cell.getBoundingClientRect();
    const dx = oldRect.left - newRect.left;
    const dy = oldRect.top - newRect.top;

    if (dx === 0 && dy === 0) return;

    // 1. 先瞬間移回原位置
    cell.style.transition = "none";
    cell.style.transform = `translate(${dx}px, ${dy}px)`;

    // 2. 強制瀏覽器即時計算樣式 (Reflow)，消除 requestAnimationFrame 造成的額外延遲
    void cell.offsetHeight;

    // 3. 瞬間套用平滑移動過渡，滑向最終位置 (0.22s 靈敏順暢曲線)
    cell.style.transition = "transform 0.22s cubic-bezier(0.2, 0, 0, 1)";
    cell.style.transform = "";

    cell.addEventListener("transitionend", function cleanup() {
      cell.style.transition = "";
      cell.removeEventListener("transitionend", cleanup);
    }, { once: true });
  });
}
