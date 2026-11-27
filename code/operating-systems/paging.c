/* Paging and TLB（分頁與 TLB）完整程式
   編譯：gcc -std=c99 -Wall -Wextra -fsanitize=address,undefined paging.c */
#include <stdio.h>
#include <stdlib.h>

#define MAXPAGES 64
#define MAXTLB 8

typedef struct {
  int valid;        /* 1：這一頁有對應的 frame */
  int frame;        /* 放在第幾個 frame */
} PTE;

typedef struct {
  int valid;
  int page;         /* 虛擬頁號（查詢用的 key） */
  int frame;        /* 對應的 frame 號 */
  int lastUsed;     /* 最後一次使用的時間，LRU 用 */
} TLBEntry;

int pageSize;                 /* 一頁幾個 byte（2 的次方） */
int numPages;                 /* 邏輯位址空間有幾頁 */
PTE pageTable[MAXPAGES];      /* 單層頁表：第 p 格記錄第 p 頁在哪個 frame */
TLBEntry tlb[MAXTLB];
int tlbSize, now;             /* TLB 格數、存取次數（當作時間） */
int tlbHits, tlbMisses, memRefs;   /* 統計：TLB 命中、失誤、讀頁表的記憶體存取次數 */

/* 沒有 TLB 的位址轉換：每次都讀一次頁表 */
int translateBasic(int addr) {
  int p = addr / pageSize;           /* 頁號 = 位址 ÷ 頁大小 */
  int d = addr % pageSize;           /* offset = 位址 mod 頁大小 */
  if (p >= numPages || !pageTable[p].valid) return -1;   /* 超出範圍或 invalid：trap */
  return pageTable[p].frame * pageSize + d;
}

/* 全關聯 TLB：每一格都比對頁號（硬體是同時比對） */
int tlbLookup(int p) {
  now++;
  for (int i = 0; i < tlbSize; i++)
    if (tlb[i].valid && tlb[i].page == p) {
      tlb[i].lastUsed = now;         /* LRU：記下最後使用時間 */
      return tlb[i].frame;
    }
  return -1;                         /* TLB miss */
}

void tlbInsert(int p, int f) {
  int v = 0;                         /* 先找空格，沒有空格就換掉最久沒用的 */
  for (int i = 0; i < tlbSize; i++) {
    if (!tlb[i].valid) { v = i; break; }
    if (tlb[i].lastUsed < tlb[v].lastUsed) v = i;
  }
  tlb[v].valid = 1;
  tlb[v].page = p;
  tlb[v].frame = f;
  tlb[v].lastUsed = now;
}

void tlbFlush(void) {                /* context switch 且沒有 ASID 時：整個 TLB 作廢 */
  for (int i = 0; i < tlbSize; i++) tlb[i].valid = 0;
}

/* 單層頁表＋TLB 的位址轉換，回傳實體位址；-1 表示 trap */
int translate(int addr) {
  int p = addr / pageSize;           /* 頁號：位址的高位元 */
  int d = addr % pageSize;           /* offset：位址的低位元 */
  int f = tlbLookup(p);              /* 先查 TLB */
  if (f >= 0) {
    tlbHits++;
    return f * pageSize + d;         /* TLB 命中：不用讀頁表 */
  }
  tlbMisses++;
  memRefs++;                         /* TLB 失誤：到記憶體讀頁表 */
  if (!pageTable[p].valid) return -1;   /* invalid：trap 給作業系統 */
  f = pageTable[p].frame;
  tlbInsert(p, f);                   /* 放進 TLB，滿了換掉 LRU */
  return f * pageSize + d;           /* 實體位址 = frame 起點 + offset */
}

/* 兩層頁表：外層每一格指向一張內層表；整段沒用到的內層表不配置（NULL） */
#define INNER 2                      /* 每張內層表幾格（頁號的低位元） */
PTE *outer[MAXPAGES / INNER];

void buildTwoLevel(void) {
  for (int k = 0; k < numPages / INNER; k++) {
    int used = 0;
    for (int j = 0; j < INNER; j++) used |= pageTable[k * INNER + j].valid;
    outer[k] = NULL;
    if (!used) continue;             /* 這一段全部 invalid：不必配置內層表 */
    outer[k] = malloc(INNER * sizeof(PTE));
    for (int j = 0; j < INNER; j++) outer[k][j] = pageTable[k * INNER + j];
  }
}

void freeTwoLevel(void) {
  for (int k = 0; k < numPages / INNER; k++) free(outer[k]);
}

int translate2(int addr) {
  int p = addr / pageSize, d = addr % pageSize;
  int p1 = p / INNER;                /* 外層索引：頁號的高位元 */
  int p2 = p % INNER;                /* 內層索引：頁號的低位元 */
  int f = tlbLookup(p);              /* TLB 仍然用完整的頁號查 */
  if (f >= 0) {
    tlbHits++;
    return f * pageSize + d;
  }
  tlbMisses++;
  memRefs++;                         /* 第 1 次：讀外層頁表 */
  if (outer[p1] == NULL) return -1;  /* 內層表不存在：trap */
  memRefs++;                         /* 第 2 次：讀內層頁表 */
  if (!outer[p1][p2].valid) return -1;
  f = outer[p1][p2].frame;
  tlbInsert(p, f);
  return f * pageSize + d;
}

/* 有效存取時間：先查 TLB，失誤時再走 levels 層頁表，最後存取資料 */
double eat(double hit, double tlbTime, double memTime, int levels) {
  double hitTime = tlbTime + memTime;                       /* 查 TLB + 存取資料 */
  double missTime = tlbTime + levels * memTime + memTime;   /* 再加上走頁表 */
  return hit * hitTime + (1 - hit) * missTime;
}

/* 想讓 EAT 不超過 target，命中率至少要多少 */
double minHitRatio(double target, double tlbTime, double memTime, int levels) {
  double hitTime = tlbTime + memTime;
  double missTime = tlbTime + levels * memTime + memTime;
  return (missTime - target) / (missTime - hitTime);
}

int log2i(long long x) { int k = 0; while (x > 1) { x >>= 1; k++; } return k; }

/* 單層頁表要多大 */
void singleLevelSize(int vaBits, long long pageBytes, int pteBytes) {
  int offset = log2i(pageBytes);
  int vpn = vaBits - offset;                    /* 頁號位元數 */
  long long entries = 1LL << vpn;
  printf("%d 位元位址、頁 %lld B：offset %d 位元、頁號 %d 位元，頁表 2^%d 格 × %d B = %lld B\n",
         vaBits, pageBytes, offset, vpn, vpn, pteBytes, entries * pteBytes);
}

/* 多層頁表：每一張表剛好放進一頁，算出要幾層、各層幾個位元 */
void levelSplit(int vaBits, long long pageBytes, int pteBytes) {
  int offset = log2i(pageBytes);
  int perLevel = log2i(pageBytes / pteBytes);   /* 一頁放 2^perLevel 個 entry */
  int vpn = vaBits - offset;                    /* 要被各層頁表吃掉的位元 */
  int levels = (vpn + perLevel - 1) / perLevel; /* 無條件進位 */
  int top = vpn - (levels - 1) * perLevel;      /* 最上層只用剩下的位元 */
  printf("%d 位元位址、頁 %lld B、PTE %d B：offset %d、每層 %d 位元，頁號 %d 位元 → %d 層，最上層 %d 位元；"
         "TLB miss 要讀 %d 次頁表＋1 次資料\n",
         vaBits, pageBytes, pteBytes, offset, perLevel, vpn, levels, top, levels);
}

/* 反向頁表：全系統一張，每個 frame 一格 */
void invertedSize(int paBits, long long pageBytes, int entryBytes) {
  long long frames = (1LL << paBits) / pageBytes;
  printf("實體記憶體 2^%d B、頁 %lld B：%lld 個 frame，反向頁表 %lld B\n",
         paBits, pageBytes, frames, frames * entryBytes);
}

void setup(int ps, const int *frames, int n, int tsize) {
  pageSize = ps; numPages = n; tlbSize = tsize;
  now = tlbHits = tlbMisses = memRefs = 0;
  for (int i = 0; i < n; i++) {
    pageTable[i].valid = frames[i] >= 0;
    pageTable[i].frame = frames[i] >= 0 ? frames[i] : 0;
  }
  tlbFlush();
}

void runTrace(const char *name, int twoLevel, int ps, const int *frames, int n, int tsize,
              const int *trace, int len) {
  setup(ps, frames, n, tsize);
  if (twoLevel) buildTwoLevel();
  printf("%s（頁 %d B、TLB %d 格）：", name, ps, tsize);
  for (int k = 0; k < len; k++) {
    int hitsBefore = tlbHits;
    int pa = twoLevel ? translate2(trace[k]) : translate(trace[k]);
    if (pa < 0) printf("%d→trap ", trace[k]);
    else printf("%d→%d%s ", trace[k], pa, tlbHits > hitsBefore ? "(H)" : "(M)");
  }
  int valid = 0;                     /* 只統計成功轉換的存取（trap 的不算） */
  for (int k = 0; k < len; k++)
    if (pageTable[trace[k] / ps].valid) valid++;
  printf("\n  TLB 命中 %d / 失誤 %d，讀頁表 %d 次、讀資料 %d 次\n", tlbHits, tlbMisses, memRefs, valid);
  if (valid) {
    double h = (double)tlbHits / valid;
    printf("  命中率 %d / %d = %.3f，EAT（TLB 10 ns、記憶體 100 ns）= %.1f ns\n",
           tlbHits, valid, h, eat(h, 10, 100, twoLevel ? 2 : 1));
  }
  if (twoLevel) freeTwoLevel();
}

int main(void) {
  /* 動畫的預設例子：頁 16 B、8 頁、TLB 2 格 */
  int pt[] = {5, 2, -1, -1, 9, 0, 7, 3};
  int demo[] = {20, 24, 70, 28, 5, 30, 72, 40};
  runTrace("單層", 0, 16, pt, 8, 2, demo, 8);
  runTrace("兩層", 1, 16, pt, 8, 2, demo, 8);

  int loc[] = {0, 4, 8, 12, 16, 20, 24, 28};
  runTrace("局部性好", 0, 16, pt, 8, 2, loc, 8);
  int cyc[] = {5, 20, 70, 5, 20, 70};
  runTrace("循環 3 頁、TLB 2 格", 0, 16, pt, 8, 2, cyc, 6);
  runTrace("循環 3 頁、TLB 3 格", 0, 16, pt, 8, 3, cyc, 6);

  /* 講解用的例子：頁 1 KB、16 位元位址 */
  int pt2[64];
  for (int i = 0; i < 64; i++) pt2[i] = -1;
  pt2[0] = 7; pt2[1] = 3; pt2[2] = 12; pt2[5] = 9; pt2[14] = 5;
  setup(1024, pt2, 64, 4);
  int ex[] = {1000, 2100, 5500, 3000, 4000};
  for (int k = 0; k < 5; k++)
    printf("邏輯 %d：頁 %d、offset %d → %d\n", ex[k], ex[k] / 1024, ex[k] % 1024, translateBasic(ex[k]));
  printf("0x3A7F：頁 %d、offset 0x%X → 0x%X\n", 0x3A7F / 1024, 0x3A7F % 1024, (unsigned)translateBasic(0x3A7F));

  /* EAT */
  printf("EAT h=0.9  TLB 15 記憶體 85 單層 = %.2f\n", eat(0.9, 15, 85, 1));
  printf("EAT h=0.98 TLB 10 記憶體 100 單層 = %.2f、兩層 = %.2f、四層 = %.2f\n",
         eat(0.98, 10, 100, 1), eat(0.98, 10, 100, 2), eat(0.98, 10, 100, 4));
  double hs[] = {0.0, 0.5, 0.8, 0.9, 0.95, 0.99, 1.0};
  for (int i = 0; i < 7; i++)
    printf("  h=%.2f：單層 %.1f、兩層 %.1f\n", hs[i], eat(hs[i], 10, 100, 1), eat(hs[i], 10, 100, 2));
  printf("EAT < 140（TLB 20、記憶體 100、單層）：h > %.3f\n", minHitRatio(140, 20, 100, 1));
  printf("EAT <= 100（TLB 5、記憶體 80、兩層）：h >= %.5f\n", minHitRatio(100, 5, 80, 2));
  printf("沒有 TLB 時：單層 %.0f、兩層 %.0f\n", 2.0 * 100, 3.0 * 100);

  /* 頁表大小與層數 */
  singleLevelSize(32, 4096, 4);
  singleLevelSize(24, 4096, 1);
  singleLevelSize(48, 4096, 8);
  singleLevelSize(48, 16384, 8);
  levelSplit(32, 4096, 4);
  levelSplit(48, 4096, 8);
  levelSplit(48, 16384, 8);
  levelSplit(64, 8192, 8);
  levelSplit(64, 32768, 16);
  invertedSize(30, 4096, 8);
  invertedSize(32, 4096, 8);

  /* 兩層頁表在稀疏位址空間省多少：32 位元、10/10/12、只用最低 8 MB 與最高 4 MB */
  long long innerCover = 1LL << 22;              /* 一張內層表涵蓋 4 MB */
  long long inner = (8LL << 20) / innerCover + (4LL << 20) / innerCover;
  printf("稀疏：內層表 %lld 張＋外層 1 張 = %lld KB（單層要 4096 KB）\n", inner, (inner + 1) * 4);

  /* 內部碎片 */
  int proc = 10300, ps = 4096;
  int pages = (proc + ps - 1) / ps;
  printf("行程 %d B、頁 %d B：%d 頁，內部碎片 %d B\n", proc, ps, pages, pages * ps - proc);
  return 0;
}
