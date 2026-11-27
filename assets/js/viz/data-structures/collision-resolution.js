/* =====================================================================
   Collision Resolution（碰撞處理）主題的視覺化
   - cr-hash : 雜湊表的 insert / search / delete，
               可切換 linear probing / quadratic probing（+i²、±i²）/ double hashing / separate chaining，
               open addressing 的刪除可切換 tombstone 或搬移補位（只限 linear probing）
   ===================================================================== */
(function () {
  "use strict";
  const { Player, Recorder, ui, register, esc, iconHTML, figure } = window.DSViz;

  /* CODE-BEGIN：由 .work/build_viz.py 從 code/data-structures/collision-resolution.c 抽出 */
  const SRC = {
    "h": [
      "int h(int k)  { return k % M; }                /* 雜湊函數：除法 */"
    ],
    "h2": [
      "int h2(int k) { return 1 + k % (M - 2); }      /* double hashing 的步長，範圍 1～M-2，不會是 0 */"
    ],
    "linear": [
      "int probeLinear(int k, int i)    { return (h(k) + i) % M; }"
    ],
    "quad": [
      "int probeQuadratic(int k, int i) { return (h(k) + i * i) % M; }"
    ],
    "quadpm": [
      "int probeQuadPM(int k, int i) {                /* 正負交替：h, h+1, h-1, h+4, h-4, ... */",
      "  int j = (i + 1) / 2, d = j * j % M;",
      "  return i % 2 == 1 ? (h(k) + d) % M : (h(k) - d + M) % M;",
      "}"
    ],
    "double": [
      "int probeDouble(int k, int i)    { return (h(k) + i * h2(k)) % M; }"
    ],
    "insert": [
      "int insert(int k) {                            /* 回傳放入的位置；放不進去回傳 -1 */",
      "  int tomb = -1;                               /* 路上遇到的第一個 tombstone */",
      "  for (int i = 0; i < M; i++) {",
      "    int idx = probe(k, i);",
      "    if (table[idx] == k) return idx;           /* 已經在表裡，不重複放 */",
      "    if (table[idx] == DELETED) {",
      "      if (tomb == -1) tomb = idx;              /* 先記下來，之後可以重複利用 */",
      "    } else if (table[idx] == EMPTY) {",
      "      if (tomb != -1) idx = tomb;              /* 確定 k 不在表裡：放到最早遇到的 tombstone */",
      "      table[idx] = k;",
      "      return idx;",
      "    }",
      "  }",
      "  if (tomb != -1) { table[tomb] = k; return tomb; }",
      "  return -1;                                   /* 探測 M 次都沒有位置 */",
      "}"
    ],
    "search": [
      "int search(int k) {                            /* 回傳位置；找不到回傳 -1 */",
      "  for (int i = 0; i < M; i++) {",
      "    int idx = probe(k, i);",
      "    if (table[idx] == EMPTY) return -1;        /* 碰到真正的空格：k 一定不在表裡 */",
      "    if (table[idx] == k) return idx;           /* 找到了 */",
      "    /* 別的 key 或 DELETED：繼續探測下一格 */",
      "  }",
      "  return -1;",
      "}"
    ],
    "remove": [
      "int removeKey(int k) {                         /* 刪除成功回傳 1 */",
      "  int idx = search(k);",
      "  if (idx == -1) return 0;",
      "  table[idx] = DELETED;                        /* 不能設回 EMPTY，否則後面的 key 會找不到 */",
      "  return 1;",
      "}"
    ],
    "between": [
      "int between(int a, int x, int b) {             /* x 是否落在環狀區間 (a, b] 裡 */",
      "  return a <= b ? (a < x && x <= b) : (a < x || x <= b);",
      "}"
    ],
    "shift": [
      "int removeShift(int k) {",
      "  int hole = search(k);",
      "  if (hole == -1) return 0;",
      "  table[hole] = EMPTY;                         /* 先挖出一個洞 */",
      "  for (int j = (hole + 1) % M; table[j] != EMPTY; j = (j + 1) % M) {",
      "    if (!between(hole, h(table[j]), j)) {      /* home 不在 (hole, j]：它的探測路徑經過洞 */",
      "      table[hole] = table[j];                  /* 往前補進洞裡 */",
      "      table[j] = EMPTY;",
      "      hole = j;                                /* 洞移到它原本的位置 */",
      "    }",
      "  }",
      "  return 1;",
      "}"
    ],
    "node": [
      "typedef struct Node { int key; struct Node *next; } Node;",
      "Node *bucket[MAXM];"
    ],
    "cinsert": [
      "void chainInsert(int k) {                      /* 接在串列尾端；已經存在就不放 */",
      "  int b = h(k);",
      "  Node *cur = bucket[b], *prev = NULL;",
      "  while (cur != NULL) {",
      "    if (cur->key == k) return;",
      "    prev = cur;",
      "    cur = cur->next;",
      "  }",
      "  Node *x = malloc(sizeof(Node));",
      "  x->key = k;",
      "  x->next = NULL;",
      "  if (prev == NULL) bucket[b] = x;             /* 串列原本是空的 */",
      "  else prev->next = x;",
      "}"
    ],
    "csearch": [
      "Node *chainSearch(int k) {",
      "  for (Node *p = bucket[h(k)]; p != NULL; p = p->next)",
      "    if (p->key == k) return p;",
      "  return NULL;                                 /* 整條串列都看完了 */",
      "}"
    ],
    "cdelete": [
      "int chainDelete(int k) {",
      "  int b = h(k);",
      "  Node *cur = bucket[b], *prev = NULL;",
      "  while (cur != NULL && cur->key != k) { prev = cur; cur = cur->next; }",
      "  if (cur == NULL) return 0;                   /* 不在表裡 */",
      "  if (prev == NULL) bucket[b] = cur->next;     /* 刪的是串列的第一個 */",
      "  else prev->next = cur->next;",
      "  free(cur);",
      "  return 1;",
      "}"
    ]
  };
  /* CODE-END */

  const METHODS = ["linear", "quad", "quadpm", "double", "chain"];
  const NAME = {
    linear: "linear probing", quad: "quadratic probing（+i²）", quadpm: "quadratic probing（±i²）",
    double: "double hashing", chain: "separate chaining",
  };
  const FORMULA = {
    linear: "h(k, i) = (h(k) + i) % m",
    quad: "h(k, i) = (h(k) + i²) % m",
    quadpm: "h, h+1², h−1², h+2², h−2², …（% m）",
    double: "h(k, i) = (h(k) + i·h2(k)) % m，h2(k) = 1 + k % (m − 2)",
    chain: "bucket = h(k) = k % m，同一格的 key 串成鏈結串列",
  };

  function codeFor(method, del) {
    const blank = [""];
    if (method === "chain") return [].concat(SRC.h, SRC.node, blank, SRC.cinsert, blank, SRC.csearch, blank, SRC.cdelete);
    const head = method === "double" ? SRC.h.concat(SRC.h2) : SRC.h;
    let c = [].concat(head, SRC[method], blank, SRC.insert, blank, SRC.search, blank);
    c = c.concat(del === "shift" ? SRC.between.concat(blank, SRC.shift) : SRC.remove);
    return c;
  }
  // 行號用內容找；from 指定從哪個函式開始找，避免不同函式裡相同的行互相混淆
  function lineFinder(code) {
    return (s, from) => {
      const start = from ? code.findIndex((l) => l.includes(from)) : 0;
      const i = code.findIndex((l, j) => j >= start && l.includes(s));
      return i + 1;
    };
  }

  // 探測位置（與 .c 相同）
  const hOf = (k, m) => k % m;
  const h2Of = (k, m) => 1 + (k % (m - 2));
  function probeAt(method, k, i, m) {
    const h = hOf(k, m);
    if (method === "linear") return (h + i) % m;
    if (method === "quad") return (h + i * i) % m;
    if (method === "quadpm") { const j = Math.floor((i + 1) / 2), d = (j * j) % m; return i % 2 === 1 ? (h + d) % m : (h - d + m) % m; }
    return (h + i * h2Of(k, m)) % m;
  }
  function probeText(method, k, i, m) {
    const h = hOf(k, m), p = probeAt(method, k, i, m);
    if (method === "linear") return `(${h} + ${i}) % ${m} = ${p}`;
    if (method === "quad") return `(${h} + ${i}²) % ${m} = (${h} + ${i * i}) % ${m} = ${p}`;
    if (method === "quadpm") {
      const j = Math.floor((i + 1) / 2);
      if (i === 0) return `h = ${p}`;
      return i % 2 === 1 ? `(${h} + ${j}²) % ${m} = ${p}` : `(${h} − ${j}²) % ${m} = ${p}`;
    }
    return `(${h} + ${i}·${h2Of(k, m)}) % ${m} = ${p}`;
  }
  const isPrime = (n) => { for (let d = 2; d * d <= n; d++) if (n % d === 0) return false; return n > 1; };
  const between = (a, x, b) => (a <= b ? a < x && x <= b : a < x || x <= b);

  const W = 720, SY = 150, MAXCHAIN = 6;

  register("cr-hash", function (root) {
    let method = "linear", del = "tomb", m = 11;
    let CODE = codeFor(method, del), ln = lineFinder(CODE);
    const player = new Player(root, {
      title: "Hashing 雜湊表的碰撞處理",
      width: W, height: 300, code: CODE, wide: true,
      legend: [["compare", "正在探測"], ["new", "剛放入"], ["found", "找到"], ["removed", "被刪除／放不進去"], ["muted", "tombstone（DEL）"], ["active", "搬移中"]],
    });

    // ---------- 模型 ----------
    let T = [];          // open addressing：null | {id, v} | {id, tomb: true}
    let B = [];          // chaining：每格一個陣列 [{id, v}]
    let order = [];      // 目前在表中的 key（依插入順序），切換做法時用來重建
    let uid = 0;
    const nid = () => "k" + uid++;

    function size() { return method === "chain" ? B.reduce((s, c) => s + c.length, 0) : T.filter((c) => c && !c.tomb).length; }
    const sp = () => Math.min(58, 680 / m);
    const sx = (i) => (W - sp() * (m - 1)) / 2 + i * sp();
    const bw = () => sp() - 6;

    // 不產生動畫地直接插入（重建、載入例子用）
    function quietInsert(v) {
      if (method === "chain") {
        const c = B[hOf(v, m)];
        if (c.some((n) => n.v === v) || c.length >= MAXCHAIN) return false;
        c.push({ id: nid(), v });
      } else {
        let tomb = -1, at = -1;
        for (let i = 0; i < m && at < 0; i++) {
          const p = probeAt(method, v, i, m), c = T[p];
          if (c && !c.tomb && c.v === v) return false;
          if (c && c.tomb) { if (tomb < 0) tomb = p; } else if (!c) at = tomb >= 0 ? tomb : p;
        }
        if (at < 0) at = tomb;
        if (at < 0) return false;
        T[at] = { id: nid(), v };
      }
      if (!order.includes(v)) order.push(v);
      return true;
    }
    function rebuild(keys) {
      T = new Array(m).fill(null);
      B = Array.from({ length: m }, () => []);
      order = [];
      const lost = [];
      keys.forEach((v) => { if (!quietInsert(v)) lost.push(v); });
      return lost;
    }

    // ---------- 繪製 ----------
    function frame(caption, line, opt = {}) {
      const nodes = [], edges = [], labels = [];
      const slotSt = opt.slotSt || {}, st = opt.st || {};
      let maxLen = 0;
      for (let i = 0; i < m; i++) {
        const chain = method === "chain";   // chaining 的 slot 本身是空的 bucket，索引寫在格子裡，避免和往下的箭頭重疊
        nodes.push({ id: "slot" + i, shape: "box", x: sx(i), y: SY, w: bw(), h: 42, state: slotSt[i] || "ghost", label: chain ? String(i) : "", sub: chain ? "" : String(i) });
      }
      if (method === "chain") {
        B.forEach((c, i) => {
          maxLen = Math.max(maxLen, c.length);
          c.forEach((n, j) => {
            const y = SY + 92 + j * 50;
            nodes.push({ id: n.id, label: n.v, shape: "box", x: sx(i), y, w: bw() - 4, h: 32, state: st[n.id] || "default" });
            edges.push({ from: j === 0 ? "slot" + i : c[j - 1].id, to: n.id, directed: true, state: st["e" + n.id] || "default" });
          });
        });
      } else {
        T.forEach((c, i) => {
          if (!c) return;
          const p = opt.pos && opt.pos[c.id] !== undefined ? opt.pos[c.id] : i;
          nodes.push(c.tomb
            ? { id: c.id, label: "DEL", shape: "box", x: sx(p), y: SY, w: bw() - 8, h: 32, state: st[c.id] || "muted" }
            : { id: c.id, label: c.v, shape: "box", x: sx(p), y: SY, w: bw() - 8, h: 32, state: st[c.id] || "default" });
        });
      }
      if (opt.fl) nodes.push({ id: opt.fl.id, label: opt.fl.v, shape: "box", x: sx(opt.fl.at), y: SY - 64, w: bw() - 8, h: 32, state: opt.fl.state || "active" });
      (opt.extra || []).forEach((n) => nodes.push(n));

      labels.push({ id: "t-f", x: 20, y: 26, text: NAME[method] + "：" + FORMULA[method], cls: "title", anchor: "start" });
      const n = size();
      labels.push({ id: "t-s", x: 20, y: 52, text: `m = ${m}　n = ${n}　α = n / m = ${(n / m).toFixed(2)}` + (method !== "chain" ? `　刪除：${del === "tomb" ? "tombstone" : "搬移補位"}` : ""), anchor: "start" });
      if (opt.warn) labels.push({ id: "t-w", x: W - 20, y: 52, text: opt.warn, cls: "warn", anchor: "end" });
      if (opt.ok) labels.push({ id: "t-o", x: W - 20, y: 52, text: opt.ok, cls: "ok", anchor: "end" });
      let height = 270;
      if (method === "chain") height = Math.max(270, SY + 92 + Math.max(0, maxLen - 1) * 50 + 40);
      else if (opt.seq && opt.seq.length) {
        labels.push({ id: "t-q", x: W / 2, y: 232, text: "探測序列：" + opt.seq.join(" → "), anchor: "middle", cls: "strong" });
      }
      return { nodes, edges, pointers: [], labels, caption, line, height };
    }
    // Recorder 外包一層：依 frame 的高度調整畫面
    function rec() {
      const r = new Recorder();
      return { push: (f) => r.push(f), frames: r.frames };
    }
    function load(frames, opts) {
      const hmax = frames.reduce((s, f) => Math.max(s, f.height || 270), 270);
      player.resize(W, hmax);
      player.load(frames, opts);
    }

    // ---------- open addressing ----------
    function oaInsert(v) {
      const r = rec(), I = "int insert(int k)";
      const id = nid(), h = hOf(v, m);
      const seq = [];
      let tomb = -1;
      const h2txt = method === "double" ? `，h2(${v}) = 1 + ${v} % ${m - 2} = <b>${h2Of(v, m)}</b>` : "";
      r.push(frame(`insert(${esc(v)})：h(${v}) = ${v} % ${m} = <b>${h}</b>${h2txt}。從 i = 0 開始依探測序列找位置。`, ln("int h(int k)"), { fl: { id, v, at: h } }));
      for (let i = 0; i < m; i++) {
        const p = probeAt(method, v, i, m), c = T[p];
        seq.push(p);
        const where = `i = ${i}：${probeText(method, v, i, m)}。`;
        const lp = [ln("int idx = probe(k, i);", I), ln("return", SRC[method][0].slice(0, 20))];
        if (c && !c.tomb && c.v === v) {
          r.push(frame(where + `第 ${p} 格就是 ${v}，<b>已經在表裡</b>，不重複放。`, ln("if (table[idx] == k) return idx;", I), { fl: { id, v, at: p, state: "found" }, slotSt: { [p]: "compare" }, st: { [c.id]: "found" }, seq, ok: "已存在" }));
          return r.frames;
        }
        if (c && c.tomb) {
          if (tomb < 0) {
            tomb = p;
            r.push(frame(where + `第 ${p} 格是 <b>tombstone</b>，先記下 tomb = ${p}；還不能直接放，因為 ${v} 可能在後面，要繼續找到 EMPTY 才能確定不存在。`, ln("if (tomb == -1) tomb = idx;", I), { fl: { id, v, at: p }, slotSt: { [p]: "compare" }, seq }));
          } else {
            r.push(frame(where + `第 ${p} 格也是 tombstone，已經記過第 ${tomb} 格了，繼續。`, lp, { fl: { id, v, at: p }, slotSt: { [p]: "compare" }, seq }));
          }
          continue;
        }
        if (c) {
          r.push(frame(where + `第 ${p} 格已被 ${c.v} 占了（<b>碰撞</b>），繼續探測下一個位置。`, lp, { fl: { id, v, at: p }, slotSt: { [p]: "compare" }, st: { [c.id]: "compare" }, seq }));
          continue;
        }
        // EMPTY
        if (tomb >= 0) {
          r.push(frame(where + `第 ${p} 格是 EMPTY，確定 ${v} 不在表中；放回路上第一個 tombstone：第 <b>${tomb}</b> 格。`, ln("if (tomb != -1) idx = tomb;", I), { fl: { id, v, at: p }, slotSt: { [p]: "compare", [tomb]: "compare" }, seq }));
          T[tomb] = { id, v };
          order.push(v);
          r.push(frame(`把 ${v} 放進第 ${tomb} 格，重複利用被刪除的位置。共探測 ${i + 1} 次。`, ln("table[idx] = k;", I), { st: { [id]: "new" }, seq }));
          return r.frames;
        }
        T[p] = { id, v };
        order.push(v);
        r.push(frame(where + `第 ${p} 格是空的，把 <b>${v}</b> 放進去。共探測 ${i + 1} 次` + (i ? `，碰撞 ${i} 次。` : "，沒有碰撞。"), ln("table[idx] = k;", I), { slotSt: { [p]: "compare" }, st: { [id]: "new" }, seq }));
        return r.frames;
      }
      if (tomb >= 0) {
        T[tomb] = { id, v };
        order.push(v);
        r.push(frame(`探測了 m = ${m} 次都沒有 EMPTY，但路上有 tombstone，放進第 ${tomb} 格。`, ln("if (tomb != -1) { table[tomb] = k; return tomb; }", I), { st: { [id]: "new" }, seq }));
        return r.frames;
      }
      const distinct = new Set(seq).size;
      const why = distinct < m ? `這 ${m} 次探測只看了 ${distinct} 個不同的格子（序列會重複），即使表還有 ${m - size()} 格空位也碰不到。` : "表已經滿了。";
      r.push(frame(`探測了 m = ${m} 次都沒有位置，<b>插入失敗</b>。${why}`, ln("/* 探測 M 次都沒有位置 */", I), { fl: { id, v, at: seq[seq.length - 1], state: "removed" }, seq, warn: "插入失敗" }));
      return r.frames;
    }

    // 搜尋過程；回傳 {frames, at}；prefix 是 caption 前綴（delete 會用）
    function oaSearchInto(r, v, prefix) {
      const S = "int search(int k)", sid = "q" + uid++, h = hOf(v, m), seq = [];
      r.push(frame(`${prefix}search(${esc(v)})：h(${v}) = ${v} % ${m} = <b>${h}</b>` + (method === "double" ? `，h2 = ${h2Of(v, m)}` : "") + "。", ln("int h(int k)"), { fl: { id: sid, v, at: h, state: "compare" } }));
      for (let i = 0; i < m; i++) {
        const p = probeAt(method, v, i, m), c = T[p];
        seq.push(p);
        const where = `i = ${i}：${probeText(method, v, i, m)}。`;
        if (!c) {
          r.push(frame(where + `第 ${p} 格是 <b>EMPTY</b>：插入時 ${v} 一定會停在第一個空位，所以它不可能在更後面，<b>找不到</b>。`, ln("if (table[idx] == EMPTY) return -1;", S), { fl: { id: sid, v, at: p, state: "removed" }, slotSt: { [p]: "removed" }, seq, warn: "找不到" }));
          return -1;
        }
        if (!c.tomb && c.v === v) {
          r.push(frame(where + `第 ${p} 格就是 ${v}，<b>找到</b>，共探測 ${i + 1} 次。`, ln("if (table[idx] == k) return idx;", S), { fl: { id: sid, v, at: p, state: "found" }, slotSt: { [p]: "found" }, st: { [c.id]: "found" }, seq, ok: "找到" }));
          return p;
        }
        const what = c.tomb ? `是 <b>tombstone</b>：這裡曾經有 key，${v} 可能是當時被擠到後面的，<b>不能停</b>，繼續探測。` : `是 ${c.v}，不是 ${v}，繼續探測。`;
        r.push(frame(where + `第 ${p} 格` + what, ln("/* 別的 key 或 DELETED", S), { fl: { id: sid, v, at: p, state: "compare" }, slotSt: { [p]: "compare" }, st: { [c.id]: "compare" }, seq }));
      }
      r.push(frame(`探測了 m = ${m} 次都沒找到 ${v}（沒有碰到 EMPTY，表裡全是 key 或 tombstone），<b>找不到</b>。`, ln("return -1;", "/* 別的 key 或 DELETED"), { seq, warn: "找不到" }));
      return -1;
    }
    function oaSearch(v) { const r = rec(); oaSearchInto(r, v, ""); return r.frames; }

    function oaDeleteTomb(v) {
      const r = rec(), R = "int removeKey(int k)";
      const p = oaSearchInto(r, v, `delete(${esc(v)})：先 `);
      if (p < 0) {
        r.push(frame(`${v} 不在表中，不用刪除。`, ln("if (idx == -1) return 0;", R), { warn: "找不到" }));
        return r.frames;
      }
      const c = T[p];
      r.push(frame(`在第 ${p} 格找到 ${v}，準備刪除。`, ln("int idx = search(k);", R), { st: { [c.id]: "removed" }, slotSt: { [p]: "removed" } }));
      T[p] = { id: c.id, tomb: true };
      order = order.filter((x) => x !== v);
      r.push(frame(`第 ${p} 格標成 <b>DELETED</b>（tombstone），不能設回 EMPTY：之後搜尋經過這裡要繼續往下找，插入時可以重複利用這一格。`, ln("table[idx] = DELETED;", R), { slotSt: { [p]: "muted" } }));
      return r.frames;
    }

    function oaDeleteShift(v) {
      const r = rec(), R = "int removeShift(int k)";
      const p = oaSearchInto(r, v, `delete(${esc(v)})：先 `);
      if (p < 0) {
        r.push(frame(`${v} 不在表中，不用刪除。`, ln("if (hole == -1) return 0;", R), { warn: "找不到" }));
        return r.frames;
      }
      const c = T[p];
      T[p] = null;
      order = order.filter((x) => x !== v);
      let hole = p;
      r.push(frame(`在第 ${p} 格找到 ${v}，直接清成 EMPTY，挖出一個<b>洞</b>（hole = ${hole}）。接下來檢查同一串後面的 key，看誰的探測路徑經過這個洞。`, ln("table[hole] = EMPTY;", R), { slotSt: { [hole]: "removed" }, extra: [{ id: c.id, label: c.v, shape: "box", x: sx(p), y: SY - 64, w: bw() - 8, h: 32, state: "removed" }] }));
      let moved = 0, j = (hole + 1) % m;
      for (let guard = 0; T[j] && guard < m; j = (j + 1) % m, guard++) {
        const x = T[j], home = hOf(x.v, m);
        if (x.tomb) break;   // 搬移補位模式下表中不會有 tombstone（切換時已重建）
        if (between(hole, home, j)) {
          r.push(frame(`第 ${j} 格 ${x.v} 的 home = ${home}，落在 (${hole}, ${j}] 之間（環狀）：它從 home 走到 ${j} 的路上沒經過洞，<b>不動</b>。`, ln("if (!between(hole, h(table[j]), j))", R), { slotSt: { [hole]: "removed", [j]: "compare" }, st: { [x.id]: "compare" } }));
          continue;
        }
        r.push(frame(`第 ${j} 格 ${x.v} 的 home = ${home}，<b>不在</b> (${hole}, ${j}] 之間：它當初是從 home 一路經過第 ${hole} 格才走到 ${j}，洞會讓搜尋提早停，所以要補進洞裡。`, ln("if (!between(hole, h(table[j]), j))", R), { slotSt: { [hole]: "removed", [j]: "compare" }, st: { [x.id]: "active" } }));
        T[hole] = x; T[j] = null;
        moved++;
        r.push(frame(`${x.v} 從第 ${j} 格搬到第 ${hole} 格，洞移到第 ${j} 格。`, [ln("table[hole] = table[j];", R), ln("hole = j;", R)], { slotSt: { [j]: "removed" }, st: { [x.id]: "active" } }));
        hole = j;
      }
      r.push(frame(`第 ${j} 格是 EMPTY，這一串檢查完畢。共搬了 <b>${moved}</b> 個 key，現在的表和「從沒插入過 ${v}」完全一樣，不需要 tombstone。`, ln("return 1;", R), {}));
      return r.frames;
    }

    // ---------- chaining ----------
    function chInsert(v) {
      const r = rec(), I = "void chainInsert(int k)", b = hOf(v, m), c = B[b];
      r.push(frame(`chainInsert(${esc(v)})：h(${v}) = ${v} % ${m} = <b>${b}</b>，到第 ${b} 個 bucket 的串列。`, ln("int b = h(k);", I), { slotSt: { [b]: "compare" } }));
      for (let j = 0; j < c.length; j++) {
        const n = c[j];
        if (n.v === v) {
          r.push(frame(`第 ${j + 1} 個節點就是 ${v}，<b>已經存在</b>，不重複放。`, ln("if (cur->key == k) return;", I), { slotSt: { [b]: "compare" }, st: { [n.id]: "found" }, ok: "已存在" }));
          return r.frames;
        }
        r.push(frame(`比較第 ${j + 1} 個節點 ${n.v} ≠ ${v}，往下一個走（prev = 它）。`, ln("if (cur->key == k) return;", I), { slotSt: { [b]: "compare" }, st: { [n.id]: "compare" } }));
      }
      if (c.length >= MAXCHAIN) {
        r.push(frame(`這條串列已有 ${MAXCHAIN} 個節點，畫面放不下，這個示範限制每串最多 ${MAXCHAIN} 個（程式本身沒有上限，chaining 的 α 可以大於 1）。`, ln("while (cur != NULL) {", I), { slotSt: { [b]: "removed" }, warn: "畫面放不下" }));
        return r.frames;
      }
      const id = nid();
      c.push({ id, v });
      order.push(v);
      r.push(frame(c.length === 1
        ? `第 ${b} 個 bucket 原本是空的，新節點 ${v} 直接當串列的第一個。沒有和任何 key 比較。`
        : `走到串列尾端都沒有 ${v}，配置新節點接在 ${c[c.length - 2].v} 後面。這次比較了 ${c.length - 1} 個節點；chaining 的 key 不會搬到別的 bucket。`,
        c.length === 1 ? [ln("Node *x = malloc", I), ln("if (prev == NULL) bucket[b] = x;", I)] : [ln("Node *x = malloc", I), ln("else prev->next = x;", I)],
        { slotSt: { [b]: "compare" }, st: { [id]: "new" } }));
      return r.frames;
    }
    function chSearch(v) {
      const r = rec(), S = "Node *chainSearch(int k)", b = hOf(v, m), c = B[b];
      r.push(frame(`chainSearch(${esc(v)})：h(${v}) = ${v} % ${m} = <b>${b}</b>，只要找第 ${b} 條串列。`, ln("for (Node *p = bucket[h(k)];", S), { slotSt: { [b]: "compare" } }));
      for (let j = 0; j < c.length; j++) {
        const n = c[j];
        if (n.v === v) {
          r.push(frame(`第 ${j + 1} 個節點就是 ${v}，<b>找到</b>，比較了 ${j + 1} 次。`, ln("if (p->key == k) return p;", S), { slotSt: { [b]: "compare" }, st: { [n.id]: "found" }, ok: "找到" }));
          return r.frames;
        }
        r.push(frame(`第 ${j + 1} 個節點 ${n.v} ≠ ${v}，往下一個。`, ln("if (p->key == k) return p;", S), { slotSt: { [b]: "compare" }, st: { [n.id]: "compare" } }));
      }
      r.push(frame(`整條串列看完（比較了 ${c.length} 個節點）都沒有 ${v}，<b>找不到</b>。失敗搜尋的比較次數 = 串列長度。`, ln("return NULL;", S), { slotSt: { [b]: "removed" }, warn: "找不到" }));
      return r.frames;
    }
    function chDelete(v) {
      const r = rec(), D = "int chainDelete(int k)", b = hOf(v, m), c = B[b];
      r.push(frame(`chainDelete(${esc(v)})：h(${v}) = ${v} % ${m} = <b>${b}</b>，在第 ${b} 條串列找 ${v}，同時記住前一個節點 prev。`, ln("int b = h(k);", D), { slotSt: { [b]: "compare" } }));
      const j = c.findIndex((n) => n.v === v);
      for (let t = 0; t < (j < 0 ? c.length : j); t++) {
        r.push(frame(`${c[t].v} ≠ ${v}，prev = ${c[t].v}，往下一個。`, ln("while (cur != NULL && cur->key != k)", D), { slotSt: { [b]: "compare" }, st: { [c[t].id]: "compare" } }));
      }
      if (j < 0) {
        r.push(frame(`走到串列尾端都沒有 ${v}，不用刪除。`, ln("if (cur == NULL) return 0;", D), { slotSt: { [b]: "removed" }, warn: "找不到" }));
        return r.frames;
      }
      const n = c[j];
      const st = { [n.id]: "removed" };
      r.push(frame(`找到 ${v}（第 ${j + 1} 個節點）。` + (j === 0 ? `它是第一個，bucket[${b}] 直接改指向它的下一個。` : `把 prev（${c[j - 1].v}）的 next 改指向 ${v} 的下一個。`),
        j === 0 ? ln("if (prev == NULL) bucket[b] = cur->next;", D) : ln("else prev->next = cur->next;", D), { slotSt: { [b]: "compare" }, st }));
      c.splice(j, 1);
      order = order.filter((x) => x !== v);
      r.push(frame(`free 掉節點 ${v}，後面的節點往上接。chaining 刪除就是一般的串列刪除，不需要 tombstone。`, ln("free(cur);", D), { slotSt: { [b]: "compare" } }));
      return r.frames;
    }

    const doInsert = (v) => (method === "chain" ? chInsert(v) : oaInsert(v));
    const doSearch = (v) => (method === "chain" ? chSearch(v) : oaSearch(v));
    const doDelete = (v) => (method === "chain" ? chDelete(v) : del === "shift" ? oaDeleteShift(v) : oaDeleteTomb(v));

    function setMethod(mt, d) {
      method = mt;
      del = mt === "linear" ? d : "tomb";
      CODE = codeFor(method, del);
      ln = lineFinder(CODE);
      player.setCode(CODE);
      methodBtn.textContent = "做法：" + NAME[method];
      delBtn.textContent = "刪除：" + (del === "tomb" ? "tombstone" : "搬移補位");
      delBtn.disabled = method === "chain";
    }
    function summary(text, opt) { load([frame(text, null, opt || {})], { autoplay: false }); }

    // ---------- 控制列 ----------
    const input = ui.input(player, { placeholder: "key", value: "71", width: 60 });
    const readKey = () => {
      const v = input.value.trim() === "" ? null : ui.int(input, { min: 0, max: 999 });
      if (v === null) {
        input.classList.add("is-error");
        setTimeout(() => input.classList.remove("is-error"), 700);
        summary(`key 要是 0～999 的整數（目前輸入「${esc(input.value)}」）。`, { warn: "輸入不合法" });
      }
      return v;
    };
    ui.button(player, "insert", () => { const v = readKey(); if (v !== null) load(doInsert(v)); });
    ui.button(player, "search", () => { const v = readKey(); if (v !== null) load(doSearch(v)); });
    ui.button(player, "delete", () => { const v = readKey(); if (v !== null) load(doDelete(v)); });
    const methodBtn = ui.button(player, "", () => {
      const keys = order.slice();
      const next = METHODS[(METHODS.indexOf(method) + 1) % METHODS.length];
      setMethod(next, del);
      const lost = rebuild(keys);
      summary(`改用 <b>${NAME[method]}</b>：把目前的 key 依原本的插入順序重新插入（tombstone 會消失），m 不變，方便比較同一組資料在不同做法下放在哪裡。` + (lost.length ? `其中 ${lost.map(esc).join("、")} 放不進去。` : ""), lost.length ? { warn: "有 key 放不進去" } : {});
    }, "ghost");
    methodBtn.title = "切換碰撞處理的做法";
    const delBtn = ui.button(player, "", () => {
      if (method !== "linear") {
        summary(`搬移補位只適用 <b>linear probing</b>：其他探測法的探測序列不是「往後一格」，無法判斷誰經過了洞，只能用 tombstone。先切換到 linear probing 再試。`, { warn: "只適用 linear" });
        return;
      }
      setMethod(method, del === "tomb" ? "shift" : "tomb");
      const lost = rebuild(order.slice());
      summary(del === "shift"
        ? `刪除改用<b>搬移補位</b>：清空被刪的格子，再把同一串中探測路徑經過洞的 key 往前搬。表中原有的 tombstone 已重建清除。` + (lost.length ? `（${lost.map(esc).join("、")} 放不進去）` : "")
        : `刪除改回 <b>tombstone</b>：被刪的格子標成 DEL，搜尋經過時繼續、插入時可重複利用。`);
    }, "ghost");
    delBtn.title = "切換 open addressing 的刪除做法";
    const mInput = ui.input(player, { placeholder: "m", value: "11", width: 48 });
    mInput.title = "表的大小 m（5～17）";
    ui.button(player, "設定 m", () => {
      const v = ui.int(mInput, { min: 5, max: 17 });
      if (v === null) { summary(`m 要是 5～17 的整數（畫面最多畫 17 格）。`, { warn: "m 不合法" }); return; }
      const keys = order.slice();
      m = v;
      const lost = rebuild(keys);
      summary(`表的大小改成 m = ${m}，所有 key 用新的 h(k) = k % ${m} 重新插入（rehash）。` + (lost.length ? `${lost.map(esc).join("、")} 放不進去。` : "") + (method === "double" && !isPrime(m) ? ` m = ${m} 不是質數，h2 可能和 m 不互質，探測序列走不遍全表。` : ""), lost.length ? { warn: "有 key 放不進去" } : {});
    }, "ghost");
    ui.button(player, "清空", () => { rebuild([]); summary("表已清空。輸入 key 按 insert 開始。"); }, "ghost");

    function example(mt, d, mm, keys, run, intro) {
      setMethod(mt, d);
      m = mm; mInput.value = String(mm);
      rebuild(keys);
      const frames = [];
      run.forEach(([op, v]) => (op === "i" ? doInsert(v) : op === "s" ? doSearch(v) : doDelete(v)).forEach((f) => frames.push(f)));
      frames[0].caption = iconHTML("play") + " " + intro + "<br>" + frames[0].caption;
      load(frames, { autoplay: false });
    }
    const EX = {
      tomb: () => example("linear", "tomb", 11, [27, 38, 49, 16], [["d", 38], ["s", 49], ["i", 71]],
        "示範：27、38、49、16 的 home 都是 5，擠成一串。先 <b>delete(38)</b> 留下 tombstone，再 <b>search(49)</b> 看它如何越過 tombstone，最後 <b>insert(71)</b> 重複利用那一格。"),
      shift: () => example("linear", "shift", 17, [23, 12, 34, 46, 28, 11, 6, 7, 0, 33, 30, 45], [["d", 46]],
        "例：m = 17、linear probing，刪除 46 時不用 tombstone，看哪些 key 要往前補（包括繞回表頭的 45）。"),
      quad: () => example("quad", "tomb", 7, [0, 1, 2, 4], [["i", 7]],
        "例：m = 7、quadratic probing（+i²），表裡只有 4 個 key，第 3、5、6 格都空著，insert(7) 卻放不進去。"),
      dbl: () => example("double", "tomb", 13, [80, 69, 99, 16, 73], [["i", 30], ["i", 41]],
        "例：m = 13、double hashing，h2(k) = 1 + k % 11。看 30、41 碰撞後各自用不同的步長跳。"),
    };
    ui.button(player, "例：tombstone", EX.tomb, "ghost");
    ui.button(player, "例：搬移補位", EX.shift, "ghost");
    ui.button(player, "例：平方探測失敗", EX.quad, "ghost");
    ui.button(player, "例：double hashing", EX.dbl, "ghost");
    input.addEventListener("keydown", (e) => e.key === "Enter" && player.toolbar.querySelector(".vop").click());

    EX.tomb();
    input.value = "60";
  });

  // ===================================================================
  // 靜態圖解
  // ===================================================================
  const box = (id, label, x, y, state, w = 40, h = 34, sub) => ({ id, label, x, y, shape: "box", w, h, state: state || "default", sub });
  function row(pfx, m, y, cells, x0, step, opt = {}) {
    const nodes = [];
    for (let i = 0; i < m; i++) {
      nodes.push(box(pfx + "s" + i, "", x0 + i * step, y, (opt.slot && opt.slot[i]) || "ghost", step - 6, 40, opt.noIdx ? undefined : String(i)));
      if (cells[i] !== null && cells[i] !== undefined) nodes.push(box(pfx + "k" + i, cells[i], x0 + i * step, y, (opt.st && opt.st[i]) || (cells[i] === "DEL" ? "muted" : "default"), step - 14, 30));
    }
    return nodes;
  }
  function simulate(method, m, keys) {
    const T = new Array(m).fill(null), probes = {};
    keys.forEach((k) => {
      for (let i = 0; i < m; i++) { const p = probeAt(method, k, i, m); if (T[p] === null) { T[p] = k; probes[k] = i + 1; break; } }
    });
    return { T, probes };
  }

  // 圖 1：separate chaining
  figure("cr-chaining", () => {
    const m = 7, keys = [15, 8, 22, 4, 11, 13], step = 70, x0 = 130, y = 70;
    const nodes = row("c", m, y, [], x0, step), edges = [], labels = [];
    const B = Array.from({ length: m }, () => []);
    keys.forEach((k) => B[k % m].push(k));
    B.forEach((c, i) => c.forEach((k, j) => {
      nodes.push(box("n" + k, k, x0 + i * step, y + 74 + j * 50, j ? "compare" : "default", 46, 30));
      edges.push({ from: j ? "n" + c[j - 1] : "cs" + i, to: "n" + k, directed: true });
    }));
    labels.push({ id: "l0", x: 20, y: 75, text: "bucket", anchor: "start", cls: "title" });
    labels.push({ id: "l1", x: x0 + 1 * step + 34, y: y + 174, text: "15、8、22 都落在 1：串成一條", anchor: "start" });
    labels.push({ id: "l2", x: 20, y: 300, text: "keys：15, 8, 22, 4, 11, 13　h(k) = k % 7　α = 6 / 7 ≈ 0.86", anchor: "start", cls: "strong" });
    return { width: 640, height: 320, nodes, edges, labels };
  });

  // 圖 2：同一個 home，三種探測序列看的格子
  figure("cr-probe-paths", () => {
    const m = 11, k = 14, step = 44, x0 = 200, nodes = [], labels = [];   // h(14) = 3，h2(14) = 1 + 14 % 9 = 6
    [["linear", "linear probing"], ["quad", "quadratic（+i²）"], ["double", "double（h2 = 6）"]].forEach(([mt, name], r) => {
      const y = 50 + r * 82, cells = new Array(m).fill(null), slot = {};
      for (let i = 0; i < 4; i++) { const p = probeAt(mt, k, i, m); cells[p] = "i=" + i; slot[p] = i === 0 ? "compare" : "visited"; }
      nodes.push(...row("p" + r, m, y, cells, x0, step, { slot, st: slot }));
      const seq = [0, 1, 2, 3].map((i) => probeAt(mt, k, i, m)).join(" → ");
      labels.push({ id: "pn" + r, x: 20, y: y - 2, text: name, anchor: "start", cls: "title" });
      labels.push({ id: "ps" + r, x: 20, y: y + 18, text: seq, anchor: "start" });
    });
    labels.push({ id: "foot", x: 320, y: 290, text: "key = 14，m = 11，h(14) = 3：前 4 次探測的位置", cls: "strong" });
    return { width: 700, height: 310, nodes, labels };
  });

  // 圖 3：primary clustering（linear）vs double hashing，同一組 key
  figure("cr-clustering", () => {
    const m = 11, keys = [16, 27, 38, 49, 6], step = 48, x0 = 170, nodes = [], labels = [];
    [["linear", "linear probing"], ["double", "double hashing"]].forEach(([mt, name], r) => {
      const y = 60 + r * 100, { T, probes } = simulate(mt, m, keys);
      const st = {}; T.forEach((v, i) => { if (v === 6) st[i] = "active"; });
      nodes.push(...row("c" + r, m, y, T, x0, step, { st }));
      labels.push({ id: "cn" + r, x: 20, y: y - 4, text: name, anchor: "start", cls: "title" });
      labels.push({ id: "cp" + r, x: 20, y: y + 16, text: `6 探測 ${probes[6]} 次`, anchor: "start", cls: probes[6] > 2 ? "warn" : "ok" });
    });
    labels.push({ id: "f1", x: 340, y: 262, text: "keys 依序：16, 27, 38, 49（home 都是 5），再放 6（home 6）", cls: "strong" });
    labels.push({ id: "f2", x: 340, y: 288, text: "linear 讓 5～9 連成一串，home 6 的 key 也被拖進去", anchor: "middle" });
    return { width: 700, height: 306, nodes, labels };
  });

  // 圖 4：刪除時設回 EMPTY vs tombstone
  figure("cr-tombstone", () => {
    const m = 11, step = 42, x0 = 250, nodes = [], labels = [];
    const cells = (mid) => { const c = new Array(m).fill(null); c[5] = 27; c[6] = mid; c[7] = 49; return c; };
    const rows = [
      ["(a) 刪除前", cells(38), {}, {}, "27、38、49 的 home 都是 5（m = 11）", ""],
      ["(b) 38 設回 EMPTY", cells(null), { 5: "visited", 6: "removed" }, { 5: "visited" }, "search(49)：5 → 6 是空的，停下來，誤判找不到", "warn"],
      ["(c) 38 標成 DEL", cells("DEL"), { 5: "visited", 6: "visited", 7: "found" }, { 5: "visited", 7: "found" }, "search(49)：5 → 6（DEL，繼續）→ 7 找到", "ok"],
    ];
    rows.forEach(([name, c, slot, st, note, cls], r) => {
      const y = 40 + r * 96;
      nodes.push(...row("t" + r, m, y, c, x0, step, { slot, st }));
      labels.push({ id: "tn" + r, x: 20, y: y + 5, text: name, anchor: "start", cls: "title" });
      labels.push({ id: "tt" + r, x: x0 + 5 * step, y: y + 58, text: note, cls });
    });
    return { width: 700, height: 300, nodes, labels };
  });

  // 圖 5：linear probing 的搬移補位
  figure("cr-shift-delete", () => {
    const m = 10, step = 50, x0 = 140, nodes = [], labels = [], edges = [];
    const before = [null, null, 12, 22, 3, 32, 6, null, null, null];
    const after = [null, null, 12, 3, 32, null, 6, null, null, null];
    nodes.push(...row("a", m, 60, before, x0, step, { st: { 3: "removed", 4: "active", 5: "active" } }));
    nodes.push(...row("b", m, 200, after, x0, step, { st: { 3: "active", 4: "active" } }));
    edges.push({ from: "ak4", to: "bk3", directed: true, dashed: true, state: "active" });
    edges.push({ from: "ak5", to: "bk4", directed: true, dashed: true, state: "active" });
    labels.push({ id: "s1", x: 20, y: 58, text: "刪除 22 前", anchor: "start", cls: "title" });
    labels.push({ id: "s2", x: 20, y: 198, text: "搬移補位後", anchor: "start", cls: "title" });
    labels.push({ id: "n1", x: x0 + 7 * step - 10, y: 116, text: "6 的 home 就是 6：不動", anchor: "start" });
    labels.push({ id: "n2", x: 360, y: 268, text: "home：12→2、22→3、3→3、32→2、6→6；3、32 的路徑經過第 3 格，往前補", cls: "strong" });
    return { width: 700, height: 286, nodes, edges, labels };
  });
})();
