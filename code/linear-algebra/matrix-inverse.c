/* Elementary Matrices and Inverses（基本矩陣與反矩陣）完整程式：只用來編譯驗證，頁面上的片段都從這裡取出 */
#include <stdio.h>
#include <stdlib.h>

/* ---------- 精確分數：分子分母都是整數，永遠約到最簡、分母為正 ---------- */
typedef struct { long long n, d; } Frac;

long long gcdll(long long a, long long b) {
  if (a < 0) a = -a;
  if (b < 0) b = -b;
  while (b) { long long t = a % b; a = b; b = t; }
  return a ? a : 1;
}

Frac frac(long long n, long long d) {          /* 建立分數並約分 */
  if (d < 0) { n = -n; d = -d; }
  long long g = gcdll(n, d);
  Frac f = { n / g, d / g };
  return f;
}
Frac fadd(Frac x, Frac y) { return frac(x.n * y.d + y.n * x.d, x.d * y.d); }
Frac fsub(Frac x, Frac y) { return frac(x.n * y.d - y.n * x.d, x.d * y.d); }
Frac fmul(Frac x, Frac y) { return frac(x.n * y.n, x.d * y.d); }
Frac fdiv(Frac x, Frac y) { return frac(x.n * y.d, x.d * y.n); }   /* 呼叫前要確定 y 不是 0 */
int isZero(Frac x) { return x.n == 0; }
int isOne(Frac x) { return x.n == 1 && x.d == 1; }

#define MAXN 4
Frac aug[MAXN][2 * MAXN];                      /* 增廣矩陣 [A | I]，左半 n 行、右半 n 行 */
int n;

void swapRows(int r1, int r2) {
  for (int j = 0; j < 2 * n; j++) { Frac t = aug[r1][j]; aug[r1][j] = aug[r2][j]; aug[r2][j] = t; }
}

/* ---------- Gauss–Jordan 求反矩陣：[A | I] → [I | A⁻¹] ---------- */
int inverse(Frac A[MAXN][MAXN], Frac inv[MAXN][MAXN]) {   /* 可逆回傳 1，不可逆回傳 0 */
  for (int i = 0; i < n; i++)
    for (int j = 0; j < n; j++) {
      aug[i][j] = A[i][j];                     /* 左半放 A */
      aug[i][n + j] = frac(i == j, 1);         /* 右半放單位矩陣 I */
    }
  int r = 0;
  for (int c = 0; c < n; c++) {
    int p = r;
    while (p < n && isZero(aug[p][c])) p++;    /* 往下找第一個非零的當 pivot */
    if (p == n) continue;                      /* 這一行沒有 pivot：A 不可逆 */
    if (p != r) swapRows(r, p);                /* 第 1 型：列交換 */
    Frac piv = aug[r][c];
    for (int j = 0; j < 2 * n; j++) aug[r][j] = fdiv(aug[r][j], piv);   /* 第 2 型：pivot 變成 1 */
    for (int i = 0; i < n; i++)                /* 第 3 型：同一行其他列消成 0 */
      if (i != r && !isZero(aug[i][c])) {
        Frac f = aug[i][c];
        for (int j = 0; j < 2 * n; j++) aug[i][j] = fsub(aug[i][j], fmul(f, aug[r][j]));
      }
    r++;
  }
  if (r < n) return 0;                         /* pivot 不到 n 個：左半最後會有零列 */
  for (int i = 0; i < n; i++)
    for (int j = 0; j < n; j++) inv[i][j] = aug[i][n + j];   /* 右半就是 A⁻¹ */
  return 1;
}

/* ---------- 驗證：A·B 是不是單位矩陣 ---------- */
void matMul(Frac X[MAXN][MAXN], Frac Y[MAXN][MAXN], Frac Z[MAXN][MAXN]) {
  for (int i = 0; i < n; i++)
    for (int j = 0; j < n; j++) {
      Frac s = frac(0, 1);
      for (int k = 0; k < n; k++) s = fadd(s, fmul(X[i][k], Y[k][j]));
      Z[i][j] = s;
    }
}

int isIdentity(Frac Z[MAXN][MAXN]) {
  for (int i = 0; i < n; i++)
    for (int j = 0; j < n; j++)
      if (Z[i][j].n != (i == j) || Z[i][j].d != 1) return 0;
  return 1;
}

/* ---------- 三種基本矩陣：對 I 做一次列運算 ---------- */
void identity(Frac E[MAXN][MAXN]) {
  for (int i = 0; i < n; i++)
    for (int j = 0; j < n; j++) E[i][j] = frac(i == j, 1);
}
void elemSwap(Frac E[MAXN][MAXN], int i, int j) {          /* 第 1 型：R_i ↔ R_j */
  identity(E);
  E[i][i] = E[j][j] = frac(0, 1);
  E[i][j] = E[j][i] = frac(1, 1);
}
void elemScale(Frac E[MAXN][MAXN], int i, Frac c) {        /* 第 2 型：R_i ← cR_i（c ≠ 0） */
  identity(E);
  E[i][i] = c;
}
void elemAdd(Frac E[MAXN][MAXN], int i, int j, Frac c) {   /* 第 3 型：R_i ← R_i + cR_j */
  identity(E);
  E[i][j] = c;
}

/* ---------- 2×2 公式：交換對角、非對角變號、除以 det ---------- */
int inverse2(Frac A[MAXN][MAXN], Frac inv[MAXN][MAXN]) {
  Frac det = fsub(fmul(A[0][0], A[1][1]), fmul(A[0][1], A[1][0]));   /* ad − bc */
  if (isZero(det)) return 0;
  inv[0][0] = fdiv(A[1][1], det);
  inv[0][1] = fdiv(frac(-A[0][1].n, A[0][1].d), det);
  inv[1][0] = fdiv(frac(-A[1][0].n, A[1][0].d), det);
  inv[1][1] = fdiv(A[0][0], det);
  return 1;
}

/* ===================== 以下只用來測試 ===================== */
void printFrac(Frac x) {
  char buf[32];
  if (x.d == 1) snprintf(buf, sizeof buf, "%lld", x.n);
  else snprintf(buf, sizeof buf, "%lld/%lld", x.n, x.d);
  printf("%7s", buf);
}

void printMat(const char *name, Frac M[MAXN][MAXN]) {
  printf("%s =\n", name);
  for (int i = 0; i < n; i++) {
    for (int j = 0; j < n; j++) printFrac(M[i][j]);
    printf("\n");
  }
}

void printAug(void) {
  for (int i = 0; i < n; i++) {
    for (int j = 0; j < 2 * n; j++) {
      if (j == n) printf("  |");
      printFrac(aug[i][j]);
    }
    printf("\n");
  }
}

void load(int size, const int *v, Frac A[MAXN][MAXN]) {
  n = size;
  for (int i = 0; i < n; i++)
    for (int j = 0; j < n; j++) A[i][j] = frac(v[i * n + j], 1);
}

void copyMat(Frac S[MAXN][MAXN], Frac D[MAXN][MAXN]) {
  for (int i = 0; i < n; i++)
    for (int j = 0; j < n; j++) D[i][j] = S[i][j];
}

int sameMat(Frac X[MAXN][MAXN], Frac Y[MAXN][MAXN]) {
  for (int i = 0; i < n; i++)
    for (int j = 0; j < n; j++)
      if (X[i][j].n != Y[i][j].n || X[i][j].d != Y[i][j].d) return 0;
  return 1;
}

/* 用「乘基本矩陣」重做一次 Gauss–Jordan：P = E_k⋯E_1，驗證 P = A⁻¹、P·A = I；回傳用了幾個基本矩陣 */
int inverseByElementary(Frac A[MAXN][MAXN], Frac P[MAXN][MAXN], int verbose) {
  Frac M[MAXN][MAXN], E[MAXN][MAXN], T[MAXN][MAXN];
  copyMat(A, M);
  identity(P);
  int r = 0, k = 0;
  for (int c = 0; c < n; c++) {
    int p = r;
    while (p < n && isZero(M[p][c])) p++;
    if (p == n) continue;
    if (p != r) {
      elemSwap(E, r, p); k++;
      if (verbose) printf("  E%d：第 1 型 R%d <-> R%d\n", k, r + 1, p + 1);
      matMul(E, M, T); copyMat(T, M); matMul(E, P, T); copyMat(T, P);
    }
    if (!isOne(M[r][c])) {
      Frac cc = fdiv(frac(1, 1), M[r][c]);
      elemScale(E, r, cc); k++;
      if (verbose) { printf("  E%d：第 2 型 R%d <- (", k, r + 1); printFrac(cc); printf(") R%d\n", r + 1); }
      matMul(E, M, T); copyMat(T, M); matMul(E, P, T); copyMat(T, P);
    }
    for (int i = 0; i < n; i++)
      if (i != r && !isZero(M[i][c])) {
        Frac cc = frac(-M[i][c].n, M[i][c].d);
        elemAdd(E, i, r, cc); k++;
        if (verbose) { printf("  E%d：第 3 型 R%d <- R%d + (", k, i + 1, i + 1); printFrac(cc); printf(") R%d\n", r + 1); }
        matMul(E, M, T); copyMat(T, M); matMul(E, P, T); copyMat(T, P);
      }
    r++;
  }
  return r == n ? k : -1;
}

void run(const char *name, int size, const int *v) {
  Frac A[MAXN][MAXN], inv[MAXN][MAXN], Z[MAXN][MAXN], P[MAXN][MAXN];
  load(size, v, A);
  printf("===== %s =====\n", name);
  printMat("A", A);
  if (inverse(A, inv)) {
    printMat("A^-1", inv);
    matMul(A, inv, Z);
    int ok1 = isIdentity(Z);
    matMul(inv, A, Z);
    int ok2 = isIdentity(Z);
    printf("A*A^-1 = I ? %s   A^-1*A = I ? %s\n", ok1 ? "yes" : "NO", ok2 ? "yes" : "NO");
    int k = inverseByElementary(A, P, 1);
    printf("用 %d 個基本矩陣，E_k...E_1 = A^-1 ? %s\n", k, sameMat(P, inv) ? "yes" : "NO");
  } else {
    printf("不可逆；Gauss-Jordan 之後的 [A | I]：\n");
    printAug();
    /* 零列右半 y 滿足 y·A = 0：說明 A 的列線性相依 */
    for (int i = 0; i < n; i++) {
      int zero = 1;
      for (int j = 0; j < n; j++) if (!isZero(aug[i][j])) zero = 0;
      if (!zero) continue;
      int ok = 1;
      for (int j = 0; j < n; j++) {
        Frac s = frac(0, 1);
        for (int k = 0; k < n; k++) s = fadd(s, fmul(aug[i][n + k], A[k][j]));
        if (!isZero(s)) ok = 0;
      }
      printf("  第 %d 列左半為零；右半 y 滿足 y*A = 0 ? %s\n", i + 1, ok ? "yes" : "NO");
    }
  }
}

/* 計數：利用右半邊 I 的零結構時，Gauss–Jordan 求反矩陣需要幾次乘除法 */
long long countInverseOps(long long size) {
  long long cnt = 0;
  for (long long k = 0; k < size; k++) {
    long long live = (size - k - 1) + (k + 1);   /* 左半 pivot 右邊的格子 + 右半已經非零的 k+1 行 */
    cnt += live;                                 /* 第 2 型：整列除以 pivot */
    cnt += (size - 1) * live;                    /* 第 3 型：其他 n−1 列各做一次 */
  }
  return cnt;
}

int main(void) {
  int ex3[] = {1, 2, 0,  2, 5, 1,  0, 1, 3};            /* 可逆的 3×3（動畫預設） */
  int exSwap[] = {0, 1, 2,  1, 1, 1,  2, 3, 5};         /* 第一個 pivot 是 0，要換列 */
  int exSing[] = {1, 2, 3,  2, 1, 4,  3, 3, 7};         /* R3 = R1 + R2，不可逆 */
  int ex2[] = {3, 1,  5, 2};                            /* 2×2 公式的例子 */
  int ex4[] = {1, 1, 0, 0,  1, 2, 1, 0,  0, 1, 2, 1,  0, 0, 1, 2};   /* 4×4 */
  run("可逆的 3x3", 3, ex3);
  run("需要換列", 3, exSwap);
  run("不可逆", 3, exSing);
  run("2x2", 2, ex2);
  run("4x4", 4, ex4);

  /* 2×2 公式與 Gauss–Jordan 一致 */
  Frac A[MAXN][MAXN], I1[MAXN][MAXN], I2[MAXN][MAXN], E[MAXN][MAXN], T[MAXN][MAXN];
  load(2, ex2, A);
  inverse(A, I1); inverse2(A, I2);
  printf("2x2 公式 = Gauss-Jordan ? %s\n", sameMat(I1, I2) ? "yes" : "NO");

  /* 左乘基本矩陣 = 做列運算：E = (R2 ← R2 − 2R1) 乘上 ex3 */
  load(3, ex3, A);
  elemAdd(E, 1, 0, frac(-2, 1));
  matMul(E, A, T);
  printMat("E (R2 <- R2 - 2R1)", E);
  printMat("E*A", T);
  /* 基本矩陣的反矩陣 */
  Frac Ei[MAXN][MAXN], Fi[MAXN][MAXN];
  inverse(E, Ei);
  elemAdd(Fi, 1, 0, frac(2, 1));
  printf("E^-1 = (R2 <- R2 + 2R1) ? %s\n", sameMat(Ei, Fi) ? "yes" : "NO");
  elemScale(E, 2, frac(1, 3)); inverse(E, Ei); elemScale(Fi, 2, frac(3, 1));
  printf("(R3 <- 1/3 R3)^-1 = (R3 <- 3 R3) ? %s\n", sameMat(Ei, Fi) ? "yes" : "NO");
  elemSwap(E, 0, 2); inverse(E, Ei);
  printf("(R1 <-> R3)^-1 = 自己 ? %s\n", sameMat(Ei, E) ? "yes" : "NO");

  /* (AB)^-1 = B^-1 A^-1 */
  Frac B[MAXN][MAXN], AB[MAXN][MAXN], ABi[MAXN][MAXN], Ai[MAXN][MAXN], Bi[MAXN][MAXN], BiAi[MAXN][MAXN], AiBi[MAXN][MAXN];
  load(3, ex3, A); load(3, exSwap, B);
  matMul(A, B, AB); inverse(AB, ABi); inverse(A, Ai); inverse(B, Bi);
  matMul(Bi, Ai, BiAi); matMul(Ai, Bi, AiBi);
  printf("(AB)^-1 = B^-1 A^-1 ? %s；= A^-1 B^-1 ? %s\n", sameMat(ABi, BiAi) ? "yes" : "NO", sameMat(ABi, AiBi) ? "yes" : "NO");

  /* 練習題用到的矩陣 */
  int q10[] = {4, 7,  1, 2};
  int q11[] = {1, 0, 2,  2, 1, 3,  0, 1, 1};
  int q12[] = {0, 2,  1, 3};
  int q14[] = {1, 1, 1,  1, 2, 3,  1, 3, 6};
  int q14s[] = {1, 1, 1,  1, 2, 3,  1, 3, 5};
  run("q10", 2, q10);
  run("q11", 3, q11);
  run("q12", 2, q12);
  run("q14 k=6", 3, q14);
  run("q14 k=5", 3, q14s);
  for (int k = 3; k <= 7; k++) {
    int q[] = {1, 1, 1,  1, 2, 3,  1, 3, 0};
    q[8] = k;
    Frac M[MAXN][MAXN], Mi[MAXN][MAXN];
    load(3, q, M);
    printf("k = %d：%s\n", k, inverse(M, Mi) ? "可逆" : "不可逆");
  }

  /* 運算量 */
  for (long long s = 1; s <= 100; s *= 10) {
    long long gj = countInverseOps(s), ge = (s * s * s - s) / 3 + s * s;
    printf("n = %lld：求反矩陣 %lld 次（= n^3 ? %s），再乘 b 要 %lld 次；高斯消去解一次 %lld 次\n",
           s, gj, gj == s * s * s ? "yes" : "NO", s * s, ge);
  }
  return 0;
}
