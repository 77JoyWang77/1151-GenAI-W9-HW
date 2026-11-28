/* =====================================================================
   Multiprocessors and GPUs（多處理器與 GPU）主題的圖與動畫
   - mp-race : 共享變數的交錯執行：自己寫各核心的運算（a += 1、a = 2…）和執行順序，
               一條一條看 load / store 怎麼互相插隊；可以加鎖（每個運算不可分割），也可以窮舉所有可能結果
   - mp-msi  : snooping 快取一致性：輸入一串 Pn R/W X/Y，逐步看各快取的 MSI / MESI 狀態、
               bus 交易、invalidate 與寫回；X、Y 在同一個 block，可以看到 false sharing
   - 靜態圖：UMA 與 NUMA、強弱擴展、false sharing、warp divergence、互連拓撲
   ===================================================================== */
(function () {
  "use strict";
  const { Player, Recorder, ui, register, esc, iconHTML, figure } = window.DSViz;

  // 行號用內容找：先找整行完全相同的，再找包含的
  const finder = (code) => (s) => {
    let i = code.findIndex((l) => l.trim() === s.trim());
    if (i < 0) i = code.findIndex((l) => l.includes(s));
    if (i < 0) throw new Error("找不到程式碼：" + s);
    return i + 1;
  };
  const bad = (player, el, msg) => {
    if (el) { el.classList.add("is-error"); setTimeout(() => el.classList.remove("is-error"), 700); }
    player.load([{ caption: iconHTML("alert") + " " + msg }], { autoplay: false });
  };

  /* =================================================================
     mp-race：共享變數的交錯執行
     ================================================================= */
  // 右側程式碼：從 code/computer-organization/multiprocessors.c 原封不動取出
  const RACE_CODE = [
    "void step(Core *c) {",
    "  Inst in = c->prog[c->pc];",
    "  switch (in.op) {",
    "    case LOAD:   c->reg = mem[in.var]; break;      /* 讀共享記憶體到自己的暫存器 */",
    "    case ADDI:   c->reg = c->reg + in.k; break;    /* 只改自己的暫存器 */",
    "    case MULI:   c->reg = c->reg * in.k; break;",
    "    case STORE:  mem[in.var] = c->reg; break;      /* 寫回共享記憶體，別人才看得到 */",
    "    case STOREI: mem[in.var] = in.k; break;",
    "  }",
    "  c->pc++;",
    "}",
    "",
    "/* 加鎖（原子）時：一次把整個高階運算做完，中間不讓別人插隊 */",
    "void runOp(Core *c) {",
    "  do step(c); while (c->pc < c->len && !c->prog[c->pc].first);",
    "}"
  ];
  const rl = finder(RACE_CODE);
  const RL = {
    LOAD: rl("case LOAD:"), ADDI: rl("case ADDI:"), MULI: rl("case MULI:"),
    STORE: rl("case STORE:"), STOREI: rl("case STOREI:"), pc: rl("c->pc++;"), op: rl("do step(c); while"),
  };
  const VN = ["a", "b"];

  // "a += 1; b = 2; a *= 3; a++" → 運算串列
  function parseProg(s) {
    const t = s.trim();
    if (!t) return [];
    const ops = [];
    for (const part of t.split(/[;；]/)) {
      const p = part.replace(/\s+/g, "");
      if (!p) continue;
      let m = p.match(/^([ab])(\+\+|--)$/);
      if (m) { ops.push({ kind: "add", v: VN.indexOf(m[1]), k: m[2] === "++" ? 1 : -1 }); continue; }
      m = p.match(/^([ab])(\+=|-=|\*=|=)(-?\d{1,2})$/);
      if (!m) return { error: `看不懂「${esc(part.trim())}」：只能寫 a++、a += 2、a -= 1、a *= 2、a = 5（變數 a 或 b，常數 -99～99）` };
      const v = VN.indexOf(m[1]), k = +m[3];
      if (m[2] === "=") ops.push({ kind: "set", v, k });
      else if (m[2] === "*=") ops.push({ kind: "mul", v, k });
      else ops.push({ kind: "add", v, k: m[2] === "-=" ? -k : k });
    }
    if (ops.length > 3) return { error: "每個核心最多 3 個運算（畫面放不下），請刪減" };
    return ops;
  }
  const opText = (o) => o.kind === "set" ? `${VN[o.v]} = ${o.k}` : o.kind === "mul" ? `${VN[o.v]} *= ${o.k}` : o.k >= 0 ? `${VN[o.v]} += ${o.k}` : `${VN[o.v]} -= ${-o.k}`;
  // 一個高階運算編成幾條指令（和 C 程式的 opAdd / opMul / opSet 一樣）
  function compile(ops) {
    const ins = [];
    ops.forEach((o, j) => {
      const v = VN[o.v];
      if (o.kind === "set") { ins.push({ op: "STOREI", v: o.v, k: o.k, first: 1, opi: j, text: `store ${o.k}, ${v}` }); return; }
      ins.push({ op: "LOAD", v: o.v, first: 1, opi: j, text: `load r, ${v}` });
      ins.push(o.kind === "mul" ? { op: "MULI", k: o.k, opi: j, text: `mul r, r, ${o.k}` } : { op: "ADDI", k: o.k, opi: j, text: `addi r, r, ${o.k}` });
      ins.push({ op: "STORE", v: o.v, opi: j, text: `store r, ${v}` });
    });
    return ins;
  }
  // 執行一條指令（和 C 程式的 step() 一樣）
  function exec(c, mem) {
    const x = c.prog[c.pc];
    if (x.op === "LOAD") c.reg = mem[x.v];
    else if (x.op === "ADDI") c.reg = c.reg + x.k;
    else if (x.op === "MULI") c.reg = c.reg * x.k;
    else if (x.op === "STORE") mem[x.v] = c.reg;
    else mem[x.v] = x.k;
    c.pc++;
    return x;
  }
  const opEnd = (c) => c.pc >= c.prog.length || c.prog[c.pc].first;   // 下一條是新運算的開頭
  const fact = (n) => { let r = 1; for (let i = 2; i <= n; i++) r *= i; return r; };

  // 窮舉所有交錯（和 C 程式的 explore() 一樣），記下每種結果的一個例子
  function enumerate(progs, init, atomic) {
    const cs = progs.map((p) => ({ prog: p, pc: 0, reg: null }));
    const mem = init.slice(), seen = new Map(), path = [];
    let count = 0;
    (function rec() {
      let moved = false;
      for (let i = 0; i < cs.length; i++) {
        const c = cs[i];
        if (c.pc >= c.prog.length) continue;
        const saved = { pc: c.pc, reg: c.reg }, m = mem.slice();
        if (atomic) { do exec(c, mem); while (!opEnd(c)); } else exec(c, mem);
        path.push(i); rec(); path.pop();
        c.pc = saved.pc; c.reg = saved.reg; mem[0] = m[0]; mem[1] = m[1];
        moved = true;
      }
      if (!moved) {
        count++;
        const key = mem[0] + "," + mem[1];
        if (!seen.has(key)) seen.set(key, { a: mem[0], b: mem[1], ex: path.join("") });
      }
    })();
    const list = [...seen.values()].sort((x, y) => x.a - y.a || x.b - y.b);
    return { list, count };
  }
  const units = (progs, atomic) => progs.map((p) => (atomic ? p.filter((x) => x.first).length : p.length));
  const ways = (u) => fact(u.reduce((s, x) => s + x, 0)) / u.reduce((s, x) => s * fact(x), 1);

  register("mp-race", function (root) {
    const player = new Player(root, {
      title: "Shared Variable Interleaving 共享變數的交錯執行",
      width: 680, height: 410, code: RACE_CODE, wide: true,
      legend: [["active", "正在執行"], ["visited", "已執行"], ["compare", "被讀取"], ["new", "剛被寫入"], ["muted", "加鎖時：別人正持有鎖"]],
    });

    let progs = [], ops = [], init = [0, 0], atomic = false;

    function frame(cs, mem, caption, line, opt = {}) {
      const n = cs.length, colW = 680 / n, nodes = [], edges = [], labels = [];
      const boxW = n === 3 ? 118 : 150;
      cs.forEach((c, i) => {
        const cx = colW * i + colW / 2 + 18;
        labels.push({ id: "t" + i, x: cx, y: 22, text: "P" + i + (opt.lockBy === i ? "（持有鎖）" : ""), cls: "title" });
        nodes.push({ id: "r" + i, label: "r = " + (c.reg == null ? "?" : c.reg), shape: "box", x: cx, y: 54, w: 90, h: 28,
          state: opt.reg === i ? "active" : "default" });
        c.prog.forEach((x, k) => {
          const y = 98 + k * 26;
          let st = k < c.pc ? "visited" : "default";
          if (opt.cur && opt.cur[0] === i && opt.cur[1] === k) st = "active";
          else if (opt.lockBy != null && opt.lockBy !== i && k >= c.pc) st = "muted";
          nodes.push({ id: `i${i}_${k}`, label: x.text, shape: "box", x: cx, y, w: boxW, h: 22, state: st });
          if (x.first) labels.push({ id: `o${i}_${k}`, x: cx - boxW / 2 - 6, y, text: opText(ops[i][x.opi]), anchor: "end" });
        });
      });
      // 共享記憶體：放在最長的指令串下面
      const maxLen = Math.max(...cs.map((c) => c.prog.length));
      const memY = 98 + maxLen * 26 + 46;
      labels.push({ id: "memt", x: 340, y: memY - 32, text: "共享記憶體", cls: "title" });
      [0, 1].forEach((v) => {
        nodes.push({ id: "m" + v, label: `${VN[v]} = ${mem[v]}`, shape: "box", x: 270 + v * 140, y: memY, w: 110, h: 32,
          state: opt.memW === v ? "new" : opt.memR === v ? "compare" : "default" });
      });
      if (opt.cur && opt.memR != null) edges.push({ from: "m" + opt.memR, to: `i${opt.cur[0]}_${opt.cur[1]}`, directed: true, state: "compare" });
      if (opt.cur && opt.memW != null) edges.push({ from: `i${opt.cur[0]}_${opt.cur[1]}`, to: "m" + opt.memW, directed: true, state: "active" });
      return { nodes, edges, labels, caption, line };
    }

    function describe(i, x, c, mem, before) {
      const v = VN[x.v];
      if (x.op === "LOAD") return `P${i} <b>load</b>：把共享記憶體的 ${v} = ${mem[x.v]} 讀進自己的暫存器 r。之後別人再改 ${v}，P${i} 手上的 r 也不會跟著變。`;
      if (x.op === "ADDI") return `P${i} 在自己的暫存器裡算 r = ${before} ${x.k >= 0 ? "+ " + x.k : "− " + -x.k} = ${c.reg}。這一步<b>只改暫存器</b>，共享記憶體還看不到新值。`;
      if (x.op === "MULI") return `P${i} 在自己的暫存器裡算 r = ${before} × ${x.k} = ${c.reg}。這一步只改暫存器，共享記憶體還看不到新值。`;
      if (x.op === "STORE") return `P${i} <b>store</b>：把 r = ${c.reg} 寫回 ${v}。如果在它 load 之後有別人先寫過 ${v}，那次寫入就被這裡<b>蓋掉</b>了。`;
      return `P${i} 直接把常數 ${x.k} 寫進 ${v}（不用先讀），之前誰寫的值都被蓋掉。`;
    }

    function run(sched) {
      const cs = progs.map((p) => ({ prog: p, pc: 0, reg: null }));
      player.resize(680, 98 + Math.max(...progs.map((p) => p.length)) * 26 + 72);
      const mem = init.slice(), r = new Recorder();
      const order = [];
      r.push(frame(cs, mem, `初始：a = ${mem[0]}、b = ${mem[1]}。每個 <code>a += k</code> 在機器層級是 load、運算、store 三條指令；${atomic ? "<b>已加鎖</b>：一個核心開始一個運算後，要做完三條才放開鎖，別人不能插進來。" : "沒有加鎖，任何兩條指令之間都可能換成別的核心執行。"}`, null));
      const doUnit = (i, note) => {
        const c = cs[i];
        const lockBy = atomic ? i : null;
        do {
          const k = c.pc, before = c.reg, x = exec(c, mem);
          order.push(i);
          const line = atomic ? [RL[x.op], RL.op] : [RL[x.op], RL.pc];
          r.push(frame(cs, mem, (note || "") + describe(i, x, c, mem, before), line,
            { cur: [i, k], reg: x.op === "LOAD" || x.op === "ADDI" || x.op === "MULI" ? i : null,
              memR: x.op === "LOAD" ? x.v : null, memW: x.op === "STORE" || x.op === "STOREI" ? x.v : null,
              lockBy: atomic && !opEnd(c) ? lockBy : null }));
          note = "";
        } while (atomic && !opEnd(c));
      };
      for (const i of sched) {
        if (i >= cs.length) return bad(player, inS, `順序裡的 ${i} 不存在：目前只有 P0～P${cs.length - 1}`);
        if (cs[i].pc >= cs[i].prog.length) return bad(player, inS, `P${i} 已經做完了，順序裡卻還有它。每個核心${atomic ? "的運算數" : "的指令數"}：${units(progs, atomic).map((u, k) => "P" + k + " " + u).join("、")}`);
        doUnit(i);
      }
      let first = true;
      cs.forEach((c, i) => {
        while (c.pc < c.prog.length) { doUnit(i, first ? "（指定的順序用完了，剩下的照 P0、P1、P2 依序做完）" : ""); first = false; }
      });
      // 和「每次做完一整個運算」的結果比較，看有沒有遺失更新
      const ok = enumerate(progs, init, true).list;
      const hit = ok.some((o) => o.a === mem[0] && o.b === mem[1]);
      r.push(frame(cs, mem, `全部做完：<b>a = ${mem[0]}、b = ${mem[1]}</b>。實際的指令順序是 ${order.map((i) => "P" + i).join(" ")}。` +
        (hit ? "這個結果在「每次做完一整個運算」的某種順序下也會出現，是合法的序列化結果。"
             : `<b>這個結果在任何「一次做完一個運算」的順序下都不會出現</b>：有核心讀到舊值後被別人插隊，自己再寫回時把別人的更新蓋掉了（lost update，遺失更新）。加鎖後只可能是 ${ok.map((o) => `(${o.a}, ${o.b})`).join("、")}。`), null));
      return r.frames;
    }

    function listAll() {
      const u = units(progs, atomic), total = ways(u);
      if (total > 300000) return bad(player, null, `交錯方式有 ${Math.round(total).toLocaleString()} 種，太多了，請減少運算（每多一條指令，數量會成倍增加）`);
      const { list, count } = enumerate(progs, init, atomic);
      const ser = atomic ? null : enumerate(progs, init, true).list;
      const labels = [{ id: "h", x: 24, y: 24, text: `${atomic ? "加鎖" : "不加鎖"}：${count} 種交錯，最後 (a, b) 共 ${list.length} 種`, cls: "title", anchor: "start" }];
      const show = list.slice(0, 24);
      show.forEach((o, k) => {
        const col = Math.floor(k / 12), row = k % 12;
        const lost = ser && !ser.some((s) => s.a === o.a && s.b === o.b);
        labels.push({ id: "v" + k, x: 24 + col * 340, y: 58 + row * 27, text: `a = ${o.a}, b = ${o.b}`, cls: lost ? "warn" : "", anchor: "start" });
        labels.push({ id: "e" + k, x: 128 + col * 340, y: 58 + row * 27, text: (lost ? "遺失更新，例：" : "例：") + o.ex, cls: lost ? "warn" : "", anchor: "start" });
      });
      if (list.length > show.length) labels.push({ id: "more", x: 24, y: 390, text: `……還有 ${list.length - show.length} 種沒有列出`, anchor: "start" });
      const cap = `窮舉每個時間點「下一條由誰執行」的所有選法（共 ${count} 種），得到 ${list.length} 種不同結果。` +
        (atomic ? "加鎖後每個運算不可分割，只剩下運算之間的先後順序會影響結果。"
                : `紅字是<b>遺失更新</b>才會出現的結果；加鎖後只會剩 ${ser.length} 種。`) +
        `「例」是能得到這個結果的一種順序（每個數字是一個${atomic ? "運算" : "指令"}由哪個核心執行），把它貼到「順序」欄按「執行」可以一步一步重播。`;
      player.resize(680, 410);
      player.load([{ nodes: [], edges: [], labels, caption: cap, line: null }], { autoplay: false });
    }

    const inP = [0, 1, 2].map((i) => ui.input(player, { placeholder: `P${i} 的運算${i === 2 ? "（可空白）" : ""}`, value: "", width: 128 }));
    const inI = ui.input(player, { placeholder: "a b 初值", value: "0 0", width: 64 });
    const inS = ui.input(player, { placeholder: "順序，例如 0 1 1 0（空白 = 依序）", value: "", width: 210 });
    const btnLock = ui.button(player, "加鎖：關", () => { atomic = !atomic; btnLock.textContent = "加鎖：" + (atomic ? "開" : "關"); }, "ghost");

    function readAll() {
      progs = []; ops = [];
      for (let i = 0; i < 3; i++) {
        const o = parseProg(inP[i].value);
        if (o.error) { bad(player, inP[i], `P${i}：${o.error}`); return false; }
        if (!o.length) { if (i < 2) { bad(player, inP[i], `P${i} 至少要有一個運算`); return false; } continue; }
        ops.push(o); progs.push(compile(o));
      }
      const iv = inI.value.trim().split(/[\s,，]+/).map(Number);
      if (iv.length !== 2 || iv.some((x) => !Number.isInteger(x) || Math.abs(x) > 99)) { bad(player, inI, "初值要寫兩個 -99～99 的整數，例如「0 0」代表 a = 0、b = 0"); return false; }
      init = iv;
      return true;
    }
    function readSched() {
      const s = inS.value.trim();
      if (!s) return [];
      const t = s.replace(/[Pp]/g, "").split(/[\s,，]+/).join("");
      if (!/^[0-9]+$/.test(t)) { bad(player, inS, "順序只能寫核心編號，例如「0 1 1 0」或「0110」"); return null; }
      if (t.length > 40) { bad(player, inS, "順序太長（最多 40 步）"); return null; }
      return [...t].map(Number);
    }
    ui.button(player, "執行", () => {
      if (!readAll()) return;
      const s = readSched();
      if (s === null) return;
      const f = run(s);
      if (f) player.load(f);
    });
    ui.button(player, "列舉所有結果", () => { if (readAll()) listAll(); }, "ghost");

    const preset = (p0, p1, p2, iv, order, lock) => () => {
      inP[0].value = p0; inP[1].value = p1; inP[2].value = p2; inI.value = iv; inS.value = order;
      atomic = lock; btnLock.textContent = "加鎖：" + (atomic ? "開" : "關");
      if (!readAll()) return;
      const s = readSched();
      if (s === null) return;
      const f = run(s);
      if (f) player.load(f);
    };
    ui.button(player, "遺失更新", preset("a += 1", "a *= 2", "", "1 0", "0 1 0 1 0 1", false), "ghost");
    ui.button(player, "a++ ‖ a = 2", preset("a++; b++", "a = 2; b += 2", "", "0 0", "0 0 1 0 1 1 1 0 0 0", false), "ghost");
    ui.button(player, "三核心", preset("a = 4; a += 4", "a += 1; a *= 2", "a = 6; a *= 2", "0 0", "", false), "ghost");

    inP[0].value = "a += 1"; inP[1].value = "a *= 2"; inI.value = "1 0"; inS.value = "0 1 0 1 0 1";
    readAll();
    const demo = run(readSched());
    demo[0].caption = iconHTML("play") + " 按播放看示範：P0 做 a += 1、P1 做 a *= 2（a 初值 1），兩個核心的 load、運算、store 交錯執行。" + demo[0].caption.replace(/^初始：/, "<br>初始：");
    player.load(demo, { autoplay: false });
  });

  /* =================================================================
     mp-msi：snooping 快取一致性（MSI / MESI）
     ================================================================= */
  const MSI_CODE = [
    "void access(int p, int isWrite) {",
    "  int others = 0;                                    /* 其他快取有沒有副本 */",
    "  for (int q = 0; q < nproc; q++) if (q != p && state[q] != I) others = 1;",
    "  if (!isWrite) {                                    /* ---- 讀 ---- */",
    "    if (state[p] != I) return;                       /* S、E、M 都是 read hit */",
    "    busTx++; misses++;                               /* read miss：送出 BusRd */",
    "    for (int q = 0; q < nproc; q++) {",
    "      if (q == p) continue;",
    "      if (state[q] == M) { flushes++; state[q] = S; } /* 有最新值的寫回，降成 S */",
    "      else if (state[q] == E) state[q] = S;",
    "    }",
    "    state[p] = (useMESI && !others) ? E : S;         /* MESI：沒人有副本就拿 E */",
    "    return;",
    "  }",
    "  /* ---- 寫 ---- */",
    "  if (state[p] == M) return;                         /* write hit，不必通知別人 */",
    "  if (state[p] == E) { state[p] = M; return; }       /* 獨占：悄悄升成 M，不上 bus */",
    "  busTx++;                                           /* S：BusUpgr；I：BusRdX */",
    "  if (state[p] == I) misses++;",
    "  for (int q = 0; q < nproc; q++) {",
    "    if (q == p || state[q] == I) continue;",
    "    if (state[q] == M) flushes++;                    /* 最新值先寫回 */",
    "    state[q] = I;                                    /* 其他副本全部作廢 */",
    "    invals++;",
    "  }",
    "  state[p] = M;",
    "}"
  ];
  const ml = finder(MSI_CODE);
  const ML = {
    others: [ml("int others = 0;"), ml("for (int q = 0; q < nproc; q++) if (q != p && state[q] != I) others = 1;")],
    rHit: ml("if (state[p] != I) return;"),
    rMiss: ml("busTx++; misses++;"),
    rSnoop: [ml("if (state[q] == M) { flushes++; state[q] = S; }"), ml("else if (state[q] == E) state[q] = S;")],
    rSet: ml("state[p] = (useMESI && !others) ? E : S;"),
    wM: ml("if (state[p] == M) return;"),
    wE: ml("if (state[p] == E) { state[p] = M; return; }"),
    wBus: [ml("S：BusUpgr"), ml("if (state[p] == I) misses++;")],
    wInv: [ml("if (state[q] == M) flushes++;"), ml("state[q] = I;"), ml("invals++;")],
    wSet: ml("state[p] = M;"),
  };
  const ST = { I: "ghost", S: "compare", E: "new", M: "active" };

  register("mp-msi", function (root) {
    const player = new Player(root, {
      title: "Snooping Coherence MSI / MESI 快取一致性",
      width: 680, height: 390, code: MSI_CODE, wide: true,
      legend: [["active", "M：已修改（唯一的最新值）"], ["new", "E：獨占、乾淨"], ["compare", "S：共享、乾淨"], ["ghost", "I：無效"], ["removed", "這一步被作廢"]],
    });
    let mesi = false;

    function run(trace, n) {
      const st = Array(n).fill("I"), val = Array.from({ length: n }, () => [0, 0]), used = Array.from({ length: n }, () => new Set());
      const mem = [0, 0];
      let next = 1, bus = 0, inv = 0, fl = 0, miss = 0;
      const r = new Recorder();
      const colX = (i) => 680 / n * (i + 0.5);
      const F = (caption, line, o = {}) => {
        const nodes = [], edges = [], labels = [];
        labels.push({ id: "proto", x: 16, y: 16, text: `${mesi ? "MESI" : "MSI"} · ${n} 個核心 · X、Y 在同一個 block`, cls: "title", anchor: "start" });
        labels.push({ id: "cnt", x: 664, y: 16, text: `bus 交易 ${bus} · miss ${miss} · invalidate ${inv} · 寫回 ${fl}`, cls: "title", anchor: "end" });
        for (let i = 0; i < n; i++) {
          nodes.push({ id: "p" + i, label: "P" + i, shape: "box", x: colX(i), y: 50, w: 64, h: 28, state: o.req === i ? "active" : "default" });
          const s = o.st && o.st[i] ? o.st[i] : ST[st[i]];
          nodes.push({ id: "c" + i, label: st[i] === "I" ? "I" : `${st[i]} · X=${val[i][0]} Y=${val[i][1]}`, shape: "box", x: colX(i), y: 112, w: 136, h: 38, state: s });
          nodes.push({ id: "tap" + i, label: "", shape: "circle", r: 3, x: colX(i), y: 206, state: "muted" });
          edges.push({ from: "p" + i, to: "c" + i, state: o.req === i ? "active" : "default" });
          edges.push({ from: "c" + i, to: "tap" + i, state: o.snoop && o.snoop.includes(i) ? "removed" : o.react && o.react.includes(i) ? "visited" : o.req === i && o.tx ? "active" : "muted" });
        }
        nodes.push({ id: "bl", label: "", shape: "circle", r: 3, x: 24, y: 206, state: "muted" });
        nodes.push({ id: "br", label: "", shape: "circle", r: 3, x: 656, y: 206, state: "muted" });
        nodes.push({ id: "bm", label: "", shape: "circle", r: 3, x: 340, y: 206, state: "muted" });
        edges.push({ from: "bl", to: "bm", state: o.tx ? "active" : "default" });
        edges.push({ from: "bm", to: "br", state: o.tx ? "active" : "default" });
        labels.push({ id: "busname", x: 24, y: 192, text: "bus", cls: "title", anchor: "start" });
        if (o.tx) labels.push({ id: "tx", x: 340, y: 228, text: o.tx, cls: "strong" });
        const stale = st.some((s) => s === "M");
        nodes.push({ id: "mem", label: `記憶體  X=${mem[0]}  Y=${mem[1]}`, shape: "box", x: 340, y: 282, w: 230, h: 36, state: o.memW ? "new" : stale ? "muted" : "default",
          sub: stale ? `過期：最新值在 P${st.indexOf("M")} 的快取` : "和快取一致" });
        edges.push({ from: "bm", to: "mem", state: o.memW ? "new" : "default" });
        trace.forEach((t, k) => {
          nodes.push({ id: "t" + k, label: `${t.w ? "W" : "R"} ${"XY"[t.v]}`, sub: "P" + t.p, shape: "box", x: 40 + k * 54, y: 344, w: 48, h: 24,
            state: k === o.cur ? "active" : k < (o.cur == null ? trace.length : o.cur) ? "visited" : "default" });
        });
        return { nodes, edges, labels, caption, line };
      };
      r.push(F(`一開始所有快取都是 I（沒有資料），X、Y 都是 0。這裡只追蹤<b>一個 block</b>，它同時裝著 X 和 Y 兩個 word；${mesi ? "MESI 比 MSI 多一個 E（獨占、乾淨）狀態。" : "MSI 每個 block 只有 M、S、I 三種狀態。"}所有快取都在 bus 上<b>監聽（snoop）</b>別人的交易。`, null, { cur: 0 }));

      trace.forEach((t, k) => {
        const p = t.p, X = "XY"[t.v], who = `P${p} ${t.w ? "寫" : "讀"} ${X}`;
        const others = st.some((s, q) => q !== p && s !== "I");
        used[p].add(t.v);
        if (!t.w) {
          if (st[p] !== "I") {
            r.push(F(`${who}：自己的狀態是 ${st[p]}，資料有效 → <b>read hit</b>，直接從自己的快取讀到 ${X} = ${val[p][t.v]}，不用上 bus，別人也不會知道。`, ML.rHit, { req: p, cur: k }));
            return;
          }
          bus++; miss++;
          r.push(F(`${who}：自己是 I → <b>read miss</b>，在 bus 上送出 <b>BusRd</b>（我要讀這個 block），其他快取都會看到。`, ML.rMiss, { req: p, cur: k, tx: `BusRd ← P${p}` }));
          const mq = st.findIndex((s, q) => q !== p && s === "M"), eq = st.findIndex((s, q) => q !== p && s === "E");
          if (mq >= 0) {
            fl++; mem[0] = val[mq][0]; mem[1] = val[mq][1]; st[mq] = "S";
            r.push(F(`P${mq} 監聽到 BusRd，而它是 <b>M</b>（記憶體裡是舊值）：把整個 block <b>寫回（flush）</b>記憶體並提供資料，自己降成 <b>S</b>，因為馬上就會有別人也持有副本。`, ML.rSnoop, { req: p, cur: k, tx: `flush ← P${mq}`, memW: true, react: [mq] }));
          } else if (eq >= 0) {
            st[eq] = "S";
            r.push(F(`P${eq} 監聽到 BusRd，它是 <b>E</b>（獨占但乾淨，記憶體也是最新的）：不用寫回，只要降成 <b>S</b>。`, ML.rSnoop, { req: p, cur: k, tx: `BusRd ← P${p}`, react: [eq] }));
          }
          val[p] = mem.slice();
          st[p] = mesi && !others ? "E" : "S";
          r.push(F(`P${p} 拿到 block，${X} = ${val[p][t.v]}。` + (st[p] === "E" ? "MESI：沒有別的快取有副本，所以拿到 <b>E</b>，之後寫入不用再上 bus。" : others ? "別的快取也有副本，所以是 <b>S</b>（共享）。" : "MSI 沒有 E，就算只有自己一份也是 <b>S</b>。"), ML.rSet, { req: p, cur: k }));
          return;
        }
        // 寫
        if (st[p] === "M") {
          val[p][t.v] = next++;
          r.push(F(`${who}：自己已經是 <b>M</b>（唯一的副本）→ <b>write hit</b>，直接改成 ${X} = ${val[p][t.v]}，不用通知任何人。`, ML.wM, { req: p, cur: k }));
          return;
        }
        if (st[p] === "E") {
          st[p] = "M"; val[p][t.v] = next++;
          r.push(F(`${who}：自己是 <b>E</b>，確定沒有別人有副本 → 不必上 bus，直接悄悄升成 <b>M</b>，${X} = ${val[p][t.v]}。這就是 MESI 比 MSI 省一次 bus 交易的地方。`, ML.wE, { req: p, cur: k }));
          return;
        }
        bus++;
        const wasI = st[p] === "I";
        if (wasI) miss++;
        const tx = wasI ? "BusRdX" : "BusUpgr";
        r.push(F(`${who}：自己是 ${st[p]}，` + (wasI ? `沒有資料 → <b>write miss</b>，送出 <b>BusRdX</b>（讀這個 block，並要求獨占）。` : `有資料但是共享的 → 不能直接寫，送出 <b>BusUpgr</b>（invalidate：請其他人把副本作廢）。`), ML.wBus, { req: p, cur: k, tx: `${tx} ← P${p}` }));
        const victims = [];
        let flushed = -1;
        st.forEach((s, q) => {
          if (q === p || s === "I") return;
          if (s === "M") { fl++; flushed = q; mem[0] = val[q][0]; mem[1] = val[q][1]; }
          victims.push(q); inv++;
        });
        if (victims.length) {
          const stMap = {};
          victims.forEach((q) => (stMap[q] = "removed"));
          const fsq = victims.filter((q) => !used[q].has(t.v));
          const fs = fsq.length ? `<br><b>false sharing</b>：${fsq.map((q) => "P" + q).join("、")} 只用過 ${"XY"[1 - t.v]}，根本沒碰 ${X}，但 X、Y 在同一個 block，還是整個被作廢。` : "";
          r.push(F(`${victims.map((q) => "P" + q).join("、")} 監聽到 ${tx}，把自己的副本改成 <b>I</b>（作廢）。` + (flushed >= 0 ? `P${flushed} 原本是 M，作廢前先把最新值寫回記憶體。` : "") + fs, ML.wInv, { req: p, cur: k, tx: `${tx} ← P${p}`, st: stMap, snoop: victims, memW: flushed >= 0 }));
          victims.forEach((q) => (st[q] = "I"));
        } else {
          r.push(F(`沒有其他快取有副本，不用作廢任何人。`, ML.wInv, { req: p, cur: k, tx: `${tx} ← P${p}` }));
        }
        if (wasI) val[p] = mem.slice();
        st[p] = "M"; val[p][t.v] = next++;
        r.push(F(`P${p} 變成 <b>M</b>，寫入 ${X} = ${val[p][t.v]}。現在它是唯一的有效副本，記憶體裡的是舊值（write-back）。`, ML.wSet, { req: p, cur: k }));
      });
      r.push(F(`全部做完：bus 交易 <b>${bus}</b> 次（其中 miss ${miss} 次）、invalidate <b>${inv}</b> 次、寫回 <b>${fl}</b> 次。最後狀態 ${st.map((s, i) => `P${i} = ${s}`).join("、")}。${mesi ? "切換成 MSI 比比看 bus 交易數。" : "切換成 MESI 比比看：只有一個人讀過的 block 之後寫入時，MESI 可以省下一次 BusUpgr。"}`, null, {}));
      return r.frames;
    }

    const inT = ui.input(player, { placeholder: "例如 P0 R X, P1 W Y", value: "P0 R X, P1 R X, P1 W X, P2 R X, P0 W X", width: 270 });
    const inN = ui.input(player, { placeholder: "核心數", value: "3", width: 56 });
    const btnP = ui.button(player, "協定：MSI", () => { mesi = !mesi; btnP.textContent = "協定：" + (mesi ? "MESI" : "MSI"); go(); }, "ghost");

    function parse() {
      const n = ui.int(inN, { min: 2, max: 4 });
      if (n === null) { bad(player, inN, "核心數要是 2～4"); return null; }
      const toks = inT.value.split(/[,，;；]+/).map((s) => s.trim()).filter(Boolean);
      if (!toks.length) { bad(player, inT, "請輸入存取序列，例如「P0 R X, P1 W X」"); return null; }
      if (toks.length > 11) { bad(player, inT, `最多 11 個存取（畫面放不下），目前有 ${toks.length} 個`); return null; }
      const trace = [];
      for (const s of toks) {
        const m = s.match(/^P?\s*(\d)\s*[:：]?\s*([RWrw])\s*([XYxy])?$/);
        if (!m) { bad(player, inT, `看不懂「${esc(s)}」：每個存取寫成「P0 R X」（核心、R 讀或 W 寫、變數 X 或 Y，變數可省略＝X）`); return null; }
        const p = +m[1];
        if (p >= n) { bad(player, inT, `「${esc(s)}」用到 P${p}，但只有 ${n} 個核心（P0～P${n - 1}）`); return null; }
        trace.push({ p, w: /w/i.test(m[2]), v: m[3] && /y/i.test(m[3]) ? 1 : 0 });
      }
      return { trace, n };
    }
    function go(autoplay = true) {
      const x = parse();
      if (x) player.load(run(x.trace, x.n), { autoplay });
    }
    ui.button(player, "執行", () => go());
    const preset = (t, n, m) => () => { inT.value = t; inN.value = String(n); mesi = m; btnP.textContent = "協定：" + (mesi ? "MESI" : "MSI"); go(); };
    ui.button(player, "教學例", preset("P0 R X, P1 R X, P1 W X, P2 R X, P0 W X", 3, false), "ghost");
    ui.button(player, "MESI 的 E", preset("P0 R X, P0 W X, P1 R X, P1 W X, P0 R X", 2, true), "ghost");
    ui.button(player, "false sharing", preset("P0 W X, P1 W Y, P0 W X, P1 W Y, P0 W X, P1 W Y", 2, false), "ghost");

    const x = parse();
    const demo = run(x.trace, x.n);
    demo[0].caption = iconHTML("play") + " 按播放看示範：三個核心輪流讀寫 X。" + demo[0].caption;
    player.load(demo, { autoplay: false });
  });

  /* =================================================================
     靜態圖
     ================================================================= */
  const box = (id, label, x, y, w, h, state, sub) => ({ id, label, shape: "box", x, y, w, h: h || 34, state: state || "default", sub });
  const dot = (id, x, y) => ({ id, label: "", shape: "circle", r: 3, x, y, state: "muted" });

  // UMA（SMP）與 NUMA
  figure("mp-uma-numa", () => {
    const nodes = [], edges = [], labels = [];
    labels.push({ id: "ta", x: 170, y: 20, text: "(a) UMA / SMP：所有核心共用一個記憶體", cls: "title" });
    labels.push({ id: "tb", x: 520, y: 20, text: "(b) NUMA：記憶體分散在各節點", cls: "title" });
    for (let i = 0; i < 4; i++) {
      const x = 50 + i * 80;
      nodes.push(box("ap" + i, "P" + i, x, 62, 56, 30, "compare"));
      nodes.push(box("ac" + i, "cache", x, 112, 56, 28, "default"));
      nodes.push(dot("at" + i, x, 162));
      edges.push({ from: "ap" + i, to: "ac" + i }, { from: "ac" + i, to: "at" + i });
    }
    nodes.push(dot("al", 22, 162), dot("ar", 318, 162), dot("am", 170, 162));
    edges.push({ from: "al", to: "am", state: "active" }, { from: "am", to: "ar", state: "active" });
    labels.push({ id: "abus", x: 22, y: 150, text: "bus", anchor: "start", cls: "title" });
    nodes.push(box("amem", "共享記憶體", 170, 214, 170, 34, "found"));
    edges.push({ from: "am", to: "amem" });
    labels.push({ id: "anote", x: 170, y: 258, text: "任何核心存取任何位址，時間都一樣" });
    // NUMA：2 × 2 個節點
    const pos = [[440, 78], [600, 78], [440, 196], [600, 196]];
    pos.forEach(([x, y], i) => {
      nodes.push(box("bp" + i, "P" + i + "+cache", x, y - 18, 96, 28, "compare"));
      nodes.push(box("bm" + i, "本地記憶體", x, y + 16, 96, 28, "found"));
      edges.push({ from: "bp" + i, to: "bm" + i });
    });
    nodes.push(box("net", "互連網路", 520, 137, 76, 30, "active"));
    [0, 1, 2, 3].forEach((i) => edges.push({ from: "bp" + i, to: "net", state: "active" }));
    labels.push({ id: "bnote", x: 520, y: 258, text: "存取本地快、存取別的節點的記憶體慢" });
    return { width: 700, height: 272, nodes, edges, labels };
  });

  // 強擴展與弱擴展（20 單位序列 + 平均分配的矩陣加總）
  figure("mp-scaling", () => {
    const nodes = [], labels = [];
    const bar = (id, y, serial, par, scale, x0, txt) => {
      const ws = serial * scale, wp = par * scale;
      nodes.push(box(id + "s", "", x0 + ws / 2, y, ws, 22, "active"));
      nodes.push(box(id + "p", "", x0 + ws + wp / 2, y, Math.max(wp, 2), 22, "compare"));
      labels.push({ id: id + "t", x: x0 + ws + wp + 8, y, text: txt, anchor: "start" });
    };
    labels.push({ id: "ta", x: 20, y: 18, text: "(a) 強擴展：總問題固定 32 × 32 = 1024 個加法", cls: "title", anchor: "start" });
    const S1 = 0.4;
    [[1, 1024, "P = 1：20 + 1024 = 1044"], [8, 128, "P = 8：20 + 128 = 148，speedup 7.05"], [32, 32, "P = 32：20 + 32 = 52，speedup 20.08"]].forEach(([p, w, t], k) => {
      labels.push({ id: "pa" + k, x: 20, y: 48 + k * 32, text: "P=" + p, anchor: "start" });
      bar("a" + k, 48 + k * 32, 20, w, S1, 64, t);
    });
    labels.push({ id: "tb", x: 20, y: 160, text: "(b) 弱擴展：每個核心固定分到 32 個加法，總量 32P", cls: "title", anchor: "start" });
    const S2 = 4;
    [[1, 32, "P = 1：總量 32，時間 52"], [8, 32, "P = 8：總量 256，時間 52"], [32, 32, "P = 32：總量 1024，時間 52"]].forEach(([p, w, t], k) => {
      labels.push({ id: "pb" + k, x: 20, y: 190 + k * 32, text: "P=" + p, anchor: "start" });
      bar("b" + k, 190 + k * 32, 20, w, S2, 64, t);
    });
    labels.push({ id: "lg1", x: 470, y: 182, text: "橘：20 單位只能序列執行", anchor: "start" });
    labels.push({ id: "lg2", x: 470, y: 204, text: "藍：平均分給 P 個核心的部分", anchor: "start" });
    return { width: 700, height: 268, nodes, edges: [], labels };
  });

  // false sharing
  figure("mp-false-sharing", () => {
    const nodes = [], edges = [], labels = [];
    labels.push({ id: "ta", x: 175, y: 18, text: "(a) X、Y 在同一個 block", cls: "title" });
    labels.push({ id: "tb", x: 530, y: 18, text: "(b) 補空間（padding）後分開", cls: "title" });
    nodes.push(box("p0", "P0：只寫 X", 85, 56, 120, 30, "compare"), box("p1", "P1：只寫 Y", 265, 56, 120, 30, "compare"));
    nodes.push(box("c0x", "X", 60, 116, 50, 30, "active"), box("c0y", "Y", 110, 116, 50, 30, "ghost"));
    nodes.push(box("c1x", "X", 240, 116, 50, 30, "ghost"), box("c1y", "Y", 290, 116, 50, 30, "active"));
    edges.push({ from: "p0", to: "c0x" }, { from: "p1", to: "c1y" });
    edges.push({ from: "c0y", to: "c1x", state: "removed" });
    labels.push({ id: "pp", x: 175, y: 170, text: "每次寫都把對方整個 block 作廢", cls: "warn" });
    labels.push({ id: "pp2", x: 175, y: 194, text: "block 在兩個快取之間來回搬（ping-pong）" });
    nodes.push(box("mx", "X", 150, 240, 50, 28, "default"), box("my", "Y", 200, 240, 50, 28, "default"));
    labels.push({ id: "mb", x: 175, y: 268, text: "記憶體：同一個 64 B block", anchor: "middle" });
    // (b)
    nodes.push(box("q0", "P0：只寫 X", 440, 56, 120, 30, "compare"), box("q1", "P1：只寫 Y", 620, 56, 120, 30, "compare"));
    nodes.push(box("d0x", "X", 415, 116, 50, 30, "active"), box("d0p", "空", 465, 116, 50, 30, "muted"));
    nodes.push(box("d1y", "Y", 595, 116, 50, 30, "active"), box("d1p", "空", 645, 116, 50, 30, "muted"));
    edges.push({ from: "q0", to: "d0x" }, { from: "q1", to: "d1y" });
    labels.push({ id: "qq", x: 530, y: 170, text: "各寫各的 block，各自停在 M", cls: "ok" });
    labels.push({ id: "qq2", x: 530, y: 194, text: "第一次 miss 之後都是 write hit" });
    nodes.push(box("nx", "X", 440, 240, 50, 28, "default"), box("ny", "Y", 620, 240, 50, 28, "default"));
    labels.push({ id: "nb", x: 530, y: 268, text: "記憶體：X、Y 各在不同 block" });
    return { width: 700, height: 284, nodes, edges, labels };
  });

  // warp divergence（用 8 個 lane 示意，實際一個 warp 是 32 個 thread）
  figure("mp-warp-divergence", () => {
    const nodes = [], labels = [];
    const take = [1, 0, 0, 0, 1, 0, 0, 0];
    labels.push({ id: "h0", x: 110, y: 20, text: "lane（thread）", cls: "title" });
    labels.push({ id: "h1", x: 300, y: 20, text: "if 那一路：20 cycles", cls: "title" });
    labels.push({ id: "h2", x: 520, y: 20, text: "else 那一路：10 cycles", cls: "title" });
    take.forEach((t, i) => {
      const y = 48 + i * 27;
      labels.push({ id: "l" + i, x: 110, y, text: `t${i}${t ? "（tid % 4 == 0）" : ""}` });
      nodes.push(box("a" + i, t ? "執行 A" : "mask", 300, y, 200, 22, t ? "found" : "ghost"));
      nodes.push(box("b" + i, t ? "mask" : "執行 B", 520, y, 100, 22, t ? "ghost" : "found"));
    });
    labels.push({ id: "s", x: 410, y: 278, text: "整個 warp 共用一個 PC：兩路依序跑完，共 30 cycles；虛線格是被 mask 掉、閒置的 lane", cls: "warn" });
    return { width: 700, height: 296, nodes, edges: [], labels };
  });

  // 互連拓撲：16 個節點的 ring 與 4 × 4 mesh，虛線是 bisection 切線
  figure("mp-topologies", () => {
    const nodes = [], edges = [], labels = [];
    labels.push({ id: "ta", x: 170, y: 18, text: "(a) Ring：16 條連線，bisection 2", cls: "title" });
    labels.push({ id: "tb", x: 520, y: 18, text: "(b) 4 × 4 Mesh：24 條連線，bisection 4", cls: "title" });
    const R = 90, cx = 170, cy = 156;
    for (let i = 0; i < 16; i++) {
      const a = (i + 0.5) / 16 * 2 * Math.PI;
      nodes.push({ id: "r" + i, label: "", shape: "circle", r: 9, x: cx + R * Math.sin(a), y: cy - R * Math.cos(a), state: i < 8 ? "compare" : "found" });
    }
    for (let i = 0; i < 16; i++) edges.push({ from: "r" + i, to: "r" + ((i + 1) % 16), state: i === 7 || i === 15 ? "removed" : "default" });
    nodes.push(dot("rc1", cx, cy - R - 14), dot("rc2", cx, cy + R + 14));
    edges.push({ from: "rc1", to: "rc2", dashed: true, state: "active" });
    const S = 46, mx = 451, my = 76;
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++)
      nodes.push({ id: `m${r}_${c}`, label: "", shape: "circle", r: 9, x: mx + c * S, y: my + r * S, state: c < 2 ? "compare" : "found" });
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
      if (c < 3) edges.push({ from: `m${r}_${c}`, to: `m${r}_${c + 1}`, state: c === 1 ? "removed" : "default" });
      if (r < 3) edges.push({ from: `m${r}_${c}`, to: `m${r + 1}_${c}` });
    }
    nodes.push(dot("mc1", mx + 1.5 * S, my - 26), dot("mc2", mx + 1.5 * S, my + 3 * S + 26));
    edges.push({ from: "mc1", to: "mc2", dashed: true, state: "active" });
    labels.push({ id: "n", x: 350, y: 286, text: "藍、綠各 8 個節點；橘色虛線是切線，紅色虛線是被切斷的連線", anchor: "middle" });
    return { width: 700, height: 300, nodes, edges, labels };
  });
})();
