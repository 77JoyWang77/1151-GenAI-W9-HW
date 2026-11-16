/* =====================================================================
   Circular Queue（環狀佇列）主題的視覺化
   - cq-ring : 環狀佇列的 enqueue / dequeue，畫成一個環，看 front、rear 怎麼繞
   ===================================================================== */
(function () {
  "use strict";
  const { Player, Recorder, ui, register, iconHTML, figure } = window.DSViz;

  const CODE = {
    // 犧牲一格（預設）
    slot: [
      "#define MAX 8                                  /* 陣列大小；最多只能放 MAX - 1 個 */",
      "int queue[MAX];",
      "int front = 0, rear = 0;                       /* front 指向第一個元素的前一格 */",
      "",
      "int isEmpty(void) { return front == rear; }",
      "int isFull(void)  { return (rear + 1) % MAX == front; }",
      "",
      "void enqueue(int x) {",
      "  if (isFull()) { printf(\"Queue Full\\n\"); exit(1); }",
      "  rear = (rear + 1) % MAX;                     /* rear 先往前一格 */",
      "  queue[rear] = x;",
      "}",
      "",
      "int dequeue(void) {",
      "  if (isEmpty()) { printf(\"Queue Empty\\n\"); exit(1); }",
      "  front = (front + 1) % MAX;                   /* front 先往前一格 */",
      "  return queue[front];",
      "}",
    ],
    // 多記一個 count
    count: [
      "int cq[MAX];",
      "int head = 0, count = 0;                       /* head：第一個元素；count：目前個數 */",
      "",
      "void enqueueCount(int x) {",
      "  if (count == MAX) { printf(\"Queue Full\\n\"); exit(1); }",
      "  cq[(head + count) % MAX] = x;                /* 最後一個元素的下一格 */",
      "  count++;",
      "}",
      "",
      "int dequeueCount(void) {",
      "  if (count == 0) { printf(\"Queue Empty\\n\"); exit(1); }",
      "  int x = cq[head];",
      "  head = (head + 1) % MAX;",
      "  count--;",
      "  return x;",
      "}",
    ],
  };
  // 程式碼行號
  const L = {
    slot: { full: [6, 9], moveRear: 10, put: 11, empty: [5, 15], moveFront: 16, ret: 17 },
    count: { full: 5, put: 6, inc: 7, empty: 11, take: 12, moveHead: 13, dec: 14, ret: 15 },
  };

  const MAX = 8;
  const CX = 215, CY = 200, R = 118, BW = 52, BH = 38;
  const ang = (i) => (-90 + i * (360 / MAX)) * Math.PI / 180;
  const slotX = (i) => CX + R * Math.cos(ang(i));
  const slotY = (i) => CY + R * Math.sin(ang(i));
  const outDir = (i) => ["up", "up", "down", "down", "down", "down", "up", "up"][i];   // 指標文字都朝上下，避免和右側說明重疊

  register("cq-ring", function (root) {
    const player = new Player(root, {
      title: "Circular Queue 環狀佇列",
      width: 720, height: 400, code: CODE.slot,
      legend: [["new", "剛放入"], ["removed", "被取出"], ["compare", "檢查中"], ["muted", "犧牲的那一格"]],
    });

    // ---------- 模型 ----------
    let mode = "slot";            // "slot" = 犧牲一格；"count" = 多記 count
    let cells = new Array(MAX).fill(null);   // 每格放 {id, v}
    let front = 0, rear = 0, head = 0, count = 0, uid = 0;

    function size() { return mode === "slot" ? (rear - front + MAX) % MAX : count; }

    function reset(f, vals) {
      cells = new Array(MAX).fill(null);
      if (mode === "slot") {
        front = rear = f;
        vals.forEach((v) => { rear = (rear + 1) % MAX; cells[rear] = { id: "q" + uid++, v }; });
      } else {
        head = f; count = 0;
        vals.forEach((v) => { cells[(head + count) % MAX] = { id: "q" + uid++, v }; count++; });
      }
    }

    // ---------- 繪製 ----------
    function frame(caption, line, opt = {}) {
      const st = opt.states || {}, slotSt = opt.slotStates || {};
      const nodes = [], labels = [], pointers = [];
      for (let i = 0; i < MAX; i++) {
        const sacrificed = mode === "slot" && i === front && size() < MAX;
        nodes.push({ id: "slot" + i, shape: "box", x: slotX(i), y: slotY(i), w: BW, h: BH, state: slotSt[i] || (sacrificed ? "muted" : "ghost") });
        const ix = CX + (R - 50) * Math.cos(ang(i)), iy = CY + (R - 50) * Math.sin(ang(i));
        labels.push({ id: "idx" + i, x: ix, y: iy + 4, text: `[${i}]` });
      }
      cells.forEach((c, i) => c && nodes.push({ id: c.id, label: c.v, shape: "box", x: slotX(i), y: slotY(i), w: BW - 8, h: BH - 8, state: st[c.id] || "default" }));
      (opt.floating || []).forEach((n) => nodes.push(Object.assign({ shape: "box", w: BW - 8, h: BH - 8 }, n)));

      // 指標：front / rear（或 head）都畫在環的外側；指到同一格時合併成一個
      const ps = mode === "slot"
        ? [["front", front, opt.fState || "compare"], ["rear", rear, opt.rState || "active"]]
        : [["head", head, opt.fState || "compare"]];
      if (ps.length === 2 && ps[0][1] === ps[1][1]) pointers.push({ id: "fr", label: "front = rear", target: "slot" + front, dir: outDir(front), state: opt.fState || "compare" });
      else ps.forEach(([name, idx, s]) => pointers.push({ id: name, label: name, target: "slot" + idx, dir: outDir(idx), state: s }));

      // 右側資訊
      const X = 430;
      labels.push({ id: "t-mode", x: X, y: 60, text: mode === "slot" ? "做法：犧牲一格" : "做法：多記 count", cls: "title", anchor: "start" });
      if (mode === "slot") {
        labels.push({ id: "t1", x: X, y: 96, text: `front = ${front}　rear = ${rear}`, anchor: "start" });
        labels.push({ id: "t2", x: X, y: 124, text: `個數 = (rear − front + MAX) % MAX = ${size()}`, anchor: "start", cls: opt.hiSize ? "strong" : "" });
        labels.push({ id: "t3", x: X, y: 162, text: "空：front == rear", anchor: "start", cls: opt.hi === "empty" ? "strong" : "" });
        labels.push({ id: "t4", x: X, y: 188, text: "滿：(rear + 1) % MAX == front", anchor: "start", cls: opt.hi === "full" ? "strong" : "" });
        labels.push({ id: "t5", x: X, y: 226, text: `最多放 MAX − 1 = ${MAX - 1} 個`, anchor: "start" });
      } else {
        labels.push({ id: "t1", x: X, y: 96, text: `head = ${head}　count = ${count}`, anchor: "start" });
        labels.push({ id: "t2", x: X, y: 124, text: `放入位置 = (head + count) % MAX = ${(head + count) % MAX}`, anchor: "start", cls: opt.hiSize ? "strong" : "" });
        labels.push({ id: "t3", x: X, y: 162, text: "空：count == 0", anchor: "start", cls: opt.hi === "empty" ? "strong" : "" });
        labels.push({ id: "t4", x: X, y: 188, text: "滿：count == MAX", anchor: "start", cls: opt.hi === "full" ? "strong" : "" });
        labels.push({ id: "t5", x: X, y: 226, text: `${MAX} 格全部用得到`, anchor: "start" });
      }
      if (opt.warn) labels.push({ id: "warn", x: X, y: 270, text: opt.warn, anchor: "start", cls: "warn" });
      labels.push({ id: "center", x: CX, y: CY + 5, text: `MAX = ${MAX}`, cls: "title" });
      return { nodes, edges: [], pointers, labels, caption, line };
    }

    // ---------- 操作：犧牲一格 ----------
    function enqueueSlot(v) {
      const r = new Recorder(), l = L.slot;
      const nr = (rear + 1) % MAX;
      r.push(frame(`enqueue(${v})：先檢查是不是滿了。(rear + 1) % MAX = (${rear} + 1) % ${MAX} = <b>${nr}</b>，和 front = ${front} 比較。`, l.full, { hi: "full", slotStates: { [nr]: "compare" } }));
      if (nr === front) {
        r.push(frame(`${nr} == front，<b>佇列已滿</b>（${MAX - 1} 個）。front 那一格必須空著，否則滿和空都會是 front == rear，分不出來。`, l.full, { hi: "full", slotStates: { [nr]: "removed" }, warn: "Queue Full" }));
        return r.frames;
      }
      const wrap = rear === MAX - 1 ? `rear 原本在最後一格 [${MAX - 1}]，取餘數後<b>繞回 [0]</b>。` : "";
      rear = nr;
      r.push(frame(`不滿，rear 往前一格：rear = (rear + 1) % MAX = <b>${rear}</b>。${wrap}`, l.moveRear, { rState: "active", slotStates: { [rear]: "compare" } }));
      const id = "q" + uid++;
      cells[rear] = { id, v };
      r.push(frame(`把 <b>${v}</b> 放進 queue[${rear}]。現在共有 ${size()} 個元素。`, l.put, { states: { [id]: "new" }, hiSize: true }));
      return r.frames;
    }

    function dequeueSlot() {
      const r = new Recorder(), l = L.slot;
      r.push(frame(`dequeue()：先檢查是不是空的。front = ${front}，rear = ${rear}。`, l.empty, { hi: "empty" }));
      if (front === rear) {
        r.push(frame(`front == rear，<b>佇列是空的</b>，沒有東西可以取。`, l.empty, { hi: "empty", warn: "Queue Empty" }));
        return r.frames;
      }
      const old = front;
      front = (front + 1) % MAX;
      const c = cells[front];
      const wrap = old === MAX - 1 ? "（從最後一格繞回 [0]）" : "";
      r.push(frame(`不空，front 往前一格：front = (${old} + 1) % MAX = <b>${front}</b>${wrap}。front 原本指的是「第一個元素的前一格」，所以前進後正好指到第一個元素。`, l.moveFront, { fState: "compare", states: { [c.id]: "removed" } }));
      cells[front] = null;
      r.push(frame(`回傳 queue[${front}] = <b>${c.v}</b>（最早進來的先出去，FIFO）。這一格成為新的「犧牲格」，剩 ${size()} 個。`, l.ret, { floating: [{ id: c.id, label: c.v, x: slotX(front) + (slotX(front) < CX ? -70 : 70), y: slotY(front), state: "removed" }], hiSize: true }));
      return r.frames;
    }

    // ---------- 操作：多記 count ----------
    function enqueueCount(v) {
      const r = new Recorder(), l = L.count;
      r.push(frame(`enqueue(${v})：先檢查 count == MAX？count = ${count}。`, l.full, { hi: "full" }));
      if (count === MAX) {
        r.push(frame(`count == ${MAX}，<b>佇列已滿</b>。這個做法 ${MAX} 格全部用得到，代價是每次操作要多維護一個 count。`, l.full, { hi: "full", warn: "Queue Full" }));
        return r.frames;
      }
      const pos = (head + count) % MAX;
      r.push(frame(`放的位置是最後一個元素的下一格：(head + count) % MAX = (${head} + ${count}) % ${MAX} = <b>${pos}</b>。`, l.put, { hiSize: true, slotStates: { [pos]: "compare" } }));
      const id = "q" + uid++;
      cells[pos] = { id, v };
      count++;
      r.push(frame(`放入 <b>${v}</b>，count 加 1 變成 ${count}。`, l.inc, { states: { [id]: "new" } }));
      return r.frames;
    }

    function dequeueCount() {
      const r = new Recorder(), l = L.count;
      r.push(frame(`dequeue()：先檢查 count == 0？count = ${count}。`, l.empty, { hi: "empty" }));
      if (count === 0) {
        r.push(frame(`count == 0，<b>佇列是空的</b>。`, l.empty, { hi: "empty", warn: "Queue Empty" }));
        return r.frames;
      }
      const c = cells[head];
      r.push(frame(`head 直接指著第一個元素，先把 cq[${head}] = <b>${c.v}</b> 取出來。`, l.take, { states: { [c.id]: "removed" } }));
      cells[head] = null;
      const old = head;
      head = (head + 1) % MAX;
      count--;
      r.push(frame(`head = (${old} + 1) % MAX = ${head}，count 減 1 變成 ${count}，回傳 <b>${c.v}</b>。`, [l.moveHead, l.dec], { floating: [{ id: c.id, label: c.v, x: slotX(old) + (slotX(old) < CX ? -70 : 70), y: slotY(old), state: "removed" }] }));
      return r.frames;
    }

    const doEnq = (v) => (mode === "slot" ? enqueueSlot(v) : enqueueCount(v));
    const doDeq = () => (mode === "slot" ? dequeueSlot() : dequeueCount());

    // ---------- 控制列 ----------
    const input = ui.input(player, { placeholder: "數值", value: "30", width: 64 });
    ui.button(player, "enqueue", () => { const v = ui.int(input, { min: 0, max: 99 }); if (v !== null) { player.load(doEnq(v)); input.value = String((v + 7) % 100); } });
    ui.button(player, "dequeue", () => player.load(doDeq()));
    ui.button(player, "放到滿", () => {
      const r = new Recorder();
      let v = 10, guard = 0;
      while (size() < (mode === "slot" ? MAX - 1 : MAX) && guard++ < MAX) { doEnq(v).forEach((f) => r.push(f)); v += 10; }
      doEnq(v).forEach((f) => r.push(f));        // 最後再放一次，看到「滿了」
      player.load(r.frames);
    }, "ghost");
    const modeBtn = ui.button(player, "做法：犧牲一格", () => {
      mode = mode === "slot" ? "count" : "slot";
      modeBtn.textContent = mode === "slot" ? "做法：犧牲一格" : "做法：多記 count";
      player.setCode(CODE[mode]);
      reset(5, [10, 20]);
      player.load([frame(mode === "slot"
        ? "改回<b>犧牲一格</b>：front 指向第一個元素的前一格，那一格永遠空著（灰色），用來分辨空和滿。"
        : "改用<b>多記 count</b>：head 直接指向第一個元素，用 count 判斷空和滿，8 格全部用得到。", null)], { autoplay: false });
    }, "ghost");
    modeBtn.title = "切換判斷空、滿的做法";
    ui.button(player, "清空", () => { reset(0, []); player.load([frame("佇列已清空。", null)], { autoplay: false }); }, "ghost");
    input.addEventListener("keydown", (e) => e.key === "Enter" && player.toolbar.querySelector(".vop").click());

    // 初始：front = rear = 5，已經放了 10、20、30（rear = 0，已經繞過一圈）；示範再放一個 40 與取出一個
    reset(5, [10, 20, 30]);
    const demo = enqueueSlot(40);
    dequeueSlot().forEach((f) => demo.push(f));
    demo[0].caption = iconHTML("play") + " 按播放看示範：先 <b>enqueue(40)</b>，再 <b>dequeue()</b>。rear 已經從 [7] 繞回 [0]，注意 front 那一格永遠空著。之後可以自己輸入數值操作，或按「放到滿」看什麼時候會滿。";
    player.load(demo, { autoplay: false });
  });

  // ===================================================================
  // 靜態圖解
  // ===================================================================
  const box = (id, label, x, y, state, w = 46, h = 36) => ({ id, label, x, y, shape: "box", w, h, state: state || "default" });

  // 圖 1：線性佇列的假性溢位
  figure("cq-linear-problem", () => {
    const nodes = [], labels = [];
    const x0 = 110, step = 56, y = 110;
    for (let i = 0; i < 8; i++) {
      nodes.push(box("s" + i, "", x0 + i * step, y, "ghost", 50, 40));
      labels.push({ id: "i" + i, x: x0 + i * step, y: y + 40, text: `[${i}]` });
      if (i >= 4) nodes.push(box("v" + i, (i + 1) * 10, x0 + i * step, y, "default", 42, 32));
    }
    return {
      width: 640, height: 220, nodes,
      pointers: [
        { id: "f", label: "front = 3", target: "s3", dir: "up", state: "compare" },
        { id: "r", label: "rear = 7", target: "s7", dir: "up", state: "active" },
      ],
      labels: labels.concat([
        { id: "e", x: x0 + 1.5 * step, y: 190, text: "前面 4 格明明是空的……", anchor: "middle" },
        { id: "w", x: x0 + 5.5 * step, y: 190, text: "rear == MAX − 1，卻判定「滿了」", anchor: "middle", cls: "warn" },
      ]),
    };
  });

  // 圖 2：環 = 頭尾相接的陣列
  figure("cq-ring-unroll", () => {
    const nodes = [], labels = [], edges = [];
    const cx = 150, cy = 140, rr = 92;
    const vals = { 6: 10, 7: 20, 0: 30, 1: 40 };
    for (let i = 0; i < 8; i++) {
      const a = (-90 + i * 45) * Math.PI / 180;
      nodes.push(box("r" + i, vals[i] ?? "", cx + rr * Math.cos(a), cy + rr * Math.sin(a), vals[i] !== undefined ? "default" : "ghost", 40, 32));
      labels.push({ id: "ri" + i, x: cx + (rr - 38) * Math.cos(a), y: cy + (rr - 38) * Math.sin(a) + 4, text: `${i}` });
    }
    const x0 = 360, step = 36, y = 140;
    for (let i = 0; i < 8; i++) {
      nodes.push(box("a" + i, vals[i] ?? "", x0 + i * step, y, vals[i] !== undefined ? "default" : "ghost", 32, 32));
      labels.push({ id: "ai" + i, x: x0 + i * step, y: y + 32, text: `[${i}]` });
    }
    return {
      width: 660, height: 280, nodes, edges,
      pointers: [{ id: "f2", label: "front", target: "a5", dir: "up", state: "compare" }, { id: "r2", label: "rear", target: "a1", dir: "up", state: "active" }],
      labels: labels.concat([
        { id: "t1", x: cx, y: 268, text: "邏輯上：一個環", cls: "strong" },
        { id: "t2", x: x0 + 3.5 * step, y: 230, text: "實際上：一般的陣列", cls: "strong" },
        { id: "t3", x: x0 + 3.5 * step, y: 256, text: "[7] 的下一格是 [0]：(7 + 1) % 8 = 0", anchor: "middle" },
      ]),
    };
  });

  // 圖 3：front == rear 分不出空與滿（指標都放在環的上方，避免壓到格子）
  figure("cq-empty-full", () => {
    const nodes = [], labels = [];
    const ring = (pfx, cx, filled, st) => {
      for (let i = 0; i < 8; i++) {
        const a = (-90 + i * 45) * Math.PI / 180;
        nodes.push(box(pfx + i, filled(i) ? "x" : "", cx + 70 * Math.cos(a), 160 + 70 * Math.sin(a), filled(i) ? st : "ghost", 34, 28));
      }
    };
    ring("e", 110, () => false, "default");
    ring("f", 330, () => true, "removed");
    ring("g", 550, (i) => i !== 0, "default");
    nodes[16].state = "muted";
    return {
      width: 660, height: 300, nodes,
      pointers: [
        { id: "p1", label: "front = rear", target: "e0", dir: "up", state: "compare" },
        { id: "p2", label: "front = rear", target: "f0", dir: "up", state: "removed" },
        { id: "p3", label: "front", target: "g0", dir: "up", state: "compare" },
        { id: "p4", label: "rear", target: "g7", dir: "up", state: "active" },
      ],
      labels: [
        { id: "l1", x: 110, y: 262, text: "(a) 空", cls: "strong" },
        { id: "l2", x: 330, y: 262, text: "(b) 8 格全滿：也是 front = rear", cls: "warn" },
        { id: "l3", x: 550, y: 262, text: "(c) 犧牲一格：7 個就算滿", cls: "strong" },
        { id: "l4", x: 550, y: 286, text: "(rear + 1) % 8 == front", anchor: "middle" },
      ],
    };
  });
})();
