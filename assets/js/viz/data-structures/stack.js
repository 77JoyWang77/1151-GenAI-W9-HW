/* =====================================================================
   Stack（堆疊）主題的視覺化
   - stack-ops     : 陣列實作的 push / pop / peek
   - infix-postfix : 中序轉後序（Infix → Postfix），採課本 §3.4 的 isp / icp 寫法
   ===================================================================== */
(function () {
  "use strict";
  const { Player, Recorder, ui, register, esc } = window.DSViz;

  // ===================================================================
  // 1) stack-ops
  // ===================================================================
  register("stack-ops", function (root) {
    const MAX = 6;
    const SX = 270, BOTTOM = 280, STEP = 42, W = 70, H = 36, SIDE = 500;
    const slotY = (i) => BOTTOM - i * STEP;

    const code = [
      "#define MAX 6",
      "int stack[MAX], top = -1;",
      "",
      "void push(int x) {",
      "  if (top == MAX - 1) { overflow(); return; }",
      "  stack[++top] = x;",
      "}",
      "",
      "int pop(void) {",
      "  if (top == -1) { underflow(); return -1; }",
      "  return stack[top--];",
      "}",
      "",
      "int peek(void) { return stack[top]; }",
    ];

    const player = new Player(root, {
      title: "Array-based Stack（陣列實作堆疊）",
      width: 640, height: 320, code,
      legend: [["new", "新加入"], ["active", "正在處理"], ["removed", "被移除"], ["found", "查看 / 回傳"]],
    });

    // 模型：items = [{id, v}]，索引即位置
    let items = [{ id: "a", v: 3 }, { id: "b", v: 8 }];
    let uid = 0;

    function frame(extra = {}) {
      const nodes = [];
      for (let i = 0; i < MAX; i++) nodes.push({ id: "slot" + i, shape: "box", x: SX, y: slotY(i), w: W, h: H, state: "ghost" });
      items.forEach((it, i) => nodes.push({ id: it.id, label: it.v, shape: "box", x: SX, y: slotY(i), w: W - 8, h: H - 8, state: (extra.states || {})[it.id] || "default" }));
      (extra.floating || []).forEach((n) => nodes.push(Object.assign({ shape: "box", w: W - 8, h: H - 8 }, n)));

      const labels = [];
      for (let i = 0; i < MAX; i++) labels.push({ id: "idx" + i, x: SX + W / 2 + 12, y: slotY(i), text: `[${i}]`, anchor: "start" });
      labels.push({ id: "cap", x: SX, y: BOTTOM + 34, text: `MAX = ${MAX}`, cls: "title" });
      if (extra.warn) labels.push({ id: "warn", x: SIDE, y: 60, text: extra.warn, cls: "warn" });

      const top = extra.top !== undefined ? extra.top : items.length - 1;
      const pointers = [top >= 0
        ? { id: "top", label: `top = ${top}`, target: top < items.length ? items[top].id : "slot" + top, dir: "left", state: extra.topState || "default" }
        : { id: "top", label: "top = -1", x: SX - W / 2 - 6, y: BOTTOM + STEP, dir: "left", state: extra.topState || "default" }];

      return { nodes, labels, pointers, caption: extra.caption, line: extra.line };
    }

    function idle(caption) { return frame({ caption }); }

    function push(v) {
      const r = new Recorder();
      const top = items.length - 1;
      r.push(frame({ caption: `呼叫 <b>push(${v})</b>，先檢查堆疊是否已滿。`, line: [4, 5] }));
      if (top === MAX - 1) {
        r.push(frame({ caption: `top = ${top} = MAX − 1，堆疊已滿 → <b>Stack Overflow（堆疊溢位）</b>，${v} 無法放入。`, line: 5, warn: "Overflow!", topState: "removed" }));
        return r.frames;
      }
      const id = "n" + uid++;
      const ghost = { id, label: v, x: SIDE, y: slotY(top + 1), state: "new" };
      r.push(frame({ caption: `top = ${top}，還沒滿（MAX − 1 = ${MAX - 1}），可以放入。`, line: 5, floating: [ghost] }));
      r.push(frame({ caption: `<b>++top</b>：top 先加 1 變成 ${top + 1}，指向下一個空位。`, line: 6, floating: [ghost], top: top + 1, topState: "active" }));
      items.push({ id, v });
      r.push(frame({ caption: `stack[${top + 1}] = ${v}，資料放進 top 指的位置。`, line: 6, states: { [id]: "new" }, topState: "active" }));
      r.push(idle(`push(${v}) 完成。目前有 ${items.length} 個元素，top = ${items.length - 1}。`));
      return r.frames;
    }

    function pop() {
      const r = new Recorder();
      const top = items.length - 1;
      r.push(frame({ caption: "呼叫 <b>pop()</b>，先檢查堆疊是否為空。", line: [9, 10] }));
      if (top === -1) {
        r.push(frame({ caption: "top = −1，堆疊是空的 → <b>Stack Underflow（堆疊下溢）</b>。", line: 10, warn: "Underflow!", topState: "removed" }));
        return r.frames;
      }
      const it = items[top];
      r.push(frame({ caption: `top = ${top}，取出 stack[${top}] = <b>${it.v}</b>。`, line: 11, states: { [it.id]: "active" }, topState: "active" }));
      items.pop();
      r.push(frame({ caption: `<b>top--</b>：top 變成 ${top - 1}。注意陣列裡的值不用真的清掉，top 以上的位置都視為空的。`, line: 11, floating: [{ id: it.id, label: it.v, x: SIDE, y: slotY(top), state: "removed" }], topState: "active" }));
      r.push(idle(`pop() 回傳 <b>${it.v}</b>。後進先出（LIFO）：最後 push 的最先被 pop。`));
      return r.frames;
    }

    function peek() {
      const r = new Recorder();
      const top = items.length - 1;
      if (top === -1) {
        r.push(frame({ caption: "堆疊是空的，peek() 沒有東西可看（實作上應先檢查 isEmpty）。", line: 14, warn: "Empty", topState: "removed" }));
        return r.frames;
      }
      r.push(frame({ caption: `peek() 只「看」最上面的元素 <b>${items[top].v}</b>，不移除，top 不變。`, line: 14, states: { [items[top].id]: "found" }, topState: "found" }));
      r.push(idle(`peek() 回傳 ${items[top].v}，堆疊內容不變。`));
      return r.frames;
    }

    const input = ui.input(player, { placeholder: "數值", value: "5", width: 64 });
    ui.button(player, "push", () => {
      const v = ui.int(input, { min: -99, max: 999 });
      if (v === null) return;
      player.load(push(v));
      input.value = String(Math.floor(Math.random() * 90) + 10);
    });
    ui.button(player, "pop", () => player.load(pop()));
    ui.button(player, "peek", () => player.load(peek()), "ghost");
    ui.button(player, "清空", () => { items = []; player.load([idle("堆疊已清空，top = −1。")], { autoplay: false }); }, "ghost");
    input.addEventListener("keydown", (e) => e.key === "Enter" && player.toolbar.querySelector(".vop").click());

    // 初始載入一段 push(5) 示範，讓 ▶ 一按就能播放
    const demo = push(5);
    demo[0].caption = "▶ 按播放看 <b>push(5)</b> 的示範；之後可以自己輸入數值按 <b>push</b>，或試試 <b>pop</b> / <b>peek</b>。也可以用 ← → 鍵逐步看。";
    player.load(demo, { autoplay: false });
    input.value = "12";
  });

  // ===================================================================
  // 2) infix-postfix — 課本 §3.4：in-stack precedence (isp) / incoming precedence (icp)
  // ===================================================================
  register("infix-postfix", function (root) {
    // 課本的表：( ) + - * / % eos；^ 是本站延伸（右結合：isp < icp）
    const ISP = { "(": 0, "+": 12, "-": 12, "*": 13, "/": 13, "%": 13, "^": 14, eos: 0 };
    const ICP = { "(": 20, "+": 12, "-": 12, "*": 13, "/": 13, "%": 13, "^": 15, eos: 0 };
    const ROWS = [["(", "(", "0", "20"], ["+-", "+  -", "12", "12"], ["*/%", "*  /  %", "13", "13"], ["^", "^（延伸）", "14", "15"], ["eos", "eos", "0", "0"]];
    const rowOf = (t) => (t === "(" ? 0 : "+-".includes(t) ? 1 : "*/%".includes(t) ? 2 : t === "^" ? 3 : 4);

    const code = [
      "void postfix(void) {",
      "  stack[0] = eos; top = 0;        /* 堆疊底放 eos */",
      "  for (token = getToken(); token != eos; token = getToken()) {",
      "    if (token == operand) printf(\"%c\", symbol);",
      "    else if (token == rparen) {",
      "      while (stack[top] != lparen) printToken(pop());",
      "      pop();                        /* 丟掉 '(' */",
      "    } else {",
      "      while (isp[stack[top]] >= icp[token])",
      "        printToken(pop());",
      "      push(token);",
      "    }",
      "  }",
      "  while ((token = pop()) != eos) printToken(token);",
      "}",
    ];

    const player = new Player(root, {
      title: "Infix → Postfix（中序轉後序，isp / icp 版）",
      width: 680, height: 340, code,
      legend: [["active", "目前讀入的 token"], ["compare", "比較 isp / icp"], ["new", "剛輸出"], ["removed", "括號被丟棄"], ["muted", "eos（堆疊底）"]],
    });

    function tokenize(s) {
      const out = [];
      const re = /\s*([A-Za-z_][A-Za-z0-9_]*|\d+|[+\-*/%^()])/y;
      let m, pos = 0;
      s = s.trim();
      while (pos < s.length) {
        re.lastIndex = pos;
        m = re.exec(s);
        if (!m) return { error: `看不懂第 ${pos + 1} 個字元「${esc(s[pos])}」` };
        out.push(m[1]);
        pos = re.lastIndex;
        while (s[pos] === " ") pos++;
      }
      let depth = 0;
      for (const t of out) { if (t === "(") depth++; if (t === ")") depth--; if (depth < 0) return { error: "括號不對稱" }; }
      if (depth) return { error: "括號不對稱" };
      if (out.length > 13) return { error: "為了畫得下，請限制在 13 個 token 以內" };
      if (!out.length) return { error: "請輸入運算式" };
      return { tokens: out };
    }

    function run(expr) {
      const tk = tokenize(expr);
      if (tk.error) return [{ caption: `<b>⚠ ${tk.error}</b>`, labels: [{ id: "err", x: 340, y: 170, text: tk.error, cls: "warn" }] }];
      const toks = tk.tokens.map((t, i) => ({ id: "t" + i, t }));
      const n = toks.length;
      const inStep = Math.min(40, 440 / n);
      const outLen = toks.filter((x) => x.t !== "(" && x.t !== ")").length;
      const outStep = Math.min(40, 420 / Math.max(outLen, 1));
      const EOS = { id: "eos", t: "eos" };

      const where = {};
      toks.forEach((x) => (where[x.id] = "in"));
      const stack = [EOS], output = [];
      const r = new Recorder();
      const top = () => stack[stack.length - 1];

      function frame(caption, line, opt = {}) {
        const st = opt.states || {};
        const nodes = [];
        toks.forEach((x, i) => {
          if (where[x.id] === "in") nodes.push({ id: x.id, label: x.t, shape: "box", x: 30 + i * inStep, y: 62, w: inStep - 6, h: 34, state: st[x.id] || "default" });
        });
        const sStep = stack.length > 5 ? 150 / stack.length : 34;
        stack.forEach((x, i) => nodes.push({ id: x.id, label: x.t, shape: "box", x: 100, y: 296 - i * sStep, w: 56, h: Math.min(30, sStep - 4), state: st[x.id] || (x === EOS ? "muted" : "default") }));
        output.forEach((x, i) => nodes.push({ id: x.id, label: x.t, shape: "box", x: 230 + i * outStep, y: 296, w: outStep - 6, h: 34, state: st[x.id] || "default" }));

        const hl = new Set(opt.rows || []);
        const labels = [
          { id: "lin", x: 12, y: 26, text: "INPUT（中序 Infix）", cls: "title", anchor: "start" },
          { id: "lst", x: 100, y: 120, text: "STACK", cls: "title" },
          { id: "lout", x: 210, y: 252, text: "OUTPUT（後序 Postfix）", cls: "title", anchor: "start" },
          { id: "th0", x: 540, y: 26, text: "token", cls: "title" },
          { id: "th1", x: 600, y: 26, text: "isp", cls: "title" },
          { id: "th2", x: 650, y: 26, text: "icp", cls: "title" },
          { id: "tnote", x: 595, y: 182, text: "')'：pop 到 '(' 為止", anchor: "middle" },
        ];
        ROWS.forEach((row, k) => {
          const c = hl.has(k) ? "strong" : "";
          labels.push({ id: "tr" + k + "a", x: 540, y: 52 + k * 24, text: row[1], cls: c });
          labels.push({ id: "tr" + k + "b", x: 600, y: 52 + k * 24, text: row[2], cls: c });
          labels.push({ id: "tr" + k + "c", x: 650, y: 52 + k * 24, text: row[3], cls: c });
        });
        if (opt.result) labels.push({ id: "res", x: 210, y: 214, text: "結果：" + opt.result, cls: "strong", anchor: "start" });
        const pointers = [];
        if (opt.cur) pointers.push({ id: "cur", label: "token", target: opt.cur, dir: "up", state: "active" });
        pointers.push({ id: "top", label: "top", target: top().id, dir: "right" });
        r.push({ nodes, labels, pointers, caption, line });
      }

      frame(`把中序式 <code>${esc(tk.tokens.join(" "))}</code> 由左到右讀入。堆疊底先放 <b>eos</b>（isp = 0），之後就不用特別判斷「堆疊是否為空」。`, 2);

      for (const x of toks) {
        const t = x.t;
        if (/^[A-Za-z0-9_]+$/.test(t)) {
          frame(`讀到運算元 <b>${esc(t)}</b>。`, 3, { cur: x.id, states: { [x.id]: "active" } });
          where[x.id] = "out"; output.push(x);
          frame(`運算元直接輸出，順序和原式相同。`, 4, { states: { [x.id]: "new" } });
        } else if (t === ")") {
          frame("讀到 <b>)</b>：把堆疊一路 pop 到遇見 <b>(</b> 為止。", 5, { cur: x.id, states: { [x.id]: "active" } });
          while (top().t !== "(") {
            const y = stack.pop(); where[y.id] = "out"; output.push(y);
            frame(`top 是 <b>${esc(y.t)}</b>，不是 (，pop 出來輸出。`, 6, { states: { [y.id]: "new", [x.id]: "active" } });
          }
          const lp = top();
          frame("遇到 <b>(</b>，把它和 ) 一起丟掉——括號不會出現在後序式中。", 7, { states: { [lp.id]: "removed", [x.id]: "removed" } });
          stack.pop(); where[lp.id] = "gone"; where[x.id] = "gone";
          frame("括號處理完畢。", 7);
        } else {
          frame(`讀到 <b>${esc(t)}</b>，icp[${esc(t)}] = ${ICP[t]}。和堆疊頂端的 isp 比較。`, 8, { cur: x.id, states: { [x.id]: "active" }, rows: [rowOf(t)] });
          for (;;) {
            const y = top();
            const a = ISP[y.t], b = ICP[t];
            const rows = [rowOf(y.t), rowOf(t)];
            const st = { [x.id]: "active", [y.id]: "compare" };
            if (a >= b) {
              frame(`isp[${esc(y.t)}] = ${a} ≥ icp[${esc(t)}] = ${b}：top 的運算子要先算，pop 出來輸出。`, 9, { cur: x.id, states: st, rows });
              stack.pop(); where[y.id] = "out"; output.push(y);
              frame(`輸出 <b>${esc(y.t)}</b>。`, 10, { cur: x.id, states: { [x.id]: "active", [y.id]: "new" }, rows });
            } else {
              let why = "";
              if (t === "(") why = "（icp[(] = 20 比誰都大，所以 ( 一定直接 push）";
              else if (y.t === "(") why = "（isp[(] = 0 比誰都小，所以 ( 在堆疊裡像一道牆）";
              else if (y.t === "eos") why = "（碰到堆疊底 eos）";
              else if (t === "^" && y.t === "^") why = "（^ 右結合：isp 14 < icp 15，同級不 pop）";
              frame(`isp[${esc(y.t)}] = ${a} < icp[${esc(t)}] = ${b}，停止 pop ${why}。`, 9, { cur: x.id, states: st, rows });
              break;
            }
          }
          where[x.id] = "stack"; stack.push(x);
          frame(`把 <b>${esc(t)}</b> push 進堆疊。`, 11, { states: { [x.id]: "new" } });
        }
      }
      if (stack.length > 1) frame("輸入讀完（token = eos），把堆疊 pop 到 eos 為止。", 14);
      while (stack.length > 1) {
        const y = stack.pop(); where[y.id] = "out"; output.push(y);
        frame(`pop 出 <b>${esc(y.t)}</b> 並輸出。`, 14, { states: { [y.id]: "new" } });
      }
      const result = output.map((x) => x.t).join(" ");
      const st = {}; output.forEach((x) => (st[x.id] = "found"));
      frame(`完成！後序式為 <b>${esc(result)}</b>。驗算：從左到右掃，遇到運算子就拿前兩個運算元計算。`, null, { states: st, result });
      return r.frames;
    }

    const input = ui.input(player, { value: "a*(b+c)*d", width: 160, placeholder: "例如 a+b*c" });
    const go = () => player.load(run(input.value));
    ui.button(player, "開始轉換", go);
    ["a+b*c", "a/b-c+d*e-a*c", "2^3^2"].forEach((ex) => ui.button(player, ex, () => { input.value = ex; go(); }, "ghost"));
    input.addEventListener("keydown", (e) => e.key === "Enter" && go());
    player.load(run(input.value), { autoplay: false });
  });
})();
