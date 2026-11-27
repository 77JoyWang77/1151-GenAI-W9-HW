/* =====================================================================
   Linear Recurrence Relations（線性遞迴關係）主題的視覺化
   - rr-solve : 輸入常係數線性遞迴（1～3 階、非齊次項 P(n)·sⁿ）與初始條件，
                逐步列特徵方程式 → 求根 → 齊次通解 → 猜特解 → 解係數 → 閉合式 → 比對前 8 項
   - 靜態圖：rr-no00、rr-hanoi、rr-root-basis
   ===================================================================== */
(function () {
  "use strict";
  const { Player, Recorder, ui, register, esc, iconHTML, figure } = window.DSViz;

  // 右側程式碼：從 code/discrete-math/recurrence-relations.c 原封不動取出
  const CODE_SOLVE = /*CODE:solve*/[
      "int solve(Rec *R) {",
      "  if (!charRoots(R)) return 0;                 /* 1. 特徵方程式的根與重數 */",
      "  for (int t = 0; t < R->nf; t++)              /* 2. 每一種 s^n 各猜一個特解（疊加） */",
      "    particular(R, t);",
      "  solveCoef(R);                                /* 3. 用初始條件解齊次解的係數 */",
      "  return 1;",
      "}"
  ];
  const CODE_PART = /*CODE:particular*/[
      "void particular(Rec *R, int t) {",
      "  Term *T = &R->f[t];",
      "  int m = multiplicity(R, T->s), d = T->d, k = R->k;",
      "  Frac M[MAXV][MAXV], v[MAXV];",
      "  for (int e = 0; e <= d; e++) {              /* 代 n = k, k+1, ..., k+d，得到 d+1 條方程式 */",
      "    long long n = k + e;",
      "    for (int j = 0; j <= d; j++) {            /* q_j 的係數：s^k n^(m+j) − Σ c_i s^(k−i) (n−i)^(m+j) */",
      "      long long coef = ipow(T->s, k) * ipow(n, m + j);",
      "      for (int i = 1; i <= k; i++) coef -= R->c[i] * ipow(T->s, k - i) * ipow(n - i, m + j);",
      "      M[e][j] = F(coef, 1);",
      "    }",
      "    v[e] = F(ipow(T->s, k) * polyAt(T, n), 1);   /* 兩邊同除 s^(n−k) */",
      "  }",
      "  R->pm[t] = m;",
      "  gauss(d + 1, M, v, R->q[t]);",
      "}"
  ];
  const CODE_COEF = /*CODE:solveCoef*/[
      "void solveCoef(Rec *R) {",
      "  Frac M[MAXV][MAXV], v[MAXV];",
      "  for (int n = 0; n < R->k; n++) {",
      "    int col = 0;",
      "    for (int i = 0; i < R->nr; i++)",
      "      for (int e = 0; e < R->mult[i]; e++)    /* m 重根 r 提供 r^n, n r^n, ..., n^(m-1) r^n */",
      "        M[n][col++] = F(ipow(n, e) * ipow(R->root[i], n), 1);",
      "    v[n] = fsub(F(R->init[n], 1), partAt(R, n));",
      "  }",
      "  gauss(R->k, M, v, R->A);",
      "}"
  ];
  const CODE_VERIFY = /*CODE:verify*/[
      "int verify(const Rec *R, int N) {",
      "  long long a[40];",
      "  recurTerms(R, a, N);",
      "  for (int n = 0; n < N; n++) {",
      "    Frac c = closedAt(R, n);",
      "    if (c.q != 1 || c.p != a[n]) return 0;",
      "  }",
      "  return 1;",
      "}"
  ];
  const CODE = [].concat(CODE_SOLVE, [""], CODE_PART, [""], CODE_COEF, [""], CODE_VERIFY);
  const ln = (s, after = 0) => CODE.findIndex((l, k) => k >= after && l.includes(s)) + 1;
  const L = {
    roots: ln("if (!charRoots(R)) return 0;"),
    partCall: ln("particular(R, t);"),
    mult: ln("int m = multiplicity(R, T->s)"),
    partEq: [ln("for (int e = 0; e <= d; e++)"), ln("long long coef = ipow(T->s, k)")],
    partGauss: ln("gauss(d + 1, M, v, R->q[t]);"),
    coefCall: ln("solveCoef(R);"),
    basis: ln("m 重根 r 提供"),
    rhs: ln("v[n] = fsub(F(R->init[n], 1), partAt(R, n));"),
    coefGauss: ln("gauss(R->k, M, v, R->A);"),
    ret: ln("return 1;"),
    vRec: ln("recurTerms(R, a, N);"),
    vCmp: [ln("Frac c = closedAt(R, n);"), ln("if (c.q != 1 || c.p != a[n]) return 0;")],
    vOk: ln("return 1;", ln("Frac c = closedAt(R, n);")),
  };

  // ---------- 分數（BigInt，避免溢位） ----------
  const gcd = (a, b) => { a = a < 0n ? -a : a; b = b < 0n ? -b : b; while (b) [a, b] = [b, a % b]; return a; };
  function Fr(p, q = 1n) {
    p = BigInt(p); q = BigInt(q);
    if (q < 0n) { p = -p; q = -q; }
    const g = gcd(p, q) || 1n;
    return { p: p / g, q: q / g };
  }
  const fadd = (a, b) => Fr(a.p * b.q + b.p * a.q, a.q * b.q);
  const fsub = (a, b) => Fr(a.p * b.q - b.p * a.q, a.q * b.q);
  const fmul = (a, b) => Fr(a.p * b.p, a.q * b.q);
  const fdiv = (a, b) => Fr(a.p * b.q, a.q * b.p);
  const fnum = (a) => Number(a.p) / Number(a.q);
  const isZero = (a) => a.p === 0n;
  const MINUS = "−";
  const istr = (v) => (v < 0 ? MINUS + String(-v) : String(v));          // BigInt 或 Number
  const fstr = (a) => (a.q === 1n ? istr(a.p) : istr(a.p) + "/" + a.q);
  const fabs = (a) => Fr(a.p < 0n ? -a.p : a.p, a.q);
  const pw = (b, e) => BigInt(b) ** BigInt(e);

  function gauss(M, v) {                       // 解 M x = v，回傳 Frac 陣列或 null
    const n = v.length;
    M = M.map((r) => r.slice()); v = v.slice();
    for (let col = 0; col < n; col++) {
      let piv = col;
      while (piv < n && isZero(M[piv][col])) piv++;
      if (piv === n) return null;
      [M[col], M[piv]] = [M[piv], M[col]]; [v[col], v[piv]] = [v[piv], v[col]];
      for (let i = 0; i < n; i++) {
        if (i === col || isZero(M[i][col])) continue;
        const r = fdiv(M[i][col], M[col][col]);
        for (let j = 0; j < n; j++) M[i][j] = fsub(M[i][j], fmul(r, M[col][j]));
        v[i] = fsub(v[i], fmul(r, v[col]));
      }
    }
    return v.map((x, i) => fdiv(x, M[i][i]));
  }

  // ---------- 顯示用的字串 ----------
  const SUP = { 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵" };
  const npart = (e) => (e === 0 ? "" : e === 1 ? "n" : "n" + SUP[e]);
  const bpart = (r) => (r === 1 ? "" : r > 0 ? r + "ⁿ" : "(" + MINUS + (-r) + ")ⁿ");
  const hb = (r) => (r === 1 ? "" : r > 0 ? `${r}<sup>n</sup>` : `(${MINUS}${-r})<sup>n</sup>`);
  const hn = (e) => (e === 0 ? "" : e === 1 ? "n" : `n<sup>${e}</sup>`);
  // 一個單項式的絕對值部分：係數 |c|、n 的次方、底數
  function mono(cAbs, e, base, html) {
    const np = html ? hn(e) : npart(e), bp = html ? hb(base) : bpart(base);
    let s = "";
    const cs = fstr(cAbs);
    if (cs !== "1" || (!np && !bp)) s = cAbs.q !== 1n && (np || bp) ? `(${cs})` : cs;
    s += np;
    if (bp) s = s ? s + "·" + bp : bp;
    return s;
  }
  // 多項式 Σ coef[e] n^e（Frac 陣列）乘上 base^n；asc = 由低次到高次
  function polyTerms(coef, base, html, asc) {
    const out = [];
    const idx = coef.map((_, e) => e);
    (asc ? idx : idx.reverse()).forEach((e) => { if (coef[e] && !isZero(coef[e])) out.push({ neg: coef[e].p < 0n, s: mono(fabs(coef[e]), e, base, html) }); });
    return out;
  }
  const joinTerms = (ts) => ts.length ? ts.map((t, i) => (i === 0 ? (t.neg ? MINUS : "") + t.s : (t.neg ? " " + MINUS + " " : " + ") + t.s)).join("") : "0";
  // 依底數分組的整個式子：base 1 的放最後、由高次到低次；其他底數的多項式括起來
  function groupedStr(groups, html) {
    const ts = [];
    groups.filter((g) => g.base !== 1).forEach((g) => {
      const t = polyTerms(g.coef, 1, html, true);
      if (!t.length) return;
      const bp = html ? hb(g.base) : bpart(g.base);
      if (t.length === 1) ts.push(polyTerms(g.coef, g.base, html, true)[0]);
      else ts.push({ neg: false, s: "(" + joinTerms(t) + ")·" + bp });
    });
    groups.filter((g) => g.base === 1).forEach((g) => polyTerms(g.coef, 1, html, false).forEach((t) => ts.push(t)));
    return joinTerms(ts);
  }
  function linStr(coefs, names) {              // 一次式：Σ coefs[j]·names[j]（BigInt 係數）
    const ts = [];
    coefs.forEach((c, j) => {
      if (c === 0n) return;
      const a = c < 0n ? -c : c;
      ts.push({ neg: c < 0n, s: (a === 1n ? "" : String(a)) + names[j] });
    });
    return joinTerms(ts);
  }
  function sqf(N) {                            // N = t²·m，m 無平方因子
    let t = 1, m = N;
    for (let d = 2; d * d <= m; d++) while (m % (d * d) === 0) { m /= d * d; t *= d; }
    return [t, m];
  }
  function surdStr(u, w, m) {                  // u + w√m（u、w 是 Frac）
    if (isZero(w)) return fstr(u);
    const wa = fabs(w);
    let ws = (wa.p === 1n ? "" : String(wa.p)) + "√" + m + (wa.q === 1n ? "" : "/" + wa.q);
    if (isZero(u)) return (w.p < 0n ? MINUS : "") + ws;
    return fstr(u) + (w.p < 0n ? " " + MINUS + " " : " + ") + ws;
  }
  const fmtNum = (v) => {                      // 表格裡的數字（BigInt 或 Number）
    const x = Number(v);
    if (Math.abs(x) >= 1e6) return (x < 0 ? MINUS : "") + Math.abs(x).toExponential(2).replace("e+", "e");
    return istr(typeof v === "bigint" ? v : Math.round(x));
  };

  // ---------- 解析輸入 ----------
  function parseInts(str, lo, hi) {
    const parts = str.trim().split(/[\s,，、]+/).filter(Boolean);
    const out = [];
    for (const p of parts) {
      const v = Number(p.replace(MINUS, "-"));
      if (!Number.isInteger(v) || v < lo || v > hi) return null;
      out.push(v);
    }
    return out;
  }
  // f(n)：每一項寫成 係數·n^k·s^n，例如 2n+7、5*4^n、n*2^n、3^n-1
  function parseF(str) {
    let s = str.replace(/\s|·/g, "").replace(/−/g, "-").replace(/\*\*/g, "^").replace(/×/g, "*");
    if (s === "" || s === "0") return { groups: [] };
    const terms = [];
    let cur = "", depth = 0;
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (ch === "(") depth++;
      if (ch === ")") depth--;
      if ((ch === "+" || ch === "-") && depth === 0 && i > 0 && s[i - 1] !== "^" && s[i - 1] !== "(") { terms.push(cur); cur = ch; }
      else cur += ch;
    }
    terms.push(cur);
    const map = new Map();
    for (let t of terms) {
      let sign = 1;
      if (t[0] === "+") t = t.slice(1); else if (t[0] === "-") { sign = -1; t = t.slice(1); }
      const m = /^(\d+(?=\*|n|$))?\*?(n(?:\^(\d))?)?\*?(?:\((-?\d+)\)\^n|(\d+)\^n)?$/.exec(t);
      if (!t || !m || (!m[1] && !m[2] && !m[4] && !m[5])) return { err: `看不懂「${esc(t || str)}」。每一項請寫成 係數·n^k·s^n，例如 2n+7、5*4^n、n*2^n、(-1)^n。` };
      const c = m[1] ? Number(m[1]) : 1, e = m[2] ? (m[3] ? Number(m[3]) : 1) : 0, b = m[4] ? Number(m[4]) : m[5] ? Number(m[5]) : 1;
      if (e > 2) return { err: "f(n) 的多項式最多 2 次（n^2）。" };
      if (b === 0 || Math.abs(b) > 9) return { err: "f(n) 的底數 s 請用 −9～9 之間、不是 0 的整數。" };
      if (c > 999) return { err: "f(n) 的係數請在 999 以內。" };
      if (!map.has(b)) map.set(b, [0, 0, 0]);
      map.get(b)[e] += sign * c;
    }
    const groups = [];
    map.forEach((P, s2) => { if (P.some((x) => x !== 0)) { let d = 2; while (d > 0 && P[d] === 0) d--; groups.push({ s: s2, P, d }); } });
    if (groups.length > 2) return { err: "f(n) 最多兩種不同的底數 sⁿ（例如 2^n+3^n）。" };
    return { groups };
  }

  // ---------- 求解（和 C 程式同樣的步驟） ----------
  function charPoly(c) {                       // 回傳係數陣列 poly[i] 為 r^(k-i)
    return [1].concat(c.map((x) => -x));
  }
  const polyAt = (poly, r) => poly.reduce((acc, x) => acc * r + x, 0);
  function charPolyStr(c) {
    const k = c.length, ts = [{ neg: false, s: "r" + (k > 1 ? SUP[k] : "") }];
    c.forEach((x, i) => { if (x === 0) return; const e = k - 1 - i, a = Math.abs(x); ts.push({ neg: x > 0, s: (a === 1 && e > 0 ? "" : String(a)) + (e === 0 ? "" : e === 1 ? "r" : "r" + SUP[e]) }); });
    return joinTerms(ts) + " = 0";
  }
  function recStr(c, groups, html) {
    const ts = c.map((x, i) => ({ x, s: `a(n${MINUS}${i + 1})` })).filter((t) => t.x !== 0)
      .map((t) => ({ neg: t.x < 0, s: (Math.abs(t.x) === 1 ? "" : Math.abs(t.x)) + t.s }));
    let s = joinTerms(ts);
    if (groups.length) {
      const f = groupedStr(groups.map((g) => ({ base: g.s, coef: g.P.map((x) => Fr(x)) })), html);
      s += f.startsWith(MINUS) ? " " + MINUS + " " + f.slice(1) : " + " + f;
    }
    return "a(n) = " + s;
  }

  function analyze(c, init, groups) {
    const k = c.length, S = { k, c, init, groups, tested: [] };
    // 1. 特徵根
    if (k === 1) { S.kind = "int"; S.roots = [{ r: c[0], m: 1 }]; }
    else if (k === 2) {
      const D = c[0] * c[0] + 4 * c[1];
      S.D = D;
      const s = Math.round(Math.sqrt(Math.abs(D)));
      if (D >= 0 && s * s === D) {
        S.kind = "int";
        S.roots = D === 0 ? [{ r: c[0] / 2, m: 2 }] : [{ r: (c[0] + s) / 2, m: 1 }, { r: (c[0] - s) / 2, m: 1 }];
      } else S.kind = D > 0 ? "irr" : "cpx";
    } else {
      let poly = charPoly(c), deg = k;
      const ck = Math.abs(c[k - 1]);
      S.roots = [];
      for (let r = -ck; r <= ck && deg > 0; r++) {
        if (r === 0 || ck % r !== 0) continue;
        S.tested.push({ r, v: polyAt(charPoly(c), r) });
        let m = 0;
        for (;;) {
          const b = []; let acc = 0;
          for (let i = 0; i <= deg; i++) { acc = acc * r + poly[i]; b.push(acc); }
          if (acc !== 0) break;
          poly = b.slice(0, deg); deg--; m++;
          if (deg === 0) break;
        }
        if (m) S.roots.push({ r, m });
      }
      S.kind = deg === 0 ? "int" : "fail3";
      S.rest = poly;
    }
    if (S.kind === "fail3") return S;
    const multOf = (s) => (S.kind === "int" ? (S.roots.find((x) => x.r === s) || { m: 0 }).m : 0);
    // 2. 特解：每一組 P(n)·s^n 猜 n^m (q0 + q1 n + ... ) s^n
    S.parts = groups.map((g, t) => {
      const m = multOf(g.s), d = g.d, M = [], v = [], eqs = [];
      for (let e = 0; e <= d; e++) {
        const n = k + e, row = [];
        for (let j = 0; j <= d; j++) {
          let coef = pw(g.s, k) * pw(n, m + j);
          for (let i = 1; i <= k; i++) coef -= BigInt(c[i - 1]) * pw(g.s, k - i) * pw(n - i, m + j);
          row.push(coef);
        }
        const rhs = pw(g.s, k) * (BigInt(g.P[0]) + BigInt(g.P[1]) * BigInt(n) + BigInt(g.P[2]) * BigInt(n * n));
        M.push(row.map((x) => Fr(x))); v.push(Fr(rhs));
        eqs.push({ n, row, rhs });
      }
      const q = gauss(M, v);
      return { s: g.s, d, m, P: g.P, q, eqs, names: t === 0 ? ["u", "v", "w"] : ["x", "y", "z"] };
    });
    const partAt = (n) => {
      let sum = Fr(0);
      S.parts.forEach((p) => p.q.forEach((qj, j) => { sum = fadd(sum, fmul(qj, Fr(pw(n, p.m + j) * pw(p.s, n)))); }));
      return sum;
    };
    S.partAt = partAt;
    S.b = init.map((a, n) => fsub(Fr(a), partAt(n)));           // 初始條件扣掉特解
    // 3. 齊次解係數
    if (S.kind === "int") {
      const M = [], cols = [];
      S.roots.forEach((rt) => { for (let e = 0; e < rt.m; e++) cols.push({ e, r: rt.r }); });
      for (let n = 0; n < k; n++) M.push(cols.map((cl) => Fr(pw(n, cl.e) * pw(cl.r, n))));
      S.cols = cols; S.M = M;
      S.A = gauss(M, S.b);
      S.closedAt = (n) => {
        let sum = partAt(n);
        cols.forEach((cl, i) => { sum = fadd(sum, fmul(S.A[i], Fr(pw(n, cl.e) * pw(cl.r, n)))); });
        return { exact: sum };
      };
    } else if (S.kind === "irr") {
      const [t, m] = sqf(S.D), g = Math.abs(Number(gcd(gcd(BigInt(c[0]), BigInt(t)), 2n))) || 1;
      const a = c[0] / g, bb = t / g, den = 2 / g;
      const rs = (sg) => { const core = (a === 0 ? "" : istr(a) + (sg > 0 ? " + " : " " + MINUS + " ")) + (a === 0 && sg < 0 ? MINUS : "") + (bb === 1 ? "" : bb) + "√" + m; return den === 1 ? core : "(" + core + ")/" + den; };
      S.rootStr = [rs(1), rs(-1)];
      S.m = m;
      const u = fdiv(S.b[0], Fr(2)), w = fmul(fdiv(fsub(fmul(Fr(2), S.b[1]), fmul(Fr(c[0]), S.b[0])), Fr(2 * S.D)), Fr(t));
      S.Astr = surdStr(u, w, m); S.Bstr = surdStr(u, Fr(-w.p, w.q), m);
      const An = fnum(u) + fnum(w) * Math.sqrt(m), Bn = fnum(u) - fnum(w) * Math.sqrt(m);
      const r1 = (c[0] + Math.sqrt(S.D)) / 2, r2 = (c[0] - Math.sqrt(S.D)) / 2;
      S.closedAt = (n) => ({ num: An * Math.pow(r1, n) + Bn * Math.pow(r2, n) + fnum(partAt(n)) });
    } else {
      const negD = -S.D, rho2 = -c[1], [t1, m1] = sqf(rho2), [t2, m2] = sqf(negD);
      S.rhoStr = m1 === 1 ? String(t1) : (t1 === 1 ? "" : t1) + "√" + m1;
      const g = Math.abs(Number(gcd(gcd(BigInt(c[0]), BigInt(t2)), 2n))) || 1;
      const re = c[0] / g, im = t2 / g, den = 2 / g;
      const imS = (im === 1 ? "" : im) + (m2 === 1 ? "" : "√" + m2) + "i";
      const imS2 = imS === "i" && m2 === 1 ? "i" : imS;
      S.rootStr = [1, -1].map((sg) => { const core = (re === 0 ? "" : istr(re) + (sg > 0 ? " + " : " " + MINUS + " ")) + (re === 0 && sg < 0 ? MINUS : "") + (imS2 === "1i" ? "i" : imS2); return den === 1 ? core : "(" + core + ")/" + den; });
      const rho = Math.sqrt(rho2), th = Math.acos(c[0] / (2 * rho)), deg = (th * 180) / Math.PI;
      S.thStr = Math.abs(deg - Math.round(deg)) < 1e-9 ? Math.round(deg) + "°" : "≈ " + deg.toFixed(2) + "°";
      S.Aval = S.b[0];
      const wB = fdiv(fsub(fmul(Fr(2), S.b[1]), fmul(Fr(c[0]), S.b[0])), Fr(negD));   // B = wB·√(−D)
      S.Bstr = surdStr(Fr(0), fmul(wB, Fr(t2)), m2);
      if (m2 === 1) S.Bstr = fstr(fmul(wB, Fr(t2)));
      const An = fnum(S.b[0]), Bn = fnum(wB) * Math.sqrt(negD);
      S.closedAt = (n) => ({ num: Math.pow(rho, n) * (An * Math.cos(n * th) + Bn * Math.sin(n * th)) + fnum(partAt(n)) });
    }
    // 4. 遞迴直接算前 8 項
    S.a = [];
    for (let n = 0; n < 8; n++) {
      if (n < k) { S.a.push(BigInt(init[n])); continue; }
      let v = groups.reduce((acc, g) => acc + (BigInt(g.P[0]) + BigInt(g.P[1]) * BigInt(n) + BigInt(g.P[2]) * BigInt(n * n)) * pw(g.s, n), 0n);
      for (let i = 1; i <= k; i++) v += BigInt(c[i - 1]) * S.a[n - i];
      S.a.push(v);
    }
    return S;
  }

  // 閉合式字串（整數根）
  function closedStr(S, html) {
    const byBase = new Map();
    const add = (base, e, f) => {
      if (!byBase.has(base)) byBase.set(base, []);
      const arr = byBase.get(base);
      while (arr.length <= e) arr.push(Fr(0));
      arr[e] = fadd(arr[e], f);
    };
    S.cols.forEach((cl, i) => add(cl.r, cl.e, S.A[i]));
    S.parts.forEach((p) => p.q.forEach((qj, j) => add(p.s, p.m + j, qj)));
    const groups = [];
    byBase.forEach((coef, base) => groups.push({ base, coef }));
    return groupedStr(groups, html);
  }
  const LET = ["A", "B", "C"];
  // 係數字串（可能含根號）乘上一個式子；係數為 0 回傳 null
  function coefTerm(cs, body) {
    if (cs === "0") return null;
    const neg = cs.startsWith(MINUS) && !/ [+−] /.test(cs), a = neg ? cs.slice(1) : cs;
    if (a === "1") return { neg, s: body };
    return { neg, s: (/[ /√]/.test(a) ? `(${a})` : a) + "·" + body };
  }
  const plusStr = (s) => (!s ? "" : s.startsWith(MINUS) ? " " + MINUS + " " + s.slice(1) : " + " + s);
  function homoStr(S) {
    if (S.kind === "irr") return `A·(${S.rootStr[0]})ⁿ + B·(${S.rootStr[1]})ⁿ`;
    if (S.kind === "cpx") return (S.rhoStr === "1" ? "" : `(${S.rhoStr})ⁿ·`) + "(A·cos nθ + B·sin nθ)";
    let li = 0;
    return S.roots.map((rt) => {
      const ps = [];
      for (let e = 0; e < rt.m; e++) ps.push(LET[li++] + npart(e));
      const inner = ps.join(" + ");
      if (rt.r === 1) return rt.m > 1 ? inner : inner;
      return (rt.m > 1 ? "(" + inner + ")" : inner) + "·" + bpart(rt.r);
    }).join(" + ");
  }
  function guessStr(p) {
    const nm = p.names, inner = [nm[0], nm[1] + "n", nm[2] + "n²"].slice(0, p.d + 1).join(" + ");
    let s = p.d > 0 ? "(" + inner + ")" : inner;
    if (p.m) s += "·" + npart(p.m);
    if (p.s !== 1) s += "·" + bpart(p.s);
    return s;
  }
  function partValStr(p) {
    const coef = [];
    p.q.forEach((qj, j) => { while (coef.length <= p.m + j) coef.push(Fr(0)); coef[p.m + j] = qj; });
    return groupedStr([{ base: p.s, coef }], false);
  }
  const fTermStr = (p) => groupedStr([{ base: p.s, coef: p.P.map((x) => Fr(x)) }], false);
  const fTermHtml = (p) => groupedStr([{ base: p.s, coef: p.P.map((x) => Fr(x)) }], true);

  // ===================================================================
  register("rr-solve", function (root) {
    const W = 680, H = 458;
    const player = new Player(root, {
      title: "Solving Linear Recurrences 解線性遞迴", width: W, height: H, code: CODE, wide: true,
      legend: [["active", "正在做的步驟"], ["found", "完成的步驟／比對一致"], ["compare", "相異根"], ["new", "重根"], ["visited", "共軛複根／無理根"], ["removed", "比對不一致"]],
    });

    const ROWS = ["特徵方程式", "特徵根", "齊次通解", "特解", "通解", "解係數", "閉合式"];
    const RY = [78, 112, 146, 180, 236, 270, 304];       // 特解佔兩行（180、202）
    const TX = 140, CW = 62, CX = (j) => 168 + j * 66, TY = [360, 394, 428];

    let S = null;
    function frame(caption, line, o = {}) {
      const nodes = [], labels = [], edges = [];
      labels.push({ id: "rec", x: 20, y: 22, text: o.rec || "", cls: "strong", anchor: "start" });
      labels.push({ id: "ini", x: 20, y: 46, text: o.ini || "", anchor: "start" });
      const step = o.step == null ? -1 : o.step;
      ROWS.forEach((name, i) => {
        if (o.fail && i > 1) return;
        nodes.push({ id: "row" + i, label: name, shape: "box", x: 70, y: RY[i], w: 104, h: 28, state: i < step ? "found" : i === step ? "active" : "ghost" });
        const txt = (o.text || [])[i];
        if (!txt || i === 1) return;
        const wide = [...txt].reduce((w, ch) => w + (ch.charCodeAt(0) > 0x2e80 ? 15 : i === 6 ? 9.2 : 7.4), 0) > W - TX - 12;
        const cut = wide ? txt.lastIndexOf(" + ", Math.ceil(txt.length / 2) + 6) : -1;
        if (cut > 0) {
          labels.push({ id: "t" + i, x: TX, y: RY[i] - (i === 6 ? 0 : 9), text: txt.slice(0, cut), cls: i === 6 ? "strong" : "", anchor: "start" });
          labels.push({ id: "t" + i + "b", x: TX + 20, y: RY[i] + (i === 6 ? 22 : 9), text: txt.slice(cut + 1), cls: i === 6 ? "strong" : "", anchor: "start" });
        } else labels.push({ id: "t" + i, x: TX, y: RY[i], text: txt, cls: i === 6 ? "strong" : "", anchor: "start" });
      });
      (o.text3b ? [o.text3b] : []).forEach((t) => labels.push({ id: "t3b", x: TX, y: 202, text: t, anchor: "start" }));
      if (o.warn) labels.push({ id: "warn", x: W - 16, y: o.warnY || 202, text: o.warn, cls: "warn", anchor: "end" });
      (o.roots || []).forEach((rt, i) => nodes.push({ id: "root" + i, label: rt.label, shape: "box", x: TX + 60 + i * 132, y: RY[1], w: 124, h: 26, state: rt.state }));
      if (o.rootNote) labels.push({ id: "rnote", x: TX + 60 + (o.roots || []).length * 132 - 54, y: RY[1], text: o.rootNote, anchor: "start" });
      if (o.table) {
        labels.push({ id: "th0", x: 92, y: TY[0], text: "n", cls: "title" }, { id: "th1", x: 92, y: TY[1], text: "遞迴算", cls: "title" }, { id: "th2", x: 92, y: TY[2], text: "閉合式", cls: "title" });
        for (let j = 0; j < 8; j++) {
          nodes.push({ id: "h" + j, label: String(j), shape: "box", x: CX(j), y: TY[0], w: CW, h: 26, state: "muted" });
          const t = o.table[j] || {};
          nodes.push({ id: "a" + j, label: t.a == null ? "" : t.a, shape: "box", x: CX(j), y: TY[1], w: CW, h: 28, state: t.a == null ? "ghost" : t.sa || "default" });
          nodes.push({ id: "z" + j, label: t.z == null ? "" : t.z, shape: "box", x: CX(j), y: TY[2], w: CW, h: 28, state: t.z == null ? "ghost" : t.sz || "default" });
        }
      }
      return { nodes, edges, labels, caption, line };
    }

    function rootBoxes(S2, st) {
      if (S2.kind === "int") return S2.roots.map((rt) => ({ label: "r = " + istr(rt.r) + (rt.m > 1 ? `（${rt.m} 重）` : ""), state: st || (rt.m > 1 ? "new" : "compare") }));
      return S2.rootStr.map((s) => ({ label: s, state: st || "visited" }));
    }

    function run(c, init, groups) {
      S = analyze(c, init, groups);
      const k = c.length, r = new Recorder();
      const rec = recStr(c, groups, false);
      const ini = "初始條件：" + init.map((a, n) => `a(${n}) = ${istr(a)}`).join("、");
      const base = { rec, ini };
      const text = [];
      const F = (cap, line, o) => r.push(frame(cap, line, Object.assign({}, base, { text: text.slice() }, o)));
      F(`${k} 階常係數線性${groups.length ? "<b>非齊次</b>" : "<b>齊次</b>"}遞迴：每一項由前 ${k} 項的固定倍數${groups.length ? "再加上 f(n)" : "相加"}得到。解法分兩半：先解<b>齊次部分</b>（拿掉 f(n)），${groups.length ? "再找一個<b>特解</b>，" : ""}最後用 ${k} 個初始條件定出係數。`, null, { step: -1 });

      // 1. 特徵方程式
      const cp = charPolyStr(c);
      text[0] = cp;
      F(`猜齊次部分的解長得像 a(n) = r<sup>n</sup>：代進 ${recStr(c, [], false)}，兩邊同除 r<sup>n${MINUS}${k}</sup>，得到<b>特徵方程式</b> ${esc(cp)}。每個根 r 都讓 r<sup>n</sup> 滿足齊次遞迴。`, L.roots, { step: 0 });

      // 2. 根
      if (S.kind === "fail3") {
        const tl = S.tested.map((t) => `p(${istr(t.r)}) = ${istr(t.v)}`).join("、");
        F(`${iconHTML("alert")} 有理根定理：整數根一定整除常數項 ${istr(-c[k - 1])}。逐一代入：${tl}。${S.roots.length ? "只找到 " + S.roots.map((x) => istr(x.r)).join("、") + "，" : ""}剩下的因式沒有整數根（可能是無理根或複根）。這個動畫的 3 階只處理<b>整數根</b>，請換一組係數，例如按「3 階例」。`, L.roots, { step: 1, fail: true, roots: S.roots.map((x) => ({ label: "r = " + istr(x.r), state: "compare" })) });
        return r.frames;
      }
      let why;
      if (k === 1) why = `1 階的特徵方程式只有一個根 r = ${istr(c[0])}，齊次解就是 A·${hb(c[0]) || "1"}，也就是一直乘 ${istr(c[0])} 的等比數列。`;
      else if (k === 2) {
        const D = S.D, sq = Math.round(Math.sqrt(Math.abs(D)));
        if (S.kind === "int" && D === 0) why = `判別式 D = c<sub>1</sub><sup>2</sup> + 4c<sub>2</sub> = ${istr(c[0])}<sup>2</sup> + 4·(${istr(c[1])}) = 0，是<b>重根</b> r = ${istr(c[0])}/2 = ${istr(S.roots[0].r)}（2 重）。重根只給出一個 r<sup>n</sup>，少了一個解，下一步要補 n·r<sup>n</sup>。`;
        else if (S.kind === "int") why = `判別式 D = ${istr(c[0])}<sup>2</sup> + 4·(${istr(c[1])}) = ${D} = ${sq}<sup>2</sup> 是完全平方數，兩個<b>相異整數根</b> r = (${istr(c[0])} ± ${sq})/2 = ${istr(S.roots[0].r)}、${istr(S.roots[1].r)}。`;
        else if (S.kind === "irr") why = `判別式 D = ${istr(c[0])}<sup>2</sup> + 4·(${istr(c[1])}) = ${D} 不是完全平方數，兩個<b>相異無理根</b> ${esc(S.rootStr[0])}、${esc(S.rootStr[1])}。做法和相異整數根完全一樣，只是係數會帶根號。`;
        else why = `判別式 D = ${istr(c[0])}<sup>2</sup> + 4·(${istr(c[1])}) = ${istr(D)} &lt; 0，是一對<b>共軛複根</b> ${esc(S.rootStr[0])}、${esc(S.rootStr[1])}。寫成極式：模長 ρ = √(${MINUS}c<sub>2</sub>) = ${esc(S.rhoStr)}，幅角 θ ${S.thStr.startsWith("≈") ? S.thStr : "= " + S.thStr}。`;
      } else {
        const tl = S.tested.map((t) => `p(${istr(t.r)}) = ${istr(t.v)}`).join("、");
        const rep = S.roots.filter((x) => x.m > 1);
        why = `3 階不好直接解，用<b>有理根定理</b>：首項係數是 1，整數根一定整除常數項 ${istr(-c[2])}。代入候選：${tl}，等於 0 的就是根；再用綜合除法降次，${rep.length ? `r = ${istr(rep[0].r)} 能連續整除 ${rep[0].m} 次，是 ${rep[0].m} 重根` : "三個根都是單根"}。`;
      }
      F(why, L.roots, { step: 1, roots: rootBoxes(S) });

      // 3. 齊次通解
      text[2] = "a(n)⁽ʰ⁾ = " + homoStr(S);
      let whyH;
      if (S.kind === "int") {
        const rep = S.roots.filter((x) => x.m > 1);
        whyH = `每個根提供基本解：單根 r 給 r<sup>n</sup>；${rep.length ? `m 重根給 r<sup>n</sup>、n·r<sup>n</sup>、…、n<sup>m−1</sup>·r<sup>n</sup>，所以 r = ${istr(rep[0].r)} 給 ${rep[0].m} 個` : "這裡全是單根"}。合計剛好 ${k} 個，對應 ${k} 個待定係數 ${LET.slice(0, k).join("、")}，留給初始條件決定。`;
      } else if (S.kind === "irr") whyH = `兩個相異根各給一個 r<sup>n</sup>，係數 A、B 留給初始條件決定。根是無理數也沒關係，最後算出來的 a(n) 一樣是整數。`;
      else whyH = `共軛複根 ρe<sup>±iθ</sup> 的兩個解 (ρe<sup>iθ</sup>)<sup>n</sup>、(ρe<sup>−iθ</sup>)<sup>n</sup> 用 Euler 公式重新組合，換成實數的 ρ<sup>n</sup>cos nθ 和 ρ<sup>n</sup>sin nθ，係數 A、B 就都是實數。`;
      F(whyH, L.basis, { step: 2, roots: rootBoxes(S) });

      // 4. 特解
      if (!S.parts.length) {
        text[3] = "齊次（f(n) = 0）：不需要特解";
        F(`這是齊次遞迴，f(n) = 0，不需要特解，通解就是齊次通解。`, L.partCall, { step: 3, roots: rootBoxes(S) });
      } else {
        const done = [];
        S.parts.forEach((p, t) => {
          const fs = fTermStr(p), deg = p.d;
          const polyWord = deg === 0 ? "常數" : deg + " 次多項式";
          const guess = guessStr(p);
          const resH = p.m > 0;
          const lineTxt = `${fs} → 猜 ${guess}`;
          const show = done.concat([lineTxt]);
          const whyP = `f(n) 的${S.parts.length > 1 ? `第 ${t + 1} 項` : "這一項"}是 ${fTermHtml(p)}：多項式部分是 ${polyWord}，底數 s = ${istr(p.s)}${p.s === 1 ? "（純多項式）" : ""}。` +
            (resH ? `s = ${istr(p.s)} <b>剛好是 ${p.m} 重特徵根</b>：直接猜 ${esc(guessStr(Object.assign({}, p, { m: 0 })))} 的話，${p.d === 0 ? "它本身就是齊次解" : "其中最低次的那一項本身就是齊次解"}，代進去左邊${p.d === 0 ? "會變成 0" : "會被消掉一部分、係數不夠用"}，湊不出 f(n)${p.m > 1 ? `；乘 n 還是齊次解（${p.m} 重根），要一直乘到 n<sup>${p.m}</sup>` : ""}。所以<b>乘 n<sup>${p.m}</sup></b>，猜 ${esc(guess)}。`
              : `s = ${istr(p.s)} 不是特徵根，直接猜同樣形式（${deg === 0 ? "常數" : "同次多項式"}${p.s === 1 ? "" : "·" + hb(p.s)}），猜 ${esc(guess)}。`);
          F(whyP, L.mult, { step: 3, roots: rootBoxes(S), text: textWith(text, 3, show[0]), text3b: show[1], warn: resH ? `s = ${istr(p.s)} 是 ${p.m} 重根 → 乘 n${p.m > 1 ? SUP[p.m] : ""}` : "", warnY: t === 0 ? 180 : 202 });
          const eqs = p.eqs.map((e) => `${linStr(e.row, p.names.slice(0, deg + 1))} = ${istr(e.rhs)}`).join("；");
          const sol = p.q.map((q, j) => `${p.names[j]} = ${fstr(q)}`).join("、");
          const res = `${fs} → ${guess} → ${partValStr(p)}`;
          done.push(res);
          F(`把猜測代進遞迴${p.s === 1 ? "" : "，兩邊同除 " + hb(p.s).replace("<sup>n</sup>", `<sup>n−${k}</sup>`)}。等式要對所有 n 都成立，${deg === 0 ? `代 n = ${p.eqs[0].n} 就夠：${esc(eqs)}` : `代 n = ${p.eqs.map((e) => e.n).join("、")} 列出 ${deg + 1} 條方程式：${esc(eqs)}`}${deg === 0 && p.eqs[0].row[0] === 1n ? "" : `，解出 <b>${esc(sol)}</b>`}，特解這一部分是 ${esc(partValStr(p))}。`, L.partGauss, { step: 3, roots: rootBoxes(S), text: textWith(text, 3, done[0]), text3b: done[1] });
        });
        text[3] = done[0]; text.t3b = done[1];
      }

      // 5. 通解
      const partSum = S.parts.length ? S.parts.map(partValStr).map((s, i) => (i === 0 ? s : s.startsWith(MINUS) ? " " + MINUS + " " + s.slice(1) : " + " + s)).join("") : "";
      text[4] = "a(n) = " + homoStr(S) + (partSum ? (partSum.startsWith(MINUS) ? " " + MINUS + " " + partSum.slice(1) : " + " + partSum) : "");
      F(`<b>通解 = 齊次通解 + 特解</b>。特解只要找到一個就好；兩個特解相減會是齊次解，差別會被 ${LET.slice(0, k).join("、")} 吸收。現在用初始條件定出 ${LET.slice(0, k).join("、")}。`, L.coefCall, { step: 4, roots: rootBoxes(S), text3b: text.t3b });

      // 6. 解係數
      const names = LET.slice(0, k);
      const pv = init.map((_, n) => S.partAt(n));
      let eqTxt, solTxt;
      if (S.kind === "int") {
        eqTxt = S.M.map((row, n) => `${linStr(row.map((x) => x.p), names)} = ${fstr(S.b[n])}`).join("；");
        solTxt = S.A.map((x, i) => `${names[i]} = ${fstr(x)}`).join("、");
      } else if (S.kind === "irr") {
        eqTxt = `A + B = ${fstr(S.b[0])}；A·r₁ + B·r₂ = ${fstr(S.b[1])}`;
        solTxt = `A = ${S.Astr}、B = ${S.Bstr}`;
      } else {
        eqTxt = `A = ${fstr(S.b[0])}；${esc(S.rhoStr)}·(A cos θ + B sin θ) = ${fstr(S.b[1])}`;
        solTxt = `A = ${fstr(S.Aval)}、B = ${S.Bstr}`;
      }
      text[5] = eqTxt;
      const subP = S.parts.length ? `先把特解在 n = ${init.map((_, n) => n).join("、")} 的值（${pv.map(fstr).join("、")}）移到右邊，` : "";
      F(`代 n = ${init.map((_, n) => n).join("、")} 進通解，要等於初始條件 ${init.map((a, n) => `a(${n}) = ${istr(a)}`).join("、")}。${subP}得到 ${k} 元一次聯立方程式：${esc(eqTxt)}。`, L.rhs, { step: 5, roots: rootBoxes(S), text3b: text.t3b });
      text[5] = solTxt;
      F(`解聯立得 <b>${esc(solTxt)}</b>。${S.kind === "irr" ? "根號會在每一項的 a(n) 中互相抵消。" : ""}`, L.coefGauss, { step: 5, roots: rootBoxes(S), text3b: text.t3b });

      // 7. 閉合式
      let cf;
      if (S.kind === "int") cf = closedStr(S, false);
      else if (S.kind === "irr") cf = joinTerms([coefTerm(S.Astr, `(${S.rootStr[0]})ⁿ`), coefTerm(S.Bstr, `(${S.rootStr[1]})ⁿ`)].filter(Boolean)) + plusStr(partSum);
      else {
        const inner = joinTerms([coefTerm(fstr(S.Aval), "cos nθ"), coefTerm(S.Bstr, "sin nθ")].filter(Boolean));
        cf = (S.rhoStr === "1" ? "" : `(${S.rhoStr})ⁿ·`) + `(${inner})` + plusStr(partSum) + `，θ ${S.thStr.startsWith("≈") ? S.thStr : "= " + S.thStr}`;
      }
      text[6] = "a(n) = " + cf;
      F(`得到<b>閉合式</b> a(n) = ${S.kind === "int" ? closedStr(S, true) : esc(cf)}。不要急著寫答案：最後一步用前幾項驗算，任何一步算錯都會在這裡露餡。`, L.ret, { step: 6, roots: rootBoxes(S), text3b: text.t3b });

      // 8. 比對前 8 項
      const table = [];
      let allOk = true;
      for (let n = 0; n < 8; n++) {
        const z = S.closedAt(n);
        const av = S.a[n];
        let zs, ok;
        if (z.exact) { ok = z.exact.q === 1n && z.exact.p === av; zs = z.exact.q === 1n ? fmtNum(z.exact.p) : fstr(z.exact); }
        else { ok = Math.abs(z.num - Number(av)) <= 1e-6 * Math.max(1, Math.abs(Number(av))); zs = ok ? fmtNum(Math.round(z.num)) : z.num.toFixed(2); }
        allOk = allOk && ok;
        table[n] = { a: fmtNum(av), z: zs, sa: ok ? "found" : "removed", sz: ok ? "found" : "removed" };
        let how;
        if (n < k) how = `a(${n}) = ${istr(av)} 是初始條件`;
        else {
          const parts = joinTerms(c.map((x, i) => (x === 0 ? null : { neg: x < 0, s: `${Math.abs(x)}·${istr(S.a[n - i - 1]).replace(/^−(.*)$/, "(−$1)")}` })).filter(Boolean));
          const fv = groups.reduce((acc, g) => acc + (BigInt(g.P[0]) + BigInt(g.P[1]) * BigInt(n) + BigInt(g.P[2]) * BigInt(n * n)) * pw(g.s, n), 0n);
          how = `遞迴：a(${n}) = ${parts}${groups.length ? ` + f(${n})（= ${istr(fv)}）` : ""} = ${istr(av)}`;
        }
        const tb = table.map((x, j) => (j === n ? Object.assign({}, x, { sa: ok ? "active" : "removed", sz: ok ? "active" : "removed" }) : x));
        F(`n = ${n}：${how}；閉合式代 n = ${n} 得 ${zs}${z.exact ? "" : `（浮點數 ${z.num.toFixed(6)}，四捨五入）`}，${ok ? "<b>一致</b>" : "<b>不一致</b>"}。`, n < k ? L.vRec : L.vCmp, { step: 7, roots: rootBoxes(S), text3b: text.t3b, table: tb });
      }
      F(allOk ? `前 8 項全部一致，閉合式正確。${n0k(k)}${S.kind === "int" ? "" : "根不是整數時用浮點數代，會有很小的誤差，所以要四捨五入後再比。"}` : `${iconHTML("alert")} 有項目不一致，請檢查。`, L.vOk, { step: 7, roots: rootBoxes(S), text3b: text.t3b, table });
      return r.frames;
    }
    const n0k = (k) => `前 ${k} 項是初始條件，閉合式本來就是照它們解的，一定對；<b>真正有檢查力的是 n ≥ ${k} 的項</b>，考試時至少代一項驗算。`;
    function textWith(text, i, v) { const t = text.slice(); t[i] = v; return t; }

    // ---------- 控制列 ----------
    const inC = ui.input(player, { placeholder: "係數 c1,c2", value: "1, 1", width: 96 });
    const inF = ui.input(player, { placeholder: "f(n)", value: "0", width: 104 });
    const inI = ui.input(player, { placeholder: "初始 a0,a1", value: "0, 1", width: 96 });
    [[inC, "係數 c1, c2（3 階再加 c3）"], [inF, "非齊次項 f(n)，例如 2n+7、5*4^n、n*2^n；齊次填 0"], [inI, "初始條件 a(0), a(1)（3 階再加 a(2)）"]].forEach(([el, t]) => {
      el.title = t; el.setAttribute("aria-label", t);
      el.addEventListener("keydown", (e) => e.key === "Enter" && go());
    });
    const bad = (el, msg) => {
      el.classList.add("is-error"); setTimeout(() => el.classList.remove("is-error"), 700);
      player.load([frame(`${iconHTML("alert")} ${msg}`, null, { rec: "", ini: "" })], { autoplay: false });
    };
    function go() {
      const c = parseInts(inC.value, -12, 12);
      if (!c || c.length < 1 || c.length > 3) return bad(inC, "係數請輸入 1～3 個 −12～12 的整數，用逗號分隔。例如 1, 1 代表 a(n) = a(n−1) + a(n−2)。");
      if (c[c.length - 1] === 0) return bad(inC, "最後一個係數不能是 0（否則階數其實比較低），例如 3 階的 c3 要不是 0。");
      const f = parseF(inF.value);
      if (f.err) return bad(inF, f.err);
      const init = parseInts(inI.value, -9999, 9999);
      if (!init || init.length !== c.length) return bad(inI, `${c.length} 階遞迴需要剛好 ${c.length} 個初始條件 a(0)${c.length > 1 ? "～a(" + (c.length - 1) + ")" : ""}，每個是 −9999～9999 的整數，用逗號分隔。`);
      const S2 = analyze(c, init, f.groups);
      if (S2.a && S2.a.some((v) => (v < 0n ? -v : v) > 10n ** 12n)) return bad(inC, "前 8 項的數字太大（超過 10¹²），表格放不下，請把係數或初始條件改小一點。");
      player.load(run(c, init, f.groups));
    }
    ui.button(player, "求解", go);
    const PRESETS = [
      ["Fibonacci", "1, 1", "0", "0, 1"],
      ["重根例", "4, -4", "0", "3, 4"],
      ["非齊次多項式", "5, -6", "2n + 7", "10, 15"],
      ["指數與根重複", "3, 4", "5*4^n", "3, 23"],
      ["3 階例", "2, 1, -2", "0", "3, 2, 6"],
    ];
    PRESETS.forEach(([name, cc, ff, ii]) => ui.button(player, name, () => { inC.value = cc; inF.value = ff; inI.value = ii; go(); }, "ghost"));

    const demo = run([3, 4], [3, 23], parseF("5*4^n").groups);
    inC.value = "3, 4"; inF.value = "5*4^n"; inI.value = "3, 23";
    demo[0].caption = iconHTML("play") + " 按播放看示範：a(n) = 3a(n−1) + 4a(n−2) + 5·4<sup>n</sup>，非齊次項的底數 4 剛好是特徵根，特解要乘 n。也可以在上方輸入係數（c1, c2[, c3]）、f(n)（例如 2n+7、5*4^n、n*2^n，0 表示齊次）和初始條件，或按快捷按鈕。";
    player.load(demo, { autoplay: false });
  });

  // ===================================================================
  // 靜態圖解
  // ===================================================================
  const box = (id, label, x, y, w, st, h) => ({ id, label, shape: "box", x, y, w, h: h || 34, state: st || "default" });

  // 圖 1：不含 00 的二進位字串，依最後一個字元分類
  figure("rr-no00", () => {
    const nodes = [], labels = [], edges = [];
    labels.push({ id: "t", x: 20, y: 22, text: "長度 n、不含連續 00 的字串，看最後面", cls: "title", anchor: "start" });
    // 結尾 1
    nodes.push(box("a1", "長度 n−1 的合法字串（任意）", 186, 66, 290, "compare"), box("a2", "1", 366, 66, 46, "found"));
    labels.push({ id: "la", x: 410, y: 66, text: "結尾是 1：前面隨便接 → a(n−1) 種", anchor: "start" });
    // 結尾 0
    nodes.push(box("b1", "長度 n−2 的合法字串", 162, 120, 244, "compare"), box("b2", "1", 310, 120, 46, "active"), box("b3", "0", 366, 120, 46, "found"));
    labels.push({ id: "lb", x: 410, y: 120, text: "結尾是 0：前一個一定是 1 → a(n−2) 種", anchor: "start" });
    // 不合法
    nodes.push(box("c1", "……", 216, 174, 136, "muted"), box("c2", "0", 310, 174, 46, "removed"), box("c3", "0", 366, 174, 46, "removed"));
    labels.push({ id: "lc", x: 410, y: 174, text: "結尾 00：不合法，不算", cls: "warn", anchor: "start" });
    labels.push({ id: "res", x: 340, y: 222, text: "a(n) = a(n−1) + a(n−2)，a(1) = 2、a(2) = 3", cls: "strong" });
    return { width: 680, height: 244, nodes, edges, labels };
  });

  // 圖 2：河內塔的三個階段
  figure("rr-hanoi", () => {
    const nodes = [], labels = [], edges = [];
    const panels = [["開始", 0, 0], ["上面 n−1 個移到 B", 1, 0], ["最大的移到 C", 1, 2], ["n−1 個疊到 C", 2, 2]];
    const steps = ["", "H(n−1) 步", "1 步", "H(n−1) 步"];
    panels.forEach(([title, small, big], p) => {
      const ox = 14 + p * 166;
      ["A", "B", "C"].forEach((peg, i) => {
        const x = ox + 26 + i * 54;
        labels.push({ id: `pg${p}${i}`, x, y: 156, text: peg, cls: "title" });
      });
      const px = (i) => ox + 26 + i * 54;
      const bigY = 126, smallY = big === small ? 100 : 122;
      nodes.push(box(`big${p}`, "最大", px(big), bigY, 50, p === 2 ? "active" : "default", 20));
      nodes.push(box(`sm${p}`, "n−1", px(small), big === small ? smallY : 116, 44, p === 1 || p === 3 ? "active" : "compare", big === small ? 30 : 32));
      labels.push({ id: `tt${p}`, x: ox + 80, y: 36, text: title, cls: "strong" });
      if (steps[p]) labels.push({ id: `st${p}`, x: ox + 80, y: 186, text: steps[p], cls: "ok" });
      if (p > 0) labels.push({ id: `ar${p}`, x: ox - 4, y: 110, text: "→", cls: "strong" });
    });
    labels.push({ id: "res", x: 340, y: 222, text: "H(n) = 2H(n−1) + 1，H(1) = 1 → H(n) = 2ⁿ − 1", cls: "strong" });
    return { width: 680, height: 244, nodes, edges, labels };
  });

  // 圖 3：根的種類 → 齊次解的基本解
  figure("rr-root-basis", () => {
    const nodes = [], labels = [], edges = [];
    const cols = [
      ["相異根 r₁ ≠ r₂", "compare", "A·r₁ⁿ + B·r₂ⁿ", "例：r = 3, 2 → A·3ⁿ + B·2ⁿ"],
      ["重根 r（2 重）", "new", "(A + Bn)·rⁿ", "例：r = 2 → (A + Bn)·2ⁿ"],
      ["共軛複根 ρe^(±iθ)", "visited", "ρⁿ(A cos nθ + B sin nθ)", "例：1 ± i → (√2)ⁿ(…45°…)"],
    ];
    cols.forEach(([t, st, f, ex], i) => {
      const x = 116 + i * 224;
      nodes.push(box("k" + i, t, x, 50, 200, st, 36), box("f" + i, f, x, 140, 214, "found", 40));
      edges.push({ from: "k" + i, to: "f" + i, directed: true, state: "default" });
      labels.push({ id: "e" + i, x, y: 190, text: ex });
    });
    labels.push({ id: "n", x: 340, y: 226, text: "k 階一定剛好 k 個基本解；m 重根要給 rⁿ, n·rⁿ, …, n^(m−1)·rⁿ 共 m 個", cls: "warn" });
    return { width: 680, height: 246, nodes, edges, labels };
  });
})();
