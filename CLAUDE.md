# CLAUDE.md — 資工考研互動學習站

> 這份是給 AI 的「員工手冊」。每次開始工作前，請先完整讀完，再動手。
> 如果使用者當下的指示和這份文件衝突，**以使用者為準**，並在回報時提醒：「這和 CLAUDE.md 第 X 節不同，要不要一起更新規則？」

---

## 1. 專案目的

這是一個 **資工所考研複習網站**，一科一科慢慢補齊。

- **讀者**：準備研究所考試的資工系學生（包含作者本人）。
- **核心理念**：讀完就懂、考試會寫。每頁都是**完整的教材**：以文字講解為主體，搭配圖解和可以自己操作的逐步動畫幫助理解；段落依主題安排，不套固定格式。
- **組織方式**：科目（subject）→ 章節（chapter）→ 主題（topic）。每個主題頁的內容獨立完整，不依賴任何課本。
- **科目清單**（`data/subjects.json`）：

| 科目 | subject-id | 狀態 |
|---|---|---|
| Data Structures（資料結構） | `data-structures` | 進行中（參考書：Horowitz《Fundamentals of Data Structures in C》，僅供 AI 查閱） |
| Algorithms（演算法） | `algorithms` | 籌備中 |
| Computer Organization（計算機組織） | `computer-organization` | 籌備中 |
| Operating Systems（作業系統） | `operating-systems` | 籌備中 |
| Discrete Mathematics（離散數學） | `discrete-math` | 籌備中 |
| Linear Algebra（線性代數） | `linear-algebra` | 籌備中 |

不要自行新增或刪除科目；使用者要求時才改。

---

## 2. 參考書（只給 AI 查閱）

- 每個科目可以在 `data/<subject-id>.json` 的 `textbook` 記錄參考書，主題的 `book` 記錄對應節次（例如 `"5.7"`）。**這些資訊只給 AI 撰寫時查閱，不顯示在網站上。**
- **頁面內容要能獨立閱讀**：網站上不寫「照課本」「課本 §」「課本對照」「課本範例」「參考書」這類字眼（`check.py` 會檢查）。
- 章節順序可以參考參考書；演算法有多種做法時，選**考研最常見的做法**當預設，動畫提供切換（例如 BST 刪除預設用左子樹最大，可切換右子樹最小）。
- **不可照抄參考書原文、圖或習題**，一律用自己的話重新整理；程式碼自己寫。
- 使用者給上課 PPT 或其他教材時，一樣當作參考，用來調整內容的正確性與重點。

---

## 3. 語言與用詞

| 規則 | 範例 |
|---|---|
| 正文使用 **繁體中文**，語氣口語、清楚，像學長姊在講解 | |
| 專有名詞 **第一次出現** 寫成「English（中文）」，並包在 `<span class="term">` 裡 | `<span class="term">Stack<small>（堆疊）</small></span>` |
| 之後再出現可以只寫英文 | push、pop、BST |
| 頁面標題、章節名稱、卡片一律用「English（中文）」 | `Binary Search Tree（二元搜尋樹）` |
| 程式碼用 **C 語言**（台灣考研最常見），註解用中文；數學科可用虛擬碼 | `/* 中序前驅 */` |
| **數字要有意義**：寫出數字時同時說明它代表什麼 | ✅「h = n，所有操作退化成 O(n)」 ❌「答案是 14」 |
| 不確定的內容標「（待確認）」，**不可編造** 定理、公式或考古題出處 | |

---

## 4. 技術限制（不能改）

| 項目 | 規則 |
|---|---|
| 技術 | 純 HTML + CSS + 原生 JavaScript。**不使用** 框架、打包工具、npm 套件、CDN。 |
| 部署 | GitHub Pages，從 `main` 分支根目錄發佈，**沒有 build 步驟**。 |
| 路徑 | 一律用 **相對路徑**（主題頁用 `../../../`，科目首頁用 `../../`），不可用 `/` 開頭的絕對路徑。 |
| 樣式 | 全部寫在 `assets/css/style.css`。HTML 頁面 **不准寫 `<style>` 或 inline style**（JS 動態產生的元素可以設 CSS 變數）。 |
| 動畫 | 一律使用 `assets/js/viz-core.js` 的 Player，**不另外寫一套動畫系統**，也不用 canvas 或外部函式庫。 |
| 外部資源 | 不引入外部字型、圖片 URL、追蹤碼。 |

---

## 5. 資料夾結構與命名

```
/
├── CLAUDE.md                     ← 本文件（規則的唯一來源）
├── README.md                     ← 給人看的介紹
├── index.html                    ← 全站首頁：讀 data/subjects.json 畫出科目卡片與進度
├── data/
│   ├── subjects.json             ← 科目登錄表
│   └── <subject-id>.json         ← 該科的參考書、章節、主題登錄表
├── subjects/
│   └── <subject-id>/
│       ├── index.html            ← 科目首頁（從 templates/subject.html 複製）
│       └── <chapter-id>/<topic-id>.html   ← 主題頁（從 templates/topic.html 複製）
├── templates/
│   ├── subject.html
│   └── topic.html
├── assets/
│   ├── css/style.css
│   └── js/
│       ├── theme.js              ← 亮 / 暗模式（放在 <head>，預設淺色）
│       ├── site.js               ← 科目列表、章節地圖、TOC、上下篇、測驗展開
│       ├── viz-core.js           ← 共用的動畫播放器與靜態圖（不要為了單一主題改它）
│       └── viz/<subject-id>/<topic-id>.js   ← 每個主題自己的圖與動畫
└── scripts/
    └── check.py                  ← 檢查所有科目與主題是否符合本文件
```

- 所有 id：**小寫英文 kebab-case**，用最常見的英文名稱。✅ `binary-search-tree` ❌ `BST`、`二元樹`、`topic1`
- `topic-id` 在**同一科目內唯一**。
- 動畫腳本：`subjects/data-structures/tree/binary-search-tree.html` ↔ `assets/js/viz/data-structures/binary-search-tree.js`。
- 一個主題頁可以有多個動畫，用 `data-viz` 名稱區分（例如 `stack-ops`、`infix-postfix`），都寫在同一個腳本。

---

## 6. 主題頁的內容

目標是一份**完整的教材**：只讀這一頁就能從零學會這個主題、上考場會寫。**文字講解是主體，圖和動畫是幫助理解的輔助**，兩者都要有。段落的順序與名稱依主題安排，不必每頁一樣。

### 6.1 必備：完整的文字講解

- 像講義一樣把觀念**從頭講清楚**，至少涵蓋（依主題取捨順序）：
  1. **動機**：為什麼需要它、它解決了什麼問題（和已學過的結構比較）。
  2. **定義**：精確的定義與性質，容易誤解的地方要特別點出。
  3. **運作原理**：每個操作一步一步怎麼做、為什麼這樣做是對的。
  4. **例子**：用具體資料完整走一遍（可以用表格逐步列出）。
  5. **性質與效能**：複雜度怎麼來的，最好／平均／最差情況，數字要解釋意義。
  6. **應用與比較**：用在哪裡、和相近的結構或做法有什麼差別。
- 文字要能**獨立讀懂**，不能只寫「請看動畫」；圖和動畫是輔助，不是取代。
- 講解用 `<div class="panel prose">`，裡面可以有 `<h3>` 小標、段落、條列。

### 6.2 必備：圖解輔助

- **靜態圖**（`<figure class="fig">`，第 8.6 節）：每頁至少一張。放在對應的文字旁邊，畫出最關鍵的結構或狀態（例如合法與不合法的對照、操作前後的比較）。每張圖都要有 `<figcaption>`，寫「<b>圖 n</b>：這張圖要看什麼」。
- **互動動畫**（`.viz`，第 8 節）：資料會移動、指標會改變、結構會變形的主題都要做，讓讀者可以自己輸入資料操作。放在對應的文字講解之後。
- 純觀念或純計算的主題（例如複雜度分析），至少要有靜態圖；有適合的互動形式（例如計算器）再加。

### 6.3 常用的段落元件

| 元件 | 用途 |
|---|---|
| 文字講解 `.panel.prose` | 主體內容（6.1） |
| 靜態圖 `figure.fig` | 關鍵結構、前後對照（6.2） |
| 互動動畫 `.viz` | 自己操作、逐步觀察（6.2） |
| `.callout` | 一句話記憶法、重要定義 |
| 表格 | 操作與複雜度、做法比較、逐步追蹤的例子 |
| 公式 `<pre class="formula">` | 重要公式、遞迴式 |
| 程式碼 `<pre class="code">` | C 實作；有動畫時要和動畫右側程式碼一致。`< > &` 要跳脫 |
| 考研重點 `.exam-q`（`<span class="qtype">` 標題型＋解題方向） | 常見考法與解題思路 |
| 易錯點 `.pitfalls`（`❌ 錯誤想法 → ✅ 正確觀念`） | 常見觀念錯誤 |
| 自我測驗 `<details class="quiz">`（答案要附理由） | 讀完後自我檢查 |

### 6.4 每頁都要遵守的外殼

- 每個頂層 `<section>` 要有 kebab-case 的 `id` 和一個 `<h2>`（右側目錄 TOC 靠它），至少 2 個 section。
- `<body data-subject="<subject-id>" data-chapter="<chapter-id>" data-chno="<章節編號>" data-topic="<subject-id>/<chapter-id>/<topic-id>" data-root="../../../">`
- `<title>`：`English（中文） · 科目中文 | 資工考研互動學習站`；`<meta name="description">` 一句話、≤ 70 字。
- 麵包屑：`首頁 › 科目 English（中文） › Ch<編號> 章節 English（中文） › 主題 English（中文）`
- meta 列：`Ch<編號> 章節 English`、難度、tags。
- 頁尾「最後更新：YYYY-MM-DD」與 JSON 的 `updated` 一致。
- `<head>` 載入 `theme.js`；頁首要有 `<button class="theme-toggle" data-theme-toggle>`。
- 結尾載入 `site.js`，再依序載入 `viz-core.js` → `viz/<subject-id>/<topic-id>.js`（圖和動畫都寫在這個腳本裡）。

---

## 7. 資料檔格式

### `data/subjects.json`

```json
{
  "subjects": [
    { "id": "data-structures", "en": "Data Structures", "zh": "資料結構", "icon": "🌲",
      "color": 5, "status": "active", "desc": "一句話描述" }
  ]
}
```

- `status`：`"active"`（已開始，要有 `data/<id>.json` 和 `subjects/<id>/index.html`）或 `"planned"`。
- `color`：1～12，對應 CSS 的 `--ch-<n>` 色盤。

### `data/<subject-id>.json`

```json
{
  "subject": { "id": "data-structures", "en": "Data Structures", "zh": "資料結構" },
  "textbook": { "title": "Fundamentals of Data Structures in C", "author": "Horowitz, Sahni, Anderson-Freed", "edition": "1993" },
  "chapters": [
    { "id": "tree", "no": 5, "en": "Trees", "zh": "樹", "desc": "一句話描述",
      "topics": [
        { "id": "binary-search-tree", "en": "Binary Search Tree", "zh": "二元搜尋樹", "book": "5.7",
          "status": "done", "priority": "high", "viz": true, "difficulty": 2,
          "tags": ["BST", "insert", "delete"], "updated": "2026-11-16" }
      ] }
  ]
}
```

- `no`：章節編號（可對應參考書章號），也決定章節色：`--ch-<(no-1) % 12 + 1>`。
- `status`：`"done"`（有頁面）或 `"planned"`（籌備中，灰色顯示）。
- `priority`：`"high"`（考研高頻，科目頁顯示「高頻」標籤）、`"mid"`、`"low"`。製作順序優先做 high。
- `viz`：頁面有沒有互動元件，要和頁面一致（`check.py` 會檢查）。
- `done` 的主題必須有 `difficulty`（1～3）、`tags`（2～5 個）、`updated`；有參考書時要填 `book`（只給 AI 查閱，不顯示）。
- 章節與主題的順序 = 學習順序，也決定頁面底部「上一個／下一個主題」。

---

## 8. 圖與動畫的寫法（viz-core.js）

### 8.1 核心概念：動畫 = 一串 Frame

主題腳本 **只負責產生 frames（每一步的畫面快照）**；播放、暫停、上一步/下一步、速度、補間動畫、程式碼高亮，全部由 Player 處理。同一個 `id` 的元素在前後兩個 frame 之間會**自動平滑移動**，新出現的淡入、消失的淡出。

### 8.2 骨架

```js
(function () {
  const { Player, Recorder, ui, register, esc } = window.DSViz;

  register("my-viz", function (root) {
    const player = new Player(root, {
      title: "English（中文）",
      width: 640, height: 320,          // SVG viewBox
      code: ["line 1", "line 2"],       // 右側程式碼；多種操作可用 player.setCode() 切換
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
    const demo = doSomething(5);         // 初始載入一段示範
    demo[0].caption = "▶ 按播放看示範……";
    player.load(demo, { autoplay: false });
  });
})();
```

### 8.3 Frame 格式

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

### 8.4 狀態色（state）— 全站語意要一致

| state | 顏色 | 意義 |
|---|---|---|
| `default` | 灰 | 一般 |
| `compare` | 藍 | 正在比較 / 目前所在位置 |
| `active` | 橘 | 正在處理、讀入、特別標記（例如替代者） |
| `new` | 紫 | 剛加入 / 剛輸出 |
| `found` | 綠 | 找到、完成、已輸出 |
| `removed` | 紅 | 將被刪除 |
| `visited` | 青 | 已經走過 |
| `muted` / `ghost` | 淡灰 / 虛線 | 不重要、哨兵（如 eos）/ 空位 |

### 8.5 動畫規則

1. **使用者可以自己輸入**資料，並提供經典例子的快捷按鈕；輸入要驗證，錯誤時給中文提示。
2. 每個 frame 的 `caption` 都要說明「**為什麼**」，例：✅「isp[*] = 13 ≥ icp[+] = 12，先 pop」 ❌「pop」。
3. 每個 frame 都要標 `line`，讓程式碼和動畫同步（初始或總結畫面可以是 `null`）。
4. 一次操作約 3～40 步；畫面放不下時要提前擋住並說明（例如限制樹高、token 數）。
5. 使用者輸入的文字放進 caption 前要用 `esc()` 跳脫。
6. 初始畫面要先載入**一段示範操作**，用 `{ autoplay: false }`，讓使用者一按 ▶ 就能播放；只有 1 步時按 ▶ 會出現提示（Player 內建）。
7. 演算法有多種做法時，**預設用考研最常見的做法**，用 `ui.button` 做切換（見 BST 的「刪除用：左子樹最大」）。
8. 需要新的視覺元素時，**優先用既有的 nodes / edges / pointers / labels 組合**；真的不夠時，先向使用者說明要怎麼擴充 `viz-core.js`，同意後再改，並確認其他主題的動畫都還正常。

### 8.6 靜態圖（figure）

靜態圖和動畫共用同一套 Frame 格式與狀態色，只是只有一張畫面、沒有控制列。

```html
<figure class="fig">
  <div class="fig-draw" data-fig="bst-valid-invalid"></div>
  <figcaption><b>圖 1</b>：(a) 合法的 BST；(b) 12 在 10 的左子樹中卻大於 10，所以不是 BST。</figcaption>
</figure>
```

```js
const { figure } = window.DSViz;
figure("bst-valid-invalid", () => ({
  width: 640, height: 250,              // viewBox
  nodes: [...], edges: [...], pointers: [...], labels: [...],
}));
```

- 圖的名稱用 kebab-case，以主題開頭（例如 `stack-array-states`）。
- 用狀態色強調重點（例如不合法的節點用 `removed`、要看的路徑用 `visited`），並在圖上用 labels 寫出關鍵說明。
- 畫完要實際截圖檢查：文字不可重疊、不可超出畫面。

---

## 9. 視覺風格

- 調性：**乾淨、現代、有質感的教材**。白色卡片、柔和陰影、圓角。
- 章節色依 `data-chno` 從 12 色色盤取（`--ch-1`～`--ch-12`），科目卡片依 `color` 取同一組色盤。
- 顏色**只能**使用 `style.css` 最上方 `:root` 的變數，不在其他地方寫死色碼。
- **預設淺色**，頁首按鈕可切換深色：`theme.js` 在 `<html>` 設定 `data-theme="dark"`，深色配色寫在 `:root[data-theme="dark"]`，選擇存在 localStorage。
- 新元件一律用 CSS 變數上色，才會自動適用兩種模式；也要支援手機寬度（≥ 360px）。
- 動畫要平滑、不炫技：顏色代表狀態（第 8.4 節），位置移動代表資料移動。

---

## 10. AI 工作流程

### 新增一個主題（最常見）

1. 在 `data/<subject-id>.json` 找到主題（通常已是 `planned`，優先做 `priority: high`），可以先查參考書對應節次確認觀念，但頁面內容要自己寫、獨立完整。
2. 複製 `templates/topic.html` → `subjects/<subject-id>/<chapter-id>/<topic-id>.html`。
3. 先規劃講解的骨架（第 6.1 節），再決定哪些地方配靜態圖、哪些地方做動畫，寫在 `assets/js/viz/<subject-id>/<topic-id>.js`（第 8 節）。
4. 撰寫完整的文字講解，把圖和動畫放在對應的文字旁；有動畫時程式碼和動畫一致；不提到參考書。
5. JSON 中把 `status` 改成 `"done"`，補上 `difficulty`、`tags`、`updated`，`viz` 依頁面實際情況填。
6. 執行 `python scripts/check.py`，必須顯示 `All checks passed`。
7. 本機預覽：`python -m http.server 8000` → `http://localhost:8000`（直接雙擊 html 會讀不到 json）。
8. 截圖檢查每張圖有沒有文字重疊或超出畫面；有動畫時實際操作：正常輸入、經典例子、邊界情況（空、滿、重複、找不到）、非法輸入；亮暗兩種模式都看一次。
9. 回報：新增或修改了哪些檔案、動畫支援哪些操作、預設採用哪種做法、哪些地方標了「（待確認）」。

### 開始一個新科目

1. 先問使用者有沒有參考書或教材，再在 `data/<subject-id>.json` 規劃章節與主題（全部 `planned`）。
2. `data/subjects.json` 中把該科 `status` 改成 `"active"`。
3. 複製 `templates/subject.html` → `subjects/<subject-id>/index.html`，取代 `{{...}}`。
4. 完成第一個主題後再 push。

### 修改既有內容

- **只改被要求的部分**（最小 diff），不要順手重寫整頁或其他主題。
- 改完更新頁尾日期與 JSON 的 `updated`。

### 不准做的事

- ❌ 刪除科目、章節或主題（除非使用者明確要求）。
- ❌ 改動 JSON 欄位名稱、資料夾結構。
- ❌ 引入任何外部套件、框架、CDN。
- ❌ 在 HTML 頁面寫 `<style>` 或 inline style。
- ❌ 在頁面上提到課本、參考書或 § 節次。
- ❌ 照抄參考書原文或圖；編造考古題出處、年份或學校。

---

## 11. 完成的定義（Definition of Done）

- [ ] 檔案位置與命名符合第 5 節
- [ ] 文字講解完整（動機、定義、運作原理、例子、效能、應用），只讀這頁就能學會；獨立完整、不提到參考書
- [ ] 至少一張有圖說的靜態圖；適合的主題有互動動畫；圖文不重疊、不超出畫面
- [ ] 有動畫時：可以自己輸入資料、有示範、能逐步播放，程式碼高亮正確
- [ ] JSON 已更新，科目首頁看得到「完成」標籤（有互動時加「▶ 互動」），全站首頁進度有變化
- [ ] `python scripts/check.py` 通過
- [ ] 手機寬度，以及淺色、深色兩種模式下都能正常閱讀

---

## 12. 給使用者的指令範例

> 請先讀 CLAUDE.md。幫我完成資料結構的「Circular Queue（環狀佇列）」，動畫要畫成一個環，看得到 front 和 rear 怎麼移動。

> 請先讀 CLAUDE.md。幫我做 Trees 章的「Heap（堆積）」，動畫要有 insert 和 delete-max。

> 請先讀 CLAUDE.md。開始「Operating Systems（作業系統）」這科，參考書是恐龍書，先規劃章節，再完成 CPU Scheduling。
