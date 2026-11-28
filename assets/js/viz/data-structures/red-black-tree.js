/* =====================================================================
   Red-Black Tree（紅黑樹）主題的視覺化
   - rbt : insert（case 1 變色 / case 2、3 旋轉）、delete（double black 四種 case）
   顏色表示法：黑色節點畫成「方形」、紅色節點畫成「圓形」（和考卷常見的畫法一樣），
   state 顏色只用來表示「目前在處理哪個節點」，不代表紅黑。
   ===================================================================== */
(function () {
  "use strict";
  const { Player, Recorder, ui, register, esc, iconHTML, figure } = window.DSViz;

  // CODE 由 .work/gen_code.py 從 code/data-structures/red-black-tree.c 抽出，不要手改
  // ==CODE-BEGIN==
  const CODE = {
    insert: [
      "int rbInsert(int key) {",
      "  Node *p = NULL, *x = root;",
      "  while (x != NULL) {",
      "    p = x;",
      "    if (key == x->key) return 0;          /* 已存在，不插入 */",
      "    x = key < x->key ? x->left : x->right;",
      "  }",
      "  Node *z = malloc(sizeof(Node));",
      "  z->key = key;",
      "  z->left = z->right = NULL;",
      "  z->parent = p;",
      "  z->color = RED;                         /* 新節點一律塗紅 */",
      "  if (p == NULL) root = z;",
      "  else if (key < p->key) p->left = z;",
      "  else p->right = z;",
      "  insertFixup(z);",
      "  return 1;",
      "}",
      "",
      "void insertFixup(Node *z) {",
      "  while (colorOf(z->parent) == RED) {     /* 父紅 → 祖父一定存在且是黑 */",
      "    Node *p = z->parent, *g = p->parent;",
      "    if (p == g->left) {",
      "      Node *u = g->right;                 /* 叔叔 */",
      "      if (colorOf(u) == RED) {            /* case 1：叔叔紅 → 變色，問題上移 */",
      "        p->color = BLACK;",
      "        u->color = BLACK;",
      "        g->color = RED;",
      "        z = g;",
      "      } else {",
      "        if (z == p->right) {              /* case 2：LR 型，先左旋父變 LL */",
      "          z = p;",
      "          leftRotate(z);",
      "          p = z->parent;",
      "        }",
      "        p->color = BLACK;                 /* case 3：LL 型，父祖換色再右旋 */",
      "        g->color = RED;",
      "        rightRotate(g);",
      "      }",
      "    } else {                              /* 鏡像：父是祖父的右子 */",
      "      Node *u = g->left;",
      "      if (colorOf(u) == RED) {            /* case 1（鏡像）：叔叔紅 → 變色 */",
      "        p->color = BLACK;",
      "        u->color = BLACK;",
      "        g->color = RED;",
      "        z = g;",
      "      } else {",
      "        if (z == p->left) {               /* case 2（鏡像）：RL 型，先右旋父 */",
      "          z = p;",
      "          rightRotate(z);",
      "          p = z->parent;",
      "        }",
      "        p->color = BLACK;                 /* case 3（鏡像）：RR 型，再左旋祖父 */",
      "        g->color = RED;",
      "        leftRotate(g);",
      "      }",
      "    }",
      "  }",
      "  root->color = BLACK;                    /* 根一定塗黑 */",
      "}",
    ],
    deletePred: [
      "int rbDelete(int key) {",
      "  Node *z = search(key);",
      "  if (z == NULL) return 0;                /* 找不到 */",
      "  if (z->left != NULL && z->right != NULL) {",
      "    Node *s = z->left;                    /* 左子樹最大 */",
      "    while (s->right != NULL) s = s->right;",
      "    z->key = s->key;                      /* 複製前驅的值 */",
      "    z = s;                                /* 改成刪除前驅，它沒有右子 */",
      "  }",
      "  removeOne(z);",
      "  return 1;",
      "}",
      "",
      "void removeOne(Node *z) {",
      "  Node *child = z->left != NULL ? z->left : z->right;",
      "  if (child != NULL) {                    /* z 黑、child 紅：child 頂上並塗黑 */",
      "    child->color = BLACK;",
      "    replaceNode(z, child);",
      "  } else {",
      "    if (z->color == BLACK) deleteFixup(z); /* 黑色葉子：先修 double black */",
      "    replaceNode(z, NULL);                 /* 紅色葉子：直接拿掉 */",
      "  }",
      "  free(z);",
      "}",
      "",
      "void deleteFixup(Node *x) {",
      "  while (x != root && x->color == BLACK) {",
      "    Node *p = x->parent;",
      "    if (x == p->left) {",
      "      Node *s = p->right;                 /* 兄弟 */",
      "      if (colorOf(s) == RED) {            /* case 1：兄弟紅 → 旋轉成兄弟黑 */",
      "        s->color = BLACK;",
      "        p->color = RED;",
      "        leftRotate(p);",
      "        s = p->right;",
      "      }",
      "      if (colorOf(s->left) == BLACK && colorOf(s->right) == BLACK) {",
      "        s->color = RED;                   /* case 2：兄弟黑、兩姪黑 → 兄弟變紅，上移 */",
      "        x = p;",
      "      } else {",
      "        if (colorOf(s->right) == BLACK) { /* case 3：遠姪黑、近姪紅 → 先右旋兄弟 */",
      "          s->left->color = BLACK;",
      "          s->color = RED;",
      "          rightRotate(s);",
      "          s = p->right;",
      "        }",
      "        s->color = p->color;              /* case 4：遠姪紅 → 左旋父，結束 */",
      "        p->color = BLACK;",
      "        s->right->color = BLACK;",
      "        leftRotate(p);",
      "        x = root;",
      "      }",
      "    } else {                              /* 鏡像：x 是右子 */",
      "      Node *s = p->left;",
      "      if (colorOf(s) == RED) {            /* case 1（鏡像）：兄弟紅 */",
      "        s->color = BLACK;",
      "        p->color = RED;",
      "        rightRotate(p);",
      "        s = p->left;",
      "      }",
      "      if (colorOf(s->left) == BLACK && colorOf(s->right) == BLACK) {",
      "        s->color = RED;                   /* case 2（鏡像）：兩姪黑 */",
      "        x = p;",
      "      } else {",
      "        if (colorOf(s->left) == BLACK) {  /* case 3（鏡像）：遠姪黑、近姪紅 */",
      "          s->right->color = BLACK;",
      "          s->color = RED;",
      "          leftRotate(s);",
      "          s = p->left;",
      "        }",
      "        s->color = p->color;              /* case 4（鏡像）：遠姪紅 → 右旋父 */",
      "        p->color = BLACK;",
      "        s->left->color = BLACK;",
      "        rightRotate(p);",
      "        x = root;",
      "      }",
      "    }",
      "  }",
      "  x->color = BLACK;                       /* 紅色節點吸收多出來的黑 */",
      "}",
    ],
    deleteSucc: [
      "int rbDeleteSucc(int key) {",
      "  Node *z = search(key);",
      "  if (z == NULL) return 0;",
      "  if (z->left != NULL && z->right != NULL) {",
      "    Node *s = z->right;                   /* 右子樹最小 */",
      "    while (s->left != NULL) s = s->left;",
      "    z->key = s->key;                      /* 複製後繼的值 */",
      "    z = s;                                /* 改成刪除後繼，它沒有左子 */",
      "  }",
      "  removeOne(z);",
      "  return 1;",
      "}",
      "",
      "void removeOne(Node *z) {",
      "  Node *child = z->left != NULL ? z->left : z->right;",
      "  if (child != NULL) {                    /* z 黑、child 紅：child 頂上並塗黑 */",
      "    child->color = BLACK;",
      "    replaceNode(z, child);",
      "  } else {",
      "    if (z->color == BLACK) deleteFixup(z); /* 黑色葉子：先修 double black */",
      "    replaceNode(z, NULL);                 /* 紅色葉子：直接拿掉 */",
      "  }",
      "  free(z);",
      "}",
      "",
      "void deleteFixup(Node *x) {",
      "  while (x != root && x->color == BLACK) {",
      "    Node *p = x->parent;",
      "    if (x == p->left) {",
      "      Node *s = p->right;                 /* 兄弟 */",
      "      if (colorOf(s) == RED) {            /* case 1：兄弟紅 → 旋轉成兄弟黑 */",
      "        s->color = BLACK;",
      "        p->color = RED;",
      "        leftRotate(p);",
      "        s = p->right;",
      "      }",
      "      if (colorOf(s->left) == BLACK && colorOf(s->right) == BLACK) {",
      "        s->color = RED;                   /* case 2：兄弟黑、兩姪黑 → 兄弟變紅，上移 */",
      "        x = p;",
      "      } else {",
      "        if (colorOf(s->right) == BLACK) { /* case 3：遠姪黑、近姪紅 → 先右旋兄弟 */",
      "          s->left->color = BLACK;",
      "          s->color = RED;",
      "          rightRotate(s);",
      "          s = p->right;",
      "        }",
      "        s->color = p->color;              /* case 4：遠姪紅 → 左旋父，結束 */",
      "        p->color = BLACK;",
      "        s->right->color = BLACK;",
      "        leftRotate(p);",
      "        x = root;",
      "      }",
      "    } else {                              /* 鏡像：x 是右子 */",
      "      Node *s = p->left;",
      "      if (colorOf(s) == RED) {            /* case 1（鏡像）：兄弟紅 */",
      "        s->color = BLACK;",
      "        p->color = RED;",
      "        rightRotate(p);",
      "        s = p->left;",
      "      }",
      "      if (colorOf(s->left) == BLACK && colorOf(s->right) == BLACK) {",
      "        s->color = RED;                   /* case 2（鏡像）：兩姪黑 */",
      "        x = p;",
      "      } else {",
      "        if (colorOf(s->left) == BLACK) {  /* case 3（鏡像）：遠姪黑、近姪紅 */",
      "          s->right->color = BLACK;",
      "          s->color = RED;",
      "          leftRotate(s);",
      "          s = p->left;",
      "        }",
      "        s->color = p->color;              /* case 4（鏡像）：遠姪紅 → 右旋父 */",
      "        p->color = BLACK;",
      "        s->left->color = BLACK;",
      "        rightRotate(p);",
      "        x = root;",
      "      }",
      "    }",
      "  }",
      "  x->color = BLACK;                       /* 紅色節點吸收多出來的黑 */",
      "}",
    ],
    rotate: [
      "void leftRotate(Node *x) {",
      "  Node *y = x->right;",
      "  x->right = y->left;                     /* β 搬到 x 的右邊 */",
      "  if (y->left != NULL) y->left->parent = x;",
      "  y->parent = x->parent;                  /* y 接到 x 原本的父節點 */",
      "  if (x->parent == NULL) root = y;",
      "  else if (x == x->parent->left) x->parent->left = y;",
      "  else x->parent->right = y;",
      "  y->left = x;                            /* x 變成 y 的左子 */",
      "  x->parent = y;",
      "}",
    ],
  };
  // ==CODE-END==

  // 紅黑的畫法：黑 = 方形、紅 = 圓形
  const SHAPE = (c) => (c === "R" ? { shape: "circle", r: 20 } : { shape: "box", w: 38, h: 38 });
  const CN = (c) => (c === "R" ? "紅" : "黑");

  register("rbt", function (root) {
    const W = 700, H = 452, MAX_DEPTH = 5, MAX_N = 22, TOP = 70, DY = 62;
    const player = new Player(root, {
      title: "Red-Black Tree 紅黑樹",
      width: W, height: H, code: CODE.insert, wide: true,
      legend: [["compare", "比較中 / 兄弟 s"], ["active", "目前處理的節點（z 或 x）"], ["new", "新插入"], ["removed", "將被刪除"], ["found", "找到 / 完成"]],
    });
    const ln = (s) => { const c = player._codeNow; const i = c.findIndex((l) => l.includes(s)); return i + 1; };
    const lr = (s, k) => { const a = ln(s); return Array.from({ length: k }, (_, i) => a + i); };
    function useCode(name) { player._codeNow = CODE[name]; player.setCode(CODE[name]); }
    useCode("insert");

    // ---------- 模型（和 C 程式一樣有 parent 指標） ----------
    let T = {}, rootId = null, uid = 0;
    const N = (id) => (id === null ? null : T[id]);
    const colorOf = (id) => (id === null ? "B" : T[id].c);
    const name = (id) => (id === null ? "NIL" : String(T[id].v));

    function plant(list) { // [[key, "R"|"B"], ...]：照 BST 規則放進去，不做修正（建立指定的樹）
      T = {}; rootId = null;
      list.forEach(([v, c]) => {
        const id = "k" + uid++;
        T[id] = { id, v, c, l: null, r: null, p: null };
        if (rootId === null) { rootId = id; return; }
        let x = T[rootId];
        for (;;) {
          const k = v < x.v ? "l" : "r";
          if (x[k] === null) { x[k] = id; T[id].p = x.id; return; }
          x = T[x[k]];
        }
      });
    }
    function setChild(parId, oldId, newId) {
      if (parId === null) rootId = newId;
      else if (T[parId].l === oldId) T[parId].l = newId;
      else T[parId].r = newId;
      if (newId !== null) T[newId].p = parId;
    }
    function rotL(xId) {
      const x = T[xId], yId = x.r, y = T[yId];
      x.r = y.l; if (y.l !== null) T[y.l].p = xId;
      setChild(x.p, xId, yId);
      y.l = xId; x.p = yId;
    }
    function rotR(xId) {
      const x = T[xId], yId = x.l, y = T[yId];
      x.l = y.r; if (y.r !== null) T[y.r].p = xId;
      setChild(x.p, xId, yId);
      y.r = xId; x.p = yId;
    }
    function find(v) {
      let x = N(rootId);
      while (x && x.v !== v) x = N(v < x.v ? x.l : x.r);
      return x ? x.id : null;
    }
    function depthOf(id) { let d = 0; while (T[id].p !== null) { id = T[id].p; d++; } return d; }
    function heightOf(id) { return id === null ? 0 : 1 + Math.max(heightOf(T[id].l), heightOf(T[id].r)); }
    function bh() { let d = 0, x = N(rootId); while (x) { if (x.c === "B") d++; x = N(x.l); } return d; }
    function count(c) { return Object.values(T).filter((n) => n.c === c).length; }

    // ---------- 繪製 ----------
    // nil = { par, side, label }：在某個空位畫出一個 NIL（例如叔叔或兄弟是 NIL 時）
    function layout(nil) {
      const order = [];
      (function walk(id, d, par, side) {
        if (id === null) { if (nil && nil.par === par && nil.side === side) order.push(["nil", d]); return; }
        walk(T[id].l, d + 1, id, "l"); order.push([id, d]); walk(T[id].r, d + 1, id, "r");
      })(rootId, 0, null, null);
      const n = order.length, step = Math.min(60, (W - 40) / Math.max(n, 1));
      const pos = {};
      order.forEach(([id, d], i) => (pos[id] = { x: W / 2 + (i - (n - 1) / 2) * step, y: TOP + d * DY }));
      return pos;
    }

    function frame(caption, line, opt = {}) {
      const pos = layout(opt.nil);
      const st = opt.st || {};
      const nodes = Object.values(T).map((n) => Object.assign({ id: n.id, label: n.v, x: pos[n.id].x, y: pos[n.id].y, state: st[n.id] || "default" }, SHAPE(n.c)));
      const edges = [];
      Object.values(T).forEach((n) => ["l", "r"].forEach((k) => n[k] && edges.push({ from: n.id, to: n[k], state: (opt.est || {})[n[k]] || "default" })));
      if (opt.nil && pos.nil) {
        nodes.push({ id: "nil", label: "NIL", x: pos.nil.x, y: pos.nil.y, shape: "box", w: 38, h: 24, state: "ghost" });
        if (opt.nil.par !== null) edges.push({ from: opt.nil.par, to: "nil", state: "muted", dashed: true });
      }
      // 圖例：方形 = 黑、圓形 = 紅（每一格都畫，不靠顏色）
      nodes.push({ id: "lgB", label: "", x: 30, y: H - 24, shape: "box", w: 30, h: 30, state: "default" });
      nodes.push({ id: "lgR", label: "", x: 140, y: H - 24, shape: "circle", r: 15, state: "default" });
      const labels = [
        { id: "lgBt", x: 52, y: H - 24, text: "方形 = 黑", anchor: "start" },
        { id: "lgRt", x: 162, y: H - 24, text: "圓形 = 紅", anchor: "start" },
      ];
      if (opt.info) labels.push({ id: "info", x: W - 16, y: H - 24, text: opt.info, anchor: "end", cls: "strong" });
      if (rootId === null && !opt.nil) labels.push({ id: "empty", x: W / 2, y: 160, text: "（空樹 root = NULL）" });
      // 指標：同一個節點有好幾個名字時合併成一個
      const byT = {};
      (opt.ptr || []).forEach(([label, target]) => {
        if (target === null || target === undefined) return;
        const key = target === "nil" ? "nil" : target;
        (byT[key] = byT[key] || []).push(label);
      });
      const pointers = Object.entries(byT).map(([target, ls]) => ({ id: "p-" + ls.join("-"), label: ls.join(", "), target, dir: "up", state: ls.some((l) => l.startsWith("x") || l === "z") ? "active" : "default" }));
      if (rootId !== null && !byT[rootId]) pointers.push({ id: "root", label: "root", target: rootId, dir: "left", state: "default" });
      return { nodes, edges, pointers, labels, caption, line };
    }
    const info = () => `黑高度 bh = ${bh()}，樹高 = ${heightOf(rootId)} 層`;

    // ---------- 共用：從根往下找 ----------
    function walk(r, v, lines) {
      let x = N(rootId), par = null;
      const path = {};
      while (x) {
        if (v === x.v) return { id: x.id, par, path };
        const go = v < x.v ? "l" : "r";
        if (!lines.quick) r.push(frame(`${v} ${v < x.v ? "<" : ">"} ${x.v}，往${go === "l" ? "左" : "右"}走。`, lines.step, { st: Object.assign({}, path, { [x.id]: "compare" }), est: path, ptr: [["x", x.id]] }));
        path[x.id] = "visited";
        par = x.id; x = N(x[go]);
      }
      return { id: null, par, path };
    }

    // ---------- insert ----------
    function insertOne(r, v, quick) {
      const w = walk(r, v, { step: ln("x = key < x->key ? x->left : x->right;"), quick });
      if (w.id !== null) {
        r.push(frame(`<b>${v}</b> 已經在樹中，紅黑樹和 BST 一樣不收重複的 key，不插入。`, ln("if (key == x->key) return 0;"), { st: { [w.id]: "found" } }));
        return null;
      }
      const id = "k" + uid++;
      T[id] = { id, v, c: "R", l: null, r: null, p: w.par };
      if (w.par === null) rootId = id;
      else if (v < T[w.par].v) T[w.par].l = id;
      else T[w.par].r = id;
      const where = w.par === null ? "成為根" : `成為 ${name(w.par)} 的${v < T[w.par].v ? "左" : "右"}子`;
      r.push(frame(`照 BST 規則找到空位，<b>${v}</b> ${where}，<b>塗紅</b>。塗紅不會改變任何路徑的黑節點數，最多只會造成「紅紅相連」。`, ln("z->color = RED;"), { st: { [id]: "new" }, ptr: [["z", id]] }));
      const stat = { recolor: 0, rotate: 0 }; // recolor：case 1 的次數
      let z = id;
      while (colorOf(T[z].p) === "R") {
        const p = T[z].p, g = T[p].p, left = T[g].l === p;
        const u = left ? T[g].r : T[g].l;
        const X = left ? "L" : "R";
        const nilU = u === null ? { par: g, side: left ? "r" : "l" } : null;
        const ptrs = [["z", z], ["p", p], ["g", g], ["u", u === null ? "nil" : u]];
        const pre = left ? "" : "鏡像，";
        r.push(frame(`z = ${name(z)} 和父節點 p = ${name(p)} 都是紅 → 違反「紅紅不相連」。看叔叔 u = <b>${name(u)}</b>${u === null ? "（NIL 一律算黑）" : ""}：它是<b>${CN(colorOf(u))}</b>。`, ln(left ? "Node *u = g->right;" : "Node *u = g->left;"), { st: { [z]: "active", [u]: "compare" }, ptr: ptrs, nil: nilU }));
        if (colorOf(u) === "R") {
          const type = X + (T[p].l === z ? "L" : "R") + "r";
          r.push(frame(`<b>case 1</b>（${pre}${type} 型）：叔叔紅 → 只要<b>變色</b>：p、u 塗黑，g 塗紅。g 底下每條路徑的黑節點數不變。`, lr(left ? "case 1：叔叔紅" : "case 1（鏡像）", 4), { st: { [z]: "active", [p]: "compare", [u]: "compare", [g]: "compare" }, ptr: ptrs }));
          T[p].c = "B"; T[u].c = "B"; T[g].c = "R"; stat.recolor++;
          r.push(frame(`變色完成。g = ${name(g)} 變紅後，可能又和它的父節點紅紅相連，所以 <b>z 往上移兩層到 g</b> 繼續檢查。`, ln(left ? "case 1：叔叔紅" : "case 1（鏡像）") + 4, { st: { [g]: "active" }, ptr: [["z", g]] }));
          z = g;
          continue;
        }
        const zInner = left ? T[p].r === z : T[p].l === z;
        if (zInner) {
          const type = X + (left ? "R" : "L") + "b";
          r.push(frame(`<b>case 2</b>（${pre}${type} 型）：叔叔黑，而且 g → p → z 是<b>折線</b>。先對 p = ${name(p)} ${left ? "左" : "右"}旋，把它拉成一直線。`, lr(left ? "case 2：LR 型" : "case 2（鏡像）", 3), { st: { [z]: "active", [p]: "compare" }, ptr: ptrs, nil: nilU }));
          if (left) rotL(p); else rotR(p);
          stat.rotate++;
          const nz = p, np = T[nz].p;
          r.push(frame(`${left ? "左" : "右"}旋後，原本的 p = ${name(nz)} 變成下面那個，令 z = ${name(nz)}、p = ${name(np)}，變成一直線的 ${X}${X}b 型，交給 case 3。`, ln(left ? "case 2：LR 型" : "case 2（鏡像）") + 3, { st: { [nz]: "active", [np]: "compare" }, ptr: [["z", nz], ["p", np], ["g", g], ["u", u === null ? "nil" : u]], nil: nilU }));
          z = nz;
        }
        const p2 = T[z].p;
        r.push(frame(`<b>case 3</b>（${pre}${X}${X}b 型）：p = ${name(p2)} 塗黑、g = ${name(g)} 塗紅，再對 g ${left ? "右" : "左"}旋。`, lr(left ? "case 3：LL 型" : "case 3（鏡像）", 2), { st: { [z]: "active", [p2]: "compare", [g]: "compare" }, ptr: [["z", z], ["p", p2], ["g", g]], nil: nilU }));
        T[p2].c = "B"; T[g].c = "R";
        if (left) rotR(g); else rotL(g);
        stat.rotate++;
        r.push(frame(`${left ? "右" : "左"}旋完成：${name(p2)}（黑）成為這棵子樹的根，兩個子節點 ${name(T[p2].l)}、${name(T[p2].r)} 都是紅。子樹的根是黑，上面不可能再紅紅相連，<b>修正結束</b>。`, ln(left ? "rightRotate(g);" : "leftRotate(g);"), { st: { [p2]: "found" }, ptr: [["z", z]] }));
        break;
      }
      if (T[rootId].c === "R") {
        r.push(frame(`根 ${name(rootId)} 是紅 → <b>塗黑</b>（根一定是黑；這一步讓整棵樹的黑高度 +1）。`, ln("root->color = BLACK;"), { st: { [rootId]: "active" } }));
        T[rootId].c = "B";
      } else if (!stat.rotate && T[z].p !== null) {
        r.push(frame(`z = ${name(z)} 的父節點 ${name(T[z].p)} 是黑，沒有紅紅相連，迴圈結束。`, ln("while (colorOf(z->parent) == RED)"), { st: { [z]: "active" }, ptr: [["z", z]] }));
      }
      return stat;
    }

    function doInsert(list) {
      useCode("insert");
      const r = new Recorder();
      const quick = list.length > 1;
      if (quick) r.push(frame(`依序插入 ${list.join(", ")}。多筆插入時省略往下比較的步驟，直接看修正。`, null));
      let rec = 0, rot = 0;
      for (const v of list) {
        if (find(v) === null && Object.keys(T).length >= MAX_N) { r.push(frame(`樹裡已經有 ${MAX_N} 個節點，畫面放不下，<b>${v}</b> 之後的插入不做。可以先清空或刪掉一些節點。`, null, { info: info() })); break; }
        if (find(v) === null) {
          let x = N(rootId), d = 0;
          while (x) { x = N(v < x.v ? x.l : x.r); d++; }
          if (d > MAX_DEPTH) { r.push(frame(`插入 ${v} 會放在第 ${d + 1} 層，超過畫面能顯示的 ${MAX_DEPTH + 1} 層，不做。`, null, { info: info() })); break; }
        }
        if (!quick) r.push(frame(`insert(${v})：先像 BST 一樣從根往下找空位。`, ln("Node *p = NULL, *x = root;"), { ptr: rootId ? [["x", rootId]] : [] }));
        const s = insertOne(r, v, quick);
        if (s) { rec += s.recolor; rot += s.rotate; }
        if (s && !quick) r.push(frame(`insert(${v}) 完成：case 1 變色 ${s.recolor} 次、旋轉 ${s.rotate} 次（插入最多旋轉 2 次）。每條根到 NIL 的路徑黑節點數都一樣。`, null, { st: { [find(v)]: "found" }, info: info() }));
      }
      if (quick) r.push(frame(`全部插入完成：共 case 1 變色 ${rec} 次、旋轉 ${rot} 次；紅節點 ${count("R")} 個、黑節點 ${count("B")} 個。`, null, { info: info() }));
      return r.frames;
    }

    // ---------- delete ----------
    let usePred = true; // 預設：兩個子節點時用左子樹最大（中序前驅）
    function deleteOne(r, v) {
      const code = usePred ? "deletePred" : "deleteSucc";
      useCode(code);
      r.push(frame(`delete(${v})：先找到 ${v}。`, ln(usePred ? "int rbDelete(int key) {" : "int rbDeleteSucc(int key) {"), { ptr: rootId ? [["x", rootId]] : [] }));
      const w = walk(r, v, { step: ln("Node *z = search(key);") });
      if (w.id === null) { r.push(frame(`走到 NIL，樹中沒有 <b>${v}</b>，不用刪除。`, ln("if (z == NULL) return 0;"), { st: w.path })); return false; }
      let z = w.id;
      r.push(frame(`找到 <b>${v}</b>（${CN(T[z].c)}）。`, ln("Node *z = search(key);"), { st: { [z]: "found" }, ptr: [["z", z]] }));
      if (T[z].l !== null && T[z].r !== null) {
        const a = usePred ? "l" : "r", b = usePred ? "r" : "l";
        let s = T[z][a];
        while (T[s][b] !== null) s = T[s][b];
        r.push(frame(`${v} 有兩個子節點，和 BST 一樣找<b>${usePred ? "左子樹最大（中序前驅）" : "右子樹最小（中序後繼）"}</b>：${name(s)}。`, ln(usePred ? "while (s->right != NULL) s = s->right;" : "while (s->left != NULL) s = s->left;"), { st: { [z]: "compare", [s]: "active" }, ptr: [["z", z], ["s", s]] }));
        T[z].v = T[s].v;
        r.push(frame(`把 ${name(s)} 的值複製到 z（<b>只換 key、不換顏色</b>），改成刪除原本 ${name(s)} 的那個節點。它最多只有一個${usePred ? "左" : "右"}子，問題變成刪除「最多一個子節點」的節點。`, [ln(usePred ? "複製前驅的值" : "複製後繼的值"), ln("z = s;")], { st: { [z]: "found", [s]: "removed" }, ptr: [["z", s]] }));
        z = s;
      }
      const child = T[z].l !== null ? T[z].l : T[z].r;
      const zp = T[z].p;
      if (child !== null) {
        r.push(frame(`z = ${name(z)} 只有一個子節點 ${name(child)}。這種情況一定是「z 黑、子紅」（否則兩邊黑高度不同）→ 子節點頂上來並<b>塗黑</b>，補回少掉的那個黑。`, lr("if (child != NULL) {", 3), { st: { [z]: "removed", [child]: "active" }, ptr: [["z", z]] }));
        T[child].c = "B";
        setChild(zp, z, child); delete T[z];
        r.push(frame(`${name(child)} 接到原本 z 的位置，黑高度不變，完成。`, ln("free(z);"), { st: { [child]: "found" }, info: info() }));
        return true;
      }
      if (T[z].c === "R") {
        r.push(frame(`z = ${name(z)} 是<b>紅色葉子</b>：拿掉它不會改變任何路徑的黑節點數，也不會造成紅紅相連 → <b>直接刪除，不用調整</b>。`, ln("replaceNode(z, NULL);"), { st: { [z]: "removed" }, est: { [z]: "removed" }, ptr: [["z", z]] }));
        setChild(zp, z, null); delete T[z];
        r.push(frame(`刪除完成。`, ln("free(z);"), { info: info() }));
        return true;
      }
      if (zp === null) {
        r.push(frame(`z = ${name(z)} 是根，也是唯一的節點，刪掉後變成空樹。`, ln("replaceNode(z, NULL);"), { st: { [z]: "removed" }, ptr: [["z", z]] }));
        delete T[z]; rootId = null;
        r.push(frame(`刪除完成，樹是空的。`, ln("free(z);")));
        return true;
      }
      r.push(frame(`z = ${name(z)} 是<b>黑色葉子</b>：拿掉後，經過這裡的路徑會少 1 個黑。先把 z 看成帶著「多一個黑」的 <b>double black</b>（x），修好之後再拿掉。`, ln("if (z->color == BLACK) deleteFixup(z);"), { st: { [z]: "removed" }, ptr: [["x（雙黑）", z]] }));
      fixDelete(r, z);
      setChild(T[z].p, z, null); delete T[z];
      r.push(frame(`最後拿掉原本的 z。檢查：每條根到 NIL 的路徑黑節點數都相同，完成。`, ln("replaceNode(z, NULL);"), { info: info() }));
      return true;
    }

    function fixDelete(r, z) {
      let x = z, guard = 0;
      const xs = () => (x === z ? { [z]: "removed" } : { [x]: "active", [z]: "removed" });
      while (x !== rootId && T[x].c === "B" && guard++ < 20) {
        const p = T[x].p, left = T[p].l === x, pre = left ? "" : "（鏡像）";
        let s = left ? T[p].r : T[p].l;
        const ptr = () => [["x（雙黑）", x], ["p", p], ["s", s]];
        r.push(frame(`x = ${name(x)} 是 p = ${name(p)} 的${left ? "左" : "右"}子，看兄弟 s = <b>${name(s)}</b>（${CN(colorOf(s))}）。`, ln(left ? "Node *s = p->right;" : "Node *s = p->left;"), { st: Object.assign(xs(), { [s]: "compare" }), ptr: ptr() }));
        if (colorOf(s) === "R") {
          r.push(frame(`<b>case 1${pre}</b>：兄弟紅 → s 塗黑、p 塗紅，對 p ${left ? "左" : "右"}旋。目的是讓 x 換到一個<b>黑色的兄弟</b>，再進 case 2～4。`, lr(left ? "case 1：兄弟紅" : "case 1（鏡像）", 4), { st: Object.assign(xs(), { [s]: "compare", [p]: "compare" }), ptr: ptr() }));
          T[s].c = "B"; T[p].c = "R";
          if (left) rotL(p); else rotR(p);
          s = left ? T[p].r : T[p].l;
          r.push(frame(`旋轉後 x 還在 p = ${name(p)} 底下（p 現在是紅），新的兄弟 s = <b>${name(s)}</b> 是黑。`, ln(left ? "case 1：兄弟紅" : "case 1（鏡像）") + 4, { st: Object.assign(xs(), { [s]: "compare" }), ptr: ptr() }));
        }
        const near = left ? T[s].l : T[s].r, far = left ? T[s].r : T[s].l;
        if (colorOf(near) === "B" && colorOf(far) === "B") {
          r.push(frame(`<b>case 2${pre}</b>：兄弟黑、兩個姪子（${name(T[s].l)}、${name(T[s].r)}）都黑 → s 塗紅，讓 s 那邊也少一個黑，兩邊扯平；少掉的黑<b>往上推給 p</b>。`, lr(left ? "case 2：兄弟黑、兩姪黑" : "case 2（鏡像）", 2), { st: Object.assign(xs(), { [s]: "compare" }), ptr: ptr() }));
          T[s].c = "R";
          x = p;
          const msg = T[p].c === "R" ? `x = p = ${name(p)} 是紅 → 迴圈結束，等一下把它塗黑就補回那個黑。` : (p === rootId ? `x = p = ${name(p)} 已經是根，整棵樹的黑高度一起少 1，迴圈結束。` : `x = p = ${name(p)} 是黑，它變成新的 double black，繼續往上處理。`);
          r.push(frame(msg, ln(left ? "case 2：兄弟黑、兩姪黑" : "case 2（鏡像）") + 1, { st: xs(), ptr: [["x（雙黑）", x]] }));
          continue;
        }
        if (colorOf(far) === "B") {
          r.push(frame(`<b>case 3${pre}</b>：遠姪 ${name(far)} 黑、近姪 ${name(near)} 紅 → 近姪塗黑、s 塗紅，對 s ${left ? "右" : "左"}旋，把紅色轉到遠姪的位置，變成 case 4。`, lr(left ? "case 3：遠姪黑、近姪紅" : "case 3（鏡像）", 4), { st: Object.assign(xs(), { [s]: "compare", [near]: "compare" }), ptr: ptr(), nil: far === null ? { par: s, side: left ? "r" : "l" } : null }));
          T[near].c = "B"; T[s].c = "R";
          if (left) rotR(s); else rotL(s);
          s = left ? T[p].r : T[p].l;
          r.push(frame(`旋轉後新的兄弟 s = <b>${name(s)}</b>（黑），它的遠姪 ${name(left ? T[s].r : T[s].l)} 是紅。`, ln(left ? "case 3：遠姪黑、近姪紅" : "case 3（鏡像）") + 4, { st: Object.assign(xs(), { [s]: "compare" }), ptr: ptr() }));
        }
        const far2 = left ? T[s].r : T[s].l;
        r.push(frame(`<b>case 4${pre}</b>：遠姪 ${name(far2)} 紅 → s 取 p 的顏色（${CN(T[p].c)}）、p 塗黑、遠姪塗黑，再對 p ${left ? "左" : "右"}旋。`, lr(left ? "case 4：遠姪紅" : "case 4（鏡像）", 4), { st: Object.assign(xs(), { [s]: "compare", [far2]: "compare" }), ptr: ptr() }));
        T[s].c = T[p].c; T[p].c = "B"; T[far2].c = "B";
        if (left) rotL(p); else rotR(p);
        r.push(frame(`旋轉後 x 這邊多了黑色的 p = ${name(p)}，補回少掉的黑；s 那邊少的黑由塗黑的遠姪補上 → <b>double black 消除，結束</b>（最多 3 次旋轉）。`, ln(left ? "case 4：遠姪紅" : "case 4（鏡像）") + 4, { st: Object.assign(xs(), { [s]: "found" }) }));
        x = rootId;
      }
      if (x !== z && T[x].c === "R") {
        r.push(frame(`x = ${name(x)} 是紅 → 塗黑，吸收多出來的黑。`, ln("紅色節點吸收多出來的黑"), { st: { [x]: "active", [z]: "removed" } }));
        T[x].c = "B";
      }
    }

    function doDelete(list) {
      const r = new Recorder();
      list.forEach((v) => deleteOne(r, v));
      useCode(usePred ? "deletePred" : "deleteSucc");
      return r.frames;
    }

    // ---------- 控制列 ----------
    const input = ui.input(player, { placeholder: "key 或 5,2,7", value: "62", width: 110 });
    function parse() {
      const parts = input.value.split(/[,，\s]+/).filter((s) => s !== "");
      const nums = parts.map((s) => (/^-?\d+$/.test(s) ? Number(s) : NaN));
      const bad = !parts.length || nums.some((v) => !Number.isInteger(v) || v < 0 || v > 999) || parts.length > 12;
      if (bad) {
        input.classList.add("is-error");
        setTimeout(() => input.classList.remove("is-error"), 700);
        const why = !parts.length ? "請先輸入 key" : parts.length > 12 ? "一次最多 12 個 key" : "key 要是 0～999 的整數，多個 key 用逗號隔開";
        player.load([frame(`${iconHTML("alert")} ${esc(why)}（目前輸入：「${esc(input.value)}」）。`, null, { info: rootId ? info() : null })], { autoplay: false });
        return null;
      }
      return nums;
    }
    ui.button(player, "insert", () => { const v = parse(); if (v) player.load(doInsert(v)); });
    ui.button(player, "delete", () => { const v = parse(); if (v) player.load(doDelete(v)); });
    const modeBtn = ui.button(player, "", () => {
      usePred = !usePred;
      modeBtn.textContent = usePred ? "刪除用：左子樹最大" : "刪除用：右子樹最小";
      useCode(usePred ? "deletePred" : "deleteSucc");
      player.load([frame(`兩個子節點的刪除改用<b>${usePred ? "左子樹最大（中序前驅）" : "右子樹最小（中序後繼）"}</b>。換了替代者，接下來要修的位置就不同，結果可能不一樣。`, null, { info: rootId ? info() : null })], { autoplay: false });
    }, "ghost");
    modeBtn.textContent = "刪除用：左子樹最大";
    modeBtn.title = "切換兩個子節點時的替代者：左子樹最大（預設）或右子樹最小";

    const EX = {
      insert62: [[50, "B"], [10, "B"], [80, "R"], [65, "B"], [90, "B"], [60, "R"], [70, "R"]],
      del: [[12, "B"], [7, "B"], [3, "B"], [2, "R"], [5, "R"], [9, "B"], [8, "R"], [42, "B"], [29, "R"], [18, "B"], [22, "R"], [38, "B"], [57, "B"]],
    };
    function example(tree, ops, intro) {
      plant(tree);
      input.value = ops.v.join(",");
      const f = ops.kind === "insert" ? doInsert(ops.v) : doDelete(ops.v);
      f[0].caption = intro + "<br>" + f[0].caption;
      player.load(f, { autoplay: false });
    }
    ui.button(player, "例：插入 62（case 1→2→3）", () => example(EX.insert62, { kind: "insert", v: [62] }, "這棵樹插入 62 會連續遇到 case 1、case 2、case 3，按播放看。"), "ghost");
    ui.button(player, "例：空樹插入 5,2,7,3,4", () => example([], { kind: "insert", v: [5, 2, 7, 3, 4] }, "從空樹開始依序插入，觀察哪幾次只變色、哪一次要旋轉。"), "ghost");
    ui.button(player, "例：刪除 57（兄弟紅）", () => { if (!usePred) modeBtn.click(); example(EX.del, { kind: "delete", v: [57] }, "57 是黑色葉子，兄弟 29 是紅：case 1 → case 2。"); }, "ghost");
    ui.button(player, "例：刪除 42（前驅取代）", () => { if (!usePred) modeBtn.click(); example(EX.del.concat([[45, "R"]]), { kind: "delete", v: [42] }, "42 有兩個子節點，用左子樹最大 38 取代；38 是黑色葉子，接著 case 3 → case 4。"); }, "ghost");
    ui.button(player, "隨機建樹", () => {
      const vals = new Set();
      while (vals.size < 10) vals.add(Math.floor(Math.random() * 90) + 10);
      plant([]);
      useCode("insert");
      const r = new Recorder();
      [...vals].forEach((v) => insertOne(r, v, true));
      player.load([frame(`依序插入 ${[...vals].join(", ")} 建出一棵紅黑樹（${count("R")} 紅、${count("B")} 黑）。輸入 key 試試 insert 或 delete。`, null, { info: info() })], { autoplay: false });
    }, "ghost");
    ui.button(player, "清空", () => { plant([]); player.load([frame("樹已清空。輸入一個或多個 key（用逗號隔開）後按 insert。", null)], { autoplay: false }); }, "ghost");
    input.addEventListener("keydown", (e) => e.key === "Enter" && player.toolbar.querySelector(".vop").click());

    // 初始示範：插入 62，三種 case 都會出現
    plant(EX.insert62);
    const demo = doInsert([62]);
    demo[0].caption = iconHTML("play") + " 按播放看 <b>insert(62)</b>：會依序遇到 case 1（變色）、case 2、case 3（旋轉）。之後可以輸入 key（或 5,2,7 這樣的序列）試 insert、delete，或按下面的例子。";
    player.load(demo, { autoplay: false });
  });

  // ===================================================================
  // 靜態圖解
  // ===================================================================
  const nd = (id, label, x, y, c, state) => Object.assign({ id, label, x, y, state: state || "default" }, c === "N" ? { shape: "box", w: 30, h: 20, state: "ghost" } : SHAPE(c));
  const ed = (from, to, state, dashed) => ({ from, to, state: state || "default", dashed: !!dashed });
  const legend = (y) => [
    Object.assign(nd("fgB", "", 24, y, "B"), { w: 26, h: 26 }), Object.assign(nd("fgR", "", 134, y, "R"), { r: 13 }),
  ];
  const legendText = (y) => [
    { id: "fgBt", x: 44, y, text: "方形 = 黑", anchor: "start" },
    { id: "fgRt", x: 154, y, text: "圓形 = 紅", anchor: "start" },
  ];

  // 圖 1：一棵合法的紅黑樹，畫出 NIL，標出每條路徑的黑節點數
  figure("rbt-properties", () => {
    const N0 = [
      nd("a", 30, 330, 40, "B"), nd("b", 15, 190, 105, "R"), nd("c", 50, 470, 105, "B"),
      nd("d", 10, 120, 170, "B"), nd("e", 20, 260, 170, "B"), nd("f", 40, 420, 170, "R"), nd("g", 60, 520, 170, "R"),
      nd("h", 25, 300, 235, "R"),
    ];
    const nils = [[85, 225, "d"], [155, 225, "d"], [225, 225, "e"], [262, 290, "h"], [338, 290, "h"], [395, 225, "f"], [445, 225, "f"], [495, 225, "g"], [545, 225, "g"]];
    const nodes = N0.concat(nils.map(([x, y], i) => nd("n" + i, "NIL", x, y, "N")));
    const edges = [ed("a", "b"), ed("a", "c"), ed("b", "d"), ed("b", "e"), ed("c", "f"), ed("c", "g"), ed("e", "h")]
      .concat(nils.map(([, , p], i) => ed(p, "n" + i, "muted", true)));
    return {
      width: 660, height: 360, nodes: nodes.concat(legend(338)), edges,
      labels: legendText(338).concat([
        { id: "t1", x: 600, y: 50, text: "① 根是黑", anchor: "middle" },
        { id: "t2", x: 600, y: 80, text: "② NIL 都是黑", anchor: "middle" },
        { id: "t3", x: 600, y: 110, text: "③ 紅的子節點必黑", anchor: "middle" },
        { id: "t4", x: 600, y: 140, text: "④ 根到每個 NIL", anchor: "middle" },
        { id: "t5", x: 600, y: 160, text: "黑節點數相同", anchor: "middle" },
        { id: "p1", x: 480, y: 300, text: "30→15→20→25→NIL：黑 30、20 共 2 個", anchor: "middle" },
        { id: "p2", x: 480, y: 322, text: "30→50→60→NIL：黑 30、50 共 2 個", anchor: "middle" },
      ]),
    };
  });

  // 圖 2：左旋、右旋
  figure("rbt-rotation", () => {
    const L = (dx) => [
      nd("x" + dx, "x", 90 + dx, 50, "B", "compare"), nd("a" + dx, "α", 45 + dx, 120, "N"), nd("y" + dx, "y", 140 + dx, 120, "B", "active"),
      nd("b" + dx, "β", 105 + dx, 190, "N"), nd("c" + dx, "γ", 175 + dx, 190, "N"),
    ];
    const R = (dx) => [
      nd("Y" + dx, "y", 140 + dx, 50, "B", "active"), nd("X" + dx, "x", 90 + dx, 120, "B", "compare"), nd("C" + dx, "γ", 185 + dx, 120, "N"),
      nd("A" + dx, "α", 55 + dx, 190, "N"), nd("B" + dx, "β", 125 + dx, 190, "N", "found"),
    ];
    const nodes = L(20).concat(R(380));
    nodes.forEach((n) => { if (n.label === "α" || n.label === "β" || n.label === "γ") { n.w = 34; n.h = 26; } });
    const edges = [ed("x20", "a20"), ed("x20", "y20"), ed("y20", "b20", "found"), ed("y20", "c20"),
      ed("Y380", "X380"), ed("Y380", "C380"), ed("X380", "A380"), ed("X380", "B380", "found")];
    return {
      width: 660, height: 250, nodes, edges,
      labels: [
        { id: "l1", x: 330, y: 95, text: "leftRotate(x) →", cls: "strong" },
        { id: "l2", x: 330, y: 140, text: "← rightRotate(y)", cls: "strong" },
        { id: "l3", x: 330, y: 230, text: "只改 3 個指標（O(1)），中序 α x β y γ 不變；β 換了父節點", anchor: "middle" },
      ],
    };
  });

  // 圖 3：插入的三種 case（以父是祖父的左子為例）
  figure("rbt-insert-cases", () => {
    const col = (dx, cs, zs, title) => {
      const [g, p, u, z] = cs;
      return {
        nodes: [nd("g" + dx, "g", 110 + dx, 50, g), nd("p" + dx, "p", 60 + dx, 115, p, "compare"), nd("u" + dx, "u", 160 + dx, 115, u),
          nd("z" + dx, "z", (zs === "l" ? 25 : 95) + dx, 180, z, "active")],
        edges: [ed("g" + dx, "p" + dx), ed("g" + dx, "u" + dx), ed("p" + dx, "z" + dx)],
        labels: [{ id: "t" + dx, x: 110 + dx, y: 230, text: title, cls: "strong" }],
      };
    };
    const parts = [col(0, ["B", "R", "R", "R"], "l", "case 1：叔叔紅"), col(220, ["B", "R", "B", "R"], "r", "case 2：叔叔黑、折線"), col(440, ["B", "R", "B", "R"], "l", "case 3：叔叔黑、直線")];
    const out = { width: 660, height: 300, nodes: [], edges: [], labels: [] };
    parts.forEach((p) => { out.nodes.push(...p.nodes); out.edges.push(...p.edges); out.labels.push(...p.labels); });
    out.labels.push({ id: "d1", x: 110, y: 254, text: "p、u 黑，g 紅；z = g", anchor: "middle" });
    out.labels.push({ id: "d2", x: 330, y: 254, text: "旋轉 p，變成 case 3", anchor: "middle" });
    out.labels.push({ id: "d3", x: 550, y: 254, text: "p 黑 g 紅，旋轉 g", anchor: "middle" });
    out.nodes.push(...legend(284)); out.labels.push(...legendText(284));
    return out;
  });

  // 圖 4：紅黑樹 ↔ 2-3-4 tree
  figure("rbt-234", () => {
    const nodes = [
      nd("a", 65, 160, 40, "B"), nd("b", 50, 90, 100, "R"), nd("c", 80, 230, 100, "R"),
      nd("d", 10, 40, 165, "B"), nd("e", 60, 130, 165, "B"), nd("f", 70, 195, 165, "B"), nd("g", 90, 270, 165, "B"),
      nd("h", 62, 165, 225, "R"),
      { id: "A", label: "50 | 65 | 80", x: 500, y: 60, shape: "box", w: 130, h: 36, state: "default" },
      { id: "B1", label: "10", x: 395, y: 160, shape: "box", w: 44, h: 32, state: "default" },
      { id: "B2", label: "60 | 62", x: 475, y: 160, shape: "box", w: 80, h: 32, state: "default" },
      { id: "B3", label: "70", x: 560, y: 160, shape: "box", w: 44, h: 32, state: "default" },
      { id: "B4", label: "90", x: 625, y: 160, shape: "box", w: 44, h: 32, state: "default" },
    ];
    const edges = [ed("a", "b", "compare"), ed("a", "c", "compare"), ed("b", "d"), ed("b", "e"), ed("c", "f"), ed("c", "g"), ed("e", "h", "compare"),
      ed("A", "B1"), ed("A", "B2"), ed("A", "B3"), ed("A", "B4")];
    return {
      width: 660, height: 316, nodes: nodes.concat(legend(298)), edges,
      labels: legendText(298).concat([
        { id: "t1", x: 160, y: 268, text: "紅黑樹（藍線 = 連到紅色子節點）", anchor: "middle" },
        { id: "t2", x: 510, y: 210, text: "2-3-4 tree：黑節點 + 紅色子節點 = 一個節點", anchor: "middle" },
        { id: "t3", x: 510, y: 234, text: "所有葉子同一層 ⇔ 黑高度相同", anchor: "middle" },
        { id: "arr", x: 335, y: 110, text: "⟹", cls: "strong" },
      ]),
    };
  });

  // 圖 5：黑高度 2 時最少、最多的節點數
  figure("rbt-bh-bounds", () => {
    const nodes = [
      nd("a", "", 140, 45, "B"), nd("b", "", 90, 115, "B"), nd("c", "", 190, 115, "B"),
      nd("A", "", 470, 40, "B"), nd("B", "", 380, 95, "R"), nd("C", "", 560, 95, "R"),
    ];
    const edges = [ed("a", "b"), ed("a", "c"), ed("A", "B"), ed("A", "C")];
    const xs3 = [335, 425, 515, 605];
    xs3.forEach((x, i) => {
      nodes.push(nd("D" + i, "", x, 150, "B"));
      edges.push(ed(i < 2 ? "B" : "C", "D" + i));
      [-22, 22].forEach((dx, j) => { nodes.push(nd("E" + i + j, "", x + dx, 205, "R")); edges.push(ed("D" + i, "E" + i + j)); });
    });
    return {
      width: 660, height: 290, nodes: nodes.concat(legend(270)), edges,
      labels: legendText(270).concat([
        { id: "t1", x: 140, y: 175, text: "最少：全黑完美樹", anchor: "middle", cls: "strong" },
        { id: "t2", x: 140, y: 200, text: "2² − 1 = 3 個", anchor: "middle" },
        { id: "t3", x: 470, y: 245, text: "最多：黑紅交錯、高 2bh：2⁴ − 1 = 15 個", anchor: "middle", cls: "strong" },
      ]),
    };
  });
})();
