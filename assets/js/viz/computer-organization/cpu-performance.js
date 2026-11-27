/* =====================================================================
   CPU Time and CPI（CPU 時間與 CPI）主題的圖與動畫
   - cpu-perf-calc : 效能計算器：輸入各指令類別的 CPI 與比例、時脈、指令數，
                     逐步算出平均 CPI、CPU time、MIPS；可比較兩部機器、只改良一類指令的 CPI
   - 靜態圖：CPU time 三因素、MIPS 陷阱、只改一類的上限、roofline
   ===================================================================== */
(function () {
  "use strict";
  const { Player, Recorder, ui, register, esc, iconHTML, figure } = window.DSViz;

  // 右側程式碼：從 code/computer-organization/cpu-performance.c 原封不動取出
  const CODE = [
    "Perf evaluate(const InstClass cls[], int n, double clockHz) {",
    "  Perf p = {0, 0, 0, 0, 0};",
    "  for (int i = 0; i < n; i++) p.ic += cls[i].count;      /* 總指令數 IC */",
    "  for (int i = 0; i < n; i++) {",
    "    double frac = cls[i].count / p.ic;                    /* 這類指令佔的比例 */",
    "    p.cpi += frac * cls[i].cpi;                           /* 加權平均 CPI */",
    "  }",
    "  p.cycles = p.ic * p.cpi;                                /* 總 clock cycles */",
    "  p.seconds = p.cycles / clockHz;                         /* CPU time = cycles ÷ clock rate */",
    "  p.mips = clockHz / (p.cpi * 1e6);                       /* MIPS = clock rate ÷ (CPI × 10^6) */",
    "  return p;",
    "}",
    "",
    "/* 效能 = 1 / 執行時間，所以「快幾倍」= 時間的反比 */",
    "double speedup(Perf before, Perf after) {",
    "  return before.seconds / after.seconds;",
    "}",
    "",
    "/* 只把第 k 類的 CPI 改成 newCPI，其他不變 */",
    "Perf improveClass(const InstClass cls[], int n, int k, double newCPI, double clockHz) {",
    "  InstClass tmp[MAXC];",
    "  for (int i = 0; i < n; i++) tmp[i] = cls[i];",
    "  tmp[k].cpi = newCPI;",
    "  return evaluate(tmp, n, clockHz);",
    "}"
  ];
  const ln = (s) => CODE.findIndex((l) => l.includes(s)) + 1;
  const L = {
    ic: ln("p.ic += cls[i].count;"),
    frac: [ln("double frac = cls[i].count / p.ic;"), ln("p.cpi += frac * cls[i].cpi;")],
    sum: ln("p.cpi += frac * cls[i].cpi;"),
    cycles: ln("p.cycles = p.ic * p.cpi;"),
    sec: ln("p.seconds = p.cycles / clockHz;"),
    mips: ln("p.mips = clockHz / (p.cpi * 1e6);"),
    sp: ln("return before.seconds / after.seconds;"),
    imp: ln("tmp[k].cpi = newCPI;"),
    impEval: ln("return evaluate(tmp, n, clockHz);"),
  };

  // ---------- 數字格式 ----------
  const num = (x) => String(Math.round(x * 1000) / 1000);
  const pct = (x) => String(Math.round(x * 1000) / 10) + "%";
  const SUP = { "-": "⁻", 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹" };
  function sci(x) {                       // 2000000000 → 2 × 10⁹
    if (x === 0) return "0";
    const e = Math.floor(Math.log10(Math.abs(x)) + 1e-9);
    if (e >= -2 && e <= 3) return num(x);
    const m = Math.round((x / Math.pow(10, e)) * 1000) / 1000;
    return `${m} × 10${String(e).split("").map((c) => SUP[c]).join("")}`;
  }
  function time(s) {                      // 秒 → 適合的單位
    const u = [[1, "s"], [1e-3, "ms"], [1e-6, "μs"], [1e-9, "ns"]];
    for (const [k, name] of u) if (s >= k * 0.9995) return `${Math.round((s / k) * 1000) / 1000} ${name}`;
    return `${sci(s * 1e9)} ns`;
  }
  const ghz = (f) => `${num(f / 1e9)} GHz`;

  // 和 C 程式的 evaluate() 同樣的算法；cls: [{name, cpi, count}]，ic 為實際總指令數
  function evaluate(cls, ic, clock) {
    const w = cls.reduce((s, c) => s + c.count, 0);
    const parts = cls.map((c) => ({ name: c.name, cpi: c.cpi, frac: c.count / w, contrib: (c.count / w) * c.cpi }));
    const cpi = parts.reduce((s, p) => s + p.contrib, 0);
    const cycles = ic * cpi;
    return { parts, cpi, ic, cycles, seconds: cycles / clock, mips: clock / (cpi * 1e6), clock };
  }

  register("cpu-perf-calc", function (root) {
    const player = new Player(root, {
      title: "CPU Performance Calculator CPU 效能計算器",
      width: 680, height: 400, code: CODE, wide: true,
      legend: [["compare", "這一步在算的類別"], ["found", "已算出的貢獻"], ["active", "佔最多 cycle 的類別"], ["new", "被改良的類別"]],
    });

    const COLX = (i) => 170 + i * 86;
    const BX = 120, BMAX = 520;
    let scale = 1;

    // st：{ title, right, m: {parts, ...}, cur, done, hot, newk, bars: [{name, segs: [{v, label, state}], text}], rows: [{text, cur}] }
    function frame(caption, line, st) {
      const nodes = [], labels = [];
      labels.push({ id: "title", x: 24, y: 22, text: st.title, cls: "title", anchor: "start" });
      if (st.right) labels.push({ id: "right", x: 656, y: 22, text: st.right, cls: "ok", anchor: "end" });
      const parts = st.m.parts;
      [["類別", 54], ["CPI", 92], ["比例", 136], ["CPI × 比例", 180]].forEach(([t, y], k) =>
        labels.push({ id: "rh" + k, x: 24, y, text: t, cls: "title", anchor: "start" }));
      for (let i = 0; i < 6; i++) {
        const p = parts[i];
        if (!p) continue;
        const x = COLX(i);
        const isCur = st.cur === i || (st.cur === "all");
        const shown = st.hide !== i && (st.done === "all" || (typeof st.done === "number" && i < st.done) || st.cur === i);
        labels.push({ id: "cn" + i, x, y: 54, text: p.name, cls: "strong" });
        nodes.push({ id: "cc" + i, label: num(p.cpi), shape: "box", x, y: 92, w: 74, h: 30,
          state: st.newk === i ? "new" : isCur ? "compare" : "default" });
        nodes.push({ id: "cf" + i, label: pct(p.frac), shape: "box", x, y: 136, w: 74, h: 30, state: isCur ? "compare" : "default" });
        nodes.push({ id: "cx" + i, label: shown ? num(p.contrib) : "?", shape: "box", x, y: 180, w: 74, h: 30,
          state: !shown ? "ghost" : st.hot === i ? "active" : st.newk === i ? "new" : "found" });
      }
      let y = 232;
      (st.bars || []).forEach((bar, k) => {
        labels.push({ id: "bn" + k, x: BX - 10, y, text: bar.name, cls: "title", anchor: "end" });
        let x = BX;
        bar.segs.forEach((s, j) => {
          const w = Math.max(s.v * scale, 1);
          nodes.push({ id: `b${k}_${j}`, label: w >= 44 ? s.label : "", shape: "box", x: x + w / 2, y, w, h: 26, state: s.state || "default" });
          x += w;
        });
        labels.push({ id: "bt" + k, x: BX, y: y + 24, text: bar.text, anchor: "start" });
        y += 54;
      });
      (st.rows || []).forEach((r, i) => {
        labels.push({ id: "row" + i, x: 24, y: y + 4 + i * 26, text: r.text, cls: r.cur ? "strong" : "", anchor: "start" });
      });
      return { nodes, edges: [], labels, caption, line };
    }

    const hotOf = (m) => m.parts.reduce((b, p, i) => (p.contrib > m.parts[b].contrib ? i : b), 0);
    const segsOf = (m, f, hot, newk) => m.parts.map((p, i) => ({ v: p.contrib * f, label: p.name, state: i === newk ? "new" : i === hot ? "active" : "default" }));
    const rowsOf = (arr) => arr.map((t, i) => ({ text: t, cur: i === arr.length - 1 }));
    const fit = (rowsCount, barCount) => player.resize(680, Math.max(400, 232 + barCount * 54 + rowsCount * 26 + 20));

    // ---------- 計算一部機器 ----------
    function runSingle(cfg) {
      const m = evaluate(cfg.cls, cfg.ic, cfg.clock), hot = hotOf(m), r = new Recorder(), rows = [];
      fit(5, 1);
      scale = BMAX / m.cpi;
      const title = "一部機器：平均 CPI → CPU time → MIPS";
      const push = (cap, line, extra) => r.push(frame(cap, line, Object.assign({ title, m, rows: rowsOf(rows) }, extra)));
      push(`CPU time = IC × CPI ÷ clock rate。先把每一類指令的 CPI 依它<b>佔的比例</b>加權平均，得到整個程式的平均 CPI。共 ${m.parts.length} 類，總指令數 IC = ${sci(cfg.ic)}，時脈 ${ghz(cfg.clock)}。`, null, { cur: null, done: 0 });
      rows.push(`IC = ${sci(cfg.ic)} 條指令`);
      push(`比例 = 這類指令數 ÷ 總指令數。${cfg.pctInput ? "輸入的是比例，直接正規化成總和 100%。" : "輸入的是各類指令數，加總就是 IC。"}`, L.ic, { cur: "all", done: 0 });
      m.parts.forEach((p, i) => {
        push(`<b>${esc(p.name)}</b>：每條要 ${num(p.cpi)} 個 cycle，佔 ${pct(p.frac)} 的指令，平均每條指令分到 ${num(p.cpi)} × ${pct(p.frac)} = <b>${num(p.contrib)}</b> 個 cycle。`, L.frac, { cur: i, done: i });
      });
      rows.push(`平均 CPI = ${m.parts.map((p) => num(p.contrib)).join(" + ")} = ${num(m.cpi)}`);
      const hp = m.parts[hot];
      push(`把各類的貢獻加起來就是平均 CPI = <b>${num(m.cpi)}</b>。它不必是整數。<b>${esc(hp.name)}</b> 只佔 ${pct(hp.frac)} 的指令，卻佔了 ${pct(hp.contrib / m.cpi)} 的 cycle（橘色），想加速要先從它下手。`, L.sum,
        { cur: null, done: "all", hot, bars: [{ name: "CPI", segs: segsOf(m, 1, hot), text: `平均 CPI ${num(m.cpi)}；${esc(hp.name)} 佔 ${pct(hp.contrib / m.cpi)} 的 cycle` }] });
      const bars = [{ name: "CPI", segs: segsOf(m, 1, hot), text: `平均 CPI ${num(m.cpi)}；${esc(hp.name)} 佔 ${pct(hp.contrib / m.cpi)} 的 cycle` }];
      rows.push(`cycles = IC × CPI = ${sci(cfg.ic)} × ${num(m.cpi)} = ${sci(m.cycles)}`);
      push(`總 cycle 數 = IC × 平均 CPI = <b>${sci(m.cycles)}</b> 個 clock cycle。`, L.cycles, { done: "all", hot, bars });
      rows.push(`CPU time = ${sci(m.cycles)} ÷ ${ghz(cfg.clock)} = ${time(m.seconds)}`);
      push(`時脈 ${ghz(cfg.clock)} 代表每秒 ${sci(cfg.clock)} 個 cycle（一個 cycle ${time(1 / cfg.clock)}）。CPU time = cycles ÷ clock rate = <b>${time(m.seconds)}</b>。最常見的錯是忘了除以時脈，或 GHz 少乘 10⁹。`, L.sec, { done: "all", hot, bars });
      rows.push(`MIPS = ${ghz(cfg.clock)} ÷ (${num(m.cpi)} × 10⁶) = ${num(m.mips)}`);
      push(`MIPS = clock rate ÷ (CPI × 10⁶) = <b>${num(m.mips)}</b>，也就是每秒執行約 ${sci(m.mips * 1e6)} 條指令。它和 IC 無關，所以只能在<b>指令數相同</b>時拿來比較。`, L.mips, { done: "all", hot, bars });
      push(`算完了：平均 CPI ${num(m.cpi)}、CPU time ${time(m.seconds)}、MIPS ${num(m.mips)}。改上面的數字再按「計算」；填了 B 的 CPI 和時脈可以按「比較 A 與 B」；填了改良類別和新 CPI 可以按「只改一類」。`, null,
        { done: "all", hot, bars, right: `CPU time ${time(m.seconds)}` });
      return r.frames;
    }

    // ---------- 比較兩部機器 ----------
    function runCompare(cfg) {
      const A = evaluate(cfg.cls, cfg.ic, cfg.clock), B = evaluate(cfg.clsB, cfg.icB, cfg.clockB);
      const r = new Recorder(), rows = [], bars = [];
      fit(4, 2);
      scale = BMAX / Math.max(A.seconds, B.seconds);
      const tA = "機器 A", tB = "機器 B";
      const timeBar = (m, name, hot) => ({ name, segs: segsOf(m, m.ic / m.clock, hot), text: `${name}：${time(m.seconds)}（CPI ${num(m.cpi)}、${ghz(m.clock)}、IC ${sci(m.ic)}）` });
      const push = (cap, line, title, m, extra) => r.push(frame(cap, line, Object.assign({ title, m, rows: rowsOf(rows), bars: bars.slice() }, extra)));
      push(`比較兩部機器跑<b>同一個程式</b>：效能看的是 CPU time，不是單看 CPI、時脈或 MIPS。先算 A。`, null, tA, A, { done: 0 });
      const hA = hotOf(A);
      rows.push(`A：CPI = ${num(A.cpi)}，time = ${sci(A.ic)} × ${num(A.cpi)} ÷ ${ghz(A.clock)} = ${time(A.seconds)}`);
      push(`A 的平均 CPI = ${A.parts.map((p) => num(p.contrib)).join(" + ")} = <b>${num(A.cpi)}</b>。`, L.frac, tA, A, { cur: "all", done: "all", hot: hA });
      bars.push(timeBar(A, "A", hA));
      push(`A 的 CPU time = IC × CPI ÷ clock rate = <b>${time(A.seconds)}</b>，MIPS = ${num(A.mips)}。長條的長度代表時間，每一段是那一類指令花掉的時間。`, L.sec, tA, A, { done: "all", hot: hA });
      const hB = hotOf(B);
      const sameIC = cfg.icB === cfg.ic;
      push(`換成 B：${cfg.clsB.length === 1 ? `直接給平均 CPI ${num(B.cpi)}` : "同一個程式、同樣的指令比例，各類 CPI 換成 B 的"}；時脈 ${ghz(cfg.clockB)}；IC ${sameIC ? "和 A 相同（同一個 ISA、同一個執行檔）" : `${sci(cfg.icB)}（不同 ISA 或不同編譯器，指令數不同）`}。`, null, tB, B, { done: 0 });
      rows.push(`B：CPI = ${num(B.cpi)}，time = ${sci(B.ic)} × ${num(B.cpi)} ÷ ${ghz(B.clock)} = ${time(B.seconds)}`);
      push(`B 的平均 CPI = <b>${num(B.cpi)}</b>。`, L.frac, tB, B, { cur: "all", done: "all", hot: hB });
      bars.push(timeBar(B, "B", hB));
      push(`B 的 CPU time = <b>${time(B.seconds)}</b>，MIPS = ${num(B.mips)}。`, L.sec, tB, B, { done: "all", hot: hB });
      const fast = A.seconds <= B.seconds ? "A" : "B", slow = fast === "A" ? "B" : "A";
      const ratio = Math.max(A.seconds, B.seconds) / Math.min(A.seconds, B.seconds);
      rows.push(`${fast} 比 ${slow} 快 ${time(Math.max(A.seconds, B.seconds))} ÷ ${time(Math.min(A.seconds, B.seconds))} = ${num(ratio)} 倍`);
      const cpiWin = A.cpi <= B.cpi ? "A" : "B", clkWin = A.clock >= B.clock ? "A" : "B", mipsWin = A.mips >= B.mips ? "A" : "B";
      push(`效能 = 1 ÷ 時間，所以「${fast} 比 ${slow} 快幾倍」= ${slow} 的時間 ÷ ${fast} 的時間 = <b>${num(ratio)}</b>。` +
        (A.cpi === B.cpi ? "" : `CPI 比較小的是 ${cpiWin}，`) + (A.clock === B.clock ? "" : `時脈比較快的是 ${clkWin}，`) +
        `真正比較快的是 <b>${fast}</b>。`, L.sp, tB, B, { done: "all", hot: hB });
      const trap = mipsWin !== fast && A.mips !== B.mips;
      push(trap
        ? `${iconHTML("alert")} <b>MIPS 陷阱</b>：${mipsWin} 的 MIPS（${num(mipsWin === "A" ? A.mips : B.mips)}）比較高，卻比較慢。因為 ${mipsWin} 要執行 ${sci(mipsWin === "A" ? A.ic : B.ic)} 條指令，比對手多，MIPS 完全沒算到指令數。`
        : `MIPS：A ${num(A.mips)}、B ${num(B.mips)}。${sameIC ? "這裡兩台的指令數相同，MIPS 高的剛好也比較快；指令數不同時就不一定了，可以按「MIPS 陷阱」看看。" : "這組數字裡 MIPS 高的剛好也比較快，但那是巧合：MIPS 沒算到指令數。"}`,
      null, tB, B, { done: "all", hot: hB, right: `${fast} 快 ${num(ratio)} 倍` });
      return r.frames;
    }

    // ---------- 只改良一類 ----------
    function runImprove(cfg) {
      const k = cfg.k, A = evaluate(cfg.cls, cfg.ic, cfg.clock);
      const after = cfg.cls.map((c, i) => (i === k ? Object.assign({}, c, { cpi: cfg.newCPI }) : c));
      const zero = cfg.cls.map((c, i) => (i === k ? Object.assign({}, c, { cpi: 0 }) : c));
      const B = evaluate(after, cfg.ic, cfg.clock), Z = evaluate(zero, cfg.ic, cfg.clock);
      const r = new Recorder(), rows = [], bars = [];
      fit(3, 3);
      scale = BMAX / Math.max(A.cpi, B.cpi);
      const name = esc(A.parts[k].name), title = `只改 ${A.parts[k].name} 的 CPI：${num(A.parts[k].cpi)} → ${num(cfg.newCPI)}`;
      const hA = hotOf(A);
      const push = (cap, line, m, extra) => r.push(frame(cap, line, Object.assign({ title, m, rows: rowsOf(rows), bars: bars.slice() }, extra)));
      bars.push({ name: "原本", segs: segsOf(A, 1, hA), text: `原本 CPI ${num(A.cpi)}；${name} 佔 ${pct(A.parts[k].contrib / A.cpi)} 的 cycle（指令只佔 ${pct(A.parts[k].frac)}）` });
      rows.push(`原本 CPI = ${num(A.cpi)}`);
      push(`只改良一類指令時，IC 和時脈都不變，所以加速 = 舊 CPI ÷ 新 CPI。先算原本的平均 CPI = <b>${num(A.cpi)}</b>。注意 ${name} 佔的是 ${pct(A.parts[k].frac)} 的<b>指令</b>，但佔 ${pct(A.parts[k].contrib / A.cpi)} 的<b>時間</b>。`, L.frac, A, { cur: "all", done: "all", hot: hA });
      push(`把 ${name} 的 CPI 從 ${num(A.parts[k].cpi)} 改成 <b>${num(cfg.newCPI)}</b>（紫色），其他類別的 CPI 和比例完全不動。`, L.imp, B, { done: "all", newk: k, cur: null, hot: -1, hide: k });
      rows.push(`新 CPI = ${B.parts.map((p) => num(p.contrib)).join(" + ")} = ${num(B.cpi)}`);
      push(`${name} 的貢獻從 ${num(A.parts[k].contrib)} 變成 ${num(B.parts[k].contrib)}，其他類別的貢獻不變，新的平均 CPI = <b>${num(B.cpi)}</b>。`, L.impEval, B, { done: "all", newk: k, hot: -1 });
      bars.push({ name: "改良後", segs: segsOf(B, 1, -1, k), text: `改良後 CPI ${num(B.cpi)}` });
      const sp = A.cpi / B.cpi;
      rows.push(`加速 = ${num(A.cpi)} ÷ ${num(B.cpi)} = ${num(sp)} 倍`);
      push(`加速 = 舊時間 ÷ 新時間 = 舊 CPI ÷ 新 CPI = <b>${num(sp)}</b> 倍${sp < 1 ? "（小於 1，代表變慢了）" : ""}。${name} 自己快了 ${cfg.newCPI > 0 ? num(A.parts[k].cpi / cfg.newCPI) + " 倍" : "無限多倍"}，整體卻只快 ${num(sp)} 倍，因為其他類別的 cycle 一點都沒少。`, L.sp, B, { done: "all", newk: k, hot: -1 });
      if (Z.cpi === 0) {
        push(`只有 ${name} 這一類指令，沒有「沒被改良的部分」：CPI 降幾倍，整體就快幾倍（${num(sp)} 倍）。只要還有其他類別，加速就會有上限。`, null, B,
          { done: "all", newk: k, hot: -1, right: `加速 ${num(sp)} 倍` });
        return r.frames;
      }
      const lim = A.cpi / Z.cpi;
      bars.push({ name: "上限", segs: segsOf(Z, 1, -1, k).filter((s, i) => i !== k), text: `${name} 的 CPI 變成 0 也只剩 ${num(Z.cpi)}：最多快 ${num(lim)} 倍` });
      rows.push(`上限：${name} CPI → 0，CPI = ${num(Z.cpi)}，最多快 ${num(lim)} 倍`);
      push(`再極端一點：就算 ${name} 完全不花時間（CPI = 0），CPI 也還有 ${num(Z.cpi)}，整體<b>最多</b>只能快 ${num(lim)} 倍。題目問「只改這一類能不能快 2 倍」，先算這個上限：${lim > 2 ? "上限大於 2，有機會" : "上限不到 2，一定做不到"}。這就是 Amdahl's Law（Amdahl 定律）的想法。`, null, Z,
        { done: "all", newk: k, hot: -1, right: `加速 ${num(sp)} 倍（上限 ${num(lim)}）` });
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
      names: field("類別", "ALU, L/S, Branch, FP", 170),
      cpi: field("CPI", "1, 3, 2, 6", 90),
      cnt: field("比例或指令數", "40, 35, 20, 5", 110),
      ic: field("總 IC（×10⁶，空白＝上一格是指令數）", "2000", 60, "空白"),
      clock: field("時脈 GHz", "2.5", 46),
      cpiB: field("B 的 CPI", "1, 2, 2, 4", 90),
      clockB: field("B 時脈 GHz", "2", 46),
      icB: field("B 的 IC（×10⁶）", "", 60, "同 A"),
      k: field("改良類別", "L/S", 60),
      newCPI: field("新 CPI", "1.5", 46),
    };
    const bad = (el, msg) => {
      el.classList.add("is-error"); setTimeout(() => el.classList.remove("is-error"), 700);
      player.resize(680, 400);
      player.load([{ nodes: [], edges: [], labels: [], caption: `${iconHTML("alert")} ${msg}`, line: null }], { autoplay: false });
      return null;
    };
    const NUM = /^\d+(\.\d+)?$/;
    const list = (el) => el.value.split(/[,，\s]+/).filter((t) => t !== "");
    const one = (el, lo, hi) => {
      const t = el.value.trim();
      if (!NUM.test(t)) return NaN;
      const v = Number(t);
      return v >= lo && v <= hi ? v : NaN;
    };

    function read() {
      const cpis = list(inp.cpi), cnts = list(inp.cnt);
      if (cpis.length < 1 || cpis.length > 6) return bad(inp.cpi, "CPI 請輸入 1～6 個數字，用逗號隔開，例如 1, 3, 2, 6。");
      if (!cpis.every((t) => NUM.test(t) && Number(t) > 0 && Number(t) <= 100)) return bad(inp.cpi, "每類指令的 CPI 要是大於 0、不超過 100 的數字。");
      if (cnts.length !== cpis.length) return bad(inp.cnt, `比例或指令數要和 CPI 一樣有 ${cpis.length} 個數字。`);
      if (!cnts.every((t) => NUM.test(t) && Number(t) > 0 && Number(t) <= 1e6)) return bad(inp.cnt, "比例或指令數要是大於 0 的數字（最多 10⁶）。");
      let names = list(inp.names);
      if (inp.names.value.trim() === "") names = cpis.map((_, i) => String.fromCharCode(65 + i));
      else names = inp.names.value.split(/[,，]/).map((t) => t.trim()).filter((t) => t !== "");
      if (names.length !== cpis.length) return bad(inp.names, `類別名稱要有 ${cpis.length} 個（用逗號隔開），或整格清空自動命名 A、B、C……`);
      if (names.some((t) => t.length > 8)) return bad(inp.names, "類別名稱每個最多 8 個字，才放得進畫面。");
      if (new Set(names).size !== names.length) return bad(inp.names, "類別名稱不能重複。");
      const cls = cpis.map((c, i) => ({ name: names[i], cpi: Number(c), count: Number(cnts[i]) }));
      let ic;
      const pctInput = inp.ic.value.trim() !== "";
      if (pctInput) {
        const v = one(inp.ic, 0.000001, 1e9);
        if (Number.isNaN(v) || v <= 0) return bad(inp.ic, "總 IC 請輸入大於 0 的數字（單位 10⁶ 條），例如 2000 代表 2 × 10⁹；清空則把上一格當成各類指令數（×10⁶）。");
        ic = v * 1e6;
      } else ic = cls.reduce((s, c) => s + c.count, 0) * 1e6;
      const clock = one(inp.clock, 0.001, 100);
      if (Number.isNaN(clock) || clock <= 0) return bad(inp.clock, "時脈請輸入 0.001～100 的 GHz，例如 2.5。");
      return { cls, ic, clock: clock * 1e9, pctInput };
    }
    function readB(cfg) {
      const cpis = list(inp.cpiB);
      if (cpis.length !== 1 && cpis.length !== cfg.cls.length) return bad(inp.cpiB, `B 的 CPI 請輸入 1 個數字（直接給平均 CPI），或和 A 一樣 ${cfg.cls.length} 個（各類 CPI）。`);
      if (!cpis.every((t) => NUM.test(t) && Number(t) > 0 && Number(t) <= 100)) return bad(inp.cpiB, "B 的 CPI 要是大於 0、不超過 100 的數字。");
      const clockB = one(inp.clockB, 0.001, 100);
      if (Number.isNaN(clockB) || clockB <= 0) return bad(inp.clockB, "B 的時脈請輸入 0.001～100 的 GHz。");
      let icB = cfg.ic;
      if (inp.icB.value.trim() !== "") {
        const v = one(inp.icB, 0.000001, 1e9);
        if (Number.isNaN(v) || v <= 0) return bad(inp.icB, "B 的 IC 請輸入大於 0 的數字（單位 10⁶），或清空表示和 A 相同。");
        icB = v * 1e6;
      }
      const clsB = cpis.length === 1 ? [{ name: "平均", cpi: Number(cpis[0]), count: 1 }]
        : cfg.cls.map((c, i) => ({ name: c.name, cpi: Number(cpis[i]), count: c.count }));
      return Object.assign({}, cfg, { clsB, clockB: clockB * 1e9, icB });
    }
    function readK(cfg) {
      const t = inp.k.value.trim();
      let k = cfg.cls.findIndex((c) => c.name === t);
      if (k < 0 && /^\d+$/.test(t) && Number(t) >= 1 && Number(t) <= cfg.cls.length) k = Number(t) - 1;
      if (k < 0) return bad(inp.k, `改良類別請輸入類別名稱（${cfg.cls.map((c) => c.name).join("、")}）或第幾類（1～${cfg.cls.length}）。`);
      const v = one(inp.newCPI, 0, 100);
      if (Number.isNaN(v)) return bad(inp.newCPI, "新 CPI 請輸入 0～100 的數字（0 代表這類指令完全不花時間）。");
      if (cfg.cls.length === 1 && v === 0) return bad(inp.newCPI, "只有一類指令時 CPI 不能改成 0，否則程式完全不花時間。");
      return Object.assign({}, cfg, { k, newCPI: v });
    }

    function go(mode) {
      const c = read();
      if (!c) return;
      if (mode === "single") return player.load(runSingle(c));
      if (mode === "compare") { const d = readB(c); if (d) player.load(runCompare(d)); return; }
      const d = readK(c);
      if (d) player.load(runImprove(d));
    }
    const set = (v) => Object.keys(v).forEach((k) => (inp[k].value = v[k]));
    const TEACH = { names: "ALU, L/S, Branch, FP", cpi: "1, 3, 2, 6", cnt: "40, 35, 20, 5", ic: "2000", clock: "2.5", cpiB: "1, 2, 2, 4", clockB: "2", icB: "", k: "L/S", newCPI: "1.5" };
    ui.button(player, "計算", () => go("single"));
    ui.button(player, "比較 A 與 B", () => go("compare"));
    ui.button(player, "只改一類", () => go("improve"));
    ui.button(player, "教學例", () => { set(TEACH); go("single"); }, "ghost");
    ui.button(player, "MIPS 陷阱", () => {
      set({ names: "全部", cpi: "1.0", cnt: "100", ic: "5000", clock: "3", cpiB: "1.2", clockB: "3", icB: "4000", k: "全部", newCPI: "0.8" });
      go("compare");
    }, "ghost");
    ui.button(player, "能快 2 倍嗎", () => { set(Object.assign({}, TEACH, { k: "L/S", newCPI: "0" })); go("improve"); }, "ghost");
    Object.values(inp).forEach((el) => el.addEventListener("keydown", (e) => e.key === "Enter" && go("single")));

    const demo = runSingle({ cls: [{ name: "ALU", cpi: 1, count: 40 }, { name: "L/S", cpi: 3, count: 35 }, { name: "Branch", cpi: 2, count: 20 }, { name: "FP", cpi: 6, count: 5 }], ic: 2e9, clock: 2.5e9, pctInput: true });
    demo[0].caption = iconHTML("play") + " 按播放看示範：四類指令 ALU / L/S / Branch / FP 的 CPI 是 1、3、2、6，比例 40%、35%、20%、5%，IC = 2 × 10⁹、時脈 2.5 GHz，逐步算出平均 CPI 2.15、CPU time 1.72 s、MIPS 1162.791。「比較 A 與 B」用 B 的 CPI 與時脈再算一次並比較；「只改一類」把指定類別換成新 CPI，算加速與上限。";
    player.load(demo, { autoplay: false });
  });

  // ===================================================================
  // 靜態圖解
  // ===================================================================
  const box = (id, label, x, y, w, st, h, sub) => ({ id, label, shape: "box", x, y, w, h: h || 34, state: st || "default", sub });

  // 圖 1：CPU time 的三個因素與影響它們的東西
  figure("cpu-perf-equation", () => {
    const nodes = [
      box("t", "秒 / 程式", 80, 70, 120, "found", 40, "CPU time"),
      box("ic", "指令 / 程式", 260, 70, 130, "compare", 40, "IC"),
      box("cpi", "cycle / 指令", 450, 70, 130, "compare", 40, "CPI"),
      box("ct", "秒 / cycle", 630, 70, 110, "compare", 40, "clock cycle time"),
    ];
    const labels = [
      { id: "eq", x: 165, y: 70, text: "=", cls: "strong" },
      { id: "x1", x: 355, y: 70, text: "×", cls: "strong" },
      { id: "x2", x: 545, y: 70, text: "×", cls: "strong" },
      { id: "a1", x: 260, y: 140, text: "演算法、程式語言" },
      { id: "a2", x: 260, y: 162, text: "編譯器、ISA" },
      { id: "b1", x: 450, y: 140, text: "ISA、微架構（管線、快取）" },
      { id: "b2", x: 450, y: 162, text: "編譯器、程式的指令組成" },
      { id: "c1", x: 630, y: 140, text: "製程、微架構" },
      { id: "c2", x: 630, y: 162, text: "（管線切幾級）" },
      { id: "h", x: 24, y: 151, text: "影響誰：", cls: "title", anchor: "start" },
      { id: "u", x: 360, y: 210, text: "單位相乘：指令/程式 × cycle/指令 × 秒/cycle = 秒/程式", cls: "warn" },
    ];
    return { width: 700, height: 232, nodes, edges: [], labels };
  });

  // 圖 2：MIPS 陷阱：MIPS 高的機器比較慢
  figure("cpu-perf-mips-trap", () => {
    const S = 300, X0 = 130, nodes = [], labels = [];
    const row = (id, y, name, sec, st, txt, mips) => {
      nodes.push(box(id, time(sec), X0 + (sec * S) / 2, y, sec * S, st, 34));
      labels.push({ id: id + "n", x: X0 - 12, y, text: name, cls: "strong", anchor: "end" });
      labels.push({ id: id + "t", x: X0, y: y + 30, text: `${txt}　→　${mips}`, anchor: "start" });
    };
    row("a", 70, "A", 5 / 3, "removed", "IC 5 × 10⁹、CPI 1.0、3 GHz", "MIPS 3000（較高）");
    row("b", 150, "B", 1.6, "found", "IC 4 × 10⁹、CPI 1.2、3 GHz", "MIPS 2500");
    labels.push({ id: "h", x: 24, y: 24, text: "長條 = CPU time（越短越快）", cls: "title", anchor: "start" });
    labels.push({ id: "w", x: 350, y: 214, text: "A 的 MIPS 高 20%，卻多跑了 25% 的指令，反而慢 4%", cls: "warn" });
    return { width: 700, height: 236, nodes, labels, edges: [] };
  });

  // 圖 3：只改一類的效果與上限（教學例）
  figure("cpu-perf-improve-limit", () => {
    const S = 220, X0 = 130, nodes = [], labels = [];
    const bar = (id, y, name, segs, txt) => {
      let x = X0;
      segs.forEach(([lab, v, st], j) => {
        const w = v * S;
        nodes.push(box(`${id}${j}`, w >= 44 ? lab : "", x + w / 2, y, w, st, 30));
        x += w;
      });
      labels.push({ id: id + "n", x: X0 - 12, y, text: name, cls: "strong", anchor: "end" });
      labels.push({ id: id + "t", x: x + 12, y, text: txt, anchor: "start" });
    };
    bar("a", 60, "原本", [["ALU", 0.4], ["L/S", 1.05, "active"], ["Br", 0.4], ["FP", 0.3]], "CPI 2.15");
    bar("b", 120, "L/S → 1.5", [["ALU", 0.4], ["L/S", 0.525, "new"], ["Br", 0.4], ["FP", 0.3]], "CPI 1.625，快 1.323 倍");
    bar("c", 180, "L/S → 0", [["ALU", 0.4], ["Br", 0.4], ["FP", 0.3]], "CPI 1.1，最多快 1.955 倍");
    labels.push({ id: "h", x: 24, y: 22, text: "每段 = 該類指令對平均 CPI 的貢獻（CPI × 比例）", cls: "title", anchor: "start" });
    labels.push({ id: "w", x: 350, y: 232, text: "L/S 只佔 35% 的指令，卻佔 49% 的 cycle；其他 1.1 個 cycle 怎樣都省不掉", cls: "warn" });
    return { width: 700, height: 254, nodes, labels, edges: [] };
  });

  // 圖 4：roofline（線性刻度）：峰值 100 GFLOP/s、頻寬 20 GB/s
  figure("cpu-perf-roofline", () => {
    const X0 = 90, Y0 = 250, SX = 50, SY = 2;      // 1 FLOP/B = 50px；1 GFLOP/s = 2px
    const P = (id, ai, g, st, r) => ({ id, label: "", shape: "circle", r: r || 3, x: X0 + ai * SX, y: Y0 - g * SY, state: st || "muted" });
    const nodes = [
      P("o", 0, 0), P("xe", 11, 0), P("ye", 0, 115),
      P("ridge", 5, 100, "default"), P("end", 11, 100, "default"), P("rx", 5, 0),
      P("k1", 1, 20, "active", 7), P("k2", 8, 100, "found", 7), P("k1c", 1, 100, "ghost", 7),
    ];
    const edges = [
      { from: "o", to: "xe" }, { from: "o", to: "ye" },
      { from: "o", to: "ridge", state: "compare" }, { from: "ridge", to: "end", state: "compare" },
      { from: "k1", to: "k1c", dashed: true }, { from: "ridge", to: "rx", dashed: true },
    ];
    const labels = [
      { id: "xl", x: X0 + 11 * SX, y: Y0 + 38, text: "arithmetic intensity（FLOP/byte）", anchor: "end" },
      { id: "yl", x: X0 + 8, y: Y0 - 118 * SY, text: "GFLOP/s", anchor: "start", cls: "title" },
      { id: "x1", x: X0 + SX, y: Y0 + 16, text: "1" }, { id: "x5", x: X0 + 5 * SX, y: Y0 + 16, text: "5" }, { id: "x8", x: X0 + 8 * SX, y: Y0 + 16, text: "8" },
      { id: "y1", x: X0 - 10, y: Y0 - 100 * SY, text: "100", anchor: "end" }, { id: "y2", x: X0 - 10, y: Y0 - 20 * SY, text: "20", anchor: "end" },
      { id: "s", x: X0 + 2.6 * SX, y: Y0 - 75 * SY, text: "斜線：20 GB/s × intensity", anchor: "end" },
      { id: "r", x: X0 + 8 * SX, y: Y0 - 108 * SY, text: "屋頂：峰值 100 GFLOP/s" },
      { id: "rp", x: X0 + 5 * SX + 10, y: Y0 - 45 * SY, text: "轉折點 100 ÷ 20 = 5", anchor: "start", cls: "warn" },
      { id: "k1t", x: X0 + SX + 12, y: Y0 - 20 * SY - 9, text: "程式 1：intensity 1", anchor: "start" },
      { id: "k1v", x: X0 + SX + 12, y: Y0 - 20 * SY + 10, text: "→ 20（memory-bound）", anchor: "start" },
      { id: "k2t", x: X0 + 8 * SX, y: Y0 - 86 * SY, text: "程式 2：intensity 8 → 100（compute-bound）" },
      { id: "k1u", x: X0 + SX + 14, y: Y0 - 106 * SY, text: "加運算單元也碰不到屋頂", anchor: "start", cls: "title" },
    ];
    return { width: 700, height: 300, nodes, edges, labels };
  });
})();
