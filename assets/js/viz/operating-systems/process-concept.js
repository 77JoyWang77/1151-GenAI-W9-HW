/* =====================================================================
   Process Concept（行程與行程狀態）主題的視覺化
   - fork-tree      : 選一段含 fork() 的程式、設定迴圈次數 n，逐步看每個 process 執行 fork，
                      畫出行程樹並統計輸出（次數固定，順序不固定）
   - process-states : 輸入一串事件（admit、dispatch、timeout、io、done、exit、suspend、resume），
                      看行程在五狀態／七狀態圖上怎麼移動；非法轉移會停下來說明原因
   - 靜態圖：process-concept-memory、process-concept-states、process-concept-context-switch、
             process-concept-tree、process-concept-zombie-orphan
   ===================================================================== */
(function () {
  "use strict";
  const { Player, Recorder, ui, register, esc, iconHTML, figure } = window.DSViz;

  // 右側程式碼：由 .work/build_js.py 從 code/operating-systems/process-concept.c 原封不動取出
  const CODE_STATE = [
      "enum State { NEW, READY, RUNNING, WAITING, TERMINATED, READY_SUSPEND, BLOCKED_SUSPEND };",
      "enum Event { ADMIT, DISPATCH, TIMEOUT, IO_WAIT, IO_DONE, EXIT, SUSPEND, RESUME };",
      "",
      "/* 回傳新狀態；這個狀態下不可能發生這個事件就回傳 -1 */",
      "int transition(int s, int ev) {",
      "  switch (s) {",
      "  case NEW:",
      "    if (ev == ADMIT) return READY;              /* long-term scheduler 允許它進入記憶體 */",
      "    break;",
      "  case READY:",
      "    if (ev == DISPATCH) return RUNNING;         /* short-term scheduler 選中，dispatcher 切過去 */",
      "    if (ev == SUSPEND) return READY_SUSPEND;    /* medium-term scheduler 把它換出到磁碟 */",
      "    break;",
      "  case RUNNING:",
      "    if (ev == TIMEOUT) return READY;            /* timer interrupt：time quantum 用完被搶先 */",
      "    if (ev == IO_WAIT) return WAITING;          /* 發出 I/O 或等待某個事件 */",
      "    if (ev == EXIT) return TERMINATED;          /* 呼叫 exit()，等 parent 用 wait() 回收 */",
      "    break;",
      "  case WAITING:",
      "    if (ev == IO_DONE) return READY;            /* 事件完成：回 ready，不是直接 running */",
      "    if (ev == SUSPEND) return BLOCKED_SUSPEND;",
      "    break;",
      "  case READY_SUSPEND:",
      "    if (ev == RESUME) return READY;             /* 換回記憶體 */",
      "    break;",
      "  case BLOCKED_SUSPEND:",
      "    if (ev == IO_DONE) return READY_SUSPEND;    /* 事件完成了，但人還在磁碟上 */",
      "    if (ev == RESUME) return WAITING;",
      "    break;",
      "  }",
      "  return -1;                                    /* 非法轉移，例如 WAITING 直接 DISPATCH */",
      "}"
  ];
  const CODE_LOOP = [
      "/* (1) 迴圈裡 fork n 次，最後每個 process 印一行 */",
      "void loopFork(int n) {",
      "  for (int i = 0; i < n; i++)",
      "    fork();",
      "  printf(\"hello\\n\");",
      "}"
  ];
  const CODE_PRINT = [
      "/* (2) 每一輪 fork 完都印出 i */",
      "void loopPrint(int n) {",
      "  for (int i = 0; i < n; i++) {",
      "    fork();",
      "    printf(\"%d\\n\", i);",
      "  }",
      "}"
  ];
  const CODE_ANDOR = [
      "/* (3) 短路求值：&& 左邊為 0 就不算右邊；|| 左邊非 0 就不算右邊 */",
      "void andOr(int n) {",
      "  (void)n;",
      "  if ((fork() && fork()) || fork())",
      "    printf(\"T\\n\");",
      "  else",
      "    printf(\"F\\n\");",
      "}"
  ];
  const CODE_FAN = [
      "/* (4) fan：child 一出生就 break，只有原本的 process 在 fork */",
      "void fan(int n) {",
      "  int i;",
      "  for (i = 0; i < n; i++)",
      "    if (fork() == 0) break;",
      "  printf(\"i=%d\\n\", i);",
      "}"
  ];
  const CODE_CHAIN = [
      "/* (5) chain：parent fork 完就 break，換 child 接著 fork */",
      "void chain(int n) {",
      "  int i;",
      "  for (i = 0; i < n; i++)",
      "    if (fork() > 0) break;",
      "  printf(\"i=%d\\n\", i);",
      "}"
  ];
  const lnIn = (code, s) => code.findIndex((l) => l.includes(s)) + 1;

  // ===================== fork-tree =====================
  const PRESETS = [
    { key: "loop", name: "迴圈 fork", code: CODE_LOOP, usesN: true },
    { key: "print", name: "迴圈內 printf", code: CODE_PRINT, usesN: true },
    { key: "andor", name: "&& 與 ||", code: CODE_ANDOR, usesN: false },
    { key: "fan", name: "fan：child break", code: CODE_FAN, usesN: true },
    { key: "chain", name: "chain：parent break", code: CODE_CHAIN, usesN: true },
  ];

  register("fork-tree", function (root) {
    const W = 720, H = 440;
    const player = new Player(root, {
      title: "fork() Process Tree 行程樹",
      width: W, height: H, code: CODE_LOOP, wide: true,
      legend: [["active", "正在執行 fork()"], ["new", "剛被建立的 child"], ["found", "已印出"], ["default", "其他 process"]],
    });

    let P = [];           // { id, parent, i, sub, done }
    let tally = [];       // [[文字, 次數]]
    function addOut(text, k) {
      const t = tally.find((x) => x[0] === text);
      if (t) t[1] += k; else tally.push([text, k]);
    }
    function spawn(par) {
      const c = { id: P.length, parent: par.id, i: par.i, sub: par.sub, done: false, stage: par.stage };
      P.push(c);
      return c;
    }

    function layout() {
      const kids = P.map(() => []);
      P.forEach((p) => { if (p.parent !== null) kids[p.parent].push(p.id); });
      const pos = [];
      let slot = 0;
      (function dfs(id, d) {
        if (!kids[id].length) pos[id] = { s: slot++, d };
        else {
          kids[id].forEach((c) => dfs(c, d + 1));
          const a = pos[kids[id][0]].s, b = pos[kids[id][kids[id].length - 1]].s;
          pos[id] = { s: (a + b) / 2, d };
        }
      })(0, 0);
      const gap = Math.min(slot <= 4 ? 130 : 84, 660 / Math.max(slot, 1)), x0 = W / 2 - ((slot - 1) * gap) / 2;
      return pos.map((p) => ({ x: x0 + p.s * gap, y: 78 + p.d * 64 }));
    }

    function frame(title, caption, line, opt) {
      opt = opt || {};
      const pos = layout(), nodes = [], edges = [], labels = [];
      P.forEach((p) => {
        const st = opt.fresh && opt.fresh.has(p.id) ? "new" : opt.active && opt.active.has(p.id) ? "active" : opt.printed && opt.printed.has(p.id) ? "found" : "default";
        nodes.push({ id: "p" + p.id, label: "P" + p.id, shape: "circle", r: 18, x: pos[p.id].x, y: pos[p.id].y, state: st });
        if (p.sub) labels.push({ id: "sb" + p.id, x: p.id === 0 ? pos[0].x : pos[p.id].x + 24, y: p.id === 0 ? pos[0].y - 30 : pos[p.id].y + 6, text: p.sub, anchor: p.id === 0 ? "middle" : "start" });
        if (p.parent !== null) edges.push({ from: "p" + p.parent, to: "p" + p.id, directed: true, state: opt.fresh && opt.fresh.has(p.id) ? "new" : "default" });
      });
      labels.push({ id: "ttl", x: 16, y: 20, text: title, cls: "title", anchor: "start" });
      labels.push({ id: "cnt", x: W - 16, y: 20, text: `process 數：${P.length}（新建 ${P.length - 1}）`, cls: "strong", anchor: "end" });
      const total = tally.reduce((s, t) => s + t[1], 0);
      labels.push({ id: "o1", x: 16, y: H - 44, text: `輸出共 ${total} 行（次數固定，順序由排程決定）`, anchor: "start" });
      labels.push({ id: "o2", x: 16, y: H - 20, text: tally.length ? tally.map(([t, k]) => `${t} ×${k}`).join("　") : "（還沒有輸出）", cls: "strong", anchor: "start" });
      return { nodes, edges, labels, caption, line };
    }

    const ids = (arr) => arr.map((p) => "P" + p.id).join("、");
    const setOf = (arr) => new Set(arr.map((p) => p.id));

    function runLoop(n, withPrint) {
      const C = withPrint ? CODE_PRINT : CODE_LOOP, L = (s) => lnIn(C, s);
      const title = withPrint ? `for (i = 0; i < ${n}; i++) { fork(); printf("%d\\n", i); }` : `for (i = 0; i < ${n}; i++) fork();  printf("hello\\n");`;
      P = [{ id: 0, parent: null, i: 0, sub: "", done: false }]; tally = [];
      const r = new Recorder();
      r.push(frame(title, `P0 開始執行。迴圈要跑 ${n} 輪；重點是 <b>child 從 fork() 返回後也會繼續跑剩下的迴圈</b>，因為它複製了 parent 的整個位址空間，包括變數 i 和「下一行要執行哪裡」（PC）。`, L("for (int i = 0; i < n; i++)")));
      for (let i = 0; i < n; i++) {
        const cur = P.slice();
        P.forEach((p) => { p.i = i; });
        r.push(frame(title, `i = ${i}：目前有 ${cur.length} 個 process（${ids(cur)}），<b>每一個</b>都執行 fork()。`, L("fork();"), { active: setOf(cur) }));
        const born = cur.map((p) => spawn(p));
        r.push(frame(title, `fork 完：每個 process 各多一個 child（紫色 ${ids(born)}），數量從 ${cur.length} 變成 ${P.length} = 2<sup>${i + 1}</sup>。parent 拿到 child 的 PID、child 拿到 0，但這段程式沒有檢查回傳值，所以兩邊都繼續下一輪；child 的 i 也是複製來的 = ${i}。`, L("fork();"), { fresh: setOf(born) }));
        if (withPrint) {
          addOut(String(i), P.length);
          r.push(frame(title, `每個 process 都執行 printf，印出自己的 i = ${i}：這一輪印 <b>${P.length}</b> 行（= 2<sup>${i + 1}</sup>）。到目前為止共印 ${tally.reduce((s, t) => s + t[1], 0)} 行。`, L("printf(\"%d\\n\", i);"), { printed: setOf(P) }));
        }
      }
      if (n === 0) r.push(frame(title, `n = 0：迴圈一次都沒跑，沒有 fork，只有 P0 一個 process。`, L("for (int i = 0; i < n; i++)")));
      if (!withPrint) {
        addOut("hello", P.length);
        P.forEach((p) => { p.sub = ""; });
        r.push(frame(title, `迴圈結束，${P.length} 個 process 各印一次 hello，共 <b>${P.length}</b> 行。`, L("printf(\"hello\\n\");"), { printed: setOf(P) }));
        r.push(frame(title, `<b>總結</b>：迴圈裡 fork ${n} 次、沒有 if 擋住 → 共 2<sup>${n}</sup> = <b>${P.length}</b> 個 process（含原本的 P0），新建立的是 2<sup>${n}</sup> − 1 = ${P.length - 1} 個。考題問「建立了幾個」還是「共有幾個」要看清楚。`, null, { printed: setOf(P) }));
      } else {
        const tot = tally.reduce((s, t) => s + t[1], 0);
        r.push(frame(title, n === 0 ? "<b>總結</b>：n = 0，沒有 fork 也沒有印任何東西，只有 P0。" : `<b>總結</b>：第 i 輪之後有 2<sup>i+1</sup> 個 process，每個印一行，所以總行數 = 2 + 4 + … + 2<sup>${n}</sup> = 2<sup>${n + 1}</sup> − 2 = <b>${tot}</b>；process 共 2<sup>${n}</sup> = ${P.length} 個。`, null, { printed: setOf(P) }));
      }
      return r.frames;
    }

    function runAndOr() {
      const C = CODE_ANDOR, L = (s) => lnIn(C, s);
      const title = "if ((fork() && fork()) || fork()) printf(\"T\\n\"); else printf(\"F\\n\");";
      P = [{ id: 0, parent: null, sub: "", done: false, stage: "A" }]; tally = [];
      const r = new Recorder();
      r.push(frame(title, "P0 開始算 <code>(A &amp;&amp; B) || C</code>，A、B、C 各是一次 fork()。<b>短路求值</b>：&amp;&amp; 左邊是 0（假）就不算右邊；|| 左邊非 0（真）就不算右邊。每個 process 只會走到它需要算的那幾個 fork。", L("if ((fork() && fork()) || fork())")));
      const nameOf = { A: "第 1 個 fork（A）", B: "第 2 個 fork（B）", C: "第 3 個 fork（C）" };
      let round = 0;
      while (P.some((p) => !p.done) && round < 5) {
        round++;
        const cur = P.filter((p) => !p.done);
        r.push(frame(title, `第 ${round} 輪：還沒算完的是 ${cur.map((p) => `P${p.id} 要做${nameOf[p.stage]}`).join("；")}。`, L("if ((fork() && fork()) || fork())"), { active: setOf(cur) }));
        const born = [], notes = [];
        cur.forEach((p) => {
          const st = p.stage, c = spawn(p);
          born.push(c);
          // parent 拿到 PID（非 0，真）；child 拿到 0（假）
          const step = (q, val) => {
            q.sub = (q.sub ? q.sub + " " : "") + st + (val ? "≠0" : "=0");
            if (st === "A") q.stage = val ? "B" : "C";
            else if (st === "B") { if (val) { q.done = true; q.res = "T"; } else q.stage = "C"; }
            else { q.done = true; q.res = val ? "T" : "F"; }
          };
          step(p, true); step(c, false);
          const say = (q) => (q.done ? `P${q.id} 結果為${q.res === "T" ? "真" : "假"}` : `P${q.id} 接著做${nameOf[q.stage]}`);
          notes.push(`P${p.id} 的 ${st} 回傳 child PID（真）→ ${say(p)}；新的 P${c.id} 的 ${st} 回傳 0（假）→ ${say(c)}`);
        });
        r.push(frame(title, notes.join("。<br>") + "。", L("if ((fork() && fork()) || fork())"), { fresh: setOf(born) }));
      }
      const T = P.filter((p) => p.res === "T"), F = P.filter((p) => p.res === "F");
      addOut("T", T.length); addOut("F", F.length);
      r.push(frame(title, `全部算完：${ids(T)} 的條件為真，印 T；${ids(F)} 為假，印 F。`, [L("printf(\"T\\n\");"), L("printf(\"F\\n\");")], { printed: setOf(P) }));
      r.push(frame(title, `<b>總結</b>：共 <b>${P.length}</b> 個 process（新建 ${P.length - 1} 個），T ×${T.length}、F ×${F.length}。只要記住「parent 拿到非 0、child 拿到 0」，再照短路規則決定每個 process 還要不要做下一個 fork。`, null, { printed: setOf(P) }));
      return r.frames;
    }

    function runFanChain(n, fan) {
      const C = fan ? CODE_FAN : CODE_CHAIN, L = (s) => lnIn(C, s);
      const title = fan ? `for (i = 0; i < ${n}; i++) if (fork() == 0) break;  printf("i=%d\\n", i);` : `for (i = 0; i < ${n}; i++) if (fork() > 0) break;  printf("i=%d\\n", i);`;
      P = [{ id: 0, parent: null, i: 0, sub: "", done: false }]; tally = [];
      const r = new Recorder();
      r.push(frame(title, fan ? "fan：<b>child 一出生就 break</b>，只有原本的 P0 一直留在迴圈裡 fork，所以行程樹是一個 parent 帶一排 child。" : "chain：<b>parent fork 完就 break</b>，換剛出生的 child 接著 fork，所以行程樹是一條鏈。", L("for (i = 0; i < n; i++)")));
      let looper = P[0];
      for (let i = 0; i < n; i++) {
        r.push(frame(title, `i = ${i}：還在迴圈裡的只有 P${looper.id}，它執行 fork()。`, L(fan ? "if (fork() == 0) break;" : "if (fork() > 0) break;"), { active: new Set([looper.id]) }));
        const c = spawn(looper);
        if (fan) {
          c.i = i; c.sub = "i=" + i; c.done = true;
          r.push(frame(title, `P${c.id} 是 child，fork() 回傳 0 → <b>break</b>，i 停在 ${i}；P${looper.id} 拿到 PID（不是 0），繼續下一輪。`, L("if (fork() == 0) break;"), { fresh: new Set([c.id]) }));
        } else {
          looper.i = i; looper.sub = "i=" + i; looper.done = true;
          r.push(frame(title, `P${looper.id} 是 parent，fork() 回傳 child 的 PID（> 0）→ <b>break</b>，i 停在 ${i}；child P${c.id} 拿到 0，繼續下一輪。`, L("if (fork() > 0) break;"), { fresh: new Set([c.id]) }));
          looper = c;
        }
      }
      looper.i = n; looper.sub = "i=" + n;
      if (n === 0) r.push(frame(title, "n = 0：迴圈條件一開始就不成立，沒有 fork。", L("for (i = 0; i < n; i++)")));
      P.slice().sort((a, b) => a.i - b.i).forEach((p) => addOut("i=" + p.i, 1));
      r.push(frame(title, `迴圈結束（P${looper.id} 是因為 i = ${n} 不再小於 n 而離開，其他的是 break 出來的）。每個 process 印出自己的 i：${P.map((p) => `P${p.id} 印 i=${p.i}`).join("、")}。`, L("printf(\"i=%d\\n\", i);"), { printed: setOf(P) }));
      r.push(frame(title, `<b>總結</b>：每一輪只有 1 個 process 在 fork，共 n + 1 = <b>${P.length}</b> 個 process，不是 2<sup>n</sup>。${fan ? "P0 是所有其他 process 的 parent（樹高 1）。" : "每個 process 只有一個 child（樹高 n = " + n + "）。"} 每個 process 的 i 各自獨立，所以印出的 i 都不一樣。`, null, { printed: setOf(P) }));
      return r.frames;
    }

    let cur = 0;
    const inN = ui.input(player, { placeholder: "n（0～4）", value: "3", width: 70 });
    inN.title = "迴圈次數 n（0～4）；&& 與 || 不用 n";
    function err(msg) {
      P = []; tally = [];
      player.load([{ nodes: [], edges: [], labels: [], caption: `${iconHTML("alert")} ${msg}`, line: null }], { autoplay: false });
    }
    function go(k) {
      if (k !== undefined) {
        cur = k;
        btns.forEach((b, i) => { b.classList.toggle("primary", i === cur); b.classList.toggle("ghost", i !== cur); });
      }
      const pr = PRESETS[cur];
      player.setCode(pr.code);
      let n = 0;
      if (pr.usesN) {
        const raw = inN.value.trim();
        n = ui.int(inN, { min: 0, max: 4 });
        if (n === null) {
          if (/^\d+$/.test(raw) && Number(raw) > 4) return err(`n = ${esc(raw)} 太大：n = 4 就有 2<sup>4</sup> = 16 個 process，再多畫面放不下。請輸入 0～4。`);
          return err(`看不懂「${esc(raw)}」：n 請輸入 0～4 的整數。`);
        }
      }
      const fr = pr.key === "loop" ? runLoop(n, false) : pr.key === "print" ? runLoop(n, true) : pr.key === "andor" ? runAndOr() : runFanChain(n, pr.key === "fan");
      player.load(fr);
    }
    const btns = PRESETS.map((pr, i) => ui.button(player, pr.name, () => go(i), i === 0 ? "primary" : "ghost"));
    ui.button(player, "執行", () => go());
    ui.button(player, "例：考古 fork 4 次", () => { inN.value = "4"; go(0); }, "ghost");

    const demo = runLoop(3, false);
    demo[0].caption = iconHTML("play") + " 按播放看示範：迴圈裡 fork 3 次。上方按鈕切換五段程式（迴圈 fork、迴圈內 printf、&amp;&amp; 與 ||、fan、chain），輸入框改迴圈次數 n（0～4）後按「執行」。";
    player.load(demo, { autoplay: false });
  });

  // ===================== process-states =====================
  const ST = ["NEW", "READY", "RUNNING", "WAITING", "TERMINATED", "READY_SUSPEND", "BLOCKED_SUSPEND"];
  const SN = ["new", "ready", "running", "waiting", "terminated", "ready/suspend", "blocked/suspend"];
  const EV = ["ADMIT", "DISPATCH", "TIMEOUT", "IO_WAIT", "IO_DONE", "EXIT", "SUSPEND", "RESUME"];
  const EN = ["admit", "dispatch", "timeout", "io", "done", "exit", "suspend", "resume"];
  const ALIAS = { admit: 0, dispatch: 1, timeout: 2, interrupt: 2, int: 2, io: 3, wait: 3, io_wait: 3, done: 4, iodone: 4, io_done: 4, wake: 4, wakeup: 4, exit: 5, suspend: 6, resume: 7, activate: 7 };
  // 和 process-concept.c 的 transition() 相同
  const TR = {
    0: { 0: 1 }, 1: { 1: 2, 6: 5 }, 2: { 2: 1, 3: 3, 5: 4 }, 3: { 4: 1, 6: 6 }, 4: {}, 5: { 7: 1 }, 6: { 4: 5, 7: 3 },
  };
  const WHO = {
    "0,0": "long-term scheduler（job scheduler）允許它進入記憶體、加入 ready queue。",
    "1,1": "short-term scheduler（CPU scheduler）從 ready queue 選中它，dispatcher 做 context switch 把 CPU 交給它。",
    "1,6": "記憶體不夠時，medium-term scheduler 把它整個換出（swap out）到磁碟。",
    "2,2": "timer interrupt：time quantum 用完，被搶先（preempt），回到 ready queue 排隊。",
    "2,3": "它發出 I/O 請求（或 wait()、blocking receive 等），要等事件完成，進入該裝置的 wait queue，CPU 交給別人。",
    "2,5": "它呼叫 exit()（或執行到 main 的 return）。資源被回收，但 PCB 留著結束碼，等 parent wait() 收屍。",
    "3,4": "I/O 完成、裝置發出 interrupt，kernel 把它移回 ready queue；<b>還要等排程器選中才會 running</b>。",
    "3,6": "它在等 I/O，又佔著記憶體，medium-term scheduler 把它換出到磁碟。",
    "5,7": "記憶體空出來了，medium-term scheduler 把它換回（swap in）記憶體，回到 ready。",
    "6,4": "它等的事件在它還在磁碟上時就完成了：不用再等，但人還沒回到記憶體，所以變 ready/suspend。",
    "6,7": "換回記憶體，但事件還沒完成，回到 waiting 繼續等。",
  };
  const WANT = { 0: 1, 1: 2, 2: 1, 3: 3, 4: 1, 5: 4 };   // 事件「想要」去的狀態，畫非法轉移用
  function whyIllegal(s, e, seven) {
    if (s === 4) return "process 已經 terminated（zombie 只剩 PCB 等 parent 回收），不能再被排程或復活。";
    if (!seven && e >= 6) return "五狀態模型沒有 suspend／resume，請先按「七狀態」切換。";
    const k = s + "," + e;
    const M = {
      "3,1": "waiting 的 process 還在等 I/O，排程器只從 <b>ready queue</b> 挑人；要先 done（I/O 完成）回到 ready，才可能被 dispatch。",
      "1,3": "ready 的 process 根本沒在 CPU 上執行，不可能發出 I/O 請求；只有 running 才會進 waiting。",
      "1,2": "ready 的 process 沒在用 CPU，談不上 time quantum 用完。",
      "3,2": "waiting 的 process 沒在用 CPU，timer interrupt 不會影響它。",
      "2,4": "running 的 process 沒有在等事件。別的 process 的 I/O 完成時，會發 device interrupt 打斷它去跑 ISR，但它<b>不會因此進 waiting</b>，處理完繼續 running 或被搶先回 ready。",
      "2,1": "已經在 running 了。",
      "1,4": "ready 的 process 沒有在等事件。",
      "0,1": "new 的 process 還沒被 admit 進 ready queue，不能直接執行。",
      "1,5": "標準五狀態圖只有 running → terminated：要在 CPU 上執行 exit() 才會結束（被別的 process kill 是另一回事）。",
      "3,5": "waiting 的 process 沒在執行，不會自己呼叫 exit()。",
      "2,6": "這個模型只把 ready 和 waiting 換出；（有些版本也畫 running → ready/suspend）。",
      "5,1": "ready/suspend 的 process 在磁碟上，要先 resume 換回記憶體才能被 dispatch。",
      "6,1": "blocked/suspend 既在磁碟上、事件也還沒完成，不能執行。",
    };
    return M[k] || `${SN[s]} 狀態下不會發生 ${EN[e]}。`;
  }

  register("process-states", function (root) {
    const W = 720, H = 420;
    const player = new Player(root, {
      title: "Process States 行程狀態轉移",
      width: W, height: H, code: CODE_STATE, wide: true,
      legend: [["active", "目前狀態／剛走過的轉移"], ["visited", "走過的狀態"], ["removed", "非法轉移"], ["default", "其他狀態"]],
    });
    const lineFor = (s, e) => {
      const c = CODE_STATE.findIndex((l) => l.includes("case " + ST[s] + ":"));
      for (let i = c + 1; i < CODE_STATE.length && !CODE_STATE[i].includes("break;"); i++)
        if (CODE_STATE[i].includes("ev == " + EV[e] + ")")) return [c + 1, i + 1];
      return [c + 1, lnIn(CODE_STATE, "return -1;")];
    };
    const POS5 = [[90, 84], [250, 190], [480, 190], [365, 300], [640, 84], [0, 0], [0, 0]];
    const POS7 = [[90, 84], [250, 190], [480, 190], [365, 300], [640, 84], [110, 300], [200, 385]];
    // [from, to, 事件文字, 標籤位置 dx, dy]
    const EDGES = [[0, 1, "admit", -22, -12], [1, 2, "dispatch", 0, -16], [2, 1, "timeout", 0, 16], [2, 3, "io／wait", 46, 0], [3, 1, "done", -40, 0], [2, 4, "exit", 22, -12],
      [1, 5, "suspend", -44, 0], [5, 1, "resume", 40, -10], [3, 6, "suspend", 32, 30], [6, 5, "done", -42, 0], [6, 3, "resume", -30, -30]];

    let seven = false;
    function frame(caption, line, s, opt) {
      opt = opt || {};
      const POS = seven ? POS7 : POS5, n = seven ? 7 : 5;
      const nodes = [], edges = [], labels = [];
      for (let k = 0; k < n; k++) {
        const st = k === s ? "active" : opt.seen && opt.seen.has(k) ? "visited" : "default";
        nodes.push({ id: "s" + k, label: SN[k], shape: "box", w: k >= 5 ? 140 : 112, h: 36, x: POS[k][0], y: POS[k][1], state: st });
      }
      EDGES.forEach(([a, b, t, dx, dy], i) => {
        if (a >= n || b >= n) return;
        const on = opt.took && opt.took[0] === a && opt.took[1] === b;
        edges.push({ from: "s" + a, to: "s" + b, directed: true, state: on ? "active" : "default" });
        labels.push({ id: "e" + i, x: (POS[a][0] + POS[b][0]) / 2 + dx, y: (POS[a][1] + POS[b][1]) / 2 + dy, text: t, anchor: "middle" });
      });
      if (opt.bad) edges.push({ from: "s" + opt.bad[0], to: "s" + opt.bad[1], directed: true, dashed: true, state: "removed" });
      if (opt.bad) labels.push({ id: "badl", x: W - 16, y: 230, text: `${SN[opt.bad[0]]} → ${SN[opt.bad[1]]}：不存在`, cls: "warn", anchor: "end" });
      nodes.push({ id: "proc", label: "P", shape: "circle", r: 14, x: POS[s][0] - (s === 6 ? 92 : 0), y: POS[s][1] - (s === 6 ? 0 : 40), state: opt.bad ? "removed" : "compare" });
      labels.push({ id: "ttl", x: 16, y: 20, text: seven ? "七狀態（含 suspend）" : "五狀態模型", cls: "title", anchor: "start" });
      labels.push({ id: "ev", x: W - 16, y: 20, text: opt.evText || "", cls: "strong", anchor: "end" });
      return { nodes, edges, labels, caption, line };
    }

    function run(evs) {
      const r = new Recorder();
      let s = 0;
      const seen = new Set([0]);
      r.push(frame(`process 剛被建立（fork() 之後），處於 <b>new</b>：OS 正在幫它配置 PCB 與記憶體，還不能被排程。接下來依序發生 ${evs.length} 個事件：${evs.map((e) => EN[e]).join(" → ") || "（沒有）"}。`, null, s, { seen }));
      for (let i = 0; i < evs.length; i++) {
        const e = evs[i], t = !seven && e >= 6 ? undefined : TR[s][e];
        const evText = `事件 ${i + 1}/${evs.length}：${EN[e]}`;
        if (t === undefined) {
          const want = e === 6 ? (s === 3 ? 6 : 5) : e === 7 ? 1 : WANT[e];
          const bad = want !== undefined && want !== s && want < (seven ? 7 : 5) ? [s, want] : null;
          r.push(frame(`${iconHTML("alert")} <b>非法轉移</b>：${whyIllegal(s, e, seven)} <code>transition()</code> 回傳 −1，模擬停在這裡。`, lineFor(s, e), s, { seen, bad, evText }));
          return r.frames;
        }
        const from = s;
        s = t; seen.add(s);
        r.push(frame(`<b>${SN[from]} → ${SN[s]}</b>（${EN[e]}）：${WHO[from + "," + e]}`, lineFor(from, e), s, { seen, took: [from, s], evText }));
      }
      const tail = s === 4 ? "process 已結束。" : `最後停在 <b>${SN[s]}</b>。`;
      r.push(frame(`<b>總結</b>：${tail} 記住三條規則：只有 running 會進 waiting；waiting 一定先回 ready；ready 和 running 之間來回是排程器（dispatch）和 interrupt（timeout）的事。`, null, s, { seen }));
      return r.frames;
    }

    const inE = ui.input(player, { placeholder: "事件，例如 admit dispatch io done", value: "admit dispatch io done dispatch timeout dispatch exit", width: 260 });
    inE.title = "事件：admit dispatch timeout io done exit suspend resume，用空白隔開（最多 14 個）";
    function err(msg) {
      player.load([{ nodes: [], edges: [], labels: [], caption: `${iconHTML("alert")} ${msg}`, line: null }], { autoplay: false });
    }
    function go(mode) {
      if (mode !== undefined) {
        seven = mode;
        mb[0].classList.toggle("primary", !seven); mb[0].classList.toggle("ghost", seven);
        mb[1].classList.toggle("primary", seven); mb[1].classList.toggle("ghost", !seven);
      }
      const raw = inE.value.trim();
      if (!raw) return err("請輸入至少一個事件，例如 <code>admit dispatch exit</code>。");
      const toks = raw.toLowerCase().split(/[\s,，→>-]+/).filter(Boolean);
      const bad = toks.find((t) => !(t in ALIAS));
      if (bad !== undefined) return err(`看不懂事件「${esc(bad)}」。可用的事件：admit、dispatch、timeout、io、done、exit、suspend、resume。`);
      if (toks.length > 14) return err(`事件有 ${toks.length} 個，最多 14 個，請分段輸入。`);
      player.load(run(toks.map((t) => ALIAS[t])));
    }
    const mb = [ui.button(player, "五狀態", () => go(false), "primary"), ui.button(player, "七狀態", () => go(true), "ghost")];
    ui.button(player, "執行", () => go());
    ui.button(player, "例：一般流程", () => { inE.value = "admit dispatch io done dispatch timeout dispatch exit"; go(false); }, "ghost");
    ui.button(player, "例：waiting → running", () => { inE.value = "admit dispatch io dispatch"; go(false); }, "ghost");
    ui.button(player, "例：ready → waiting", () => { inE.value = "admit io"; go(false); }, "ghost");
    ui.button(player, "例：suspend", () => { inE.value = "admit dispatch io suspend done resume dispatch exit"; go(true); }, "ghost");

    const demo = run([0, 1, 3, 4, 1, 2, 1, 5]);
    demo[0].caption = iconHTML("play") + " 按播放看示範：admit → dispatch → io → done → dispatch → timeout → dispatch → exit。輸入框可以自己排事件（admit、dispatch、timeout、io、done、exit、suspend、resume），按「七狀態」加入 suspend。";
    player.load(demo, { autoplay: false });
  });

  // ===================== 靜態圖 =====================
  // 圖 1：行程的記憶體配置
  figure("process-concept-memory", () => {
    const nodes = [], edges = [], labels = [];
    const X = 230, BW = 230;
    const segs = [
      ["args", "參數與環境變數", 46, "muted"], ["stack", "stack", 46, "compare"], ["gap", "", 70, "ghost"],
      ["heap", "heap", 46, "active"], ["bss", "BSS（未初始化 data）", 40, "default"], ["data", "initialized data", 40, "default"], ["text", "text（程式碼）", 46, "found"],
    ];
    let y = 44, gy = 0;
    const note = {
      args: "argc、argv、環境變數",
      stack: "區域變數、參數、返回位址；往下長",
      gap: "空白：stack 和 heap 往中間長",
      heap: "malloc／new 配置；往上長",
      bss: "int g;　static int c;（初值 0）",
      data: "int g = 5;（有初值的 global、static）",
      text: "機器碼、唯讀常數；可共用、唯讀",
    };
    segs.forEach(([id, t, h, st]) => {
      nodes.push({ id, label: t, shape: "box", w: BW, h, x: X, y: y + h / 2, state: st });
      if (id === "gap") gy = y;
      if (note[id]) labels.push({ id: "n" + id, x: X + BW / 2 + 22, y: y + h / 2, text: note[id], anchor: "start" });
      y += h + 6;
    });
    labels.push({ id: "hi", x: X - BW / 2 - 12, y: 52, text: "高位址", cls: "strong", anchor: "end" });
    labels.push({ id: "lo", x: X - BW / 2 - 12, y: y - 14, text: "低位址", cls: "strong", anchor: "end" });
    labels.push({ id: "dn", x: X, y: gy + 16, text: "↓ stack 往下長", anchor: "middle" });
    labels.push({ id: "up", x: X, y: gy + 54, text: "↑ heap 往上長", anchor: "middle" });
    return { width: 680, height: y + 10, nodes, edges, labels };
  });

  // 圖 2：五狀態圖與兩個不存在的轉移
  figure("process-concept-states", () => {
    const P = [[90, 70], [240, 180], [480, 180], [360, 300], [630, 70]];
    const nodes = SN.slice(0, 5).map((t, k) => ({ id: "s" + k, label: t, shape: "box", w: 112, h: 36, x: P[k][0], y: P[k][1], state: k === 2 ? "compare" : "default" }));
    const edges = [], labels = [];
    const E = [[0, 1, "admitted", -44, -6], [1, 2, "scheduler dispatch", 0, -16], [2, 1, "interrupt（timeout）", 0, 16], [2, 3, "I/O 或等待事件", 74, 0], [3, 1, "I/O 或事件完成", -76, 0], [2, 4, "exit", 30, 8]];
    E.forEach(([a, b, t, dx, dy], i) => {
      edges.push({ from: "s" + a, to: "s" + b, directed: true, state: "found" });
      labels.push({ id: "l" + i, x: (P[a][0] + P[b][0]) / 2 + dx, y: (P[a][1] + P[b][1]) / 2 + dy, text: t });
    });
    // 不存在的轉移（虛線）：畫成獨立的節點避免和實線重疊
    nodes.push({ id: "x1", label: "ready → waiting", shape: "box", w: 150, h: 30, x: 110, y: 360, state: "removed" });
    nodes.push({ id: "x2", label: "waiting → running", shape: "box", w: 160, h: 30, x: 600, y: 360, state: "removed" });
    labels.push({ id: "x1t", x: 110, y: 330, text: "不存在：沒在跑，發不出 I/O", cls: "warn" });
    labels.push({ id: "x2t", x: 600, y: 330, text: "不存在：要先回 ready", cls: "warn" });
    return { width: 720, height: 390, nodes, edges, labels };
  });

  // 圖 3：context switch
  figure("process-concept-context-switch", () => {
    const nodes = [], edges = [], labels = [];
    labels.push({ id: "h0", x: 110, y: 22, text: "P0", cls: "strong" });
    labels.push({ id: "h1", x: 340, y: 22, text: "OS（kernel）", cls: "strong" });
    labels.push({ id: "h2", x: 570, y: 22, text: "P1", cls: "strong" });
    const row = (i) => 62 + i * 50;
    nodes.push({ id: "a0", label: "執行中", shape: "box", w: 120, h: 34, x: 110, y: row(0), state: "active" });
    nodes.push({ id: "b0", label: "閒置", shape: "box", w: 120, h: 34, x: 570, y: row(0), state: "muted" });
    nodes.push({ id: "k1", label: "存 P0 的狀態到 PCB0", shape: "box", w: 190, h: 34, x: 340, y: row(1), state: "compare" });
    nodes.push({ id: "k2", label: "從 PCB1 載入 P1 的狀態", shape: "box", w: 190, h: 34, x: 340, y: row(2), state: "compare" });
    nodes.push({ id: "b1", label: "執行中", shape: "box", w: 120, h: 34, x: 570, y: row(3), state: "active" });
    nodes.push({ id: "a1", label: "閒置", shape: "box", w: 120, h: 34, x: 110, y: row(3), state: "muted" });
    nodes.push({ id: "k3", label: "存 P1 的狀態到 PCB1", shape: "box", w: 190, h: 34, x: 340, y: row(4), state: "compare" });
    nodes.push({ id: "k4", label: "從 PCB0 載入 P0 的狀態", shape: "box", w: 190, h: 34, x: 340, y: row(5), state: "compare" });
    nodes.push({ id: "a2", label: "執行中", shape: "box", w: 120, h: 34, x: 110, y: row(6), state: "active" });
    edges.push({ from: "a0", to: "k1", directed: true }); edges.push({ from: "k1", to: "k2", directed: true }); edges.push({ from: "k2", to: "b1", directed: true });
    edges.push({ from: "b1", to: "k3", directed: true }); edges.push({ from: "k3", to: "k4", directed: true }); edges.push({ from: "k4", to: "a2", directed: true });
    labels.push({ id: "t1", x: 110, y: row(0) + 30, text: "interrupt／system call", anchor: "middle" });
    labels.push({ id: "t2", x: 570, y: row(3) + 30, text: "interrupt／system call", anchor: "middle" });
    labels.push({ id: "ov", x: 340, y: row(6) + 44, text: "藍色區段 CPU 沒有在跑任何使用者程式：純 overhead", cls: "warn" });
    return { width: 700, height: row(6) + 64, nodes, edges, labels };
  });

  // 圖 4：Linux 的行程樹
  figure("process-concept-tree", () => {
    const N = [["sd", "systemd（1）", 360, 50, "compare"], ["kt", "kthreadd（2）", 600, 50, "muted"], ["lg", "login（980）", 160, 140, "default"], ["sh", "sshd（730）", 400, 140, "default"],
      ["b1", "bash（1205）", 160, 230, "default"], ["s2", "sshd（3010）", 400, 230, "default"], ["vi", "vim（1300）", 90, 320, "default"], ["ps", "ps（1311）", 230, 320, "active"], ["b2", "bash（3015）", 400, 320, "default"],
      ["k1", "kworker", 545, 140, "muted"], ["k2", "ksoftirqd", 660, 140, "muted"]];
    const nodes = N.map(([id, t, x, y, st]) => ({ id, label: t, shape: "box", w: id === "kt" || id === "sd" ? 140 : id[0] === "k" ? 104 : 124, h: 34, x, y, state: st }));
    const edges = [["sd", "lg"], ["sd", "sh"], ["lg", "b1"], ["sh", "s2"], ["b1", "vi"], ["b1", "ps"], ["s2", "b2"], ["kt", "k1"], ["kt", "k2"]].map(([a, b]) => ({ from: a, to: b, directed: true }));
    const labels = [{ id: "n1", x: 380, y: 376, text: "括號內是 PID；箭頭從 parent 指向 child", anchor: "middle" }, { id: "n2", x: 600, y: 196, text: "kernel thread 的祖先", anchor: "middle" }];
    return { width: 720, height: 392, nodes, edges, labels };
  });

  // 圖 5：zombie 與 orphan
  figure("process-concept-zombie-orphan", () => {
    const nodes = [], edges = [], labels = [];
    labels.push({ id: "a", x: 170, y: 22, text: "(a) zombie：child 先結束", cls: "title" });
    labels.push({ id: "b", x: 520, y: 22, text: "(b) orphan：parent 先結束", cls: "title" });
    nodes.push({ id: "p", label: "parent（還在跑，沒 wait）", shape: "box", w: 210, h: 36, x: 170, y: 80, state: "active" });
    nodes.push({ id: "c", label: "child：Z（zombie）", shape: "box", w: 190, h: 36, x: 170, y: 180, state: "removed" });
    edges.push({ from: "p", to: "c", directed: true, state: "removed" });
    labels.push({ id: "c1", x: 170, y: 224, text: "只剩 PCB：PID、結束碼", anchor: "middle" });
    labels.push({ id: "c2", x: 170, y: 248, text: "parent 呼叫 wait() 才釋放", anchor: "middle" });
    nodes.push({ id: "i", label: "init／systemd（1）", shape: "box", w: 170, h: 36, x: 600, y: 80, state: "found" });
    nodes.push({ id: "q", label: "parent（已結束）", shape: "box", w: 160, h: 36, x: 420, y: 80, state: "ghost" });
    nodes.push({ id: "o", label: "child：orphan", shape: "box", w: 160, h: 36, x: 520, y: 180, state: "compare" });
    edges.push({ from: "q", to: "o", directed: true, dashed: true, state: "muted" });
    edges.push({ from: "i", to: "o", directed: true, state: "found" });
    labels.push({ id: "o1", x: 520, y: 224, text: "被 init 收養（reparent）", anchor: "middle" });
    labels.push({ id: "o2", x: 520, y: 248, text: "init 定期 wait()，不會留下 zombie", anchor: "middle" });
    return { width: 700, height: 266, nodes, edges, labels };
  });
})();
