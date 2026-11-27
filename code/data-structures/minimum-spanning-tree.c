/* Minimum Cost Spanning Tree（最小成本生成樹）完整程式：只用來編譯驗證，頁面上的片段都從這裡取出 */
#include <stdio.h>
#include <stdlib.h>
#include <limits.h>

#define MAXV 20
#define MAXE 100
#define INF INT_MAX

typedef struct {
  int u, v, w;                           /* 無向邊 (u, v)，權重 w */
} Edge;

int n, m;                                /* 頂點數（編號 0 ~ n-1）、邊數 */
Edge e[MAXE];                            /* 邊的陣列：Kruskal、Sollin 用 */
int cost[MAXV][MAXV];                    /* 相鄰矩陣：cost[u][v] 是權重，沒有邊就是 INF */
int head[MAXV], nxt[2 * MAXE], to[2 * MAXE], wt[2 * MAXE], cnt;   /* 相鄰串列：Prim（heap 版）用 */

void initGraph(int vertices) {
  n = vertices;
  m = 0;
  cnt = 0;
  for (int i = 0; i < n; i++) {
    head[i] = -1;
    for (int j = 0; j < n; j++) cost[i][j] = INF;
  }
}

void addEdge(int u, int v, int w) {      /* 無向邊：矩陣兩格、串列兩端都要記 */
  e[m++] = (Edge){u < v ? u : v, u < v ? v : u, w};
  cost[u][v] = cost[v][u] = w;
  to[cnt] = v; wt[cnt] = w; nxt[cnt] = head[u]; head[u] = cnt++;
  to[cnt] = u; wt[cnt] = w; nxt[cnt] = head[v]; head[v] = cnt++;
}

/* 權重小的在前；權重相同時依 (u, v) 由小到大，讓結果固定 */
int cmpEdge(const void *x, const void *y) {
  const Edge *a = x, *b = y;
  if (a->w != b->w) return (a->w > b->w) - (a->w < b->w);
  if (a->u != b->u) return a->u - b->u;
  return a->v - b->v;
}

/* ---------- union-find：記錄每個頂點目前屬於哪一棵樹 ---------- */
int parent[MAXV], setSize[MAXV];

void initSets(void) {
  for (int i = 0; i < n; i++) {
    parent[i] = i;                       /* 一開始每個頂點自己一棵樹 */
    setSize[i] = 1;
  }
}

int find(int x) {                        /* 找 x 所在集合的代表（root），順便壓縮路徑 */
  if (parent[x] != x) parent[x] = find(parent[x]);
  return parent[x];
}

void unionSets(int a, int b) {           /* a、b 都是 root：小的集合掛到大的下面 */
  if (setSize[a] < setSize[b]) { int t = a; a = b; b = t; }
  parent[b] = a;
  setSize[a] += setSize[b];
}

/* ---------- Kruskal：邊由小到大，不成環就收 ---------- */
int kruskal(Edge t[]) {
  int k = 0, total = 0;
  qsort(e, m, sizeof(Edge), cmpEdge);    /* 所有邊依權重排序：O(E log E) */
  initSets();
  for (int i = 0; i < m && k < n - 1; i++) {
    int ru = find(e[i].u), rv = find(e[i].v);
    if (ru == rv) {                      /* 兩端已在同一棵樹：加進來會形成環 */
      printf("  略過 (%d,%d) %d：形成環\n", e[i].u, e[i].v, e[i].w);
      continue;
    }
    unionSets(ru, rv);                   /* 兩棵樹合併成一棵 */
    t[k++] = e[i];
    total += e[i].w;
  }
  if (k < n - 1) return -1;              /* 收不滿 n-1 條：圖不連通，只得到生成樹林 */
  return total;
}

/* ---------- Prim（相鄰矩陣）：從起點往外長，O(V²) ---------- */
int prim(int s, Edge t[]) {
  int key[MAXV], from[MAXV], inTree[MAXV], total = 0;
  for (int v = 0; v < n; v++) {
    key[v] = INF;                        /* key[v]：v 連到樹上最便宜的邊權 */
    from[v] = -1;                        /* from[v]：那條邊的另一端（樹上的頂點） */
    inTree[v] = 0;
  }
  key[s] = 0;
  for (int k = 0; k < n; k++) {
    int u = -1;
    for (int v = 0; v < n; v++)          /* 在樹外找 key 最小的頂點：O(V) */
      if (!inTree[v] && (u == -1 || key[v] < key[u])) u = v;
    if (key[u] == INF) return -1;        /* 剩下的頂點都接不上：圖不連通 */
    inTree[u] = 1;                       /* 邊 (from[u], u) 是跨越 cut 最輕的邊 */
    total += key[u];
    if (from[u] != -1) t[k - 1] = (Edge){from[u], u, key[u]};
    for (int v = 0; v < n; v++)          /* 用 u 的邊更新樹外頂點的 key */
      if (!inTree[v] && cost[u][v] < key[v]) {
        key[v] = cost[u][v];
        from[v] = u;
      }
  }
  return total;
}

/* ---------- Prim（binary heap＋相鄰串列）：O(E log V) ---------- */
Edge heap[2 * MAXE];
int hsize;

int less(Edge a, Edge b) { return cmpEdge(&a, &b) < 0; }

void heapPush(Edge x) {
  int i = hsize++;
  while (i > 0 && less(x, heap[(i - 1) / 2])) {   /* 往上浮 */
    heap[i] = heap[(i - 1) / 2];
    i = (i - 1) / 2;
  }
  heap[i] = x;
}

Edge heapPop(void) {
  Edge top = heap[0], last = heap[--hsize];
  int i = 0;
  while (2 * i + 1 < hsize) {                       /* 往下沉 */
    int c = 2 * i + 1;
    if (c + 1 < hsize && less(heap[c + 1], heap[c])) c++;
    if (!less(heap[c], last)) break;
    heap[i] = heap[c];
    i = c;
  }
  heap[i] = last;
  return top;
}

int primHeap(int s, Edge t[]) {
  int inTree[MAXV] = {0}, k = 0, total = 0;
  hsize = 0;
  inTree[s] = 1;
  for (int i = head[s]; i != -1; i = nxt[i]) heapPush((Edge){s, to[i], wt[i]});
  while (hsize > 0 && k < n - 1) {
    Edge x = heapPop();                  /* heap 裡最便宜的候選邊 */
    if (inTree[x.v]) continue;           /* 另一端也已在樹上：過期的候選，丟掉 */
    inTree[x.v] = 1;
    t[k++] = x;
    total += x.w;
    for (int i = head[x.v]; i != -1; i = nxt[i])
      if (!inTree[to[i]]) heapPush((Edge){x.v, to[i], wt[i]});
  }
  return k == n - 1 ? total : -1;
}

/* ---------- Sollin（Borůvka）：每棵樹同時挑一條最便宜的外連邊 ---------- */
int sollin(Edge t[]) {
  int k = 0, total = 0, trees = n, cheap[MAXV];
  initSets();
  while (trees > 1) {
    for (int i = 0; i < n; i++) cheap[i] = -1;
    for (int i = 0; i < m; i++) {        /* 每棵樹找出連到外面最便宜的邊 */
      int a = find(e[i].u), b = find(e[i].v);
      if (a == b) continue;
      if (cheap[a] == -1 || cmpEdge(&e[i], &e[cheap[a]]) < 0) cheap[a] = i;
      if (cheap[b] == -1 || cmpEdge(&e[i], &e[cheap[b]]) < 0) cheap[b] = i;
    }
    int added = 0;
    for (int i = 0; i < n; i++) {
      if (cheap[i] == -1) continue;
      Edge x = e[cheap[i]];
      int a = find(x.u), b = find(x.v);
      if (a == b) continue;              /* 兩棵樹選中同一條邊：只加一次 */
      unionSets(a, b);
      t[k++] = x;
      total += x.w;
      trees--;
      added = 1;
    }
    if (!added) return -1;               /* 沒有樹找得到外連邊：圖不連通 */
    printf("  一回合後剩 %d 棵樹\n", trees);
  }
  return total;
}

/* ---------- 測試 ---------- */
void printTree(const char *name, Edge t[], int total) {
  printf("%s：", name);
  if (total < 0) { printf("圖不連通，沒有生成樹\n"); return; }
  for (int i = 0; i < n - 1; i++) printf("(%d,%d)%d ", t[i].u, t[i].v, t[i].w);
  printf(" 總成本 %d\n", total);
}

void buildDemo(void) {                   /* 本頁範例圖：7 個頂點、11 條邊，權重互不相同 */
  initGraph(7);
  addEdge(0, 1, 6);  addEdge(0, 3, 11); addEdge(0, 4, 9);
  addEdge(1, 2, 10); addEdge(1, 3, 3);  addEdge(2, 3, 7);
  addEdge(2, 6, 5);  addEdge(3, 4, 8);  addEdge(3, 5, 4);
  addEdge(4, 5, 12); addEdge(5, 6, 2);
}

void runAll(const char *title) {
  Edge t[MAXV];
  printf("== %s ==\n", title);
  printTree("Kruskal", t, kruskal(t));
  printTree("Prim 從 0（矩陣）", t, prim(0, t));
  printTree("Prim 從 0（heap）", t, primHeap(0, t));
  printTree("Sollin", t, sollin(t));
}

int main(void) {
  Edge t[MAXV];

  buildDemo();
  runAll("範例圖");
  printTree("Prim 從 4（矩陣）", t, prim(4, t));

  /* 同權重的例子：正方形 0-1-2-3 四條邊都是 1，再加一條對角線 0-2 權重 2 */
  initGraph(4);
  addEdge(0, 1, 1); addEdge(1, 2, 1); addEdge(2, 3, 1); addEdge(0, 3, 1); addEdge(0, 2, 2);
  runAll("同權重");

  /* 不連通：{0,1,2} 和 {3,4} 兩塊 */
  initGraph(5);
  addEdge(0, 1, 3); addEdge(1, 2, 1); addEdge(0, 2, 2); addEdge(3, 4, 5);
  runAll("不連通");

  /* 對照最短路徑樹：0-1:4、0-2:5、1-2:2 */
  initGraph(3);
  addEdge(0, 1, 4); addEdge(0, 2, 5); addEdge(1, 2, 2);
  runAll("MST 與最短路徑樹");
  return 0;
}
