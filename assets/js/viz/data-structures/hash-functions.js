/* =====================================================================
   Hash Functions（雜湊函數）主題的圖與動畫
   - hf-compute : 輸入 key、m，用選定的雜湊函數一步一步算出位址
                  （division / multiplication / mid-square / folding shift / folding boundary / 字串 Horner / 字串加總）
   - hf-dist    : 一批 key 在兩種設定（方法、m）下的分布直方圖，比較均不均勻
   - hf-bloom   : Bloom filter 的 insert / query / 嘗試刪除
   ===================================================================== */
(function () {
  "use strict";
  const { Player, Recorder, ui, register, esc, iconHTML, figure } = window.DSViz;

  /* CODE-BEGIN：由 .work/extract.py 從 code/data-structures/hash-functions.c 抽出 */
  const SRC = {
    "div": [
      "int hashDiv(int k, int m) {                    /* k ≥ 0，m 最好是不靠近 2 的冪的質數 */",
      "  return k % m;",
      "}"
    ],
    "mul": [
      "int hashMul(int k, int m) {",
      "  const double A = 0.6180339887;               /* (√5 − 1) / 2，常用的 A */",
      "  double t = k * A;",
      "  double frac = t - floor(t);                  /* kA 的小數部分，介於 [0, 1) */",
      "  return (int)(m * frac);                      /* floor(m × 小數部分) */",
      "}"
    ],
    "mid": [
      "int hashMidSquare(long long k, int r) {        /* 取 k² 中間的 r 位（十進位），k ≤ 999999 */",
      "  long long sq = k * k, pw = 1;",
      "  int drop = (numDigits(sq) - r) / 2;          /* 右邊丟掉幾位；剩下奇數位時左邊多丟一位 */",
      "  for (int i = 0; i < drop; i++) sq /= 10;",
      "  for (int i = 0; i < r; i++) pw *= 10;",
      "  return (int)(sq % pw);                       /* 再留下最右邊 r 位 */",
      "}"
    ],
    "part": [
      "int part(const char *s, int from, int r, int rev) {  /* 從 s[from] 起讀 r 位數字，rev = 1 時倒著讀 */",
      "  int n = (int)strlen(s), end = from + r < n ? from + r : n, v = 0;",
      "  for (int i = 0; i < end - from; i++)",
      "    v = v * 10 + (s[rev ? end - 1 - i : from + i] - '0');",
      "  return v;",
      "}"
    ],
    "fshift": [
      "int foldShift(const char *key, int r) {        /* 每 r 位切一段，直接相加 */",
      "  int n = (int)strlen(key), sum = 0;",
      "  for (int i = 0; i < n; i += r) sum += part(key, i, r, 0);",
      "  return sum;",
      "}"
    ],
    "fbound": [
      "int foldBoundary(const char *key, int r) {     /* 第 2、4、6… 段反轉後再相加 */",
      "  int n = (int)strlen(key), sum = 0;",
      "  for (int i = 0, j = 0; i < n; i += r, j++) sum += part(key, i, r, j % 2 == 1);",
      "  return sum;",
      "}"
    ],
    "ssum": [
      "int hashStrSum(const char *s, int m) {         /* 只把字元碼加總：換位字一定撞 */",
      "  int sum = 0;",
      "  for (int i = 0; s[i] != '\\0'; i++) sum += (unsigned char)s[i];",
      "  return sum % m;",
      "}"
    ],
    "horner": [
      "int hashStr(const char *s, int m) {            /* 多項式雜湊，用 Horner 法計算 */",
      "  const long long B = 31;                      /* 基底 */",
      "  long long h = 0;",
      "  for (int i = 0; s[i] != '\\0'; i++)",
      "    h = (h * B + (unsigned char)s[i]) % m;     /* 每一步都 mod m，數字不會溢位 */",
      "  return (int)h;",
      "}"
    ],
    "bglob": [
      "int BM = 16;                                   /* bit array 的大小 m */",
      "int BK = 3;                                    /* 雜湊函數的個數 k */",
      "unsigned char bits[MAXBITS];"
    ],
    "bpos": [
      "int bloomPos(int x, int i) {                   /* 第 i 個雜湊函數（i = 0…k−1） */",
      "  return (x % BM + i * (1 + x % (BM - 1))) % BM;",
      "}"
    ],
    "bins": [
      "void bloomInsert(int x) {",
      "  for (int i = 0; i < BK; i++) bits[bloomPos(x, i)] = 1;",
      "}"
    ],
    "bquery": [
      "int bloomQuery(int x) {                        /* 0：一定不在；1：可能在 */",
      "  for (int i = 0; i < BK; i++)",
      "    if (bits[bloomPos(x, i)] == 0) return 0;   /* 有一個 bit 是 0 就一定沒插入過 */",
      "  return 1;                                    /* 全部是 1：可能在，也可能是 false positive */",
      "}"
    ]
  };
  /* CODE-END */

  /* ---------- 小工具 ---------- */
  const box = (id, label, x, y, state, w, h, sub) =>
    ({ id, label: label == null ? "" : String(label), x, y, shape: "box", w: w || 40, h: h || 34, state: state || "default", sub: sub || "" });
  const lab = (id, x, y, text, cls, anchor) => ({ id, x, y, text: String(text), cls: cls || "", anchor: anchor || "middle" });
  const lnIn = (code) => (s) => {
    const i = code.findIndex((l) => l.includes(s));
    if (i < 0) console.warn("找不到程式碼行：" + s);
    return i + 1;
  };
  const A = 0.6180339887;
  const fmt = (x, d) => x.toFixed(d).replace(/0+$/, "").replace(/\.$/, "");

  /* 和 .c 檔相同的雜湊函數（JS 版） */
  const H = {
    div: (k, m) => k % m,
    mul: (k, m) => { const t = k * A; return Math.floor(m * (t - Math.floor(t))); },
    mid: (k, r) => {
      let sq = k * k; const drop = Math.floor((String(sq).length - r) / 2);
      for (let i = 0; i < drop; i++) sq = Math.floor(sq / 10);
      return sq % Math.pow(10, r);
    },
  };

  /* 畫出 m 格的表（m ≤ 20 才畫每一格，否則只畫一格 slot） */
  function tableNodes(m, y, hit, hitState) {
    const nodes = [], labels = [];
    if (m <= 20) {
      const step = Math.min(30, Math.floor(600 / m)), x0 = 320 - ((m - 1) * step) / 2;
      for (let i = 0; i < m; i++)
        nodes.push(box("t" + i, "", x0 + i * step, y, i === hit ? hitState || "found" : "ghost", step - 4, 26, String(i)));
      labels.push(lab("tl", x0 - step / 2 - 6, y, "表", "title", "end"));
    } else {
      nodes.push(box("tbig", hit == null ? "slot ?" : "slot " + hit, 320, y, hit == null ? "ghost" : hitState || "found", 120, 30, "共 " + m + " 格（0～" + (m - 1) + "）"));
    }
    return { nodes, labels };
  }

  /* =================================================================
     動畫 1：hf-compute
     ================================================================= */
  register("hf-compute", function (root) {
    const METHODS = ["div", "mul", "mid", "fshift", "fbound", "horner", "ssum"];
    const NAME = {
      div: "division", mul: "multiplication", mid: "mid-square", fshift: "folding（shift）",
      fbound: "folding（boundary）", horner: "字串（Horner）", ssum: "字串（加總）",
    };
    const CODES = {
      div: SRC.div, mul: SRC.mul, mid: SRC.mid,
      fshift: SRC.part.concat([""], SRC.fshift), fbound: SRC.part.concat([""], SRC.fbound),
      horner: SRC.horner, ssum: SRC.ssum,
    };
    let method = "div";
    const player = new Player(root, {
      title: "Hash Function Calculator 雜湊函數計算",
      width: 640, height: 330, code: CODES.div, wide: true,
      legend: [["active", "正在處理"], ["muted", "丟掉的位數"], ["found", "算出的位址"], ["ghost", "表的空格"]],
    });

    /* 一個 frame：title、上方一排格子（digits）、中間計算式（lines）、下方表格 */
    function frame(st, caption, line) {
      const nodes = [], labels = [lab("title", 20, 22, st.title, "title", "start")];
      st.cells.forEach((c) => nodes.push(box(c.id, c.label, c.x, 78, c.state, c.w, 34, c.sub)));
      st.lines.slice(-4).forEach((t, i) => labels.push(lab("ln" + i, 20, 150 + i * 26, t, i === Math.min(st.lines.length, 4) - 1 ? "strong" : "", "start")));
      const T = tableNodes(st.m, 284, st.hit, "found");
      return { nodes: nodes.concat(T.nodes), labels: labels.concat(T.labels), caption, line };
    }

    function digitCells(str, groups, stateOf) {
      /* groups：每個字元屬於第幾段（-1 表示不分段）；段與段之間多空一點 */
      const n = str.length, gaps = groups ? Math.max(...groups) : 0;
      const step = 32, gap = 8, width = n * step + gaps * gap, x0 = 320 - width / 2 + step / 2;
      return str.split("").map((ch, i) => ({
        id: "d" + i, label: ch, x: x0 + i * step + (groups ? groups[i] * gap : 0), w: 28,
        state: stateOf ? stateOf(i) : "default",
      }));
    }

    function run(keyStr, m, r) {
      const rec = new Recorder(), code = CODES[method], ln = lnIn(code);
      const st = { title: "", cells: [], lines: [], m, hit: null };
      const push = (cap, line) => rec.push(frame(st, cap, line));
      if (method === "div") {
        const k = +keyStr, q = Math.floor(k / m), h = k % m;
        st.title = `division：h(k) = k mod m，k = ${k}，m = ${m}`;
        st.cells = [{ id: "k", label: String(k), x: 320, w: Math.max(60, String(k).length * 12 + 20), state: "active" }];
        push(`除法只做一件事：k 除以 m 取<b>餘數</b>。餘數一定落在 0～${m - 1}，剛好是表的格子編號。`, ln("return k % m;"));
        st.lines.push(`${k} = ${q} × ${m} + ${h}`);
        push(`${k} ÷ ${m} 商 ${q}、餘 ${h}。只有餘數決定位址，商被丟掉，所以 m 的選法決定 key 的哪些資訊被留下。`, ln("return k % m;"));
        st.lines.push(`h(${k}) = ${h}`); st.hit = h;
        push(`位址是 <b>${h}</b>。${(m & (m - 1)) === 0 ? `注意 m = ${m} 是 2 的冪，k mod ${m} 只是 k 的最低 ${Math.log2(m)} 個位元，高位元完全沒用到。` : "m 不是 2 的冪，餘數和 k 的每一位都有關。"}`, ln("return k % m;"));
      } else if (method === "mul") {
        const k = +keyStr, t = k * A, frac = t - Math.floor(t), y = m * frac, h = Math.floor(y);
        st.title = `multiplication：h(k) = ⌊m · frac(kA)⌋，k = ${k}，m = ${m}`;
        st.cells = [{ id: "k", label: String(k), x: 320, w: Math.max(60, String(k).length * 12 + 20), state: "active" }];
        push(`乘法先把 k 乘上一個 0 和 1 之間的常數 A，取小數部分，再放大到 0～m 之間。A 用 (√5 − 1)/2 ≈ 0.618。`, ln("const double A"));
        st.lines.push(`k × A = ${k} × 0.6180339887 = ${fmt(t, 6)}`);
        push(`k × A = ${fmt(t, 6)}。整數部分 ${Math.floor(t)} 會被丟掉，k 的每一位都影響小數部分。`, ln("double t = k * A;"));
        st.lines.push(`frac(kA) = ${fmt(frac, 6)}`);
        push(`取小數部分 ${fmt(frac, 6)}，一定在 [0, 1)。`, ln("double frac"));
        st.lines.push(`m × frac = ${m} × ${fmt(frac, 6)} = ${fmt(y, 4)} → 取 floor = ${h}`); st.hit = h;
        push(`乘上 m = ${m} 得 ${fmt(y, 4)}，無條件捨去得到位址 <b>${h}</b>。乘法法對 m 沒有要求，m 取 2 的冪也可以。`, ln("return (int)(m * frac);"));
      } else if (method === "mid") {
        const k = +keyStr, sqs = String(k * k), n = sqs.length, drop = Math.floor((n - r) / 2), left = n - r - drop;
        const v = H.mid(k, r), h = v % m;
        st.title = `mid-square：k = ${k}，取 k² 中間 ${r} 位，m = ${m}`;
        st.cells = digitCells(String(k), null, () => "active");
        push(`平方取中：先算 k²，再取中間的 ${r} 位。中間的位數受 k 每一位的影響最多，所以比較亂。`, ln("long long sq = k * k"));
        st.cells = digitCells(sqs, null, () => "default");
        st.lines.push(`k² = ${k} × ${k} = ${sqs}（${n} 位）`);
        push(`k² = ${sqs}，共 ${n} 位。`, ln("long long sq = k * k"));
        st.cells = digitCells(sqs, null, (i) => (i < left || i >= left + r ? "muted" : "active"));
        st.lines.push(`去掉右邊 ${drop} 位、左邊 ${left} 位，留中間 ${r} 位 = ${sqs.substr(left, r)}`);
        push(`${n} − ${r} = ${n - r} 位要丟，右邊丟 ${drop} 位${left !== drop ? `、左邊多丟一位（${left} 位）` : `、左邊 ${left} 位`}。`, ln("int drop ="));
        st.lines.push(`中間 ${r} 位 = ${v}`);
        push(`右移 ${drop} 位後只留最右邊 ${r} 位：${v}。`, ln("return (int)(sq % pw);"));
        st.lines.push(`${v} mod ${m} = ${h}`); st.hit = h;
        push(`表有 ${m} 格，再 mod ${m} 得到位址 <b>${h}</b>${m === Math.pow(10, r) ? `（m = 10^${r}，mod 不改變數值）` : ""}。`, null);
      } else if (method === "fshift" || method === "fbound") {
        const bound = method === "fbound", n = keyStr.length, groups = keyStr.split("").map((_, i) => Math.floor(i / r));
        const parts = [];
        for (let i = 0, j = 0; i < n; i += r, j++) {
          const s = keyStr.substr(i, r), rev = bound && j % 2 === 1;
          parts.push({ j, from: i, s, rev, v: parseInt(rev ? s.split("").reverse().join("") : s, 10) });
        }
        st.title = `folding（${bound ? "boundary" : "shift"}）：key = ${keyStr}，每 ${r} 位一段，m = ${m}`;
        st.cells = digitCells(keyStr, groups);
        push(`把 key 從左邊開始每 ${r} 位切成一段，共 ${parts.length} 段。${bound ? "boundary 折疊像折紙：第 2、4…段反過來疊，所以要把數字<b>倒過來</b>讀。" : "shift 折疊把每段直接對齊右邊相加。"}`, ln("int n = (int)strlen(key), sum = 0;"));
        let sum = 0;
        parts.forEach((p) => {
          sum += p.v;
          st.cells = digitCells(keyStr, groups, (i) => (groups[i] === p.j ? "active" : groups[i] < p.j ? "visited" : "default"));
          st.lines.push(`第 ${p.j + 1} 段 ${p.s}${p.rev ? ` 反轉 → ${p.v}` : ""}，sum = ${sum}`);
          push(`第 ${p.j + 1} 段是 ${p.s}${p.rev ? `，是偶數段所以倒過來讀成 ${p.v}` : bound ? "，奇數段照原樣" : ""}，累加後 sum = ${sum}。`,
            bound ? ln("sum += part(key, i, r, j % 2 == 1)") : ln("sum += part(key, i, r, 0)"));
        });
        const h = sum % m;
        st.cells = digitCells(keyStr, groups, () => "visited");
        st.lines.push(`sum mod m = ${sum} mod ${m} = ${h}`); st.hit = h;
        push(`各段加總 = ${sum}。表有 ${m} 格，再 mod ${m} 得到位址 <b>${h}</b>（有些題目改成「只留最右邊 ${r} 位」，記得看題目怎麼定義）。`, ln("return sum;"));
      } else {
        const horner = method === "horner", chars = keyStr.split("");
        const step = 46, x0 = 320 - ((chars.length - 1) * step) / 2;
        const cellsOf = (cur) => chars.map((c, i) => ({
          id: "c" + i, label: c === " " ? "␣" : c, x: x0 + i * step, w: 40, sub: String(c.charCodeAt(0)),
          state: i === cur ? "active" : i < cur ? "visited" : "default",
        }));
        st.title = horner ? `字串雜湊（Horner）：s = "${keyStr}"，B = 31，m = ${m}` : `字串加總：s = "${keyStr}"，m = ${m}`;
        st.cells = cellsOf(-1);
        push(horner
          ? `把字串看成以 B = 31 為底的數字：s₀·B^(n−1) + s₁·B^(n−2) + … + s₍ₙ₋₁₎。用 Horner 法從左到右，每一步 h = h·B + 字元碼，順便 mod m。格子下方是 ASCII 碼。`
          : `最簡單的做法：把每個字元的 ASCII 碼加起來再 mod m。缺點是<b>不看順序</b>，字元相同、順序不同的字串一定撞。`,
        horner ? ln("long long h = 0;") : ln("int sum = 0;"));
        let acc = 0;
        chars.forEach((c, i) => {
          const code = c.charCodeAt(0), prev = acc;
          st.cells = cellsOf(i);
          if (horner) {
            acc = (acc * 31 + code) % m;
            st.lines.push(`h = (${prev} × 31 + ${code}) mod ${m} = ${acc}`);
            push(`第 ${i + 1} 個字元 '${esc(c)}' = ${code}：h = (${prev} × 31 + ${code}) mod ${m} = ${prev * 31 + code} mod ${m} = ${acc}。乘上 31 讓前面的字元「往高位推」，位置不同權重就不同。`, ln("h = (h * B"));
          } else {
            acc += code;
            st.lines.push(`sum = ${prev} + ${code} = ${acc}`);
            push(`第 ${i + 1} 個字元 '${esc(c)}' = ${code}，sum = ${prev} + ${code} = ${acc}。`, ln("sum += (unsigned char)s[i];"));
          }
        });
        const h = horner ? acc : acc % m;
        st.cells = cellsOf(chars.length);
        if (!horner) st.lines.push(`${acc} mod ${m} = ${h}`);
        st.hit = h;
        push(horner
          ? `位址是 <b>${h}</b>。因為每一步都 mod m，h 永遠小於 m，不會溢位；結果和先算出整個大數再 mod m 相同。`
          : `位址是 <b>${h}</b>。把字元順序打亂再算一次，結果完全一樣。`,
        horner ? ln("return (int)h;") : ln("return sum % m;"));
      }
      return rec.frames;
    }

    /* ---- 輸入驗證 ---- */
    const keyIn = ui.input(player, { placeholder: "key", value: "2024", width: 120 });
    const mIn = ui.input(player, { placeholder: "m", value: "13", width: 56 });
    const rIn = ui.input(player, { placeholder: "r", value: "3", width: 40 });
    const flash = (el) => { el.classList.add("is-error"); setTimeout(() => el.classList.remove("is-error"), 700); };
    function bad(el, msg) { flash(el); player.load([{ caption: iconHTML("alert") + " " + msg, nodes: [], labels: [] }], { autoplay: false }); return null; }
    function compute() {
      const s = keyIn.value.trim(), m = ui.int(mIn, { min: 2, max: 9999 });
      if (m === null) return bad(mIn, "m 要是 2～9999 的整數。");
      let r = 0;
      if (method === "mid" || method === "fshift" || method === "fbound") {
        r = ui.int(rIn, { min: 1, max: method === "mid" ? 6 : 4 });
        if (r === null) return bad(rIn, method === "mid" ? "r（取幾位）要是 1～6。" : "r（每段幾位）要是 1～4。");
      }
      if (method === "div" || method === "mul") {
        if (!/^\d{1,8}$/.test(s)) return bad(keyIn, "這個方法的 key 要是 0～99999999 的非負整數。");
      } else if (method === "mid") {
        if (!/^\d{1,6}$/.test(s)) return bad(keyIn, "mid-square 的 key 要是 0～999999 的整數（平方最多 12 位才畫得下）。");
        if (String(+s * +s).length < r) return bad(rIn, `k² = ${+s * +s} 只有 ${String(+s * +s).length} 位，取不出中間 ${r} 位，請把 r 改小或換大一點的 key。`);
      } else if (method === "fshift" || method === "fbound") {
        if (!/^\d{1,15}$/.test(s)) return bad(keyIn, "折疊的 key 要是 1～15 位的數字字串（可以有前導 0）。");
      } else {
        if (s.length < 1 || s.length > 10 || !/^[\x20-\x7e]+$/.test(keyIn.value)) return bad(keyIn, "字串要是 1～10 個英數或符號（ASCII 可見字元）。");
      }
      const str = method === "horner" || method === "ssum" ? keyIn.value : method === "fshift" || method === "fbound" ? s : String(+s);
      player.setCode(CODES[method]);
      player.load(run(str, m, r));
      return true;
    }
    ui.button(player, "計算", compute);
    const methodBtn = ui.button(player, "", () => {
      method = METHODS[(METHODS.indexOf(method) + 1) % METHODS.length];
      const def = { div: ["2024", 13], mul: ["2024", 16], mid: ["1234", 1000], fshift: ["25361482917", 1000], fbound: ["25361482917", 1000], horner: ["cat", 97], ssum: ["cat", 97] }[method];
      keyIn.value = def[0]; mIn.value = String(def[1]);
      if (method === "mid" || method === "fshift" || method === "fbound") rIn.value = "3";
      sync(); compute();
    }, "ghost");
    function sync() { methodBtn.textContent = "方法：" + NAME[method]; }
    function example(mt, key, m, r) {
      return () => { method = mt; keyIn.value = key; mIn.value = String(m); if (r) rIn.value = String(r); sync(); compute(); };
    }
    ui.button(player, "例：m = 16 只看低位", example("div", "1000", 16), "ghost");
    ui.button(player, "例：乘法 m = 16", example("mul", "1000", 16), "ghost");
    ui.button(player, "例：boundary 折疊", example("fbound", "25361482917", 1000, 3), "ghost");
    ui.button(player, "例：act 與 cat", example("ssum", "act", 97), "ghost");
    sync();
    player.setCode(CODES.div);
    const demo = run("2024", 13, 3);
    demo[0].caption = iconHTML("play") + " 按播放看 h(2024) = 2024 mod 13 的計算；「方法」按鈕可以切換七種雜湊函數，也可以自己輸入 key、m、r（平方取中取幾位、折疊每段幾位）。";
    player.load(demo, { autoplay: false });
  });

  /* =================================================================
     動畫 2：hf-dist（兩組設定的分布直方圖）
     ================================================================= */
  register("hf-dist", function (root) {
    const MS = ["div", "mul", "mid"];
    const MNAME = { div: "division", mul: "multiplication", mid: "mid-square（r = 2）" };
    const hashOf = (mt, k, m) => (mt === "div" ? H.div(k, m) : mt === "mul" ? H.mul(k, m) : H.mid(k, 2) % m);
    const player = new Player(root, {
      title: "Key Distribution 分布比較",
      width: 640, height: 420,
      legend: [["new", "這一步加入"], ["active", "最擠的格子"], ["default", "已有 key"], ["ghost", "空格"]],
    });
    const cfg = [{ mt: "div", m: 12 }, { mt: "div", m: 13 }];
    const BASE = [180, 395], X0 = 70, XW = 550;

    function frames(keys) {
      const rec = new Recorder(), n = keys.length;
      const cnt = cfg.map((c) => new Array(c.m).fill(0));
      const finalMax = Math.max(...cfg.map((c) => { const a = new Array(c.m).fill(0); keys.forEach((k) => a[hashOf(c.mt, k, c.m)]++); return Math.max(...a); }));
      const unit = Math.min(18, 110 / Math.max(1, finalMax));
      const bs = Math.ceil(n / 8);
      function draw(newSet, done) {
        const nodes = [], labels = [];
        cfg.forEach((c, r) => {
          const step = XW / c.m, base = BASE[r], a = cnt[r], mx = Math.max(...a);
          labels.push(lab("t" + r, 20, base - 155, `${r === 0 ? "上" : "下"}：${MNAME[c.mt]}，m = ${c.m}`, "title", "start"));
          for (let i = 0; i < c.m; i++) {
            const hgt = Math.max(4, a[i] * unit), x = X0 + step * (i + 0.5);
            let s = a[i] === 0 ? "ghost" : newSet[r].has(i) ? "new" : "default";
            if (done && a[i] === mx && mx > 0) s = "active";
            nodes.push(box(`b${r}_${i}`, "", x, base - hgt / 2, s, Math.max(6, step - 5), hgt));
            if (a[i] > 0) labels.push(lab(`c${r}_${i}`, x, base - hgt - 9, a[i]));
            if (c.m <= 16 || i % 2 === 0) labels.push(lab(`i${r}_${i}`, x, base + 12, i));
          }
          if (done) {
            const used = a.filter((v) => v > 0).length;
            labels.push(lab("s" + r, 620, base - 155, `用到 ${used}/${c.m} 格，最多 ${mx} 個，碰撞 ${n - used} 次`, "strong", "end"));
          }
        });
        return { nodes, labels };
      }
      const empty = [new Set(), new Set()];
      rec.push(Object.assign(draw(empty, false), { caption: `共 ${n} 個 key${dupNote}：${esc(keys.join(", "))}。上下兩張圖用<b>同一批 key</b>，只改一個設定，看哪一種分布比較平均（理想是每格約 ${fmt(n / cfg[0].m, 2)}${cfg[0].m !== cfg[1].m ? ` ／ ${fmt(n / cfg[1].m, 2)}` : ""} 個）。`, line: null }));
      for (let s = 0; s < n; s += bs) {
        const batch = keys.slice(s, s + bs), ns = [new Set(), new Set()];
        const hs = cfg.map((c, r) => batch.map((k) => { const h = hashOf(c.mt, k, c.m); cnt[r][h]++; ns[r].add(h); return h; }));
        rec.push(Object.assign(draw(ns, false), { caption: `加入 ${batch.join(", ")}：上 h = ${hs[0].join(", ")}；下 h = ${hs[1].join(", ")}。`, line: null }));
      }
      const used = cnt.map((a) => a.filter((v) => v > 0).length);
      const better = used[0] === used[1] ? "兩邊用到的格子一樣多" : `${used[0] > used[1] ? "上" : "下"}面用到比較多格，分布比較均勻`;
      rec.push(Object.assign(draw(empty, true), { caption: `完成。${better}。「碰撞 x 次」= key 數 − 有用到的格子數，也就是插入時那一格已經有人的次數；橘色是最擠的格子，它決定最差情況要比較幾次。`, line: null }));
      return rec.frames;
    }

    const keysIn = ui.input(player, { placeholder: "key 用逗號分隔", value: "", width: 200 });
    const m1 = ui.input(player, { placeholder: "上 m", value: "12", width: 48 });
    const b1 = ui.button(player, "", () => { cfg[0].mt = MS[(MS.indexOf(cfg[0].mt) + 1) % 3]; sync(); go(); }, "ghost");
    const m2 = ui.input(player, { placeholder: "下 m", value: "13", width: 48 });
    const b2 = ui.button(player, "", () => { cfg[1].mt = MS[(MS.indexOf(cfg[1].mt) + 1) % 3]; sync(); go(); }, "ghost");
    function sync() { b1.textContent = "上：" + MNAME[cfg[0].mt]; b2.textContent = "下：" + MNAME[cfg[1].mt]; }
    function parseKeys() {
      const parts = keysIn.value.split(/[\s,，、]+/).filter((x) => x !== "");
      if (!parts.length || parts.length > 60 || parts.some((x) => !/^\d{1,6}$/.test(x))) return null;
      const keys = [...new Set(parts.map(Number))];
      dupNote = keys.length < parts.length ? `（重複的 key 只算一次，去掉了 ${parts.length - keys.length} 個）` : "";
      return keys;
    }
    let dupNote = "";
    function go() {
      const a = ui.int(m1, { min: 2, max: 24 }), b = ui.int(m2, { min: 2, max: 24 });
      const keys = parseKeys();
      if (a === null || b === null || keys === null) {
        if (keys === null) { keysIn.classList.add("is-error"); setTimeout(() => keysIn.classList.remove("is-error"), 700); }
        player.load([{ caption: iconHTML("alert") + " " + (keys === null ? "key 要是 1～60 個 0～999999 的整數，用逗號或空白分隔。" : "m 要是 2～24 的整數（直方圖才放得下）。"), nodes: [], labels: [] }], { autoplay: false });
        return;
      }
      cfg[0].m = a; cfg[1].m = b;
      player.load(frames(keys));
    }
    ui.button(player, "畫分布", go);
    const range = (n, f) => Array.from({ length: n }, (_, i) => f(i));
    function ex(keys, c0, c1) {
      return () => {
        keysIn.value = keys.join(", ");
        cfg[0].mt = c0[0]; m1.value = String(c0[1]); cfg[1].mt = c1[0]; m2.value = String(c1[1]);
        sync(); go();
      };
    }
    const mult4 = range(24, (i) => 4 * i);
    const low4 = range(24, (i) => 16 * i + 5 + 32 * (i % 3));        // 低 4 位都是 0101
    ui.button(player, "例：4 的倍數，m = 12 vs 13", ex(mult4, ["div", 12], ["div", 13]), "ghost");
    ui.button(player, "例：低 4 位相同，m = 16 vs 17", ex(low4, ["div", 16], ["div", 17]), "ghost");
    ui.button(player, "例：m = 16，除法 vs 乘法", ex(low4, ["div", 16], ["mul", 16]), "ghost");
    ui.button(player, "例：連續 key，除法 vs 平方取中", ex(range(30, (i) => 100 + i), ["div", 10], ["mid", 10]), "ghost");
    keysIn.value = mult4.join(", ");
    sync();
    const demo = frames(mult4);
    demo[0].caption = iconHTML("play") + " 按播放：24 個 4 的倍數，上面放進 m = 12、下面放進 m = 13。可以自己輸入 key、改兩邊的 m 或方法，或按下方的例子。";
    player.load(demo, { autoplay: false });
  });

  /* =================================================================
     動畫 3：hf-bloom
     ================================================================= */
  register("hf-bloom", function (root) {
    const CODE = SRC.bglob.concat([""], SRC.bpos, [""], SRC.bins, [""], SRC.bquery);
    const ln = lnIn(CODE);
    const player = new Player(root, {
      title: "Bloom Filter 布隆過濾器",
      width: 640, height: 300, code: CODE, wide: true,
      legend: [["compare", "正在檢查"], ["new", "剛設成 1"], ["found", "是 1"], ["removed", "是 0／被清掉"]],
    });
    let M = 16, K = 3, bits = new Array(M).fill(0), set = [];
    const pos = (x, i) => (x % M + i * (1 + (x % (M - 1)))) % M;
    const fp = () => Math.pow(1 - Math.exp((-K * set.length) / M), K);

    function frame(hl, lines, caption, line, ptr) {
      const step = Math.min(34, Math.floor(600 / M)), x0 = 320 - ((M - 1) * step) / 2;
      const nodes = bits.map((b, i) => box("b" + i, b, x0 + i * step, 150, (hl && hl[i]) || (b ? "found" : "default"), step - 4, 32, String(i)));
      const labels = [
        lab("set", 20, 26, `已插入（n = ${set.length}）：${set.length ? set.join(", ") : "（空）"}`, "title", "start"),
        lab("fp", 20, 50, `m = ${M}、k = ${K}：false positive 機率 ≈ (1 − e^(−kn/m))^k ≈ ${fp().toFixed(3)}`, "", "start"),
      ];
      lines.slice(-3).forEach((t, i) => labels.push(lab("l" + i, 20, 222 + i * 24, t, i === Math.min(lines.length, 3) - 1 ? "strong" : "", "start")));
      const pointers = [];
      if (ptr) {
        const by = {};
        ptr.forEach(([i, p]) => (by[p] = by[p] ? by[p] + "," + "g" + i : "g" + i));
        Object.keys(by).forEach((p) => pointers.push({ id: "p" + p, label: by[p], target: "b" + p, dir: "up", state: "compare" }));
      }
      return { nodes, labels, pointers, caption, line };
    }
    const formula = (x, i) => `g${i}(${x}) = (${x} % ${M} + ${i}·(1 + ${x} % ${M - 1})) % ${M} = ${pos(x, i)}`;

    function doInsert(x) {
      const rec = new Recorder(), lines = [], ptr = [];
      rec.push(frame(null, lines, `insert ${x}：用 k = ${K} 個雜湊函數算出 ${K} 個位置，全部設成 1。`, ln("void bloomInsert")));
      for (let i = 0; i < K; i++) {
        const p = pos(x, i), was = bits[p];
        ptr.push([i, p]); lines.push(formula(x, i));
        rec.push(frame({ [p]: "compare" }, lines, `第 ${i} 個雜湊函數：g${i}(${x}) = ${p}。`, ln("return (x % BM"), ptr));
        bits[p] = 1;
        rec.push(frame({ [p]: was ? "found" : "new" }, lines, was ? `bit[${p}] 本來就是 1（被別的 key 設過，或同一個 key 的兩個雜湊函數撞在一起），維持 1。這種共用就是 false positive 和「不能刪除」的來源。` : `bit[${p}] 從 0 設成 1。`, ln("bits[bloomPos(x, i)] = 1;"), ptr));
      }
      if (!set.includes(x)) set.push(x);
      rec.push(frame(null, lines, `插入完成。Bloom filter 只記 bit，不存 key 本身，所以 m 個 bit 就能代表很大的集合。`, null, ptr));
      return rec.frames;
    }
    function doQuery(x) {
      const rec = new Recorder(), lines = [], ptr = [], hl = {};
      rec.push(frame(null, lines, `query ${x}：算出同樣的 ${K} 個位置，檢查是不是全部都是 1。`, ln("int bloomQuery")));
      for (let i = 0; i < K; i++) {
        const p = pos(x, i);
        ptr.push([i, p]); lines.push(formula(x, i));
        rec.push(frame(Object.assign({}, hl, { [p]: "compare" }), lines, `檢查 bit[g${i}(${x})] = bit[${p}]。`, ln("if (bits[bloomPos(x, i)] == 0)"), ptr));
        if (!bits[p]) {
          hl[p] = "removed";
          lines.push(`bit[${p}] = 0 → ${x} 一定不在`);
          rec.push(frame(hl, lines, `bit[${p}] 是 0。如果 ${x} 插入過，這一格一定會被設成 1，所以 <b>${x} 一定不在</b>集合裡（Bloom filter 不會有 false negative）。`, ln("return 0;"), ptr));
          return rec.frames;
        }
        hl[p] = "found";
        rec.push(frame(hl, lines, `bit[${p}] = 1，繼續檢查下一個。`, ln("if (bits[bloomPos(x, i)] == 0)"), ptr));
      }
      const real = set.includes(x);
      lines.push(real ? `全部是 1 → 可能在（${x} 確實插入過）` : `全部是 1 → 回答「可能在」，但 ${x} 沒插入過：false positive`);
      rec.push(frame(hl, lines, real
        ? `${K} 個 bit 都是 1，回答「<b>可能在</b>」。這次 ${x} 真的插入過，答對了。Bloom filter 只能說「可能在」，永遠不會說「一定在」。`
        : `${K} 個 bit 都是 1，回答「<b>可能在</b>」，但 ${x} 根本沒插入過，這些 bit 都是被 ${set.join("、")} 設成 1 的。這就是 <b>false positive</b>，所以實務上「可能在」之後還要做一次精確檢查。`, ln("return 1;"), ptr));
      return rec.frames;
    }
    function doDelete(x) {
      const rec = new Recorder(), lines = [], ptr = [], save = bits.slice();
      if (!set.includes(x)) {
        rec.push(frame(null, lines, `${esc(String(x))} 沒有插入過。這個按鈕示範「把 ${x} 的 bit 清成 0」會出什麼事，請輸入已插入的 key（${set.join(", ") || "目前是空的"}）。`, null));
        return rec.frames;
      }
      const ps = [];
      for (let i = 0; i < K; i++) { const p = pos(x, i); ps.push(p); ptr.push([i, p]); lines.push(formula(x, i)); }
      const hl = {}; ps.forEach((p) => (hl[p] = "removed"));
      rec.push(frame(hl, lines, `嘗試刪除 ${x}：如果直接把 ${x} 的 ${K} 個位置 ${[...new Set(ps)].join("、")} 清成 0……`, null, ptr));
      ps.forEach((p) => (bits[p] = 0));
      const others = set.filter((y) => y !== x);
      const broken = others.filter((y) => { for (let i = 0; i < K; i++) if (!bits[pos(y, i)]) return true; return false; });
      rec.push(frame(hl, lines, `清掉之後，再查其他已插入的 key：${others.length ? others.join(", ") : "（沒有其他 key）"}。`, null, ptr));
      if (broken.length) {
        const y = broken[0], ptr2 = [], hl2 = Object.assign({}, hl), lines2 = lines.slice();
        for (let i = 0; i < K; i++) { const p = pos(y, i); ptr2.push([i, p]); hl2[p] = bits[p] ? "found" : "removed"; lines2.push(formula(y, i)); }
        rec.push(frame(hl2, lines2, `${broken.join("、")} 明明還在集合裡，現在卻有 bit 是 0，查詢會回答「一定不在」：<b>false negative</b>。原因是 bit 被多個 key 共用，清掉一個 key 的 bit 也清掉了別人的。所以標準 Bloom filter <b>不支援刪除</b>；要刪除得用 counting Bloom filter（每格放計數器，插入加 1、刪除減 1）。`, null, ptr2));
      } else {
        rec.push(frame(hl, lines, `這次運氣好，${x} 的 bit 沒有被別的 key 共用，其他 key 都還查得到。但一般情況無法知道某個 bit 有沒有被共用，所以標準 Bloom filter 仍然<b>不支援刪除</b>（試試「例：不能刪除」）。`, null, ptr));
      }
      bits = save;
      rec.push(frame(null, [], `示範結束，bit array 已還原。標準 Bloom filter 不提供刪除。`, null));
      return rec.frames;
    }

    const xIn = ui.input(player, { placeholder: "key", value: "15", width: 64 });
    const readX = () => {
      const x = ui.int(xIn, { min: 0, max: 9999 });
      if (x === null) player.load([frame(null, [], iconHTML("alert") + " key 要是 0～9999 的整數。", null)], { autoplay: false });
      return x;
    };
    ui.button(player, "insert", () => { const x = readX(); if (x !== null) player.load(doInsert(x)); });
    ui.button(player, "query", () => { const x = readX(); if (x !== null) player.load(doQuery(x)); });
    ui.button(player, "嘗試刪除", () => { const x = readX(); if (x !== null) player.load(doDelete(x)); }, "ghost");
    const mIn = ui.input(player, { placeholder: "m", value: "16", width: 44 });
    const kIn = ui.input(player, { placeholder: "k", value: "3", width: 36 });
    function reset(note) {
      bits = new Array(M).fill(0); set = [];
      player.load([frame(null, [], note || `已清空：m = ${M} 個 bit、k = ${K} 個雜湊函數。輸入 key 按 insert。`, null)], { autoplay: false });
    }
    ui.button(player, "設定 m、k", () => {
      const m = ui.int(mIn, { min: 8, max: 24 }), k = ui.int(kIn, { min: 1, max: 4 });
      if (m === null || k === null) {
        player.load([frame(null, [], iconHTML("alert") + " m 要是 8～24、k 要是 1～4 的整數。", null)], { autoplay: false });
        return;
      }
      M = m; K = k; reset();
    }, "ghost");
    ui.button(player, "清空", () => reset(), "ghost");
    function preload(m, k, keys) { M = m; K = k; mIn.value = String(m); kIn.value = String(k); bits = new Array(M).fill(0); set = []; keys.forEach((x) => { for (let i = 0; i < K; i++) bits[pos(x, i)] = 1; set.push(x); }); }
    ui.button(player, "例：false positive", () => { preload(16, 3, [5, 12, 30]); xIn.value = "15"; player.load(doQuery(15)); }, "ghost");
    ui.button(player, "例：一定不在", () => { preload(16, 3, [5, 12, 30]); xIn.value = "8"; player.load(doQuery(8)); }, "ghost");
    ui.button(player, "例：不能刪除", () => { preload(16, 3, [5, 12, 30, 22]); xIn.value = "22"; player.load(doDelete(22)); }, "ghost");
    preload(16, 3, [5, 12]);
    const demo = doInsert(30);
    demo[0].caption = iconHTML("play") + " 按播放：已插入 5、12，接著插入 30。之後可以 query 15（false positive）、query 8（一定不在），或用「嘗試刪除」看為什麼不能刪。";
    player.load(demo, { autoplay: false });
  });

  /* =================================================================
     靜態圖
     ================================================================= */
  // 圖 1：4 的倍數放進 m = 12 與 m = 13
  figure("hf-mod-choice", () => {
    const keys = Array.from({ length: 12 }, (_, i) => 4 * i), nodes = [], labels = [];
    [12, 13].forEach((m, r) => {
      const y = 70 + r * 110, step = 38, x0 = 190, c = new Array(m).fill(0);
      keys.forEach((k) => c[k % m]++);
      for (let i = 0; i < m; i++) nodes.push(box(`m${r}_${i}`, c[i] || "", x0 + i * step, y, c[i] === 0 ? "ghost" : c[i] > 1 ? "removed" : "found", 34, 32, String(i)));
      labels.push(lab("t" + r, 20, y - 8, `m = ${m}`, "title", "start"));
      labels.push(lab("u" + r, 20, y + 14, `用到 ${c.filter((v) => v).length} 格`, r ? "" : "warn", "start"));
    });
    labels.push(lab("f", 320, 268, "key = 0, 4, 8, …, 44（12 個 4 的倍數），格子裡是該格的 key 數", "strong"));
    return { width: 680, height: 290, nodes, labels };
  });

  // 圖 2：乘法法的位元版本
  figure("hf-mul-shift", () => {
    const nodes = [
      box("k", "k（w 位元）", 200, 50, "default", 180, 34),
      box("s", "s = ⌊A·2^w⌋（w 位元）", 450, 50, "default", 220, 34),
      box("r1", "r1：高 w 位元（丟掉）", 200, 140, "muted", 240, 36),
      box("hp", "前 p 位", 365, 140, "found", 90, 36),
      box("r0", "r0 其餘位元", 505, 140, "muted", 190, 36),
    ];
    const labels = [
      lab("x", 325, 50, "×", "strong"),
      lab("eq", 30, 140, "k·s =", "strong", "start"),
      lab("w2", 460, 104, "r0：乘積的低 w 位元", "", "middle"),
      lab("h", 365, 196, "h(k) = r0 >> (w − p)", "strong"),
      lab("f", 320, 236, "m = 2^p：只用乘法、位移，不需要除法與浮點數", ""),
    ];
    return { width: 640, height: 256, nodes, labels };
  });

  // 圖 3：shift folding 與 boundary folding
  figure("hf-folding", () => {
    const parts = ["253", "614", "829", "17"], nodes = [], labels = [];
    [["shift", false], ["boundary", true]].forEach(([name, b], r) => {
      const y = 60 + r * 90; let sum = 0;
      parts.forEach((p, j) => {
        const rev = b && j % 2 === 1, v = rev ? p.split("").reverse().join("") : p;
        sum += +v;
        nodes.push(box(`f${r}_${j}`, v, 190 + j * 90, y, rev ? "active" : "default", 62, 34, rev ? "反轉 " + p : ""));
        if (j) labels.push(lab(`p${r}_${j}`, 190 + j * 90 - 45, y, "+", "strong"));
      });
      labels.push(lab("n" + r, 20, y, name + " folding", "title", "start"));
      labels.push(lab("s" + r, 530, y, "= " + sum, "strong", "start"));
    });
    labels.push(lab("k", 320, 232, "key = 25361482917，從左邊每 3 位切一段：253 | 614 | 829 | 17", ""));
    return { width: 640, height: 252, nodes, labels };
  });

  // 圖 4：兩層 perfect hashing（示意）
  figure("hf-perfect", () => {
    const nodes = [], edges = [], labels = [];
    const groups = [["k3", "k7"], [], ["k1"], ["k2", "k5", "k6"]];
    const at = { 1: [0], 2: [1, 2], 3: [0, 4, 7] };          // 第二層表裡 key 放的位置（示意）
    let x = 20;
    groups.forEach((g, j) => {
      const size = g.length * g.length, w = Math.max(96, size * 30), cx = x + w / 2;
      x += w + 22;
      nodes.push(box("s" + j, "n" + j + " = " + g.length, cx, 60, g.length ? "compare" : "ghost", 86, 32, "第一層 " + j));
      if (!size) { labels.push(lab("e" + j, cx, 160, "空", "", "middle")); return; }
      const x0 = cx - ((size - 1) * 30) / 2;
      for (let c = 0; c < size; c++) {
        const ki = at[g.length].indexOf(c);
        nodes.push(box(`c${j}_${c}`, ki >= 0 ? g[ki] : "", x0 + c * 30, 160, ki >= 0 ? "found" : "ghost", 26, 28));
      }
      edges.push({ from: "s" + j, to: `c${j}_${Math.floor((size - 1) / 2)}`, directed: true });
      labels.push(lab("z" + j, cx, 198, `第二層 ${size} 格`, "", "middle"));
    });
    labels.push(lab("f", 330, 236, "第 j 格有 n_j 個 key，就開 n_j² 格的第二層表，並挑一個在這 n_j 個 key 上不碰撞的 h_j", ""));
    return { width: 660, height: 256, nodes, edges, labels };
  });

  // 圖 5：Bloom filter 插入 5、12、30 後，查 15 與 8
  figure("hf-bloom-fig", () => {
    const M = 16, pos = (x, i) => (x % M + i * (1 + (x % (M - 1)))) % M, bits = new Array(M).fill(0);
    [5, 12, 30].forEach((x) => { for (let i = 0; i < 3; i++) bits[pos(x, i)] = 1; });
    const step = 36, x0 = 50, nodes = [], pointers = [], labels = [];
    for (let i = 0; i < M; i++) nodes.push(box("b" + i, bits[i], x0 + i * step, 120, bits[i] ? "found" : "default", 32, 32, String(i)));
    [15].forEach((x) => [0, 1, 2].forEach((i) => pointers.push({ id: `q${x}_${i}`, label: "15", target: "b" + pos(x, i), dir: "up", state: "active" })));
    pointers.push({ id: "q8", label: "8", target: "b" + pos(8, 0), dir: "up", state: "removed" });
    labels.push(lab("t", 20, 26, "插入 5、12、30（m = 16、k = 3）後的 bit array", "title", "start"));
    labels.push(lab("a", 20, 186, "查 15：g = 15, 0, 1 三格都是 1 → 回答「可能在」，其實沒插入過（false positive）", "", "start"));
    labels.push(lab("b", 20, 212, "查 8：g0 = 8 那一格是 0 → 一定不在（不用再看後面）", "", "start"));
    return { width: 640, height: 232, nodes, pointers, labels };
  });
})();
