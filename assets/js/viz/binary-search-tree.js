/* =====================================================================
   Binary Search Tree（二元搜尋樹）主題的視覺化
   - bst : insert / search / delete（三種情況）/ inorder 走訪
   ===================================================================== */
(function () {
  "use strict";
  const { Player, Recorder, ui, register } = window.DSViz;

  const CODE = {
    insert: [
      "Node* insert(Node* root, int x) {",
      "  if (root == NULL) return newNode(x);",
      "  if (x < root->key)",
      "    root->left = insert(root->left, x);",
      "  else if (x > root->key)",
      "    root->right = insert(root->right, x);",
      "  /* x == root->key：已存在，不插入 */",
      "  return root;",
      "}",
    ],
    search: [
      "Node* search(Node* root, int x) {",
      "  while (root != NULL && root->key != x) {",
      "    if (x < root->key) root = root->left;",
      "    else               root = root->right;",
      "  }",
      "  return root;   /* NULL 表示找不到 */",
      "}",
    ],
    delete: [
      "Node* delete(Node* root, int x) {",
      "  if (root == NULL) return NULL;   /* 找不到 */",
      "  if (x < root->key) root->left = delete(root->left, x);",
      "  else if (x > root->key) root->right = delete(root->right, x);",
      "  else {                           /* 找到了 */",
      "    if (root->left == NULL)  return root->right; /* 0 或 1 個子 */",
      "    if (root->right == NULL) return root->left;  /* 1 個子 */",
      "    Node* s = root->right;         /* 2 個子 */",
      "    while (s->left) s = s->left;   /* 中序後繼 */",
      "    root->key = s->key;",
      "    root->right = delete(root->right, s->key);",
      "  }",
      "  return root;",
      "}",
    ],
    inorder: [
      "void inorder(Node* t) {",
      "  if (t == NULL) return;",
      "  inorder(t->left);",
      "  visit(t);          /* 輸出 t->key */",
      "  inorder(t->right);",
      "}",
    ],
  };

  register("bst", function (root) {
    const W = 680, MAX_DEPTH = 5;
    const player = new Player(root, {
      title: "Binary Search Tree（二元搜尋樹）",
      width: W, height: 400, code: CODE.insert,
      legend: [["compare", "比較中"], ["found", "找到 / 已輸出"], ["new", "新節點"], ["removed", "被刪除"], ["active", "中序後繼"]],
    });

    // ---------- 模型 ----------
    let T = {};       // id -> {id, v, l, r}
    let rootId = null;
    let uid = 0;

    function insertRaw(v) {
      const id = "k" + uid++;
      T[id] = { id, v, l: null, r: null };
      if (rootId === null) { rootId = id; return; }
      let c = T[rootId];
      for (;;) {
        if (v < c.v) { if (c.l === null) { c.l = id; return; } c = T[c.l]; }
        else { if (c.r === null) { c.r = id; return; } c = T[c.r]; }
      }
    }
    function depthOf(v) { // 插入 v 後的深度（0 = root）
      let d = 0, c = rootId === null ? null : T[rootId];
      while (c) { if (v === c.v) return -1; c = v < c.v ? (c.l && T[c.l]) : (c.r && T[c.r]); d++; }
      return d;
    }
    function reset(values) { T = {}; rootId = null; values.forEach(insertRaw); }

    // ---------- 繪製 ----------
    function layout() {
      const pos = {}, order = [];
      (function walk(id, d) {
        if (id === null) return;
        walk(T[id].l, d + 1); order.push([id, d]); walk(T[id].r, d + 1);
      })(rootId, 0);
      const n = order.length, step = Math.min(58, (W - 60) / Math.max(n, 1));
      order.forEach(([id, d], i) => (pos[id] = { x: W / 2 + (i - (n - 1) / 2) * step, y: 46 + d * 62 }));
      return pos;
    }

    function frame(caption, line, opt = {}) {
      const pos = layout();
      const st = opt.states || {}, est = opt.edgeStates || {};
      const nodes = Object.values(T).map((n) => ({ id: n.id, label: n.v, x: pos[n.id].x, y: pos[n.id].y, state: st[n.id] || "default" }));
      (opt.extra || []).forEach((e) => nodes.push(e));
      const edges = [];
      Object.values(T).forEach((n) => ["l", "r"].forEach((k) => n[k] && edges.push({ from: n.id, to: n[k], state: est[n[k]] || "default" })));
      (opt.extraEdges || []).forEach((e) => edges.push(e));
      const pointers = (opt.pointers || []).map((p) => Object.assign({ dir: "up" }, p));
      if (rootId !== null && !pointers.some((p) => p.target === rootId)) pointers.push({ id: "root", label: "root", target: rootId, dir: "left", state: "default" });
      const labels = [];
      if (rootId === null && !(opt.extra || []).length) labels.push({ id: "empty", x: W / 2, y: 160, text: "（空樹 root = NULL）" });
      if (opt.output) labels.push({ id: "out", x: 24, y: 384, text: "輸出：" + opt.output.join("  "), cls: "strong", anchor: "start" });
      return { nodes, edges, pointers, labels, caption, line };
    }

    // ---------- 操作 ----------
    function doInsert(v) {
      player.setCode(CODE.insert);
      const r = new Recorder();
      const d = depthOf(v);
      if (d === -1) {
        return walk(v, r, "insert", () => r.push(frame(`<b>${v}</b> 已經在樹中，BST 不允許重複的 key，不插入。`, 7, { states: { [findId(v)]: "found" } })));
      }
      if (d > MAX_DEPTH) {
        r.push(frame(`插入 ${v} 會讓樹高超過 ${MAX_DEPTH + 1} 層，畫面放不下。可以先清空或刪掉一些節點（這也提醒我們：BST 不保證平衡）。`, null));
        return r.frames;
      }
      return walk(v, r, "insert", (parent) => {
        insertRaw(v);
        const id = "k" + (uid - 1);
        const where = parent ? `成為 <b>${T[parent].v}</b> 的${v < T[parent].v ? "左" : "右"}子節點` : "成為 root";
        r.push(frame(`走到 NULL，在這裡建立新節點 <b>${v}</b>，${where}。`, 2, { states: { [id]: "new" }, edgeStates: { [id]: "found" } }));
        r.push(frame(`insert(${v}) 完成。比較次數 = 新節點的深度 = ${d}，最差情況是 O(h)。`, 8));
      });
    }

    function findId(v) {
      let c = rootId === null ? null : T[rootId];
      while (c && c.v !== v) c = v < c.v ? (c.l && T[c.l]) : (c.r && T[c.r]);
      return c ? c.id : null;
    }

    // 共用：從 root 往下比較，走到 v 或 NULL。onEnd(parentId 或 foundId)
    function walk(v, r, mode, onEnd) {
      const lines = {
        insert: { start: 1, null: 2, lt: [3, 4], gt: [5, 6], eq: 7 },
        search: { start: 2, null: 6, lt: 3, gt: 4, eq: 6 },
        delete: { start: 1, null: 2, lt: 3, gt: 4, eq: 5 },
      }[mode];
      const path = {};
      let c = rootId === null ? null : T[rootId], parent = null;
      r.push(frame(`${mode}(${v})：從 <b>root</b> 開始往下比較。`, lines.start, { pointers: c ? [{ id: "cur", label: "cur", target: c.id, state: "compare" }] : [] }));
      while (c) {
        const st = Object.assign({}, path, { [c.id]: "compare" });
        if (v === c.v) {
          r.push(frame(`${v} = ${c.v}，找到了！`, lines.eq, { states: Object.assign({}, path, { [c.id]: "found" }), edgeStates: path, pointers: [{ id: "cur", label: "cur", target: c.id, state: "found" }] }));
          onEnd(c.id, path, true);
          return r.frames;
        }
        const go = v < c.v ? "l" : "r";
        r.push(frame(`${v} ${v < c.v ? "<" : ">"} ${c.v}，往<b>${go === "l" ? "左" : "右"}</b>子樹走。`, v < c.v ? lines.lt : lines.gt, { states: st, edgeStates: path, pointers: [{ id: "cur", label: "cur", target: c.id, state: "compare" }] }));
        path[c.id] = "visited";
        parent = c.id;
        c = c[go] ? T[c[go]] : null;
      }
      if (mode !== "insert") {
        r.push(frame(`走到 NULL，樹中沒有 <b>${v}</b>。`, lines.null, { states: path, edgeStates: path }));
        onEnd(null, path, false);
      } else onEnd(parent, path, false);
      return r.frames;
    }

    function doSearch(v) {
      player.setCode(CODE.search);
      const r = new Recorder();
      return walk(v, r, "search", (id, path, ok) => {
        if (ok) r.push(frame(`search(${v}) 回傳這個節點。每往下一層就排除一整棵子樹，平衡時是 O(log n)。`, 6, { states: { [id]: "found" } }));
      });
    }

    function parentOf(id) {
      for (const n of Object.values(T)) if (n.l === id || n.r === id) return n;
      return null;
    }
    function replaceChild(par, oldId, newId) {
      if (!par) rootId = newId;
      else if (par.l === oldId) par.l = newId;
      else par.r = newId;
    }

    function doDelete(v) {
      player.setCode(CODE.delete);
      const r = new Recorder();
      return walk(v, r, "delete", (id, path, ok) => {
        if (!ok) return;
        const node = T[id], par = parentOf(id);
        const kids = (node.l ? 1 : 0) + (node.r ? 1 : 0);

        if (kids === 0) {
          r.push(frame(`<b>Case 1</b>：${v} 是葉節點（leaf），沒有子節點，直接移除。`, 6, { states: { [id]: "removed" }, edgeStates: { [id]: "removed" } }));
          replaceChild(par, id, null); delete T[id];
          r.push(frame(`刪除 ${v} 完成。`, 13));
        } else if (kids === 1) {
          const child = node.l || node.r;
          r.push(frame(`<b>Case 2</b>：${v} 只有一個子節點 <b>${T[child].v}</b>，讓子節點直接接到 ${par ? T[par.id].v : "root"} 的位置。`, node.l ? 7 : 6, { states: { [id]: "removed", [child]: "active" }, edgeStates: { [id]: "removed" } }));
          replaceChild(par, id, child); delete T[id];
          r.push(frame(`子樹整個往上提一層，BST 性質不變。刪除 ${v} 完成。`, 13, { states: { [child]: "found" } }));
        } else {
          r.push(frame(`<b>Case 3</b>：${v} 有兩個子節點，不能直接拿掉。要找<b>中序後繼（inorder successor）</b>：右子樹中最小的節點。`, 8, { states: { [id]: "compare" } }));
          let s = T[node.r]; const trail = { [s.id]: "active" };
          r.push(frame(`先往右走一步到 <b>${s.v}</b>。`, 8, { states: Object.assign({ [id]: "compare" }, trail), pointers: [{ id: "s", label: "s", target: s.id, state: "active", dir: "down" }] }));
          while (s.l) {
            trail[s.id] = "visited"; s = T[s.l]; trail[s.id] = "active";
            r.push(frame(`還有左子節點，繼續往左走到 <b>${s.v}</b>。`, 9, { states: Object.assign({ [id]: "compare" }, trail), pointers: [{ id: "s", label: "s", target: s.id, state: "active", dir: "down" }] }));
          }
          r.push(frame(`<b>${s.v}</b> 沒有左子節點，它就是中序後繼，也就是比 ${v} 大的數中最小的那個。`, 9, { states: { [id]: "compare", [s.id]: "active" }, pointers: [{ id: "s", label: "s", target: s.id, state: "active", dir: "down" }] }));
          const sv = s.v;
          node.v = sv;
          r.push(frame(`把後繼的值 <b>${sv}</b> 複製到原本 ${v} 的位置。現在樹裡暫時有兩個 ${sv}。`, 10, { states: { [id]: "found", [s.id]: "removed" }, pointers: [{ id: "s", label: "s", target: s.id, state: "removed", dir: "down" }] }));
          const sp = parentOf(s.id);
          r.push(frame(`再到右子樹刪掉原本的 ${sv}。它最多只有右子節點，所以一定是 Case 1 或 Case 2。`, 11, { states: { [id]: "found", [s.id]: "removed" }, edgeStates: { [s.id]: "removed" } }));
          replaceChild(sp, s.id, s.r); delete T[s.id];
          r.push(frame(`刪除 ${v} 完成，${sv} 取代了它的位置，中序走訪仍然是遞增的。`, 13, { states: { [id]: "found" } }));
        }
      });
    }

    function doInorder() {
      player.setCode(CODE.inorder);
      const r = new Recorder();
      const out = [], done = {};
      r.push(frame("中序走訪（Inorder）：左子樹 → 自己 → 右子樹。BST 的中序結果一定是<b>遞增排序</b>的。", 1, { output: [] }));
      (function go(id) {
        if (id === null) return;
        const n = T[id];
        r.push(frame(`進入 <b>${n.v}</b>，先走訪它的左子樹。`, 3, { states: Object.assign({}, done, { [id]: "compare" }), output: out, pointers: [{ id: "t", label: "t", target: id, state: "compare" }] }));
        go(n.l);
        out.push(n.v); done[id] = "found";
        r.push(frame(`左子樹走完，輸出 <b>${n.v}</b>。`, 4, { states: done, output: out, pointers: [{ id: "t", label: "t", target: id, state: "found" }] }));
        go(n.r);
      })(rootId);
      r.push(frame(`走訪完成：${out.join(" < ")}。確實是遞增的！`, null, { states: done, output: out }));
      return r.frames;
    }

    // ---------- 控制列 ----------
    const input = ui.input(player, { placeholder: "key", value: "45", width: 64 });
    const val = () => ui.int(input, { min: 0, max: 999 });
    ui.button(player, "insert", () => { const v = val(); if (v !== null) player.load(doInsert(v)); });
    ui.button(player, "search", () => { const v = val(); if (v !== null) player.load(doSearch(v)); });
    ui.button(player, "delete", () => { const v = val(); if (v !== null) player.load(doDelete(v)); });
    ui.button(player, "中序走訪", () => player.load(doInorder()), "ghost");
    ui.button(player, "隨機建樹", () => {
      const vals = new Set();
      while (vals.size < 9) vals.add(Math.floor(Math.random() * 90) + 10);
      reset([]);
      [...vals].forEach((v) => depthOf(v) <= MAX_DEPTH && insertRaw(v));
      player.setCode(CODE.insert);
      player.load([frame(`依序插入 ${[...vals].join(", ")} 建出新的樹。插入順序不同，樹的形狀就不同。`, null)], { autoplay: false });
    }, "ghost");
    ui.button(player, "清空", () => { reset([]); player.load([frame("樹已清空。", null)], { autoplay: false }); }, "ghost");
    input.addEventListener("keydown", (e) => e.key === "Enter" && player.toolbar.querySelector(".vop").click());

    reset([50, 30, 70, 20, 40, 60, 80, 35, 65]);
    // 初始載入一段 search(35) 示範（不改變樹），讓 ▶ 一按就能播放
    const demo = doSearch(35);
    demo[0].caption = "▶ 按播放看 <b>search(35)</b> 的示範。之後輸入 key 試試 <b>insert</b>、<b>search</b>、<b>delete</b>，建議刪除 30（兩個子節點）、20（葉節點）、60（一個子節點）比較三種情況。";
    player.load(demo, { autoplay: false });
  });
})();
