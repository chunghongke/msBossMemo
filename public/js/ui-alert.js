/**
 * ui-alert.js
 * 自訂系統訊息彈窗，覆蓋原生 window.alert
 * 自動辨識訊息內容決定圖示種類（✅ 成功 / ❌ 錯誤 / ⚠️ 警告 / ℹ️ 一般）
 *
 * 公開函式：
 *   showAlert(message, icon?)   — 顯示自訂 Alert
 *   closeSysAlert()             — 關閉 Alert
 *
 * window.alert 已被覆蓋，所有 alert("...") 呼叫皆自動使用此 Modal。
 */

(function () {
  // 依訊息內容自動選擇圖示
  function detectIcon(msg) {
    const s = String(msg);
    if (/成功|完成|儲存|更新|新增|同步|已.*匯入|🎉/.test(s)) return '✅';
    if (/失敗|錯誤|❌|找不到|格式|異常|無法|拒絕/.test(s)) return '❌';
    if (/最多|上限|警告|注意|⚠️|請輸入|請確認/.test(s)) return '⚠️';
    return 'ℹ️';
  }

  let _resolveQueue = null;

  window.showAlert = function (message, icon) {
    return new Promise((resolve) => {
      const modal = document.getElementById('sysAlertModal');
      const msgEl = document.getElementById('sysAlertMessage');
      const iconEl = document.getElementById('sysAlertIcon');
      if (!modal || !msgEl) {
        // fallback：頁面還沒掛載時用原生
        _nativeAlert(message);
        resolve();
        return;
      }
      _resolveQueue = resolve;
      iconEl.textContent = icon || detectIcon(message);
      msgEl.textContent = message;
      modal.style.display = 'flex';

      // 按 Escape 關閉
      const onKey = (e) => {
        if (e.key === 'Escape') { window.closeSysAlert(); document.removeEventListener('keydown', onKey); }
      };
      document.addEventListener('keydown', onKey);
    });
  };

  window.closeSysAlert = function () {
    const modal = document.getElementById('sysAlertModal');
    if (modal) modal.style.display = 'none';
    if (_resolveQueue) { _resolveQueue(); _resolveQueue = null; }
  };

  // 保留原生 alert 備用
  const _nativeAlert = window.alert.bind(window);
  window._nativeAlert = _nativeAlert;

  // 覆蓋 window.alert
  window.alert = function (message) {
    window.showAlert(message);
  };
})();
