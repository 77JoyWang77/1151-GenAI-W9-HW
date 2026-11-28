/* =====================================================================
   I/O Hardware and DMA（I/O 硬體與 DMA）主題的視覺化
   - io-transfer : 選 polling／interrupt／DMA，設定要讀幾筆、裝置每筆要準備多久，
                   逐步看 CPU、device controller、DMA controller、記憶體之間的訊號
   - io-cpu-load : 輸入裝置速率、每次傳輸大小、CPU 時脈與各種成本，
                   一步一步算出三種方式的 CPU 時間佔比並畫成長條
   - 靜態圖：io-bus、io-port-mmio、io-poll-vs-int、io-interrupt-flow、io-dma-steps、
             io-blocking-models、io-kernel-layers
   ===================================================================== */
(function () {
  "use strict";
  const { Player, Recorder, ui, register, esc, iconHTML, figure } = window.DSViz;

  // 右側程式碼：由 .work/build_js.py 從 code/operating-systems/io-systems.c 原封不動取出
  const CODE_POLL = [
    "void issueRead(Controller *c, int delay) {   /* driver 寫 control register 下命令 */",
    "  c->control = CMD_READ;",
    "  c->status = BUSY;",
    "  c->delay = delay;",
    "}",
    "",
    "/* 時間前進一個單位；資料剛準備好時回傳 1 */",
    "int deviceTick(Controller *c) {",
    "  if (c->status != BUSY) return 0;",
    "  if (--c->delay > 0) return 0;",
    "  c->dataIn = c->next++;",
    "  c->status = READY;",
    "  return 1;",
    "}",
    "",
    "/* CPU 自己等、自己搬：回傳花在空轉檢查的次數 */",
    "int pollingRead(Controller *c, int *buf, int n, int delay) {",
    "  int polls = 0;",
    "  for (int i = 0; i < n; i++) {",
    "    issueRead(c, delay);                 /* 1. 寫 control register 下命令 */",
    "    while (c->status != READY) {         /* 2. busy-wait：反覆讀 status register */",
    "      polls++;",
    "      deviceTick(c);",
    "    }",
    "    buf[i] = c->dataIn;                  /* 3. CPU 讀 data-in，自己寫進記憶體 */",
    "    c->status = IDLE;                    /* 4. 清掉 ready，準備下一筆 */",
    "  }",
    "  return polls;",
    "}"
  ];
  const CODE_INT = [
    "void devISR(void) {                      /* 裝置的 interrupt service routine */",
    "  ioBuf[ioPos++] = dev.dataIn;           /* 一次中斷搬一筆 */",
    "  dev.status = IDLE;                     /* 回應裝置，清掉中斷原因 */",
    "  if (ioPos < ioWant) issueRead(&dev, ioDelay);   /* 還沒讀完：下一筆的命令 */",
    "  else ioDone = 1;                       /* 讀完：喚醒等待的 process */",
    "}",
    "",
    "void cpuRun(void) {                      /* CPU 的主迴圈（模擬） */",
    "  while (!ioDone) {",
    "    otherWork++;                         /* 執行其他 process 的一條指令 */",
    "    if (deviceTick(&dev) && !useDMA) irqLine = IRQ_DEV;",
    "    if (useDMA && dmaCycle()) irqLine = IRQ_DMA;",
    "    if (irqLine >= 0) {                  /* 每條指令結束時檢查 interrupt-request line */",
    "      int irq = irqLine;",
    "      irqLine = -1;",
    "      interrupts++;                      /* 硬體：保存 PC 與狀態、切到 kernel mode */",
    "      vector[irq]();                     /* 查向量表，跳到對應的 handler */",
    "    }                                    /* handler 返回：恢復狀態，回到被中斷的程式 */",
    "  }",
    "}",
    "",
    "int interruptRead(int *buf, int n, int delay) {",
    "  ioBuf = buf; ioWant = n; ioPos = 0; ioDone = 0; ioDelay = delay;",
    "  otherWork = 0; interrupts = 0; useDMA = 0;",
    "  vector[IRQ_DEV] = devISR;",
    "  issueRead(&dev, delay);                /* 下完第一筆命令就去做別的事 */",
    "  cpuRun();",
    "  return otherWork;",
    "}"
  ];
  const CODE_DMA = [
    "int dmaRead(int *buf, int n, int delay) {",
    "  ioDone = 0; ioDelay = delay; otherWork = 0; interrupts = 0; stolen = 0; useDMA = 1;",
    "  vector[IRQ_DMA] = dmaISR;",
    "  dmaStart(buf, n);",
    "  cpuRun();",
    "  return otherWork;",
    "}",
    "",
    "void dmaStart(int *dst, int n) {         /* driver 寫 DMA 的位址、長度暫存器 */",
    "  dma.dst = dst;",
    "  dma.count = n;",
    "  dma.busy = 1;",
    "  issueRead(&dev, ioDelay);              /* 之後 CPU 就不管了 */",
    "}",
    "",
    "/* 裝置有資料（DMA-request）時，DMA 搶一個 bus cycle 寫進記憶體；整塊搬完回傳 1 */",
    "int dmaCycle(void) {",
    "  if (!dma.busy || dev.status != READY) return 0;",
    "  *dma.dst++ = dev.dataIn;               /* 直接寫記憶體，不經過 CPU */",
    "  stolen++;                              /* 這個 bus cycle CPU 用不到 */",
    "  dev.status = IDLE;                     /* DMA-acknowledge：裝置準備下一筆 */",
    "  if (--dma.count > 0) { issueRead(&dev, ioDelay); return 0; }",
    "  dma.busy = 0;",
    "  return 1;                              /* 整塊搬完：發中斷 */",
    "}",
    "",
    "void dmaISR(void) { ioDone = 1; }        /* 整塊只中斷這一次 */",
    "",
    "void cpuRun(void) {                      /* CPU 的主迴圈（模擬） */",
    "  while (!ioDone) {",
    "    otherWork++;                         /* 執行其他 process 的一條指令 */",
    "    if (deviceTick(&dev) && !useDMA) irqLine = IRQ_DEV;",
    "    if (useDMA && dmaCycle()) irqLine = IRQ_DMA;",
    "    if (irqLine >= 0) {                  /* 每條指令結束時檢查 interrupt-request line */",
    "      int irq = irqLine;",
    "      irqLine = -1;",
    "      interrupts++;                      /* 硬體：保存 PC 與狀態、切到 kernel mode */",
    "      vector[irq]();                     /* 查向量表，跳到對應的 handler */",
    "    }                                    /* handler 返回：恢復狀態，回到被中斷的程式 */",
    "  }",
    "}"
  ];
  const CODE_LOAD = [
    "double pollingLoad(double rate, double unit, double cPoll, double clock) {",
    "  double polls = rate / unit;              /* 要跟上裝置，每秒至少查這麼多次 */",
    "  return polls * cPoll / clock;            /* 裝置閒著也得照查，和 active 無關 */",
    "}",
    "",
    "double interruptLoad(double rate, double unit, double cInt, double clock, double active) {",
    "  double ints = rate / unit * active;      /* 只有裝置真的在傳時才會中斷 */",
    "  return ints * cInt / clock;",
    "}",
    "",
    "double dmaLoad(double rate, double block, double cDma, double clock, double active) {",
    "  double blocks = rate / block * active;   /* 每搬完一整塊才中斷一次 */",
    "  return blocks * cDma / clock;            /* cDma = 設定 DMA + 完成中斷的週期數 */",
    "}"
  ];
  const finder = (code) => (s) => code.findIndex((l) => l.includes(s)) + 1;

  // ===================== 動畫一：一次傳輸的訊號流程 =====================
  const POLL = 0, INT = 1, DMA = 2;
  const MNAME = ["Polling", "Interrupt", "DMA"];

  register("io-transfer", function (root) {
    const player = new Player(root, {
      title: "I/O Transfer 一次傳輸的訊號流程",
      width: 720, height: 400, code: CODE_POLL, wide: true,
      legend: [["active", "正在送訊號／正在做事"], ["compare", "CPU 在忙這次 I/O"], ["found", "已寫進記憶體"], ["new", "剛寫入"], ["removed", "中斷"], ["ghost", "還沒有資料"]],
    });

    const lp = finder(CODE_POLL), li = finder(CODE_INT), ld = finder(CODE_DMA);
    const LP = {
      issue: [lp("issueRead(c, delay);"), lp("c->control = CMD_READ;"), lp("c->status = BUSY;")],
      loop: [lp("while (c->status != READY) {"), lp("polls++;")],
      tick: [lp("int deviceTick(Controller *c) {"), lp("c->dataIn = c->next++;"), lp("c->status = READY;")],
      exit: [lp("while (c->status != READY) {")],
      move: [lp("buf[i] = c->dataIn;"), lp("c->status = IDLE;                    /* 4.")],
      ret: [lp("return polls;")],
    };
    const LI = {
      setup: [li("vector[IRQ_DEV] = devISR;"), li("issueRead(&dev, delay);")],
      other: [li("otherWork++;"), li("if (deviceTick(&dev) && !useDMA)")],
      check: [li("if (irqLine >= 0) {"), li("interrupts++;")],
      vec: [li("vector[irq]();")],
      isr: [li("void devISR(void) {"), li("ioBuf[ioPos++] = dev.dataIn;"), li("dev.status = IDLE;")],
      next: [li("if (ioPos < ioWant) issueRead(&dev, ioDelay);")],
      done: [li("else ioDone = 1;")],
      back: [li("while (!ioDone) {")],
    };
    const LD = {
      setup: [ld("vector[IRQ_DMA] = dmaISR;"), ld("dma.dst = dst;"), ld("dma.count = n;"), ld("issueRead(&dev, ioDelay);              /* 之後")],
      other: [ld("otherWork++;"), ld("if (deviceTick(&dev) && !useDMA)")],
      cycle: [ld("if (useDMA && dmaCycle()) irqLine = IRQ_DMA;"), ld("*dma.dst++ = dev.dataIn;"), ld("stolen++;")],
      ack: [ld("dev.status = IDLE;                     /* DMA-acknowledge"), ld("if (--dma.count > 0)")],
      fin: [ld("dma.busy = 0;"), ld("return 1;                              /* 整塊")],
      check: [ld("if (irqLine >= 0) {"), ld("interrupts++;")],
      vec: [ld("vector[irq]();")],
      isr: [ld("void dmaISR(void) { ioDone = 1; }")],
    };

    // ---------- 模型 ----------
    let S = null;
    function reset(method, n, d) {
      S = { method, n, d, status: "IDLE", control: "-", dataIn: "-", next: 10, left: 0,
        buf: Array(n).fill(null), justWrote: -1, polls: 0, other: 0, ints: 0, stolen: 0, moved: 0,
        dmaDst: 0, dmaCount: 0, dmaBusy: false, vecHot: -1, cpu: "閒置", cpuSt: "default" };
    }
    const issue = () => { S.control = "READ"; S.status = "BUSY"; S.left = S.d; };
    function tick() {               // 和 deviceTick() 相同：剛準備好回傳 true
      if (S.status !== "BUSY") return false;
      if (--S.left > 0) return false;
      S.dataIn = S.next++; S.status = "READY";
      return true;
    }

    // ---------- 畫面 ----------
    const CPU = { x: 110, y: 84 }, MEM = { x: 570, y: 84 }, CTL = { x: 470, y: 300 }, DSK = { x: 650, y: 300 }, DMAC = { x: 300, y: 215 };
    function frame(caption, line, sig) {
      sig = sig || {};
      const nodes = [], edges = [], labels = [];
      const m = S.method;
      labels.push({ id: "ttl", x: 16, y: 18, text: `${MNAME[m]}：讀 ${S.n} 筆，裝置每筆要準備 ${S.d} 個時間單位`, cls: "title", anchor: "start" });
      const cnt = m === POLL ? `空轉檢查 ${S.polls} 次｜CPU 搬 ${S.moved} 筆` : m === INT ? `其他工作 ${S.other}｜中斷 ${S.ints} 次｜CPU 搬 ${S.moved} 筆` : `其他工作 ${S.other}｜中斷 ${S.ints} 次｜偷走 bus cycle ${S.stolen}`;
      labels.push({ id: "cnt", x: 704, y: 40, text: cnt, cls: "strong", anchor: "end" });
      nodes.push({ id: "cpu", label: "CPU", shape: "box", w: 160, h: 52, x: CPU.x, y: CPU.y, state: sig.cpuSt || S.cpuSt });
      labels.push({ id: "cpus", x: CPU.x - 80, y: CPU.y - 40, text: "CPU：" + (sig.cpu || S.cpu), anchor: "start", cls: sig.cpuWarn ? "warn" : "" });
      nodes.push({ id: "mem", label: "Memory", shape: "box", w: 230, h: 52, x: MEM.x, y: MEM.y, state: "default" });
      const cw = 36, x0 = MEM.x - ((S.n - 1) * (cw + 4)) / 2;
      S.buf.forEach((v, i) => nodes.push({ id: "b" + i, label: v == null ? "" : String(v), shape: "box", w: cw, h: 30, x: x0 + i * (cw + 4), y: MEM.y + 64, state: v == null ? "ghost" : i === S.justWrote ? "new" : "found" }));
      labels.push({ id: "bufl", x: MEM.x, y: MEM.y + 96, text: `buf[0..${S.n - 1}]`, anchor: "middle" });
      if (m !== POLL) {
        labels.push({ id: "vt", x: CPU.x, y: 150, text: "interrupt vector table", anchor: "middle" });
        [[3, "devISR"], [5, "dmaISR"]].forEach(([no, nm], k) =>
          nodes.push({ id: "v" + no, label: `${no} → ${nm}`, shape: "box", w: 140, h: 28, x: CPU.x, y: 176 + k * 32, state: S.vecHot === no ? "active" : (m === INT && no === 3) || (m === DMA && no === 5) ? "default" : "muted" }));
      }
      nodes.push({ id: "ctl", label: "Device Controller", shape: "box", w: 200, h: 44, x: CTL.x, y: CTL.y, state: sig.ctl || "default" });
      const reg = [["status", S.status], ["control", S.control], ["data-in", S.dataIn]];
      reg.forEach(([nm, v], k) => nodes.push({ id: "r" + k, label: `${nm}=${v}`, shape: "box", w: 112, h: 28, x: CTL.x - 116 + k * 116, y: CTL.y + 58, state: (sig.reg || []).includes(k) ? "active" : nm === "status" && v === "READY" ? "found" : "default" }));
      nodes.push({ id: "dsk", label: "Device", shape: "box", w: 96, h: 44, x: DSK.x, y: DSK.y, state: S.status === "BUSY" ? "active" : "default", sub: S.status === "BUSY" ? `還要 ${S.left} 單位` : "" });
      if (m === DMA) nodes.push({ id: "dma", label: "DMA Controller", shape: "box", w: 170, h: 44, x: DMAC.x, y: DMAC.y, state: sig.dma || (S.dmaBusy ? "compare" : "default") });
      if (m === DMA) labels.push({ id: "dmas", x: DMAC.x + 92, y: DMAC.y, text: `dst=&buf[${S.dmaDst}] count=${S.dmaCount}`, anchor: "start" });
      (sig.edges || []).forEach(([a, b, st, text, lx, ly]) => {
        edges.push({ from: a, to: b, directed: true, state: st });
        if (text) labels.push({ id: "e" + a + b, x: lx, y: ly, text, anchor: "middle", cls: st === "removed" ? "warn" : "strong" });
      });
      if (S.status === "BUSY" && !sig.noDev) edges.push({ from: "dsk", to: "ctl", directed: true, state: "muted" });
      return { nodes, edges, labels, caption, line };
    }
    // 常用的訊號（from, to, state, 文字, 文字 x, 文字 y）
    const E = {
      cmd: ["cpu", "ctl", "active", "寫 control：READ", 350, 166],
      poll: ["ctl", "cpu", "compare", "讀 status", 350, 166],
      data: ["ctl", "cpu", "compare", "讀 data-in", 350, 166],
      store: ["cpu", "mem", "compare", "寫 buf[i]", 340, 70],
      irq: ["ctl", "cpu", "removed", "IRQ 3", 350, 166],
      ready: ["dsk", "ctl", "active", "", 0, 0],
      dset: ["cpu", "dma", "active", "dst、count、READ", 290, 128],
      dreq: ["ctl", "dma", "active", "DMA-request", 470, 252],
      dwr: ["dma", "mem", "active", "DMA 寫記憶體", 330, 150],
      dack: ["dma", "ctl", "active", "DMA-ack", 470, 252],
      dirq: ["dma", "cpu", "removed", "IRQ 5", 290, 128],
    };
    const lbl = (e, t) => [e[0], e[1], e[2], t, e[4], e[5]];

    function runPoll(n, d) {
      reset(POLL, n, d); player.setCode(CODE_POLL);
      const r = new Recorder();
      r.push(frame(`Polling（programmed I/O）：CPU 自己下命令、自己反覆讀 <b>status register</b> 等裝置準備好，再自己把資料從 <b>data-in register</b> 搬進記憶體。CPU 從頭到尾都綁在這次 I/O 上。`, null));
      for (let i = 0; i < n; i++) {
        issue(); S.cpu = "下命令"; S.cpuSt = "compare";
        r.push(frame(`第 ${i + 1} 筆：driver 寫 control register = READ，裝置開始準備資料，status 變成 <b>BUSY</b>。`, LP.issue, { edges: [E.cmd], reg: [0, 1] }));
        if (i === 0) {
          while (S.status !== "READY") {
            S.polls++; S.cpu = "busy-wait 空轉"; tick();
            const ok = S.status === "READY";
            r.push(frame(`讀 status = BUSY，還沒好，polls = ${S.polls}。` + (ok ? ` 同時裝置把資料 ${S.dataIn} 放進 data-in，status 變成 <b>READY</b>。` : ` 裝置還要 ${S.left} 個單位；CPU 什麼都不能做，只能再查一次。`), ok ? LP.tick : LP.loop, { edges: [lbl(E.poll, "讀 status：BUSY")], reg: [0], cpuWarn: true }));
          }
          r.push(frame(`再讀一次 status = <b>READY</b>，離開 while 迴圈。這 ${d} 次檢查全是空轉：裝置越慢，浪費越多。`, LP.exit, { edges: [lbl(E.poll, "讀 status：READY")], reg: [0] }));
        } else {
          S.polls += d; S.cpu = "busy-wait 空轉"; while (tick() === false && S.status === "BUSY");
          r.push(frame(`同樣反覆讀 status，又空轉 ${d} 次（polls = ${S.polls}），裝置才把資料 ${S.dataIn} 準備好、status 變 READY。`, LP.loop, { edges: [lbl(E.poll, "讀 status ×" + d)], reg: [0], cpuWarn: true }));
        }
        S.buf[i] = S.dataIn; S.justWrote = i; S.moved++; S.status = "IDLE"; S.cpu = "搬資料";
        r.push(frame(`CPU 讀 data-in = ${S.buf[i]}，<b>自己</b>寫進 buf[${i}]，再把 status 清回 IDLE。每一筆資料都要經過 CPU 的暫存器。`, LP.move, { edges: [lbl(E.data, "讀 data-in"), lbl(E.store, `寫 buf[${i}]`)], reg: [0, 2] }));
      }
      S.justWrote = -1; S.cpu = "這段時間沒做任何別的事"; S.cpuSt = "compare";
      r.push(frame(`<b>總結</b>：讀 ${n} 筆共空轉 ${S.polls} 次（= ${n} 筆 × ${d}），CPU 還親手搬了 ${n} 筆；這段時間 CPU 沒有做任何其他工作。裝置很快（每筆幾乎馬上好）時 polling 很划算，裝置很慢時就是在浪費 CPU。`, LP.ret));
      return r.frames;
    }

    function cpuStep(r, i, line, dmaMode) {   // 等第 i 筆期間：CPU 做其他工作、裝置準備
      if (i === 0) {
        for (let t = 0; t < S.d; t++) {
          S.other++; S.cpu = `執行其他程式（第 ${S.other} 條指令）`; S.cpuSt = "default";
          const ok = tick();
          if (!ok) r.push(frame(`CPU 沒有在等：它去執行其他 process 的指令（otherWork = ${S.other}）。每條指令結束時檢查 interrupt-request line，現在沒有訊號。裝置還要 ${S.left} 個單位。`, line));
          else return;
        }
      } else {
        S.other += S.d - 1; S.cpu = "執行其他程式"; S.cpuSt = "default";
        S.other++; while (!tick() && S.status === "BUSY");
        return true;
      }
    }

    function runInt(n, d) {
      reset(INT, n, d); player.setCode(CODE_INT);
      const r = new Recorder();
      S.vecHot = 3;
      issue(); S.cpu = "下命令"; S.cpuSt = "compare";
      r.push(frame(`Interrupt-driven I/O：開機時 kernel 已把 vector[3] 設成 devISR。driver 寫 control = READ 下第一筆命令，<b>下完就去做別的事</b>，不必盯著 status。`, LI.setup, { edges: [E.cmd], reg: [1] }));
      S.vecHot = -1;
      for (let i = 0; i < n; i++) {
        const fast = cpuStep(r, i, LI.other);
        if (fast) {
          S.ints++; S.buf[i] = S.dataIn; S.justWrote = i; S.moved++; S.status = "IDLE";
          if (i < n - 1) issue();
          S.cpu = "ISR 搬資料"; S.cpuSt = "compare"; S.vecHot = 3;
          r.push(frame(`第 ${i + 1} 筆：CPU 先做了 ${d} 條其他指令（otherWork = ${S.other}），裝置好了就發 <b>IRQ 3</b>；CPU 保存狀態 → 查 vector[3] → devISR 把 ${S.buf[i]} 寫進 buf[${i}]${i < n - 1 ? "，並下一筆命令" : ""}（中斷 ${S.ints} 次）。`, LI.isr, { edges: [lbl(E.irq, "IRQ 3"), lbl(E.store, `寫 buf[${i}]`)], reg: [0, 2] }));
          S.vecHot = -1;
          continue;
        }
        S.cpu = "執行其他程式"; S.cpuSt = "default";
        r.push(frame(`裝置把資料 ${S.dataIn} 放進 data-in、status = READY，controller 拉起 <b>interrupt-request line（IRQ 3）</b>。CPU 正在執行的那條指令（otherWork = ${S.other}）會先做完。`, LI.other, { edges: [E.irq], reg: [0, 2], noDev: true }));
        S.ints++; S.cpu = "保存狀態、切到 kernel mode"; S.cpuSt = "removed";
        r.push(frame(`指令結束時 CPU 檢查到 IRQ line：<b>硬體自動保存</b> PC 與狀態暫存器、切到 kernel mode（中斷 ${S.ints} 次）。被打斷的 process 之後會從這裡繼續。`, LI.check, { edges: [E.irq] }));
        S.vecHot = 3; S.cpu = "查向量表";
        r.push(frame(`用中斷編號 3 當索引查 <b>interrupt vector table</b>，得到 devISR 的位址，直接跳過去；不用一個一個問「是哪個裝置」。`, LI.vec));
        S.buf[i] = S.dataIn; S.justWrote = i; S.moved++; S.status = "IDLE"; S.cpu = "執行 devISR"; S.cpuSt = "compare";
        r.push(frame(`devISR：讀 data-in = ${S.buf[i]}，寫進 buf[${i}]，把 status 清為 IDLE（等於告訴裝置「中斷收到了」）。資料仍然是 <b>CPU 一筆一筆搬</b>的，每筆一次中斷。`, LI.isr, { edges: [lbl(E.data, "讀 data-in"), lbl(E.store, `寫 buf[${i}]`)], reg: [0, 2] }));
        if (i < n - 1) {
          issue();
          r.push(frame(`還沒讀完（ioPos = ${i + 1} &lt; ${n}），ISR 順便下一筆命令，然後恢復狀態、返回被中斷的 process。`, LI.next, { edges: [E.cmd], reg: [1] }));
        }
        S.vecHot = -1;
      }
      S.justWrote = -1; S.cpu = "喚醒等待的 process"; S.cpuSt = "found";
      r.push(frame(`最後一筆搬完，ioDone = 1：kernel 把等待這次 read 的 process 從 waiting 移回 ready。`, LI.done));
      S.cpu = "回到一般工作"; S.cpuSt = "default";
      r.push(frame(`<b>總結</b>：等待期間 CPU 做了 ${S.other} 條其他指令（polling 是 0），代價是 <b>${S.ints} 次中斷</b>（每筆一次），每次都要保存／恢復狀態，資料仍由 CPU 搬 ${S.moved} 筆。資料量大時中斷次數太多，就交給 DMA。`, LI.back));
      return r.frames;
    }

    function runDma(n, d) {
      reset(DMA, n, d); player.setCode(CODE_DMA);
      const r = new Recorder();
      S.vecHot = 5; S.dmaDst = 0; S.dmaCount = n; S.dmaBusy = true; issue(); S.cpu = "設定 DMA"; S.cpuSt = "compare";
      r.push(frame(`DMA：driver 只做一次設定，把目的位址 &amp;buf[0]、筆數 count = ${n} 寫進 DMA controller 的暫存器，再對裝置下 READ 命令；vector[5] 是 dmaISR。之後 CPU 就去做別的事。`, LD.setup, { edges: [E.dset, ["dma", "ctl", "active", "開始傳輸", 470, 252]], reg: [1], dma: "active" }));
      S.vecHot = -1;
      for (let i = 0; i < n; i++) {
        const fast = cpuStep(r, i, LD.other, true);
        if (fast) {
          S.buf[i] = S.dataIn; S.justWrote = i; S.stolen++; S.status = "IDLE"; S.dmaDst = i + 1; S.dmaCount--;
          if (S.dmaCount > 0) issue();
          S.cpu = "執行其他程式（沒有中斷）"; S.cpuSt = "default";
          r.push(frame(`第 ${i + 1} 筆：CPU 照樣做了 ${d} 條其他指令（otherWork = ${S.other}）；裝置好了送 DMA-request，DMA 偷一個 bus cycle 把 ${S.buf[i]} 寫進 buf[${i}]（stolen = ${S.stolen}），count = ${S.dmaCount}。<b>CPU 沒有收到中斷</b>。`, LD.cycle, { edges: [lbl(E.dreq, "DMA-request"), E.dwr], reg: [0, 2] }));
          continue;
        }
        S.cpu = "執行其他程式"; S.cpuSt = "default";
        r.push(frame(`資料 ${S.dataIn} 準備好了。這次 controller <b>不發中斷給 CPU</b>，而是對 DMA controller 送 <b>DMA-request</b>。`, LD.other, { edges: [E.dreq], reg: [0, 2], noDev: true }));
        S.buf[i] = S.dataIn; S.justWrote = i; S.stolen++; S.dmaDst = i + 1;
        S.cpu = "這個 bus cycle 等匯流排"; S.cpuSt = "muted";
        r.push(frame(`DMA controller 取得匯流排，直接把 ${S.buf[i]} 寫進 buf[${i}]，<b>不經過 CPU 的暫存器</b>。這個 bus cycle 被 DMA 佔用，CPU 若要存取記憶體得等一下，叫 <b>cycle stealing</b>（stolen = ${S.stolen}）。`, LD.cycle, { edges: [E.dwr], dma: "active", cpuWarn: true }));
        S.status = "IDLE"; S.dmaCount--;
        if (S.dmaCount > 0) issue();
        S.cpu = "執行其他程式"; S.cpuSt = "default";
        r.push(frame(`DMA-acknowledge：裝置把 status 清掉，DMA 把 dst 往後移、count 減 1 = ${S.dmaCount}。${S.dmaCount > 0 ? "還沒完，裝置開始準備下一筆。" : "count 變 0，整塊搬完。"}`, LD.ack, { edges: [E.dack], reg: [0], dma: "active" }));
      }
      S.dmaBusy = false; S.ints++; S.cpu = "保存狀態、切到 kernel mode"; S.cpuSt = "removed"; S.justWrote = -1;
      r.push(frame(`整塊 ${n} 筆搬完，DMA controller 對 CPU 發 <b>IRQ 5</b>：這是整次傳輸<b>唯一的一次中斷</b>。CPU 一樣先保存狀態。`, LD.fin, { edges: [E.dirq], dma: "active" }));
      S.vecHot = 5; S.cpu = "執行 dmaISR"; S.cpuSt = "compare";
      r.push(frame(`查 vector[5] 跳到 dmaISR，ioDone = 1，喚醒等待的 process。`, LD.isr));
      S.vecHot = -1; S.cpu = "回到一般工作"; S.cpuSt = "default";
      r.push(frame(`<b>總結</b>：CPU 做了 ${S.other} 條其他指令、只被中斷 <b>1 次</b>、親手搬了 <b>0 筆</b>；代價是 DMA 偷走 ${S.stolen} 個 bus cycle。比較 interrupt：同樣 ${n} 筆要中斷 ${n} 次。`, null));
      return r.frames;
    }

    // ---------- 控制列 ----------
    let method = POLL;
    const inN = ui.input(player, { placeholder: "筆數", value: "3", width: 52 });
    const inD = ui.input(player, { placeholder: "準備時間", value: "3", width: 60 });
    inN.title = "要讀幾筆資料（1～6）"; inD.title = "裝置每筆要準備幾個時間單位（1～5）";
    function err(msg) {
      player.load([{ nodes: [], edges: [], labels: [], caption: `${iconHTML("alert")} ${msg}`, line: null }], { autoplay: false });
    }
    function go(m) {
      if (m !== undefined) { method = m; mBtns.forEach((b, i) => { b.classList.toggle("ghost", i !== method); b.classList.toggle("primary", i === method); }); }
      const n = ui.int(inN, { min: 1, max: 6 }), d = ui.int(inD, { min: 1, max: 5 });
      if (n === null) return err(`筆數請輸入 1～6 的整數（目前是「${esc(inN.value)}」），記憶體的 buf 最多畫 6 格。`);
      if (d === null) return err(`準備時間請輸入 1～5 的整數（目前是「${esc(inD.value)}」）：裝置每準備一筆要幾個時間單位。`);
      player.load([runPoll, runInt, runDma][method](n, d));
    }
    const mBtns = MNAME.map((nm, i) => ui.button(player, nm, () => go(i), i === 0 ? "primary" : "ghost"));
    ui.button(player, "執行", () => go());
    ui.button(player, "例：慢裝置 polling", () => { inN.value = "2"; inD.value = "5"; go(POLL); }, "ghost");
    ui.button(player, "例：每筆一次中斷", () => { inN.value = "4"; inD.value = "2"; go(INT); }, "ghost");
    ui.button(player, "例：DMA 搬 6 筆", () => { inN.value = "6"; inD.value = "2"; go(DMA); }, "ghost");

    const demo = runPoll(3, 3);
    demo[0].caption = iconHTML("play") + " 按播放看示範：polling 讀 3 筆、裝置每筆要 3 個時間單位。上方三個按鈕切換 Polling／Interrupt／DMA；輸入框是筆數（1～6）與裝置準備時間（1～5），改完按「執行」。";
    player.load(demo, { autoplay: false });
  });

  // ===================== 動畫二：CPU 負擔計算器 =====================
  // 數字可用 K、M、G（10^3、10^6、10^9）
  function parseQty(s) {
    const m = String(s).trim().match(/^(\d+(?:\.\d+)?)\s*([kKmMgG]?)$/);
    if (!m) return null;
    return Number(m[1]) * { "": 1, k: 1e3, m: 1e6, g: 1e9 }[m[2].toLowerCase()];
  }
  function fmt(x) {
    const a = Math.abs(x);
    const u = a >= 1e9 ? [1e9, "G"] : a >= 1e6 ? [1e6, "M"] : a >= 1e3 ? [1e3, "K"] : [1, ""];
    const v = x / u[0];
    return (Number.isInteger(v) ? String(v) : String(Number(v.toPrecision(4)))) + u[1];
  }
  function pct(f) {
    const p = f * 100;
    if (p === 0) return "0%";
    if (p >= 10) return p.toFixed(1).replace(/\.0$/, "") + "%";
    return Number(p.toPrecision(3)) + "%";
  }

  register("io-cpu-load", function (root) {
    const player = new Player(root, {
      title: "CPU Load 三種 I/O 方式的 CPU 時間佔比",
      width: 680, height: 300, code: CODE_LOAD, wide: true,
      legend: [["active", "正在計算"], ["found", "最省 CPU"], ["removed", "超過 100%：CPU 跟不上"], ["default", "已算出"]],
    });
    const ln = finder(CODE_LOAD);
    const L = {
      poll: [ln("double polls = rate / unit;"), ln("return polls * cPoll / clock;")],
      int: [ln("double ints = rate / unit * active;"), ln("return ints * cInt / clock;")],
      dma: [ln("double blocks = rate / block * active;"), ln("return blocks * cDma / clock;")],
    };
    const NAMES = ["Polling", "Interrupt", "DMA"];
    const BX = 150, BW = 440;

    function frame(P, vals, hot, caption, line) {
      const nodes = [], labels = [];
      labels.push({ id: "p1", x: 16, y: 20, text: `裝置 ${fmt(P.rate)}B/s｜每次 ${fmt(P.unit)} B｜CPU ${fmt(P.clock)}Hz｜活躍 ${P.act}%`, cls: "title", anchor: "start" });
      labels.push({ id: "p2", x: 16, y: 42, text: `一次 poll ${fmt(P.cPoll)} 週期｜一次中斷 ${fmt(P.cInt)} 週期｜DMA 每塊 ${fmt(P.block)} B、${fmt(P.cDma)} 週期`, cls: "title", anchor: "start" });
      const known = vals.filter((v) => v != null);
      const scale = Math.max(0.01, ...known);       // 長條的滿格 = 目前最大的佔比
      const best = vals.every((v) => v != null) ? Math.min(...vals) : null;
      vals.forEach((v, i) => {
        const y = 92 + i * 62;
        labels.push({ id: "n" + i, x: BX - 14, y, text: NAMES[i], cls: "strong", anchor: "end" });
        if (v == null) { nodes.push({ id: "bar" + i, label: "", shape: "box", w: BW, h: 30, x: BX + BW / 2, y, state: "ghost" }); labels.push({ id: "v" + i, x: BX + BW + 12, y, text: "?", anchor: "start" }); return; }
        const w = Math.max(6, (BW * v) / scale);
        const st = v > 1 ? "removed" : i === hot ? "active" : best != null && v === best ? "found" : "default";
        nodes.push({ id: "bar" + i, label: "", shape: "box", w, h: 30, x: BX + w / 2, y, state: st });
        labels.push({ id: "v" + i, x: BX + w + 12, y, text: pct(v), cls: v > 1 ? "warn" : "strong", anchor: "start" });
      });
      if (known.length) labels.push({ id: "ax", x: BX, y: 282, text: `長條長度相對於目前最大的值（滿格 = ${pct(scale)}）`, anchor: "start" });
      return { nodes, labels, caption, line };
    }

    function run(P) {
      const r = new Recorder();
      const a = P.act / 100;
      const vals = [null, null, null];
      r.push(frame(P, vals, -1, `題目：裝置每秒傳 ${fmt(P.rate)} byte，每次 poll／中斷搬 ${fmt(P.unit)} byte，CPU 每秒有 ${fmt(P.clock)} 個週期，裝置有 ${P.act}% 的時間真的在傳。算每秒花在 I/O 的週期數，除以時脈，就是 CPU 時間佔比。`, null));
      const polls = P.rate / P.unit;
      vals[0] = (polls * P.cPoll) / P.clock;
      r.push(frame(P, vals, 0, `<b>Polling</b>：要不漏資料，每秒至少查 ${fmt(P.rate)} / ${fmt(P.unit)} = <b>${fmt(polls)} 次</b>；每次 ${fmt(P.cPoll)} 週期 → ${fmt(polls * P.cPoll)} 週期／秒 ÷ ${fmt(P.clock)} = <b>${pct(vals[0])}</b>。裝置閒著時也得照查，所以和活躍比例無關。`, L.poll));
      const ints = polls * a;
      vals[1] = (ints * P.cInt) / P.clock;
      r.push(frame(P, vals, 1, `<b>Interrupt</b>：只有真的有資料才中斷，每秒 ${fmt(polls)} × ${P.act}% = <b>${fmt(ints)} 次</b>；每次 ${fmt(P.cInt)} 週期（含保存狀態、ISR、搬資料）→ <b>${pct(vals[1])}</b>。` + (vals[1] > vals[0] ? ` 比 polling 還高：裝置幾乎一直在傳，而一次中斷比一次 poll 貴。` : ` 比 polling 低：裝置閒著的時間不用花 CPU。`), L.int));
      const blocks = (P.rate / P.block) * a;
      vals[2] = (blocks * P.cDma) / P.clock;
      r.push(frame(P, vals, 2, `<b>DMA</b>：每 ${fmt(P.block)} byte 才中斷一次，每秒 ${fmt(P.rate)} / ${fmt(P.block)} × ${P.act}% = <b>${fmt(blocks)} 塊</b>；每塊 ${fmt(P.cDma)} 週期（設定 + 完成中斷）→ <b>${pct(vals[2])}</b>。搬資料本身由 DMA 做，不算 CPU 時間。`, L.dma));
      const mn = Math.min(...vals);
      let s = `<b>結論</b>：${NAMES.filter((_, i) => vals[i] === mn).join("、")} 最省（${pct(mn)}）。`;
      const over = vals.map((v, i) => (v > 1 ? NAMES[i] : null)).filter(Boolean);
      if (over.length) s += ` <b>${over.join("、")} 超過 100%</b>：CPU 每秒的週期全拿來處理 I/O 都不夠，這種組合根本跟不上裝置。`;
      if (P.block < P.unit) s += " 注意 DMA 的塊比每次傳輸還小，這不合理，通常塊要大得多才划算。";
      if (vals[2] > 0 && vals[0] > 0) {
        const k = vals[2] / vals[0];
        s += k < 1 ? ` DMA 的負擔只有 polling 的 1/${Number((1 / k).toPrecision(3))}。` : ` DMA 的負擔是 polling 的 ${Number(k.toPrecision(3))} 倍：每塊太小，DMA 的固定成本划不來。`;
      }
      if (P.act === 0) s += " 裝置完全沒在傳時，只有 polling 還在白白花 CPU。";
      r.push(frame(P, vals, -1, s, null));
      return r.frames;
    }

    const F = [
      ["rate", "裝置速率 B/s（可寫 8M）", "8M", 76],
      ["unit", "每次傳輸 B", "16", 52],
      ["clock", "CPU 時脈 Hz（可寫 1G）", "1G", 60],
      ["cPoll", "一次 poll 週期", "300", 64],
      ["cInt", "一次中斷週期", "600", 64],
      ["block", "DMA 塊大小 B（可寫 8K）", "8K", 60],
      ["cDma", "DMA 每塊週期（設定＋完成中斷）", "3000", 64],
      ["act", "裝置活躍 %（0～100）", "100", 48],
    ];
    const inp = {};
    F.forEach(([k, t, v, w]) => { inp[k] = ui.input(player, { placeholder: t.split("（")[0], value: v, width: w }); inp[k].title = t; });
    function err(msg) {
      player.load([{ nodes: [], labels: [], caption: `${iconHTML("alert")} ${msg}`, line: null }], { autoplay: false });
    }
    const LIM = { rate: [1, 1e11], unit: [1, 1e9], clock: [1e6, 1e11], cPoll: [1, 1e8], cInt: [1, 1e8], block: [1, 1e10], cDma: [1, 1e9] };
    function go() {
      const P = {};
      for (const [k, t] of F) {
        if (k === "act") {
          const v = ui.int(inp.act, { min: 0, max: 100 });
          if (v === null) return err(`裝置活躍比例請輸入 0～100 的整數（目前是「${esc(inp.act.value)}」）。`);
          P.act = v; continue;
        }
        const v = parseQty(inp[k].value);
        if (v === null || v < LIM[k][0] || v > LIM[k][1]) {
          inp[k].classList.add("is-error"); setTimeout(() => inp[k].classList.remove("is-error"), 700);
          return err(`「${t.split("（")[0]}」看不懂或超出範圍（目前是「${esc(inp[k].value)}」）：請輸入正數，可以用 K、M、G 代表 10^3、10^6、10^9，範圍 ${fmt(LIM[k][0])}～${fmt(LIM[k][1])}。`);
        }
        P[k] = v;
      }
      player.load(run(P));
    }
    const set = (vals) => { F.forEach(([k], i) => (inp[k].value = vals[i])); go(); };
    ui.button(player, "計算", go);
    ui.button(player, "例：硬碟", () => set(["8M", "16", "1G", "300", "600", "8K", "3000", "100"]), "ghost");
    ui.button(player, "例：滑鼠", () => set(["120", "4", "1G", "300", "600", "4", "600", "100"]), "ghost");
    ui.button(player, "例：裝置常閒置", () => set(["8M", "16", "1G", "300", "600", "8K", "3000", "10"]), "ghost");
    ui.button(player, "例：10 Gbps 網卡", () => set(["1.25G", "64", "3G", "300", "2000", "64K", "3000", "100"]), "ghost");

    const P0 = { rate: 8e6, unit: 16, clock: 1e9, cPoll: 300, cInt: 600, block: 8000, cDma: 3000, act: 100 };
    const demo = run(P0);
    demo[0].caption = iconHTML("play") + " 按播放看示範：8 MB/s 的硬碟。輸入框依序是：裝置速率、每次傳輸大小、CPU 時脈、一次 poll 的週期、一次中斷的週期、DMA 塊大小、DMA 每塊的週期、裝置活躍 %（滑鼠移到輸入框上會顯示名稱），改完按「計算」。";
    player.load(demo, { autoplay: false });
  });

  // ===================== 靜態圖 =====================
  // 圖 1：匯流排與裝置控制器
  figure("io-bus", () => {
    const nodes = [], edges = [], labels = [];
    nodes.push({ id: "cpu", label: "CPU", shape: "box", w: 120, h: 44, x: 110, y: 50, state: "compare" });
    nodes.push({ id: "mem", label: "Memory", shape: "box", w: 140, h: 44, x: 560, y: 50, state: "default" });
    nodes.push({ id: "bus", label: "system bus（例如 PCIe）", shape: "box", w: 620, h: 30, x: 340, y: 132, state: "muted" });
    edges.push({ from: "cpu", to: "bus" }); edges.push({ from: "mem", to: "bus" });
    const cs = [["磁碟控制器", "磁碟"], ["USB 控制器", "鍵盤、滑鼠"], ["網路控制器", "網路"], ["顯示控制器", "螢幕"]];
    cs.forEach(([c, d], i) => {
      const x = 100 + i * 160;
      nodes.push({ id: "c" + i, label: c, shape: "box", w: 148, h: 36, x, y: 210, state: "active" });
      nodes.push({ id: "d" + i, label: d, shape: "box", w: 110, h: 32, x, y: 284, state: "default" });
      edges.push({ from: "bus", to: "c" + i }); edges.push({ from: "c" + i, to: "d" + i });
    });
    labels.push({ id: "t", x: 340, y: 322, text: "每個 controller 有 data-in、data-out、status、control 暫存器，driver 讀寫它們來控制裝置", anchor: "middle" });
    return { width: 680, height: 340, nodes, edges, labels };
  });

  // 圖 2：port-mapped I/O 與 memory-mapped I/O
  figure("io-port-mmio", () => {
    const nodes = [], labels = [];
    labels.push({ id: "a", x: 170, y: 20, text: "(a) Port-mapped I/O：兩個位址空間", cls: "strong" });
    labels.push({ id: "b", x: 510, y: 20, text: "(b) Memory-mapped I/O：一個位址空間", cls: "strong" });
    nodes.push({ id: "m1", label: "RAM", shape: "box", w: 140, h: 150, x: 100, y: 130, state: "default" });
    labels.push({ id: "m1l", x: 100, y: 222, text: "load／store", anchor: "middle" });
    [["0x60 鍵盤", 70], ["0x1F0 磁碟", 110], ["0x3F8 序列埠", 150]].forEach(([t, y], i) =>
      nodes.push({ id: "p" + i, label: t, shape: "box", w: 140, h: 34, x: 260, y: y + 8, state: "active" }));
    labels.push({ id: "pl", x: 260, y: 222, text: "in／out 指令", anchor: "middle" });
    nodes.push({ id: "m2", label: "RAM", shape: "box", w: 160, h: 100, x: 510, y: 106, state: "default" });
    nodes.push({ id: "io2", label: "裝置暫存器", shape: "box", w: 160, h: 40, x: 510, y: 182, state: "active" });
    nodes.push({ id: "m3", label: "RAM", shape: "box", w: 160, h: 30, x: 510, y: 222, state: "default" });
    labels.push({ id: "r2", x: 510, y: 256, text: "同一套 load／store 就能存取裝置", anchor: "middle" });
    labels.push({ id: "w", x: 340, y: 284, text: "MMIO 的那段位址要設成不可快取（uncached），否則讀到的是 cache 裡的舊狀態", cls: "warn", anchor: "middle" });
    return { width: 680, height: 300, nodes, labels };
  });

  // 圖 3：polling 與 interrupt 的 CPU 時間線
  figure("io-poll-vs-int", () => {
    const nodes = [], labels = [];
    const row = (y, seq, id) => seq.forEach((s, i) => nodes.push({ id: id + i, label: s[0], shape: "box", w: 50, h: 32, x: 150 + i * 54, y, state: s[1] }));
    labels.push({ id: "a", x: 16, y: 24, text: "(a) Polling：裝置準備資料的時間，CPU 全在查 status", cls: "title", anchor: "start" });
    labels.push({ id: "al", x: 16, y: 62, text: "CPU", anchor: "start" });
    const P = ["查", "compare"], M = ["搬", "active"], W = ["工作", "default"], I = ["ISR", "removed"];
    row(62, [P, P, P, P, M, P, P, P, P, M], "p");
    labels.push({ id: "b", x: 16, y: 112, text: "(b) Interrupt：CPU 照常工作，資料好了才被打斷一下", cls: "title", anchor: "start" });
    labels.push({ id: "bl", x: 16, y: 150, text: "CPU", anchor: "start" });
    row(150, [W, W, W, W, I, W, W, W, W, I], "i");
    labels.push({ id: "dl", x: 16, y: 196, text: "裝置", anchor: "start" });
    [0, 5].forEach((s, k) => nodes.push({ id: "dev" + k, label: "準備資料", shape: "box", w: 212, h: 28, x: 150 + s * 54 + 81, y: 196, state: "muted" }));
    labels.push({ id: "tm", x: 664, y: 232, text: "時間 →", anchor: "end" });
    labels.push({ id: "n", x: 16, y: 232, text: "藍：空轉檢查　橘：搬資料　紅：中斷處理（保存狀態＋ISR）", anchor: "start" });
    return { width: 680, height: 250, nodes, labels };
  });

  // 圖 4：中斷處理的流程
  figure("io-interrupt-flow", () => {
    const nodes = [], edges = [], labels = [];
    const steps = [["① 裝置拉起 IRQ line", "active"], ["② 目前指令做完才檢查", "default"], ["③ 保存 PC、狀態", "compare"],
      ["⑥ 恢復狀態、返回", "found"], ["⑤ 執行 ISR（top half）", "removed"], ["④ 查 vector table", "compare"]];
    steps.forEach(([t, st], i) => {
      const r = Math.floor(i / 3), c = i % 3;
      nodes.push({ id: "s" + i, label: t, shape: "box", w: 196, h: 40, x: 116 + c * 224, y: 52 + r * 96, state: st });
    });
    [[0, 1], [1, 2], [2, 5], [5, 4], [4, 3]].forEach(([a, b]) => edges.push({ from: "s" + a, to: "s" + b, directed: true }));
    labels.push({ id: "v", x: 340, y: 210, text: "vector table：0 除以零｜14 page fault｜32+ 外部裝置｜0x80 system call（x86 例）", anchor: "middle" });
    labels.push({ id: "m", x: 340, y: 236, text: "高優先權中斷可以打斷低優先權的 ISR；maskable 中斷可被暫時遮罩", anchor: "middle" });
    return { width: 680, height: 252, nodes, edges, labels };
  });

  // 圖 5：DMA 的步驟
  figure("io-dma-steps", () => {
    const nodes = [], edges = [], labels = [];
    nodes.push({ id: "cpu", label: "CPU", shape: "box", w: 120, h: 44, x: 100, y: 56, state: "compare" });
    nodes.push({ id: "mem", label: "Memory（buffer）", shape: "box", w: 180, h: 44, x: 560, y: 56, state: "found" });
    nodes.push({ id: "dma", label: "DMA controller", shape: "box", w: 160, h: 44, x: 100, y: 236, state: "active" });
    nodes.push({ id: "dc", label: "disk controller", shape: "box", w: 160, h: 44, x: 560, y: 236, state: "default" });
    edges.push({ from: "cpu", to: "dma", directed: true, state: "compare" });
    edges.push({ from: "dc", to: "dma", directed: true, state: "active" });
    edges.push({ from: "dma", to: "mem", directed: true, state: "found" });
    labels.push({ id: "l1", x: 112, y: 148, text: "① 寫位址、長度、方向", anchor: "start" });
    labels.push({ id: "l2", x: 330, y: 224, text: "② DMA-request／③ DMA-ack", anchor: "middle" });
    labels.push({ id: "l3", x: 450, y: 150, text: "④ 每筆搶一個 bus cycle 寫記憶體", anchor: "start" });
    labels.push({ id: "l4", x: 340, y: 292, text: "⑤ 重複到 count = 0　⑥ 整塊完成才中斷 CPU 一次", cls: "strong", anchor: "middle" });
    return { width: 680, height: 310, nodes, edges, labels };
  });

  // 圖 6：blocking、nonblocking、asynchronous
  figure("io-blocking-models", () => {
    const nodes = [], labels = [];
    const box = (id, t, x, w, y, st) => nodes.push({ id, label: t, shape: "box", w, h: 30, x: x + w / 2, y, state: st });
    labels.push({ id: "a", x: 16, y: 22, text: "(a) Blocking：呼叫後 process 進 waiting，資料到齊才返回", cls: "title", anchor: "start" });
    box("a1", "read()", 120, 80, 52, "compare"); box("a2", "waiting（不能做別的）", 204, 300, 52, "removed"); box("a3", "拿到資料繼續", 508, 150, 52, "found");
    labels.push({ id: "b", x: 16, y: 98, text: "(b) Nonblocking：立刻返回「現在有的」（可能 0 byte），要自己再問", cls: "title", anchor: "start" });
    box("b1", "read()→2B", 120, 110, 128, "compare"); box("b2", "做別的事", 234, 120, 128, "default"); box("b3", "read()→0B", 358, 110, 128, "compare"); box("b4", "做別的事", 472, 90, 128, "default"); box("b5", "read()", 566, 92, 128, "compare");
    labels.push({ id: "c", x: 16, y: 174, text: "(c) Asynchronous：立刻返回，整個 I/O 完成後 kernel 主動通知", cls: "title", anchor: "start" });
    box("c1", "aio_read()", 120, 110, 204, "compare"); box("c2", "做別的事（I/O 在背景進行）", 234, 300, 204, "default"); box("c3", "完成通知", 538, 120, 204, "found");
    labels.push({ id: "l", x: 16, y: 52, text: "app", anchor: "start" });
    labels.push({ id: "l2", x: 16, y: 128, text: "app", anchor: "start" });
    labels.push({ id: "l3", x: 16, y: 204, text: "app", anchor: "start" });
    labels.push({ id: "t", x: 664, y: 238, text: "時間 →", anchor: "end" });
    return { width: 680, height: 252, nodes, labels };
  });

  // 圖 7：kernel I/O 的分層
  figure("io-kernel-layers", () => {
    const nodes = [], edges = [], labels = [];
    const L = [["user process：read(fd, buf, n)", "default", "user mode"], ["system call 介面", "compare", ""],
      ["kernel I/O subsystem：排程、緩衝、快取、spooling…", "active", "與裝置無關"], ["device drivers（含 interrupt handler）", "new", "與裝置有關"],
      ["device controllers（硬體暫存器）", "muted", "硬體"], ["devices：磁碟、鍵盤、網卡……", "muted", ""]];
    L.forEach(([t, st, side], i) => {
      nodes.push({ id: "l" + i, label: t, shape: "box", w: 500, h: 34, x: 300, y: 30 + i * 50, state: st });
      if (side) labels.push({ id: "s" + i, x: 566, y: 30 + i * 50, text: side, anchor: "start" });
      if (i) edges.push({ from: "l" + (i - 1), to: "l" + i });
    });
    return { width: 680, height: 300, nodes, edges, labels };
  });
})();
