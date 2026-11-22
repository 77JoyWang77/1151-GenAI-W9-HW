/* =====================================================================
   BFS & DFS（廣度與深度優先搜尋）主題的視覺化
   - graph-search : 輸入無向圖的邊與起點，切換 BFS／DFS（遞迴）／DFS（stack），
                    看 queue 或 stack 的內容、visited、走訪順序與生成樹的邊
   ===================================================================== */
(function () {
  "use strict";
  const { Player, Recorder, ui, register, esc, iconHTML, figure } = window.DSViz;

  // 右側程式碼：從 code/data-structures/bfs-dfs.c 原封不動取出
  const CODE = {
    bfs: [
      "void bfs(int s) {",
      "  int queue[MAXV], front = 0, rear = 0;",
      "  visited[s] = 1;                        /* 起點先標記再放進 queue */",
      "  dist[s] = 0;",
      "  queue[rear++] = s;",
      "  while (front < rear) {",
      "    int v = queue[front++];              /* 取出 queue 前端 */",
      "    printf(\"%d \", v);",
      "    for (Node *p = list[v]; p != NULL; p = p->next) {",
      "      int w = p->v;",
      "      if (!visited[w]) {                 /* 第一次看到 w：標記、記父節點、放進 queue */",
      "        visited[w] = 1;",
      "        dist[w] = dist[v] + 1;",
      "        parent[w] = v;                   /* (v, w) 是 BFS 生成樹的樹邊 */",
      "        queue[rear++] = w;",
      "      }",
      "    }",
      "  }",
      "}"
    ],
    dfs: [
      "void dfs(int v) {",
      "  visited[v] = 1;",
      "  d[v] = ++timer;                        /* 發現時間 */",
      "  printf(\"%d \", v);",
      "  for (Node *p = list[v]; p != NULL; p = p->next)",
      "    if (!visited[p->v]) {",
      "      parent[p->v] = v;                  /* (v, w) 是 DFS 生成樹的樹邊 */",
      "      dfs(p->v);",
      "    }",
      "  f[v] = ++timer;                        /* 完成時間：v 的相鄰點都處理完了 */",
      "}"
    ],
    stack: [
      "void dfsStack(int s) {",
      "  int stack[MAXV], top = -1;",
      "  Node *cur[MAXV];                       /* cur[v]：v 的串列下一個要檢查的位置 */",
      "  for (int i = 0; i < n; i++) cur[i] = list[i];",
      "  visited[s] = 1;",
      "  printf(\"%d \", s);",
      "  stack[++top] = s;",
      "  while (top != -1) {",
      "    int v = stack[top];                  /* 看 stack 頂端，先不 pop */",
      "    while (cur[v] != NULL && visited[cur[v]->v])",
      "      cur[v] = cur[v]->next;             /* 跳過已經拜訪過的相鄰點 */",
      "    if (cur[v] == NULL) {                /* v 沒有路可走了：pop，退回上一個頂點 */",
      "      top--;",
      "      continue;",
      "    }",
      "    int w = cur[v]->v;",
      "    visited[w] = 1;",
      "    parent[w] = v;",
      "    printf(\"%d \", w);",
      "    stack[++top] = w;                    /* 往更深的 w 走 */",
      "  }",
      "}"
    ],
  };
  const ln = (code, s) => code.findIndex((l) => l.includes(s)) + 1;
  const LB = {
    init: [ln(CODE.bfs, "visited[s] = 1;"), ln(CODE.bfs, "dist[s] = 0;"), ln(CODE.bfs, "queue[rear++] = s;")],
    deq: [ln(CODE.bfs, "int v = queue[front++];"), ln(CODE.bfs, "printf(")],
    scan: [ln(CODE.bfs, "for (Node *p = list[v]"), ln(CODE.bfs, "int w = p->v;"), ln(CODE.bfs, "if (!visited[w])")],
    enq: [ln(CODE.bfs, "visited[w] = 1;"), ln(CODE.bfs, "dist[w] = dist[v] + 1;"), ln(CODE.bfs, "parent[w] = v;"), ln(CODE.bfs, "queue[rear++] = w;")],
  };
  const LD = {
    enter: [ln(CODE.dfs, "visited[v] = 1;"), ln(CODE.dfs, "d[v] = ++timer;"), ln(CODE.dfs, "printf(")],
    scan: [ln(CODE.dfs, "for (Node *p = list[v]"), ln(CODE.dfs, "if (!visited[p->v])")],
    call: [ln(CODE.dfs, "parent[p->v] = v;"), ln(CODE.dfs, "dfs(p->v);")],
    finish: [ln(CODE.dfs, "f[v] = ++timer;")],
  };
  const LS = {
    init: [ln(CODE.stack, "visited[s] = 1;"), ln(CODE.stack, "printf(\"%d \", s);"), ln(CODE.stack, "stack[++top] = s;")],
    scan: [ln(CODE.stack, "int v = stack[top];"), ln(CODE.stack, "while (cur[v] != NULL"), ln(CODE.stack, "cur[v] = cur[v]->next;")],
    push: [ln(CODE.stack, "int w = cur[v]->v;"), ln(CODE.stack, "visited[w] = 1;"), ln(CODE.stack, "parent[w] = v;"), ln(CODE.stack, "printf(\"%d \", w);"), ln(CODE.stack, "stack[++top] = w;")],
    pop: [ln(CODE.stack, "if (cur[v] == NULL)"), ln(CODE.stack, "top--;")],
  };

  const W = 680, H = 420, MAXV = 10, MAXE = 20;
  // 範例圖的手排座標；自訂的圖改用橢圓排列
  const PRESET = {
    demo: { text: "0-1 0-3 1-2 1-4 2-5 3-4 4-5 4-6 5-7 6-7", start: 0,
      pos: [[160, 60], [300, 60], [440, 60], [160, 165], [300, 165], [440, 165], [370, 265], [510, 265]] },
    split: { text: "0-2 2-4 4-0 1-5 3-6 6-7 3-7", start: 0,
      pos: [[110, 70], [330, 70], [230, 140], [470, 70], [110, 230], [330, 230], [570, 70], [570, 230]] },
  };
  const ellipse = (n) => Array.from({ length: n }, (_, k) => {
    const a = -Math.PI / 2 + (2 * Math.PI * k) / n;
    return [340 + 250 * Math.cos(a), 160 + 110 * Math.sin(a)];
  });
  const eid = (a, b) => (a < b ? [a, b] : [b, a]);

  register("graph-search", function (root) {
    const player = new Player(root, {
      title: "BFS & DFS 圖的走訪",
      width: W, height: H, code: CODE.bfs,
      legend: [["compare", "目前處理的頂點／正在檢查的邊"], ["active", "在 queue／stack 裡"], ["found", "處理完／生成樹的邊"], ["default", "還沒拜訪"]],
    });

    let n = 0, edges = [], adj = [], pos = [], mode = "bfs";

    function parse(text, startText) {
      const toks = text.trim().split(/[\s,]+/).filter(Boolean);
      if (!toks.length) return "請輸入至少一條邊，格式像 0-1 1-2。";
      if (toks.length > MAXE) return `最多 ${MAXE} 條邊，畫面才放得下。`;
      const seen = new Set(), es = [];
      let mx = 0;
      for (const t of toks) {
        const m = /^(\d+)-(\d+)$/.exec(t);
        if (!m) return `「${esc(t)}」格式不對，每條邊要寫成「頂點-頂點」，例如 2-5。`;
        const a = +m[1], b = +m[2];
        if (a >= MAXV || b >= MAXV) return `頂點編號請用 0～${MAXV - 1}（最多 ${MAXV} 個頂點）：「${esc(t)}」超出範圍。`;
        if (a === b) return `「${esc(t)}」是自己連到自己（self-loop），這裡只處理簡單圖。`;
        const [x, y] = eid(a, b), k = x + "-" + y;
        if (seen.has(k)) return `邊 ${x}-${y} 重複輸入了。`;
        seen.add(k); es.push([x, y]); mx = Math.max(mx, a, b);
      }
      const s = Number(startText.trim());
      if (!/^\d+$/.test(startText.trim()) || s > mx) return `起點請輸入 0～${mx} 之間的頂點編號。`;
      return { n: mx + 1, es, s };
    }

    function setGraph(g, p) {
      n = g.n; edges = g.es;
      adj = Array.from({ length: n }, () => []);
      edges.forEach(([a, b]) => { adj[a].push(b); adj[b].push(a); });
      adj.forEach((l) => l.sort((x, y) => x - y));    // 相鄰點由小到大
      pos = p || ellipse(n);
    }

    // ---------- 繪製 ----------
    // m: { st: 頂點狀態, tree: Set("a-b"), chk: [v,w], sub: [], strip: {name, items, note}, out: [] }
    function frame(caption, line, m) {
      const nodes = [], es = [], labels = [], pointers = [];
      for (let v = 0; v < n; v++) {
        const deg = adj[v].length;
        nodes.push({ id: "v" + v, label: String(v), x: pos[v][0], y: pos[v][1], r: 19,
          state: m.st[v] || (deg ? "default" : "muted"), sub: m.sub[v] || "" });
      }
      edges.forEach(([a, b]) => {
        const k = a + "-" + b, c = m.chk && eid(m.chk[0], m.chk[1]).join("-") === k;
        es.push({ from: "v" + a, to: "v" + b, state: c ? "compare" : m.tree.has(k) ? "found" : "default" });
      });
      const SY = 350;
      labels.push({ id: "sname", x: 24, y: SY, text: m.strip.name, cls: "title", anchor: "start" });
      m.strip.items.forEach((v, k) => nodes.push({ id: "q" + v, label: String(v), shape: "box", x: 132 + k * 44, y: SY, w: 38, h: 30,
        state: k === m.strip.hi ? "compare" : "active" }));
      if (!m.strip.items.length) labels.push({ id: "sempty", x: 112, y: SY, text: "（空）", anchor: "start" });
      labels.push({ id: "snote", x: W - 24, y: 396, text: m.strip.note, anchor: "end" });
      labels.push({ id: "out", x: 24, y: 396, text: "走訪順序：" + m.out.join(" "), cls: "strong", anchor: "start" });
      return { nodes, edges: es, pointers, labels, caption, line };
    }

    const nb = (v, skip) => adj[v].map((w) => (skip.includes(w) ? `<s>${w}</s>` : String(w))).join("、");

    // ---------- BFS ----------
    function bfs(s) {
      player.setCode(CODE.bfs);
      const r = new Recorder(), st = {}, sub = [], tree = new Set(), out = [], q = [], dist = [];
      const visited = new Array(n).fill(false);
      const strip = (hi) => ({ name: "queue：", items: q.slice(), hi, note: "左 front（先出）→ 右 rear（後進）" });
      const M = (o) => Object.assign({ st: Object.assign({}, st), sub: sub.slice(), tree: new Set(tree), out: out.slice(), strip: strip(-1) }, o);
      visited[s] = true; dist[s] = 0; q.push(s); st[s] = "active"; sub[s] = "dist 0";
      r.push(frame(`BFS 從頂點 <b>${s}</b> 出發：先把它標成 visited、dist = 0，放進 queue。<b>一放進 queue 就標記</b>，同一個頂點才不會被放兩次。`, LB.init, M({})));
      while (q.length) {
        const v = q.shift();
        out.push(v); st[v] = "compare";
        const skip = adj[v].filter((w) => visited[w]);
        r.push(frame(`從 queue 前端取出 <b>${v}</b>（dist ${dist[v]}）並輸出。它的相鄰點依編號由小到大是：${adj[v].length ? nb(v, skip) : "（沒有）"}${skip.length ? `；畫刪除線的已經 visited，直接跳過` : ""}。`, LB.deq, M({ cur: v })));
        adj[v].forEach((w) => {
          if (visited[w]) return;
          visited[w] = true; dist[w] = dist[v] + 1; q.push(w); st[w] = "active"; sub[w] = "dist " + dist[w];
          tree.add(eid(v, w).join("-"));
          r.push(frame(`<b>${w}</b> 還沒被看過：標記 visited，dist[${w}] = dist[${v}] + 1 = ${dist[w]}，parent[${w}] = ${v}，放到 queue 尾端。邊 (${v}, ${w}) 成為 BFS 生成樹的樹邊。`, LB.enq, M({ cur: v, chk: [v, w], strip: strip(q.length - 1) })));
        });
        st[v] = "found";
      }
      const miss = [];
      for (let v = 0; v < n; v++) if (!visited[v]) miss.push(v);
      r.push(frame(`queue 空了，BFS 結束：<b>${out.join(" ")}</b>。綠色的 ${tree.size} 條邊就是 BFS 生成樹（${out.length} 個頂點 − 1）；每個頂點下方的 dist 是從 ${s} 出發的<b>最少邊數</b>。${miss.length ? `頂點 ${miss.join("、")} 走不到，代表它們和 ${s} 不在同一個連通元件。` : ""}`, null, M({})));
      return r.frames;
    }

    // ---------- DFS（遞迴 / stack 版共用；stack 內容 = 遞迴呼叫路徑） ----------
    function dfs(s, useStack) {
      const code = useStack ? CODE.stack : CODE.dfs;
      player.setCode(code);
      const r = new Recorder(), st = {}, sub = [], tree = new Set(), out = [], stk = [];
      const visited = new Array(n).fill(false), d = [], f = [];
      let timer = 0;
      const strip = () => ({ name: useStack ? "stack：" : "呼叫堆疊：", items: stk.slice(), hi: stk.length - 1, note: useStack ? "左 底 → 右 top" : "左 dfs(起點) → 右 正在執行的 dfs" });
      const M = (o) => Object.assign({ st: Object.assign({}, st), sub: sub.slice(), tree: new Set(tree), out: out.slice(), strip: strip() }, o);
      const tag = (v) => (useStack ? "" : (f[v] ? `${d[v]}/${f[v]}` : `${d[v]}/`));
      const visit = (v, from) => {
        visited[v] = true; d[v] = ++timer; out.push(v); stk.push(v); st[v] = "compare";
        if (from != null) { st[from] = "active"; tree.add(eid(from, v).join("-")); }
        sub[v] = tag(v);
        const why = from == null
          ? `DFS 從頂點 <b>${s}</b> 出發：標記 visited、輸出${useStack ? "，push 進 stack" : `，發現時間 d[${s}] = ${d[v]}`}。`
          : `${from} 的相鄰點中，編號最小、還沒拜訪的是 <b>${v}</b>：${useStack ? "標記、輸出，push 進 stack" : `呼叫 dfs(${v})，d[${v}] = ${d[v]}`}。邊 (${from}, ${v}) 是 DFS 生成樹的樹邊；${from} 先暫停，<b>能往深處走就先往深處走</b>。`;
        r.push(frame(why, from == null ? (useStack ? LS.init : LD.enter) : (useStack ? LS.push : LD.call.concat(LD.enter)), M({ cur: v, chk: from != null ? [from, v] : null })));
      };
      visit(s, null);
      while (stk.length) {
        const v = stk[stk.length - 1];
        const w = adj[v].find((x) => !visited[x]);
        if (w !== undefined) { visit(w, v); continue; }
        stk.pop(); f[v] = ++timer; st[v] = "found"; sub[v] = tag(v);
        const back = stk.length ? stk[stk.length - 1] : null;
        if (back != null) st[back] = "compare";
        const why = `${v} 的相鄰點 ${adj[v].join("、") || "（沒有）"} 都已經 visited，沒有路可走：` +
          (useStack ? `pop ${v}` : `dfs(${v}) 結束，完成時間 f[${v}] = ${f[v]}`) +
          (back != null ? `，退回 <b>${back}</b> 繼續看它剩下的相鄰點。` : `。stack 空了，整個 DFS 結束。`);
        r.push(frame(why, useStack ? LS.scan.concat(LS.pop) : LD.scan.concat(LD.finish), M({ cur: back })));
      }
      const miss = [];
      for (let v = 0; v < n; v++) if (!visited[v]) miss.push(v);
      r.push(frame(`DFS 結束：<b>${out.join(" ")}</b>。綠色的 ${tree.size} 條邊是 DFS 生成樹${useStack ? "" : "，頂點下方是「發現時間 / 完成時間」，子孫的區間一定包在祖先的區間裡"}。${miss.length ? `頂點 ${miss.join("、")} 走不到，屬於別的連通元件。` : ""}`, null, M({})));
      return r.frames;
    }

    // ---------- 控制列 ----------
    const inE = ui.input(player, { placeholder: "邊，例如 0-1 1-2", value: PRESET.demo.text, width: 230 });
    const inS = ui.input(player, { placeholder: "起點", value: "0", width: 52 });
    let lastText = null, lastPos = null;
    function go(m, preset) {
      mode = m || mode;
      if (preset) { inE.value = preset.text; inS.value = String(preset.start); }
      const g = parse(inE.value, inS.value);
      if (typeof g === "string") {
        const el = /起點/.test(g) ? inS : inE;
        el.classList.add("is-error"); setTimeout(() => el.classList.remove("is-error"), 700);
        n = 0; edges = []; adj = [];
        player.load([frame(`${iconHTML("alert")} ${g}`, null, { st: {}, sub: [], tree: new Set(), out: [], strip: { name: "", items: [], note: "" } })], { autoplay: false });
        return null;
      }
      const p = preset ? preset.pos : (inE.value === lastText ? lastPos : null);
      setGraph(g, p && p.length >= g.n ? p : null);
      lastText = inE.value; lastPos = pos;
      const fr = mode === "bfs" ? bfs(g.s) : dfs(g.s, mode === "stack");
      player.load(fr, { autoplay: !preset || preset.auto !== false });
      return fr;
    }
    ui.button(player, "BFS", () => go("bfs"));
    ui.button(player, "DFS（遞迴）", () => go("dfs"));
    ui.button(player, "DFS（stack）", () => go("stack"));
    ui.button(player, "範例圖", () => go(null, PRESET.demo), "ghost");
    ui.button(player, "非連通圖", () => go(null, PRESET.split), "ghost");
    [inE, inS].forEach((el) => el.addEventListener("keydown", (e) => e.key === "Enter" && go()));

    const demo = go("bfs", Object.assign({ auto: false }, PRESET.demo));
    demo[0].caption = iconHTML("play") + " 按播放看示範：範例圖從頂點 0 做 BFS，相鄰點由小到大。橘色是 queue 裡的頂點、綠色邊是 BFS 生成樹、頂點下方是最少邊數 dist。按「DFS（遞迴）」看同一張圖的 DFS（頂點下方換成發現 / 完成時間）；也可以改起點、輸入自己的邊。";
    player.load(demo, { autoplay: false });
  });

  // ===================================================================
  // 靜態圖解
  // ===================================================================
  const G = [[0, 1], [0, 3], [1, 2], [1, 4], [2, 5], [3, 4], [4, 5], [4, 6], [5, 7], [6, 7]];
  const P = [[160, 60], [300, 60], [440, 60], [160, 165], [300, 165], [440, 165], [370, 265], [510, 265]];
  const circ = (id, label, x, y, st, sub) => ({ id, label: String(label), x, y, r: 18, state: st || "default", sub: sub || "" });
  const box = (id, label, x, y, w, st) => ({ id, label, shape: "box", x, y, w, h: 28, state: st || "default" });

  // 圖 1：範例圖與它的相鄰串列（由小到大）
  figure("bfs-dfs-graph", () => {
    const nodes = [], edges = [], labels = [];
    const S = 0.62, OX = -40, OY = 20;
    P.forEach(([x, y], v) => nodes.push(circ("g" + v, v, OX + x * S + 40, OY + y * S + 30)));
    G.forEach(([a, b]) => edges.push({ from: "g" + a, to: "g" + b }));
    const adj = P.map(() => []);
    G.forEach(([a, b]) => { adj[a].push(b); adj[b].push(a); });
    adj.forEach((l) => l.sort((x, y) => x - y));
    labels.push({ id: "t1", x: 190, y: 22, text: "(a) 範例圖：8 個頂點、10 條邊", cls: "strong" });
    labels.push({ id: "t2", x: 520, y: 22, text: "(b) 相鄰串列（由小到大）", cls: "strong" });
    adj.forEach((l, v) => {
      const y = 56 + v * 30;
      nodes.push(box("h" + v, `${v}`, 400, y, 34, "compare"));
      l.forEach((w, k) => {
        nodes.push(box(`a${v}_${k}`, String(w), 452 + k * 46, y, 34));
        edges.push({ from: k ? `a${v}_${k - 1}` : "h" + v, to: `a${v}_${k}`, directed: true });
      });
    });
    labels.push({ id: "t3", x: 190, y: 262, text: "共 2 × 10 = 20 個串列節點：無向邊兩端各記一次", anchor: "middle" });
    return { width: 680, height: 290, nodes, edges, labels };
  });

  // 圖 2：BFS 樹與 DFS 樹
  figure("bfs-dfs-trees", () => {
    const nodes = [], edges = [], labels = [];
    // BFS：依 dist 分層
    const lvl = [[0], [1, 3], [2, 4], [5, 6], [7]];
    const bp = {};
    lvl.forEach((row, d) => row.forEach((v, k) => { bp[v] = [70 + (k - (row.length - 1) / 2) * 90 + 90, 60 + d * 58]; }));
    const bTree = new Set(["0-1", "1-2", "0-3", "1-4", "2-5", "4-6", "5-7"]);
    Object.keys(bp).forEach((v) => nodes.push(circ("b" + v, v, bp[v][0], bp[v][1], "default")));
    G.forEach(([a, b]) => edges.push({ from: "b" + a, to: "b" + b, state: bTree.has(a + "-" + b) ? "found" : "muted" }));
    lvl.forEach((row, d) => labels.push({ id: "bl" + d, x: 20, y: 60 + d * 58, text: "dist " + d, anchor: "start" }));
    labels.push({ id: "bt", x: 160, y: 22, text: "(a) BFS 樹：又寬又矮", cls: "strong" });
    // DFS：沿著遞迴深度往下
    const dp = { 0: [380, 50], 1: [420, 100], 2: [460, 150], 5: [500, 200], 4: [460, 255], 3: [400, 305], 6: [520, 305], 7: [600, 250] };
    const dTree = new Set(["0-1", "1-2", "2-5", "4-5", "3-4", "4-6", "6-7"]);
    const df = { 0: "1/16", 1: "2/15", 2: "3/14", 5: "4/13", 4: "5/12", 3: "6/7", 6: "8/11", 7: "9/10" };
    Object.keys(dp).forEach((v) => nodes.push(circ("d" + v, v, dp[v][0], dp[v][1], "default")));
    Object.keys(dp).forEach((v) => labels.push({ id: "df" + v, x: dp[v][0] + (v === "3" ? -24 : 24), y: dp[v][1], text: df[v], anchor: v === "3" ? "end" : "start" }));
    G.forEach(([a, b]) => edges.push({ from: "d" + a, to: "d" + b, state: dTree.has(a + "-" + b) ? "found" : "muted" }));
    labels.push({ id: "dt", x: 480, y: 22, text: "(b) DFS 樹：又窄又深", cls: "strong" });
    labels.push({ id: "n1", x: 340, y: 348, text: "綠色：樹邊（各 7 條 = 8 − 1）；淡灰：非樹邊。DFS 旁的數字是發現 / 完成時間", anchor: "middle" });
    return { width: 680, height: 366, nodes, edges, labels };
  });

  // 圖 3：串列順序不同，走訪順序就不同
  figure("bfs-dfs-order", () => {
    const nodes = [], edges = [], labels = [];
    const S = 0.5;
    [[0, "a", "由小到大（插在正確位置）", "BFS 0 1 3 2 4 5 6 7", "DFS 0 1 2 5 4 3 6 7"],
     [340, "b", "插在串列前端（順序反過來）", "BFS 0 3 1 4 2 6 5 7", "DFS 0 3 4 6 7 5 2 1"]].forEach(([ox, p, t, b, d]) => {
      P.forEach(([x, y], v) => nodes.push(circ(p + v, v, ox + 30 + x * S, 46 + y * S, v === 0 ? "compare" : "default")));
      G.forEach(([a, c]) => edges.push({ from: p + a, to: p + c }));
      labels.push({ id: p + "t", x: ox + 170, y: 20, text: `(${p}) ${t}`, cls: "strong" });
      labels.push({ id: p + "l", x: ox + 30 + 160 * S, y: 46 + 60 * S - 32, text: p === "a" ? "list[0]: 1 → 3" : "list[0]: 3 → 1", cls: "warn", anchor: "middle" });
      labels.push({ id: p + "b", x: ox + 170, y: 216, text: b, anchor: "middle" });
      labels.push({ id: p + "d", x: ox + 170, y: 240, text: d, anchor: "middle" });
    });
    return { width: 680, height: 258, nodes, edges, labels };
  });
})();
