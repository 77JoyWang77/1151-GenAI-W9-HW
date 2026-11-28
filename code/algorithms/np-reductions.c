/* NP-Completeness Reductions（NP 完備歸約）完整程式
   每個歸約都寫成「把 A 的輸入轉成 B 的輸入」的函數，再在小輸入上用暴力法
   分別解 A 和 B，確認兩邊的 yes/no 完全一致（x 是 yes ⇔ f(x) 是 yes）。
   1. SAT → 3-SAT（長子句拆開）
   2. 3-SAT → CLIQUE、3-SAT → INDEPENDENT-SET
   3. CLIQUE ↔ INDEPENDENT-SET ↔ VERTEX-COVER（補圖、補集）
   4. VERTEX-COVER → SUBSET-SUM（4 進位，每一位代表一條邊）
   5. HAM-CYCLE → TSP（邊權重 1、非邊權重 2）
   6. 3-SAT → 3-COLOR（調色盤三角形、變數零件、OR 零件）
   編譯：gcc -std=c99 -Wall -Wextra -fsanitize=address,undefined np-reductions.c */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define MAXV 64   /* 圖最多 64 個點 */
#define MAXM 32   /* 子句最多 32 個 */
#define MAXL 8    /* 每個子句最多 8 個字面（3-SAT 只用到 3 個） */
#define MAXE 32   /* VC → SUBSET-SUM 時邊最多 32 條 */

/* CNF 公式：lit[j][t] = +i 代表 x_i，-i 代表 ¬x_i（i 從 1 開始） */
typedef struct {
  int n, m;
  int len[MAXM];
  int lit[MAXM][MAXL];
} CNF;

/* 無向圖：鄰接矩陣 */
typedef struct {
  int n;
  int adj[MAXV][MAXV];
} Graph;

/* ===================== 暴力求解（只用來驗證） ===================== */

int litValue(int l, const int x[]) {
  return l > 0 ? x[l] : !x[-l];
}

int satisfies(const CNF *f, const int x[]) {
  for (int j = 0; j < f->m; j++) {
    int ok = 0;
    for (int t = 0; t < f->len[j]; t++)
      if (litValue(f->lit[j][t], x)) ok = 1;
    if (!ok) return 0;
  }
  return 1;
}

/* 試遍 2^n 組指派；找到時把指派留在 x[] */
int bruteSAT(const CNF *f, int x[]) {
  for (long mask = 0; mask < (1L << f->n); mask++) {
    for (int i = 1; i <= f->n; i++) x[i] = (mask >> (i - 1)) & 1;
    if (satisfies(f, x)) return 1;
  }
  return 0;
}

int popcount(long s) {
  int c = 0;
  for (; s; s &= s - 1) c++;
  return c;
}

/* 點集合 s（位元遮罩）是不是 clique／獨立集／點覆蓋 */
int isClique(const Graph *g, long s) {
  for (int u = 0; u < g->n; u++)
    for (int v = u + 1; v < g->n; v++)
      if ((s >> u & 1) && (s >> v & 1) && !g->adj[u][v]) return 0;
  return 1;
}
int isIndependent(const Graph *g, long s) {
  for (int u = 0; u < g->n; u++)
    for (int v = u + 1; v < g->n; v++)
      if ((s >> u & 1) && (s >> v & 1) && g->adj[u][v]) return 0;
  return 1;
}
int isCover(const Graph *g, long s) {
  for (int u = 0; u < g->n; u++)
    for (int v = u + 1; v < g->n; v++)
      if (g->adj[u][v] && !(s >> u & 1) && !(s >> v & 1)) return 0;
  return 1;
}

/* 找一個大小恰好 k、通過 test（clique、獨立集）的點集合，找不到回傳 -1；點覆蓋用「≤ k」 */
long findSet(const Graph *g, int k, int (*test)(const Graph *, long)) {
  for (long s = 0; s < (1L << g->n); s++)
    if (popcount(s) == k && test(g, s)) return s;
  return -1;
}
int hasSet(const Graph *g, int k, int (*test)(const Graph *, long)) {
  return findSet(g, k, test) >= 0;
}
int hasCoverAtMost(const Graph *g, int k) {
  for (long s = 0; s < (1L << g->n); s++)
    if (popcount(s) <= k && isCover(g, s)) return 1;
  return 0;
}

/* ===================== 1. SAT → 3-SAT ===================== */

/* 把每個子句變成最多 3 個字面：
   (l1 ∨ l2 ∨ … ∨ lk)，k > 3 時拆成
   (l1 ∨ l2 ∨ y1)(¬y1 ∨ l3 ∨ y2)…(¬y_{k-3} ∨ l_{k-1} ∨ lk)，y 是新變數 */
void reduceSATTo3SAT(const CNF *f, CNF *g) {
  g->n = f->n; g->m = 0;
  for (int j = 0; j < f->m; j++) {
    const int *l = f->lit[j];
    int k = f->len[j];
    if (k <= 3) {                                   /* 本來就夠短，照抄 */
      g->len[g->m] = k;
      memcpy(g->lit[g->m++], l, sizeof(int) * k);
      continue;
    }
    int y = ++g->n;                                 /* 第一個新變數 y1 */
    int first[3] = { l[0], l[1], y };
    g->len[g->m] = 3; memcpy(g->lit[g->m++], first, sizeof first);
    for (int t = 2; t < k - 2; t++) {               /* 中間：(¬y ∨ l_t ∨ y') */
      int y2 = ++g->n;
      int mid[3] = { -y, l[t], y2 };
      g->len[g->m] = 3; memcpy(g->lit[g->m++], mid, sizeof mid);
      y = y2;
    }
    int last[3] = { -y, l[k - 2], l[k - 1] };       /* 最後：(¬y ∨ l_{k-1} ∨ l_k) */
    g->len[g->m] = 3; memcpy(g->lit[g->m++], last, sizeof last);
  }
}

/* ===================== 2. 3-SAT → CLIQUE / INDEPENDENT-SET ===================== */

/* 每個字面一個點：lit[v] 是它代表的字面、cls[v] 是它所在的子句 */
void literalVertices(const CNF *f, Graph *g, int lit[], int cls[]) {
  g->n = 0;
  for (int j = 0; j < f->m; j++)
    for (int t = 0; t < f->len[j]; t++) {
      lit[g->n] = f->lit[j][t];
      cls[g->n] = j;
      g->n++;
    }
}

/* 3-SAT → CLIQUE：不同子句、而且不互補的兩個字面之間連邊；k = 子句數 m */
void reduce3SATToClique(const CNF *f, Graph *g, int *k, int lit[], int cls[]) {
  literalVertices(f, g, lit, cls);
  for (int u = 0; u < g->n; u++)
    for (int v = 0; v < g->n; v++)
      g->adj[u][v] = u != v
                     && cls[u] != cls[v]            /* 不同子句才連 */
                     && lit[u] != -lit[v];          /* x 和 ¬x 不連 */
  *k = f->m;
}

/* 3-SAT → INDEPENDENT-SET：同一個子句連成三角形、互補字面連邊；k = m */
void reduce3SATToIS(const CNF *f, Graph *g, int *k, int lit[], int cls[]) {
  literalVertices(f, g, lit, cls);
  for (int u = 0; u < g->n; u++)
    for (int v = 0; v < g->n; v++)
      g->adj[u][v] = u != v
                     && (cls[u] == cls[v]           /* 同一個子句：最多選一個 */
                         || lit[u] == -lit[v]);     /* x 和 ¬x：不能同時為真 */
  *k = f->m;
}

/* (⇒) 滿足指派 x → 每個子句挑第一個為真的字面，得到 m 個點 */
long pickTrueLiterals(const CNF *f, const Graph *g, const int x[], const int lit[], const int cls[]) {
  long s = 0;
  for (int j = 0; j < f->m; j++)
    for (int v = 0; v < g->n; v++)
      if (cls[v] == j && litValue(lit[v], x)) {
        s |= 1L << v;                               /* 子句 j 挑這個點 */
        break;                                      /* 每個子句只挑一個 */
      }
  return s;
}

/* (⇐) 大小 m 的 clique（或獨立集）s → 把裡面的字面設成真 */
void readAssignment(const CNF *f, const Graph *g, long s, const int lit[], int x[]) {
  for (int i = 1; i <= f->n; i++) x[i] = 0;         /* 沒被選到的變數：設成什麼都可以 */
  for (int v = 0; v < g->n; v++)
    if (s >> v & 1) x[abs(lit[v])] = lit[v] > 0;    /* x_i 為真設 1，¬x_i 為真設 0 */
}

/* ===================== 3. CLIQUE ↔ IS ↔ VC ===================== */

/* 補圖：原本有邊的變沒邊、沒邊的變有邊 */
void complementGraph(const Graph *g, Graph *h) {
  h->n = g->n;
  for (int u = 0; u < g->n; u++)
    for (int v = 0; v < g->n; v++)
      h->adj[u][v] = u != v && !g->adj[u][v];
}

/* CLIQUE(G, k) → IS(Ḡ, k)：S 是 G 的 clique ⇔ S 是 Ḡ 的獨立集 */
void reduceCliqueToIS(const Graph *g, int k, Graph *h, int *k2) {
  complementGraph(g, h);
  *k2 = k;
}

/* IS(G, k) → VC(G, n − k)：S 是獨立集 ⇔ V − S 是點覆蓋 */
void reduceISToVC(const Graph *g, int k, Graph *h, int *k2) {
  *h = *g;
  *k2 = g->n - k;
}

/* ===================== 4. VERTEX-COVER → SUBSET-SUM ===================== */

/* 邊 e_j = (eu[j], ev[j])，j = 0..m−1。每個數寫成 4 進位：
   第 m 位（最高位）數「選了幾個點」，第 j 位數「邊 e_j 被蓋到幾次」。
   x_i = 4^m + Σ_{e_j 碰到 v_i} 4^j；y_j = 4^j；t = k·4^m + Σ_j 2·4^j */
int reduceVCToSubsetSum(int n, int m, const int eu[], const int ev[], int k,
                        long long S[], long long *t) {
  long long p[MAXE + 1];
  p[0] = 1;
  for (int j = 1; j <= m; j++) p[j] = p[j - 1] * 4;
  int c = 0;
  for (int i = 0; i < n; i++) {                     /* 每個點一個數 x_i */
    S[c] = p[m];
    for (int j = 0; j < m; j++)
      if (eu[j] == i || ev[j] == i) S[c] += p[j];   /* 碰到的邊那一位放 1 */
    c++;
  }
  for (int j = 0; j < m; j++) S[c++] = p[j];        /* 每條邊一個補位數 y_j */
  *t = k * p[m];
  for (int j = 0; j < m; j++) *t += 2 * p[j];       /* 每條邊那一位都要湊到 2 */
  return c;                                          /* 共 n + m 個數 */
}

int bruteSubsetSum(const long long S[], int c, long long t) {
  for (long s = 0; s < (1L << c); s++) {
    long long sum = 0;
    for (int i = 0; i < c; i++)
      if (s >> i & 1) sum += S[i];
    if (sum == t) return 1;
  }
  return 0;
}

/* ===================== 5. HAM-CYCLE → TSP ===================== */

/* 完全圖上的權重：G 裡的邊權重 1，不是邊的權重 2；門檻 k = n */
void reduceHCToTSP(const Graph *g, int w[][MAXV], int *k) {
  for (int u = 0; u < g->n; u++)
    for (int v = 0; v < g->n; v++)
      w[u][v] = u == v ? 0 : (g->adj[u][v] ? 1 : 2);
  *k = g->n;
}

/* 暴力：固定從點 0 出發，試所有排列，回傳最短巡迴長度 */
int perm[MAXV], used[MAXV], best;
void tour(int n, int w[][MAXV], int d, int len) {
  if (len >= best) return;
  if (d == n) {
    if (len + w[perm[n - 1]][0] < best) best = len + w[perm[n - 1]][0];
    return;
  }
  for (int v = 1; v < n; v++)
    if (!used[v]) {
      used[v] = 1; perm[d] = v;
      tour(n, w, d + 1, len + w[perm[d - 1]][v]);
      used[v] = 0;
    }
}
int bestTour(int n, int w[][MAXV]) {
  memset(used, 0, sizeof used);
  best = 1 << 30; perm[0] = 0; used[0] = 1;
  tour(n, w, 1, 0);
  return best;
}
/* 有沒有 Hamiltonian cycle：只准走 G 的邊（非邊當成無限大） */
int hasHamCycle(const Graph *g) {
  static int w[MAXV][MAXV];
  for (int u = 0; u < g->n; u++)
    for (int v = 0; v < g->n; v++)
      w[u][v] = g->adj[u][v] ? 1 : 1000;
  return bestTour(g->n, w) == g->n;
}

/* ===================== 6. 3-SAT → 3-COLOR ===================== */

/* 點 0、1、2 = 調色盤 T、F、B（三角形，三種顏色各占一個）；
   變數 x_i：點 v_i 和 ¬v_i 互連，兩者都連到 B，所以一個是 T、一個是 F */
enum { T = 0, F = 1, B = 2 };
int varNode(int l) { return l > 0 ? 3 + 2 * (l - 1) : 4 + 2 * (-l - 1); }
void addEdge(Graph *g, int u, int v) { g->adj[u][v] = g->adj[v][u] = 1; }

/* OR 零件：輸入 a、b，新增 p、q、o 三個點；a、b 都是 F 時 o 一定是 F */
int orGadget(Graph *g, int a, int b) {
  int p = g->n++, q = g->n++, o = g->n++;
  addEdge(g, a, p); addEdge(g, b, q); addEdge(g, p, q);
  addEdge(g, p, o); addEdge(g, q, o);
  return o;
}

/* 每個子句恰好 3 個字面：o = OR(OR(l1, l2), l3)，再把 o 連到 F 和 B，逼它是 T */
void reduce3SATTo3Color(const CNF *f, Graph *g) {
  memset(g, 0, sizeof *g);
  g->n = 3 + 2 * f->n;
  addEdge(g, T, F); addEdge(g, F, B); addEdge(g, B, T);
  for (int i = 1; i <= f->n; i++) {
    addEdge(g, varNode(i), varNode(-i));
    addEdge(g, varNode(i), B); addEdge(g, varNode(-i), B);
  }
  for (int j = 0; j < f->m; j++) {
    const int *l = f->lit[j];
    int o1 = orGadget(g, varNode(l[0]), varNode(l[1]));
    int o2 = orGadget(g, o1, varNode(l[2]));
    addEdge(g, o2, F); addEdge(g, o2, B);           /* 子句的輸出只能是 T */
  }
}

/* 回溯法：依序替每個點挑顏色 */
int color[MAXV];
int tryColor(const Graph *g, int v) {
  if (v == g->n) return 1;
  for (int c = 0; c < 3; c++) {
    int ok = 1;
    for (int u = 0; u < v && ok; u++)
      if (g->adj[u][v] && color[u] == c) ok = 0;
    if (ok) { color[v] = c; if (tryColor(g, v + 1)) return 1; }
  }
  return 0;
}

/* ===================== 測試 ===================== */

int randInt(int a, int b) { return a + rand() % (b - a + 1); }

CNF randomCNF(int n, int m, int minL, int maxL) {
  CNF f;
  f.n = n; f.m = m;
  for (int j = 0; j < m; j++) {
    f.len[j] = randInt(minL, maxL);
    for (int t = 0; t < f.len[j]; t++) f.lit[j][t] = randInt(1, n) * (rand() % 2 ? 1 : -1);
  }
  return f;
}

Graph randomGraph(int n, int pct) {
  Graph g;
  memset(&g, 0, sizeof g);
  g.n = n;
  for (int u = 0; u < n; u++)
    for (int v = u + 1; v < n; v++)
      if (rand() % 100 < pct) g.adj[u][v] = g.adj[v][u] = 1;
  return g;
}

int countEdges(const Graph *g) {
  int e = 0;
  for (int u = 0; u < g->n; u++)
    for (int v = u + 1; v < g->n; v++) e += g->adj[u][v];
  return e;
}

void printCNF(const CNF *f) {
  for (int j = 0; j < f->m; j++) {
    printf("(");
    for (int t = 0; t < f->len[j]; t++)
      printf("%s%sx%d", t ? " v " : "", f->lit[j][t] < 0 ? "~" : "", abs(f->lit[j][t]));
    printf(")");
  }
  printf("\n");
}

int main(void) {
  srand(20261128);
  int x[MAXV], lit[MAXV], cls[MAXV], k, bad = 0, tests;
  static Graph g, h;
  static int w[MAXV][MAXV];

  /* 示範公式：(x1 ∨ x2 ∨ x3)(¬x1 ∨ ¬x2 ∨ x3)(x1 ∨ ¬x2 ∨ ¬x3) */
  CNF demo = { 3, 3, { 3, 3, 3 }, { { 1, 2, 3 }, { -1, -2, 3 }, { 1, -2, -3 } } };
  printf("== 3-SAT -> CLIQUE 示範 ==\n");
  printCNF(&demo);
  reduce3SATToClique(&demo, &g, &k, lit, cls);
  printf("點數 %d（= 字面數）、邊數 %d、k = %d\n", g.n, countEdges(&g), k);
  int sat = bruteSAT(&demo, x);
  printf("可滿足 %d（x1..x3 = %d%d%d），有 %d-clique %d\n", sat, x[1], x[2], x[3], k, hasSet(&g, k, isClique));
  long pick = pickTrueLiterals(&demo, &g, x, lit, cls);
  printf("挑出的點（遮罩）%ld，是 clique %d\n", pick, isClique(&g, pick));
  reduce3SATToIS(&demo, &h, &k, lit, cls);
  printf("IS 版本：邊數 %d（三角形 %d 條 + 互補 %d 條），有大小 %d 的獨立集 %d\n",
         countEdges(&h), 3 * demo.m, countEdges(&h) - 3 * demo.m, k, hasSet(&h, k, isIndependent));

  /* 1. 3-SAT → CLIQUE / IS：隨機公式 */
  tests = 0;
  int unsatC = 0;
  for (int it = 0; it < 3000; it++) {
    CNF f = randomCNF(randInt(1, 4), randInt(1, 5), 1, 3);
    int s = bruteSAT(&f, x);
    reduce3SATToClique(&f, &g, &k, lit, cls);
    int c = hasSet(&g, k, isClique);
    reduce3SATToIS(&f, &h, &k, lit, cls);
    int i2 = hasSet(&h, k, isIndependent);
    if (s != c || s != i2) { bad++; printCNF(&f); }
    if (s) {
      long p = pickTrueLiterals(&f, &g, x, lit, cls);           /* (⇒) 指派 → clique／獨立集 */
      if (popcount(p) != f.m || !isClique(&g, p) || !isIndependent(&h, p)) bad++;
      int y[MAXV];
      readAssignment(&f, &g, findSet(&g, k, isClique), lit, y);  /* (⇐) clique → 指派 */
      if (!satisfies(&f, y)) bad++;
      readAssignment(&f, &h, findSet(&h, k, isIndependent), lit, y);
      if (!satisfies(&f, y)) bad++;
    }
    for (int u = 0; u < g.n; u++)                               /* 兩種圖互為補圖 */
      for (int v = 0; v < g.n; v++)
        if (u != v && g.adj[u][v] == h.adj[u][v]) bad++;
    unsatC += !s;
    tests++;
  }
  printf("3-SAT -> CLIQUE / IS：%d 個隨機公式（%d 個不可滿足），不一致 %d 個\n", tests, unsatC, bad);

  /* 2. SAT → 3-SAT */
  tests = 0;
  int maxNew = 0;
  for (int it = 0; it < 3000; it++) {
    CNF f = randomCNF(randInt(1, 5), randInt(1, 4), 1, 7), f3;
    reduceSATTo3SAT(&f, &f3);
    if (f3.n > MAXV - 1) continue;
    if (bruteSAT(&f, x) != bruteSAT(&f3, x)) { bad++; printCNF(&f); }
    if (f3.n - f.n > maxNew) maxNew = f3.n - f.n;
    tests++;
  }
  printf("SAT -> 3-SAT：%d 個隨機公式，不一致累計 %d 個\n", tests, bad);
  CNF longc = { 6, 1, { 6 }, { { 1, 2, 3, 4, 5, 6 } } }, l3;
  reduceSATTo3SAT(&longc, &l3);
  printf("6 個字面的子句拆成 %d 個子句、多 %d 個新變數：", l3.m, l3.n - longc.n);
  printCNF(&l3);

  /* 3. CLIQUE ↔ IS ↔ VC：所有 n ≤ 5 的圖 */
  tests = 0;
  for (int n = 1; n <= 5; n++) {
    int pairs = n * (n - 1) / 2;
    for (long mask = 0; mask < (1L << pairs); mask++) {
      memset(&g, 0, sizeof g); g.n = n;
      int b = 0;
      for (int u = 0; u < n; u++)
        for (int v = u + 1; v < n; v++, b++)
          if (mask >> b & 1) g.adj[u][v] = g.adj[v][u] = 1;
      for (int kk = 0; kk <= n; kk++) {
        int k2, k3;
        Graph h2;
        reduceCliqueToIS(&g, kk, &h, &k2);
        reduceISToVC(&h, k2, &h2, &k3);
        int a = hasSet(&g, kk, isClique), c = hasSet(&h, k2, isIndependent), d = hasCoverAtMost(&h2, k3);
        if (a != c || a != d) bad++;
        tests++;
      }
    }
  }
  printf("CLIQUE -> IS -> VC：n <= 5 全部的圖、每個 k，共 %d 組，不一致累計 %d 組\n", tests, bad);

  /* 4. VC → SUBSET-SUM：考古題的圖（e0 = v0v4, e1 = v4v1, e2 = v0v3, e3 = v4v2, e4 = v1v2） */
  int eu[MAXE] = { 0, 4, 0, 4, 1 }, ev[MAXE] = { 4, 1, 3, 2, 2 };
  long long S[MAXV], t;
  int c = reduceVCToSubsetSum(5, 5, eu, ev, 3, S, &t);
  printf("== VC -> SUBSET-SUM 示範（k = 3）==\nS = {");
  for (int i = 0; i < c; i++) printf("%s%lld", i ? ", " : "", S[i]);
  printf("}，t = %lld，有解 %d\n", t, bruteSubsetSum(S, c, t));
  printf("只加 x1 + x3 + x4 = %lld（沒有補 y 的陷阱值）\n", S[1] + S[3] + S[4]);
  for (int kk = 0; kk <= 5; kk++) {
    reduceVCToSubsetSum(5, 5, eu, ev, kk, S, &t);
    printf("  k = %d：t = %lld，有解 %d\n", kk, t, bruteSubsetSum(S, c, t));
  }
  tests = 0;
  for (int it = 0; it < 400; it++) {
    int n = randInt(1, 5), m = 0;
    g = randomGraph(n, 50);
    for (int u = 0; u < n; u++)
      for (int v = u + 1; v < n; v++)
        if (g.adj[u][v]) { eu[m] = u; ev[m] = v; m++; }
    for (int kk = 0; kk <= n; kk++) {
      c = reduceVCToSubsetSum(n, m, eu, ev, kk, S, &t);
      /* 構造湊的是「恰好 k 個點」；k ≤ n 時 ≤ k 的覆蓋補幾個點就變成恰好 k，兩者相同 */
      int a = hasCoverAtMost(&g, kk), b2 = bruteSubsetSum(S, c, t);
      if (a != b2) bad++;
      tests++;
    }
  }
  printf("VC -> SUBSET-SUM：%d 組（隨機圖 n <= 5、每個 k），不一致累計 %d 組\n", tests, bad);

  /* 5. HAM-CYCLE → TSP */
  tests = 0;
  int yes = 0;
  for (int it = 0; it < 600; it++) {
    int n = randInt(3, 7);
    g = randomGraph(n, randInt(30, 80));
    reduceHCToTSP(&g, w, &k);
    int a = hasHamCycle(&g), b2 = bestTour(n, w) <= k;
    if (a != b2) bad++;
    yes += a;
    tests++;
  }
  printf("HAM-CYCLE -> TSP：%d 張隨機圖（%d 張有 HC），不一致累計 %d 張\n", tests, yes, bad);
  /* 示範：4-cycle 0-1-2-3 加一條 0-2，再拿掉 2-3 */
  memset(&g, 0, sizeof g); g.n = 4;
  addEdge(&g, 0, 1); addEdge(&g, 1, 2); addEdge(&g, 2, 3); addEdge(&g, 3, 0); addEdge(&g, 0, 2);
  reduceHCToTSP(&g, w, &k);
  printf("示範圖 A：有 HC %d，最短巡迴 %d，k = %d\n", hasHamCycle(&g), bestTour(4, w), k);
  g.adj[2][3] = g.adj[3][2] = 0;
  reduceHCToTSP(&g, w, &k);
  printf("示範圖 B（拿掉 2-3）：有 HC %d，最短巡迴 %d，k = %d\n", hasHamCycle(&g), bestTour(4, w), k);

  /* 6. 3-SAT → 3-COLOR */
  tests = 0;
  int unsat = 0;
  for (int it = 0; it < 300; it++) {
    CNF f = randomCNF(randInt(1, 3), randInt(1, 8), 3, 3);
    reduce3SATTo3Color(&f, &g);
    int a = bruteSAT(&f, x), b2 = tryColor(&g, 0);
    if (a != b2) { bad++; printCNF(&f); }
    unsat += !a;
    tests++;
  }
  reduce3SATTo3Color(&demo, &g);
  printf("3-SAT -> 3-COLOR：%d 個隨機公式（%d 個不可滿足），不一致累計 %d 個；示範公式的圖有 %d 個點（3 + 2n + 6m）、%d 條邊\n",
         tests, unsat, bad, g.n, countEdges(&g));

  printf(bad ? "FAILED\n" : "ALL OK\n");
  return bad != 0;
}
