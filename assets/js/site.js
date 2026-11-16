/* =====================================================================
   site.js — 首頁章節地圖、主題頁目錄 / 上下篇導覽 / 測驗展開
   資料來源：data/syllabus.json（格式見 CLAUDE.md 第 5 節）
   ===================================================================== */
(function () {
  "use strict";

  const $ = (s, r = document) => r.querySelector(s);
  function h(tag, attrs, children) {
    const el = document.createElement(tag);
    for (const k in attrs || {}) {
      if (k === "text") el.textContent = attrs[k];
      else el.setAttribute(k, attrs[k]);
    }
    (children || []).forEach((c) => c && el.appendChild(typeof c === "string" ? document.createTextNode(c) : c));
    return el;
  }

  // 主題頁在 topics/<chapter>/<topic>.html，所以 root = "../../"
  const ROOT = document.body.dataset.root || "";

  async function loadSyllabus() {
    const res = await fetch(ROOT + "data/syllabus.json", { cache: "no-cache" });
    return res.json();
  }

  // ---------- 首頁 ----------
  function renderHome(data) {
    const box = $("#chapters");
    const all = data.chapters.flatMap((c) => c.topics);
    const done = all.filter((t) => t.status === "done").length;
    $("#progress-bar").style.width = Math.round((done / all.length) * 100) + "%";
    $("#progress-txt").textContent = `已完成 ${done} / ${all.length} 個主題（${Math.round((done / all.length) * 100)}%），其餘標示為籌備中`;

    data.chapters.forEach((ch, i) => {
      const list = h("ul", {}, ch.topics.map((t) => {
        const name = `${t.en}（${t.zh}）`;
        if (t.status !== "done") return h("li", {}, [h("span", { class: "planned", text: name }), h("span", { class: "badge", text: "籌備中" })]);
        const badges = h("span", {}, [t.viz ? h("span", { class: "badge viz", text: "▶ 互動" }) : null, " ", h("span", { class: "badge done", text: "完成" })]);
        return h("li", {}, [h("a", { href: `topics/${ch.id}/${t.id}.html`, text: name }), badges]);
      }));
      const card = h("article", { class: "chapter", style: `--accent: var(--ch-${ch.id}, var(--brand))` }, [
        h("div", { class: "no", text: "CH " + String(i + 1).padStart(2, "0") }),
        h("h3", { text: ch.en }),
        h("div", { class: "zh", text: ch.zh + "　·　" + ch.desc }),
        list,
      ]);
      box.appendChild(card);
    });
  }

  // ---------- 主題頁 ----------
  function renderToc() {
    const toc = $(".toc");
    if (!toc) return;
    const secs = Array.from(document.querySelectorAll(".topic section[id]"));
    const ol = h("ol", {}, secs.map((s) => h("li", {}, [h("a", { href: "#" + s.id, text: s.querySelector("h2").textContent })])));
    toc.append(h("strong", { text: "本頁目錄" }), ol);
    const links = Array.from(ol.querySelectorAll("a"));
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        links.forEach((a) => a.classList.toggle("is-current", a.getAttribute("href") === "#" + e.target.id));
      });
    }, { rootMargin: "-30% 0px -60% 0px" });
    secs.forEach((s) => io.observe(s));
  }

  function renderQuizToggle() {
    const btn = $("#toggle-quiz");
    if (!btn) return;
    btn.addEventListener("click", () => {
      const items = document.querySelectorAll("details.quiz");
      const open = !Array.from(items).every((d) => d.open);
      items.forEach((d) => (d.open = open));
      btn.textContent = open ? "收合全部答案" : "展開全部答案";
    });
  }

  function renderPager(data) {
    const pager = $(".pager");
    const cur = document.body.dataset.topic;
    if (!pager || !cur) return;
    const flat = data.chapters.flatMap((c) => c.topics.filter((t) => t.status === "done").map((t) => ({ ...t, ch: c.id })));
    const i = flat.findIndex((t) => `${t.ch}/${t.id}` === cur);
    const link = (t, cls, hint) => h("a", { class: cls, href: `${ROOT}topics/${t.ch}/${t.id}.html` }, [h("small", { text: hint }), `${t.en}（${t.zh}）`]);
    if (i > 0) pager.appendChild(link(flat[i - 1], "prev", "← 上一個主題"));
    if (i >= 0 && i < flat.length - 1) pager.appendChild(link(flat[i + 1], "next", "下一個主題 →"));
  }

  document.addEventListener("DOMContentLoaded", async () => {
    renderToc();
    renderQuizToggle();
    let data;
    try { data = await loadSyllabus(); } catch (e) {
      const box = $("#chapters");
      if (box) box.textContent = "讀不到 data/syllabus.json。本機預覽請用 python -m http.server 開啟。";
      return;
    }
    if ($("#chapters")) renderHome(data);
    renderPager(data);
  });
})();
