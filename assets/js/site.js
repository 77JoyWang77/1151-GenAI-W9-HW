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
  const ICONS = new URL("../icons.svg", document.currentScript.src).href;
  // 全站 icon：assets/icons.svg 裡的 <symbol id="i-名稱">
  function icon(name, cls) {
    const NS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("class", "icon" + (cls ? " " + cls : ""));
    svg.setAttribute("aria-hidden", "true");
    const use = document.createElementNS(NS, "use");
    use.setAttribute("href", `${ICONS}#i-${name}`);
    svg.appendChild(use);
    return svg;
  }
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
        h("div", { class: "subj-icon" }, [icon(s.icon)]),
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
    const pg = $("#progress");
    if (pg) pg.replaceChildren(progress(doneCount(data), allTopics(data).length));

    data.chapters.forEach((ch) => {
      const list = h("ul", {}, ch.topics.map((t) => {
        const name = `${t.en}（${t.zh}）`;
        // 考研高頻的主題在名稱前加火焰 icon；沒有高頻的留同寬空位，讓名稱對齊
        const mark = t.priority === "high"
          ? h("span", { class: "hot-mark", title: "考研高頻" }, [icon("flame")])
          : h("span", { class: "hot-mark is-empty" });
        if (t.status !== "done") return h("li", {}, [h("span", { class: "topic-name planned" }, [mark, name]), h("span", { class: "badge", text: "籌備中" })]);
        return h("li", {}, [h("a", { class: "topic-name", href: `${ch.id}/${t.id}.html` }, [mark, name])]);
      }));
      box.appendChild(h("article", { class: "chapter", style: `--accent: ${chColor(ch.no)}` }, [
        h("div", { class: "no", text: "CHAPTER " + ch.no }),
        h("h3", { text: ch.en }),
        h("div", { class: "zh", text: ch.zh + " · " + ch.desc }),
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
      const items = document.querySelectorAll("details.quiz, details.qans");
      const open = !Array.from(items).every((d) => d.open);
      items.forEach((d) => (d.open = open));
      btn.textContent = open ? "收合全部答案" : "展開全部答案";
    });
  }

  // 程式碼區塊：複製按鈕 + 分頁切換
  function renderCodeBlocks() {
    document.querySelectorAll(".code-block").forEach((block) => {
      const head = block.querySelector(".code-head");
      const pre = block.querySelector("pre");
      if (!head || !pre) return;
      const btn = h("button", { type: "button", class: "code-copy" });
      const label = (ico, text) => btn.replaceChildren(icon(ico), document.createTextNode(text));
      label("copy", "複製");
      btn.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        try { await navigator.clipboard.writeText(pre.innerText); label("check", "已複製"); }
        catch (e) { label("alert", "請手動選取"); }
        setTimeout(() => label("copy", "複製"), 1500);
      });
      head.appendChild(btn);
    });
    // 程式碼收合：summary 本身就是程式碼框的標題列，點它往下展開、再點一次收起；
    // 單一程式碼時把複製按鈕移到這一列，並隱藏重複的 .code-head
    document.querySelectorAll("details.code-fold").forEach((fold) => {
      const sm = fold.querySelector(":scope > summary");
      const raw = sm.textContent.trim();
      const cut = raw.indexOf("：");
      const title = cut >= 0 ? raw.slice(cut + 1) : raw;
      sm.replaceChildren(icon("chevron-right", "fold-arrow"), h("span", { class: "fold-label", text: title }));
      sm.title = "點一下展開／收起程式碼";
      const blocks = fold.querySelectorAll(".code-block");
      if (blocks.length === 1 && !fold.querySelector(".code-tabs")) {
        fold.classList.add("is-single");
        const copy = blocks[0].querySelector(".code-copy");
        if (copy) sm.appendChild(copy);   // 複製按鈕自己會 preventDefault，不會觸發收合
      }
    });
    document.querySelectorAll(".code-tabs").forEach((tabs) => {
      const blocks = Array.from(tabs.querySelectorAll(":scope > .code-block[data-tab]"));
      if (!blocks.length) return;
      const bar = h("div", { class: "tab-bar", role: "tablist" });
      const select = (k) => blocks.forEach((b, i) => {
        b.hidden = i !== k;
        bar.children[i].setAttribute("aria-selected", String(i === k));
      });
      blocks.forEach((b, i) => {
        const t = h("button", { type: "button", role: "tab", text: b.dataset.tab });
        t.addEventListener("click", () => select(i));
        bar.appendChild(t);
      });
      tabs.insertBefore(bar, blocks[0]);
      select(0);
    });
  }

  // ---------- 題庫：主題頁的練習題、科目的題庫頁 ----------
  const LEVELS = ["basic", "advanced", "exam"];
  function srcText(src) {
    if (!src || src.kind !== "exam") return "原創";
    return [src.school, src.year ? src.year + " 學年度" : "", src.dept, src.no ? "第 " + src.no + " 題" : ""].filter(Boolean).join(" ");
  }
  function qCard(q, levels, num, topicNames) {
    const el = h("article", { class: "qcard", id: "q-" + q.id });
    const meta = h("div", { class: "qmeta" }, [
      h("span", { class: "qnum", text: num }),
      h("span", { class: "qlevel lv-" + q.level, text: levels[q.level] || q.level }),
      h("span", { class: "qkind", text: q.type }),
      h("span", { class: "qsrc" + (q.source && q.source.kind === "exam" ? " is-exam" : ""), text: srcText(q.source) }),
    ]);
    if (topicNames) q.topics.forEach((t) => topicNames[t] && meta.appendChild(h("a", { class: "qtopic", href: topicNames[t].href, text: topicNames[t].name })));
    if (q.source && q.source.url) meta.appendChild(h("a", { class: "qtopic", href: q.source.url, text: "原題連結", target: "_blank", rel: "noopener" }));
    const text = h("div", { class: "qtext" }); text.innerHTML = q.question;
    el.append(meta, text);
    if (q.choices) {
      const ul = h("ul", { class: "qchoices" });
      q.choices.forEach((c) => { const li = h("li"); li.innerHTML = c; ul.appendChild(li); });
      el.appendChild(ul);
    }
    const ans = h("details", { class: "qans" });
    const body = h("div", { class: "qa" });
    body.innerHTML = `<p class="qa-answer"><b>答案：</b>${q.answer}</p>${q.explanation}`;
    ans.append(h("summary", { text: "看答案與詳解" }), body);
    el.appendChild(ans);
    return el;
  }
  async function loadQuestions(subjectId) {
    try { return await getJSON(`data/questions/${subjectId}.json`); } catch (e) { return { levels: {}, questions: [] }; }
  }
  function focusHash() {
    const id = decodeURIComponent(location.hash.slice(1));
    const el = id && document.getElementById(id);
    if (!el) return;
    el.classList.add("is-target");
    el.scrollIntoView({ block: "center" });
  }

  async function renderTopicQuestions(box, subjectId, topicId) {
    const data = await loadQuestions(subjectId);
    const mine = data.questions.filter((q) => q.topics.includes(topicId));
    const orig = mine.filter((q) => !q.source || q.source.kind !== "exam");
    const exam = mine.filter((q) => q.source && q.source.kind === "exam");
    let n = 0;
    LEVELS.forEach((lv) => {
      const qs = orig.filter((q) => q.level === lv);
      if (!qs.length) return;
      box.appendChild(h("h3", { class: "qgroup", text: (data.levels[lv] || lv) + `（${qs.length} 題）` }));
      qs.forEach((q) => box.appendChild(qCard(q, data.levels, "Q" + ++n)));
    });
    box.appendChild(h("h3", { class: "qgroup", text: `考古題（${exam.length} 題）` }));
    if (!exam.length) box.appendChild(h("p", { class: "qempty", text: "這個主題還沒有收錄考古題，之後匯入後會自動出現在這裡。" }));
    exam.forEach((q) => box.appendChild(qCard(q, data.levels, "Q" + ++n)));
    // 頁面上「例題」連結改成顯示題號；找不到題目的連結標成錯誤，方便發現
    document.querySelectorAll('a.q-link[href^="#q-"]').forEach((a) => {
      const card = document.getElementById(a.getAttribute("href").slice(1));
      if (card) a.textContent = card.querySelector(".qnum").textContent;
      else a.replaceChildren(icon("alert"), document.createTextNode(" 題目不存在"));
    });
    focusHash();
  }

  async function renderQuestionBank(box, subjectId) {
    const [data, subj] = await Promise.all([loadQuestions(subjectId), getJSON(`data/${subjectId}.json`)]);
    const topicNames = {};
    subj.chapters.forEach((c) => c.topics.forEach((t) => (topicNames[t.id] = { name: `${t.en}（${t.zh}）`, href: t.status === "done" ? `${c.id}/${t.id}.html` : "#" , order: Object.keys(topicNames).length })));
    const used = [...new Set(data.questions.flatMap((q) => q.topics))].sort((a, b) => (topicNames[a]?.order ?? 0) - (topicNames[b]?.order ?? 0));
    const schools = [...new Set(data.questions.filter((q) => q.source && q.source.kind === "exam").map((q) => q.source.school))];
    const types = [...new Set(data.questions.map((q) => q.type))];
    const sel = (label, opts) => {
      const s = h("select", { class: "vinput", "aria-label": label }, [h("option", { value: "", text: label + "：全部" }), ...opts.map(([v, t]) => h("option", { value: v, text: t }))]);
      return s;
    };
    const fTopic = sel("主題", used.map((t) => [t, topicNames[t] ? topicNames[t].name : t]));
    const fLevel = sel("難度", LEVELS.map((l) => [l, data.levels[l] || l]));
    const fType = sel("題型", types.map((t) => [t, t]));
    const fSrc = sel("來源", [["original", "原創"], ["exam", "考古題"], ...schools.map((s) => ["school:" + s, s])]);
    const fText = h("input", { class: "vinput", type: "search", placeholder: "搜尋題目、答案或詳解…" });
    const count = h("span", { class: "qcount" });
    const list = h("div", { class: "qlist" });
    box.append(h("div", { class: "qfilters" }, [fTopic, fLevel, fType, fSrc, fText, count]), list);
    function draw() {
      list.innerHTML = "";
      const kw = fText.value.trim().toLowerCase();
      const qs = data.questions.filter((q) => {
        if (fTopic.value && !q.topics.includes(fTopic.value)) return false;
        if (fLevel.value && q.level !== fLevel.value) return false;
        if (fType.value && q.type !== fType.value) return false;
        const isExam = q.source && q.source.kind === "exam";
        if (fSrc.value === "original" && isExam) return false;
        if (fSrc.value === "exam" && !isExam) return false;
        if (fSrc.value.startsWith("school:") && !(isExam && q.source.school === fSrc.value.slice(7))) return false;
        if (kw && !(q.question + q.answer + q.explanation).toLowerCase().includes(kw)) return false;
        return true;
      });
      count.textContent = `共 ${qs.length} / ${data.questions.length} 題`;
      qs.forEach((q, i) => list.appendChild(qCard(q, data.levels, "Q" + (i + 1), topicNames)));
      if (!qs.length) list.appendChild(h("p", { class: "qempty", text: "沒有符合條件的題目。" }));
    }
    [fTopic, fLevel, fType, fSrc].forEach((f) => f.addEventListener("change", draw));
    fText.addEventListener("input", draw);
    draw();
  }

  async function renderPager(pager, topicKey) {
    const [subjectId, chId, tId] = topicKey.split("/");
    const data = await getJSON(`data/${subjectId}.json`);
    const flat = data.chapters.flatMap((c) => c.topics.filter((t) => t.status === "done").map((t) => ({ ...t, ch: c.id })));
    const i = flat.findIndex((t) => t.ch === chId && t.id === tId);
    const link = (t, cls, hint) => h("a", { class: cls, href: `${ROOT}subjects/${subjectId}/${t.ch}/${t.id}.html` }, [h("small", {}, hint), `${t.en}（${t.zh}）`]);
    if (i > 0) pager.appendChild(link(flat[i - 1], "prev", [icon("prev"), " 上一個主題"]));
    if (i >= 0 && i < flat.length - 1) pager.appendChild(link(flat[i + 1], "next", ["下一個主題 ", icon("next")]));
  }

  // 難度：<span class="chip" data-difficulty="2">難度</span> → 3 顆星，亮 2 顆
  function renderDifficulty() {
    document.querySelectorAll("[data-difficulty]").forEach((el) => {
      const n = +el.dataset.difficulty;
      const stars = h("span", { class: "stars", "aria-label": `難度 ${n} / 3` });
      for (let i = 1; i <= 3; i++) stars.appendChild(i <= n ? icon("star-fill", "on") : icon("star", "off"));
      el.appendChild(stars);
    });
  }

  // 科目頁的題庫入口：顯示題數
  async function renderBankEntry(el, subjectId) {
    const data = await loadQuestions(subjectId);
    const exam = data.questions.filter((q) => q.source && q.source.kind === "exam").length;
    el.textContent = `${data.questions.length - exam} 題練習題 · ${exam} 題考古題 · 可依主題、難度、學校篩選`;
  }

  document.addEventListener("DOMContentLoaded", async () => {
    renderToc();
    renderQuizToggle();
    renderCodeBlocks();
    renderDifficulty();
    try {
      const subjects = $("#subjects");
      if (subjects) await renderSubjects(subjects);
      const chapters = $("#chapters");
      if (chapters) await renderSubject(chapters, document.body.dataset.subject);
      const entry = $("[data-qcount]");
      if (entry) await renderBankEntry(entry, document.body.dataset.subject);
      const qbox = $(".qbank[data-questions]");
      if (qbox) await renderTopicQuestions(qbox, document.body.dataset.subject, qbox.dataset.questions);
      const bank = $("#qbank-all");
      if (bank) await renderQuestionBank(bank, document.body.dataset.subject);
      const pager = $(".pager");
      if (pager && document.body.dataset.topic) await renderPager(pager, document.body.dataset.topic);
    } catch (e) {
      const box = $("#subjects") || $("#chapters");
      if (box) box.textContent = "讀不到 data/ 裡的 JSON。本機預覽請用 python -m http.server 開啟。";
    }
  });
})();
