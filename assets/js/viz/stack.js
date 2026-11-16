/* =====================================================================
   Stack（堆疊）主題的視覺化
   - stack-ops     : 陣列實作的 push / pop / peek
   - infix-postfix : 中序轉後序（Infix → Postfix）逐步動畫
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

    player.load([idle("輸入數值後按 <b>push</b>，或按 <b>pop</b> / <b>peek</b> 看看堆疊怎麼變化。可以用 ← → 鍵逐步檢視。")], { autoplay: false });
  });

  // ===================================================================
  // 2) infix-postfix
  // ===================================================================
  register("infix-postfix", function (root) {
    const PREC = { "+": 1, "-": 1, "*": 2, "/": 2, "%": 2, "^": 3 };
    const RIGHT = { "^": true };
    const code = [
      "for (每個 token t，由左到右) {",
      "  if (t 是運算元)      輸出 t;",
      "  else if (t == '(')   push(t);",
      "  else if (t == ')') {",
      "    while (top != '(') 輸出 pop();",
      "    pop();             // 丟掉 '('",
      "  } else {             // t 是運算子",
      "    while (!empty && top != '(' &&",
      "           prec(top) >= prec(t))",
      "      輸出 pop();      // ^ 右結合時用 >",
      "    push(t);",
      "  }",
      "}",
      "while (!empty) 輸出 pop();",
    ];

    const player = new Player(root, {
      title: "Infix → Postfix（中序轉後序）",
      width: 680, height: 330, code,
      legend: [["active", "目前讀入的 token"], ["compare", "比較優先權"], ["new", "剛輸出"], ["removed", "括號被丟棄"]],
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
      if (out.length > 15) return { error: "為了畫得下，請限制在 15 個 token 以內" };
      if (!out.length) return { error: "請輸入運算式" };
      return { tokens: out };
    }

    function run(expr) {
      const tk = tokenize(expr);
      if (tk.error) return [{ caption: `<b>⚠ ${tk.error}</b>`, labels: [{ id: "err", x: 340, y: 160, text: tk.error, cls: "warn" }] }];
      const toks = tk.tokens.map((t, i) => ({ id: "t" + i, t }));
      const n = toks.length;
      const inStep = Math.min(42, 600 / n);
      const outLen = toks.filter((x) => x.t !== "(" && x.t !== ")").length;
      const outStep = Math.min(42, 400 / Math.max(outLen, 1));

      const where = {};        // id -> "in" | "stack" | "out" | "gone"
      toks.forEach((x) => (where[x.id] = "in"));
      const stack = [], output = [];
      const r = new Recorder();

      function frame(caption, line, opt = {}) {
        const nodes = [];
        const st = opt.states || {};
        toks.forEach((x, i) => {
          if (where[x.id] === "in") nodes.push({ id: x.id, label: x.t, shape: "box", x: 40 + i * inStep, y: 62, w: inStep - 6, h: 34, state: st[x.id] || "default" });
        });
        const sStep = stack.length > 4 ? Math.min(40, 160 / stack.length) : 40;
        stack.forEach((x, i) => nodes.push({ id: x.id, label: x.t, shape: "box", x: 100, y: 290 - i * sStep, w: 54, h: Math.min(34, sStep - 4), state: st[x.id] || "default" }));
        output.forEach((x, i) => nodes.push({ id: x.id, label: x.t, shape: "box", x: 240 + i * outStep, y: 290, w: outStep - 6, h: 34, state: st[x.id] || "default" }));
        (opt.extra || []).forEach((e) => nodes.push(e));

        const labels = [
          { id: "lin", x: 22, y: 26, text: "INPUT（中序 Infix）", cls: "title", anchor: "start" },
          { id: "lst", x: 100, y: 130, text: "OPERATOR STACK", cls: "title" },
          { id: "lout", x: 222, y: 240, text: "OUTPUT（後序 Postfix）", cls: "title", anchor: "start" },
          { id: "base", x: 100, y: 318, text: "▔▔▔▔▔", cls: "" },
        ];
        if (opt.result) labels.push({ id: "res", x: 222, y: 190, text: "結果：" + opt.result, cls: "strong", anchor: "start" });
        const pointers = [];
        if (opt.cur) pointers.push({ id: "cur", label: "讀入", target: opt.cur, dir: "up", state: "active" });
        if (stack.length) pointers.push({ id: "top", label: "top", target: stack[stack.length - 1].id, dir: "right" });
        r.push({ nodes, labels, pointers, caption, line });
      }

      frame(`把中序式 <code>${esc(tk.tokens.join(" "))}</code> 由左到右逐一讀入。運算元直接輸出，運算子先放進堆疊等待。`, null);

      for (const x of toks) {
        const t = x.t;
        if (/^[A-Za-z0-9_]+$/.test(t)) {
          frame(`讀到運算元 <b>${esc(t)}</b>。`, 1, { cur: x.id, states: { [x.id]: "active" } });
          where[x.id] = "out"; output.push(x);
          frame(`運算元 <b>${esc(t)}</b> 直接輸出。`, 2, { states: { [x.id]: "new" } });
        } else if (t === "(") {
          frame("讀到 <b>(</b>。", 3, { cur: x.id, states: { [x.id]: "active" } });
          where[x.id] = "stack"; stack.push(x);
          frame("左括號直接 push：它像一道牆，括號內的運算子不會越過它被比較。", 3, { states: { [x.id]: "new" } });
        } else if (t === ")") {
          frame("讀到 <b>)</b>：要把堆疊一路 pop 到遇見 <b>(</b> 為止。", 4, { cur: x.id, states: { [x.id]: "active" } });
          while (stack[stack.length - 1].t !== "(") {
            const y = stack.pop(); where[y.id] = "out"; output.push(y);
            frame(`top 是 <b>${esc(y.t)}</b>，不是 (，pop 出來輸出。`, 5, { states: { [y.id]: "new", [x.id]: "active" } });
          }
          const lp = stack[stack.length - 1];
          frame("遇到 <b>(</b>，把它和 ) 一起丟掉——括號不會出現在後序式中。", 6, { states: { [lp.id]: "removed", [x.id]: "removed" } });
          stack.pop(); where[lp.id] = "gone"; where[x.id] = "gone";
          frame("括號處理完畢。", 6);
        } else {
          frame(`讀到運算子 <b>${esc(t)}</b>（優先權 ${PREC[t]}）。`, 7, { cur: x.id, states: { [x.id]: "active" } });
          while (stack.length) {
            const y = stack[stack.length - 1];
            if (y.t === "(") {
              frame(`top 是 <b>(</b>，停止比較。`, [8, 9], { cur: x.id, states: { [x.id]: "active", [y.id]: "compare" } });
              break;
            }
            const popIt = PREC[y.t] > PREC[t] || (PREC[y.t] === PREC[t] && !RIGHT[t]);
            const rel = PREC[y.t] > PREC[t] ? "高於" : PREC[y.t] === PREC[t] ? "等於" : "低於";
            if (!popIt) {
              const why = PREC[y.t] === PREC[t] ? `（^ 是右結合，同級不 pop）` : "";
              frame(`top 的 <b>${esc(y.t)}</b> 優先權${rel} <b>${esc(t)}</b>${why}，停止 pop。`, [8, 9], { cur: x.id, states: { [x.id]: "active", [y.id]: "compare" } });
              break;
            }
            frame(`top 的 <b>${esc(y.t)}</b> 優先權${rel} <b>${esc(t)}</b>，要先輸出它。`, [8, 9], { cur: x.id, states: { [x.id]: "active", [y.id]: "compare" } });
            stack.pop(); where[y.id] = "out"; output.push(y);
            frame(`pop 出 <b>${esc(y.t)}</b> 並輸出。`, 10, { cur: x.id, states: { [x.id]: "active", [y.id]: "new" } });
          }
          if (!stack.length) frame("堆疊是空的，不用比較。", [8, 9], { cur: x.id, states: { [x.id]: "active" } });
          where[x.id] = "stack"; stack.push(x);
          frame(`把 <b>${esc(t)}</b> push 進堆疊。`, 11, { states: { [x.id]: "new" } });
        }
      }
      if (stack.length) frame("輸入讀完了，把堆疊裡剩下的運算子依序 pop 出來。", 14);
      while (stack.length) {
        const y = stack.pop(); where[y.id] = "out"; output.push(y);
        frame(`pop 出 <b>${esc(y.t)}</b> 並輸出。`, 14, { states: { [y.id]: "new" } });
      }
      const result = output.map((x) => x.t).join(" ");
      const st = {}; output.forEach((x) => (st[x.id] = "found"));
      frame(`完成！後序式為 <b>${esc(result)}</b>。驗算：從左到右掃，遇到運算子就拿前兩個運算元計算。`, null, { states: st, result });
      return r.frames;
    }

    const input = ui.input(player, { value: "a+b*(c-d)/e", width: 170, placeholder: "例如 a+b*c" });
    const go = () => player.load(run(input.value));
    ui.button(player, "開始轉換", go);
    ["A*(B+C)/D", "a-b-c", "2^3^2"].forEach((ex) => ui.button(player, ex, () => { input.value = ex; go(); }, "ghost"));
    input.addEventListener("keydown", (e) => e.key === "Enter" && go());
    player.load(run(input.value), { autoplay: false });
  });
})();
