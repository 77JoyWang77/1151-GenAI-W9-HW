/* =====================================================================
   P, NP, and NP-Completeness（P、NP 與 NP 完備）主題的視覺化
   - sat-verify-vs-solve : 同一個 CNF 公式，先用 certificate 逐子句驗證（多項式），
                           再暴力枚舉 2^n 組指派（指數），比較看過的字面數
   - 靜態圖：p-np-classes（類別關係）、p-np-reduction（歸約的方向）、p-np-is-vc（獨立集與點覆蓋互補）
   ===================================================================== */
(function () {
  "use strict";
  const { Player, Recorder, ui, register, esc, iconHTML, figure } = window.DSViz;

  // 右側程式碼：從 code/algorithms/p-np.c 原封不動取出（verifySAT、bruteSAT）
  const CODE = [
      "int verifySAT(const CNF *f, const int x[]) {",
      "  for (int j = 0; j < f->m; j++) {",
      "    int sat = 0;",
      "    for (int k = 0; k < f->len[j] && !sat; k++) {",
      "      steps++;",
      "      if (litValue(f->lit[j][k], x)) sat = 1;   /* 有一個字面為真，這個子句就滿足 */",
      "    }",
      "    if (!sat) return 0;                           /* 有一個子句全假：這組指派不行 */",
      "  }",
      "  return 1;                                       /* 每個子句都滿足：接受 */",
      "}",
      "",
      "int bruteSAT(const CNF *f, int x[]) {",
      "  for (long mask = 0; mask < (1L << f->n); mask++) {",
      "    for (int i = 1; i <= f->n; i++)",
      "      x[i] = (mask >> (f->n - i)) & 1;",
      "    if (verifySAT(f, x)) return 1;                /* 找到一組可以滿足的指派 */",
      "  }",
      "  return 0;                                       /* 2^n 組全部失敗：不可滿足 */",
      "}"

  ];
  const ln = (s) => CODE.findIndex((l) => l.includes(s)) + 1;
  const L = {
    vHead: ln("int verifySAT("),
    vClause: ln("for (int j = 0; j < f->m; j++)"),
    vLit: [ln("for (int k = 0; k < f->len[j] && !sat; k++)"), ln("if (litValue(f->lit[j][k], x)) sat = 1;")],
    vFail: ln("if (!sat) return 0;"),
    vOk: ln("return 1;                                       /*"),
    bLoop: ln("for (long mask = 0;"),
    bSet: [ln("for (int i = 1; i <= f->n; i++)"), ln("x[i] = (mask >> (f->n - i)) & 1;")],
    bCall: ln("if (verifySAT(f, x)) return 1;"),
    bNone: ln("return 0;                                       /*"),
  };

  // ---------- 公式：clauses = [[+1, -2, 3], ...]，+i 是 x_i、-i 是 ¬x_i ----------
  const litText = (l) => (l < 0 ? "¬" : "") + "x" + Math.abs(l);
  const clauseText = (c) => c.map(litText).join(" ∨ ");
  const formulaText = (cl) => cl.map((c) => "(" + clauseText(c) + ")").join("");
  const litVal = (l, x) => (l > 0 ? x[l] : !x[-l]);
  const bits = (x, n) => Array.from({ length: n }, (_, i) => (x[i + 1] ? "1" : "0")).join("");

  // 回傳 { clauses, n } 或 { err }
  function parse(s) {
    s = s.replace(/\s+/g, "");
    if (!s) return { err: "請輸入公式，例如 (x1|!x2)(!x1|x3)。" };
    const clauses = [];
    const rest = s.replace(/\(([^()]*)\)/g, (_, inner) => { clauses.push(inner); return "&"; });
    if (/[^&∧]/.test(rest)) return { err: "每個子句要用括號包起來，子句之間可以不寫或寫 & 或 ∧，例如 (x1|x2)&(!x1|x3)。" };
    if (clauses.length < 1 || clauses.length > 6) return { err: `子句要 1～6 個（目前 ${clauses.length} 個），畫面最多放得下 6 個。` };
    let n = 0;
    const out = [];
    for (let j = 0; j < clauses.length; j++) {
      const lits = clauses[j].split(/[|∨+]/);
      if (lits.length > 3) return { err: `第 ${j + 1} 個子句有 ${lits.length} 個字面，這裡限制每個子句最多 3 個（3-CNF）。` };
      const c = [];
      for (const t of lits) {
        const m = /^([!~¬-]?)[xX]([1-4])$/.exec(t);
        if (!m) return { err: `看不懂「${esc(t || "（空白）")}」：字面要寫成 x1～x4，否定在前面加 ! 或 ¬，例如 !x2。` };
        const v = +m[2];
        n = Math.max(n, v);
        c.push(m[1] ? -v : v);
      }
      out.push(c);
    }
    return { clauses: out, n };
  }

  register("sat-verify-vs-solve", function (root) {
    const player = new Player(root, {
      title: "Verify vs Solve 驗證與求解",
      width: 680, height: 420, code: CODE, wide: true,
      legend: [["compare", "正在檢查"], ["found", "滿足／找到"], ["removed", "子句全假"], ["muted", "試過、失敗的指派"], ["ghost", "還沒試"], ["active", "certificate"]],
    });

    let cl = [], n = 0;
    const VX = (i) => 340 + (i - (n + 1) / 2) * 110;            // 變數方塊的 x
    const CX = (j) => [120, 340, 560][j % 3], CY = (j) => (j < 3 ? 150 : 222);
    const strip = () => 1 << n;
    const SX = (k) => { const per = Math.min(8, strip()); return 340 + ((k % 8) - (per - 1) / 2) * 80; };
    const SY = (k) => (k < 8 ? 318 : 358);

    // opt: x（目前的指派，可為 null）、vs（變數狀態）、cs（每個子句的狀態陣列）、ss（每組指派的狀態陣列）、info
    function frame(caption, line, opt = {}) {
      const nodes = [], labels = [];
      const x = opt.x;
      labels.push({ id: "tv", x: 24, y: 30, text: opt.vtitle || "指派", cls: "title", anchor: "start" });
      for (let i = 1; i <= n; i++)
        nodes.push({ id: "v" + i, shape: "box", x: VX(i), y: 62, w: 92, h: 38,
          label: "x" + i + " = " + (x ? (x[i] ? "T" : "F") : "?"), state: x ? (opt.vs || "default") : "ghost" });
      labels.push({ id: "tc", x: 24, y: 108, text: "子句（每個子句至少要有一個字面為真）", cls: "title", anchor: "start" });
      cl.forEach((c, j) => nodes.push({ id: "c" + j, shape: "box", x: CX(j), y: CY(j), w: 200, h: 40,
        label: clauseText(c), sub: "C" + (j + 1), state: (opt.cs || [])[j] || "default" }));
      if (!n) return { nodes, labels: [], edges: [], caption, line };
      labels.push({ id: "ts", x: 24, y: 284, text: `暴力枚舉：2^${n} = ${strip()} 組指派（x1 是最高位元）`, cls: "title", anchor: "start" });
      for (let k = 0; k < strip(); k++) {
        const xs = {};
        for (let i = 1; i <= n; i++) xs[i] = (k >> (n - i)) & 1;
        nodes.push({ id: "s" + k, shape: "box", x: SX(k), y: SY(k), w: 68, h: 30, label: bits(xs, n), state: (opt.ss || [])[k] || "ghost" });
      }
      (opt.info || []).forEach((t, k) => labels.push({ id: "in" + k, x: 24 + k * 330, y: 402, text: t[0], cls: t[1] || "", anchor: "start" }));
      return { nodes, labels, edges: [], caption, line };
    }

    // 跑一次 verifySAT，回傳每個子句的結果：{ cs, looked, ok, failAt, why[] }
    function check(x) {
      const cs = [], why = [];
      let looked = 0, failAt = -1;
      for (let j = 0; j < cl.length; j++) {
        const c = cl[j];
        const t = c.findIndex((l) => litVal(l, x));
        looked += t >= 0 ? t + 1 : c.length;
        why.push(t >= 0 ? { lit: c[t], k: t + 1 } : { lit: null, k: c.length });
        if (t < 0) { cs.push("removed"); failAt = j; break; }
        cs.push("found");
      }
      for (let j = cs.length; j < cl.length; j++) cs.push("muted");
      return { cs, looked, ok: failAt < 0, failAt, why };
    }
    const valTxt = (l, x) => `${litText(l)} = ${litVal(l, x) ? "T" : "F"}`;

    function run(clauses, nv, cert) {
      cl = clauses; n = nv;
      const r = new Recorder();
      const ss = Array(strip()).fill("ghost");
      let vLooked = null, vOk = false;
      r.push(frame(`公式 φ = ${esc(formulaText(cl))}，有 n = ${n} 個變數、m = ${cl.length} 個子句。決策問題 SAT 問：「有沒有一組指派讓 φ 為真？」下面先用 certificate <b>驗證</b>，再用暴力法<b>求解</b>，比較兩者看了多少個字面。`, null,
        { info: [["n = " + n + "，m = " + cl.length, "strong"]] }));

      // ---------- 第一部分：驗證 certificate ----------
      if (cert) {
        const x = {};
        for (let i = 1; i <= n; i++) x[i] = cert[i - 1] === "1";
        r.push(frame(`驗證器拿到 certificate <b>${cert}</b>（x1 到 x${n} 的值）。它不用去「找」答案，只要照著這組值把每個子句檢查一遍。`, L.vHead,
          { x, vs: "active", vtitle: "certificate", info: [["驗證：看了 0 個字面", "strong"]] }));
        const res = check(x);
        let looked = 0;
        for (let j = 0; j < cl.length; j++) {
          const w = res.why[j];
          if (!w) break;
          looked += w.k;
          const cs = res.cs.slice(0, j + 1).concat(Array(cl.length - j - 1).fill("default"));
          if (w.lit !== null) {
            cs[j] = "found";
            r.push(frame(`C${j + 1} = (${esc(clauseText(cl[j]))})：看到第 ${w.k} 個字面 ${valTxt(w.lit, x)}，有一個為真就夠了，這個子句滿足，不用再看後面的字面。`, L.vLit,
              { x, vs: "active", vtitle: "certificate", cs, info: [[`驗證：看了 ${looked} 個字面`, "strong"]] }));
          } else {
            cs[j] = "removed";
            r.push(frame(`C${j + 1} = (${esc(clauseText(cl[j]))})：${cl[j].map((l) => valTxt(l, x)).join("、")}，<b>全部為假</b>，這個子句不滿足，驗證器馬上回傳 0（拒絕）。`, L.vFail,
              { x, vs: "active", vtitle: "certificate", cs, info: [[`驗證：看了 ${looked} 個字面`, "strong"]] }));
            break;
          }
        }
        vLooked = res.looked; vOk = res.ok;
        if (res.ok) {
          r.push(frame(`${cl.length} 個子句都滿足，驗證器<b>接受</b>，總共只看了 ${res.looked} 個字面，最多就是公式的長度：這就是「多項式時間可驗證」。`, L.vOk,
            { x, vs: "found", vtitle: "certificate", cs: res.cs, info: [[`驗證：看了 ${res.looked} 個字面`, "ok"]] }));
        } else {
          r.push(frame(`certificate 被<b>拒絕</b>，但這只代表「${cert} 這一組不行」，<b>不代表</b> φ 不可滿足。NP 的定義只要求：答案是 yes 時<b>存在</b>某個 certificate 會被接受。接下來用暴力法看看到底有沒有。`, L.vFail,
            { x, vs: "active", vtitle: "certificate", cs: res.cs, info: [[`驗證：看了 ${res.looked} 個字面（拒絕）`, "warn"]] }));
        }
      }

      // ---------- 第二部分：暴力枚舉 ----------
      let total = 0, found = -1;
      const vInfo = vLooked === null ? [] : [[`驗證：${vLooked} 個字面`]];
      for (let k = 0; k < strip(); k++) {
        const x = {};
        for (let i = 1; i <= n; i++) x[i] = !!((k >> (n - i)) & 1);
        const res = check(x);
        total += res.looked;
        ss[k] = res.ok ? "found" : "compare";
        const info = [[`暴力：試了 ${k + 1} 組、看了 ${total} 個字面`, "strong"]].concat(vInfo);
        if (res.ok) {
          found = k;
          r.push(frame(`試第 ${k + 1} 組 ${bits(x, n)}：把它當成 certificate 交給 verifySAT()，${cl.length} 個子句全部滿足，<b>找到了</b>，回傳 1。前面 ${k} 組都白試了。`, L.bCall,
            { x, vs: "found", vtitle: `第 ${k + 1} 組指派`, cs: res.cs, ss: ss.slice(), info }));
          break;
        }
        const f = res.failAt, bad = cl[f];
        r.push(frame(`試第 ${k + 1} 組 ${bits(x, n)}：每一組都要整個再驗證一次。C${f + 1} = (${esc(clauseText(bad))}) 的字面 ${bad.map((l) => valTxt(l, x)).join("、")} 全假，失敗，換下一組。`, [L.bLoop].concat(L.bSet, [L.bCall]),
          { x, vs: "compare", vtitle: `第 ${k + 1} 組指派`, cs: res.cs, ss: ss.slice(), info }));
        ss[k] = "muted";
      }
      const summary = vLooked === null ? "" : `驗證${vOk ? "" : "（拒絕）"}只看了 ${vLooked} 個字面，暴力看了 ${total} 個，約 ${(total / Math.max(1, vLooked)).toFixed(1)} 倍。`;
      if (found < 0) {
        r.push(frame(`${strip()} 組指派全部失敗，φ <b>不可滿足</b>，回傳 0。要確定答案是 no，暴力法得試完全部 2^${n} 組，而且目前也不知道 no 有沒有簡短的證據（UNSAT 在 co-NP，在不在 NP 未知）。${summary}n 每多 1 個變數，要試的組數就加倍。`, L.bNone,
          { x: null, cs: cl.map(() => "default"), ss: ss.slice(), info: [[`暴力：試完 ${strip()} 組、看了 ${total} 個字面`, "warn"]].concat(vInfo) }));
      } else {
        const x = {};
        for (let i = 1; i <= n; i++) x[i] = !!((found >> (n - i)) & 1);
        r.push(frame(`結論：φ <b>可滿足</b>，${bits(x, n)} 就是一個 certificate。${summary}驗證的工作量跟公式長度成正比（多項式），暴力最壞要乘上 2^${n}（指數）。「好驗證、不知道好不好找」正是 NP 的特徵。`, null,
          { x, vs: "found", vtitle: "找到的指派", cs: cl.map(() => "found"), ss: ss.slice(), info: [[`暴力：試了 ${found + 1} 組、看了 ${total} 個字面`, "ok"]].concat(vInfo) }));
      }
      return r.frames;
    }

    const PRESETS = {
      "4 個變數": ["(¬x1 ∨ x2 ∨ ¬x3)(x1 ∨ ¬x2)(x1 ∨ x3)(x1 ∨ ¬x3)(¬x1 ∨ ¬x2 ∨ ¬x4)(¬x1 ∨ x3)", "1110"],
      "3 個變數": ["(x1 ∨ x2 ∨ x3)(¬x1 ∨ ¬x2)(¬x2 ∨ x3)(x2 ∨ ¬x3)(x1 ∨ ¬x3)", "100"],
      "certificate 給錯": ["(x1 ∨ x2 ∨ x3)(¬x1 ∨ ¬x2)(¬x2 ∨ x3)(x2 ∨ ¬x3)(x1 ∨ ¬x3)", "110"],
      "不可滿足": ["(x1 ∨ x2)(¬x1 ∨ x3)(¬x2 ∨ x3)(¬x3)", "000"],
    };
    const inF = ui.input(player, { placeholder: "公式，例如 (x1|!x2)(!x1|x3)", value: PRESETS["4 個變數"][0], width: 300 });
    const inC = ui.input(player, { placeholder: "certificate，例如 101", value: PRESETS["4 個變數"][1], width: 150 });
    const bad = (el, msg) => {
      el.classList.add("is-error"); setTimeout(() => el.classList.remove("is-error"), 700);
      cl = []; n = 0;
      player.load([frame(`${iconHTML("alert")} ${msg}`, null)], { autoplay: false });
    };
    const go = () => {
      const p = parse(inF.value);
      if (p.err) return bad(inF, p.err);
      let c = inC.value.trim().toUpperCase().replace(/T/g, "1").replace(/F/g, "0");
      if (c && !/^[01]+$/.test(c)) return bad(inC, "certificate 只能用 0／1（或 T／F），依序代表 x1、x2、… 的值；留白就只跑暴力法。");
      if (c && c.length !== p.n) return bad(inC, `公式用到 x1～x${p.n}，certificate 要剛好 ${p.n} 位（目前 ${c.length} 位）；留白就只跑暴力法。`);
      inF.value = formulaText(p.clauses);
      inC.value = c;
      player.load(run(p.clauses, p.n, c));
    };
    ui.button(player, "驗證 vs 暴力", go);
    Object.keys(PRESETS).forEach((k) => ui.button(player, k, () => { [inF.value, inC.value] = PRESETS[k]; go(); }, "ghost"));
    [inF, inC].forEach((el) => el.addEventListener("keydown", (e) => e.key === "Enter" && go()));

    const p0 = parse(PRESETS["4 個變數"][0]);
    const demo = run(p0.clauses, p0.n, PRESETS["4 個變數"][1]);
    demo[0].caption = iconHTML("play") + " 按播放看示範：4 個變數、6 個子句的公式。先拿 certificate 1110 逐子句驗證，只要看 10 個字面；再用暴力法從 0000 開始試，要試到第 15 組才找到。可以輸入自己的公式（! 代表否定、| 代表或），或按「certificate 給錯」「不可滿足」看看驗證器拒絕代表什麼。";
    player.load(demo, { autoplay: false });
  });

  // ===================================================================
  // 靜態圖解
  // ===================================================================
  const box = (id, label, x, y, w, st, h) => ({ id, label, shape: "box", x, y, w, h: h || 32, state: st || "default" });

  // 圖 1：假設 P ≠ NP 時，P、NP、NP-complete、NP-hard 的關係
  figure("p-np-classes", () => {
    const nodes = [], labels = [];
    // 區域：先畫大的，後畫的蓋在上面
    nodes.push(box("rNP", "", 225, 190, 390, "default", 270));       // NP：x 30～420
    nodes.push(box("rH", "", 490, 185, 340, "muted", 290));         // NP-hard：x 320～660
    nodes.push(box("rC", "", 370, 190, 100, "active", 270));        // NPC = 兩者重疊：x 320～420
    nodes.push(box("rP", "", 140, 210, 190, "compare", 190));       // P：在 NP 裡面
    // 區域名稱（小標籤方塊放在區域上緣）
    nodes.push(box("tNP", "NP", 70, 72, 60, "default", 28));
    nodes.push(box("tP", "P", 70, 132, 44, "compare", 28));
    nodes.push(box("tC", "NPC", 370, 72, 64, "active", 28));
    nodes.push(box("tH", "NP-hard", 600, 58, 100, "muted", 28));
    // 例子
    ["最短路徑", "2-SAT", "最小割", "排序"].forEach((t, k) => nodes.push(box("p" + k, t, 140, 168 + k * 36, 120)));
    ["SAT", "3-SAT", "CLIQUE", "HAM-CYCLE", "子集合和"].forEach((t, k) => nodes.push(box("c" + k, t, 370, 120 + k * 42, 92)));
    [["TSP 最佳化", "要的是最短長度，不是 yes/no"], ["最長路徑長度", "要的是數值，不是 yes/no"], ["停機問題", "不可判定，根本不在 NP"]]
      .forEach(([t, sub], k) => nodes.push(Object.assign(box("h" + k, t, 540, 112 + k * 64, 150, "removed"), { sub })));
    labels.push({ id: "t0", x: 20, y: 20, text: "假設 P ≠ NP", cls: "strong", anchor: "start" });
    return { width: 680, height: 345, nodes, labels, edges: [] };
  });

  // 圖 2：A ≤p B 的意思：解 A 的演算法 = 轉換 f + 解 B 的演算法
  figure("p-np-reduction", () => {
    const nodes = [], edges = [], labels = [];
    nodes.push(box("wrap", "", 412, 96, 500, "ghost", 96));
    nodes.push(box("x", "x", 70, 96, 70, "default", 40));
    nodes.push(box("f", "f 多項式轉換", 250, 96, 150, "active", 40));
    nodes.push(box("fx", "f(x)", 410, 96, 80, "default", 40));
    nodes.push(box("B", "解 B", 570, 96, 110, "compare", 40));
    nodes.push(box("ans", "yes / no", 570, 176, 110, "found", 34));
    edges.push({ from: "x", to: "f", directed: true }, { from: "f", to: "fx", directed: true },
      { from: "fx", to: "B", directed: true }, { from: "B", to: "ans", directed: true, state: "found" });
    labels.push({ id: "l0", x: 412, y: 34, text: "解 A 的演算法", cls: "strong" },
      { id: "l1", x: 70, y: 136, text: "A 的輸入" },
      { id: "l2", x: 410, y: 136, text: "B 的輸入" },
      { id: "l3", x: 250, y: 176, text: "x 是 yes ⇔ f(x) 是 yes", cls: "strong" },
      { id: "l4", x: 340, y: 222, text: "A ≤p B：B 至少和 A 一樣難", cls: "strong" },
      { id: "l5", x: 340, y: 248, text: "B ∈ P ⇒ A ∈ P；A 是 NP-hard ⇒ B 是 NP-hard", cls: "ok" },
      { id: "l6", x: 340, y: 272, text: "反過來（A ∈ P ⇒ B ∈ P）推不出來", cls: "warn" });
    return { width: 680, height: 290, nodes, edges, labels };
  });

  // 圖 3：獨立集 S 的補集 V − S 就是點覆蓋
  figure("p-np-is-vc", () => {
    const V = { a: [70, 125], b: [170, 60], c: [170, 190], d: [310, 60], e: [310, 190], f: [410, 125] };
    const S = { a: 1, d: 1 };
    const nodes = Object.entries(V).map(([id, [x, y]]) => ({ id, label: id, x, y, state: S[id] ? "found" : "active" }));
    const edges = ["ab", "ac", "bc", "bd", "ce", "de", "df", "ef"].map((e) => ({ from: e[0], to: e[1] }));
    const labels = [
      { id: "l1", x: 470, y: 50, text: "S = {a, d}：獨立集（綠）", cls: "ok", anchor: "start" },
      { id: "l2", x: 470, y: 80, text: "V − S = {b, c, e, f}：點覆蓋（橘）", anchor: "start" },
      { id: "l3", x: 470, y: 125, text: "每條邊最多 1 個端點在 S 裡", anchor: "start" },
      { id: "l4", x: 470, y: 150, text: "⇔ 至少 1 個端點在 V − S 裡", anchor: "start" },
      { id: "l5", x: 470, y: 195, text: "|S| + |V − S| = n = 6", cls: "strong", anchor: "start" },
    ];
    return { width: 680, height: 240, nodes, edges, labels };
  });
})();
