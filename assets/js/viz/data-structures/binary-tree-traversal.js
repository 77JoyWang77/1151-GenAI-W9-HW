/* =====================================================================
   Binary Tree Traversal（二元樹走訪）主題的視覺化
   - tree-traversal : 前序 / 中序 / 後序（遞迴）、中序（stack 版）、層序（queue）
   ===================================================================== */
(function () {
  "use strict";
  const { Player, Recorder, ui, register, esc, iconHTML, figure } = window.DSViz;

  const CODE = {
    pre: [
      "void preorder(Node *t) {",
      "  if (t == NULL) return;",
      "  printf(\"%c \", t->data);                        /* V：先拜訪自己 */",
      "  preorder(t->left);                             /* L */",
      "  preorder(t->right);                            /* R */",
      "}",
    ],
    in: [
      "void inorder(Node *t) {",
      "  if (t == NULL) return;",
      "  inorder(t->left);                              /* L */",
      "  printf(\"%c \", t->data);                        /* V：左子樹走完才拜訪自己 */",
      "  inorder(t->right);                             /* R */",
      "}",
    ],
    post: [
      "void postorder(Node *t) {",
      "  if (t == NULL) return;",
      "  postorder(t->left);                            /* L */",
      "  postorder(t->right);                           /* R */",
      "  printf(\"%c \", t->data);                        /* V：兩棵子樹都走完才拜訪自己 */",
      "}",
    ],
    iter: [
      "void inorderIter(Node *t) {",
      "  Node *stack[100];",
      "  int top = -1;",
      "  while (t != NULL || top != -1) {",
      "    while (t != NULL) {                          /* 一路往左走，沿途 push */",
      "      stack[++top] = t;",
      "      t = t->left;",
      "    }",
      "    t = stack[top--];                            /* 左邊到底了，pop 出來拜訪 */",
      "    printf(\"%c \", t->data);",
      "    t = t->right;                                /* 再處理它的右子樹 */",
      "  }",
      "}",
    ],
    level: [
      "void levelorder(Node *t) {",
      "  Node *queue[100];",
      "  int front = 0, rear = 0;                       /* front：下一個要取的；rear：下一個空位 */",
      "  if (t == NULL) return;",
      "  queue[rear++] = t;",
      "  while (front < rear) {",
      "    Node *p = queue[front++];",
      "    printf(\"%c \", p->data);",
      "    if (p->left)  queue[rear++] = p->left;       /* 先左後右放進 queue */",
      "    if (p->right) queue[rear++] = p->right;",
      "  }",
      "}",
    ],
  };
  // 遞迴版行號：進入、空、visit、左、右
  const LN = {
    pre: { enter: 1, nil: 2, visit: 3, left: 4, right: 5 },
    in: { enter: 1, nil: 2, visit: 4, left: 3, right: 5 },
    post: { enter: 1, nil: 2, visit: 5, left: 3, right: 4 },
  };
  const NAME = { pre: "前序 Preorder（V L R）", in: "中序 Inorder（L V R）", post: "後序 Postorder（L R V）" };

  const W = 680, H = 400, MAXN = 15;   // 最多 4 層（層序陣列 15 格）
  const posOf = (i) => {
    const d = Math.floor(Math.log2(i + 1)), k = i - (2 ** d - 1), span = 600;
    return { x: W / 2 - span / 2 + (k + 0.5) * span / 2 ** d, y: 72 + d * 56 };
  };

  register("tree-traversal", function (root) {
    const player = new Player(root, {
      title: "Binary Tree Traversal（二元樹走訪）",
      width: W, height: H, code: CODE.pre,
      legend: [["compare", "目前所在"], ["visited", "走過、還沒輸出"], ["found", "已輸出"], ["active", "在 stack / queue 裡"]],
    });

    let slots = [];   // 層序陣列，null 表示空

    function parse(text) {
      const toks = text.trim().split(/[\s,]+/).filter(Boolean);
      if (!toks.length) return "請輸入至少一個節點，例如：A B C D E # F";
      if (toks.length > MAXN) return `最多 ${MAXN} 格（4 層），畫面才放得下。`;
      const arr = toks.map((t) => (t === "#" ? null : t));
      if (arr[0] === null) return "第一格是根，不能是 #。";
      for (const t of toks) if (t !== "#" && t.length > 3) return `節點名稱最多 3 個字元：「${esc(t)}」太長了。`;
      for (let i = 1; i < arr.length; i++) if (arr[i] !== null && arr[Math.floor((i - 1) / 2)] === null) return `第 ${i + 1} 格「${esc(arr[i])}」的父節點是空的，接不上去。`;
      return arr;
    }
    const L = (i) => (2 * i + 1 < slots.length && slots[2 * i + 1] !== null ? 2 * i + 1 : null);
    const R = (i) => (2 * i + 2 < slots.length && slots[2 * i + 2] !== null ? 2 * i + 2 : null);

    // ---------- 繪製 ----------
    function frame(caption, line, opt = {}) {
      const st = opt.states || {};
      const nodes = [], edges = [], labels = [], pointers = [];
      slots.forEach((v, i) => {
        if (v === null) return;
        const p = posOf(i);
        nodes.push({ id: "n" + i, label: v, x: p.x, y: p.y, state: st[i] || "default", r: 19 });
        if (i > 0) edges.push({ from: "n" + Math.floor((i - 1) / 2), to: "n" + i, state: st[i] && st[Math.floor((i - 1) / 2)] ? "visited" : "default" });
      });
      if (opt.cur !== undefined && opt.cur !== null) pointers.push({ id: "cur", label: opt.curName || "t", target: "n" + opt.cur, dir: "up", state: "compare" });
      labels.push({ id: "out", x: 24, y: 290, text: "輸出：" + (opt.out || []).join(" "), cls: "strong", anchor: "start" });
      if (opt.strip) {
        const { name, items, note } = opt.strip;
        labels.push({ id: "sname", x: 24, y: 342, text: name, anchor: "start", cls: "title" });
        items.forEach((i, k) => nodes.push({ id: "s" + i, label: slots[i], shape: "box", x: 130 + k * 50, y: 338, w: 42, h: 32, state: k === opt.strip.hi ? "active" : "default" }));
        if (note) labels.push({ id: "snote", x: 24, y: 380, text: note, anchor: "start" });
      }
      if (opt.depth) labels.push({ id: "depth", x: W - 24, y: 290, text: opt.depth, anchor: "end" });
      return { nodes, edges, pointers, labels, caption, line };
    }

    // ---------- 遞迴版：前序 / 中序 / 後序 ----------
    function recursive(kind) {
      player.setCode(CODE[kind]);
      const r = new Recorder(), ln = LN[kind], st = {}, out = [], stack = [];
      const dep = () => `遞迴深度 ${stack.length}`;
      r.push(frame(`${NAME[kind]}：從根開始呼叫。三種走訪的路線完全一樣，差別只在<b>什麼時候輸出</b>自己。`, ln.enter, { out, cur: 0, states: { 0: "compare" } }));
      (function go(i, from) {
        stack.push(i);
        st[i] = st[i] === "found" ? "found" : "visited";
        if (from) r.push(frame(`往${from}走，進入 <b>${esc(slots[i])}</b>。`, ln.enter, { out, cur: i, states: Object.assign({}, st, { [i]: st[i] === "found" ? "found" : "compare" }), depth: dep() }));
        const visit = () => {
          out.push(slots[i]); st[i] = "found";
          const why = { pre: "一進來就先輸出自己", in: "左子樹已經走完，輸出自己", post: "左、右子樹都走完了，最後才輸出自己" }[kind];
          r.push(frame(`${why}：輸出 <b>${esc(slots[i])}</b>。`, ln.visit, { out, cur: i, states: Object.assign({}, st), depth: dep() }));
        };
        if (kind === "pre") visit();
        const l = L(i), rr = R(i);
        if (l !== null) go(l, "左"); else r.push(frame(`${esc(slots[i])} 沒有左子節點（NULL），左邊直接 return。`, [ln.left, ln.nil], { out, cur: i, states: Object.assign({}, st, st[i] === "found" ? {} : { [i]: "compare" }), depth: dep() }));
        if (kind === "in") visit();
        if (rr !== null) go(rr, "右"); else r.push(frame(`${esc(slots[i])} 沒有右子節點（NULL），右邊直接 return。`, [ln.right, ln.nil], { out, cur: i, states: Object.assign({}, st, st[i] === "found" ? {} : { [i]: "compare" }), depth: dep() }));
        if (kind === "post") visit();
        stack.pop();
        if (stack.length) r.push(frame(`${esc(slots[i])} 這棵子樹處理完，回到父節點 <b>${esc(slots[stack[stack.length - 1]])}</b>。`, 6, { out, cur: stack[stack.length - 1], states: Object.assign({}, st), depth: dep() }));
      })(0, null);
      r.push(frame(`完成！${NAME[kind]}：<b>${out.map(esc).join(" ")}</b>。每個節點剛好輸出一次，時間 O(n)。`, null, { out, states: Object.assign({}, st) }));
      return r.frames;
    }

    // ---------- 中序（stack 版）----------
    function iterIn() {
      player.setCode(CODE.iter);
      const r = new Recorder(), st = {}, out = [], stack = [];
      const strip = (note) => ({ name: "stack：", items: stack.slice(), hi: stack.length - 1, note: note || "底 → 頂（右邊是 top）" });
      let t = 0;
      r.push(frame("不用遞迴，自己用一個 stack 記住「之後要回來拜訪」的節點。", [2, 3], { out, cur: t, strip: strip() }));
      while (t !== null || stack.length) {
        while (t !== null) {
          stack.push(t); st[t] = "active";
          r.push(frame(`push <b>${esc(slots[t])}</b>，然後往左走。現在還不能輸出它，因為它的左子樹要先輸出。`, [6, 7], { out, cur: t, states: Object.assign({}, st), strip: strip() }));
          t = L(t);
        }
        const p = stack.pop();
        r.push(frame(`左邊走到 NULL，pop 出 <b>${esc(slots[p])}</b>：它的左子樹已經處理完了。`, 9, { out, cur: p, states: Object.assign({}, st, { [p]: "compare" }), strip: strip() }));
        out.push(slots[p]); st[p] = "found";
        r.push(frame(`輸出 <b>${esc(slots[p])}</b>，接著處理它的右子樹${R(p) === null ? "（是 NULL，下一輪直接 pop）" : `，從 ${esc(slots[R(p)])} 開始`}。`, [10, 11], { out, cur: p, states: Object.assign({}, st), strip: strip() }));
        t = R(p);
      }
      r.push(frame(`stack 空了、t 也是 NULL，結束。結果和遞迴版一樣：<b>${out.map(esc).join(" ")}</b>。stack 最多同時放的節點數 ≤ 樹高。`, null, { out, states: Object.assign({}, st), strip: strip() }));
      return r.frames;
    }

    // ---------- 層序（queue）----------
    function level() {
      player.setCode(CODE.level);
      const r = new Recorder(), st = {}, out = [], q = [];
      const strip = () => ({ name: "queue：", items: q.slice(), hi: 0, note: "左邊是 front（先出），右邊是 rear（後進）" });
      q.push(0); st[0] = "active";
      r.push(frame("層序走訪（Level-order）：一層一層、由左到右。先把根放進 queue。", 5, { out, states: Object.assign({}, st), strip: strip() }));
      while (q.length) {
        const p = q.shift();
        out.push(slots[p]); st[p] = "found";
        r.push(frame(`從 queue 前端取出 <b>${esc(slots[p])}</b> 並輸出。`, [7, 8], { out, cur: p, curName: "p", states: Object.assign({}, st), strip: strip() }));
        const kids = [L(p), R(p)].filter((x) => x !== null);
        kids.forEach((k) => { q.push(k); st[k] = "active"; });
        r.push(frame(kids.length ? `把它的子節點 <b>${kids.map((k) => esc(slots[k])).join("、")}</b> 依「先左後右」放到 queue 尾端，它們會在這一層的節點都輸出完後才輪到。` : `${esc(slots[p])} 沒有子節點，不用放。`, [9, 10], { out, cur: p, curName: "p", states: Object.assign({}, st), strip: strip() }));
      }
      r.push(frame(`queue 空了，完成：<b>${out.map(esc).join(" ")}</b>。層序用的是 queue（先進先出），三種深度優先走訪用的是 stack（遞迴）。`, null, { out, states: Object.assign({}, st), strip: strip() }));
      return r.frames;
    }

    // ---------- 控制列 ----------
    const input = ui.input(player, { placeholder: "層序，空的用 #", value: "A B C D E # F # # G # # # H I", width: 210 });
    const load = () => {
      const arr = parse(input.value);
      if (typeof arr === "string") {
        input.classList.add("is-error"); setTimeout(() => input.classList.remove("is-error"), 700);
        player.load([frame(`${iconHTML("alert")} ${arr}`, null)], { autoplay: false });
        return false;
      }
      slots = arr; return true;
    };
    ui.button(player, "建樹", () => load() && player.load([frame("依層序建好樹了：第 i 格的左子節點在 2i + 1、右子節點在 2i + 2，<code>#</code> 表示空。選一種走訪按播放。", null)], { autoplay: false }), "ghost");
    ui.button(player, "前序", () => load() && player.load(recursive("pre")));
    ui.button(player, "中序", () => load() && player.load(recursive("in")));
    ui.button(player, "後序", () => load() && player.load(recursive("post")));
    ui.button(player, "中序（stack 版）", () => load() && player.load(iterIn()), "ghost");
    ui.button(player, "層序", () => load() && player.load(level()));
    ui.button(player, "運算式樹", () => { input.value = "- + / a * d e # # b c"; load() && player.load([frame("這是 a + b * c − d / e 的運算式樹：葉節點是運算元、內部節點是運算子。試試前序、中序、後序，分別得到前序式、中序式（少了括號）、後序式。", null)], { autoplay: false }); }, "ghost");
    input.addEventListener("keydown", (e) => e.key === "Enter" && load() && player.load(recursive("in")));

    load();
    const demo = recursive("in");
    demo[0].caption = iconHTML("play") + " 按播放看<b>中序走訪</b>的示範。可以改用前序、後序、層序比較，或在輸入框用層序輸入自己的樹（空的位置用 <code>#</code>）。";
    player.load(demo, { autoplay: false });
  });

  // ===================================================================
  // 靜態圖解
  // ===================================================================
  const lv = ["A", "B", "C", "D", "E", null, "F", null, null, "G", null, null, null, "H", "I"];
  const fp = (i, W2, top, gap, span) => {
    const d = Math.floor(Math.log2(i + 1)), k = i - (2 ** d - 1);
    return { x: W2 - span / 2 + (k + 0.5) * span / 2 ** d, y: top + d * gap };
  };
  function exampleTree(cx, top, gap, span, stateOf, prefix = "") {
    const nodes = [], edges = [];
    lv.forEach((v, i) => {
      if (v === null) return;
      const p = fp(i, cx, top, gap, span);
      nodes.push({ id: prefix + i, label: v, x: p.x, y: p.y, r: 18, state: stateOf ? stateOf(i) : "default" });
      if (i > 0) edges.push({ from: prefix + Math.floor((i - 1) / 2), to: prefix + i });
    });
    return { nodes, edges };
  }

  // 圖 1：範例樹與四種走訪結果
  figure("traversal-example", () => {
    const { nodes, edges } = exampleTree(190, 40, 58, 370);
    const X = 400;
    return {
      width: 680, height: 260, nodes, edges,
      labels: [
        { id: "a", x: X, y: 60, text: "前序 V L R：A B D E G C F H I", anchor: "start" },
        { id: "b", x: X, y: 100, text: "中序 L V R：D B G E A C H F I", anchor: "start" },
        { id: "c", x: X, y: 140, text: "後序 L R V：D G E B H I F C A", anchor: "start" },
        { id: "d", x: X, y: 180, text: "層序（一層一層）：A B C D E F G H I", anchor: "start" },
        { id: "e", x: X, y: 224, text: "前序第一個、後序最後一個都是根 A", anchor: "start", cls: "strong" },
      ],
    };
  });

  // 圖 2：手算技巧——沿著外圍繞一圈，每個節點有三個記號
  figure("traversal-contour", () => {
    const { nodes, edges } = exampleTree(330, 50, 64, 620);
    const dots = [];
    nodes.slice().forEach((n) => {
      dots.push({ id: n.id + "L", x: n.x - 26, y: n.y, r: 5, state: "new" });
      dots.push({ id: n.id + "B", x: n.x, y: n.y + 26, r: 5, state: "found" });
      dots.push({ id: n.id + "R", x: n.x + 26, y: n.y, r: 5, state: "active" });
    });
    return {
      width: 660, height: 330, nodes: nodes.concat(dots), edges,
      labels: [
        { id: "l1", x: 30, y: 290, text: "紫色（左側）：第一次經過 → 前序　　綠色（下方）：第二次經過 → 中序", anchor: "start", cls: "strong" },
        { id: "l2", x: 30, y: 314, text: "橘色（右側）：最後一次經過 → 後序", anchor: "start", cls: "strong" },
      ],
    };
  });

  // 圖 3：運算式樹
  figure("traversal-expression", () => {
    const ex = ["-", "+", "/", "a", "*", "d", "e", null, null, "b", "c"];
    const nodes = [], edges = [];
    ex.forEach((v, i) => {
      if (v === null) return;
      const p = fp(i, 185, 40, 56, 360);
      nodes.push({ id: "x" + i, label: v, x: p.x, y: p.y, r: 18, state: /[a-z]/.test(v) ? "default" : "compare" });
      if (i > 0) edges.push({ from: "x" + Math.floor((i - 1) / 2), to: "x" + i });
    });
    const X = 390;
    return {
      width: 680, height: 240, nodes, edges,
      labels: [
        { id: "t", x: X, y: 50, text: "a + b * c − d / e", anchor: "start", cls: "strong" },
        { id: "p", x: X, y: 92, text: "前序 → 前序式：− + a * b c / d e", anchor: "start" },
        { id: "i", x: X, y: 126, text: "中序 → 中序式：a + b * c − d / e", anchor: "start" },
        { id: "q", x: X, y: 160, text: "後序 → 後序式：a b c * + d e / −", anchor: "start" },
        { id: "n", x: X, y: 202, text: "葉節點是運算元，內部節點是運算子", anchor: "start" },
      ],
    };
  });
})();
