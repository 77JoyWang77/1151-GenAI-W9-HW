/* Eigenvalues and Eigenvectors（特徵值與特徵向量）完整程式：只用來編譯驗證，頁面上的片段都從這裡取出
   流程：det(A − λI) 展開成多項式 → 有理根定理找根 → 每個 λ 對 A − λI 做 RREF 讀出特徵空間基底 → 驗證 Av = λv */
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

/* ---------- trace = 特徵值和、det = 特徵值積（重根要照重數算） ---------- */
void traceDetCheck(Frac A[MAXN][MAXN], Frac lam[], int alg[], int k, Frac *tr, Frac *sum, Frac *det, Frac *prod) {
  *tr = frac(0, 1); *sum = frac(0, 1); *prod = frac(1, 1);
  for (int i = 0; i < n; i++) *tr = fadd(*tr, A[i][i]);
  for (int i = 0; i < k; i++)
    for (int t = 0; t < alg[i]; t++) { *sum = fadd(*sum, lam[i]); *prod = fmul(*prod, lam[i]); }
  *det = charPoly(A).c[0];                     /* det(A − 0·I) = det A：特徵多項式的常數項 */
}

/* ---------- Cayley–Hamilton：p(A) = 0 ---------- */
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

void polyOfMatrix(Poly p, Frac A[MAXN][MAXN], Frac R[MAXN][MAXN]) {   /* Horner 法算 p(A) */
  for (int i = 0; i < n; i++)
    for (int j = 0; j < n; j++) R[i][j] = frac(0, 1);
  for (int k = p.deg; k >= 0; k--) {
    matMul(R, A, R);                           /* R ← R·A */
    for (int i = 0; i < n; i++) R[i][i] = fadd(R[i][i], p.c[k]);   /* R ← R + c_k I */
  }
}

int inverseByCH(Frac A[MAXN][MAXN], Frac inv[MAXN][MAXN]) {   /* 用 Cayley–Hamilton 求 A⁻¹，不可逆回傳 0 */
  Poly p = charPoly(A);                        /* p(A) = c_n A^n + ⋯ + c_1 A + c_0 I = 0 */
  if (isZero(p.c[0])) return 0;                /* c_0 = det A = 0：不可逆 */
  Poly q = pzero(); q.deg = p.deg - 1;         /* q(λ) = (p(λ) − c_0)/λ，所以 A·q(A) = −c_0 I */
  for (int k = 1; k <= p.deg; k++) q.c[k - 1] = p.c[k];
  polyOfMatrix(q, A, inv);
  for (int i = 0; i < n; i++)
    for (int j = 0; j < n; j++) inv[i][j] = fdiv(inv[i][j], fneg(p.c[0]));   /* A⁻¹ = −q(A)/c_0 */
  return 1;
}

/* ===================== 以下是輸出與測試 ===================== */
void printFrac(Frac x) {
  if (x.d == 1) printf("%lld", x.n);
  else printf("%lld/%lld", x.n, x.d);
}
void printPoly(Poly p) {
  for (int k = p.deg; k >= 0; k--) {
    printf(" %s", (p.c[k].n < 0) ? "-" : "+");
    Frac a = frac(llabs(p.c[k].n), p.c[k].d);
    printf(" "); printFrac(a);
    if (k > 0) printf(" L^%d", k);
  }
  printf("\n");
}
void printVec(Frac v[MAXN]) {
  printf("(");
  for (int j = 0; j < n; j++) { printFrac(v[j]); printf(j + 1 < n ? ", " : ")"); }
}

int failures = 0;

void analyze(const char *name, int size, long long M[MAXN][MAXN]) {
  Frac A[MAXN][MAXN];
  n = size;
  for (int i = 0; i < n; i++)
    for (int j = 0; j < n; j++) A[i][j] = frac(M[i][j], 1);
  printf("== %s ==\n", name);
  Poly p = charPoly(A);
  printf("det(A - L I) ="); printPoly(p);
  Frac lam[MAXN]; int alg[MAXN]; Poly rest;
  int k = eigenvalues(p, lam, alg, &rest);
  if (rest.deg > 0) { printf("  remaining factor without rational root:"); printPoly(rest); }
  for (int i = 0; i < k; i++) {
    Frac basis[MAXN][MAXN];
    int geo = eigenspace(A, lam[i], basis);
    printf("  lambda = "); printFrac(lam[i]);
    printf("  alg = %d  geo = %d  basis:", alg[i], geo);
    for (int t = 0; t < geo; t++) {
      printf(" "); printVec(basis[t]);
      if (!checkEigen(A, lam[i], basis[t])) { printf(" [Av != lv]"); failures++; }
    }
    if (geo < 1 || geo > alg[i]) { printf(" [1 <= geo <= alg violated]"); failures++; }
    printf("\n");
  }
  Frac tr, sum, det, prod;
  traceDetCheck(A, lam, alg, k, &tr, &sum, &det, &prod);
  printf("  trace = "); printFrac(tr); printf(", det = "); printFrac(det);
  if (rest.deg == 0) {
    printf("  | sum = "); printFrac(sum); printf(", prod = "); printFrac(prod);
    if (!feq(tr, sum) || !feq(det, prod)) { printf(" [mismatch]"); failures++; }
  }
  printf("\n");
  Frac R[MAXN][MAXN];
  polyOfMatrix(p, A, R);
  int zero = 1;
  for (int i = 0; i < n; i++)
    for (int j = 0; j < n; j++) if (!isZero(R[i][j])) zero = 0;
  printf("  Cayley-Hamilton p(A) = 0 : %s\n", zero ? "yes" : "NO");
  if (!zero) failures++;
  Frac inv[MAXN][MAXN];
  if (inverseByCH(A, inv)) {
    Frac P[MAXN][MAXN]; matMul(A, inv, P);
    int id = 1;
    for (int i = 0; i < n; i++)
      for (int j = 0; j < n; j++) if (!feq(P[i][j], frac(i == j, 1))) id = 0;
    printf("  A^-1 by Cayley-Hamilton: row1 = ");
    printVec(inv[0]);
    printf("  A*A^-1 = I : %s\n", id ? "yes" : "NO");
    if (!id) failures++;
  } else printf("  singular: no inverse\n");
}

int main(void) {
  long long geo2[MAXN][MAXN] = { { 4, 1 }, { 2, 3 } };                         /* 幾何意義的例子 */
  long long rot[MAXN][MAXN] = { { 0, -1 }, { 1, 0 } };                         /* 旋轉 90°：複數根 */
  long long irr[MAXN][MAXN] = { { 1, 2 }, { 3, 1 } };                          /* 無理根 */
  long long defect2[MAXN][MAXN] = { { 2, 1 }, { 0, 2 } };
  long long scalar2[MAXN][MAXN] = { { 2, 0 }, { 0, 2 } };
  long long distinct[MAXN][MAXN] = { { -1, 1, 2 }, { -2, 2, 2 }, { -5, 1, 6 } };   /* 相異特徵值 */
  long long defect[MAXN][MAXN] = { { 1, 2, -1 }, { -2, 5, -1 }, { -2, 2, 1 } };    /* 重根、幾何重數 1 */
  long long twodim[MAXN][MAXN] = { { 2, 1, -1 }, { -1, 4, -1 }, { -2, 2, 1 } };    /* 重根、特徵空間 2 維 */
  long long tri[MAXN][MAXN] = { { 4, 1, -2 }, { 0, -1, 3 }, { 0, 0, 2 } };         /* 三角矩陣 */
  long long sing[MAXN][MAXN] = { { 1, 2, 3 }, { 2, 4, 6 }, { 1, 1, 1 } };          /* 不可逆：0 是特徵值 */
  long long mixed[MAXN][MAXN] = { { 2, 0, 0 }, { 0, 1, 2 }, { 0, 3, 1 } };          /* 一個有理根＋兩個無理根 */
  long long ex92[MAXN][MAXN] = { { 1, 1, 1 }, { 0, 2, 1 }, { 0, 0, 3 } };
  long long q169[MAXN][MAXN] = { { 1, 4 }, { 2, 3 } };                         /* 練習題 la-0169 */
  long long q171[MAXN][MAXN] = { { 2, 1, 0 }, { 0, 2, 0 }, { 3, 1, -1 } };      /* 練習題 la-0171 */
  long long q172[MAXN][MAXN] = { { 3, 1 }, { 6, 4 } };                         /* 練習題 la-0172 */
  long long q173[MAXN][MAXN] = { { 1, 2 }, { 1, 0 } };                         /* 練習題 la-0173 */
  long long q176[MAXN][MAXN] = { { 2, 1, 1 }, { 2, 3, 2 }, { 3, 3, 4 } };       /* 練習題 la-0176：I + u vᵀ */
  long long block[MAXN][MAXN] = { { 1, 2, 0 }, { 3, 2, 0 }, { 5, -1, 3 } };     /* 區塊下三角 */
  analyze("geometry 2x2 [4 1; 2 3]", 2, geo2);
  analyze("rotation [0 -1; 1 0]", 2, rot);
  analyze("irrational [1 2; 3 1]", 2, irr);
  analyze("defective 2x2 [2 1; 0 2]", 2, defect2);
  analyze("scalar 2x2 [2 0; 0 2]", 2, scalar2);
  analyze("distinct 3x3", 3, distinct);
  analyze("defective 3x3", 3, defect);
  analyze("two-dim eigenspace 3x3", 3, twodim);
  analyze("triangular 3x3", 3, tri);
  analyze("singular 3x3", 3, sing);
  analyze("mixed rational + irrational", 3, mixed);
  analyze("upper triangular [1 1 1; 0 2 1; 0 0 3]", 3, ex92);
  analyze("la-0169", 2, q169);
  analyze("la-0171", 3, q171);
  analyze("la-0172", 2, q172);
  analyze("la-0173", 2, q173);
  analyze("la-0176", 3, q176);
  analyze("block lower triangular", 3, block);
  printf("%s (%d failures)\n", failures ? "FAILED" : "ALL OK", failures);
  return failures != 0;
}
