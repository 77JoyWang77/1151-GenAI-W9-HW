/* Cache Organization and Mapping（快取組織與映射）完整程式
   編譯：gcc -std=c99 -Wall -Wextra -fsanitize=address,undefined cache-mapping.c */
#include <stdio.h>

#define MAXSETS 64
#define MAXWAYS 8

typedef struct {
  int valid;        /* 1：這一格存著資料 */
  int tag;          /* 用來確認存的是哪一個區塊 */
  int lastUsed;     /* 最後一次被存取的時間，LRU 用 */
} Line;

Line cache[MAXSETS][MAXWAYS];
int sets, ways, blockWords;   /* 幾個 set、每個 set 幾格、一個區塊幾個 word */
int now;                      /* 存取次數，當作時間 */

void init(int numBlocks, int assoc, int bw) {
  ways = assoc;
  sets = numBlocks / assoc;     /* 直接映射：assoc = 1；全關聯：assoc = numBlocks */
  blockWords = bw;
  now = 0;
  for (int s = 0; s < sets; s++)
    for (int w = 0; w < ways; w++) cache[s][w].valid = 0;
}

/* 存取一個 word 位址，回傳 1 表示命中、0 表示失誤 */
int access(int addr) {
  int block = addr / blockWords;   /* 屬於第幾個記憶體區塊 */
  int set = block % sets;          /* 只能放進這一個 set */
  int tag = block / sets;          /* 剩下的高位元當 tag */
  now++;
  for (int w = 0; w < ways; w++)   /* 同一個 set 裡的每一格都要比對 tag */
    if (cache[set][w].valid && cache[set][w].tag == tag) {
      cache[set][w].lastUsed = now;
      return 1;                    /* 命中 */
    }
  int victim = 0;                  /* 失誤：先找空格，沒有空格就換掉最久沒用的 */
  for (int w = 0; w < ways; w++) {
    if (!cache[set][w].valid) { victim = w; break; }
    if (cache[set][w].lastUsed < cache[set][victim].lastUsed) victim = w;
  }
  cache[set][victim].valid = 1;
  cache[set][victim].tag = tag;
  cache[set][victim].lastUsed = now;
  return 0;
}

/* 位元組位址切成 tag / index / offset，並算出整個快取需要的總位元數 */
int log2i(long x) { int k = 0; while (x > 1) { x >>= 1; k++; } return k; }

void addressFields(long cacheBytes, long blockBytes, int assoc, int addrBits) {
  long numBlocks = cacheBytes / blockBytes;
  long numSets = numBlocks / assoc;
  int offset = log2i(blockBytes);
  int index = log2i(numSets);
  int tag = addrBits - index - offset;
  long total = numBlocks * (blockBytes * 8 + tag + 1);   /* 每格：資料 + tag + valid */
  printf("快取 %ld B、區塊 %ld B、%d-way：%ld 個 set\n", cacheBytes, blockBytes, assoc, numSets);
  printf("  tag %d 位元、index %d 位元、offset %d 位元；總共 %ld 位元（資料 %ld 位元，額外 %.1f%%）\n",
         tag, index, offset, total, cacheBytes * 8, 100.0 * (total - cacheBytes * 8) / (cacheBytes * 8));
}

void runTrace(const char *name, int numBlocks, int assoc, int bw, const int *trace, int len) {
  init(numBlocks, assoc, bw);
  int hits = 0;
  printf("%s（%d 個區塊、%d-way、區塊 %d word）：", name, numBlocks, assoc, bw);
  for (int k = 0; k < len; k++) {
    int h = access(trace[k]);
    hits += h;
    printf("%d%s ", trace[k], h ? "H" : "M");
  }
  printf(" → 命中 %d / %d\n", hits, len);
}

int main(void) {
  int t1[] = {3, 11, 3, 19, 4, 11, 20, 3};
  int n1 = sizeof t1 / sizeof t1[0];
  runTrace("直接映射", 8, 1, 1, t1, n1);
  runTrace("2-way", 8, 2, 1, t1, n1);
  runTrace("全關聯", 8, 8, 1, t1, n1);

  int t2[] = {1, 5, 9, 1, 5, 9, 2, 6};
  int n2 = sizeof t2 / sizeof t2[0];
  runTrace("直接映射", 4, 1, 1, t2, n2);
  runTrace("2-way", 4, 2, 1, t2, n2);
  runTrace("全關聯", 4, 4, 1, t2, n2);

  int t3[] = {0, 1, 2, 3, 4, 5, 6, 7, 0, 1};
  int n3 = sizeof t3 / sizeof t3[0];
  runTrace("直接映射", 4, 1, 1, t3, n3);
  runTrace("直接映射", 2, 1, 2, t3, n3);

  int t4[] = {2, 10, 2, 6, 10, 14, 2, 18};
  int n4 = sizeof t4 / sizeof t4[0];
  runTrace("直接映射", 4, 1, 1, t4, n4);
  runTrace("2-way", 4, 2, 1, t4, n4);

  int t5[] = {0, 2, 4, 0, 2, 4, 0, 2, 4};
  int n5 = sizeof t5 / sizeof t5[0];
  runTrace("直接映射", 4, 1, 1, t5, n5);
  runTrace("2-way", 4, 2, 1, t5, n5);

  int t6[] = {0, 1, 2, 3, 8, 9, 0, 16, 1, 17};
  int n6 = sizeof t6 / sizeof t6[0];
  runTrace("直接映射", 8, 1, 2, t6, n6);
  runTrace("全關聯", 8, 8, 2, t6, n6);

  addressFields(16 * 1024, 16, 1, 32);
  addressFields(16 * 1024, 16, 4, 32);
  addressFields(32 * 1024, 64, 2, 32);
  addressFields(4 * 1024, 4, 1, 32);
  addressFields(64 * 1024, 32, 4, 32);
  return 0;
}
