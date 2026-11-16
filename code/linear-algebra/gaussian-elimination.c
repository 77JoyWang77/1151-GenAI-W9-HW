/* Gaussian Elimination（高斯消去法與列梯形）完整程式：只用來編譯驗證，頁面上的片段都從這裡取出 */
#include <stdio.h>
#include <math.h>

#define MAXR 8
#define MAXC 9
#define EPS 1e-9
double a[MAXR][MAXC];                          /* 增廣矩陣 [A | b] */
int m, n;                                      /* m 列；n 行（含最後一行常數 b） */

void swapRows(int r1, int r2) {
  for (int j = 0; j < n; j++) { double t = a[r1][j]; a[r1][j] = a[r2][j]; a[r2][j] = t; }
}

/* ---------- 高斯消去：化成列梯形（REF），再回代 ---------- */
int forwardElim(void) {                        /* 回傳 pivot 個數；假設方陣且有唯一解時才回代 */
  int r = 0;
  for (int c = 0; c < n - 1 && r < m; c++) {
    int p = r;
    while (p < m && fabs(a[p][c]) < EPS) p++;  /* 往下找第一個非零的當 pivot */
    if (p == m) continue;                      /* 這一行都是 0：沒有 pivot */
    swapRows(r, p);
    for (int i = r + 1; i < m; i++) {          /* 只消去 pivot 下面的列 */
      double f = a[i][c] / a[r][c];
      for (int j = c; j < n; j++) a[i][j] -= f * a[r][j];
    }
    r++;
  }
  return r;
}

void backSub(double x[]) {                     /* 上三角（n-1 個未知數）由下往上回代 */
  int k = n - 1;
  for (int i = k - 1; i >= 0; i--) {
    double s = a[i][k];
    for (int j = i + 1; j < k; j++) s -= a[i][j] * x[j];
    x[i] = s / a[i][i];
  }
}

/* ---------- Gauss–Jordan：化成簡化列梯形（RREF）---------- */
int rref(int pivotCol[]) {                     /* 回傳 rank；pivotCol[k] 是第 k 個 pivot 所在的行 */
  int r = 0;
  for (int c = 0; c < n && r < m; c++) {
    int p = r;
    while (p < m && fabs(a[p][c]) < EPS) p++;  /* 往下找第一個非零的當 pivot */
    if (p == m) continue;                      /* 這一行沒有 pivot：對應自由變數 */
    if (p != r) swapRows(r, p);                /* 列交換：把 pivot 換到第 r 列 */
    double piv = a[r][c];
    for (int j = 0; j < n; j++) a[r][j] /= piv;   /* 列乘以常數：pivot 變成 1 */
    for (int i = 0; i < m; i++)                /* 列相加：把同一行其他列消成 0 */
      if (i != r && fabs(a[i][c]) > EPS) {
        double f = a[i][c];
        for (int j = 0; j < n; j++) a[i][j] -= f * a[r][j];
      }
    pivotCol[r++] = c;
  }
  return r;
}

/* 0 = 無解，1 = 唯一解，2 = 無限多解 */
int classify(int rank, int pivotCol[]) {
  if (rank > 0 && pivotCol[rank - 1] == n - 1) return 0;   /* pivot 落在常數行：出現 0 = 1 */
  if (rank == n - 1) return 1;                 /* 每個未知數都有 pivot */
  return 2;                                    /* 有沒有 pivot 的行：自由變數 */
}

/* ---------- 測試 ---------- */
void load(int rows, int cols, const double *v) {
  m = rows; n = cols;
  for (int i = 0; i < m; i++) for (int j = 0; j < n; j++) a[i][j] = v[i * n + j];
}

void print(void) {
  for (int i = 0; i < m; i++) {
    for (int j = 0; j < n; j++) printf(j == n - 1 ? " | %6.3f" : "%7.3f", fabs(a[i][j]) < EPS ? 0.0 : a[i][j]);
    printf("\n");
  }
}

void run(const char *name, int rows, int cols, const double *v) {
  int piv[MAXC];
  const char *kind[] = {"無解", "唯一解", "無限多解"};
  load(rows, cols, v);
  int rank = rref(piv);
  printf("[%s] rank = %d，%s\n", name, rank, kind[classify(rank, piv)]);
  print();
}

int main(void) {
  double u[] = {1, 1, 1, 6,    2, -1, 1, 3,  1, 2, -1, 2};      /* 唯一解 x = (1, 2, 3) */
  double s[] = {0, 2, 1, 7,    1, 1, 1, 6,   2, 1, 3, 13};      /* 第一個 pivot 是 0，要列交換 */
  double inf[] = {1, 2, -1, 1, 2, 4, 1, 8,   3, 6, 0, 9};       /* 無限多解 */
  double no[] = {1, 1, 2, 3,   2, 3, 1, 5,   3, 4, 3, 9};       /* 無解 */
  run("唯一解", 3, 4, u);
  run("需要列交換", 3, 4, s);
  run("無限多解", 3, 4, inf);
  run("無解", 3, 4, no);

  double x[MAXC];
  load(3, 4, u);
  forwardElim();
  printf("[REF + 回代]\n");
  print();
  backSub(x);
  printf("x = (%g, %g, %g)\n", x[0], x[1], x[2]);
  return 0;
}
