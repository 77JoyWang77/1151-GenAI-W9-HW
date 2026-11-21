/* =====================================================================
   Singly Linked List（單向鏈結串列）主題的視覺化
   - sll : insertFront / insertSorted / deleteValue / search / reverse，
           prev、cur、next 指標和每一條 link 的變化都看得到
   ===================================================================== */
(function () {
  "use strict";
  const { Player, Recorder, ui, register, iconHTML, figure } = window.DSViz;

  // 右側程式碼（和 code/data-structures/singly-linked-list.c 完全一致）
  const SRC = {
    "insertFront": [
      "void insertFront(listPointer *first, int x) {",
      "  listPointer p = newNode(x);",
      "  p->link = *first;                            /* 新節點先指向原本的第一個 */",
      "  *first = p;                                  /* 再讓 first 指向新節點 */",
      "}"
    ],
    "insertAfter": [
      "void insertAfter(listPointer prev, int x) {",
      "  listPointer p = newNode(x);",
      "  p->link = prev->link;                        /* 先接後面 */",
      "  prev->link = p;                              /* 再接前面 */",
      "}"
    ],
    "insertSorted": [
      "void insertSorted(listPointer *first, int x) {",
      "  listPointer prev = NULL, cur = *first;",
      "  while (cur != NULL && cur->data < x) {       /* 找第一個 >= x 的節點 */",
      "    prev = cur;",
      "    cur = cur->link;",
      "  }",
      "  if (prev == NULL) insertFront(first, x);     /* 插在最前面要改 first */",
      "  else insertAfter(prev, x);",
      "}"
    ],
    "deleteValue": [
      "int deleteValue(listPointer *first, int x) {",
      "  listPointer prev = NULL, cur = *first;",
      "  while (cur != NULL && cur->data != x) {      /* 找要刪的節點，順便記住前一個 */",
      "    prev = cur;",
      "    cur = cur->link;",
      "  }",
      "  if (cur == NULL) return 0;                   /* 找不到 */",
      "  if (prev == NULL) *first = cur->link;        /* 刪第一個：first 往後移 */",
      "  else prev->link = cur->link;                 /* 前一個直接跳過 cur */",
      "  free(cur);",
      "  return 1;",
      "}"
    ],
    "search": [
      "listPointer search(listPointer first, int x) {",
      "  listPointer p = first;",
      "  while (p != NULL && p->data != x)            /* 一個一個往後找 */",
      "    p = p->link;",
      "  return p;                                    /* 找不到時 p 是 NULL */",
      "}"
    ],
    "reverse": [
      "listPointer reverse(listPointer first) {",
      "  listPointer prev = NULL, cur = first, next;",
      "  while (cur != NULL) {",
      "    next = cur->link;                          /* 先記住下一個，不然會斷掉 */",
      "    cur->link = prev;                          /* 箭頭反過來指向前一個 */",
      "    prev = cur;                                /* 三個指標一起往後移 */",
      "    cur = next;",
      "  }",
      "  return prev;                                 /* prev 停在原本的最後一個 */",
      "}"
    ]
  };
  const CODE = {
    front: SRC.insertFront,
    sorted: SRC.insertFront.concat([""], SRC.insertAfter, [""], SRC.insertSorted),
    del: SRC.deleteValue,
    search: SRC.search,
    reverse: SRC.reverse,
  };
  // 找出含有某段文字的行號（從 1 開始），避免手寫行號對不上
  const at = (code, text, nth = 0) => {
    let k = -1;
    for (let i = 0; i <= nth; i++) k = code.findIndex((l, j) => j > k && l.includes(text));
    return k + 1;
  };

  const W = 690, H = 200, MAXN = 7;
  const X0 = 100, DX = 78, Y = 115, NW = 54, NH = 34;
  const xOf = (i) => X0 + i * DX;

  register("sll", function (root) {
    const player = new Player(root, {
      title: "Singly Linked List 單向鏈結串列",
      width: W, height: H, code: CODE.sorted,
      legend: [["new", "新節點"], ["compare", "目前節點 cur"], ["visited", "已經走過"], ["active", "正在改 link"], ["found", "找到 / 完成"], ["removed", "要刪除"]],
    });

    // 模型：L 是畫面上由左到右的節點；link[id] 是它指向的節點 id（null = NULL）
    let L = [], link = {}, first = null, uid = 0;
    const byId = (id) => L.find((e) => e.id === id);

    function build(vals) {
      L = vals.map((v) => ({ id: "n" + uid++, v }));
      link = {};
      L.forEach((e, i) => (link[e.id] = i + 1 < L.length ? L[i + 1].id : null));
      first = L.length ? L[0].id : null;
    }

    // opt.st：{ id: state }；opt.ptr：{ 名稱: id | null }；opt.float：浮在上方的節點 { id: {x, y} }
    function frame(caption, line, opt = {}) {
      const st = opt.st || {}, fl = opt.float || {};
      const nodes = [], edges = [], pointers = [], labels = [];
      const pos = {};
      let col = 0;
      L.forEach((e) => {
        if (fl[e.id]) pos[e.id] = fl[e.id];
        else pos[e.id] = { x: xOf(col++), y: Y };
      });
      const lastX = col ? xOf(col - 1) : X0 - DX;
      const nilR = { x: Math.min(lastX + DX, W - 36), y: Y };
      nodes.push({ id: "nilR", label: "NULL", shape: "box", x: nilR.x, y: nilR.y, w: 52, h: 30, state: "muted" });
      if (opt.nilL) nodes.push({ id: "nilL", label: "NULL", shape: "box", x: 40, y: Y, w: 52, h: 30, state: "muted" });
      L.forEach((e) => {
        nodes.push({ id: e.id, label: e.v, shape: "box", x: pos[e.id].x, y: pos[e.id].y, w: NW, h: NH, state: st[e.id] || "default" });
        const t = link[e.id];
        if (t === undefined) return;
        const to = t === null ? (opt.nilL && opt.toLeft && opt.toLeft[e.id] ? "nilL" : "nilR") : t;
        edges.push({ from: e.id, to, directed: true, state: opt.est && opt.est[e.id] ? opt.est[e.id] : "default" });
      });
      // first 一定畫在上方；其他指標畫在下方
      const tgt = (id) => (id === null ? (opt.nullLeft ? "nilL" : "nilR") : id);
      pointers.push({ id: "first", label: "first", target: tgt(first), dir: "up", state: opt.firstState || "default" });
      const ptr = opt.ptr || {};
      const used = {};
      Object.keys(ptr).forEach((name) => {
        let t = ptr[name];
        if (t === null) t = name === "prev" && opt.nilL ? "nilL" : "nilR";
        const k = used[t] = (used[t] || 0) + 1;
        pointers.push({ id: "p-" + name, label: name, target: t, dir: k === 1 ? "down" : "right", state: name === "p" ? "active" : "compare" });
      });
      if (!L.length) labels.push({ id: "empty", x: W / 2, y: 60, text: "first = NULL（空串列）" });
      if (opt.note) labels.push({ id: "note", x: W - 16, y: 24, text: opt.note, anchor: "end", cls: "strong" });
      return { nodes, edges, pointers, labels, caption, line };
    }

    const listText = () => {
      const out = [];
      for (let p = first, g = 0; p !== null && g < 20; p = link[p], g++) out.push(byId(p).v);
      return out.concat(["NULL"]).join(" → ");
    };

    // ---------- insertFront ----------
    function doFront(v) {
      player.setCode(CODE.front);
      const c = CODE.front, r = new Recorder();
      if (L.length >= MAXN) return full(r);
      const e = { id: "n" + uid++, v };
      L.unshift(e);
      const up = { [e.id]: { x: X0, y: 42 } };
      r.push(frame(`insertFront(${v})：先用 newNode 配置一個新節點 p，data = ${v}，link 先設成 NULL。`, at(c, "newNode(x)"), { st: { [e.id]: "new" }, float: up, ptr: { p: e.id } }));
      link[e.id] = first;
      r.push(frame(`<code>p-&gt;link = *first</code>：新節點先指向原本的第一個節點${first ? "（" + byId(first).v + "）" : "（目前是 NULL）"}。這一步要先做，原本的串列才不會遺失。`, at(c, "p->link = *first"), { st: { [e.id]: "new" }, float: up, ptr: { p: e.id }, est: { [e.id]: "active" } }));
      first = e.id;
      r.push(frame(`<code>*first = p</code>：再把 first 改成指向新節點。只改兩個指標，和串列長度無關，所以是 O(1)。`, at(c, "*first = p"), { st: { [e.id]: "new" }, float: up, ptr: { p: e.id }, firstState: "active" }));
      r.push(frame(`完成：${listText()}。`, null, { st: { [e.id]: "found" } }));
      return r.frames;
    }

    // ---------- insertSorted（遞增串列）----------
    function doSorted(v) {
      player.setCode(CODE.sorted);
      const c = CODE.sorted, r = new Recorder();
      if (L.length >= MAXN) return full(r);
      const loop = at(c, "while (cur != NULL && cur->data < x)"), step1 = at(c, "prev = cur;"), step2 = at(c, "cur = cur->link;");
      let prev = null, cur = first;
      const seen = {};
      r.push(frame(`insertSorted(${v})：從頭找<b>第一個 ≥ ${v} 的節點</b>，新節點要插在它前面。所以除了 cur，還要用 prev 記住 cur 的前一個（單向串列沒辦法往回走）。`, at(c, "listPointer prev = NULL, cur = *first;"), { ptr: { prev, cur }, nilL: true, nullLeft: true }));
      while (cur !== null && byId(cur).v < v) {
        seen[cur] = "visited";
        r.push(frame(`${byId(cur).v} &lt; ${v}，還沒到，prev 和 cur 一起往後移一格。`, [loop, step1, step2], { st: Object.assign({}, seen, { [cur]: "compare" }), ptr: { prev, cur }, nilL: true }));
        prev = cur; cur = link[cur];
      }
      r.push(frame(cur === null ? `cur 已經走到 NULL，${v} 比所有節點都大，要接在最後面。` : `${byId(cur).v} ≥ ${v}，找到位置：插在 ${prev === null ? "最前面" : byId(prev).v + " 和 " + byId(cur).v + " 之間"}。`, loop, { st: Object.assign({}, seen, cur ? { [cur]: "compare" } : {}), ptr: { prev, cur }, nilL: true }));
      const e = { id: "n" + uid++, v };
      const k = prev === null ? 0 : L.findIndex((x) => x.id === prev) + 1;
      L.splice(k, 0, e);
      const up = { [e.id]: { x: xOf(k) - (prev === null ? 0 : DX / 2), y: 42 } };
      if (prev === null) {
        r.push(frame(`prev 是 NULL，代表要插在第一個節點之前，first 會改變，所以呼叫 insertFront。`, at(c, "if (prev == NULL) insertFront(first, x);"), { st: { [e.id]: "new" }, float: up, ptr: { cur }, nilL: true }));
        link[e.id] = first;
        r.push(frame(`<code>p-&gt;link = *first</code>：新節點先指向原本的第一個節點。`, at(c, "p->link = *first"), { st: { [e.id]: "new" }, float: up, ptr: { p: e.id }, est: { [e.id]: "active" } }));
        first = e.id;
        r.push(frame(`<code>*first = p</code>：first 改指向新節點。`, at(c, "*first = p"), { st: { [e.id]: "new" }, float: up, ptr: { p: e.id }, firstState: "active" }));
      } else {
        r.push(frame(`呼叫 insertAfter(prev, ${v})：配置新節點 p。`, at(c, "listPointer p = newNode(x);", 1), { st: { [e.id]: "new" }, float: up, ptr: { prev, p: e.id } }));
        link[e.id] = link[prev];
        r.push(frame(`<code>p-&gt;link = prev-&gt;link</code>：<b>先接後面</b>，p 指向 ${link[prev] === null ? "NULL" : byId(link[prev]).v}。這時 prev 還指著原本的下一個，串列沒有斷。`, at(c, "p->link = prev->link;"), { st: { [e.id]: "new", [prev]: "compare" }, float: up, ptr: { prev, p: e.id }, est: { [e.id]: "active" } }));
        link[prev] = e.id;
        r.push(frame(`<code>prev-&gt;link = p</code>：<b>再接前面</b>，${byId(prev).v} 改指向新節點。兩行順序如果顛倒，p-&gt;link 會讀到 p 自己，後半段就遺失了。`, at(c, "prev->link = p;"), { st: { [e.id]: "new", [prev]: "compare" }, float: up, ptr: { prev, p: e.id }, est: { [prev]: "active" } }));
      }
      r.push(frame(`完成：${listText()}。找位置最多走 n 步是 O(n)，真正的插入只改 2 個指標是 O(1)。`, null, { st: { [e.id]: "found" } }));
      return r.frames;
    }

    // ---------- deleteValue ----------
    function doDelete(v) {
      player.setCode(CODE.del);
      const c = CODE.del, r = new Recorder();
      const loop = at(c, "while (cur != NULL && cur->data != x)"), step = [at(c, "prev = cur;"), at(c, "cur = cur->link;")];
      let prev = null, cur = first;
      const seen = {};
      r.push(frame(`deleteValue(${v})：要刪掉 cur，必須改「cur 前一個節點」的 link，所以同樣用 prev 跟在 cur 後面。`, at(c, "listPointer prev = NULL, cur = *first;"), { ptr: { prev, cur }, nilL: true }));
      while (cur !== null && byId(cur).v !== v) {
        seen[cur] = "visited";
        r.push(frame(`${byId(cur).v} ≠ ${v}，prev 和 cur 往後移。`, [loop].concat(step), { st: Object.assign({}, seen, { [cur]: "compare" }), ptr: { prev, cur }, nilL: true }));
        prev = cur; cur = link[cur];
      }
      if (cur === null) {
        r.push(frame(`cur 走到 NULL 還沒找到 ${v}，回傳 0，串列不變。`, at(c, "if (cur == NULL) return 0;"), { st: seen, ptr: { prev, cur }, nilL: true }));
        return r.frames;
      }
      r.push(frame(`找到 ${v}，它就是要刪的節點。`, loop, { st: Object.assign({}, seen, { [cur]: "removed" }), ptr: { prev, cur }, nilL: true }));
      const up = { [cur]: { x: xOf(L.findIndex((x) => x.id === cur)), y: 42 } };
      if (prev === null) {
        first = link[cur];
        r.push(frame(`prev 是 NULL，代表刪的是第一個節點：<code>*first = cur-&gt;link</code>，first 直接往後移。`, at(c, "if (prev == NULL) *first = cur->link;"), { st: { [cur]: "removed" }, float: up, ptr: { cur }, firstState: "active" }));
      } else {
        link[prev] = link[cur];
        r.push(frame(`<code>prev-&gt;link = cur-&gt;link</code>：${byId(prev).v} 直接跳過 ${v}，指向 ${link[cur] === null ? "NULL" : byId(link[cur]).v}。`, at(c, "else prev->link = cur->link;"), { st: { [cur]: "removed", [prev]: "compare" }, float: up, ptr: { prev, cur }, est: { [prev]: "active" } }));
      }
      L = L.filter((x) => x.id !== cur); delete link[cur];
      r.push(frame(`<code>free(cur)</code>：把節點的記憶體還回去。只改 1 個指標，但找到它要 O(n)。結果：${listText()}。`, at(c, "free(cur);"), {}));
      return r.frames;
    }

    // ---------- search ----------
    function doSearch(v) {
      player.setCode(CODE.search);
      const c = CODE.search, r = new Recorder();
      let p = first, k = 0;
      const seen = {};
      r.push(frame(`search(${v})：鏈結串列不能用索引直接跳到第 k 個，只能從 first 開始一個一個往後走。`, at(c, "listPointer p = first;"), { ptr: { p } }));
      while (p !== null && byId(p).v !== v) {
        seen[p] = "visited"; k++;
        r.push(frame(`${byId(p).v} ≠ ${v}，<code>p = p-&gt;link</code> 往下一個走（已比較 ${k} 個）。`, [at(c, "while (p != NULL && p->data != x)"), at(c, "p = p->link;")], { st: Object.assign({}, seen, { [p]: "compare" }), ptr: { p } }));
        p = link[p];
      }
      if (p === null) r.push(frame(`p 走到 NULL，找不到 ${v}，比較了 ${k} 個節點，這是最差情況 O(n)。`, at(c, "return p;"), { st: seen, ptr: { p } }));
      else r.push(frame(`找到 ${v}，是第 ${k + 1} 個節點，回傳指向它的指標。`, at(c, "return p;"), { st: Object.assign({}, seen, { [p]: "found" }), ptr: { p } }));
      return r.frames;
    }

    // ---------- reverse ----------
    function doReverse() {
      player.setCode(CODE.reverse);
      const c = CODE.reverse, r = new Recorder();
      let prev = null, cur = first, next = null;
      const done = {}, toLeft = {};
      const base = () => ({ nilL: true, toLeft, st: Object.assign({}, done, cur ? { [cur]: "compare" } : {}) });
      r.push(frame(`reverse()：準備三個指標。prev = NULL（反轉後的串列，一開始是空的）、cur = first（還沒反轉的部分）。`, at(c, "listPointer prev = NULL, cur = first, next;"), Object.assign(base(), { ptr: { prev, cur } })));
      if (cur === null) { r.push(frame("串列是空的，回傳 NULL。", at(c, "return prev;"), { ptr: {} })); return r.frames; }
      let round = 0;
      while (cur !== null) {
        round++;
        next = link[cur];
        r.push(frame(`第 ${round} 輪：<code>next = cur-&gt;link</code>，先記住 ${byId(cur).v} 的下一個（${next === null ? "NULL" : byId(next).v}）。下一行會改掉 cur-&gt;link，不先記住就找不到後面了。`, at(c, "next = cur->link;"), Object.assign(base(), { ptr: { prev, cur, next } })));
        link[cur] = prev;
        if (prev === null) toLeft[cur] = true;
        r.push(frame(`<code>cur-&gt;link = prev</code>：${byId(cur).v} 的箭頭反過來，指向 ${prev === null ? "NULL" : byId(prev).v}。`, at(c, "cur->link = prev;"), Object.assign(base(), { ptr: { prev, cur, next }, est: { [cur]: "active" } })));
        done[cur] = "found";
        prev = cur; cur = next;
        r.push(frame(`<code>prev = cur; cur = next;</code>：三個指標一起往右移一格。綠色是已經反轉好的部分。`, [at(c, "prev = cur;"), at(c, "cur = next;")], Object.assign(base(), { ptr: { prev, cur } })));
      }
      first = prev;
      L.reverse();
      Object.keys(toLeft).forEach((k) => delete toLeft[k]);
      r.push(frame(`cur 是 NULL，迴圈結束。回傳 prev（原本的最後一個），first = reverse(first)。每個節點只處理一次，O(n) 時間、O(1) 額外空間。結果：${listText()}。`, at(c, "return prev;"), { st: Object.fromEntries(L.map((e) => [e.id, "found"])), firstState: "active" }));
      return r.frames;
    }

    function full(r) {
      r.push(frame(`${iconHTML("alert")} 示範最多 ${MAXN} 個節點，畫面才放得下。可以先刪除幾個，或按「重設」。`, null));
      return r.frames;
    }

    // ---------- 控制列 ----------
    const input = ui.input(player, { placeholder: "數值", value: "25", width: 70 });
    const val = () => ui.int(input, { min: 0, max: 99 });
    const bad = () => player.load([frame(`${iconHTML("alert")} 請輸入 0～99 的整數。`, null)], { autoplay: false });
    const op = (fn) => () => { const v = val(); if (v === null) bad(); else player.load(fn(v)); };
    ui.button(player, "insertSorted", op(doSorted));
    ui.button(player, "insertFront", op(doFront), "ghost");
    ui.button(player, "delete", op(doDelete), "ghost");
    ui.button(player, "search", op(doSearch), "ghost");
    ui.button(player, "reverse", () => player.load(doReverse()), "ghost");
    ui.button(player, "重設", () => { build([10, 20, 30, 40]); player.load([frame(`串列重設為 ${listText()}。`, null)], { autoplay: false }); }, "ghost");
    input.addEventListener("keydown", (e) => e.key === "Enter" && player.toolbar.querySelector(".vop").click());

    build([10, 20, 30, 40]);
    const demo = doSorted(25);
    demo[0].caption = iconHTML("play") + " 按播放看 <b>insertSorted(25)</b>：prev 和 cur 一起往後找位置，接著先接後面、再接前面。之後可以試 delete、search，或按 <b>reverse</b> 看三個指標怎麼把箭頭一個一個反過來。";
    player.load(demo, { autoplay: false });
  });

  // ===================================================================
  // 靜態圖解
  // ===================================================================
  const box = (id, label, x, y, o = {}) => Object.assign({ id, label, shape: "box", x, y, w: 46, h: 34, state: "default" }, o);

  // 圖 1：節點結構 data | link 與記憶體位置
  figure("sll-structure", () => {
    const xs = [110, 270, 430], vals = [10, 20, 30], addr = ["0x1A0", "0x3F8", "0x2C4"];
    const nodes = [], edges = [], labels = [];
    xs.forEach((x, i) => {
      nodes.push(box("d" + i, vals[i], x, 110, { w: 50 }));
      nodes.push(box("l" + i, i < 2 ? addr[i + 1] : "NULL", x + 54, 110, { w: 58, state: "muted" }));
      labels.push({ id: "a" + i, x: x + 27, y: 146, text: "位址 " + addr[i], anchor: "middle" });
      if (i < 2) edges.push({ from: "l" + i, to: "d" + (i + 1), directed: true });
    });
    labels.push({ id: "fd", x: 110, y: 74, text: "data", anchor: "middle", cls: "strong" });
    labels.push({ id: "fl", x: 164, y: 74, text: "link", anchor: "middle", cls: "strong" });
    labels.push({ id: "note", x: 340, y: 188, text: "位址不連續也沒關係：每個節點的 link 存的是下一個節點的位址", anchor: "middle" });
    return { width: 640, height: 210, nodes, edges, labels, pointers: [{ id: "first", label: "first", target: "d0", dir: "left" }] };
  });

  // 圖 2：插入時兩行的順序
  figure("sll-insert-order", () => {
    const L = (pfx, ox, wrong) => {
      const n = [box(pfx + "a", 20, ox, 150), box(pfx + "b", 30, ox + 120, 150), box(pfx + "p", 25, ox + 60, 70, { state: wrong ? "removed" : "new" })];
      const e = wrong
        ? [{ from: pfx + "a", to: pfx + "p", directed: true, state: "active" }]
        : [{ from: pfx + "a", to: pfx + "p", directed: true, state: "active" }, { from: pfx + "p", to: pfx + "b", directed: true, state: "active" }];
      return { n, e };
    };
    const A = L("o", 80, false), B = L("x", 400, true);
    return {
      width: 640, height: 250,
      nodes: A.n.concat(B.n), edges: A.e.concat(B.e),
      labels: [
        { id: "t1", x: 140, y: 24, text: "(a) 先接後面，再接前面", anchor: "middle", cls: "strong" },
        { id: "t2", x: 460, y: 24, text: "(b) 順序顛倒", anchor: "middle", cls: "warn" },
        { id: "w1", x: 460, y: 200, text: "prev->link 已經改成 p，", anchor: "middle" },
        { id: "w2", x: 460, y: 222, text: "p->link = prev->link 讓 p 指向自己，30 之後全部遺失", anchor: "middle" },
        { id: "o1", x: 140, y: 200, text: "20 → 25 → 30，串列完整", anchor: "middle" },
      ],
    };
  });

  // 圖 3：dummy head
  figure("sll-dummy-head", () => ({
    width: 640, height: 170,
    nodes: [
      box("h", "—", 130, 90, { state: "muted", w: 50 }), box("a", 10, 250, 90), box("b", 20, 350, 90), box("c", 30, 450, 90),
      box("nil", "NULL", 560, 90, { state: "muted", w: 60 }),
    ],
    edges: [{ from: "h", to: "a", directed: true }, { from: "a", to: "b", directed: true }, { from: "b", to: "c", directed: true }, { from: "c", to: "nil", directed: true }],
    pointers: [{ id: "head", label: "head", target: "h", dir: "left" }],
    labels: [
      { id: "l1", x: 130, y: 140, text: "dummy：不存資料", anchor: "middle" },
      { id: "l2", x: 350, y: 140, text: "真正的資料從 head->link 開始", anchor: "middle" },
      { id: "l3", x: 350, y: 34, text: "每個資料節點前面都一定有一個節點，插入、刪除不用再特別處理第一個", anchor: "middle", cls: "strong" },
    ],
  }));
})();
