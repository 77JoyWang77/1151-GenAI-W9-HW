/* =====================================================================
   theme.js — 亮 / 暗模式切換（預設淺色）
   放在 <head> 裡同步載入，在畫面出現前就套用主題，避免閃一下。
   使用者的選擇存在 localStorage("ds-theme")：
     "light" | "dark"；沒有存過就用淺色。
   頁首的 <button data-theme-toggle> 會自動綁定切換功能。
   ===================================================================== */
(function () {
  "use strict";
  const KEY = "ds-theme";
  const root = document.documentElement;
  const ICONS = new URL("../icons.svg", document.currentScript.src).href;
  const icon = (n) => `<svg class="icon" aria-hidden="true"><use href="${ICONS}#i-${n}"></use></svg>`;

  function saved() {
    try { return localStorage.getItem(KEY); } catch (e) { return null; }
  }
  function apply(theme) {
    root.setAttribute("data-theme", theme);
    document.querySelectorAll("[data-theme-toggle]").forEach((btn) => {
      btn.innerHTML = theme === "dark" ? `${icon("sun")}<span>淺色</span>` : `${icon("moon")}<span>深色</span>`;
      btn.setAttribute("aria-label", theme === "dark" ? "切換成淺色模式" : "切換成深色模式");
    });
  }

  apply(saved() === "dark" ? "dark" : "light");

  document.addEventListener("DOMContentLoaded", () => {
    apply(root.getAttribute("data-theme"));
    document.querySelectorAll("[data-theme-toggle]").forEach((btn) =>
      btn.addEventListener("click", () => {
        const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
        try { localStorage.setItem(KEY, next); } catch (e) { /* 無痕模式等情況：只切換不記憶 */ }
        apply(next);
      })
    );
  });
})();
