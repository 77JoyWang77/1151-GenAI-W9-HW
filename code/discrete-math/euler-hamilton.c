/* Euler and Hamilton Paths（Euler 與 Hamilton 路徑）完整程式：只用來編譯驗證，頁面上的片段都從這裡取出 */
#include <stdio.h>
#include <string.h>

#define N 8
int g[N][N];                                   /* g[u][v]：u、v 之間的邊數（允許重邊） */
int n;                                         /* 頂點數，編號 0..n-1 */

int degree(int v) {
  int d = 0;
  for (int u = 0; u < n; u++) d += g[v][u];
  return d;
}

/* ---------- 連通性：只看有邊的頂點 ---------- */
int seen[N];
void dfs(int v) {
  seen[v] = 1;
  for (int u = 0; u < n; u++)
    if (g[v][u] && !seen[u]) dfs(u);
}

int connected(void) {
  int s = -1;
  memset(seen, 0, sizeof seen);
  for (int v = 0; v < n; v++) if (degree(v) > 0) { s = v; break; }
  if (s == -1) return 1;                       /* 沒有邊：當作連通 */
  dfs(s);
  for (int v = 0; v < n; v++)
    if (degree(v) > 0 && !seen[v]) return 0;   /* 有邊的頂點沒被走到 */
  return 1;
}

/* ---------- 判斷：2 = Euler 迴路，1 = Euler 路徑，0 = 都沒有 ---------- */
int eulerType(int *start) {
  int odd = 0;
  *start = 0;
  if (!connected()) return 0;
  for (int v = n - 1; v >= 0; v--)             /* 倒著找，start 會是編號最小的奇點 */
    if (degree(v) % 2 == 1) { odd++; *start = v; }
  if (odd == 0) return 2;                      /* 全部偶點：Euler 迴路，從哪裡出發都行 */
  if (odd == 2) return 1;                      /* 恰好兩個奇點：從其中一個奇點出發 */
  return 0;                                    /* 奇點有 4 個以上：不存在 */
}

/* ---------- Hierholzer：用 stack 找出 Euler 路徑 ---------- */
int adj[N][N];                                 /* 還沒走過的邊（g 的副本） */
int stack[64], path[64];

int hierholzer(int start) {                    /* 回傳 path 的頂點數 */
  int top = 0, len = 0;
  memcpy(adj, g, sizeof g);
  stack[0] = start;
  while (top >= 0) {
    int v = stack[top], u = 0;
    while (u < n && adj[v][u] == 0) u++;       /* 找 v 的一條還沒走過的邊 */
    if (u < n) {                               /* 有：走過去，這條邊用掉 */
      adj[v][u]--; adj[u][v]--;
      stack[++top] = u;
    } else {                                   /* 沒路了：v 放進答案，退回上一個點 */
      path[len++] = stack[top--];
    }
  }
  return len;                                  /* path 倒過來讀就是 Euler 路徑 */
}

/* ---------- Hamilton 迴路：回溯法（backtracking）---------- */
int cyc[N], used[N];

int hamilton(int k) {                          /* cyc[0..k-1] 已經排好，現在決定第 k 個 */
  if (k == n) return g[cyc[n - 1]][cyc[0]] > 0;   /* 全部排完，最後一點要能回到起點 */
  for (int v = 1; v < n; v++)
    if (!used[v] && g[cyc[k - 1]][v]) {        /* 沒用過、而且和上一個點相鄰 */
      used[v] = 1; cyc[k] = v;
      if (hamilton(k + 1)) return 1;
      used[v] = 0;                             /* 這條路走不通：退回，試下一個 */
    }
  return 0;
}

int hasHamiltonCircuit(void) {
  memset(used, 0, sizeof used);
  cyc[0] = 0; used[0] = 1;                     /* 迴路會經過每個點，固定從 0 出發即可 */
  return hamilton(1);
}

/* ---------- 測試 ---------- */
void setGraph(int vertices, const char *edges) {   /* edges 例如 "AB BC CA" */
  n = vertices;
  memset(g, 0, sizeof g);
  for (const char *p = edges; p[0] && p[1]; p += (p[2] ? 3 : 2)) {
    int a = p[0] - 'A', b = p[1] - 'A';
    g[a][b]++; g[b][a]++;
  }
}

void report(const char *name) {
  int s, t = eulerType(&s);
  printf("%-10s Euler：%s", name, t == 2 ? "迴路" : t == 1 ? "路徑" : "無");
  if (t) {
    int len = hierholzer(s);
    printf("（");
    for (int i = len - 1; i >= 0; i--) printf("%c", 'A' + path[i]);
    printf("）");
  }
  printf("　Hamilton 迴路：");
  if (hasHamiltonCircuit()) { for (int i = 0; i < n; i++) printf("%c", 'A' + cyc[i]); printf("A\n"); }
  else printf("無\n");
}

int main(void) {
  setGraph(5, "AB AC BC CD CE DE");            report("蝴蝶結");
  setGraph(6, "AB BC CD DE EF FA AC CE EA");   report("六邊形");
  setGraph(5, "AB AC BC BD CE DE BE CD");      report("房子");
  setGraph(4, "AB AB AC AC AD BD CD");         report("Königsberg");
  setGraph(5, "AB AC AD AE BC BD BE CD CE DE"); report("K5");
  setGraph(5, "AC AD AE BC BD BE");            report("K2,3");
  setGraph(4, "AB BC CD DA AC");               report("菱形");
  return 0;
}
