/* =====================================================================
   Pipelining（管線化）主題的視覺化
   - pipeline-timing : 輸入一小段 MIPS 指令，逐個時脈畫出五階段管線時序圖，
                       偵測 RAW 相依並插入 stall，可切換有／無 forwarding
   - 靜態圖：洗衣比喻、五個階段與管線暫存器、理想時序圖、三種相依處理
   ===================================================================== */
(function () {
  "use strict";
  const { Player, Recorder, ui, register, esc, iconHTML, figure } = window.DSViz;

  // 右側程式碼：從 code/computer-organization/pipelining.c 原封不動取出
  const CODE = [
      "int schedule(const Inst *in, int n, int forwarding) {",
      "  for (int j = 0; j < n; j++) {",
      "    fetch[j] = (j == 0) ? 1 : decode[j - 1];   /* 前一條離開 IF/ID，這一條才完成 IF */",
      "    int d = fetch[j] + 1;                      /* 沒有危障：下一個週期就 ID */",
      "    for (int s = 0; s < 2; s++) {",
      "      int i = lastWriter(in, j, in[j].src[s]); /* RAW：我要讀的暫存器是誰寫的 */",
      "      if (i < 0) continue;",
      "      int need;",
      "      if (!forwarding) need = decode[i] + 3;          /* 等它 WB：前半週期寫、後半週期讀 */",
      "      else if (in[i].isLoad) need = decode[i] + 2;    /* load-use：MEM 結束才有資料 */",
      "      else need = decode[i] + 1;                      /* EX 結束就能轉送給下一條 */",
      "      if (need > d) d = need;",
      "    }",
      "    decode[j] = d;",
      "    stalls[j] = d - fetch[j] - 1;              /* 多等的週期就是 stall */",
      "  }",
      "  return decode[n - 1] + 3;                    /* 最後一條：EX、MEM、WB 還要 3 個週期 */",
      "}"
  ];
  const ln = (s) => CODE.findIndex((l) => l.includes(s)) + 1;
  const L = {
    fetch: [ln("fetch[j] = (j == 0)")],
    noHaz: [ln("int d = fetch[j] + 1;")],
    find: [ln("int i = lastWriter(in, j, in[j].src[s]);")],
    needNo: [ln("if (!forwarding) need = decode[i] + 3;")],
    needLoad: [ln("else if (in[i].isLoad) need = decode[i] + 2;")],
    needAlu: [ln("else need = decode[i] + 1;")],
    bump: [ln("if (need > d) d = need;")],
    stall: [ln("stalls[j] = d - fetch[j] - 1;")],
    decode: [ln("decode[j] = d;")],
    ret: [ln("return decode[n - 1] + 3;")],
  };

  // ---------- 解析指令（和 C 程式的 parse() 規則相同） ----------
  const REG = "\\$(?:zero|at|v[01]|a[0-3]|t[0-9]|s[0-7]|k[01]|gp|sp|fp|ra|[12]?[0-9]|3[01])";
  const RE_R = new RegExp(`^(add|sub|and|or|slt)\\s+(${REG})\\s*,\\s*(${REG})\\s*,\\s*(${REG})$`);
  const RE_I = new RegExp(`^(addi|andi|ori|slti)\\s+(${REG})\\s*,\\s*(${REG})\\s*,\\s*-?\\d{1,5}$`);
  const RE_M = new RegExp(`^(lw|sw)\\s+(${REG})\\s*,\\s*-?\\d{1,5}\\s*\\(\\s*(${REG})\\s*\\)$`);

  function parseLine(s) {
    let m;
    if ((m = s.match(RE_R))) return { op: m[1], dst: m[2], src: [m[3], m[4]], isLoad: false };
    if ((m = s.match(RE_I))) return { op: m[1], dst: m[2], src: [m[3], ""], isLoad: false };
    if ((m = s.match(RE_M))) {
      if (m[1] === "lw") return { op: "lw", dst: m[2], src: [m[3], ""], isLoad: true };
      return { op: "sw", dst: "", src: [m[2], m[3]], isLoad: false };
    }
    return null;
  }
  const isZero = (r) => r === "$zero" || r === "$0";

  // ---------- 排時序（和 C 程式的 schedule() 相同），另外記下是誰擋住誰 ----------
  function schedule(ins, fwd) {
    const f = [], d = [], why = [];
    ins.forEach((x, j) => {
      f[j] = j === 0 ? 1 : d[j - 1];
      let dd = f[j] + 1, bind = null;
      const deps = [];
      x.src.forEach((r) => {
        if (!r || isZero(r)) return;
        let i = -1;
        for (let k = j - 1; k >= 0; k--) if (ins[k].dst === r) { i = k; break; }
        if (i < 0) return;
        const need = !fwd ? d[i] + 3 : ins[i].isLoad ? d[i] + 2 : d[i] + 1;
        const dep = { i, reg: r, need };
        if (!deps.some((q) => q.i === i && q.reg === r)) deps.push(dep);
        if (need > dd) { dd = need; bind = dep; }
      });
      d[j] = dd;
      why[j] = { bind, deps };
    });
    return { f, d, total: d[ins.length - 1] + 3, why };
  }

  register("pipeline-timing", function (root) {
    let W = 600;
    const player = new Player(root, {
      title: "Pipeline Timing 管線時序圖",
      width: W, height: 300, code: CODE, wide: true,
      legend: [["compare", "這個週期正在做的階段"], ["active", "stall（被擋住）"], ["found", "資料來源與轉送"], ["new", "等暫存器檔寫回"], ["ghost", "還沒開始"]],
    });

    let ins = [], text = [], fwd = true, S = null;
    const X0 = 150, Y0 = 82, RH = 46;
    let CW = 54;
    const cx = (c) => X0 + (c - 0.5) * CW;
    const ry = (j) => Y0 + j * RH;

    // 第 j 條指令在週期 c 的格子內容
    function cell(j, c) {
      const f = S.f[j], d = S.d[j];
      if (c === f) return "IF";
      if (c > f && c < d) return "stall";
      if (c === d) return "ID";
      if (c === d + 1) return "EX";
      if (c === d + 2) return "MEM";
      if (c === d + 3) return "WB";
      return "";
    }
    // 轉送或寫回的來源格：producer i 在哪個週期、哪個階段把資料交給 consumer j
    function source(dep, j) {
      const i = dep.i, ex = S.d[j] + 1;
      if (!fwd) return { c: S.d[i] + 3, to: S.d[j], kind: "wb" };
      if (S.d[j] >= S.d[i] + 3) return { c: S.d[i] + 3, to: S.d[j], kind: "wb" };   // 已經寫回，直接讀暫存器檔
      return { c: ex - 1, to: ex, kind: ex - 1 === S.d[i] + 1 ? "exmem" : "memwb" };
    }

    function frame(cyc, caption, line, opt = {}) {
      const nodes = [], labels = [], edges = [];
      const hl = opt.hl || {};
      const stallTxt = CW >= 50 ? "stall" : "st";
      labels.push({ id: "mode", x: 12, y: 22, text: fwd ? "有 forwarding" : "無 forwarding（只能等 WB 寫回）", cls: "title", anchor: "start" });
      if (cyc > 0) labels.push({ id: "now", x: W - 12, y: 22, text: `週期 ${Math.min(cyc, S.total)} / ${S.total}`, cls: "strong", anchor: "end" });
      for (let c = 1; c <= S.total; c++)
        labels.push({ id: "cy" + c, x: cx(c), y: 52, text: String(c), cls: c === cyc ? "warn" : "", anchor: "middle" });
      ins.forEach((x, j) => {
        labels.push({ id: "in" + j, x: 12, y: ry(j), text: "I" + (j + 1), cls: "title", anchor: "start" });
        labels.push({ id: "tx" + j, x: 34, y: ry(j), text: text[j], cls: "", anchor: "start" });
        for (let c = 1; c <= S.total; c++) {
          const v = cell(j, c);
          if (!v) continue;
          const key = j + "," + c;
          let st;
          if (c > cyc) st = "ghost";
          else if (hl[key]) st = hl[key];
          else if (v === "stall") st = "active";
          else if (c === cyc) st = "compare";
          else st = "default";
          nodes.push({ id: `c${j}_${c}`, label: c > cyc ? "" : v === "stall" ? stallTxt : v, shape: "box", x: cx(c), y: ry(j), w: CW - 5, h: 32, state: st });
        }
      });
      (opt.edges || []).forEach((e) => edges.push(e));
      if (opt.result) labels.push({ id: "res", x: 12, y: ry(ins.length - 1) + 46, text: opt.result, cls: "strong", anchor: "start" });
      if (CW < 50) labels.push({ id: "abbr", x: W - 12, y: ry(ins.length - 1) + 46, text: "（格子窄時 stall 簡寫成 st）", cls: "", anchor: "end" });
      return { nodes, edges, labels, caption, line };
    }

    const nm = (j) => `I${j + 1}（${esc(text[j])}）`;
    const stageName = { exmem: "EX/MEM", memwb: "MEM/WB" };

    function run(lines, mode) {
      fwd = mode;
      ins = lines.map(parseLine);
      text = lines;
      S = schedule(ins, fwd);
      // 畫面寬度跟著週期數調整：週期少時格子放大，週期多（無 forwarding 的長相依鏈）時格子縮小、stall 簡寫
      CW = S.total <= 12 ? 54 : 40;
      W = Math.max(560, X0 + S.total * CW + 12);
      player.resize(W, ry(ins.length - 1) + 70);
      const n = ins.length, r = new Recorder();
      const nSt = S.d.reduce((a, d, j) => a + (d - S.f[j] - 1), 0);
      r.push(frame(0, `${n} 條指令，${fwd ? "<b>有 forwarding</b>：ALU 結果在 EX 結束就能轉送；只有 lw 後面馬上用到它的資料（load-use）才要停 1 個週期。" : "<b>沒有 forwarding</b>：要用前面指令的結果，只能等它在 WB 寫回暫存器檔（WB 前半週期寫、ID 後半週期讀，所以 ID 可以和 WB 同一個週期）。"}每一列是一條指令、每一行是一個時脈週期，按下一步逐個週期看。`, null));

      for (let c = 1; c <= S.total; c++) {
        const parts = [], hl = {}, edges = [];
        let line = L.decode;
        let prio = 0;
        const use = (p, l) => { if (p > prio) { prio = p; line = l; } };
        const where = [];
        ins.forEach((x, j) => {
          const v = cell(j, c);
          if (v) where.push(`I${j + 1} ${v === "stall" ? "stall" : v}`);
          if (v === "IF") {
            parts.push(`${nm(j)} 進入 IF 取指令${j > 0 && S.f[j] > S.f[j - 1] + 1 ? `（前一條被擋在 IF/ID，這一條直到現在才能完成 IF）` : ""}。`);
            use(1, L.fetch);
          }
          if (v === "stall") {
            const b = S.why[j].bind, src = ins[b.i];
            hl[`${b.i},${source(b, j).c}`] = fwd ? "found" : "new";
            if (!fwd) parts.push(`${nm(j)} 要讀 <code>${esc(b.reg)}</code>，但它由 I${b.i + 1} 產生，要到週期 ${b.need}（I${b.i + 1} 的 WB）才寫回暫存器檔：<b>stall</b>，後面的指令也跟著等。`);
            else parts.push(`${nm(j)} 要用 <code>${esc(b.reg)}</code>，I${b.i + 1} 是 <code>${src.op}</code>，資料要到 MEM 結束才從記憶體讀出來，轉送也來不及給下一個週期的 EX：<b>load-use，stall 1 個週期</b>。`);
            use(4, (fwd ? L.needLoad : L.needNo).concat(L.bump, L.stall));
          }
          if (v === "ID") {
            const deps = S.why[j].deps;
            if (!deps.length) { use(2, L.noHaz); return; }
            if (!fwd || deps.every((dp) => source(dp, j).kind === "wb")) {
              const rd = deps.filter((dp) => source(dp, j).c === c);
              rd.forEach((dp) => {
                hl[`${dp.i},${c}`] = "new";
                hl[`${j},${c}`] = "new";
                edges.push({ from: `c${dp.i}_${c}`, to: `c${j}_${c}`, state: "active", directed: true });
              });
              if (rd.length) parts.push(`${nm(j)} 在 ID 讀 <code>${rd.map((dp) => esc(dp.reg)).join("、")}</code>：I${rd[0].i + 1} 這個週期在 WB，前半週期寫入、後半週期讀出，剛好來得及。`);
              else parts.push(`${nm(j)} 進入 ID：要讀的暫存器早就寫回了，不用等。`);
              use(3, L.find.concat(fwd ? [] : L.needNo));
            } else {
              parts.push(`${nm(j)} 進入 ID：它和前面的指令有相依，但下一個週期 EX 時資料可以轉送過來，不用等。`);
              use(3, L.find.concat(deps.some((dp) => ins[dp.i].isLoad) ? L.needLoad : L.needAlu));
            }
          }
          if (v === "EX" && fwd) {
            S.why[j].deps.forEach((dp) => {
              const s = source(dp, j);
              if (s.kind === "wb") return;
              hl[`${dp.i},${s.c}`] = "found";
              hl[`${j},${c}`] = "found";
              edges.push({ from: `c${dp.i}_${s.c}`, to: `c${j}_${c}`, state: "found", directed: true });
              parts.push(`${nm(j)} 在 EX 需要 <code>${esc(dp.reg)}</code>：從 ${stageName[s.kind]} 管線暫存器轉送 I${dp.i + 1} ${ins[dp.i].isLoad ? "剛從記憶體讀出的資料" : "上一個週期算出的結果"}（forwarding）。`);
              use(3, ins[dp.i].isLoad ? L.needLoad : L.needAlu);
            });
          }
          if (v === "WB" && j === n - 1) use(5, L.ret);
        });
        if (!parts.length) parts.push(c > S.f[n - 1] ? `所有指令都已經進入管線，沒有新的指令可以取，管線開始<b>排空</b>。` : `管線往前推進一格，沒有危障。`);
        r.push(frame(c, `<b>週期 ${c}</b>（${where.join("、")}）：${parts.join("")}`, line, { hl, edges }));
      }
      const res = `總週期 ${S.total} = 5 + (${n} − 1) + ${nSt} 個 stall，CPI = ${S.total} / ${n} = ${(S.total / n).toFixed(2)}`;
      r.push(frame(S.total + 1, `全部完成：最後一條在週期 ${S.total} 做完 WB。理想情況 ${n} 條指令要 5 + ${n} − 1 = ${n + 4} 個週期（前 4 個週期在填滿管線），這段程式多了 <b>${nSt}</b> 個 stall。${fwd ? "按「無 forwarding」比比看要多等幾個週期。" : "按「有 forwarding」看看轉送可以省掉多少 stall。"}`, L.ret, { result: res }));
      return r.frames;
    }

    const inT = ui.input(player, { placeholder: "指令用 ; 隔開，2～6 行", value: "lw $t0,0($s0); add $t1,$t0,$t2; sub $t3,$t1,$t4", width: 300 });
    let mode = true;
    const bad = (msg) => {
      inT.classList.add("is-error"); setTimeout(() => inT.classList.remove("is-error"), 700);
      ins = []; text = []; S = { f: [], d: [], total: 0, why: [] };
      player.load([{ nodes: [], edges: [], labels: [], caption: `${iconHTML("alert")} ${msg}`, line: null }], { autoplay: false });
    };
    function go(m) {
      if (m !== undefined) mode = m;
      const lines = inT.value.split(/[;\n]/).map((s) => s.trim().replace(/\s+/g, " ")).filter(Boolean);
      if (lines.length < 2 || lines.length > 6) return bad(`請輸入 2～6 行指令，用分號 ; 隔開（目前 ${lines.length} 行）。`);
      for (let k = 0; k < lines.length; k++) {
        if (lines[k].length > 24) return bad(`第 ${k + 1} 行太長：${esc(lines[k])}`);
        if (!parseLine(lines[k])) return bad(`第 ${k + 1} 行「${esc(lines[k])}」格式不對。支援：add/sub/and/or/slt $rd,$rs,$rt、addi/andi/ori/slti $rt,$rs,常數、lw/sw $rt,位移($rs)，暫存器寫成 $t0、$s1、$zero 這類名稱。`);
      }
      player.load(run(lines, mode));
    }
    ui.button(player, "有 forwarding", () => go(true));
    ui.button(player, "無 forwarding", () => go(false));
    const ex = (s) => () => { inT.value = s; go(); };
    ui.button(player, "ALU 連續相依", ex("add $t0,$s1,$s2; sub $t1,$t0,$s3; and $t2,$t1,$t0; or $t3,$t2,$s4"), "ghost");
    ui.button(player, "load-use 隔一條", ex("lw $t0,0($s0); addi $s1,$s1,4; add $t1,$t0,$t2"), "ghost");
    ui.button(player, "沒有相依", ex("add $t1,$s1,$s2; sub $t2,$s3,$s4; and $t3,$s5,$s6; or $t4,$s1,$s3"), "ghost");
    inT.addEventListener("keydown", (e) => e.key === "Enter" && go());

    const demo = run(["lw $t0,0($s0)", "add $t1,$t0,$t2", "sub $t3,$t1,$t4"], true);
    demo[0].caption = iconHTML("play") + " 按播放看示範：lw 載入 $t0，add 馬上要用 $t0（load-use），sub 又要用 add 的結果 $t1。有 forwarding 時只需要 1 個 stall、共 8 個週期；按「無 forwarding」會變成 4 個 stall、11 個週期。也可以輸入自己的指令（2～6 行，用 ; 隔開）。";
    player.load(demo, { autoplay: false });
  });

  // ===================================================================
  // 靜態圖解
  // ===================================================================
  const box = (id, label, x, y, w, st, h) => ({ id, label, shape: "box", x, y, w, h: h || 30, state: st || "default" });

  // 圖 1：洗衣比喻（洗 30、烘 40、摺 20 分鐘，4 籃）
  figure("pipelining-laundry", () => {
    const nodes = [], labels = [], X0 = 96, PX = 1.75, RH = 30;
    const tx = (t) => X0 + t * PX;
    const dur = [30, 40, 20], nm = ["洗", "烘", "摺"], st = ["compare", "active", "found"];
    labels.push({ id: "ta", x: 16, y: 22, text: "(a) 一籃做完再做下一籃：4 × 90 = 360 分鐘", cls: "strong", anchor: "start" });
    for (let k = 0; k < 4; k++) {
      let t = k * 90;
      labels.push({ id: "la" + k, x: 16, y: 54 + k * RH, text: "第 " + (k + 1) + " 籃", anchor: "start" });
      dur.forEach((d, s) => { nodes.push(box(`a${k}_${s}`, nm[s], tx(t + d / 2), 54 + k * RH, d * PX - 3, st[s], 24)); t += d; });
    }
    const Y2 = 210;
    labels.push({ id: "tb", x: 16, y: Y2 - 32, text: "(b) 管線：每一步 40 分鐘（等最慢的烘衣機），(3 + 4 − 1) × 40 = 240 分鐘", cls: "strong", anchor: "start" });
    for (let k = 0; k < 4; k++) {
      labels.push({ id: "lb" + k, x: 16, y: Y2 + k * RH, text: "第 " + (k + 1) + " 籃", anchor: "start" });
      dur.forEach((d, s) => { const t = (k + s) * 40; nodes.push(box(`b${k}_${s}`, nm[s], tx(t + d / 2), Y2 + k * RH, d * PX - 3, st[s], 24)); });
    }
    [0, 120, 240, 360].forEach((t) => labels.push({ id: "ax" + t, x: tx(t), y: Y2 + 4 * RH + 4, text: t + " 分", anchor: "middle" }));
    labels.push({ id: "note", x: tx(360), y: Y2 + 40, text: "洗和摺做完後要空等到 40 分鐘才能交棒", cls: "warn", anchor: "end" });
    return { width: 760, height: 352, nodes, labels, edges: [] };
  });

  // 圖 2：五個階段與管線暫存器
  figure("pipelining-stages", () => {
    const nodes = [], labels = [], edges = [];
    const st = [["IF", "取指令、PC + 4"], ["ID", "解碼、讀暫存器"], ["EX", "ALU 運算／算位址"], ["MEM", "讀寫資料記憶體"], ["WB", "結果寫回暫存器"]];
    const regs = ["IF/ID", "ID/EX", "EX/MEM", "MEM/WB"];
    const SX = (k) => 70 + k * 160, Y = 80;
    st.forEach(([a, b], k) => {
      nodes.push(box("s" + k, a, SX(k), Y, 92, "compare", 44));
      labels.push({ id: "d" + k, x: SX(k), y: Y + 44, text: b, anchor: "middle" });
    });
    regs.forEach((r, k) => {
      nodes.push(box("r" + k, "", SX(k) + 80, Y, 14, "active", 92));
      labels.push({ id: "rl" + k, x: SX(k) + 80, y: Y - 60, text: r, cls: "title", anchor: "middle" });
      edges.push({ from: "s" + k, to: "r" + k, directed: true }, { from: "r" + k, to: "s" + (k + 1), directed: true });
    });
    labels.push({ id: "n1", x: 390, y: 176, text: "管線暫存器在每個時脈邊緣把這一階段的結果交給下一階段", cls: "warn", anchor: "middle" });
    return { width: 780, height: 196, nodes, labels, edges };
  });

  // 圖 3：理想時序圖：5 條指令、9 個週期
  figure("pipelining-ideal", () => {
    const nodes = [], labels = [], ST = ["IF", "ID", "EX", "MEM", "WB"];
    const X0 = 150, CW = 62, cx = (c) => X0 + (c - 0.5) * CW, ry = (j) => 70 + j * 40;
    for (let c = 1; c <= 9; c++) labels.push({ id: "c" + c, x: cx(c), y: 40, text: String(c), cls: c === 5 ? "warn" : "", anchor: "middle" });
    for (let j = 0; j < 5; j++) {
      labels.push({ id: "i" + j, x: 20, y: ry(j), text: "指令 " + (j + 1), cls: "strong", anchor: "start" });
      ST.forEach((s, k) => nodes.push(box(`n${j}_${k}`, s, cx(j + k + 1), ry(j), CW - 6, j + k + 1 === 5 ? "active" : "compare", 30)));
    }
    labels.push({ id: "f", x: cx(2.5), y: ry(4) + 44, text: "填滿：前 4 個週期", anchor: "middle" });
    labels.push({ id: "m", x: cx(5), y: ry(4) + 44, text: "週期 5：五個階段都在忙", cls: "warn", anchor: "middle" });
    labels.push({ id: "e", x: cx(7.5), y: ry(4) + 44, text: "排空：後 4 個週期", anchor: "middle" });
    return { width: 720, height: 300, nodes, labels, edges: [] };
  });

  // 圖 4：三種相依處理的對照
  figure("pipelining-hazard-cases", () => {
    const nodes = [], labels = [], edges = [];
    const X0 = 200, CW = 62, cx = (c) => X0 + (c - 0.5) * CW;
    const part = (pfx, y, title, rows, link, caption) => {
      labels.push({ id: pfx + "t", x: 16, y, text: title, cls: "strong", anchor: "start" });
      rows.forEach(([name, cells], j) => {
        const yy = y + 34 + j * 54;
        labels.push({ id: pfx + "n" + j, x: 16, y: yy, text: name, anchor: "start" });
        cells.forEach(([c, v, st]) => nodes.push(box(`${pfx}${j}_${c}`, v, cx(c), yy, CW - 6, st, 30)));
      });
      edges.push({ from: `${pfx}${link[0]}`, to: `${pfx}${link[1]}`, state: "found", directed: true });
      labels.push({ id: pfx + "c", x: 764, y, text: caption, cls: "warn", anchor: "end" });
    };
    const seq = (f, d) => [[f, "IF", "default"], ...Array.from({ length: d - f - 1 }, (_, k) => [f + k + 1, "stall", "active"]), [d, "ID", "default"], [d + 1, "EX", "default"], [d + 2, "MEM", "default"], [d + 3, "WB", "default"]];
    const mark = (cells, c, st) => cells.map((x) => (x[0] === c ? [x[0], x[1], st] : x));
    part("a", 20, "(a) 無 forwarding：add → sub", [["add $t1,$s1,$s2", mark(seq(1, 2), 5, "found")], ["sub $t3,$t1,$s3", mark(seq(2, 5), 5, "found")]], ["0_5", "1_5"], "等到 WB，stall 2");
    part("b", 150, "(b) forwarding：add → sub", [["add $t1,$s1,$s2", mark(seq(1, 2), 3, "found")], ["sub $t3,$t1,$s3", mark(seq(2, 3), 4, "found")]], ["0_3", "1_4"], "EX → EX，不用停");
    part("c", 280, "(c) forwarding：lw → sub（load-use）", [["lw $t1,0($s0)", mark(seq(1, 2), 4, "found")], ["sub $t3,$t1,$s3", mark(seq(2, 4), 5, "found")]], ["0_4", "1_5"], "MEM → EX，仍要 stall 1");
    return { width: 780, height: 400, nodes, labels, edges };
  });
})();
