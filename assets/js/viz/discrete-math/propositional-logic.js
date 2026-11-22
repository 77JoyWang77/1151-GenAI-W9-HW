/* =====================================================================
   Propositional Logic（命題邏輯）主題的視覺化
   - truth-table : 輸入命題公式，逐列填真值表，判斷恆真／矛盾／可滿足；可輸入第二式比較是否等價
   ===================================================================== */
(function () {
  "use strict";
  const { Player, Recorder, ui, register, esc, iconHTML, figure } = window.DSViz;

  // 右側程式碼：從 code/discrete-math/propositional-logic.c 原封不動取出
  const CODE = {
    "eval": [
      "int eval(int k, int row) {",
      "  Node *t = &node[k];",
      "  switch (t->op) {",
      "  case VAR:   return (row >> (nvar - 1 - pos[t->var])) & 1;",
      "  case CONST: return t->var;",
      "  case NOT:   return !eval(t->l, row);",
      "  case AND:   return eval(t->l, row) && eval(t->r, row);",
      "  case XOR:   return eval(t->l, row) != eval(t->r, row);   /* 剛好一個為真 */",
      "  case OR:    return eval(t->l, row) || eval(t->r, row);",
      "  case IMP:   return !eval(t->l, row) || eval(t->r, row);  /* 前提假就為真 */",
      "  case IFF:   return eval(t->l, row) == eval(t->r, row);   /* 真值相同才為真 */",
      "  }",
      "  return 0;",
      "}"
    ],
    "classify": [
      "int classify(int root) {",
      "  int t = 0, rows = 1 << nvar;",
      "  for (int row = rows - 1; row >= 0; row--)     /* 由全 T 到全 F，共 2^n 列 */",
      "    t += eval(root, row);                       /* 數有幾列為真 */",
      "  if (t == rows) return TAUTOLOGY;              /* 每一列都真 */",
      "  if (t == 0) return CONTRADICTION;             /* 每一列都假 */",
      "  return CONTINGENT;                            /* 有真有假：可滿足但不是恆真 */",
      "}"
    ],
    "equivalent": [
      "int equivalent(int a, int b) {                  /* 回傳反例那一列；-1 表示等價 */",
      "  for (int row = (1 << nvar) - 1; row >= 0; row--)",
      "    if (eval(a, row) != eval(b, row)) return row;   /* 這一列兩式真值不同 */",
      "  return -1;                                    /* 每一列都相同：a ≡ b */",
      "}"
    ]
  };

  const CODE_ONE = CODE.eval.concat([""], CODE.classify);
  const CODE_TWO = CODE.eval.concat([""], CODE.equivalent);
  const ln = (code, s) => code.findIndex((l) => l.includes(s)) + 1;

  // ---------------------------------------------------------------
  // 剖析器：和 C 程式相同的優先順序 ~ > & > ^ > | > -> > <->（-> 從右結合）
  // ---------------------------------------------------------------
  const PREC = { iff: 1, imp: 2, or: 3, xor: 4, and: 5, not: 6, var: 7, const: 7 };
  const SYM = { not: "¬", and: " ∧ ", xor: " ⊕ ", or: " ∨ ", imp: " → ", iff: " ↔ " };
  const ASC = { not: "~", and: " & ", xor: " ^ ", or: " | ", imp: " -> ", iff: " <-> " };

  function tokenize(s) {
    const toks = [];
    let i = 0;
    while (i < s.length) {
      const c = s[i];
      if (c === " ") { i++; continue; }
      const two = s.substr(i, 2), three = s.substr(i, 3);
      let t = null, len = 1;
      if (three === "<->") { t = "iff"; len = 3; }
      else if (two === "->") { t = "imp"; len = 2; }
      else if (c === "↔") t = "iff";
      else if (c === "→") t = "imp";
      else if (c === "~" || c === "!" || c === "¬") t = "not";
      else if (c === "&" || c === "∧") t = "and";
      else if (c === "|" || c === "∨") t = "or";
      else if (c === "^" || c === "⊕") t = "xor";
      else if (c === "(" || c === ")") t = c;
      else if ("pqrs".includes(c)) t = "var";
      else if (c === "T" || c === "F") t = "const";
      else {
        let hint = "只能用 p q r s、T F、~ & | ^ -> <-> 和括號";
        if (/[a-z]/.test(c)) hint = `變數只能用 p、q、r、s 四個小寫字母（「${c}」不行）`;
        else if (c === "-" || c === "<") hint = "箭頭要寫成 -> 或 <->";
        else if (c === "+" || c === "*") hint = "且用 &、或用 |，不用 + 和 *";
        throw { pos: i, msg: hint };
      }
      toks.push({ t, v: c, pos: i });
      i += len;
    }
    toks.push({ t: "end", pos: s.length });
    return toks;
  }

  function parse(s) {
    const toks = tokenize(s);
    let k = 0;
    const peek = () => toks[k];
    const fail = (msg) => { throw { pos: peek().pos, msg }; };
    function atom() {
      const t = peek();
      if (t.t === "var") { k++; return { op: "var", v: t.v }; }
      if (t.t === "const") { k++; return { op: "const", v: t.v === "T" }; }
      if (t.t === "(") {
        k++;
        const e = iff();
        if (peek().t !== ")") fail("少了右括號 )");
        k++;
        return e;
      }
      if (t.t === "end") fail("公式還沒結束，這裡需要一個變數或左括號");
      if (t.t === ")") fail("括號裡是空的，或前面少了一個變數");
      fail("這裡需要變數 p q r s、常數 T F 或左括號（運算子兩邊都要有東西）");
    }
    function not() {
      if (peek().t === "not") { k++; return { op: "not", l: not() }; }
      return atom();
    }
    const level = (op, next) => function () {
      let e = next();
      while (peek().t === op) { k++; e = { op, l: e, r: next() }; }
      return e;
    };
    const and = level("and", not), xor = level("xor", and), or = level("or", xor);
    function imp() {
      const e = or();
      if (peek().t === "imp") { k++; return { op: "imp", l: e, r: imp() }; }
      return e;
    }
    const iff = level("iff", imp);
    const e = iff();
    if (peek().t !== "end") fail(peek().t === ")" ? "多了一個右括號 )" : "這裡多出了一個符號（兩個變數之間少了運算子？）");
    return e;
  }

  // 依優先順序只加必要的括號（和 C 的 show() 規則相同）
  function show(e, S) {
    if (e.op === "var") return e.v;
    if (e.op === "const") return e.v ? "T" : "F";
    const p = PREC[e.op];
    if (e.op === "not") {
      const c = show(e.l, S);
      return S.not + (PREC[e.l.op] < p ? "(" + c + ")" : c);
    }
    const pl = PREC[e.l.op], pr = PREC[e.r.op];
    const lp = pl < p || (pl === p && e.op === "imp"), rp = pr <= p;
    const L = show(e.l, S), R = show(e.r, S);
    return (lp ? "(" + L + ")" : L) + S[e.op] + (rp ? "(" + R + ")" : R);
  }

  function evalNode(e, env) {
    switch (e.op) {
      case "var": return env[e.v];
      case "const": return e.v;
      case "not": return !evalNode(e.l, env);
      case "and": return evalNode(e.l, env) && evalNode(e.r, env);
      case "xor": return evalNode(e.l, env) !== evalNode(e.r, env);
      case "or": return evalNode(e.l, env) || evalNode(e.r, env);
      case "imp": return !evalNode(e.l, env) || evalNode(e.r, env);
      case "iff": return evalNode(e.l, env) === evalNode(e.r, env);
    }
    return false;
  }

  function vars(e, set) {
    if (!e) return set;
    if (e.op === "var") set.add(e.v);
    vars(e.l, set); vars(e.r, set);
    return set;
  }

  // 後序列出子式欄（同一個子式只列一次）
  function columns(root) {
    const out = [], seen = {};
    (function walk(e) {
      if (e.op === "var" || e.op === "const") return;
      walk(e.l);
      if (e.r) walk(e.r);
      const key = show(e, ASC);
      if (seen[key] === undefined) { seen[key] = out.length; out.push({ e, key, text: show(e, SYM) }); }
    })(root);
    return out;
  }

  const TF = (b) => (b ? "T" : "F");

  register("truth-table", function (root) {
    const player = new Player(root, {
      title: "Truth Table 真值表",
      width: 600, height: 475, code: CODE_ONE,
      legend: [["active", "代入的變數值"], ["compare", "正在算的子式與它的運算元"], ["new", "剛算出的真值"], ["found", "結果為 T"], ["removed", "兩式不同（反例）"]],
    });

    // 模型
    let V = [], cols = [], rows = 0, cell = {}, two = false, nA = 0, layout = null, full = { A: "", B: "" };
    const X0 = 8, GAP = 6, Y_HEAD = 72;

    function build(A, B) {
      const set = vars(A, new Set());
      if (B) vars(B, set);
      V = ["p", "q", "r", "s"].filter((v) => set.has(v));
      const cA = columns(A), cB = B ? columns(B) : [];
      nA = cA.length;
      two = !!B;
      cols = V.map((v) => ({ kind: "var", v, text: v }))
        .concat(cA.map((c) => Object.assign({ kind: "A" }, c)))
        .concat(cB.map((c) => Object.assign({ kind: "B" }, c)));
      if (two) cols.push({ kind: "cmp", text: "相同？" });
      // 整個公式太長時，欄名改用 A / B，完整公式寫在表格上方
      [["A", V.length + nA - 1], ["B", cols.length - 2]].forEach(([nm, j]) => {
        if (two || (nm === "A" && cols[j] && cols[j].text.length > 12)) cols[j].text = nm;
      });
      full = { A: show(A, SYM), B: B ? show(B, SYM) : "" };
      rows = 1 << V.length;
      // 欄寬依文字長度決定
      let x = X0;
      layout = cols.map((c, i) => {
        const w = c.kind === "var" ? 34 : c.kind === "cmp" ? 62 : Math.max(40, c.text.length * 9.4 + 14);
        const sep = (c.kind === "B" && cols[i - 1].kind !== "B") || c.kind === "cmp" ? 12 : 0;
        x += sep;
        const o = { x: x + w / 2, w };
        x += w + GAP;
        return o;
      });
      const shift = Math.max(0, (600 - (x - GAP) - X0) / 2);   // 表格水平置中
      layout.forEach((o) => (o.x += shift));
      return x;
    }

    const step = () => (rows <= 4 ? 56 : rows <= 8 ? 40 : 21);
    const cy = (r) => Y_HEAD + 46 + r * step();
    const ch = () => (rows <= 4 ? 36 : rows <= 8 ? 30 : 18);
    // 第 r 列（由上往下）的變數值：第一列全 T
    const envOf = (r) => {
      const bits = rows - 1 - r, env = {};
      V.forEach((v, i) => (env[v] = ((bits >> (V.length - 1 - i)) & 1) === 1));
      return env;
    };
    const colIndexOf = (e, kind) => {
      if (e.op === "var") return V.indexOf(e.v);
      if (e.op === "const") return -1;
      const key = show(e, ASC);
      return cols.findIndex((c) => c.kind === kind && c.key === key);
    };

    function frame(caption, line, opt = {}) {
      const st = opt.st || {}, hst = opt.hst || {}, nodes = [], labels = [];
      cols.forEach((c, j) => {
        const L = layout[j];
        nodes.push({ id: "h" + j, label: c.text, shape: "box", x: L.x, y: Y_HEAD, w: L.w, h: 30,
          state: hst[j] || (c.kind === "var" ? "muted" : "default") });
        for (let r = 0; r < rows; r++) {
          const v = cell[r + "," + j];
          nodes.push({ id: `c${r}_${j}`, label: v === undefined ? "" : v, shape: "box", x: L.x, y: cy(r), w: L.w, h: ch(),
            state: st[r + "," + j] || (v === undefined ? "ghost" : "default") });
        }
      });
      if (cols.length) {
        labels.push({ id: "ta", x: X0, y: 14, text: "A：" + full.A, anchor: "start" });
        if (two) labels.push({ id: "tb", x: X0, y: 38, text: "B：" + full.B, anchor: "start" });
      }
      if (opt.info) labels.push({ id: "info", x: 300, y: cy(rows - 1) + ch() / 2 + 20, text: opt.info, cls: opt.infoCls || "strong", anchor: "middle" });
      return { nodes, labels, edges: [], caption, line };
    }

    // 每個運算子的「為什麼」
    function why(c, env) {
      const e = c.e, l = evalNode(e.l, env), res = evalNode(e, env);
      const nm = (x) => esc(show(x, SYM));
      const lt = `${nm(e.l)} = ${TF(l)}`;
      if (e.op === "not") return `${lt}，¬ 把真值反過來，所以 ${nm(e)} = <b>${TF(res)}</b>。`;
      const r = evalNode(e.r, env), rt = `${nm(e.r)} = ${TF(r)}`;
      const head = `${lt}、${rt}：`;
      switch (e.op) {
        case "and": return head + (res ? "兩邊都是 T，∧ 才是 <b>T</b>。" : "至少一邊是 F，∧ 就是 <b>F</b>。");
        case "or": return head + (res ? "至少一邊是 T，∨ 就是 <b>T</b>。" : "兩邊都是 F，∨ 才是 <b>F</b>。");
        case "xor": return head + (res ? "兩邊不同，⊕（互斥或）是 <b>T</b>。" : "兩邊相同，⊕ 是 <b>F</b>（注意和 ∨ 不同：兩邊都 T 時 ⊕ 是 F）。");
        case "imp": return head + (!l ? "前提是 F，不管結論如何，蘊含都<b>為真 T</b>（沒有違反承諾）。" : r ? "前提 T、結論也 T，蘊含為 <b>T</b>。" : "前提 T 結論卻 F，這是蘊含<b>唯一為假</b>的情況：<b>F</b>。");
        case "iff": return head + (res ? "兩邊真值相同，↔ 是 <b>T</b>。" : "兩邊真值不同，↔ 是 <b>F</b>。");
      }
      return "";
    }

    const opLine = (code, op) => ln(code, { not: "case NOT:", and: "case AND:", xor: "case XOR:", or: "case OR:", imp: "case IMP:", iff: "case IFF:" }[op]);

    function run(A, B, srcA, srcB) {
      const width = build(A, B);
      if (width > 594) return null;
      const code = two ? CODE_TWO : CODE_ONE;
      player.setCode(code);
      const L = two
        ? { loop: ln(code, "for (int row = (1 << nvar) - 1"), test: ln(code, "if (eval(a, row) != eval(b, row))"), eq: ln(code, "return -1;") }
        : { loop: ln(code, "for (int row = rows - 1"), count: ln(code, "t += eval(root, row)"), taut: ln(code, "if (t == rows)"), contra: ln(code, "if (t == 0)"), cont: ln(code, "return CONTINGENT") };
      const varLine = ln(code, "case VAR:");
      cell = {};
      const r = new Recorder();
      const fA = esc(show(A, SYM)), fB = B ? esc(show(B, SYM)) : "";
      const nsub = cols.length - V.length - (two ? 1 : 0);
      r.push(frame(`${V.length} 個變數（${V.join("、") || "沒有變數"}）→ 2<sup>${V.length}</sup> = <b>${rows}</b> 列，第一列全 T、最後一列全 F。${two ? `A = ${fA}、B = ${fB}，` : `公式讀成 ${fA}，`}子式欄依<b>運算優先順序</b>由內往外排（先算的在左邊），共 ${nsub} 欄要算。`, L.loop));
      // 步數控制：前 d 列逐欄詳細，後面一次填一列
      const per = 2 + nsub;   // 代入 1 步 + 每個子式 1 步 + 該列結尾 1 步
      let d = rows;
      while (d > 1 && 1 + d * per + (rows - d) + 1 > 40) d--;
      let cntT = 0;
      const diff = [];
      const finalCol = two ? cols.length - 1 : cols.length - 1;
      for (let row = 0; row < rows; row++) {
        const env = envOf(row);
        V.forEach((v, j) => (cell[row + "," + j] = TF(env[v])));
        const vst = {};
        V.forEach((v, j) => (vst[row + "," + j] = "active"));
        const assign = V.map((v) => `${v} = ${TF(env[v])}`).join("、");
        const detail = row < d;
        if (detail) r.push(frame(`第 ${row + 1} 列：代入 ${assign}。`, [two ? L.loop : L.loop, varLine], { st: vst }));
        cols.forEach((c, j) => {
          if (c.kind !== "A" && c.kind !== "B") return;
          cell[row + "," + j] = TF(evalNode(c.e, env));
          if (!detail) return;
          const st = Object.assign({}, vst), hst = { [j]: "compare" };
          [c.e.l, c.e.r].forEach((x) => { if (!x) return; const k = colIndexOf(x, c.kind); if (k >= 0) { st[row + "," + k] = "compare"; hst[k] = "compare"; } });
          st[row + "," + j] = "new";
          r.push(frame(`第 ${row + 1} 列，算 <b>${esc(show(c.e, SYM))}</b>：${why(c, env)}`, opLine(code, c.e.op), { st, hst }));
        });
        if (two) {
          const a = evalNode(A, env), b = evalNode(B, env), same = a === b;
          cell[row + "," + finalCol] = same ? "相同" : "不同";
          if (!same) diff.push(row);
          if (detail) {
            const st = { [row + "," + (V.length + nA - 1)]: "compare", [row + "," + (cols.length - 2)]: "compare", [row + "," + finalCol]: same ? "found" : "removed" };
            r.push(frame(`第 ${row + 1} 列：A = ${TF(a)}、B = ${TF(b)}，${same ? "真值相同，繼續檢查下一列。" : `真值<b>不同</b>，這一列就是<b>反例</b>：${assign}。C 程式在這裡就會 return；動畫繼續填完，讓你看到所有反例。`}`, L.test, { st }));
          } else {
            r.push(frame(`第 ${row + 1} 列：代入 ${assign}，依序算完各子式，A = ${TF(a)}、B = ${TF(b)}，${same ? "相同" : "<b>不同（反例）</b>"}。表格比較大，後面一次填一列。`, L.test, { st: Object.assign(vst, { [row + "," + finalCol]: same ? "found" : "removed" }) }));
          }
        } else {
          const res = evalNode(A, env);
          if (res) cntT++;
          if (detail) {
            r.push(frame(`第 ${row + 1} 列算完：整個公式為 <b>${TF(res)}</b>${res ? "，為真的列數 +1" : ""}，目前 ${cntT} 列為真。`, L.count, { st: { [row + "," + finalCol]: res ? "found" : "default" } }));
          } else {
            r.push(frame(`第 ${row + 1} 列：代入 ${assign}，依序算完各子式，整個公式為 <b>${TF(res)}</b>，目前 ${cntT} 列為真。表格比較大，後面一次填一列。`, L.count, { st: Object.assign(vst, { [row + "," + finalCol]: res ? "found" : "default" }) }));
          }
        }
      }
      // 總結
      const st = {};
      for (let row = 0; row < rows; row++) {
        if (two) st[row + "," + finalCol] = diff.includes(row) ? "removed" : "found";
        else st[row + "," + finalCol] = cell[row + "," + finalCol] === "T" ? "found" : "default";
      }
      if (two) {
        if (!diff.length) r.push(frame(`${rows} 列全部「相同」：A ≡ B，兩式<b>邏輯等價</b>。等於說 A ↔ B 是恆真式。`, L.eq, { st, info: "A ≡ B（邏輯等價）", infoCls: "ok" }));
        else {
          const ex = V.map((v) => `${v} = ${TF(envOf(diff[0])[v])}`).join("、");
          r.push(frame(`有 ${diff.length} 列不同（紅色），所以 A 和 B <b>不等價</b>。只要找到一列反例就夠了，例如 ${ex}。`, L.test, { st, info: `不等價：${diff.length} / ${rows} 列不同`, infoCls: "warn" }));
        }
      } else if (cntT === rows) {
        r.push(frame(`${rows} 列全部為 T：這是<b>恆真式</b>（tautology），不管變數怎麼代都成立。`, L.taut, { st, info: `恆真式：${cntT} / ${rows} 列為真`, infoCls: "ok" }));
      } else if (cntT === 0) {
        r.push(frame(`${rows} 列全部為 F：這是<b>矛盾式</b>（contradiction），找不到任何一組值讓它成立，所以<b>不可滿足</b>。`, L.contra, { st, info: `矛盾式：0 / ${rows} 列為真`, infoCls: "warn" }));
      } else {
        r.push(frame(`${cntT} 列為 T、${rows - cntT} 列為 F：有真有假，是<b>可滿足但非恆真</b>（contingency）。綠色那幾列就是讓公式成立的指派。`, L.cont, { st, info: `可滿足：${cntT} / ${rows} 列為真` }));
      }
      return r.frames;
    }

    // ---------- 控制列 ----------
    const inA = ui.input(player, { placeholder: "公式 A，例如 p -> q", value: "(p -> q) & ~q -> ~p", width: 200 });
    const inB = ui.input(player, { placeholder: "公式 B（可留空）", value: "", width: 160 });
    const bad = (el, msg) => {
      el.classList.add("is-error"); setTimeout(() => el.classList.remove("is-error"), 700);
      V = []; cols = []; rows = 0; cell = {}; two = false;
      player.load([frame(`${iconHTML("alert")} ${msg}`, null)], { autoplay: false });
    };
    function tryParse(el, name) {
      const s = el.value.trim();
      if (!s) { bad(el, `請輸入公式 ${name}，例如 <code>~p | q</code>。`); return null; }
      if (s.length > 40) { bad(el, `公式 ${name} 太長（最多 40 個字元），畫面放不下。`); return null; }
      try { return parse(s); }
      catch (e) {
        if (!e || e.pos === undefined) throw e;
        const where = e.pos >= s.length ? "結尾" : `第 ${e.pos + 1} 個字元`;
        const shown = esc(s.slice(0, e.pos)) + "<b>" + (e.pos < s.length ? esc(s[e.pos]) : "（結尾）") + "</b>" + esc(s.slice(e.pos + 1));
        bad(el, `公式 ${name} ${where}有問題：${esc(e.msg)}。<br><code>${shown}</code>`);
        return null;
      }
    }
    const go = () => {
      const A = tryParse(inA, "A");
      if (!A) return;
      let B = null;
      if (inB.value.trim()) { B = tryParse(inB, "B"); if (!B) return; }
      const f = run(A, B);
      if (!f) return bad(B ? inB : inA, "子式太多，表格寬度超出畫面。請把公式拆短一點（例如先比較其中一部分）。");
      player.load(f);
    };
    ui.button(player, "填真值表", go);
    const PRESETS = {
      "De Morgan": ["~(p & q)", "~p | ~q"],
      "蘊含消去": ["p -> q", "~p | q"],
      "逆否等價": ["p -> q", "~q -> ~p"],
      "逆命題（不等價）": ["p -> q", "q -> p"],
      "矛盾式": ["(p | q) & ~p & ~q", ""],
      "三段論": ["(p -> q) & (q -> r) -> (p -> r)", ""],
    };
    Object.keys(PRESETS).forEach((k) => ui.button(player, k, () => { [inA.value, inB.value] = PRESETS[k]; go(); }, "ghost"));
    [inA, inB].forEach((el) => el.addEventListener("keydown", (e) => e.key === "Enter" && go()));

    const demo = run(parse("(p -> q) & ~q -> ~p"), null);
    demo[0].caption = iconHTML("play") + " 按播放看示範：(p → q) ∧ ¬q → ¬p 有 2 個變數、4 列，每一列先代入 p、q，再照優先順序一欄一欄算子式，最後判斷它是不是恆真式。也可以在第二格輸入公式 B，比較兩式是否等價。";
    player.load(demo, { autoplay: false });
  });

  // ===================================================================
  // 靜態圖解
  // ===================================================================
  const box = (id, label, x, y, w, st, h) => ({ id, label, shape: "box", x, y, w, h: h || 30, state: st || "default" });

  // 圖 1：五個連接詞的真值表，蘊含「前提假就為真」
  figure("propositional-logic-connectives", () => {
    const heads = ["p", "q", "¬p", "p ∧ q", "p ∨ q", "p ⊕ q", "p → q", "p ↔ q"];
    const W = [40, 40, 54, 72, 72, 72, 72, 72];
    const rowsV = [[1, 1], [1, 0], [0, 1], [0, 0]];
    const f = [(p) => !p, (p, q) => p && q, (p, q) => p || q, (p, q) => p !== q, (p, q) => !p || q, (p, q) => p === q];
    const nodes = [], labels = [];
    let x = 30;
    const xs = W.map((w) => { const c = x + w / 2; x += w + 8; return c; });
    heads.forEach((h, j) => nodes.push(box("h" + j, h, xs[j], 34, W[j], j < 2 ? "muted" : j === 6 ? "compare" : "default")));
    rowsV.forEach(([p, q], i) => {
      const y = 78 + i * 40;
      const vals = [p, q].map(Boolean).concat(f.map((fn) => fn(!!p, !!q)));
      vals.forEach((v, j) => {
        let st = "default";
        if (j === 6) st = !p ? "found" : !v ? "active" : "default";
        nodes.push(box(`c${i}_${j}`, v ? "T" : "F", xs[j], y, W[j], st, 28));
      });
    });
    labels.push({ id: "a1", x: xs[7] + 50, y: 118, text: "← 唯一為假：前提 T、結論 F", cls: "warn", anchor: "start" });
    labels.push({ id: "a2", x: xs[7] + 50, y: 178, text: "← 前提 F：一律為 T", cls: "ok", anchor: "start" });
    labels.push({ id: "a3", x: 30, y: 250, text: "∨ 是「可兼或」：兩邊都 T 時仍為 T；⊕ 是「互斥或」：兩邊都 T 時為 F", anchor: "start" });
    return { width: 860, height: 270, nodes, labels, edges: [] };
  });

  // 圖 2：條件句的四種變形
  figure("propositional-logic-variants", () => {
    const nodes = [
      box("o", "p → q（原命題）", 170, 60, 190, "compare", 40),
      box("c", "q → p（逆）", 510, 60, 190, "default", 40),
      box("i", "¬p → ¬q（否）", 170, 220, 190, "default", 40),
      box("k", "¬q → ¬p（逆否）", 510, 220, 190, "compare", 40),
    ];
    const edges = [
      { from: "o", to: "c" }, { from: "o", to: "i" }, { from: "c", to: "k" }, { from: "i", to: "k" },
      { from: "o", to: "k", state: "found" }, { from: "c", to: "i", state: "found" },
    ];
    const labels = [
      { id: "l1", x: 340, y: 44, text: "前後對調", anchor: "middle" },
      { id: "l2", x: 340, y: 238, text: "前後對調", anchor: "middle" },
      { id: "l3", x: 70, y: 140, text: "兩邊都否定", anchor: "middle" },
      { id: "l4", x: 610, y: 140, text: "兩邊都否定", anchor: "middle" },
      { id: "l5", x: 330, y: 290, text: "綠色對角線：等價（≡）", cls: "ok", anchor: "end" },
      { id: "l6", x: 350, y: 290, text: "相鄰的兩個：不等價", cls: "warn", anchor: "start" },
    ];
    return { width: 680, height: 310, nodes, edges, labels };
  });

  // 圖 3：運算優先順序決定的語法樹
  figure("propositional-logic-parse-tree", () => {
    const N = (id, label, x, y, st, sub) => ({ id, label, x, y, r: 22, state: st, sub });
    const nodes = [
      N("imp", "→", 340, 40, "found", "第 4 步"),
      N("or", "∨", 220, 110, "visited", "第 3 步"),
      N("s", "s", 460, 110, "muted"),
      N("p", "p", 130, 180, "muted"),
      N("and", "∧", 310, 180, "visited", "第 2 步"),
      N("q", "q", 240, 250, "muted"),
      N("not", "¬", 380, 250, "visited", "第 1 步"),
      N("r", "r", 380, 320, "muted"),
    ];
    const edges = [["imp", "or"], ["imp", "s"], ["or", "p"], ["or", "and"], ["and", "q"], ["and", "not"], ["not", "r"]].map(([f, t]) => ({ from: f, to: t }));
    const labels = [
      { id: "t1", x: 520, y: 200, text: "p ∨ q ∧ ¬r → s", cls: "strong", anchor: "start" },
      { id: "t2", x: 520, y: 228, text: "讀成 (p ∨ (q ∧ ¬r)) → s", anchor: "start" },
      { id: "t3", x: 520, y: 256, text: "越上面越晚算：→ 優先順序最低", anchor: "start" },
    ];
    return { width: 760, height: 350, nodes, edges, labels };
  });

  // 圖 4：命題公式就是邏輯電路
  figure("propositional-logic-circuit", () => {
    const nodes = [
      box("p", "p", 60, 50, 50, "active"), box("q", "q", 60, 130, 50, "active"), box("r", "r", 60, 210, 50, "active"),
      box("not", "NOT", 200, 130, 70), box("and", "AND", 340, 90, 70), box("or", "OR", 480, 150, 70),
      box("out", "輸出", 620, 150, 70, "found"),
    ];
    const edges = [["p", "and"], ["q", "not"], ["not", "and"], ["and", "or"], ["r", "or"], ["or", "out"]].map(([f, t]) => ({ from: f, to: t, directed: true }));
    const labels = [
      { id: "e1", x: 200, y: 168, text: "¬q", anchor: "middle" },
      { id: "e2", x: 340, y: 128, text: "p ∧ ¬q", anchor: "middle" },
      { id: "e3", x: 480, y: 188, text: "(p ∧ ¬q) ∨ r", anchor: "middle" },
      { id: "e4", x: 360, y: 240, text: "每個連接詞對應一個邏輯閘，T / F 對應高 / 低電位", anchor: "middle" },
    ];
    return { width: 700, height: 260, nodes, edges, labels };
  });
})();
