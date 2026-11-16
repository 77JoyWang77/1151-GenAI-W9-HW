# DS 考研互動學習站（Data Structures）

資工所考研的資料結構學習網站。每個主題都有**可以自己輸入資料、逐步播放的動畫**，程式碼會跟著高亮目前執行的那一行。另外搭配複雜度表、考研重點、易錯點和自我測驗。

🔗 網站：https://77joywang77.github.io/1151-GenAI-W9-HW/

## 目前內容

| 章節 | 主題 | 互動動畫 |
|---|---|---|
| Stack & Queue（堆疊與佇列） | Stack（堆疊） | push / pop / peek、Infix → Postfix 逐步轉換 |
| Tree（樹） | Binary Search Tree（二元搜尋樹） | insert / search / delete（三種情況）、中序走訪 |

其餘 9 章、十多個主題已規劃在 `data/syllabus.json`，首頁會顯示為「籌備中」。

## 這個專案的重點：CLAUDE.md

整個網站是 AI 依照 [`CLAUDE.md`](./CLAUDE.md) 的規則做出來的。這份文件規定了：

- 專案目的、讀者、語言格式（專有名詞寫成「English（中文）」）
- 技術限制：純靜態網頁、不用框架，可以直接部署到 GitHub Pages
- 資料夾結構與命名、`syllabus.json` 登錄格式
- 主題頁固定的 7 個段落與各段的內容規則
- **共用動畫播放器的使用方式**：Frame 格式、狀態色的意義、動畫規則
- 新增主題的 SOP、使用者提供 PPT 時怎麼處理、禁止事項、完成的定義

新增主題只要對 AI 說：

> 請先讀 CLAUDE.md。幫我完成 Stack & Queue 章的「Circular Queue（環狀佇列）」。

## 本機預覽

```bash
python -m http.server 8000      # 開啟 http://localhost:8000
python scripts/check.py         # 檢查所有主題是否符合 CLAUDE.md
```
