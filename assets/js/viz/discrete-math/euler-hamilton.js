/* =====================================================================
   Euler and Hamilton Paths（Euler 與 Hamilton 路徑）主題的視覺化
   - euler-hamilton : 判斷 Euler 迴路／路徑、Hierholzer 演算法、Hamilton 迴路回溯法
   ===================================================================== */
(function () {
  "use strict";
  const { Player, Recorder, ui, register, esc, iconHTML, figure } = window.DSViz;

  const CODE = {
    euler: [
      "int eulerType(int *start) {",
      "  int odd = 0;",
      "  *start = 0;",
      "  if (!connected()) return 0;",
      "  for (int v = n - 1; v >= 0; v--)             /* 倒著找，start 會是編號最小的奇點 */",
      "    if (degree(v) % 2 == 1) { odd++; *start = v; }",
      "  if (odd == 0) return 2;                      /* 全部偶點：Euler 迴路，從哪裡出發都行 */",
      "  if (odd == 2) return 1;                      /* 恰好兩個奇點：從其中一個奇點出發 */",
      "  return 0;                                    /* 奇點有 4 個以上：不存在 */",
      "}",
      "",
      "int hierholzer(int start) {                    /* 回傳 path 的頂點數 */",
      "  int top = 0, len = 0;",
      "  memcpy(adj, g, sizeof g);",
      "  stack[0] = start;",
      "  while (top >= 0) {",
      "    int v = stack[top], u = 0;",
      "    while (u < n && adj[v][u] == 0) u++;       /* 找 v 的一條還沒走過的邊 */",
      "    if (u < n) {                               /* 有：走過去，這條邊用掉 */",
      "      adj[v][u]--; adj[u][v]--;",
      "      stack[++top] = u;",
      "    } else {                                   /* 沒路了：v 放進答案，退回上一個點 */",
      "      path[len++] = stack[top--];",
      "    }",
      "  }",
      "  return len;                                  /* path 倒過來讀就是 Euler 路徑 */",
      "}",
    ],
    ham: [
      "int hamilton(int k) {                          /* cyc[0..k-1] 已經排好，現在決定第 k 個 */",
      "  if (k == n) return g[cyc[n - 1]][cyc[0]] > 0;   /* 全部排完，最後一點要能回到起點 */",
      "  for (int v = 1; v < n; v++)",
      "    if (!used[v] && g[cyc[k - 1]][v]) {        /* 沒用過、而且和上一個點相鄰 */",
      "      used[v] = 1; cyc[k] = v;",
      "      if (hamilton(k + 1)) return 1;",
      "      used[v] = 0;                             /* 這條路走不通：退回，試下一個 */",
      "    }",
      "  return 0;",
      "}",
    ],
  };
  const LE = { degree: [5, 6], conn: 4, circuit: 7, path: 8, none: 9, init: [13, 14, 15], find: [17, 18], go: [19, 20, 21], back: [22, 23], done: 26 };
  const LH = { full: 2, loop: 3, ok: 4, put: 5, rec: 6, undo: 7, fail: 9 };

  const L = (i) => String.fromCharCode(65 + i);
  const PRESETS = {
    "蝴蝶結": { edges: "AB AC BC CD CE DE", pos: [[90, 66], [90, 266], [210, 166], [330, 66], [330, 266]] },
    "六邊形": { edges: "AB BC CD DE EF FA AC CE EA", pos: null },
    "房子": { edges: "AB AC BC BD CE DE BE CD", pos: [[220, 46], [140, 126], [300, 126], [140, 276], [300, 276]] },
    "七橋": { edges: "AB AB AC AC AD BD CD", pos: [[200, 166], [200, 46], [200, 286], [380, 166]] },
    "K5": { edges: "AB AC AD AE BC BD BE CD CE DE", pos: null },
    "K2,3": { edges: "AC AD AE BC BD BE", pos: [[120, 106], [120, 236], [330, 66], [330, 166], [330, 266]] },
  };
  const MAX_V = 8, MAX_E = 16;

  // 解析 "AB BC CA"：回傳 {n, edges:[{id,u,v}]} 或錯誤字串
  function parse(text) {
    const toks = text.trim().toUpperCase().split(/[\s,]+/).filter(Boolean);
    if (!toks.length) return "請輸入邊，例如：AB BC CA";
    if (toks.length > MAX_E) return `最多 ${MAX_E} 條邊，動畫才放得下。`;
    const edges = [];
    let n = 0;
    for (const t of toks) {
      if (!/^[A-H][A-H]$/.test(t)) return `「${esc(t)}」不是合法的邊：請用兩個 A～H 的字母，例如 AB。`;
      const u = t.charCodeAt(0) - 65, v = t.charCodeAt(1) - 65;
      if (u === v) return `「${esc(t)}」是自迴圈（loop），本動畫不處理，請拿掉。`;
      edges.push({ id: "e" + edges.length, u, v });
      n = Math.max(n, u + 1, v + 1);
    }
    return { n, edges };
  }

  // 位置：預設排在圓上；重邊加上彎折點
  function layout(G, pos) {
    const P = pos || Array.from({ length: G.n }, (_, i) => {
      const a = (-90 + (360 / G.n) * i) * Math.PI / 180;
      return [210 + 125 * Math.cos(a), 166 + 125 * Math.sin(a)];
    });
    const seen = {};
    G.edges.forEach((e) => {
      const key = Math.min(e.u, e.v) + "-" + Math.max(e.u, e.v);
      const k = (seen[key] = (seen[key] || 0) + 1) - 1;
      e.bend = null;
      if (k > 0) {
        const [x1, y1] = P[e.u], [x2, y2] = P[e.v];
        const len = Math.hypot(x2 - x1, y2 - y1), off = 34 * Math.ceil(k / 2) * (k % 2 ? 1 : -1);
        e.bend = { x: (x1 + x2) / 2 + (-(y2 - y1) / len) * off, y: (y1 + y2) / 2 + ((x2 - x1) / len) * off };
      }
    });
    return P;
  }

  register("euler-hamilton", function (root) {
    const player = new Player(root, {
      title: "Euler and Hamilton Paths（Euler 與 Hamilton 路徑）",
      width: 680, height: 420, code: CODE.euler,
      legend: [["compare", "目前所在"], ["active", "奇數度頂點 / 嘗試中"], ["visited", "已走過的邊"], ["found", "完成"], ["removed", "不行"]],
    });

    let G = null, P = null;
    const deg = (v) => G.edges.filter((e) => e.u === v || e.v === v).length;

    function frame(caption, line, opt = {}) {
      const vs = opt.v || {}, es = opt.e || {};
      const nodes = [], edges = [], labels = [], pointers = [];
      for (let i = 0; i < G.n; i++) {
        nodes.push({ id: "v" + i, label: L(i), x: P[i][0], y: P[i][1], r: 19, state: vs[i] || "default", sub: opt.showDeg === false ? "" : `deg ${deg(i)}` });
      }
      G.edges.forEach((e) => {
        const st = es[e.id] || "default";
        if (!e.bend) edges.push({ id: e.id, from: "v" + e.u, to: "v" + e.v, state: st });
        else {
          nodes.push({ id: "b" + e.id, label: "", x: e.bend.x, y: e.bend.y, r: 3, state: st });
          edges.push({ id: e.id + "a", from: "v" + e.u, to: "b" + e.id, state: st }, { id: e.id + "b", from: "b" + e.id, to: "v" + e.v, state: st });
        }
      });
      if (opt.cur !== undefined) pointers.push({ id: "cur", label: opt.curName || "v", target: "v" + opt.cur, dir: P[opt.cur][1] < 120 ? "left" : "up", state: "compare" });
      const X = 450;
      (opt.info || []).forEach((t, k) => labels.push({ id: "i" + k, x: X, y: 52 + k * 28, text: t[0], cls: t[1] || "", anchor: "start" }));
      const strip = (name, arr, y, st) => {
        labels.push({ id: "s" + name, x: 24, y: y + 4, text: name, anchor: "start", cls: "title" });
        arr.forEach((v, k) => nodes.push({ id: name + k, label: L(v), shape: "box", x: 96 + k * 34, y, w: 30, h: 28, state: k === arr.length - 1 ? st : "default" }));
      };
      if (opt.stack) strip("stack", opt.stack, 352, "compare");
      if (opt.path) strip("path", opt.path, 392, "found");
      return { nodes, edges, pointers, labels, caption, line };
    }

    // ---------- Euler：判斷 + Hierholzer ----------
    function euler() {
      player.setCode(CODE.euler);
      const r = new Recorder();
      const odd = [];
      for (let i = 0; i < G.n; i++) if (deg(i) % 2) odd.push(i);
      const vs = {}; odd.forEach((i) => (vs[i] = "active"));
      r.push(frame(`先算每個頂點的度數（deg）。奇數度的頂點標成橘色：${odd.length ? odd.map(L).join("、") : "沒有"}，共 <b>${odd.length}</b> 個。奇數度頂點的個數一定是偶數，因為度數總和 = 2 × 邊數。`, LE.degree,
        { v: vs, info: [[`奇數度頂點：${odd.length} 個`, "strong"]] }));
      // 連通（只看有邊的點）
      const seen = new Set(), adjL = (v) => G.edges.filter((e) => e.u === v || e.v === v).map((e) => (e.u === v ? e.v : e.u));
      const s0 = [...Array(G.n).keys()].find((v) => deg(v) > 0);
      (function dfs(v) { seen.add(v); adjL(v).forEach((u) => !seen.has(u) && dfs(u)); })(s0);
      const lonely = [...Array(G.n).keys()].filter((v) => deg(v) > 0 && !seen.has(v));
      if (lonely.length) {
        const rv = {}; lonely.forEach((v) => (rv[v] = "removed"));
        r.push(frame(`圖<b>不連通</b>：從 ${L(s0)} 出發走不到 ${lonely.map(L).join("、")}。邊分散在不同塊，不可能一筆走完，度數再漂亮也沒用。`, LE.conn, { v: rv, info: [["不連通 → 沒有 Euler 路徑", "warn"]] }));
        return r.frames;
      }
      if (odd.length > 2) {
        r.push(frame(`奇數度頂點有 ${odd.length} 個 &gt; 2：每個奇點都只能當起點或終點，但一條路只有一個起點和一個終點，所以<b>不存在</b> Euler 路徑，至少要分成 ${odd.length / 2} 筆才畫得完。`, LE.none,
          { v: vs, info: [[`奇數度頂點：${odd.length} 個`, "strong"], ["→ 沒有 Euler 路徑", "warn"], [`最少要 ${odd.length / 2} 筆`, ""]] }));
        return r.frames;
      }
      const start = odd.length ? odd[0] : 0;
      const kind = odd.length ? "Euler 路徑" : "Euler 迴路";
      const info0 = [[`奇數度頂點：${odd.length} 個`, "strong"], [`→ 有 ${kind}`, "strong"], [odd.length ? `起點 ${L(odd[0])}，終點 ${L(odd[1])}` : "從任何點出發都會回到原點", ""]];
      r.push(frame(odd.length ? `恰好 2 個奇點：有 <b>Euler 路徑</b>（不是迴路），必須從一個奇點出發、在另一個奇點結束。從 <b>${L(start)}</b> 出發。` : `全部都是偶數度、而且連通：有 <b>Euler 迴路</b>，從哪個點出發都可以，這裡從 <b>A</b> 出發。`,
        odd.length ? LE.path : LE.circuit, { v: vs, info: info0 }));
      // Hierholzer
      const used = {}, stack = [start], path = [];
      let guard = 0;
      r.push(frame(`Hierholzer 演算法：把起點 ${L(start)} 放進 stack。之後每一步只看 stack 頂端的點。`, LE.init, { cur: start, v: { [start]: "compare" }, e: used, stack, path, info: info0 }));
      while (stack.length && guard++ < 200) {
        const v = stack[stack.length - 1];
        let pick = null;
        for (let u = 0; u < G.n && !pick; u++) pick = G.edges.find((e) => !used[e.id] && ((e.u === v && e.v === u) || (e.v === v && e.u === u))) || null;
        if (pick) {
          const u = pick.u === v ? pick.v : pick.u;
          used[pick.id] = "visited";
          stack.push(u);
          r.push(frame(`${L(v)} 還有沒走過的邊，挑編號最小的鄰居 <b>${L(u)}</b>：走過 ${L(v)}–${L(u)}，這條邊用掉，${L(u)} 放進 stack。`, LE.go,
            { cur: u, v: { [u]: "compare" }, e: Object.assign({}, used, { [pick.id]: "compare" }), stack, path, info: info0 }));
        } else {
          stack.pop(); path.push(v);
          r.push(frame(`${L(v)} 的邊都走完了，卡住了：把 <b>${L(v)}</b> 從 stack pop 出來放進答案，退回上一個點${stack.length ? ` ${L(stack[stack.length - 1])}` : ""}，看它還有沒有別的路（這就是把小圈「接」進來的地方）。`, LE.back,
            { cur: stack.length ? stack[stack.length - 1] : undefined, v: { [v]: "found" }, e: used, stack, path, info: info0 }));
        }
      }
      const ans = path.slice().reverse().map(L).join(" → ");
      const fin = {}; G.edges.forEach((e) => (fin[e.id] = "found"));
      r.push(frame(`stack 空了，完成！path 倒過來就是 ${kind}：<b>${ans}</b>。共走過 ${G.edges.length} 條邊、每條剛好一次；每條邊只被推進、退出一次，所以是 O(|E|)。`, LE.done,
        { e: fin, stack, path, info: info0.concat([[`${kind}：`, "strong"], [path.slice().reverse().map(L).join(""), ""]]) }));
      return r.frames;
    }

    // ---------- Hamilton：回溯法 ----------
    function hamilton() {
      player.setCode(CODE.ham);
      const r = new Recorder(), LIMIT = 90;
      const adjOK = (a, b) => G.edges.some((e) => (e.u === a && e.v === b) || (e.u === b && e.v === a));
      const cyc = [0], used = { 0: true };
      let found = false, cut = false;
      const vstate = () => { const s = {}; cyc.forEach((v) => (s[v] = "visited")); s[cyc[cyc.length - 1]] = "compare"; return s; };
      const estate = () => {
        const s = {};
        for (let k = 1; k < cyc.length; k++) { const e = G.edges.find((x) => (x.u === cyc[k - 1] && x.v === cyc[k]) || (x.v === cyc[k - 1] && x.u === cyc[k])); if (e) s[e.id] = "visited"; }
        return s;
      };
      const info = () => [["Hamilton：每點剛好一次", "strong"], [`目前：${cyc.map(L).join(" → ")}`, ""], ["最差要試 (n − 1)! 種順序", ""]];
      r.push(frame(`Hamilton 迴路要經過<b>每個頂點剛好一次</b>再回到起點。沒有像 Euler 那樣的簡單判別法，只能一個一個試：固定從 A 出發，每一步挑一個沒用過的相鄰頂點，走不通就退回。`, LH.loop,
        { v: vstate(), e: estate(), cur: 0, showDeg: false, info: info() }));
      (function go() {
        if (found || cut) return;
        if (r.frames.length > LIMIT) { cut = true; return; }
        const last = cyc[cyc.length - 1];
        if (cyc.length === G.n) {
          if (adjOK(last, 0)) {
            found = true;
            const es = estate(); const back = G.edges.find((x) => (x.u === last && x.v === 0) || (x.v === last && x.u === 0)); es[back.id] = "found";
            Object.keys(es).forEach((k) => (es[k] = "found"));
            const vs = {}; cyc.forEach((v) => (vs[v] = "found"));
            r.push(frame(`${G.n} 個頂點都排進來了，而且 ${L(last)} 和 A 相鄰，可以回到起點：找到 Hamilton 迴路 <b>${cyc.map(L).join(" → ")} → A</b>。`, LH.full,
              { v: vs, e: es, showDeg: false, info: [["找到 Hamilton 迴路", "strong"], [cyc.map(L).join("") + "A", ""]] }));
          } else {
            r.push(frame(`頂點都排完了，但 ${L(last)} 和 A <b>不相鄰</b>，回不到起點，這個排法不行，退回。`, LH.full, { v: Object.assign(vstate(), { [last]: "removed" }), e: estate(), showDeg: false, info: info() }));
          }
          return;
        }
        for (let v = 1; v < G.n && !found && !cut; v++) {
          if (used[v] || !adjOK(last, v)) continue;
          used[v] = true; cyc.push(v);
          r.push(frame(`${L(last)} 的鄰居 <b>${L(v)}</b> 還沒用過，放進第 ${cyc.length} 個位置，繼續往下排。`, [LH.ok, LH.put, LH.rec], { v: vstate(), e: estate(), cur: v, showDeg: false, info: info() }));
          go();
          if (found || cut) return;
          cyc.pop(); delete used[v];
          r.push(frame(`從 ${L(v)} 往下怎麼排都不行，<b>退回</b>到 ${L(last)}，改試下一個鄰居。`, LH.undo, { v: Object.assign(vstate(), { [v]: "removed" }), e: estate(), cur: last, showDeg: false, info: info() }));
        }
      })();
      if (cut) r.push(frame(`${iconHTML("alert")} 已經試了很多步還沒結束，動畫先停在這裡。這正說明了 Hamilton 問題的困難：回溯法最差要試 (n − 1)! 種順序。`, null, { v: vstate(), e: estate(), showDeg: false, info: info() }));
      else if (!found) r.push(frame(`所有可能的順序都試過了，都排不出來：這個圖<b>沒有 Hamilton 迴路</b>。`, LH.fail, { showDeg: false, info: [["沒有 Hamilton 迴路", "warn"]] }));
      return r.frames;
    }

    // ---------- 控制列 ----------
    const input = ui.input(player, { placeholder: "邊，例如 AB BC CA", value: PRESETS["蝴蝶結"].edges, width: 230 });
    const build = (pos) => {
      const g = parse(input.value);
      if (typeof g === "string") {
        input.classList.add("is-error"); setTimeout(() => input.classList.remove("is-error"), 700);
        if (G) player.load([frame(`${iconHTML("alert")} ${g}`, null)], { autoplay: false });
        return false;
      }
      if (g.n > MAX_V) return false;
      G = g; P = layout(G, pos && pos.length === G.n ? pos : null);
      return true;
    };
    let curPos = PRESETS["蝴蝶結"].pos;
    input.addEventListener("input", () => (curPos = null));
    ui.button(player, "Euler", () => build(curPos) && player.load(euler()));
    ui.button(player, "Hamilton", () => build(curPos) && player.load(hamilton()));
    Object.keys(PRESETS).forEach((name) => ui.button(player, name, () => {
      input.value = PRESETS[name].edges; curPos = PRESETS[name].pos;
      build(curPos);
      player.setCode(CODE.euler);
      player.load([frame(`載入「${name}」。按 <b>Euler</b> 判斷並用 Hierholzer 找出 Euler 路徑，按 <b>Hamilton</b> 用回溯法找 Hamilton 迴路。`, null)], { autoplay: false });
    }, "ghost"));

    build(curPos);
    const demo = euler();
    demo[0].caption = iconHTML("play") + " 按播放看示範：先數度數判斷有沒有 Euler 迴路，再用 Hierholzer 演算法一步步找出來；注意走到 A 卡住之後，怎麼退回 C 把右邊的小圈接進來。可以點下方的範例圖（房子、七橋、K5…），或自己輸入邊（例如 <code>AB BC CA</code>，同一組字母重複代表重邊）。";
    player.load(demo, { autoplay: false });
  });

  // ===================================================================
  // 靜態圖解
  // ===================================================================
  const V = (id, label, x, y, st, sub) => ({ id, label, x, y, r: 17, state: st || "default", sub: sub || "" });
  const E = (a, b, st) => ({ from: a, to: b, state: st || "default" });
  const dot = (id, x, y) => ({ id, label: "", x, y, r: 2, state: "default" });

  // 圖 1：七橋問題
  figure("euler-konigsberg", () => ({
    width: 640, height: 285,
    nodes: [
      V("a", "A", 300, 130, "active", "deg 5"), V("b", "B", 300, 30, "active", "deg 3"), V("c", "C", 300, 230, "active", "deg 3"), V("d", "D", 470, 130, "active", "deg 3"),
      dot("ab", 262, 80), dot("ac", 262, 180),
    ],
    edges: [E("a", "b"), E("a", "ab"), E("ab", "b"), E("a", "c"), E("a", "ac"), E("ac", "c"), E("a", "d"), E("b", "d"), E("c", "d")],
    labels: [
      { id: "t1", x: 40, y: 60, text: "A：河中的島", anchor: "start" },
      { id: "t2", x: 40, y: 88, text: "B、C：兩岸　D：另一座島", anchor: "start" },
      { id: "t3", x: 40, y: 116, text: "邊：7 座橋", anchor: "start" },
      { id: "t4", x: 40, y: 172, text: "4 個頂點都是奇數度", anchor: "start", cls: "warn" },
      { id: "t5", x: 40, y: 200, text: "→ 不可能每座橋剛好走一次", anchor: "start", cls: "warn" },
    ],
  }));

  // 圖 2：用奇點個數判斷
  figure("euler-conditions", () => ({
    width: 720, height: 250,
    nodes: [
      // (a) 蝴蝶結：全偶
      V("a1", "A", 50, 50, "found", "2"), V("a2", "B", 50, 170, "found", "2"), V("a3", "C", 120, 110, "found", "4"), V("a4", "D", 190, 50, "found", "2"), V("a5", "E", 190, 170, "found", "2"),
      // (b) 正方形 + 一條對角線：兩個奇點
      V("b1", "A", 300, 50, "active", "3"), V("b2", "B", 410, 50, "default", "2"), V("b3", "C", 410, 170, "active", "3"), V("b4", "D", 300, 170, "default", "2"),
      // (c) K4：四個奇點
      V("c1", "A", 545, 50, "removed", "3"), V("c2", "B", 665, 50, "removed", "3"), V("c3", "C", 665, 170, "removed", "3"), V("c4", "D", 545, 170, "removed", "3"),
    ],
    edges: [E("a1", "a2"), E("a1", "a3"), E("a2", "a3"), E("a3", "a4"), E("a3", "a5"), E("a4", "a5"),
      E("b1", "b2"), E("b2", "b3"), E("b3", "b4"), E("b4", "b1"), E("b1", "b3"),
      E("c1", "c2"), E("c2", "c3"), E("c3", "c4"), E("c4", "c1"), E("c1", "c3"), E("c2", "c4")],
    labels: [
      { id: "l1", x: 120, y: 226, text: "(a) 0 個奇點：Euler 迴路", cls: "strong" },
      { id: "l2", x: 355, y: 226, text: "(b) 2 個奇點：Euler 路徑", cls: "strong" },
      { id: "l3", x: 605, y: 226, text: "(c) 4 個奇點：都沒有", cls: "warn" },
    ],
  }));

  // 圖 3：Euler 與 Hamilton 互不保證
  figure("euler-vs-hamilton", () => ({
    width: 640, height: 250,
    nodes: [
      V("p1", "A", 90, 50, "default"), V("p2", "B", 230, 50, "default"), V("p3", "C", 230, 170, "default"), V("p4", "D", 90, 170, "default"),
      V("q1", "A", 380, 50), V("q2", "B", 380, 170), V("q3", "C", 470, 110, "removed"), V("q4", "D", 560, 50), V("q5", "E", 560, 170),
    ],
    edges: [E("p1", "p2", "found"), E("p2", "p3", "found"), E("p3", "p4", "found"), E("p4", "p1", "found"), E("p1", "p3"), E("p2", "p4"),
      E("q1", "q2", "visited"), E("q1", "q3", "visited"), E("q2", "q3", "visited"), E("q3", "q4", "visited"), E("q3", "q5", "visited"), E("q4", "q5", "visited")],
    labels: [
      { id: "l1", x: 160, y: 218, text: "(a) K4：有 Hamilton 迴路", cls: "strong" },
      { id: "l2", x: 160, y: 242, text: "4 個奇點 → 沒有 Euler 路徑", anchor: "middle" },
      { id: "l3", x: 470, y: 218, text: "(b) 蝴蝶結：有 Euler 迴路", cls: "strong" },
      { id: "l4", x: 470, y: 242, text: "C 必須經過兩次 → 沒有 Hamilton 迴路", anchor: "middle" },
    ],
  }));
})();
