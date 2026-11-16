/* =====================================================================
   Gaussian Elimination（高斯消去法與列梯形）主題的視覺化
   - gauss-jordan : 用列運算把增廣矩陣化成 RREF，判斷唯一解／無限多解／無解（分數精確計算）
   ===================================================================== */
(function () {
  "use strict";
  const { Player, Recorder, ui, register, esc, iconHTML, figure } = window.DSViz;

  // 右側程式碼：從 code/linear-algebra/gaussian-elimination.c 原封不動取出
  const CODE = [
      "int rref(int pivotCol[]) {                     /* 回傳 rank；pivotCol[k] 是第 k 個 pivot 所在的行 */",
      "  int r = 0;",
      "  for (int c = 0; c < n && r < m; c++) {",
      "    int p = r;",
      "    while (p < m && fabs(a[p][c]) < EPS) p++;  /* 往下找第一個非零的當 pivot */",
      "    if (p == m) continue;                      /* 這一行沒有 pivot：對應自由變數 */",
      "    if (p != r) swapRows(r, p);                /* 列交換：把 pivot 換到第 r 列 */",
      "    double piv = a[r][c];",
      "    for (int j = 0; j < n; j++) a[r][j] /= piv;   /* 列乘以常數：pivot 變成 1 */",
      "    for (int i = 0; i < m; i++)                /* 列相加：把同一行其他列消成 0 */",
      "      if (i != r && fabs(a[i][c]) > EPS) {",
      "        double f = a[i][c];",
      "        for (int j = 0; j < n; j++) a[i][j] -= f * a[r][j];",
      "      }",
      "    pivotCol[r++] = c;",
      "  }",
      "  return r;",
      "}",
      "",
      "int classify(int rank, int pivotCol[]) {",
      "  if (rank > 0 && pivotCol[rank - 1] == n - 1) return 0;   /* pivot 落在常數行：出現 0 = 1 */",
      "  if (rank == n - 1) return 1;                 /* 每個未知數都有 pivot */",
      "  return 2;                                    /* 有沒有 pivot 的行：自由變數 */",
      "}"
  ];
  // 行號（對應上面的 CODE）
  const LN = { col: [3, 4, 5], none: 6, swap: 7, scale: [8, 9], elim: [10, 11, 12, 13], done: 15, ret: 17, noSol: 21, unique: 22, inf: 23 };

  // ---------- 分數（精確計算，顯示成 -7/3 這種寫法）----------
  const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a || 1; };
  const F = (n, d = 1) => { if (d < 0) { n = -n; d = -d; } const g = gcd(n, d); return { n: n / g, d: d / g }; };
  const add = (x, y) => F(x.n * y.d + y.n * x.d, x.d * y.d);
  const sub = (x, y) => F(x.n * y.d - y.n * x.d, x.d * y.d);
  const mul = (x, y) => F(x.n * y.n, x.d * y.d);
  const div = (x, y) => F(x.n * y.d, x.d * y.n);
  const isZ = (x) => x.n === 0;
  const isOne = (x) => x.n === 1 && x.d === 1;
  const S = (x) => (x.d === 1 ? String(x.n) : `${x.n}/${x.d}`).replace("-", "−");
  const coef = (x) => (isOne(x) ? "" : x.n === -1 && x.d === 1 ? "−" : x.d === 1 ? S(x) : `(${S(x)})`);

  function parse(text) {
    const rows = text.trim().split(/\s*[;\n]\s*/).filter(Boolean);
    if (rows.length < 2 || rows.length > 4) return "請輸入 2～4 列，列與列之間用分號 ; 隔開。";
    const M = [];
    for (const r of rows) {
      const toks = r.split(/[\s,]+/).filter(Boolean), row = [];
      for (const t of toks) {
        const m = /^(-?\d+)(?:\/(\d+))?$/.exec(t);
        if (!m) return `「${esc(t)}」不是整數或分數（例如 3、-2、1/2）。`;
        const n = +m[1], d = m[2] ? +m[2] : 1;
        if (d === 0) return "分母不能是 0。";
        if (Math.abs(n) > 99 || d > 99) return "數字請在 −99～99 之間，畫面才放得下。";
        row.push(F(n, d));
      }
      M.push(row);
    }
    const n = M[0].length;
    if (n < 2 || n > 5) return "每列要有 2～5 個數（最後一個是等號右邊的常數）。";
    if (M.some((r) => r.length !== n)) return "每一列的個數要一樣。";
    return M;
  }

  register("gauss-jordan", function (root) {
    const player = new Player(root, {
      title: "Gauss–Jordan Elimination 高斯–喬登消去法",
      width: 680, height: 340, code: CODE,
      legend: [["compare", "找 pivot 的那一行"], ["active", "pivot"], ["new", "剛改變的列"], ["found", "完成的 pivot"], ["removed", "矛盾的列"]],
    });

    let rows = [], m = 0, n = 0;
    const CW = 64, CH = 38, GX = 74, GY = 52, X0 = 120, Y0 = 70;
    const cx = (j) => X0 + j * GX + (j === n - 1 ? 14 : 0), cy = (i) => Y0 + i * GY;

    function frame(caption, line, opt = {}) {
      const cs = opt.cells || {}, rs = opt.rows || {};
      const nodes = [], edges = [], labels = [];
      rows.forEach((row, i) => {
        row.v.forEach((x, j) => nodes.push({ id: row.id + "c" + j, label: S(x), shape: "box", x: cx(j), y: cy(i), w: CW, h: CH, state: cs[i + "," + j] || rs[i] || "default" }));
        labels.push({ id: "rl" + i, x: X0 - 52, y: cy(i) + 5, text: "R" + (i + 1), cls: "strong" });
      });
      for (let j = 0; j < n; j++) labels.push({ id: "hd" + j, x: cx(j), y: Y0 - 34, text: j === n - 1 ? "b" : "x" + (j + 1), cls: "title" });
      const sx = (cx(n - 2) + cx(n - 1)) / 2;
      nodes.push({ id: "sepA", label: "", x: sx, y: Y0 - 22, r: 0.5, state: "muted" }, { id: "sepB", label: "", x: sx, y: cy(m - 1) + 22, r: 0.5, state: "muted" });
      edges.push({ from: "sepA", to: "sepB", state: "muted" });
      const RX = cx(n - 1) + 56;
      if (opt.op) labels.push({ id: "op", x: RX, y: Y0 + 4, text: opt.op, cls: "strong", anchor: "start" });
      (opt.info || []).forEach((t, k) => labels.push({ id: "in" + k, x: RX, y: Y0 + 40 + k * 26, text: t, anchor: "start" }));
      (opt.result || []).forEach((t, k) => labels.push({ id: "res" + k, x: 40, y: cy(m - 1) + 62 + k * 26, text: t[0], cls: t[1] || "", anchor: "start" }));
      return { nodes, edges, labels, caption, line };
    }

    function solve(M) {
      m = M.length; n = M[0].length;
      rows = M.map((v, i) => ({ id: "r" + i + "_" + Math.random().toString(36).slice(2, 6), v: v.slice() }));
      const r = new Recorder(), done = {}, pivotCol = [];
      const keepDone = () => Object.assign({}, done);
      r.push(frame(`增廣矩陣 [A | b]：每一列是一條方程式，直線右邊是常數。目標是用三種<b>列運算</b>化成簡化列梯形（RREF）。`, 2));
      let rr = 0;
      for (let c = 0; c < n && rr < m; c++) {
        const colSt = keepDone(); for (let i = rr; i < m; i++) colSt[i + "," + c] = "compare";
        let p = rr; while (p < m && isZ(rows[p].v[c])) p++;
        const name = c === n - 1 ? "常數行 b" : "x" + (c + 1) + " 這一行";
        if (p === m) {
          r.push(frame(`看${name}：從 R${rr + 1} 往下都是 0，<b>沒有 pivot</b>。${c < n - 1 ? `x${c + 1} 沒有 pivot，會是<b>自由變數</b>。` : ""}跳到下一行。`, LN.none, { cells: colSt }));
          continue;
        }
        r.push(frame(`看${name}：從 R${rr + 1} 往下找第一個不是 0 的數，找到 R${p + 1} 的 <b>${S(rows[p].v[c])}</b>，它就是這一行的 pivot。`, LN.col, { cells: Object.assign(colSt, { [p + "," + c]: "active" }) }));
        if (p !== rr) {
          [rows[p], rows[rr]] = [rows[rr], rows[p]];
          r.push(frame(`pivot 要放在第 ${rr + 1} 列，所以<b>交換</b> R${rr + 1} 和 R${p + 1}。兩條方程式換位置，解不會改變。`, LN.swap, { op: `R${rr + 1} ↔ R${p + 1}`, cells: Object.assign(keepDone(), { [rr + "," + c]: "active" }), rows: { [rr]: "new", [p]: "new" } }));
        }
        const piv = rows[rr].v[c];
        if (!isOne(piv)) {
          rows[rr].v = rows[rr].v.map((x) => div(x, piv));
          r.push(frame(`把 R${rr + 1} 整列除以 pivot ${S(piv)}，讓 pivot <b>變成 1</b>（RREF 要求 leading 1）。`, LN.scale, { op: `R${rr + 1} ← (${S(div(F(1), piv))}) R${rr + 1}`, cells: Object.assign(keepDone(), { [rr + "," + c]: "active" }), rows: { [rr]: "new" } }));
        }
        for (let i = 0; i < m; i++) {
          if (i === rr || isZ(rows[i].v[c])) continue;
          const f = rows[i].v[c];
          rows[i].v = rows[i].v.map((x, j) => sub(x, mul(f, rows[rr].v[j])));
          const op = f.n > 0 ? `R${i + 1} ← R${i + 1} − ${coef(f)}R${rr + 1}` : `R${i + 1} ← R${i + 1} + ${coef(F(-f.n, f.d))}R${rr + 1}`;
          r.push(frame(`R${i + 1} 在這一行是 ${S(f)}，要消成 0：減掉 ${S(f)} 倍的 R${rr + 1}。${i < rr ? "（pivot <b>上面</b>也要消，這是 Gauss–Jordan 和高斯消去法的差別）" : ""}`, LN.elim,
            { op, cells: Object.assign(keepDone(), { [rr + "," + c]: "active", [i + "," + c]: "found" }), rows: { [i]: "new" } }));
        }
        done[rr + "," + c] = "found"; pivotCol.push(c);
        r.push(frame(`${name}處理完：pivot 是 1，同一行其他位置都是 0。rank 目前是 ${rr + 1}。`, LN.done, { cells: keepDone() }));
        rr++;
      }
      const rank = rr;
      r.push(frame(`化成 RREF 了，共有 <b>${rank}</b> 個 pivot，所以 rank = ${rank}。接著看 pivot 的位置判斷解的情況。`, LN.ret, { cells: keepDone(), info: [`rank = ${rank}`, `未知數 ${n - 1} 個`] }));
      // 判斷
      if (rank > 0 && pivotCol[rank - 1] === n - 1) {
        const bad = rank - 1, rs = { [bad]: "removed" };
        r.push(frame(`R${bad + 1} 的係數全是 0，常數卻是 1，代表 <b>0 = 1</b>，矛盾：方程組<b>無解</b>（inconsistent）。`, LN.noSol, { cells: keepDone(), rows: rs, result: [["無解：出現 0 = 1 的列", "warn"], [`rank(A) = ${rank - 1} < rank([A | b]) = ${rank}`, ""]] }));
      } else if (rank === n - 1) {
        const sol = rows.slice(0, rank).map((row, k) => `x${pivotCol[k] + 1} = ${S(row.v[n - 1])}`);
        r.push(frame(`每個未知數都有 pivot（rank = 未知數個數 = ${rank}），沒有自由變數：<b>唯一解</b>，直接從最後一行讀出來。`, LN.unique, { cells: keepDone(), result: [["唯一解", "strong"], [sol.join("，"), ""]] }));
      } else {
        const free = []; for (let j = 0; j < n - 1; j++) if (!pivotCol.includes(j)) free.push(j);
        const pname = ["t", "s", "u", "w"];
        const fv = {}; free.forEach((j, k) => (fv[j] = pname[k]));
        const sol = rows.slice(0, rank).map((row, k) => {
          let t = S(row.v[n - 1]);
          free.forEach((j) => { const a = row.v[j]; if (isZ(a)) return; const na = F(-a.n, a.d); t += (na.n > 0 ? " + " : " − ") + coef(F(Math.abs(na.n), na.d)) + fv[j]; });
          return `x${pivotCol[k] + 1} = ${t.replace(/^0 \+ /, "").replace(/^0 − /, "−")}`;
        });
        free.forEach((j) => sol.push(`x${j + 1} = ${fv[j]}`));
        sol.sort((p1, p2) => +p1.slice(1, p1.indexOf(" ")) - +p2.slice(1, p2.indexOf(" ")));   // 依未知數編號排列
        r.push(frame(`rank = ${rank} &lt; 未知數個數 ${n - 1}，${free.map((j) => "x" + (j + 1)).join("、")} 沒有 pivot，是<b>自由變數</b>，可以任意取值：<b>無限多解</b>。`, LN.inf,
          { cells: keepDone(), result: [[`無限多解（${free.length} 個自由變數，${free.map((j) => fv[j]).join("、")} 為任意實數）`, "strong"], [sol.join("，"), ""]] }));
      }
      return r.frames;
    }

    const PRESETS = {
      "唯一解": "1 1 1 6; 2 -1 1 3; 1 2 -1 2",
      "需要列交換": "0 2 1 7; 1 1 1 6; 2 1 3 13",
      "無限多解": "1 2 -1 1; 2 4 1 8; 3 6 0 9",
      "無解": "1 1 2 3; 2 3 1 5; 3 4 3 9",
    };
    const input = ui.input(player, { placeholder: "例如 1 1 1 6; 2 -1 1 3", value: PRESETS["唯一解"], width: 230 });
    const go = () => {
      const M = parse(input.value);
      if (typeof M === "string") {
        input.classList.add("is-error"); setTimeout(() => input.classList.remove("is-error"), 700);
        player.load([Object.assign(frame(`${iconHTML("alert")} ${M}`, null), {})], { autoplay: false });
        return;
      }
      player.load(solve(M));
    };
    ui.button(player, "化成 RREF", go);
    Object.keys(PRESETS).forEach((k) => ui.button(player, k, () => { input.value = PRESETS[k]; go(); }, "ghost"));
    input.addEventListener("keydown", (e) => e.key === "Enter" && go());

    const demo = solve(parse(PRESETS["唯一解"]));
    demo[0].caption = iconHTML("play") + " 按播放看示範：用列運算把 3 條方程式化成 RREF，最後直接讀出 x₁ = 1、x₂ = 2、x₃ = 3。也可以在輸入框輸入自己的增廣矩陣（列用 ; 隔開，最後一個數是常數），或點「需要列交換」「無限多解」「無解」看不同情況。";
    player.load(demo, { autoplay: false });
  });

  // ===================================================================
  // 靜態圖解
  // ===================================================================
  const P = (id, x, y, st) => ({ id, label: "", x, y, r: 0.5, state: st || "muted" });
  const L = (a, b, st) => ({ from: a, to: b, state: st });
  const B = (id, label, x, y, st) => ({ id, label, shape: "box", x, y, w: 48, h: 32, state: st || "default" });

  // 圖 1：兩條直線的三種關係
  figure("gauss-geometry", () => {
    const panel = (k, cx, l1, l2, dot) => {
      const nodes = [P(k + "a1", cx + l1[0], l1[1]), P(k + "a2", cx + l1[2], l1[3]), P(k + "b1", cx + l2[0], l2[1]), P(k + "b2", cx + l2[2], l2[3])];
      const edges = [L(k + "a1", k + "a2", "compare"), L(k + "b1", k + "b2", "active")];
      if (dot) nodes.push({ id: k + "d", label: "", x: cx + dot[0], y: dot[1], r: 6, state: "found" });
      return { nodes, edges };
    };
    const a = panel("a", 120, [-90, 40, 90, 170], [-90, 170, 90, 40], [0, 105]);
    const b = panel("b", 330, [-90, 60, 90, 150], [-90, 100, 90, 190]);
    const c = panel("c", 540, [-90, 50, 90, 170], [-88, 54, 88, 166]);
    return {
      width: 660, height: 250,
      nodes: a.nodes.concat(b.nodes, c.nodes), edges: a.edges.concat(b.edges, c.edges),
      labels: [
        { id: "l1", x: 120, y: 214, text: "(a) 相交：唯一解", cls: "strong" },
        { id: "l2", x: 330, y: 214, text: "(b) 平行：無解", cls: "warn" },
        { id: "l3", x: 540, y: 214, text: "(c) 重合：無限多解", cls: "strong" },
        { id: "l4", x: 120, y: 240, text: "x + y = 3，x − y = 1", anchor: "middle" },
        { id: "l5", x: 330, y: 240, text: "x + 2y = 2，x + 2y = 5", anchor: "middle" },
        { id: "l6", x: 540, y: 240, text: "x + 2y = 2，2x + 4y = 4", anchor: "middle" },
      ],
    };
  });

  // 圖 2：REF 與 RREF
  figure("gauss-ref-rref", () => {
    const mat = (k, x0, M, piv) => M.flatMap((row, i) => row.map((v, j) => B(k + i + j, v, x0 + j * 56 + (j === 3 ? 12 : 0), 60 + i * 46, piv.some(([pi, pj]) => pi === i && pj === j) ? "active" : (v === "0" ? "muted" : "default"))));
    const ref = [["1", "1", "1", "6"], ["0", "−3", "−1", "−9"], ["0", "0", "−7/3", "−7"]];
    const rref = [["1", "0", "0", "1"], ["0", "1", "0", "2"], ["0", "0", "1", "3"]];
    const nodes = mat("a", 70, ref, [[0, 0], [1, 1], [2, 2]]).concat(mat("b", 400, rref, [[0, 0], [1, 1], [2, 2]]));
    return {
      width: 660, height: 240, nodes,
      labels: [
        { id: "t1", x: 160, y: 22, text: "列梯形 REF", cls: "strong" },
        { id: "t2", x: 490, y: 22, text: "簡化列梯形 RREF", cls: "strong" },
        { id: "n1", x: 160, y: 206, text: "pivot 下方都是 0，呈階梯狀", anchor: "middle" },
        { id: "n2", x: 160, y: 230, text: "還要回代才知道答案", anchor: "middle" },
        { id: "n3", x: 490, y: 206, text: "pivot 都是 1，上下都是 0", anchor: "middle" },
        { id: "n4", x: 490, y: 230, text: "直接讀出 x = (1, 2, 3)", anchor: "middle" },
      ],
    };
  });

  // 圖 3：從 RREF 判斷解的情況
  figure("gauss-three-cases", () => {
    const mat = (k, x0, M, st) => M.flatMap((row, i) => row.map((v, j) => ({ id: k + i + j, label: v, shape: "box", x: x0 + j * 44 + (j === 3 ? 8 : 0), y: 56 + i * 40, w: 38, h: 30, state: st(i, j, v) })));
    const u = mat("u", 40, [["1", "0", "0", "1"], ["0", "1", "0", "2"], ["0", "0", "1", "3"]], (i, j) => (i === j ? "found" : "default"));
    const f = mat("f", 260, [["1", "2", "0", "3"], ["0", "0", "1", "2"], ["0", "0", "0", "0"]], (i, j) => (i === 0 && j === 0) || (i === 1 && j === 2) ? "found" : j === 1 ? "active" : i === 2 ? "muted" : "default");
    const nn = mat("n", 480, [["1", "0", "5", "0"], ["0", "1", "−3", "0"], ["0", "0", "0", "1"]], (i, j) => i === 2 ? "removed" : (i === j ? "found" : "default"));
    return {
      width: 660, height: 250, nodes: u.concat(f, nn),
      labels: [
        { id: "a", x: 110, y: 22, text: "(a) 唯一解", cls: "strong" },
        { id: "b", x: 330, y: 22, text: "(b) 無限多解", cls: "strong" },
        { id: "c", x: 550, y: 22, text: "(c) 無解", cls: "warn" },
        { id: "a2", x: 110, y: 200, text: "每個未知數都有 pivot", anchor: "middle" },
        { id: "b2", x: 330, y: 200, text: "x₂ 沒有 pivot：自由變數", anchor: "middle" },
        { id: "b3", x: 330, y: 224, text: "x = (3 − 2t, t, 2)", anchor: "middle" },
        { id: "c2", x: 550, y: 200, text: "最後一列：0 = 1", anchor: "middle" },
        { id: "c3", x: 550, y: 224, text: "pivot 落在常數行", anchor: "middle" },
      ],
    };
  });
})();
