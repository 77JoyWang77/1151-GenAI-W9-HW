/* =====================================================================
   Deadlock Avoidance and Banker's Algorithm（死結避免與銀行家演算法）主題的視覺化
   - bankers-sim : 編輯 Available / Max / Allocation，逐步跑安全演算法，
                   或讓某個行程提出請求：先檢查、假裝配置、再試算安全性
   ===================================================================== */
(function () {
  "use strict";
  const { Player, Recorder, ui, register, esc, iconHTML, figure } = window.DSViz;

  // 右側程式碼：從 code/operating-systems/bankers-algorithm.c 原封不動取出
  const CODE = {
    "isSafe": [
      "int isSafe(int seq[]) {",
      "  int Work[M], Finish[N] = {0}, count = 0;",
      "  for (int j = 0; j < m; j++) Work[j] = Available[j];",
      "  while (count < n) {",
      "    int found = -1;",
      "    for (int i = 0; i < n && found == -1; i++)   /* 每輪從 P0 開始，找第一個做得完的 */",
      "      if (!Finish[i] && lessEq(Need[i], Work)) found = i;",
      "    if (found == -1) return 0;                    /* 沒有人做得完：unsafe */",
      "    for (int j = 0; j < m; j++)",
      "      Work[j] += Allocation[found][j];            /* 它做完會歸還全部資源 */",
      "    Finish[found] = 1;",
      "    seq[count++] = found;",
      "  }",
      "  return 1;",
      "}"
    ],
    "isSafeSweep": [
      "int isSafeSweep(int seq[]) {",
      "  int Work[M], Finish[N] = {0}, count = 0, progress = 1;",
      "  for (int j = 0; j < m; j++) Work[j] = Available[j];",
      "  while (progress) {                              /* 整輪都沒人做得完才停 */",
      "    progress = 0;",
      "    for (int i = 0; i < n; i++)",
      "      if (!Finish[i] && lessEq(Need[i], Work)) {",
      "        for (int j = 0; j < m; j++) Work[j] += Allocation[i][j];",
      "        Finish[i] = 1;",
      "        seq[count++] = i;",
      "        progress = 1;",
      "      }",
      "  }",
      "  return count == n;",
      "}"
    ],
    "request": [
      "int request(int p, const int Request[], int seq[]) {",
      "  if (!lessEq(Request, Need[p])) return -1;      /* 要的比當初宣告的還多：錯誤 */",
      "  if (!lessEq(Request, Available)) return -2;    /* 現在的資源不夠：只能等 */",
      "  for (int j = 0; j < m; j++) {                  /* 先假裝配置給它 */",
      "    Available[j] -= Request[j];",
      "    Allocation[p][j] += Request[j];",
      "    Need[p][j] -= Request[j];",
      "  }",
      "  if (isSafe(seq)) return 1;                     /* 配置後仍安全：真的給 */",
      "  for (int j = 0; j < m; j++) {                  /* 不安全：復原，P[p] 等待 */",
      "    Available[j] += Request[j];",
      "    Allocation[p][j] -= Request[j];",
      "    Need[p][j] += Request[j];",
      "  }",
      "  return 0;",
      "}"
    ]
  };
  const SAFE_CODE = CODE.isSafe, SWEEP_CODE = CODE.isSafeSweep;
  const REQ_CODE = CODE.request.concat([""], CODE.isSafe);
  const lnIn = (code) => (s) => code.findIndex((l) => l.includes(s)) + 1;
  function linesFor(code) {
    const ln = lnIn(code);
    return {
      init: [ln("int Work[M], Finish[N]"), ln("Work[j] = Available[j]")],
      cmp: [ln("for (int i = 0; i < n"), ln("lessEq(Need[i], Work)")],
      give: [ln("+= Allocation["), ln(code === SWEEP_CODE ? "Finish[i] = 1" : "Finish[found] = 1"), ln("seq[count++]")],
      fail: [ln("if (found == -1) return 0;")],
      ok: [code === SWEEP_CODE ? ln("return count == n;") : code.findIndex((l) => l.trim() === "return 1;") + 1],
      sweepEnd: [ln("while (progress)")],
    };
  }
  const LS = linesFor(SAFE_CODE), LW = linesFor(SWEEP_CODE), LR = linesFor(REQ_CODE);
  const lnR = lnIn(REQ_CODE);
  LR.head = [lnR("int request(int p")];
  LR.chkNeed = [lnR("if (!lessEq(Request, Need[p]))")];
  LR.chkAvail = [lnR("if (!lessEq(Request, Available))")];
  LR.pretend = [lnR("Available[j] -= Request[j]"), lnR("Allocation[p][j] += Request[j]"), lnR("Need[p][j] -= Request[j]")];
  LR.call = [lnR("if (isSafe(seq)) return 1;")];
  LR.restore = [lnR("Available[j] += Request[j]"), lnR("Allocation[p][j] -= Request[j]"), lnR("Need[p][j] += Request[j]"), REQ_CODE.findIndex((l) => l.trim() === "return 0;") + 1];

  const RES = ["A", "B", "C", "D"];
  const vec = (v) => "(" + v.join(" ") + ")";
  const le = (a, b) => a.every((x, j) => x <= b[j]);

  register("bankers-sim", function (root) {
    const player = new Player(root, {
      title: "Banker's Algorithm 銀行家演算法",
      width: 680, height: 420, code: SAFE_CODE,
      legend: [["compare", "正在比較"], ["removed", "這一項不夠"], ["new", "剛加回／剛改變"], ["found", "做得完（Finish = T）"], ["active", "請求"], ["muted", "已完成的行程"]],
    });

    // ---------- 資料模型 ----------
    let S = null;          // { n, m, avail, max, alloc, need, work, fin, order, req, rp, seq, workName, title }
    function geom() {
      const m = S.m, step = m === 4 ? 34 : 38, cw = m === 4 ? 30 : 34, gap = m === 4 ? 24 : 30, X0 = 96;
      const gx = (g, j) => X0 + g * (m * step + gap) + step / 2 + j * step;
      const finX = gx(2, m - 1) + step / 2 + 44, ordX = finX + 56;
      const rowY = (i) => 92 + i * (S.n > 5 ? 36 : 40), botY = rowY(S.n) + 14;   // 6 個行程時列距縮小，序列才放得下
      return { step, cw, gx, finX, ordX, rowY, botY };
    }

    function frame(caption, line, st = {}) {
      const g = geom(), nodes = [], labels = [], cell = (id, v, x, y, s) =>
        nodes.push({ id, label: String(v), shape: "box", x, y, w: g.cw, h: 30, state: s });
      labels.push({ id: "ttl", x: 20, y: 18, text: S.title, cls: "title", anchor: "start" });
      ["Allocation", "Max", "Need"].forEach((nm, k) => {
        labels.push({ id: "gh" + k, x: (g.gx(k, 0) + g.gx(k, S.m - 1)) / 2, y: 42, text: nm, cls: "strong" });
        for (let j = 0; j < S.m; j++) labels.push({ id: `rh${k}_${j}`, x: g.gx(k, j), y: 64, text: RES[j], cls: "title" });
      });
      labels.push({ id: "fh", x: g.finX, y: 42, text: "Finish", cls: "strong" }, { id: "oh", x: g.ordX, y: 42, text: "順序", cls: "strong" });
      for (let i = 0; i < S.n; i++) {
        const y = g.rowY(i), done = S.fin[i];
        labels.push({ id: "p" + i, x: 50, y, text: "P" + i, cls: st["p" + i] || (done ? "" : "strong"), anchor: "middle" });
        for (let j = 0; j < S.m; j++) {
          cell(`a${i}_${j}`, S.alloc[i][j], g.gx(0, j), y, st[`a${i}_${j}`] || (done ? "muted" : "default"));
          cell(`x${i}_${j}`, S.max[i][j], g.gx(1, j), y, st[`x${i}_${j}`] || (done ? "muted" : "default"));
          cell(`d${i}_${j}`, S.need[i][j], g.gx(2, j), y, st[`d${i}_${j}`] || (done ? "muted" : "default"));
        }
        nodes.push({ id: "f" + i, label: S.fin ? (done ? "T" : "F") : "", shape: "box", x: g.finX, y, w: 40, h: 30, state: st["f" + i] || (done ? "found" : "default") });
        if (S.order[i]) labels.push({ id: "o" + i, x: g.ordX, y, text: "第 " + S.order[i] + " 個", cls: "ok" });
      }
      const by = g.botY + 26;
      if (S.work) {
        labels.push({ id: "wl", x: g.gx(0, 0) - 30, y: by, text: S.workName, cls: "strong", anchor: "end" });
        for (let j = 0; j < S.m; j++) cell("w" + j, S.work[j], g.gx(0, j), by, st["w" + j] || "compare");
      }
      if (S.req) {
        labels.push({ id: "ql", x: g.gx(2, 0) - 30, y: by, text: "Request P" + S.rp, cls: "strong", anchor: "end" });
        for (let j = 0; j < S.m; j++) cell("q" + j, S.req[j], g.gx(2, j), by, st["q" + j] || "active");
      }
      if (S.seq.length) labels.push({ id: "seq", x: 20, y: by + 42, text: (S.seqDone ? "安全序列：" : "目前序列：") + S.seq.map((i) => "P" + i).join(" → "), cls: S.seqBad ? "warn" : "strong", anchor: "start" });
      return { nodes, edges: [], labels, caption, line };
    }

    function setup(av, mx, al, title) {
      const n = mx.length, m = av.length;
      S = { n, m, avail: av.slice(), max: mx.map((r) => r.slice()), alloc: al.map((r) => r.slice()),
        need: mx.map((r, i) => r.map((x, j) => x - al[i][j])), work: null, fin: Array(n).fill(false),
        order: Array(n).fill(0), req: null, rp: -1, seq: [], seqDone: false, seqBad: false, workName: "Work", title };
    }

    // 逐步記錄安全演算法；sweep = true 時找到之後不回頭
    function safety(r, L, sweep, pre) {
      S.work = S.avail.slice(); S.workName = "Work"; S.fin.fill(false); S.order.fill(0); S.seq = []; S.seqDone = false;
      r.push(frame(`${pre}Work 先設成 Available = ${vec(S.work)}，所有 Finish 都是 F。接下來要找：誰的 Need ≤ Work，也就是「用現在手上的資源就能讓它跑完」。`, L.init));
      const tryRow = (i) => {
        const bad = S.need[i].map((x, j) => x > S.work[j]), st = { ["p" + i]: "warn" };
        for (let j = 0; j < S.m; j++) { st[`d${i}_${j}`] = bad[j] ? "removed" : "compare"; if (bad[j]) st["w" + j] = "removed"; }
        if (bad.some(Boolean)) {
          const js = bad.map((b, j) => (b ? j : -1)).filter((j) => j >= 0);
          r.push(frame(`${pre}看 P${i}：Need = ${vec(S.need[i])}，但 ${js.map((j) => `${RES[j]} 要 ${S.need[i][j]} > Work 只有 ${S.work[j]}`).join("、")}。現在給不起它最多可能要的量，<b>先跳過</b>，看下一個。`, L.cmp, st));
          return false;
        }
        r.push(frame(`${pre}看 P${i}：Need = ${vec(S.need[i])} ≤ Work = ${vec(S.work)}，每一項都夠。就算它把剩下的需求一次要滿，也能跑完。`, L.cmp, st));
        const old = S.work.slice();
        S.work = S.work.map((x, j) => x + S.alloc[i][j]); S.fin[i] = true; S.seq.push(i); S.order[i] = S.seq.length;
        const st2 = { ["f" + i]: "found" };
        for (let j = 0; j < S.m; j++) { st2[`a${i}_${j}`] = "new"; st2["w" + j] = "new"; }
        r.push(frame(`${pre}P${i} 跑完會把手上的 Allocation ${vec(S.alloc[i])} 全部還回來：Work = ${vec(old)} + ${vec(S.alloc[i])} = <b>${vec(S.work)}</b>，Finish[P${i}] = T，排在序列第 ${S.seq.length} 個。`, L.give, st2));
        return true;
      };
      const stuck = () => {
        const st = {};
        S.fin.forEach((f, i) => { if (!f) st["f" + i] = "removed"; });
        S.seqBad = true;
        r.push(frame(`${pre}剩下的 ${S.fin.map((f, i) => (f ? null : "P" + i)).filter(Boolean).join("、")} 每一個的 Need 都有某一項大於 Work = ${vec(S.work)}，<b>找不到能跑完的行程</b>，所以這個狀態是 <b>unsafe</b>。`, L.fail, st));
        return false;
      };
      if (!sweep) {
        while (S.seq.length < S.n) {
          let found = false;
          for (let i = 0; i < S.n && !found; i++) if (!S.fin[i]) found = tryRow(i);
          if (!found) return stuck();
        }
      } else {
        let progress = true;
        while (progress) {
          progress = false;
          for (let i = 0; i < S.n; i++) if (!S.fin[i] && tryRow(i)) progress = true;
          if (progress && S.seq.length < S.n) r.push(frame(`${pre}這一輪掃到底，有行程完成、Work 變大了，所以<b>從 P0 再掃一輪</b>，剛才做不完的可能現在做得完。`, L.sweepEnd));
          if (S.seq.length === S.n) break;
        }
        if (S.seq.length < S.n) { const st = {}; S.fin.forEach((f, i) => { if (!f) st["f" + i] = "removed"; }); S.seqBad = true;
          r.push(frame(`${pre}整整一輪都沒有人完成（progress = 0），剩下的行程永遠等不到足夠的資源：<b>unsafe</b>。`, L.ok, st)); return false; }
      }
      S.seqDone = true;
      const st = {}; S.fin.forEach((f, i) => (st["f" + i] = "found"));
      r.push(frame(`${pre}所有 Finish 都是 T：<b>safe</b>，安全序列 ${S.seq.map((i) => "P" + i).join(" → ")}。最後 Work = ${vec(S.work)}，正好是每種資源的總量（Available 加上所有人的 Allocation），可以拿來驗算。`, L.ok, st));
      return true;
    }

    let sweep = false;
    function runSafety(av, mx, al) {
      const code = sweep ? SWEEP_CODE : SAFE_CODE, L = sweep ? LW : LS;
      player.setCode(code);
      setup(av, mx, al, sweep ? "安全演算法（找到後接著往下掃）" : "安全演算法（每輪從 P0 開始找）");
      const r = new Recorder();
      r.push(frame(`Need = Max − Allocation：例如 P0 的 Need = ${vec(S.max[0])} − ${vec(S.alloc[0])} = ${vec(S.need[0])}，代表 P0 最多還可能再要這麼多。Available = ${vec(S.avail)}。`, null));
      safety(r, L, sweep, "");
      return r.frames;
    }

    function runRequest(av, mx, al, p, q) {
      player.setCode(REQ_CODE);
      setup(av, mx, al, `資源請求：P${p} 要求 ${vec(q)}`);
      S.work = S.avail.slice(); S.workName = "Available"; S.req = q; S.rp = p;
      const r = new Recorder(), rowSt = (pre, s) => { const st = { ["p" + p]: "warn" }; for (let j = 0; j < S.m; j++) st[pre + p + "_" + j] = s; return st; };
      r.push(frame(`P${p} 提出請求 Request = ${vec(q)}。銀行家不會因為「現在夠」就直接給，要先檢查兩件事，再試算給了之後還安不安全。`, LR.head, rowSt("d", "compare")));
      const overN = q.map((x, j) => x > S.need[p][j]);
      const st1 = rowSt("d", "compare"); overN.forEach((b, j) => { if (b) { st1["q" + j] = "removed"; st1[`d${p}_${j}`] = "removed"; } });
      if (overN.some(Boolean)) {
        r.push(frame(`檢查一：Request ≤ Need[P${p}] = ${vec(S.need[p])}？${overN.map((b, j) => (b ? `${RES[j]} 要 ${q[j]} > Need ${S.need[p][j]}` : "")).filter(Boolean).join("、")}。它要的比當初宣告的最大需求還多，這是<b>錯誤</b>（回傳 -1），不是等待。`, LR.chkNeed, st1));
        return r.frames;
      }
      r.push(frame(`檢查一：Request = ${vec(q)} ≤ Need[P${p}] = ${vec(S.need[p])}，沒有超過它宣告的最大需求，通過。`, LR.chkNeed, st1));
      const overA = q.map((x, j) => x > S.avail[j]), st2 = {};
      for (let j = 0; j < S.m; j++) st2["w" + j] = overA[j] ? "removed" : "compare";
      overA.forEach((b, j) => b && (st2["q" + j] = "removed"));
      if (overA.some(Boolean)) {
        r.push(frame(`檢查二：Request ≤ Available = ${vec(S.avail)}？${overA.map((b, j) => (b ? `${RES[j]} 要 ${q[j]} > 只剩 ${S.avail[j]}` : "")).filter(Boolean).join("、")}。現在根本拿不出來，P${p} 只能<b>等待</b>（回傳 -2）。`, LR.chkAvail, st2));
        return r.frames;
      }
      r.push(frame(`檢查二：Request = ${vec(q)} ≤ Available = ${vec(S.avail)}，資源現在拿得出來，通過。但「拿得出來」不等於「可以給」，還要看給了會不會變 unsafe。`, LR.chkAvail, st2));
      const old = { av: S.avail.slice(), al: S.alloc[p].slice(), nd: S.need[p].slice() };
      S.avail = S.avail.map((x, j) => x - q[j]); S.alloc[p] = S.alloc[p].map((x, j) => x + q[j]); S.need[p] = S.need[p].map((x, j) => x - q[j]); S.work = S.avail.slice();
      const st3 = {}; for (let j = 0; j < S.m; j++) { st3["w" + j] = "new"; st3[`a${p}_${j}`] = "new"; st3[`d${p}_${j}`] = "new"; }
      r.push(frame(`<b>假裝配置</b>：Available ${vec(old.av)} → ${vec(S.avail)}、Allocation[P${p}] ${vec(old.al)} → ${vec(S.alloc[p])}、Need[P${p}] ${vec(old.nd)} → ${vec(S.need[p])}。接著對這個假想的狀態跑安全演算法。`, LR.pretend, st3));
      S.req = null;
      const ok = safety(r, LR, false, "試算：");
      if (ok) {
        r.push(frame(`試算結果是 safe，所以<b>真的配置</b>給 P${p}（回傳 1），系統停在新的狀態 Available = ${vec(S.avail)}。`, LR.call));
      } else {
        S.avail = old.av; S.alloc[p] = old.al; S.need[p] = old.nd; S.work = S.avail.slice(); S.workName = "Available";
        S.fin.fill(false); S.order.fill(0); S.req = q;
        const st4 = {}; for (let j = 0; j < S.m; j++) { st4["w" + j] = "new"; st4[`a${p}_${j}`] = "new"; st4[`d${p}_${j}`] = "new"; }
        r.push(frame(`給了會進入 unsafe，所以<b>復原</b>剛才的假裝配置，P${p} 等待（回傳 0）。注意：資源明明拿得出來，還是不給，這就是「避免」的代價。`, LR.restore, st4));
      }
      return r.frames;
    }

    // ---------- 輸入 ----------
    const PRE = {
      safe: ["2 2 2", "5 3 2; 3 2 2; 2 4 3; 4 1 4; 6 3 3", "1 1 0; 2 0 1; 0 2 1; 3 0 2; 1 1 1"],
      unsafe: ["1 1 2", "5 3 2; 3 2 2; 2 4 3; 4 1 4; 6 3 3", "1 1 0; 2 0 1; 0 2 1; 3 0 2; 1 1 1"],
    };
    const inAv = ui.input(player, { placeholder: "Available", value: PRE.safe[0], width: 70 });
    const inMx = ui.input(player, { placeholder: "Max：每列用分號隔開", value: PRE.safe[1], width: 210 });
    const inAl = ui.input(player, { placeholder: "Allocation：每列用分號隔開", value: PRE.safe[2], width: 210 });
    const inP = ui.input(player, { placeholder: "行程", value: "3", width: 44 });
    const inQ = ui.input(player, { placeholder: "Request", value: "1 0 1", width: 70 });

    const bad = (el, msg) => {
      el.classList.add("is-error"); setTimeout(() => el.classList.remove("is-error"), 700);
      player.load([{ nodes: [], edges: [], labels: [], caption: `${iconHTML("alert")} ${msg}`, line: null }], { autoplay: false });
      return null;
    };
    const nums = (s) => s.trim().split(/[\s,]+/).filter(Boolean);
    const okNum = (t) => /^\d{1,2}$/.test(t) && Number(t) <= 20;
    function read() {
      const a = nums(inAv.value);
      if (a.length < 1 || a.length > 4 || !a.every(okNum)) return bad(inAv, "Available 請輸入 1～4 個 0～20 的整數（一種資源一個數字），用空白隔開。");
      const m = a.length, av = a.map(Number);
      const mat = (el, nm) => {
        const rows = el.value.split(";").map((x) => x.trim()).filter(Boolean);
        if (rows.length < 2 || rows.length > 6) return bad(el, `${nm} 請輸入 2～6 列（一個行程一列），列與列之間用分號隔開。`);
        const out = [];
        for (let i = 0; i < rows.length; i++) {
          const t = nums(rows[i]);
          if (t.length !== m || !t.every(okNum)) return bad(el, `${nm} 第 ${i + 1} 列（P${i}）要剛好 ${m} 個 0～20 的整數，和 Available 的資源種類數一樣。`);
          out.push(t.map(Number));
        }
        return out;
      };
      const mx = mat(inMx, "Max"); if (!mx) return null;
      const al = mat(inAl, "Allocation"); if (!al) return null;
      if (al.length !== mx.length) return bad(inAl, `Allocation 有 ${al.length} 列，Max 有 ${mx.length} 列，行程數要一樣。`);
      for (let i = 0; i < mx.length; i++) for (let j = 0; j < m; j++)
        if (al[i][j] > mx[i][j]) return bad(inAl, `P${i} 的 Allocation 第 ${RES[j]} 項（${al[i][j]}）大於 Max（${mx[i][j]}）：已經拿到的不可能超過宣告的最大需求。`);
      return { av, mx, al };
    }
    function goSafe() { const d = read(); if (d) player.load(runSafety(d.av, d.mx, d.al)); }
    function goReq() {
      const d = read(); if (!d) return;
      const p = inP.value.trim().replace(/^P/i, "");
      if (!/^\d$/.test(p) || Number(p) >= d.mx.length) return bad(inP, `行程請輸入 0～${d.mx.length - 1} 的編號（例如 3 代表 P3）。`);
      const q = nums(inQ.value);
      if (q.length !== d.av.length || !q.every(okNum)) return bad(inQ, `Request 要剛好 ${d.av.length} 個 0～20 的整數，一種資源一個。`);
      player.load(runRequest(d.av, d.mx, d.al, Number(p), q.map(Number)));
    }
    const fill = (k) => { [inAv.value, inMx.value, inAl.value] = PRE[k]; };
    ui.button(player, "安全檢查", goSafe);
    ui.button(player, "提出請求", goReq);
    const tg = ui.button(player, "掃描：每輪從 P0", () => {
      sweep = !sweep; tg.textContent = sweep ? "掃描：接著往下" : "掃描：每輪從 P0"; goSafe();
    }, "ghost");
    ui.button(player, "unsafe 範例", () => { fill("unsafe"); goSafe(); }, "ghost");
    ui.button(player, "請求被拒", () => { fill("safe"); inP.value = "4"; inQ.value = "2 0 0"; goReq(); }, "ghost");
    ui.button(player, "請求超過 Need", () => { fill("safe"); inP.value = "1"; inQ.value = "0 3 0"; goReq(); }, "ghost");
    [inAv, inMx, inAl].forEach((el) => el.addEventListener("keydown", (e) => e.key === "Enter" && goSafe()));
    [inP, inQ].forEach((el) => el.addEventListener("keydown", (e) => e.key === "Enter" && goReq()));

    const demo = runSafety(...PRE.safe.map((s, k) => (k === 0 ? nums(s).map(Number) : s.split(";").map((x) => nums(x).map(Number)))));
    demo[0].caption = iconHTML("play") + " 按播放看示範：5 個行程、3 種資源，每輪從 P0 開始找第一個 Need ≤ Work 的行程，最後得到安全序列 P1 → P0 → P2 → P3 → P4。改用「掃描：接著往下」會得到另一個安全序列；「提出請求」用第 4、5 個輸入框（行程編號、請求向量），預設是 P3 要求 (1 0 1)。";
    player.load(demo, { autoplay: false });
  });

  // ===================================================================
  // 靜態圖解
  // ===================================================================
  const box = (id, label, x, y, w, h, st) => ({ id, label, shape: "box", x, y, w, h, state: st || "default" });

  // 圖 1：safe、unsafe、deadlock 三種狀態的關係
  figure("bankers-state-space", () => ({
    width: 680, height: 270,
    nodes: [
      box("all", "", 340, 128, 640, 224, "ghost"),
      box("safeR", "", 175, 140, 270, 160, "ghost"),
      box("unsafeR", "", 495, 140, 290, 160, "ghost"),
      box("safe", "safe state", 175, 88, 150, 34, "found"),
      box("unsafe", "unsafe state", 495, 88, 160, 34, "active"),
      box("dead", "deadlock", 540, 186, 150, 50, "removed"),
    ],
    edges: [],
    labels: [
      { id: "t0", x: 36, y: 36, text: "所有可能的狀態", cls: "title", anchor: "start" },
      { id: "t2", x: 175, y: 134, text: "存在安全序列" },
      { id: "t3", x: 175, y: 158, text: "一定不會死結" },
      { id: "t4", x: 175, y: 194, text: "銀行家只讓系統停在這裡", cls: "ok" },
      { id: "t6", x: 495, y: 130, text: "找不到安全序列，可能死結" },
      { id: "t7", x: 432, y: 186, text: "還沒死結", anchor: "middle" },
      { id: "t8", x: 340, y: 258, text: "deadlock ⊂ unsafe；unsafe 不一定 deadlock", cls: "warn" },
    ],
  }));

  // 圖 2：單一資源時的 claim edge
  figure("bankers-claim-edge", () => {
    const nodes = [], edges = [], labels = [];
    const panel = (k, dx, granted) => {
      const P1 = k + "P1", P2 = k + "P2", R1 = k + "R1", R2 = k + "R2";
      nodes.push({ id: P1, label: "P1", x: dx + 70, y: 80, state: "compare" }, { id: P2, label: "P2", x: dx + 250, y: 210, state: "compare" },
        box(R1, "R1", dx + 70, 210, 48, 40), box(R2, "R2", dx + 250, 80, 48, 40, granted ? "default" : "default"));
      edges.push({ from: R1, to: P1, directed: true, state: granted ? "active" : "default" });
      edges.push({ from: P1, to: R2, directed: true, dashed: true, state: granted ? "active" : "muted" });
      edges.push({ from: P2, to: R1, directed: true, dashed: true, state: granted ? "active" : "muted" });
      if (granted) edges.push({ from: R2, to: P2, directed: true, state: "removed" });
      else edges.push({ from: P2, to: R2, directed: true, state: "compare" });
      labels.push(
        { id: k + "l1", x: dx + 50, y: 145, text: "持有", anchor: "end" },
        { id: k + "l2", x: dx + 160, y: 66, text: "claim", anchor: "middle" },
        { id: k + "l3", x: dx + 160, y: 230, text: "claim", anchor: "middle" },
        { id: k + "l4", x: dx + 270, y: 145, text: granted ? "假設配置" : "提出請求", anchor: "start", cls: granted ? "warn" : "" });
    };
    panel("a", 20, false);
    panel("b", 360, true);
    labels.push({ id: "ta", x: 180, y: 24, text: "(a) P2 請求 R2（R2 目前空著）", cls: "strong" },
      { id: "tb", x: 520, y: 24, text: "(b) 如果配置：出現環", cls: "strong" },
      { id: "ua", x: 180, y: 262, text: "虛線：claim edge（將來可能要）" },
      { id: "ub", x: 520, y: 262, text: "P1 → R2 → P2 → R1 → P1，不給", cls: "warn" });
    return { width: 680, height: 280, nodes, edges, labels };
  });

  // 圖 3：安全演算法中 Work 怎麼一路變大
  figure("bankers-work-chain", () => {
    const W = [[2, 2, 2], [4, 2, 3], [5, 3, 3], [5, 5, 4], [8, 5, 6], [9, 6, 7]];
    const P = [[1, "2 0 1"], [0, "1 1 0"], [2, "0 2 1"], [3, "3 0 2"], [4, "1 1 1"]];
    const nodes = [], edges = [], labels = [];
    W.forEach((w, k) => {
      nodes.push(box("w" + k, w.join(" "), 60 + k * 112, 110, 84, 36, k === 0 ? "compare" : k === 5 ? "found" : "default"));
      if (k) {
        edges.push({ from: "w" + (k - 1), to: "w" + k, directed: true, state: "visited" });
        labels.push({ id: "p" + k, x: 4 + k * 112, y: 70, text: "P" + P[k - 1][0] + " 做完", cls: "strong" },
          { id: "q" + k, x: 4 + k * 112, y: 152, text: "+(" + P[k - 1][1] + ")" });
      }
    });
    labels.push({ id: "s", x: 60, y: 24, text: "Work 初值 = Available", cls: "title", anchor: "start" },
      { id: "e", x: 620, y: 24, text: "= 資源總量", cls: "title", anchor: "end" },
      { id: "c", x: 340, y: 196, text: "每完成一個行程，Work 加上它的 Allocation（不是 Need）", cls: "warn" });
    return { width: 680, height: 214, nodes, edges, labels };
  });
})();
