# 資工考研互動學習站（CS Grad Exam Review）

資工所考研複習網站，目前在做 **Data Structures（資料結構）**。每個主題頁有完整的文字講解、靜態圖解、可以自己輸入資料逐步播放的動畫（旁邊的程式碼會亮起正在執行的那一行），以及考研重點、易錯點和分級練習題。

🔗 網站：https://77joywang77.github.io/1151-GenAI-W9-HW/

## 科目

| 科目 | 狀態 | 參考書（僅供 AI 查閱） |
|---|---|---|
| Data Structures（資料結構） | 進行中：10 章、54 個主題（高頻 27 個），已完成 5 個 | Horowitz《Fundamentals of Data Structures in C》 |
| Algorithms（演算法） | 籌備中 | |
| Computer Organization（計算機組織） | 籌備中 | |
| Operating Systems（作業系統） | 籌備中 | |
| Discrete Mathematics（離散數學） | 籌備中 | |
| Linear Algebra（線性代數） | 籌備中 | |

### 資料結構已完成的主題

| 主題 | 互動動畫 |
|---|---|
| Stack（堆疊） | push / pop / peek；中序轉後序（isp / icp 寫法） |
| Circular Queue（環狀佇列） | 佇列畫成一個環：enqueue / dequeue / 放到滿，可切換「犧牲一格／多記 count」 |
| Binary Tree Traversal（二元樹走訪與重建） | 自己輸入樹，播放前序 / 中序 / 後序 / 層序與 stack 版中序，看得到 stack、queue 內容 |
| Heap（堆積） | insert / delete-max / build heap（由下往上），樹和陣列同步移動 |
| Binary Search Tree（二元搜尋樹） | insert / search / delete（三種情況，可切換左子樹最大 / 右子樹最小）、中序走訪 |

## 這個專案的重點：CLAUDE.md

整個網站是 AI 依照 [`CLAUDE.md`](./CLAUDE.md) 的規則做出來的。這份文件規定了：

- 科目 → 章節 → 主題的結構、資料夾與命名、JSON 登錄格式
- **參考書只給 AI 查閱**：頁面內容獨立完整，不在網站上提到課本
- 主題頁依主題安排內容，提供常用段落元件；互動只在有助理解時使用
- **共用動畫播放器的使用方式**：Frame 格式、狀態色的意義、動畫規則
- **題庫**：原創練習題（基礎／進階／考研級）與考古題存在 `data/questions/`，主題頁自動列出，科目另有可篩選的題庫頁；匯入考古題有固定流程
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
