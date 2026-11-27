/* Collision Resolution（碰撞處理）：chaining 與 open addressing（linear / quadratic / double hashing）
   編譯：gcc -std=c99 -Wall -Wextra -fsanitize=address,undefined collision-resolution.c */
#include <stdio.h>
#include <stdlib.h>

#define MAXM 17                                /* 陣列最多開 17 格 */
#define EMPTY   -1                             /* 從來沒放過東西的空格 */
#define DELETED -2                             /* tombstone：這格的 key 被刪掉了 */

int M = 11;                                    /* 表的大小（slot 數） */
int table[MAXM];

int h(int k)  { return k % M; }                /* 雜湊函數：除法 */
int h2(int k) { return 1 + k % (M - 2); }      /* double hashing 的步長，範圍 1～M-2，不會是 0 */

/* ===== 四種探測序列：第 i 次（i = 0, 1, 2, ...）要看哪一格 ===== */
int probeLinear(int k, int i)    { return (h(k) + i) % M; }
int probeQuadratic(int k, int i) { return (h(k) + i * i) % M; }
int probeQuadPM(int k, int i) {                /* 正負交替：h, h+1, h-1, h+4, h-4, ... */
  int j = (i + 1) / 2, d = j * j % M;
  return i % 2 == 1 ? (h(k) + d) % M : (h(k) - d + M) % M;
}
int probeDouble(int k, int i)    { return (h(k) + i * h2(k)) % M; }

int (*probe)(int, int) = probeLinear;          /* 目前用哪一種探測法 */

void clearTable(void) { for (int i = 0; i < M; i++) table[i] = EMPTY; }

/* ===== open addressing：插入、搜尋、刪除（tombstone） ===== */
int insert(int k) {                            /* 回傳放入的位置；放不進去回傳 -1 */
  int tomb = -1;                               /* 路上遇到的第一個 tombstone */
  for (int i = 0; i < M; i++) {
    int idx = probe(k, i);
    if (table[idx] == k) return idx;           /* 已經在表裡，不重複放 */
    if (table[idx] == DELETED) {
      if (tomb == -1) tomb = idx;              /* 先記下來，之後可以重複利用 */
    } else if (table[idx] == EMPTY) {
      if (tomb != -1) idx = tomb;              /* 確定 k 不在表裡：放到最早遇到的 tombstone */
      table[idx] = k;
      return idx;
    }
  }
  if (tomb != -1) { table[tomb] = k; return tomb; }
  return -1;                                   /* 探測 M 次都沒有位置 */
}

int search(int k) {                            /* 回傳位置；找不到回傳 -1 */
  for (int i = 0; i < M; i++) {
    int idx = probe(k, i);
    if (table[idx] == EMPTY) return -1;        /* 碰到真正的空格：k 一定不在表裡 */
    if (table[idx] == k) return idx;           /* 找到了 */
    /* 別的 key 或 DELETED：繼續探測下一格 */
  }
  return -1;
}

int removeKey(int k) {                         /* 刪除成功回傳 1 */
  int idx = search(k);
  if (idx == -1) return 0;
  table[idx] = DELETED;                        /* 不能設回 EMPTY，否則後面的 key 會找不到 */
  return 1;
}

/* ===== linear probing 專用：不用 tombstone，把後面的 key 往前補 ===== */
int between(int a, int x, int b) {             /* x 是否落在環狀區間 (a, b] 裡 */
  return a <= b ? (a < x && x <= b) : (a < x || x <= b);
}

int removeShift(int k) {
  int hole = search(k);
  if (hole == -1) return 0;
  table[hole] = EMPTY;                         /* 先挖出一個洞 */
  for (int j = (hole + 1) % M; table[j] != EMPTY; j = (j + 1) % M) {
    if (!between(hole, h(table[j]), j)) {      /* home 不在 (hole, j]：它的探測路徑經過洞 */
      table[hole] = table[j];                  /* 往前補進洞裡 */
      table[j] = EMPTY;
      hole = j;                                /* 洞移到它原本的位置 */
    }
  }
  return 1;
}

/* ===== separate chaining：每個 bucket 一條鏈結串列 ===== */
typedef struct Node { int key; struct Node *next; } Node;
Node *bucket[MAXM];

void chainInsert(int k) {                      /* 接在串列尾端；已經存在就不放 */
  int b = h(k);
  Node *cur = bucket[b], *prev = NULL;
  while (cur != NULL) {
    if (cur->key == k) return;
    prev = cur;
    cur = cur->next;
  }
  Node *x = malloc(sizeof(Node));
  x->key = k;
  x->next = NULL;
  if (prev == NULL) bucket[b] = x;             /* 串列原本是空的 */
  else prev->next = x;
}

Node *chainSearch(int k) {
  for (Node *p = bucket[h(k)]; p != NULL; p = p->next)
    if (p->key == k) return p;
  return NULL;                                 /* 整條串列都看完了 */
}

int chainDelete(int k) {
  int b = h(k);
  Node *cur = bucket[b], *prev = NULL;
  while (cur != NULL && cur->key != k) { prev = cur; cur = cur->next; }
  if (cur == NULL) return 0;                   /* 不在表裡 */
  if (prev == NULL) bucket[b] = cur->next;     /* 刪的是串列的第一個 */
  else prev->next = cur->next;
  free(cur);
  return 1;
}

/* ===================== 測試 ===================== */
static void show(const char *tag) {
  printf("%-26s", tag);
  for (int i = 0; i < M; i++) {
    if (table[i] == EMPTY) printf("  .");
    else if (table[i] == DELETED) printf("  D");
    else printf("%3d", table[i]);
  }
  printf("\n");
}

static void fill(int m, int (*p)(int, int), const int *keys, int n) {
  M = m; probe = p; clearTable();
  for (int i = 0; i < n; i++) insert(keys[i]);
}

static void freeChains(void) {
  for (int b = 0; b < MAXM; b++) {
    Node *p = bucket[b];
    while (p) { Node *nx = p->next; free(p); p = nx; }
    bucket[b] = NULL;
  }
}

int main(void) {
  /* 成大 111：m = 17、linear probing */
  int a[] = {23, 52, 11, 1, 50, 99, 65, 20, 35, 34, 82};
  fill(17, probeLinear, a, 11);
  show("linear m=17");

  /* 中央 110：刪除 46，看誰要搬 */
  int b[] = {23, 12, 34, 46, 28, 11, 6, 7, 0, 33, 30, 45};
  fill(17, probeLinear, b, 12);
  show("before delete 46");
  removeShift(46);
  show("removeShift(46)");

  /* 陽明交大 111：m = 7、quadratic +i² */
  int c[] = {1, 2, 4, 6, 8, 12, 15};
  fill(7, probeQuadratic, c, 7);
  show("quadratic m=7");

  /* 中央 114：m = 11、±i² */
  int d[] = {27, 37, 16, 17, 59, 15, 25, 38};
  fill(11, probeQuadPM, d, 8);
  show("quadratic +- m=11");

  /* 陽明交大 113：m = 13、double hashing，h2 = 1 + k % 11 */
  int e[] = {80, 69, 99, 16, 73, 30, 41};
  fill(13, probeDouble, e, 7);
  show("double m=13");

  /* tombstone：刪掉 22 後仍找得到 33；插入 44 重用 tombstone */
  int f[] = {11, 22, 33};
  fill(11, probeLinear, f, 3);
  removeKey(22);
  show("tombstone");
  printf("search(33) = %d, search(22) = %d\n", search(33), search(22));
  printf("insert(44) -> %d\n", insert(44));
  show("after insert 44");

  /* quadratic +i²：m = 7 時 i² mod 7 只有 0,1,2,4，表沒滿也可能放不進去 */
  int g[] = {0, 1, 2, 4};
  fill(7, probeQuadratic, g, 4);
  printf("quadratic insert(7) -> %d (table not full)\n", insert(7));

  /* chaining：中央 111 的 5 格表 */
  M = 5;
  int k[] = {7, 1, 10, 12, 2, 55, 5};
  for (int i = 0; i < 7; i++) chainInsert(k[i]);
  chainDelete(12);
  for (int i = 0; i < M; i++) {
    printf("bucket[%d]:", i);
    for (Node *p = bucket[i]; p; p = p->next) printf(" %d", p->key);
    printf("\n");
  }
  printf("chainSearch(55) %s, chainSearch(12) %s\n", chainSearch(55) ? "found" : "miss", chainSearch(12) ? "found" : "miss");
  freeChains();
  return 0;
}
