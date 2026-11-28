/* =====================================================================
   Control Hazards and Branch Prediction（控制危障與分支預測）主題的視覺化
   - branch-timing    : 選分支在哪一級決定、處理做法（stall / predict-not-taken /
                        predict-taken / delayed branch）與實際結果，逐週期看 IF 抓了什麼、哪些被 flush
   - branch-predictor : 輸入 T/N 序列或迴圈次數，選 1-bit / 2-bit（飽和、跳躍）與初始狀態，
                        逐次看預測、實際、狀態轉移與累計正確率
   - 靜態圖：決定階段與 penalty、delay slot 三種填法、1-bit／2-bit 狀態圖、
             跳躍版 2-bit、迴圈的 1-bit／2-bit 預測對照、BTB
   右側程式碼由 .work/gen_viz.py 從 code/computer-organization/control-hazards.c 原封不動抽出
   ===================================================================== */
(function () {
  "use strict";
  const { Player, Recorder, ui, register, esc, iconHTML, figure } = window.DSViz;

  const CODE_TIMING = [
      "int fetchTrace(Strategy st, int resolve, int taken, Fetch *out, int n) {",
      "  int lost = 0, seq = 1, tgt = 1;",
      "  snprintf(out[0].name, sizeof out[0].name, \"beq\");",
      "  out[0].cycle = 1;",
      "  out[0].flushed = 0;",
      "  for (int c = 2; c <= n; c++) {",
      "    Fetch *f = &out[c - 1];",
      "    f->cycle = c;",
      "    f->flushed = 0;",
      "    if (c > resolve) {                              /* 結果已知：照實際方向抓 */",
      "      if (taken) snprintf(f->name, sizeof f->name, \"t%d\", tgt++);",
      "      else snprintf(f->name, sizeof f->name, \"i+%d\", seq++);",
      "    } else if (st == DELAYED && c == 2) {           /* delay slot：不管跳不跳都執行 */",
      "      snprintf(f->name, sizeof f->name, \"slot\");",
      "      seq = 2;                                      /* slot 就是原本的 i+1 */",
      "    } else if (st == STALL || st == DELAYED) {      /* 還不知道：什麼都不抓 */",
      "      snprintf(f->name, sizeof f->name, \"bubble\");",
      "      lost++;",
      "    } else if (st == PREDICT_NT) {                  /* 猜不跳：照常抓 PC + 4 */",
      "      snprintf(f->name, sizeof f->name, \"i+%d\", seq++);",
      "      if (taken) { f->flushed = 1; lost++; }",
      "    } else {                                        /* 猜跳：BTB 在 IF 就給出目標 */",
      "      snprintf(f->name, sizeof f->name, \"t%d\", tgt++);",
      "      if (!taken) { f->flushed = 1; lost++; }",
      "    }",
      "  }",
      "  return lost;",
      "}"
  ];
  const CODE_PRED = [
      "int predictTaken(Kind k, int s) {",
      "  if (k == ONE_BIT) return s == 1;",
      "  return s >= 2;                                    /* 2 和 3 預測 taken */",
      "}",
      "",
      "int nextState(Kind k, int s, int taken) {",
      "  if (k == ONE_BIT) return taken;                   /* 只記住上一次的結果 */",
      "  if (k == TWO_BIT_JUMP) {                          /* 跳躍版：弱狀態猜錯直接跳到另一邊的強狀態 */",
      "    if (taken && s == 1) return 3;",
      "    if (!taken && s == 2) return 0;",
      "  }",
      "  if (taken) return s < 3 ? s + 1 : 3;              /* 飽和計數器：往上加，最多到 3 */",
      "  return s > 0 ? s - 1 : 0;                         /* 往下減，最少到 0 */",
      "}",
      "",
      "int runPredictor(Kind k, int *state, const int *outcome, int n, int verbose) {",
      "  int correct = 0;",
      "  for (int i = 0; i < n; i++) {",
      "    int p = predictTaken(k, *state);",
      "    if (p == outcome[i]) correct++;",
      "    if (verbose)",
      "      printf(\"  #%-2d 狀態 %d 預測 %c 實際 %c %s\\n\", i + 1, *state,",
      "             p ? 'T' : 'N', outcome[i] ? 'T' : 'N', p == outcome[i] ? \"對\" : \"錯\");",
      "    *state = nextState(k, *state, outcome[i]);",
      "  }",
      "  return correct;",
      "}"
  ];

  const STAGE = ["", "IF", "ID", "EX", "MEM", "WB"];
  const dot = (id, x, y) => ({ id, label: "", shape: "circle", r: 1, x, y, state: "muted" });

  // =====================================================================
  // 共用：分支後面 IF 抓了什麼（和 C 程式的 fetchTrace() 相同）
  // =====================================================================
  const STRAT = ["stall", "predict-not-taken", "predict-taken", "delayed"];
  const STRAT_ZH = { stall: "一律 stall", "predict-not-taken": "predict-not-taken（猜不跳）", "predict-taken": "predict-taken（猜跳，BTB 給目標）", delayed: "delayed branch（1 個 delay slot）" };
  function fetchTrace(st, resolve, taken, n) {
    const out = [{ name: "beq", cycle: 1, flushed: false, kind: "beq" }];
    let lost = 0, seq = 1, tgt = 1;
    for (let c = 2; c <= n; c++) {
      const f = { cycle: c, flushed: false };
      if (c > resolve) {
        if (taken) { f.name = "t" + tgt++; f.kind = "after"; } else { f.name = "i+" + seq++; f.kind = "after"; }
      } else if (st === "delayed" && c === 2) {
        f.name = "slot"; f.kind = "slot"; seq = 2;
      } else if (st === "stall" || st === "delayed") {
        f.name = "bubble"; f.kind = "bubble"; lost++;
      } else if (st === "predict-not-taken") {
        f.name = "i+" + seq++; f.kind = "guess";
        if (taken) { f.flushed = true; lost++; }
      } else {
        f.name = "t" + tgt++; f.kind = "guess";
        if (!taken) { f.flushed = true; lost++; }
      }
      out.push(f);
    }
    return { rows: out, lost };
  }

  // ---------- 圖 1：分支在哪一級決定 ----------
  figure("control-hazards-resolve", () => {
    const X0 = 170, CW = 58, Y0 = 70, RH = 44;
    const cx = (c) => X0 + (c - 0.5) * CW;
    const nodes = [], labels = [], edges = [];
    for (let c = 1; c <= 7; c++) labels.push({ id: "c" + c, x: cx(c), y: 40, text: "週期 " + c, anchor: "middle" });
    const rows = [["beq", 1], ["i+1", 2], ["i+2", 3], ["i+3", 4]];
    const st = { ID: "compare", EX: "active", MEM: "removed" };
    rows.forEach(([nm, f], j) => {
      labels.push({ id: "n" + j, x: 14, y: Y0 + j * RH, text: j === 0 ? "beq（分支）" : nm + "（猜不跳時抓的）", anchor: "start", cls: j === 0 ? "strong" : "" });
      for (let s = 1; s <= 5; s++) {
        const c = f + s - 1;
        if (c > 7) break;
        if (j > 0 && s > 1) continue;                       // 後面幾條只畫 IF，看它們在哪個週期被抓
        let state = "default";
        if (j === 0 && s >= 2 && s <= 4) state = st[STAGE[s]];
        if (j > 0) state = ["", "compare", "active", "removed"][j];
        nodes.push({ id: `r${j}_${s}`, label: STAGE[s], shape: "box", x: cx(c), y: Y0 + j * RH, w: CW - 6, h: 32, state });
      }
    });
    const ty = Y0 + 4 * RH + 6;
    labels.push({ id: "t1", x: 14, y: ty, text: "ID 結束決定（藍）：只有 i+1 已經抓了 → penalty 1", anchor: "start" });
    labels.push({ id: "t2", x: 14, y: ty + 24, text: "EX 結束決定（橘）：i+1、i+2 已經抓了 → penalty 2", anchor: "start" });
    labels.push({ id: "t3", x: 14, y: ty + 48, text: "MEM 結束決定（紅）：i+1～i+3 都抓了 → penalty 3", anchor: "start" });
    return { width: 600, height: ty + 66, nodes, edges, labels };
  });

  // ---------- 圖 2：delay slot 的三種填法 ----------
  figure("control-hazards-delay-slot", () => {
    const nodes = [], edges = [], labels = [];
    const col = [110, 330, 550], W = 196, H = 34;
    const heads = ["(a) from before", "(b) from target", "(c) from fall-through"];
    heads.forEach((t, i) => labels.push({ id: "h" + i, x: col[i], y: 24, text: t, cls: "title" }));
    // (a)
    const a = [["a1", "add $s1,$s2,$s3", 70, "active"], ["a2", "beq $s2,$0,L", 120, "default"], ["a3", "slot：add", 170, "new"]];
    // (b)
    const b = [["b0", "L: sub $t4,$t5,$t6", 70, "active"], ["b1", "add $s1,$s2,$s3", 120, "default"], ["b2", "beq $s1,$0,L", 170, "default"], ["b3", "slot：sub", 220, "new"]];
    // (c)
    const cc = [["c1", "add $s1,$s2,$s3", 70, "default"], ["c2", "beq $s1,$0,L", 120, "default"], ["c3", "slot：or", 170, "new"], ["c4", "or $t7,$t8,$t9", 220, "active"]];
    [[a, 0], [b, 1], [cc, 2]].forEach(([arr, i]) => arr.forEach(([id, t, y, s]) => nodes.push({ id, label: t, shape: "box", x: col[i], y, w: W, h: H, state: s })));
    nodes.push(dot("ad1", col[0] + 108, 70), dot("ad2", col[0] + 108, 170));
    edges.push({ from: "a1", to: "ad1" }, { from: "ad1", to: "ad2" }, { from: "ad2", to: "a3", directed: true, state: "active" });
    nodes.push(dot("bd1", col[1] + 108, 70), dot("bd2", col[1] + 108, 220));
    edges.push({ from: "b0", to: "bd1" }, { from: "bd1", to: "bd2" }, { from: "bd2", to: "b3", directed: true, state: "active" });
    nodes.push(dot("cd1", col[2] + 108, 220), dot("cd2", col[2] + 108, 170));
    edges.push({ from: "c4", to: "cd1" }, { from: "cd1", to: "cd2" }, { from: "cd2", to: "c3", directed: true, state: "active" });
    const notes = [
      ["一定最好：分支結果和它無關", "（add 不能寫 beq 要比較的暫存器）"],
      ["跳的時候才有用；不跳時白做，", "所以 $t4 在不跳的路上不能被讀"],
      ["不跳的時候才有用；跳的時候白做，", "所以 $t7 在目標那條路上不能被讀"],
    ];
    notes.forEach(([l1, l2], i) => {
      labels.push({ id: "m" + i, x: col[i], y: 262, text: l1 });
      labels.push({ id: "q" + i, x: col[i], y: 284, text: l2 });
    });
    return { width: 660, height: 304, nodes, edges, labels };
  });

  // =====================================================================
  // 共用：預測器狀態圖（狀態：2-bit 3 = 強T、2 = 弱T、1 = 弱N、0 = 強N；1-bit 1 = T、0 = N）
  // =====================================================================
  const KIND = ["sat", "jump", "one"];
  const KIND_ZH = { sat: "2-bit 飽和計數器", jump: "2-bit 跳躍版", one: "1-bit" };
  const BITS = (k, s) => (k === "one" ? String(s) : ["00", "01", "10", "11"][s]);
  const SNAME = (k, s) => (k === "one" ? (s ? "上次 taken" : "上次 not taken") : ["強 not taken", "弱 not taken", "弱 taken", "強 taken"][s]);
  const predictTaken = (k, s) => (k === "one" ? s === 1 : s >= 2);
  function nextState(k, s, t) {
    if (k === "one") return t ? 1 : 0;
    if (k === "jump") {
      if (t && s === 1) return 3;
      if (!t && s === 2) return 0;
    }
    if (t) return s < 3 ? s + 1 : 3;
    return s > 0 ? s - 1 : 0;
  }

  /** 畫狀態圖。ox 是最左邊狀態的中心 x，oy 是中心 y；cur / to：目前狀態、這一步轉到的狀態；via：這一步走的邊 */
  function fsm(k, ox, oy, opt = {}) {
    const P = opt.prefix || "f";
    const nodes = [], edges = [], labels = [];
    const GAP = 150, BW = 112, BH = 44;
    const states = k === "one" ? [0, 1] : [0, 1, 2, 3];
    const x = (s) => ox + (k === "one" ? (s + 1) * GAP : s * GAP);
    states.forEach((s) => {
      let st = "default";
      if (opt.to !== undefined && s === opt.to && s !== opt.cur) st = "new";
      if (s === opt.cur) st = "compare";
      nodes.push({ id: `${P}s${s}`, label: `${BITS(k, s)} ${k === "one" ? (s ? "猜T" : "猜N") : ["強N", "弱N", "弱T", "強T"][s]}`, shape: "box", x: x(s), y: oy, w: BW, h: BH, state: st });
    });
    const est = (from, to, t) => (opt.via && opt.via[0] === from && opt.via[1] === to && opt.via[2] === t ? "active" : "default");
    // 相鄰兩個狀態之間：T 往右（上方車道）、N 往左（下方車道）
    const adj = (a, b) => {
      const xa = x(a) + BW / 2 + 3, xb = x(b) - BW / 2 - 3;
      nodes.push(dot(`${P}t${a}a`, xa, oy - 10), dot(`${P}t${a}b`, xb, oy - 10), dot(`${P}n${a}a`, xb, oy + 10), dot(`${P}n${a}b`, xa, oy + 10));
      edges.push({ from: `${P}t${a}a`, to: `${P}t${a}b`, directed: true, state: est(a, b, 1) });
      edges.push({ from: `${P}n${a}a`, to: `${P}n${a}b`, directed: true, state: est(b, a, 0) });
      labels.push({ id: `${P}lt${a}`, x: (xa + xb) / 2, y: oy - 24, text: "T" });
      labels.push({ id: `${P}ln${a}`, x: (xa + xb) / 2, y: oy + 24, text: "N" });
    };
    if (k === "one") adj(0, 1);
    else {
      adj(0, 1);
      adj(2, 3);
      if (k === "sat") adj(1, 2);
      else {
        // 跳躍版：弱N 遇 T 直接到強T（上方繞過去），弱T 遇 N 直接到強N（下方繞過去）
        const yU = oy - 54, yD = oy + 54;
        nodes.push(dot(`${P}u1`, x(1), yU), dot(`${P}u2`, x(3), yU), dot(`${P}d1`, x(2), yD), dot(`${P}d2`, x(0), yD));
        const su = est(1, 3, 1), sd = est(2, 0, 0);
        edges.push({ from: `${P}s1`, to: `${P}u1`, state: su }, { from: `${P}u1`, to: `${P}u2`, state: su }, { from: `${P}u2`, to: `${P}s3`, directed: true, state: su });
        edges.push({ from: `${P}s2`, to: `${P}d1`, state: sd }, { from: `${P}d1`, to: `${P}d2`, state: sd }, { from: `${P}d2`, to: `${P}s0`, directed: true, state: sd });
        labels.push({ id: `${P}lu`, x: x(2), y: yU - 12, text: "T：弱N 直接跳到強T" });
        labels.push({ id: `${P}ld`, x: x(1), y: yD + 12, text: "N：弱T 直接跳到強N" });
      }
    }
    // 自己轉回自己：寫在不會撞到繞線的那一側
    const lo = states[0], hi = states[states.length - 1];
    const selfSt = (s, t) => (opt.via && opt.via[0] === s && opt.via[1] === s && opt.via[2] === t ? "warn" : "");
    labels.push({ id: `${P}self0`, x: x(lo), y: oy - 36, text: `N：留在 ${BITS(k, lo)}`, cls: selfSt(lo, 0) });
    labels.push({ id: `${P}self1`, x: x(hi), y: oy + 37, text: `T：留在 ${BITS(k, hi)}`, cls: selfSt(hi, 1) });
    if (k !== "one") {
      labels.push({ id: `${P}gN`, x: (x(0) + x(1)) / 2, y: oy - 84, text: "預測 not taken", cls: "title" });
      labels.push({ id: `${P}gT`, x: (x(2) + x(3)) / 2, y: oy - 84, text: "預測 taken", cls: "title" });
    }
    return { nodes, edges, labels };
  }
  const merge = (...fs) => ({ nodes: [].concat(...fs.map((f) => f.nodes)), edges: [].concat(...fs.map((f) => f.edges)), labels: [].concat(...fs.map((f) => f.labels)) });

  // ---------- 圖 3：1-bit 與 2-bit 飽和計數器 ----------
  figure("control-hazards-fsm", () => {
    const a = fsm("one", 95, 84, { prefix: "a" });
    const b = fsm("sat", 95, 262, { prefix: "b" });
    a.labels.push({ id: "ha", x: 14, y: 22, text: "(a) 1-bit：記住上一次的結果", anchor: "start", cls: "title" });
    b.labels.push({ id: "hb", x: 14, y: 146, text: "(b) 2-bit 飽和計數器：taken 加 1、not taken 減 1，≥ 10 預測 taken", anchor: "start", cls: "title" });
    return Object.assign({ width: 640, height: 318 }, merge(a, b));
  });

  // ---------- 圖 4：跳躍版 2-bit ----------
  figure("control-hazards-fsm-jump", () => {
    const f = fsm("jump", 95, 110, { prefix: "j" });
    return Object.assign({ width: 640, height: 200 }, f);
  });

  // ---------- 圖 5：迴圈的 1-bit／2-bit 預測對照 ----------
  figure("control-hazards-loop-compare", () => {
    const out = [];
    for (let r = 0; r < 3; r++) for (let i = 0; i < 4; i++) out.push(i < 3 ? 1 : 0);
    const nodes = [], labels = [], X0 = 136, CW = 36;
    const cx = (i) => X0 + i * CW + Math.floor(i / 4) * 14;
    labels.push({ id: "h", x: 14, y: 20, text: "內圈 4 次、外面重複 3 輪；1-bit 初始 T、2-bit 初始 11", anchor: "start", cls: "title" });
    for (let r = 0; r < 3; r++) labels.push({ id: "r" + r, x: (cx(r * 4) + cx(r * 4 + 3)) / 2, y: 46, text: `第 ${r + 1} 輪`, anchor: "middle" });
    labels.push({ id: "l0", x: 14, y: 76, text: "實際", anchor: "start", cls: "strong" });
    const rows = [["one", 1, "1-bit 預測", 122], ["sat", 3, "2-bit 預測", 168]];
    out.forEach((t, i) => nodes.push({ id: "o" + i, label: t ? "T" : "N", shape: "box", x: cx(i), y: 76, w: 30, h: 30, state: "default" }));
    rows.forEach(([k, s0, nm, y]) => {
      labels.push({ id: "l" + k, x: 14, y, text: nm, anchor: "start", cls: "strong" });
      let s = s0, ok = 0;
      out.forEach((t, i) => {
        const p = predictTaken(k, s) ? 1 : 0;
        if (p === t) ok++;
        nodes.push({ id: k + i, label: p ? "T" : "N", shape: "box", x: cx(i), y, w: 30, h: 30, state: p === t ? "found" : "removed" });
        s = nextState(k, s, t);
      });
      labels.push({ id: "a" + k, x: cx(11) + 26, y, text: `${ok}/12`, anchor: "start", cls: "strong" });
    });
    labels.push({ id: "n1", x: 14, y: 206, text: "1-bit：每輪最後一次猜錯，下一輪第一次又錯（紅）；2-bit：每輪只錯最後一次", anchor: "start" });
    return { width: 640, height: 224, nodes, edges: [], labels };
  });

  // ---------- 圖 6：BTB ----------
  figure("control-hazards-btb", () => {
    const nodes = [], edges = [], labels = [];
    nodes.push({ id: "pc", label: "PC", shape: "box", x: 56, y: 110, w: 70, h: 40, state: "compare" });
    const rows = [["0x0040", "11", "0x0010"], ["0x0088", "10", "0x0120"], ["0x00A4", "01", "0x0030"]];
    labels.push({ id: "th", x: 180, y: 34, text: "Tag", cls: "title" }, { id: "tb", x: 284, y: 34, text: "預測位元", cls: "title" }, { id: "tt", x: 392, y: 34, text: "預測的目標", cls: "title" });
    rows.forEach((r, i) => {
      const y = 66 + i * 44, st = i === 1 ? "active" : "default";
      nodes.push({ id: "g" + i, label: r[0], shape: "box", x: 180, y, w: 96, h: 36, state: st });
      nodes.push({ id: "b" + i, label: r[1], shape: "box", x: 284, y, w: 70, h: 36, state: st });
      nodes.push({ id: "t" + i, label: r[2], shape: "box", x: 392, y, w: 106, h: 36, state: st });
    });
    labels.push({ id: "bt", x: 286, y: 196, text: "BTB：用 PC 低位元選一列，再比對 tag", cls: "title" });
    edges.push({ from: "pc", to: "g1", directed: true, state: "compare" });
    nodes.push({ id: "mux", label: "下一個 PC", shape: "box", x: 550, y: 110, w: 118, h: 40, state: "found" });
    edges.push({ from: "t1", to: "mux", directed: true, state: "active" });
    labels.push({ id: "m1", x: 550, y: 150, text: "tag 相同、預測 taken" });
    labels.push({ id: "m2", x: 550, y: 168, text: "→ 用表裡的目標" });
    labels.push({ id: "m3", x: 550, y: 66, text: "否則 → PC + 4" });
    labels.push({ id: "n", x: 14, y: 228, text: "全部在 IF 階段完成：下一個週期就從預測的目標抓指令，猜對 taken 沒有任何損失", anchor: "start" });
    return { width: 640, height: 246, nodes, edges, labels };
  });

  // =====================================================================
  // 動畫 1：branch-timing
  // =====================================================================
  register("branch-timing", function (root) {
    const W = 640, X0 = 168, CW = 46, Y0 = 92, RH = 40, NC = 10;
    const player = new Player(root, {
      title: "Branch Penalty 分支損失時序",
      width: W, height: Y0 + 5 * RH + 64, code: CODE_TIMING, wide: true,
      legend: [["compare", "這個週期正在做"], ["found", "分支在這一級決定"], ["new", "delay slot（一定執行）"], ["removed", "猜錯被 flush"], ["muted", "bubble"]],
    });
    const ln = (s) => CODE_TIMING.findIndex((l) => l.includes(s)) + 1;
    const lnAfter = (s, a) => CODE_TIMING.findIndex((l, i) => i >= ln(a) && l.includes(s)) + 1;   // 同一行內容出現兩次時，找某一行之後的那個
    const L = {
      start: [ln('snprintf(out[0].name, sizeof out[0].name, "beq");')],
      after: [ln("if (c > resolve) {"), ln('if (taken) snprintf(f->name, sizeof f->name, "t%d", tgt++);'), ln('else snprintf(f->name, sizeof f->name, "i+%d", seq++);')],
      slot: [ln("} else if (st == DELAYED && c == 2) {"), ln('snprintf(f->name, sizeof f->name, "slot");')],
      stall: [ln("} else if (st == STALL || st == DELAYED) {"), ln('snprintf(f->name, sizeof f->name, "bubble");')],
      pnt: [ln("} else if (st == PREDICT_NT) {"), lnAfter('snprintf(f->name, sizeof f->name, "i+%d", seq++);', "} else if (st == PREDICT_NT) {")],
      pntMiss: [ln("if (taken) { f->flushed = 1; lost++; }")],
      pt: [lnAfter("} else {", "} else if (st == PREDICT_NT) {"), lnAfter('snprintf(f->name, sizeof f->name, "t%d", tgt++);', "} else if (st == PREDICT_NT) {")],
      ptMiss: [ln("if (!taken) { f->flushed = 1; lost++; }")],
      ret: [ln("return lost;")],
    };
    let resolve = 3, st = "predict-not-taken", taken = true, T = null;
    const cx = (c) => X0 + (c - 0.5) * CW;
    const ry = (j) => Y0 + j * RH;
    const rowName = (f) => ({ beq: "beq（分支）", slot: "slot（delay slot）", bubble: "（不抓：bubble）" }[f.kind] || (f.name[0] === "t" ? `${f.name}（目標那條路）` : `${f.name}（PC + 4 那條路）`));

    function frame(cyc, caption, line) {
      const nodes = [], labels = [];
      labels.push({ id: "mode", x: 12, y: 20, text: `決定在 ${STAGE[resolve]} · ${STRAT_ZH[st]} · 實際 ${taken ? "taken" : "not taken"}`, anchor: "start", cls: "title" });
      for (let c = 1; c <= NC; c++) labels.push({ id: "cy" + c, x: cx(c), y: 56, text: String(c), cls: c === cyc ? "warn" : "", anchor: "middle" });
      T.rows.forEach((f, j) => {
        if (f.cycle > cyc) return;
        labels.push({ id: "rn" + j, x: 12, y: ry(j), text: rowName(f), anchor: "start", cls: j === 0 ? "strong" : "" });
        for (let s = 1; s <= 5; s++) {
          const c = f.cycle + s - 1;
          if (c > NC) break;
          let state = "default", label = STAGE[s];
          if (c > cyc) state = "ghost";
          if (f.kind === "bubble") { state = c > cyc ? "ghost" : "muted"; label = "nop"; }
          else if (f.kind === "slot" && c <= cyc) state = "new";
          else if (f.flushed && cyc >= resolve) {
            if (c <= resolve) state = "removed";
            else { state = c > cyc ? "ghost" : "muted"; label = "nop"; }
          } else if (j === 0 && s === resolve && c <= cyc) state = "found";
          else if (c === cyc) state = "compare";
          nodes.push({ id: `c${j}_${s}`, label: c > cyc ? "" : label, shape: "box", x: cx(c), y: ry(j), w: CW - 5, h: 30, state });
        }
      });
      if (cyc > NC) labels.push({ id: "res", x: 12, y: ry(5) + 40, text: `損失 ${T.lost} 個週期（penalty 上限 = ${resolve - 1}）`, anchor: "start", cls: "strong" });
      return { nodes, edges: [], labels, caption, line };
    }

    function run() {
      T = fetchTrace(st, resolve, taken, 6);
      const r = new Recorder();
      const S = STAGE[resolve];
      r.push(frame(0, `beq 要到 <b>${S}</b> 結束才知道跳不跳；在那之前 IF 已經要抓 ${resolve - 1} 條指令（第 2～${resolve} 週期）。做法是 <b>${STRAT_ZH[st]}</b>，這次實際 <b>${taken ? "taken（跳）" : "not taken（不跳）"}</b>。按下一步逐個週期看 IF 抓了什麼。`, null));
      r.push(frame(1, "週期 1：beq 進入 IF。IF 每個週期都要抓下一條，但這時連它是不是分支都還沒解碼。", L.start));
      for (let c = 2; c <= 6; c++) {
        const f = T.rows[c - 1];
        let cap = `週期 ${c}：`, line;
        if (c > resolve) {
          cap += `結果已經知道（${taken ? "taken" : "not taken"}），照實際方向抓 <b>${f.name}</b>。`;
          line = L.after;
        } else if (f.kind === "slot") {
          cap += "抓 <b>delay slot</b> 裡的指令：ISA 規定分支後面這一條不管跳不跳都執行，編譯器負責放一條有用的指令進來，所以它不算損失。";
          line = L.slot;
        } else if (f.kind === "bubble") {
          cap += st === "delayed" ? `delay slot 只有 1 格，但分支要到 ${S} 才決定，剩下這一格只能空等（bubble）。` : "還不知道要往哪裡走，IF 不抓（插 bubble），這一格白白浪費。";
          line = L.stall;
        } else if (st === "predict-not-taken") {
          cap += `猜不跳，照常抓 PC + 4 那條路的 <b>${f.name}</b>。`;
          line = L.pnt;
        } else {
          cap += `BTB 在 IF 就查到這是分支、預測 taken，直接從目標抓 <b>${f.name}</b>。`;
          line = L.pt;
        }
        if (c === resolve) {
          const wrong = T.rows.filter((x) => x.flushed).map((x) => x.name);
          cap += ` 這個週期結束時 beq 在 ${S} 算出結果：<b>${taken ? "taken" : "not taken"}</b>。`;
          if (wrong.length) {
            cap += `猜錯了！已經抓進來的 ${wrong.join("、")} 是錯的路，<b>flush</b> 掉（控制訊號清 0，變成 bubble，不會寫回任何東西），共 ${wrong.length} 條。`;
            line = line.concat(st === "predict-not-taken" ? L.pntMiss : L.ptMiss);
          } else if (st === "predict-not-taken" || st === "predict-taken") cap += "猜對了，抓進來的指令都留著，沒有損失。";
        }
        r.push(frame(c, cap, line));
      }
      const why = {
        stall: `一律 stall：不管跳不跳都等 ${resolve - 1} 個週期。`,
        "predict-not-taken": taken ? `猜不跳但實際跳：白抓的 ${resolve - 1} 條全部 flush。` : "猜不跳而且真的不跳：完全沒有損失。",
        "predict-taken": taken ? "猜跳而且真的跳，BTB 在 IF 就給了目標：沒有損失。" : `猜跳但實際不跳：目標那條路抓的 ${resolve - 1} 條全部 flush。`,
        delayed: `delay slot 吃掉 1 格，${resolve - 1 > 1 ? `還剩 ${resolve - 2} 格只能空等` : "分支在 ID 決定，剛好不用等"}；如果編譯器找不到指令只能放 nop，那一格也算損失。`,
      }[st];
      r.push(frame(NC + 1, `全部畫完：這個分支損失 <b>${T.lost}</b> 個週期。${why}${st === "delayed" ? "" : `平均下來，每條指令多出的 CPI = 分支比例 × 付出代價的比例 × ${resolve - 1}。`}`, L.ret));
      return r.frames;
    }
    const bR = ui.button(player, "", () => { resolve = resolve === 4 ? 2 : resolve + 1; sync(); go(); }, "ghost");
    const bS = ui.button(player, "", () => { st = STRAT[(STRAT.indexOf(st) + 1) % STRAT.length]; sync(); go(); }, "ghost");
    const bT = ui.button(player, "", () => { taken = !taken; sync(); go(); }, "ghost");
    function sync() {
      bR.textContent = `決定在：${STAGE[resolve]}`;
      bS.textContent = `做法：${st}`;
      bT.textContent = `實際：${taken ? "taken" : "not taken"}`;
    }
    const go = () => player.load(run());
    const ex = (r0, s0, t0) => () => { resolve = r0; st = s0; taken = t0; sync(); go(); };
    ui.button(player, "MEM 決定猜錯", ex(4, "predict-not-taken", true), "ghost");
    ui.button(player, "ID + delay slot", ex(2, "delayed", true), "ghost");
    sync();
    const demo = run();
    demo[0].caption = iconHTML("play") + " 按播放看示範：分支在 EX 決定、猜不跳，結果實際跳了，要 flush 2 條。可以切換決定的階段（ID / EX / MEM）、做法（stall、predict-not-taken、predict-taken、delayed）和實際結果，比較每個分支損失幾個週期。";
    player.load(demo, { autoplay: false });
  });

  // =====================================================================
  // 動畫 2：branch-predictor
  // =====================================================================
  register("branch-predictor", function (root) {
    const W = 640, FY = 128, HY = 236, CW = 26, HX = 96, PER = 20, BLK = 100;
    const player = new Player(root, {
      title: "Branch Predictor 分支預測器",
      width: W, height: HY + 2 * BLK + 30, code: CODE_PRED, wide: true,
      legend: [["compare", "目前狀態"], ["new", "這次轉到的狀態"], ["active", "走的那條邊"], ["found", "猜對"], ["removed", "猜錯"]],
    });
    const ln = (s) => CODE_PRED.findIndex((l) => l.includes(s)) + 1;
    const L = {
      p1: ln("if (k == ONE_BIT) return s == 1;"), p2: ln("return s >= 2;"),
      cmp: [ln("int p = predictTaken(k, *state);"), ln("if (p == outcome[i]) correct++;")],
      one: ln("if (k == ONE_BIT) return taken;"),
      j1: ln("if (taken && s == 1) return 3;"), j2: ln("if (!taken && s == 2) return 0;"),
      up: ln("if (taken) return s < 3 ? s + 1 : 3;"), down: ln("return s > 0 ? s - 1 : 0;"),
      upd: ln("*state = nextState(k, *state, outcome[i]);"), ret: ln("return correct;"),
    };
    let kind = "sat", init = 3, seq = [], rounds = null;   // rounds：迴圈模式時每輪幾次
    const INIT = { sat: [3, 2, 1, 0], jump: [3, 2, 1, 0], one: [1, 0] };

    const cellX = (i) => HX + (i % PER) * CW + 12;
    const cellY = (i, row) => HY + Math.floor(i / PER) * BLK + row * 30;

    function frame(upto, cur, opt, caption, line, hist) {
      const f = fsm(kind, 95, FY, { prefix: "f", cur, to: opt.to, via: opt.via });
      const labels = f.labels.slice(), nodes = f.nodes.slice();
      labels.push({ id: "mode", x: 12, y: 18, text: `${KIND_ZH[kind]} · 初始 ${BITS(kind, init)}（${SNAME(kind, init)}）`, anchor: "start", cls: "title" });
      const blocks = Math.ceil(seq.length / PER);
      for (let b = 0; b < blocks; b++) {
        labels.push({ id: "hs" + b, x: 12, y: HY + b * BLK, text: "狀態", anchor: "start" });
        labels.push({ id: "hp" + b, x: 12, y: HY + b * BLK + 30, text: "預測", anchor: "start" });
        labels.push({ id: "ha" + b, x: 12, y: HY + b * BLK + 60, text: "實際", anchor: "start" });
      }
      seq.forEach((t, i) => {
        const done = i < upto, now = i === upto - 1;
        const h = hist[i];
        labels.push({ id: "st" + i, x: cellX(i), y: cellY(i, 0), text: done ? BITS(kind, h.s) : "", cls: now ? "warn" : "" });
        nodes.push({ id: "pp" + i, label: done ? (h.p ? "T" : "N") : "", shape: "box", x: cellX(i), y: cellY(i, 1), w: CW - 3, h: 24, state: done ? (h.p === t ? "found" : "removed") : "ghost" });
        nodes.push({ id: "aa" + i, label: t ? "T" : "N", shape: "box", x: cellX(i), y: cellY(i, 2), w: CW - 3, h: 24, state: now ? "compare" : done ? "default" : "muted" });
      });
      if (upto > 0) {
        const ok = hist.slice(0, upto).filter((h, i) => h.p === seq[i]).length;
        labels.push({ id: "acc", x: W - 12, y: 18, text: `累計 ${ok}/${upto} = ${(100 * ok / upto).toFixed(1)}%`, anchor: "end", cls: "strong" });
      }
      return { nodes, edges: f.edges, labels, caption, line };
    }

    function why(s, t, n) {
      if (kind === "one") return [`1-bit 只記住上一次：改成 ${n}（${SNAME(kind, n)}）。`, [L.one]];
      if (kind === "jump" && t && s === 1) return ["弱 not taken 又猜錯：跳躍版直接跳到 <b>11（強 taken）</b>，不經過 10。", [L.j1]];
      if (kind === "jump" && !t && s === 2) return ["弱 taken 又猜錯：跳躍版直接跳到 <b>00（強 not taken）</b>，不經過 01。", [L.j2]];
      if (t) return [s === 3 ? "taken：已經是 11，飽和、停在原地。" : `taken：計數器加 1 → ${BITS(kind, n)}（${SNAME(kind, n)}）。`, [L.up]];
      return [s === 0 ? "not taken：已經是 00，飽和、停在原地。" : `not taken：計數器減 1 → ${BITS(kind, n)}（${SNAME(kind, n)}）。`, [L.down]];
    }

    function run() {
      const r = new Recorder(), hist = [];
      let s = init, ok = 0;
      player.resize(W, HY + Math.ceil(seq.length / PER) * BLK + 6);
      seq.forEach((t) => {
        const p = predictTaken(kind, s) ? 1 : 0, n = nextState(kind, s, t);
        hist.push({ s, p, n });
        s = n;
      });
      const src = rounds ? `迴圈：內圈 ${rounds} 次 × ${seq.length / rounds} 輪（每輪前 ${rounds - 1} 次 taken、最後 1 次 not taken）` : `序列 ${esc(seq.map((t) => (t ? "T" : "N")).join(""))}`;
      r.push(frame(0, init, {}, `${src}，共 ${seq.length} 次。用 <b>${KIND_ZH[kind]}</b>，從 ${BITS(kind, init)}（${SNAME(kind, init)}）開始。每一步：用目前狀態預測 → 和實際比對 → 依實際結果更新狀態。`, null, hist));
      hist.forEach((h, i) => {
        const t = seq[i];
        if (h.p === t) ok++;
        const [w, wl] = why(h.s, t, h.n);
        const where = rounds ? `（第 ${Math.floor(i / rounds) + 1} 輪第 ${(i % rounds) + 1} 次）` : "";
        const cap = `第 ${i + 1} 次${where}：狀態 ${BITS(kind, h.s)} → 預測 <b>${h.p ? "T" : "N"}</b>；實際 <b>${t ? "T" : "N"}</b>，${h.p === t ? "猜對" : "<b>猜錯</b>"}。${w} 累計 ${ok}/${i + 1}。`;
        const line = [kind === "one" ? L.p1 : L.p2].concat(L.cmp, wl, [L.upd]);
        r.push(frame(i + 1, h.s, { to: h.n, via: [h.s, h.n, t] }, cap, line, hist));
      });
      let tail = "";
      if (rounds && seq.length / rounds >= 2) {
        const last = hist.slice(-rounds).filter((h, j) => h.p === seq[seq.length - rounds + j]).length;
        tail = ` 最後一輪 ${last}/${rounds}：迴圈重複很多次時，正確率會趨近這個穩態值，不是第一輪的值。`;
      }
      r.push(frame(seq.length, s, {}, `結束：猜對 ${ok}/${seq.length} = <b>${(100 * ok / seq.length).toFixed(1)}%</b>，最後停在 ${BITS(kind, s)}。${tail}`, [L.ret], hist));
      return r.frames;
    }

    const bK = ui.button(player, "", () => { kind = KIND[(KIND.indexOf(kind) + 1) % 3]; if (!INIT[kind].includes(init)) init = INIT[kind][0]; sync(); go(); }, "ghost");
    const bI = ui.button(player, "", () => { const a = INIT[kind]; init = a[(a.indexOf(init) + 1) % a.length]; sync(); go(); }, "ghost");
    const inp = ui.input(player, { placeholder: "T/N 序列，最多 40 個", value: "", width: 170 });
    const bad = (el, msg) => {
      el.classList.add("is-error"); setTimeout(() => el.classList.remove("is-error"), 700);
      player.load([{ nodes: [], edges: [], labels: [], caption: `${iconHTML("alert")} ${msg}`, line: null }], { autoplay: false });
    };
    function goSeq() {
      const s = inp.value.toUpperCase().replace(/[\s,，、]/g, "");
      if (!s) return bad(inp, "請輸入由 T（taken）和 N（not taken）組成的序列，例如 TTTN。");
      if (!/^[TN]+$/.test(s)) return bad(inp, "序列只能有 T 和 N（可以用空白或逗號隔開）。");
      if (s.length > 40) return bad(inp, `序列有 ${s.length} 個，最多 40 個，畫面才放得下。`);
      seq = [...s].map((c) => (c === "T" ? 1 : 0));
      rounds = null;
      go();
    }
    ui.button(player, "執行序列", goSeq);
    const field = (lab, val, ph) => {
      const sp = document.createElement("span");
      sp.textContent = lab;
      player.toolbar.appendChild(sp);
      return ui.input(player, { value: val, width: 56, placeholder: ph });
    };
    const inInner = field("內圈", "6", "2～20");
    const inOuter = field("× 輪數", "3", "1～10");
    function goLoop() {
      const a = ui.int(inInner, { min: 2, max: 20 });
      if (a === null) return bad(inInner, "內圈次數請輸入 2～20 的整數（分支執行 a 次：前 a − 1 次 taken、最後一次 not taken）。");
      const b = ui.int(inOuter, { min: 1, max: 10 });
      if (b === null) return bad(inOuter, "輪數請輸入 1～10 的整數。");
      if (a * b > 40) return bad(inOuter, `內圈 × 輪數 = ${a * b}，最多 40 次，畫面才放得下。`);
      seq = [];
      for (let r = 0; r < b; r++) for (let i = 0; i < a; i++) seq.push(i < a - 1 ? 1 : 0);
      rounds = a;
      go();
    }
    ui.button(player, "迴圈", goLoop);
    inp.addEventListener("keydown", (e) => e.key === "Enter" && goSeq());
    [inInner, inOuter].forEach((el) => el.addEventListener("keydown", (e) => e.key === "Enter" && goLoop()));
    const exSeq = (s, k, i0) => () => { inp.value = s; kind = k; init = i0; sync(); goSeq(); };
    const exLoop = (a, b, k, i0) => () => { inInner.value = a; inOuter.value = b; kind = k; init = i0; sync(); goLoop(); };
    ui.button(player, "1-bit 迴圈 6×3", exLoop(6, 3, "one", 1), "ghost");
    ui.button(player, "NTNNT × 3", exSeq("NTNNT NTNNT NTNNT", "sat", 3), "ghost");
    ui.button(player, "跳躍版 TTNTTTNT", exSeq("TTNTTTNT", "jump", 0), "ghost");
    function sync() {
      bK.textContent = `預測器：${KIND_ZH[kind]}`;
      bI.textContent = `初始：${BITS(kind, init)} ${SNAME(kind, init)}`;
    }
    const go = () => player.load(run());

    sync();
    for (let r = 0; r < 3; r++) for (let i = 0; i < 6; i++) seq.push(i < 5 ? 1 : 0);
    rounds = 6;
    const demo = run();
    demo[0].caption = iconHTML("play") + " 按播放看示範：內圈 6 次的迴圈分支跑 3 輪，用 2-bit 飽和計數器、從 11（強 taken）開始，每輪只猜錯離開迴圈那一次。可以切換預測器（1-bit、2-bit 飽和、2-bit 跳躍版）與初始狀態，或輸入自己的 T/N 序列、迴圈次數。";
    player.load(demo, { autoplay: false });
  });
})();
