/* =====================================================================
   Heap（堆積）主題的視覺化
   - heap : max heap 的 insert / delete-max / build heap（由下往上），樹和陣列同步
   ===================================================================== */
(function () {
  "use strict";
  const { Player, Recorder, ui, register, iconHTML, figure } = window.DSViz;

  const SIFT = [
    "void siftDown(int a[], int i, int size) {",
    "  while (2 * i <= size) {                      /* 還有子節點就繼續 */",
    "    int c = 2 * i;                             /* 先假設左子比較大 */",
    "    if (c + 1 <= size && a[c + 1] > a[c]) c++; /* 右子更大就改選右子 */",
    "    if (a[i] >= a[c]) break;                   /* 比兩個子節點都大，停 */",
    "    swap(&a[i], &a[c]);",
    "    i = c;",
    "  }",
    "}",
  ];
  const CODE = {
    insert: [
      "void insert(int x) {",
      "  if (n == MAX) { printf(\"Heap Full\\n\"); exit(1); }",
      "  int i = ++n;                                 /* 先放在最後一個位置 */",
      "  heap[i] = x;",
      "  while (i > 1 && heap[i] > heap[i / 2]) {     /* 比父節點大就往上換 */",
      "    swap(&heap[i], &heap[i / 2]);",
      "    i /= 2;",
      "  }",
      "}",
    ],
    del: SIFT.concat([
      "",
      "int deleteMax(void) {",
      "  if (n == 0) { printf(\"Heap Empty\\n\"); exit(1); }",
      "  int top = heap[1];",
      "  heap[1] = heap[n--];                         /* 最後一個移到根 */",
      "  siftDown(heap, 1, n);",
      "  return top;",
      "}",
    ]),
    build: SIFT.concat([
      "",
      "void buildHeap(int a[], int size) {",
      "  for (int i = size / 2; i >= 1; i--)          /* 從最後一個內部節點往前 */",
      "    siftDown(a, i, size);",
      "}",
    ]),
  };
  const S = { loop: 2, pickL: 3, pickR: 4, stop: 5, swap: 6, next: 7 };   // siftDown 的行號

  const W = 680, H = 410, MAXN = 15;
  const tpos = (i) => {               // i 從 1 開始
    const d = Math.floor(Math.log2(i)), k = i - 2 ** d, span = 600;
    return { x: W / 2 - span / 2 + (k + 0.5) * span / 2 ** d, y: 70 + d * 54 };
  };
  const AX = (i) => 52 + (i - 1) * 41, AY = 340;

  register("heap", function (root) {
    const player = new Player(root, {
      title: "Max Heap 最大堆積",
      width: W, height: H, code: CODE.insert,
      legend: [["new", "新加入"], ["compare", "比較中"], ["active", "正在移動的元素"], ["found", "位置確定"], ["removed", "被取走"]],
    });

    // 模型：a[1..n] 放 {id, v}
    let a = [null], uid = 0;
    const n = () => a.length - 1;

    function frame(caption, line, opt = {}) {
      const st = opt.states || {};
      const nodes = [], edges = [], labels = [], pointers = [];
      for (let i = 1; i <= n(); i++) {
        const e = a[i], p = tpos(i), s = st[i] || "default";
        nodes.push({ id: e.id, label: e.v, x: p.x, y: p.y, r: 19, state: s });
        if (i > 1) edges.push({ from: a[Math.floor(i / 2)].id, to: e.id, state: st[i] === "found" && st[Math.floor(i / 2)] === "found" ? "found" : st[i] && st[Math.floor(i / 2)] ? "compare" : "default" });
        nodes.push({ id: "a" + e.id, label: e.v, shape: "box", x: AX(i), y: AY, w: 36, h: 32, state: s });
      }
      for (let i = 1; i <= MAXN; i++) {
        nodes.push({ id: "slot" + i, shape: "box", x: AX(i), y: AY, w: 38, h: 34, state: "ghost" });
        labels.push({ id: "ix" + i, x: AX(i), y: AY + 32, text: `[${i}]` });
      }
      labels.push({ id: "arr", x: 32, y: AY - 30, text: `陣列 heap[1..n]，n = ${n()}　（i 的父節點 i / 2，子節點 2i、2i + 1）`, anchor: "start" });
      if (opt.i) pointers.push({ id: "pi", label: "i", target: a[opt.i] ? a[opt.i].id : "slot" + opt.i, dir: "up", state: "active" });
      (opt.floating || []).forEach((f) => nodes.push(f));
      if (opt.note) labels.push({ id: "note", x: W - 20, y: 34, text: opt.note, anchor: "end", cls: "strong" });
      if (!n() && !(opt.floating || []).length) labels.push({ id: "empty", x: W / 2, y: 150, text: "（空的 heap）" });
      return { nodes, edges, pointers, labels, caption, line };
    }

    // siftDown：r 是 Recorder，i 起點，size，lineOf(siftLine) 換算行號
    function siftDown(r, i, size, extra = {}) {
      const done = extra.done || {};
      while (2 * i <= size) {
        let c = 2 * i;
        const both = c + 1 <= size;
        r.push(frame(both ? `${a[i].v} 有兩個子節點 ${a[c].v}、${a[c + 1].v}，先挑<b>比較大</b>的那個（${Math.max(a[c].v, a[c + 1].v)}）來比較。`
          : `${a[i].v} 只有左子節點 ${a[c].v}。`, [S.pickL, S.pickR], { states: Object.assign({}, done, { [i]: "active", [c]: "compare", ...(both ? { [c + 1]: "compare" } : {}) }), i, note: extra.note }));
        if (both && a[c + 1].v > a[c].v) c++;
        if (a[i].v >= a[c].v) {
          r.push(frame(`${a[i].v} ≥ ${a[c].v}，已經比子節點都大，<b>停下來</b>。`, S.stop, { states: Object.assign({}, done, { [i]: "found" }), i, note: extra.note }));
          return;
        }
        r.push(frame(`${a[i].v} &lt; ${a[c].v}，違反 max heap（父 ≥ 子），<b>交換</b>：較大的子節點往上，${a[i].v} 往下沉。`, S.swap, { states: Object.assign({}, done, { [i]: "active", [c]: "compare" }), i, note: extra.note }));
        [a[i], a[c]] = [a[c], a[i]];
        i = c;
        r.push(frame(`交換完成，繼續從位置 ${i} 往下檢查。`, S.next, { states: Object.assign({}, done, { [i]: "active" }), i, note: extra.note }));
      }
      r.push(frame(`${a[i].v} 已經沒有子節點（2 × ${i} &gt; ${size}），停在葉子。`, S.loop, { states: Object.assign({}, done, { [i]: "found" }), i, note: extra.note }));
    }

    // ---------- insert ----------
    function doInsert(v) {
      player.setCode(CODE.insert);
      const r = new Recorder();
      if (n() >= MAXN) { r.push(frame(`${iconHTML("alert")} 示範最多 ${MAXN} 個元素（4 層），畫面才放得下。可以先 delete-max 或清空。`, 2)); return r.frames; }
      a.push({ id: "h" + uid++, v });
      let i = n();
      r.push(frame(`insert(${v})：先放在陣列最後一格 heap[${i}]，也就是完全二元樹最下層最左邊的空位，這樣樹的<b>形狀</b>仍然是完全二元樹。`, [3, 4], { states: { [i]: "new" }, i }));
      while (i > 1) {
        const p = Math.floor(i / 2);
        r.push(frame(`和父節點 heap[${i} / 2] = heap[${p}] = ${a[p].v} 比較。`, 5, { states: { [i]: "active", [p]: "compare" }, i }));
        if (a[i].v <= a[p].v) {
          r.push(frame(`${a[i].v} ≤ ${a[p].v}，父節點比較大，<b>停</b>。heap 性質恢復。`, 5, { states: { [i]: "found" }, i }));
          return r.frames;
        }
        r.push(frame(`${a[i].v} &gt; ${a[p].v}，比父節點大，<b>交換</b>（往上浮一層）。`, 6, { states: { [i]: "active", [p]: "compare" }, i }));
        [a[i], a[p]] = [a[p], a[i]];
        i = p;
        r.push(frame(`交換完成，i = ${i}。`, 7, { states: { [i]: "active" }, i }));
      }
      r.push(frame(`${a[1].v} 已經浮到根（i = 1），是目前最大的元素。最多換 ⌊log₂n⌋ 次，所以是 O(log n)。`, 5, { states: { 1: "found" }, i: 1 }));
      return r.frames;
    }

    // ---------- delete-max ----------
    function doDelete() {
      player.setCode(CODE.del);
      const r = new Recorder();
      if (!n()) { r.push(frame("heap 是空的，沒有東西可以刪。", 12)); return r.frames; }
      const top = a[1];
      r.push(frame(`deleteMax()：最大值一定在根 heap[1] = <b>${top.v}</b>，把它取出來。`, 13, { states: { 1: "removed" } }));
      const fl = { id: top.id, label: top.v, x: W - 70, y: 90, r: 19, state: "removed" };
      if (n() === 1) { a.pop(); r.push(frame(`只剩一個元素，取走後 heap 變空。回傳 ${top.v}。`, 16, { floating: [fl], note: `回傳 ${top.v}` })); return r.frames; }
      const last = a.pop();
      a[1] = last;
      r.push(frame(`把<b>最後一個元素 ${last.v}</b> 搬到根，n 減 1。這樣形狀仍是完全二元樹，但 ${last.v} 很可能太小，要往下沉。`, 14, { states: { 1: "active" }, i: 1, floating: [fl], note: `取出 ${top.v}` }));
      const r2 = new Recorder();
      siftDown(r2, 1, n(), { note: `取出 ${top.v}` });
      r2.frames.forEach((f) => { f.nodes.push(fl); r.push(f); });
      r.push(frame(`heap 性質恢復，回傳 <b>${top.v}</b>。往下沉最多 ⌊log₂n⌋ 層，每層比較 2 次，所以是 O(log n)。`, 16, { floating: [fl], note: `回傳 ${top.v}` }));
      return r.frames;
    }

    // ---------- build heap（由下往上）----------
    function doBuild(vals) {
      player.setCode(CODE.build);
      a = [null].concat(vals.map((v) => ({ id: "h" + uid++, v })));
      const r = new Recorder(), size = n();
      r.push(frame(`先把 ${size} 個數照順序放進陣列，形狀已經是完全二元樹，但還不滿足 heap 性質。從<b>最後一個內部節點</b> i = ⌊${size} / 2⌋ = ${Math.floor(size / 2)} 開始往前，對每個節點做 siftDown。`, [11, 12]));
      for (let i = Math.floor(size / 2); i >= 1; i--) {
        const done = {};
        for (let k = i + 1; k <= size; k++) done[k] = "visited";
        r.push(frame(`i = ${i}：它底下的子樹都已經是 heap 了，只要把 ${a[i].v} 往下沉到正確位置。`, 13, { states: Object.assign({}, done, { [i]: "active" }), i }));
        siftDown(r, i, size, { done });
      }
      const all = {}; for (let k = 1; k <= size; k++) all[k] = "found";
      r.push(frame(`完成！由下往上建 heap 的總成本是 <b>O(n)</b>：大部分節點在底層，只需要往下沉很少層。`, null, { states: all }));
      return r.frames;
    }

    function parseList(text) {
      const toks = text.trim().split(/[\s,]+/).filter(Boolean);
      if (!toks.length) return "請輸入數字，用空白或逗號分隔。";
      if (toks.length > MAXN) return `最多 ${MAXN} 個數字（4 層），畫面才放得下。`;
      const vs = toks.map(Number);
      if (vs.some((v) => !Number.isInteger(v) || v < 0 || v > 999)) return "只能輸入 0～999 的整數。";
      return vs;
    }

    // ---------- 控制列 ----------
    const input = ui.input(player, { placeholder: "數值或一串數字", value: "85", width: 150 });
    const one = () => {
      const v = ui.int(input, { min: 0, max: 999 });
      if (v === null) player.load([frame(`${iconHTML("alert")} insert 請輸入一個 0～999 的整數；要建 heap 請輸入一串數字再按「build heap」。`, null)], { autoplay: false });
      return v;
    };
    ui.button(player, "insert", () => { const v = one(); if (v !== null) player.load(doInsert(v)); });
    ui.button(player, "delete-max", () => player.load(doDelete()));
    ui.button(player, "build heap", () => {
      const vs = parseList(input.value);
      if (typeof vs === "string") { input.classList.add("is-error"); setTimeout(() => input.classList.remove("is-error"), 700); player.load([frame(`${iconHTML("alert")} ${vs}`, null)], { autoplay: false }); return; }
      player.load(doBuild(vs));
    }, "ghost");
    ui.button(player, "範例數列", () => { input.value = "15 25 10 40 35 50 20"; }, "ghost");
    ui.button(player, "清空", () => { a = [null]; player.load([frame("heap 已清空。", null)], { autoplay: false }); }, "ghost");
    input.addEventListener("keydown", (e) => e.key === "Enter" && player.toolbar.querySelector(".vop").click());

    // 初始：依序 insert 30 50 20 70 60 10 後的 heap，示範 insert(80)
    [30, 50, 20, 70, 60, 10].forEach((v) => { a.push({ id: "h" + uid++, v }); let i = n(); while (i > 1 && a[i].v > a[Math.floor(i / 2)].v) { [a[i], a[Math.floor(i / 2)]] = [a[Math.floor(i / 2)], a[i]]; i = Math.floor(i / 2); } });
    const demo = doInsert(80);
    demo[0].caption = iconHTML("play") + " 按播放看 <b>insert(80)</b>：80 會從最後一格一路浮到根。上方的樹和下方的陣列是同一份資料，交換時兩邊會一起移動。之後可以試試 <b>delete-max</b>，或輸入一串數字按 <b>build heap</b>。";
    player.load(demo, { autoplay: false });
  });

  // ===================================================================
  // 靜態圖解
  // ===================================================================
  const node = (id, v, x, y, st) => ({ id, label: v, x, y, r: 18, state: st || "default" });
  const tp = (i, cx, top, gap, span) => {
    const d = Math.floor(Math.log2(i)), k = i - 2 ** d;
    return { x: cx - span / 2 + (k + 0.5) * span / 2 ** d, y: top + d * gap };
  };
  function heapTree(vals, cx, top, gap, span, pfx, stOf) {
    const nodes = [], edges = [];
    vals.forEach((v, k) => {
      const i = k + 1, p = tp(i, cx, top, gap, span);
      nodes.push(node(pfx + i, v, p.x, p.y, stOf ? stOf(i) : "default"));
      if (i > 1) edges.push({ from: pfx + Math.floor(i / 2), to: pfx + i, state: stOf && stOf(i) === "removed" ? "removed" : "default" });
    });
    return { nodes, edges };
  }

  // 圖 1：樹與陣列的對應
  figure("heap-array-mapping", () => {
    const vals = [80, 60, 70, 30, 50, 10, 20];
    const { nodes, edges } = heapTree(vals, 200, 40, 62, 340, "t");
    const labels = [];
    vals.forEach((v, k) => {
      nodes.push({ id: "a" + k, label: v, shape: "box", x: 400 + k * 38, y: 120, w: 34, h: 32, state: k === 1 ? "compare" : k === 3 || k === 4 ? "active" : "default" });
      labels.push({ id: "i" + k, x: 400 + k * 38, y: 152, text: `[${k + 1}]` });
    });
    nodes[1].state = "compare"; nodes[3].state = "active"; nodes[4].state = "active";
    return {
      width: 680, height: 250, nodes, edges,
      labels: labels.concat([
        { id: "t1", x: 514, y: 76, text: "陣列 heap[1..7]", cls: "strong" },
        { id: "t2", x: 514, y: 196, text: "heap[2] = 60 的子節點在 [4]、[5]", anchor: "middle" },
        { id: "t3", x: 514, y: 222, text: "父 = i / 2，左子 = 2i，右子 = 2i + 1", anchor: "middle", cls: "strong" },
      ]),
    };
  });

  // 圖 2：合法與不合法
  figure("heap-valid-invalid", () => {
    const A = heapTree([90, 70, 80, 60, 50, 75], 150, 40, 60, 260, "a");
    const B = heapTree([90, 70, 80, 75, 50, 60], 400, 40, 60, 260, "b", (i) => (i === 4 ? "removed" : i === 2 ? "compare" : "default"));
    const C = heapTree([90, 70, 80, 60], 600, 40, 60, 160, "c");
    C.nodes.push(node("c6", 40, 600 - 80 + 2.5 * 160 / 4, 160, "removed"));
    C.edges.push({ from: "c3", to: "c6", state: "removed" });
    return {
      width: 700, height: 260, nodes: A.nodes.concat(B.nodes, C.nodes), edges: A.edges.concat(B.edges, C.edges),
      labels: [
        { id: "l1", x: 150, y: 220, text: "(a) 合法的 max heap", cls: "strong" },
        { id: "l2", x: 400, y: 220, text: "(b) 75 > 父節點 70", cls: "warn" },
        { id: "l3", x: 600, y: 220, text: "(c) 不是完全二元樹", cls: "warn" },
        { id: "l4", x: 600, y: 246, text: "[5] 空著卻用了 [6]", anchor: "middle" },
      ],
    };
  });

  // 圖 3：由下往上建 heap 的成本
  figure("heap-build-cost", () => {
    const vals = new Array(15).fill("");
    const depth = (i) => Math.floor(Math.log2(i));
    const { nodes, edges } = heapTree(vals, 250, 40, 56, 440, "x", (i) => ["active", "compare", "visited", "muted"][depth(i)]);
    nodes.forEach((n2) => (n2.r = 14));
    return {
      width: 680, height: 260, nodes, edges,
      labels: [
        { id: "d0", x: 500, y: 44, text: "1 個 × 最多沉 3 層", anchor: "start" },
        { id: "d1", x: 500, y: 100, text: "2 個 × 2 層", anchor: "start" },
        { id: "d2", x: 500, y: 156, text: "4 個 × 1 層", anchor: "start" },
        { id: "d3", x: 500, y: 212, text: "8 個 × 0 層", anchor: "start" },
        { id: "sum", x: 340, y: 250, text: "總交換次數 ≤ 1·3 + 2·2 + 4·1 + 8·0 = 11 < n = 15", cls: "strong" },
      ],
    };
  });
})();
