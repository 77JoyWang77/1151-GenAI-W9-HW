/* BFS & DFS（廣度與深度優先搜尋）完整程式：只用來編譯驗證，頁面上的片段都從這裡取出 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define MAXV 20

typedef struct Node {
  int v;                                 /* 相鄰的頂點編號 */
  struct Node *next;
} Node;

int n;                                   /* 頂點數，編號 0 ~ n-1 */
Node *list[MAXV];                        /* 相鄰串列：list[v] 是 v 的所有相鄰點 */
int adj[MAXV][MAXV];                     /* 相鄰矩陣：adj[v][w] = 1 表示有邊 (v, w) */
int visited[MAXV];
int parent[MAXV];                        /* 生成樹上的父節點，起點是 -1 */
int dist[MAXV];                          /* BFS：起點到 v 的最少邊數 */
int d[MAXV], f[MAXV], timer;             /* DFS：發現時間、完成時間 */

/* ---------- 建圖：串列依編號由小到大排好（考題常說「編號小的先走」） ---------- */
void insertSorted(int v, int w) {
  Node **pp = &list[v];
  while (*pp != NULL && (*pp)->v < w) pp = &(*pp)->next;
  Node *p = malloc(sizeof(Node));
  p->v = w;
  p->next = *pp;
  *pp = p;
}

void addEdge(int u, int v) {             /* 無向圖：兩邊都要記 */
  adj[u][v] = adj[v][u] = 1;
  insertSorted(u, v);
  insertSorted(v, u);
}

void insertFront(int v, int w) {         /* 對照用：插在串列前端，相鄰點順序會反過來 */
  Node *p = malloc(sizeof(Node));
  p->v = w;
  p->next = list[v];
  list[v] = p;
}

void freeGraph(void) {
  for (int v = 0; v < MAXV; v++) {
    while (list[v] != NULL) {
      Node *p = list[v];
      list[v] = p->next;
      free(p);
    }
  }
  memset(adj, 0, sizeof(adj));
}

void resetVisited(void) {
  for (int i = 0; i < n; i++) {
    visited[i] = 0;
    parent[i] = -1;
    dist[i] = -1;
  }
  timer = 0;
}

/* ---------- BFS：用 queue，一層一層往外擴 ---------- */
void bfs(int s) {
  int queue[MAXV], front = 0, rear = 0;
  visited[s] = 1;                        /* 起點先標記再放進 queue */
  dist[s] = 0;
  queue[rear++] = s;
  while (front < rear) {
    int v = queue[front++];              /* 取出 queue 前端 */
    printf("%d ", v);
    for (Node *p = list[v]; p != NULL; p = p->next) {
      int w = p->v;
      if (!visited[w]) {                 /* 第一次看到 w：標記、記父節點、放進 queue */
        visited[w] = 1;
        dist[w] = dist[v] + 1;
        parent[w] = v;                   /* (v, w) 是 BFS 生成樹的樹邊 */
        queue[rear++] = w;
      }
    }
  }
}

void bfsMatrix(int s) {
  int queue[MAXV], front = 0, rear = 0;
  visited[s] = 1;
  queue[rear++] = s;
  while (front < rear) {
    int v = queue[front++];
    printf("%d ", v);
    for (int w = 0; w < n; w++)          /* 整列 n 格都要看：每個頂點 O(n) */
      if (adj[v][w] && !visited[w]) {
        visited[w] = 1;
        queue[rear++] = w;
      }
  }
}

/* ---------- DFS：遞迴（隱形的 stack），能走多深就走多深 ---------- */
void dfs(int v) {
  visited[v] = 1;
  d[v] = ++timer;                        /* 發現時間 */
  printf("%d ", v);
  for (Node *p = list[v]; p != NULL; p = p->next)
    if (!visited[p->v]) {
      parent[p->v] = v;                  /* (v, w) 是 DFS 生成樹的樹邊 */
      dfs(p->v);
    }
  f[v] = ++timer;                        /* 完成時間：v 的相鄰點都處理完了 */
}

void dfsMatrix(int v) {
  visited[v] = 1;
  printf("%d ", v);
  for (int w = 0; w < n; w++)            /* 整列 n 格都要看：每個頂點 O(n) */
    if (adj[v][w] && !visited[w])
      dfsMatrix(w);
}

/* ---------- DFS：自己用 stack，stack 裡就是「目前這條路徑」 ---------- */
void dfsStack(int s) {
  int stack[MAXV], top = -1;
  Node *cur[MAXV];                       /* cur[v]：v 的串列下一個要檢查的位置 */
  for (int i = 0; i < n; i++) cur[i] = list[i];
  visited[s] = 1;
  printf("%d ", s);
  stack[++top] = s;
  while (top != -1) {
    int v = stack[top];                  /* 看 stack 頂端，先不 pop */
    while (cur[v] != NULL && visited[cur[v]->v])
      cur[v] = cur[v]->next;             /* 跳過已經拜訪過的相鄰點 */
    if (cur[v] == NULL) {                /* v 沒有路可走了：pop，退回上一個頂點 */
      top--;
      continue;
    }
    int w = cur[v]->v;
    visited[w] = 1;
    parent[w] = v;
    printf("%d ", w);
    stack[++top] = w;                    /* 往更深的 w 走 */
  }
}

/* 另一種常見寫法：pop 出來才標記，相鄰點全部 push（同一點可能被 push 好幾次） */
void dfsPushAll(int s) {
  int stack[MAXV * MAXV], top = -1;      /* 最多 push 2E + 1 次，不是 V 次 */
  stack[++top] = s;
  while (top != -1) {
    int v = stack[top--];
    if (visited[v]) continue;            /* 已經拜訪過的舊紀錄，直接丟掉 */
    visited[v] = 1;
    printf("%d ", v);
    for (int w = n - 1; w >= 0; w--)     /* 由大到小 push，編號小的才會先被 pop */
      if (adj[v][w] && !visited[w])
        stack[++top] = w;
  }
}

/* ---------- 應用：連通元件、最短路徑 ---------- */
int components(void) {
  int k = 0;
  resetVisited();
  for (int v = 0; v < n; v++)
    if (!visited[v]) {                   /* 還沒被走到的點：屬於一個新的連通元件 */
      printf("元件 %d：", ++k);
      dfs(v);
      printf("\n");
    }
  return k;
}

void printPath(int v) {                  /* 沿著 parent 回推起點，再倒著印出來 */
  if (parent[v] != -1) printPath(parent[v]);
  printf("%d ", v);
}

/* ---------- 測試 ---------- */
void build(int nv, const int e[][2], int m) {
  freeGraph();
  n = nv;
  for (int i = 0; i < m; i++) addEdge(e[i][0], e[i][1]);
}

int main(void) {
  /* 範例圖：8 個頂點、10 條邊 */
  const int E1[][2] = {{0, 1}, {0, 3}, {1, 2}, {1, 4}, {2, 5}, {3, 4}, {4, 5}, {4, 6}, {5, 7}, {6, 7}};
  build(8, E1, 10);

  printf("BFS(0)：");
  resetVisited(); bfs(0); printf("\n");
  printf("dist：");
  for (int v = 0; v < n; v++) printf("%d ", dist[v]);
  printf("\nBFS 樹邊：");
  for (int v = 0; v < n; v++) if (parent[v] != -1) printf("(%d,%d) ", parent[v], v);
  printf("\n0 到 7 的最短路徑：");
  printPath(7);
  printf("\n");

  printf("BFS 矩陣版(0)：");
  resetVisited(); bfsMatrix(0); printf("\n");

  printf("DFS(0)：");
  resetVisited(); dfs(0); printf("\n");
  printf("d/f：");
  for (int v = 0; v < n; v++) printf("%d:%d/%d ", v, d[v], f[v]);
  printf("\nDFS 樹邊：");
  for (int v = 0; v < n; v++) if (parent[v] != -1) printf("(%d,%d) ", parent[v], v);
  printf("\n");

  printf("DFS 矩陣版(0)：");
  resetVisited(); dfsMatrix(0); printf("\n");
  printf("DFS stack 版(0)：");
  resetVisited(); dfsStack(0); printf("\n");
  printf("DFS push-all 版(0)：");
  resetVisited(); dfsPushAll(0); printf("\n");

  for (int s = 0; s < n; s++) {          /* 換起點也都要一致 */
    printf("起點 %d：BFS ", s);
    resetVisited(); bfs(s);
    printf("｜DFS ");
    resetVisited(); dfs(s);
    printf("\n");
  }

  /* 串列用「插在前端」建立：相鄰點順序反過來，走訪順序也跟著變 */
  freeGraph();
  n = 8;
  for (int i = 0; i < 10; i++) {
    insertFront(E1[i][0], E1[i][1]);
    insertFront(E1[i][1], E1[i][0]);
  }
  printf("前端插入 BFS(0)：");
  resetVisited(); bfs(0); printf("\n");
  printf("前端插入 DFS(0)：");
  resetVisited(); dfs(0); printf("\n");

  /* 非連通圖：3 個連通元件 */
  const int E2[][2] = {{0, 2}, {2, 4}, {4, 0}, {1, 5}, {3, 6}, {6, 7}, {3, 7}};
  build(8, E2, 7);
  int k = components();
  printf("共 %d 個連通元件\n", k);

  /* 練習題驗算用 */
  const int E3[][2] = {{0, 1}, {0, 2}, {0, 5}, {1, 3}, {2, 3}, {2, 4}, {3, 6}, {4, 6}, {5, 6}};
  build(7, E3, 9);
  printf("Q 圖 BFS(0)：");
  resetVisited(); bfs(0); printf("\n");
  printf("Q 圖 DFS(0)：");
  resetVisited(); dfs(0); printf("\n");
  printf("Q 圖 d/f：");
  for (int v = 0; v < n; v++) printf("%d:%d/%d ", v, d[v], f[v]);
  printf("\nQ 圖 BFS(0) 的 dist：");
  resetVisited(); bfs(0);
  printf("→ ");
  for (int v = 0; v < n; v++) printf("%d ", dist[v]);
  printf("\nQ 圖 BFS(3)：");
  resetVisited(); bfs(3); printf("\n");
  printf("Q 圖 DFS(3)：");
  resetVisited(); dfs(3); printf("\n");

  freeGraph();
  return 0;
}
