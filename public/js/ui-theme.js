/**
 * ui-theme.js
 * Contains: applyThemeImmediately, updateThemeButton, toggleTheme
 */

// ==========================================
// 主題切換
// ==========================================
(function applyThemeImmediately() {
  const savedTheme = localStorage.getItem("theme");
  const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;

  if (savedTheme === "dark" || (!savedTheme && prefersDark)) {
    document.documentElement.classList.add("dark-mode");
  } else {
    document.documentElement.classList.remove("dark-mode");
  }
})();

window.toggleTheme = function() {
  const isDark = document.documentElement.classList.toggle("dark-mode");
  localStorage.setItem("theme", isDark ? "dark" : "light");
  updateThemeButton(isDark);
};

function updateThemeButton(isDark) {
  const iconEl = document.getElementById("themeIcon");
  const textEl = document.getElementById("themeText");
  if (iconEl && textEl) {
    iconEl.innerText = isDark ? "☀️" : "🌙";
    textEl.innerText = isDark ? "淺色模式" : "深色模式";
  }
}

document.addEventListener("DOMContentLoaded", function() {
  const isDark = document.documentElement.classList.contains("dark-mode");
  updateThemeButton(isDark);
  initNotificationSystem();
});
