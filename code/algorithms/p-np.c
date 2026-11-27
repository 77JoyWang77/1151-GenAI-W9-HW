/* P, NP, and NP-Completeness（P、NP 與 NP 完備）完整程式
   1. SAT 的驗證器（給 certificate，多項式時間）與暴力求解器（2^n 組指派），比較看過的字面數
   2. 歸約 Independent Set ≤p Vertex Cover（取補集），枚舉所有 5 個點的圖驗證答案一致
   3. Subset Sum 的 O(nT) 動態規劃：偽多項式時間，T 每多 1 個位元，表格就變兩倍
   編譯：gcc -std=c99 -Wall -Wextra -fsanitize=address,undefined p-np.c */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define MAXN 20   /* 變數最多 20 個 */
#define MAXM 64   /* 子句最多 64 個 */
#define MAXK 3    /* 每個子句最多 3 個字面（3-CNF） */

/* CNF 公式：lit[j][k] = +i 代表 x_i，-i 代表 ¬x_i（i 從 1 開始） */
typedef struct {
  int n, m;
  int len[MAXM];
  int lit[MAXM][MAXK];
} CNF;

long steps;   /* 看過的字面數：用來比較驗證與求解的工作量 */

/* 字面在指派 x 之下的值：x[i] 是 1（TRUE）或 0（FALSE） */
int litValue(int l, const int x[]) {
  return l > 0 ? x[l] : !x[-l];
}

/* 驗證器：certificate 就是一組指派 x，逐子句檢查，O(公式長度) */
int verifySAT(const CNF *f, const int x[]) {
  for (int j = 0; j < f->m; j++) {
    int sat = 0;
    for (int k = 0; k < f->len[j] && !sat; k++) {
      steps++;
      if (litValue(f->lit[j][k], x)) sat = 1;   /* 有一個字面為真，這個子句就滿足 */
    }
    if (!sat) return 0;                           /* 有一個子句全假：這組指派不行 */
  }
  return 1;                                       /* 每個子句都滿足：接受 */
}

/* 暴力求解：依序試 2^n 組指派（x1 是最高位元），每組都呼叫一次驗證器 */
int bruteSAT(const CNF *f, int x[]) {
  for (long mask = 0; mask < (1L << f->n); mask++) {
    for (int i = 1; i <= f->n; i++)
      x[i] = (mask >> (f->n - i)) & 1;
    if (verifySAT(f, x)) return 1;                /* 找到一組可以滿足的指派 */
  }
  return 0;                                       /* 2^n 組全部失敗：不可滿足 */
}

/* 方便測試：用陣列建立 CNF，每個子句以 0 結尾 */
CNF makeCNF(int n, const int *a) {
  CNF f;
  f.n = n; f.m = 0;
  int k = 0;
  for (int i = 0; a[i] != 99; i++) {
    if (a[i] == 0) { f.len[f.m++] = k; k = 0; }
    else f.lit[f.m][k++] = a[i];
  }
  return f;
}

void printCNF(const CNF *f) {
  for (int j = 0; j < f->m; j++) {
    printf("(");
    for (int k = 0; k < f->len[j]; k++)
      printf("%s%sx%d", k ? " v " : "", f->lit[j][k] < 0 ? "~" : "", abs(f->lit[j][k]));
    printf(")");
  }
}

void testSAT(const char *name, int n, const int *a, const char *cert) {
  CNF f = makeCNF(n, a);
  int x[MAXN + 1] = {0};
  printf("[%s] ", name);
  printCNF(&f);
  printf("\n");
  for (int i = 1; i <= n; i++) x[i] = cert[i - 1] == '1';
  steps = 0;
  int ok = verifySAT(&f, x);
  printf("  驗證 certificate %s：%s，看了 %ld 個字面\n", cert, ok ? "接受" : "拒絕", steps);
  steps = 0;
  int s = bruteSAT(&f, x);
  long tried = 0;
  if (s) for (int i = 1; i <= n; i++) tried = tried * 2 + x[i];
  printf("  暴力求解：%s", s ? "可滿足，" : "不可滿足，");
  if (s) {
    printf("第 %ld 組 ", tried + 1);
    for (int i = 1; i <= n; i++) printf("%d", x[i]);
  } else {
    printf("試完 %ld 組", 1L << n);
  }
  printf("，共看了 %ld 個字面\n", steps);
}

/* 最壞情況：n 個變數、每個子句都把同一組指派排除，看工作量怎麼成長 */
void growth(void) {
  printf("\n變數 n | 驗證看的字面數 | 暴力最壞看的字面數（公式：(x1)(x2)...(xn)，全真才滿足）\n");
  for (int n = 2; n <= 20; n += 6) {
    CNF f;
    f.n = n; f.m = n;
    for (int j = 0; j < n; j++) { f.len[j] = 1; f.lit[j][0] = j + 1; }
    int x[MAXN + 1];
    for (int i = 1; i <= n; i++) x[i] = 1;
    steps = 0;
    verifySAT(&f, x);
    long v = steps;
    steps = 0;
    bruteSAT(&f, x);
    printf("%6d | %14ld | %ld\n", n, v, steps);
  }
}

/* ---------------- 歸約：Independent Set ≤p Vertex Cover ---------------- */
#define MAXV 12
typedef struct {
  int n;
  int adj[MAXV][MAXV];
} Graph;

/* S 是 independent set：S 裡任兩點都不相鄰 */
int isIndependentSet(const Graph *g, const int in[]) {
  for (int u = 0; u < g->n; u++)
    for (int v = u + 1; v < g->n; v++)
      if (g->adj[u][v] && in[u] && in[v]) return 0;   /* 這條邊的兩端都在 S 裡 */
  return 1;
}

/* C 是 vertex cover：每條邊至少有一個端點在 C 裡 */
int isVertexCover(const Graph *g, const int in[]) {
  for (int u = 0; u < g->n; u++)
    for (int v = u + 1; v < g->n; v++)
      if (g->adj[u][v] && !in[u] && !in[v]) return 0; /* 這條邊兩端都不在 C 裡 */
  return 1;
}

/* 歸約函數 f：(G, k) 問「有沒有大小 k 的獨立集」→ (G, n − k) 問「有沒有大小 n − k 的點覆蓋」 */
void reduceISToVC(const Graph *g, int k, Graph *h, int *k2) {
  *h = *g;          /* 圖完全不用改 */
  *k2 = g->n - k;   /* 只改門檻：O(1)，當然是多項式時間 */
}

/* 暴力判斷：有沒有恰好 k 個點的獨立集／點覆蓋（只用來驗證歸約，指數時間） */
int hasIS(const Graph *g, int k) {
  int in[MAXV];
  for (int mask = 0; mask < (1 << g->n); mask++) {
    int c = 0;
    for (int v = 0; v < g->n; v++) c += in[v] = (mask >> v) & 1;
    if (c == k && isIndependentSet(g, in)) return 1;
  }
  return 0;
}

int hasVC(const Graph *g, int k) {
  int in[MAXV];
  for (int mask = 0; mask < (1 << g->n); mask++) {
    int c = 0;
    for (int v = 0; v < g->n; v++) c += in[v] = (mask >> v) & 1;
    if (c == k && isVertexCover(g, in)) return 1;
  }
  return 0;
}

void testReduction(void) {
  /* 枚舉 5 個點的所有 2^10 = 1024 張圖、每個 k = 0..5，檢查兩個問題的答案都一樣 */
  int n = 5, pairs[10][2], e = 0, bad = 0, total = 0;
  for (int u = 0; u < n; u++)
    for (int v = u + 1; v < n; v++) { pairs[e][0] = u; pairs[e][1] = v; e++; }
  for (int mask = 0; mask < (1 << e); mask++) {
    Graph g, h;
    memset(&g, 0, sizeof g);
    g.n = n;
    for (int i = 0; i < e; i++)
      if ((mask >> i) & 1) g.adj[pairs[i][0]][pairs[i][1]] = g.adj[pairs[i][1]][pairs[i][0]] = 1;
    for (int k = 0; k <= n; k++) {
      int k2;
      reduceISToVC(&g, k, &h, &k2);
      total++;
      if (hasIS(&g, k) != hasVC(&h, k2)) bad++;
    }
  }
  printf("\nIS ≤p VC：測了 %d 組 (G, k)，答案不一致 %d 組\n", total, bad);

  /* 頁面上的例子：6 個點的圖 */
  Graph g;
  memset(&g, 0, sizeof g);
  g.n = 6;
  int E[][2] = {{0, 1}, {0, 2}, {1, 2}, {1, 3}, {2, 4}, {3, 4}, {3, 5}, {4, 5}};
  for (int i = 0; i < 8; i++) g.adj[E[i][0]][E[i][1]] = g.adj[E[i][1]][E[i][0]] = 1;
  int S[6] = {1, 0, 0, 1, 0, 0}, C[6];          /* S = {a, d} */
  for (int v = 0; v < 6; v++) C[v] = !S[v];     /* C = V − S = {b, c, e, f} */
  printf("例子：S = {a, d} 是獨立集？%d；V − S = {b, c, e, f} 是點覆蓋？%d\n",
         isIndependentSet(&g, S), isVertexCover(&g, C));
  int best = 0;
  for (int k = 0; k <= 6; k++) if (hasIS(&g, k)) best = k;
  printf("例子：最大獨立集大小 %d，最小點覆蓋大小 %d（相加 = 6）\n", best, 6 - best);
  int S3[6] = {1, 0, 0, 0, 1, 0};
  printf("例子：S = {a, e} 是獨立集？%d；S = {a, d, e} 是獨立集？",
         isIndependentSet(&g, S3));
  S3[3] = 1;
  printf("%d\n", isIndependentSet(&g, S3));
}

/* ---------------- 偽多項式時間：Subset Sum 的 DP ---------------- */
/* can[s] = 能不能用前 i 個數湊出總和 s；填 n × (T + 1) 格，時間 O(nT) */
int subsetSum(const int a[], int n, int T, long *cells) {
  char *can = calloc(T + 1, 1);
  can[0] = 1;                                      /* 什麼都不選，總和 0 */
  for (int i = 0; i < n; i++)
    for (int s = T; s >= a[i]; s--) {              /* 由大到小，每個數只用一次 */
      if (can[s - a[i]]) can[s] = 1;
      (*cells)++;
    }
  int r = can[T];
  free(can);
  return r;
}

void testSubsetSum(void) {
  int a[] = {5, 8, 13, 4, 7};
  long cells = 0;
  int r = subsetSum(a, 5, 20, &cells);
  printf("\nSubset Sum {5, 8, 13, 4, 7}：T = 20 → %d（更新了 %ld 格）", r, cells);
  cells = 0;
  r = subsetSum(a, 5, 3, &cells);
  printf("，T = 3 → %d\n", r);
  printf("T 的位元數 | T 最大值   | 表格約 n × T 格（n = 5）\n");
  for (int bits = 10; bits <= 30; bits += 10) {
    long T = (1L << bits) - 1;
    printf("%10d | %10ld | %ld\n", bits, T, 5 * (T + 1));
  }
}

int main(void) {
  /* 4 個變數，2^4 = 16 組裡只有 1110 能滿足 */
  int f4[] = {-1, 2, -3, 0, 1, -2, 0, 1, 3, 0, 1, -3, 0, -1, -2, -4, 0, -1, 3, 0, 99};
  /* 3 個變數，只有 100 能滿足 */
  int f3[] = {1, 2, 3, 0, -1, -2, 0, -2, 3, 0, 2, -3, 0, 1, -3, 0, 99};
  /* 3 個變數，不可滿足：x3 必須假 → x1、x2 都必須假 → 第一個子句失敗 */
  int u3[] = {1, 2, 0, -1, 3, 0, -2, 3, 0, -3, 0, 99};
  testSAT("4 個變數", 4, f4, "1110");
  testSAT("3 個變數", 3, f3, "100");
  testSAT("certificate 給錯", 3, f3, "110");
  testSAT("不可滿足", 3, u3, "000");
  growth();
  testReduction();
  testSubsetSum();
  return 0;
}
