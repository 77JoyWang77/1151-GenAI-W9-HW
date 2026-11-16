/* =====================================================================
   Longest Common Subsequence（最長共同子序列）主題的視覺化
   - lcs-table : 一格一格填 LCS 長度表，再照箭頭回溯找出 LCS（可切換平手往上／往左）
   ===================================================================== */
(function () {
  "use strict";
  const { Player, Recorder, ui, register, esc, iconHTML, figure } = window.DSViz;

  // 右側程式碼：從 code/algorithms/longest-common-subsequence.c 原封不動取出
  const CODE = {
    "lcsLength": [
      "int lcsLength(const char *X, const char *Y) {",
      "  int m = strlen(X), n = strlen(Y);",
      "  for (int i = 0; i <= m; i++) c[i][0] = 0;   /* 空字串和任何字串的 LCS 長度都是 0 */",
      "  for (int j = 0; j <= n; j++) c[0][j] = 0;",
      "  for (int i = 1; i <= m; i++)",
      "    for (int j = 1; j <= n; j++) {",
      "      if (X[i - 1] == Y[j - 1]) {              /* 最後一個字元相同：一定可以接在 LCS 後面 */",
      "        c[i][j] = c[i - 1][j - 1] + 1;",
      "        b[i][j] = 'D';",
      "      } else if (c[i - 1][j] >= c[i][j - 1]) { /* 不同：丟掉 X 的最後一個字元比較好（平手往上） */",
      "        c[i][j] = c[i - 1][j];",
      "        b[i][j] = 'U';",
      "      } else {                                 /* 丟掉 Y 的最後一個字元比較好 */",
      "        c[i][j] = c[i][j - 1];",
      "        b[i][j] = 'L';",
      "      }",
      "    }",
      "  return c[m][n];",
      "}"
    ],
    "lcsLengthLeft": [
      "int lcsLengthLeft(const char *X, const char *Y) {",
      "  int m = strlen(X), n = strlen(Y);",
      "  for (int i = 0; i <= m; i++) c[i][0] = 0;",
      "  for (int j = 0; j <= n; j++) c[0][j] = 0;",
      "  for (int i = 1; i <= m; i++)",
      "    for (int j = 1; j <= n; j++) {",
      "      if (X[i - 1] == Y[j - 1]) {",
      "        c[i][j] = c[i - 1][j - 1] + 1;",
      "        b[i][j] = 'D';",
      "      } else if (c[i][j - 1] >= c[i - 1][j]) { /* 平手往左 */",
      "        c[i][j] = c[i][j - 1];",
      "        b[i][j] = 'L';",
      "      } else {",
      "        c[i][j] = c[i - 1][j];",
      "        b[i][j] = 'U';",
      "      }",
      "    }",
      "  return c[m][n];",
      "}"
    ],
    "printLCS": [
      "void printLCS(const char *X, int i, int j) {",
      "  if (i == 0 || j == 0) return;",
      "  if (b[i][j] == 'D') {",
      "    printLCS(X, i - 1, j - 1);",
      "    putchar(X[i - 1]);",
      "  } else if (b[i][j] == 'U') {",
      "    printLCS(X, i - 1, j);",
      "  } else {",
      "    printLCS(X, i, j - 1);",
      "  }",
      "}"
    ]
  };

  const CODE_UP = CODE.lcsLength.concat([""], CODE.printLCS);
  const CODE_LEFT = CODE.lcsLengthLeft.concat([""], CODE.printLCS);
  // 找出某段程式在 code 陣列中的行號（從 1 開始）；after 用來跳過前面同樣的字串
  const ln = (code, s, after = 0) => code.findIndex((l, k) => k >= after && l.includes(s)) + 1;
  const ARROW = { D: "↖", U: "↑", L: "←" };

  register("lcs-table", function (root) {
    const player = new Player(root, {
      title: "LCS Table 最長共同子序列填表",
      width: 680, height: 410, code: CODE_UP,
      legend: [["active", "正在填的格子"], ["compare", "參考的格子"], ["found", "字元相同（↖）"], ["visited", "回溯走過的路"], ["new", "加入 LCS 的字元"]],
    });

    let X = "", Y = "", m = 0, n = 0, tieUp = true;
    const CW = 58, CH = 34, GX = 64, GY = 40, X0 = 110, Y0 = 66;
    const cx = (j) => X0 + j * GX, cy = (i) => Y0 + i * GY;

    // L：程式碼裡各個關鍵行的行號
    function lines(code) {
      const t = tieUp, s = 0;
      return {
        init: [ln(code, "c[i][0] = 0", s), ln(code, "c[0][j] = 0", s)],
        loop: [ln(code, "for (int i = 1"), ln(code, "for (int j = 1")],
        same: [ln(code, "if (X[i - 1] == Y[j - 1])"), ln(code, "c[i][j] = c[i - 1][j - 1] + 1")],
        up: t ? [ln(code, "else if (c[i - 1][j] >= c[i][j - 1])"), ln(code, "c[i][j] = c[i - 1][j];")] : [ln(code, "} else {"), ln(code, "c[i][j] = c[i - 1][j];")],
        left: t ? [ln(code, "} else {"), ln(code, "c[i][j] = c[i][j - 1];")] : [ln(code, "else if (c[i][j - 1] >= c[i - 1][j])"), ln(code, "c[i][j] = c[i][j - 1];")],
        ret: ln(code, "return c[m][n]"),
        pStop: ln(code, "if (i == 0 || j == 0) return;"),
        pD: [ln(code, "if (b[i][j] == 'D')"), ln(code, "printLCS(X, i - 1, j - 1);")],
        pPut: ln(code, "putchar(X[i - 1]);"),
        pU: [ln(code, "} else if (b[i][j] == 'U')"), ln(code, "printLCS(X, i - 1, j);")],
        pL: ln(code, "printLCS(X, i, j - 1);"),
      };
    }

    let c = [], b = [];
    function frame(caption, line, opt = {}) {
      const st = opt.st || {}, nodes = [], labels = [], edges = [];
      for (let j = 0; j < n; j++) labels.push({ id: "y" + j, x: cx(j + 1), y: Y0 - 30, text: Y[j], cls: (opt.hy === j ? "warn" : "strong") });
      for (let i = 0; i < m; i++) labels.push({ id: "x" + i, x: X0 - 52, y: cy(i + 1) + 5, text: X[i], cls: (opt.hx === i ? "warn" : "strong") });
      labels.push({ id: "yh", x: X0 - 52, y: Y0 - 30, text: "X \\ Y", cls: "title" });
      for (let i = 0; i <= m; i++) for (let j = 0; j <= n; j++) {
        const v = c[i] && c[i][j];
        const filled = v !== undefined && v !== null;
        const arrow = filled && i > 0 && j > 0 && b[i][j] ? ARROW[b[i][j]] + " " : "";
        nodes.push({ id: `c${i}_${j}`, label: filled ? arrow + v : "", shape: "box", x: cx(j), y: cy(i), w: CW, h: CH,
          state: st[i + "," + j] || (!filled ? "ghost" : i === 0 || j === 0 ? "muted" : "default") });
      }
      (opt.info || []).forEach((t, k) => labels.push({ id: "in" + k, x: X0 - 70 + k * 220, y: cy(m) + 42, text: t[0], cls: t[1] || "", anchor: "start" }));
      return { nodes, edges, labels, caption, line };
    }

    function run(x, y) {
      X = x; Y = y; m = X.length; n = Y.length;
      const code = tieUp ? CODE_UP : CODE_LEFT, L = lines(code);
      player.setCode(code);
      c = Array.from({ length: m + 1 }, () => Array(n + 1).fill(null));
      b = Array.from({ length: m + 1 }, () => Array(n + 1).fill(null));
      const r = new Recorder();
      for (let i = 0; i <= m; i++) c[i][0] = 0;
      for (let j = 0; j <= n; j++) c[0][j] = 0;
      r.push(frame(`第 0 列、第 0 行代表「其中一個字串是空的」，空字串和任何字串的 LCS 長度都是 0，先填好。接著<b>一列一列、由左到右</b>填，因為每一格只會用到左、上、左上三格。`, L.init, { info: [[`X = ${esc(X)}（m = ${m}）`], [`Y = ${esc(Y)}（n = ${n}）`]] }));
      const perRow = m * n > 36;
      for (let i = 1; i <= m; i++) {
        const rowSt = {};
        for (let j = 1; j <= n; j++) {
          let why, ln2, st = {};
          if (X[i - 1] === Y[j - 1]) {
            c[i][j] = c[i - 1][j - 1] + 1; b[i][j] = "D";
            st[(i - 1) + "," + (j - 1)] = "compare"; st[i + "," + j] = "found"; rowSt[i + "," + j] = "found";
            why = `X 的第 ${i} 個字元 <b>${esc(X[i - 1])}</b> 和 Y 的第 ${j} 個字元 <b>${esc(Y[j - 1])}</b> 相同：這個字元一定可以接在「兩邊都去掉它」的 LCS 後面，c[${i}][${j}] = 左上 ${c[i - 1][j - 1]} + 1 = <b>${c[i][j]}</b>，箭頭 ↖。`;
            ln2 = L.same;
          } else {
            const up = c[i - 1][j], left = c[i][j - 1];
            const goUp = tieUp ? up >= left : !(left >= up);
            c[i][j] = goUp ? up : left; b[i][j] = goUp ? "U" : "L";
            st[(i - 1) + "," + j] = "compare"; st[i + "," + (j - 1)] = "compare"; st[i + "," + j] = "active";
            const tie = up === left ? `兩邊一樣大，平手時往${tieUp ? "上" : "左"}` : `${goUp ? "上面" : "左邊"}比較大`;
            why = `${esc(X[i - 1])} ≠ ${esc(Y[j - 1])}：最後一個字元不能同時用，只能丟掉 X 的（看上面 ${up}）或丟掉 Y 的（看左邊 ${left}），取大的。${tie}，c[${i}][${j}] = <b>${c[i][j]}</b>，箭頭 ${goUp ? "↑" : "←"}。`;
            ln2 = goUp ? L.up : L.left;
          }
          if (!perRow) r.push(frame(why, ln2, { st, hx: i - 1, hy: j - 1, info: [[`c[${i}][${j}] = ${c[i][j]}`, "strong"]] }));
        }
        if (perRow) {
          const hits = [];
          for (let j = 1; j <= n; j++) if (b[i][j] === "D") hits.push(`${esc(Y[j - 1])}（第 ${j} 行）`);
          r.push(frame(`填第 ${i} 列（X 的字元 <b>${esc(X[i - 1])}</b>）：${hits.length ? `和 Y 的 ${hits.join("、")} 相同，那幾格是左上 + 1（↖）` : "Y 裡沒有相同的字元"}；其他格取上面和左邊比較大的（平手往${tieUp ? "上" : "左"}）。表格比較大，這裡一次填一列。`, L.loop, { st: rowSt, hx: i - 1, info: [[`第 ${i} 列填完`, "strong"]] }));
        }
      }
      r.push(frame(`表格填完：右下角 c[${m}][${n}] = <b>${c[m][n]}</b> 就是整個 X 和 Y 的 LCS 長度。接下來從右下角照箭頭走回去，找出是哪些字元。`, L.ret, { st: { [m + "," + n]: "active" }, info: [[`LCS 長度 = ${c[m][n]}`, "strong"]] }));
      // 回溯
      let i = m, j = n, out = "";
      const path = {};
      const pathSt = () => Object.assign({}, path);
      while (i > 0 && j > 0) {
        const s = pathSt();
        if (b[i][j] === "D") {
          out = X[i - 1] + out; path[i + "," + j] = "new";
          s[i + "," + j] = "new";
          r.push(frame(`c[${i}][${j}] 是 ↖：X[${i}] = Y[${j}] = <b>${esc(X[i - 1])}</b>，這個字元屬於 LCS，往左上走。因為是從後面往前找，印出時要<b>先遞迴再印</b>，順序才會是正的。`, [L.pD[0], L.pD[1], L.pPut], { st: s, hx: i - 1, hy: j - 1, info: [[`LCS = ${esc(out)}`, "strong"]] }));
          i--; j--;
        } else if (b[i][j] === "U") {
          path[i + "," + j] = "visited"; s[i + "," + j] = "visited";
          r.push(frame(`c[${i}][${j}] 是 ↑：這一格的值來自上面，代表 X 的 <b>${esc(X[i - 1])}</b> 沒有用到，往上走。`, L.pU, { st: s, info: [[`LCS = ${esc(out) || "（還沒有）"}`, "strong"]] }));
          i--;
        } else {
          path[i + "," + j] = "visited"; s[i + "," + j] = "visited";
          r.push(frame(`c[${i}][${j}] 是 ←：這一格的值來自左邊，代表 Y 的 <b>${esc(Y[j - 1])}</b> 沒有用到，往左走。`, L.pL, { st: s, info: [[`LCS = ${esc(out) || "（還沒有）"}`, "strong"]] }));
          j--;
        }
      }
      r.push(frame(`走到第 0 ${i === 0 ? "列" : "行"}，停止。LCS = <b>${esc(out) || "（空字串）"}</b>，長度 ${out.length}，和右下角的 ${c[m][n]} 一致。${tieUp ? "換成「平手往左」再跑一次，同樣長度可能找到不同的 LCS。" : "和「平手往上」比較看看：長度一樣，字元可能不同。"}`, L.pStop, { st: pathSt(), info: [[`LCS = ${esc(out) || "（空）"}`, "strong"], [`長度 ${out.length}`]] }));
      return r.frames;
    }

    const PRESETS = { "STONE / LONGEST": ["STONE", "LONGEST"], "ABAB / BABA": ["ABAB", "BABA"], "沒有共同字元": ["ABC", "XYZ"] };
    const inX = ui.input(player, { placeholder: "X", value: "STONE", width: 96 });
    const inY = ui.input(player, { placeholder: "Y", value: "LONGEST", width: 110 });
    const bad = (el, msg) => {
      el.classList.add("is-error"); setTimeout(() => el.classList.remove("is-error"), 700);
      X = ""; Y = ""; m = 0; n = 0; c = []; b = [];
      player.load([frame(`${iconHTML("alert")} ${msg}`, null)], { autoplay: false });
    };
    const go = () => {
      const x = inX.value.trim().toUpperCase(), y = inY.value.trim().toUpperCase();
      if (!/^[A-Z0-9]{1,7}$/.test(x)) return bad(inX, "X 請輸入 1～7 個英文字母或數字（畫面最多放得下 7 列）。");
      if (!/^[A-Z0-9]{1,8}$/.test(y)) return bad(inY, "Y 請輸入 1～8 個英文字母或數字（畫面最多放得下 8 行）。");
      inX.value = x; inY.value = y;
      player.load(run(x, y));
    };
    ui.button(player, "填表並找 LCS", go);
    const tieBtn = ui.button(player, "平手時：往上", () => {
      tieUp = !tieUp; tieBtn.textContent = tieUp ? "平手時：往上" : "平手時：往左"; go();
    }, "ghost");
    Object.keys(PRESETS).forEach((k) => ui.button(player, k, () => { [inX.value, inY.value] = PRESETS[k]; go(); }, "ghost"));
    [inX, inY].forEach((el) => el.addEventListener("keydown", (e) => e.key === "Enter" && go()));

    const demo = run("STONE", "LONGEST");
    demo[0].caption = iconHTML("play") + " 按播放看示範：X = STONE、Y = LONGEST，一格一格填出 LCS 長度表，再從右下角照箭頭走回去，找到 LCS = ONE。可以輸入自己的字串，或按「ABAB / BABA」再切換「平手時：往上／往左」，看同樣長度的不同 LCS。";
    player.load(demo, { autoplay: false });
  });

  // ===================================================================
  // 靜態圖解
  // ===================================================================
  const box = (id, label, x, y, w, st, h) => ({ id, label, shape: "box", x, y, w, h: h || 34, state: st || "default" });

  // 圖 1：子序列可以跳著選，但順序不能亂
  figure("lcs-subsequence", () => {
    const X = "STONE", Y = "LONGEST", pick = { 2: 1, 3: 2, 4: 4 };   // X 的位置 → Y 的位置
    const nodes = [], edges = [], labels = [];
    const xx = (k) => 200 + k * 54, yx = (k) => 146 + k * 54;
    [...X].forEach((ch, k) => nodes.push(box("x" + k, ch, xx(k), 60, 40, k in pick ? "found" : "muted")));
    [...Y].forEach((ch, k) => nodes.push(box("y" + k, ch, yx(k), 170, 40, Object.values(pick).includes(k) ? "found" : "muted")));
    Object.entries(pick).forEach(([a, b2]) => edges.push({ from: "x" + a, to: "y" + b2, state: "found" }));
    labels.push({ id: "lx", x: 120, y: 66, text: "X", cls: "strong" }, { id: "ly", x: 66, y: 176, text: "Y", cls: "strong" },
      { id: "t1", x: 470, y: 66, text: "LCS = ONE（長度 3）", cls: "ok", anchor: "start" },
      { id: "t2", x: 340, y: 228, text: "連線不能交叉：字元在兩個字串裡的先後順序都要一樣", anchor: "middle" });
    return { width: 680, height: 250, nodes, edges, labels };
  });

  // 圖 2：遞迴式的兩種情況
  figure("lcs-cases", () => {
    const nodes = [], edges = [], labels = [];
    const cell = (id, label, x, y, st) => nodes.push(box(id, label, x, y, 108, st, 40));
    // (a) 相同
    cell("a1", "c[i−1][j−1]", 104, 80, "compare"); cell("a2", "c[i−1][j]", 220, 80, "muted");
    cell("a3", "c[i][j−1]", 104, 130, "muted"); cell("a4", "+1", 220, 130, "found");
    edges.push({ from: "a1", to: "a4", directed: true, state: "found" });
    labels.push({ id: "at", x: 162, y: 36, text: "(a) X[i] = Y[j]", cls: "strong" },
      { id: "ad", x: 162, y: 186, text: "左上 + 1", cls: "ok" },
      { id: "ae", x: 162, y: 208, text: "共同的字元一定放進 LCS" });
    // (b) 不同
    cell("b1", "c[i−1][j−1]", 460, 80, "muted"); cell("b2", "c[i−1][j]", 576, 80, "compare");
    cell("b3", "c[i][j−1]", 460, 130, "compare"); cell("b4", "max", 576, 130, "active");
    edges.push({ from: "b2", to: "b4", directed: true, state: "compare" }, { from: "b3", to: "b4", directed: true, state: "compare" });
    labels.push({ id: "bt", x: 518, y: 36, text: "(b) X[i] ≠ Y[j]", cls: "strong" },
      { id: "bd", x: 518, y: 186, text: "max(上, 左)", cls: "warn" },
      { id: "be", x: 518, y: 208, text: "丟掉 X[i] 或丟掉 Y[j]，取比較好的" });
    return { width: 680, height: 230, nodes, edges, labels };
  });

  // 圖 3：直接遞迴的重複子問題
  figure("lcs-overlap", () => {
    const nodes = [], edges = [], labels = [];
    const T = [
      ["r", "(3,3)", 340, 34, "default"],
      ["a", "(2,3)", 180, 104, "default"], ["b", "(3,2)", 500, 104, "default"],
      ["aa", "(1,3)", 90, 174, "default"], ["ab", "(2,2)", 260, 174, "removed"],
      ["ba", "(2,2)", 420, 174, "removed"], ["bb", "(3,1)", 590, 174, "default"],
      ["aba", "(1,2)", 215, 244, "active"], ["abb", "(2,1)", 305, 244, "active"],
      ["baa", "(1,2)", 375, 244, "active"], ["bab", "(2,1)", 465, 244, "active"],
    ];
    T.forEach(([id, l, x, y, st]) => nodes.push(box(id, l, x, y, 66, st, 32)));
    [["r", "a"], ["r", "b"], ["a", "aa"], ["a", "ab"], ["b", "ba"], ["b", "bb"], ["ab", "aba"], ["ab", "abb"], ["ba", "baa"], ["ba", "bab"]]
      .forEach(([f, t]) => edges.push({ from: f, to: t }));
    labels.push({ id: "n1", x: 340, y: 292, text: "(2,2) 被算了 2 次，它底下的整棵子樹也跟著重算", cls: "warn" });
    return { width: 680, height: 310, nodes, edges, labels };
  });
})();
