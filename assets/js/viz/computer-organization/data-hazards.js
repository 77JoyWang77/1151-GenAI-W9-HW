/* =====================================================================
   Data Hazards and Forwarding（資料危障與轉送）主題的視覺化
   - forwarding-unit : 逐週期看五個階段裡是哪條指令，forwarding unit 怎麼比較
                       EX/MEM、MEM/WB 的 rd 與 ID/EX 的 rs、rt 決定 ForwardA / ForwardB，
                       hazard detection unit 怎麼偵測 load-use、插入 bubble
   - load-use-reorder: 編譯器重排指令，逐個位置挑一條可以合法往前搬、又不會造成 load-use 的指令
   - 靜態圖：相依矩陣、forwarding mux 示意、double data hazard、bubble 往後走
   ===================================================================== */
(function () {
  "use strict";
  const { Player, Recorder, ui, register, esc, iconHTML, figure } = window.DSViz;

  // 右側程式碼：由 .work/build_js.py 從 code/computer-organization/data-hazards.c 原封不動抽出
  const CODE_FWD = [
    "int forwardSel(int src, const Inst *exmem, const Inst *memwb) {",
    "  if (src < 0) return 0;                                  /* 沒用到這個運算元 */",
    "  if (exmem && exmem->regWrite && exmem->dst != 0 && exmem->dst == src)",
    "    return 2;                                             /* EX hazard：上一條剛算完 */",
    "  if (memwb && memwb->regWrite && memwb->dst != 0 && memwb->dst == src)",
    "    return 1;                                             /* MEM hazard：EX/MEM 沒命中才輪到它 */",
    "  return 0;",
    "}",
    "",
    "int loadUseStall(const Inst *idex, const Inst *ifid) {",
    "  return idex && ifid && idex->memRead &&",
    "         (idex->dst == ifid->rs || idex->dst == ifid->rt);",
    "}",
    "",
    "int simulate(const Inst *in, int n, int verbose, int *nStall) {",
    "  int pc = 0, ifid = EMPTY, idex = EMPTY, exmem = EMPTY, memwb = EMPTY;",
    "  *nStall = 0;",
    "  for (int cycle = 1; ; cycle++) {",
    "    int fetch = pc < n ? pc : EMPTY;        /* 這個週期 IF 抓的指令 */",
    "    if (fetch < 0 && ifid < 0 && idex < 0 && exmem < 0 && memwb < 0) return cycle - 1;",
    "    if (idex >= 0) {                        /* EX 的指令：forwarding unit 選 ALU 的兩個輸入 */",
    "      fwdA[idex] = forwardSel(in[idex].rs, AT(exmem), AT(memwb));",
    "      fwdB[idex] = forwardSel(in[idex].rt, AT(exmem), AT(memwb));",
    "    }",
    "    int stall = loadUseStall(AT(idex), AT(ifid));   /* ID 的指令要用 EX 那條 lw 的結果？ */",
    "    if (verbose) {",
    "      int st[5] = {fetch, ifid, idex, exmem, memwb};",
    "      trace(cycle, st, stall);",
    "    }",
    "    /* 時脈邊緣：管線暫存器一起往後移 */",
    "    memwb = exmem;",
    "    exmem = idex;",
    "    if (stall) {                            /* PCWrite = 0、IF/IDWrite = 0：PC 和 IF/ID 不動 */",
    "      idex = BUBBLE;                        /* 控制訊號清 0 送進 ID/EX：往 EX 塞一個 bubble */",
    "      (*nStall)++;",
    "    } else {",
    "      idex = ifid;",
    "      ifid = fetch;",
    "      if (fetch >= 0) pc++;",
    "    }",
    "  }",
    "}"
  ];
  const CODE_RE = [
    "int conflict(const Inst *a, const Inst *b) {",
    "  if (a->dst > 0 && (a->dst == b->rs || a->dst == b->rt)) return 1;   /* RAW */",
    "  if (b->dst > 0 && (b->dst == a->rs || b->dst == a->rt)) return 1;   /* WAR */",
    "  if (a->dst > 0 && a->dst == b->dst) return 1;                       /* WAW */",
    "  if ((a->memWrite && (b->memRead || b->memWrite)) || (b->memWrite && a->memRead))",
    "    if (!(a->rs == b->rs && abs(a->off - b->off) >= 4)) return 1;    /* 可能是同一個位址 */",
    "  return 0;",
    "}",
    "",
    "void reorder(const Inst *in, int n, int *order) {",
    "  int used[MAXN] = {0};",
    "  for (int k = 0; k < n; k++) {",
    "    int pick = -1, first = -1;",
    "    for (int j = 0; j < n && pick < 0; j++) {",
    "      if (used[j]) continue;",
    "      int ok = 1;",
    "      for (int i = 0; i < j; i++)           /* 要跳過的每一條（原本在 j 前面、還沒排）都要能交換 */",
    "        if (!used[i] && conflict(&in[i], &in[j])) { ok = 0; break; }",
    "      if (!ok) continue;",
    "      if (first < 0) first = j;",
    "      if (k == 0 || !loadUseStall(&in[order[k - 1]], &in[j])) pick = j;",
    "    }",
    "    if (pick < 0) pick = first;             /* 每一條都會停：照原本順序，接受這次 stall */",
    "    order[k] = pick;",
    "    used[pick] = 1;",
    "  }",
    "}"
  ];
  const lnIn = (code) => (s) => code.findIndex((l) => l.includes(s)) + 1;
  const lnF = lnIn(CODE_FWD), lnR = lnIn(CODE_RE);
  const LF = {
    unused: lnF("if (src < 0) return 0;"),
    exHit: [lnF("if (exmem && exmem->regWrite"), lnF("return 2;")],
    memHit: [lnF("if (memwb && memwb->regWrite"), lnF("return 1;")],
    none: CODE_FWD.findIndex((l) => l.trim() === "return 0;") + 1,
    detect: [lnF("return idex && ifid && idex->memRead"), lnF("(idex->dst == ifid->rs || idex->dst == ifid->rt)")],
    callFwd: [lnF("fwdA[idex] = forwardSel"), lnF("fwdB[idex] = forwardSel")],
    callDet: lnF("int stall = loadUseStall("),
    bubble: [lnF("idex = BUBBLE;"), lnF("(*nStall)++;")],
    advance: [lnF("idex = ifid;"), lnF("ifid = fetch;")],
    done: lnF("return cycle - 1;"),
    fetch: lnF("int fetch = pc < n ? pc : EMPTY;"),
  };
  const LR = {
    raw: lnR("/* RAW */"), war: lnR("/* WAR */"), waw: lnR("/* WAW */"),
    mem: [lnR("if ((a->memWrite && (b->memRead"), lnR("if (!(a->rs == b->rs")],
    skip: lnR("if (!used[i] && conflict(&in[i], &in[j]))"),
    lu: lnR("if (k == 0 || !loadUseStall(&in[order[k - 1]], &in[j])) pick = j;"),
    fallback: lnR("if (pick < 0) pick = first;"),
    place: [lnR("order[k] = pick;"), lnR("used[pick] = 1;")],
    loop: lnR("for (int k = 0; k < n; k++) {"),
  };

  // ---------- 解析指令（和 C 程式的 parse() 規則相同） ----------
  const NAMES = "zero at v0 v1 a0 a1 a2 a3 t0 t1 t2 t3 t4 t5 t6 t7 s0 s1 s2 s3 s4 s5 s6 s7 t8 t9 k0 k1 gp sp fp ra".split(" ");
  const REG = "\\$(?:zero|at|v[01]|a[0-3]|t[0-9]|s[0-7]|k[01]|gp|sp|fp|ra|[12]?[0-9]|3[01])";
  const RE_R = new RegExp(`^(add|sub|and|or|slt) (${REG}),(${REG}),(${REG})$`);
  const RE_I = new RegExp(`^(addi|andi|ori|slti) (${REG}),(${REG}),(-?\\d{1,4})$`);
  const RE_M = new RegExp(`^(lw|sw) (${REG}),(-?\\d{1,4})\\((${REG})\\)$`);
  const num = (r) => { const s = r.slice(1), k = NAMES.indexOf(s); return k >= 0 ? k : +s; };
  const rn = (k) => (k < 0 ? "—" : "$" + NAMES[k]);
  const norm = (s) => s.trim().replace(/\s*,\s*/g, ",").replace(/\s*\(\s*/g, "(").replace(/\s*\)/g, ")").replace(/\s+/g, " ");

  function parseLine(s) {
    let m;
    const x = { text: s, dst: -1, rs: -1, rt: -1, memRead: false, memWrite: false, off: 0 };
    if ((m = s.match(RE_R))) Object.assign(x, { op: m[1], dst: num(m[2]), rs: num(m[3]), rt: num(m[4]) });
    else if ((m = s.match(RE_I))) Object.assign(x, { op: m[1], dst: num(m[2]), rs: num(m[3]) });
    else if ((m = s.match(RE_M))) {
      Object.assign(x, { op: m[1], off: +m[3], rs: num(m[4]) });
      if (m[1] === "lw") Object.assign(x, { dst: num(m[2]), memRead: true });
      else Object.assign(x, { rt: num(m[2]), memWrite: true });
    } else return null;
    x.regWrite = x.dst >= 0;
    return x;
  }
  function readLines(input, lo, hi) {
    const lines = input.value.split(/[;\n]/).map(norm).filter(Boolean);
    if (lines.length < lo || lines.length > hi) return { err: `請輸入 ${lo}～${hi} 行指令，用分號 ; 隔開（目前 ${lines.length} 行）。` };
    const ins = [];
    for (let k = 0; k < lines.length; k++) {
      lines[k] = lines[k].replace(/\$zero\b/g, "$0");   // 畫面放不下太長的指令，$zero 一律顯示成 $0
      if (lines[k].length > 15) return { err: `第 ${k + 1} 行「${esc(lines[k])}」太長（最多 15 個字元，逗號後不要空格），常數請用 3 位數以內。` };
      const x = parseLine(lines[k]);
      if (!x) return { err: `第 ${k + 1} 行「${esc(lines[k])}」格式不對。支援：add/sub/and/or/slt $rd,$rs,$rt、addi/andi/ori/slti $rt,$rs,常數、lw/sw $rt,位移($rs)，暫存器寫成 $t0、$s1、$zero 或 $8 這類名稱。` };
      ins.push(x);
    }
    return { ins, lines };
  }

  // ---------- forwarding unit / hazard detection unit（和 C 的 forwardSel()、loadUseStall() 相同） ----------
  function forwardSel(src, exmem, memwb) {
    if (src < 0) return 0;
    if (exmem && exmem.regWrite && exmem.dst !== 0 && exmem.dst === src) return 2;
    if (memwb && memwb.regWrite && memwb.dst !== 0 && memwb.dst === src) return 1;
    return 0;
  }
  const loadUseStall = (idex, ifid) => !!(idex && ifid && idex.memRead && (idex.dst === ifid.rs || idex.dst === ifid.rt));
  const SEL = ["00", "01", "10"];
  const EMPTY = -1, BUBBLE = -2;

  // 和 C 的 simulate() 相同：記下每個週期各階段的指令、stall 與 ForwardA/B
  function simulate(ins) {
    const n = ins.length, cycles = [];
    let pc = 0, ifid = EMPTY, idex = EMPTY, exmem = EMPTY, memwb = EMPTY, nStall = 0;
    const at = (k) => (k >= 0 ? ins[k] : null);
    const fa = [], fb = [], exAt = [], stalledBy = [];
    for (let cycle = 1; cycle < 60; cycle++) {
      const fetch = pc < n ? pc : EMPTY;
      if (fetch < 0 && ifid < 0 && idex < 0 && exmem < 0 && memwb < 0) return { cycles, total: cycle - 1, nStall, fa, fb, exAt, stalledBy };
      if (idex >= 0) {
        fa[idex] = forwardSel(ins[idex].rs, at(exmem), at(memwb));
        fb[idex] = forwardSel(ins[idex].rt, at(exmem), at(memwb));
        exAt[idex] = cycle;
      }
      const stall = loadUseStall(at(idex), at(ifid));
      if (stall) stalledBy[ifid] = idex;
      cycles.push({ cycle, st: [fetch, ifid, idex, exmem, memwb], stall });
      memwb = exmem; exmem = idex;
      if (stall) { idex = BUBBLE; nStall++; }
      else { idex = ifid; ifid = fetch; if (fetch >= 0) pc++; }
    }
    return null;
  }

  // =================================================================
  // 動畫 1：Forwarding Unit 與 Hazard Detection Unit
  // =================================================================
  register("forwarding-unit", function (root) {
    const W = 800, H = 420;
    const player = new Player(root, {
      title: "Forwarding Unit 轉送單元",
      width: W, height: H, code: CODE_FWD, wide: true,
      legend: [["compare", "EX 的指令（要選 ALU 輸入）"], ["found", "轉送來源／命中"], ["active", "被擋住（stall）"], ["muted", "bubble（nop）"]],
    });
    const SX = [83, 241, 399, 557, 715], SY = 92;
    const HEAD = ["IF", "ID · IF/ID", "EX · ID/EX", "MEM · EX/MEM", "WB · MEM/WB"];
    let ins = [], S = null;

    function stageNodes(st, states, labels, detail) {
      const nodes = [];
      HEAD.forEach((h, k) => labels.push({ id: "h" + k, x: SX[k], y: 52, text: h, cls: "title", anchor: "middle" }));
      st.forEach((v, k) => {
        const x = v >= 0 ? ins[v] : null;
        nodes.push({
          id: "st" + k, shape: "box", x: SX[k], y: SY, w: 154, h: 46,
          label: x ? x.text : v === BUBBLE ? "nop（bubble）" : "",
          sub: x ? "I" + (v + 1) : "",
          state: states[k] || (v === BUBBLE ? "muted" : v === EMPTY ? "ghost" : "default"),
        });
        (detail[k] || []).forEach((t, r) => labels.push({ id: `d${k}_${r}`, x: SX[k], y: 148 + r * 19, text: t.text, cls: t.cls || "", anchor: "middle" }));
      });
      return nodes;
    }

    // 說明一個運算元的判斷過程，回傳每一行文字與結果
    function explain(name, src, exmem, memwb, isStoreData) {
      const lines = [];
      if (src < 0) return { sel: 0, lines: [`${name}：沒用到（立即值）`, "  第二個 ALU 運算元是立即值，ALUSrc = 1"], unused: true };
      lines.push(`${name}：要讀 ${rn(src)}${isStoreData ? "（sw 要存的資料）" : ""}`);
      const one = (tag, x, k) => {
        if (k === EMPTY) return { t: `${tag}：空的 → 不轉送`, hit: false };
        if (k === BUBBLE) return { t: `${tag}：bubble，RegWrite = 0 → 不轉送`, hit: false };
        if (!x.regWrite) return { t: `${tag}：${x.op} 不寫暫存器（RegWrite = 0）→ 不轉送`, hit: false };
        if (x.dst !== src) return { t: `${tag}：RegWrite = 1，rd = ${rn(x.dst)} ≠ ${rn(src)}`, hit: false };
        if (x.dst === 0) return { t: `${tag}：rd = $zero，寫不進去 → 不轉送`, hit: false };
        return { t: `${tag}：RegWrite = 1，rd = ${rn(x.dst)} 相同 → 命中`, hit: true };
      };
      const a = one("EX/MEM", exmem.x, exmem.k), b = one("MEM/WB", memwb.x, memwb.k);
      lines.push("  " + a.t);
      if (a.hit && b.hit) lines.push("  MEM/WB 也命中，但 EX/MEM 比較新 → 不選它");
      else lines.push("  " + b.t);
      const sel = a.hit ? 2 : b.hit ? 1 : 0;
      return { sel, lines };
    }

    function frameCycle(c) {
      const { cycle, st, stall } = c;
      const labels = [], detail = [[], [], [], [], []], states = [];
      const [fe, id, ex, me, wb] = st;
      const X = (k) => (k >= 0 ? ins[k] : null);
      labels.push({ id: "cy", x: 12, y: 18, text: `週期 ${cycle} / ${S.total}`, cls: "strong", anchor: "start" });
      labels.push({ id: "ns", x: W - 12, y: 18, text: `目前 stall 次數：${S.cycles.slice(0, cycle - 1).filter((q) => q.stall).length + (stall ? 1 : 0)}`, cls: "", anchor: "end" });
      // 每個階段下面寫出 forwarding / hazard 判斷要看的欄位
      if (fe >= 0) detail[0].push({ text: stall ? "PC 不更新，下週期重抓" : "PC → 下一條" });
      if (X(id)) detail[1].push({ text: `rs=${rn(X(id).rs)}  rt=${rn(X(id).rt)}` });
      if (X(ex)) {
        detail[2].push({ text: `rs=${rn(X(ex).rs)}  rt=${rn(X(ex).rt)}` });
        detail[2].push({ text: `MemRead=${X(ex).memRead ? 1 : 0}${X(ex).memRead ? "  rt=" + rn(X(ex).dst) : ""}` });
      }
      [[3, me], [4, wb]].forEach(([k, v]) => {
        if (X(v)) { detail[k].push({ text: `RegWrite=${X(v).regWrite ? 1 : 0}` }); detail[k].push({ text: `rd=${rn(X(v).dst)}` }); }
        else if (v === BUBBLE) detail[k].push({ text: "控制訊號全為 0" });
      });
      let line = LF.advance, parts = [];
      // ---- forwarding unit ----
      labels.push({ id: "fu", x: 20, y: 226, text: "FORWARDING UNIT（看 EX 的指令）", cls: "title", anchor: "start" });
      const nodes = [];
      let fa = null, fb = null;
      if (X(ex)) {
        const x = X(ex);
        fa = explain("ForwardA", x.rs, { x: X(me), k: me }, { x: X(wb), k: wb }, false);
        fb = explain("ForwardB", x.rt, { x: X(me), k: me }, { x: X(wb), k: wb }, x.memWrite);
        [fa, fb].forEach((r, g) => {
          r.lines.forEach((t, q) => labels.push({ id: `f${g}_${q}`, x: 24, y: 252 + g * 82 + q * 21, text: t, cls: q === 0 ? "strong" : "", anchor: "start" }));
          nodes.push({ id: "res" + g, shape: "box", x: 440, y: 273 + g * 82, w: 132, h: 40, label: `${g ? "ForwardB" : "ForwardA"}=${SEL[r.sel]}`, state: r.sel ? "found" : "default" });
          if (r.sel) {
            const k = r.sel === 2 ? 3 : 4;
            states[k] = "found";
          }
        });
        states[2] = "compare";
        const srcTag = (k, sel) => [fa.sel === sel ? "A" : "", fb.sel === sel ? "B" : ""].filter(Boolean).join("、");
        [[3, 2], [4, 1]].forEach(([k, sel]) => { const t = srcTag(k, sel); if (t) detail[k].push({ text: `→ 轉送給 ${t}`, cls: "warn" }); });
        const how = (r, nm) => r.unused ? `${nm} 沒用到` : r.sel === 2 ? `${nm} = <b>10</b>（從 EX/MEM 拿上一條的 ALU 結果）` : r.sel === 1 ? `${nm} = <b>01</b>（從 MEM/WB 拿上上一條的結果）` : `${nm} = <b>00</b>（用 ID 讀出的暫存器值）`;
        parts.push(`EX 的 I${ex + 1}（<code>${esc(x.text)}</code>）：${how(fa, "ForwardA")}；${how(fb, "ForwardB")}。`);
        if (fa.sel === 2 && fa.lines.some((t) => t.includes("比較新")) || fb.sel === 2 && fb.lines.some((t) => t.includes("比較新")))
          parts.push(`EX/MEM 和 MEM/WB 都要寫同一個暫存器（double data hazard），選比較新的 EX/MEM。`);
        if (x.memWrite && fb.sel) parts.push(`sw 要存的資料也經過 ForwardB 的 mux，再送進 EX/MEM。`);
        const any = fa.sel || fb.sel;
        line = any ? LF.callFwd.concat(fa.sel === 2 || fb.sel === 2 ? LF.exHit : LF.memHit) : LF.callFwd.concat([LF.none]);
      } else {
        labels.push({ id: "f0_0", x: 24, y: 252, text: ex === BUBBLE ? "EX 是 bubble：沒有要算的東西，ForwardA、ForwardB 不重要" : "EX 還沒有指令", cls: "", anchor: "start" });
      }
      // ---- hazard detection unit ----
      const HX = 560;
      labels.push({ id: "hu", x: HX, y: 226, text: "HAZARD DETECTION（看 ID 的指令）", cls: "title", anchor: "start" });
      const hl = [];
      if (!X(id)) hl.push(id === EMPTY ? "ID 沒有指令 → 不用停" : "");
      else if (!X(ex)) hl.push(ex === BUBBLE ? "ID/EX 是 bubble，MemRead = 0" : "ID/EX 是空的，MemRead = 0", "→ 不用停");
      else if (!X(ex).memRead) hl.push(`ID/EX：${X(ex).op}，MemRead = 0`, "不是 lw，結果下週期能轉送", "→ 不用停");
      else {
        hl.push(`ID/EX：lw，MemRead = 1，rt = ${rn(X(ex).dst)}`);
        hl.push(`IF/ID：rs = ${rn(X(id).rs)}，rt = ${rn(X(id).rt)}`);
        hl.push(stall ? "→ 相同：load-use，stall！" : "→ 都不相同，不用停");
      }
      hl.filter(Boolean).forEach((t, q) => labels.push({ id: "h_" + q, x: HX + 4, y: 252 + q * 21, text: t, cls: t.includes("stall！") ? "warn" : "", anchor: "start" }));
      const sig = stall ? [["PCWrite = 0", "active"], ["IF/IDWrite = 0", "active"], ["控制訊號 → 0", "active"]] : [["PCWrite = 1", "muted"], ["IF/IDWrite = 1", "muted"], ["控制訊號照常", "muted"]];
      sig.forEach(([t, s], q) => nodes.push({ id: "sig" + q, shape: "box", x: 660, y: 330 + q * 32, w: 190, h: 26, label: t, state: s }));
      if (stall) {
        states[0] = "active"; states[1] = "active";
        parts.push(`ID 的 I${id + 1}（<code>${esc(X(id).text)}</code>）要讀 ${rn(X(ex).dst)}，而 EX 的 lw 要到 MEM 結束才拿到資料，下個週期的 EX 來不及：<b>load-use，stall 一個週期</b>。PC 和 IF/ID 不更新（I${id + 1} 下週期留在 ID 再解碼一次），送進 ID/EX 的控制訊號清成 0，往 EX 塞一個 bubble。`);
        line = [LF.callDet].concat(LF.detect, LF.bubble);
      } else if (!X(ex)) {
        if (ex === BUBBLE) parts.push(`上個週期塞進來的 bubble 現在在 EX，它的控制訊號全是 0，往後走不會寫任何東西。`);
        else parts.push(fe >= 0 ? `I${fe + 1} 進入 IF，管線還在填滿。` : `沒有新指令，管線正在排空。`);
        if (wb >= 0 && X(id) && [X(id).rs, X(id).rt].includes(X(wb).dst) && X(wb).dst > 0)
          parts.push(`I${wb + 1} 在 WB 前半週期寫回 ${rn(X(wb).dst)}，ID 的 I${id + 1} 後半週期就讀得到新值，不需要轉送。`);
      } else if (wb >= 0 && X(id) && X(wb).dst > 0 && [X(id).rs, X(id).rt].includes(X(wb).dst)) {
        parts.push(`另外，I${wb + 1} 在 WB 前半週期寫回 ${rn(X(wb).dst)}，ID 的 I${id + 1} 後半週期讀暫存器檔就拿到新值。`);
      }
      if (me === BUBBLE || wb === BUBBLE) parts.push(`bubble 現在在 ${me === BUBBLE ? "MEM" : "WB"}，它像一條 nop 一樣往後走。`);
      return { nodes: stageNodes(st, states, labels, detail).concat(nodes), edges: [], labels, caption: `<b>週期 ${cycle}</b>：${parts.join("")}`, line };
    }

    function frameList(title, rows, caption, line) {
      const labels = [{ id: "cy", x: 12, y: 18, text: title, cls: "strong", anchor: "start" }];
      labels.push({ id: "fu", x: 20, y: 160, text: rows.head, cls: "title", anchor: "start" });
      rows.cols.forEach(([t, x], q) => labels.push({ id: "lh" + q, x, y: 186, text: t, cls: "title", anchor: "start" }));
      rows.data.forEach((r, j) => r.forEach((t, q) => labels.push({ id: `l${j}_${q}`, x: rows.cols[q][1], y: 210 + j * 21, text: t, cls: q === 0 ? "strong" : "", anchor: "start" })));
      return { nodes: stageNodes([EMPTY, EMPTY, EMPTY, EMPTY, EMPTY], [], labels, []), edges: [], labels, caption, line };
    }
    const COLS = [["指令", 24], ["", 74], ["寫入", 260], ["讀 rs", 340], ["讀 rt", 420], ["EX 週期", 500], ["ForwardA", 590], ["ForwardB", 690]];

    function run(list) {
      ins = list;
      S = simulate(ins);
      const r = new Recorder();
      const n = ins.length;
      r.push(frameList(`${n} 條指令，有 forwarding 與 hazard detection`, {
        head: "先把每條指令拆成 forwarding 要比對的欄位",
        cols: COLS.slice(0, 5),
        data: ins.map((x, j) => [`I${j + 1}`, x.text, rn(x.dst), rn(x.rs), rn(x.rt)]),
      }, `每條指令先拆成「寫哪個暫存器（rd）、讀哪些（rs、rt）」：lw 和 addi 的目的暫存器在 rt 欄位，sw 讀 rt 當作要存的資料。接下來逐個週期看：<b>forwarding unit</b> 在 EX 比對 EX/MEM、MEM/WB 的 rd 和 ID/EX 的 rs、rt；<b>hazard detection unit</b> 在 ID 檢查 load-use。`, null));
      S.cycles.forEach((c) => r.push(frameCycle(c)));
      r.push(frameList(`總週期 ${S.total} = 5 + (${n} − 1) + ${S.nStall} 個 stall`, {
        head: "整理：每條指令在 EX 時的 ForwardA / ForwardB",
        cols: COLS,
        data: ins.map((x, j) => [`I${j + 1}`, x.text, rn(x.dst), rn(x.rs), rn(x.rt), String(S.exAt[j]), SEL[S.fa[j]], x.rt < 0 ? "—" : SEL[S.fb[j]]]),
      }, `全部完成。${S.nStall ? `共 ${S.nStall} 次 load-use stall（${S.stalledBy.map((p, j) => (p === undefined ? null : `I${p + 1} → I${j + 1}`)).filter(Boolean).join("、")}），其餘相依都靠轉送解決。` : "沒有 load-use，所有相依都靠轉送解決，一個 stall 都不用。"}ForwardB 為「—」表示這條指令的第二個 ALU 運算元是立即值。`, LF.done));
      return r.frames;
    }

    const inp = ui.input(player, { placeholder: "指令用 ; 隔開，2～7 行", value: "", width: 300 });
    const DEMO = "add $t1,$s1,$s2; sub $t1,$t1,$s3; lw $t0,0($t1); add $t2,$t0,$t1; sw $t2,4($s0)";
    inp.value = DEMO;
    const bad = (msg) => {
      inp.classList.add("is-error"); setTimeout(() => inp.classList.remove("is-error"), 700);
      player.load([{ nodes: [], edges: [], labels: [], caption: `${iconHTML("alert")} ${msg}`, line: null }], { autoplay: false });
    };
    function go() {
      const r = readLines(inp, 2, 7);
      if (r.err) return bad(r.err);
      player.load(run(r.ins));
    }
    ui.button(player, "執行", go);
    const ex = (s) => () => { inp.value = s; go(); };
    ui.button(player, "double hazard", ex("add $t1,$t1,$t2; add $t1,$t1,$t3; add $t1,$t1,$t4"), "ghost");
    ui.button(player, "隔一條轉送", ex("add $t0,$s1,$s2; or $t1,$s3,$s4; sub $t2,$t0,$t1"), "ghost");
    ui.button(player, "lw → sw", ex("lw $t0,0($s0); sw $t0,4($s0); lw $t1,8($s0); addi $t2,$t1,1"), "ghost");
    ui.button(player, "寫入 $zero", ex("add $0,$t1,$t2; add $t3,$0,$t4"), "ghost");
    inp.addEventListener("keydown", (e) => e.key === "Enter" && go());

    const demo = run(DEMO.split(";").map(norm).map(parseLine));
    demo[0].caption = iconHTML("play") + " 按播放看示範：I2、I3 都要用前一條剛算出的 $t1（EX/MEM 轉送），I3 還同時遇到 I1、I2 都寫 $t1 的 double data hazard；I4 要用 lw 載入的 $t0，hazard detection unit 會插一個 bubble；I5 sw 要存的 $t2 也要轉送。也可以輸入自己的指令（2～7 行，用 ; 隔開）。";
    player.load(demo, { autoplay: false });
  });

  // =================================================================
  // 動畫 2：重排指令避開 load-use
  // =================================================================
  function conflictWhy(a, b) {
    if (a.dst > 0 && (a.dst === b.rs || a.dst === b.rt)) return { t: `RAW（${rn(a.dst)}）`, l: LR.raw };
    if (b.dst > 0 && (b.dst === a.rs || b.dst === a.rt)) return { t: `WAR（${rn(b.dst)}）`, l: LR.war };
    if (a.dst > 0 && a.dst === b.dst) return { t: `WAW（${rn(a.dst)}）`, l: LR.waw };
    if ((a.memWrite && (b.memRead || b.memWrite)) || (b.memWrite && a.memRead))
      if (!(a.rs === b.rs && Math.abs(a.off - b.off) >= 4)) return { t: a.rs === b.rs ? "可能是同一個記憶體位址" : "base 不同，可能是同一個位址", l: LR.mem };
    return null;
  }

  register("load-use-reorder", function (root) {
    const W = 760;
    const player = new Player(root, {
      title: "Instruction Reordering 重排指令",
      width: W, height: 420, code: CODE_RE, wide: true,
      legend: [["compare", "目前檢查的候選"], ["removed", "不能選"], ["found", "選中，搬到這個位置"], ["active", "load-use stall"], ["muted", "已經排好"]],
    });
    const LXc = 200, RXc = 560, BW = 250, Y0 = 84, RH = 34;
    let ins = [];

    // 依某個順序列出指令與 stall 列；回傳每列 {j, stall}
    function rowsOf(order) {
      const rows = [];
      order.forEach((j, k) => {
        if (k > 0 && loadUseStall(ins[order[k - 1]], ins[j])) rows.push({ stall: true, j });
        rows.push({ j });
      });
      return rows;
    }
    function draw(caption, line, opt) {
      const nodes = [], labels = [];
      const L = opt.left, R = opt.right;
      labels.push({ id: "lt", x: LXc, y: 30, text: `原本順序：${opt.st0} 個 stall`, cls: "strong", anchor: "middle" });
      labels.push({ id: "rt", x: RXc, y: 30, text: opt.done ? `重排後：${opt.st1} 個 stall` : "重排後（逐個位置填）", cls: "strong", anchor: "middle" });
      L.forEach((r, q) => {
        const y = Y0 + q * RH;
        if (r.stall) nodes.push({ id: "ls" + r.j, shape: "box", x: LXc, y, w: BW, h: 28, label: "stall（load-use）", state: "active" });
        else nodes.push({ id: "l" + r.j, shape: "box", x: LXc, y, w: BW, h: 28, label: `I${r.j + 1}  ${ins[r.j].text}`, state: (opt.ls && opt.ls[r.j]) || "default" });
      });
      R.forEach((r, q) => {
        const y = Y0 + q * RH;
        if (r.stall) nodes.push({ id: "rs" + r.j, shape: "box", x: RXc, y, w: BW, h: 28, label: "stall（load-use）", state: "active" });
        else nodes.push({ id: "r" + r.j, shape: "box", x: RXc, y, w: BW, h: 28, label: `I${r.j + 1}  ${ins[r.j].text}`, state: r.j === opt.newJ ? "found" : "default" });
      });
      const bottom = Y0 + Math.max(L.length, R.length, 1) * RH;
      if (opt.result) labels.push({ id: "res", x: W / 2, y: bottom + 8, text: opt.result, cls: "strong", anchor: "middle" });
      return { nodes, edges: [], labels, caption, line };
    }

    function run(list) {
      ins = list;
      const n = ins.length, orig = ins.map((_, j) => j);
      const L = rowsOf(orig), st0 = L.filter((r) => r.stall).length;
      const used = [], order = [];
      const r = new Recorder();
      const maxRows = Math.max(L.length, n * 2);
      player.resize(W, Math.max(300, Y0 + Math.min(maxRows, L.length + 4) * RH + 40));
      const muted = () => { const m = {}; order.forEach((j) => (m[j] = "muted")); return m; };
      r.push(draw(`左邊是原本的順序，有 forwarding 時一共 <b>${st0}</b> 個 load-use stall。${st0 ? "" : "原本就沒有 stall，重排不會更好，但還是可以看檢查的過程。"}接下來從第 1 個位置開始，每個位置依原本順序找第一條「可以合法搬上來、又不會和上一條形成 load-use」的指令。`, null, { left: L, right: [], st0, ls: {} }));
      for (let k = 0; k < n; k++) {
        let pick = -1, first = -1;
        const ls = muted(), why = [];
        for (let j = 0; j < n && pick < 0; j++) {
          if (used[j]) continue;
          let block = null;
          for (let i = 0; i < j; i++) if (!used[i]) { const c = conflictWhy(ins[i], ins[j]); if (c) { block = { i, c }; break; } }
          if (block) { ls[j] = "removed"; why.push(`I${j + 1} 要越過 I${block.i + 1}，但兩者有 ${block.c.t} → 不能搬`); continue; }
          if (first < 0) first = j;
          if (k === 0 || !loadUseStall(ins[order[k - 1]], ins[j])) { pick = j; ls[j] = "found"; why.push(j === first && (k === 0 || !why.length) ? `I${j + 1} 照原本順序就輪到它，不會造成 stall → 選它` : `I${j + 1} 可以合法搬上來，也不會和上一條形成 load-use → 選它`); }
          else { ls[j] = "removed"; why.push(`I${j + 1} 要用上一條 lw（I${order[k - 1] + 1}）載入的 ${rn(ins[order[k - 1]].dst)} → 放這裡會 load-use`); }
        }
        let fb = false;
        if (pick < 0) { pick = first; fb = true; ls[pick] = "found"; why.push(`沒有能避開 stall 的指令，只好照原本順序放 I${pick + 1}，接受這次 stall`); }
        order.push(pick); used[pick] = 1;
        const R = rowsOf(order);
        const lines = fb ? [LR.fallback].concat(LR.place) : why.length > 1 ? [LR.skip, LR.lu].concat(LR.place) : LR.place;
        r.push(draw(`<b>第 ${k + 1} 個位置</b>${k ? `（上一條是 I${order[k - 1] + 1} <code>${esc(ins[order[k - 1]].text)}</code>）` : ""}：${why.join("；")}。`, lines, { left: L, right: R, st0, ls, newJ: pick }));
      }
      const R = rowsOf(order), st1 = R.filter((q) => q.stall).length;
      const t0 = n + 4 + st0, t1 = n + 4 + st1;
      const allm = {}; orig.forEach((j) => (allm[j] = "muted"));
      r.push(draw(`完成。總週期 = 5 + (n − 1) + stall：重排前 ${t0}、重排後 ${t1}${t0 > t1 ? `，省下 ${t0 - t1} 個週期（${((t0 - t1) / t0 * 100).toFixed(0)}%）` : ""}。${st1 ? "還剩下的 stall 是因為找不到可以合法搬進去的獨立指令。" : ""}每次搬動都只越過和它沒有 RAW、WAR、WAW、也不會碰到同一個記憶體位址的指令，所以執行結果和原本完全一樣。`, LR.loop, { left: L, right: R, st0, st1, done: true, ls: allm, result: `重排前 ${t0} 個週期 → 重排後 ${t1} 個週期` }));
      return r.frames;
    }

    const inp = ui.input(player, { placeholder: "指令用 ; 隔開，2～7 行", value: "", width: 300 });
    const DEMO = "lw $t0,0($a0); lw $t1,4($a0); sub $t2,$t0,$t1; sw $t2,8($a0); lw $t3,12($a0); addi $t4,$t3,1; sw $t4,16($a0)";
    inp.value = DEMO;
    const bad = (msg) => {
      inp.classList.add("is-error"); setTimeout(() => inp.classList.remove("is-error"), 700);
      player.load([{ nodes: [], edges: [], labels: [], caption: `${iconHTML("alert")} ${msg}`, line: null }], { autoplay: false });
    };
    function go() {
      const r = readLines(inp, 2, 7);
      if (r.err) return bad(r.err);
      player.load(run(r.ins));
    }
    ui.button(player, "重排", go);
    const ex = (s) => () => { inp.value = s; go(); };
    ui.button(player, "被 WAR 擋住", ex("lw $t0,0($s0); add $t1,$t0,$s1; sub $s1,$s2,$s3"), "ghost");
    ui.button(player, "可能同一個位址", ex("lw $t0,0($s0); add $t1,$t0,$t0; sw $t1,0($s1); lw $t2,0($s2)"), "ghost");
    ui.button(player, "兩個 lw 交錯", ex("lw $t0,0($s0); add $t1,$t0,$s1; lw $t2,4($s0); sub $t3,$t2,$s1; sw $t1,0($s1); sw $t3,4($s1)"), "ghost");
    inp.addEventListener("keydown", (e) => e.key === "Enter" && go());

    const demo = run(DEMO.split(";").map(norm).map(parseLine));
    demo[0].caption = iconHTML("play") + " 按播放看示範：原本 sub 緊接在 lw $t1 後面、addi 緊接在 lw $t3 後面，各要 stall 1 次。把 lw $t3 搬到 sub 前面就能把兩個 stall 都消掉。也可以輸入自己的程式（2～7 行）。";
    player.load(demo, { autoplay: false });
  });

  // ===================================================================
  // 靜態圖解
  // ===================================================================
  const box = (id, label, x, y, w, st, h) => ({ id, label, shape: "box", x, y, w, h: h || 30, state: st || "default" });

  // 圖 1：相依矩陣
  figure("data-hazards-dep-matrix", () => {
    const P = ["lw $t0,0($s0)", "add $t1,$t0,$s1", "sub $t0,$s2,$s3", "or $t1,$t1,$t0"].map(parseLine);
    const nodes = [], labels = [];
    labels.push({ id: "pt", x: 20, y: 24, text: "程式", cls: "title", anchor: "start" });
    P.forEach((x, k) => labels.push({ id: "p" + k, x: 20, y: 56 + k * 40, text: `I${k + 1}  ${x.text}`, cls: "strong", anchor: "start" }));
    const CX = (i) => 330 + i * 122, RY = (j) => 96 + (j - 1) * 50;
    labels.push({ id: "mt", x: 470, y: 24, text: "前面的指令 i（橫）× 後面的指令 j（直）", cls: "title", anchor: "middle" });
    for (let i = 0; i < 3; i++) labels.push({ id: "c" + i, x: CX(i), y: 56, text: "I" + (i + 1), cls: "strong", anchor: "middle" });
    for (let j = 1; j < 4; j++) {
      labels.push({ id: "r" + j, x: 260, y: RY(j), text: "I" + (j + 1), cls: "strong", anchor: "middle" });
      for (let i = 0; i < 3; i++) {
        if (i >= j) { nodes.push(box(`m${i}${j}`, "", CX(i), RY(j), 116, "ghost", 36)); continue; }
        const a = P[i], b = P[j], d = [];
        let newest = true;
        for (let k = i + 1; k < j; k++) if (P[k].dst === a.dst) newest = false;
        if (a.dst > 0 && newest && (a.dst === b.rs || a.dst === b.rt)) d.push("RAW");
        if (b.dst > 0 && (b.dst === a.rs || b.dst === a.rt)) d.push("WAR");
        if (b.dst > 0 && b.dst === a.dst) d.push("WAW");
        const st = d.includes("RAW") ? "active" : d.length ? "compare" : "default";
        const reg = d.includes("RAW") ? rn(a.dst) : d.includes("WAR") ? rn(b.dst) : d.length ? rn(a.dst) : "";
        nodes.push(box(`m${i}${j}`, d.length ? `${d.join("+")} ${reg}` : "—", CX(i), RY(j), 116, st, 36));
      }
    }
    labels.push({ id: "n1", x: 20, y: 236, text: "橘色：RAW（真的要等資料，五階段管線裡唯一會出錯的）", cls: "", anchor: "start" });
    labels.push({ id: "n2", x: 20, y: 258, text: "藍色：只有 WAR / WAW（只是名字撞到，換暫存器就消失）", cls: "", anchor: "start" });
    labels.push({ id: "n3", x: 20, y: 280, text: "I1 → I4 不是 RAW：I3 已經把 $t0 改掉，I4 讀到的是 I3 的值", cls: "warn", anchor: "start" });
    return { width: 640, height: 300, nodes, labels, edges: [] };
  });

  // 圖 2：forwarding mux 示意
  figure("data-hazards-forward-mux", () => {
    const nodes = [
      box("s1", "EX/MEM：上一條的 ALU 結果（10）", 160, 50, 290, "found", 36),
      box("s2", "ID/EX：暫存器檔讀出的 rs（00）", 160, 140, 290, "default", 36),
      box("s3", "ID/EX：暫存器檔讀出的 rt（00）", 160, 250, 290, "default", 36),
      box("s4", "MEM/WB：上上一條的寫回值（01）", 160, 340, 290, "found", 36),
      box("ma", "A", 440, 130, 46, "compare", 96),
      box("mb", "B", 440, 290, 46, "compare", 96),
      box("alu", "ALU", 640, 180, 90, "active", 120),
      box("sd", "sw 要存的資料", 640, 330, 150, "default", 34),
    ];
    const e = (from, to, st) => ({ from, to, state: st || "default", directed: true });
    const edges = [e("s1", "ma", "found"), e("s1", "mb", "found"), e("s2", "ma"), e("s3", "mb"), e("s4", "ma", "found"), e("s4", "mb", "found"), e("ma", "alu"), e("mb", "alu"), e("mb", "sd")];
    const labels = [
      { id: "la", x: 440, y: 68, text: "ForwardA 選", cls: "title", anchor: "middle" },
      { id: "lb", x: 440, y: 352, text: "ForwardB 選", cls: "title", anchor: "middle" },
      { id: "lu", x: 640, y: 106, text: "（B 還會再經過 ALUSrc mux）", cls: "", anchor: "middle" },
      { id: "lo", x: 640, y: 256, text: "結果存進 EX/MEM", cls: "", anchor: "middle" },
    ];
    return { width: 760, height: 380, nodes, labels, edges };
  });

  // 圖 3：double data hazard
  figure("data-hazards-double", () => {
    const nodes = [], labels = [], edges = [];
    const ST = ["IF", "ID", "EX", "MEM", "WB"];
    const X0 = 230, CW = 62, cx = (c) => X0 + (c - 0.5) * CW, ry = (j) => 70 + j * 46;
    const P = ["add $t1,$t1,$t2", "add $t1,$t1,$t3", "add $t1,$t1,$t4"];
    for (let c = 1; c <= 7; c++) labels.push({ id: "c" + c, x: cx(c), y: 36, text: String(c), cls: c === 5 ? "warn" : "", anchor: "middle" });
    P.forEach((t, j) => {
      labels.push({ id: "i" + j, x: 16, y: ry(j), text: `I${j + 1}  ${t}`, cls: "strong", anchor: "start" });
      ST.forEach((s, k) => {
        const c = j + k + 1;
        let st = "default";
        if (c === 5 && j === 2) st = "compare";
        if (c === 5 && j === 1) st = "found";
        if (c === 5 && j === 0) st = "muted";
        nodes.push(box(`n${j}_${c}`, s, cx(c), ry(j), CW - 6, st, 32));
      });
    });
    edges.push({ from: "n1_5", to: "n2_5", state: "found", directed: true });
    labels.push({ id: "a", x: 16, y: ry(2) + 50, text: "週期 5：I3 在 EX 要讀 $t1。EX/MEM（I2）和 MEM/WB（I1）的 rd 都是 $t1", anchor: "start" });
    labels.push({ id: "b", x: 16, y: ry(2) + 72, text: "→ 選最新的 EX/MEM：ForwardA = 10；I1 的值已經被 I2 蓋過了", cls: "warn", anchor: "start" });
    return { width: 680, height: 290, nodes, labels, edges };
  });

  // 圖 4：bubble 往後走（階段 × 週期）
  figure("data-hazards-bubble", () => {
    const P = ["lw $t0,0($s0)", "add $t1,$t0,$s1", "or $t2,$s2,$s3", "sub $t3,$s4,$s5"].map(parseLine);
    const S = simulate(P);
    const nodes = [], labels = [], edges = [];
    const STN = ["IF", "ID", "EX", "MEM", "WB"];
    const C = [2, 3, 4, 5, 6];
    const cx = (q) => 170 + q * 120, ry = (k) => 76 + k * 42;
    labels.push({ id: "t", x: 16, y: 20, text: "I1 lw $t0　I2 add 用 $t0　I3 or　I4 sub", cls: "strong", anchor: "start" });
    C.forEach((c, q) => labels.push({ id: "c" + q, x: cx(q), y: 46, text: "週期 " + c, cls: c === 3 ? "warn" : "title", anchor: "middle" }));
    STN.forEach((s, k) => labels.push({ id: "s" + k, x: 40, y: ry(k), text: s, cls: "strong", anchor: "start" }));
    C.forEach((c, q) => {
      const row = S.cycles[c - 1];
      row.st.forEach((v, k) => {
        let label = v >= 0 ? "I" + (v + 1) + " " + P[v].op : v === BUBBLE ? "nop" : "";
        let st = v === BUBBLE ? "muted" : v === EMPTY ? "ghost" : "default";
        if (c === 4 && (k === 0 || k === 1)) st = "active";
        if (c === 5 && k === 2) st = "compare";
        if (c === 5 && k === 4) st = "found";
        nodes.push(box(`b${q}_${k}`, label, cx(q), ry(k), 104, st, 32));
      });
    });
    labels.push({ id: "n1", x: 16, y: ry(4) + 44, text: "週期 3 偵測到 load-use；週期 4 IF、ID 的指令原地不動（橘色），EX 換成 nop", anchor: "start" });
    labels.push({ id: "n2", x: 16, y: ry(4) + 66, text: "nop 之後沿著 EX → MEM → WB 往後走；週期 5 add 在 EX，從 MEM/WB 拿到 lw 的資料（ForwardA = 01）", anchor: "start" });
    return { width: 760, height: 366, nodes, labels, edges };
  });
})();
