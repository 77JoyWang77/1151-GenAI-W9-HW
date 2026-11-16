/* =====================================================================
   CPU Scheduling（CPU 排程演算法）主題的視覺化
   - cpu-scheduling : FCFS / SJF / SRTF / Priority / 搶先式 Priority / RR，畫出甘特圖並計算等待時間
   ===================================================================== */
(function () {
  "use strict";
  const { Player, Recorder, ui, register, esc, iconHTML, figure } = window.DSViz;

  // 右側程式碼：從 code/operating-systems/cpu-scheduling.c 原封不動取出
  const CODE = {
      "np": [
          "void nonPreemptive(int alg) {",
          "  int t = 0, done = 0;",
          "  reset();",
          "  while (done < n) {",
          "    int i = pick(t, alg);",
          "    if (i == -1) { gantt[t++] = -1; continue; }   /* 沒有行程到達：CPU 閒置 */",
          "    p[i].start = t;",
          "    while (p[i].remain > 0) {                  /* 一旦開始就做到完 */",
          "      gantt[t++] = i;",
          "      p[i].remain--;",
          "    }",
          "    p[i].finish = t;",
          "    done++;",
          "  }",
          "  len = t;",
          "}"
      ],
      "pre": [
          "void preemptive(int alg) {",
          "  int t = 0, done = 0, cur = -1;",
          "  reset();",
          "  while (done < n) {",
          "    int i = pick(t, alg);",
          "    if (cur != -1 && p[cur].remain > 0 && key(cur, alg) <= key(i, alg)) i = cur;   /* 平手不搶 */",
          "    if (i == -1) { gantt[t++] = -1; continue; }",
          "    if (p[i].start == -1) p[i].start = t;",
          "    gantt[t++] = i;                            /* 每個時間單位都重新挑一次 */",
          "    if (--p[i].remain == 0) { p[i].finish = t; done++; }",
          "    cur = i;",
          "  }",
          "  len = t;",
          "}"
      ],
      "rr": [
          "void roundRobin(int q) {",
          "  int queue[TMAX], front = 0, rear = 0;",
          "  int t = 0, done = 0, next = 0;               /* next：下一個還沒進 queue 的行程（依到達時間排序） */",
          "  reset();",
          "  while (done < n) {",
          "    while (next < n && p[next].arrival <= t) queue[rear++] = next++;   /* 新到的放進 queue 尾端 */",
          "    if (front == rear) { gantt[t++] = -1; continue; }",
          "    int i = queue[front++];",
          "    if (p[i].start == -1) p[i].start = t;",
          "    int run = p[i].remain < q ? p[i].remain : q;   /* 最多跑一個 time quantum */",
          "    for (int k = 0; k < run; k++) { gantt[t++] = i; p[i].remain--; }",
          "    while (next < n && p[next].arrival <= t) queue[rear++] = next++;   /* 這段時間內到達的先排進去 */",
          "    if (p[i].remain > 0) queue[rear++] = i;    /* 還沒做完：排到 queue 最後面 */",
          "    else { p[i].finish = t; done++; }",
          "  }",
          "  len = t;",
          "}"
      ]
  };
  const ALG = {
    fcfs: { name: "FCFS", code: "np", key: (p) => p.a, why: (p) => `最早到達（${p.a}）` },
    sjf: { name: "SJF", code: "np", key: (p) => p.rem, why: (p) => `burst 最短（${p.rem}）` },
    prio: { name: "Priority", code: "np", key: (p) => p.pr, why: (p) => `優先權最高（數字 ${p.pr} 最小）` },
    srtf: { name: "SRTF", code: "pre", key: (p) => p.rem, why: (p) => `剩餘時間最短（${p.rem}）` },
    pprio: { name: "搶先式 Priority", code: "pre", key: (p) => p.pr, why: (p) => `優先權最高（${p.pr}）` },
    rr: { name: "Round Robin", code: "rr" },
  };
  const LN = { np: { pick: 5, idle: 6, run: [7, 8, 9, 10], fin: [12, 13], end: 15 },
               pre: { pick: [5, 6], idle: 7, run: [8, 9], fin: 10, end: 13 },
               rr: { arrive: 6, idle: 7, take: [8, 9], run: [10, 11], back: [12, 13], fin: 14, end: 16 } };

  function parse(text) {
    const rows = text.trim().split(/\s*[;\n]\s*/).filter(Boolean);
    if (rows.length < 1 || rows.length > 6) return "請輸入 1～6 個行程，用分號 ; 隔開，例如：0 7 3; 2 4 1";
    const P = [];
    for (let k = 0; k < rows.length; k++) {
      const v = rows[k].split(/[\s,]+/).map(Number);
      if (v.length < 2 || v.length > 3 || v.some((x) => !Number.isInteger(x))) return `第 ${k + 1} 個行程「${esc(rows[k])}」格式不對：要寫「到達時間 burst [優先權]」，都是整數。`;
      const [a, b, pr = 0] = v;
      if (a < 0 || a > 20) return "到達時間請在 0～20 之間。";
      if (b < 1 || b > 15) return "burst 請在 1～15 之間。";
      if (pr < 0 || pr > 9) return "優先權請在 0～9 之間（數字越小越優先）。";
      P.push({ name: "P" + (k + 1), a, b, pr });
    }
    if (P.reduce((s, p) => s + p.b, 0) > 45) return "burst 總和請不要超過 45，甘特圖才放得下。";
    return P;
  }

  register("cpu-scheduling", function (root) {
    const player = new Player(root, {
      title: "CPU Scheduling 排程模擬",
      width: 680, height: 300, code: CODE.np,
      legend: [["compare", "正在執行"], ["active", "在 ready queue"], ["found", "已完成"], ["muted", "還沒到達"], ["new", "這次被選中"]],
    });

    let P = [], segs = [], total = 1, q = 3;
    const X0 = 40, GW = 600, GY = 205, GH = 34;
    const gx = (t) => X0 + (t / total) * GW;

    function frame(caption, line, opt = {}) {
      const t = opt.t ?? 0, ready = opt.ready || [], run = opt.run;
      const nodes = [], labels = [], edges = [];
      P.forEach((p, i) => {
        const y = 36 + i * 30;
        let st = p.a > t ? "muted" : p.rem === 0 ? "found" : ready.includes(i) ? "active" : "default";
        if (run === i) st = "compare";
        if (opt.pick === i) st = "new";
        nodes.push({ id: "pr" + i, label: p.name, shape: "box", x: 40, y, w: 40, h: 24, state: st });
        labels.push({ id: "pl" + i, x: 70, y: y + 4, text: `到達 ${p.a}　burst ${p.b}　剩 ${p.rem}${opt.showPr ? `　優先權 ${p.pr}` : ""}`, anchor: "start" });
      });
      labels.push({ id: "rqt", x: 330, y: 40, text: opt.rr ? "Ready queue（前 → 後）：" : "Ready（已到達、還沒做完）：", anchor: "start", cls: "title" });
      ready.forEach((i, k) => nodes.push({ id: "rq" + i, label: P[i].name, shape: "box", x: 350 + k * 46, y: 70, w: 40, h: 26, state: opt.pick === i ? "new" : "active" }));
      if (!ready.length) labels.push({ id: "rqe", x: 350, y: 75, text: "（空）", anchor: "start" });
      labels.push({ id: "now", x: 330, y: 122, text: `時間 t = ${t}`, anchor: "start", cls: "strong" });
      // 甘特圖
      labels.push({ id: "gt", x: X0, y: GY - 30, text: "Gantt chart", anchor: "start", cls: "title" });
      nodes.push({ id: "gbase", label: "", shape: "box", x: X0 + GW / 2, y: GY, w: GW, h: GH, state: "ghost" });
      const ticks = new Set([0]);
      segs.forEach((s, k) => {
        const w = Math.max(gx(s.e) - gx(s.s), 2);
        nodes.push({ id: "sg" + k, label: w > 22 ? (s.p === null ? "idle" : P[s.p].name) : "", shape: "box", x: (gx(s.s) + gx(s.e)) / 2, y: GY, w, h: GH, state: s.p === null ? "muted" : k === segs.length - 1 && opt.live ? "compare" : "default" });
        ticks.add(s.s); ticks.add(s.e);
      });
      [...ticks].forEach((v) => labels.push({ id: "tk" + v, x: gx(v), y: GY + 34, text: String(v) }));
      (opt.result || []).forEach((r, k) => labels.push({ id: "res" + k, x: X0, y: GY + 62 + k * 22, text: r, anchor: "start", cls: k === 0 ? "strong" : "" }));
      return { nodes, edges, labels, caption, line };
    }

    const addRun = (who, s, e) => { const last = segs[segs.length - 1]; if (last && last.p === who && last.e === s) last.e = e; else segs.push({ p: who, s, e }); };
    const stats = () => {
      const W = P.map((p) => p.fin - p.a - p.b), T = P.map((p) => p.fin - p.a), R = P.map((p) => p.start - p.a), n = P.length;
      const avg = (A) => (A.reduce((x, y) => x + y, 0) / n).toFixed(2);
      return [`平均等待 ${avg(W)}　平均周轉 ${avg(T)}　平均回應 ${avg(R)}`, `等待時間：${P.map((p, i) => `${p.name}=${W[i]}`).join("、")}`];
    };
    const arrived = (t) => P.map((p, i) => i).filter((i) => P[i].a <= t && P[i].rem > 0);
    const better = (alg, i, j) => { const k = ALG[alg].key; return k(P[i]) < k(P[j]) || (k(P[i]) === k(P[j]) && P[i].a < P[j].a); };
    const choose = (alg, t) => arrived(t).reduce((b, i) => (b === null || better(alg, i, b) ? i : b), null);

    function run(alg, input) {
      P = input.map((p) => Object.assign({}, p, { rem: p.b, start: -1, fin: 0 }));
      if (alg === "rr") P.sort((x, y) => x.a - y.a);   // 依到達時間排序（平手保持輸入順序）
      segs = []; total = Math.max(P.reduce((s, p) => s + p.b, 0) + Math.min(...P.map((p) => p.a)), 1);
      // 先算一次總長（含閒置），讓甘特圖比例固定
      total = simulateLength(alg);
      P.forEach((p) => { p.rem = p.b; p.start = -1; p.fin = 0; });
      player.setCode(CODE[ALG[alg].code]);
      const r = new Recorder(), showPr = alg === "prio" || alg === "pprio", ln = LN[ALG[alg].code];
      const F = (c, l, o = {}) => r.push(frame(c, l, Object.assign({ showPr }, o)));
      F(`${ALG[alg].name}：${{ fcfs: "誰先到誰先做，不可搶先", sjf: "挑 burst 最短的，不可搶先", prio: "挑優先權最高的（數字越小越優先），不可搶先", srtf: "每個時間點都挑剩餘時間最短的，新來的更短就搶先", pprio: "每個時間點都挑優先權最高的，新來的更高就搶先", rr: `每人輪流跑最多 q = ${q} 個時間單位，沒做完就排到 queue 尾端` }[alg]}。`, null, { t: 0 });
      let t = 0, done = 0;
      if (ALG[alg].code === "np") {
        while (done < P.length) {
          const i = choose(alg, t);
          if (i === null) { const nt = Math.min(...P.filter((p) => p.rem > 0).map((p) => p.a)); addRun(null, t, nt); F(`時間 ${t} 沒有行程到達，CPU <b>閒置</b>到 ${nt}。`, ln.idle, { t: nt }); t = nt; continue; }
          const rd = arrived(t);
          F(`時間 ${t}：ready 的有 ${rd.map((k) => P[k].name).join("、")}，挑${ALG[alg].why(P[i])}的 <b>${P[i].name}</b>。`, ln.pick, { t, ready: rd, pick: i });
          P[i].start = t; addRun(i, t, t + P[i].rem); t += P[i].rem; P[i].rem = 0; P[i].fin = t; done++;
          F(`${P[i].name} 不可搶先，一路做到完成，時間來到 ${t}。等待時間 = ${t} − ${P[i].a} − ${P[i].b} = ${t - P[i].a - P[i].b}。`, ln.run, { t, ready: arrived(t), run: i });
        }
      } else if (ALG[alg].code === "pre") {
        let cur = null;
        while (done < P.length) {
          let i = choose(alg, t);
          const keep = cur !== null && P[cur].rem > 0 && !better(alg, i, cur);
          if (keep) i = cur;
          if (i === null) { addRun(null, t, t + 1); t++; continue; }
          const newcomer = P.some((p) => p.a === t);
          if (t === 0 || i !== cur || newcomer || (cur !== null && P[cur].rem === 0)) {
            const rd = arrived(t);
            const msg = cur !== null && P[cur].rem > 0 && i !== cur
              ? `時間 ${t}：${P.filter((p) => p.a === t).map((p) => p.name).join("、")} 到達，${P[i].name} ${ALG[alg].why(P[i])}比正在跑的 ${P[cur].name}（${ALG[alg].key(P[cur])}）更好，<b>搶先</b>！`
              : cur !== null && P[cur].rem > 0 ? `時間 ${t}：有新行程到達，但 ${P[cur].name} 仍是${ALG[alg].why(P[cur])}，<b>繼續跑</b>（平手不搶）。`
              : `時間 ${t}：ready 的有 ${rd.map((k) => P[k].name).join("、")}，挑${ALG[alg].why(P[i])}的 <b>${P[i].name}</b>。`;
            F(msg, ln.pick, { t, ready: rd, pick: i, live: true });
          }
          if (P[i].start === -1) P[i].start = t;
          addRun(i, t, t + 1); t++; P[i].rem--;
          if (P[i].rem === 0) { P[i].fin = t; done++; F(`${P[i].name} 在時間 ${t} 完成。等待時間 = ${t} − ${P[i].a} − ${P[i].b} = ${t - P[i].a - P[i].b}。`, ln.fin, { t, ready: arrived(t), live: true }); }
          cur = i;
        }
      } else {
        const Q = []; let next = 0;
        const enq = (tt) => { while (next < P.length && P[next].a <= tt) Q.push(next++); };
        enq(0);
        while (done < P.length) {
          if (!Q.length) { const nt = P[next].a; addRun(null, t, nt); F(`queue 是空的，CPU <b>閒置</b>到 ${nt}。`, ln.idle, { t: nt, rr: true }); t = nt; enq(t); continue; }
          const i = Q.shift();
          if (P[i].start === -1) P[i].start = t;
          const len = Math.min(q, P[i].rem);
          F(`時間 ${t}：從 queue 前端取出 <b>${P[i].name}</b>（剩 ${P[i].rem}），這次跑 min(q, 剩餘) = ${len}。`, ln.take, { t, ready: Q.slice(), pick: i, rr: true });
          addRun(i, t, t + len); t += len; P[i].rem -= len;
          const before = next; enq(t);
          const came = P.slice(before, next).map((p) => p.name);
          if (P[i].rem > 0) {
            Q.push(i);
            F(`跑到時間 ${t}，quantum 用完但 ${P[i].name} 還剩 ${P[i].rem}。${came.length ? `這段時間內到達的 ${came.join("、")} 先排進 queue，` : ""}${P[i].name} 再排到<b>最後面</b>。`, ln.back, { t, ready: Q.slice(), run: i, rr: true });
          } else {
            P[i].fin = t; done++;
            F(`${P[i].name} 在時間 ${t} 做完。${came.length ? `期間到達的 ${came.join("、")} 已排進 queue。` : ""}等待時間 = ${t} − ${P[i].a} − ${P[i].b} = ${t - P[i].a - P[i].b}。`, ln.fin, { t, ready: Q.slice(), rr: true });
          }
        }
      }
      F(`全部完成！等待時間 = 完成 − 到達 − burst；周轉時間 = 完成 − 到達；回應時間 = 第一次執行 − 到達。`, ln.end, { t, result: stats(), rr: alg === "rr" });
      return r.frames;
    }

    function simulateLength(alg) {   // 用同樣規則先跑一次，取得總時間
      const save = segs; segs = [];
      const S = P.map((p) => Object.assign({}, p));
      let t = 0, done = 0;
      const rem = S.map((p) => p.b);
      if (alg === "rr") {
        const Q = []; let next = 0; const enq = (tt) => { while (next < S.length && S[next].a <= tt) Q.push(next++); };
        enq(0);
        while (done < S.length) { if (!Q.length) { t = S[next].a; enq(t); continue; } const i = Q.shift(); const l = Math.min(q, rem[i]); t += l; rem[i] -= l; enq(t); if (rem[i] > 0) Q.push(i); else done++; }
      } else {
        while (done < S.length) { const live = S.filter((p, i) => rem[i] > 0); const ready = live.filter((p) => p.a <= t); if (!ready.length) { t = Math.min(...live.map((p) => p.a)); continue; } const i = S.indexOf(ready[0]); t += 1; rem[i]--; if (rem[i] === 0) done++; }
      }
      segs = save;
      return Math.max(t, 1);
    }

    // ---------- 控制列 ----------
    const PRESETS = { "範例": "0 7 3; 2 4 1; 3 1 4; 5 6 2", "convoy": "0 20; 0 4; 0 2" };
    const input = ui.input(player, { placeholder: "到達 burst [優先權]; …", value: PRESETS["範例"], width: 200 });
    const qIn = ui.input(player, { placeholder: "q", value: "3", width: 46 });
    qIn.title = "Round Robin 的 time quantum";
    const go = (alg) => {
      const v = parse(input.value);
      if (typeof v === "string") { input.classList.add("is-error"); setTimeout(() => input.classList.remove("is-error"), 700); player.load([frame(`${iconHTML("alert")} ${v}`, null)], { autoplay: false }); return; }
      if (alg === "rr") { const qq = ui.int(qIn, { min: 1, max: 10 }); if (qq === null) { player.load([frame(`${iconHTML("alert")} time quantum 請輸入 1～10 的整數。`, null)], { autoplay: false }); return; } q = qq; }
      player.load(run(alg, v));
    };
    ["fcfs", "sjf", "srtf", "prio", "pprio", "rr"].forEach((a) => ui.button(player, ALG[a].name, () => go(a), "ghost"));
    ui.button(player, "convoy 範例", () => { input.value = PRESETS.convoy; go("fcfs"); }, "ghost");
    input.addEventListener("keydown", (e) => e.key === "Enter" && go("fcfs"));

    const demo = run("srtf", parse(PRESETS["範例"]));
    demo[0].caption = iconHTML("play") + " 按播放看 <b>SRTF</b> 的示範：P2 一到達就搶走 P1 的 CPU。可以改按 FCFS、SJF、Priority、RR 比較同一組行程的甘特圖和平均等待時間，也可以自己輸入行程（每個行程寫「到達時間 burst [優先權]」，用 ; 隔開）。";
    player.load(demo, { autoplay: false });
  });

  // ===================================================================
  // 靜態圖解
  // ===================================================================
  const box = (id, label, x, y, w, st) => ({ id, label, shape: "box", x, y, w, h: 34, state: st || "default" });
  const gantt = (pfx, y, x0, scale, parts) => {
    const nodes = [], labels = [];
    let t = 0;
    labels.push({ id: pfx + "t0", x: x0, y: y + 32, text: "0" });
    parts.forEach(([name, d, st], k) => {
      nodes.push(box(pfx + k, name, x0 + (t + d / 2) * scale, y, d * scale, st));
      t += d;
      labels.push({ id: pfx + "t" + (k + 1), x: x0 + t * scale, y: y + 32, text: String(t) });
    });
    return { nodes, labels };
  };

  // 圖 1：行程狀態
  figure("sched-states", () => ({
    width: 680, height: 260,
    nodes: [box("new", "new", 70, 60, 90, "muted"), box("ready", "ready", 250, 60, 100, "active"), box("run", "running", 450, 60, 110, "compare"),
            box("term", "terminated", 610, 60, 110, "found"), box("intr", "中斷", 350, 118, 64, "removed"), box("wait", "waiting", 350, 222, 110, "default")],
    edges: [{ from: "new", to: "ready", directed: true }, { from: "ready", to: "run", directed: true }, { from: "run", to: "term", directed: true },
            { from: "run", to: "intr", directed: true }, { from: "intr", to: "ready", directed: true },
            { from: "run", to: "wait", directed: true }, { from: "wait", to: "ready", directed: true }],
    labels: [
      { id: "l1", x: 160, y: 46, text: "admitted" },
      { id: "l2", x: 350, y: 26, text: "scheduler dispatch" },
            { id: "l4", x: 440, y: 172, text: "等 I/O 或事件", anchor: "start" },
      { id: "l5", x: 262, y: 172, text: "I/O 完成", anchor: "end" },
      { id: "l6", x: 610, y: 102, text: "exit" },
    ],
  }));

  // 圖 2：convoy effect
  figure("sched-convoy", () => {
    const a = gantt("a", 70, 40, 22, [["P1", 20, "active"], ["P2", 4], ["P3", 2]]);
    const b = gantt("b", 180, 40, 22, [["P3", 2, "found"], ["P2", 4, "found"], ["P1", 20]]);
    return {
      width: 680, height: 250, nodes: a.nodes.concat(b.nodes),
      labels: a.labels.concat(b.labels, [
        { id: "ta", x: 40, y: 34, text: "長的先到（FCFS）：平均等待 (0 + 20 + 24) / 3 ≈ 14.67", anchor: "start", cls: "warn" },
        { id: "tb", x: 40, y: 144, text: "短的先跑（SJF）：平均等待 (0 + 2 + 6) / 3 ≈ 2.67", anchor: "start", cls: "ok" },
      ]),
    };
  });

  // 圖 3：多層回饋佇列
  figure("sched-mlfq", () => {
    const nodes = [], labels = [], edges = [];
    const rows = [["Q0", "RR，q = 8", "compare"], ["Q1", "RR，q = 16", "active"], ["Q2", "FCFS", "default"]];
    rows.forEach(([name, rule, st], k) => {
      const y = 50 + k * 70;
      nodes.push(box("q" + k, name, 70, y, 70, st));
      for (let j = 0; j < 4; j++) nodes.push(box(`s${k}${j}`, "", 160 + j * 46, y, 40, "ghost"));
      nodes.push(box("c" + k, "CPU", 420, y, 70, st));
      edges.push({ from: `s${k}3`, to: "c" + k, directed: true });
      labels.push({ id: "r" + k, x: 470, y: y + 5, text: rule, anchor: "start" });
      if (k < 2) labels.push({ id: "d" + k, x: 560, y: y + 40, text: "用完 quantum 還沒做完 → 降到下一層", anchor: "end", cls: "warn" });
    });
    labels.push({ id: "top", x: 70, y: 18, text: "優先權高", cls: "strong" });
    labels.push({ id: "bot", x: 70, y: 222, text: "優先權低", cls: "strong" });
    return { width: 680, height: 240, nodes, edges, labels };
  });
})();
