# CLAUDE.md — DS 考研互動學習站

> 這份是給 AI 的「員工手冊」。每次開始工作前，請先完整讀完，再動手。
> 如果使用者當下的指示和這份文件衝突，**以使用者為準**，並在回報時提醒：「這和 CLAUDE.md 第 X 節不同，要不要一起更新規則？」

---

## 1. 專案目的

這是一個 **資工所考研用的資料結構（Data Structures）互動學習網站**。

- **讀者**：準備研究所考試的資工系學生（包含作者本人）。
- **核心理念**：資料結構要「看得到」才好懂。每個主題都要有**可以自己輸入資料、逐步播放的動畫**，再搭配考研重點與自我測驗。
- **組織方式**：依章節（chapter）→ 主題（topic）排列，可以慢慢一個主題一個主題地補上。
- **之後可擴充**：其他考研科目（演算法、計算機組織、作業系統…）沿用同一套結構。

---

## 2. 語言與用詞

| 規則 | 範例 |
|---|---|
| 正文使用 **繁體中文**，語氣口語、清楚，像學長姊在講解 | |
| 專有名詞 **第一次出現** 寫成「English（中文）」，並包在 `<span class="term">` 裡 | `<span class="term">Stack<small>（堆疊）</small></span>` |
| 之後再出現可以只寫英文 | push、pop、BST |
| 頁面標題、章節名稱、首頁卡片一律用「English（中文）」 | `Binary Search Tree（二元搜尋樹）` |
| 程式碼用 **C 語言**（台灣考研最常見），註解用中文 | `/* 中序後繼 */` |
| **數字要有意義**：寫出數字時同時說明它代表什麼 | ✅「h = n，所有操作退化成 O(n)」 ❌「答案是 14」 |
| 不確定的內容標「（待確認）」，**不可編造** 定理、公式或考古題出處 | |

---

## 3. 技術限制（不能改）

| 項目 | 規則 |
|---|---|
| 技術 | 純 HTML + CSS + 原生 JavaScript。**不使用** 框架、打包工具、npm 套件、CDN。 |
| 部署 | GitHub Pages，從 `main` 分支根目錄發佈，**沒有 build 步驟**。 |
| 路徑 | 一律用 **相對路徑**（主題頁用 `../../`），不可用 `/` 開頭的絕對路徑。 |
| 樣式 | 全部寫在 `assets/css/style.css`。主題頁 **不准寫 `<style>` 或 inline style**。 |
| 動畫 | 一律使用 `assets/js/viz-core.js` 的 Player，**不另外寫一套動畫系統**，也不用 canvas 或外部函式庫。 |
| 外部資源 | 不引入外部字型、圖片 URL、追蹤碼。 |

---

## 4. 資料夾結構與命名

```
/
├── CLAUDE.md                ← 本文件（規則的唯一來源）
├── README.md                ← 給人看的介紹
├── index.html               ← 首頁：讀 data/syllabus.json 自動畫出章節地圖與進度
├── data/
│   └── syllabus.json        ← 章節與主題登錄表（首頁、上下篇導覽都靠它）
├── topics/
│   ├── _template.html       ← 新主題一律從這裡複製
│   └── <chapter-id>/<topic-id>.html
├── assets/
│   ├── css/style.css
│   └── js/
│       ├── site.js          ← 首頁渲染、目錄 TOC、上下篇、測驗展開
│       ├── viz-core.js      ← 共用動畫播放器（不要為了單一主題改它）
│       └── viz/<topic-id>.js   ← 每個主題自己的動畫腳本
└── scripts/
    └── check.py             ← 檢查所有主題是否符合本文件
```

- `chapter-id`、`topic-id`：**小寫英文 kebab-case**，用該主題最常見的英文名稱。
  ✅ `binary-search-tree`、`circular-queue` ❌ `BST`、`二元樹`、`topic1`
- `topic-id` **全站唯一**（因為動畫腳本放在同一個 `viz/` 資料夾）。
- 動畫腳本檔名 = `topic-id`：`topics/tree/binary-search-tree.html` ↔ `assets/js/viz/binary-search-tree.js`。
- 一個主題頁可以有多個動畫，用 `data-viz` 名稱區分（例如 `stack-ops`、`infix-postfix`），都寫在同一個 `viz/<topic-id>.js`。

---

## 5. 主題頁的固定結構（最重要）

每個主題頁都從 `topics/_template.html` 複製，**依序** 包含以下 7 個 `<section>`，id 不可改：

| # | section id | 標題 | 內容規則 |
|---|---|---|---|
| 1 | `intro` | 核心概念 | 2～4 段說明，至少一個 `.callout` 放「一句話記憶法」。專有名詞照第 2 節格式。 |
| 2 | `viz` | 互動動畫 | 至少一個 `<div class="viz" data-viz="...">`。使用者必須能**自己輸入資料**操作，不只是播固定範例。 |
| 3 | `ops` | 操作與複雜度 | 表格：操作 / 做法 / 時間複雜度（需要時分平均與最差）。 |
| 4 | `code` | 程式碼 | `<pre class="code">` 放 C 實作，**要和動畫右側的程式碼邏輯一致**。HTML 中的 `< > &` 要跳脫。 |
| 5 | `exam` | 考研重點 | 2～4 題 `.exam-q`，每題用 `<span class="qtype">` 標題型（追蹤／計算／判斷／比較／證明／實作），並寫「解題方向」。 |
| 6 | `pitfalls` | 易錯點 | 3～5 點，格式：`❌ 錯誤想法 → ✅ 正確觀念`。 |
| 7 | `quiz` | 自我測驗 | 3～6 題 `<details class="quiz">`，答案要附**理由**，不只給答案。 |

頁面其他必備項目：

- `<body data-chapter="<chapter-id>" data-topic="<chapter-id>/<topic-id>" data-root="../../">`
- `<title>`：`English（中文） · 章節中文 | DS 考研互動學習站`
- `<meta name="description">`：一句話說明，≤ 70 字。
- 麵包屑：`首頁 › 章節 English（中文） › 主題 English（中文）`
- 頁尾「最後更新：YYYY-MM-DD」與 `syllabus.json` 的 `updated` 一致。
- 結尾依序載入：`site.js` → `viz-core.js` → `viz/<topic-id>.js`。

---

## 6. 互動動畫的寫法（viz-core.js）

### 6.1 核心概念：動畫 = 一串 Frame

主題腳本 **只負責產生 frames（每一步的畫面快照）**；播放、暫停、上一步/下一步、速度、補間動畫、程式碼高亮，全部由 Player 處理。同一個 `id` 的元素在前後兩個 frame 之間會**自動平滑移動**，新出現的淡入、消失的淡出。

### 6.2 骨架

```js
(function () {
  const { Player, Recorder, ui, register, esc } = window.DSViz;

  register("my-viz", function (root) {
    const player = new Player(root, {
      title: "English（中文）",
      width: 640, height: 320,          // SVG viewBox
      code: ["line 1", "line 2"],       // 右側程式碼（C 或虛擬碼）
      legend: [["compare", "比較中"], ["found", "找到"]],
    });

    function frame(caption, line, opt) { /* 依目前資料模型組出一個 Frame */ }

    function doSomething(x) {
      const r = new Recorder();
      r.push(frame("第一步說明", 1));
      /* 修改模型… */
      r.push(frame("第二步說明", [2, 3]));
      return r.frames;
    }

    const input = ui.input(player, { value: "5" });
    ui.button(player, "操作", () => {
      const v = ui.int(input);           // 驗證失敗回傳 null，輸入框會閃紅
      if (v !== null) player.load(doSomething(v));
    });
    player.load([frame("初始說明", null)], { autoplay: false });
  });
})();
```

### 6.3 Frame 格式

```js
{
  nodes:    [{ id, label, x, y, shape: "circle" | "box", w, h, r, state, sub }],
  edges:    [{ from, to, state, directed: false }],
  pointers: [{ id, label, target: nodeId, dir: "up"|"down"|"left"|"right", state }],
  labels:   [{ id, x, y, text, cls: "title"|"strong"|"warn", anchor: "start"|"middle"|"end" }],
  caption:  "這一步在做什麼（可用 <b>、<code>）",
  line:     3 或 [3, 4]               // 右側要高亮的程式碼行（從 1 開始）
}
```

### 6.4 狀態色（state）— 全站語意要一致

| state | 顏色 | 意義 |
|---|---|---|
| `default` | 灰 | 一般 |
| `compare` | 藍 | 正在比較 / 目前所在位置 |
| `active` | 橘 | 正在處理、讀入、特別標記（例如中序後繼） |
| `new` | 紫 | 剛加入 / 剛輸出 |
| `found` | 綠 | 找到、完成、已輸出 |
| `removed` | 紅 | 將被刪除 |
| `visited` | 青 | 已經走過 |
| `muted` / `ghost` | 淡灰 / 虛線 | 不重要 / 空位 |

### 6.5 動畫規則

1. **使用者可以自己輸入**資料，至少提供一個輸入框或預設範例按鈕；輸入要驗證，錯誤時給中文提示。
2. 每個 frame 的 `caption` 都要說明「**為什麼**」這樣做，而不是只說「做了什麼」。例：✅「35 < 50，往左子樹走」 ❌「往左」。
3. 每個 frame 都要標 `line`，讓程式碼和動畫同步（初始畫面或總結畫面可以是 `null`）。
4. 一次操作的步數控制在約 3～40 步；畫面放不下時要提前擋住並說明（例如限制樹高、token 數）。
5. 使用者輸入的文字放進 caption 前要用 `esc()` 跳脫。
6. 初始畫面用 `{ autoplay: false }`，並在 caption 告訴使用者可以怎麼玩。
7. 需要新的視覺元素時，**優先用既有的 nodes / edges / pointers / labels 組合**；真的不夠時，先向使用者說明要怎麼擴充 `viz-core.js`，同意後再改，並確認其他主題的動畫都還正常。

---

## 7. `data/syllabus.json` 格式

```json
{
  "subject": { "id": "data-structures", "en": "Data Structures", "zh": "資料結構" },
  "chapters": [
    {
      "id": "tree", "en": "Tree", "zh": "樹", "desc": "一句話描述",
      "topics": [
        { "id": "binary-search-tree", "en": "Binary Search Tree", "zh": "二元搜尋樹",
          "status": "done", "viz": true, "difficulty": 2,
          "tags": ["BST", "insert", "delete"], "updated": "2026-11-16" }
      ]
    }
  ]
}
```

- `status`：`"done"`（有頁面）或 `"planned"`（籌備中，首頁顯示灰色）。
- `done` 的主題必須有 `difficulty`（1～3）、`tags`（2～5 個）、`updated`。
- 章節與主題的順序就是學習順序，也決定頁面底部「上一個／下一個主題」的連結。
- 新增章節時，要在 `style.css` 的「章節色」區塊加 `--ch-<chapter-id>`，並加一行 `body[data-chapter="<id>"]` 的對應。

---

## 8. 視覺風格

- 調性：**乾淨、現代、有質感的教材**。白色卡片、柔和陰影、圓角，每個章節有一個主題色。
- 顏色**只能**使用 `style.css` 最上方 `:root` 的變數，不在其他地方寫死色碼。
- 支援深色模式（`prefers-color-scheme: dark`）與手機寬度（≥ 360px），新元件也要用變數，才會自動適用。
- 動畫要平滑、不炫技：顏色代表狀態（第 6.4 節），位置移動代表資料移動。

---

## 9. AI 工作流程

### 新增一個主題（最常見）

1. 在 `syllabus.json` 找到主題（通常已是 `planned`）；沒有就依學習順序新增。
2. 複製 `topics/_template.html` → `topics/<chapter-id>/<topic-id>.html`。
3. 寫 `assets/js/viz/<topic-id>.js`（第 6 節），先讓動畫能跑。
4. 填 7 個 section 的內容（第 5 節），程式碼要和動畫一致。
5. 把 `syllabus.json` 中的 `status` 改成 `"done"`，補上 `difficulty`、`tags`、`updated`。
6. 執行 `python scripts/check.py`，必須顯示 `All checks passed`。
7. 本機預覽：`python -m http.server 8000` → `http://localhost:8000`（直接雙擊 html 會讀不到 json）。
8. 至少實際操作一次動畫：正常輸入、邊界情況（空、滿、重複、找不到），以及非法輸入。
9. 回報：新增或修改了哪些檔案、動畫支援哪些操作、哪些地方標了「（待確認）」。

### 使用者提供上課 PPT 或原文書時

- 以使用者提供的教材為準，調整章節順序、名詞譯法、演算法細節（例如刪除時用後繼還是前驅、top 從 −1 還是 0 開始）。
- 教材和本站既有寫法不同時，在頁面上用 `.callout` 註明「本課程採用 ○○ 版本」。
- 不要大段照抄教材原文，要用自己的話重新整理。

### 修改既有內容

- **只改被要求的部分**（最小 diff），不要順手重寫整頁或其他主題。
- 改完更新頁尾日期與 `syllabus.json` 的 `updated`。

### 不准做的事

- ❌ 刪除主題或章節（除非使用者明確要求）。
- ❌ 改動 section id、`syllabus.json` 欄位名稱、資料夾結構。
- ❌ 引入任何外部套件、框架、CDN。
- ❌ 在主題頁寫 `<style>` 或 inline style。
- ❌ 只有說明文字、沒有互動動畫的主題，不可標成 `done`。
- ❌ 編造考古題出處、年份或學校。

---

## 10. 完成的定義（Definition of Done）

- [ ] 檔案位置與命名符合第 4 節
- [ ] 7 個 section 齊全、順序正確
- [ ] 動畫可以自己輸入資料、能逐步播放，程式碼高亮正確
- [ ] `syllabus.json` 已更新，首頁看得到「完成」與「▶ 互動」標籤
- [ ] `python scripts/check.py` 通過
- [ ] 手機寬度與深色模式下都能正常閱讀

---

## 11. 給使用者的指令範例

> 請先讀 CLAUDE.md。幫我完成 Stack & Queue 章的「Circular Queue（環狀佇列）」，動畫要畫成一個環，看得到 front 和 rear 怎麼移動。

> 請先讀 CLAUDE.md。這是我們上課的 PPT，幫我照它的內容做 Tree 章的「Heap（堆積）」，動畫要有 insert 和 delete-max。

> 請先讀 CLAUDE.md。新增一個科目「Algorithms（演算法）」，先規劃章節，再完成第一個主題。
