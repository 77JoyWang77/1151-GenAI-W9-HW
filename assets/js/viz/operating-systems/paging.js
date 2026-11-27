/* =====================================================================
   Paging and TLB（分頁與 TLB）主題的視覺化
   - paging-sim : 輸入頁大小、頁表、TLB 格數與一串邏輯位址，逐個位址切 p / d、查 TLB、
                  失誤時查頁表（單層或兩層）並以 LRU 更新 TLB，最後算命中率與 EAT
   ===================================================================== */
(function () {
  "use strict";
  const { Player, Recorder, ui, register, esc, iconHTML, figure } = window.DSViz;

  // 右側程式碼：從 code/operating-systems/paging.c 原封不動取出
  const CODE1 = [
    "int translate(int addr) {",
    "  int p = addr / pageSize;           /* 頁號：位址的高位元 */",
    "  int d = addr % pageSize;           /* offset：位址的低位元 */",
    "  int f = tlbLookup(p);              /* 先查 TLB */",
    "  if (f >= 0) {",
    "    tlbHits++;",
    "    return f * pageSize + d;         /* TLB 命中：不用讀頁表 */",
    "  }",
    "  tlbMisses++;",
    "  memRefs++;                         /* TLB 失誤：到記憶體讀頁表 */",
    "  if (!pageTable[p].valid) return -1;   /* invalid：trap 給作業系統 */",
    "  f = pageTable[p].frame;",
    "  tlbInsert(p, f);                   /* 放進 TLB，滿了換掉 LRU */",
    "  return f * pageSize + d;           /* 實體位址 = frame 起點 + offset */",
    "}"
  ];
  const CODE2 = [
    "int translate2(int addr) {",
    "  int p = addr / pageSize, d = addr % pageSize;",
    "  int p1 = p / INNER;                /* 外層索引：頁號的高位元 */",
    "  int p2 = p % INNER;                /* 內層索引：頁號的低位元 */",
    "  int f = tlbLookup(p);              /* TLB 仍然用完整的頁號查 */",
    "  if (f >= 0) {",
    "    tlbHits++;",
    "    return f * pageSize + d;",
    "  }",
    "  tlbMisses++;",
    "  memRefs++;                         /* 第 1 次：讀外層頁表 */",
    "  if (outer[p1] == NULL) return -1;  /* 內層表不存在：trap */",
    "  memRefs++;                         /* 第 2 次：讀內層頁表 */",
    "  if (!outer[p1][p2].valid) return -1;",
    "  f = outer[p1][p2].frame;",
    "  tlbInsert(p, f);",
    "  return f * pageSize + d;",
    "}"
  ];
  function lines(CODE) {
    const ln = (s) => CODE.findIndex((l) => l.includes(s)) + 1;
    const last = CODE.map((l) => l.includes("return f * pageSize + d;")).lastIndexOf(true) + 1;
    return {
      split: CODE === CODE1 ? [ln("int p = addr / pageSize;"), ln("int d = addr % pageSize;")]
        : [ln("int p = addr / pageSize, d"), ln("int p1 = p / INNER;"), ln("int p2 = p % INNER;")],
      tlb: [ln("int f = tlbLookup(p);")],
      hit: [ln("if (f >= 0) {"), ln("tlbHits++;"), ln("    return f * pageSize + d;")],
      miss: [ln("if (f >= 0) {"), ln("tlbMisses++;")],
      pt: [ln("/* TLB 失誤：到記憶體讀頁表"), ln("if (!pageTable[p].valid)"), ln("f = pageTable[p].frame;")],
      ptBad: [ln("/* TLB 失誤：到記憶體讀頁表"), ln("if (!pageTable[p].valid)")],
      outer: [ln("/* 第 1 次"), ln("if (outer[p1] == NULL)")],
      inner: [ln("/* 第 2 次"), ln("if (!outer[p1][p2].valid)"), ln("f = outer[p1][p2].frame;")],
      innerBad: [ln("/* 第 2 次"), ln("if (!outer[p1][p2].valid)")],
      insert: [ln("tlbInsert(p, f);"), last],
    };
  }

  const TLB_NS = 10, MEM_NS = 100, NP = 8, INNER = 2;

  register("paging-sim", function (root) {
    const player = new Player(root, {
      title: "Paging and TLB 分頁與 TLB 模擬",
      width: 720, height: 480, code: CODE1, wide: true,
      legend: [["compare", "正在查"], ["found", "命中／找到"], ["new", "剛放進 TLB"], ["removed", "被換掉／invalid"], ["ghost", "空格"]],
    });

    // 模型
    let PS = 16, PT = [], TS = 2, LV = 1, trace = [], res = [], pas = [], tlb = [], now = 0, L = lines(CODE1);
    let hits = 0, ptRefs = 0, dataRefs = 0;
    const bitsOf = (x) => Math.round(Math.log2(x));
    const bin = (v, n) => v.toString(2).padStart(n, "0");

    function frame(caption, line, o = {}) {
      const nodes = [], labels = [], edges = [];
      const ob = bitsOf(PS);
      labels.push({ id: "cfg", x: 20, y: 22, text: `頁大小 ${PS} B → offset ${ob} 位元；8 頁 → 頁號 3 位元；TLB ${TS} 格（全關聯、LRU）；${LV === 1 ? "單層" : "兩層"}頁表`, cls: "title", anchor: "start" });
      if (o.calc) labels.push({ id: "calc", x: 20, y: 50, text: o.calc, cls: "strong", anchor: "start" });

      // 邏輯位址
      labels.push({ id: "lt", x: 40, y: 80, text: "邏輯位址", cls: "title", anchor: "start" });
      const has = o.p != null, st = has ? "compare" : "ghost";
      if (LV === 1) {
        nodes.push({ id: "lp", label: has ? `p = ${o.p}` : "p", shape: "box", x: 95, y: 108, w: 100, h: 32, state: st, sub: has ? bin(o.p, 3) : "" });
      } else {
        nodes.push({ id: "lp1", label: has ? `p1 = ${o.p >> 1}` : "p1", shape: "box", x: 75, y: 108, w: 80, h: 32, state: st, sub: has ? bin(o.p >> 1, 2) : "" });
        nodes.push({ id: "lp2", label: has ? `p2 = ${o.p & 1}` : "p2", shape: "box", x: 160, y: 108, w: 80, h: 32, state: st, sub: has ? bin(o.p & 1, 1) : "" });
      }
      nodes.push({ id: "ld", label: has ? `d = ${o.d}` : "d", shape: "box", x: LV === 1 ? 200 : 250, y: 108, w: 96, h: 32, state: has ? "active" : "ghost", sub: has ? bin(o.d, ob) : "" });
      // 實體位址
      labels.push({ id: "pt_", x: 470, y: 80, text: "實體位址", cls: "title", anchor: "start" });
      const ph = o.f != null;
      nodes.push({ id: "pf", label: ph ? `f = ${o.f}` : "f", shape: "box", x: 520, y: 108, w: 96, h: 32, state: ph ? "found" : "ghost" });
      nodes.push({ id: "pd", label: ph ? `d = ${o.d}` : "d", shape: "box", x: 622, y: 108, w: 96, h: 32, state: ph ? "active" : "ghost" });
      if (ph) labels.push({ id: "pa", x: 472, y: 146, text: `${o.f} × ${PS} + ${o.d} = ${o.f * PS + o.d}`, cls: "strong", anchor: "start" });
      if (o.trap) labels.push({ id: "pa", x: 472, y: 146, text: "trap：交給作業系統", cls: "warn", anchor: "start" });

      // TLB
      labels.push({ id: "tt", x: 40, y: 178, text: "TLB", cls: "title", anchor: "start" });
      labels.push({ id: "th1", x: 95, y: 200, text: "page", cls: "title" }, { id: "th2", x: 175, y: 200, text: "frame", cls: "title" });
      const tst = o.tlb || {};
      const full = tlb.every(Boolean);
      let lru = -1;
      if (full && tlb.length > 1) { lru = 0; tlb.forEach((e, i) => { if (e.last < tlb[lru].last) lru = i; }); }
      tlb.forEach((e, i) => {
        const y = 226 + i * 36, s = tst[i] || (e ? "default" : "ghost");
        nodes.push({ id: "tp" + i, label: e ? String(e.page) : "", shape: "box", x: 95, y, w: 70, h: 30, state: s });
        nodes.push({ id: "tf" + i, label: e ? String(e.frame) : "", shape: "box", x: 175, y, w: 70, h: 30, state: s });
        if (i === lru && !o.noLru) labels.push({ id: "lru" + i, x: 220, y, text: "最久沒用", cls: "warn", anchor: "start" });
      });

      // 頁表
      const pst = o.pt || {};
      if (LV === 1) {
        labels.push({ id: "ptt", x: 400, y: 178, text: "頁表（放在記憶體）", cls: "title", anchor: "start" });
        labels.push({ id: "ph1", x: 420, y: 200, text: "page", cls: "title" }, { id: "ph2", x: 500, y: 200, text: "frame", cls: "title" }, { id: "ph3", x: 575, y: 200, text: "valid", cls: "title" });
        PT.forEach((f, p) => {
          const y = 224 + p * 32, s = pst[p] || (f < 0 ? "muted" : "default");
          labels.push({ id: "pi" + p, x: 420, y, text: String(p), cls: pst[p] ? "strong" : "" });
          nodes.push({ id: "pfr" + p, label: f < 0 ? "—" : String(f), shape: "box", x: 500, y, w: 80, h: 26, state: s });
          nodes.push({ id: "pv" + p, label: f < 0 ? "i" : "v", shape: "box", x: 575, y, w: 44, h: 26, state: s });
        });
      } else {
        labels.push({ id: "ot", x: 380, y: 178, text: "外層頁表", cls: "title", anchor: "start" });
        labels.push({ id: "it", x: 530, y: 178, text: "內層頁表", cls: "title", anchor: "start" });
        labels.push({ id: "ih1", x: 580, y: 200, text: "frame", cls: "title" }, { id: "ih2", x: 650, y: 200, text: "valid", cls: "title" });
        const ost = o.outer || {};
        for (let k = 0; k < NP / INNER; k++) {
          const used = PT[2 * k] >= 0 || PT[2 * k + 1] >= 0;
          const yo = 226 + k * 64 + 15;
          labels.push({ id: "oi" + k, x: 388, y: yo, text: String(k), cls: ost[k] ? "strong" : "" });
          nodes.push({ id: "ob" + k, label: used ? `表 ${k}` : "NULL", shape: "box", x: 440, y: yo, w: 70, h: 28, state: ost[k] || (used ? "default" : "muted") });
          if (!used) { labels.push({ id: "un" + k, x: 600, y: yo, text: "（不配置內層表）" }); continue; }
          for (let j = 0; j < INNER; j++) {
            const p = 2 * k + j, f = PT[p], y = 226 + k * 64 + j * 30, s = pst[p] || (f < 0 ? "muted" : "default");
            labels.push({ id: "pi" + p, x: 678, y, text: `p2=${j}`, cls: pst[p] ? "strong" : "", anchor: "start" });
            nodes.push({ id: "pfr" + p, label: f < 0 ? "—" : String(f), shape: "box", x: 580, y, w: 64, h: 26, state: s });
            nodes.push({ id: "pv" + p, label: f < 0 ? "i" : "v", shape: "box", x: 650, y, w: 40, h: 26, state: s });
          }
          edges.push({ from: "ob" + k, to: "pfr" + 2 * k, directed: true, state: ost[k] ? "compare" : "default" });
        }
      }

      // 存取序列
      const TY = 400;
      labels.push({ id: "trl", x: 20, y: TY - 30, text: "存取序列", cls: "title", anchor: "start" });
      trace.forEach((a, k) => {
        const r = res[k];
        nodes.push({ id: "t" + k, label: String(a), shape: "box", x: 40 + k * 44, y: TY, w: 40, h: 28,
          state: k === o.cur ? "active" : r === "H" ? "found" : r === "F" ? "removed" : r === "M" ? "default" : "muted" });
        if (r) labels.push({ id: "tr" + k, x: 40 + k * 44, y: TY + 28, text: r === "H" ? "hit" : r === "M" ? "miss" : "trap", cls: r === "H" ? "ok" : r === "F" ? "warn" : "" });
      });
      labels.push({ id: "stat", x: 20, y: 460, text: `TLB 命中 ${hits}／讀頁表 ${ptRefs} 次／讀資料 ${dataRefs} 次`, cls: "title", anchor: "start" });
      return { nodes, edges, labels, caption, line };
    }

    function run(t, ps, pt, ts, lv) {
      PS = ps; PT = pt; TS = ts; LV = lv; trace = t;
      res = t.map(() => null); pas = []; tlb = Array.from({ length: ts }, () => null); now = 0;
      hits = ptRefs = dataRefs = 0;
      const CODE = lv === 1 ? CODE1 : CODE2;
      player.setCode(CODE); L = lines(CODE);
      const ob = bitsOf(ps), r = new Recorder();
      r.push(frame(`一開始 TLB 是空的。每個邏輯位址的低 ${ob} 位元是 offset d（因為頁大小 ${ps} = 2<sup>${ob}</sup>），再往上 3 位元是頁號 p。${lv === 2 ? "兩層頁表再把 p 切成外層索引 p1（高 2 位元）和內層索引 p2（低 1 位元）。" : ""}`, null, { noLru: true }));
      t.forEach((a, k) => {
        const p = Math.floor(a / ps), d = a % ps;
        now++;
        const calc = lv === 1 ? `位址 ${a} = ${p} × ${ps} + ${d} → p = ${p}、d = ${d}` : `位址 ${a} → p = ${p}（p1 = ${p} / 2 = ${p >> 1}、p2 = ${p} mod 2 = ${p & 1}）、d = ${d}`;
        const base = { calc, p, d, cur: k };
        r.push(frame(`存取邏輯位址 <b>${a}</b>：p = ${a} / ${ps} = <b>${p}</b>，d = ${a} mod ${ps} = <b>${d}</b>。頁大小是 2 的次方，所以這只是把位址的二進位<b>從中間切開</b>，硬體不用做除法。`, L.split, base));
        const ti = tlb.findIndex((e) => e && e.page === p);
        if (ti >= 0) {
          const f = tlb[ti].frame;
          tlb[ti].last = now; hits++; dataRefs++; res[k] = "H"; pas[k] = f * ps + d;
          r.push(frame(`TLB 裡有 page ${p} → frame ${f}：<b>TLB 命中</b>，完全不用讀頁表。實體位址 = ${f} × ${ps} + ${d} = <b>${f * ps + d}</b>。這次只花 TLB ${TLB_NS} ns + 1 次記憶體 ${MEM_NS} ns。同時更新它的最後使用時間（LRU）。`, L.hit, Object.assign({ f, tlb: { [ti]: "found" } }, base)));
          return;
        }
        let v = tlb.findIndex((e) => !e);
        const full = v < 0;
        if (full) { v = 0; tlb.forEach((e, i) => { if (e.last < tlb[v].last) v = i; }); }
        r.push(frame(`TLB 的 ${TS} 格都沒有 page ${p}：<b>TLB miss</b>。miss 不代表頁不在記憶體，只是這筆對應沒被快取，要到記憶體讀頁表${lv === 2 ? "（兩層要讀 2 次）" : "（多 1 次記憶體存取）"}。${full ? `TLB 已滿，等一下要換掉最久沒用的 page ${tlb[v].page}。` : ""}`, L.miss.concat(L.tlb), Object.assign({ tlb: full ? { [v]: "removed" } : {} }, base)));
        const f = pt[p];
        if (lv === 1) {
          ptRefs++;
          if (f < 0) {
            res[k] = "F";
            r.push(frame(`讀頁表第 ${p} 格（位置 = PTBR + ${p} × PTE 大小）：valid-invalid 位元是 <b>i</b>，這一頁不在行程的合法範圍或還沒載入記憶體，MMU 發出 <b>trap</b> 交給作業系統，這次存取不會產生實體位址。`, L.ptBad, Object.assign({ trap: true, pt: { [p]: "removed" }, noLru: true }, base)));
            return;
          }
          r.push(frame(`讀頁表第 ${p} 格（位置 = PTBR + ${p} × PTE 大小，這是 1 次記憶體存取）：valid，page ${p} 放在 <b>frame ${f}</b>。`, L.pt, Object.assign({ pt: { [p]: "found" }, tlb: full ? { [v]: "removed" } : {} }, base)));
        } else {
          const p1 = p >> 1, p2 = p & 1, used = pt[2 * p1] >= 0 || pt[2 * p1 + 1] >= 0;
          ptRefs++;
          if (!used) {
            res[k] = "F";
            r.push(frame(`第 1 次記憶體存取：讀外層頁表第 ${p1} 格，是 <b>NULL</b>：page ${2 * p1}、${2 * p1 + 1} 都沒用到，所以這張內層表根本沒配置（兩層頁表就是這樣省空間）。MMU 發出 <b>trap</b>。`, L.outer, Object.assign({ trap: true, outer: { [p1]: "removed" }, noLru: true }, base)));
            return;
          }
          r.push(frame(`第 1 次記憶體存取：讀外層頁表第 p1 = ${p1} 格，得到內層表 ${p1} 的位置。`, L.outer, Object.assign({ outer: { [p1]: "compare" }, tlb: full ? { [v]: "removed" } : {} }, base)));
          ptRefs++;
          if (f < 0) {
            res[k] = "F";
            r.push(frame(`第 2 次記憶體存取：讀內層表 ${p1} 的第 p2 = ${p2} 格，valid-invalid 位元是 <b>i</b>：MMU 發出 <b>trap</b> 交給作業系統。`, L.innerBad, Object.assign({ trap: true, outer: { [p1]: "compare" }, pt: { [p]: "removed" }, noLru: true }, base)));
            return;
          }
          r.push(frame(`第 2 次記憶體存取：讀內層表 ${p1} 的第 p2 = ${p2} 格：valid，page ${p} 放在 <b>frame ${f}</b>。TLB miss 時兩層頁表要讀 2 次記憶體才拿到 frame 號。`, L.inner, Object.assign({ outer: { [p1]: "compare" }, pt: { [p]: "found" }, tlb: full ? { [v]: "removed" } : {} }, base)));
        }
        const old = tlb[v];
        tlb[v] = { page: p, frame: f, last: now }; dataRefs++; res[k] = "M"; pas[k] = f * ps + d;
        r.push(frame(`把 (page ${p}, frame ${f}) 放進 TLB${old ? `，換掉最久沒用的 page ${old.page}` : " 的空格"}，下次再用到 page ${p} 就會命中。實體位址 = ${f} × ${ps} + ${d} = <b>${f * ps + d}</b>，最後再花 1 次記憶體存取讀資料。`, L.insert, Object.assign({ f, tlb: { [v]: "new" }, pt: { [p]: "found" }, outer: lv === 2 ? { [p >> 1]: "compare" } : {}, noLru: true }, base)));
      });
      const n = dataRefs, miss = n - hits;
      let msg;
      if (!n) msg = "所有位址都 trap，沒有成功的存取可以算 EAT。";
      else {
        const h = hits / n, ht = TLB_NS + MEM_NS, mt = TLB_NS + (lv + 1) * MEM_NS, e = h * ht + (1 - h) * mt;
        msg = `成功轉換 ${n} 次，TLB 命中 ${hits} 次、失誤 ${miss} 次，命中率 h = ${hits}/${n} = ${(h * 100).toFixed(1)}%。設 TLB ${TLB_NS} ns、記憶體 ${MEM_NS} ns：EAT = h × ${ht} + (1 − h) × ${mt} = <b>${e.toFixed(1)} ns</b>（命中只要 ${ht} ns；完全沒有 TLB 要 ${(lv + 1) * MEM_NS} ns）。`;
      }
      const traps = res.filter((x) => x === "F").length;
      r.push(frame(`全部做完。${msg}${traps ? ` 另有 ${traps} 次 trap 不算在內。` : ""}`, null, { noLru: true }));
      return r.frames;
    }

    const inT = ui.input(player, { placeholder: "邏輯位址，空白隔開", value: "20 24 70 28 5 30 72 40", width: 170 });
    const inS = ui.input(player, { placeholder: "頁大小", value: "16", width: 52 });
    const inP = ui.input(player, { placeholder: "頁表 8 格（- 表示 invalid）", value: "5 2 - - 9 0 7 3", width: 130 });
    const inB = ui.input(player, { placeholder: "TLB 格數", value: "2", width: 48 });
    let mode = 1;
    const bad = (el, msg) => {
      el.classList.add("is-error"); setTimeout(() => el.classList.remove("is-error"), 700);
      trace = []; res = []; tlb = []; hits = ptRefs = dataRefs = 0;
      player.load([frame(`${iconHTML("alert")} ${msg}`, null)], { autoplay: false });
    };
    function go(lv) {
      if (lv) mode = lv;
      const ps = Number(inS.value.trim());
      if (![4, 8, 16, 32, 64].includes(ps)) return bad(inS, "頁大小請輸入 4、8、16、32 或 64（2 的次方，單位 byte）。");
      const toks = inP.value.trim().split(/[\s,]+/).filter(Boolean);
      if (toks.length !== NP || toks.some((x) => x !== "-" && !/^\d{1,2}$/.test(x)) || toks.some((x) => x !== "-" && Number(x) > 15))
        return bad(inP, `頁表請輸入剛好 8 格，每格是 frame 號 0～15，或用「-」表示 invalid。目前是「${esc(inP.value)}」。`);
      const pt = toks.map((x) => (x === "-" ? -1 : Number(x)));
      const ts = Number(inB.value.trim());
      if (![1, 2, 3, 4].includes(ts)) return bad(inB, "TLB 格數請輸入 1～4。");
      const t = inT.value.trim().split(/[\s,]+/).filter(Boolean);
      const max = NP * ps - 1;
      if (!t.length || t.length > 8 || t.some((x) => !/^\d{1,3}$/.test(x) || Number(x) > max))
        return bad(inT, `邏輯位址請輸入 1～8 個 0～${max} 的整數（8 頁 × ${ps} B），用空白隔開。`);
      player.load(run(t.map(Number), ps, pt, ts, mode));
    }
    ui.button(player, "單層頁表", () => go(1));
    ui.button(player, "兩層頁表", () => go(2));
    ui.button(player, "局部性好", () => { inT.value = "0 4 8 12 16 20 24 28"; inS.value = "16"; inB.value = "2"; go(); }, "ghost");
    ui.button(player, "循環 3 頁", () => { inT.value = "5 20 70 5 20 70"; inS.value = "16"; inB.value = "2"; go(); }, "ghost");
    ui.button(player, "TLB 加到 3 格", () => { inT.value = "5 20 70 5 20 70"; inS.value = "16"; inB.value = "3"; go(); }, "ghost");
    inT.addEventListener("keydown", (e) => e.key === "Enter" && go());

    const demo = run([20, 24, 70, 28, 5, 30, 72, 40], 16, [5, 2, -1, -1, 9, 0, 7, 3], 2, 1);
    demo[0].caption = iconHTML("play") + " 按播放看示範：頁大小 16 B、TLB 2 格，8 個位址中 3 次 TLB 命中、4 次失誤、1 次 trap（位址 40 在 invalid 的 page 2）。注意第 5 個位址：TLB 滿了，LRU 換掉的是 page 4 而不是先進來的 page 1，因為 page 1 剛被用過。輸入框依序是：邏輯位址、頁大小、頁表 8 格（- 表示 invalid）、TLB 格數；按「兩層頁表」用同一組資料比較記憶體存取次數。";
    player.load(demo, { autoplay: false });
  });

  // ===================================================================
  // 靜態圖解
  // ===================================================================
  const box = (id, label, x, y, w, st, h, sub) => ({ id, label, shape: "box", x, y, w, h: h || 30, state: st || "default", sub });

  // 圖 1：連續配置的外部碎片 vs 分頁
  figure("paging-contiguous-vs-paging", () => {
    const nodes = [], labels = [], edges = [];
    // (a) 連續配置：由上到下 OS、P1、洞 30、P2、洞 20、P3、洞 25
    const segs = [["OS", 40, "muted"], ["P1", 40, "default"], ["空 30 KB", 30, "ghost"], ["P2", 50, "default"], ["空 20 KB", 20, "ghost"], ["P3", 40, "default"], ["空 25 KB", 25, "ghost"]];
    let y = 56;
    segs.forEach(([nm, sz, st], i) => {
      const hh = sz * 1.15;
      nodes.push(box("a" + i, nm, 130, y + hh / 2, 120, st, hh - 3));
      y += hh;
    });
    labels.push({ id: "at", x: 130, y: 28, text: "(a) 連續配置", cls: "strong" });
    labels.push({ id: "aw", x: 130, y: y + 20, text: "空間共 75 KB，", cls: "warn" });
    labels.push({ id: "aw2", x: 130, y: y + 40, text: "但沒有一塊 ≥ 60 KB", cls: "warn" });
    nodes.push(box("p4", "P4 要 60 KB", 275, 160, 110, "removed", 34));
    labels.push({ id: "ax", x: 275, y: 196, text: "放不進去", cls: "warn" });
    // (b) 分頁：P4 切成 4 頁（每頁 15 KB），放進不相鄰的 frame
    labels.push({ id: "bt", x: 545, y: 28, text: "(b) 分頁", cls: "strong" });
    const map = [2, 4, 6, 7], LY = [110, 175, 245, 305];
    for (let i = 0; i < 4; i++) nodes.push(box("lp" + i, "P4 頁 " + i, 405, LY[i], 90, "compare", 32));
    labels.push({ id: "bl", x: 405, y: 56, text: "邏輯（連續）", cls: "title" });
    labels.push({ id: "br", x: 680, y: 56, text: "實體 frame", cls: "title" });
    const used = { 0: "OS", 1: "P1", 3: "P2", 5: "P3" };
    for (let f = 0; f < 8; f++) {
      const k = map.indexOf(f);
      nodes.push(box("f" + f, k >= 0 ? "P4-" + k : used[f] || "空", 680, 80 + f * 34, 84, k >= 0 ? "compare" : used[f] ? "muted" : "ghost", 28));
      labels.push({ id: "fn" + f, x: 728, y: 80 + f * 34, text: String(f), anchor: "start" });
    }
    map.forEach((f, i) => edges.push({ from: "lp" + i, to: "f" + f, directed: true, state: "compare" }));
    labels.push({ id: "bw", x: 545, y: 366, text: "每一頁可以放進任何空的 frame：沒有外部碎片", cls: "ok" });
    return { width: 740, height: 384, nodes, labels, edges };
  });

  // 圖 2：位址轉換（頁 1 KB，邏輯 5500 → 實體 9596）
  figure("paging-translation", () => {
    const nodes = [], labels = [], edges = [];
    labels.push({ id: "lt", x: 125, y: 34, text: "邏輯位址 5500", cls: "title" });
    nodes.push(box("p", "p = 5", 80, 66, 90, "compare", 34, "高 6 位元"), box("d", "d = 380", 175, 66, 100, "active", 34, "低 10 位元"));
    labels.push({ id: "rt", x: 610, y: 34, text: "實體位址 9596", cls: "title" });
    nodes.push(box("f", "f = 9", 565, 66, 90, "found", 34), box("d2", "d = 380", 660, 66, 100, "active", 34));
    edges.push({ from: "d", to: "d2", directed: true, state: "active", dashed: true });
    labels.push({ id: "dn", x: 400, y: 54, text: "offset 原封不動", cls: "" });
    const tab = [7, 3, 12, -1, -1, 9, -1, 2];
    labels.push({ id: "tt", x: 380, y: 120, text: "頁表（起點記在 PTBR）", cls: "title" });
    tab.forEach((f, i) => {
      if (i !== 5) labels.push({ id: "ti" + i, x: 322, y: 150 + i * 28, text: String(i), anchor: "end" });
      nodes.push(box("t" + i, f < 0 ? "—" : String(f), 370, 150 + i * 28, 70, i === 5 ? "found" : f < 0 ? "muted" : "default", 24));
      nodes.push(box("v" + i, f < 0 ? "i" : "v", 430, 150 + i * 28, 36, i === 5 ? "found" : f < 0 ? "muted" : "default", 24));
    });
    const pointers = [{ id: "pp", label: "p = 5", target: "t5", dir: "left", state: "compare" }];
    labels.push({ id: "out", x: 462, y: 290, text: "→ f = 9，接上 d", cls: "ok", anchor: "start" });
    labels.push({ id: "eq", x: 610, y: 120, text: "9 × 1024 + 380 = 9596", cls: "strong" });
    return { width: 740, height: 370, nodes, labels, edges, pointers };
  });

  // 圖 3：有 TLB 的位址轉換流程
  figure("paging-tlb-flow", () => {
    const nodes = [], labels = [], edges = [];
    nodes.push(box("cpu", "CPU", 50, 70, 70, "default", 34));
    nodes.push(box("p", "p = 5", 150, 70, 76, "compare", 34), box("d", "d", 222, 70, 60, "active", 34));
    edges.push({ from: "cpu", to: "p", directed: true });
    labels.push({ id: "tt", x: 370, y: 32, text: "TLB（全關聯，同時比對）", cls: "title" });
    const ents = [[1, 2], [5, 9], [4, 6], [0, 7]];
    ents.forEach(([pg, f], i) => {
      nodes.push(box("tp" + i, String(pg), 345, 64 + i * 30, 50, i === 1 ? "found" : "default", 26));
      nodes.push(box("tf" + i, String(f), 400, 64 + i * 30, 50, i === 1 ? "found" : "default", 26));
    });
    labels.push({ id: "cmp", x: 312, y: 94, text: "p = 5 →", cls: "strong", anchor: "end" });
    nodes.push(box("f", "f", 600, 94, 60, "found", 34), box("d2", "d", 665, 94, 60, "active", 34));
    edges.push({ from: "tf1", to: "f", directed: true, state: "found" });
    labels.push({ id: "hit", x: 520, y: 80, text: "TLB hit", cls: "ok" });
    // miss 路徑
    nodes.push(box("pt", "頁表[p] = f", 372, 300, 150, "compare", 36));
    labels.push({ id: "pt_", x: 372, y: 338, text: "頁表（在記憶體）", cls: "title" });
    edges.push({ from: "p", to: "pt", directed: true, state: "removed" });
    labels.push({ id: "miss", x: 205, y: 220, text: "TLB miss", cls: "warn" });
    edges.push({ from: "pt", to: "f", directed: true, state: "compare" });
    nodes.push(box("upd", "放進 TLB（滿了換 LRU）", 600, 250, 190, "new", 30));
    edges.push({ from: "upd", to: "tf3", directed: true, state: "visited", dashed: true });
    labels.push({ id: "c1", x: 380, y: 382, text: "hit：TLB + 1 次記憶體；miss：TLB + 讀頁表 1 次 + 讀資料 1 次", cls: "strong" });
    return { width: 740, height: 400, nodes, labels, edges };
  });

  // 圖 4：共享頁：兩個行程的程式碼頁對到同一個 frame，虛擬頁號可以不同
  figure("paging-shared-pages", () => {
    const nodes = [], labels = [], edges = [];
    labels.push({ id: "a", x: 90, y: 30, text: "P1 的邏輯頁", cls: "strong" }, { id: "b", x: 640, y: 30, text: "P2 的邏輯頁", cls: "strong" }, { id: "c", x: 365, y: 30, text: "實體 frame", cls: "strong" });
    const P1 = [["0：ed1", 3, "r-x"], ["1：ed2", 4, "r-x"], ["2：data1", 6, "rw-"]];
    const P2 = [["0：data2", 1, "rw-"], ["1：ed1", 3, "r-x"], ["2：ed2", 4, "r-x"]];
    const fr = { 1: "data2", 3: "ed1", 4: "ed2", 6: "data1" };
    for (let f = 0; f < 8; f++) {
      const shared = f === 3 || f === 4;
      nodes.push(box("f" + f, fr[f] || "", 365, 70 + f * 34, 100, shared ? "found" : fr[f] ? "default" : "ghost", 28));
      labels.push({ id: "fn" + f, x: 300, y: 70 + f * 34, text: String(f), anchor: "end" });
    }
    P1.forEach(([nm, f, pr], i) => {
      nodes.push(box("a" + i, nm, 90, 100 + i * 70, 120, f === 6 ? "default" : "found", 32, pr));
      edges.push({ from: "a" + i, to: "f" + f, directed: true, state: f === 6 ? "default" : "found" });
    });
    P2.forEach(([nm, f, pr], i) => {
      nodes.push(box("b" + i, nm, 640, 100 + i * 70, 120, f === 1 ? "default" : "found", 32, pr));
      edges.push({ from: "b" + i, to: "f" + f, directed: true, state: f === 1 ? "default" : "found" });
    });
    labels.push({ id: "n1", x: 365, y: 352, text: "ed1 在 P1 是第 0 頁、在 P2 是第 1 頁，指向同一個 frame 3", cls: "ok" });
    return { width: 740, height: 372, nodes, labels, edges };
  });

  // 圖 5：兩層頁表（32 位元、10 | 10 | 12）
  figure("paging-two-level", () => {
    const nodes = [], labels = [], edges = [];
    const PX = 13, X0 = 160;
    [["p1 10", 10, "compare"], ["p2 10", 10, "visited"], ["d 12", 12, "active"]].reduce((x, [nm, b, st], k) => {
      nodes.push(box("h" + k, nm, x + (b * PX) / 2, 46, b * PX - 4, st, 32));
      return x + b * PX;
    }, X0);
    labels.push({ id: "ht", x: X0 - 12, y: 46, text: "32 位元位址", cls: "title", anchor: "end" });
    labels.push({ id: "ot", x: 120, y: 104, text: "外層頁表（1 頁）", cls: "title" });
    const orow = ["0", "1", "2", "…", "1023"];
    orow.forEach((nm, i) => {
      const st = i === 1 ? "compare" : i === 2 || i === 3 ? "muted" : "default";
      nodes.push(box("o" + i, i === 2 ? "NULL" : i === 3 ? "…" : "→", 120, 136 + i * 34, 80, st, 28));
      labels.push({ id: "on" + i, x: 70, y: 136 + i * 34, text: nm, anchor: "end" });
    });
    labels.push({ id: "it", x: 380, y: 104, text: "內層頁表（各 1 頁）", cls: "title" });
    const inner = (pfx, y0, hl) => {
      for (let j = 0; j < 3; j++) nodes.push(box(pfx + j, j === 1 && hl ? "frame f" : "", 380, y0 + j * 26, 110, j === 1 && hl ? "visited" : "default", 22));
    };
    inner("ia", 130, false); inner("ib", 220, true); inner("ic", 310, false);
    edges.push({ from: "o0", to: "ia0", directed: true }, { from: "o1", to: "ib0", directed: true, state: "compare" }, { from: "o4", to: "ic0", directed: true });
    labels.push({ id: "un", x: 120, y: 330, text: "NULL：那 4 MB 沒用到，", anchor: "middle" });
    labels.push({ id: "un2", x: 120, y: 350, text: "不配置內層表", anchor: "middle" });
    nodes.push(box("pg", "資料所在的頁", 620, 246, 140, "found", 34));
    edges.push({ from: "ib1", to: "pg", directed: true, state: "visited" });
    labels.push({ id: "c1", x: 620, y: 290, text: "+ d 得到實體位址", cls: "" });
    labels.push({ id: "c2", x: 370, y: 392, text: "TLB miss：外層 1 次 + 內層 1 次 + 資料 1 次 = 3 次記憶體存取", cls: "strong" });
    return { width: 740, height: 410, nodes, labels, edges };
  });

  // 圖 6：反向頁表：用 (pid, p) 搜尋，找到的列號 i 就是 frame 號
  figure("paging-inverted", () => {
    const nodes = [], labels = [], edges = [];
    labels.push({ id: "lt", x: 135, y: 34, text: "邏輯位址", cls: "title" });
    nodes.push(box("pid", "pid = 2", 70, 66, 90, "compare", 32), box("p", "p = 7", 165, 66, 90, "compare", 32), box("d", "d", 240, 66, 50, "active", 32));
    const rows = [["1", "0"], ["2", "3"], ["1", "5"], ["2", "7"], ["3", "0"], ["1", "2"]];
    labels.push({ id: "tt", x: 420, y: 34, text: "反向頁表（每個 frame 一列）", cls: "title" });
    labels.push({ id: "h1", x: 390, y: 60, text: "pid", cls: "title" }, { id: "h2", x: 460, y: 60, text: "page", cls: "title" });
    rows.forEach(([pid, pg], i) => {
      const st = i === 3 ? "found" : i < 3 ? "visited" : "default";
      nodes.push(box("r" + i, pid, 390, 88 + i * 30, 60, st, 26), box("s" + i, pg, 460, 88 + i * 30, 60, st, 26));
      labels.push({ id: "ri" + i, x: 340, y: 88 + i * 30, text: "i = " + i, anchor: "end", cls: i === 3 ? "strong" : "" });
    });
    nodes.push(box("f", "f = 3", 630, 178, 90, "found", 32), box("d2", "d", 705, 178, 50, "active", 32));
    edges.push({ from: "s3", to: "f", directed: true, state: "found" });
    labels.push({ id: "c1", x: 210, y: 140, text: "由上往下比對，", anchor: "middle" });
    labels.push({ id: "c2", x: 210, y: 160, text: "第 3 列吻合", anchor: "middle" });
    labels.push({ id: "c3", x: 380, y: 290, text: "表的大小只跟實體記憶體有關，但要搜尋（實務上搭配雜湊）", cls: "strong" });
    return { width: 740, height: 310, nodes, labels, edges };
  });
})();
