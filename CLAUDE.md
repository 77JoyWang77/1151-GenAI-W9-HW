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
| Data Structures（資料結構） | `data-structures` | 進行中（參考書：Horowitz《Fundamentals of Data Structures in C》，僅供 AI 查閱；題號前綴 `ds-`） |
| Algorithms（演算法） | `algorithms` | 進行中（參考書：Cormen 等《Introduction to Algorithms》4th，僅供 AI 查閱；題號前綴 `al-`） |
| Computer Organization（計算機組織） | `computer-organization` | 進行中（參考書：Patterson & Hennessy《Computer Organization and Design》5th，僅供 AI 查閱；題號前綴 `co-`） |
| Operating Systems（作業系統） | `operating-systems` | 進行中（參考書：Silberschatz《Operating System Concepts》10th，僅供 AI 查閱；題號前綴 `os-`） |
| Discrete Mathematics（離散數學） | `discrete-math` | 進行中（參考書：Rosen《Discrete Mathematics and Its Applications》8th，僅供 AI 查閱；題號前綴 `dm-`） |
| Linear Algebra（線性代數） | `linear-algebra` | 進行中（參考書：Leon《Linear Algebra with Applications》Global Edition，僅供 AI 查閱；題號前綴 `la-`） |

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
| **標題類不加括號**：網頁標題、頁面大標、麵包屑、卡片與列表上的名稱、上一篇／下一篇、動畫標題，一律寫成「English 中文」，中間空一格；括號只用在**內文**第一次出現的專有名詞 | 標題 `Binary Search Tree 二元搜尋樹`；內文 `Binary Search Tree（二元搜尋樹）` |
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
| 快取 | 頁面引用 CSS、JS 時都帶版本號 `?v=<雜湊>`，避免瀏覽器拿新 HTML 配舊 JS。改過 `assets/` 之後、push 之前執行 `python scripts/stamp.py` 更新版本號（`check.py` 會檢查）。 |

---

## 5. 資料夾結構與命名

```
/
├── CLAUDE.md                     ← 本文件（規則的唯一來源）
├── README.md                     ← 給人看的介紹
├── index.html                    ← 全站首頁：讀 data/subjects.json 畫出科目卡片與進度
├── data/
│   ├── subjects.json             ← 科目登錄表
│   ├── questions/<subject-id>.json  ← 題庫：原創練習題與考古題（第 7 節）
│   ├── exam-log.json             ← 考卷登錄表：每份考卷的 id、卷名、原卷網址、不收的題目與原因（第 7.1、7.2 節）
│   └── <subject-id>.json         ← 該科的參考書、章節、主題登錄表
├── exams/
│   ├── index.html                ← 考古題總覽：學校 × 學年度 × 卷別（第 7.2 節）
│   └── paper.html                ← 單份考卷頁，用 ?id=<考卷 id> 指定，內容全由 site.js 讀 JSON 畫出
├── subjects/
│   └── <subject-id>/
│       ├── index.html            ← 科目首頁（從 templates/subject.html 複製）
│       ├── questions.html        ← 科目題庫頁（從 templates/questions.html 複製）
│       └── <chapter-id>/<topic-id>.html   ← 主題頁（用 scripts/new_topic.py 從 templates/topic.html 產生）
├── code/
│   └── <subject-id>/<topic-id>.c    ← 每個主題的完整 C 程式（只用來編譯驗證，頁面片段從這裡取出）
├── templates/
│   ├── subject.html
│   ├── questions.html
│   └── topic.html
├── assets/
│   ├── icons.svg                 ← 全站 SVG icon（第 10.1 節）
│   ├── exam-img/<subject-id>/    ← 考古題的原卷裁切圖（第 7.1 節）
│   ├── css/style.css
│   └── js/
│       ├── theme.js              ← 亮 / 暗模式（放在 <head>，預設淺色）
│       ├── site.js               ← 科目列表、章節地圖、TOC、上下篇、測驗展開
│       ├── viz-core.js           ← 共用的動畫播放器與靜態圖（不要為了單一主題改它）
│       └── viz/<subject-id>/<topic-id>.js   ← 每個主題自己的圖與動畫
└── scripts/
    ├── check.py                  ← 檢查所有科目與主題是否符合本文件
    ├── header.py                 ← 產生全站統一頁首（6.6）
    ├── new_topic.py              ← 產生主題頁（11）
    ├── stamp.py                  ← 替 CSS / JS 加版本號（4）
    └── exam/                     ← 考古題匯入工具：OCR、檢查、合併、裁圖、預覽（第 11 節）
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
- **比較兩種做法時一次只改一個變因**，其他條件寫清楚並固定。例如比較區塊大小對命中率的影響，快取總容量要相同（4 個 1-word 區塊 vs 2 個 2-word 區塊），不能讓容量也跟著變大，否則讀者分不出差別是哪個因素造成的。
- 講解用 `<div class="panel prose">`，裡面可以有 `<h3>` 小標、段落、條列。
- **一個 section 一張卡片**：同一節的文字、表格（包在 `<div class="table-scroll">` 裡）、靜態圖、公式、callout、「看程式碼」都放在**同一個** `.panel.prose` 裡，照閱讀順序排，不要把表格或圖另外包成一張卡片，讓一節被切成好幾塊。
- **唯一的例外是互動動畫**（`.viz`）：它本身就是一張可操作的卡片，放在講解卡片的前面或後面，不要塞進講解卡片裡。所以一個 section 只會是「卡片」或「卡片 → 動畫」（必要時「卡片 → 動畫 → 卡片」），`check.py` 會檢查兩張卡片之間一定隔著動畫。

### 6.2 必備：圖解輔助

- **靜態圖**（`<figure class="fig">`，第 8.6 節）：每頁至少一張。放在對應的文字旁邊，畫出最關鍵的結構或狀態（例如合法與不合法的對照、操作前後的比較）。每張圖都要有 `<figcaption>`，寫「<b>圖 n</b>：這張圖要看什麼」。
- **互動動畫**（`.viz`，第 9 節）：資料會移動、指標會改變、結構會變形的主題都要做，讓讀者可以自己輸入資料操作。放在對應的文字講解之後。
- 純觀念或純計算的主題（例如複雜度分析），至少要有靜態圖；有適合的互動形式（例如計算器）再加。

### 6.3 程式碼

- **程式碼跟著講解走，但預設收合**：每個操作講完，接一段收合的程式碼框：收起時只看到程式碼框的標題列（例如「push / pop / peek（陣列實作）」），點它往下展開、再點一次收起，不打斷閱讀（箭頭和外觀由 `site.js` 處理，HTML 照下面的寫法即可，`summary` 裡「看程式碼：」後面的文字就是標題列）。不要把程式碼集中在頁尾一大段，也不要直接攤開在講解中。
- **每段程式碼都要有標題**；同一件事有多種寫法時（陣列／鏈結、遞迴／迴圈、左子樹最大／右子樹最小）用頁籤切換，預設頁籤放考研最常見的寫法：

```html
<details class="code-fold">
  <summary>看程式碼：push / pop / peek（陣列實作）</summary>
  <div class="code-block">
    <div class="code-head">push / pop / peek（陣列實作）</div>
    <pre class="code">...</pre>
  </div>
</details>

<details class="code-fold">
  <summary>看程式碼：插入（遞迴版／迴圈版）</summary>
  <div class="code-tabs">
    <div class="code-block" data-tab="遞迴版"><div class="code-head">insert()：遞迴版</div><pre class="code">...</pre></div>
    <div class="code-block" data-tab="迴圈版"><div class="code-head">insertIter()：迴圈版</div><pre class="code">...</pre></div>
  </div>
</details>
```

- **頁面上只放各段 C 程式碼片段，不放完整程式**。完整程式（含 `main()` 和測試）存成 `code/<subject-id>/<topic-id>.c`，只用來編譯驗證，不顯示在網站上。
- **程式碼一定要實際編譯執行過**：用 `gcc -std=c99 -Wall -Wextra` 編譯不能有警告，最好再加 `-fsanitize=address,undefined` 跑一次確認沒有記憶體錯誤；頁面上的片段、動畫右側的程式碼都要從 `code/` 裡的完整程式中**原封不動地取出**，三者必須一致（`check.py` 會檢查片段的每一行都在 `.c` 檔裡）。
- 用程式產生 HTML 或 JS 時，`<pre>` 裡的內容不可以被加縮排或改動；`\n`、`\0` 這類跳脫字元要保持原樣。
- 片段可以省略與該段無關的部分，但不能用頁面上沒定義的函式卻不說明。
- 不要寫依賴未定義行為的程式（例如在同一個 `printf` 參數裡呼叫多次 `pop()`）。

### 6.4 考研重點、易錯點、練習題

每個主題頁的最後依序是這三個 section（標題就說明了用途，不用再加一段開場說明）：

| section id | 內容 |
|---|---|
| `exam`：考研重點：題型地圖 | 表格 `.exam-map`：**題型／常見度（很常考、常考、偶爾）／解題步驟／例題**。例題欄用 `<a class="q-link" href="#q-<題目id>">例題</a>` 連到下方題目，網頁會自動換成題號 |
| `pitfalls`：易錯點 | `x-circle` icon＋錯誤想法 → `check-circle` icon＋正確觀念，**每一點後面都要附一個 `q-link`**，連到專門考這個觀念的題目 |
| `practice`：練習題與考古題 | 只放 `<div class="qbank" data-questions="<topic-id>">`，題目由 `data/questions/<subject-id>.json` 自動產生，依難度分組，最後是考古題 |

**題目難度**（`level`）：

| level | 名稱 | 標準 |
|---|---|---|
| `basic` | 基礎 | 讀完講解就答得出來，確認觀念 |
| `advanced` | 進階 | 要動手算、逐步追蹤，或需要把兩個觀念合起來用 |
| `exam` | 考研級 | 和研究所考題同等難度：綜合題、證明題、計數題、複雜度分析 |

- 每個主題**每個難度至少 2 題原創題**（`check.py` 會檢查），避免只出觀念確認題。
- **詳解要寫推導過程**，不是只給答案；有常見錯誤時順便點出來。
- **計算題、追蹤題的答案一定要用程式驗算**（例如寫個小程式跑一遍），確認正確才放上去。

### 6.5 常用的段落元件

| 元件 | 用途 |
|---|---|
| 文字講解 `.panel.prose` | 主體內容（6.1）；一節一張卡片，其他元件都放在卡片裡 |
| 靜態圖 `figure.fig` | 關鍵結構、前後對照（6.2） |
| 互動動畫 `.viz` | 自己操作、逐步觀察（6.2） |
| `.callout` | 一句話記憶法、重要定義 |
| 表格 `<div class="table-scroll"><table>` | 操作與複雜度、做法比較、逐步追蹤的例子；放在卡片裡 |
| 公式 `<pre class="formula">` | 重要公式、遞迴式 |
| 程式碼 `details.code-fold`、頁籤 `.code-tabs` | 見 6.3；`< > &` 要跳脫 |
| 考研重點、易錯點、練習題 | 見 6.4，每頁都要有 |

### 6.6 每頁都要遵守的外殼

- 每個頂層 `<section>` 要有 kebab-case 的 `id` 和一個 `<h2>`（右側目錄 TOC 靠它），至少 2 個 section。
- `<body data-subject="<subject-id>" data-chapter="<chapter-id>" data-chno="<章節編號>" data-topic="<subject-id>/<chapter-id>/<topic-id>" data-root="../../../">`
- `<title>`：`English 中文 · 科目中文 | 資工考研互動學習站`（標題不加括號，第 3 節），English、中文要和 JSON 的 `en`、`zh` 完全一致（`check.py` 會檢查）；`<meta name="description">` 一句話、≤ 70 字。
- 麵包屑：`首頁 › 科目 English 中文 › Ch<編號> 章節 English 中文 › 主題 English 中文`
- meta 列：`Ch<編號> 章節 English`、難度、tags。
- 頁尾「最後更新：YYYY-MM-DD」與 JSON 的 `updated` 一致。
- 難度寫成 `<span class="chip" data-difficulty="1～3">難度</span>`，星星由 `site.js` 畫。
- **全站頁首統一**：每一頁的 `<header class="site-header">` 都**一模一樣**（只有相對路徑不同）。頁首只放每一頁都適用的東西：logo＋站名、「科目」、「考古題」、亮暗切換。屬於某個科目的連結（科目首頁、題庫）不放頁首，改由頁面內的麵包屑、題庫卡片、「到題庫篩選」提供。頁首也不標示目前所在頁，外觀在每一頁都完全相同。頁首由 `scripts/header.py` 產生，不要手改；要調整時改 `header.py` 再執行 `python scripts/header.py` 更新全部頁面（`check.py` 會比對）。
- HTML 標籤要成對，特別是專有名詞的 `<small>`：少寫一個 `</small>`，後面整段字都會變小（`check.py` 會檢查）。
- `<head>` 載入 `theme.js`。
- 結尾載入 `site.js`，再依序載入 `viz-core.js` → `viz/<subject-id>/<topic-id>.js`（圖和動畫都寫在這個腳本裡）。

---

## 7. 題庫（`data/questions/<subject-id>.json`）

主題頁的練習題、科目的題庫頁（`subjects/<subject-id>/questions.html`，可依主題、難度、題型、來源、學校篩選）和考古卷頁（第 7.2 節）都讀這個檔案。

```json
{
  "subject": "data-structures",
  "levels": { "basic": "基礎", "advanced": "進階", "exam": "考研級" },
  "questions": [
    {
      "id": "ds-0014",
      "topics": ["binary-search-tree"],
      "level": "advanced",
      "type": "選擇",
      "source": { "kind": "original" },
      "question": "題目（可用 HTML）",
      "choices": ["(A) …", "(B) …"],
      "answer": "(B)",
      "explanation": "<p>詳解（可用 HTML）</p>"
    }
  ]
}
```

- `id`：科目縮寫 + 四位數流水號（資料結構用 `ds-0001`），**全科唯一、不可重複使用**。
- **新增題目前先 `git pull`**，從最新的最大題號往下排。考古題可能在別的對話中整批匯入，用舊的最大題號會和它們撞號（`check.py` 會檢查重複）。push 時被拒，就先 pull，題號撞到時把自己新增的題目重新編號，並一起改頁面上的 `q-link`。
- `topics`：一題可以對應多個主題，主題頁會自動列出所有標了它的題目。
- `type`：選擇／填空／計算／追蹤／證明／實作／簡答。選擇題要有 `choices`。
- `source.kind`：`"original"`（原創）或 `"exam"`（考古題）。

### 7.1 匯入考古題

考古題**照原題全文收錄**，並寫自己的詳解。工具在 `scripts/exam/`（見第 11 節的流程）。

**1. 來源**
- 只有兩種：使用者提供的檔案（PDF 或圖片），或 AI 從**使用者指定**的考古題網站（例如學校圖書館考古題系統）取得的原卷。**不可憑印象寫出或編造題目、學校、年份、題號**；`source.url` 一定要填原卷網址。
- 掃描檔先用 OCR（`scripts/exam/ocr.sh`）找出題目位置，但收錄的文字一律對照原卷圖片逐字確認，不能直接用 OCR 結果。

**2. 收不收（同一套標準，不要每次自己判斷）**

| 情況 | 處理 |
|---|---|
| 至少有一種合理解讀能算出選項中的答案（題意有歧義、單選題有兩個選項說得通） | **收**。答案取最合理的解讀，詳解寫出每種解讀各得到什麼，答案後面標「（待確認）」 |
| 任何解讀都對不上選項、資料自相矛盾、卷上註明送分 | 不收 |
| 圖上的手寫註記或掃描瑕疵蓋住題目內容，無法確認原字 | 不收 |
| 要讀卷外的長篇資料（新聞全文、外部量測結果）才能作答 | 不收 |
| 不屬於六科（例如計算機網路、機器學習） | **收**，放進該考卷所屬科目最後的「其他」章（`others`），沒有合適主題就在那一章新增 `planned` 主題 |
| 有圖 | **一定要收**，照第 3 點附圖 |

不收的題目一律登錄在 `data/exam-log.json`（題號＋原因），不能只寫在回報裡。

**3. 題目內容**
- 題目全文照錄（包含選項、表格）。英文題目照英文，不翻譯。
- **卷上的筆誤**：原文照錄，在題目裡加「（註：原卷寫 X，應為 Y）」，詳解再說明。
- **承上題**：題目開頭補一段前一題的必要題幹（「（承上題：……）」），讓這題單獨看也能作答。
- **複選題**：題目開頭寫「（複選）」，答案列出所有正確選項。
- **有圖的題目**：
  - 樹、圖、陣列、小表格這類結構簡單的圖，用 viz-core 的 Frame 格式重畫：`<figure class="fig"><div class="q-fig" data-spec="{Frame JSON}"></div><figcaption>…</figcaption></figure>`，`site.js` 會用 Player 畫出來，和主題頁的靜態圖同一套風格與狀態色。重畫的圖不要用狀態色洩漏答案。
  - 電路、datapath、波形、長篇圖表這類難以重畫的，從原卷裁切成 PNG（灰階、寬 ≤ 1100px），放在 `assets/exam-img/<subject-id>/<學校>-<年>-q<題號>.png`，寫成 `<figure class="fig"><img class="q-img" data-src="assets/exam-img/…" alt="原卷附圖"><figcaption>…</figcaption></figure>`（`data-src` 相對網站根目錄，由 `site.js` 補上路徑；深色模式會自動反相）。只裁圖本身，題目文字仍要照錄成文字。
  - 圖上有考生的手寫註記（答案、圈選、塗改）時，裁切前先塗白遮掉，或改用重畫。

**4. 分類**
- **分科**：軟體卷要拆成資料結構與演算法。結構本身（陣列、串列、樹、heap、雜湊、圖的表示與走訪、排序的過程）歸 `data-structures`；設計與分析（複雜度、遞迴式、DP、greedy、網路流、NP、隨機化、均攤分析）歸 `algorithms`。數學卷、硬體卷照內容分到離散／線代、計組／作業系統。
- **topics**：可以標多個。**沒有合適的主題時，先在 `data/<subject-id>.json` 新增一個 `planned` 主題**，不要硬塞進相近的主題。
- `type` 照題目性質，`level` 一律為 `"exam"`。

**5. source**
- `{ "kind": "exam", "school": "國立臺灣大學", "year": 113, "dept": "…", "no": 3, "paper": "ntu-113-software", "url": "原卷網址" }`，`school`、`year`、`dept`、`no`、`paper` 必填。
- `paper`：這題屬於哪一份考卷，值是 `data/exam-log.json` 裡那份考卷的 `id`（`import_exq.py` 會自動填）。考古卷頁靠它把散在各科題庫的題目組回一份卷。
- `dept`：照該年卷頭的系所／科目寫，同一學校不同年份卷頭不同就分開寫。
- `no`：用卷上的題號。大題下的小題寫 `"3-(a)"`；卷上分成幾個部分（例如問答、單選、複選）就加部分編號 `"I-3"`、`"II-1"`；同一份考卷內格式要一致。合併收錄的幾題寫 `"21-23"`。

**6. 詳解與驗算**
- 自己寫詳解，寫推導過程；計算、追蹤題一定用程式驗算。看不清楚或不確定的地方標「（待確認）」並回報使用者。
- 題目用到的主題如果還沒有頁面，仍然可以先收錄（題庫頁看得到），主題頁做好後會自動出現。

**7.** 執行 `python scripts/check.py` 檢查格式；匯入整批考卷後再用 `EXAM_PDFS=<考卷資料夾> python scripts/check.py`，確認資料夾裡每份 PDF 都登錄了，沒有整份漏收（會檢查題目圖片存在、每份考卷都登錄在 `data/exam-log.json`、每題的 `paper` 對得到考卷、同一份卷的題號不重複、不收的題號沒有同時被收錄）。

### 7.2 考古卷頁（`exams/`）

考古題除了依主題出現在主題頁和題庫頁，也可以**一份卷一頁**瀏覽，模擬真的寫一份考卷。

- **資料**：不另外存題目。`data/exam-log.json` 的每份考卷有：
  - `id`：`<學校縮寫>-<學年>-<卷別>`，例如 `ncu-115-software`。學校縮寫在 `scripts/exam/_common.py` 的 `SCHOOL_SLUG`（ntu、nycu、ncu、ncku），新學校先在那裡加縮寫；卷別用 `software`（資料結構＋演算法）、`hardware`（計算機組織＋作業系統）、`math`（離散數學＋線性代數）。用 `_common.paper_id()` 產生，不要手打。
  - `title`：卷頭的卷名（和題目的 `dept` 一致）。
  - 其餘欄位見第 7.1 節：`school`、`year`、`paper`、`url`、`subjects`、`skipped`。
  頁面把所有科目題庫中 `source.paper` 等於這個 id 的題目，加上 `skipped`，依卷上題號自然排序（2 < 10、1-(a) < 1-(b)、I-3 < II-1）組成一份卷。
- **總覽 `exams/index.html`**：每間學校一張表，列是學年度、欄是三種卷，格子是收錄題數與未收題數，連到單份考卷頁；可依學校、卷別篩選。
- **單份考卷 `exams/paper.html?id=<考卷 id>`**：
  - 卷頭：學校、學年度、卷名、卷別、收錄／未收題數、原卷 PDF 連結，以及這份卷考了哪些主題（依次數排序，先顯示 8 個；已完成的主題可以點過去）。
  - 題目卡片和題庫頁同一套，編號顯示卷上的「第 n 題」，附主題標籤；未收的題目放在原本的位置，灰色虛線框寫出原因，讓整份卷是完整的。
  - 工具：展開／收合全部答案、每題自評「答對／答錯」（存在瀏覽器 localStorage，`exam-grade:<考卷 id>`）、自評統計、清除自評、同校同卷別的前一年／後一年。
- **串接**：主題頁與題庫頁上考古題的來源標籤是連結，點了跳到那份考卷的那一題（`paper.html?id=…#q-<題目 id>`）；頁首有「考古題」；首頁有考古卷入口卡。
- 新增考卷時**不用新增 HTML**：登錄 `exam-log.json`、匯入題目後，總覽和考卷頁會自動出現。

---

## 8. 資料檔格式

### `data/subjects.json`

```json
{
  "subjects": [
    { "id": "data-structures", "en": "Data Structures", "zh": "資料結構", "icon": "tree",
      "color": 5, "status": "active", "desc": "一句話描述" }
  ]
}
```

- `status`：`"active"`（已開始，要有 `data/<id>.json` 和 `subjects/<id>/index.html`）或 `"planned"`。
- `color`：1～12（保留欄位，目前網站不依它上色，見第 10 節）。
- `icon`：`assets/icons.svg` 裡的 icon 名稱（不含 `i-`，第 10.1 節）。

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

- `no`：章節編號（可對應參考書章號），顯示為「Ch<編號>」。
- `status`：`"done"`（有頁面）或 `"planned"`（籌備中，灰色顯示）。
- `priority`：`"high"`（考研高頻，科目頁在主題名稱前顯示火焰 icon）、`"mid"`、`"low"`。製作順序優先做 high。
- `viz`：頁面有沒有互動元件，要和頁面一致（`check.py` 會檢查）。
- `done` 的主題必須有 `difficulty`（1～3）、`tags`（2～5 個）、`updated`；有參考書時要填 `book`（只給 AI 查閱，不顯示）。
- 章節與主題的順序 = 學習順序，也決定頁面底部「上一個／下一個主題」。

---

## 9. 圖與動畫的寫法（viz-core.js）

### 9.1 核心概念：動畫 = 一串 Frame

主題腳本 **只負責產生 frames（每一步的畫面快照）**；播放、暫停、上一步/下一步、速度、補間動畫、程式碼高亮，全部由 Player 處理。同一個 `id` 的元素在前後兩個 frame 之間會**自動平滑移動**，新出現的淡入、消失的淡出。

### 9.2 骨架

```js
(function () {
  const { Player, Recorder, ui, register, esc, iconHTML } = window.DSViz;

  register("my-viz", function (root) {
    const player = new Player(root, {
      title: "English 中文",
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
    demo[0].caption = iconHTML("play") + " 按播放看示範……";
    player.load(demo, { autoplay: false });
  });
})();
```

### 9.3 Frame 格式

```js
{
  nodes:    [{ id, label, x, y, shape: "circle" | "box", w, h, r, state, sub }],
  edges:    [{ from, to, state, directed: false, dashed: false }],   // dashed：虛線（例如 claim edge、可能但尚未發生的關係）
  pointers: [{ id, label, target: nodeId, dir: "up"|"down"|"left"|"right", state }],
  labels:   [{ id, x, y, text, cls: "title"|"strong"|"warn", anchor: "start"|"middle"|"end" }],
  caption:  "這一步在做什麼（可用 <b>、<code>）",
  line:     3 或 [3, 4]               // 右側要高亮的程式碼行（從 1 開始）
}
```

Player 的其他選項與方法：

| 用法 | 說明 |
|---|---|
| `new Player(root, { …, wide: true })` | 程式碼一律放在圖的下方，讓圖用滿整個寬度。適合很寬的時序圖、大表格 |
| `player.resize(width, height)` | 依資料量改變畫面（viewBox）大小，例如週期數變多時加寬；不要直接改 `player.svg` 的屬性 |
| `player.setCode(lines)` | 切換右側程式碼（例如換成另一種做法） |

### 9.4 狀態色（state）— 全站語意要一致

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

### 9.5 動畫規則

1. **使用者可以自己輸入**資料，並提供經典例子的快捷按鈕；輸入要驗證，錯誤時給中文提示。
2. 每個 frame 的 `caption` 都要說明「**為什麼**」，例：✅「isp[*] = 13 ≥ icp[+] = 12，先 pop」 ❌「pop」。
3. 每個 frame 都要標 `line`，讓程式碼和動畫同步（初始或總結畫面可以是 `null`）。行號**用內容找**：`const ln = (s) => CODE.findIndex((l) => l.includes(s)) + 1;`，再寫 `ln("return 1;")`；不要寫死數字，否則 `.c` 檔一改就對錯行。動畫右側的 `CODE` 陣列也要用程式從 `.c` 檔抽出來貼上，不要手打。
4. 一次操作約 3～40 步；畫面放不下時要提前擋住並說明（例如限制樹高、token 數）。
5. 使用者輸入的文字放進 caption 前要用 `esc()` 跳脫。
6. 初始畫面要先載入**一段示範操作**，用 `{ autoplay: false }`，讓使用者一按播放鍵就能播放；只有 1 步時按播放鍵會出現提示（Player 內建）。
7. 演算法有多種做法時，**預設用考研最常見的做法**，用 `ui.button` 做切換（見 BST 的「刪除用：左子樹最大」）。
8. 需要新的視覺元素時，**優先用既有的 nodes / edges / pointers / labels 組合**；真的不夠時，先向使用者說明要怎麼擴充 `viz-core.js`，同意後再改，並確認其他主題的動畫都還正常。

### 9.6 靜態圖（figure）

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

## 10. 視覺風格

- 調性：**乾淨、現代、有質感的教材**。白色卡片、柔和陰影、圓角。
- **全站用色統一**：所有卡片（首頁的科目與主題卡片、科目頁的章節卡片）、主題頁的標題色條、按鈕、callout 都只用品牌色 `--brand`（`--accent` 一律等於 `--brand`），**不依科目或章節換顏色**，否則不同層級的顏色會撞在一起、讀者也會以為顏色有意義。顏色只在動畫與靜態圖中代表狀態（第 9.4 節）。籌備中只用「籌備中」標籤和灰色 icon 區分，不改整張卡片的底色或透明度。
- 首頁 banner 在淺色模式是淡品牌色底＋深色字，深色模式是深墨底＋白字（`--banner-*` 變數在兩種模式各有一組）；外框只用很淡的 `--banner-border`（比底色深一點點），沒有裝飾圖。
- 顏色**只能**使用 `style.css` 最上方 `:root` 的變數，不在其他地方寫死色碼。
- **預設淺色**，頁首按鈕可切換深色：`theme.js` 在 `<html>` 設定 `data-theme="dark"`，深色配色寫在 `:root[data-theme="dark"]`，選擇存在 localStorage。
- 新元件一律用 CSS 變數上色，才會自動適用兩種模式；也要支援手機寬度（≥ 360px）：窄螢幕的樣式統一寫在 `style.css` 最後的 `@media (max-width: 600px)` 區塊（放在最後才能蓋過基本樣式），改完要用 360px 寬度截圖確認沒有橫向捲動。圖和動畫在窄螢幕會保留最小寬度、在自己的框裡左右滑動（`.viz-stage`），所以畫的時候字不要太小（label 至少 12px 等級），也要實際用 360px 截圖確認讀得清楚。題庫頁（`subjects/<id>/questions.html`）也要用 360px 檢查：考古題常有長式子、長表格、`<pre>`，題目卡片裡的 `<pre>` 和表格要能在自己的框裡捲動（表格包 `.table-scroll`）。
- 動畫要平滑、不炫技：顏色代表狀態（第 9.4 節），位置移動代表資料移動。
- **用語實用導向**：首頁、科目頁、題庫頁只放標題和功能，不寫宣傳性標語或「這裡可以做什麼」之類的說明文字。首頁只有 banner（站名、科目名稱、數字概況：已完成主題、練習題、考古題）、考古卷入口卡（考卷份數、題數、學校與學年度範圍，連到 `exams/index.html`）和科目卡片（不加「科目」小標，也不列已完成的主題），全部由 `site.js` 讀 JSON 產生，新增主題或題目後會自動更新。
- 科目頁的主題列表保持簡潔：已完成的主題是連結、籌備中的灰色並標「籌備中」，高頻主題名稱前有火焰 icon；不要再加其他標籤。

### 10.1 Icon

- **網站上不使用 emoji 或文字符號當 icon**（例如 💡 ❌ ✅ ▶ ★ ⚠），一律用 `assets/icons.svg` 的 SVG（`check.py` 會檢查）。內文中的箭頭「→」屬於文字，可以照用。
- HTML 裡的寫法（路徑依頁面深度調整）：

```html
<svg class="icon" aria-hidden="true"><use href="../../../assets/icons.svg#i-bulb"></use></svg>
```

- JS 裡：`site.js` 用 `icon("名稱")`，動畫腳本用 `DSViz.iconHTML("名稱")`（回傳 HTML 字串，可放進 caption）。
- 常用 icon 與用途：

| 名稱 | 用途 |
|---|---|
| `bulb` | callout：一句話記憶法、提示 |
| `bookmark` | callout：重要定義、性質 |
| `x-circle` / `check-circle` | 易錯點的錯誤想法 / 正確觀念、不合法的例子 |
| `flame` | 考研高頻 |
| `star` / `star-fill` | 難度（`<span class="chip" data-difficulty="2">難度</span>` 會自動畫星星） |
| `book` | 題庫 |
| `alert` | 警告、錯誤訊息 |
| `play` `pause` `first` `prev` `next` `last` | 播放器（Player 內建） |
| `tree` `compass` `cpu` `layers` `sigma` `matrix` | 科目 |

- 需要新 icon 時加進 `assets/icons.svg`：24×24、`fill="none"`、`stroke="currentColor"`、`stroke-width="2"`、圓角端點，風格和現有的一致，並更新上表。

---

## 11. AI 工作流程

### 新增一個主題（最常見）

1. 在 `data/<subject-id>.json` 找到主題（通常已是 `planned`，優先做 `priority: high`），可以先查參考書對應節次確認觀念，但頁面內容要自己寫、獨立完整。
   動手前先用 `grep -o '<h2>[^<]*' subjects/*/*/*.html` 看**所有科目**已完成的頁面有沒有講過同樣的內容（例如 Stack 頁已經有中序轉後序和後序求值；資料結構和演算法都有排序、圖論）。有重疊時先告訴使用者，改做別的主題，或在新頁只簡短帶過、連到既有的頁面，不要重寫一份。要提到還在籌備中的主題時，寫出名稱並標「（籌備中）」，不放連結。
2. 先在 `data/<subject-id>.json` 補好這個主題的 `difficulty`、`tags`、`updated`，再用產生器建立頁面，不要手動複製模板：
   `python scripts/new_topic.py <subject-id> <topic-id> --sub "一句話副標" --desc "≤ 70 字描述" [--body body.html]`
   名稱、章節、麵包屑、meta 列、頁首、頁尾都從 JSON 和模板自動產生；`--body` 是頁面主體（多個 `<section>`，可用 `{{X}}` `{{OK}}` `{{BULB}}` `{{MARK}}` 代表四種 icon），沒給就保留模板的範例段落讓你照著填。內容改了要重新產生時，再跑一次同樣的指令。
3. 先規劃講解的骨架（第 6.1 節），再決定哪些地方配靜態圖、哪些地方做動畫，寫在 `assets/js/viz/<subject-id>/<topic-id>.js`（第 9 節）。
4. 先寫好完整的 C 程式並實際編譯執行（第 6.3 節），再撰寫文字講解，把圖、動畫和程式碼片段放在對應的文字旁；片段和動畫右側程式碼都從完整程式取出；不提到參考書。
5. 在 `data/questions/<subject-id>.json` 新增這個主題的練習題（每個難度至少 2 題，答案用程式驗算），寫好考研重點的題型地圖和易錯點的例題連結（第 6.4 節）。
6. JSON 中把 `status` 改成 `"done"`，補上 `difficulty`、`tags`、`updated`，`viz` 依頁面實際情況填。
7. 執行 `python scripts/stamp.py` 更新 CSS / JS 版本號，再執行 `python scripts/check.py`，必須顯示 `All checks passed`。
8. 本機預覽：`python -m http.server 8000` → `http://localhost:8000`（直接雙擊 html 會讀不到 json）。
9. 截圖檢查每張圖有沒有文字重疊或超出畫面；有動畫時實際操作：正常輸入、經典例子、邊界情況（空、滿、重複、找不到）、非法輸入；亮暗兩種模式都看一次。
10. 回報：新增或修改了哪些檔案、動畫支援哪些操作、預設採用哪種做法、哪些地方標了「（待確認）」。

### 平行製作多個主題

使用者要求一次做多個主題、用子代理平行處理時：

1. 每個主題在**自己的 repo 複本**裡做（例如 `cp -r` 到 `/tmp/wt/<topic-id>`），各自用不同的本機預覽 port。
2. 子代理只新增自己的三個檔案（`code/`、`assets/js/viz/`、主題頁），並只改共用 JSON 裡**自己的**主題條目與題目；不 commit、不 push，也不改共用的 CSS、`viz-core.js`、`site.js`、`scripts/`、`templates/`、`CLAUDE.md`。真的需要改共用檔案時，在回報裡提出，由主流程決定。
3. 題號事先分配好（每科只會有一個子代理在加題目，就接著該科目前最大的題號）。
4. 全部完成後由主流程合併：複製三個新檔案、把每個主題的 JSON 條目與新題目合併進主 repo，再執行 `python scripts/header.py`、`python scripts/stamp.py`、`python scripts/check.py`，抽查截圖，最後一次 commit、push（push 前照第 7 節先 pull、確認題號沒撞）。
5. 子代理被中斷（例如用量上限）時，已完成的檔案都留在複本裡，之後讓同一個子代理接著做，不要重開一個從頭做。

### 匯入考古題

照第 7.1 節的標準，用 `scripts/exam/` 的工具：

1. **登錄考卷**：先列出考卷資料夾裡**實際有哪些檔案**，不要憑印象判斷某校某年有沒有卷。在 `data/exam-log.json` 新增這份考卷（id、school、year、paper、title、url、subjects、skipped；id 用 `_common.paper_id()` 產生，見第 7.2 節）。
2. **OCR**：`sh scripts/exam/ocr.sh <paper.pdf>`，頁面圖放在 repo 外的 `$EXAM_PAGES`（預設 `~/exams/img`），不要把整份掃描檔放進 repo。
3. **寫題目模組**：每份考卷 × 每科一個 Python 檔（放在 repo 外），格式：
   ```python
   SCHOOL = "國立中央大學"; DEPT = "資工類（資料結構與演算法）"
   def U(y): return f"https://…/ncu_{y}_software.pdf"
   Q = [dict(year=113, no=3, topics=["heap"], type="選擇", question="…", choices=["(A) …"], answer="(B)", explanation="<p>…</p>")]
   SKIP = [dict(year=113, no=10, reason="題目有錯：…")]
   ```
   有圖時用 `scripts/exam/qfig.py` 的 `crop()`、`img_html()`、`fig_html()`。
4. **檢查**：`python scripts/exam/validate.py <subject-id> <模組>`；有圖時再跑 `python scripts/exam/qpreview.py <模組> <輸出資料夾>`，看淺色、深色截圖。
5. **合併**：`python scripts/exam/import_exq.py <subject-id> <模組…>`。依（學校, 年, 題號）去重，題號自動接在題庫最大號後面，`SKIP` 會寫進 `data/exam-log.json`。已收的題目要修改時用 `sync_exq.py` 覆蓋，不要手改。
6. **push 前先 `git fetch`**：遠端題庫有變動（例如另一個 session 新增了題目）時，先以遠端版本為準，再重跑 `import_exq.py`，讓題號往後接，不要讓題號撞號。
7. **大量匯入**（很多份考卷）可以分給多個子代理平行處理：每個子代理只寫題目模組，不碰 repo；每做完一份考卷就存檔並跑 `validate.py`，避免中途被中斷時白做；由主代理統一合併、檢查、push。
8. 回報：匯入幾題、對應到哪些主題、不收的題目與原因、哪些題目標了「（待確認）」，並附上考古卷頁的連結（`exams/paper.html?id=…`）確認整份卷顯示正常。

### 開始一個新科目

1. 先問使用者有沒有參考書或教材，再在 `data/<subject-id>.json` 規劃章節與主題（全部 `planned`）。
2. `data/subjects.json` 中把該科 `status` 改成 `"active"`。
3. 複製 `templates/subject.html` → `subjects/<subject-id>/index.html`、`templates/questions.html` → `subjects/<subject-id>/questions.html`，取代 `{{...}}`；建立 `data/questions/<subject-id>.json`（科目縮寫自訂，例如演算法用 `al-`）。
4. 完成第一個主題後再 push。

### 修改既有內容

- **只改被要求的部分**（最小 diff），不要順手重寫整頁或其他主題。
- 改完更新頁尾日期與 JSON 的 `updated`。
- **共用檔的 bug 可以直接修**：`viz-core.js`、`site.js`、`style.css` 裡會影響多個頁面的錯誤（例如 `ui.int` 把空白輸入當成 0），不用先問就可以修。只改出錯的那幾行，在程式碼旁加註解說明原因；修完執行全站回歸：所有頁面（`index.html`、`exams/`、`subjects/` 底下全部）在桌機沒有 JS 錯誤、在 360px 寬度沒有橫向捲動，並在回報裡寫出改了什麼、影響哪些主題。新增功能或改變既有行為不算修 bug，仍照第 9.5 節第 8 點先問使用者。
- 主題從 `planned` 變成 `done` 時，用 `grep -rn "<主題名稱>（籌備中）" subjects/` 找出其他頁面提到它的地方，改成連結。

### 不准做的事

- ❌ 刪除科目、章節或主題（除非使用者明確要求）。
- ❌ 改動 JSON 欄位名稱、資料夾結構。
- ❌ 引入任何外部套件、框架、CDN。
- ❌ 在 HTML 頁面寫 `<style>` 或 inline style。
- ❌ 在頁面上提到課本、參考書或 § 節次。
- ❌ 照抄參考書原文或圖；編造考古題出處、年份或學校。

---

## 12. 完成的定義（Definition of Done）

- [ ] 檔案位置與命名符合第 5 節
- [ ] 文字講解完整（動機、定義、運作原理、例子、效能、應用），只讀這頁就能學會；獨立完整、不提到參考書
- [ ] 至少一張有圖說的靜態圖；適合的主題有互動動畫；圖文不重疊、不超出畫面
- [ ] 程式碼放在對應講解旁並預設收合、每段有標題、多種寫法用頁籤；`code/` 裡的完整程式已用 gcc 編譯執行，片段與動畫程式碼都從它取出
- [ ] 考研重點有題型地圖、易錯點都有例題連結；題庫中每個難度至少 2 題，答案已驗算
- [ ] 有動畫時：可以自己輸入資料、有示範、能逐步播放，程式碼高亮正確
- [ ] JSON 已更新，科目首頁的主題變成可點的連結，全站首頁進度有變化
- [ ] 沒有用 emoji 或文字符號當 icon，都用 `assets/icons.svg`
- [ ] `python scripts/check.py` 通過
- [ ] 手機寬度，以及淺色、深色兩種模式下都能正常閱讀

---

## 13. 給使用者的指令範例

> 請先讀 CLAUDE.md。幫我完成資料結構的「Circular Queue（環狀佇列）」，動畫要畫成一個環，看得到 front 和 rear 怎麼移動。

> 請先讀 CLAUDE.md。幫我做 Trees 章的「Heap（堆積）」，動畫要有 insert 和 delete-max。

> 請先讀 CLAUDE.md。這是台大 113 學年度資工所資料結構的考古題 PDF，幫我匯入題庫。

> 請先讀 CLAUDE.md。開始「Operating Systems（作業系統）」這科，參考書是恐龍書，先規劃章節，再完成 CPU Scheduling。
