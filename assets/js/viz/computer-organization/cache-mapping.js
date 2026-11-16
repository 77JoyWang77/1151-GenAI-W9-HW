/* =====================================================================
   Cache Organization and Mapping（快取組織與映射）主題的視覺化
   - cache-sim : 輸入位址序列，用直接映射／2-way／全關聯快取逐一存取，看命中與替換（LRU）
   ===================================================================== */
(function () {
  "use strict";
  const { Player, Recorder, ui, register, esc, iconHTML, figure } = window.DSViz;

  // 右側程式碼：從 code/computer-organization/cache-mapping.c 原封不動取出
  const CODE = [
    "int access(int addr) {",
    "  int block = addr / blockWords;   /* 屬於第幾個記憶體區塊 */",
    "  int set = block % sets;          /* 只能放進這一個 set */",
    "  int tag = block / sets;          /* 剩下的高位元當 tag */",
    "  now++;",
    "  for (int w = 0; w < ways; w++)   /* 同一個 set 裡的每一格都要比對 tag */",
    "    if (cache[set][w].valid && cache[set][w].tag == tag) {",
    "      cache[set][w].lastUsed = now;",
    "      return 1;                    /* 命中 */",
    "    }",
    "  int victim = 0;                  /* 失誤：先找空格，沒有空格就換掉最久沒用的 */",
    "  for (int w = 0; w < ways; w++) {",
    "    if (!cache[set][w].valid) { victim = w; break; }",
    "    if (cache[set][w].lastUsed < cache[set][victim].lastUsed) victim = w;",
    "  }",
    "  cache[set][victim].valid = 1;",
    "  cache[set][victim].tag = tag;",
    "  cache[set][victim].lastUsed = now;",
    "  return 0;",
    "}"
  ];
  const ln = (s) => CODE.findIndex((l) => l.includes(s)) + 1;
  const L = {
    fields: [ln("int block = addr / blockWords"), ln("int set = block % sets"), ln("int tag = block / sets")],
    cmp: [ln("for (int w = 0; w < ways; w++)   /* 同一個 set"), ln("if (cache[set][w].valid && cache[set][w].tag == tag)")],
    hit: [ln("cache[set][w].lastUsed = now;"), ln("return 1;")],
    victim: [ln("int victim = 0;"), ln("if (!cache[set][w].valid)"), ln("if (cache[set][w].lastUsed < cache[set][victim].lastUsed)")],
    fill: [ln("cache[set][victim].valid = 1;"), ln("cache[set][victim].tag = tag;"), ln("return 0;")],
  };

  register("cache-sim", function (root) {
    const player = new Player(root, {
      title: "Cache Simulator 快取模擬",
      width: 680, height: 420, code: CODE,
      legend: [["compare", "這個位址能放的 set"], ["found", "命中"], ["removed", "被換掉"], ["new", "剛放進來"], ["ghost", "空格（valid = 0）"]],
    });

    let NB = 8, WAYS = 1, BW = 1, SETS = 8, trace = [], cache = [], res = [];
    const X0 = 150, Y0 = 92, BW_ = 62, BH = 30;
    const colX = (w) => X0 + w * (WAYS > 4 ? 66 : 96) + (WAYS === 1 ? 30 : 0);
    const gap = () => (SETS > 4 ? 32 : 44);
    const rowY = (s) => 204 - (SETS - 1) * gap() / 2 + s * gap();   // 所有 set 垂直置中
    const name = () => (WAYS === 1 ? "直接映射" : WAYS === NB ? "全關聯" : WAYS + "-way 集合關聯");

    function frame(caption, line, opt = {}) {
      const st = opt.st || {}, nodes = [], labels = [];
      labels.push({ id: "cfg", x: 24, y: 26, text: `${name()}：${NB} 個區塊、${SETS} 個 set × ${WAYS} 格、區塊 ${BW} word`, cls: "title", anchor: "start" });
      if (opt.calc) labels.push({ id: "calc", x: 24, y: 54, text: opt.calc, cls: "strong", anchor: "start" });
      for (let s = 0; s < SETS; s++) {
        labels.push({ id: "set" + s, x: X0 - 70, y: rowY(s) + 5, text: "set " + s, cls: opt.set === s ? "warn" : "", anchor: "start" });
        for (let w = 0; w < WAYS; w++) {
          const ln_ = cache[s][w];
          nodes.push({ id: `l${s}_${w}`, label: ln_.valid ? `B${ln_.block}` : "", shape: "box", x: colX(w), y: rowY(s), w: WAYS === 1 ? 120 : BW_, h: BH,
            state: st[s + "," + w] || (!ln_.valid ? "ghost" : opt.set === s ? "compare" : "default") });
        }
      }
      if (WAYS > 1) for (let w = 0; w < WAYS; w++) labels.push({ id: "way" + w, x: colX(w), y: rowY(0) - 26, text: "way " + w, cls: "title" });
      // 存取序列
      const TY = 360;
      labels.push({ id: "tl", x: 24, y: TY + 5, text: "存取序列", cls: "title", anchor: "start" });
      trace.forEach((a, k) => {
        const r = res[k];
        nodes.push({ id: "t" + k, label: String(a), shape: "box", x: 110 + k * 44, y: TY, w: 38, h: 28,
          state: k === opt.cur ? "active" : r === "H" ? "found" : r === "M" ? "removed" : "muted" });
        if (r) labels.push({ id: "tr" + k, x: 110 + k * 44, y: TY + 34, text: r === "H" ? "hit" : "miss", cls: r === "H" ? "ok" : "warn" });
      });
      const hits = res.filter((x) => x === "H").length, done = res.filter(Boolean).length;
      if (done) labels.push({ id: "rate", x: 656, y: 26, text: `命中 ${hits} / ${done}`, cls: "strong", anchor: "end" });
      return { nodes, edges: [], labels, caption, line };
    }

    function run(t, nb, ways, bw) {
      NB = nb; WAYS = ways; BW = bw; SETS = nb / ways; trace = t; res = t.map(() => null);
      cache = Array.from({ length: SETS }, () => Array.from({ length: WAYS }, () => ({ valid: 0, tag: 0, block: 0, last: 0 })));
      const r = new Recorder();
      r.push(frame(`一開始快取是空的（所有 valid = 0）。${name()}：每個記憶體區塊只能放進「區塊編號 mod ${SETS}」那個 set，set 裡有 ${WAYS} 格可以選。`, null));
      let now = 0;
      t.forEach((a, k) => {
        const blk = Math.floor(a / BW), set = blk % SETS, tag = Math.floor(blk / SETS);
        now++;
        const calc = `位址 ${a} → 區塊 ${a} / ${BW} = ${blk} → set ${blk} mod ${SETS} = ${set}，tag ${blk} / ${SETS} = ${tag}`;
        r.push(frame(`存取位址 <b>${a}</b>：先算它屬於哪個區塊、只能放在哪個 set。${BW > 1 ? `區塊 ${BW} 個 word，所以位址 ${blk * BW}～${blk * BW + BW - 1} 屬於同一個區塊。` : ""}`, L.fields, { calc, set, cur: k }));
        const lines = cache[set];
        const w = lines.findIndex((x) => x.valid && x.tag === tag);
        if (w >= 0) {
          lines[w].last = now; res[k] = "H";
          r.push(frame(`set ${set} 裡有 valid = 1 且 tag = ${tag} 的格子，存的正是區塊 ${blk}：<b>命中</b>，直接從快取讀。${WAYS > 1 ? "同時更新它的最後使用時間（LRU）。" : ""}`, L.hit, { calc, set, cur: k, st: { [set + "," + w]: "found" } }));
          return;
        }
        let v = lines.findIndex((x) => !x.valid), why;
        if (v >= 0) why = WAYS === 1 ? `這一格還是空的` : `set ${set} 還有空格（way ${v}）`;
        else {
          v = 0; lines.forEach((x, i) => { if (x.last < lines[v].last) v = i; });
          why = WAYS === 1 ? `直接映射只有這一格可以放，只好把原本的區塊 ${lines[v].block} <b>換掉</b>。` : `set ${set} 的 ${WAYS} 格都滿了，換掉<b>最久沒被用到</b>的區塊 ${lines[v].block}（LRU）。`;
          r.push(frame(`set ${set} 沒有 tag = ${tag} 的格子：<b>失誤</b>。${why}`, L.victim, { calc, set, cur: k, st: { [set + "," + v]: "removed" } }));
          why = "";
        }
        lines[v] = { valid: 1, tag, block: blk, last: now }; res[k] = "M";
        r.push(frame(`${why ? `set ${set} 沒有區塊 ${blk}：<b>失誤</b>。${why}，` : ""}從記憶體把區塊 ${blk} 搬進來，設定 valid = 1、tag = ${tag}。${BW > 1 ? `整個區塊（位址 ${blk * BW}～${blk * BW + BW - 1}）一起搬進來，之後存取鄰近位址就會命中。` : ""}`, why ? L.victim.concat(L.fill) : L.fill, { calc, set, cur: k, st: { [set + "," + v]: "new" } }));
      });
      const hits = res.filter((x) => x === "H").length;
      r.push(frame(`全部存取完：命中 <b>${hits}</b> 次、失誤 ${t.length - hits} 次，命中率 ${hits} / ${t.length} = ${(hits / t.length * 100).toFixed(1)}%。換成別的映射方式，用同一串位址比比看。`, null));
      return r.frames;
    }

    const inT = ui.input(player, { placeholder: "word 位址，用空白隔開", value: "3 11 3 19 4 11 20 3", width: 190 });
    const inN = ui.input(player, { placeholder: "區塊數", value: "8", width: 52 });
    const inB = ui.input(player, { placeholder: "word/區塊", value: "1", width: 52 });
    const bad = (el, msg) => {
      el.classList.add("is-error"); setTimeout(() => el.classList.remove("is-error"), 700);
      trace = []; res = []; cache = []; SETS = 0;
      player.load([frame(`${iconHTML("alert")} ${msg}`, null)], { autoplay: false });
    };
    function go(mode) {
      const t = inT.value.trim().split(/[\s,]+/).filter(Boolean);
      if (!t.length || t.length > 12 || t.some((x) => !/^\d{1,2}$/.test(x))) return bad(inT, "位址請輸入 1～12 個 0～99 的整數，用空白隔開。");
      const nb = Number(inN.value), bw = Number(inB.value);
      if (![2, 4, 8].includes(nb)) return bad(inN, "區塊數請輸入 2、4 或 8（畫面最多放 8 格）。");
      if (![1, 2, 4].includes(bw)) return bad(inB, "每個區塊的 word 數請輸入 1、2 或 4。");
      const ways = mode === "direct" ? 1 : mode === "full" ? nb : Math.min(2, nb);
      player.load(run(t.map(Number), nb, ways, bw));
    }
    ui.button(player, "直接映射", () => go("direct"));
    ui.button(player, "2-way", () => go("2way"));
    ui.button(player, "全關聯", () => go("full"));
    ui.button(player, "空間區域性範例", () => { inT.value = "0 1 2 3 4 5 6 7 0 1"; inN.value = "2"; inB.value = "2"; go("direct"); }, "ghost");
    ui.button(player, "2-way 反而比較差", () => { inT.value = "0 2 4 0 2 4 0 2 4"; inN.value = "4"; inB.value = "1"; go("2way"); }, "ghost");
    inT.addEventListener("keydown", (e) => e.key === "Enter" && go("direct"));

    const demo = run([3, 11, 3, 19, 4, 11, 20, 3], 8, 1, 1);
    demo[0].caption = iconHTML("play") + " 按播放看示範：8 個區塊的直接映射快取，位址 3、11、19 都落在 set 3，互相把對方擠掉，8 次全部失誤。按「2-way」「全關聯」用同一串位址比較（命中分別是 1 次和 3 次）；也可以改區塊數、每個區塊的 word 數，輸入自己的位址。";
    player.load(demo, { autoplay: false });
  });

  // ===================================================================
  // 靜態圖解
  // ===================================================================
  const box = (id, label, x, y, w, st, h) => ({ id, label, shape: "box", x, y, w, h: h || 32, state: st || "default" });

  // 圖 1：位址切成 tag / index / offset
  figure("cache-address-fields", () => {
    const nodes = [], labels = [], PX = 17, X0 = 52;
    const row = (pfx, y, parts, title) => {
      let x = X0;
      labels.push({ id: pfx + "t", x: X0, y: y - 30, text: title, cls: "strong", anchor: "start" });
      parts.forEach(([nm, bits, st], k) => {
        const w = Math.max(bits * PX, 100);
        nodes.push(box(pfx + k, `${nm} ${bits}`, x + w / 2, y, w - 4, st, 34));
        x += w;
      });
    };
    row("a", 70, [["tag", 18, "active"], ["index", 10, "compare"], ["offset", 4, "found"]], "16 KiB、區塊 16 B、直接映射（1024 個 set）");
    row("b", 170, [["tag", 20, "active"], ["index", 8, "compare"], ["offset", 4, "found"]], "16 KiB、區塊 16 B、4-way（256 個 set）");
    labels.push(
      { id: "e1", x: X0 + 10 * PX, y: 222, text: "和 set 裡每一格的 tag 比對", anchor: "middle" },
      { id: "e2", x: X0 + 24 * PX, y: 222, text: "選 set", anchor: "middle" },
      { id: "e3", x: X0 + 28 * PX + 50, y: 222, text: "區塊內第幾個 byte", anchor: "middle" },
      { id: "e4", x: 340, y: 248, text: "每多一倍關聯度：set 少一半 → index 少 1 位元 → tag 多 1 位元", cls: "warn" });
    return { width: 680, height: 262, nodes, labels, edges: [] };
  });

  // 圖 2：同樣 8 個區塊的三種組織方式，記憶體區塊 12 可以放在哪裡
  figure("cache-mapping-compare", () => {
    const nodes = [], labels = [];
    for (let s = 0; s < 8; s++) {
      nodes.push(box("a" + s, s === 4 ? "12" : "", 130, 66 + s * 30, 56, s === 4 ? "compare" : "ghost", 24));
      labels.push({ id: "as" + s, x: 82, y: 71 + s * 30, text: "set " + s, anchor: "end" });
    }
    for (let s = 0; s < 4; s++) {
      labels.push({ id: "bs" + s, x: 290, y: 85 + s * 60, text: "set " + s, anchor: "end" });
      for (let w = 0; w < 2; w++) nodes.push(box(`b${s}_${w}`, s === 0 ? "12?" : "", 330 + w * 64, 80 + s * 60, 56, s === 0 ? "compare" : "ghost", 24));
    }
    for (let w = 0; w < 8; w++) nodes.push(box("c" + w, "12?", 590, 66 + w * 30, 56, "compare", 24));
    labels.push({ id: "cs", x: 548, y: 176, text: "set 0", anchor: "end" });
    labels.push(
      { id: "ta", x: 110, y: 30, text: "(a) 直接映射", cls: "strong" },
      { id: "tb", x: 362, y: 30, text: "(b) 2-way", cls: "strong" },
      { id: "tc", x: 570, y: 30, text: "(c) 全關聯", cls: "strong" },
      { id: "ua", x: 110, y: 318, text: "12 mod 8 = 4：只有 1 格" },
      { id: "ub", x: 362, y: 318, text: "12 mod 4 = 0：2 格擇一" },
      { id: "uc", x: 570, y: 318, text: "只有 1 個 set：8 格都行" });
    return { width: 680, height: 336, nodes, labels, edges: [] };
  });
})();
