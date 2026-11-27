/* =====================================================================
   Minimum Cost Spanning Tree（最小成本生成樹）主題的視覺化
   - mst-build : 輸入帶權無向邊與起點，切換 Kruskal／Prim，
                 Kruskal 看邊依序被考慮、收下或因成環略過，以及 union-find 的集合；
                 Prim 看目前的 cut、跨越 cut 的邊與每個樹外頂點的 key
   ===================================================================== */
(function () {
  "use strict";
  const { Player, Recorder, ui, register, esc, iconHTML, figure } = window.DSViz;

  // 右側程式碼：從 code/data-structures/minimum-spanning-tree.c 原封不動取出
  const CODE = {
    kruskal: [
      "int kruskal(Edge t[]) {",
      "  int k = 0, total = 0;",
      "  qsort(e, m, sizeof(Edge), cmpEdge);    /* 所有邊依權重排序：O(E log E) */",
      "  initSets();",
      "  for (int i = 0; i < m && k < n - 1; i++) {",
      "    int ru = find(e[i].u), rv = find(e[i].v);",
      "    if (ru == rv) {                      /* 兩端已在同一棵樹：加進來會形成環 */",
      "      printf(\"  略過 (%d,%d) %d：形成環\\n\", e[i].u, e[i].v, e[i].w);",
      "      continue;",
      "    }",
      "    unionSets(ru, rv);                   /* 兩棵樹合併成一棵 */",
      "    t[k++] = e[i];",
      "    total += e[i].w;",
      "  }",
      "  if (k < n - 1) return -1;              /* 收不滿 n-1 條：圖不連通，只得到生成樹林 */",
      "  return total;",
      "}"
    ],
    prim: [
      "int prim(int s, Edge t[]) {",
      "  int key[MAXV], from[MAXV], inTree[MAXV], total = 0;",
      "  for (int v = 0; v < n; v++) {",
      "    key[v] = INF;                        /* key[v]：v 連到樹上最便宜的邊權 */",
      "    from[v] = -1;                        /* from[v]：那條邊的另一端（樹上的頂點） */",
      "    inTree[v] = 0;",
      "  }",
      "  key[s] = 0;",
      "  for (int k = 0; k < n; k++) {",
      "    int u = -1;",
      "    for (int v = 0; v < n; v++)          /* 在樹外找 key 最小的頂點：O(V) */",
      "      if (!inTree[v] && (u == -1 || key[v] < key[u])) u = v;",
      "    if (key[u] == INF) return -1;        /* 剩下的頂點都接不上：圖不連通 */",
      "    inTree[u] = 1;                       /* 邊 (from[u], u) 是跨越 cut 最輕的邊 */",
      "    total += key[u];",
      "    if (from[u] != -1) t[k - 1] = (Edge){from[u], u, key[u]};",
      "    for (int v = 0; v < n; v++)          /* 用 u 的邊更新樹外頂點的 key */",
      "      if (!inTree[v] && cost[u][v] < key[v]) {",
      "        key[v] = cost[u][v];",
      "        from[v] = u;",
      "      }",
      "  }",
      "  return total;",
      "}"
    ],
  };
  const ln = (code, s) => code.findIndex((l) => l.includes(s)) + 1;
  const LK = {
    init: [ln(CODE.kruskal, "qsort("), ln(CODE.kruskal, "initSets();")],
    find: [ln(CODE.kruskal, "for (int i = 0;"), ln(CODE.kruskal, "int ru = find(")],
    cycle: [ln(CODE.kruskal, "if (ru == rv)"), ln(CODE.kruskal, "continue;")],
    take: [ln(CODE.kruskal, "unionSets(ru, rv);"), ln(CODE.kruskal, "t[k++] = e[i];"), ln(CODE.kruskal, "total += e[i].w;")],
    fail: [ln(CODE.kruskal, "if (k < n - 1) return -1;")],
    done: [ln(CODE.kruskal, "return total;")],
  };
  const LP = {
    init: [ln(CODE.prim, "key[v] = INF;"), ln(CODE.prim, "from[v] = -1;"), ln(CODE.prim, "key[s] = 0;")],
    pick: [ln(CODE.prim, "if (!inTree[v] && (u == -1"), ln(CODE.prim, "inTree[u] = 1;"), ln(CODE.prim, "total += key[u];"), ln(CODE.prim, "t[k - 1] = (Edge)")],
    upd: [ln(CODE.prim, "if (!inTree[v] && cost[u][v] < key[v])"), ln(CODE.prim, "key[v] = cost[u][v];"), ln(CODE.prim, "from[v] = u;")],
    fail: [ln(CODE.prim, "if (key[u] == INF) return -1;")],
    done: [ln(CODE.prim, "return total;")],
  };

  const W = 724, H = 450, MAXV = 10, MAXE = 16, INF = Infinity;
  const PRESET = {
    demo: { text: "0-1:6 0-3:11 0-4:9 1-2:10 1-3:3 2-3:7 2-6:5 3-4:8 3-5:4 4-5:12 5-6:2", start: 0,
      pos: [[70, 185], [190, 70], [390, 70], [270, 190], [190, 315], [390, 305], [505, 185]] },
    tie: { text: "0-1:1 1-2:1 2-3:1 0-3:1 0-2:2", start: 0,
      pos: [[150, 80], [410, 80], [410, 300], [150, 300]] },
    split: { text: "0-1:3 1-2:1 0-2:2 3-4:5", start: 0,
      pos: [[90, 100], [270, 90], [180, 280], [390, 120], [490, 290]] },
  };
  const ellipse = (n) => Array.from({ length: n }, (_, k) => {
    const a = -Math.PI / 2 + (2 * Math.PI * k) / n;
    return [285 + 225 * Math.cos(a), 190 + 140 * Math.sin(a)];
  });
  const ek = (a, b) => (a < b ? a + "-" + b : b + "-" + a);
  const kw = (x) => (x === INF ? "∞" : String(x));
  // 和 C 程式的 cmpEdge 一樣：權重小的在前，同權重依 (u, v)
  const cmpEdge = (a, b) => a.w - b.w || a.u - b.u || a.v - b.v;

  // 邊權標在線段中點旁（往法線方向偏移，避免壓在線上）
  function weightLabel(id, p, q, text, cls, off) {
    const mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2;
    let nx = -(q[1] - p[1]), ny = q[0] - p[0];
    const len = Math.hypot(nx, ny) || 1;
    nx /= len; ny /= len;
    if (ny > 0 || (ny === 0 && nx > 0)) { nx = -nx; ny = -ny; }   // 一律往上（或往左）偏
    const d = off || 12;
    return { id, x: mx + nx * d, y: my + ny * d, text, cls: cls || "", anchor: "middle" };
  }

  register("mst-build", function (root) {
    const player = new Player(root, {
      title: "Kruskal & Prim 最小成本生成樹",
      width: W, height: H, code: CODE.kruskal, wide: true,
      legend: [["compare", "考慮中的邊／跨越 cut 的邊"], ["active", "Prim 這一步選中的邊"], ["found", "MST 的邊與樹上頂點"], ["removed", "Kruskal：會成環，略過"]],
    });

    let n = 0, edges = [], pos = [], mode = "kruskal";

    function parse(text, startText) {
      const toks = text.trim().split(/[\s,]+/).filter(Boolean);
      if (!toks.length) return "請輸入至少一條邊，格式像 0-1:4 1-2:3（頂點-頂點:權重）。";
      if (toks.length > MAXE) return `最多 ${MAXE} 條邊，畫面才放得下。`;
      const seen = new Set(), es = [];
      let mx = 0;
      for (const t of toks) {
        const m = /^(\d+)-(\d+):(-?\d+)$/.exec(t);
        if (!m) return `「${esc(t)}」格式不對，每條邊要寫成「頂點-頂點:權重」，例如 2-5:7。`;
        const a = +m[1], b = +m[2], w = +m[3];
        if (a >= MAXV || b >= MAXV) return `頂點編號請用 0～${MAXV - 1}（最多 ${MAXV} 個頂點）：「${esc(t)}」超出範圍。`;
        if (a === b) return `「${esc(t)}」是自己連到自己（self-loop），生成樹不會用到它，請拿掉。`;
        if (w < -99 || w > 999) return `「${esc(t)}」的權重請用 −99～999 的整數。`;
        const k = ek(a, b);
        if (seen.has(k)) return `邊 ${k} 重複輸入了（這裡只處理簡單圖，兩點之間最多一條邊）。`;
        seen.add(k); es.push({ u: Math.min(a, b), v: Math.max(a, b), w }); mx = Math.max(mx, a, b);
      }
      const st = startText.trim();
      if (!/^\d+$/.test(st) || +st > mx) return `起點請輸入 0～${mx} 之間的頂點編號。`;
      return { n: mx + 1, es, s: +st };
    }

    // ---------- 繪製 ----------
    // m: { vs: 頂點狀態, vsub: 頂點下方文字, es: 邊狀態 {key: state}, dash: Set, col: {title, rows:[{id,label,state}]}, line1, line2 }
    function frame(caption, line, m) {
      const nodes = [], es = [], labels = [];
      for (let v = 0; v < n; v++) {
        nodes.push({ id: "v" + v, label: String(v), x: pos[v][0], y: pos[v][1], r: 19, state: m.vs[v] || "default", sub: m.vsub[v] || "" });
      }
      edges.forEach((e) => {
        const k = ek(e.u, e.v), st = m.es[k] || "default";
        es.push({ from: "v" + e.u, to: "v" + e.v, state: st, dashed: m.dash.has(k) });
        const cls = st === "found" ? "ok" : st === "removed" ? "warn" : "";
        labels.push(weightLabel("w" + k, pos[e.u], pos[e.v], String(e.w), cls));
      });
      labels.push({ id: "ct", x: 550, y: 24, text: m.col.title, cls: "title", anchor: "start" });
      m.col.rows.forEach((r, i) => nodes.push({ id: r.id, label: r.label, shape: "box", x: 550 + r.w / 2, y: 52 + i * 25, w: r.w, h: 22, state: r.state }));
      labels.push({ id: "l1", x: 24, y: 385, text: m.line1, anchor: "start" });
      labels.push({ id: "l2", x: 24, y: 422, text: m.line2, cls: "strong", anchor: "start" });
      return { nodes, edges: es, labels, caption, line };
    }

    const empty = () => ({ vs: {}, vsub: {}, es: {}, dash: new Set(), col: { title: "", rows: [] }, line1: "", line2: "" });

    // ---------- Kruskal ----------
    function kruskal() {
      player.setCode(CODE.kruskal);
      const r = new Recorder();
      const sorted = edges.slice().sort(cmpEdge);
      const parent = [], size = [];
      for (let i = 0; i < n; i++) { parent[i] = i; size[i] = 1; }
      const find = (x) => (parent[x] === x ? x : (parent[x] = find(parent[x])));
      const es = {}, dash = new Set(), rowSt = sorted.map(() => "default");
      let k = 0, total = 0;
      const sets = () => {
        const g = {};
        for (let v = 0; v < n; v++) (g[find(v)] = g[find(v)] || []).push(v);
        return "集合：" + Object.values(g).map((a) => "{" + a.join(",") + "}").join(" ");
      };
      const M = (o) => Object.assign(empty(), {
        es: Object.assign({}, es), dash: new Set(dash),
        col: { title: "邊（由小到大）", rows: sorted.map((e, i) => ({ id: "r" + i, label: `(${e.u},${e.v}) ${e.w}`, w: 120, state: rowSt[i] })) },
        line1: sets(), line2: `已收 ${k} / ${n - 1} 條　總成本 ${total}`,
      }, o);
      r.push(frame(`Kruskal 先把 ${sorted.length} 條邊<b>依權重由小到大排序</b>（右側清單；同權重時依 (u, v) 排）。union-find 一開始每個頂點自己一個集合，代表「${n} 棵只有一個點的樹」。接下來由上往下一條一條看。`, LK.init, M({})));
      for (let i = 0; i < sorted.length && k < n - 1; i++) {
        const e = sorted[i], key = ek(e.u, e.v);
        const ru = find(e.u), rv = find(e.v);
        rowSt[i] = "compare"; es[key] = "compare";
        const vs = { [e.u]: "compare", [e.v]: "compare" };
        r.push(frame(`第 ${i + 1} 小的邊是 <b>(${e.u},${e.v}) ${e.w}</b>：find(${e.u}) = ${ru}、find(${e.v}) = ${rv}。${ru === rv ? "兩個 root 一樣……" : "兩個 root 不一樣……"}`, LK.find, M({ vs })));
        if (ru === rv) {
          rowSt[i] = "removed"; es[key] = "removed"; dash.add(key);
          r.push(frame(`find(${e.u}) = find(${e.v}) = ${ru}，<b>${e.u} 和 ${e.v} 已經在同一棵樹上</b>，樹上本來就有一條路連接它們，再加 (${e.u},${e.v}) 會形成環，所以略過。這條邊是那個環上最重的邊（cycle property），丟掉不會吃虧。`, LK.cycle, M({ vs })));
          continue;
        }
        if (size[ru] < size[rv]) { parent[ru] = rv; size[rv] += size[ru]; } else { parent[rv] = ru; size[ru] += size[rv]; }
        k++; total += e.w;
        rowSt[i] = "found"; es[key] = "found";
        r.push(frame(`root 不同，代表 ${e.u}、${e.v} 在兩棵不同的樹上，收下 (${e.u},${e.v}) 不會成環，而且它是目前跨越這兩棵樹最輕的邊（cut property）。union 把兩個集合合併，總成本 + ${e.w < 0 ? "(" + e.w + ")" : e.w} = <b>${total}</b>。`, LK.take, M({ vs: { [e.u]: "found", [e.v]: "found" } })));
      }
      if (k === n - 1) {
        sorted.forEach((e, i) => { if (rowSt[i] === "default") { rowSt[i] = "muted"; es[ek(e.u, e.v)] = "muted"; } });
        const rest = rowSt.filter((s) => s === "muted").length;
        const vs = {};
        for (let v = 0; v < n; v++) vs[v] = "found";
        r.push(frame(`收滿 n − 1 = ${n - 1} 條邊，所有頂點連成一棵樹，迴圈提前結束${rest ? `，後面 ${rest} 條邊（淡灰）<b>不用再看</b>` : ""}。MST 總成本 = <b>${total}</b>。`, LK.done, M({ vs })));
      } else {
        r.push(frame(`${iconHTML("alert")} 所有邊都看完了，只收到 ${k} 條，不到 n − 1 = ${n - 1} 條：圖<b>不連通</b>，沒有生成樹。綠色的邊是每個連通元件各自的 MST，合起來叫<b>最小生成樹林</b>（${n} 個頂點、${n - k} 個元件，邊數 ${n} − ${n - k} = ${k}）。`, LK.fail, M({})));
      }
      return r.frames;
    }

    // ---------- Prim（相鄰矩陣版） ----------
    function prim(s) {
      player.setCode(CODE.prim);
      const r = new Recorder();
      const cost = Array.from({ length: n }, () => new Array(n).fill(INF));
      edges.forEach((e) => { cost[e.u][e.v] = cost[e.v][e.u] = e.w; });
      const key = new Array(n).fill(INF), from = new Array(n).fill(-1), inTree = new Array(n).fill(false);
      const tree = new Set();
      let total = 0, cnt = 0;
      key[s] = 0;
      const M = (o, chosen) => {
        const es = {}, dash = new Set(), vs = {}, vsub = {};
        edges.forEach((e) => {
          const k = ek(e.u, e.v);
          if (tree.has(k)) es[k] = "found";
          else if (inTree[e.u] !== inTree[e.v]) {
            const out = inTree[e.u] ? e.v : e.u;
            es[k] = "compare";
            if (from[out] < 0 || ek(from[out], out) !== k) dash.add(k);   // 實線 = 這個樹外頂點目前的 key 邊
          } else es[k] = "muted";
          if (chosen === k) { es[k] = "active"; dash.delete(k); }
        });
        for (let v = 0; v < n; v++) {
          vs[v] = inTree[v] ? "found" : "default";
          vsub[v] = inTree[v] ? "" : "key " + kw(key[v]);
        }
        const X = [];
        for (let v = 0; v < n; v++) if (inTree[v]) X.push(v);
        return Object.assign(empty(), {
          es, dash, vs, vsub,
          col: { title: "每個頂點的 key", rows: key.map((kv, v) => ({ id: "p" + v, w: 162,
            label: inTree[v] ? `${v}：已在樹上` : `${v}：key ${kw(kv)}${from[v] >= 0 ? `（${from[v]}-${v}）` : ""}`,
            state: inTree[v] ? "found" : kv === INF ? "muted" : "compare" })) },
          line1: `樹上 X = {${X.join(",")}}　樹外 V − X 的頂點下方標著 key`,
          line2: `已選 ${tree.size} / ${n - 1} 條　總成本 ${total}`,
        }, o);
      };
      r.push(frame(`Prim 從起點 <b>${s}</b> 開始長一棵樹：所有 key 設成 ∞，只有 key[${s}] = 0，所以第一輪一定先選 ${s}。key[v] 的意思是「v 用一條邊接到目前這棵樹，最便宜要多少」。`, LP.init, M({})));
      for (let it = 0; it < n; it++) {
        let u = -1;
        for (let v = 0; v < n; v++) if (!inTree[v] && (u === -1 || key[v] < key[u])) u = v;
        if (key[u] === INF) {
          r.push(frame(`${iconHTML("alert")} 樹外最小的 key 是 ∞：剩下的頂點和這棵樹之間<b>一條邊都沒有</b>，圖不連通，Prim 回傳 −1。Prim 只會長出起點所在的那個連通元件（綠色）。`, LP.fail, M({})));
          return r.frames;
        }
        const k = from[u] >= 0 ? ek(from[u], u) : null;
        const pre = M({}, k);
        pre.vs[u] = "active";
        const cands = [];
        for (let v = 0; v < n; v++) if (!inTree[v] && key[v] !== INF) cands.push(`${v}:${key[v]}`);
        r.push(frame(it === 0
          ? `選 key 最小的 <b>${u}</b>（key = 0，起點）放進樹裡。`
          : `樹外的 key 有 ${cands.join("、")}，最小的是 <b>${u}</b>（key ${key[u]}${cands.filter((c) => c.endsWith(":" + key[u])).length > 1 ? "，同 key 時取編號小的" : ""}）。也就是說，所有跨越 cut（X | V − X，藍色）的邊裡，<b>(${from[u]},${u}) ${key[u]} 最輕</b>，依 cut property 放心收下。`, LP.pick, pre));
        inTree[u] = true; total += key[u];
        if (k) { tree.add(k); cnt++; }
        const ups = [];
        for (let v = 0; v < n; v++) {
          if (!inTree[v] && cost[u][v] < key[v]) { ups.push(`key[${v}]：${kw(key[v])} → ${cost[u][v]}`); key[v] = cost[u][v]; from[v] = u; }
        }
        if (cnt === n - 1) break;
        r.push(frame(`${u} 加入後總成本 ${total}。用 ${u} 的邊更新樹外頂點：${ups.length ? ups.join("、") + "（新的邊比原本的 key 便宜才換）" : `${u} 的邊都沒有比現有的 key 便宜，key 不變`}。`, LP.upd, M({})));
      }
      const vs = {};
      for (let v = 0; v < n; v++) vs[v] = "found";
      r.push(frame(`${n} 個頂點都進了樹，選了 n − 1 = ${n - 1} 條邊，MST 總成本 = <b>${total}</b>。注意 Prim 收邊的順序是「當下跨得出去的最輕邊」，不是全域的權重順序，所以和 Kruskal 的順序不同，但總成本一定相同。`, LP.done, M({ vs })));
      return r.frames;
    }

    // ---------- 控制列 ----------
    const inE = ui.input(player, { placeholder: "邊，例如 0-1:4 1-2:3", value: PRESET.demo.text, width: 250 });
    const inS = ui.input(player, { placeholder: "起點", value: "0", width: 52 });
    inS.title = "Prim 的起點";
    let lastText = null, lastPos = null;
    function go(m, preset) {
      mode = m || mode;
      if (preset) { inE.value = preset.text; inS.value = String(preset.start); }
      const g = parse(inE.value, inS.value);
      if (typeof g === "string") {
        const el = /起點/.test(g) ? inS : inE;
        el.classList.add("is-error"); setTimeout(() => el.classList.remove("is-error"), 700);
        n = 0; edges = [];
        player.load([frame(`${iconHTML("alert")} ${g}`, null, empty())], { autoplay: false });
        return null;
      }
      const same = inE.value === lastText;
      n = g.n; edges = g.es;
      const p = preset ? preset.pos : same ? lastPos : null;
      pos = p && p.length >= n ? p : ellipse(n);
      lastText = inE.value; lastPos = pos;
      const fr = mode === "kruskal" ? kruskal() : prim(g.s);
      player.load(fr, { autoplay: !preset || preset.auto !== false });
      return fr;
    }
    ui.button(player, "Kruskal", () => go("kruskal"));
    ui.button(player, "Prim", () => go("prim"));
    ui.button(player, "範例圖", () => go(null, PRESET.demo), "ghost");
    ui.button(player, "同權重", () => go(null, PRESET.tie), "ghost");
    ui.button(player, "不連通", () => go(null, PRESET.split), "ghost");
    [inE, inS].forEach((el) => el.addEventListener("keydown", (e) => e.key === "Enter" && go()));

    const demo = go("kruskal", Object.assign({ auto: false }, PRESET.demo));
    demo[0].caption = iconHTML("play") + " 按播放看示範：範例圖用 Kruskal，右側是排好序的邊，藍色是正在考慮的邊，綠色收下，紅色虛線因為會成環而略過；下方是 union-find 的集合。按「Prim」看同一張圖從起點長出的過程（藍色是跨越 cut 的邊）。也可以改起點、輸入自己的邊（格式 頂點-頂點:權重）。";
    player.load(demo, { autoplay: false });
  });

  // ===================================================================
  // 靜態圖解
  // ===================================================================
  const circ = (id, label, x, y, st, r) => ({ id, label: String(label), x, y, r: r || 17, state: st || "default" });

  // 畫一張小圖：P 座標、E [[u,v,w]]、st(key) 回傳邊狀態、opt.dash(key)
  function drawGraph(pre, P, E, ox, oy, s, out, opt) {
    const pt = P.map(([x, y]) => [ox + x * s, oy + y * s]);
    pt.forEach(([x, y], v) => out.nodes.push(circ(pre + v, v, x, y, opt.vs ? opt.vs(v) : "default", opt.r)));
    E.forEach(([a, b, w]) => {
      const k = ek(a, b), st = opt.es ? opt.es(k) : "default";
      if (st === "hide") return;
      out.edges.push({ from: pre + a, to: pre + b, state: st, dashed: opt.dash ? opt.dash(k) : false });
      if (opt.badge && opt.badge[k]) {
        const mx = (pt[a][0] + pt[b][0]) / 2, my = (pt[a][1] + pt[b][1]) / 2;
        out.nodes.push({ id: pre + "b" + k, label: String(opt.badge[k]), shape: "box", x: mx, y: my, w: 22, h: 20, state: "new" });
        out.labels.push(weightLabel(pre + "w" + k, pt[a], pt[b], String(w), st === "found" ? "ok" : st === "removed" ? "warn" : "", 20));
      } else {
        out.labels.push(weightLabel(pre + "w" + k, pt[a], pt[b], String(w), st === "found" ? "ok" : st === "removed" ? "warn" : "", opt.off));
      }
    });
    return pt;
  }

  // 圖 1：一張圖的幾種生成樹
  figure("mst-spanning-trees", () => {
    const out = { nodes: [], edges: [], labels: [] };
    const P = [[0, 0], [100, 0], [100, 100], [0, 100]];
    const E = [[0, 1, 1], [1, 2, 2], [2, 3, 3], [0, 3, 4], [0, 2, 5]];
    const panels = [
      ["(a) 原圖", null, "5 條邊、4 個頂點", ""],
      ["(b) 生成樹", new Set(["0-1", "0-3", "0-2"]), "成本 1+4+5 = 10", ""],
      ["(c) MST", new Set(["0-1", "1-2", "2-3"]), "成本 1+2+3 = 6", "ok"],
      ["(d) 不是生成樹", new Set(["0-1", "1-2", "0-2"]), "有環、3 沒接上", "warn"],
    ];
    panels.forEach(([t, sel, note, cls], i) => {
      const ox = 45 + i * 170;
      drawGraph("f" + i, P, E, ox, 55, 1, out, {
        es: (k) => (!sel ? "default" : sel.has(k) ? (i === 3 ? "removed" : "found") : "muted"),
        vs: (v) => (i === 3 && v === 3 ? "removed" : "default"),
      });
      out.labels.push({ id: "t" + i, x: ox + 50, y: 18, text: t, cls: "strong" });
      out.labels.push({ id: "n" + i, x: ox + 50, y: 196, text: note, cls });
    });
    return { width: 680, height: 214, ...out };
  });

  // 範例圖（和動畫的範例圖相同）
  const DP = PRESET.demo.pos.map(([x, y]) => [x - 70, y - 70]);
  const DE = [[0, 1, 6], [0, 3, 11], [0, 4, 9], [1, 2, 10], [1, 3, 3], [2, 3, 7], [2, 6, 5], [3, 4, 8], [3, 5, 4], [4, 5, 12], [5, 6, 2]];
  const MST = new Set(["5-6", "1-3", "3-5", "2-6", "0-1", "3-4"]);

  // 圖 2：cut property 與 cycle property
  figure("mst-cut-cycle", () => {
    const out = { nodes: [], edges: [], labels: [] };
    const S = new Set([0, 1]);
    drawGraph("a", DP, DE, 40, 50, 0.66, out, {
      vs: (v) => (S.has(v) ? "found" : "default"),
      es: (k) => {
        const [a, b] = k.split("-").map(Number);
        if (k === "1-3") return "active";
        return S.has(a) !== S.has(b) ? "compare" : k === "0-1" ? "found" : "muted";
      },
      dash: (k) => { const [a, b] = k.split("-").map(Number); return k !== "1-3" && S.has(a) !== S.has(b); },
    });
    const C = new Set(["2-3", "3-5", "5-6", "2-6"]);
    drawGraph("b", DP, DE, 370, 50, 0.66, out, {
      vs: (v) => ([2, 3, 5, 6].includes(v) ? "compare" : "default"),
      es: (k) => (k === "2-3" ? "removed" : C.has(k) ? "compare" : "muted"),
      dash: (k) => k === "2-3",
    });
    out.labels.push({ id: "ta", x: 185, y: 20, text: "(a) cut：S = {0, 1}", cls: "strong" });
    out.labels.push({ id: "tb", x: 515, y: 20, text: "(b) 環 2-3-5-6", cls: "strong" });
    out.labels.push({ id: "na", x: 185, y: 248, text: "跨越的邊 11、9、10、3，最輕 (1,3) 3 必在 MST", anchor: "middle" });
    out.labels.push({ id: "nb", x: 515, y: 248, text: "環上 7、4、2、5，最重 (2,3) 7 不在 MST", anchor: "middle" });
    return { width: 680, height: 266, ...out };
  });

  // 圖 3：同一棵 MST，Kruskal 與 Prim 收邊的順序
  figure("mst-order", () => {
    const out = { nodes: [], edges: [], labels: [] };
    const kOrd = { "5-6": 1, "1-3": 2, "3-5": 3, "2-6": 4, "0-1": 5, "3-4": 6 };
    const pOrd = { "0-1": 1, "1-3": 2, "3-5": 3, "5-6": 4, "2-6": 5, "3-4": 6 };
    drawGraph("k", DP, DE, 40, 50, 0.66, out, {
      es: (k) => (MST.has(k) ? "found" : k === "2-3" ? "removed" : "muted"),
      dash: (k) => k === "2-3", badge: kOrd,
    });
    drawGraph("p", DP, DE, 370, 50, 0.66, out, {
      vs: (v) => (v === 0 ? "compare" : "default"),
      es: (k) => (MST.has(k) ? "found" : "muted"), badge: pOrd,
    });
    out.labels.push({ id: "ta", x: 185, y: 20, text: "(a) Kruskal：照權重 2 3 4 5 6 8", cls: "strong" });
    out.labels.push({ id: "tb", x: 515, y: 20, text: "(b) Prim 從 0：6 3 4 2 5 8", cls: "strong" });
    out.labels.push({ id: "na", x: 185, y: 248, text: "紫色方塊是收邊順序；(2,3) 7 成環被略過", anchor: "middle" });
    out.labels.push({ id: "nb", x: 515, y: 248, text: "同一棵樹、總成本都是 28，順序不同", anchor: "middle" });
    return { width: 680, height: 266, ...out };
  });

  // 圖 4：MST 與最短路徑樹
  figure("mst-vs-spt", () => {
    const out = { nodes: [], edges: [], labels: [] };
    const P = [[60, 0], [0, 110], [120, 110]];
    const E = [[0, 1, 4], [0, 2, 5], [1, 2, 2]];
    const panels = [
      ["(a) 原圖", null, "", ""],
      ["(b) MST", new Set(["0-1", "1-2"]), "總成本 6；0 到 2 要走 4+2 = 6", "ok"],
      ["(c) 從 0 的最短路徑樹", new Set(["0-1", "0-2"]), "總成本 9；0 到 2 只要 5", ""],
    ];
    panels.forEach(([t, sel, note, cls], i) => {
      const ox = 53 + i * 225;
      drawGraph("s" + i, P, E, ox, 60, 1, out, {
        vs: (v) => (v === 0 && i === 2 ? "compare" : "default"),
        es: (k) => (!sel ? "default" : sel.has(k) ? (i === 2 ? "visited" : "found") : "muted"),
      });
      out.labels.push({ id: "t" + i, x: ox + 60, y: 22, text: t, cls: "strong" });
      if (note) out.labels.push({ id: "n" + i, x: ox + 60, y: 210, text: note, cls });
    });
    return { width: 680, height: 228, ...out };
  });
})();
