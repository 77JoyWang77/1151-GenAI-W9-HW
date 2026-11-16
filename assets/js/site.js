/* =====================================================================
   site.js — 全站首頁（科目列表）、科目首頁（章節地圖）、
             主題頁（目錄 TOC / 上下篇 / 測驗展開）
   資料：data/subjects.json、data/<subject-id>.json（格式見 CLAUDE.md 第 7 節）
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

  const ROOT = document.body.dataset.root || "";
  const getJSON = (path) => fetch(ROOT + path, { cache: "no-cache" }).then((r) => r.json());
  const chColor = (no) => `var(--ch-${((no - 1) % 12) + 1})`;
  const allTopics = (subj) => subj.chapters.flatMap((c) => c.topics);
  const doneCount = (subj) => allTopics(subj).filter((t) => t.status === "done").length;

  function progress(done, total) {
    const pct = total ? Math.round((done / total) * 100) : 0;
    return h("div", { class: "progress" }, [
      h("div", { class: "bar" }, [h("i", { style: `width:${pct}%` })]),
      h("div", { class: "txt", text: `已完成 ${done} / ${total} 個主題（${pct}%）` }),
    ]);
  }

  // ---------- 全站首頁：科目列表 ----------
  async function renderSubjects(box) {
    const data = await getJSON("data/subjects.json");
    for (const s of data.subjects) {
      const active = s.status === "active";
      let prog = h("span", { class: "badge", text: "籌備中" });
      if (active) {
        try { const subj = await getJSON(`data/${s.id}.json`); prog = progress(doneCount(subj), allTopics(subj).length); } catch (e) { /* 忽略 */ }
      }
      const inner = [
        h("div", { class: "subj-icon", text: s.icon }),
        h("h3", { text: s.en }),
        h("div", { class: "zh", text: s.zh }),
        h("p", { text: s.desc }),
        prog,
      ];
      const attrs = { class: "subject" + (active ? "" : " is-planned"), style: `--accent: ${chColor(s.color)}` };
      box.appendChild(active ? h("a", Object.assign({ href: `subjects/${s.id}/index.html` }, attrs), inner) : h("article", attrs, inner));
    }
  }

  // ---------- 科目首頁：章節地圖 ----------
  async function renderSubject(box, subjectId) {
    const data = await getJSON(`data/${subjectId}.json`);
    const tb = $("#textbook");
    if (tb && data.textbook) tb.textContent = `章節依照課本：${data.textbook.title}（${data.textbook.author}，${data.textbook.edition}）`;
    const pg = $("#progress");
    if (pg) pg.replaceChildren(progress(doneCount(data), allTopics(data).length));

    data.chapters.forEach((ch) => {
      const list = h("ul", {}, ch.topics.map((t) => {
        const name = `${t.en}（${t.zh}）`;
        const sec = t.book ? h("span", { class: "sec", text: "§" + t.book }) : null;
        if (t.status !== "done") return h("li", {}, [h("span", { class: "planned" }, [sec, name]), h("span", { class: "badge", text: "籌備中" })]);
        const badges = h("span", {}, [t.viz ? h("span", { class: "badge viz", text: "▶ 互動" }) : null, " ", h("span", { class: "badge done", text: "完成" })]);
        return h("li", {}, [h("a", { href: `${ch.id}/${t.id}.html` }, [sec, name]), badges]);
      }));
      box.appendChild(h("article", { class: "chapter", style: `--accent: ${chColor(ch.no)}` }, [
        h("div", { class: "no", text: "CHAPTER " + ch.no }),
        h("h3", { text: ch.en }),
        h("div", { class: "zh", text: ch.zh + "　·　" + ch.desc }),
        list,
      ]));
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

  async function renderPager(pager, topicKey) {
    const [subjectId, chId, tId] = topicKey.split("/");
    const data = await getJSON(`data/${subjectId}.json`);
    const flat = data.chapters.flatMap((c) => c.topics.filter((t) => t.status === "done").map((t) => ({ ...t, ch: c.id })));
    const i = flat.findIndex((t) => t.ch === chId && t.id === tId);
    const link = (t, cls, hint) => h("a", { class: cls, href: `${ROOT}subjects/${subjectId}/${t.ch}/${t.id}.html` }, [h("small", { text: hint }), `${t.en}（${t.zh}）`]);
    if (i > 0) pager.appendChild(link(flat[i - 1], "prev", "← 上一個主題"));
    if (i >= 0 && i < flat.length - 1) pager.appendChild(link(flat[i + 1], "next", "下一個主題 →"));
  }

  document.addEventListener("DOMContentLoaded", async () => {
    renderToc();
    renderQuizToggle();
    try {
      const subjects = $("#subjects");
      if (subjects) await renderSubjects(subjects);
      const chapters = $("#chapters");
      if (chapters) await renderSubject(chapters, document.body.dataset.subject);
      const pager = $(".pager");
      if (pager && document.body.dataset.topic) await renderPager(pager, document.body.dataset.topic);
    } catch (e) {
      const box = $("#subjects") || $("#chapters");
      if (box) box.textContent = "讀不到 data/ 裡的 JSON。本機預覽請用 python -m http.server 開啟。";
    }
  });
})();
