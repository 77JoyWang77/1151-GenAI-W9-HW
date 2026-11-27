/* Cache Performance（快取效能）完整程式
   編譯：gcc -std=c99 -Wall -Wextra -fsanitize=address,undefined cache-performance.c
   內容：AMAT、含記憶體停頓的 CPI、多層快取、時脈加倍、寫入策略、記憶體組織，
         以及一個小的快取模擬器：實測 miss rate 後帶入公式。 */
#include <stdio.h>

/* ---------- 1. AMAT ---------- */
/* 平均記憶體存取時間：每次存取都要付 hit time，miss 時再多付 miss penalty */
double amat(double hitTime, double missRate, double missPenalty) {
  return hitTime + missRate * missPenalty;
}

/* 兩層快取：L1 的 miss penalty 就是「L2 的 AMAT」 */
double amat2(double h1, double m1, double h2, double m2Local, double memPenalty) {
  double l1Penalty = h2 + m2Local * memPenalty;   /* 先付 L2 hit time，L2 也 miss 才到主記憶體 */
  return h1 + m1 * l1Penalty;
}

/* ---------- 2. 含記憶體停頓的 CPI ---------- */
typedef struct {
  double baseCPI;      /* 沒有任何 miss 時的 CPI（hit time 已經算在管線裡） */
  double instrRefs;    /* 每條指令取指令的次數，通常是 1 */
  double dataRefs;     /* 每條指令的資料存取次數 = load/store 佔的比例 */
  double iMiss, dMiss; /* I-cache、D-cache 的 miss rate */
  double memPenalty;   /* 到主記憶體的 miss penalty（cycle） */
  int hasL2;           /* 有沒有 L2 */
  double l2Hit;        /* L2 hit time（cycle） */
  double l2LocalMiss;  /* L2 的 local miss rate */
} Config;

typedef struct { double penalty, iStall, dStall, cpi; } Breakdown;

Breakdown breakdown(Config c) {
  Breakdown b;
  b.penalty = c.memPenalty;                          /* L1 miss 要付的代價 */
  if (c.hasL2)                                       /* 有 L2：先問 L2，L2 也 miss 才去主記憶體 */
    b.penalty = c.l2Hit + c.l2LocalMiss * c.memPenalty;
  b.iStall = c.instrRefs * c.iMiss * b.penalty;      /* 取指令造成的停頓 */
  b.dStall = c.dataRefs * c.dMiss * b.penalty;       /* load/store 造成的停頓 */
  b.cpi = c.baseCPI + b.iStall + b.dStall;           /* 實際 CPI */
  return b;
}

void printBreakdown(const char *name, Config c) {
  Breakdown b = breakdown(c);
  double stall = b.iStall + b.dStall;
  printf("%s：L1 miss penalty %.2f，I 停頓 %.3f，D 停頓 %.3f，CPI %.3f（停頓佔 %.1f%%）\n",
         name, b.penalty, b.iStall, b.dStall, b.cpi, 100.0 * stall / b.cpi);
}

/* ---------- 3. 時脈變快、記憶體時間不變 ---------- */
/* 時脈變成 k 倍：以 ns 計的記憶體時間不變，換算成 cycle 就變 k 倍 */
double clockSpeedup(Config c, double k) {
  Config f = c;
  f.memPenalty = c.memPenalty * k;
  f.l2Hit = c.l2Hit * k;
  double oldTime = breakdown(c).cpi * 1.0;          /* 每條指令的時間 = CPI × cycle time */
  double newTime = breakdown(f).cpi * (1.0 / k);    /* cycle time 變成 1/k */
  return oldTime / newTime;
}

/* ---------- 4. 寫入策略 ---------- */
/* write-back：被換掉的區塊有 dirty 比例要先寫回，平均每次 miss 多付 dirty × penalty */
double writeBackPenalty(double penalty, double dirtyFrac) {
  return penalty * (1 + dirtyFrac);
}

/* write-through、沒有 write buffer、no-write-allocate：
   讀取照常 hit / miss；每次寫入都要等主記憶體 */
double amatWriteThrough(double readFrac, double readHit, double cacheTime, double memTime) {
  double readTime = readHit * cacheTime + (1 - readHit) * memTime;   /* miss 只算主記憶體時間 */
  return readFrac * readTime + (1 - readFrac) * memTime;
}

/* ---------- 5. miss penalty 的組成：記憶體組織 ---------- */
/* 送位址 addr cycle；每次 DRAM 存取 access cycle；匯流排每傳一次 xfer cycle。
   busWords：匯流排與記憶體一次傳幾個 word；banks：幾個 bank 交錯（interleaving） */
int missPenalty(int addr, int access, int xfer, int blockWords, int busWords, int banks) {
  int transfers = blockWords / busWords;                 /* 匯流排要傳幾次 */
  int rounds = (transfers + banks - 1) / banks;          /* 各 bank 同時存取，要存取幾輪 */
  return addr + rounds * access + transfers * xfer;
}

/* ---------- 6. 小快取模擬器：實測 miss rate ---------- */
#define MAXSETS 256
#define MAXWAYS 64

typedef struct { int valid; long tag; long lastUsed; } Line;
Line cache[MAXSETS][MAXWAYS];
int sets, ways, blockBytes;
long now, hits, misses;

void cacheInit(int cacheBytes, int bBytes, int assoc) {
  blockBytes = bBytes;
  ways = assoc;
  sets = cacheBytes / bBytes / assoc;
  now = hits = misses = 0;
  for (int s = 0; s < sets; s++)
    for (int w = 0; w < ways; w++) cache[s][w].valid = 0;
}

void cacheAccess(long addr) {          /* byte 位址，LRU 替換 */
  long block = addr / blockBytes;
  int set = (int)(block % sets);
  long tag = block / sets;
  now++;
  for (int w = 0; w < ways; w++)
    if (cache[set][w].valid && cache[set][w].tag == tag) {
      cache[set][w].lastUsed = now;
      hits++;
      return;
    }
  misses++;
  int v = 0;
  for (int w = 0; w < ways; w++) {
    if (!cache[set][w].valid) { v = w; break; }
    if (cache[set][w].lastUsed < cache[set][v].lastUsed) v = w;
  }
  cache[set][v].valid = 1;
  cache[set][v].tag = tag;
  cache[set][v].lastUsed = now;
}

/* 走訪 n×n 的 int 陣列（從位址 0 開始、row-major 存放），回傳 miss rate */
double traverse(int n, int byRow) {
  for (int i = 0; i < n; i++)
    for (int j = 0; j < n; j++) {
      int r = byRow ? i : j, c = byRow ? j : i;      /* byRow = 0：一行一行往下走 */
      cacheAccess((long)(r * n + c) * 4);
    }
  return (double)misses / (hits + misses);
}

double measure(int cacheBytes, int bBytes, int assoc, int n, int byRow) {
  cacheInit(cacheBytes, bBytes, assoc);
  return traverse(n, byRow);
}

int main(void) {
  printf("== AMAT ==\n");
  printf("L1：1 + 5%% x 80 = %.2f cycles\n", amat(1, 0.05, 80));
  printf("加 L2：1 + 5%% x (10 + 20%% x 80) = %.2f cycles\n", amat2(1, 0.05, 10, 0.20, 80));
  printf("2 GHz 換算成 ns：%.2f ns\n", amat(1, 0.05, 80) * 0.5);

  printf("\n== CPI ==\n");
  Config base = { 1.5, 1, 0.30, 0.01, 0.05, 80, 0, 0, 0 };
  printBreakdown("典型設定", base);
  Config withL2 = base; withL2.hasL2 = 1; withL2.l2Hit = 10; withL2.l2LocalMiss = 0.20;
  printBreakdown("加上 L2", withL2);
  printf("加 L2 的加速：%.3f\n", breakdown(base).cpi / breakdown(withL2).cpi);
  printf("完美快取的加速：%.3f\n", breakdown(base).cpi / base.baseCPI);
  Config fast = base; fast.memPenalty = 160;
  printBreakdown("時脈加倍（penalty 160）", fast);
  printf("時脈加倍的加速：%.3f\n", clockSpeedup(base, 2));
  printf("加 L2 後時脈加倍的加速：%.3f\n", clockSpeedup(withL2, 2));
  printf("L1 miss 後在 L2 也 miss：global miss rate I = %.4f, D = %.4f\n", 0.01 * 0.20, 0.05 * 0.20);

  printf("\n== 寫入策略 ==\n");
  printf("write-back，dirty 30%%：每次 miss 平均 %.1f cycles\n", writeBackPenalty(80, 0.30));
  Breakdown wb = breakdown(base);                   /* I-cache 不會被寫，不會有 dirty 區塊 */
  wb.dStall = base.dataRefs * base.dMiss * writeBackPenalty(80, 0.30);
  printf("write-back（dirty 30%%）：D 停頓 %.3f，CPI %.3f\n", wb.dStall, base.baseCPI + wb.iStall + wb.dStall);
  printf("write-through 沒有 write buffer，store 10%% 每次等 80 cycles：每條指令多 %.1f cycles\n", 0.10 * 80);
  printf("write-through AMAT（讀 70%%、讀 hit 95%%、C = 1 ns、M = 50 ns）：%.3f ns\n", amatWriteThrough(0.70, 0.95, 1, 50));
  printf("  只看讀取：%.3f ns；寫入佔 %.3f ns\n", 0.70 * (0.95 * 1 + 0.05 * 50), 0.30 * 50.0);

  printf("\n== 記憶體組織（送位址 1、DRAM 存取 12、傳送 1，區塊 4 words）==\n");
  int narrow = missPenalty(1, 12, 1, 4, 1, 1);
  int wide = missPenalty(1, 12, 1, 4, 4, 1);
  int inter = missPenalty(1, 12, 1, 4, 1, 4);
  printf("一次 1 word：%d cycles，頻寬 %.2f B/cycle\n", narrow, 16.0 / narrow);
  printf("4-word 寬：%d cycles，頻寬 %.2f B/cycle\n", wide, 16.0 / wide);
  printf("4 bank 交錯：%d cycles，頻寬 %.2f B/cycle\n", inter, 16.0 / inter);
  Config mem = base;
  mem.memPenalty = narrow; printBreakdown("penalty = 一次 1 word", mem);
  mem.memPenalty = inter;  printBreakdown("penalty = 4 bank 交錯", mem);
  printf("（練習題）區塊 8 words、存取 10：1 word %d，2-word 寬 %d，8 bank %d\n",
         missPenalty(1, 10, 1, 8, 1, 1), missPenalty(1, 10, 1, 8, 2, 1), missPenalty(1, 10, 1, 8, 1, 8));

  printf("\n== 模擬器實測：int a[64][64]，1 KiB 直接映射、區塊 16 B ==\n");
  double mRow = measure(1024, 16, 1, 64, 1);
  double mCol = measure(1024, 16, 1, 64, 0);
  printf("一列一列走：miss rate %.4f；一行一行走：miss rate %.4f\n", mRow, mCol);
  Config loop = { 1.0, 1, 0.25, 0, 0, 40, 0, 0, 0 };
  loop.dMiss = mRow; printBreakdown("一列一列", loop);
  loop.dMiss = mCol; printBreakdown("一行一行", loop);
  printf("AMAT（hit 1、penalty 40）：%.2f vs %.2f cycles\n", amat(1, mRow, 40), amat(1, mCol, 40));
  printf("改成 2-way 再一行一行走：%.4f；4-way：%.4f；全關聯：%.4f\n", measure(1024, 16, 2, 64, 0),
         measure(1024, 16, 4, 64, 0), measure(1024, 16, 64, 64, 0));

  printf("\n== 練習題驗算：1 KiB 直接映射、區塊 32 B ==\n");
  printf("N = 16：列 %.4f，行 %.4f\n", measure(1024, 32, 1, 16, 1), measure(1024, 32, 1, 16, 0));
  printf("N = 32：列 %.4f，行 %.4f\n", measure(1024, 32, 1, 32, 1), measure(1024, 32, 1, 32, 0));
  Config q = { 1.0, 1, 0.25, 0, 0, 50, 0, 0, 0 };
  q.dMiss = measure(1024, 32, 1, 32, 1); printBreakdown("N=32 列", q);
  q.dMiss = measure(1024, 32, 1, 32, 0); printBreakdown("N=32 行", q);

  printf("\n== 練習題驗算 ==\n");
  printf("AMAT 2 + 4%% x 50 = %.2f\n", amat(2, 0.04, 50));
  Config a1 = { 1.2, 1, 0.25, 0.02, 0.06, 60, 0, 0, 0 };
  printBreakdown("進階 CPI", a1);
  printf("完美快取加速 %.3f\n", breakdown(a1).cpi / 1.2);
  printf("兩層 AMAT：%.3f（L1 6%%、L2 local 25%%、global %.3f）\n", amat2(1, 0.06, 12, 0.25, 150), 15.0 / 1000);
  Config e1 = { 1.0, 1, 0.40, 0.02, 0.05, 120, 0, 0, 0 };
  printBreakdown("2 GHz", e1);
  Config e2 = e1; e2.memPenalty = 240;
  printBreakdown("4 GHz", e2);
  printf("4 GHz / 2 GHz 加速 %.4f\n", clockSpeedup(e1, 2));
  Config e3 = e2; e3.hasL2 = 1; e3.l2Hit = 20; e3.l2LocalMiss = 0.25;
  printBreakdown("4 GHz + L2", e3);
  printf("每條指令時間：2 GHz %.3f ns，4 GHz %.3f ns，4 GHz + L2 %.3f ns\n",
         breakdown(e1).cpi * 0.5, breakdown(e2).cpi * 0.25, breakdown(e3).cpi * 0.25);
  Config w1 = { 0, 1, 0.30, 0, 0.04, writeBackPenalty(100, 0.40), 0, 0, 0 };
  printf("write-back 停頓 %.3f\n", breakdown(w1).dStall);
  printf("write-through 無 buffer：讀 %.3f + 寫 %.3f = %.3f\n", 0.20 * 0.04 * 100, 0.10 * 50.0, 0.20 * 0.04 * 100 + 0.10 * 50.0);
  return 0;
}
