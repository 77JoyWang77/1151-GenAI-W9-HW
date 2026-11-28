/* =====================================================================
   NP-Completeness Reductions（NP 完備歸約）主題的視覺化
   - sat-to-clique : 輸入一個 3-CNF 公式，一步一步建出 3-SAT → CLIQUE（或 → 獨立集）的圖，
                     再看「滿足指派 ⇒ 大小 m 的 clique」與「clique ⇒ 滿足指派」兩個方向
   - 靜態圖：np-reductions-tree（歸約樹）、np-reductions-chain（推論方向）、
             np-reductions-sat-clique（示範公式的圖）、np-reductions-complement（補圖轉換）、
             np-reductions-ham-tsp（HAM-CYCLE → TSP）、np-reductions-3color（3-COLOR 的零件）
   ===================================================================== */
(function () {
  "use strict";
  const { Player, Recorder, ui, register, esc, iconHTML, figure } = window.DSViz;

  // 右側程式碼：由 .work/gen_code.py 從 code/algorithms/np-reductions.c 原封不動抽出
  const CODE_CLIQUE = /*CODE:CLIQUE*/[
    "void literalVertices(const CNF *f, Graph *g, int lit[], int cls[]) {",
    "  g->n = 0;",
    "  for (int j = 0; j < f->m; j++)",
    "    for (int t = 0; t < f->len[j]; t++) {",
    "      lit[g->n] = f->lit[j][t];",
    "      cls[g->n] = j;",
    "      g->n++;",
    "    }",
    "}",
    "",
    "void reduce3SATToClique(const CNF *f, Graph *g, int *k, int lit[], int cls[]) {",
    "  literalVertices(f, g, lit, cls);",
    "  for (int u = 0; u < g->n; u++)",
    "    for (int v = 0; v < g->n; v++)",
    "      g->adj[u][v] = u != v",
    "                     && cls[u] != cls[v]            /* 不同子句才連 */",
    "                     && lit[u] != -lit[v];          /* x 和 ¬x 不連 */",
    "  *k = f->m;",
    "}",
    "",
    "long pickTrueLiterals(const CNF *f, const Graph *g, const int x[], const int lit[], const int cls[]) {",
    "  long s = 0;",
    "  for (int j = 0; j < f->m; j++)",
    "    for (int v = 0; v < g->n; v++)",
    "      if (cls[v] == j && litValue(lit[v], x)) {",
    "        s |= 1L << v;                               /* 子句 j 挑這個點 */",
    "        break;                                      /* 每個子句只挑一個 */",
    "      }",
    "  return s;",
    "}",
    "",
    "void readAssignment(const CNF *f, const Graph *g, long s, const int lit[], int x[]) {",
    "  for (int i = 1; i <= f->n; i++) x[i] = 0;         /* 沒被選到的變數：設成什麼都可以 */",
    "  for (int v = 0; v < g->n; v++)",
    "    if (s >> v & 1) x[abs(lit[v])] = lit[v] > 0;    /* x_i 為真設 1，¬x_i 為真設 0 */",
    "}"
  ];
  const CODE_IS = /*CODE:IS*/[
    "void literalVertices(const CNF *f, Graph *g, int lit[], int cls[]) {",
    "  g->n = 0;",
    "  for (int j = 0; j < f->m; j++)",
    "    for (int t = 0; t < f->len[j]; t++) {",
    "      lit[g->n] = f->lit[j][t];",
    "      cls[g->n] = j;",
    "      g->n++;",
    "    }",
    "}",
    "",
    "void reduce3SATToIS(const CNF *f, Graph *g, int *k, int lit[], int cls[]) {",
    "  literalVertices(f, g, lit, cls);",
    "  for (int u = 0; u < g->n; u++)",
    "    for (int v = 0; v < g->n; v++)",
    "      g->adj[u][v] = u != v",
    "                     && (cls[u] == cls[v]           /* 同一個子句：最多選一個 */",
    "                         || lit[u] == -lit[v]);     /* x 和 ¬x：不能同時為真 */",
    "  *k = f->m;",
    "}",
    "",
    "long pickTrueLiterals(const CNF *f, const Graph *g, const int x[], const int lit[], const int cls[]) {",
    "  long s = 0;",
    "  for (int j = 0; j < f->m; j++)",
    "    for (int v = 0; v < g->n; v++)",
    "      if (cls[v] == j && litValue(lit[v], x)) {",
    "        s |= 1L << v;                               /* 子句 j 挑這個點 */",
    "        break;                                      /* 每個子句只挑一個 */",
    "      }",
    "  return s;",
    "}",
    "",
    "void readAssignment(const CNF *f, const Graph *g, long s, const int lit[], int x[]) {",
    "  for (int i = 1; i <= f->n; i++) x[i] = 0;         /* 沒被選到的變數：設成什麼都可以 */",
    "  for (int v = 0; v < g->n; v++)",
    "    if (s >> v & 1) x[abs(lit[v])] = lit[v] > 0;    /* x_i 為真設 1，¬x_i 為真設 0 */",
    "}"
  ];

  // ---------- 公式：clauses = [[+1, -2, 3], ...]，+i 是 x_i、-i 是 ¬x_i ----------
  const litText = (l) => (l < 0 ? "¬" : "") + "x" + Math.abs(l);
  const clauseText = (c) => c.map(litText).join(" ∨ ");
  const formulaText = (cl) => cl.map((c) => "(" + clauseText(c) + ")").join("");
  const litVal = (l, x) => (l > 0 ? x[l] : !x[-l]);
  const TF = (b) => (b ? "T" : "F");

  // 回傳 { clauses, n } 或 { err }
  function parse(s) {
    s = s.replace(/\s+/g, "");
    if (!s) return { err: "請輸入公式，例如 (x1|x2|!x3)(!x1|x3)。" };
    const raw = [];
    const rest = s.replace(/\(([^()]*)\)/g, (_, inner) => { raw.push(inner); return "&"; });
    if (/[^&∧]/.test(rest)) return { err: "每個子句要用括號包起來，子句之間可以不寫或寫 & 或 ∧，例如 (x1|x2)&(!x1|x3)。" };
    if (raw.length < 1 || raw.length > 4) return { err: `子句要 1～4 個（目前 ${raw.length} 個）：m 個子句會畫成 m 組點，畫面最多放得下 4 組。` };
    let n = 0;
    const out = [];
    for (let j = 0; j < raw.length; j++) {
      const lits = raw[j].split(/[|∨+]/);
      if (lits.length > 3) return { err: `第 ${j + 1} 個子句有 ${lits.length} 個字面；3-SAT 每個子句最多 3 個字面（更長的子句要先用 SAT → 3-SAT 拆開）。` };
      const c = [];
      for (const t of lits) {
        const mm = /^([!~¬-]?)[xX]([1-4])$/.exec(t);
        if (!mm) return { err: `看不懂「${esc(t || "（空白）")}」：字面要寫成 x1～x4，否定在前面加 ! 或 ¬，例如 !x2。` };
        const v = +mm[2];
        n = Math.max(n, v);
        c.push(mm[1] ? -v : v);
      }
      out.push(c);
    }
    return { clauses: out, n };
  }

  // ---------- 版面：第 j 個子句的點排在圓周上的一個方向，中間那個往外推，三角形的邊才不會壓到點 ----------
  const CX = 340, CY = 235, R = 140;
  const ANG = { 1: [-90], 2: [180, 0], 3: [-90, 30, 150], 4: [-90, 0, 90, 180] };
  function layout(cl) {
    const vs = [], gl = [];
    const m = cl.length;
    cl.forEach((c, j) => {
      const a = (ANG[m][j] * Math.PI) / 180;
      const ux = Math.cos(a), uy = Math.sin(a);
      let tx = -uy, ty = ux;
      if (Math.abs(ty) > Math.abs(tx) ? ty < 0 : tx < 0) { tx = -tx; ty = -ty; }   // 讓字面由上到下（或由左到右）排
      const L = c.length;
      c.forEach((l, t) => {
        const off = (t - (L - 1) / 2) * 62;
        const out = L === 3 && t === 1 ? 34 : 0;
        vs.push({ id: "v" + vs.length, lit: l, cls: j, x: CX + ux * (R + out) + tx * off, y: CY + uy * (R + out) + ty * off });
      });
      gl.push({ id: "g" + j, x: CX + ux * (R + 80), y: CY + uy * (R + 80) + 5, text: "C" + (j + 1), cls: "strong" });
    });
    return { vs, gl };
  }

  // 兩種圖的邊：CLIQUE 是「不同子句且不互補」，IS 是「同子句或互補」（剛好互為補圖）
  const cliqueEdge = (a, b) => a.cls !== b.cls && a.lit !== -b.lit;
  const isEdge = (a, b) => a.cls === b.cls || a.lit === -b.lit;

  // 暴力：照 C 程式的順序試指派（x1 是最低位元）
  function bruteSAT(cl, n) {
    for (let mask = 0; mask < 1 << n; mask++) {
      const x = {};
      for (let i = 1; i <= n; i++) x[i] = !!((mask >> (i - 1)) & 1);
      if (cl.every((c) => c.some((l) => litVal(l, x)))) return x;
    }
    return null;
  }
  // 暴力找大小 k 的集合（照遮罩由小到大，和 C 的 findSet 一樣），以及最大的那種集合
  function findSet(vs, k, ok) {
    for (let s = 0; s < 1 << vs.length; s++) {
      const pick = vs.filter((_, i) => (s >> i) & 1);
      if (pick.length !== k) continue;
      if (pick.every((a, i) => pick.every((b, j) => i >= j || ok(a, b)))) return pick.map((v) => v.id);
    }
    return null;
  }

  // ===================================================================
  // 動畫：3-SAT → CLIQUE / 獨立集
  // ===================================================================
  register("sat-to-clique", function (root) {
    let mode = "clique";
    const player = new Player(root, {
      title: "3-SAT to Clique 3-SAT 歸約到 Clique",
      width: 680, height: 470, code: CODE_CLIQUE, wide: true,
      legend: [["new", "剛加入的點"], ["active", "剛加入的邊、最大的團"], ["compare", "指派下為真"], ["found", "選中的點與邊"], ["removed", "互補、不連"], ["muted", "沒選到"]],
    });

    let cl = [], n = 0, vs = [], gl = [];
    const byId = (id) => vs.find((v) => v.id === id);
    const vName = (v) => `${litText(v.lit)}@C${v.cls + 1}`;

    // opt: show（前幾個點看得到）、ns（點狀態）、es（邊：[{from,to,state,dashed}]）、info（左上兩行）、right（右上）
    function frame(caption, line, opt = {}) {
      const show = opt.show === undefined ? vs.length : opt.show;
      const nodes = vs.slice(0, show).map((v) => ({ id: v.id, label: litText(v.lit), x: v.x, y: v.y, r: 22, state: (opt.ns || {})[v.id] || "default" }));
      const shownCls = new Set(vs.slice(0, show).map((v) => v.cls));
      const labels = gl.filter((g, j) => shownCls.has(j)).map((g) => Object.assign({ anchor: "middle" }, g));
      (opt.info || []).forEach((t, k) => labels.push({ id: "in" + k, x: 24, y: 26 + k * 24, text: t[0], cls: t[1] || "strong", anchor: "start" }));
      if (opt.right) labels.push({ id: "rt", x: 656, y: 26, text: opt.right, cls: "strong", anchor: "end" });
      return { nodes, edges: opt.es || [], labels, caption, line };
    }

    function run(clauses, nv) {
      cl = clauses; n = nv;
      ({ vs, gl } = layout(cl));
      const isMode = mode === "is";
      const CODE = isMode ? CODE_IS : CODE_CLIQUE;
      player.setCode(CODE);
      const ln = (s) => CODE.findIndex((l) => l.includes(s)) + 1;
      const L = {
        vert: [ln("lit[g->n] = f->lit[j][t];"), ln("cls[g->n] = j;")],
        diff: ln("&& cls[u] != cls[v]"),
        nocomp: ln("&& lit[u] != -lit[v];"),
        same: ln("&& (cls[u] == cls[v]"),
        comp: ln("|| lit[u] == -lit[v]);"),
        k: ln("*k = f->m;"),
        pickIf: ln("if (cls[v] == j && litValue(lit[v], x)) {"),
        pick: [ln("s |= 1L << v;"), ln("break;")],
        read: ln("if (s >> v & 1) x[abs(lit[v])]"),
        free: ln("for (int i = 1; i <= f->n; i++) x[i] = 0;"),
      };
      const m = cl.length, target = isMode ? "獨立集" : " clique", targetB = isMode ? "獨立集" : "clique ";   // 中英文之間留空白
      const okPair = isMode ? (a, b) => !isEdge(a, b) : cliqueEdge;   // 選中的兩點要滿足的條件
      const edgeOf = isMode ? isEdge : cliqueEdge;
      const r = new Recorder();
      let es = [];                                   // 目前已加入的邊
      const ns0 = {};
      const settle = () => es.forEach((e) => (e.state = "default"));

      r.push(frame(`公式 φ = ${esc(formulaText(cl))}，m = ${m} 個子句、n = ${n} 個變數。歸約要做的事：只根據 φ 的長相，在多項式時間內畫出一張圖 G 和門檻 k，使得「φ 可滿足 ⇔ G 有大小 k 的${target}」。下面一步一步建圖。`, null,
        { show: 0, info: [[`目標：${isMode ? "INDEPENDENT-SET" : "CLIQUE"}`]] }));

      // ---------- 建點（IS 模式順便連同子句的三角形） ----------
      let shown = 0;
      cl.forEach((c, j) => {
        settle();
        shown += c.length;
        const ns = {};
        vs.forEach((v) => { if (v.cls === j) ns[v.id] = "new"; });
        let cap = `C${j + 1} = (${esc(clauseText(c))}) 有 ${c.length} 個字面，每個字面變成一個點（共 ${shown} 個點）。點記得自己是哪個字面、屬於哪個子句。`;
        let line = L.vert;
        if (isMode && c.length > 1) {
          const mine = vs.filter((v) => v.cls === j);
          mine.forEach((a, i) => mine.forEach((b, k2) => { if (i < k2) es.push({ from: a.id, to: b.id, state: "active" }); }));
          cap += `同一個子句的點<b>兩兩連邊</b>（${c.length === 3 ? "三角形" : "一條邊"}）：獨立集裡相鄰的點不能同時選，所以一個子句最多選一個點。`;
          line = L.vert.concat([L.same]);
        }
        r.push(frame(cap, line, { show: shown, ns, es: es.map((e) => Object.assign({}, e)), info: [[`點數 ${shown}`]] }));
      });

      // ---------- 建邊 ----------
      if (!isMode) {
        for (let a = 0; a < m; a++)
          for (let b = a + 1; b < m; b++) {
            settle();
            const A = vs.filter((v) => v.cls === a), B = vs.filter((v) => v.cls === b);
            const add = [], bad = [];
            A.forEach((u) => B.forEach((v) => (cliqueEdge(u, v) ? add : bad).push([u, v])));
            add.forEach(([u, v]) => es.push({ from: u.id, to: v.id, state: "active" }));
            const tmp = es.map((e) => Object.assign({}, e)).concat(bad.map(([u, v]) => ({ from: u.id, to: v.id, state: "removed", dashed: true })));
            const badTxt = bad.length ? `${bad.map(([u, v]) => `${litText(u.lit)} 和 ${litText(v.lit)}`).join("、")} 互補（紅色虛線），<b>不連</b>：x 和 ¬x 不可能同時為真，不能一起出現在 clique 裡。` : "這兩個子句之間沒有互補的字面，全部都連。";
            r.push(frame(`C${a + 1} 和 C${b + 1} 之間：不同子句的字面，只要不互補就連邊，這次加了 ${add.length} 條。${badTxt}同一個子句裡的點<b>永遠不連</b>，所以一個 clique 在每個子句最多拿一個點。`, [L.diff, L.nocomp],
              { es: tmp, info: [[`邊數 ${es.length}`]] }));
          }
      } else {
        const vars = [...new Set(vs.map((v) => Math.abs(v.lit)))].sort();
        let any = false;
        vars.forEach((i) => {
          const P = vs.filter((v) => v.lit === i), N = vs.filter((v) => v.lit === -i);
          const add = [];
          P.forEach((u) => N.forEach((v) => { if (u.cls !== v.cls) add.push([u, v]); }));
          if (!add.length) return;
          any = true;
          settle();
          add.forEach(([u, v]) => es.push({ from: u.id, to: v.id, state: "active" }));
          r.push(frame(`變數 x${i}：每個 x${i} 和每個 ¬x${i} 之間連邊（加了 ${add.length} 條）。獨立集不能同時選相鄰的兩點，也就保證不會同時選到 x${i} 和 ¬x${i}，讀回指派時才不會矛盾。`, L.comp,
            { es: es.map((e) => Object.assign({}, e)), info: [[`邊數 ${es.length}`]] }));
        });
        if (!any) r.push(frame(`公式裡沒有任何一對分在不同子句的 x 和 ¬x，所以不用加「互補邊」，只有每個子句內的三角形。`, L.comp, { es: es.map((e) => Object.assign({}, e)), info: [[`邊數 ${es.length}`]] }));
      }
      settle();
      const E = es.length, N = vs.length;
      r.push(frame(`圖建好了：${N} 個點（= 字面總數）、${E} 條邊，門檻 k = m = ${m}。建圖只看了每一對點一次，O(N²) 時間，N 是公式長度，所以是多項式時間的轉換。接下來證明「φ 可滿足 ⇔ G 有大小 ${m} 的${target}」。`, L.k,
        { es: es.map((e) => Object.assign({}, e)), info: [[`k = m = ${m}`]], right: `點 ${N}、邊 ${E}` }));

      // ---------- 兩個方向 ----------
      const x = bruteSAT(cl, n);
      const xTxt = (xx) => "(" + Array.from({ length: n }, (_, i) => TF(xx[i + 1])).join(", ") + ")";
      const edgesWith = (ids, st) => es.map((e) => Object.assign({}, e, { state: ids.includes(e.from) && ids.includes(e.to) ? st : "default" }));
      if (x) {
        const tns = {};
        vs.forEach((v) => { if (litVal(v.lit, x)) tns[v.id] = "compare"; });
        r.push(frame(`(⇒) φ 可滿足，例如 x = ${xTxt(x)}（${n === 1 ? "x1 的值" : "依序是 x1 到 x" + n}）。在這組指派下為真的字面標成藍色。x 讓每個子句都成立，所以<b>每一組點至少有一個藍點</b>。`, L.pickIf,
          { ns: tns, es: es.map((e) => Object.assign({}, e)), info: [[`x = ${xTxt(x)}`]], right: `k = ${m}` }));
        const pick = [];
        for (let j = 0; j < m; j++) { const v = vs.find((w) => w.cls === j && litVal(w.lit, x)); pick.push(v.id); }
        const pns = {};
        vs.forEach((v) => (pns[v.id] = pick.includes(v.id) ? "found" : "muted"));
        const why = isMode
          ? `任兩個選中的點：屬於不同子句，所以沒有三角形的邊；兩個都為真，所以不會是 x 和 ¬x，也沒有互補邊。所以它們<b>兩兩不相鄰</b>，是大小 ${m} 的獨立集。`
          : `任兩個選中的點：屬於不同子句，而且兩個都為真，不可能一個是 x、一個是 ¬x，照建邊規則它們之間<b>一定有邊</b>（綠色）。所以這 ${m} 個點兩兩相鄰，是大小 ${m} 的 clique。`;
        r.push(frame(`每個子句挑第一個藍點：${pick.map((id) => vName(byId(id))).join("、")}。${m === 1 ? `只有一個子句，一個點本身就是大小 1 的${target}。` : why}`, L.pick,
          { ns: pns, es: isMode ? es.map((e) => Object.assign({}, e, { state: "default" })) : edgesWith(pick, "found"), info: [[`x = ${xTxt(x)}`], [`選了 ${m} 個點`, "ok"]], right: `k = ${m}` }));

        const any = findSet(vs, m, okPair);
        const y = {};
        for (let i = 1; i <= n; i++) y[i] = false;
        const fixed = new Set();
        any.forEach((id) => { const v = byId(id); y[Math.abs(v.lit)] = v.lit > 0; fixed.add(Math.abs(v.lit)); });
        const freeVars = Array.from({ length: n }, (_, i) => i + 1).filter((i) => !fixed.has(i));
        const ans = {};
        vs.forEach((v) => (ans[v.id] = any.includes(v.id) ? "found" : "muted"));
        const reason = isMode
          ? `同一個子句的點互相連成三角形，所以 ${m} 個點只能<b>每個子句剛好一個</b>；互補的字面之間有邊，所以不會同時選到 x 和 ¬x`
          : `同一個子句的點之間沒有邊，所以 ${m} 個點只能<b>每個子句剛好一個</b>；互補的字面之間沒有邊，所以 clique 裡不會同時有 x 和 ¬x`;
        r.push(frame(`(⇐) 反過來，任給一個大小 ${m} 的${target}（這裡用暴力法找到的第一個：${any.map((id) => vName(byId(id))).join("、")}${any.join() === pick.join() ? "，剛好和剛才那組相同，但下面的論證對任何一組都成立" : "，和剛才那組不同也沒關係"}）。${reason}。把選中的字面都設成真，不會矛盾：得到 x = ${xTxt(y)}${freeVars.length ? `（${freeVars.map((i) => "x" + i).join("、")} 沒被選到，設 T 或 F 都可以）` : ""}。每個子句都有一個選中的字面為真，所以 φ 被滿足。`, L.read,
          { ns: ans, es: isMode ? es.map((e) => Object.assign({}, e, { state: "default" })) : edgesWith(any, "found"), info: [[`讀回 x = ${xTxt(y)}`], [`${targetB}大小 ${m}`, "ok"]], right: `k = ${m}` }));
        r.push(frame(`兩個方向都成立：φ 可滿足 ⇔ G 有大小 ${m} 的${target}。${isMode ? "對照「目標：Clique」那張圖會發現：兩張圖剛好互為<b>補圖</b>（同子句或互補 ⇔ 不是「不同子句且不互補」），這正是 CLIQUE 和獨立集互相歸約的方式。" : "如果把邊的規則反過來（同一個子句連、互補的連），就變成 3-SAT → 獨立集，按一下「目標：Clique」按鈕切換過去看看。"}`, null,
          { ns: ans, es: isMode ? es.map((e) => Object.assign({}, e, { state: "default" })) : edgesWith(any, "found"), info: [[`φ 可滿足 ⇔ 有大小 ${m} 的${target}`, "ok"]] }));
      } else {
        let best = null, sz = m - 1;
        for (; sz >= 1; sz--) { best = findSet(vs, sz, okPair); if (best) break; }
        const bns = {};
        vs.forEach((v) => (bns[v.id] = best && best.includes(v.id) ? "active" : "muted"));
        const missCls = cl.map((_, j) => j).filter((j) => !best || !best.some((id) => byId(id).cls === j));
        r.push(frame(`φ <b>不可滿足</b>（${1 << n} 組指派全部失敗）。那 G 也一定沒有大小 ${m} 的${target}：否則照 (⇐) 的讀法就能讀出一組滿足指派。暴力檢查的結果吻合：最大的${target}${isMode ? "" : " "}只有 ${sz} 個點（橘色，例如 ${best ? best.map((id) => vName(byId(id))).join("、") : "無"}），${missCls.map((j) => "C" + (j + 1)).join("、")} 沒有點能再加進來。所以答案兩邊都是 no。`, null,
          { ns: bns, es: isMode ? es.map((e) => Object.assign({}, e, { state: "default" })) : edgesWith(best || [], "active"), info: [[`最大${target} = ${sz} < k = ${m}`, "warn"]] }));
      }
      return r.frames;
    }

    const PRESETS = {
      "示範": "(x1 ∨ x2 ∨ x3)(¬x1 ∨ ¬x2 ∨ x3)(x1 ∨ ¬x2 ∨ ¬x3)",
      "4 個子句": "(x1 ∨ ¬x2 ∨ x3)(x1 ∨ x2 ∨ x4)(x2 ∨ ¬x3 ∨ ¬x4)(¬x1 ∨ ¬x2 ∨ ¬x4)",
      "不可滿足": "(x1 ∨ x2)(x1 ∨ ¬x2)(¬x1 ∨ x2)(¬x1 ∨ ¬x2)",
    };
    const inF = ui.input(player, { placeholder: "3-CNF，例如 (x1|!x2|x3)(!x1|x2)", value: PRESETS["示範"], width: 290 });
    let last = PRESETS["示範"];
    const bad = (msg) => {
      inF.classList.add("is-error"); setTimeout(() => inF.classList.remove("is-error"), 700);
      cl = []; n = 0; vs = []; gl = [];
      player.load([frame(`${iconHTML("alert")} ${msg}`, null)], { autoplay: false });
    };
    const go = () => {
      const p = parse(inF.value);
      if (p.err) return bad(p.err);
      inF.value = formulaText(p.clauses);
      last = inF.value;
      player.load(run(p.clauses, p.n));
    };
    ui.button(player, "建圖", go);
    const modeBtn = ui.button(player, "目標：Clique", () => {
      mode = mode === "clique" ? "is" : "clique";
      modeBtn.textContent = mode === "clique" ? "目標：Clique" : "目標：獨立集";
      const p = parse(inF.value);
      if (p.err) inF.value = last;
      go();
    }, "ghost");
    Object.keys(PRESETS).forEach((k) => ui.button(player, k, () => { inF.value = PRESETS[k]; go(); }, "ghost"));
    inF.addEventListener("keydown", (e) => e.key === "Enter" && go());

    const p0 = parse(PRESETS["示範"]);
    const demo = run(p0.clauses, p0.n);
    demo[0].caption = iconHTML("play") + " 按播放看示範：3 個子句的公式，先每個字面畫一個點，再在「不同子句、不互補」的字面之間連邊，最後看滿足指派和 3-clique 怎麼互相對應。可以輸入自己的公式（! 代表否定、| 代表或，最多 4 個子句、每個子句 1～3 個字面），按「不可滿足」看 no 的情況，或按「目標：Clique」切換成 3-SAT → 獨立集。";
    player.load(demo, { autoplay: false });
  });

  // ===================================================================
  // 靜態圖解
  // ===================================================================
  const box = (id, label, x, y, w, st, h) => ({ id, label, shape: "box", x, y, w, h: h || 34, state: st || "default" });

  // 圖 1：常考的歸約樹（箭頭 A → B 代表 A ≤p B）
  figure("np-reductions-tree", () => {
    const nodes = [
      box("sat", "SAT", 90, 60, 90, "active"),
      box("3sat", "3-SAT", 90, 160, 90, "active"),
      box("clq", "CLIQUE", 270, 70, 110),
      box("is", "IND-SET", 270, 160, 110),
      box("col", "3-COLOR", 270, 250, 110),
      box("vc", "VERTEX-COVER", 460, 160, 150),
      box("ss", "SUBSET-SUM", 270, 330, 130),
      box("hc", "HAM-CYCLE", 460, 70, 130),
      box("tsp", "TSP", 620, 70, 70),
      box("hp", "長度 k 的簡單路徑", 590, 250, 150),
      box("odd", "ODDNUMBERSUM", 480, 330, 150),
    ];
    const d = (from, to, dashed) => ({ from, to, directed: true, dashed: !!dashed });
    const edges = [d("sat", "3sat"), d("3sat", "clq"), d("3sat", "is"), d("3sat", "col"), d("3sat", "ss"),
      d("clq", "is"), d("is", "vc"), d("vc", "hc"), d("vc", "ss", true), d("hc", "tsp"), d("hc", "hp"), d("ss", "odd")];
    const labels = [
      { id: "l0", x: 20, y: 18, text: "A → B 代表 A ≤p B：B 至少和 A 一樣難", cls: "strong", anchor: "start" },
      { id: "l1", x: 90, y: 214, text: "起點：Cook–Levin", anchor: "middle" },
      { id: "l2", x: 20, y: 372, text: "虛線：另一條常考的路", anchor: "start" },
    ];
    return { width: 680, height: 380, nodes, edges, labels };
  });

  // 圖 2：推論方向：A ≤p B ≤p C ≤p D
  figure("np-reductions-chain", () => {
    const nodes = ["A", "B", "C", "D"].map((t, i) => box("c" + i, t, 110 + i * 160, 110, 70, "default", 44));
    const edges = [0, 1, 2].map((i) => ({ from: "c" + i, to: "c" + (i + 1), directed: true }));
    nodes.push(box("hard", "NP-hard 往右傳 →", 340, 40, 300, "removed", 34));
    nodes.push(box("easy", "← 在 P、在 NP 往左傳", 340, 180, 300, "found", 34));
    const labels = [
      { id: "l1", x: 190, y: 98, text: "≤p", cls: "strong" },
      { id: "l2", x: 350, y: 98, text: "≤p", cls: "strong" },
      { id: "l3", x: 510, y: 98, text: "≤p", cls: "strong" },
      { id: "l4", x: 340, y: 236, text: "A 是 NP-hard ⇒ B、C、D 都是 NP-hard；D ∈ NP ⇒ A、B、C 都 ∈ NP", anchor: "middle" },
      { id: "l5", x: 340, y: 262, text: "反方向都推不出來：D 很難不代表 A 難；A 簡單不代表 D 簡單", cls: "warn", anchor: "middle" },
    ];
    return { width: 680, height: 280, nodes, edges, labels };
  });

  // 圖 3：示範公式的 3-SAT → CLIQUE 圖與一個 3-clique
  figure("np-reductions-sat-clique", () => {
    const cl = [[1, 2, 3], [-1, -2, 3], [1, -2, -3]];
    const { vs, gl } = layout(cl);
    const pick = ["v0", "v4", "v6"];                  // x = (T, F, F)：C1 挑 x1、C2 挑 ¬x2、C3 挑 x1
    const nodes = vs.map((v) => ({ id: v.id, label: litText(v.lit), x: v.x, y: v.y, r: 22, state: pick.includes(v.id) ? "found" : "default" }));
    const edges = [];
    vs.forEach((a, i) => vs.forEach((b, j) => {
      if (i < j && cliqueEdge(a, b)) edges.push({ from: a.id, to: b.id, state: pick.includes(a.id) && pick.includes(b.id) ? "found" : "muted" });
    }));
    const labels = gl.map((g) => Object.assign({ anchor: "middle" }, g));
    labels.push({ id: "f0", x: 24, y: 26, text: "x = (T, F, F)", cls: "strong", anchor: "start" },
      { id: "f1", x: 24, y: 50, text: "綠色：3-clique", cls: "ok", anchor: "start" },
      { id: "f2", x: 656, y: 26, text: "9 個點、21 條邊", cls: "strong", anchor: "end" },
      { id: "f3", x: 656, y: 50, text: "k = m = 3", cls: "strong", anchor: "end" });
    return { width: 680, height: 380, nodes, edges, labels };
  });

  // 圖 4：clique ↔ 補圖的獨立集 ↔ 點覆蓋
  figure("np-reductions-complement", () => {
    const P = { a: [70, 70], b: [190, 70], c: [130, 160], d: [70, 250], e: [190, 250] };
    const S = ["a", "b", "c"];
    const nodes = [], edges = [];
    Object.entries(P).forEach(([id, [x, y]]) => {
      nodes.push({ id: "L" + id, label: id, x, y, r: 20, state: S.includes(id) ? "found" : "default" });
      nodes.push({ id: "R" + id, label: id, x: x + 380, y, r: 20, state: S.includes(id) ? "found" : "active" });
    });
    const G = ["ab", "ac", "bc", "cd", "de"];
    const all = ["ab", "ac", "ad", "ae", "bc", "bd", "be", "cd", "ce", "de"];
    G.forEach((e) => edges.push({ from: "L" + e[0], to: "L" + e[1], state: S.includes(e[0]) && S.includes(e[1]) ? "found" : "default" }));
    all.filter((e) => !G.includes(e)).forEach((e) => edges.push({ from: "R" + e[0], to: "R" + e[1] }));
    const labels = [
      { id: "t1", x: 130, y: 24, text: "G：{a, b, c} 是 3-clique", cls: "ok" },
      { id: "t2", x: 510, y: 24, text: "補圖 Ḡ：{a, b, c} 是獨立集", cls: "ok" },
      { id: "t3", x: 510, y: 300, text: "剩下的 {d, e}（橘）是 Ḡ 的點覆蓋", cls: "strong" },
      { id: "t4", x: 330, y: 150, text: "取補圖", cls: "strong" },
      { id: "t5", x: 330, y: 176, text: "k 不變", anchor: "middle" },
      { id: "t6", x: 130, y: 300, text: "n = 5、k = 3", cls: "strong" },
      { id: "t7", x: 510, y: 324, text: "大小 n − k = 2", anchor: "middle" },
    ];
    return { width: 680, height: 340, nodes, edges, labels };
  });

  // 圖 5：HAM-CYCLE → TSP：原本的邊權重 1，非邊權重 2，k = n
  figure("np-reductions-ham-tsp", () => {
    const P = [[80, 70], [240, 70], [240, 220], [80, 220]];
    const nodes = [], edges = [];
    P.forEach(([x, y], i) => {
      nodes.push({ id: "L" + i, label: String(i), x, y, r: 20 });
      nodes.push({ id: "R" + i, label: String(i), x: x + 360, y, r: 20 });
    });
    const G = [[0, 1], [1, 2], [2, 3], [3, 0], [0, 2]];
    const has = (u, v) => G.some(([a, b]) => (a === u && b === v) || (a === v && b === u));
    const cyc = [[0, 1], [1, 2], [2, 3], [3, 0]];
    const onC = (u, v) => cyc.some(([a, b]) => (a === u && b === v) || (a === v && b === u));
    G.forEach(([u, v]) => edges.push({ from: "L" + u, to: "L" + v, state: onC(u, v) ? "found" : "default" }));
    const labels = [];
    for (let u = 0; u < 4; u++)
      for (let v = u + 1; v < 4; v++) {
        const e = has(u, v);
        edges.push({ from: "R" + u, to: "R" + v, dashed: !e, state: onC(u, v) ? "found" : e ? "default" : "muted" });
        const [x1, y1] = P[u], [x2, y2] = P[v];
        // 權重標在邊的中點旁邊（兩條對角線錯開，避免疊在中心）
        let mx = (x1 + x2) / 2 + 360, my = (y1 + y2) / 2;
        if (u === 0 && v === 2) { mx -= 30; my -= 18; } else if (u === 1 && v === 3) { mx += 30; my -= 18; }
        else if (y1 === y2) my -= 12; else mx += x1 < 160 ? -16 : 16;
        labels.push({ id: `w${u}${v}`, x: mx, y: my, text: e ? "1" : "2", cls: e ? "ok" : "warn" });
      }
    labels.push({ id: "t1", x: 160, y: 24, text: "G：有 Hamiltonian cycle 0-1-2-3-0", cls: "ok" },
      { id: "t2", x: 520, y: 24, text: "完全圖：G 的邊權重 1，其他 2", cls: "strong" },
      { id: "t3", x: 520, y: 276, text: "巡迴 0-1-2-3-0 總長 4 ≤ k = n = 4", cls: "ok" },
      { id: "t4", x: 160, y: 276, text: "非邊 1-3 只能用權重 2", anchor: "middle" },
      { id: "t5", x: 340, y: 150, text: "轉換", cls: "strong" });
    return { width: 680, height: 296, nodes, edges, labels };
  });

  // 圖 6：3-SAT → 3-COLOR 的三種零件
  figure("np-reductions-3color", () => {
    const c = (id, label, x, y, st) => ({ id, label, x, y, r: 19, state: st || "default" });
    const nodes = [
      c("T", "T", 80, 70, "found"), c("F", "F", 40, 150, "removed"), c("B", "B", 120, 150, "compare"),
      c("x", "x1", 210, 70, "found"), c("nx", "¬x1", 290, 70, "removed"), c("B2", "B", 250, 150, "compare"),
      c("a", "l1", 400, 60, "removed"), c("b", "l2", 400, 140, "removed"), c("cc", "l3", 400, 240, "found"),
      c("p", "p", 480, 60, "found"), c("q", "q", 480, 140, "compare"), c("o1", "o1", 560, 100, "removed"),
      c("p2", "p'", 560, 190, "compare"), c("q2", "q'", 480, 240, "removed"), c("o2", "o2", 640, 215, "found"),
      c("F2", "F", 600, 290, "removed"), c("B3", "B", 670, 290, "compare"),
    ];
    const e = (from, to) => ({ from, to });
    const edges = [e("T", "F"), e("F", "B"), e("B", "T"), e("x", "nx"), e("x", "B2"), e("nx", "B2"),
      e("a", "p"), e("b", "q"), e("p", "q"), e("p", "o1"), e("q", "o1"),
      e("o1", "p2"), e("cc", "q2"), e("p2", "q2"), e("p2", "o2"), e("q2", "o2"), e("o2", "F2"), e("o2", "B3")];
    const labels = [
      { id: "t1", x: 80, y: 24, text: "調色盤", cls: "strong" },
      { id: "t2", x: 250, y: 24, text: "變數零件", cls: "strong" },
      { id: "t3", x: 540, y: 24, text: "子句零件：o2 = OR(OR(l1, l2), l3)", cls: "strong" },
      { id: "t4", x: 80, y: 200, text: "三色各占一個", anchor: "middle" },
      { id: "t5", x: 250, y: 200, text: "一個 T、一個 F", anchor: "middle" },
      { id: "t6", x: 250, y: 290, text: "（圖中的 F、B 都是同一個點）", anchor: "middle" },
      { id: "t7", x: 300, y: 330, text: "l1、l2 都是 F ⇒ o1 只能是 F；o2 連到 F、B ⇒ o2 必須是 T", cls: "warn", anchor: "middle" },
    ];
    return { width: 700, height: 350, nodes, edges, labels };
  });
})();
