/* =====================================================================
   Elementary Matrices and Inverses（基本矩陣與反矩陣）主題的視覺化
   - inverse-gj : 對 [A | I] 做 Gauss–Jordan，每一步標出列運算與對應的基本矩陣 E，
                  最後得到 [I | A⁻¹] 或判定不可逆（分數精確計算）
   ===================================================================== */
(function () {
  "use strict";
  const { Player, Recorder, ui, register, esc, iconHTML, figure } = window.DSViz;

  // 右側程式碼：從 code/linear-algebra/matrix-inverse.c 原封不動取出
  const CODE = [
        "int inverse(Frac A[MAXN][MAXN], Frac inv[MAXN][MAXN]) {   /* 可逆回傳 1，不可逆回傳 0 */",
        "  for (int i = 0; i < n; i++)",
        "    for (int j = 0; j < n; j++) {",
        "      aug[i][j] = A[i][j];                     /* 左半放 A */",
        "      aug[i][n + j] = frac(i == j, 1);         /* 右半放單位矩陣 I */",
        "    }",
        "  int r = 0;",
        "  for (int c = 0; c < n; c++) {",
        "    int p = r;",
        "    while (p < n && isZero(aug[p][c])) p++;    /* 往下找第一個非零的當 pivot */",
        "    if (p == n) continue;                      /* 這一行沒有 pivot：A 不可逆 */",
        "    if (p != r) swapRows(r, p);                /* 第 1 型：列交換 */",
        "    Frac piv = aug[r][c];",
        "    for (int j = 0; j < 2 * n; j++) aug[r][j] = fdiv(aug[r][j], piv);   /* 第 2 型：pivot 變成 1 */",
        "    for (int i = 0; i < n; i++)                /* 第 3 型：同一行其他列消成 0 */",
        "      if (i != r && !isZero(aug[i][c])) {",
        "        Frac f = aug[i][c];",
        "        for (int j = 0; j < 2 * n; j++) aug[i][j] = fsub(aug[i][j], fmul(f, aug[r][j]));",
        "      }",
        "    r++;",
        "  }",
        "  if (r < n) return 0;                         /* pivot 不到 n 個：左半最後會有零列 */",
        "  for (int i = 0; i < n; i++)",
        "    for (int j = 0; j < n; j++) inv[i][j] = aug[i][n + j];   /* 右半就是 A⁻¹ */",
        "  return 1;",
        "}"
  ];
  const at = (s) => CODE.findIndex((l) => l.includes(s)) + 1;
  const LN = {
    init: [at("for (int i = 0; i < n; i++)"), at("aug[i][j] = A[i][j];"), at("aug[i][n + j] = frac(i == j, 1);")],
    find: [at("for (int c = 0; c < n; c++)"), at("int p = r;"), at("while (p < n && isZero")],
    none: at("if (p == n) continue;"),
    swap: at("if (p != r) swapRows"),
    scale: [at("Frac piv = aug[r][c];"), at("fdiv(aug[r][j], piv)")],
    elim: [at("if (i != r && !isZero"), at("Frac f = aug[i][c];"), at("fsub(aug[i][j]")],
    next: at("r++;"),
    fail: at("if (r < n) return 0;"),
    copy: [at("inv[i][j] = aug[i][n + j]"), at("return 1;")],
  };

  // ---------- 分數（精確計算）----------
  const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a || 1; };
  const F = (n, d = 1) => { if (d < 0) { n = -n; d = -d; } const g = gcd(n, d); return { n: n / g, d: d / g }; };
  const add = (x, y) => F(x.n * y.d + y.n * x.d, x.d * y.d);
  const sub = (x, y) => F(x.n * y.d - y.n * x.d, x.d * y.d);
  const mul = (x, y) => F(x.n * y.n, x.d * y.d);
  const div = (x, y) => F(x.n * y.d, x.d * y.n);
  const neg = (x) => F(-x.n, x.d);
  const isZ = (x) => x.n === 0;
  const isOne = (x) => x.n === 1 && x.d === 1;
  const S = (x) => (x.d === 1 ? String(x.n) : `${x.n}/${x.d}`).replace("-", "−");
  const coef = (x) => (isOne(x) ? "" : x.d === 1 ? S(x) : `(${S(x)})`);

  function parse(text) {
    const rows = text.trim().split(/\s*[;\n]\s*/).filter(Boolean);
    if (rows.length < 2 || rows.length > 4) return "請輸入 2～4 列的方陣，列與列之間用分號 ; 隔開。";
    const M = [];
    for (const r of rows) {
      const toks = r.split(/[\s,]+/).filter(Boolean), row = [];
      for (const t of toks) {
        const m = /^(-?\d+)(?:\/(\d+))?$/.exec(t);
        if (!m) return `「${esc(t)}」不是整數或分數（例如 3、-2、1/2）。`;
        const nn = +m[1], d = m[2] ? +m[2] : 1;
        if (d === 0) return "分母不能是 0。";
        if (Math.abs(nn) > 99 || d > 99) return "數字請在 −99～99 之間、分母不超過 99，畫面才放得下。";
        row.push(F(nn, d));
      }
      M.push(row);
    }
    if (M.some((r) => r.length !== M.length)) return `反矩陣只對<b>方陣</b>有定義：你輸入了 ${M.length} 列，每一列也要剛好 ${M.length} 個數。`;
    return M;
  }

  register("inverse-gj", function (root) {
    const player = new Player(root, {
      title: "Gauss–Jordan Inverse 用 [A | I] 求反矩陣",
      width: 560, height: 380, code: CODE,
      legend: [["compare", "找 pivot 的那一行"], ["active", "pivot／E 中改變的位置"], ["new", "剛改變的列"], ["found", "完成"], ["removed", "零列（不可逆）"]],
    });

    let rows = [], n = 0, E = null, eName = "";
    const W = 560, CW = 50, CH = 34, GX = 56, GY = 46, Y0 = 58;
    const x0 = () => (W - (2 * n * GX + 16)) / 2 + GX / 2 + 14;   // 依 n 置中
    const cx = (j) => x0() + j * GX + (j >= n ? 16 : 0), cy = (i) => Y0 + i * GY;
    const EG = 48, EGY = 30, EX0 = 40;
    const ey0 = () => cy(n - 1) + 74;

    function frame(caption, line, opt = {}) {
      const cs = opt.cells || {}, rs = opt.rows || {};
      const nodes = [], edges = [], labels = [];
      rows.forEach((row, i) => {
        row.v.forEach((x, j) => nodes.push({ id: row.id + "c" + j, label: S(x), shape: "box", x: cx(j), y: cy(i), w: CW, h: CH,
          state: cs[i + "," + j] || (rs[i] && (rs[i] !== "zeroL" || j < n) ? (rs[i] === "zeroL" ? "removed" : rs[i]) : (opt.right && j >= n ? opt.right : "default")) }));
        labels.push({ id: "rl" + i, x: x0() - 46, y: cy(i) + 5, text: "R" + (i + 1), cls: "strong" });
      });
      labels.push({ id: "hA", x: (cx(0) + cx(n - 1)) / 2, y: Y0 - 32, text: opt.leftName || "A", cls: "title" });
      labels.push({ id: "hI", x: (cx(n) + cx(2 * n - 1)) / 2, y: Y0 - 32, text: opt.rightName || "I", cls: "title" });
      const sx = (cx(n - 1) + cx(n)) / 2;
      nodes.push({ id: "sepA", label: "", x: sx, y: Y0 - 22, r: 0.5, state: "muted" }, { id: "sepB", label: "", x: sx, y: cy(n - 1) + 22, r: 0.5, state: "muted" });
      edges.push({ from: "sepA", to: "sepB", state: "muted" });
      if (opt.E) {   // 這一步對應的基本矩陣
        labels.push({ id: "eT", x: EX0 + (n - 1) * EG / 2, y: ey0() - 26, text: opt.eLabel, cls: "strong" });
        opt.E.forEach((row, i) => row.forEach((x, j) => {
          const changed = (i === j && !isOne(x)) || (i !== j && !isZ(x));
          nodes.push({ id: "e" + i + j, label: S(x), shape: "box", x: EX0 + j * EG, y: ey0() + i * EGY, w: 44, h: 26, state: changed ? "active" : isZ(x) ? "muted" : "default" });
        }));
      }
      // 有 E 時文字放在 E 的右邊；沒有 E 時從左邊開始
      const TX = opt.E ? EX0 + (n - 1) * EG + 40 : 30, BY = opt.E ? ey0() + 4 : cy(n - 1) + 60;
      if (opt.op) labels.push({ id: "op", x: TX, y: BY, text: opt.op, cls: "strong", anchor: "start" });
      (opt.info || []).forEach((t, k) => labels.push({ id: "in" + k, x: TX, y: BY + (opt.op ? 28 : 0) + k * 26, text: t[0], cls: t[1] || "", anchor: "start" }));
      return { nodes, edges, labels, caption, line };
    }

    const ident = () => Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => F(i === j ? 1 : 0)));

    function run(M) {
      n = M.length;
      const tag = Math.random().toString(36).slice(2, 6);
      rows = M.map((v, i) => ({ id: "r" + i + "_" + tag, v: v.concat(ident()[i]) }));
      const A0 = M.map((r) => r.slice());
      const r = new Recorder(), done = {};
      let k = 0;
      const keep = () => Object.assign({}, done);
      r.push(frame(`左半放 A、右半放單位矩陣 I，組成 ${n}×${2 * n} 的 [A | I]。接下來只用<b>列運算</b>把左半化成 I；每一個列運算都等於左乘一個基本矩陣 E。`, LN.init));
      let rr = 0;
      for (let c = 0; c < n; c++) {
        const colSt = keep(); for (let i = rr; i < n; i++) colSt[i + "," + c] = "compare";
        let p = rr; while (p < n && isZ(rows[p].v[c])) p++;
        if (p === n) {
          r.push(frame(`看第 ${c + 1} 行：從 R${rr + 1} 往下全是 0，<b>找不到 pivot</b>。左半這一行永遠湊不出 I 的 1，所以 A <b>不可逆</b>；照樣處理下一行，最後左半會留下零列。`, LN.none, { cells: colSt }));
          continue;
        }
        r.push(frame(`看第 ${c + 1} 行：從 R${rr + 1} 往下找第一個不是 0 的數，找到 R${p + 1} 的 <b>${S(rows[p].v[c])}</b> 當 pivot。`, LN.find, { cells: Object.assign(colSt, { [p + "," + c]: "active" }) }));
        if (p !== rr) {
          [rows[p], rows[rr]] = [rows[rr], rows[p]];
          const Em = ident(); Em[rr][rr] = Em[p][p] = F(0); Em[rr][p] = Em[p][rr] = F(1); k++;
          r.push(frame(`pivot 要放在第 ${rr + 1} 列，所以交換 R${rr + 1}、R${p + 1}。這是<b>第 1 型</b>基本矩陣：把 I 的第 ${rr + 1}、${p + 1} 列對調，它的反矩陣就是自己。`, LN.swap,
            { op: `R${rr + 1} ↔ R${p + 1}`, info: [[`E${k}：第 1 型（列交換）`, ""]], E: Em, eLabel: `E${k} =`, cells: Object.assign(keep(), { [rr + "," + c]: "active" }), rows: { [rr]: "new", [p]: "new" } }));
        }
        const piv = rows[rr].v[c];
        if (!isOne(piv)) {
          const cc = div(F(1), piv);
          rows[rr].v = rows[rr].v.map((x) => div(x, piv));
          const Em = ident(); Em[rr][rr] = cc; k++;
          r.push(frame(`R${rr + 1} 整列乘以 ${S(cc)}，讓 pivot 變成 1。這是<b>第 2 型</b>基本矩陣：I 的 (${rr + 1},${rr + 1}) 換成 ${S(cc)}；反矩陣是乘回 ${S(piv)}。`, LN.scale,
            { op: `R${rr + 1} ← ${coef(cc)}R${rr + 1}`, info: [[`E${k}：第 2 型（列乘以非零常數）`, ""]], E: Em, eLabel: `E${k} =`, cells: Object.assign(keep(), { [rr + "," + c]: "active" }), rows: { [rr]: "new" } }));
        }
        for (let i = 0; i < n; i++) {
          if (i === rr || isZ(rows[i].v[c])) continue;
          const f = rows[i].v[c], m = neg(f);
          rows[i].v = rows[i].v.map((x, j) => sub(x, mul(f, rows[rr].v[j])));
          const Em = ident(); Em[i][rr] = m; k++;
          const op = f.n > 0 ? `R${i + 1} ← R${i + 1} − ${coef(f)}R${rr + 1}` : `R${i + 1} ← R${i + 1} + ${coef(m)}R${rr + 1}`;
          r.push(frame(`R${i + 1} 在第 ${c + 1} 行是 ${S(f)}，加上 ${S(m)} 倍的 R${rr + 1} 消成 0${i < rr ? "（pivot <b>上方</b>也要消）" : ""}。這是<b>第 3 型</b>：I 的 (${i + 1},${rr + 1}) 放 ${S(m)}；反矩陣把它變號成 ${S(f)}。`, LN.elim,
            { op, info: [[`E${k}：第 3 型（列加上另一列的倍數）`, ""]], E: Em, eLabel: `E${k} =`, cells: Object.assign(keep(), { [rr + "," + c]: "active", [i + "," + c]: "found" }), rows: { [i]: "new" } }));
        }
        done[rr + "," + c] = "found";
        r.push(frame(`第 ${c + 1} 行處理完：pivot 是 1，同一行其他位置都是 0，和 I 的第 ${c + 1} 行一樣。到目前用了 ${k} 個基本矩陣。`, LN.next, { cells: keep() }));
        rr++;
      }
      if (rr < n) {
        const zr = {}; for (let i = rr; i < n; i++) zr[i] = "zeroL";
        const y = rows[n - 1].v.slice(n);
        const comb = y.map((x, i) => (isZ(x) ? "" : (x.n > 0 ? " + " : " − ") + coef(F(Math.abs(x.n), x.d)) + "R" + (i + 1))).join("").replace(/^ \+ /, "").replace(/^ − /, "−");
        r.push(frame(`只有 ${rr} 個 pivot（少於 ${n}）：左半第 ${rr + 1}${n - rr > 1 ? "～" + n : ""} 列<b>全是 0</b>，不可能化成 I，所以 <b>A 不可逆</b>（rank A = ${rr} &lt; ${n}）。右半那一列記錄了原本各列的組合：${comb} = 0，A 的列線性相依。`, LN.fail,
          { cells: keep(), rows: zr, info: [["A 不可逆（singular）", "warn"], [`rank A = ${rr} < ${n}；零列右半：${comb} = 0`, ""]] }));
        return r.frames;
      }
      const inv = rows.map((row) => row.v.slice(n));
      let ok = true;
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
        let s = F(0); for (let t = 0; t < n; t++) s = add(s, mul(A0[i][t], inv[t][j]));
        if (s.n !== (i === j ? 1 : 0) || s.d !== 1) ok = false;
      }
      r.push(frame(`左半變成 I 了：E${k}⋯E1·A = I，所以 E${k}⋯E1 = A⁻¹。右半一開始是 I，跟著做了同樣的 ${k} 次列運算，就是 E${k}⋯E1·I = <b>A⁻¹</b>。驗算 A·A⁻¹ ${ok ? "= I，正確" : "≠ I（不該發生）"}。`, LN.copy,
        { cells: keep(), right: "found", leftName: "I", rightName: "A⁻¹", info: [["A 可逆，右半就是 A⁻¹", "strong"], [`共 ${k} 個基本矩陣；已驗算 A·A⁻¹ = I`, ""]] }));
      return r.frames;
    }

    const PRESETS = {
      "可逆 3×3": "1 2 0; 2 5 1; 0 1 3",
      "需要換列": "0 1 2; 1 1 1; 2 3 5",
      "不可逆": "1 2 3; 2 1 4; 3 3 7",
    };
    const input = ui.input(player, { placeholder: "例如 1 2; 3 4", value: PRESETS["可逆 3×3"], width: 220 });
    const go = () => {
      const M = parse(input.value);
      if (typeof M === "string") {
        input.classList.add("is-error"); setTimeout(() => input.classList.remove("is-error"), 700);
        rows = []; n = 1;
        player.load([{ nodes: [], edges: [], labels: [], caption: `${iconHTML("alert")} ${M}`, line: null }], { autoplay: false });
        return;
      }
      const frames = run(M);
      // 分數太長（超過 6 個字元）時格子放不下，提前擋住
      const long = frames.flatMap((f) => f.nodes).map((nd) => nd.label).find((s) => s && s.length > 6);
      if (long) {
        input.classList.add("is-error"); setTimeout(() => input.classList.remove("is-error"), 700);
        rows = []; n = 1;
        player.load([{ nodes: [], edges: [], labels: [], caption: `${iconHTML("alert")} 計算過程會出現 ${esc(long)} 這種太長的分數，格子放不下。請換一個數字小一點的矩陣（整數矩陣最好）。`, line: null }], { autoplay: false });
        return;
      }
      player.load(frames);
    };
    ui.button(player, "求反矩陣", go);
    Object.keys(PRESETS).forEach((key) => ui.button(player, key, () => { input.value = PRESETS[key]; go(); }, "ghost"));
    input.addEventListener("keydown", (e) => e.key === "Enter" && go());

    const demo = run(parse(PRESETS["可逆 3×3"]));
    demo[0].caption = iconHTML("play") + " 按播放看示範：對 [A | I] 做 6 次列運算（6 個基本矩陣），左半變成 I 時右半就是 A⁻¹。也可以輸入自己的 2×2～4×4 方陣（列用 ; 隔開，可用分數如 1/2），或點「需要換列」「不可逆」看其他情況。";
    player.load(demo, { autoplay: false });
  });

  // ===================================================================
  // 靜態圖解
  // ===================================================================
  const box = (id, label, x, y, st, w, h) => ({ id, label, shape: "box", x, y, w: w || 38, h: h || 30, state: st || "default" });
  // 畫一個矩陣：M 是字串二維陣列；hl(i, j) 回傳狀態
  const mat = (k, x0, y0, M, hl, g = 44, gy = 38, w, h) => M.flatMap((row, i) => row.map((v, j) => box(k + i + "_" + j, v, x0 + j * g, y0 + i * gy, hl(i, j, v) || (v === "0" ? "muted" : "default"), w, h)));

  // 圖 1：三種基本矩陣與它們的反矩陣
  figure("matrix-inverse-elementary", () => {
    const e1 = [["1", "0", "0"], ["0", "0", "1"], ["0", "1", "0"]];
    const e2 = [["1", "0", "0"], ["0", "3", "0"], ["0", "0", "1"]];
    const e3 = [["1", "0", "0"], ["0", "1", "0"], ["4", "0", "1"]];
    const nodes = mat("a", 66, 70, e1, (i, j) => ((i === 1 && j === 2) || (i === 2 && j === 1) ? "active" : (i === 1 && j === 1) || (i === 2 && j === 2) ? "muted" : null))
      .concat(mat("b", 286, 70, e2, (i, j) => (i === 1 && j === 1 ? "active" : null)))
      .concat(mat("c", 506, 70, e3, (i, j) => (i === 2 && j === 0 ? "active" : null)));
    return {
      width: 660, height: 260, nodes,
      labels: [
        { id: "t1", x: 110, y: 24, text: "第 1 型：R2 ↔ R3", cls: "strong" },
        { id: "t2", x: 330, y: 24, text: "第 2 型：R2 ← 3R2", cls: "strong" },
        { id: "t3", x: 550, y: 24, text: "第 3 型：R3 ← R3 + 4R1", cls: "strong" },
        { id: "a1", x: 110, y: 190, text: "對調 I 的第 2、3 列", anchor: "middle" },
        { id: "a2", x: 110, y: 216, text: "反矩陣：自己（再換一次）", anchor: "middle" },
        { id: "b1", x: 330, y: 190, text: "I 的 (2,2) 換成 3", anchor: "middle" },
        { id: "b2", x: 330, y: 216, text: "反矩陣：(2,2) 換成 1/3", anchor: "middle" },
        { id: "c1", x: 550, y: 190, text: "I 的 (3,1) 放 4", anchor: "middle" },
        { id: "c2", x: 550, y: 216, text: "反矩陣：(3,1) 改成 −4", anchor: "middle" },
        { id: "c3", x: 330, y: 248, text: "橘色是和 I 不同的位置：每個基本矩陣只和 I 差「一次列運算」", anchor: "middle" },
      ],
    };
  });

  // 圖 2：左乘基本矩陣 = 做列運算
  figure("matrix-inverse-left-multiply", () => {
    const E = [["1", "0", "0"], ["−2", "1", "0"], ["0", "0", "1"]];
    const A = [["1", "2", "0"], ["2", "5", "1"], ["0", "1", "3"]];
    const EA = [["1", "2", "0"], ["0", "1", "1"], ["0", "1", "3"]];
    const nodes = mat("e", 50, 70, E, (i, j) => (i === 1 && j === 0 ? "active" : null))
      .concat(mat("a", 260, 70, A, (i) => (i === 0 ? "visited" : i === 1 ? "compare" : null)))
      .concat(mat("r", 486, 70, EA, (i) => (i === 1 ? "new" : null)));
    return {
      width: 660, height: 250, nodes,
      labels: [
        { id: "t1", x: 94, y: 24, text: "E（R2 ← R2 − 2R1）", cls: "strong" },
        { id: "t2", x: 304, y: 24, text: "A", cls: "strong" },
        { id: "t3", x: 530, y: 24, text: "EA", cls: "strong" },
        { id: "x", x: 197, y: 113, text: "×", cls: "title" },
        { id: "eq", x: 420, y: 113, text: "=", cls: "title" },
        { id: "n1", x: 330, y: 196, text: "EA 的第 2 列 = (−2)·(A 的第 1 列) + 1·(A 的第 2 列) = (0, 1, 1)", anchor: "middle" },
        { id: "n2", x: 330, y: 224, text: "其他列在 E 裡和 I 一樣，所以 EA 的第 1、3 列照抄 A", anchor: "middle" },
      ],
    };
  });

  // 圖 3：不可逆時 [A | I] 會出現零列
  figure("matrix-inverse-singular", () => {
    const L = [["1", "0", "5/3"], ["0", "1", "2/3"], ["0", "0", "0"]];
    const R = [["−1/3", "2/3", "0"], ["2/3", "−1/3", "0"], ["−1", "−1", "1"]];
    const nodes = mat("l", 140, 64, L, (i, j) => (i === 2 ? "removed" : i === j ? "found" : null), 60, 42, 52, 32)
      .concat(mat("r", 340, 64, R, (i) => (i === 2 ? "active" : null), 60, 42, 52, 32));
    nodes.push({ id: "s1", label: "", x: 310, y: 42, r: 0.5, state: "muted" }, { id: "s2", label: "", x: 310, y: 170, r: 0.5, state: "muted" });
    return {
      width: 660, height: 250, nodes, edges: [{ from: "s1", to: "s2", state: "muted" }],
      labels: [
        { id: "t1", x: 200, y: 24, text: "左半（A 化簡後）", cls: "strong" },
        { id: "t2", x: 400, y: 24, text: "右半", cls: "strong" },
        { id: "rl1", x: 90, y: 69, text: "R1", cls: "strong" },
        { id: "rl2", x: 90, y: 111, text: "R2", cls: "strong" },
        { id: "rl3", x: 90, y: 153, text: "R3", cls: "strong" },
        { id: "n1", x: 330, y: 206, text: "A = [1 2 3; 2 1 4; 3 3 7]：第 3 行找不到 pivot，左半第 3 列變成零列", anchor: "middle" },
        { id: "n2", x: 330, y: 234, text: "右半這一列是 (−1, −1, 1)：−R1 − R2 + R3 = 0，也就是 R3 = R1 + R2", anchor: "middle" },
      ],
    };
  });

  // 圖 4：可逆的等價條件
  figure("matrix-inverse-equivalent", () => {
    const C = { x: 330, y: 140 };
    const items = [
      ["eq1", "A 列等價於 I", 126, 46], ["eq2", "Ax = 0 只有零解", 534, 46],
      ["eq3", "Ax = b 恆有唯一解", 120, 140], ["eq4", "A = 基本矩陣乘積", 540, 140],
      ["eq5", "rank A = n", 126, 234], ["eq6", "det A ≠ 0", 534, 234],
    ];
    const nodes = [box("c", "A（n×n）可逆", C.x, C.y, "found", 150, 40)].concat(items.map(([id, t, x, y]) => box(id, t, x, y, "compare", 200, 36)));
    return {
      width: 660, height: 280, nodes,
      edges: items.map(([id]) => ({ from: "c", to: id, state: "visited" })),
      labels: [{ id: "n", x: 330, y: 272, text: "任何一個成立，其他全部成立；任何一個不成立，A 就不可逆", anchor: "middle" }],
    };
  });
})();
