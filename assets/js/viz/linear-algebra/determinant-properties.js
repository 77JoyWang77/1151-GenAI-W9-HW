/* =====================================================================
   Determinants and Their Properties（行列式與其性質）主題的視覺化
   - det-rowops : (1) 化成上三角求 det，逐步追蹤列交換的正負號
                  (2) 自訂列運算（交換、倍乘、加倍數），追蹤 det(新) = factor × det(A)
                  分數精確計算
   ===================================================================== */
(function () {
  "use strict";
  const { Player, Recorder, ui, register, esc, iconHTML, figure } = window.DSViz;

  // 右側程式碼：從 code/linear-algebra/determinant-properties.c 原封不動取出
  const CODE_ELIM = [
    "Frac detElim(Frac A[MAXN][MAXN], int size, int pickMax) {   /* 化成上三角，det = 正負號 × 對角線乘積 */",
    "  Frac U[MAXN][MAXN];",
    "  copyMat(A, U, size);",
    "  int sign = 1;                                  /* 每交換一次列就變號 */",
    "  for (int c = 0; c < size; c++) {",
    "    int p = c;                                   /* 在第 c 行、第 c 列以下找 pivot */",
    "    for (int i = c; i < size; i++) {",
    "      if (isZero(U[p][c]) && !isZero(U[i][c])) p = i;    /* 預設：第一個非零 */",
    "      if (pickMax && absGreater(U[i][c], U[p][c])) p = i;   /* 選項：絕對值最大 */",
    "    }",
    "    if (isZero(U[p][c])) return frac(0, 1);      /* 這一行往下全是 0：det = 0 */",
    "    if (p != c) { swapRows(U, size, p, c); sign = -sign; }   /* 列交換：det 變號 */",
    "    for (int i = c + 1; i < size; i++) {         /* 列加上倍數：det 不變 */",
    "      if (isZero(U[i][c])) continue;",
    "      Frac f = fdiv(U[i][c], U[c][c]);",
    "      for (int j = c; j < size; j++) U[i][j] = fsub(U[i][j], fmul(f, U[c][j]));",
    "    }",
    "  }",
    "  Frac d = frac(sign, 1);",
    "  for (int i = 0; i < size; i++) d = fmul(d, U[i][i]);   /* 上三角：det = 對角線乘積 */",
    "  return d;",
    "}"
  ];
  const CODE_OPS = [
    "/* 對 A 做一次列運算；factor 記錄 det(新矩陣) = factor × det(原矩陣) */",
    "void opSwap(Frac A[MAXN][MAXN], int size, int i, int j, Frac *factor) {",
    "  swapRows(A, size, i, j);                       /* R_i ↔ R_j：det 乘 −1 */",
    "  *factor = fmul(*factor, frac(-1, 1));",
    "}",
    "void opScale(Frac A[MAXN][MAXN], int size, int i, Frac c, Frac *factor) {",
    "  for (int k = 0; k < size; k++) A[i][k] = fmul(c, A[i][k]);   /* R_i ← cR_i：det 乘 c */",
    "  *factor = fmul(*factor, c);",
    "}",
    "void opAdd(Frac A[MAXN][MAXN], int size, int i, int j, Frac c, Frac *factor) {",
    "  for (int k = 0; k < size; k++) A[i][k] = fadd(A[i][k], fmul(c, A[j][k]));   /* R_i ← R_i + cR_j：det 不變 */",
    "  (void)factor;",
    "}"
  ];
  const finder = (code) => (s) => code.findIndex((l) => l.includes(s)) + 1;
  const le = finder(CODE_ELIM), lo = finder(CODE_OPS);
  const LN = {
    init: [le("copyMat(A, U, size);"), le("int sign = 1;")],
    find: [le("for (int c = 0; c < size; c++)"), le("int p = c;"), le("if (isZero(U[p][c]) && !isZero(U[i][c])) p = i;")],
    findMax: [le("for (int c = 0; c < size; c++)"), le("int p = c;"), le("if (pickMax && absGreater")],
    zero: le("if (isZero(U[p][c])) return frac(0, 1);"),
    swap: le("if (p != c) { swapRows"),
    elim: [le("for (int i = c + 1; i < size; i++) {"), le("Frac f = fdiv(U[i][c], U[c][c]);"), le("U[i][j] = fsub(U[i][j], fmul(f, U[c][j]));")],
    done: [le("Frac d = frac(sign, 1);"), le("d = fmul(d, U[i][i]);"), le("return d;")],
    oSwap: [lo("swapRows(A, size, i, j);"), lo("*factor = fmul(*factor, frac(-1, 1));")],
    oScale: [lo("A[i][k] = fmul(c, A[i][k]);"), lo("*factor = fmul(*factor, c);")],
    oAdd: [lo("A[i][k] = fadd(A[i][k], fmul(c, A[j][k]));"), lo("(void)factor;")],
  };

  // ---------- 分數（精確計算）----------
  const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a || 1; };
  const F = (n, d = 1) => { if (d < 0) { n = -n; d = -d; } const g = gcd(n, d); return { n: n / g, d: d / g }; };
  const add = (x, y) => F(x.n * y.d + y.n * x.d, x.d * y.d);
  const sub = (x, y) => F(x.n * y.d - y.n * x.d, x.d * y.d);
  const mul = (x, y) => F(x.n * y.n, x.d * y.d);
  const div = (x, y) => F(x.n * y.d, x.d * y.n);
  const isZ = (x) => x.n === 0;
  const isOne = (x) => x.n === 1 && x.d === 1;
  const absGt = (x, y) => Math.abs(x.n) * y.d > Math.abs(y.n) * x.d;
  const S = (x) => (x.d === 1 ? String(x.n) : `${x.n}/${x.d}`).replace("-", "−");
  const P = (x) => (x.n < 0 || x.d !== 1 ? `(${S(x)})` : S(x));   // 乘式裡加括號
  const coef = (x) => (isOne(x) ? "" : x.d === 1 ? S(x) : `(${S(x)})`);

  function detOf(M) {                   // 驗算用：同 detElim()
    const U = M.map((r) => r.slice()), n = U.length;
    let sign = 1;
    for (let c = 0; c < n; c++) {
      let p = c; while (p < n && isZ(U[p][c])) p++;
      if (p === n) return F(0);
      if (p !== c) { [U[p], U[c]] = [U[c], U[p]]; sign = -sign; }
      for (let i = c + 1; i < n; i++) {
        if (isZ(U[i][c])) continue;
        const f = div(U[i][c], U[c][c]);
        U[i] = U[i].map((x, j) => sub(x, mul(f, U[c][j])));
      }
    }
    return U.reduce((d, r, i) => mul(d, r[i]), F(sign));
  }

  function parseNum(t) {
    const m = /^([+-]?\d+)(?:\/(\d+))?$/.exec(t);
    if (!m) return null;
    const d = m[2] ? +m[2] : 1;
    if (d === 0 || Math.abs(+m[1]) > 99 || d > 99) return null;
    return F(+m[1], d);
  }

  function parseMatrix(text) {
    const rows = text.trim().split(/\s*[;\n]\s*/).filter(Boolean);
    if (rows.length < 2 || rows.length > 5) return "請輸入 2～5 列的方陣，列與列之間用分號 ; 隔開。";
    const M = [];
    for (const r of rows) {
      const row = [];
      for (const t of r.split(/[\s,]+/).filter(Boolean)) {
        const v = parseNum(t);
        if (!v) return `「${esc(t)}」不是 −99～99 的整數或分數（例如 3、-2、1/2）。`;
        row.push(v);
      }
      M.push(row);
    }
    if (M.some((r) => r.length !== M.length)) return `行列式只對<b>方陣</b>有定義：你輸入了 ${M.length} 列，每一列也要剛好 ${M.length} 個數。`;
    return M;
  }

  // 列運算：R1<->R2、R3*3（或 3R3）、R2-2R1、R2+1/2R3
  function parseOps(text, n) {
    const toks = text.split(/[,，]/).map((s) => s.replace(/\s+/g, "")).filter(Boolean);
    if (!toks.length) return "請輸入至少一個列運算，例如 R1<->R2, R3*3, R2-2R1。";
    if (toks.length > 8) return "一次最多 8 個列運算。";
    const ops = [];
    const row = (s) => { const k = +s; return k >= 1 && k <= n ? k - 1 : null; };
    for (const t of toks) {
      let m;
      if ((m = /^R(\d)(?:<->|↔)R(\d)$/i.exec(t))) {
        const i = row(m[1]), j = row(m[2]);
        if (i === null || j === null) return `「${esc(t)}」的列號超出範圍（只有 R1～R${n}）。`;
        if (i === j) return `「${esc(t)}」是自己和自己交換，不是列運算。`;
        ops.push({ k: "swap", i, j, text: t });
      } else if ((m = /^R(\d)\*([+-]?\d+(?:\/\d+)?)$/i.exec(t)) || (m = /^([+-]?\d+(?:\/\d+)?)\*?R(\d)$/i.exec(t))) {
        const rowFirst = /^R/i.test(t);
        const i = row(rowFirst ? m[1] : m[2]), c = parseNum(rowFirst ? m[2] : m[1]);
        if (i === null) return `「${esc(t)}」的列號超出範圍（只有 R1～R${n}）。`;
        if (!c) return `「${esc(t)}」的倍數要是 −99～99 的整數或分數。`;
        if (isZ(c)) return `「${esc(t)}」把一列乘以 0 不是合法的列運算（不可逆，det 會直接變成 0）。`;
        ops.push({ k: "scale", i, c, text: t });
      } else if ((m = /^R(\d)([+-])(\d+(?:\/\d+)?)?\*?R(\d)$/i.exec(t))) {
        const i = row(m[1]), j = row(m[4]);
        if (i === null || j === null) return `「${esc(t)}」的列號超出範圍（只有 R1～R${n}）。`;
        if (i === j) return `「${esc(t)}」是把自己的倍數加到自己（等於倍乘），請改用 R${i + 1}*c 的寫法。`;
        const mag = m[3] ? parseNum(m[3]) : F(1);
        if (!mag || isZ(mag)) return `「${esc(t)}」的倍數要是 1～99 的整數或分數。`;
        ops.push({ k: "add", i, j, c: m[2] === "-" ? F(-mag.n, mag.d) : mag, text: t });
      } else {
        return `看不懂「${esc(t)}」。寫法：交換 R1<->R2、倍乘 R3*3、加倍數 R2-2R1 或 R2+1/2R3。`;
      }
    }
    return ops;
  }

  register("det-rowops", function (root) {
    const W = 620;
    const player = new Player(root, {
      title: "Row Operations and Determinant 列運算與行列式",
      width: W, height: 340, code: CODE_ELIM,
      legend: [["compare", "找 pivot 的那一行"], ["active", "pivot"], ["new", "剛改變的列"], ["found", "對角線（完成）"], ["visited", "加倍數的來源列"], ["removed", "整行是 0"]],
    });

    let rows = [], n = 3, hist = [];
    const GX = 60, GY = 44, CW = 54, CH = 34, Y0 = 62;
    const x0 = () => 70;
    const cx = (j) => x0() + j * GX, cy = (i) => Y0 + i * GY;
    const PX = () => x0() + (n - 1) * GX + 64;     // 右側說明欄
    const H = () => Math.max(300, cy(n - 1) + 118);

    function frame(caption, line, opt = {}) {
      const cs = opt.cells || {}, rs = opt.rows || {};
      const nodes = [], labels = [];
      rows.forEach((row, i) => {
        row.v.forEach((x, j) => nodes.push({ id: row.id + "c" + j, label: S(x), shape: "box", x: cx(j), y: cy(i), w: CW, h: CH,
          state: cs[i + "," + j] || rs[i] || (isZ(x) && opt.dimZero ? "muted" : "default") }));
        labels.push({ id: "rl" + i, x: x0() - 46, y: cy(i), text: "R" + (i + 1), cls: "strong" });
      });
      labels.push({ id: "hM", x: (cx(0) + cx(n - 1)) / 2, y: Y0 - 36, text: opt.name || "目前的矩陣", cls: "title" });
      const px = PX();
      labels.push({ id: "tr0", x: px, y: Y0 - 36, text: "det 追蹤", cls: "title", anchor: "start" });
      (opt.track || []).forEach((t, k) => labels.push({ id: "tr" + (k + 1), x: px, y: Y0 - 4 + k * 26, text: t[0], cls: t[1] || "", anchor: "start" }));
      const by = cy(n - 1) + 52;
      (opt.info || []).forEach((t, k) => labels.push({ id: "in" + k, x: 24, y: by + k * 26, text: t[0], cls: t[1] || "", anchor: "start" }));
      return { nodes, edges: [], labels, caption, line };
    }

    const newRows = (M) => {
      const tag = Math.random().toString(36).slice(2, 6);
      rows = M.map((v, i) => ({ id: "r" + i + "_" + tag, v: v.slice() }));
      n = M.length;
      player.resize(W, H());
    };
    const histLines = () => hist.slice(-5).map((h) => [h, ""]);

    // ---------- (1) 化成上三角 ----------
    let pickMax = false;
    function runElim(M) {
      newRows(M);
      hist = [];
      const d0 = detOf(M);
      const r = new Recorder(), done = {};
      let sign = 1;
      const keep = () => Object.assign({}, done);
      const track = () => [[`det A = ${sign < 0 ? "−1" : "+1"} × det(目前)`, "strong"], [`交換次數：${hist.filter((h) => h.includes("↔")).length}`, ""]].concat(histLines());
      r.push(frame(`複製 A 開始消去。只用<b>列交換</b>（det 變號）和<b>列加上另一列的倍數</b>（det 不變），不做倍乘，所以全程 det A = ±det(目前的矩陣)，正負號由交換次數決定。`, LN.init, { track: track(), name: "A" }));
      for (let c = 0; c < n; c++) {
        const colSt = keep(); for (let i = c; i < n; i++) colSt[i + "," + c] = "compare";
        let p = c;
        for (let i = c; i < n; i++) {
          if (isZ(rows[p].v[c]) && !isZ(rows[i].v[c])) p = i;
          if (pickMax && absGt(rows[i].v[c], rows[p].v[c])) p = i;
        }
        if (isZ(rows[p].v[c])) {
          for (let i = c; i < n; i++) colSt[i + "," + c] = "removed";
          r.push(frame(`第 ${c + 1} 行從 R${c + 1} 往下<b>全是 0</b>，找不到 pivot。這時矩陣化不成對角線全非零的上三角，列向量線性相依，所以 <b>det A = 0</b>，可以直接停。`, LN.zero,
            { cells: colSt, track: [["det A = 0", "warn"]].concat(histLines()), info: [["某一行在對角線以下（含）全是 0 → det = 0", "warn"]] }));
          return r.frames;
        }
        const why = pickMax ? `取絕對值最大的 <b>${S(rows[p].v[c])}</b>（partial pivoting，數值計算較穩定）` : `取第一個不是 0 的 <b>${S(rows[p].v[c])}</b>（手算最常見）`;
        r.push(frame(`看第 ${c + 1} 行、R${c + 1} 以下：${why}，在 R${p + 1}。`, pickMax ? LN.findMax : LN.find, { cells: Object.assign(colSt, { [p + "," + c]: "active" }), track: track() }));
        if (p !== c) {
          [rows[p], rows[c]] = [rows[c], rows[p]];
          sign = -sign;
          hist.push(`R${c + 1} ↔ R${p + 1}：× (−1)`);
          r.push(frame(`pivot 要放在第 ${c + 1} 列，交換 R${c + 1}、R${p + 1}。<b>每交換一次，det 就變號</b>：現在 det A = ${sign < 0 ? "−" : "+"}det(目前)。`, LN.swap,
            { cells: Object.assign(keep(), { [c + "," + c]: "active" }), rows: { [c]: "new", [p]: "new" }, track: track() }));
        }
        for (let i = c + 1; i < n; i++) {
          if (isZ(rows[i].v[c])) continue;
          const f = div(rows[i].v[c], rows[c].v[c]);
          rows[i].v = rows[i].v.map((x, j) => sub(x, mul(f, rows[c].v[j])));
          const op = f.n > 0 ? `R${i + 1} ← R${i + 1} − ${coef(f)}R${c + 1}` : `R${i + 1} ← R${i + 1} + ${coef(F(-f.n, f.d))}R${c + 1}`;
          hist.push(`${op}：× 1`);
          r.push(frame(`${op}，把第 ${c + 1} 行的 ${S(mul(f, rows[c].v[c]))} 消成 0（倍數 = ${S(mul(f, rows[c].v[c]))} ÷ pivot ${S(rows[c].v[c])} = ${S(f)}）。<b>列加上另一列的倍數不改變 det</b>。`, LN.elim,
            { cells: Object.assign(keep(), { [c + "," + c]: "active", [i + "," + c]: "found" }), rows: { [i]: "new" }, track: track() }));
        }
        done[c + "," + c] = "found";
      }
      const diag = rows.map((rw, i) => rw.v[i]);
      const d = diag.reduce((a, x) => mul(a, x), F(sign));
      const prod = diag.map(P).join(" × ");
      const ok = d.n === d0.n && d.d === d0.d;
      r.push(frame(`變成上三角了：上三角矩陣的 det 就是對角線乘積。共交換 ${hist.filter((h) => h.includes("↔")).length} 次，正負號是 ${sign < 0 ? "−1" : "+1"}，所以 det A = ${sign < 0 ? `−(${prod})` : prod} = <b>${S(d)}</b>${ok ? "（已用另一種算法驗算）" : "（驗算不一致，不該發生）"}。`, LN.done,
        { cells: keep(), dimZero: true, track: [[`det A = ${S(d)}`, "strong"], [`交換次數：${hist.filter((h) => h.includes("↔")).length}`, ""]].concat(histLines()),
          info: [[`det A = ${sign < 0 ? "−1" : "+1"} × ${prod}`, "strong"], [`= ${S(d)}`, "strong"]] }));
      return r.frames;
    }

    // ---------- (2) 自訂列運算 ----------
    function runOps(M, ops) {
      newRows(M);
      hist = [];
      const d0 = detOf(M);
      let factor = F(1);
      const r = new Recorder();
      const track = () => [[`det(目前) = ${P(factor)} × det A`, "strong"], [`= ${P(factor)} × ${P(d0)} = ${S(mul(factor, d0))}`, ""]].concat(histLines());
      r.push(frame(`原矩陣 A 的 det = ${S(d0)}。接下來依序做你給的 ${ops.length} 個列運算，右邊追蹤 factor：det(目前) = factor × det A。`, null, { track: track(), name: "A" }));
      for (const o of ops) {
        if (o.k === "swap") {
          [rows[o.i], rows[o.j]] = [rows[o.j], rows[o.i]];
          factor = mul(factor, F(-1));
          hist.push(`R${o.i + 1} ↔ R${o.j + 1}：× (−1)`);
          r.push(frame(`交換 R${o.i + 1}、R${o.j + 1}：<b>det 乘以 −1</b>（交換兩列等於排列展開裡每一項的逆序數奇偶都改變）。`, LN.oSwap, { rows: { [o.i]: "new", [o.j]: "new" }, track: track() }));
        } else if (o.k === "scale") {
          rows[o.i].v = rows[o.i].v.map((x) => mul(o.c, x));
          factor = mul(factor, o.c);
          hist.push(`R${o.i + 1} ← ${coef(o.c)}R${o.i + 1}：× ${P(o.c)}`);
          r.push(frame(`R${o.i + 1} 整列乘以 ${S(o.c)}：<b>det 也乘以 ${S(o.c)}</b>（行列式對每一列是線性的，可以把這列的公因數提出來）。`, LN.oScale, { rows: { [o.i]: "new" }, track: track() }));
        } else {
          rows[o.i].v = rows[o.i].v.map((x, k) => add(x, mul(o.c, rows[o.j].v[k])));
          const op = o.c.n > 0 ? `R${o.i + 1} ← R${o.i + 1} + ${coef(o.c)}R${o.j + 1}` : `R${o.i + 1} ← R${o.i + 1} − ${coef(F(-o.c.n, o.c.d))}R${o.j + 1}`;
          hist.push(`${op}：× 1`);
          r.push(frame(`${op}：<b>det 不變</b>。拆開來看 = det(原) + ${S(o.c)} × det(有兩列相同的矩陣) = det(原) + 0。`, LN.oAdd, { rows: { [o.i]: "new" }, cells: Object.fromEntries(rows[o.j].v.map((_, k) => [o.j + "," + k, "visited"])), track: track() }));
        }
      }
      const dNow = detOf(rows.map((rw) => rw.v));
      const expect = mul(factor, d0);
      const ok = dNow.n === expect.n && dNow.d === expect.d;
      r.push(frame(`做完 ${ops.length} 個列運算：factor = ${S(factor)}，所以 det(目前) = ${P(factor)} × ${P(d0)} = <b>${S(expect)}</b>。直接重算目前矩陣的 det 得 ${S(dNow)}，${ok ? "一致" : "不一致（不該發生）"}。反過來，若想由目前矩陣求 det A，就要<b>除以</b> factor。`, null,
        { track: track(), info: [[`factor = ${S(factor)}`, "strong"], [`det(目前) = ${S(expect)}，det A = ${S(d0)}`, ""]] }));
      return r.frames;
    }

    const PRESETS = {
      "4×4 要換列": "0 2 1 3; 1 1 0 2; 2 4 1 5; 1 3 2 2",
      "3×3": "2 -1 3; 1 0 4; -2 5 1",
      "det = 0": "1 2 3; 4 5 6; 5 7 9",
    };
    const input = ui.input(player, { placeholder: "例如 1 2; 3 4", value: PRESETS["4×4 要換列"], width: 230 });
    const fail = (el, msg) => {
      el.classList.add("is-error"); setTimeout(() => el.classList.remove("is-error"), 700);
      rows = []; n = 2;
      player.load([{ nodes: [], edges: [], labels: [], caption: `${iconHTML("alert")} ${msg}`, line: null }], { autoplay: false });
    };
    const tooLong = (frames) => frames.flatMap((f) => f.nodes).map((nd) => nd.label).find((s) => s && s.length > 6);
    const goElim = () => {
      const M = parseMatrix(input.value);
      if (typeof M === "string") return fail(input, M);
      player.setCode(CODE_ELIM);
      const frames = runElim(M);
      const long = tooLong(frames);
      if (long) return fail(input, `計算過程會出現 ${esc(long)} 這種太長的分數，格子放不下。請換一個數字小一點的矩陣（整數矩陣最好）。`);
      player.load(frames);
    };
    ui.button(player, "化上三角求 det", goElim);
    const pivBtn = ui.button(player, "pivot：第一個非零", () => {
      pickMax = !pickMax;
      pivBtn.textContent = pickMax ? "pivot：絕對值最大" : "pivot：第一個非零";
      goElim();
    }, "ghost");
    Object.keys(PRESETS).forEach((key) => ui.button(player, key, () => { input.value = PRESETS[key]; goElim(); }, "ghost"));

    const opsIn = ui.input(player, { placeholder: "R1<->R2, R3*3, R2-2R1", value: "R1<->R2, R3*3, R2-2R1", width: 230 });
    const goOps = () => {
      const M = parseMatrix(input.value);
      if (typeof M === "string") return fail(input, M);
      const ops = parseOps(opsIn.value, M.length);
      if (typeof ops === "string") return fail(opsIn, ops);
      player.setCode(CODE_OPS);
      const frames = runOps(M, ops);
      const long = tooLong(frames);
      if (long) return fail(opsIn, `計算過程會出現 ${esc(long)} 這種太長的數字，格子放不下。請把倍數改小一點。`);
      player.load(frames);
    };
    ui.button(player, "做列運算", goOps);
    ui.button(player, "例：三種各一次", () => { input.value = PRESETS["3×3"]; opsIn.value = "R1<->R2, R3*3, R2-2R1"; goOps(); }, "ghost");
    input.addEventListener("keydown", (e) => e.key === "Enter" && goElim());
    opsIn.addEventListener("keydown", (e) => e.key === "Enter" && goOps());

    const demo = runElim(parseMatrix(PRESETS["4×4 要換列"]));
    demo[0].caption = iconHTML("play") + " 按播放看示範：4×4 矩陣化成上三角，過程交換了 2 次列（正負號變回 +），det = 1 × 2 × 1 × (−2) = −4。也可以輸入自己的 2×2～5×5 方陣（列用 ; 隔開），或在第二個輸入框寫列運算（R1<->R2、R3*3、R2-2R1）按「做列運算」，看每一種列運算讓 det 乘上多少。";
    player.load(demo, { autoplay: false });
  });

  // ===================================================================
  // 靜態圖解
  // ===================================================================
  const box = (id, label, x, y, st, w, h) => ({ id, label, shape: "box", x, y, w: w || 40, h: h || 30, state: st || "default" });
  const mat = (k, x0, y0, M, hl, g = 46, gy = 38, w, h) => M.flatMap((row, i) => row.map((v, j) => box(k + i + "_" + j, v, x0 + j * g, y0 + i * gy, hl(i, j, v) || (v === "0" ? "muted" : "default"), w, h)));
  const dot = (id, x, y, st) => ({ id, label: "", x, y, r: 4, state: st || "default" });

  // 圖 1：|det| = 平行四邊形面積
  figure("determinant-properties-area", () => {
    const U = 40;
    const pt = (ox, oy, a, b) => [ox + a * U, oy - b * U];
    const L = { x: 70, y: 210 }, R = { x: 360, y: 210 };
    const nodes = [], edges = [], labels = [];
    const poly = (k, o, vs, st) => {
      vs.forEach(([a, b], i) => { const [x, y] = pt(o.x, o.y, a, b); nodes.push(dot(k + i, x, y, st)); });
      vs.forEach((_, i) => edges.push({ from: k + i, to: k + ((i + 1) % vs.length), state: st }));
    };
    // 座標軸
    [[L, 3], [R, 5]].forEach(([o, len], t) => {
      nodes.push(dot("ax" + t + "o", o.x, o.y, "muted"), dot("ax" + t + "x", o.x + len * U, o.y, "muted"), dot("ax" + t + "y", o.x, o.y - 4 * U, "muted"));
      edges.push({ from: "ax" + t + "o", to: "ax" + t + "x", state: "muted", directed: true }, { from: "ax" + t + "o", to: "ax" + t + "y", state: "muted", directed: true });
    });
    poly("s", L, [[0, 0], [1, 0], [1, 1], [0, 1]], "compare");
    poly("p", R, [[0, 0], [3, 1], [4, 3], [1, 2]], "active");
    labels.push(
      { id: "l1", x: L.x + 1.5 * U, y: 26, text: "單位正方形：面積 1", cls: "strong" },
      { id: "l2", x: L.x + 0.5 * U, y: L.y - 0.5 * U, text: "1" },
      { id: "e1", x: L.x + 1 * U + 4, y: L.y + 18, text: "e1", anchor: "middle" },
      { id: "e2", x: L.x - 18, y: L.y - 1 * U, text: "e2", anchor: "middle" },
      { id: "r1", x: R.x + 2.5 * U, y: 26, text: "A = [3 1; 1 2] 作用之後", cls: "strong" },
      { id: "r2", x: R.x + 2 * U, y: R.y - 1.5 * U, text: "面積 5", cls: "strong" },
      { id: "c1", x: R.x + 3 * U + 14, y: R.y - 1 * U + 14, text: "(3, 1)", anchor: "start" },
      { id: "c2", x: R.x + 1 * U + 12, y: R.y - 2 * U - 16, text: "(1, 2)", anchor: "start" },
      { id: "ar", x: 250, y: 120, text: "→", cls: "title" },
      { id: "n1", x: 330, y: 258, text: "det A = 3·2 − 1·1 = 5：A 把每塊面積放大 5 倍；det = 0 表示壓扁成一條線", anchor: "middle" },
    );
    return { width: 660, height: 276, nodes, edges, labels };
  });

  // 圖 2：餘因子符號棋盤與「挑零最多的列」
  figure("determinant-properties-cofactor", () => {
    const sg = [["+", "−", "+", "−"], ["−", "+", "−", "+"], ["+", "−", "+", "−"], ["−", "+", "−", "+"]];
    const A = [["1", "0", "2", "0"], ["3", "0", "1", "2"], ["0", "0", "5", "0"], ["4", "1", "6", "3"]];
    const nodes = mat("s", 60, 70, sg, (i, j) => (i === 2 && j === 2 ? "active" : (i + j) % 2 ? "compare" : "default"), 46, 40, 38, 32)
      .concat(mat("a", 330, 70, A, (i, j) => (i === 2 && j === 2 ? "active" : i === 2 || j === 2 ? "muted" : null), 50, 40, 42, 32));
    return {
      width: 660, height: 290, nodes,
      labels: [
        { id: "t1", x: 129, y: 26, text: "符號 (−1)^(i+j)", cls: "strong" },
        { id: "t2", x: 405, y: 26, text: "A：第 3 列只有一個非零", cls: "strong" },
        { id: "r3", x: 290, y: 150, text: "R3", cls: "strong" },
        { id: "n0", x: 545, y: 150, text: "a33 = 5，符號 +", anchor: "start" },
        { id: "n1", x: 330, y: 242, text: "沿第 3 列展開：det A = (+1)·5·det[1 0 0; 3 0 2; 4 1 3]，其他三項的 a3j 都是 0", anchor: "middle" },
        { id: "n2", x: 330, y: 270, text: "3×3 再沿第 1 列展開：1·(0·3 − 2·1) = −2，所以 det A = 5 × (−2) = −10", anchor: "middle" },
      ],
    };
  });

  // 圖 3：三種列運算對 det 的影響（2×2）
  figure("determinant-properties-row-ops", () => {
    const base = [["3", "1"], ["1", "2"]];
    const sw = [["1", "2"], ["3", "1"]];
    const sc = [["6", "2"], ["1", "2"]];
    const ad = [["3", "1"], ["7", "4"]];
    const g = 44, X = [44, 206, 368, 530];
    const nodes = mat("a", X[0], 80, base, () => null, g)
      .concat(mat("b", X[1], 80, sw, () => "new", g))
      .concat(mat("c", X[2], 80, sc, (i) => (i === 0 ? "new" : null), g))
      .concat(mat("d", X[3], 80, ad, (i) => (i === 1 ? "new" : null), g));
    const mid = (k) => X[k] + g / 2;
    return {
      width: 660, height: 230, nodes,
      labels: [
        { id: "t0", x: mid(0), y: 30, text: "A", cls: "strong" },
        { id: "t1", x: mid(1), y: 30, text: "R1 ↔ R2", cls: "strong" },
        { id: "t2", x: mid(2), y: 30, text: "R1 ← 2R1", cls: "strong" },
        { id: "t3", x: mid(3), y: 30, text: "R2 ← R2 + 2R1", cls: "strong" },
        { id: "d0", x: mid(0), y: 160, text: "det = 5", cls: "strong" },
        { id: "d1", x: mid(1), y: 160, text: "det = −5", cls: "warn" },
        { id: "d2", x: mid(2), y: 160, text: "det = 10", cls: "warn" },
        { id: "d3", x: mid(3), y: 160, text: "det = 5", cls: "strong" },
        { id: "f1", x: mid(1), y: 188, text: "× (−1)" },
        { id: "f2", x: mid(2), y: 188, text: "× 2" },
        { id: "f3", x: mid(3), y: 188, text: "× 1（不變）" },
        { id: "n", x: 330, y: 218, text: "三張圖都是從 A 出發各做一次列運算；紫色是被改的列", anchor: "middle" },
      ],
    };
  });

  // 圖 4：區塊上三角
  figure("determinant-properties-block", () => {
    const M = [["2", "1", "7", "4"], ["1", "3", "5", "6"], ["0", "0", "4", "1"], ["0", "0", "2", "3"]];
    const nodes = mat("m", 120, 60, M, (i, j) => (i < 2 && j < 2 ? "compare" : i >= 2 && j >= 2 ? "visited" : i >= 2 ? "muted" : "default"), 52, 42, 44, 34);
    return {
      width: 660, height: 260, nodes,
      labels: [
        { id: "t", x: 198, y: 22, text: "M = [A B; 0 D]", cls: "strong" },
        { id: "a", x: 360, y: 82, text: "A = [2 1; 1 3]，det A = 5", anchor: "start" },
        { id: "d", x: 360, y: 166, text: "D = [4 1; 2 3]，det D = 10", anchor: "start" },
        { id: "b", x: 360, y: 124, text: "B（右上）不影響 det", anchor: "start" },
        { id: "n1", x: 330, y: 222, text: "det M = det A · det D = 5 × 10 = 50（左下必須是零矩陣、A 和 D 是方陣）", anchor: "middle" },
        { id: "n2", x: 330, y: 248, text: "一般的 [A B; C D] 沒有 det A·det D − det B·det C 這種公式", anchor: "middle" },
      ],
    };
  });
})();
