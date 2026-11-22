/* Banker's Algorithm（銀行家演算法）完整程式：只用來編譯驗證，頁面上的片段都從這裡取出 */
#include <stdio.h>

#define N 10                                   /* 最多行程數 */
#define M 10                                   /* 最多資源種類數 */

int n, m;                                      /* n 個行程、m 種資源 */
int Available[M];                              /* 每種資源目前還剩幾個 */
int Max[N][M];                                 /* 每個行程宣告的最大需求 */
int Allocation[N][M];                          /* 每個行程目前已經拿到的 */
int Need[N][M];                                /* 還可能再要的 = Max - Allocation */

void computeNeed(void) {
  for (int i = 0; i < n; i++)
    for (int j = 0; j < m; j++)
      Need[i][j] = Max[i][j] - Allocation[i][j];
}

/* 向量比較：a 的每一項都 <= b 才算 a <= b */
int lessEq(const int a[], const int b[]) {
  for (int j = 0; j < m; j++)
    if (a[j] > b[j]) return 0;
  return 1;
}

/* 安全演算法：安全回傳 1，並把安全序列放進 seq[]；不安全回傳 0 */
int isSafe(int seq[]) {
  int Work[M], Finish[N] = {0}, count = 0;
  for (int j = 0; j < m; j++) Work[j] = Available[j];
  while (count < n) {
    int found = -1;
    for (int i = 0; i < n && found == -1; i++)   /* 每輪從 P0 開始，找第一個做得完的 */
      if (!Finish[i] && lessEq(Need[i], Work)) found = i;
    if (found == -1) return 0;                    /* 沒有人做得完：unsafe */
    for (int j = 0; j < m; j++)
      Work[j] += Allocation[found][j];            /* 它做完會歸還全部資源 */
    Finish[found] = 1;
    seq[count++] = found;
  }
  return 1;
}

/* 另一種掃描方式：找到一個之後不回頭，接著往下掃，掃到底再從頭 */
int isSafeSweep(int seq[]) {
  int Work[M], Finish[N] = {0}, count = 0, progress = 1;
  for (int j = 0; j < m; j++) Work[j] = Available[j];
  while (progress) {                              /* 整輪都沒人做得完才停 */
    progress = 0;
    for (int i = 0; i < n; i++)
      if (!Finish[i] && lessEq(Need[i], Work)) {
        for (int j = 0; j < m; j++) Work[j] += Allocation[i][j];
        Finish[i] = 1;
        seq[count++] = i;
        progress = 1;
      }
  }
  return count == n;
}

/* 資源請求演算法：P[p] 要求 Request[]
   回傳 1 = 配置成功、0 = 會變 unsafe 要等、-1 = 超過宣告的最大需求、-2 = 資源不夠要等 */
int request(int p, const int Request[], int seq[]) {
  if (!lessEq(Request, Need[p])) return -1;      /* 要的比當初宣告的還多：錯誤 */
  if (!lessEq(Request, Available)) return -2;    /* 現在的資源不夠：只能等 */
  for (int j = 0; j < m; j++) {                  /* 先假裝配置給它 */
    Available[j] -= Request[j];
    Allocation[p][j] += Request[j];
    Need[p][j] -= Request[j];
  }
  if (isSafe(seq)) return 1;                     /* 配置後仍安全：真的給 */
  for (int j = 0; j < m; j++) {                  /* 不安全：復原，P[p] 等待 */
    Available[j] += Request[j];
    Allocation[p][j] -= Request[j];
    Need[p][j] += Request[j];
  }
  return 0;
}

/* ---------- 以下為測試 ---------- */
void load(int nn, int mm, const int av[], const int mx[][3], const int al[][3]) {
  n = nn; m = mm;
  for (int j = 0; j < m; j++) Available[j] = av[j];
  for (int i = 0; i < n; i++)
    for (int j = 0; j < m; j++) { Max[i][j] = mx[i][j]; Allocation[i][j] = al[i][j]; }
  computeNeed();
}

void printSeq(const char *title, int ok, const int seq[]) {
  printf("%s：", title);
  if (!ok) { printf("unsafe\n"); return; }
  for (int i = 0; i < n; i++) printf("P%d%s", seq[i], i + 1 < n ? " -> " : "\n");
}

void printNeed(void) {
  printf("Need：");
  for (int i = 0; i < n; i++) {
    printf("P%d(", i);
    for (int j = 0; j < m; j++) printf("%d%s", Need[i][j], j + 1 < m ? " " : ")");
    printf(i + 1 < n ? " " : "\n");
  }
}

static const int AV[3] = {2, 2, 2};
static const int MX[5][3] = {{5, 3, 2}, {3, 2, 2}, {2, 4, 3}, {4, 1, 4}, {6, 3, 3}};
static const int AL[5][3] = {{1, 1, 0}, {2, 0, 1}, {0, 2, 1}, {3, 0, 2}, {1, 1, 1}};

void tryRequest(int p, int a, int b, int c) {
  int req[3] = {a, b, c}, seq[N];
  load(5, 3, AV, MX, AL);
  int r = request(p, req, seq);
  printf("P%d 請求 (%d %d %d)：", p, a, b, c);
  if (r == 1) { printf("配置，"); printSeq("安全序列", 1, seq); }
  else if (r == 0) printf("配置後 unsafe，拒絕（等待）\n");
  else if (r == -1) printf("超過 Need，錯誤\n");
  else printf("超過 Available，等待\n");
}

int main(void) {
  int seq[N];
  load(5, 3, AV, MX, AL);
  printNeed();
  printSeq("isSafe（每輪從 P0）", isSafe(seq), seq);
  printSeq("isSafeSweep（接著往下）", isSafeSweep(seq), seq);

  /* unsafe 範例：同樣的 Max、Allocation，Available 換成 (1 1 2) 再檢查 */
  static const int AV2[3] = {1, 1, 2};
  load(5, 3, AV2, MX, AL);
  printSeq("Available = (1 1 2)", isSafe(seq), seq);

  tryRequest(3, 1, 0, 1);   /* 安全，配置 */
  tryRequest(4, 2, 0, 0);   /* 看起來夠，但配置後 unsafe */
  tryRequest(1, 0, 3, 0);   /* 超過 Need */
  tryRequest(0, 3, 0, 0);   /* 超過 Available */
  return 0;
}
