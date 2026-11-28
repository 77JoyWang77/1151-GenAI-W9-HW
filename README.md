# 資工考研互動學習站（CS Grad Exam Review）

資工所考研複習網站，目前在做 **Data Structures（資料結構）**、**Discrete Mathematics（離散數學）** 和 **Linear Algebra（線性代數）**。每個主題頁有完整的文字講解、靜態圖解、可以自己輸入資料逐步播放的動畫（旁邊的程式碼會亮起正在執行的那一行），以及考研重點、易錯點和分級練習題。

🔗 網站：https://77joywang77.github.io/1151-GenAI-W9-HW/

## 科目

| 科目 | 狀態 | 參考書（僅供 AI 查閱） |
|---|---|---|
| Data Structures（資料結構） | 進行中：10 章、54 個主題（高頻 27 個），已完成 12 個 | Horowitz《Fundamentals of Data Structures in C》 |
| Algorithms（演算法） | 進行中：13 章、36 個主題（高頻 19 個），已完成 3 個 | Cormen 等《Introduction to Algorithms》 |
| Computer Organization（計算機組織） | 進行中：6 章、27 個主題（高頻 13 個），已完成 6 個 | Patterson & Hennessy《Computer Organization and Design》 |
| Operating Systems（作業系統） | 進行中：12 章、27 個主題（高頻 12 個），已完成 4 個 | Silberschatz《Operating System Concepts》 |
| Discrete Mathematics（離散數學） | 進行中：12 章、38 個主題（高頻 18 個），已完成 3 個 | Rosen《Discrete Mathematics and Its Applications》 |
| Linear Algebra（線性代數） | 進行中：8 章、30 個主題（高頻 18 個），已完成 5 個 | Leon《Linear Algebra with Applications》 |

### 資料結構已完成的主題

| 主題 | 互動動畫 |
|---|---|
| Stack（堆疊） | push / pop / peek；中序轉後序（isp / icp 寫法） |
| Circular Queue（環狀佇列） | 佇列畫成一個環：enqueue / dequeue / 放到滿，可切換「犧牲一格／多記 count」 |
| Singly Linked List（單向鏈結串列） | insertSorted / insertFront / delete / search，看得到 prev、cur 怎麼移動、每條 link 怎麼改；reverse 用三個指標把箭頭逐一反過來 |
| Binary Tree Properties & Representation（二元樹性質與表示法） | 自己輸入陣列表示法，逐格放回樹上，數出 n0、n1、n2 與高度，判斷是不是完全二元樹 |
| Binary Tree Traversal（二元樹走訪與重建） | 自己輸入樹，播放前序 / 中序 / 後序 / 層序與 stack 版中序，看得到 stack、queue 內容 |
| Heap（堆積） | insert / delete-max / build heap（由下往上），樹和陣列同步移動 |
| Binary Search Tree（二元搜尋樹） | insert / search / delete（三種情況，可切換左子樹最大 / 右子樹最小）、中序走訪 |
| BFS & DFS（廣度與深度優先搜尋） | 自己輸入邊與起點，切換 BFS／DFS（遞迴、stack），看 queue／stack、visited、走訪順序與生成樹 |
| Minimum Cost Spanning Tree（最小成本生成樹） | 輸入帶權邊，切換 Kruskal／Prim，看邊被考慮、收下或因成環略過，顯示 union-find 集合或 cut 與 key |
| Hash Functions（雜湊函數） | 三個動畫：用 7 種雜湊函數（除法、乘法、平方取中、兩種折疊、兩種字串雜湊）逐步算位址；同一批 key 在兩種設定下的分布直方圖比較；Bloom filter 的插入、查詢與 false positive、為什麼不能刪除 |
| Collision Resolution（碰撞處理） | 輸入 key 逐步 insert / search / delete，切換 linear／quadratic（+i²、±i²）／double hashing／separate chaining，刪除可選 tombstone 或搬移補位，看探測序列與群聚 |
| Red-Black Tree（紅黑樹） | insert（叔叔紅變色、折線先旋轉、直線換色旋轉）與 delete（double black 四種 case，可切換用左子樹最大／右子樹最小取代），方形 = 黑、圓形 = 紅，NIL 以虛線框畫出 |

### 演算法已完成的主題

| 主題 | 互動動畫 |
|---|---|
| Longest Common Subsequence（最長共同子序列） | 自己輸入兩個字串，一格一格填 LCS 長度表，再從右下角照箭頭回溯找出 LCS；可切換平手往上／往左，比較不同的 LCS |
| Master Theorem（主定理） | 輸入 a、b、f(n) = n^k lg^p n，逐層畫遞迴樹與每層成本，判斷 case 並給出答案（含落在空隙的例子） |
| P, NP, and NP-Completeness（P、NP 與 NP 完備） | 輸入 CNF 公式與 certificate，對照逐子句驗證（多項式）和暴力枚舉指派（指數）的步數 |

### 離散數學已完成的主題

| 主題 | 互動動畫 |
|---|---|
| Euler and Hamilton Paths（Euler 與 Hamilton 路徑） | 自己輸入圖（可有重邊）：數奇點判斷、Hierholzer 找 Euler 路徑、回溯法找 Hamilton 迴路 |
| Propositional Logic（命題邏輯） | 輸入命題公式，逐列逐欄填真值表，判斷恆真／矛盾／可滿足；輸入第二式比較是否等價並標出反例 |
| Linear Recurrence Relations（線性遞迴關係） | 輸入係數、非齊次項與初始條件，逐步求特徵根、特解、通解與係數，並用表格比對前 8 項 |

### 線性代數已完成的主題

| 主題 | 互動動畫 |
|---|---|
| Gaussian Elimination（高斯消去法與列梯形） | 自己輸入增廣矩陣（可用分數），逐步列運算化成 RREF，判斷唯一解／無限多解／無解並寫出通解 |
| Elementary Matrices and Inverses（基本矩陣與反矩陣） | 輸入 2×2～4×4 矩陣（可用分數），對 [A \| I] 逐步列運算並畫出對應的基本矩陣，得到 A⁻¹ 或判定不可逆 |
| Determinants and Their Properties（行列式與其性質） | 輸入 2×2～5×5 矩陣（可用分數），逐步化上三角追蹤正負號與交換次數（可切換 pivot 選法）；也可自己寫列運算序列，看每一步讓 det 乘上多少 |
| Eigenvalues and Eigenvectors（特徵值與特徵向量） | 輸入 2×2／3×3 矩陣（可用分數），逐步展開特徵多項式、求有理根、化簡 A − λI 求特徵空間並驗算 |
| Diagonalization（對角化） | 輸入 2×2／3×3 矩陣（可用分數），逐步求特徵值與各特徵空間維度、判斷能否對角化、組出 P 與 D 並驗算 AP = PD，再算 Aᵏ = PDᵏP⁻¹ 並看 k → ∞ 的行為 |

### 計算機組織已完成的主題

| 主題 | 互動動畫 |
|---|---|
| CPU Time and CPI（CPU 時間與 CPI） | 輸入各類指令的 CPI、比例、指令數與時脈，逐步算出平均 CPI、CPU 時間與 MIPS；比較兩部機器（含 MIPS 陷阱），以及只改良一類指令的加速與上限 |
| MIPS Instruction Formats（MIPS 指令格式） | 輸入一條組語指令或 32 位元十六進位碼，逐欄位組譯／解碼成 R、I、J 格式，示範符號／零延伸，並算出 branch 與 jump 的目標位址（含超出範圍時的改寫提示） |
| Cache Organization and Mapping（快取組織與映射） | 自己輸入位址序列、區塊數與區塊大小，切換直接映射／2-way／全關聯，逐步看每個位址落在哪個 set、命中或失誤、LRU 換掉誰 |
| Pipelining（管線化） | 輸入 2～6 行 MIPS 指令，逐個時脈畫管線時序圖，切換有／無 forwarding，算出總週期、stall 數與 CPI |
| Data Hazards and Forwarding（資料危障與轉送） | 輸入 2～7 行 MIPS 指令，逐週期看各階段的指令、forwarding unit 比對 rd 算出 ForwardA/B、hazard detection unit 何時插 bubble；另一個動畫逐步重排指令避開 load-use stall |
| Cache Performance（快取效能） | 輸入 CPI、存取比例、miss rate、penalty（可加 L2），逐步展開 AMAT 與 CPI，長條圖比較各部分停頓 |

### 作業系統已完成的主題

| 主題 | 互動動畫 |
|---|---|
| Threads（執行緒與多執行緒模型） | 選擇 many-to-one／one-to-one／many-to-many／two-level，設定 user thread、LWP、CPU 數，看某個 thread 做 blocking system call 時哪些 thread 會跟著卡住、同時有幾個在跑 |
| CPU Scheduling Algorithms（CPU 排程演算法） | 自己輸入行程（到達、burst、優先權），切換 FCFS／SJF／SRTF／Priority／RR，逐步看 ready queue 與甘特圖，算出平均等待、周轉、回應時間 |
| Deadlock Avoidance and Banker's Algorithm（死結避免與銀行家演算法） | 編輯 Available／Max／Allocation，逐步跑安全演算法找安全序列；輸入請求先檢查再試算安全性 |
| Paging and TLB（分頁與 TLB） | 設定頁大小、頁表、TLB 大小，逐個位址切 p/d、查 TLB、查頁表（單層／兩層），算出 TLB 命中率與 EAT |

## 這個專案的重點：CLAUDE.md

整個網站是 AI 依照 [`CLAUDE.md`](./CLAUDE.md) 的規則做出來的。這份文件規定了：

- 科目 → 章節 → 主題的結構、資料夾與命名、JSON 登錄格式
- **參考書只給 AI 查閱**：頁面內容獨立完整，不在網站上提到課本
- 主題頁依主題安排內容，提供常用段落元件；互動只在有助理解時使用
- **共用動畫播放器的使用方式**：Frame 格式、狀態色的意義、動畫規則
- **題庫**：原創練習題（基礎／進階／考研級）與考古題存在 `data/questions/`，主題頁自動列出，科目另有可篩選的題庫頁；匯入考古題有固定流程
- **考古卷**：`exams/` 依學校、學年度、卷別列出所有考古卷，一份卷一頁（題目依卷上順序、未收的題目寫出原因、每題可自評答對答錯）；資料直接由題庫和 `data/exam-log.json` 組成，新增考卷不用新增頁面
- **程式碼規則**：片段放在對應講解旁並預設收合、每段有標題、多種寫法用頁籤；完整程式存在 `code/`（不顯示在網站上）並實際用 gcc 編譯執行，頁面片段與動畫程式碼都從它取出
- 新增主題、開始新科目的 SOP，以及禁止事項、完成的定義

新增主題只要對 AI 說：

> 請先讀 CLAUDE.md。幫我完成資料結構的「Circular Queue（環狀佇列）」。

## 本機預覽

```bash
python -m http.server 8000      # 開啟 http://localhost:8000
python scripts/check.py         # 檢查所有科目與主題是否符合 CLAUDE.md
gcc -std=c99 -Wall -Wextra code/data-structures/stack.c -o stack && ./stack   # 編譯執行範例程式
```
