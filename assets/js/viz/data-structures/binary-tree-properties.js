/* =====================================================================
   Binary Tree Properties & Representation（二元樹性質與表示法）主題的視覺化
   - bt-array : 輸入陣列表示法，逐格放到樹上（父 = i / 2），
                再數出 n0、n1、n2、高度，檢查是不是完全二元樹
   ===================================================================== */
(function () {
  "use strict";
  const { Player, Recorder, ui, register, iconHTML, figure, esc } = window.DSViz;

  // 右側程式碼（和 code/data-structures/binary-tree-properties.c 完全一致）
  const SRC = {
    "buildFromArray": [
      "treePointer buildFromArray(const char a[], int size, int i) {",
      "  if (i > size || a[i] == '-') return NULL;    /* 超出陣列或空位：空樹 */",
      "  treePointer t = newNode(a[i]);",
      "  t->left = buildFromArray(a, size, 2 * i);    /* 左子在 2i */",
      "  t->right = buildFromArray(a, size, 2 * i + 1); /* 右子在 2i + 1 */",
      "  return t;",
      "}"
    ],
    "countDegree": [
      "void countDegree(treePointer t, int cnt[3]) {  /* cnt[d]：分支度為 d 的節點數 */",
      "  if (t == NULL) return;",
      "  int d = (t->left != NULL) + (t->right != NULL);",
      "  cnt[d]++;",
      "  countDegree(t->left, cnt);",
      "  countDegree(t->right, cnt);",
      "}"
    ],
    "isComplete": [
      "int isComplete(treePointer t, int i, int n) {",
      "  if (t == NULL) return 1;",
      "  if (i > n) return 0;                         /* 編號超過 n 代表中間有空洞 */",
      "  return isComplete(t->left, 2 * i, n) && isComplete(t->right, 2 * i + 1, n);",
      "}"
    ]
  };
  const CODE = SRC.buildFromArray.concat([""], SRC.countDegree, [""], SRC.isComplete);
  const at = (text) => CODE.findIndex((l) => l.includes(text)) + 1;

  const W = 680, H = 400, MAXN = 15;
  const tpos = (i) => {
    const d = Math.floor(Math.log2(i)), k = i - 2 ** d, span = 620;
    return { x: W / 2 - span / 2 + (k + 0.5) * span / 2 ** d, y: 48 + d * 62 };
  };
  const AX = (i) => 52 + (i - 1) * 41, AY = 330;

  register("bt-array", function (root) {
    const player = new Player(root, {
      title: "Array Representation 陣列表示法",
      width: W, height: H, code: CODE,
      legend: [["active", "正在處理 / 編號超過 n"], ["compare", "父節點 / 分支度 2"], ["found", "葉子 / 完成"], ["new", "分支度 1"], ["removed", "空洞"]],
    });

    let a = [];      // a[1..size]，null 代表空位
    let size = 0;

    function frame(caption, line, opt = {}) {
      const st = opt.st || {}, upto = opt.upto == null ? size : opt.upto;
      const nodes = [], edges = [], labels = [], pointers = [];
      for (let i = 1; i <= size; i++) {
        const p = tpos(i), s = st[i];
        nodes.push({ id: "slot" + i, shape: "box", x: AX(i), y: AY, w: 38, h: 34, state: "ghost" });
        labels.push({ id: "ix" + i, x: AX(i), y: AY + 32, text: `[${i}]` });
        if (i <= upto && a[i] !== null) {
          nodes.push({ id: "t" + i, label: a[i], x: p.x, y: p.y, r: 19, state: s || "default" });
          nodes.push({ id: "a" + i, label: a[i], shape: "box", x: AX(i), y: AY, w: 36, h: 32, state: s || "default" });
          if (i > 1) edges.push({ from: "t" + Math.floor(i / 2), to: "t" + i, state: s === "active" ? "compare" : "default" });
        } else if (i <= upto || s === "removed") {
          nodes.push({ id: "h" + i, label: "", x: p.x, y: p.y, r: 15, state: s === "removed" ? "removed" : "ghost" });
          nodes.push({ id: "e" + i, label: "-", shape: "box", x: AX(i), y: AY, w: 36, h: 32, state: s === "removed" ? "removed" : "muted" });
        }
      }
      labels.push({ id: "arr", x: 32, y: AY + 56, text: `陣列 a[1..${size}]（'-' 是空位）　父 = i / 2，左子 = 2i，右子 = 2i + 1`, anchor: "start" });
      if (opt.i) pointers.push({ id: "pi", label: "i", target: a[opt.i] !== null && opt.i <= upto ? "a" + opt.i : "slot" + opt.i, dir: "up", state: "active" });
      (opt.notes || []).forEach((t, k) => labels.push({ id: "note" + k, x: W - 14, y: 22 + k * 22, text: t, anchor: "end", cls: "strong" }));
      return { nodes, edges, pointers, labels, caption, line };
    }

    function run() {
      const r = new Recorder();
      r.push(frame(`陣列表示法：把二元樹想成一棵完滿二元樹，節點依「由上到下、由左到右」編號 1、2、3……，編號 i 的節點放在 a[i]。現在從 a[1] 開始，一格一格放回樹上。`, at("treePointer buildFromArray"), { upto: 0 }));
      for (let i = 1; i <= size; i++) {
        if (a[i] === null) {
          r.push(frame(`a[${i}] 是 '-'：編號 ${i} 的位置沒有節點，但這一格還是要留著，後面的編號才不會錯位。`, at("if (i > size || a[i] == '-') return NULL;"), { upto: i, i }));
          continue;
        }
        if (i === 1) {
          r.push(frame(`a[1] = ${esc(a[1])} 是根。它的左子在 a[2]、右子在 a[3]。`, at("treePointer t = newNode(a[i]);"), { upto: 1, i, st: { 1: "active" } }));
          continue;
        }
        const p = Math.floor(i / 2), side = i % 2 === 0 ? "左" : "右";
        r.push(frame(`a[${i}] = ${esc(a[i])}：父節點在 a[${i} / 2] = a[${p}] = ${esc(a[p])}；${i} 是${i % 2 === 0 ? "偶數" : "奇數"}，所以是${side}子（${i % 2 === 0 ? `2 × ${p} = ${i}` : `2 × ${p} + 1 = ${i}`}）。`, at(i % 2 === 0 ? "t->left = buildFromArray" : "t->right = buildFromArray"), { upto: i, i, st: { [i]: "active", [p]: "compare" } }));
      }
      // 數分支度
      const deg = {}, cnt = [0, 0, 0];
      let n = 0, h = 0;
      for (let i = 1; i <= size; i++) {
        if (a[i] === null) continue;
        n++; h = Math.max(h, Math.floor(Math.log2(i)) + 1);
        const d = (2 * i <= size && a[2 * i] !== null) + (2 * i + 1 <= size && a[2 * i + 1] !== null);
        deg[i] = ["found", "new", "compare"][d]; cnt[d]++;
      }
      r.push(frame(`數每個節點的分支度（有幾個子節點）：綠色葉子 n0 = ${cnt[0]}、紫色 n1 = ${cnt[1]}、藍色 n2 = ${cnt[2]}。n0 = n2 + 1 → ${cnt[0]} = ${cnt[2]} + 1，${cnt[0] === cnt[2] + 1 ? "成立" : "不成立（不應該發生）"}。`, [at("int d = (t->left != NULL)"), at("cnt[d]++;")], { st: deg, notes: [`n = ${n}，n0 = ${cnt[0]}，n1 = ${cnt[1]}，n2 = ${cnt[2]}`] }));
      const notes = [`n = ${n}，n0 = ${cnt[0]}，n1 = ${cnt[1]}，n2 = ${cnt[2]}`, `高度 = ${h}，最多可放 2^${h} − 1 = ${2 ** h - 1} 個節點`];
      r.push(frame(`最深的節點在第 ${h} 層，高度是 ${h}。高度 ${h} 的二元樹最多 ${2 ** h - 1} 個節點，這棵有 ${n} 個。陣列用了 ${size} 格，其中 ${size - n} 格是空位。`, null, { st: deg, notes }));
      // 完全二元樹：1..n 都要有節點
      let hole = 0;
      for (let i = 1; i <= n; i++) if (a[i] === null) { hole = i; break; }
      const fin = {};
      for (let i = 1; i <= size; i++) if (a[i] !== null) fin[i] = i <= n ? "found" : "active";
      if (!hole) {
        r.push(frame(`判斷完全二元樹：n = ${n}，編號 1～${n} 全部都有節點、沒有空洞，所以<b>是完全二元樹</b>，陣列沒有浪費任何一格。`, at("if (i > n) return 0;"), { st: fin, notes: notes.concat(["是完全二元樹"]) }));
      } else {
        fin[hole] = "removed";
        r.push(frame(`判斷完全二元樹：n = ${n}，但編號 ${hole} 是空洞（紅色），代表有節點的編號超過了 ${n}，編號超過 ${n} 的節點（橘色）就是被擠出去的，所以<b>不是完全二元樹</b>。完全二元樹的節點編號一定剛好是 1～n。`, at("if (i > n) return 0;"), { st: fin, i: hole, notes: notes.concat(["不是完全二元樹"]) }));
      }
      return r.frames;
    }

    function parse(text) {
      const s = text.replace(/\s+/g, "");
      if (!s.length) return "請輸入層序的陣列，例如 ABCDE-F（'-' 代表空位）。";
      if (s.length > MAXN) return `最多 ${MAXN} 格（4 層），畫面才放得下。`;
      if (!/^[A-Za-z0-9-]+$/.test(s)) return "每一格只能是一個英文字母、數字，或 '-'。";
      const arr = [null].concat(s.split("").map((c) => (c === "-" ? null : c)));
      if (arr[1] === null) return "a[1] 是根，不能是空位。";
      for (let i = 2; i < arr.length; i++)
        if (arr[i] !== null && arr[Math.floor(i / 2)] === null) return `a[${i}] 有節點，但它的父節點 a[${Math.floor(i / 2)}] 是空位，這不是一棵樹。`;
      return arr;
    }

    function load(text, autoplay = true) {
      const v = parse(text);
      if (typeof v === "string") {
        input.classList.add("is-error"); setTimeout(() => input.classList.remove("is-error"), 700);
        player.load([{ nodes: [], edges: [], pointers: [], labels: [], caption: `${iconHTML("alert")} ${esc(v)}`, line: null }], { autoplay: false });
        return null;
      }
      a = v; size = a.length - 1;
      const fr = run();
      player.load(fr, { autoplay });
      return fr;
    }

    const input = ui.input(player, { placeholder: "例如 ABCDE-F", value: "ABCDE-F--GH", width: 170 });
    ui.button(player, "放到樹上", () => load(input.value));
    [["完全", "ABCDEF"], ["完滿", "ABCDEFG"], ["有空洞", "ABCD-FG"], ["右歪斜", "A-B---C"]].forEach(([name, s]) =>
      ui.button(player, name, () => { input.value = s; load(s); }, "ghost"));
    input.addEventListener("keydown", (e) => e.key === "Enter" && load(input.value));

    const demo = load(input.value, false);
    demo[0].caption = iconHTML("play") + " 按播放：陣列 ABCDE-F--GH 會一格一格放回樹上，接著數出 n0、n1、n2 和高度，最後檢查是不是完全二元樹。也可以自己輸入，或按右邊的範例。";
    player.load(demo, { autoplay: false });
  });

  // ===================================================================
  // 靜態圖解
  // ===================================================================
  const nd = (id, v, x, y, st) => ({ id, label: v, x, y, r: 17, state: st || "default" });
  // 依編號 i 放節點；vals 是陣列表示法（null 為空）
  function tree(vals, cx, top, gap, span, pfx, stOf) {
    const nodes = [], edges = [];
    vals.forEach((v, k) => {
      const i = k + 1;
      if (v === null) return;
      const d = Math.floor(Math.log2(i)), j = i - 2 ** d;
      nodes.push(nd(pfx + i, v, cx - span / 2 + (j + 0.5) * span / 2 ** d, top + d * gap, stOf ? stOf(i) : "default"));
      if (i > 1) edges.push({ from: pfx + Math.floor(i / 2), to: pfx + i });
    });
    return { nodes, edges };
  }

  // 圖 1：術語
  figure("btp-terms", () => {
    const vals = ["A", "B", "C", "D", "E", null, "F", null, null, "G", "H"];
    const leaf = { 4: 1, 7: 1, 10: 1, 11: 1 };
    const T = tree(vals, 300, 40, 58, 440, "n", (i) => (i === 1 ? "active" : leaf[i] ? "found" : i === 3 ? "new" : "default"));
    const labels = [1, 2, 3, 4].map((lv) => ({ id: "lv" + lv, x: 40, y: 40 + (lv - 1) * 58, text: `第 ${lv} 層`, anchor: "start" }));
    labels.push(
      { id: "r", x: 360, y: 40, text: "← 根 root", anchor: "start" },
      { id: "c", x: 530, y: 98, text: "C 只有右子：分支度 1", anchor: "middle" },
      { id: "l", x: 560, y: 214, text: "綠色：葉子（分支度 0）", anchor: "end" },
      { id: "h", x: 600, y: 156, text: "高度 = 4", anchor: "end", cls: "strong" },
    );
    return { width: 640, height: 240, nodes: T.nodes, edges: T.edges, labels };
  });

  // 圖 2：特殊的二元樹
  figure("btp-special", () => {
    const parts = [
      { vals: ["A", null, "B", null, null, null, "C"], cx: 90, span: 140, title: "(a) 右歪斜" },
      { vals: ["A", "B", "C", "D", "E", "F", "G"], cx: 270, span: 172, title: "(b) 完滿" },
      { vals: ["A", "B", "C", "D", "E", "F"], cx: 450, span: 172, title: "(c) 完全" },
      { vals: ["A", "B", "C", "D", null, "F"], cx: 630, span: 172, title: "(d) 不是完全", bad: 5 },
    ];
    let nodes = [], edges = [];
    const labels = [];
    parts.forEach((p, k) => {
      const T = tree(p.vals, p.cx, 52, 56, p.span, "p" + k + "-");
      nodes = nodes.concat(T.nodes); edges = edges.concat(T.edges);
      labels.push({ id: "t" + k, x: p.cx, y: 18, text: p.title, anchor: "middle", cls: p.bad ? "warn" : "strong" });
      if (p.bad) {
        nodes.push({ id: "hole", label: "", x: p.cx - p.span / 2 + 1.5 * p.span / 4, y: 164, r: 14, state: "removed" });
        labels.push({ id: "hl", x: p.cx, y: 200, text: "[5] 空著卻用了 [6]", anchor: "middle" });
      }
    });
    labels.push({ id: "n2", x: 270, y: 200, text: "2^3 − 1 = 7 個", anchor: "middle" });
    labels.push({ id: "n3", x: 450, y: 200, text: "編號 1～6 都有", anchor: "middle" });
    labels.push({ id: "n1", x: 90, y: 200, text: "3 個節點、高度 3", anchor: "middle" });
    return { width: 720, height: 220, nodes, edges, labels };
  });

  // 圖 3：3 個節點的 5 種二元樹
  figure("btp-shapes-3", () => {
    const shapes = [
      ["A", "B", null, "C"], ["A", "B", null, null, "C"], ["A", "B", "C"],
      ["A", null, "B", null, null, "C"], ["A", null, "B", null, null, null, "C"],
    ];
    let nodes = [], edges = [];
    shapes.forEach((s, k) => {
      const T = tree(s, 70 + k * 125, 40, 52, 110, "s" + k + "-");
      nodes = nodes.concat(T.nodes); edges = edges.concat(T.edges);
    });
    return {
      width: 640, height: 200, nodes, edges,
      labels: [{ id: "c", x: 320, y: 186, text: "C(3) = 6! / (3! · 4!) = 5 種形狀", anchor: "middle", cls: "strong" }],
    };
  });

  // 圖 4：歪斜樹的陣列浪費
  figure("btp-array-waste", () => {
    const vals = ["A", null, "B", null, null, null, "C"];
    const T = tree(vals, 150, 40, 58, 200, "w");
    const nodes = T.nodes.slice(), labels = [];
    vals.forEach((v, k) => {
      nodes.push({ id: "x" + k, label: v === null ? "-" : v, shape: "box", x: 330 + k * 42, y: 100, w: 36, h: 32, state: v === null ? "muted" : "default" });
      labels.push({ id: "i" + k, x: 330 + k * 42, y: 132, text: `[${k + 1}]` });
    });
    labels.push(
      { id: "t1", x: 456, y: 60, text: "a[1..7]", anchor: "middle", cls: "strong" },
      { id: "t2", x: 456, y: 168, text: "3 個節點用掉 7 格，4 格是空的", anchor: "middle" },
      { id: "t3", x: 456, y: 192, text: "高度 k 的歪斜樹：k 個節點要 2^k − 1 格", anchor: "middle", cls: "warn" },
    );
    return { width: 640, height: 215, nodes, edges: T.edges, labels };
  });
})();
