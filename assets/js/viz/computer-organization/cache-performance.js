/* =====================================================================
   Cache Performance（快取效能）主題的圖與動畫
   - cache-perf-calc : 效能計算器＋拆解：輸入 base CPI、存取比例、miss rate、penalty（可加 L2），
                       逐步展開 CPI 公式，最後用長條圖比較理想 CPI 與 I / D 停頓
   - 靜態圖：AMAT 的機率樹、多層快取的 local / global miss rate、三種記憶體組織的 miss penalty
   ===================================================================== */
(function () {
  "use strict";
  const { Player, Recorder, ui, register, iconHTML, figure } = window.DSViz;

  // 右側程式碼：從 code/computer-organization/cache-performance.c 原封不動取出
  const CODE = [
    "Breakdown breakdown(Config c) {",
    "  Breakdown b;",
    "  b.penalty = c.memPenalty;                          /* L1 miss 要付的代價 */",
    "  if (c.hasL2)                                       /* 有 L2：先問 L2，L2 也 miss 才去主記憶體 */",
    "    b.penalty = c.l2Hit + c.l2LocalMiss * c.memPenalty;",
    "  b.iStall = c.instrRefs * c.iMiss * b.penalty;      /* 取指令造成的停頓 */",
    "  b.dStall = c.dataRefs * c.dMiss * b.penalty;       /* load/store 造成的停頓 */",
    "  b.cpi = c.baseCPI + b.iStall + b.dStall;           /* 實際 CPI */",
    "  return b;",
    "}"
  ];
  const ln = (s) => CODE.findIndex((l) => l.includes(s)) + 1;
  const L = {
    pen: [ln("b.penalty = c.memPenalty;"), ln("if (c.hasL2)")],
    l2: [ln("if (c.hasL2)"), ln("b.penalty = c.l2Hit + c.l2LocalMiss * c.memPenalty;")],
    i: ln("b.iStall = c.instrRefs * c.iMiss * b.penalty;"),
    d: ln("b.dStall = c.dataRefs * c.dMiss * b.penalty;"),
    cpi: ln("b.cpi = c.baseCPI + b.iStall + b.dStall;"),
    ret: ln("return b;"),
  };

  // 數字格式：最多 3 位小數，去掉多餘的 0
  const num = (x) => String(Math.round(x * 1000) / 1000);
  const pct = (x) => String(Math.round(x * 100000) / 1000) + "%";
  const share = (x, t) => Math.round((x / t) * 100) + "%";

  // 和 C 程式的 breakdown() 同樣的算法
  function breakdown(c) {
    let penalty = c.P;
    if (c.l2) penalty = c.h2 + c.m2 * c.P;
    const iStall = c.iref * c.mi * penalty;
    const dStall = c.ls * c.md * penalty;
    return { penalty, iStall, dStall, cpi: c.base + iStall + dStall };
  }

  register("cache-perf-calc", function (root) {
    const player = new Player(root, {
      title: "CPI Calculator 記憶體停頓計算器",
      width: 680, height: 400, code: CODE, wide: true,
      legend: [["compare", "這一步用到的參數"], ["default", "理想 CPI（base）"], ["active", "I-cache 停頓"], ["new", "D-cache 停頓"]],
    });

    const KEYS = [
      ["base", "base CPI", (c) => num(c.base)],
      ["iref", "取指次數", (c) => num(c.iref)],
      ["ls", "LS 比例", (c) => pct(c.ls)],
      ["mi", "I miss", (c) => pct(c.mi)],
      ["md", "D miss", (c) => pct(c.md)],
      ["P", "penalty", (c) => num(c.P)],
      ["h2", "L2 hit", (c) => (c.l2 ? num(c.h2) : "—")],
      ["m2", "L2 local", (c) => (c.l2 ? pct(c.m2) : "—")],
    ];
    const BX = 110, BMAX = 540, BY = [292, 350];
    let scale = 1;

    // st：{ cfg, title, use: [參數], rows: [{text, cur}], bars: [{name, b, note}], right }
    function frame(caption, line, st) {
      const nodes = [], labels = [];
      labels.push({ id: "title", x: 24, y: 22, text: st.title, cls: "title", anchor: "start" });
      if (st.right) labels.push({ id: "right", x: 656, y: 22, text: st.right, cls: "ok", anchor: "end" });
      KEYS.forEach(([k, name, show], i) => {
        const off = (k === "h2" || k === "m2") && !st.cfg.l2;
        nodes.push({ id: "p_" + k, label: show(st.cfg), sub: name, shape: "box", x: 58 + i * 80, y: 58, w: 70, h: 32,
          state: off ? "ghost" : (st.use || []).includes(k) ? "compare" : "default" });
      });
      (st.rows || []).forEach((r, i) => {
        labels.push({ id: "row" + i, x: 24, y: 120 + i * 30, text: r.text, cls: r.cur ? "strong" : "", anchor: "start" });
      });
      (st.bars || []).forEach((bar, k) => {
        const y = BY[k], b = bar.b, base = bar.cfg.base;
        labels.push({ id: "bn" + k, x: BX - 10, y, text: bar.name, cls: "title", anchor: "end" });
        let x = BX;
        [["base", base, "default"], ["i", b.iStall, "active"], ["d", b.dStall, "new"]].forEach(([s, v, state]) => {
          const w = v * scale;
          nodes.push({ id: `b${k}_${s}`, label: w >= 48 ? num(v) : "", shape: "box", x: x + Math.max(w, 1) / 2, y, w: Math.max(w, 1), h: 30, state });
          x += w;
        });
        labels.push({ id: "bs" + k, x: BX, y: y + 30, anchor: "start",
          text: `CPI ${num(b.cpi)}：理想 ${num(base)}（${share(base, b.cpi)}）· I ${num(b.iStall)}（${share(b.iStall, b.cpi)}）· D ${num(b.dStall)}（${share(b.dStall, b.cpi)}）${bar.note || ""}` });
      });
      return { nodes, edges: [], labels, caption, line };
    }

    // 一組設定的計算步驟；prev：前面已經畫好的長條
    function steps(r, c, name, bars, title, intro) {
      const b = breakdown(c), rows = [];
      const push = (cap, line, use, extra) => r.push(frame(cap, line, Object.assign({ cfg: c, title, use, rows: rows.map((x, i) => ({ text: x, cur: i === rows.length - 1 })), bars }, extra || {})));
      if (c.l2) {
        rows.push(`L1 miss penalty = ${num(c.h2)} + ${pct(c.m2)} × ${num(c.P)} = ${num(b.penalty)} cycles`);
        push(`${intro}L1 miss 後先問 L2：一定要付 L2 hit time ${num(c.h2)} cycles；其中 ${pct(c.m2)}（L2 的 local miss rate）L2 也沒有，才再付主記憶體的 ${num(c.P)} cycles。所以 L1 每次 miss 平均只要 <b>${num(b.penalty)}</b> cycles，而不是 ${num(c.P)}。`, L.l2, ["h2", "m2", "P"]);
      } else {
        rows.push(`L1 miss penalty = 主記憶體 penalty = ${num(c.P)} cycles`);
        push(`${intro}沒有 L2：L1 miss 就直接到主記憶體，每次 miss 付 <b>${num(c.P)}</b> cycles。`, L.pen, ["P"]);
      }
      rows.push(`I 停頓 = ${num(c.iref)} × ${pct(c.mi)} × ${num(b.penalty)} = ${num(b.iStall)} cycles/指令`);
      push(`<b>每一條指令</b>都要從 I-cache 取指令（每條 ${num(c.iref)} 次），其中 ${pct(c.mi)} 會 miss，每次 miss 停 ${num(b.penalty)} cycles：平均每條指令停 <b>${num(b.iStall)}</b> cycles。`, L.i, ["iref", "mi"]);
      rows.push(`D 停頓 = ${pct(c.ls)} × ${pct(c.md)} × ${num(b.penalty)} = ${num(b.dStall)} cycles/指令`);
      push(`只有 load/store（${pct(c.ls)} 的指令）會存取 D-cache，所以要先乘上 ${pct(c.ls)}，再乘 D-cache miss rate ${pct(c.md)} 和 penalty：平均每條指令停 <b>${num(b.dStall)}</b> cycles。`, L.d, ["ls", "md"]);
      rows.push(`CPI = ${num(c.base)} + ${num(b.iStall)} + ${num(b.dStall)} = ${num(b.cpi)}`);
      push(`停頓是「每條指令平均多等的 cycle 數」，直接加到理想 CPI 上：${num(c.base)} + ${num(b.iStall)} + ${num(b.dStall)} = <b>${num(b.cpi)}</b>。`, L.cpi, ["base"]);
      const stall = b.iStall + b.dStall;
      bars.push({ name, b, cfg: c });
      b.rows = rows.map((x) => ({ text: x, cur: false }));
      push(`畫成長條：記憶體停頓佔了 <b>${share(stall, b.cpi)}</b> 的時間${stall > 0 ? `，其中 ${b.iStall >= b.dStall ? "I-cache" : "D-cache"} 佔得比較多` : ""}。如果快取永遠命中，CPI 只有 ${num(c.base)}，會快 ${num(b.cpi / c.base)} 倍。`, L.ret, []);
      return b;
    }

    function run(cfgs, mode) {
      const bs = cfgs.map(breakdown);
      scale = BMAX / Math.max(...bs.map((b) => b.cpi));
      const r = new Recorder(), bars = [];
      const A = cfgs[0], B = cfgs[1];
      const tA = mode === "l2" ? "設定 A：沒有 L2" : mode === "clock" ? "設定 A：原本的時脈" : "記憶體停頓拆解";
      r.push(frame(mode === "single"
        ? `CPI = 理想 CPI + 每條指令的記憶體停頓。停頓分成兩部分：<b>取指令</b>（I-cache）和 <b>load/store</b>（D-cache），各自是「存取次數 × miss rate × miss penalty」。`
        : mode === "l2" ? `比較同一台機器<b>沒有 L2</b> 和<b>加上 L2</b> 的 CPI。先算 A（沒有 L2）。`
          : `比較時脈<b>加倍</b>前後。主記憶體的存取時間（ns）不會跟著變快，所以換算成 cycle 會變成 2 倍。先算 A（原本的時脈）。`, null, { cfg: A, title: tA, rows: [], bars }));
      const bA = steps(r, A, mode === "single" ? "CPI" : "A", bars, tA, "");
      if (!B) {
        r.push(frame(`算完了：CPI = <b>${num(bA.cpi)}</b>，其中理想 CPI 佔 ${share(A.base, bA.cpi)}、I-cache 停頓佔 ${share(bA.iStall, bA.cpi)}、D-cache 停頓佔 ${share(bA.dStall, bA.cpi)}。改改看 miss rate 或 penalty，或按「加上 L2 前後」「時脈加倍前後」比較。`, null, { cfg: A, title: tA, rows: bA.rows, bars }));
        return r.frames;
      }
      const tB = mode === "l2" ? "設定 B：加上 L2" : "設定 B：時脈加倍";
      const intro = mode === "l2"
        ? `換成 B：其他參數不變，只在 L1 和主記憶體之間加一層 L2。`
        : `換成 B：時脈加倍，一個 cycle 只剩一半的時間，主記憶體同樣要等那麼多 ns，penalty 變成 ${num(A.P)} × 2 = ${num(B.P)} cycles${A.l2 ? `（L2 hit time 也以 ns 固定，變成 ${num(B.h2)} cycles）` : ""}。理想 CPI 和 miss rate 不變。`;
      const bB = steps(r, B, "B", bars, tB, intro + " ");
      if (mode === "l2") {
        const sp = bA.cpi / bB.cpi;
        r.push(frame(`時脈和指令數都沒變，只有 CPI 變了：加速 = ${num(bA.cpi)} / ${num(bB.cpi)} = <b>${num(sp)} 倍</b>。L2 把 L1 miss 的平均代價從 ${num(bA.penalty)} 降到 ${num(bB.penalty)} cycles，停頓從 ${num(bA.iStall + bA.dStall)} 降到 ${num(bB.iStall + bB.dStall)} cycles/指令。`, null,
          { cfg: B, title: tB, rows: bB.rows, bars, right: `加速 ${num(sp)} 倍` }));
      } else {
        const tAt = bA.cpi, tBt = bB.cpi / 2, sp = tAt / tBt;
        r.push(frame(`CPI 從 ${num(bA.cpi)} 變成 ${num(bB.cpi)}，但每個 cycle 只要一半的時間。每條指令的時間：A = ${num(bA.cpi)} × T，B = ${num(bB.cpi)} × T/2 = ${num(tBt)} T。加速 = ${num(tAt)} / ${num(tBt)} = <b>${num(sp)} 倍</b>，時脈快了 2 倍，程式卻只快 ${Math.round((sp - 1) * 100)}%：記憶體停頓佔的比例從 ${share(bA.iStall + bA.dStall, bA.cpi)} 升到 ${share(bB.iStall + bB.dStall, bB.cpi)}。`, null,
          { cfg: B, title: tB, rows: bB.rows.concat([{ text: `時間比 = (${num(bA.cpi)} × T) / (${num(bB.cpi)} × T/2) = ${num(sp)}`, cur: true }]), bars, right: `只快 ${num(sp)} 倍` }));
      }
      return r.frames;
    }

    // ---------- 輸入 ----------
    const field = (lab, val, w, ph) => {
      const s = document.createElement("span");
      s.textContent = lab;
      player.toolbar.appendChild(s);
      return ui.input(player, { value: val, width: w, placeholder: ph || lab });
    };
    const inp = {
      base: field("base CPI", "1.5", 50), iref: field("取指/指令", "1", 40), ls: field("load/store %", "30", 46),
      mi: field("I miss %", "1", 46), md: field("D miss %", "5", 46), P: field("penalty", "80", 52),
      h2: field("L2 hit", "", 46, "無"), m2: field("L2 local miss %", "", 46, "無"),
    };
    const bad = (el, msg) => {
      el.classList.add("is-error"); setTimeout(() => el.classList.remove("is-error"), 700);
      player.load([{ nodes: [], edges: [], labels: [], caption: `${iconHTML("alert")} ${msg}`, line: null }], { autoplay: false });
      return null;
    };
    const val = (el, lo, hi) => {
      const t = el.value.trim().replace(/%$/, "");
      if (!/^\d+(\.\d+)?$/.test(t)) return NaN;
      const v = Number(t);
      return v >= lo && v <= hi ? v : NaN;
    };
    function read() {
      const c = {};
      const chk = [["base", 0.1, 20, "base CPI 請輸入 0.1～20 的數字。"], ["iref", 0, 3, "每條指令的取指次數請輸入 0～3（通常是 1）。"],
        ["ls", 0, 100, "load/store 比例請輸入 0～100 的百分比，例如 30。"], ["mi", 0, 100, "I-cache miss rate 請輸入 0～100 的百分比，例如 2。"],
        ["md", 0, 100, "D-cache miss rate 請輸入 0～100 的百分比，例如 5。"], ["P", 1, 1000, "主記憶體 penalty 請輸入 1～1000 個 cycle。"]];
      for (const [k, lo, hi, msg] of chk) {
        const v = val(inp[k], lo, hi);
        if (Number.isNaN(v)) return bad(inp[k], msg);
        c[k] = ["ls", "mi", "md"].includes(k) ? v / 100 : v;
      }
      const h2 = inp.h2.value.trim(), m2 = inp.m2.value.trim();
      c.l2 = h2 !== "" || m2 !== "";
      if (c.l2) {
        const a = val(inp.h2, 0, 500);
        if (Number.isNaN(a)) return bad(inp.h2, "L2 hit time 請輸入 0～500 個 cycle；不想要 L2 就把兩格 L2 都清空。");
        const b = val(inp.m2, 0, 100);
        if (Number.isNaN(b)) return bad(inp.m2, "L2 local miss rate 請輸入 0～100 的百分比；不想要 L2 就把兩格 L2 都清空。");
        c.h2 = a; c.m2 = b / 100;
      }
      return c;
    }
    const set = (v) => Object.keys(v).forEach((k) => (inp[k].value = v[k]));
    const TYPICAL = { base: "1.5", iref: "1", ls: "30", mi: "1", md: "5", P: "80", h2: "", m2: "" };

    function go(mode) {
      const c = read();
      if (!c) return;
      if (mode === "single") return player.load(run([c], "single"));
      if (mode === "l2") {
        if (!c.l2) return bad(inp.h2, "要比較加上 L2 的效果，請先填 L2 hit time 和 L2 local miss rate（例如 10 和 20）。");
        return player.load(run([Object.assign({}, c, { l2: false }), c], "l2"));
      }
      const f = Object.assign({}, c, { P: c.P * 2, h2: c.l2 ? c.h2 * 2 : c.h2 });
      player.load(run([c, f], "clock"));
    }
    ui.button(player, "計算", () => go("single"));
    ui.button(player, "和沒有 L2 比較", () => go("l2"));
    ui.button(player, "時脈加倍比較", () => go("clock"));
    ui.button(player, "典型設定", () => { set(TYPICAL); go("single"); }, "ghost");
    ui.button(player, "加上 L2 前後", () => { set(Object.assign({}, TYPICAL, { h2: "10", m2: "20" })); go("l2"); }, "ghost");
    ui.button(player, "時脈加倍前後", () => { set(TYPICAL); go("clock"); }, "ghost");
    Object.values(inp).forEach((el) => el.addEventListener("keydown", (e) => e.key === "Enter" && go("single")));

    const demo = run([{ base: 1.5, iref: 1, ls: 0.3, mi: 0.01, md: 0.05, P: 80, l2: false }], "single");
    demo[0].caption = iconHTML("play") + " 按播放看示範：理想 CPI 1.5、30% 是 load/store、I-cache miss 1%、D-cache miss 5%、penalty 80 cycles，逐步算出 CPI = 3.5。改上面的數字後按「計算」；填了 L2 的兩格可以按「和沒有 L2 比較」；「時脈加倍比較」會把 penalty 換算成 2 倍的 cycle。";
    player.load(demo, { autoplay: false });
  });

  // ===================================================================
  // 靜態圖解
  // ===================================================================
  const box = (id, label, x, y, w, st, h, sub) => ({ id, label, shape: "box", x, y, w, h: h || 34, state: st || "default", sub });

  // 圖 1：一次存取的機率樹 → AMAT
  figure("cache-perf-amat-tree", () => {
    const nodes = [
      box("acc", "一次存取", 110, 130, 110, "compare"),
      box("hit", "hit 95%", 330, 66, 110, "found"),
      box("miss", "miss 5%", 330, 194, 110, "removed"),
      box("th", "1 cycle", 560, 66, 150, "default"),
      box("tm", "1 + 80 = 81", 560, 194, 150, "default"),
    ];
    const edges = [
      { from: "acc", to: "hit", directed: true }, { from: "acc", to: "miss", directed: true },
      { from: "hit", to: "th", directed: true }, { from: "miss", to: "tm", directed: true, state: "removed" },
    ];
    const labels = [
      { id: "l1", x: 445, y: 46, text: "只付 hit time" },
      { id: "l2", x: 445, y: 160, text: "查完快取再等記憶體" },
      { id: "l3", x: 560, y: 226, text: "hit time + miss penalty" },
      { id: "f1", x: 340, y: 262, text: "AMAT = 0.95 × 1 + 0.05 × 81 = 1 + 0.05 × 80 = 5 cycles", cls: "strong" },
      { id: "f2", x: 340, y: 290, text: "只有 5% 的存取 miss，平均時間卻是 hit time 的 5 倍", cls: "warn" },
    ];
    return { width: 680, height: 310, nodes, edges, labels };
  });

  // 圖 2：兩層快取的 local / global miss rate
  figure("cache-perf-multilevel", () => {
    const nodes = [
      box("cpu", "CPU", 60, 110, 80, "compare"),
      box("l1", "L1", 240, 110, 90, "default", 40, "hit 1 cycle"),
      box("l2", "L2", 430, 110, 90, "default", 40, "hit 10 cycles"),
      box("mem", "主記憶體", 610, 110, 100, "muted", 40, "80 cycles"),
    ];
    const edges = [
      { from: "cpu", to: "l1", directed: true }, { from: "l1", to: "l2", directed: true, state: "active" },
      { from: "l2", to: "mem", directed: true, state: "removed" },
    ];
    const labels = [
      { id: "a", x: 150, y: 90, text: "1000 次", cls: "strong" },
      { id: "b", x: 335, y: 90, text: "50 次", cls: "strong" },
      { id: "c", x: 520, y: 90, text: "10 次", cls: "strong" },
      { id: "h1", x: 240, y: 172, text: "命中 950 次" },
      { id: "h2", x: 430, y: 172, text: "命中 40 次" },
      { id: "r1", x: 240, y: 30, text: "L1 miss rate = 50 / 1000 = 5%", cls: "title" },
      { id: "r2", x: 430, y: 52, text: "L2 local miss rate = 10 / 50 = 20%", cls: "title" },
      { id: "g", x: 340, y: 216, text: "global miss rate = 10 / 1000 = 1% = 5% × 20%", cls: "warn" },
      { id: "f", x: 340, y: 248, text: "AMAT = 1 + 5% × (10 + 20% × 80) = 2.3 cycles", cls: "strong" },
    ];
    return { width: 680, height: 270, nodes, edges, labels };
  });

  // 圖 3：三種記憶體組織的 miss penalty（區塊 4 words；送位址 1、存取 12、傳送 1）
  figure("cache-perf-memory-org", () => {
    const S = 10, X0 = 180, nodes = [], labels = [];
    const seg = (id, t0, len, y, st, label, h) => nodes.push(box(id, label || "", X0 + (t0 + len / 2) * S, y, len * S - 2, st, h || 26));
    // (a) 一次 1 word
    let t = 0, y = 70;
    seg("a0", 0, 1, y, "muted"); t = 1;
    for (let k = 0; k < 4; k++) { seg("aa" + k, t, 12, y, "compare", "存取"); t += 12; seg("at" + k, t, 1, y, "active"); t += 1; }
    labels.push({ id: "la", x: 20, y, text: "(a) 1 word 寬", cls: "strong", anchor: "start" }, { id: "ta", x: X0 + t * S, y: y + 28, text: `${t} cycles`, cls: "warn", anchor: "end" });
    // (b) 4 words 寬
    y = 140;
    seg("b0", 0, 1, y, "muted"); seg("ba", 1, 12, y, "compare", "存取"); seg("bt", 13, 1, y, "active");
    labels.push({ id: "lb", x: 20, y, text: "(b) 4 words 寬", cls: "strong", anchor: "start" }, { id: "tb", x: X0 + 14 * S + 8, y, text: "14 cycles", cls: "ok", anchor: "start" });
    // (c) 4 個 bank 交錯
    y = 226;
    seg("c0", 0, 1, y, "muted");
    for (let k = 0; k < 4; k++) {
      seg("cb" + k, 1, 12, y - 27 + k * 18, "compare", "", 14);
      seg("ct" + k, 13 + k, 1, y - 27 + k * 18, "active", "", 14);
    }
    labels.push({ id: "lc", x: 20, y, text: "(c) 4 bank 交錯", cls: "strong", anchor: "start" }, { id: "tc", x: X0 + 17 * S + 8, y, text: "17 cycles：4 個 bank 同時存取，再輪流傳", cls: "ok", anchor: "start" });
    labels.push({ id: "lg", x: 20, y: 24, text: "灰：送位址 1 cycle　藍：DRAM 存取 12 cycles　橘：匯流排傳 1 word 1 cycle", cls: "title", anchor: "start" });
    return { width: 720, height: 270, nodes, labels, edges: [] };
  });
})();
