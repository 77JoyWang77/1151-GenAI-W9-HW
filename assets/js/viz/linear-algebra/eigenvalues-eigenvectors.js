/* =====================================================================
   Eigenvalues and Eigenvectors（特徵值與特徵向量）主題的視覺化
   - eigen-solve : 輸入 2×2 或 3×3 矩陣，逐步寫出 A − λI → 展開 det(A − λI) →
                   有理根定理求根 → 每個 λ 把 A − λI 化成 RREF → 讀出特徵空間基底 →
                   驗證 Av = λv、trace 與 det（分數精確計算）
   - 靜態圖：幾何意義、代數重數 vs 幾何重數、常考性質
   ===================================================================== */
(function () {
  "use strict";
  const { Player, Recorder, ui, register, esc, iconHTML, figure } = window.DSViz;

  // 右側程式碼：從 code/linear-algebra/eigenvalues-eigenvectors.c 原封不動取出
  const CODE = [
    "Poly entry(Frac A[MAXN][MAXN], int i, int j) {   /* A − λI 的 (i, j) 元素：對角線是 a_ii − λ */",
    "  Poly p = pzero();",
    "  p.c[0] = A[i][j];",
    "  if (i == j) { p.deg = 1; p.c[1] = frac(-1, 1); }",
    "  return p;",
    "}",
    "",
    "Poly charPoly(Frac A[MAXN][MAXN]) {           /* 回傳 det(A − λI) */",
    "  if (n == 2)                                  /* (a − λ)(d − λ) − bc */",
    "    return psub(pmul(entry(A, 0, 0), entry(A, 1, 1)), pmul(entry(A, 0, 1), entry(A, 1, 0)));",
    "  Poly p = pzero();",
    "  for (int j = 0; j < 3; j++) {                /* 沿第 1 列餘因子展開，符號 + − + */",
    "    int c1 = (j == 0) ? 1 : 0, c2 = (j == 2) ? 1 : 2;   /* 刪掉第 1 列、第 j 行後剩下的兩行 */",
    "    Poly minor = psub(pmul(entry(A, 1, c1), entry(A, 2, c2)), pmul(entry(A, 1, c2), entry(A, 2, c1)));",
    "    Poly term = pmul(entry(A, 0, j), minor);",
    "    p = (j == 1) ? psub(p, term) : padd(p, term);",
    "  }",
    "  return p;",
    "}",
    "",
    "int rationalRoot(Poly p, Frac *root) {         /* 找到回傳 1，找不到（剩下無理根或複數根）回傳 0 */",
    "  long long L = 1, a[MAXN + 1];",
    "  for (int k = 0; k <= p.deg; k++) L = L / gcdll(L, p.c[k].d) * p.c[k].d;   /* 分母的最小公倍數 */",
    "  for (int k = 0; k <= p.deg; k++) a[k] = p.c[k].n * (L / p.c[k].d);         /* 通分成整數係數 */",
    "  if (a[0] == 0) { *root = frac(0, 1); return 1; }                            /* 常數項是 0：λ = 0 是根 */",
    "  long long a0 = llabs(a[0]), an = llabs(a[p.deg]);",
    "  for (long long q = 1; q <= an; q++) {",
    "    if (an % q) continue;",
    "    for (long long pp = 1; pp <= a0; pp++) {",
    "      if (a0 % pp) continue;",
    "      for (int s = 1; s >= -1; s -= 2) {       /* 先試 +p/q 再試 −p/q */",
    "        Frac r = frac(s * pp, q);",
    "        if (isZero(peval(p, r))) { *root = r; return 1; }",
    "      }",
    "    }",
    "  }",
    "  return 0;",
    "}",
    "",
    "Poly deflate(Poly p, Frac r) {                 /* 綜合除法：p(λ) = (λ − r)·q(λ)，回傳 q */",
    "  Poly q = pzero(); q.deg = p.deg - 1;",
    "  Frac carry = frac(0, 1);",
    "  for (int k = p.deg; k >= 1; k--) {",
    "    carry = fadd(fmul(carry, r), p.c[k]);",
    "    q.c[k - 1] = carry;",
    "  }",
    "  return q;",
    "}",
    "",
    "int eigenvalues(Poly p, Frac lam[], int alg[], Poly *rest) {   /* 回傳相異特徵值個數 */",
    "  int k = 0;",
    "  Frac r;",
    "  while (p.deg > 0 && rationalRoot(p, &r)) {",
    "    if (k > 0 && feq(lam[k - 1], r)) alg[k - 1]++;   /* 同一個根再出現：代數重數 +1 */",
    "    else { lam[k] = r; alg[k] = 1; k++; }",
    "    p = deflate(p, r);",
    "  }",
    "  *rest = p;                                   /* rest.deg > 0：剩下的因式沒有有理根 */",
    "  return k;",
    "}",
    "",
    "int rref(Frac B[MAXN][MAXN], int pivcol[]) {   /* 化成 RREF，回傳 rank；pivcol[i] 是第 i 個 pivot 所在的行 */",
    "  int r = 0;",
    "  for (int c = 0; c < n && r < n; c++) {",
    "    int p = r;",
    "    while (p < n && isZero(B[p][c])) p++;",
    "    if (p == n) continue;                      /* 這一行沒有 pivot：對應自由變數 */",
    "    for (int j = 0; j < n; j++) { Frac t = B[r][j]; B[r][j] = B[p][j]; B[p][j] = t; }",
    "    Frac piv = B[r][c];",
    "    for (int j = 0; j < n; j++) B[r][j] = fdiv(B[r][j], piv);",
    "    for (int i = 0; i < n; i++)",
    "      if (i != r && !isZero(B[i][c])) {",
    "        Frac f = B[i][c];",
    "        for (int j = 0; j < n; j++) B[i][j] = fsub(B[i][j], fmul(f, B[r][j]));",
    "      }",
    "    pivcol[r++] = c;",
    "  }",
    "  return r;",
    "}",
    "",
    "int eigenspace(Frac A[MAXN][MAXN], Frac lam, Frac basis[MAXN][MAXN]) {   /* 回傳幾何重數 dim E_λ */",
    "  Frac B[MAXN][MAXN];",
    "  for (int i = 0; i < n; i++)",
    "    for (int j = 0; j < n; j++) B[i][j] = (i == j) ? fsub(A[i][j], lam) : A[i][j];   /* B = A − λI */",
    "  int pivcol[MAXN], isPiv[MAXN] = { 0 };",
    "  int r = rref(B, pivcol);",
    "  for (int i = 0; i < r; i++) isPiv[pivcol[i]] = 1;",
    "  int dim = 0;",
    "  for (int f = 0; f < n; f++) {",
    "    if (isPiv[f]) continue;                    /* 只有自由變數那一行會產生基底向量 */",
    "    for (int j = 0; j < n; j++) basis[dim][j] = frac(j == f, 1);   /* x_f = 1，其他自由變數 = 0 */",
    "    for (int i = 0; i < r; i++) basis[dim][pivcol[i]] = fneg(B[i][f]);   /* pivot 變數 = −(那一列在第 f 行的數) */",
    "    toInteger(basis[dim]);",
    "    dim++;",
    "  }",
    "  return dim;                                  /* = n − rank(A − λI) */",
    "}",
    "",
    "int checkEigen(Frac A[MAXN][MAXN], Frac lam, Frac v[MAXN]) {   /* 驗證 Av = λv */",
    "  for (int i = 0; i < n; i++) {",
    "    Frac s = frac(0, 1);",
    "    for (int j = 0; j < n; j++) s = fadd(s, fmul(A[i][j], v[j]));",
    "    if (!feq(s, fmul(lam, v[i]))) return 0;",
    "  }",
    "  return 1;",
    "}",
    "",
    "void traceDetCheck(Frac A[MAXN][MAXN], Frac lam[], int alg[], int k, Frac *tr, Frac *sum, Frac *det, Frac *prod) {",
    "  *tr = frac(0, 1); *sum = frac(0, 1); *prod = frac(1, 1);",
    "  for (int i = 0; i < n; i++) *tr = fadd(*tr, A[i][i]);",
    "  for (int i = 0; i < k; i++)",
    "    for (int t = 0; t < alg[i]; t++) { *sum = fadd(*sum, lam[i]); *prod = fmul(*prod, lam[i]); }",
    "  *det = charPoly(A).c[0];                     /* det(A − 0·I) = det A：特徵多項式的常數項 */",
    "}"
  ];
  const at = (s) => CODE.findIndex((l) => l.includes(s)) + 1;
  const LN = {
    entry: [at("Poly entry("), at("if (i == j) { p.deg = 1;")],
    det2: [at("if (n == 2)"), at("return psub(pmul(entry(A, 0, 0)")],
    expand: at("沿第 1 列餘因子展開"),
    minor: [at("int c1 = (j == 0)"), at("Poly minor =")],
    term: [at("Poly term ="), at("p = (j == 1) ? psub")],
    lcm: [at("分母的最小公倍數"), at("通分成整數係數")],
    zero: at("常數項是 0"),
    cand: [at("long long a0 = llabs"), at("for (long long q = 1;"), at("for (long long pp = 1;")],
    test: [at("Frac r = frac(s * pp, q);"), at("if (isZero(peval(p, r)))")],
    root: [at("while (p.deg > 0 && rationalRoot"), at("p = deflate(p, r);")],
    rep: at("代數重數 +1"),
    newRoot: at("else { lam[k] = r; alg[k] = 1; k++; }"),
    rest: at("*rest = p;"),
    B: at("B = A − λI"),
    pivot: [at("for (int c = 0; c < n && r < n; c++)"), at("while (p < n && isZero(B[p][c])) p++;")],
    nopiv: at("這一行沒有 pivot：對應自由變數"),
    ops: [at("Frac piv = B[r][c];"), at("fdiv(B[r][j], piv)"), at("fsub(B[i][j], fmul(f, B[r][j]))")],
    free: [at("int r = rref(B, pivcol);"), at("isPiv[pivcol[i]] = 1;"), at("if (isPiv[f]) continue;")],
    basis: [at("x_f = 1"), at("pivot 變數 = −"), at("toInteger(basis[dim]);")],
    dim: at("return dim;"),
    check: [at("int checkEigen("), at("if (!feq(s, fmul(lam, v[i]))) return 0;")],
    trdet: [at("*tr = fadd(*tr, A[i][i]);"), at("*sum = fadd(*sum, lam[i]); *prod"), at("*det = charPoly(A).c[0];")],
  };
  LN.fail = [CODE.findIndex((l, k) => k >= at("int rationalRoot(") && l.trim() === "return 0;") + 1, at("*rest = p;")];

  // ---------- 分數（精確計算；超出安全整數範圍就丟例外，避免默默算錯）----------
  const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a || 1; };
  const F = (n, d = 1) => {
    if (!Number.isSafeInteger(n) || !Number.isSafeInteger(d)) throw new Error("big");
    if (d < 0) { n = -n; d = -d; }
    const g = gcd(n, d); return { n: n / g, d: d / g };
  };
  const add = (x, y) => F(x.n * y.d + y.n * x.d, x.d * y.d);
  const sub = (x, y) => F(x.n * y.d - y.n * x.d, x.d * y.d);
  const mul = (x, y) => F(x.n * y.n, x.d * y.d);
  const div = (x, y) => F(x.n * y.d, x.d * y.n);
  const neg = (x) => F(-x.n, x.d);
  const isZ = (x) => x.n === 0;
  const isOne = (x) => x.n === 1 && x.d === 1;
  const eq = (x, y) => x.n === y.n && x.d === y.d;
  const S = (x) => (x.d === 1 ? String(x.n) : `${x.n}/${x.d}`).replace("-", "−");
  const coef = (x) => (isOne(x) ? "" : x.d === 1 ? S(x) : `(${S(x)})`);
  const lcm = (a, b) => a / gcd(a, b) * b;

  // ---------- 多項式：c[k] 是 λ^k 的係數 ----------
  const SUP = ["", "", "²", "³"];
  const trim = (c) => { c = c.slice(); while (c.length > 1 && isZ(c[c.length - 1])) c.pop(); return c; };
  const padd = (a, b) => trim(Array.from({ length: Math.max(a.length, b.length) }, (_, k) => add(a[k] || F(0), b[k] || F(0))));
  const psub = (a, b) => padd(a, b.map(neg));
  const pmul = (a, b) => { const r = Array.from({ length: a.length + b.length - 1 }, () => F(0)); a.forEach((x, i) => b.forEach((y, j) => (r[i + j] = add(r[i + j], mul(x, y))))); return trim(r); };
  const peval = (c, x) => c.reduceRight((s, a) => add(mul(s, x), a), F(0));
  const deflate = (c, r) => { const q = []; let carry = F(0); for (let k = c.length - 1; k >= 1; k--) { carry = add(mul(carry, r), c[k]); q[k - 1] = carry; } return q; };
  function P(c) {
    let s = "";
    for (let k = c.length - 1; k >= 0; k--) {
      const a = c[k];
      if (isZ(a)) continue;
      const ab = F(Math.abs(a.n), a.d);
      const body = k === 0 ? S(ab) : coef(ab) + "λ" + SUP[k];
      s += s === "" ? (a.n < 0 ? "−" : "") + body : (a.n < 0 ? " − " : " + ") + body;
    }
    return s || "0";
  }
  const lin = (r) => (isZ(r) ? "λ" : r.n > 0 ? `λ − ${S(r)}` : `λ + ${S(neg(r))}`);   // λ − r
  const fx = (x) => x.toFixed(3).replace("-", "−");
  const vec = (v) => "(" + v.map(S).join(", ") + ")";

  function parse(text) {
    const rows = text.trim().split(/\s*[;\n]\s*/).filter(Boolean);
    if (rows.length < 2 || rows.length > 3) return "請輸入 2×2 或 3×3 的方陣，列與列之間用分號 ; 隔開，例如 4 1; 2 3。";
    const M = [];
    for (const r of rows) {
      const toks = r.split(/[\s,]+/).filter(Boolean), row = [];
      for (const t of toks) {
        const m = /^(-?\d+)(?:\/(\d+))?$/.exec(t);
        if (!m) return `「${esc(t)}」不是整數或分數（例如 3、-2、1/2）。`;
        const nn = +m[1], d = m[2] ? +m[2] : 1;
        if (d === 0) return "分母不能是 0。";
        if (Math.abs(nn) > 20 || d > 9) return "數字請在 −20～20 之間、分母不超過 9，畫面才放得下。";
        row.push(F(nn, d));
      }
      M.push(row);
    }
    if (M.some((r) => r.length !== M.length)) return `特徵值只對<b>方陣</b>有定義：你輸入了 ${M.length} 列，每一列也要剛好 ${M.length} 個數。`;
    return M;
  }

  register("eigen-solve", function (root) {
    const player = new Player(root, {
      title: "Eigenvalues and Eigenvectors 特徵值與特徵向量",
      width: 640, height: 410, code: CODE, wide: true,
      legend: [["active", "對角線 −λ／pivot"], ["compare", "正在看的位置／目前的 λ"], ["found", "完成"], ["muted", "0 或不相關"]],
    });

    let n = 0;
    const GX = 74, GY = 44, X0 = 72, Y0 = 84, TX = 292;
    const cx = (j) => X0 + j * GX, cy = (i) => Y0 + i * GY;
    const TABLE_Y = 380;

    // 畫一個畫面：mat 是字串二維陣列；right 是右側文字 [[text, cls]]；table 是底部特徵值表
    function frame(caption, line, o = {}) {
      const nodes = [], labels = [];
      const cs = o.cs || {};
      (o.mat || []).forEach((row, i) => row.forEach((t, j) => {
        nodes.push({ id: "m" + i + j, label: t, shape: "box", x: cx(j), y: cy(i), w: 66, h: 34,
          state: cs[i + "," + j] || (o.base ? o.base(i, j, t) : (t === "0" ? "muted" : "default")) });
      }));
      if (o.mat) labels.push({ id: "mt", x: (cx(0) + cx(n - 1)) / 2, y: Y0 - 40, text: o.title || "A", cls: "title" });
      if (o.rowLabels) for (let i = 0; i < n; i++) labels.push({ id: "rl" + i, x: X0 - 50, y: cy(i), text: "R" + (i + 1), cls: "strong" });
      (o.colTags || []).forEach((t, j) => t && labels.push({ id: "ct" + j, x: cx(j), y: cy(n - 1) + 40, text: t[0], cls: t[1] || "" }));
      (o.right || []).forEach((t, k) => labels.push({ id: "r" + k + "_" + (o.rk || ""), x: TX, y: 48 + k * 27, text: t[0], cls: t[1] || "", anchor: "start" }));
      (o.table || []).forEach((t, k, all) => {
        const xs = all.length === 1 ? [320] : all.length === 2 ? [205, 435] : [112, 320, 528];
        nodes.push({ id: "tb" + k, label: t.label, shape: "box", x: xs[k], y: TABLE_Y, w: 200, h: 36, state: t.state });
      });
      if (o.table && o.table.length) labels.push({ id: "tbt", x: 320, y: TABLE_Y - 32, text: o.tableTitle || "特徵值　代數重數／幾何重數", cls: "title" });
      return { nodes, edges: [], labels, caption, line };
    }

    function run(A) {
      n = A.length;
      const r = new Recorder();
      const num = A.map((row) => row.map(S));
      const ent = (i, j) => (i === j ? (isZ(A[i][j]) ? "−λ" : S(A[i][j]) + "−λ") : S(A[i][j]));
      const entP = (i, j) => (i === j ? [A[i][j], F(-1)] : [A[i][j]]);
      const par = (i, j) => "(" + ent(i, j) + ")";
      const lamMat = A.map((row, i) => row.map((_, j) => ent(i, j)));
      const diag = (i, j) => (i === j ? "active" : null);
      const tr = A.reduce((s, row, i) => add(s, row[i]), F(0));

      r.push(frame(`輸入的 ${n}×${n} 矩陣 A。目標是找出所有 λ 和非零向量 v 使 Av = λv。先記下 trace A = ${A.map((row, i) => S(row[i])).join(" + ").replace(/\+ −/g, "− ")} = ${S(tr)}，最後拿來驗算特徵值的和。`, null,
        { mat: num, title: "A", right: [["Av = λv，v ≠ 0", "strong"], ["⟺ (A − λI)v = 0 有非零解", ""], ["⟺ A − λI 不可逆", ""], ["⟺ det(A − λI) = 0", "strong"], [`trace A = ${S(tr)}`, ""]] }));
      r.push(frame(`寫出 A − λI：只有<b>對角線</b>減 λ（橘色），其他元素不變。v 要是非零解，A − λI 就必須不可逆，所以接下來算它的行列式。`, LN.entry,
        { mat: lamMat, title: "A − λI", cs: {}, base: (i, j, t) => diag(i, j) || (t === "0" ? "muted" : "default"), right: [["A − λI：對角線各減 λ", "strong"], ["其他位置照抄 A", ""], ["det(A − λI) 會是 λ 的 " + n + " 次多項式", ""]] }));

      // ---------- 展開 det(A − λI) ----------
      let p;
      if (n === 2) {
        p = psub(pmul(entP(0, 0), entP(1, 1)), pmul(entP(0, 1), entP(1, 0)));
        r.push(frame(`2×2 行列式 = 主對角線乘積 − 副對角線乘積：${par(0, 0)}${par(1, 1)} − ${par(0, 1)}${par(1, 0)}。展開後一定是 λ² − (trace A)λ + det A 的形式。`, LN.det2,
          { mat: lamMat, title: "A − λI", cs: { "0,0": "active", "1,1": "active", "0,1": "compare", "1,0": "compare" },
            right: [["det(A − λI)", "strong"], [`= ${par(0, 0)}${par(1, 1)} − ${par(0, 1)}${par(1, 0)}`, ""], [`= ${P(pmul(entP(0, 0), entP(1, 1)))} − (${S(mul(A[0][1], A[1][0]))})`, ""], [`= ${P(p)}`, "strong"]] }));
      } else {
        p = [F(0)];
        const lines = [["沿第 1 列餘因子展開，符號 + − +", ""]];
        for (let j = 0; j < 3; j++) {
          const c1 = j === 0 ? 1 : 0, c2 = j === 2 ? 1 : 2;
          const minor = psub(pmul(entP(1, c1), entP(2, c2)), pmul(entP(1, c2), entP(2, c1)));
          const term = pmul(entP(0, j), minor);
          p = j === 1 ? psub(p, term) : padd(p, term);
          const sign = j === 1 ? "−" : "+";
          lines.push([`${sign} ${par(0, j)} × [${par(1, c1)}${par(2, c2)} − ${par(1, c2)}${par(2, c1)}]`, ""]);
          lines.push([`　= ${sign} ${par(0, j)}(${P(minor)})`, ""]);
          const cs = {};
          for (let i = 0; i < 3; i++) for (let k = 0; k < 3; k++) cs[i + "," + k] = i === 0 ? (k === j ? "active" : "muted") : (k === j ? "muted" : "compare");
          r.push(frame(`第 ${j + 1} 項：取第 1 列第 ${j + 1} 個元素 ${esc(ent(0, j))}（橘色），乘上刪掉第 1 列、第 ${j + 1} 行後剩下的 2×2 子式（藍色）；位置 (1, ${j + 1}) 的符號是 ${sign}。子式的行列式 = ${esc(P(minor))}。`, j === 0 ? [LN.expand].concat(LN.minor) : LN.minor.concat(LN.term),
            { mat: lamMat, title: "A − λI", cs, right: lines.slice() }));
        }
        lines.push(["det(A − λI) =", "strong"], [`　${P(p)}`, "strong"]);
        r.push(frame(`三項相加整理得 det(A − λI) = <b>${P(p)}</b>。3×3 的首項是 −λ³（因為 (a−λ)(b−λ)(c−λ) 的 λ³ 係數是 −1），λ² 係數 ${S(p[2])} 正好是 trace A，常數項 ${S(p[0])} 就是 det A（代 λ = 0）。`, LN.term,
          { mat: lamMat, title: "A − λI", base: (i, j, t) => diag(i, j) || "default", right: lines }));
      }

      // ---------- 求根：有理根定理 ----------
      const sgn = n === 3 ? -1 : 1;
      let m = p.map((x) => mul(x, F(sgn)));       // 首項係數 1 的版本，根和 det(A − λI) 一樣
      const detA = p[0];
      const roots = [], alg = [], tried = [];
      const rootLines = [[`令 det(A − λI) = 0${n === 3 ? "（兩邊乘 −1）" : ""}：`, ""], [`${P(m)} = 0`, "strong"]];
      const factors = [];
      let first = true;
      const rootTable = () => roots.map((x, k) => ({ label: `λ = ${S(x)}　代數 ${alg[k]}`, state: "compare" }));
      while (m.length > 1) {
        let L = 1; m.forEach((a) => (L = lcm(L, a.d)));
        const ai = m.map((a) => a.n * (L / a.d));
        let found = null;
        const tries = [];
        const zeroConst = ai[0] === 0;
        if (zeroConst) found = F(0);
        else {
          const a0 = Math.abs(ai[0]), an = Math.abs(ai[ai.length - 1]);
          const cands = [];
          outer: for (let q = 1; q <= an; q++) {
            if (an % q) continue;
            for (let pp = 1; pp <= a0; pp++) {
              if (a0 % pp) continue;
              for (const s of [1, -1]) {
                const c = F(s * pp, q);
                if (!cands.some((y) => eq(y, c))) cands.push(c);
                if (found) continue;
                const val = peval(m, c);
                tries.push([c, val]);
                if (isZ(val)) { found = c; if (!first) break outer; }
              }
            }
          }
          if (first) {
            const intForm = L === 1 ? P(m) : P(ai.map((x) => F(x)));
            const shown = cands.slice(0, 12).map(S).join(", ") + (cands.length > 12 ? ", …" : "");
            r.push(frame(`有理根定理：若最簡分數 p/q 是根，p 必整除常數項 ${ai[0]}、q 必整除首項係數 ${ai[ai.length - 1]}${L > 1 ? `（先乘 ${L} 通分成整數係數 ${esc(intForm)}）` : ""}。所以只要試有限個候選值。`, LN.cand,
              { mat: lamMat, title: "A − λI", base: (i, j, t) => diag(i, j) || "default", right: rootLines.concat([["有理根候選：", ""], [shown, ""]]) }));
          }
        }
        first = false;
        if (!found) {
          // 剩下的因式沒有有理根
          const deg = m.length - 1;
          let why = "";
          if (deg === 2) {
            const a = m[2], b = m[1], c = m[0];
            const D = sub(mul(b, b), mul(F(4), mul(a, c)));
            const Dv = D.n / D.d, bv = b.n / b.d, av = a.n / a.d;
            if (D.n < 0) {
              const re = -bv / (2 * av), im = Math.sqrt(-Dv) / (2 * Math.abs(av));
              why = `判別式 D = ${S(D)} &lt; 0，兩根是<b>共軛複數</b> ≈ ${fx(re)} ± ${fx(im)}i`;
              rootLines.push([`D = ${S(D)} < 0：共軛複數根`, "warn"], [`λ ≈ ${fx(re)} ± ${fx(im)}i`, ""]);
            } else {
              const s1 = (-bv + Math.sqrt(Dv)) / (2 * av), s2 = (-bv - Math.sqrt(Dv)) / (2 * av);
              why = `判別式 D = ${S(D)} &gt; 0 但不是完全平方，兩根是<b>無理數</b> ≈ ${fx(s1)}、${fx(s2)}`;
              rootLines.push([`D = ${S(D)} 不是完全平方：無理根`, "warn"], [`λ ≈ ${fx(s1)}、${fx(s2)}`, ""]);
            }
          } else {
            why = "三次式沒有有理根：它一定有一個實根，但不是有理數，沒辦法用精確分數寫出來";
            rootLines.push(["沒有有理根（實根是無理數）", "warn"]);
          }
          const done = roots.length ? `已找到的有理根 ${roots.map(S).join("、")} 一樣可以照下一步的做法求特徵空間，` : "";
          r.push(frame(`${iconHTML("alert")} 候選值全部試過都不是根：剩下的 ${esc(P(m))} 沒有有理根。${why}。${done}這個動畫只處理有理根，所以<b>停在特徵多項式</b>。trace A = ${S(tr)} 仍然等於全部特徵值（含複數、無理數）的和，det A = ${S(detA)} 等於它們的乘積。`, LN.fail,
            { mat: lamMat, title: "A − λI", base: (i, j, t) => diag(i, j) || "default", right: rootLines, table: rootTable() }));
          return r.frames;
        }
        const pn = roots.length || factors.length ? "q" : "p";
        const val0 = tries.filter((t) => !isZ(t[1])).slice(0, 4).map((t) => `${pn}(${S(t[0])}) = ${S(t[1])}`).join("、");
        const qd = deflate(m, found);
        const repeat = roots.length && eq(roots[roots.length - 1], found);
        if (repeat) alg[alg.length - 1]++; else { roots.push(found); alg.push(1); }
        factors.push(lin(found));
        m = qd;
        const rest = m.length > 1 ? `(${P(m)})` : "";
        rootLines.push([`λ = ${S(found)}：${pn}(${S(found)}) = 0　→ ${factors.map((f) => "(" + f + ")").join("")}${rest}`, ""]);
        r.push(frame(`${zeroConst ? "常數項是 0，所以每一項都有 λ 因式，λ = 0 一定是根；" : val0 ? "依序試候選值：" + esc(val0) + " 都不是 0；" : ""}${pn === "q" ? "對剩下的商式 q(λ)，" : ""}代入 λ = ${S(found)} 得 0，所以 (${lin(found)}) 是因式。用<b>綜合除法</b>除掉它${m.length > 1 ? `，剩下 ${esc(P(m))}，對它重複同樣的步驟` : "，已經除盡"}。${repeat ? `λ = ${S(found)} 又出現一次，<b>代數重數</b>加 1，變成 ${alg[alg.length - 1]}。` : ""}`, repeat ? LN.rep : LN.test.concat(LN.root),
          { mat: lamMat, title: "A − λI", base: (i, j, t) => diag(i, j) || "default", right: rootLines.slice(-9), table: rootTable() }));
      }
      const table = roots.map((x, k) => ({ label: `λ = ${S(x)}　代數 ${alg[k]}`, state: "default", lam: x, alg: alg[k] }));
      const T = () => table.map((t) => ({ label: t.label, state: t.state }));
      table.forEach((t) => (t.state = "compare"));
      r.push(frame(`特徵多項式完全分解：${factors.map((f) => "(" + f + ")").join("")}。${roots.length} 個相異特徵值，代數重數（因式出現的次數）加起來 = ${n} = 矩陣大小。接下來對每個 λ 求特徵空間。`, LN.root,
        { mat: lamMat, title: "A − λI", base: (i, j, t) => diag(i, j) || "default", right: rootLines.slice(-9), table: T() }));
      table.forEach((t) => (t.state = "default"));

      // ---------- 每個 λ：A − λI → RREF → 基底 ----------
      const geo = [];
      roots.forEach((lam, k) => {
        table[k].state = "compare";
        const B = A.map((row, i) => row.map((x, j) => (i === j ? sub(x, lam) : x)));
        const Bs = () => B.map((row) => row.map(S));
        const mag = F(Math.abs(lam.n), lam.d);
        const AL = isZ(lam) ? "A − 0I" : `A ${lam.n > 0 ? "−" : "+"} ${isOne(mag) ? "" : mag.d === 1 ? S(mag) : "(" + S(mag) + ")"}I`;
        const head = [[`λ = ${S(lam)}（代數重數 ${alg[k]}）`, "strong"], [`解 (${AL})x = 0`, ""]];
        const title = AL;
        r.push(frame(`λ = ${S(lam)}：把 λ 代進 A − λI，對角線各減 ${S(lam)}。特徵空間 E<sub>${S(lam)}</sub> 就是 (${AL})x = 0 的解集合，也就是 Null(${AL})。這個矩陣一定不可逆（det = 0），化簡後至少會有一個零列。`, LN.B,
          { mat: Bs(), title, base: (i, j, t) => diag(i, j) || (t === "0" ? "muted" : "default"), right: head.concat([["對角線各減 " + S(lam), ""]]), table: T(), rk: k }));
        // RREF：每一行一個畫面
        let rr = 0;
        const pivcol = [];
        const ops = [];
        for (let c = 0; c < n && rr < n; c++) {
          let pr = rr; while (pr < n && isZ(B[pr][c])) pr++;
          if (pr === n) {
            r.push(frame(`第 ${c + 1} 行從 R${rr + 1} 往下全是 0，<b>沒有 pivot</b>：x<sub>${c + 1}</sub> 是自由變數，之後會貢獻一個基底向量。`, LN.nopiv,
              { mat: Bs(), title, rowLabels: true, cs: Object.fromEntries(Array.from({ length: n - rr }, (_, t) => [(rr + t) + "," + c, "compare"])), right: head.concat(ops.map((t) => [t, ""])), table: T(), rk: k }));
            continue;
          }
          const step = [];
          if (pr !== rr) { [B[pr], B[rr]] = [B[rr], B[pr]]; step.push(`R${rr + 1} ↔ R${pr + 1}`); }
          const piv = B[rr][c];
          if (!isOne(piv)) { const cc = div(F(1), piv); B[rr] = B[rr].map((x) => div(x, piv)); step.push(`R${rr + 1} ← ${coef(cc) || "1"}R${rr + 1}`); }
          for (let i = 0; i < n; i++) {
            if (i === rr || isZ(B[i][c])) continue;
            const f = B[i][c];
            B[i] = B[i].map((x, j) => sub(x, mul(f, B[rr][j])));
            step.push(f.n > 0 ? `R${i + 1} ← R${i + 1} − ${coef(f)}R${rr + 1}` : `R${i + 1} ← R${i + 1} + ${coef(neg(f))}R${rr + 1}`);
          }
          const prev = ops.slice();
          ops.push(`第 ${c + 1} 行：pivot 完成`);
          const now = [[`第 ${c + 1} 行：`, "strong"]].concat(step.length ? step.map((t) => ["　" + t, ""]) : [["　已經是 pivot 1，不用動", ""]]);
          const cs = {}; for (let i = 0; i < n; i++) cs[i + "," + c] = i === rr ? "active" : "found";
          r.push(frame(`第 ${c + 1} 行：pivot 取在 R${rr + 1}${step.length ? `，做 ${esc(step.join("、"))}` : ""}，讓 pivot 變 1、同一行其他位置變 0（列運算不改變解集合，所以特徵空間不變）。`, LN.pivot.concat(LN.ops),
            { mat: Bs(), title, rowLabels: true, cs, right: head.concat(prev.map((t) => [t, ""]), now), table: T(), rk: k }));
          pivcol.push(c); rr++;
        }
        // 讀出基底
        const isPiv = Array.from({ length: n }, (_, j) => pivcol.includes(j));
        const basis = [];
        for (let f = 0; f < n; f++) {
          if (isPiv[f]) continue;
          const v = Array.from({ length: n }, (_, j) => F(j === f ? 1 : 0));
          pivcol.forEach((pc, i) => (v[pc] = neg(B[i][f])));
          let L = 1; v.forEach((x) => (L = lcm(L, x.d)));
          let w = v.map((x) => mul(x, F(L)));
          let g = 0; w.forEach((x) => (g = g ? gcd(g, x.n) : Math.abs(x.n)));
          if (g > 1) w = w.map((x) => F(x.n, g));
          basis.push({ f, v: w });
        }
        geo.push(basis.length);
        const tags = Array.from({ length: n }, (_, j) => (isPiv[j] ? [`x${j + 1}：pivot`, ""] : [`x${j + 1}：自由`, "strong"]));
        const csF = {}; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (!isPiv[j]) csF[i + "," + j] = "compare"; else if (isZ(B[i][j])) csF[i + "," + j] = "muted"; else csF[i + "," + j] = "found";
        const eqs = pivcol.map((pc, i) => {
          const termsS = basis.map(({ f }) => (isZ(B[i][f]) ? "" : `${neg(B[i][f]).n > 0 ? " + " : " − "}${coef(F(Math.abs(B[i][f].n), B[i][f].d))}x${f + 1}`)).join("");
          return [`x${pc + 1} = ${termsS.replace(/^ \+ /, "").replace(/^ − /, "−") || "0"}`, ""];
        });
        r.push(frame(`RREF 有 ${rr} 個 pivot，rank(${AL}) = ${rr}，所以自由變數有 ${n} − ${rr} = <b>${n - rr}</b> 個（藍色的行）。用自由變數把 pivot 變數寫出來：${esc(eqs.map((e) => e[0]).join("，"))}。`, LN.free,
          { mat: Bs(), title: "RREF", rowLabels: true, cs: csF, colTags: tags, right: head.concat([[`rank = ${rr}，dim E = ${n} − ${rr} = ${n - rr}`, "strong"]], eqs), table: T(), rk: k }));
        // 基底與驗證
        const checks = basis.map(({ v }, t) => {
          const Av = A.map((row) => row.reduce((s, x, j) => add(s, mul(x, v[j])), F(0)));
          const ok = Av.every((x, i) => eq(x, mul(lam, v[i])));
          return { v, Av, ok, t };
        });
        table[k].label = `λ = ${S(lam)}　代數 ${alg[k]}／幾何 ${basis.length}`;
        table[k].state = basis.length < alg[k] ? "active" : "found";
        const vl = [];
        checks.forEach(({ v, Av, ok, t }) => {
          vl.push([`v${t + 1} = ${vec(v)}`, "strong"]);
          vl.push([`Av${t + 1} = ${vec(Av)} ${ok ? "=" : "≠"} ${S(lam)}·v${t + 1}`, ok ? "ok" : "warn"]);
        });
        const freeNames = basis.map(({ f }) => "x" + (f + 1)).join("、");
        r.push(frame(`每個自由變數輪流設成 1（其他自由變數設 0），得到一個基底向量（必要時乘上倍數化成整數，方向不變）；自由變數是 ${freeNames}。E<sub>${S(lam)}</sub> 的維度 = <b>幾何重數 ${basis.length}</b>${basis.length < alg[k] ? `，<b>小於</b>代數重數 ${alg[k]}（缺少特徵向量，橘色標記）` : alg[k] > 1 ? `，等於代數重數 ${alg[k]}` : ""}。每個基底向量都驗算 Av = λv ${checks.every((c) => c.ok) ? "成立" : "不成立（不該發生）"}。`, LN.basis.concat(LN.check),
          { mat: Bs(), title: "RREF", rowLabels: true, cs: csF, colTags: tags, right: head.concat(vl), table: T(), rk: k }));
      });

      // ---------- 總結：trace、det ----------
      const sumL = roots.reduce((s, x, k) => { for (let t = 0; t < alg[k]; t++) s = add(s, x); return s; }, F(0));
      const prodL = roots.reduce((s, x, k) => { for (let t = 0; t < alg[k]; t++) s = mul(s, x); return s; }, F(1));
      const listL = roots.flatMap((x, k) => Array(alg[k]).fill(x));
      const sumTxt = listL.map((x) => (x.n < 0 ? `(${S(x)})` : S(x))).join(" + ");
      const prodTxt = listL.map((x) => (x.n < 0 ? `(${S(x)})` : S(x))).join("·");
      const totalGeo = geo.reduce((a, b) => a + b, 0);
      const right = [
        [`trace A = ${S(tr)}`, "strong"], [`特徵值和 = ${sumTxt} = ${S(sumL)}`, eq(tr, sumL) ? "ok" : "warn"],
        [`det A = ${S(detA)}`, "strong"], [`特徵值積 = ${prodTxt} = ${S(prodL)}`, eq(detA, prodL) ? "ok" : "warn"],
        [`幾何重數總和 = ${totalGeo}（n = ${n}）`, ""],
        [totalGeo === n ? `有 ${n} 個線性獨立的特徵向量` : `只有 ${totalGeo} 個獨立特徵向量 < ${n}`, totalGeo === n ? "ok" : "warn"],
      ];
      if (roots.some((x) => isZ(x))) right.push(["0 是特徵值 ⟺ A 不可逆", "warn"]);
      r.push(frame(`驗算：特徵值<b>照重數</b>加起來 = trace A（${eq(tr, sumL) ? "相符" : "不符"}），乘起來 = det A（${eq(detA, prodL) ? "相符" : "不符"}）。${totalGeo === n ? `幾何重數加起來剛好 ${n}，找得到 ${n} 個線性獨立的特徵向量（之後的對角化會用到）。` : `幾何重數加起來只有 ${totalGeo} &lt; ${n}，獨立的特徵向量不夠 ${n} 個，這種矩陣稱為<b>缺陷矩陣</b>，不能對角化。`}`, LN.trdet,
        { mat: num, title: "A", right, table: T(), base: (i, j, t) => (i === j ? "compare" : t === "0" ? "muted" : "default") }));
      return r.frames;
    }

    const PRESETS = {
      "相異特徵值": "-1 1 2; -2 2 2; -5 1 6",
      "缺陷矩陣": "1 2 -1; -2 5 -1; -2 2 1",
      "重根 2 維特徵空間": "2 1 -1; -1 4 -1; -2 2 1",
      "三角矩陣": "4 1 -2; 0 -1 3; 0 0 2",
      "複數根": "0 -1; 1 0",
    };
    const input = ui.input(player, { placeholder: "例如 4 1; 2 3", value: PRESETS["相異特徵值"], width: 200 });
    const fail = (msg) => {
      input.classList.add("is-error"); setTimeout(() => input.classList.remove("is-error"), 700);
      player.load([{ nodes: [], edges: [], labels: [], caption: `${iconHTML("alert")} ${msg}`, line: null }], { autoplay: false });
    };
    const go = () => {
      const M = parse(input.value);
      if (typeof M === "string") return fail(M);
      let frames;
      try { frames = run(M); } catch (e) { return fail("計算過程的分子或分母太大，超出精確計算的範圍。請換一個數字小一點的矩陣（整數矩陣最好）。"); }
      const long = frames.flatMap((f) => f.nodes).map((nd) => nd.label).find((s) => s && s.length > 7 && !s.startsWith("λ"));
      if (long) return fail(`計算過程會出現 ${esc(long)} 這種太長的數，格子放不下。請換一個數字小一點的矩陣（整數矩陣最好）。`);
      player.load(frames);
    };
    ui.button(player, "求特徵值", go);
    Object.keys(PRESETS).forEach((key) => ui.button(player, key, () => { input.value = PRESETS[key]; go(); }, "ghost"));
    input.addEventListener("keydown", (e) => e.key === "Enter" && go());

    const demo = run(parse(PRESETS["相異特徵值"]));
    demo[0].caption = iconHTML("play") + " 按播放看示範：3×3 矩陣的特徵值 1、2、4 怎麼從 det(A − λI) = 0 找出來，以及每個特徵值的特徵空間怎麼用 RREF 讀出來。也可以輸入自己的 2×2 或 3×3 矩陣（列用 ; 隔開，可用分數如 1/2），或點其他按鈕看重根、缺陷矩陣、三角矩陣、複數根。";
    player.load(demo, { autoplay: false });
  });

  // ===================================================================
  // 靜態圖解
  // ===================================================================
  const dot = (id, x, y) => ({ id, label: "", x, y, r: 0.5, state: "muted" });
  const box = (id, label, x, y, st, w, h) => ({ id, label, shape: "box", x, y, w: w || 40, h: h || 32, state: st || "default" });
  const mat = (k, x0, y0, M, hl, g = 46, gy = 40) => M.flatMap((row, i) => row.map((v, j) => box(k + i + "_" + j, v, x0 + j * g, y0 + i * gy, hl(i, j, v) || (v === "0" ? "muted" : "default"))));

  // 圖 1：A = [4 1; 2 3] 作用在三個向量上
  figure("eigen-geometry", () => {
    const U = 32, OX = 150, OY = 222;
    const P2 = (x, y) => [OX + x * U, OY - y * U];
    const nodes = [], edges = [], labels = [];
    const pt = (id, x, y) => { const [a, b] = P2(x, y); nodes.push(dot(id, a, b)); };
    // 座標軸
    pt("ax0", -2.2, 0); pt("ax1", 6.2, 0); pt("ay0", 0, -4.6); pt("ay1", 0, 5.8);
    edges.push({ from: "ax0", to: "ax1", state: "muted" }, { from: "ay0", to: "ay1", state: "muted" });
    // 兩條特徵向量方向（虛線）
    pt("l1a", -1.5, -1.5); pt("l1b", 5.8, 5.8); pt("l2a", -0.6, 1.2); pt("l2b", 2.25, -4.5);
    edges.push({ from: "l1a", to: "l1b", state: "muted", dashed: true }, { from: "l2a", to: "l2b", state: "muted", dashed: true });
    pt("o", 0, 0);
    const vecs = [["Av1", 5, 5, "found"], ["v1", 1, 1, "compare"], ["Av2", 2, -4, "found"], ["v2", 1, -2, "compare"], ["Ax", 4, 2, "active"], ["x", 1, 0, "visited"]];
    vecs.forEach(([id, x, y, st]) => { pt(id, x, y); edges.push({ from: "o", to: id, state: st, directed: true }); });
    const lab = (id, x, y, text, cls, anchor) => { const [a, b] = P2(x, y); labels.push({ id, x: a, y: b, text, cls: cls || "", anchor: anchor || "start" }); };
    lab("t1", 4.75, 5.45, "Av₁ = (5, 5) = 5v₁", "strong", "end");
    lab("t2", -0.25, 1.35, "v₁ = (1, 1)", "", "end");
    lab("t3", 2.2, -4.15, "Av₂ = (2, −4) = 2v₂", "strong");
    lab("t4", 1.2, -1.75, "v₂ = (1, −2)", "");
    lab("t5", 4.2, 2.1, "Ax = (4, 2)", "");
    lab("t6", 1.0, -0.42, "x = (1, 0)", "");
    labels.push(
      { id: "h", x: 380, y: 50, text: "A = [4 1; 2 3]", cls: "strong", anchor: "start" },
      { id: "n1", x: 380, y: 92, text: "藍 → 綠：特徵向量被 A 映射後", anchor: "start" },
      { id: "n2", x: 380, y: 116, text: "仍在同一條虛線上，只被拉長", anchor: "start" },
      { id: "n3", x: 380, y: 150, text: "v₁ 拉長 5 倍：λ₁ = 5", anchor: "start", cls: "ok" },
      { id: "n4", x: 380, y: 174, text: "v₂ 拉長 2 倍：λ₂ = 2", anchor: "start", cls: "ok" },
      { id: "n5", x: 380, y: 218, text: "青 → 橘：一般向量 x", anchor: "start" },
      { id: "n6", x: 380, y: 242, text: "映射後方向改變了（轉了約 27°）", anchor: "start" },
      { id: "n7", x: 380, y: 266, text: "所以 x 不是特徵向量", anchor: "start", cls: "warn" },
      { id: "n8", x: 380, y: 318, text: "虛線上任何非零向量", anchor: "start" },
      { id: "n9", x: 380, y: 342, text: "（例如 3v₁、−v₂）也都是特徵向量", anchor: "start" },
    );
    return { width: 640, height: 400, nodes, edges, labels };
  });

  // 圖 2：同樣的特徵多項式 (λ − 2)²，幾何重數不同
  figure("eigen-multiplicity", () => {
    const J = [["2", "1"], ["0", "2"]], Jm = [["0", "1"], ["0", "0"]];
    const D = [["2", "0"], ["0", "2"]], Dm = [["0", "0"], ["0", "0"]];
    const nodes = mat("a", 60, 86, J, (i, j) => (i === j ? "compare" : null))
      .concat(mat("b", 196, 86, Jm, (i, j) => (i === 0 && j === 1 ? "active" : null)))
      .concat(mat("c", 384, 86, D, (i, j) => (i === j ? "compare" : null)))
      .concat(mat("d", 520, 86, Dm, () => null));
    return {
      width: 640, height: 290, nodes,
      labels: [
        { id: "t1", x: 160, y: 24, text: "缺陷：代數 2、幾何 1", cls: "strong" },
        { id: "t2", x: 484, y: 24, text: "不缺陷：代數 2、幾何 2", cls: "strong" },
        { id: "a", x: 83, y: 56, text: "A", cls: "title" }, { id: "b", x: 219, y: 56, text: "A − 2I", cls: "title" },
        { id: "c", x: 407, y: 56, text: "B", cls: "title" }, { id: "d", x: 543, y: 56, text: "B − 2I", cls: "title" },
        { id: "ar1", x: 150, y: 106, text: "→", cls: "title" }, { id: "ar2", x: 474, y: 106, text: "→", cls: "title" },
        { id: "a1", x: 160, y: 182, text: "rank(A − 2I) = 1", anchor: "middle" },
        { id: "a2", x: 160, y: 206, text: "dim E₂ = 2 − 1 = 1", anchor: "middle", cls: "warn" },
        { id: "a3", x: 160, y: 230, text: "E₂ = span{(1, 0)}：只有 x 軸方向", anchor: "middle" },
        { id: "b1", x: 484, y: 182, text: "rank(B − 2I) = 0", anchor: "middle" },
        { id: "b2", x: 484, y: 206, text: "dim E₂ = 2 − 0 = 2", anchor: "middle", cls: "ok" },
        { id: "b3", x: 484, y: 230, text: "E₂ = ℝ²：每個非零向量都是", anchor: "middle" },
        { id: "n", x: 320, y: 272, text: "兩者的特徵多項式都是 (λ − 2)²，差別只能從 rank(A − λI) 看出來", anchor: "middle" },
      ],
    };
  });

  // 圖 3：由 (λ, v) 推出相關矩陣的特徵值
  figure("eigen-properties", () => {
    const C = { x: 320, y: 150 };
    const items = [
      ["k", "Aᵏ：λᵏ（v 不變）", 120, 46], ["inv", "A⁻¹：1/λ（v 不變）", 520, 46],
      ["c", "A + cI：λ + c（v 不變）", 112, 150], ["p", "p(A)：p(λ)（v 不變）", 528, 150],
      ["t", "Aᵀ：λ（特徵向量會變）", 120, 254], ["s", "cA：cλ（v 不變）", 520, 254],
    ];
    const nodes = [box("c0", "Av = λv", C.x, C.y, "found", 130, 40)].concat(items.map(([id, t, x, y]) => box(id, t, x, y, id === "t" ? "active" : "compare", 214, 36)));
    return {
      width: 640, height: 300, nodes,
      edges: items.map(([id]) => ({ from: "c0", to: id, state: "visited" })),
      labels: [{ id: "n", x: 320, y: 292, text: "A⁻¹ 要 A 可逆（λ ≠ 0）；Aᵀ 的特徵值相同但特徵向量一般不同（橘色）", anchor: "middle" }],
    };
  });
})();
