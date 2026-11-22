/* =====================================================================
   Master Theorem（主定理）主題的視覺化
   - master-tree : 輸入 a、b、f(n) = n^k lg^p n，逐層畫遞迴樹與每層成本，最後判斷 case
   ===================================================================== */
(function () {
  "use strict";
  const { Player, Recorder, ui, register, esc, iconHTML, figure } = window.DSViz;

  // 右側程式碼：從 code/algorithms/master-theorem.c 原封不動取出
  const CODE = {
    "recursionTree": [
      "double recursionTree(int a, int b, double k, int p, int L) {",
      "  double n = pow(b, L), total = 0;",
      "  for (int i = 0; i < L; i++) {",
      "    double nodes = pow(a, i);              /* 第 i 層的節點數 */",
      "    double size = n / pow(b, i);           /* 每個子問題的大小 */",
      "    double level = nodes * f(size, k, p);  /* 這一層的總成本 */",
      "    printf(\"  第 %d 層：%g 個 × f(%g) = %g\\n\", i, nodes, size, level);",
      "    total += level;",
      "  }",
      "  double leaves = pow(a, L);               /* a^L = n^(log_b a) 片葉子，每片 T(1) = 1 */",
      "  printf(\"  葉子：%g 個 × T(1) = %g\\n\", leaves, leaves);",
      "  return total + leaves;",
      "}"
    ],
    "masterCase": [
      "int masterCase(int a, int b, double k, int p) {",
      "  double e = critExp(a, b);",
      "  if (k < e - EPS) {                       /* f 比 n^e 小了一個多項式倍：葉子主導 */",
      "    printf(\"case 1：T(n) = Θ(n^%.3f)\\n\", e);",
      "    return 1;",
      "  }",
      "  if (k > e + EPS) {                       /* f 比 n^e 大了一個多項式倍：樹根主導 */",
      "    double c = a / pow(b, k);              /* 正則條件：a·f(n/b) ≤ c·f(n)，c = a / b^k < 1 */",
      "    printf(\"case 3（c = %.3f < 1）：T(n) = Θ(n^%g lg^%d n)\\n\", c, k, p);",
      "    return 3;",
      "  }",
      "  if (p >= 0) {                            /* 同階：每層差不多一樣大，再乘上層數 lg n */",
      "    printf(\"case 2：T(n) = Θ(n^%.3f lg^%d n)\\n\", e, p + 1);",
      "    return 2;",
      "  }",
      "  printf(\"不能套用：f = n^%.3f / lg^%d n 落在 case 1 和 case 2 之間\\n\", e, -p);",
      "  return 0;",
      "}"
    ]
  };

  const ALL = CODE.recursionTree.concat([""], CODE.masterCase);
  const ln = (s, after = 0) => ALL.findIndex((l, k) => k >= after && l.includes(s)) + 1;
  const MC = ALL.findIndex((l) => l.startsWith("int masterCase")) ;   // masterCase 在 ALL 中的起點（0-based）
  const L = {
    n: ln("double n = pow(b, L)"),
    loop: ln("for (int i = 0; i < L; i++)"),
    nodes: ln("double nodes = pow(a, i)"),
    size: ln("double size = n / pow(b, i)"),
    level: ln("double level = nodes * f(size, k, p)"),
    total: ln("total += level;"),
    leaves: ln("double leaves = pow(a, L)"),
    ret: ln("return total + leaves;"),
    e: ln("double e = critExp(a, b);", MC),
    c1: [ln("if (k < e - EPS)", MC), ln("case 1：", MC)],
    c3: [ln("if (k > e + EPS)", MC), ln("case 3（", MC)],
    reg: ln("double c = a / pow(b, k);", MC),
    c2: [ln("if (p >= 0)", MC), ln("case 2：", MC)],
    gap: ln("不能套用", MC),
  };

  const EPS = 1e-9;
  const lg = Math.log2;
  const fval = (n, k, p) => Math.pow(n, k) * Math.pow(lg(n), p);
  const SUP = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "-": "⁻" };
  function fmt(v) {
    if (Math.abs(v - Math.round(v)) < 1e-9 && Math.abs(v) < 1e6) return String(Math.round(v));
    if (Math.abs(v) >= 1e6) {
      const ex = Math.floor(Math.log10(Math.abs(v))), m = v / Math.pow(10, ex);
      return m.toFixed(2) + "×10" + String(ex).split("").map((c) => SUP[c]).join("");
    }
    return v >= 100 ? v.toFixed(1) : v.toFixed(2);
  }
  const num = (x) => (Math.abs(x - Math.round(x)) < 1e-9 ? String(Math.round(x)) : x.toFixed(3).replace(/0+$/, ""));
  // 文字版（SVG）與 HTML 版的 n^x lg^q n
  function term(e, q, html) {
    const pw = (base, x) => html ? `${base}<sup>${x}</sup>` : `${base}^${x}`;
    const np = Math.abs(e) < EPS ? "" : Math.abs(e - 1) < EPS ? "n" : pw("n", num(e));
    const lgq = (x) => x === 1 ? "lg n" : pw("lg", x) + " n";
    if (q > 0) return (np ? np + " " : "") + lgq(q);
    if (q < 0) return (np || "1") + " / " + lgq(-q);
    return np || "1";
  }

  // 依 a、b、k、p 判斷 case，回傳 { kind, e, r, ans, why }
  function decide(a, b, k, p) {
    const e = Math.log(a) / Math.log(b), r = a / Math.pow(b, k);
    if (k < e - EPS) return { kind: 1, e, r, ans: term(e, 0, true) };
    if (k > e + EPS) return { kind: 3, e, r, ans: term(k, p, true) };
    if (p >= 0) return { kind: 2, e, r, ans: term(e, p + 1, true) };
    return { kind: 0, e, r, ans: p === -1 ? term(e, 0, true).replace(/^1$/, "") + " lg lg n" : term(e, 0, true) };
  }

  register("master-tree", function (root) {
    const W = 680, H = 450, LV = 5;           // n = b^5：0～4 層是內部節點，第 5 層是葉子
    const player = new Player(root, {
      title: "Recursion Tree 遞迴樹與主定理",
      width: W, height: H, code: ALL,
      legend: [["compare", "正在算的這一層"], ["found", "主導總成本的層"], ["active", "比較 f(n) 與 n^(log_b a)"], ["muted", "其他層"]],
    });
    const rowY = (i) => 86 + i * 50;
    const BAR0 = 486, BARW = 120;

    let A, B, K, P, rows = [], maxLv = 1;
    function frame(caption, line, opt = {}) {
      const nodes = [], edges = [], labels = [];
      const hl = opt.hl || {};
      const n = Math.pow(B, LV);
      labels.push({ id: "eq", x: 16, y: 18, anchor: "start", cls: "strong",
        text: `T(n) = ${A}T(n/${B}) + ${term(K, P, false)}，n = ${B}^${LV} = ${fmt(n)}` });
      labels.push({ id: "h1", x: 150, y: 50, text: "遞迴樹（框內是子問題大小）", cls: "title" },
        { id: "h2", x: 318, y: 50, text: "節點數 × 每個成本", cls: "title", anchor: "start" },
        { id: "h3", x: BAR0, y: 50, text: "這一層的總成本", cls: "title", anchor: "start" });
      let prevDrawn = false;
      rows.forEach((row, i) => {
        const y = rowY(i), st = hl[i] || "default", span = 272, slot = span / row.cnt;
        if (slot >= 10) {
          // 子問題不多：照真正的樹形位置畫出每個節點，連到父節點
          const w = Math.min(40, slot - 3);
          for (let c = 0; c < row.cnt; c++) {
            const id = `n${i}_${c}`;
            nodes.push({ id, label: w >= 24 ? fmt(row.size) : "", shape: "box", x: 14 + slot * (c + 0.5), y, w, h: 26, state: st });
            if (i > 0 && prevDrawn) edges.push({ from: `n${i - 1}_${Math.floor(c / A)}`, to: id, state: st });
          }
          prevDrawn = true;
        } else {
          // 太多畫不下：整列用一個長框代表
          nodes.push({ id: `n${i}_all`, label: i === LV ? `${fmt(row.cnt)} 片葉子，大小 1` : `${fmt(row.cnt)} 個大小 ${fmt(row.size)} 的子問題`, shape: "box", x: 14 + span / 2, y, w: span, h: 26, state: st });
          prevDrawn = false;
        }
        labels.push({ id: "m" + i, x: 318, y, anchor: "start", cls: i === LV ? "" : "",
          text: i === LV ? `${fmt(row.cnt)} 片葉子 × T(1)` : `${fmt(row.cnt)} 個 × f(${fmt(row.size)})` });
        const w = Math.max(4, BARW * row.total / maxLv);
        nodes.push({ id: "bar" + i, label: "", shape: "box", x: BAR0 + w / 2, y, w, h: 18, state: st === "default" ? "muted" : st });
        labels.push({ id: "v" + i, x: W - 8, y, anchor: "end", cls: "strong", text: fmt(row.total) });
      });
      (opt.info || []).forEach((t, k) => labels.push({ id: "in" + k, x: 16, y: 400 + k * 26, anchor: "start", text: t[0], cls: t[1] || "" }));
      return { nodes, edges, labels, caption, line };
    }

    function run(a, b, k, p) {
      A = a; B = b; K = k; P = p;
      const n = Math.pow(b, LV), d = decide(a, b, k, p);
      const all = [];
      for (let i = 0; i < LV; i++) { const cnt = Math.pow(a, i), size = n / Math.pow(b, i); all.push({ cnt, size, total: cnt * fval(size, k, p) }); }
      all.push({ cnt: Math.pow(a, LV), size: 1, total: Math.pow(a, LV) });
      maxLv = Math.max(...all.map((r) => r.total));
      const sum = all.reduce((s, r) => s + r.total, 0);
      const fTxt = esc(term(k, p, false)), eTxt = num(d.e);
      const r = new Recorder();
      rows = [];
      r.push(frame(`遞迴式 T(n) = ${a}T(n/${b}) + ${fTxt}：每個問題分成 <b>${a}</b> 個子問題、每個大小變成 <b>1/${b}</b>，自己再花 f(n) 分割與合併。取 n = ${b}<sup>${LV}</sup> = ${fmt(n)}，大小每層除以 ${b}，所以第 ${LV} 層剛好縮到 1，是葉子。`, L.n));
      for (let i = 0; i < LV; i++) {
        rows.push(all[i]);
        const row = all[i], hl = { [i]: "compare" };
        let why;
        if (i === 0) why = `第 0 層只有樹根：1 個大小 ${fmt(n)} 的問題，成本 f(${fmt(n)}) = <b>${fmt(row.total)}</b>。`;
        else {
          const ratio = row.total / all[i - 1].total;
          why = `第 ${i} 層：節點數乘上 a = ${a} 變成 ${fmt(row.cnt)}，每個大小除以 b = ${b} 變成 ${fmt(row.size)}，每個成本 f(${fmt(row.size)}) = ${fmt(fval(row.size, k, p))}。這層總共 ${fmt(row.cnt)} × ${fmt(fval(row.size, k, p))} = <b>${fmt(row.total)}</b>，是上一層的 ${ratio.toFixed(3)} 倍` +
            (Math.abs(ratio - 1) < 1e-9 ? "，<b>每層一樣大</b>。" : ratio > 1 ? "，<b>越往下越大</b>。" : "，<b>越往下越小</b>。");
        }
        r.push(frame(why, [L.nodes, L.size, L.level], { hl, info: [[`目前累計：${fmt(all.slice(0, i + 1).reduce((s, x) => s + x.total, 0))}`]] }));
      }
      rows.push(all[LV]);
      r.push(frame(`最底層是葉子：a<sup>${LV}</sup> = ${a}<sup>${LV}</sup> = <b>${fmt(all[LV].cnt)}</b> 片，每片 T(1) = 1。一般的 n 會有 a<sup>log<sub>b</sub> n</sup> = n<sup>log<sub>b</sub> a</sup> 片葉子，這裡 n<sup>log<sub>b</sub> a</sup> = ${fmt(n)}<sup>${eTxt}</sup> = ${fmt(all[LV].cnt)}，正好吻合。所有層加起來 T(${fmt(n)}) = <b>${fmt(sum)}</b>。`, [L.leaves, L.ret], { hl: { [LV]: "compare" }, info: [[`總成本 T(${fmt(n)}) = ${fmt(sum)}`, "strong"]] }));
      // 比較 f(n) 與 n^(log_b a)
      const cmpHl = { 0: "active", [LV]: "active" };
      const rel = d.kind === 1 ? `k = ${num(k)} < ${eTxt}` : d.kind === 3 ? `k = ${num(k)} > ${eTxt}` : `k = ${num(k)} = ${eTxt}`;
      r.push(frame(`主定理只比兩個東西：樹根的 f(n) = ${fTxt} 和葉子總數 n<sup>log<sub>${b}</sub> ${a}</sup> = n<sup>${eTxt}</sup>。先算臨界指數 log<sub>${b}</sub> ${a} = <b>${eTxt}</b>，再比 f 的指數：${rel}。相鄰兩層的比值大約是 a / b<sup>k</sup> = ${a} / ${b}<sup>${num(k)}</sup> = <b>${d.r.toFixed(3)}</b>。`, L.e, { hl: cmpHl, info: [[`log_${b} ${a} = ${eTxt}，a / b^k = ${d.r.toFixed(3)}`, "strong"]] }));
      const dom = {};
      let cap, line;
      if (d.kind === 1) {
        dom[LV] = "found"; for (let i = LV - 2; i < LV; i++) dom[i] = "found";
        cap = `<b>case 1</b>：f(n) = ${fTxt} 比 n<sup>${eTxt}</sup> 小了一個多項式倍（指數差 ${(d.e - k).toFixed(3)} &gt; 0）。每層成本是上一層的 ${d.r.toFixed(3)} 倍，越往下越大，是遞增的等比級數，總和由最底下的葉子主導：T(n) = Θ(${d.ans})。`;
        line = L.c1;
      } else if (d.kind === 3) {
        dom[0] = "found"; dom[1] = "found";
        cap = `<b>case 3</b>：f(n) 比 n<sup>${eTxt}</sup> 大了一個多項式倍（指數差 ${(k - d.e).toFixed(3)} &gt; 0），每層成本越往下越小，總和由樹根主導。還要確認<b>正則條件</b>：a·f(n/b) = ${a}·f(n/${b}) ≤ c·f(n)，這裡 c ≈ a / b<sup>k</sup> = ${d.r.toFixed(3)} &lt; 1，成立。`;
        line = [L.c3[0], L.reg];
      } else if (d.kind === 2) {
        for (let i = 0; i <= LV; i++) dom[i] = "found";
        cap = `<b>case 2</b>：f(n) 和 n<sup>${eTxt}</sup> 同階${p > 0 ? `（再多乘 lg<sup>${p}</sup> n，用延伸版的 case 2）` : ""}。每層成本差不多一樣大，總共 log<sub>${b}</sub> n + 1 層，所以答案是「每層成本 × 層數」：多乘一個 lg n，T(n) = Θ(${d.ans})。`;
        line = L.c2;
      } else {
        for (let i = 0; i <= LV; i++) dom[i] = "active";
        cap = `<b>不能套用主定理</b>：f(n) = ${fTxt} 比 n<sup>${eTxt}</sup> 小，但只小了 lg<sup>${-p}</sup> n 倍，<b>不是多項式倍</b>（對任何 ε &gt; 0，n<sup>ε</sup> 都比 lg n 長得快），不符合 case 1；也不是同階，不符合 case 2。它落在兩個 case 中間的空隙。`;
        line = L.gap;
      }
      r.push(frame(cap, line, { hl: dom, info: [[`case ${d.kind || "—"}`, d.kind ? "ok" : "warn"]] }));
      let fin;
      if (d.kind === 0) fin = `改用遞迴樹自己加：第 i 層成本是 ${term(d.e, 0, true)} / (log<sub>${b}</sub> n − i)${p === -1 ? "" : "<sup>" + -p + "</sup>"} 的常數倍，加總是 ${p === -1 ? "調和級數 1 + 1/2 + … + 1/log n ≈ ln log n" : "Σ 1/j<sup>" + -p + "</sup>，會收斂到常數"}，所以 T(n) = Θ(<b>${d.ans}</b>)。`;
      else fin = `答案：T(n) = Θ(<b>${d.ans}</b>)。實際加起來 T(${fmt(n)}) = ${fmt(sum)}；n 越大，T(n) 和 ${d.ans.replace(/<[^>]+>/g, (t) => t === "<sup>" ? "^" : "")} 的比值會越接近一個常數。`;
      r.push(frame(fin, d.kind === 0 ? L.gap : line, { hl: dom, info: [[`T(n) = Θ(${d.ans.replace(/<sup>/g, "^").replace(/<\/sup>/g, "")})`, d.kind ? "ok" : "warn"], [`n = ${fmt(n)} 時實際總成本 ${fmt(sum)}`]] }));
      return r.frames;
    }

    const PRESETS = {
      "Merge sort": [2, 2, 1, 0], "Binary search": [1, 2, 0, 0], "Strassen": [7, 2, 2, 0],
      "case 3：2T(n/2)+n²": [2, 2, 2, 0], "延伸 case 2：n lg n": [2, 2, 1, 1], "不能套用：n / lg n": [2, 2, 1, -1],
    };
    const inA = ui.input(player, { placeholder: "a", value: "2", width: 46 });
    const inB = ui.input(player, { placeholder: "b", value: "2", width: 46 });
    const inK = ui.input(player, { placeholder: "k", value: "1", width: 54 });
    const inP = ui.input(player, { placeholder: "p", value: "0", width: 46 });
    [inA, inB, inK, inP].forEach((el, i) => el.setAttribute("aria-label", ["a：子問題個數", "b：大小縮小的倍數", "k：f(n) 中 n 的次方", "p：f(n) 中 lg n 的次方"][i]));
    const bad = (el, msg) => {
      el.classList.add("is-error"); setTimeout(() => el.classList.remove("is-error"), 700);
      rows = []; A = A || 2; B = B || 2;
      player.load([{ nodes: [], edges: [], labels: [], caption: `${iconHTML("alert")} ${msg}`, line: null }], { autoplay: false });
    };
    const go = () => {
      const sa = inA.value.trim(), sb = inB.value.trim(), sk = inK.value.trim(), sp = inP.value.trim();
      if (!/^[1-8]$/.test(sa)) return bad(inA, "a 是子問題個數，請輸入 1～8 的整數（a 至少要是 1；太大畫面放不下）。");
      if (!/^[2-8]$/.test(sb)) return bad(inB, "b 是每次縮小的倍數，請輸入 2～8 的整數（b 必須大於 1，問題才會變小）。");
      if (!/^\d(\.\d{1,3})?$/.test(sk) || +sk > 3) return bad(inK, "k 是 f(n) = n^k lg^p n 中 n 的次方，請輸入 0～3 的數字（最多 3 位小數，例如 1、2.5）。");
      if (!/^-?\d$/.test(sp) || +sp < -2 || +sp > 3) return bad(inP, "p 是 lg n 的次方，請輸入 -2～3 的整數（負數代表除以 lg n）。");
      player.load(run(+sa, +sb, +sk, +sp));
    };
    ui.button(player, "畫遞迴樹", go);
    Object.keys(PRESETS).forEach((name) => ui.button(player, name, () => {
      [inA.value, inB.value, inK.value, inP.value] = PRESETS[name].map(String); go();
    }, "ghost"));
    [inA, inB, inK, inP].forEach((el) => el.addEventListener("keydown", (e) => e.key === "Enter" && go()));

    const demo = run(2, 2, 1, 0);
    demo[0].caption = iconHTML("play") + " 按播放看示範：merge sort 的 T(n) = 2T(n/2) + n，一層一層畫出遞迴樹、算出每層成本，最後判斷落在哪個 case。上方四格依序是 a、b、k、p（f(n) = n^k lg^p n），可以輸入自己的遞迴式，或按快捷按鈕看 Strassen、case 3 與不能套用的例子。";
    player.load(demo, { autoplay: false });
  });

  // ===================================================================
  // 靜態圖解
  // ===================================================================
  const box = (id, label, x, y, w, st, h) => ({ id, label, shape: "box", x, y, w, h: h || 30, state: st || "default" });

  // 圖 1：一般的遞迴樹
  figure("master-theorem-tree", () => {
    const nodes = [], edges = [], labels = [];
    nodes.push(box("r", "f(n)", 200, 40, 64, "compare"));
    const l1 = [70, 200, 330];
    l1.forEach((x, i) => { nodes.push(box("a" + i, "f(n/b)", x, 110, 70)); edges.push({ from: "r", to: "a" + i }); });
    const l2x = [30, 70, 110, 160, 200, 240, 290, 330, 370];
    l2x.forEach((x, i) => { nodes.push(box("b" + i, "", x, 180, 34, "default", 26)); edges.push({ from: "a" + Math.floor(i / 3), to: "b" + i }); });
    labels.push({ id: "l2t", x: 200, y: 214, text: "每個 f(n/b²)", cls: "" });
    labels.push({ id: "vd", x: 200, y: 246, text: "⋮", cls: "strong" });
    for (let i = 0; i < 11; i++) nodes.push(box("z" + i, "", 20 + i * 36, 290, 26, "found", 22));
    labels.push({ id: "zt", x: 200, y: 318, text: "葉子：每個 Θ(1)", cls: "ok" });
    labels.push({ id: "c0", x: 430, y: 40, text: "f(n)", anchor: "start", cls: "strong" },
      { id: "c1", x: 430, y: 110, text: "a · f(n/b)", anchor: "start", cls: "strong" },
      { id: "c2", x: 430, y: 180, text: "a² · f(n/b²)", anchor: "start", cls: "strong" },
      { id: "c3", x: 430, y: 246, text: "第 i 層：aⁱ · f(n/bⁱ)", anchor: "start" },
      { id: "c4", x: 430, y: 290, text: "n^(log_b a) · Θ(1)", anchor: "start", cls: "strong" },
      { id: "c5", x: 430, y: 316, text: "葉子數 = a^(log_b n) = n^(log_b a)", anchor: "start", cls: "ok" },
      { id: "hh", x: 640, y: 165, text: "共 log_b n 層", anchor: "middle", cls: "warn" },
      { id: "t0", x: 430, y: 14, text: "每層總成本", anchor: "start", cls: "title" });
    return { width: 680, height: 336, nodes, edges, labels };
  });

  // 圖 2：三種 case 每層成本的形狀
  figure("master-theorem-three-cases", () => {
    const nodes = [], labels = [];
    const groups = [
      { x0: 20, t: "case 1：越往下越大", s: "葉子主導 → Θ(n^(log_b a))", w: [12, 20, 34, 56, 92, 150], st: "found", last: true },
      { x0: 245, t: "case 2：每層一樣", s: "每層 × 層數 → 多乘 lg n", w: [90, 90, 90, 90, 90, 90], st: "found", all: true },
      { x0: 470, t: "case 3：越往下越小", s: "樹根主導 → Θ(f(n))", w: [150, 92, 56, 34, 20, 12], st: "found", first: true },
    ];
    groups.forEach((g, gi) => {
      labels.push({ id: "t" + gi, x: g.x0 + 95, y: 18, text: g.t, cls: "strong" });
      g.w.forEach((w, i) => {
        const dom = g.all || (g.last && i >= 4) || (g.first && i <= 1);
        nodes.push({ id: `g${gi}_${i}`, label: "", shape: "box", x: g.x0 + 20 + w / 2, y: 50 + i * 30, w, h: 18, state: dom ? g.st : "muted" });
        if (gi === 0) labels.push({ id: "lv" + i, x: 10, y: 50 + i * 30, text: i === 5 ? "葉" : String(i), anchor: "middle", cls: "" });
      });
      labels.push({ id: "s" + gi, x: g.x0 + 95, y: 246, text: g.s, cls: "ok" });
    });
    labels.push({ id: "ax", x: 340, y: 272, text: "每一列是一層（0 是樹根），長條長度 = 這層的總成本", cls: "" });
    return { width: 680, height: 290, nodes, labels };
  });

  // 圖 3：主定理涵蓋的範圍與空隙
  figure("master-theorem-gap", () => {
    const nodes = [], labels = [], edges = [];
    const items = [
      ["n^(e−ε)", 60, "found", "case 1"],
      ["n^e/lg² n", 172, "removed", "空隙"],
      ["n^e/lg n", 284, "removed", "空隙"],
      ["n^e", 396, "found", "case 2"],
      ["n^e lg n", 508, "found", "延伸 case 2"],
      ["n^(e+ε)", 620, "found", "case 3"],
    ];
    items.forEach(([t, x, st, c], i) => {
      nodes.push(box("p" + i, t, x, 90, 100, st, 34));
      labels.push({ id: "c" + i, x, y: 130, text: c, cls: st === "removed" ? "warn" : "ok" });
      if (i) edges.push({ from: "p" + (i - 1), to: "p" + i, directed: true, state: "muted" });
    });
    labels.push({ id: "top", x: 340, y: 30, text: "f(n) 由小到大排（e = log_b a）", cls: "title" },
      { id: "g1", x: 232, y: 166, text: "比 n^e 小，但只小了 lg 的次方倍，", cls: "warn" },
      { id: "g2", x: 232, y: 188, text: "不是多項式倍，case 1 管不到", cls: "warn" },
      { id: "g3", x: 232, y: 214, text: "實際：n^e / lg n → Θ(n^e lg lg n)；n^e / lg² n → Θ(n^e)", cls: "" });
    return { width: 680, height: 236, nodes, edges, labels };
  });
})();
