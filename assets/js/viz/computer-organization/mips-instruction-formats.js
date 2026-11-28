/* =====================================================================
   MIPS Instruction Formats（MIPS 指令格式）主題的視覺化
   - mips-codec : 輸入一條組語指令（組譯）或一個 32 位元十六進位碼（解碼），
                  逐欄位填入 / 拆解，並算出 branch、jump 的目標位址
   - 靜態圖：R / I / J 三種格式、branch 與 jump 目標怎麼組成、
             符號延伸與 lui + ori、RISC-V 六種格式
   ===================================================================== */
(function () {
  "use strict";
  const { Player, Recorder, ui, register, esc, iconHTML, figure } = window.DSViz;

  // @@CODE-BEGIN（由 .work/build_js.py 從 code/computer-organization/mips-instruction-formats.c 原封不動抽出）
  const CODE_ENC = [
    "uint32_t encodeR(int rs, int rt, int rd, int shamt, int funct) {",
    "  return (0u << 26)                     /* R-type 的 opcode 一律是 0 */",
    "       | ((uint32_t)rs << 21) | ((uint32_t)rt << 16)",
    "       | ((uint32_t)rd << 11) | ((uint32_t)shamt << 6)",
    "       | (uint32_t)funct;               /* 真正的運算由 funct 決定 */",
    "}",
    "",
    "uint32_t encodeI(int op, int rs, int rt, int imm) {",
    "  return ((uint32_t)op << 26) | ((uint32_t)rs << 21) | ((uint32_t)rt << 16)",
    "       | ((uint32_t)imm & 0xFFFFu);     /* 負數取低 16 位，就是 2's complement */",
    "}",
    "",
    "uint32_t encodeJ(int op, uint32_t target) {",
    "  return ((uint32_t)op << 26)",
    "       | ((target >> 2) & 0x03FFFFFFu); /* 去掉最低 2 位（必為 00）與最高 4 位 */",
    "}",
    "",
    "int branchOffset(uint32_t pc, uint32_t target, int *off) {",
    "  int64_t diff = (int64_t)target - ((int64_t)pc + 4);",
    "  if (diff % 4 != 0) return 0;                     /* 目標沒有對齊 4 */",
    "  int64_t words = diff / 4;",
    "  if (words < -32768 || words > 32767) return 0;   /* 16 位元放不下：超出 ±2^15 words */",
    "  *off = (int)words;",
    "  return 1;",
    "}",
    "",
    "int canJump(uint32_t pc, uint32_t target) {",
    "  return target % 4 == 0 &&",
    "         ((pc + 4) & 0xF0000000u) == (target & 0xF0000000u);  /* 同一個 256MB 區塊 */",
    "}"
  ];
  const CODE_DEC = [
    "Fields decode(uint32_t x) {",
    "  Fields f;",
    "  f.op    = (int)((x >> 26) & 0x3F);",
    "  f.rs    = (int)((x >> 21) & 0x1F);",
    "  f.rt    = (int)((x >> 16) & 0x1F);",
    "  f.rd    = (int)((x >> 11) & 0x1F);",
    "  f.shamt = (int)((x >> 6) & 0x1F);",
    "  f.funct = (int)(x & 0x3F);",
    "  f.imm   = x & 0xFFFFu;",
    "  f.addr  = x & 0x03FFFFFFu;",
    "  return f;",
    "}",
    "",
    "Format formatOf(int op) {",
    "  if (op == 0) return FMT_R;              /* opcode 0：看 funct */",
    "  if (op == 2 || op == 3) return FMT_J;   /* j、jal */",
    "  return FMT_I;                           /* 其他都是 I-type */",
    "}",
    "",
    "int32_t signExt16(uint32_t imm) {        /* addi、slti、lw、sw、beq、bne */",
    "  int32_t v = (int32_t)(imm & 0xFFFFu);",
    "  return v >= 0x8000 ? v - 0x10000 : v;  /* 最高位是 1 → 負數，高 16 位補 1 */",
    "}",
    "",
    "uint32_t zeroExt16(uint32_t imm) {       /* andi、ori：高 16 位補 0 */",
    "  return imm & 0xFFFFu;",
    "}",
    "",
    "uint32_t branchTarget(uint32_t pc, uint32_t imm) {",
    "  return pc + 4 + (uint32_t)signExt16(imm) * 4u;",
    "}",
    "",
    "uint32_t jumpTarget(uint32_t pc, uint32_t addr26) {",
    "  return ((pc + 4) & 0xF0000000u) | (addr26 << 2);",
    "}"
  ];
  // @@CODE-END

  const lnIn = (code) => (s) => code.findIndex((l) => l.includes(s)) + 1;
  const lnEqIn = (code) => (s) => code.findIndex((l) => l.trim() === s) + 1;
  const lnE = lnIn(CODE_ENC), lnEqE = lnEqIn(CODE_ENC), lnD = lnIn(CODE_DEC);

  // ---------------- 指令表（和 .c 的 OPS 相同的 19 條） ----------------
  const REG = ["$zero", "$at", "$v0", "$v1", "$a0", "$a1", "$a2", "$a3",
    "$t0", "$t1", "$t2", "$t3", "$t4", "$t5", "$t6", "$t7",
    "$s0", "$s1", "$s2", "$s3", "$s4", "$s5", "$s6", "$s7",
    "$t8", "$t9", "$k0", "$k1", "$gp", "$sp", "$fp", "$ra"];
  // kind：r3 三暫存器、shift、jr、signed（符號延伸的算術）、logic（零延伸）、lui、mem、branch、jump
  const OPS = {
    add: { f: "R", op: 0, fn: 0x20, kind: "r3" }, sub: { f: "R", op: 0, fn: 0x22, kind: "r3" },
    and: { f: "R", op: 0, fn: 0x24, kind: "r3" }, or: { f: "R", op: 0, fn: 0x25, kind: "r3" },
    slt: { f: "R", op: 0, fn: 0x2a, kind: "r3" }, sll: { f: "R", op: 0, fn: 0x00, kind: "shift" },
    srl: { f: "R", op: 0, fn: 0x02, kind: "shift" }, jr: { f: "R", op: 0, fn: 0x08, kind: "jr" },
    beq: { f: "I", op: 4, kind: "branch" }, bne: { f: "I", op: 5, kind: "branch" },
    addi: { f: "I", op: 8, kind: "signed" }, slti: { f: "I", op: 10, kind: "signed" },
    andi: { f: "I", op: 12, kind: "logic" }, ori: { f: "I", op: 13, kind: "logic" },
    lui: { f: "I", op: 15, kind: "lui" }, lw: { f: "I", op: 35, kind: "mem" }, sw: { f: "I", op: 43, kind: "mem" },
    j: { f: "J", op: 2, kind: "jump" }, jal: { f: "J", op: 3, kind: "jump" },
  };
  const SYNTAX = {
    r3: "rd, rs, rt", shift: "rd, rt, shamt", jr: "rs", signed: "rt, rs, imm", logic: "rt, rs, imm",
    lui: "rt, imm", mem: "rt, offset(rs)", branch: "rs, rt, offset（十進位）或 0x目標位址", jump: "0x目標位址",
  };
  const byOp = {}, byFn = {};
  Object.keys(OPS).forEach((k) => { const o = OPS[k]; if (o.f === "R") byFn[o.fn] = k; else byOp[o.op] = k; });

  const FIELDS = {
    R: [["op", 31, 26], ["rs", 25, 21], ["rt", 20, 16], ["rd", 15, 11], ["shamt", 10, 6], ["funct", 5, 0]],
    I: [["op", 31, 26], ["rs", 25, 21], ["rt", 20, 16], ["imm", 15, 0]],
    J: [["op", 31, 26], ["address", 25, 0]],
  };

  const u32 = (x) => x >>> 0;
  const hex8 = (x) => "0x" + u32(x).toString(16).toUpperCase().padStart(8, "0");
  const hexN = (x, n) => "0x" + u32(x).toString(16).toUpperCase().padStart(n, "0");
  const bin = (v, n) => u32(v).toString(2).padStart(n, "0").slice(-n);
  const binGroups = (v, n) => bin(v, n).replace(/(.{4})(?=.)/g, "$1 ");
  const sext16 = (v) => ((v & 0xffff) >= 0x8000 ? (v & 0xffff) - 0x10000 : v & 0xffff);
  const rname = (n) => `${REG[n]}`;
  const rfull = (n) => `${REG[n]} = ${n}`;

  function parseNum(s) {
    s = s.trim();
    if (/^-?\d+$/.test(s)) return { v: parseInt(s, 10), hex: false };
    if (/^-?0x[0-9a-f]+$/i.test(s)) {
      const neg = s[0] === "-";
      const v = parseInt(s.replace(/^-/, "").slice(2), 16);
      return { v: neg ? -v : v, hex: true };
    }
    return null;
  }
  function parseReg(s) {
    s = s.trim().toLowerCase();
    const i = REG.indexOf(s);
    if (i >= 0) return i;
    const m = /^\$r?(\d{1,2})$/.exec(s);
    if (m && +m[1] <= 31) return +m[1];
    return -1;
  }

  // ---------------- 組語解析：回傳 { ins } 或 { err } ----------------
  function parseAsm(text) {
    const t = text.trim().replace(/\s+/g, " ");
    const m = /^([a-z]+)\s*(.*)$/i.exec(t);
    if (!m) return { err: "看不懂這行：請輸入一條組語指令（例如 add $t0, $s1, $s2），或一個 32 位元十六進位碼（例如 0x12400003）。" };
    const name = m[1].toLowerCase();
    const o = OPS[name];
    if (!o) return { err: `不認得「${esc(m[1])}」。本動畫支援：${Object.keys(OPS).join("、")}。` };
    const args = m[2] === "" ? [] : m[2].split(",").map((s) => s.trim());
    const want = { r3: 3, shift: 3, jr: 1, signed: 3, logic: 3, lui: 2, mem: 2, branch: 3, jump: 1 }[o.kind];
    const form = `格式是「${name} ${SYNTAX[o.kind]}」`;
    if (args.length !== want || args.some((a) => a === "")) return { err: `${name} 的${form}，運算元個數不對。` };
    const ins = { name, o, rs: 0, rt: 0, rd: 0, shamt: 0, imm: 0 };
    const reg = (s, what) => {
      const r = parseReg(s);
      if (r < 0) throw new Error(`${what}「${esc(s)}」不是暫存器（用 $t0、$s2、$sp 或 $0～$31）。`);
      return r;
    };
    const num = (s, lo, hi, what) => {
      const p = parseNum(s);
      if (!p) throw new Error(`${what}「${esc(s)}」不是數字（十進位或 0x 開頭的十六進位）。`);
      if (p.v < lo || p.v > hi) throw new Error(`${what}${what.endsWith("，") ? "" : " "}${esc(s)} 超出範圍：只能是 ${lo}～${hi}。`);
      return p;
    };
    try {
      switch (o.kind) {
        case "r3":
          if (parseNum(args[2])) throw new Error(`${name} 的三個運算元都要是暫存器；要和常數運算請用 ${name === "add" ? "addi" : name === "and" ? "andi" : name === "or" ? "ori" : name === "slt" ? "slti" : "addi 加上負數"}。`);
          ins.rd = reg(args[0], "rd"); ins.rs = reg(args[1], "rs"); ins.rt = reg(args[2], "rt"); break;
        case "shift":
          ins.rd = reg(args[0], "rd"); ins.rt = reg(args[1], "rt"); ins.shamt = num(args[2], 0, 31, "shamt（位移量，5 bits）").v; break;
        case "jr": ins.rs = reg(args[0], "rs"); break;
        case "signed":
          ins.rt = reg(args[0], "rt"); ins.rs = reg(args[1], "rs");
          ins.imm = num(args[2], -32768, 32767, `${name} 的立即值做符號延伸，`).v; break;
        case "logic": {
          ins.rt = reg(args[0], "rt"); ins.rs = reg(args[1], "rs");
          const p = parseNum(args[2]);
          if (p && p.v < 0) throw new Error(`${name} 的立即值做「零延伸」，只能是 0～65535（0x0000～0xFFFF），不能是負數。`);
          ins.imm = num(args[2], 0, 65535, `${name} 的立即值`).v; break;
        }
        case "lui": ins.rt = reg(args[0], "rt"); ins.imm = num(args[1], 0, 65535, "lui 的立即值（放到高 16 位）").v; break;
        case "mem": {
          ins.rt = reg(args[0], "rt");
          const mm = /^(.*?)\(\s*([^)]*)\s*\)$/.exec(args[1]);
          if (!mm) throw new Error(`${name} 的第二個運算元要寫成 offset(rs)，例如 -8($sp)。`);
          ins.rs = reg(mm[2], "base 暫存器");
          ins.imm = mm[1].trim() === "" ? 0 : num(mm[1], -32768, 32767, "位移量（16 位元、符號延伸）").v; break;
        }
        case "branch": {
          ins.rs = reg(args[0], "rs"); ins.rt = reg(args[1], "rt");
          const p = parseNum(args[2]);
          if (!p) throw new Error(`第三個運算元「${esc(args[2])}」要是十進位的 offset（以指令為單位），或 0x 開頭的目標位址。`);
          if (p.hex) {
            if (p.v < 0 || p.v > 0xffffffff) throw new Error("目標位址要在 0x00000000～0xFFFFFFFF。");
            ins.target = p.v;
          } else {
            if (p.v < -32768 || p.v > 32767) throw new Error(`offset ${p.v} 超出 16 位元 2's complement 的範圍 −32768～32767。`);
            ins.imm = p.v;
          }
          break;
        }
        case "jump": {
          const p = num(args[0], 0, 0xffffffff, "目標位址");
          ins.target = p.v; break;
        }
      }
    } catch (e) { return { err: e.message }; }
    return { ins };
  }

  function asmText(ins) {
    const n = ins.name, o = ins.o;
    switch (o.kind) {
      case "r3": return `${n} ${rname(ins.rd)}, ${rname(ins.rs)}, ${rname(ins.rt)}`;
      case "shift": return `${n} ${rname(ins.rd)}, ${rname(ins.rt)}, ${ins.shamt}`;
      case "jr": return `jr ${rname(ins.rs)}`;
      case "signed": return `${n} ${rname(ins.rt)}, ${rname(ins.rs)}, ${ins.imm}`;
      case "logic": return `${n} ${rname(ins.rt)}, ${rname(ins.rs)}, ${hexN(ins.imm, 4)}`;
      case "lui": return `lui ${rname(ins.rt)}, ${hexN(ins.imm, 4)}`;
      case "mem": return `${n} ${rname(ins.rt)}, ${ins.imm}(${rname(ins.rs)})`;
      case "branch": return `${n} ${rname(ins.rs)}, ${rname(ins.rt)}, ${ins.target != null ? hex8(ins.target) : ins.imm}`;
      case "jump": return `${n} ${hex8(ins.target)}`;
    }
    return n;
  }

  // ---------------- 畫面模型 ----------------
  const W = 760, H = 392, X0 = 28, P = 22;
  const bitX = (i) => X0 + (31 - i) * P + P / 2;
  const midX = (hi, lo) => (bitX(hi) + bitX(lo)) / 2;

  function newModel(title) {
    return { title, fmt: null, val: {}, st: {}, bits: new Array(32).fill(null), hex: null, hexState: "new", result: "", resultCls: "strong", notes: [] };
  }
  function draw(S) {
    const nodes = [], labels = [];
    labels.push({ id: "ttl", x: W / 2, y: 22, text: S.title, cls: "strong" });
    const active = {};
    if (S.fmt) {
      FIELDS[S.fmt].forEach(([name, hi, lo]) => {
        const st = S.st[name] || "default";
        nodes.push({ id: "f-" + name, shape: "box", x: midX(hi, lo), y: 92, w: (hi - lo + 1) * P - 4, h: 34, label: S.val[name] || "", state: S.val[name] == null ? "ghost" : st });
        labels.push({ id: "fn-" + name, x: midX(hi, lo), y: 60, text: `${name} [${hi}:${lo}]` });
        labels.push({ id: "bi-" + hi, x: bitX(hi), y: 167, text: String(hi) });
        if (lo !== hi) labels.push({ id: "bi-" + lo, x: bitX(lo), y: 167, text: String(lo) });
        if (st === "active") for (let i = lo; i <= hi; i++) active[i] = true;
      });
    } else {
      labels.push({ id: "bi-31", x: bitX(31), y: 167, text: "31" });
      labels.push({ id: "bi-0", x: bitX(0), y: 167, text: "0" });
    }
    for (let i = 31; i >= 0; i--) {
      const b = S.bits[i];
      nodes.push({ id: "b" + i, shape: "box", x: bitX(i), y: 140, w: 20, h: 26, label: b == null ? "" : String(b), state: b == null ? "ghost" : active[i] ? "active" : "default" });
    }
    if (S.hex) {
      for (let k = 0; k < 8; k++) {
        const hi = 31 - 4 * k;
        nodes.push({ id: "h" + k, shape: "box", x: midX(hi, hi - 3), y: 202, w: 84, h: 30, label: S.hex[k], state: S.hexState });
      }
    }
    if (S.result) labels.push({ id: "res", x: W / 2, y: 246, text: S.result, cls: S.resultCls });
    S.notes.forEach((n, k) => labels.push({ id: "n" + k, x: X0, y: 280 + k * 26, text: n.t, anchor: "start", cls: n.c || "" }));
    return { nodes, labels };
  }
  const setBits = (S, v, hi, lo) => { for (let i = lo; i <= hi; i++) S.bits[i] = (u32(v) >>> (i - lo)) & 1; };
  const markDone = (S) => Object.keys(S.st).forEach((k) => { if (S.st[k] === "active") S.st[k] = "found"; });

  // ---------------- 組譯：組語 → 機器碼 ----------------
  function encodeFrames(ins, pc) {
    const r = new Recorder();
    const o = ins.o, f = o.f;
    const srcText = asmText(ins);
    const S = newModel("組譯：" + srcText);
    const push = (cap, line) => { const d = draw(S); r.push({ nodes: d.nodes, labels: d.labels, edges: [], caption: cap, line }); };
    const fill = (name, v, valText, cap, line) => {
      markDone(S);
      const [, hi, lo] = FIELDS[f].find((x) => x[0] === name);
      setBits(S, v, hi, lo);
      S.val[name] = valText; S.st[name] = "active";
      push(cap, line);
    };
    const warn = (cap, line, notes) => {
      markDone(S);
      S.result = "無法組譯"; S.resultCls = "warn";
      S.notes = notes.map((t) => ({ t, c: "warn" }));
      push(iconHTML("alert") + " " + cap, line);
      return r.frames;
    };

    S.fmt = f;
    const order = { R: "op rs rt rd shamt funct", I: "op rs rt imm", J: "op address" }[f];
    S.notes = [{ t: `組語寫法：${ins.name} ${SYNTAX[o.kind]}` }, { t: `欄位順序：${order}（和組語的順序不一定一樣）` }];
    push(`查指令表：<b>${ins.name}</b> 是 <b>${f}-type</b>，opcode = ${o.op}${f === "R" ? `，funct = ${o.fn}（0x${o.fn.toString(16).toUpperCase().padStart(2, "0")}）` : ""}。${o.kind === "r3" ? "注意組語寫 rd 在最前面，但欄位裡 rd 排在 rs、rt 後面。" : o.kind === "mem" ? "lw / sw 的 base 暫存器放 rs，rt 是 lw 的目的地、sw 要存的資料。" : ""}`, null);

    if (f === "R") {
      const ret = lnE("(0u << 26)");
      fill("op", 0, "0", `R-type 的 opcode 一律是 <b>0</b>（000000），真正做哪種運算要看最後的 funct。`, ret);
      if (o.kind === "shift") fill("rs", 0, "0", `${ins.name} 只用 rt 和 shamt，<b>rs 不用，填 0</b>。`, lnE("| ((uint32_t)rs << 21)"));
      else if (o.kind === "jr") fill("rs", ins.rs, rfull(ins.rs), `jr 要跳到 rs 裡的位址：rs = ${esc(rfull(ins.rs))} = ${bin(ins.rs, 5)}。`, lnE("| ((uint32_t)rs << 21)"));
      else fill("rs", ins.rs, rfull(ins.rs), `第一個來源暫存器 rs = ${esc(rfull(ins.rs))}，5 位元是 ${bin(ins.rs, 5)}。`, lnE("| ((uint32_t)rs << 21)"));
      if (o.kind === "jr") fill("rt", 0, "0", "jr 沒有 rt，填 0。", lnE("| ((uint32_t)rs << 21)"));
      else fill("rt", ins.rt, rfull(ins.rt), `${o.kind === "shift" ? "被移位的來源" : "第二個來源"} rt = ${esc(rfull(ins.rt))} = ${bin(ins.rt, 5)}。`, lnE("| ((uint32_t)rs << 21)"));
      if (o.kind === "jr") fill("rd", 0, "0", "jr 不寫暫存器，rd 填 0。", lnE("((uint32_t)rd << 11)"));
      else fill("rd", ins.rd, rfull(ins.rd), `目的暫存器 rd = ${esc(rfull(ins.rd))} = ${bin(ins.rd, 5)}${ins.rd === 0 ? "（寫進 $zero 的結果會被丟掉）" : ""}。`, lnE("((uint32_t)rd << 11)"));
      fill("shamt", ins.shamt, String(ins.shamt), o.kind === "shift" ? `位移量 shamt = ${ins.shamt}，5 位元最多移 31 位（${bin(ins.shamt, 5)}）。` : "不是位移指令，shamt 填 0。", lnE("((uint32_t)rd << 11)"));
      fill("funct", o.fn, `${o.fn} ${ins.name}`, `funct = ${o.fn} = ${bin(o.fn, 6)}，硬體用它分辨 ${ins.name} 和其他 R-type 指令。`, lnE("| (uint32_t)funct;"));
    } else if (f === "I") {
      const ret = lnE("return ((uint32_t)op << 26) | ((uint32_t)rs << 21)");
      fill("op", o.op, `${o.op} ${ins.name}`, `opcode = ${o.op} = ${bin(o.op, 6)}。`, ret);
      if (o.kind === "lui") fill("rs", 0, "0", "lui 只有一個暫存器（rt），rs 不用，填 0。", ret);
      else fill("rs", ins.rs, rfull(ins.rs), o.kind === "mem" ? `base 暫存器放 rs：${esc(rfull(ins.rs))}，位址 = rs + 符號延伸(offset)。` : o.kind === "branch" ? `要比較的第一個暫存器 rs = ${esc(rfull(ins.rs))}。` : `來源 rs = ${esc(rfull(ins.rs))} = ${bin(ins.rs, 5)}。`, ret);
      fill("rt", ins.rt, rfull(ins.rt), o.kind === "branch" ? `要比較的第二個暫存器 rt = ${esc(rfull(ins.rt))}。` : o.kind === "mem" && ins.name === "sw" ? `sw 要存的資料在 rt：${esc(rfull(ins.rt))}（這時 rt 是來源）。` : `在 I-type 裡 <b>rt 是目的暫存器</b>：${esc(rfull(ins.rt))}${ins.rt === 0 ? "（寫進 $zero 會被丟掉）" : ""}。`, ret);
      let imm = ins.imm;
      if (o.kind === "branch") {
        if (ins.target != null) {
          const base = pc + 4, diff = ins.target - base;
          markDone(S);
          S.notes = [{ t: `PC = ${hex8(pc)}，PC + 4 = ${hex8(base)}` }, { t: `目標 − (PC + 4) = ${hex8(ins.target)} − ${hex8(base)} = ${diff} bytes` }];
          push(`分支是 <b>PC-relative</b>：以<b>下一條指令（PC + 4）</b>為基準，不是 beq 自己的位址。差距 = ${diff} bytes。`, lnE("int64_t diff ="));
          if (diff % 4 !== 0) return warn(`差距 ${diff} 不是 4 的倍數：MIPS 指令都對齊 4 bytes，目標位址一定是 4 的倍數。`, lnE("diff % 4 != 0"), [`${diff} ÷ 4 除不盡 → 目標沒有對齊`, "改輸入 4 的倍數的目標位址"]);
          imm = diff / 4;
          S.notes.push({ t: `offset = ${diff} ÷ 4 = ${imm}（以指令 = word 為單位）` });
          push(`offset 以 <b>word</b> 為單位：${diff} ÷ 4 = <b>${imm}</b>。16 位元能放 −32768～32767，也就是 PC + 4 前後約 ±128 KB。`, lnE("int64_t words = diff / 4"));
          if (imm < -32768 || imm > 32767) return warn(`offset ${imm} 超出 16 位元 −32768～32767：beq 跳不到。組譯器會改寫成「條件相反的 bne 跳過下一條 + j 目標」，由 j 的 26 位元負責遠跳。`, lnE("words < -32768"), [`offset = ${imm}，超出 ±2^15 words`, `改寫：${ins.name === "beq" ? "bne" : "beq"} ${rname(ins.rs)}, ${rname(ins.rt)}, 跳過下一條；j 目標`]);
        } else {
          const tgt = u32(pc + 4 + imm * 4);
          S.notes = [{ t: `offset = ${imm}：目標 = PC + 4 + ${imm} × 4` }, { t: `= ${hex8(pc + 4)} ${imm < 0 ? "−" : "+"} ${Math.abs(imm * 4)} = ${hex8(tgt)}` }];
          ins.target = tgt;
        }
      }
      const kindNote = {
        signed: `${ins.name} 的立即值之後會做<b>符號延伸</b>，所以可以是負數。`,
        logic: `${ins.name} 的立即值之後做<b>零延伸</b>（高 16 位補 0），所以範圍是 0～65535。`,
        lui: "lui 把這 16 位元放到 rt 的<b>高 16 位</b>，低 16 位清成 0。",
        mem: "位移量之後做符號延伸，再和 base 相加得到記憶體位址。",
        branch: "offset 之後做符號延伸、乘 4（左移 2）再加 PC + 4。",
      }[o.kind];
      const v16 = imm & 0xffff;
      const negNote = imm < 0 ? `負數要用 16 位元 <b>2's complement</b>：65536 − ${-imm} = ${v16} = ${hexN(v16, 4)}（不是在 ${-imm} 前面加一個符號位）。` : `${imm} = ${hexN(v16, 4)}。`;
      if (o.kind !== "branch") S.notes = [];
      S.notes.push({ t: `imm 欄位 = ${binGroups(v16, 16)} = ${hexN(v16, 4)}` });
      fill("imm", v16, `${imm}${imm < 0 || imm > 9 ? " → " + hexN(v16, 4) : ""}`, negNote + kindNote, lnE("((uint32_t)imm & 0xFFFFu)"));
    } else {
      const t = ins.target, base = u32(pc + 4);
      fill("op", o.op, `${o.op} ${ins.name}`, `opcode = ${o.op} = ${bin(o.op, 6)}，${ins.name} 是 J-type：除了 opcode，剩下 26 位元全部拿來放位址。`, lnEqE("return ((uint32_t)op << 26)"));
      S.notes = [{ t: `PC + 4 = ${hex8(base)}，高 4 位 = ${(base >>> 28).toString(16).toUpperCase()}（${bin(base >>> 28, 4)}）` }, { t: `目標 = ${hex8(t)}，高 4 位 = ${(t >>> 28).toString(16).toUpperCase()}` }];
      if (t % 4 !== 0) return warn(`目標 ${hex8(t)} 不是 4 的倍數，指令位址一定對齊 4 bytes，最低 2 位必為 00，所以不存。`, lnE("return target % 4 == 0"), [`${hex8(t)} 最低 2 位不是 00`, "j 無法表示沒有對齊的位址"]);
      if ((t >>> 28) !== (base >>> 28)) return warn(`j 的高 4 位<b>直接沿用 PC + 4</b>，只能跳到同一個 256 MB 區塊（${hex8(base & 0xf0000000)}～${hex8((base & 0xf0000000) + 0x0ffffffc)}）。目標不在裡面，要改用 lui / ori 把位址放進暫存器再 jr。`, lnE("((pc + 4) & 0xF0000000u) == (target"), [`PC + 4 的高 4 位 ${(base >>> 28).toString(16).toUpperCase()} ≠ 目標的高 4 位 ${(t >>> 28).toString(16).toUpperCase()}`, "跨 256 MB 區塊：改用 lui + ori + jr"]);
      markDone(S);
      push(`檢查：目標對齊 4，而且和 PC + 4 在同一個 256 MB 區塊（高 4 位都是 ${(t >>> 28).toString(16).toUpperCase()}），j 跳得到。`, lnE("((pc + 4) & 0xF0000000u) == (target"));
      const a26 = (t >>> 2) & 0x03ffffff;
      S.notes.push({ t: `目標 >> 2 = ${hex8(t >>> 2)}，取低 26 位 = ${hexN(a26, 7)}` });
      fill("address", a26, hexN(a26, 7), `位址欄位 = 目標的第 27～2 位：先右移 2（最低 2 位必為 00，不用存），再<b>去掉最高 4 位</b>只留 26 位 = ${hexN(a26, 7)}。只右移不去掉高位，會得到 ${hex8(t >>> 2)} 的錯誤答案。`, lnE("((target >> 2) & 0x03FFFFFFu)"));
    }
    // 四個一組換成十六進位
    markDone(S);
    let code = 0;
    for (let i = 0; i < 32; i++) code += S.bits[i] * 2 ** i;
    S.hex = hex8(code).slice(2);
    S.hexState = "new";
    push(`32 個位元從左到右每 <b>4 個一組</b>，換成一個十六進位數字：${binGroups(code, 32)} = <b>${hex8(code)}</b>。`, f === "R" ? lnE("| (uint32_t)funct;") : f === "I" ? lnE("((uint32_t)imm & 0xFFFFu)") : lnE("((target >> 2) & 0x03FFFFFFu)"));
    S.result = `機器碼 = ${hex8(code)}`; S.resultCls = "strong"; S.hexState = "found";
    Object.keys(S.st).forEach((k) => (S.st[k] = "found"));
    const fin = [];
    if (o.kind === "branch") fin.push({ t: `offset = ${sext16(code & 0xffff)}：從 PC + 4 = ${hex8(pc + 4)} 往${sext16(code & 0xffff) < 0 ? "前" : "後"}數 ${Math.abs(sext16(code & 0xffff))} 條指令` });
    if (o.kind === "branch") fin.push({ t: `跳到 ${hex8(ins.target)}（條件成立時）；不成立就執行 PC + 4 = ${hex8(pc + 4)}`, c: "ok" });
    if (f === "J") fin.push({ t: `跳到 ${hex8(ins.target)}${ins.name === "jal" ? "，並把 PC + 4 = " + hex8(pc + 4) + " 存進 $ra" : ""}`, c: "ok" });
    if (o.kind === "jr") fin.push({ t: "jr 的目標在暫存器裡，可以是任何 32 位元位址", c: "ok" });
    S.notes = fin;
    push(`完成：<code>${esc(srcText)}</code> 的機器碼是 <b>${hex8(code)}</b>。`, null);
    return r.frames;
  }

  // ---------------- 解碼：機器碼 → 組語 ----------------
  function decodeFrames(x, pc) {
    const r = new Recorder();
    const S = newModel("解碼：" + hex8(x));
    const push = (cap, line) => { const d = draw(S); r.push({ nodes: d.nodes, labels: d.labels, edges: [], caption: cap, line }); };
    setBits(S, x, 31, 0);
    S.hex = hex8(x).slice(2); S.hexState = "compare";
    push(`每個十六進位數字展開成 <b>4 個位元</b>：${hex8(x)} = ${binGroups(x, 32)}。接下來先看最左邊 6 位的 opcode，才知道後面要怎麼切。`, lnD("Fields decode(uint32_t x)"));
    const op = x >>> 26;
    const f = op === 0 ? "R" : op === 2 || op === 3 ? "J" : "I";
    const fl = op === 0 ? lnD("if (op == 0) return FMT_R") : f === "J" ? lnD("if (op == 2 || op == 3) return FMT_J") : lnD("return FMT_I;");
    const fields = { op, rs: (x >>> 21) & 31, rt: (x >>> 16) & 31, rd: (x >>> 11) & 31, shamt: (x >>> 6) & 31, funct: x & 63, imm: x & 0xffff, address: x & 0x03ffffff };
    const name = f === "R" ? byFn[fields.funct] : byOp[op];
    const o = name ? OPS[name] : null;
    S.fmt = f; S.st.op = "active";
    S.val.op = `${op}${f !== "R" && name ? " " + name : ""}`;
    push(`opcode = 第 31～26 位 = ${bin(op, 6)} = <b>${op}</b>。${f === "R" ? "opcode 0 → <b>R-type</b>，運算種類要看 funct。" : f === "J" ? `opcode ${op} → <b>J-type</b>（${name}），後 26 位都是位址。` : `opcode ${op} → <b>I-type</b>${name ? `（${name}）` : "（不在本動畫的指令表，仍照 I-type 切）"}。`}`, fl);
    const take = (nm, valText, cap, line) => { markDone(S); S.val[nm] = valText; S.st[nm] = "active"; push(cap, line); };
    const rl = (k) => lnD(`f.${k}`.padEnd(8, " ") + "=");
    if (f === "R") {
      take("rs", rfull(fields.rs), `rs = 第 25～21 位 = ${bin(fields.rs, 5)} = ${fields.rs}，也就是 ${REG[fields.rs]}。`, rl("rs"));
      take("rt", rfull(fields.rt), `rt = 第 20～16 位 = ${bin(fields.rt, 5)} = ${fields.rt}（${REG[fields.rt]}）。`, rl("rt"));
      take("rd", rfull(fields.rd), `rd = 第 15～11 位 = ${bin(fields.rd, 5)} = ${fields.rd}（${REG[fields.rd]}），R-type 的結果寫進 rd。`, rl("rd"));
      take("shamt", String(fields.shamt), `shamt = 第 10～6 位 = ${fields.shamt}${fields.shamt ? "（位移量）" : "，不是位移指令時都是 0"}。`, rl("shamt"));
      take("funct", `${fields.funct}${name ? " " + name : " ?"}`, `funct = 第 5～0 位 = ${bin(fields.funct, 6)} = ${fields.funct}（0x${fields.funct.toString(16).toUpperCase()}）→ ${name ? `<b>${name}</b>` : "不在本動畫的指令表"}。`, rl("funct"));
    } else if (f === "I") {
      take("rs", rfull(fields.rs), `rs = ${bin(fields.rs, 5)} = ${fields.rs}（${REG[fields.rs]}）${o && o.kind === "mem" ? "，是 base 暫存器" : o && o.kind === "lui" ? "，lui 不用 rs" : ""}。`, rl("rs"));
      take("rt", rfull(fields.rt), `rt = ${bin(fields.rt, 5)} = ${fields.rt}（${REG[fields.rt]}）${o && o.kind === "branch" ? "，和 rs 比較" : o && name === "sw" ? "，是要存的資料" : "，I-type 裡通常是目的暫存器"}。`, rl("rt"));
      take("imm", hexN(fields.imm, 4), `imm = 第 15～0 位 = ${binGroups(fields.imm, 16)} = ${hexN(fields.imm, 4)}，還要依指令決定怎麼延伸成 32 位元。`, rl("imm"));
    } else {
      take("address", hexN(fields.address, 7), `address = 第 25～0 位 = ${hexN(fields.address, 7)}，這是「word 位址」的低 26 位。`, rl("addr"));
    }
    markDone(S);
    let asm = "", notes = [];
    if (!o) {
      S.result = "（不在本動畫支援的 19 條指令裡）"; S.resultCls = "warn";
      S.notes = [{ t: `${f === "R" ? "funct" : "opcode"} = ${f === "R" ? fields.funct : op} 查不到`, c: "warn" }, { t: "欄位仍照上面的格式切開；支援的指令見頁面上的對照表" }];
      push(iconHTML("alert") + " 查不到這個 " + (f === "R" ? "funct" : "opcode") + "。本動畫只收常考的 19 條指令，其他指令的欄位切法一樣，只是名稱要查完整的對照表。", null);
      return r.frames;
    }
    const ins = { name, o, rs: fields.rs, rt: fields.rt, rd: fields.rd, shamt: fields.shamt, imm: 0 };
    if (f === "I") {
      const se = sext16(fields.imm);
      if (o.kind === "logic") {
        ins.imm = fields.imm;
        S.notes = [{ t: `零延伸：0x0000 接上 ${hexN(fields.imm, 4)} = ${hex8(fields.imm)} = ${fields.imm}` }];
        push(`${name} 是邏輯運算，立即值做<b>零延伸</b>：高 16 位補 0，得到 ${fields.imm}。${fields.imm >= 0x8000 ? `若誤用符號延伸會變成 ${se}。` : ""}`, lnD("return imm & 0xFFFFu;"));
      } else if (o.kind === "lui") {
        ins.imm = fields.imm;
        S.notes = [{ t: `rt = ${hexN(fields.imm, 4)} << 16 = ${hex8(fields.imm << 16)}` }];
        push(`lui 不做延伸：把 ${hexN(fields.imm, 4)} 放到 ${REG[fields.rt]} 的高 16 位，低 16 位清 0。`, rl("imm"));
      } else {
        ins.imm = se;
        S.notes = [{ t: `符號延伸：最高位是 ${fields.imm >> 15}，高 16 位補 ${fields.imm >> 15 ? "1" : "0"} → ${hex8(se)} = ${se}` }];
        push(`${name} 的立即值做<b>符號延伸</b>：第 15 位是 ${fields.imm >> 15}，${fields.imm >> 15 ? `是負數，高 16 位補 1，${hexN(fields.imm, 4)} 代表 ${se}` : `是正數，值就是 ${se}`}。`, lnD("return v >= 0x8000"));
        if (o.kind === "branch") {
          ins.target = u32(pc + 4 + se * 4);
          S.notes.push({ t: `目標 = PC + 4 + ${se} × 4 = ${hex8(pc + 4)} ${se < 0 ? "−" : "+"} ${Math.abs(se * 4)} = ${hex8(ins.target)}` });
          push(`分支目標 = (PC + 4) + 符號延伸(offset) × 4。PC = ${hex8(pc)}，所以是 ${hex8(pc + 4)} ${se < 0 ? "−" : "+"} ${Math.abs(se * 4)} = <b>${hex8(ins.target)}</b>${se < 0 ? "，offset 是負的，往回跳（迴圈）" : ""}。`, lnD("return pc + 4 + "));
        }
      }
    } else if (f === "J") {
      ins.target = u32(((pc + 4) & 0xf0000000) | (fields.address << 2));
      S.notes = [{ t: `PC + 4 = ${hex8(pc + 4)}，取高 4 位 ${bin((pc + 4) >>> 28, 4)}` }, { t: `${bin((pc + 4) >>> 28, 4)} ‖ ${hexN(fields.address, 7)} 的 26 位 ‖ 00 = ${hex8(ins.target)}` }];
      push(`<b>Pseudodirect</b>：目標 = PC + 4 的高 4 位，接上 26 位 address，再補 2 個 0（左移 2）。PC = ${hex8(pc)} → <b>${hex8(ins.target)}</b>。`, lnD("return ((pc + 4) & 0xF0000000u) |"));
    }
    asm = asmText(ins);
    if (o.kind === "branch") asm = `${name} ${rname(ins.rs)}, ${rname(ins.rt)}, ${ins.imm}`;
    Object.keys(S.st).forEach((k) => (S.st[k] = "found"));
    S.hexState = "found";
    S.result = "組語：" + asm; S.resultCls = "strong";
    if (o.kind === "branch") notes.push({ t: `條件成立跳到 ${hex8(ins.target)}，否則執行 ${hex8(pc + 4)}`, c: "ok" });
    if (f === "J") notes.push({ t: `跳到 ${hex8(ins.target)}${name === "jal" ? "，$ra = " + hex8(pc + 4) : ""}`, c: "ok" });
    if (x === 0) notes.push({ t: "0x00000000 = sll $zero, $zero, 0，什麼都不做，就是 nop", c: "ok" });
    S.notes = notes;
    push(`完成：${hex8(x)} 是 <code>${esc(asm)}</code>。`, null);
    return r.frames;
  }

  register("mips-codec", function (root) {
    const player = new Player(root, {
      title: "MIPS Encoder Decoder 指令組譯與解碼",
      width: W, height: H, wide: true,
      code: CODE_ENC,
      legend: [["active", "正在處理的欄位"], ["found", "已完成"], ["new", "十六進位結果"], ["compare", "輸入的十六進位"], ["ghost", "還沒填"]],
    });
    const inp = ui.input(player, { placeholder: "組語或 0x 十六進位碼", value: "", width: 250 });
    const pcIn = ui.input(player, { placeholder: "PC（十六進位）", value: "", width: 120 });
    inp.title = "一條 MIPS 組語指令，或一個 32 位元十六進位機器碼";
    pcIn.title = "這條指令所在的位址 PC（branch、jump 計算目標用）";
    const flash = (el) => { el.classList.add("is-error"); setTimeout(() => el.classList.remove("is-error"), 700); };
    const bad = (el, msg) => {
      flash(el);
      player.load([{ nodes: [], edges: [], labels: [], caption: `${iconHTML("alert")} ${msg}`, line: null }], { autoplay: false });
    };
    function build(text, pcText) {
      const ps = pcText.trim();
      if (!/^(0x)?[0-9a-f]{1,8}$/i.test(ps)) return { el: pcIn, err: "PC 要是十六進位位址，例如 0x00400000。" };
      const pc = parseInt(ps.replace(/^0x/i, ""), 16);
      if (pc % 4 !== 0) return { el: pcIn, err: `PC = ${esc(ps)} 不是 4 的倍數：MIPS 指令都對齊 4 bytes。` };
      if (pc > 0xfffffff8) return { el: pcIn, err: "PC 太大：PC + 4 會超出 32 位元。" };
      const t = text.trim();
      if (t === "") return { el: inp, err: "請輸入一條組語指令或一個十六進位機器碼。" };
      if (/^0x[0-9a-f]+$/i.test(t) || /^[0-9a-f]{8}$/i.test(t)) {
        const hs = t.replace(/^0x/i, "");
        if (hs.length > 8) return { el: inp, err: `機器碼最多 8 個十六進位數字（32 位元），「${esc(t)}」有 ${hs.length} 個。` };
        return { mode: "dec", frames: decodeFrames(parseInt(hs, 16) >>> 0, pc) };
      }
      const p = parseAsm(t);
      if (p.err) return { el: inp, err: p.err };
      return { mode: "enc", frames: encodeFrames(p.ins, pc) };
    }
    function go() {
      const b = build(inp.value, pcIn.value);
      if (b.err) return bad(b.el, b.err);
      player.setCode(b.mode === "dec" ? CODE_DEC : CODE_ENC);
      player.load(b.frames);
    }
    ui.button(player, "執行", go);
    const ex = (s, pc) => () => { inp.value = s; pcIn.value = pc; go(); };
    ui.button(player, "add（R）", ex("add $t0, $s1, $s2", "0x00400000"), "ghost");
    ui.button(player, "sw 負位移", ex("sw $5, -7($9)", "0x00400000"), "ghost");
    ui.button(player, "beq 算 offset", ex("beq $s2, $zero, 0x88004014", "0x88004004"), "ghost");
    ui.button(player, "j 算位址", ex("j 0x88004004", "0x88004010"), "ghost");
    ui.button(player, "解碼 0x1511FFFB", ex("0x1511FFFB", "0x00400020"), "ghost");
    ui.button(player, "sll", ex("sll $t2, $s0, 4", "0x00400000"), "ghost");
    ui.button(player, "ori 零延伸", ex("ori $t0, $t0, 0xFFF8", "0x00400000"), "ghost");
    [inp, pcIn].forEach((el) => el.addEventListener("keydown", (e) => e.key === "Enter" && go()));

    inp.value = "beq $s2, $zero, 0x88004014"; pcIn.value = "0x88004004";
    const demo = build(inp.value, pcIn.value).frames;
    demo[0].caption = iconHTML("play") + " 按播放看示範：beq 在 0x88004004，要跳到 0x88004014，先算 offset 再逐欄位組出機器碼。也可以自己輸入組語（例如 lw $t0, -8($sp)）或十六進位碼（例如 0x8FA8FFF8），右邊輸入這條指令的 PC。branch 的第三個運算元寫十進位是 offset、寫 0x 開頭是目標位址。";
    player.load(demo, { autoplay: false });
  });

  // =================================================================
  // 靜態圖
  // =================================================================
  function rowBoxes(fields, y, x1, p, states, subFn) {
    return fields.map(([name, hi, lo, label]) => ({
      id: `${y}-${name}`, shape: "box", x: x1 + (31 - hi) * p + ((hi - lo + 1) * p) / 2, y,
      w: (hi - lo + 1) * p - 3, h: 36, label: label || name, state: states[name] || "default",
      sub: subFn ? subFn(hi, lo) : `${hi === lo ? hi : hi + ":" + lo}（${hi - lo + 1}）`,
    }));
  }

  figure("mips-formats", () => {
    const x1 = 96, p = 20, st = { op: "compare", rs: "active", rt: "active" };
    const rows = [["R-type", FIELDS.R, 52], ["I-type", FIELDS.I, 136], ["J-type", FIELDS.J, 220]];
    const nodes = [], labels = [];
    rows.forEach(([nm, fs, y]) => {
      nodes.push(...rowBoxes(fs, y, x1, p, st));
      labels.push({ id: "rl" + y, x: 48, y, text: nm, cls: "strong" });
    });
    return { width: 760, height: 262, nodes, labels };
  });

  figure("mips-branch-jump", () => {
    const nodes = [
      { id: "pc4", shape: "box", x: 110, y: 62, w: 150, h: 38, label: "PC + 4", state: "compare" },
      { id: "off", shape: "box", x: 345, y: 62, w: 240, h: 38, label: "sign-ext(imm) × 4", state: "active" },
      { id: "bt", shape: "box", x: 620, y: 62, w: 170, h: 38, label: "分支目標", state: "found" },
      { id: "j4", shape: "box", x: 110, y: 196, w: 92, h: 38, label: "PC+4", sub: "高 4 位 31:28", state: "compare" },
      { id: "j26", shape: "box", x: 425, y: 196, w: 530, h: 38, label: "address（26 bits）", sub: "指令裡的 25:0", state: "active" },
      { id: "j00", shape: "box", x: 718, y: 196, w: 48, h: 38, label: "00", sub: "1:0", state: "default" },
    ];
    const labels = [
      { id: "t1", x: 24, y: 20, text: "(a) beq / bne：PC-relative，offset 以 word 為單位", anchor: "start", cls: "strong" },
      { id: "plus", x: 205, y: 62, text: "+", cls: "strong" },
      { id: "eq", x: 505, y: 62, text: "=", cls: "strong" },
      { id: "e1", x: 24, y: 106, text: "範圍：PC + 4 往前 32768、往後 32767 條指令（約 ±128 KB）", anchor: "start" },
      { id: "t2", x: 24, y: 150, text: "(b) j / jal：pseudodirect，三段直接接起來（不是相加）", anchor: "start", cls: "strong" },
      { id: "e2", x: 24, y: 254, text: "範圍：和 PC + 4 同一個 256 MB 區塊，跟距離遠近無關", anchor: "start" },
    ];
    return { width: 760, height: 272, nodes, labels };
  });

  figure("mips-extend-lui", () => {
    const box = (id, x, y, label, state) => ({ id, shape: "box", x, y, w: 190, h: 34, label, state });
    const nodes = [
      box("s-h", 236, 62, "1111 1111 1111 1111", "new"), box("s-l", 430, 62, "1111 1111 1111 1000", "default"),
      box("z-h", 236, 110, "0000 0000 0000 0000", "new"), box("z-l", 430, 110, "1111 1111 1111 1000", "default"),
      box("u-h", 236, 194, "0x0120", "active"), box("u-l", 430, 194, "0x0000", "ghost"),
      box("o-h", 236, 242, "0x0120", "found"), box("o-l", 430, 242, "0x001A", "found"),
    ];
    const labels = [
      { id: "t1", x: 24, y: 22, text: "(a) 16 位元立即值 0xFFF8 延伸成 32 位元（紫色是補上的高 16 位）", anchor: "start", cls: "strong" },
      { id: "l1", x: 76, y: 62, text: "符號延伸" }, { id: "r1", x: 540, y: 62, text: "= 0xFFFFFFF8 = −8", anchor: "start", cls: "strong" },
      { id: "l2", x: 76, y: 110, text: "零延伸" }, { id: "r2", x: 540, y: 110, text: "= 0x0000FFF8 = 65528", anchor: "start", cls: "strong" },
      { id: "t2", x: 24, y: 154, text: "(b) lui + ori 組出 32 位元常數 0x0120001A", anchor: "start", cls: "strong" },
      { id: "l3", x: 76, y: 194, text: "lui $t1, 288" }, { id: "r3", x: 540, y: 194, text: "高 16 位放常數、低 16 位清 0", anchor: "start" },
      { id: "l4", x: 76, y: 242, text: "ori $t1,$t1,26" }, { id: "r4", x: 540, y: 242, text: "低 16 位零延伸後 OR 進去", anchor: "start" },
    ];
    return { width: 760, height: 268, nodes, labels };
  });

  figure("mips-riscv-formats", () => {
    const x1 = 84, p = 21, st = { rd: "active", rs1: "compare", rs2: "visited" };
    const F = (a) => a.map(([n, hi, lo, l]) => [n === "rd" || n === "rs1" || n === "rs2" ? n : n + hi, hi, lo, l || n]);
    const rows = [
      ["R", F([["funct7", 31, 25], ["rs2", 24, 20], ["rs1", 19, 15], ["funct3", 14, 12], ["rd", 11, 7], ["opcode", 6, 0]])],
      ["I", F([["imm[11:0]", 31, 20], ["rs1", 19, 15], ["funct3", 14, 12], ["rd", 11, 7], ["opcode", 6, 0]])],
      ["S", F([["imm[11:5]", 31, 25], ["rs2", 24, 20], ["rs1", 19, 15], ["funct3", 14, 12], ["imm[4:0]", 11, 7], ["opcode", 6, 0]])],
      ["B", F([["i[12|10:5]", 31, 25], ["rs2", 24, 20], ["rs1", 19, 15], ["funct3", 14, 12], ["i[4:1|11]", 11, 7], ["opcode", 6, 0]])],
      ["U", F([["imm[31:12]", 31, 12], ["rd", 11, 7], ["opcode", 6, 0]])],
      ["J", F([["imm[20|10:1|11|19:12]", 31, 12], ["rd", 11, 7], ["opcode", 6, 0]])],
    ];
    const nodes = [], labels = [];
    rows.forEach(([nm, fs], k) => {
      const y = 34 + k * 58;
      fs.forEach(([id, hi, lo, label]) => nodes.push({
        id: `${nm}-${id}`, shape: "box", x: x1 + (31 - hi) * p + ((hi - lo + 1) * p) / 2, y,
        w: (hi - lo + 1) * p - 3, h: 34, label, state: st[id] || "default", sub: `${hi}:${lo}`,
      }));
      labels.push({ id: "rl" + k, x: 42, y, text: nm + "-type", cls: "strong" });
    });
    return { width: 760, height: 380, nodes, labels };
  });
})();
