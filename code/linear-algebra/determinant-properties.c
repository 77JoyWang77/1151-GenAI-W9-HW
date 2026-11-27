/* Determinants and Their Properties（行列式與其性質）
 * - detCofactor()：沿第 1 列餘因子展開（遞迴）
 * - expandAlongRow()：沿任意一列展開，驗證每一列結果都一樣
 * - detElim()：列運算化成上三角，det = 正負號 × 對角線乘積
 * - opSwap() / opScale() / opAdd()：三種列運算對 det 的影響
 * - countNonzeroTerms()：排列展開中非零項的個數
 * 編譯：gcc -std=c99 -Wall -Wextra -fsanitize=address,undefined determinant-properties.c
 */
#include <stdio.h>
#include <string.h>

#define MAXN 6

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
int absGreater(Frac x, Frac y) {               /* |x| > |y| ? */
  long long a = x.n < 0 ? -x.n : x.n, b = y.n < 0 ? -y.n : y.n;
  return a * y.d > b * x.d;
}

void printFrac(Frac x) {
  if (x.d == 1) printf("%lld", x.n);
  else printf("%lld/%lld", x.n, x.d);
}

void load(int size, const int *v, Frac A[MAXN][MAXN]) {
  for (int i = 0; i < size; i++)
    for (int j = 0; j < size; j++) A[i][j] = frac(v[i * size + j], 1);
}

void copyMat(Frac A[MAXN][MAXN], Frac B[MAXN][MAXN], int size) {
  for (int i = 0; i < size; i++)
    for (int j = 0; j < size; j++) B[i][j] = A[i][j];
}

/* ---------- 餘因子展開 ---------- */
void minorOf(Frac A[MAXN][MAXN], int size, int r, int c, Frac M[MAXN][MAXN]) {
  for (int i = 0, mi = 0; i < size; i++) {     /* 刪掉第 r 列、第 c 行 */
    if (i == r) continue;
    for (int j = 0, mj = 0; j < size; j++) {
      if (j == c) continue;
      M[mi][mj++] = A[i][j];
    }
    mi++;
  }
}

Frac detCofactor(Frac A[MAXN][MAXN], int size) {     /* 沿第 1 列餘因子展開（遞迴） */
  if (size == 1) return A[0][0];
  Frac d = frac(0, 1);
  for (int c = 0; c < size; c++) {
    if (isZero(A[0][c])) continue;               /* 0 的那一項不用算 */
    Frac M[MAXN][MAXN];
    minorOf(A, size, 0, c, M);                   /* 刪掉第 1 列、第 c+1 行 */
    Frac term = fmul(A[0][c], detCofactor(M, size - 1));
    d = (c % 2 == 0) ? fadd(d, term) : fsub(d, term);   /* 符號 (−1)^(1+j) */
  }
  return d;
}

Frac expandAlongRow(Frac A[MAXN][MAXN], int size, int r) {   /* 沿第 r+1 列展開 */
  Frac d = frac(0, 1);
  for (int c = 0; c < size; c++) {
    if (isZero(A[r][c])) continue;
    Frac M[MAXN][MAXN];
    minorOf(A, size, r, c, M);
    Frac cof = detCofactor(M, size - 1);         /* 子行列式 M_rc */
    if ((r + c) % 2 == 1) cof = fmul(cof, frac(-1, 1));   /* 餘因子 C_rc = (−1)^(r+c) M_rc */
    d = fadd(d, fmul(A[r][c], cof));
  }
  return d;
}

/* ---------- 列運算化上三角 ---------- */
void swapRows(Frac U[MAXN][MAXN], int size, int a, int b) {
  for (int j = 0; j < size; j++) { Frac t = U[a][j]; U[a][j] = U[b][j]; U[b][j] = t; }
}

Frac detElim(Frac A[MAXN][MAXN], int size, int pickMax) {   /* 化成上三角，det = 正負號 × 對角線乘積 */
  Frac U[MAXN][MAXN];
  copyMat(A, U, size);
  int sign = 1;                                  /* 每交換一次列就變號 */
  for (int c = 0; c < size; c++) {
    int p = c;                                   /* 在第 c 行、第 c 列以下找 pivot */
    for (int i = c; i < size; i++) {
      if (isZero(U[p][c]) && !isZero(U[i][c])) p = i;    /* 預設：第一個非零 */
      if (pickMax && absGreater(U[i][c], U[p][c])) p = i;   /* 選項：絕對值最大 */
    }
    if (isZero(U[p][c])) return frac(0, 1);      /* 這一行往下全是 0：det = 0 */
    if (p != c) { swapRows(U, size, p, c); sign = -sign; }   /* 列交換：det 變號 */
    for (int i = c + 1; i < size; i++) {         /* 列加上倍數：det 不變 */
      if (isZero(U[i][c])) continue;
      Frac f = fdiv(U[i][c], U[c][c]);
      for (int j = c; j < size; j++) U[i][j] = fsub(U[i][j], fmul(f, U[c][j]));
    }
  }
  Frac d = frac(sign, 1);
  for (int i = 0; i < size; i++) d = fmul(d, U[i][i]);   /* 上三角：det = 對角線乘積 */
  return d;
}

/* ---------- 三種列運算對 det 的影響 ---------- */
/* 對 A 做一次列運算；factor 記錄 det(新矩陣) = factor × det(原矩陣) */
void opSwap(Frac A[MAXN][MAXN], int size, int i, int j, Frac *factor) {
  swapRows(A, size, i, j);                       /* R_i ↔ R_j：det 乘 −1 */
  *factor = fmul(*factor, frac(-1, 1));
}
void opScale(Frac A[MAXN][MAXN], int size, int i, Frac c, Frac *factor) {
  for (int k = 0; k < size; k++) A[i][k] = fmul(c, A[i][k]);   /* R_i ← cR_i：det 乘 c */
  *factor = fmul(*factor, c);
}
void opAdd(Frac A[MAXN][MAXN], int size, int i, int j, Frac c, Frac *factor) {
  for (int k = 0; k < size; k++) A[i][k] = fadd(A[i][k], fmul(c, A[j][k]));   /* R_i ← R_i + cR_j：det 不變 */
  (void)factor;
}

/* ---------- 排列展開 ---------- */
int perm[MAXN], used[MAXN];
long long termCount;

void enumerate(const int *pattern, int size, int row) {   /* pattern[i*size+j] != 0 表示該位置非零 */
  if (row == size) { termCount++; return; }
  for (int c = 0; c < size; c++) {
    if (used[c] || !pattern[row * size + c]) continue;   /* 每列選一個非零、各在不同行 */
    used[c] = 1; perm[row] = c;
    enumerate(pattern, size, row + 1);
    used[c] = 0;
  }
}

long long countNonzeroTerms(const int *pattern, int size) {
  termCount = 0;
  memset(used, 0, sizeof used);
  enumerate(pattern, size, 0);
  return termCount;
}

int inversions(const int *p, int size) {        /* 逆序數：奇數 → 該項取負號 */
  int inv = 0;
  for (int i = 0; i < size; i++)
    for (int j = i + 1; j < size; j++)
      if (p[i] > p[j]) inv++;
  return inv;
}

/* ---------- 運算量：餘因子展開 vs 列運算 ---------- */
long long cofactorMults(int size) {             /* T(n) = n·(T(n−1) + 1)，T(1) = 0 */
  if (size == 1) return 0;
  return size * (cofactorMults(size - 1) + 1);
}
long long elimMults(int size) {                 /* 第 k 步：n−k 列 × (1 次除法 + n−k 次乘法)，最後 n−1 次乘對角線 */
  long long cnt = 0;
  for (int k = 1; k < size; k++) cnt += (long long)(size - k) * (size - k + 1);
  return cnt + (size - 1);
}

/* ---------- 測試 ---------- */
void report(const char *name, int size, const int *v) {
  Frac A[MAXN][MAXN];
  load(size, v, A);
  Frac d1 = detCofactor(A, size), d2 = detElim(A, size, 0), d3 = detElim(A, size, 1);
  int ok = d1.n == d2.n && d1.d == d2.d && d1.n == d3.n && d1.d == d3.d;
  for (int r = 0; r < size; r++) {
    Frac e = expandAlongRow(A, size, r);
    if (e.n != d1.n || e.d != d1.d) ok = 0;
  }
  printf("%-28s det = ", name);
  printFrac(d1);
  printf("  %s\n", ok ? "(三種方法一致)" : "(不一致！)");
}

Frac detOf(int size, const int *v) {
  Frac A[MAXN][MAXN];
  load(size, v, A);
  return detElim(A, size, 0);
}

int main(void) {
  /* 頁面例子 */
  int area[] = {3, 1,  1, 2};
  int cof3[] = {2, -1, 3,  1, 0, 4,  -2, 5, 1};
  int demo4[] = {0, 2, 1, 3,  1, 1, 0, 2,  2, 4, 1, 5,  1, 3, 2, 2};
  int spot[] = {1, 2, 3,  4, 5, 6,  5, 7, 9};
  int vand[] = {1, 2, 4,  1, 3, 9,  1, 5, 25};
  int block[] = {2, 1, 7, 4,  1, 3, 5, 6,  0, 0, 4, 1,  0, 0, 2, 3};
  int sparse[] = {1, 0, 2, 0,  3, 0, 1, 2,  0, 0, 5, 0,  4, 1, 6, 3};
  report("2x2 面積", 2, area);
  report("3x3 餘因子", 3, cof3);
  report("4x4 動畫預設（要換列）", 4, demo4);
  report("3x3 R3 = R1 + R2", 3, spot);
  report("Vandermonde 2,3,5", 3, vand);
  report("區塊上三角", 4, block);
  report("零很多的 4x4", 4, sparse);

  /* 三種列運算：從 cof3 出發 */
  Frac A[MAXN][MAXN], factor = frac(1, 1);
  load(3, cof3, A);
  opSwap(A, 3, 0, 1, &factor);
  opScale(A, 3, 2, frac(3, 1), &factor);
  opAdd(A, 3, 1, 0, frac(-2, 1), &factor);
  printf("cof3 做 R1<->R2、R3<-3R3、R2<-R2-2R1：factor = ");
  printFrac(factor);
  printf("，det(新) = ");
  printFrac(detCofactor(A, 3));
  printf("（應為 factor × det(原)）\n");

  /* 性質 */
  int P[] = {1, 2, 0,  3, 1, 1,  0, 2, 4}, Q[] = {2, 0, 1,  1, 1, 0,  3, 2, 1};
  Frac Pm[MAXN][MAXN], Qm[MAXN][MAXN], PQ[MAXN][MAXN], S[MAXN][MAXN], T2[MAXN][MAXN];
  load(3, P, Pm); load(3, Q, Qm);
  for (int i = 0; i < 3; i++)
    for (int j = 0; j < 3; j++) {
      Frac s = frac(0, 1);
      for (int k = 0; k < 3; k++) s = fadd(s, fmul(Pm[i][k], Qm[k][j]));
      PQ[i][j] = s;
      S[i][j] = fadd(Pm[i][j], Qm[i][j]);
      T2[i][j] = fmul(frac(2, 1), Pm[i][j]);
    }
  printf("det P = "); printFrac(detCofactor(Pm, 3));
  printf("，det Q = "); printFrac(detCofactor(Qm, 3));
  printf("，det PQ = "); printFrac(detCofactor(PQ, 3));
  printf("，det(P+Q) = "); printFrac(detCofactor(S, 3));
  printf("，det(2P) = "); printFrac(detCofactor(T2, 3));
  printf("\n");

  /* 排列展開 */
  int full4[16];
  for (int i = 0; i < 16; i++) full4[i] = 1;
  printf("4x4 全非零：%lld 項（= 4! = 24）\n", countNonzeroTerms(full4, 4));
  int tri4[] = {1, 1, 0, 0,  1, 1, 1, 0,  0, 1, 1, 1,  0, 0, 1, 1};
  printf("4x4 三對角：%lld 個非零項\n", countNonzeroTerms(tri4, 4));
  int pat96[] = {1,0,1,1,0,1, 0,0,1,1,0,1, 0,1,1,1,1,0, 0,1,1,0,1,0, 0,1,1,1,1,0, 1,0,1,1,0,1};
  printf("考古題 la-0096 的非零項：%lld（應為 40）\n", countNonzeroTerms(pat96, 6));

  /* 運算量 */
  for (int s = 2; s <= MAXN; s++)
    printf("n = %d：餘因子展開 %lld 次乘法，列運算 %lld 次乘除\n", s, cofactorMults(s), elimMults(s));
  printf("n = 10：餘因子展開 %lld 次乘法，列運算 %lld 次乘除\n", cofactorMults(10), elimMults(10));

  /* 考古題驗算 */
  int q75[] = {2,0,-1,1,3, 0,-1,0,-2,0, 2,1,4,0,3, 2,-1,-1,-3,3, 0,2,0,3,1};
  int q80[] = {1,-1,0,2, 0,0,3,3, 2,1,0,0, 1,1,2,2};
  int q101[] = {1,0,2,0,0,4, 30,1,5,0,0,9, 3,5,3,8,0,4, 2,0,8,0,0,7, 7,0,4,0,6,0, 0,0,1,0,2,0};
  int q149[] = {1,2,5,3,7, 3,7,1,4,2, 2,5,1,2,6, -1,-6,2,-5,3, -3,-7,4,-3,9};
  report("la-0075 (iii)", 5, q75);
  report("la-0080 a", 4, q80);
  report("la-0101", 6, q101);
  report("la-0149", 5, q149);

  /* 原創題驗算 */
  /* la-0177：det A = 2 的 3×3（取 diag(1,1,2)），做 R1<->R3、R2<-R2-4R1、R3<-5R3 */
  int q177[] = {1, 0, 0,  0, 1, 0,  0, 0, 2};
  load(3, q177, A); factor = frac(1, 1);
  opSwap(A, 3, 0, 2, &factor);
  opAdd(A, 3, 1, 0, frac(-4, 1), &factor);
  opScale(A, 3, 2, frac(5, 1), &factor);
  printf("la-0177：det B = "); printFrac(detCofactor(A, 3)); printf("\n");
  /* la-0179 */
  int q179[] = {0, 1, 2, 1,  1, 2, 1, 0,  2, 5, 3, 1,  1, 3, 4, 3};
  report("la-0179", 4, q179);
  /* la-0180：det [[x,1,1],[1,x,1],[1,1,x]] */
  for (int x = -3; x <= 3; x++) {
    int m[] = {x, 1, 1,  1, x, 1,  1, 1, x};
    Frac d = detOf(3, m);
    printf("la-0180 x = %2d：det = ", x); printFrac(d);
    printf("，(x+2)(x-1)^2 = %d\n", (x + 2) * (x - 1) * (x - 1));
  }
  /* la-0181：a, b, c 取 det[a;b;c] = 5 的例子 */
  int abc[] = {1, 2, 0,  0, 1, 3,  1, 0, 2};
  int new181[9];
  for (int j = 0; j < 3; j++) {
    new181[j] = abc[j] + 2 * abc[3 + j];
    new181[3 + j] = abc[3 + j];
    new181[6 + j] = 3 * abc[6 + j] - abc[j];
  }
  printf("la-0181：det[a;b;c] = "); printFrac(detOf(3, abc));
  printf("，det[a+2b; b; 3c-a] = "); printFrac(detOf(3, new181)); printf("\n");
  /* la-0182：三對角 3 / 1 / 1 */
  for (int s = 1; s <= MAXN; s++) {
    int m[MAXN * MAXN];
    for (int i = 0; i < s; i++)
      for (int j = 0; j < s; j++) m[i * s + j] = (i == j) ? 3 : (i - j == 1 || j - i == 1) ? 1 : 0;
    printf("la-0182 D%d = ", s); printFrac(detOf(s, m)); printf("\n");
  }
  /* la-0183：[[0, A], [B, 0]]，A、B 為 2×2（det A = 2、det B = 5）與 3×3（det A = 2、det B = 5） */
  int A2[] = {1, 1,  0, 2}, B2[] = {5, 0,  3, 1};
  int A3[] = {1, 1, 0,  0, 2, 0,  0, 0, 1}, B3[] = {5, 0, 0,  3, 1, 0,  2, 4, 1};
  for (int h = 2; h <= 3; h++) {
    const int *Ah = h == 2 ? A2 : A3, *Bh = h == 2 ? B2 : B3;
    int big[MAXN * MAXN], s2 = 2 * h;
    for (int i = 0; i < s2; i++)
      for (int j = 0; j < s2; j++) {
        int v = 0;
        if (i < h && j >= h) v = Ah[i * h + (j - h)];
        if (i >= h && j < h) v = Bh[(i - h) * h + j];
        big[i * s2 + j] = v;
      }
    printf("la-0183 n = %d：det A = ", h); printFrac(detOf(h, Ah));
    printf("，det B = "); printFrac(detOf(h, Bh));
    printf("，det[[0,A],[B,0]] = "); printFrac(detOf(s2, big));
    printf("\n");
  }
  /* la-0184：f(x) = det[[2x, x, 1, 2], [1, x, 1, -1], [3, 2, x, 1], [1, 1, 1, x]]，用 x = 0..4 插值出係數 */
  long long val[5];
  for (int x = 0; x <= 4; x++) {
    int m[] = {2 * x, x, 1, 2,  1, x, 1, -1,  3, 2, x, 1,  1, 1, 1, x};
    Frac d = detOf(4, m);
    val[x] = d.n;
  }
  /* 差分法求四次多項式係數：先印出值，係數另在驗算腳本確認 */
  printf("la-0184 f(0..4) = %lld %lld %lld %lld %lld\n", val[0], val[1], val[2], val[3], val[4]);
  int p184[] = {1, 0, 2, 3};
  printf("排列 (2,1,3,4) 的逆序數 = %d\n", inversions(p184, 4));
  return 0;
}
