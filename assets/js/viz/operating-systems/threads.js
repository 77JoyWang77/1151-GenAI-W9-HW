/* =====================================================================
   Threads and Multithreading Models（執行緒與多執行緒模型）主題的視覺化
   - thread-models : 選一種多執行緒模型（many-to-one / one-to-one / many-to-many / two-level），
                     設定 user thread 數、LWP 數、CPU 數，讓正在跑的 user thread 依序做
                     blocking system call，看誰被卡住、同時還有幾個在跑
   - 靜態圖：threads-shared-private、threads-models、threads-concurrency、threads-fork
   ===================================================================== */
(function () {
  "use strict";
  const { Player, Recorder, ui, register, esc, iconHTML, figure } = window.DSViz;

  // 右側程式碼：由 .work/build_js.py 從 code/operating-systems/threads.c 原封不動取出
  const CODE = [
    "int numKernel(void) {",
    "  if (model == MANY_TO_ONE) return 1;",
    "  if (model == ONE_TO_ONE) return nUser;",
    "  if (model == MANY_TO_MANY) return nLWP;",
    "  return 1 + nLWP;             /* two-level：T0 綁定 K0，其餘共用 nLWP 個 */",
    "}",
    "",
    "/* user thread t 能不能用 kernel thread k */",
    "int allowed(int t, int k) {",
    "  if (model == MANY_TO_ONE) return k == 0;",
    "  if (model == ONE_TO_ONE) return k == t;",
    "  if (model == MANY_TO_MANY) return 1;",
    "  return t == 0 ? k == 0 : k >= 1;   /* two-level：bound thread 只用自己的 K0 */",
    "}",
    "",
    "/* 排程一輪：kernel 把沒被卡住的 kernel thread 排上 CPU，",
    "   thread library 替每個 kernel thread 挑一個 ready 的 user thread */",
    "int schedule(int running[]) {",
    "  int taken[MAXT] = {0}, cnt = 0;",
    "  for (int k = 0; k < numKernel() && cnt < cores; k++) {",
    "    if (kblocked[k]) continue;                 /* 卡在 system call 的 kernel thread 不能上 CPU */",
    "    for (int t = 0; t < nUser; t++)",
    "      if (!blocked[t] && !taken[t] && allowed(t, k)) {",
    "        taken[t] = 1;",
    "        running[cnt++] = t;",
    "        break;",
    "      }",
    "  }",
    "  return cnt;                                  /* 同時在跑的 user thread 數 */",
    "}",
    "",
    "/* user thread t（目前跑在 kernel thread k 上）呼叫 read() 之類的 blocking system call */",
    "void blockingCall(int t, int k) {",
    "  blocked[t] = 1;",
    "  kblocked[k] = 1;             /* kernel 只看得到 kernel thread：卡住的是 k */",
    "  lwpOf[t] = k;",
    "}",
    "",
    "/* I/O 完成：t 和它的 kernel thread 回到 ready */",
    "void ioDone(int t) {",
    "  blocked[t] = 0;",
    "  kblocked[lwpOf[t]] = 0;",
    "}"
  ];
  const ln = (s) => CODE.findIndex((l) => l.includes(s)) + 1;
  const L = {
    nk: [ln("int numKernel(void) {")],
    sched: [ln("int schedule(int running[]) {"), ln("for (int k = 0; k < numKernel()")],
    skip: [ln("if (kblocked[k]) continue;")],
    pick: [ln("if (!blocked[t] && !taken[t] && allowed(t, k))"), ln("running[cnt++] = t;")],
    ret: [ln("return cnt;")],
    block: [ln("void blockingCall(int t, int k) {"), ln("blocked[t] = 1;"), ln("kblocked[k] = 1;")],
    done: [ln("void ioDone(int t) {"), ln("blocked[t] = 0;"), ln("kblocked[lwpOf[t]] = 0;")],
  };

  const M1 = 0, O1 = 1, MM = 2, TL = 3;
  const NAME = ["Many-to-One", "One-to-One", "Many-to-Many", "Two-Level"];

  register("thread-models", function (root) {
    const player = new Player(root, {
      title: "Multithreading Models 多執行緒模型",
      width: 680, height: 380, code: CODE, wide: true,
      legend: [["active", "正在 CPU 上執行"], ["default", "ready，等 CPU"], ["removed", "卡在 blocking system call"], ["muted", "ready 但沒有可用的 kernel thread"], ["compare", "忙碌的 CPU"]],
    });

    // ---------- 模型（和 threads.c 的 schedule() 相同邏輯） ----------
    let S = null;   // { model, nU, nL, cores, bl:Set, kb:Set, lwpOf:{}, run:[[t,k]] }
    const nK = () => [1, S.nU, S.nL, 1 + S.nL][S.model];
    function allowed(t, k) {
      if (S.model === M1) return k === 0;
      if (S.model === O1) return k === t;
      if (S.model === MM) return true;
      return t === 0 ? k === 0 : k >= 1;
    }
    function schedule() {
      const taken = new Set(), run = [];
      for (let k = 0; k < nK() && run.length < S.cores; k++) {
        if (S.kb.has(k)) continue;
        for (let t = 0; t < S.nU; t++)
          if (!S.bl.has(t) && !taken.has(t) && allowed(t, k)) { taken.add(t); run.push([t, k]); break; }
      }
      S.run = run;
      return run;
    }
    const stuck = (t) => !S.bl.has(t) && ![...Array(nK()).keys()].some((k) => !S.kb.has(k) && allowed(t, k));
    const names = (arr) => (arr.length ? arr.map((t) => "T" + t).join("、") : "沒有");

    // ---------- 畫面 ----------
    const UY = 92, KY = 206, CY = 318;
    const xs = (n) => { const gap = Math.min(104, 600 / Math.max(n, 1)), x0 = 340 - ((n - 1) * gap) / 2; return Array.from({ length: n }, (_, i) => x0 + i * gap); };

    function frame(caption, line) {
      const nodes = [], edges = [], labels = [];
      const ux = xs(S.nU), kx = xs(nK()), cx = xs(S.cores);
      const runT = new Map(S.run.map(([t, k]) => [t, k])), runK = new Map(S.run.map(([t, k], i) => [k, i]));
      labels.push({ id: "ttl", x: 16, y: 20, text: NAME[S.model] + `：${S.nU} 個 user thread、${nK()} 個 kernel thread、${S.cores} 顆 CPU`, cls: "title", anchor: "start" });
      labels.push({ id: "lu", x: 16, y: UY - 34, text: "user threads（thread library 管理）", anchor: "start" });
      labels.push({ id: "lk", x: 16, y: KY - 34, text: S.model === M1 || S.model === O1 ? "kernel threads（kernel 排程的單位）" : "kernel threads／LWP（kernel 排程的單位）", anchor: "start" });
      labels.push({ id: "lc", x: 16, y: CY - 34, text: "CPU 核心", anchor: "start" });
      for (let t = 0; t < S.nU; t++) {
        const st = runT.has(t) ? "active" : S.bl.has(t) ? "removed" : stuck(t) ? "muted" : "default";
        nodes.push({ id: "u" + t, label: "T" + t, shape: "box", w: 60, h: 34, x: ux[t], y: UY, state: st });
      }
      for (let k = 0; k < nK(); k++) {
        const st = S.kb.has(k) ? "removed" : runK.has(k) ? "active" : "default";
        nodes.push({ id: "k" + k, label: "K" + k, shape: "box", w: 60, h: 34, x: kx[k], y: KY, state: st });
      }
      for (let c = 0; c < S.cores; c++) {
        const busy = c < S.run.length;
        nodes.push({ id: "c" + c, label: "CPU" + c, shape: "box", w: 70, h: 34, x: cx[c], y: CY, state: busy ? "compare" : "muted" });
      }
      // user → kernel 的對應：固定的對應畫虛線；正在用、或卡在上面的畫實線
      const fixed = (t, k) => S.model === M1 || S.model === O1 || (S.model === TL && t === 0);
      for (let t = 0; t < S.nU; t++) {
        for (let k = 0; k < nK(); k++) {
          const using = runT.get(t) === k, blockedOn = S.bl.has(t) && S.lwpOf[t] === k;
          if (using || blockedOn) edges.push({ from: "u" + t, to: "k" + k, state: blockedOn ? "removed" : "active" });
          else if (fixed(t, k) && allowed(t, k)) edges.push({ from: "u" + t, to: "k" + k, dashed: true, state: "muted" });
        }
      }
      S.run.forEach(([, k], i) => edges.push({ from: "k" + k, to: "c" + i, state: "compare" }));
      if (S.model === MM || S.model === TL)
        labels.push({ id: "hint", x: 664, y: KY - 34, text: S.model === MM ? "任何 user thread 都可以用任何一個 LWP" : "T0 綁定 K0；其餘共用 K1 之後的 LWP", anchor: "end" });
      labels.push({ id: "sum", x: 664, y: 20, text: `同時在跑：${S.run.length} 個`, cls: "strong", anchor: "end" });
      return { nodes, edges, labels, caption, line };
    }

    function schedCaption(why) {
      const run = S.run.map(([t]) => t);
      const ready = [...Array(S.nU).keys()].filter((t) => !S.bl.has(t) && !run.includes(t));
      const st = ready.filter(stuck), wait = ready.filter((t) => !stuck(t));
      let s = `${why}排程結果：${run.length ? names(run) + ` 在跑（${run.length} 個）` : "沒有任何 user thread 在跑"}。`;
      if (wait.length) s += ` ${names(wait)} 是 ready，只是 CPU 或可用的 kernel thread 已經分完，等下一輪。`;
      if (st.length) s += ` <b>${names(st)} 明明是 ready，卻沒有任何沒被卡住的 kernel thread 可用</b>，只能乾等。`;
      return s;
    }

    function run(model, nU, nL, cores, blockers) {
      S = { model, nU, nL, cores, bl: new Set(), kb: new Set(), lwpOf: {}, run: [] };
      const r = new Recorder();
      const intro = [
        `Many-to-one：${nU} 個 user thread 全部對應到<b>唯一的 K0</b>。thread 的建立與切換都在 user space 完成，kernel 只看到一個執行單位。`,
        `One-to-one：每個 user thread 都有<b>自己的 kernel thread</b>（T<i>i</i> ↔ K<i>i</i>），kernel 可以個別排程每一個。`,
        `Many-to-many：${nU} 個 user thread 由 thread library 多工到 <b>${nL} 個 LWP</b> 上，哪個 user thread 用哪個 LWP 每一輪都可以換。`,
        `Two-level：和 many-to-many 一樣多工，但 <b>T0 綁定（bound）在自己的 K0</b> 上；T1 之後共用 ${nL} 個 LWP（K1～K${nL}）。`,
      ][model];
      r.push(frame(intro + ` 共有 ${nK()} 個 kernel thread、${cores} 顆 CPU。`, L.nk));
      schedule();
      const lim = Math.min(cores, nK(), nU);
      r.push(frame(schedCaption(`kernel 把 kernel thread 排上 CPU，thread library 替每個 kernel thread 挑一個 user thread；同時最多 min(CPU ${cores}, kernel thread ${nK()}, user thread ${nU}) = ${lim} 個。`) + (cores === 1 && nU > 1 ? " 只有 1 顆 CPU：thread 只能輪流用 CPU，有 concurrency 但沒有 parallelism。" : ""), L.pick));
      const order = [];
      for (const b of blockers) {
        const m = new Map(S.run.map(([t, k]) => [t, k]));
        if (!m.has(b)) {
          const why = S.bl.has(b) ? `T${b} 已經卡在 system call 裡了` : `T${b} 現在沒在 CPU 上`;
          r.push(frame(`${iconHTML("alert")} ${why}，沒辦法發出新的 system call；只有正在跑的 thread（${names(S.run.map(([t]) => t))}）能呼叫。${S.run.length ? "" : "整個 process 已經沒有任何 thread 在跑。"}`, null));
          break;
        }
        const k = m.get(b);
        S.bl.add(b); S.kb.add(k); S.lwpOf[b] = k; order.push(b);
        S.run = S.run.filter(([t]) => t !== b);
        r.push(frame(`T${b} 呼叫 <code>read()</code> 這類 blocking system call。kernel 只看得到 kernel thread，所以被卡住的是 <b>K${k}</b>，T${b} 跟著停住。`, L.block));
        schedule();
        let why;
        if (model === M1) why = `K0 是這個 process 唯一的 kernel thread，它被卡住，<b>其他 user thread 全都上不了 CPU</b>：一個 thread block，整個 process 都 block。`;
        else if (model === O1) why = `只有 K${k} 被卡住，其他 kernel thread 照樣可以被 kernel 排上 CPU。`;
        else {
          const freeK = [...Array(nK()).keys()].filter((x) => !S.kb.has(x) && (model === MM || x >= 1));
          why = freeK.length ? `K${k} 被卡住，但還有 ${freeK.map((x) => "K" + x).join("、")} 沒被卡，thread library 把其他 ready 的 user thread 放上去。`
            : `所有可共用的 LWP 都被卡住了，${model === TL && !S.kb.has(0) ? "只剩綁定在 K0 的 T0 還能跑；" : ""}其餘 ready 的 user thread 只能等（真實系統可用 scheduler activation 的 upcall 要求 kernel 再給一個 LWP）。`;
        }
        r.push(frame(schedCaption(why + " 重新排程："), L.skip));
      }
      if (order.length) {
        for (const b of order) { S.bl.delete(b); S.kb.delete(S.lwpOf[b]); }
        S.run = [];
        r.push(frame(`I/O 完成，kernel 喚醒 ${order.map((b) => "T" + b + "（K" + S.lwpOf[b] + "）").join("、")}，回到 ready。`, L.done));
        schedule();
        r.push(frame(schedCaption("全部回到 ready 後再排程一次。") + ` <b>總結</b>：${NAME[model]} 下，一個 thread 做 blocking call ${model === M1 ? "會讓整個 process 停住" : "不會拖累其他 thread（除非可用的 kernel thread 全被卡住）"}。`, L.ret));
      }
      return r.frames;
    }

    // ---------- 控制列 ----------
    let model = M1;
    const inU = ui.input(player, { placeholder: "user thread 數", value: "4", width: 52 });
    const inL = ui.input(player, { placeholder: "LWP 數", value: "2", width: 52 });
    const inC = ui.input(player, { placeholder: "CPU 數", value: "2", width: 52 });
    const inB = ui.input(player, { placeholder: "依序 block 的 thread，例如 0 1", value: "0", width: 150 });
    inU.title = "user thread 數（1～6）"; inL.title = "many-to-many／two-level 共用的 LWP 數"; inC.title = "CPU 核心數（1～4）"; inB.title = "依序做 blocking system call 的 user thread 編號（最多 3 個）";
    function err(msg) {
      player.load([{ nodes: [], edges: [], labels: [], caption: `${iconHTML("alert")} ${msg}`, line: null }], { autoplay: false });
    }
    function go(m) {
      if (m !== undefined) { model = m; mBtns.forEach((b, i) => b.classList.toggle("ghost", i !== model)); mBtns.forEach((b, i) => b.classList.toggle("primary", i === model)); }
      const u = ui.int(inU, { min: 1, max: 6 }), c = ui.int(inC, { min: 1, max: 4 });
      if (u === null) return err("user thread 數請輸入 1～6 的整數。");
      if (c === null) return err("CPU 數請輸入 1～4 的整數。");
      let l = 0;
      if (model === MM || model === TL) {
        const maxL = model === MM ? u : u - 1;
        if (maxL < 1) return err("two-level 至少要 2 個 user thread：T0 綁定 K0，其他的才有 LWP 可以共用。");
        l = ui.int(inL, { min: 1, max: maxL });
        if (l === null) return err(`LWP 數請輸入 1～${maxL}：${model === MM ? "many-to-many 的 kernel thread 不會比 user thread 多" : "two-level 的共用 LWP 不會比 T1 之後的 user thread 多"}。`);
      }
      const raw = inB.value.trim();
      const toks = raw === "" ? [] : raw.split(/[\s,，]+/);
      if (toks.some((s) => !/^T?\d+$/i.test(s))) return err(`看不懂「${esc(raw)}」：請輸入 user thread 編號，用空白隔開，例如 <code>0 1</code>。`);
      const bs = toks.map((s) => Number(s.replace(/^T/i, "")));
      if (bs.length > 3) return err("最多讓 3 個 thread 依序 block，畫面才看得清楚。");
      if (bs.some((x) => x >= u)) return err(`沒有 T${bs.find((x) => x >= u)}：目前只有 T0～T${u - 1}。`);
      if (new Set(bs).size !== bs.length) return err("同一個 thread 不能重複出現：它已經卡在第一次的 system call 裡。");
      player.load(run(model, u, l, c, bs));
    }
    const mBtns = NAME.map((nm, i) => ui.button(player, nm, () => go(i), i === 0 ? "primary" : "ghost"));
    ui.button(player, "執行", () => go());
    ui.button(player, "例：M:1 一個卡全部卡", () => { inU.value = "4"; inC.value = "2"; inB.value = "0"; go(M1); }, "ghost");
    ui.button(player, "例：LWP 用完", () => { inU.value = "5"; inL.value = "2"; inC.value = "4"; inB.value = "0 1"; go(MM); }, "ghost");
    ui.button(player, "例：單核 1:1", () => { inU.value = "3"; inC.value = "1"; inB.value = "0 1"; go(O1); }, "ghost");

    const demo = run(M1, 4, 2, 2, [0]);
    demo[0].caption = iconHTML("play") + " 按播放看示範：many-to-one，4 個 user thread、2 顆 CPU，T0 做 blocking system call。也可以按上方四個模型切換，或改輸入框：user thread 數、LWP 數（只用在 many-to-many／two-level）、CPU 數、依序 block 的 thread 編號，再按「執行」。";
    player.load(demo, { autoplay: false });
  });

  // ===================== 靜態圖 =====================
  // 圖 1：同一個 process 的三個 thread 共享什麼、各自擁有什麼
  figure("threads-shared-private", () => {
    const nodes = [], labels = [], edges = [];
    labels.push({ id: "t", x: 20, y: 22, text: "一個 process（單一位址空間，同一張 page table）", cls: "title", anchor: "start" });
    ["code", "data", "heap", "open files"].forEach((s, i) =>
      nodes.push({ id: "s" + i, label: s, shape: "box", w: 120, h: 36, x: 110 + i * 140, y: 66, state: "found" }));
    labels.push({ id: "sh", x: 320, y: 106, text: "所有 thread 共享（global 變數、malloc 的空間、檔案描述子）", anchor: "middle" });
    [0, 1, 2].forEach((t) => {
      const x = 130 + t * 190;
      labels.push({ id: "tt" + t, x, y: 140, text: "thread " + t, cls: "strong" });
      ["registers", "PC", "stack"].forEach((s, j) =>
        nodes.push({ id: `p${t}_${j}`, label: s, shape: "box", w: 110, h: 32, x, y: 176 + j * 40, state: "compare" }));
    });
    labels.push({ id: "pv", x: 320, y: 312, text: "每個 thread 各自擁有：thread ID、暫存器、PC、stack（區域變數、函式呼叫）", anchor: "middle" });
    return { width: 640, height: 330, nodes, edges, labels };
  });

  // 圖 2：四種多執行緒模型
  figure("threads-models", () => {
    const nodes = [], edges = [], labels = [];
    const panel = (i, title, nu, nk, map, bound) => {
      const x0 = 18 + i * 172, cx = x0 + 78;
      labels.push({ id: "h" + i, x: cx, y: 22, text: title, cls: "strong" });
      const ux = (j) => cx - ((nu - 1) * 36) / 2 + j * 36, kx = (j) => cx - ((nk - 1) * 44) / 2 + j * 44;
      for (let j = 0; j < nu; j++) nodes.push({ id: `u${i}_${j}`, label: "U", shape: "circle", r: 14, x: ux(j), y: 70, state: bound === j ? "active" : "default" });
      for (let j = 0; j < nk; j++) nodes.push({ id: `k${i}_${j}`, label: "K", shape: "box", w: 34, h: 30, x: kx(j), y: 170, state: "compare" });
      map.forEach(([a, b, d]) => edges.push({ from: `u${i}_${a}`, to: `k${i}_${b}`, dashed: !!d, state: bound === a ? "active" : "default" }));
    };
    panel(0, "Many-to-One", 3, 1, [[0, 0], [1, 0], [2, 0]]);
    panel(1, "One-to-One", 3, 3, [[0, 0], [1, 1], [2, 2]]);
    panel(2, "Many-to-Many", 4, 2, [[0, 0, 1], [0, 1, 1], [1, 0, 1], [1, 1, 1], [2, 0, 1], [2, 1, 1], [3, 0, 1], [3, 1, 1]]);
    panel(3, "Two-Level", 4, 3, [[0, 0], [1, 1, 1], [1, 2, 1], [2, 1, 1], [2, 2, 1], [3, 1, 1], [3, 2, 1]], 0);
    labels.push({ id: "f0", x: 96, y: 214, text: "一個 block 全部 block", cls: "warn" });
    labels.push({ id: "f1", x: 268, y: 214, text: "kernel thread 最多" });
    labels.push({ id: "f2", x: 440, y: 214, text: "虛線：每輪可以換" });
    labels.push({ id: "f3", x: 612, y: 214, text: "橘色：bound thread" });
    return { width: 700, height: 232, nodes, edges, labels };
  });

  // 圖 3：concurrency 與 parallelism
  figure("threads-concurrency", () => {
    const nodes = [], labels = [];
    const seq1 = ["T1", "T2", "T3", "T4", "T1", "T2", "T3", "T4"];
    const st = { T1: "compare", T2: "active", T3: "new", T4: "found" };
    labels.push({ id: "a", x: 20, y: 26, text: "(a) 單核心：concurrency，輪流推進", cls: "title", anchor: "start" });
    labels.push({ id: "c0", x: 20, y: 64, text: "core 0", anchor: "start" });
    seq1.forEach((t, i) => nodes.push({ id: "a" + i, label: t, shape: "box", w: 60, h: 32, x: 110 + i * 64, y: 60, state: st[t] }));
    labels.push({ id: "b", x: 20, y: 118, text: "(b) 雙核心：parallelism，同一時刻真的有兩個在跑", cls: "title", anchor: "start" });
    labels.push({ id: "c1", x: 20, y: 156, text: "core 0", anchor: "start" });
    labels.push({ id: "c2", x: 20, y: 196, text: "core 1", anchor: "start" });
    ["T1", "T3", "T1", "T3"].forEach((t, i) => nodes.push({ id: "b" + i, label: t, shape: "box", w: 60, h: 32, x: 110 + i * 64, y: 152, state: st[t] }));
    ["T2", "T4", "T2", "T4"].forEach((t, i) => nodes.push({ id: "d" + i, label: t, shape: "box", w: 60, h: 32, x: 110 + i * 64, y: 192, state: st[t] }));
    labels.push({ id: "tm", x: 620, y: 236, text: "時間 →", anchor: "end" });
    labels.push({ id: "n", x: 380, y: 172, text: "同樣 8 段工作，只要一半時間", anchor: "start" });
    return { width: 640, height: 250, nodes, labels };
  });

  // 圖 4：多執行緒的 process 呼叫 fork()
  figure("threads-fork", () => {
    const nodes = [], edges = [], labels = [];
    labels.push({ id: "p", x: 150, y: 22, text: "parent process", cls: "strong" });
    labels.push({ id: "c", x: 500, y: 22, text: "child process（POSIX fork）", cls: "strong" });
    nodes.push({ id: "t0", label: "T0 呼叫 fork()", shape: "box", w: 150, h: 34, x: 150, y: 70, state: "active" });
    nodes.push({ id: "t1", label: "T1 拿著 mutex m", shape: "box", w: 150, h: 34, x: 150, y: 120, state: "default" });
    nodes.push({ id: "t2", label: "T2", shape: "box", w: 150, h: 34, x: 150, y: 170, state: "default" });
    nodes.push({ id: "m0", label: "m：locked（T1）", shape: "box", w: 150, h: 34, x: 150, y: 236, state: "compare" });
    nodes.push({ id: "c0", label: "T0 的複本", shape: "box", w: 150, h: 34, x: 500, y: 70, state: "active" });
    nodes.push({ id: "c1", label: "（沒有 T1）", shape: "box", w: 150, h: 34, x: 500, y: 120, state: "ghost" });
    nodes.push({ id: "c2", label: "（沒有 T2）", shape: "box", w: 150, h: 34, x: 500, y: 170, state: "ghost" });
    nodes.push({ id: "cm", label: "m：仍是 locked", shape: "box", w: 150, h: 34, x: 500, y: 236, state: "removed" });
    edges.push({ from: "t0", to: "c0", directed: true, state: "active" });
    edges.push({ from: "m0", to: "cm", directed: true, state: "default" });
    labels.push({ id: "k1", x: 325, y: 58, text: "只複製呼叫者", anchor: "middle" });
    labels.push({ id: "k2", x: 325, y: 224, text: "記憶體整份複製", anchor: "middle" });
    labels.push({ id: "w", x: 500, y: 284, text: "沒有人能解鎖：child 再 lock(m) 就永遠等下去", cls: "warn" });
    return { width: 660, height: 300, nodes, edges, labels };
  });
})();
