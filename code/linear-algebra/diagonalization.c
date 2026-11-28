/* Diagonalization（對角化）完整程式：只用來編譯驗證，頁面上的片段都從這裡取出
   流程：特徵值與特徵空間 → 判斷幾何重數是否等於代數重數 → 組出 P、D → 驗算 AP = PD → A^k = P D^k P⁻¹ */
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
Frac fneg(Frac x) { return frac(-x.n, x.d); }
int isZero(Frac x) { return x.n == 0; }
int feq(Frac x, Frac y) { return x.n == y.n && x.d == y.d; }

#define MAXN 3
int n;                                         /* 矩陣大小：2 或 3 */

/* ---------- λ 的多項式：c[k] 是 λ^k 的係數 ---------- */
typedef struct { int deg; Frac c[MAXN + 1]; } Poly;

Poly pzero(void) {
  Poly p; p.deg = 0;
  for (int k = 0; k <= MAXN; k++) p.c[k] = frac(0, 1);
  return p;
}
Poly ptrim(Poly p) {                           /* 去掉最高次的 0 係數 */
  while (p.deg > 0 && isZero(p.c[p.deg])) p.deg--;
  return p;
}
Poly padd(Poly a, Poly b) {
  Poly r = pzero(); r.deg = a.deg > b.deg ? a.deg : b.deg;
  for (int k = 0; k <= r.deg; k++) r.c[k] = fadd(k <= a.deg ? a.c[k] : frac(0, 1), k <= b.deg ? b.c[k] : frac(0, 1));
  return ptrim(r);
}
Poly psub(Poly a, Poly b) {
  for (int k = 0; k <= b.deg; k++) b.c[k] = fneg(b.c[k]);
  return padd(a, b);
}
Poly pmul(Poly a, Poly b) {
  Poly r = pzero(); r.deg = a.deg + b.deg;
  for (int i = 0; i <= a.deg; i++)
    for (int j = 0; j <= b.deg; j++) r.c[i + j] = fadd(r.c[i + j], fmul(a.c[i], b.c[j]));
  return ptrim(r);
}
Frac peval(Poly p, Frac x) {                   /* Horner 法代入 λ = x */
  Frac s = frac(0, 1);
  for (int k = p.deg; k >= 0; k--) s = fadd(fmul(s, x), p.c[k]);
  return s;
}

/* ---------- 特徵多項式：把 det(A − λI) 當成 λ 的多項式展開 ---------- */
Poly entry(Frac A[MAXN][MAXN], int i, int j) {   /* A − λI 的 (i, j) 元素：對角線是 a_ii − λ */
  Poly p = pzero();
  p.c[0] = A[i][j];
  if (i == j) { p.deg = 1; p.c[1] = frac(-1, 1); }
  return p;
}

Poly charPoly(Frac A[MAXN][MAXN]) {           /* 回傳 det(A − λI) */
  if (n == 2)                                  /* (a − λ)(d − λ) − bc */
    return psub(pmul(entry(A, 0, 0), entry(A, 1, 1)), pmul(entry(A, 0, 1), entry(A, 1, 0)));
  Poly p = pzero();
  for (int j = 0; j < 3; j++) {                /* 沿第 1 列餘因子展開，符號 + − + */
    int c1 = (j == 0) ? 1 : 0, c2 = (j == 2) ? 1 : 2;   /* 刪掉第 1 列、第 j 行後剩下的兩行 */
    Poly minor = psub(pmul(entry(A, 1, c1), entry(A, 2, c2)), pmul(entry(A, 1, c2), entry(A, 2, c1)));
    Poly term = pmul(entry(A, 0, j), minor);
    p = (j == 1) ? psub(p, term) : padd(p, term);
  }
  return p;
}

/* ---------- 有理根定理：根若是 p/q（最簡），p 整除常數項、q 整除最高次係數 ---------- */
int rationalRoot(Poly p, Frac *root) {         /* 找到回傳 1，找不到（剩下無理根或複數根）回傳 0 */
  long long L = 1, a[MAXN + 1];
  for (int k = 0; k <= p.deg; k++) L = L / gcdll(L, p.c[k].d) * p.c[k].d;   /* 分母的最小公倍數 */
  for (int k = 0; k <= p.deg; k++) a[k] = p.c[k].n * (L / p.c[k].d);         /* 通分成整數係數 */
  if (a[0] == 0) { *root = frac(0, 1); return 1; }                            /* 常數項是 0：λ = 0 是根 */
  long long a0 = llabs(a[0]), an = llabs(a[p.deg]);
  for (long long q = 1; q <= an; q++) {
    if (an % q) continue;
    for (long long pp = 1; pp <= a0; pp++) {
      if (a0 % pp) continue;
      for (int s = 1; s >= -1; s -= 2) {       /* 先試 +p/q 再試 −p/q */
        Frac r = frac(s * pp, q);
        if (isZero(peval(p, r))) { *root = r; return 1; }
      }
    }
  }
  return 0;
}

Poly deflate(Poly p, Frac r) {                 /* 綜合除法：p(λ) = (λ − r)·q(λ)，回傳 q */
  Poly q = pzero(); q.deg = p.deg - 1;
  Frac carry = frac(0, 1);
  for (int k = p.deg; k >= 1; k--) {
    carry = fadd(fmul(carry, r), p.c[k]);
    q.c[k - 1] = carry;
  }
  return q;
}

int eigenvalues(Poly p, Frac lam[], int alg[], Poly *rest) {   /* 回傳相異特徵值個數 */
  int k = 0;
  Frac r;
  while (p.deg > 0 && rationalRoot(p, &r)) {
    if (k > 0 && feq(lam[k - 1], r)) alg[k - 1]++;   /* 同一個根再出現：代數重數 +1 */
    else { lam[k] = r; alg[k] = 1; k++; }
    p = deflate(p, r);
  }
  *rest = p;                                   /* rest.deg > 0：剩下的因式沒有有理根 */
  return k;
}

/* ---------- RREF：和高斯消去法同一套列運算 ---------- */
int rref(Frac B[MAXN][MAXN], int pivcol[]) {   /* 化成 RREF，回傳 rank；pivcol[i] 是第 i 個 pivot 所在的行 */
  int r = 0;
  for (int c = 0; c < n && r < n; c++) {
    int p = r;
    while (p < n && isZero(B[p][c])) p++;
    if (p == n) continue;                      /* 這一行沒有 pivot：對應自由變數 */
    for (int j = 0; j < n; j++) { Frac t = B[r][j]; B[r][j] = B[p][j]; B[p][j] = t; }
    Frac piv = B[r][c];
    for (int j = 0; j < n; j++) B[r][j] = fdiv(B[r][j], piv);
    for (int i = 0; i < n; i++)
      if (i != r && !isZero(B[i][c])) {
        Frac f = B[i][c];
        for (int j = 0; j < n; j++) B[i][j] = fsub(B[i][j], fmul(f, B[r][j]));
      }
    pivcol[r++] = c;
  }
  return r;
}

void toInteger(Frac v[MAXN]) {                 /* 把向量乘上正數倍，化成互質的整數（方向不變） */
  long long L = 1, g = 0;
  for (int j = 0; j < n; j++) L = L / gcdll(L, v[j].d) * v[j].d;
  for (int j = 0; j < n; j++) { v[j] = fmul(v[j], frac(L, 1)); g = g ? gcdll(g, v[j].n) : llabs(v[j].n); }
  if (g > 1) for (int j = 0; j < n; j++) v[j] = frac(v[j].n, g);
}

/* ---------- 特徵空間 = Null(A − λI)：每個自由變數給一個基底向量 ---------- */
int eigenspace(Frac A[MAXN][MAXN], Frac lam, Frac basis[MAXN][MAXN]) {   /* 回傳幾何重數 dim E_λ */
  Frac B[MAXN][MAXN];
  for (int i = 0; i < n; i++)
    for (int j = 0; j < n; j++) B[i][j] = (i == j) ? fsub(A[i][j], lam) : A[i][j];   /* B = A − λI */
  int pivcol[MAXN], isPiv[MAXN] = { 0 };
  int r = rref(B, pivcol);
  for (int i = 0; i < r; i++) isPiv[pivcol[i]] = 1;
  int dim = 0;
  for (int f = 0; f < n; f++) {
    if (isPiv[f]) continue;                    /* 只有自由變數那一行會產生基底向量 */
    for (int j = 0; j < n; j++) basis[dim][j] = frac(j == f, 1);   /* x_f = 1，其他自由變數 = 0 */
    for (int i = 0; i < r; i++) basis[dim][pivcol[i]] = fneg(B[i][f]);   /* pivot 變數 = −(那一列在第 f 行的數) */
    toInteger(basis[dim]);
    dim++;
  }
  return dim;                                  /* = n − rank(A − λI) */
}

int checkEigen(Frac A[MAXN][MAXN], Frac lam, Frac v[MAXN]) {   /* 驗證 Av = λv */
  for (int i = 0; i < n; i++) {
    Frac s = frac(0, 1);
    for (int j = 0; j < n; j++) s = fadd(s, fmul(A[i][j], v[j]));
    if (!feq(s, fmul(lam, v[i]))) return 0;
  }
  return 1;
}


/* ---------- 矩陣乘法 ---------- */
void matMul(Frac X[MAXN][MAXN], Frac Y[MAXN][MAXN], Frac Z[MAXN][MAXN]) {
  Frac T[MAXN][MAXN];
  for (int i = 0; i < n; i++)
    for (int j = 0; j < n; j++) {
      T[i][j] = frac(0, 1);
      for (int k = 0; k < n; k++) T[i][j] = fadd(T[i][j], fmul(X[i][k], Y[k][j]));
    }
  for (int i = 0; i < n; i++)
    for (int j = 0; j < n; j++) Z[i][j] = T[i][j];
}


Frac fpow(Frac x, int k) {                     /* x^k，k ≥ 0 */
  Frac r = frac(1, 1);
  for (int t = 0; t < k; t++) r = fmul(r, x);
  return r;
}

/* ---------- 對角化：每個特徵空間的基底排成 P 的行，特徵值照同樣順序放進 D ---------- */
int diagonalize(Frac A[MAXN][MAXN], Frac P[MAXN][MAXN], Frac D[MAXN][MAXN]) {   /* 可對角化回傳 1、缺陷回傳 0 */
  Frac lam[MAXN], basis[MAXN][MAXN];
  int alg[MAXN], col = 0;
  Poly rest;
  int k = eigenvalues(charPoly(A), lam, alg, &rest);
  if (rest.deg > 0) return -1;                 /* 有無理根或複數根：P、D 不是有理數，這裡不處理 */
  for (int i = 0; i < n; i++)
    for (int j = 0; j < n; j++) D[i][j] = frac(0, 1);
  for (int t = 0; t < k; t++) {
    int g = eigenspace(A, lam[t], basis);      /* g = 幾何重數 = n − rank(A − λI) */
    if (g < alg[t]) return 0;                  /* 幾何重數 < 代數重數：特徵向量不夠 n 個 */
    for (int s = 0; s < g; s++, col++) {
      for (int i = 0; i < n; i++) P[i][col] = basis[s][i];   /* 第 col 個特徵向量放進 P 的第 col 行 */
      D[col][col] = lam[t];                    /* 對應的特徵值放在 D 的同一行 */
    }
  }
  return 1;                                    /* 此時 col == n，P 的 n 行線性獨立 */
}

int checkAPPD(Frac A[MAXN][MAXN], Frac P[MAXN][MAXN], Frac D[MAXN][MAXN]) {   /* 驗算 AP = PD */
  Frac L[MAXN][MAXN], R[MAXN][MAXN];
  matMul(A, P, L);                             /* AP 的第 j 行 = A·(P 的第 j 行) */
  matMul(P, D, R);                             /* PD 的第 j 行 = d_jj·(P 的第 j 行) */
  for (int i = 0; i < n; i++)
    for (int j = 0; j < n; j++)
      if (!feq(L[i][j], R[i][j])) return 0;
  return 1;
}

/* ---------- P⁻¹：Gauss–Jordan，把 [P | I] 化成 [I | P⁻¹] ---------- */
int inverse(Frac P[MAXN][MAXN], Frac inv[MAXN][MAXN]) {   /* 不可逆回傳 0 */
  Frac M[MAXN][2 * MAXN];
  for (int i = 0; i < n; i++)
    for (int j = 0; j < 2 * n; j++) M[i][j] = (j < n) ? P[i][j] : frac(j - n == i, 1);
  for (int c = 0; c < n; c++) {
    int p = c;
    while (p < n && isZero(M[p][c])) p++;
    if (p == n) return 0;                      /* 這一行找不到 pivot：P 不可逆 */
    for (int j = 0; j < 2 * n; j++) { Frac t = M[c][j]; M[c][j] = M[p][j]; M[p][j] = t; }
    Frac piv = M[c][c];
    for (int j = 0; j < 2 * n; j++) M[c][j] = fdiv(M[c][j], piv);
    for (int i = 0; i < n; i++)
      if (i != c && !isZero(M[i][c])) {
        Frac f = M[i][c];
        for (int j = 0; j < 2 * n; j++) M[i][j] = fsub(M[i][j], fmul(f, M[c][j]));
      }
  }
  for (int i = 0; i < n; i++)
    for (int j = 0; j < n; j++) inv[i][j] = M[i][n + j];
  return 1;
}

/* ---------- A^k = P D^k P⁻¹：對角矩陣的次方只要把對角線各自次方 ---------- */
void powerByDiag(Frac P[MAXN][MAXN], Frac D[MAXN][MAXN], int k, Frac Ak[MAXN][MAXN]) {
  Frac Dk[MAXN][MAXN], Pinv[MAXN][MAXN], T[MAXN][MAXN];
  for (int i = 0; i < n; i++)
    for (int j = 0; j < n; j++) Dk[i][j] = (i == j) ? fpow(D[i][i], k) : frac(0, 1);   /* D^k = diag(λ₁^k, …, λₙ^k) */
  inverse(P, Pinv);
  matMul(P, Dk, T);                            /* T = P D^k */
  matMul(T, Pinv, Ak);                         /* A^k = P D^k P⁻¹ */
}

void matPow(Frac A[MAXN][MAXN], int k, Frac R[MAXN][MAXN]) {   /* 直接算 A^k（快速冪），用來對答案 */
  Frac B[MAXN][MAXN];
  for (int i = 0; i < n; i++)
    for (int j = 0; j < n; j++) { R[i][j] = frac(i == j, 1); B[i][j] = A[i][j]; }
  while (k > 0) {
    if (k & 1) matMul(R, B, R);                /* 二進位這一位是 1：乘進答案 */
    matMul(B, B, B);                           /* B ← B²，只要 O(log k) 次矩陣乘法 */
    k >>= 1;
  }
}

/* ---------- 線性遞迴：a_{k+2} = p·a_{k+1} + q·a_k 寫成 u_{k+1} = A u_k ---------- */
long long recurByMatrix(long long p, long long q, long long a0, long long a1, int k) {   /* 回傳 a_k */
  Frac A[MAXN][MAXN], R[MAXN][MAXN];
  n = 2;
  A[0][0] = frac(p, 1); A[0][1] = frac(q, 1);  /* [a_{k+2}; a_{k+1}] = [p q; 1 0][a_{k+1}; a_k] */
  A[1][0] = frac(1, 1); A[1][1] = frac(0, 1);
  matPow(A, k, R);                             /* [a_{k+1}; a_k] = A^k [a_1; a_0] */
  return fadd(fmul(R[1][0], frac(a1, 1)), fmul(R[1][1], frac(a0, 1))).n;
}

/* ---------- 輸出與測試 ---------- */
void printFrac(Frac x) {
  if (x.d == 1) printf("%lld", x.n);
  else printf("%lld/%lld", x.n, x.d);
}
void printMat(const char *name, Frac M[MAXN][MAXN]) {
  printf("  %s = [", name);
  for (int i = 0; i < n; i++) {
    for (int j = 0; j < n; j++) { printFrac(M[i][j]); if (j + 1 < n) printf(" "); }
    if (i + 1 < n) printf("; ");
  }
  printf("]\n");
}

int failures = 0;

void analyze(const char *name, int size, long long num[MAXN][MAXN], long long den, int k) {
  Frac A[MAXN][MAXN], P[MAXN][MAXN], D[MAXN][MAXN];
  n = size;
  for (int i = 0; i < n; i++)
    for (int j = 0; j < n; j++) A[i][j] = frac(num[i][j], den);
  printf("== %s ==\n", name);
  int ok = diagonalize(A, P, D);
  if (ok == -1) { printf("  irrational / complex eigenvalues\n"); return; }
  if (ok == 0) { printf("  NOT diagonalizable (defective)\n"); return; }
  printMat("P", P); printMat("D", D);
  if (!checkAPPD(A, P, D)) { printf("  [AP != PD]\n"); failures++; }
  Frac Pinv[MAXN][MAXN];
  if (!inverse(P, Pinv)) { printf("  [P singular]\n"); failures++; return; }
  printMat("P^-1", Pinv);
  Frac Ak[MAXN][MAXN], R[MAXN][MAXN];
  powerByDiag(P, D, k, Ak);
  matPow(A, k, R);
  printf("  k = %d\n", k);
  printMat("A^k", Ak);
  for (int i = 0; i < n; i++)
    for (int j = 0; j < n; j++)
      if (!feq(Ak[i][j], R[i][j])) { printf("  [P D^k P^-1 != A^k]\n"); failures++; i = n; break; }
}

int main(void) {
  long long ex2[MAXN][MAXN] = { { 4, 1 }, { 2, 3 } };                           /* 頁面主例 */
  long long distinct[MAXN][MAXN] = { { -1, 1, 2 }, { -2, 2, 2 }, { -5, 1, 6 } };  /* 特徵值 1、2、4 */
  long long twodim[MAXN][MAXN] = { { 2, 1, -1 }, { -1, 4, -1 }, { -2, 2, 1 } };   /* 重根但可對角化 */
  long long defect[MAXN][MAXN] = { { 1, 2, -1 }, { -2, 5, -1 }, { -2, 2, 1 } };   /* 缺陷 */
  long long q121[MAXN][MAXN] = { { 0, 0, -2 }, { 1, 2, 1 }, { 1, 0, 3 } };        /* la-0121 */
  long long markov[MAXN][MAXN] = { { 2, 1 }, { 2, 3 } };                        /* 除以 4：[1/2 1/4; 1/2 3/4] */
  long long rec[MAXN][MAXN] = { { 1, 2 }, { 1, 0 } };                           /* a_{k+2} = a_{k+1} + 2a_k */
  long long fib[MAXN][MAXN] = { { 1, 1 }, { 1, 0 } };                           /* Fibonacci：無理特徵值 */
  long long jordan[MAXN][MAXN] = { { 2, 1 }, { 0, 2 } };
  long long q81c[MAXN][MAXN] = { { 8, -9 }, { 4, -4 } };                        /* 除以 2：la-0081 的 C */
  long long q147[MAXN][MAXN] = { { 3, 2 }, { -1, 0 } };                         /* la-0147 */
  long long q164[MAXN][MAXN] = { { 4, 3 }, { 1, 2 } };                          /* la-0164 */
  analyze("main 2x2 [4 1; 2 3]", 2, ex2, 1, 5);
  analyze("distinct 3x3", 3, distinct, 1, 4);
  analyze("repeated root, 2-dim eigenspace", 3, twodim, 1, 3);
  analyze("defective 3x3", 3, defect, 1, 3);
  analyze("la-0121", 3, q121, 1, 12);
  analyze("markov [1/2 1/4; 1/2 3/4]", 2, markov, 4, 6);
  analyze("recurrence [1 2; 1 0]", 2, rec, 1, 10);
  analyze("fibonacci [1 1; 1 0]", 2, fib, 1, 10);
  analyze("jordan [2 1; 0 2]", 2, jordan, 1, 3);
  analyze("la-0081 C", 2, q81c, 2, 3);
  analyze("la-0147", 2, q147, 1, 20);
  analyze("la-0164", 2, q164, 1, 6);
  /* 遞迴：Fibonacci 與 a_{k+2} = a_{k+1} + 2a_k 的封閉解 */
  long long fprev = 0, fcur = 1;
  for (int k = 1; k <= 40; k++) {
    if (recurByMatrix(1, 1, 0, 1, k) != fcur) { printf("[fib %d wrong]\n", k); failures++; }
    long long t = fprev + fcur; fprev = fcur; fcur = t;
  }
  long long pw = 1;
  for (int k = 0; k <= 30; k++, pw *= 2) {
    long long closed = (pw - ((k % 2) ? -1 : 1)) / 3;     /* a_k = (2^k − (−1)^k)/3 */
    if (recurByMatrix(1, 2, 0, 1, k) != closed) { printf("[rec %d wrong]\n", k); failures++; }
  }
  printf("F_10 = %lld, F_40 = %lld, a_10 = %lld\n", recurByMatrix(1, 1, 0, 1, 10), recurByMatrix(1, 1, 0, 1, 40), recurByMatrix(1, 2, 0, 1, 10));
  printf("%s (%d failures)\n", failures ? "FAILED" : "ALL OK", failures);
  return failures != 0;
}
