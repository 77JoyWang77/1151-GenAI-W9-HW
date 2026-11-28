/* =====================================================================
   Diagonalization（對角化）主題的視覺化
   - diag-solve : 輸入 2×2 或 3×3 矩陣（可用分數），逐步求特徵值 → 每個 λ 的 rank(A − λI) 與
                  幾何重數 → 判斷可否對角化 → 把特徵向量排進 P、特徵值排進 D → 逐行驗算 AP = PD →
                  （算 Aᵏ 時）P⁻¹、Dᵏ、Aᵏ = P Dᵏ P⁻¹，並和直接連乘比對（分數精確計算）
   - 靜態圖：AP = PD 的逐行意義、三種矩陣的重數比較、Aᵏ = P Dᵏ P⁻¹ 的座標變換
   ===================================================================== */
(function () {
  "use strict";
  const { Player, Recorder, ui, register, esc, iconHTML, figure } = window.DSViz;

  // 右側程式碼：用 .work/extract_code.py 從 code/linear-algebra/diagonalization.c 原封不動抽出
  const CODE = [
    "int diagonalize(Frac A[MAXN][MAXN], Frac P[MAXN][MAXN], Frac D[MAXN][MAXN]) {   /* 可對角化回傳 1、缺陷回傳 0 */",
    "  Frac lam[MAXN], basis[MAXN][MAXN];",
    "  int alg[MAXN], col = 0;",
    "  Poly rest;",
    "  int k = eigenvalues(charPoly(A), lam, alg, &rest);",
    "  if (rest.deg > 0) return -1;                 /* 有無理根或複數根：P、D 不是有理數，這裡不處理 */",
    "  for (int i = 0; i < n; i++)",
    "    for (int j = 0; j < n; j++) D[i][j] = frac(0, 1);",
    "  for (int t = 0; t < k; t++) {",
    "    int g = eigenspace(A, lam[t], basis);      /* g = 幾何重數 = n − rank(A − λI) */",
    "    if (g < alg[t]) return 0;                  /* 幾何重數 < 代數重數：特徵向量不夠 n 個 */",
    "    for (int s = 0; s < g; s++, col++) {",
    "      for (int i = 0; i < n; i++) P[i][col] = basis[s][i];   /* 第 col 個特徵向量放進 P 的第 col 行 */",
    "      D[col][col] = lam[t];                    /* 對應的特徵值放在 D 的同一行 */",
    "    }",
    "  }",
    "  return 1;                                    /* 此時 col == n，P 的 n 行線性獨立 */",
    "}",
    "",
    "int checkAPPD(Frac A[MAXN][MAXN], Frac P[MAXN][MAXN], Frac D[MAXN][MAXN]) {   /* 驗算 AP = PD */",
    "  Frac L[MAXN][MAXN], R[MAXN][MAXN];",
    "  matMul(A, P, L);                             /* AP 的第 j 行 = A·(P 的第 j 行) */",
    "  matMul(P, D, R);                             /* PD 的第 j 行 = d_jj·(P 的第 j 行) */",
    "  for (int i = 0; i < n; i++)",
    "    for (int j = 0; j < n; j++)",
    "      if (!feq(L[i][j], R[i][j])) return 0;",
    "  return 1;",
    "}",
    "",
    "void powerByDiag(Frac P[MAXN][MAXN], Frac D[MAXN][MAXN], int k, Frac Ak[MAXN][MAXN]) {",
    "  Frac Dk[MAXN][MAXN], Pinv[MAXN][MAXN], T[MAXN][MAXN];",
    "  for (int i = 0; i < n; i++)",
    "    for (int j = 0; j < n; j++) Dk[i][j] = (i == j) ? fpow(D[i][i], k) : frac(0, 1);   /* D^k = diag(λ₁^k, …, λₙ^k) */",
    "  inverse(P, Pinv);",
    "  matMul(P, Dk, T);                            /* T = P D^k */",
    "  matMul(T, Pinv, Ak);                         /* A^k = P D^k P⁻¹ */",
    "}"
  ];
  const ln = (s) => CODE.findIndex((l) => l.includes(s)) + 1;
  const LN = {
    eig: ln("int k = eigenvalues(charPoly(A)"),
    irr: ln("if (rest.deg > 0) return -1;"),
    space: ln("int g = eigenspace("),
    defect: ln("if (g < alg[t]) return 0;"),
    put: [ln("P[i][col] = basis[s][i]"), ln("D[col][col] = lam[t]")],
    done: ln("此時 col == n"),
    check: [ln("matMul(A, P, L);"), ln("matMul(P, D, R);"), ln("if (!feq(L[i][j], R[i][j])) return 0;")],
    dk: [ln("D^k = diag("), ln("inverse(P, Pinv);")],
    mul: [ln("T = P D^k"), ln("matMul(T, Pinv, Ak);")],
  };

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
  const absF = (x) => F(Math.abs(x.n), x.d);
  const cmpAbs1 = (x) => Math.sign(Math.abs(x.n) - x.d);           // |x| 和 1 比大小
  const fpow = (x, k) => { let r = F(1); for (let t = 0; t < k; t++) r = mul(r, x); return r; };

  // ---------- 矩陣 ----------
  const matMul = (X, Y) => X.map((row) => Y[0].map((_, j) => row.reduce((s, x, k) => add(s, mul(x, Y[k][j])), F(0))));
  const ident = (n) => Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => F(i === j ? 1 : 0)));
  const matPow = (A, k) => { let R = ident(A.length), B = A; while (k > 0) { if (k & 1) R = matMul(R, B); B = matMul(B, B); k >>= 1; } return R; };
  const Ms = (M) => M.map((row) => row.map(S));
  function inverse(P) {                          // [P | I] → [I | P⁻¹]
    const n = P.length;
    const M = P.map((row, i) => row.concat(Array.from({ length: n }, (_, j) => F(i === j ? 1 : 0))));
    for (let c = 0; c < n; c++) {
      let p = c; while (p < n && isZ(M[p][c])) p++;
      if (p === n) return null;
      [M[c], M[p]] = [M[p], M[c]];
      const piv = M[c][c];
      M[c] = M[c].map((x) => div(x, piv));
      for (let i = 0; i < n; i++) if (i !== c && !isZ(M[i][c])) { const f = M[i][c]; M[i] = M[i].map((x, j) => sub(x, mul(f, M[c][j]))); }
    }
    return M.map((row) => row.slice(n));
  }
  function rref(B) {                             // 回傳 { R, pivcol }
    const n = B.length, R = B.map((row) => row.slice()), pivcol = [];
    let r = 0;
    for (let c = 0; c < n && r < n; c++) {
      let p = r; while (p < n && isZ(R[p][c])) p++;
      if (p === n) continue;
      [R[r], R[p]] = [R[p], R[r]];
      const piv = R[r][c];
      R[r] = R[r].map((x) => div(x, piv));
      for (let i = 0; i < n; i++) if (i !== r && !isZ(R[i][c])) { const f = R[i][c]; R[i] = R[i].map((x, j) => sub(x, mul(f, R[r][j]))); }
      pivcol.push(c); r++;
    }
    return { R, pivcol };
  }

  // ---------- 多項式：c[k] 是 λ^k 的係數 ----------
  const SUP = ["", "", "²", "³"];
  const trim = (c) => { c = c.slice(); while (c.length > 1 && isZ(c[c.length - 1])) c.pop(); return c; };
  const padd = (a, b) => trim(Array.from({ length: Math.max(a.length, b.length) }, (_, k) => add(a[k] || F(0), b[k] || F(0))));
  const psub = (a, b) => padd(a, b.map(neg));
  const pmul = (a, b) => { const r = Array.from({ length: a.length + b.length - 1 }, () => F(0)); a.forEach((x, i) => b.forEach((y, j) => (r[i + j] = add(r[i + j], mul(x, y))))); return trim(r); };
  const peval = (c, x) => c.reduceRight((s, a) => add(mul(s, x), a), F(0));
  const deflate = (c, r) => { const q = []; let carry = F(0); for (let k = c.length - 1; k >= 1; k--) { carry = add(mul(carry, r), c[k]); q[k - 1] = carry; } return q; };
  function Ptxt(c) {
    let s = "";
    for (let k = c.length - 1; k >= 0; k--) {
      const a = c[k];
      if (isZ(a)) continue;
      const body = k === 0 ? S(absF(a)) : coef(absF(a)) + "λ" + SUP[k];
      s += s === "" ? (a.n < 0 ? "−" : "") + body : (a.n < 0 ? " − " : " + ") + body;
    }
    return s || "0";
  }
  const lin = (r) => (isZ(r) ? "λ" : r.n > 0 ? `λ − ${S(r)}` : `λ + ${S(neg(r))}`);
  const vec = (v) => "(" + v.map(S).join(", ") + ")";
  const SUB = ["₁", "₂", "₃"];

  function charPoly(A) {                         // det(A − λI)
    const n = A.length;
    const e = (i, j) => (i === j ? [A[i][j], F(-1)] : [A[i][j]]);
    if (n === 2) return psub(pmul(e(0, 0), e(1, 1)), pmul(e(0, 1), e(1, 0)));
    let p = [F(0)];
    for (let j = 0; j < 3; j++) {
      const c1 = j === 0 ? 1 : 0, c2 = j === 2 ? 1 : 2;
      const term = pmul(e(0, j), psub(pmul(e(1, c1), e(2, c2)), pmul(e(1, c2), e(2, c1))));
      p = j === 1 ? psub(p, term) : padd(p, term);
    }
    return p;
  }
  function rationalRoot(m) {                     // 和 C 版同樣的試根順序：q = 1, 2, …；p = 1, 2, …；先 + 後 −
    let L = 1; m.forEach((a) => (L = lcm(L, a.d)));
    const ai = m.map((a) => a.n * (L / a.d));
    if (ai[0] === 0) return F(0);
    const a0 = Math.abs(ai[0]), an = Math.abs(ai[ai.length - 1]);
    for (let q = 1; q <= an; q++) {
      if (an % q) continue;
      for (let pp = 1; pp <= a0; pp++) {
        if (a0 % pp) continue;
        for (const s of [1, -1]) { const c = F(s * pp, q); if (isZ(peval(m, c))) return c; }
      }
    }
    return null;
  }
  function eigenvalues(A) {
    let m = charPoly(A);
    const lam = [], alg = [];
    let r;
    while (m.length > 1 && (r = rationalRoot(m))) {
      if (lam.length && eq(lam[lam.length - 1], r)) alg[alg.length - 1]++;
      else { lam.push(r); alg.push(1); }
      m = deflate(m, r);
    }
    return { p: charPoly(A), lam, alg, rest: m };
  }
  function eigenspace(A, lam) {                  // 回傳 { B, R, pivcol, basis }
    const n = A.length;
    const B = A.map((row, i) => row.map((x, j) => (i === j ? sub(x, lam) : x)));
    const { R, pivcol } = rref(B);
    const basis = [];
    for (let f = 0; f < n; f++) {
      if (pivcol.includes(f)) continue;
      const v = Array.from({ length: n }, (_, j) => F(j === f ? 1 : 0));
      pivcol.forEach((pc, i) => (v[pc] = neg(R[i][f])));
      let L = 1; v.forEach((x) => (L = lcm(L, x.d)));
      let w = v.map((x) => mul(x, F(L)));
      let g = 0; w.forEach((x) => (g = g ? gcd(g, x.n) : Math.abs(x.n)));
      if (g > 1) w = w.map((x) => F(x.n, g));
      basis.push(w);
    }
    return { B, R, pivcol, basis };
  }

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
    if (M.some((r) => r.length !== M.length)) return `只有<b>方陣</b>才談得上對角化：你輸入了 ${M.length} 列，每一列也要剛好 ${M.length} 個數。`;
    return M;
  }

  // ---------- 畫面配置 ----------
  const GX = 72, GY = 40, CW = 66, CH = 32;
  const ROW1 = 74, ROW2 = 258, SL = 130, SM = 380, NX = 515;

  register("diag-solve", function (root) {
    const player = new Player(root, {
      title: "Diagonalization 對角化",
      width: 780, height: 376, code: CODE, wide: true,
      legend: [["active", "對角線／pivot"], ["compare", "正在看的行"], ["new", "剛放進 P、D"], ["found", "完成"], ["removed", "缺特徵向量"]],
    });
    let n = 2;
    const cx = (c, j) => c + (j - (n - 1) / 2) * GX;

    // 畫一個矩陣：key 決定元素 id（同 id 在前後畫面之間會平滑移動／變色）
    function drawMat(nodes, labels, key, center, y0, spec) {
      if (!spec) return;
      const M = spec.M;
      M.forEach((row, i) => row.forEach((t, j) => {
        const st = (spec.cs && spec.cs(i, j, t)) || (t === "?" ? "ghost" : t === "0" ? "muted" : "default");
        nodes.push({ id: key + i + j, label: t === "?" ? "" : t, shape: "box", x: cx(center, j), y: y0 + i * GY, w: CW, h: CH, state: st });
      }));
      labels.push({ id: key + "t", x: center, y: y0 - 34, text: spec.title, cls: "title" });
    }
    function frame(caption, line, o = {}) {
      const nodes = [], labels = [];
      drawMat(nodes, labels, "a", SL, ROW1, o.m1);
      drawMat(nodes, labels, "b", SM, ROW1, o.m2);
      drawMat(nodes, labels, "P", SL, ROW2, o.P);
      drawMat(nodes, labels, "D", SM, ROW2, o.D);
      if (o.op) labels.push({ id: "op1", x: (SL + SM) / 2, y: ROW1 + (n - 1) * GY / 2 + 6, text: o.op, cls: "strong" });
      (o.notes || []).forEach((t, k) => labels.push({ id: "n" + k + "_" + (o.nk || ""), x: NX, y: ROW1 - 30 + k * 25, text: t[0], cls: t[1] || "", anchor: "start" }));
      (o.table || []).forEach((t, k) => labels.push({ id: "tb" + k, x: NX, y: ROW2 - 30 + k * 25, text: t[0], cls: t[1] || "", anchor: "start" }));
      return { nodes, edges: [], labels, caption, line };
    }

    function run(A, k) {
      n = A.length;
      const r = new Recorder();
      const num = Ms(A);
      const Pm = Array.from({ length: n }, () => Array(n).fill("?"));
      const Dm = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? "?" : "0")));
      const Pstate = Array.from({ length: n }, () => "default");      // 每一行的狀態
      const Pspec = () => ({ title: "P（特徵向量當行）", M: Pm.map((row) => row.slice()), cs: (i, j, t) => (t === "?" ? "ghost" : Pstate[j]) });
      const Dspec = () => ({ title: "D（特徵值放對角線）", M: Dm.map((row) => row.slice()), cs: (i, j, t) => (i !== j ? "muted" : t === "?" ? "ghost" : Pstate[j]) });
      const diagSt = (i, j, t) => (i === j ? "active" : t === "0" ? "muted" : "default");

      r.push(frame(`輸入的 ${n}×${n} 矩陣 A。對角化要找<b>可逆</b>的 P 和<b>對角</b>的 D 使 A = PDP⁻¹；兩邊右乘 P 就是 AP = PD，逐行看就是 Avⱼ = λⱼvⱼ：P 的每一行都必須是特徵向量，D 的對角線放對應的特徵值。下面的 P、D 會一行一行填滿。`, null,
        { m1: { title: "A", M: num }, P: Pspec(), D: Dspec(), notes: [["A = PDP⁻¹", "strong"], ["⟺ AP = PD", "strong"], ["P 的第 j 行 = 特徵向量 vⱼ", ""], ["D 的第 j 個對角元素 = λⱼ", ""], ["P 可逆 ⟺ n 個特徵向量線性獨立", ""]] }));

      // ---------- 特徵值 ----------
      const { p, lam, alg, rest } = eigenvalues(A);
      const factors = lam.map((x, t) => "(" + lin(x) + ")" + (alg[t] > 1 ? SUP[alg[t]] : "")).join("");
      const sign = n === 3 ? "−" : "";
      const restTxt = rest.length > 1 ? "(" + Ptxt(n === 3 ? rest.map(neg) : rest) + ")" : "";
      const eigTable = (geo) => lam.map((x, t) => [`λ = ${S(x)}：代數 ${alg[t]}` + (geo && geo[t] !== undefined ? `、幾何 ${geo[t]}` : ""), geo && geo[t] !== undefined ? (geo[t] < alg[t] ? "warn" : "ok") : ""]);
      if (rest.length > 1) {
        const deg = rest.length - 1;
        let why, kind;
        if (deg === 2) {
          const a = rest[2], b = rest[1], c = rest[0];
          const Dd = sub(mul(b, b), mul(F(4), mul(a, c)));
          kind = Dd.n < 0 ? "共軛複數" : "無理數";
          why = `剩下的二次式判別式 ${S(Dd)} ${Dd.n < 0 ? "&lt; 0，兩根是共軛複數" : "&gt; 0 但不是完全平方，兩根是無理數"}，而且兩根不相等`;
        } else { kind = "無理數或複數"; why = "三次式沒有有理根，在有理數上不可約，三個根一定互不相同"; }
        const notes = [["det(A − λI) =", "strong"], [Ptxt(p), ""], [`= ${sign}${factors}${restTxt}`, ""], [`剩下的根是${kind}`, "warn"]];
        let caption = `${iconHTML("alert")} det(A − λI) = ${esc(Ptxt(p))}，有理根定理找不完所有根：${why}。所有特徵值都是<b>單根、互不相同</b>，所以 A ${kind === "無理數" ? "在 ℝ 上" : deg === 2 ? "在 ℂ 上（不是在 ℝ 上）" : "至少在 ℂ 上"}<b>一定可以對角化</b>，只是 P、D 含有${kind}，這個動畫用分數精確計算，不展開 P、D。`;
        const o = { m1: { title: "A", M: num }, P: Pspec(), D: Dspec(), notes, table: eigTable() };
        if (k !== null) {
          const Ak = matPow(A, k);
          o.m2 = { title: `A${supK(k)}（直接快速冪）`, M: Ms(Ak), cs: () => "found" };
          o.op = "→";
          caption += ` 不過 A${supK(k)} 仍然可以直接用快速冪精確算出來（右邊）；它的封閉式會是 λ₁ᵏ、λ₂ᵏ 的組合，例如 Fibonacci 的 Binet 公式。`;
        }
        r.push(frame(caption, LN.irr, o));
        return r.frames;
      }
      r.push(frame(`第 1 步：求特徵值（求法見特徵值頁）。det(A − λI) = ${esc(Ptxt(p))} = ${sign}${esc(factors)}。${lam.length === n ? `${n} 個特徵值<b>互不相同</b>，其實已經保證可對角化；還是照流程把特徵向量求出來組 P。` : `有<b>重根</b>，重根能不能湊滿特徵向量要看下一步的幾何重數。`}`, LN.eig,
        { m1: { title: "A", M: num }, P: Pspec(), D: Dspec(), notes: [["det(A − λI) =", "strong"], [Ptxt(p), ""], [`= ${sign}${factors}`, ""], [`相異特徵值 ${lam.length} 個，代數重數和 = ${n}`, ""]], table: eigTable() }));

      // ---------- 每個 λ：幾何重數、特徵向量放進 P ----------
      const geo = [];
      let col = 0;
      for (let t = 0; t < lam.length; t++) {
        const L = lam[t];
        const { B, R, pivcol, basis } = eigenspace(A, L);
        const g = basis.length, rk = n - g;
        geo.push(g);
        const mag = absF(L);
        const AL = isZ(L) ? "A − 0I" : `A ${L.n > 0 ? "−" : "+"} ${isOne(mag) ? "" : mag.d === 1 ? S(mag) : "(" + S(mag) + ")"}I`;
        const free = (j) => !pivcol.includes(j);
        const rrefCs = (i, j, t2) => (pivcol[i] === j ? "active" : free(j) ? "compare" : t2 === "0" ? "muted" : "default");
        const okg = g === alg[t];
        r.push(frame(`λ = ${S(L)}（代數重數 ${alg[t]}）：把 ${AL} 化成 RREF，有 ${rk} 個 pivot（橘色），rank = ${rk}，自由變數 ${g} 個（藍色的行），所以<b>幾何重數 = ${n} − ${rk} = ${g}</b>${okg ? (alg[t] > 1 ? `，等於代數重數 ${alg[t]}：這個重根貢獻得出 ${g} 個獨立的特徵向量。` : "。單根的幾何重數一定是 1。") : `，<b>小於</b>代數重數 ${alg[t]}。`}`, LN.space,
          { m1: { title: AL, M: Ms(B), cs: diagSt }, m2: { title: "RREF", M: Ms(R), cs: rrefCs }, op: "→", P: Pspec(), D: Dspec(), nk: t,
            notes: [[`λ = ${S(L)}（代數重數 ${alg[t]}）`, "strong"], [`rank(${AL}) = ${rk}`, ""], [`幾何重數 = ${n} − ${rk} = ${g}`, okg ? "ok" : "warn"], [okg ? "幾何 = 代數" : `幾何 ${g} < 代數 ${alg[t]}`, okg ? "ok" : "warn"]], table: eigTable(geo) }));
        if (!okg) {
          r.push(frame(`${iconHTML("alert")} λ = ${S(L)} 的代數重數是 ${alg[t]}，特徵空間卻只有 ${g} 維：少了 ${alg[t] - g} 個特徵向量。每個特徵值的幾何重數最多等於代數重數，別的特徵值補不回來，獨立的特徵向量最多只有 ${geo.slice(0, t + 1).reduce((a, b) => a + b, 0)} + ${lam.slice(t + 1).map((_, s) => alg[t + 1 + s]).reduce((a, b) => a + b, 0)} &lt; ${n} 個，P 的 ${n} 行永遠湊不滿。所以 A <b>不能對角化</b>（缺陷矩陣），程式在這裡回傳 0。它最接近的形式是 Jordan form。`, LN.defect,
            { m1: { title: AL, M: Ms(B), cs: diagSt }, m2: { title: "RREF", M: Ms(R), cs: rrefCs }, op: "→", P: Pspec(), D: Dspec(), nk: "x",
              notes: [["不能對角化", "warn"], [`λ = ${S(L)}：幾何 ${g} < 代數 ${alg[t]}`, "warn"], [`獨立特徵向量 < ${n} 個`, ""], ["P 湊不出可逆矩陣", ""]], table: eigTable(geo) }));
          return r.frames;
        }
        // 特徵向量放進 P
        const names = [];
        basis.forEach((v, s) => {
          const c = col + s;
          v.forEach((x, i) => (Pm[i][c] = S(x)));
          Dm[c][c] = S(L);
          Pstate[c] = "new";
          names.push(`v${SUB[c]} = ${vec(v)}`);
        });
        r.push(frame(`每個自由變數輪流設 1（其他設 0）得到 E<sub>${S(L)}</sub> 的基底：${esc(names.join("、"))}。把它們放進 P 的第 ${Array.from({ length: g }, (_, s) => col + s + 1).join("、")} 行（紫色），D 的同一個對角位置寫 ${S(L)}，<b>順序要對應</b>：P 第 j 行的特徵向量配 D 第 j 個對角元素。`, LN.put,
          { m1: { title: "RREF", M: Ms(R), cs: rrefCs }, P: Pspec(), D: Dspec(), nk: "v" + t,
            notes: [[`特徵空間基底（λ = ${S(L)}）`, "strong"]].concat(names.map((s2) => [s2, ""])), table: eigTable(geo) }));
        basis.forEach((_, s) => (Pstate[col + s] = "found"));
        col += g;
      }

      // ---------- 完成 P、D ----------
      const P = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => null));
      // 重新取出分數版的 P、D
      let c0 = 0;
      lam.forEach((L) => { eigenspace(A, L).basis.forEach((v) => { v.forEach((x, i) => (P[i][c0] = x)); c0++; }); });
      const D = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? null : F(0))));
      c0 = 0; lam.forEach((L, t) => { for (let s = 0; s < alg[t]; s++) { D[c0][c0] = L; c0++; } });
      r.push(frame(`每個特徵值的幾何重數都等於代數重數，加起來剛好 ${n}：P 的 ${n} 行是 ${n} 個線性獨立的特徵向量（不同特徵空間的基底合起來仍然獨立），所以 P 可逆，<b>A 可以對角化</b>。`, LN.done,
        { m1: { title: "A", M: num }, P: Pspec(), D: Dspec(), notes: [["可以對角化", "ok"], [`幾何重數總和 = ${geo.join(" + ")} = ${n}`, ""], ["P 的行線性獨立 → P 可逆", ""], ["A = PDP⁻¹", "strong"]], table: eigTable(geo) }));

      // ---------- 驗算 AP = PD ----------
      const AP = matMul(A, P), PD = matMul(P, D);
      for (let j = 0; j < n; j++) {
        const csj = (i, jj) => (jj === j ? "compare" : jj < j ? "found" : "default");
        const v = P.map((row) => row[j]);
        r.push(frame(`驗算第 ${j + 1} 行：AP 的第 ${j + 1} 行 = A·v${SUB[j]} = ${vec(AP.map((row) => row[j]))}；PD 的第 ${j + 1} 行 = ${S(D[j][j])}·v${SUB[j]} = ${vec(PD.map((row) => row[j]))}。${AP.every((row, i) => eq(row[j], PD[i][j])) ? "兩者相同" : "不相同（不該發生）"}，這正是 Av = λv。`, LN.check,
          { m1: { title: "AP", M: Ms(AP), cs: csj }, m2: { title: "PD", M: Ms(PD), cs: csj }, op: "=", P: Pspec(), D: Dspec(), nk: "c" + j,
            notes: [[`第 ${j + 1} 行：v${SUB[j]} = ${vec(v)}`, "strong"], [`A·v${SUB[j]} = ${vec(AP.map((row) => row[j]))}`, ""], [`${S(D[j][j])}·v${SUB[j]} = ${vec(PD.map((row) => row[j]))}`, ""], ["兩邊相同", "ok"]], table: eigTable(geo) }));
      }
      const longRun = trend(lam);
      if (k === null) {
        r.push(frame(`AP = PD 每一行都對上，P 可逆，所以 <b>A = PDP⁻¹</b>（也可寫成 P⁻¹AP = D）。P、D 並不唯一：特徵向量可以乘非零倍數、行的順序可以換（D 跟著換）。${longRun}`, null,
          { m1: { title: "AP", M: Ms(AP), cs: () => "found" }, m2: { title: "PD", M: Ms(PD), cs: () => "found" }, op: "=", P: Pspec(), D: Dspec(), nk: "end",
            notes: [["AP = PD 全部相符", "ok"], ["⟹ A = PDP⁻¹", "strong"], ["P、D 不唯一：", ""], ["倍數、行的順序都能換", ""]], table: eigTable(geo) }));
        return r.frames;
      }

      // ---------- Aᵏ = P Dᵏ P⁻¹ ----------
      const Pinv = inverse(P);
      const Dk = D.map((row, i) => row.map((x, j) => (i === j ? fpow(x, k) : F(0))));
      const K = supK(k);
      r.push(frame(`算 A${K}：先寫出 D${K}，<b>對角矩陣的次方只要把每個對角元素各自 ${k} 次方</b>：diag(${lam.flatMap((L, t) => Array(alg[t]).fill(L)).map((L) => `${S(L)}${K}`).join(", ")})。再用 [P | I] 的列運算求出 P⁻¹（見反矩陣頁）。`, LN.dk,
        { m1: { title: "P⁻¹", M: Ms(Pinv), cs: () => "active" }, m2: { title: `D${K}`, M: Ms(Dk), cs: (i, j) => (i === j ? "new" : "muted") }, P: Pspec(), D: Dspec(), nk: "dk",
          notes: [[`A${K} = P D${K} P⁻¹`, "strong"], [`D${K} = diag(λ₁${K}, …, λₙ${K})`, ""], ["中間的 P⁻¹P = I 全部消掉：", ""], ["(PDP⁻¹)(PDP⁻¹)⋯ = PDᵏP⁻¹", ""]], table: eigTable(geo) }));
      const T = matMul(P, Dk), Ak = matMul(T, Pinv), direct = matPow(A, k);
      r.push(frame(`P·D${K} 就是把 P 的第 j 行乘上 λⱼ${K}；再右乘 P⁻¹ 得到 A${K}（右邊）。整個過程只需要 2 次矩陣乘法，不管 k 多大。`, LN.mul,
        { m1: { title: `P D${K}`, M: Ms(T), cs: () => "compare" }, m2: { title: `A${K} = P D${K} P⁻¹`, M: Ms(Ak), cs: () => "found" }, op: "→", P: Pspec(), D: Dspec(), nk: "mul",
          notes: [[`P D${K}：P 的第 j 行 × λⱼ${K}`, ""], [`再右乘 P⁻¹`, ""], [`A${K} 算好了`, "ok"]], table: eigTable(geo) }));
      const same = Ak.every((row, i) => row.every((x, j) => eq(x, direct[i][j])));
      r.push(frame(`對答案：直接用快速冪連乘算 A${K}（右邊），和 P D${K} P⁻¹ ${same ? "完全相同" : "不同（不該發生）"}。${longRun}`, null,
        { m1: { title: `P D${K} P⁻¹`, M: Ms(Ak), cs: () => "found" }, m2: { title: `A${K}（直接連乘）`, M: Ms(direct), cs: () => "found" }, op: "=", P: Pspec(), D: Dspec(), nk: "end",
          notes: [[same ? "兩種算法相同" : "不相同", same ? "ok" : "warn"], ["k → ∞ 看 |λ|：", "strong"]].concat(trendNotes(lam)), table: eigTable(geo) }));
      return r.frames;
    }

    const supK = (k) => String(k).split("").map((d) => "⁰¹²³⁴⁵⁶⁷⁸⁹"[d]).join("");
    function trend(lam) {
      const big = lam.some((L) => cmpAbs1(L) > 0), unit = lam.filter((L) => cmpAbs1(L) === 0);
      if (big) return "有 |λ| &gt; 1 的特徵值，k 越大 Aᵏ 越大，lim Aᵏ 不存在（發散）。";
      if (!unit.length) return "所有 |λ| &lt; 1，λᵏ → 0，所以 Aᵏ → 0。";
      if (unit.some((L) => L.n < 0)) return "有 λ = −1，(−1)ᵏ 一直正負交替，Aᵏ 震盪，極限不存在。";
      return "λ = 1 的部分永遠不變、|λ| &lt; 1 的部分趨近 0，所以 Aᵏ 收斂到 P·diag(只留 λ = 1 的 1)·P⁻¹（Markov 鏈的穩定狀態就是這樣來的）。";
    }
    function trendNotes(lam) {
      const big = lam.some((L) => cmpAbs1(L) > 0), unit = lam.filter((L) => cmpAbs1(L) === 0);
      if (big) return [["有 |λ| > 1 → 發散", "warn"]];
      if (!unit.length) return [["全部 |λ| < 1 → Aᵏ → 0", "ok"]];
      if (unit.some((L) => L.n < 0)) return [["λ = −1 → 震盪、無極限", "warn"]];
      return [["λ = 1 留下、其餘 → 0", "ok"], ["→ 收斂", "ok"]];
    }

    const PRESETS = {
      "重根可對角化": ["2 1 -1; -1 4 -1; -2 2 1", 3],
      "相異特徵值": ["-1 1 2; -2 2 2; -5 1 6", 4],
      "缺陷矩陣": ["1 2 -1; -2 5 -1; -2 2 1", 3],
      "2×2 例子": ["4 1; 2 3", 5],
      "分數（收斂）": ["1/2 1/4; 1/2 3/4", 3],
      "遞迴 aₙ₊₂ = aₙ₊₁ + 2aₙ": ["1 2; 1 0", 10],
      "Fibonacci": ["1 1; 1 0", 10],
    };
    const input = ui.input(player, { placeholder: "例如 4 1; 2 3", value: PRESETS["重根可對角化"][0], width: 190 });
    const kIn = ui.input(player, { placeholder: "k", value: "3", width: 54 });
    kIn.setAttribute("aria-label", "次方 k");
    input.setAttribute("aria-label", "矩陣 A");
    const fail = (msg, el) => {
      (el || input).classList.add("is-error"); setTimeout(() => (el || input).classList.remove("is-error"), 700);
      player.load([{ nodes: [], edges: [], labels: [], caption: `${iconHTML("alert")} ${msg}`, line: null }], { autoplay: false });
    };
    const go = (withPower) => {
      const M = parse(input.value);
      if (typeof M === "string") return fail(M);
      let k = null;
      if (withPower) {
        const s = kIn.value.trim();
        if (!/^\d+$/.test(s) || +s > 30) return fail("次方 k 請輸入 0～30 的整數（k = 0 時 A⁰ = I）。", kIn);
        k = +s;
      }
      let frames;
      try { frames = run(M, k); } catch (e) { return fail("計算過程的分子或分母太大，超出精確計算的範圍。請換一個數字小一點的矩陣，或把 k 調小。"); }
      const long = frames.flatMap((f) => f.nodes).map((nd) => nd.label).find((s) => s && s.length > 7);
      if (long) return fail(`計算過程會出現 ${esc(long)} 這種太長的數，格子放不下。請換一個數字小一點的矩陣${withPower ? "，或把 k 調小" : ""}。`, withPower ? kIn : input);
      player.load(frames);
    };
    ui.button(player, "對角化", () => go(false));
    ui.button(player, "算 Aᵏ", () => go(true));
    Object.keys(PRESETS).forEach((key) => ui.button(player, key, () => { input.value = PRESETS[key][0]; kIn.value = String(PRESETS[key][1]); go(true); }, "ghost"));
    input.addEventListener("keydown", (e) => e.key === "Enter" && go(false));
    kIn.addEventListener("keydown", (e) => e.key === "Enter" && go(true));

    const demo = run(parse(PRESETS["重根可對角化"][0]), 3);
    demo[0].caption = iconHTML("play") + " 按播放看示範：這個 3×3 矩陣的 λ = 3 是二重根，但特徵空間有 2 維，所以仍然可以對角化；接著把特徵向量排進 P、驗算 AP = PD，最後用 A³ = P D³ P⁻¹ 算次方。也可以輸入自己的 2×2 或 3×3 矩陣（列用 ; 隔開，可用分數如 1/2）和次方 k，按「對角化」或「算 Aᵏ」。";
    player.load(demo, { autoplay: false });
  });

  // ===================================================================
  // 靜態圖解
  // ===================================================================
  const box = (id, label, x, y, st, w, h) => ({ id, label, shape: "box", x, y, w: w || 44, h: h || 32, state: st || "default" });
  const mat = (k, x0, y0, M, hl, g = 50, gy = 40) => M.flatMap((row, i) => row.map((v, j) => box(k + i + "_" + j, v, x0 + j * g, y0 + i * gy, hl(i, j, v) || (v === "0" ? "muted" : "default"))));

  // 圖 1：AP = PD 逐行看就是 Avⱼ = λⱼvⱼ（A = [4 1; 2 3]）
  figure("diag-columns", () => {
    const colSt = (i, j) => (j === 0 ? "compare" : "found");
    const nodes = []
      .concat(mat("A", 40, 92, [["4", "1"], ["2", "3"]], () => null))
      .concat(mat("P", 170, 92, [["−1", "1"], ["2", "1"]], colSt))
      .concat(mat("Q", 330, 92, [["−1", "1"], ["2", "1"]], colSt))
      .concat(mat("D", 460, 92, [["2", "0"], ["0", "5"]], (i, j) => (i === j ? (j === 0 ? "compare" : "found") : null)))
      .concat(mat("L", 120, 244, [["−2", "5"], ["4", "5"]], colSt))
      .concat(mat("R", 400, 244, [["−2", "5"], ["4", "5"]], colSt));
    return {
      width: 640, height: 340, nodes,
      labels: [
        { id: "tA", x: 65, y: 58, text: "A", cls: "title" }, { id: "tP", x: 195, y: 58, text: "P", cls: "title" },
        { id: "tQ", x: 355, y: 58, text: "P", cls: "title" }, { id: "tD", x: 485, y: 58, text: "D", cls: "title" },
        { id: "e1", x: 270, y: 118, text: "=", cls: "strong" },
        { id: "l1", x: 145, y: 210, text: "AP", cls: "title" }, { id: "l2", x: 425, y: 210, text: "PD", cls: "title" },
        { id: "e2", x: 285, y: 270, text: "=", cls: "strong" },
        { id: "c1", x: 548, y: 92, text: "藍：第 1 行", anchor: "start" },
        { id: "c2", x: 548, y: 116, text: "A·(−1, 2)", anchor: "start" },
        { id: "c3", x: 548, y: 140, text: "= 2·(−1, 2)", anchor: "start", cls: "ok" },
        { id: "c4", x: 548, y: 244, text: "綠：第 2 行", anchor: "start" },
        { id: "c5", x: 548, y: 268, text: "A·(1, 1)", anchor: "start" },
        { id: "c6", x: 548, y: 292, text: "= 5·(1, 1)", anchor: "start", cls: "ok" },
        { id: "n", x: 320, y: 330, text: "AP 的第 j 行 = A·vⱼ；PD 的第 j 行 = λⱼ·vⱼ：兩邊相等就是 n 個 Avⱼ = λⱼvⱼ", anchor: "middle" },
      ],
    };
  });

  // 圖 2：三個 3×3 矩陣，代數重數 vs 幾何重數
  figure("diag-criterion", () => {
    const nodes = [], labels = [];
    const rows = [
      ["相異特徵值 1、2、4", [["1", 1, 1], ["2", 1, 1], ["4", 1, 1]], "ok", "可對角化"],
      ["λ = 3 二重根、E₃ 2 維", [["3", 2, 2], ["1", 1, 1]], "ok", "可對角化"],
      ["λ = 3 二重根、E₃ 只有 1 維", [["3", 2, 1], ["1", 1, 1]], "warn", "不能對角化"],
    ];
    const Y = [70, 170, 270];
    labels.push({ id: "h1", x: 24, y: 24, text: "矩陣", cls: "title", anchor: "start" },
      { id: "h2", x: 250, y: 24, text: "每個 λ：上排代數重數、下排幾何重數（格數）", cls: "title", anchor: "start" });
    rows.forEach(([name, eig, cls, verdict], r) => {
      const y = Y[r];
      labels.push({ id: "nm" + r, x: 24, y: y + 4, text: name, anchor: "start" });
      labels.push({ id: "vd" + r, x: 616, y: y + 4, text: verdict, anchor: "end", cls });
      let x = 260;
      eig.forEach(([L, a, g], t) => {
        labels.push({ id: `l${r}${t}`, x: x + 4, y: y - 26, text: "λ = " + L, anchor: "start" });
        for (let s = 0; s < a; s++) nodes.push(box(`a${r}${t}${s}`, "", x + 14 + s * 30, y - 2, "compare", 24, 18));
        for (let s = 0; s < a; s++) nodes.push(box(`g${r}${t}${s}`, "", x + 14 + s * 30, y + 22, s < g ? "found" : "removed", 24, 18));
        x += a === 2 ? 110 : 80;
      });
    });
    labels.push({ id: "ft", x: 320, y: 336, text: "綠格 = 找得到的獨立特徵向量；紅格 = 缺的。紅格出現就湊不滿 P 的 n 行", anchor: "middle" });
    return { width: 640, height: 350, nodes, labels };
  });

  // 圖 3：Aᵏx = P Dᵏ P⁻¹ x：換到特徵向量座標 → 各自乘 λᵏ → 換回來
  figure("diag-power", () => {
    const nodes = [
      box("x", "x", 70, 80, "default", 90, 40), box("c", "c = P⁻¹x", 320, 80, "compare", 130, 40), box("dc", "Dᵏc", 570, 80, "new", 90, 40),
      box("y", "Aᵏx", 70, 230, "found", 90, 40), box("pd", "P(Dᵏc)", 570, 230, "found", 110, 40),
    ];
    const edges = [
      { from: "x", to: "c", state: "compare", directed: true }, { from: "c", to: "dc", state: "active", directed: true },
      { from: "dc", to: "pd", state: "visited", directed: true }, { from: "pd", to: "y", state: "found", directed: true },
      { from: "x", to: "y", state: "muted", directed: true, dashed: true },
    ];
    const labels = [
      { id: "e1", x: 195, y: 60, text: "P⁻¹：換成特徵向量座標" }, { id: "e2", x: 445, y: 60, text: "Dᵏ：第 j 個座標 × λⱼᵏ" },
      { id: "e3", x: 556, y: 160, text: "P：換回標準座標", anchor: "end" },
      { id: "e4", x: 320, y: 250, text: "同一個結果" },
      { id: "e5", x: 85, y: 160, text: "直接乘 k 次（虛線）", anchor: "start" },
      { id: "n1", x: 320, y: 290, text: "例：A = [4 1; 2 3]、x = (1, 0)：c = P⁻¹x = (−1/3, 2/3)", anchor: "middle", cls: "strong" },
      { id: "n2", x: 320, y: 318, text: "Aᵏx = (−1/3)·2ᵏ·(−1, 2) + (2/3)·5ᵏ·(1, 1)，k 大時 5ᵏ 那一項主導", anchor: "middle" },
    ];
    return { width: 640, height: 340, nodes, edges, labels };
  });
})();
