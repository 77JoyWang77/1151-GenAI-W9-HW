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
  // 標題類名稱：「English 中文」不加括號；中文整段一起換行（CLAUDE.md 第 3 節）
  const nameOf = (t) => h("span", { class: "en-zh" }, [t.en + " ", h("span", { class: "zh-name", text: t.zh })]);
  const getJSON = (path) => fetch(ROOT + path, { cache: "no-cache" }).then((r) => r.json());
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
      const attrs = { class: "subject" + (active ? "" : " is-planned") };   // 首頁卡片統一用品牌色，不依科目上色
      box.appendChild(active ? h("a", Object.assign({ href: `subjects/${s.id}/index.html` }, attrs), inner) : h("article", attrs, inner));
    }
  }

  // ---------- 全站首頁：概況（科目名稱、數字）----------
  async function renderHome() {
    const reg = await getJSON("data/subjects.json");
    const names = $("#home-subjects");
    if (names) names.textContent = reg.subjects.map((s) => s.zh).join(" · ");
    let done = 0, total = 0, practice = 0, exam = 0;
    for (const s of reg.subjects.filter((x) => x.status === "active")) {
      const subj = await getJSON(`data/${s.id}.json`);
      total += allTopics(subj).length;
      done += doneCount(subj);
      try {
        const q = await loadQuestions(s.id);
        const e = q.questions.filter((x) => x.source && x.source.kind === "exam").length;
        exam += e; practice += q.questions.length - e;
      } catch (err) { /* 還沒有題庫 */ }
    }
    const ex = $("#home-exams");
    if (ex) {
      try {
        const log = await getJSON("data/exam-log.json");
        const years = log.papers.map((p) => p.year);
        ex.textContent = `${log.papers.length} 份考卷 · ${exam} 題 · ${[...new Set(log.papers.map((p) => SCHOOL_SHORT[p.school] || p.school))].join("、")} ${Math.min(...years)}–${Math.max(...years)} 學年度`;
      } catch (err) { ex.textContent = `${exam} 題`; }
    }
    const stats = $("#home-stats");
    if (stats) {
      const tile = (ic, num, unit, label) => h("div", { class: "stat" }, [
        h("span", { class: "stat-icon" }, [icon(ic)]),
        h("div", {}, [h("b", { text: num }), h("small", { text: unit }), h("div", { class: "stat-label", text: label })]),
      ]);
      stats.append(
        tile("check-circle", String(done), ` / ${total}`, "已完成主題"),
        tile("book", String(practice), " 題", "練習題"),
        tile("bookmark", String(exam), " 題", "考古題"),
      );
    }
  }

  // ---------- 科目首頁：章節地圖 ----------
  async function renderSubject(box, subjectId) {
    const data = await getJSON(`data/${subjectId}.json`);
    const pg = $("#progress");
    if (pg) pg.replaceChildren(progress(doneCount(data), allTopics(data).length));

    data.chapters.forEach((ch) => {
      const list = h("ul", {}, ch.topics.map((t) => {
        const name = nameOf(t);
        // 考研高頻的主題在名稱前加火焰 icon；沒有高頻的留同寬空位，讓名稱對齊
        const mark = t.priority === "high"
          ? h("span", { class: "hot-mark", title: "考研高頻" }, [icon("flame")])
          : h("span", { class: "hot-mark is-empty" });
        if (t.status !== "done") return h("li", {}, [h("span", { class: "topic-name planned" }, [mark, name]), h("span", { class: "badge", text: "籌備中" })]);
        return h("li", {}, [h("a", { class: "topic-name", href: `${ch.id}/${t.id}.html` }, [mark, name])]);
      }));
      box.appendChild(h("article", { class: "chapter" }, [   // 全站統一用品牌色，不依章節上色
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
  const paperHref = (src, qid) => `${ROOT}exams/paper.html?id=${encodeURIComponent(src.paper)}#q-${qid}`;
  function qCard(q, levels, num, topicNames, opts = {}) {
    const el = h("article", { class: "qcard", id: "q-" + q.id });
    const meta = h("div", { class: "qmeta" }, [
      h("span", { class: "qnum", text: num }),
      h("span", { class: "qlevel lv-" + q.level, text: levels[q.level] || q.level }),
      h("span", { class: "qkind", text: q.type }),
    ]);
    const isExam = q.source && q.source.kind === "exam";
    if (!opts.noSource) meta.appendChild(isExam && q.source.paper
      ? h("a", { class: "qsrc is-exam", href: paperHref(q.source, q.id), title: "看整份考卷", text: srcText(q.source) })
      : h("span", { class: "qsrc" + (isExam ? " is-exam" : ""), text: srcText(q.source) }));
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
    qFigures(el);
    return el;
  }
  // 題目裡的圖：原卷裁切圖 <img class="q-img" data-src="assets/exam-img/…">（路徑相對於網站根目錄），
  // 重畫的圖 <div class="q-fig" data-spec="{…Frame…}">（用 viz-core 的 Player 靜態畫出）
  function qFigures(el) {
    el.querySelectorAll("img.q-img[data-src]").forEach((img) => {
      img.src = ROOT + img.dataset.src;
      img.loading = "lazy";
    });
    el.querySelectorAll(".q-fig[data-spec]").forEach((div) => {
      if (!window.DSViz) return;
      try {
        const f = JSON.parse(div.dataset.spec);
        div.style.setProperty("--fig-w", (f.width || 640) + "px");
        new window.DSViz.Player(div, { static: true, width: f.width || 640, height: f.height || 240, title: "" }).load([f], { autoplay: false });
      } catch (err) {
        div.textContent = "圖無法顯示";
      }
    });
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
    if (!exam.length) box.appendChild(h("p", { class: "qempty", text: "尚未收錄考古題。" }));
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
    subj.chapters.forEach((c) => c.topics.forEach((t) => (topicNames[t.id] = { name: `${t.en} ${t.zh}`, href: t.status === "done" ? `${c.id}/${t.id}.html` : "#" , order: Object.keys(topicNames).length })));
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
    const link = (t, cls, hint) => h("a", { class: cls, href: `${ROOT}subjects/${subjectId}/${t.ch}/${t.id}.html` }, [h("small", {}, hint), nameOf(t)]);
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
    el.textContent = `${data.questions.length - exam} 題練習題 · ${exam} 題考古題`;
  }


  // ---------- 考古題：總覽（學校 × 學年度 × 卷別）與單份考卷 ----------
  const SCHOOL_SHORT = { "國立臺灣大學": "臺大", "國立陽明交通大學": "陽明交大", "國立中央大學": "中央", "國立成功大學": "成大" };
  const SCHOOL_ORDER = Object.keys(SCHOOL_SHORT);
  const PAPER_KIND = { software: ["軟體卷", "資料結構與演算法"], hardware: ["硬體卷", "計算機組織與作業系統"], math: ["數學卷", "離散數學與線性代數"] };
  const KIND_ORDER = Object.keys(PAPER_KIND);
  // 卷上的題號自然排序：2 < 10、1-(a) < 1-(b)、I-3 < II-1
  const natCmp = (a, b) => String(a).localeCompare(String(b), "en", { numeric: true });
  const schoolRank = (s) => { const i = SCHOOL_ORDER.indexOf(s); return i < 0 ? 99 : i; };

  // 所有科目的考古題，附上科目 id
  async function allExamQuestions() {
    const reg = await getJSON("data/subjects.json");
    const active = reg.subjects.filter((s) => s.status === "active");
    const lists = await Promise.all(active.map(async (s) => {
      const [d, subj] = await Promise.all([loadQuestions(s.id), getJSON(`data/${s.id}.json`)]);
      return { s, d, subj };
    }));
    const qs = [], topics = {}, levels = {};
    lists.forEach(({ s, d, subj }) => {
      Object.assign(levels, d.levels);
      subj.chapters.forEach((c) => c.topics.forEach((t) => (topics[s.id + "/" + t.id] = {
        name: `${t.en} ${t.zh}`, done: t.status === "done", href: `${ROOT}subjects/${s.id}/${c.id}/${t.id}.html`, subject: s.zh,
      })));
      d.questions.forEach((q) => q.source && q.source.kind === "exam" && qs.push({ q, sid: s.id }));
    });
    return { qs, topics, levels, subjects: reg.subjects };
  }

  async function renderExamIndex(box) {
    const [log, all] = await Promise.all([getJSON("data/exam-log.json"), allExamQuestions()]);
    const count = {};
    all.qs.forEach(({ q }) => (count[q.source.paper] = (count[q.source.paper] || 0) + 1));
    const sum = $("#exam-summary");
    if (sum) sum.textContent = `${log.papers.length} 份考卷 · ${all.qs.length} 題`;
    const schools = [...new Set(log.papers.map((p) => p.school))].sort((a, b) => schoolRank(a) - schoolRank(b));
    const sel = (label, opts) => h("select", { class: "vinput", "aria-label": label }, [h("option", { value: "", text: label + "：全部" }), ...opts.map(([v, t]) => h("option", { value: v, text: t }))]);
    const fSchool = sel("學校", schools.map((s) => [s, s]));
    const fKind = sel("卷別", KIND_ORDER.map((k) => [k, `${PAPER_KIND[k][0]}（${PAPER_KIND[k][1]}）`]));
    const out = h("div");
    box.append(h("div", { class: "qfilters" }, [fSchool, fKind]), out);
    function draw() {
      out.innerHTML = "";
      const kinds = KIND_ORDER.filter((k) => !fKind.value || k === fKind.value);
      schools.filter((s) => !fSchool.value || s === fSchool.value).forEach((school) => {
        const mine = log.papers.filter((p) => p.school === school);
        const years = [...new Set(mine.map((p) => p.year))].sort((a, b) => b - a);
        const head = h("tr", {}, [h("th", { text: "學年度" }), ...kinds.map((k) => h("th", {}, [PAPER_KIND[k][0], h("small", { text: PAPER_KIND[k][1] })]))]);
        const rows = years.map((y) => h("tr", {}, [h("th", { text: String(y) }), ...kinds.map((k) => {
          const p = mine.find((x) => x.year === y && x.paper === k);
          if (!p) return h("td", { class: "is-empty", text: "—" });
          const n = count[p.id] || 0, sk = (p.skipped || []).length;
          return h("td", {}, [h("a", { class: "paper-link", href: `paper.html?id=${encodeURIComponent(p.id)}` }, [
            h("b", { text: `${n} 題` }), sk ? h("small", { text: `未收 ${sk}` }) : "",
          ])]);
        })]));
        out.append(h("section", { class: "exam-school" }, [
          h("h2", { text: school }),
          h("div", { class: "table-scroll" }, [h("table", { class: "exam-grid" }, [h("thead", {}, [head]), h("tbody", {}, rows)])]),
        ]));
      });
    }
    [fSchool, fKind].forEach((f) => f.addEventListener("change", draw));
    draw();
  }

  async function renderPaper(box) {
    const id = new URLSearchParams(location.search).get("id");
    const [log, all] = await Promise.all([getJSON("data/exam-log.json"), allExamQuestions()]);
    const p = log.papers.find((x) => x.id === id);
    if (!p) {
      box.append(h("p", { class: "qempty" }, ["找不到這份考卷。", h("a", { href: "index.html", text: "回考古題總覽" })]));
      return;
    }
    const school = SCHOOL_SHORT[p.school] || p.school;
    const kind = PAPER_KIND[p.paper] || [p.paper, ""];
    document.title = `${school} ${p.year} ${p.title} · 考古題 | 資工考研互動學習站`;
    const crumb = $("#paper-crumb");
    if (crumb) crumb.textContent = `${school} ${p.year} ${kind[0]}`;

    const mine = all.qs.filter(({ q }) => q.source.paper === id);
    const items = [
      ...mine.map(({ q, sid }) => ({ no: q.source.no, q, sid })),
      ...(p.skipped || []).map((s) => ({ no: s.no, skip: s })),
    ].sort((a, b) => natCmp(a.no, b.no));

    // 前後年度（同一間學校、同一種卷）
    const same = log.papers.filter((x) => x.school === p.school && x.paper === p.paper).sort((a, b) => a.year - b.year);
    const i = same.findIndex((x) => x.id === id);
    const pager = h("nav", { class: "pager" });
    const plink = (x, cls, hint) => h("a", { class: cls, href: `paper.html?id=${encodeURIComponent(x.id)}` }, [h("small", {}, hint), `${school} ${x.year} ${kind[0]}`]);
    if (i > 0) pager.appendChild(plink(same[i - 1], "prev", [icon("prev"), " 前一年"]));
    if (i < same.length - 1) pager.appendChild(plink(same[i + 1], "next", ["後一年 ", icon("next")]));

    // 這份考卷考了哪些主題（次數多的在前）
    const tc = {};
    mine.forEach(({ q, sid }) => q.topics.forEach((t) => (tc[sid + "/" + t] = (tc[sid + "/" + t] || 0) + 1)));
    const chips = Object.entries(tc).sort((a, b) => b[1] - a[1]).map(([k, n]) => {
      const t = all.topics[k] || { name: k.split("/")[1], done: false };
      const label = [t.name + " ", h("b", { text: String(n) })];
      return t.done ? h("a", { class: "chip topic-chip", href: t.href }, label) : h("span", { class: "chip topic-chip is-planned", title: "主題頁籌備中" }, label);
    });

    // 主題太多時只先顯示最常考的 8 個，其他收起來
    function topicBox(chips) {
      const SHOW = 8;
      const box2 = h("div", { class: "paper-topics" }, [h("span", { class: "paper-topics-label", text: `考了哪些主題（${chips.length}）` }), ...chips]);
      if (chips.length > SHOW) {
        chips.slice(SHOW).forEach((c) => (c.hidden = true));
        const more = h("button", { class: "linkbtn", type: "button", text: `顯示全部 ${chips.length} 個` });
        more.addEventListener("click", () => { chips.forEach((c) => (c.hidden = false)); more.remove(); });
        box2.appendChild(more);
      }
      return box2;
    }

    // 自評：每題記「答對／答錯」，存在這台電腦的瀏覽器
    const KEY = "exam-grade:" + id;
    let grade = {};
    try { grade = JSON.parse(localStorage.getItem(KEY) || "{}"); } catch (e) { grade = {}; }
    const save = () => { try { localStorage.setItem(KEY, JSON.stringify(grade)); } catch (e) { /* 無痕模式等情況存不了，只影響紀錄 */ } };
    const score = h("span", { class: "grade-score" });
    const updateScore = () => {
      const v = Object.values(grade), ok = v.filter((x) => x === 1).length;
      score.textContent = v.length ? `自評：答對 ${ok} / 已作答 ${v.length} / 共 ${mine.length} 題` : `自評：尚未作答（共 ${mine.length} 題）`;
    };

    const toggle = h("button", { class: "linkbtn", type: "button", text: "展開全部答案" });
    toggle.addEventListener("click", () => {
      const ds = box.querySelectorAll("details.qans");
      const open = !Array.from(ds).every((d) => d.open);
      ds.forEach((d) => (d.open = open));
      toggle.textContent = open ? "收合全部答案" : "展開全部答案";
    });
    const reset = h("button", { class: "linkbtn", type: "button", text: "清除自評" });
    reset.addEventListener("click", () => {
      grade = {}; save(); updateScore();
      box.querySelectorAll(".qgrade button").forEach((b) => b.setAttribute("aria-pressed", "false"));
    });

    const skipped = (p.skipped || []).length;
    box.append(
      h("section", { class: "page-head paper-head" }, [
        h("h1", {}, [`${p.school} ${p.year} 學年度`, h("small", { text: p.title })]),
        h("div", { class: "meta" }, [
          h("span", { class: "chip accent", text: `${kind[0]}・${kind[1]}` }),
          h("span", { class: "chip", text: `收錄 ${mine.length} 題` }),
          skipped ? h("span", { class: "chip", text: `未收 ${skipped} 題` }) : "",
          h("a", { class: "chip", href: p.url, target: "_blank", rel: "noopener", text: "原卷 PDF" }),
        ]),
        chips.length ? topicBox(chips) : "",
      ]),
      h("div", { class: "practice-tools paper-tools" }, [score, toggle, reset]),
    );
    updateScore();

    const list = h("div", { class: "qlist" });
    items.forEach((it) => {
      if (it.skip) {
        list.appendChild(h("article", { class: "qcard is-skipped", id: "skip-" + it.no }, [
          h("div", { class: "qmeta" }, [h("span", { class: "qnum", text: `第 ${it.no} 題` }), h("span", { text: "未收錄" })]),
          h("p", { class: "qempty", text: it.skip.reason }),
        ]));
        return;
      }
      const card = qCard(it.q, all.levels, `第 ${it.no} 題`, null, { noSource: true });
      // 主題標籤：已完成的主題可以點過去
      const meta = card.querySelector(".qmeta");
      it.q.topics.forEach((t) => {
        const tp = all.topics[it.sid + "/" + t];
        if (!tp) return;
        meta.appendChild(tp.done ? h("a", { class: "qtopic", href: tp.href, text: tp.name }) : h("span", { class: "qtopic", title: "主題頁籌備中", text: tp.name }));
      });
      const g = h("div", { class: "qgrade" }, [h("span", { text: "自評" })]);
      [[1, "答對", "check-circle"], [0, "答錯", "x-circle"]].forEach(([v, text, ic]) => {
        const b = h("button", { type: "button", class: "linkbtn grade-" + (v ? "ok" : "ng"), "aria-pressed": String(grade[it.q.id] === v) }, [icon(ic), " " + text]);
        b.addEventListener("click", () => {
          if (grade[it.q.id] === v) delete grade[it.q.id]; else grade[it.q.id] = v;
          save(); updateScore();
          g.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b && grade[it.q.id] === v)));
        });
        g.appendChild(b);
      });
      card.appendChild(g);
      list.appendChild(card);
    });
    box.append(list, pager);
    focusHash();
  }

  document.addEventListener("DOMContentLoaded", async () => {
    renderToc();
    renderQuizToggle();
    renderCodeBlocks();
    renderDifficulty();
    // 每個區塊各自載入：一個失敗不會拖累其他區塊
    const fail = (box) => box && (box.textContent = "讀不到 data/ 裡的 JSON。本機預覽請用 python -m http.server 開啟；線上請重新整理（Ctrl + F5）。");
    const run = async (sel, fn) => { const el = $(sel); if (!el) return; try { await fn(el); } catch (e) { console.error(e); fail(el); } };
    const subjectId = document.body.dataset.subject;
    await Promise.all([
      run("#home-stats", () => renderHome()),
      run("#subjects", (el) => renderSubjects(el)),
      run("#chapters", (el) => renderSubject(el, subjectId)),
      run("[data-qcount]", (el) => renderBankEntry(el, subjectId)),
      run(".qbank[data-questions]", (el) => renderTopicQuestions(el, subjectId, el.dataset.questions)),
      run("#qbank-all", (el) => renderQuestionBank(el, subjectId)),
      run(".pager", (el) => document.body.dataset.topic && renderPager(el, document.body.dataset.topic)),
      run("#exam-index", (el) => renderExamIndex(el)),
      run("#exam-paper", (el) => renderPaper(el)),
    ]);
  });
})();
