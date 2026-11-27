/* Linear Recurrence Relations（線性遞迴關係）完整程式
   編譯：gcc -std=c99 -Wall -Wextra -fsanitize=address,undefined recurrence-relations.c -lm
   內容：
   1. 用遞迴關係直接算前 N 項
   2. 特徵方程式的整數根（2 階用判別式，3 階用有理根定理）
   3. 非齊次項 P(n)·s^n 的特解（s 是 m 重特徵根時乘 n^m）
   4. 用初始條件解齊次解的係數，得到閉合式，再和遞迴值逐項比對
   5. Fibonacci 的 Binet 公式：浮點數算到第幾項開始出錯
   6. 建模驗證：不含 00 的二進位字串、河內塔（暴力法對照遞迴） */
#include <stdio.h>
#include <math.h>

/* ---------- 分數 ---------- */
typedef struct { long long p, q; } Frac;       /* p / q，q > 0 且約到最簡 */

long long gcdll(long long a, long long b) {
  if (a < 0) a = -a;
  if (b < 0) b = -b;
  while (b) { long long t = a % b; a = b; b = t; }
  return a;
}
Frac F(long long p, long long q) {
  if (q < 0) { p = -p; q = -q; }
  long long g = gcdll(p, q);
  if (g == 0) g = 1;
  Frac r = { p / g, q / g };
  return r;
}
Frac fadd(Frac a, Frac b) { return F(a.p * b.q + b.p * a.q, a.q * b.q); }
Frac fsub(Frac a, Frac b) { return F(a.p * b.q - b.p * a.q, a.q * b.q); }
Frac fmul(Frac a, Frac b) { return F(a.p * b.p, a.q * b.q); }
Frac fdiv(Frac a, Frac b) { return F(a.p * b.q, a.q * b.p); }
long long ipow(long long b, int e) { long long r = 1; while (e-- > 0) r *= b; return r; }
void fprint(Frac a) { if (a.q == 1) printf("%lld", a.p); else printf("%lld/%lld", a.p, a.q); }

/* 解 n 元一次聯立方程 M x = v（高斯消去法，全部用分數）；回傳 0 表示沒有唯一解 */
#define MAXV 6
int gauss(int n, Frac M[MAXV][MAXV], Frac v[MAXV], Frac x[MAXV]) {
  for (int col = 0; col < n; col++) {
    int piv = col;
    while (piv < n && M[piv][col].p == 0) piv++;
    if (piv == n) return 0;
    for (int j = 0; j < n; j++) { Frac t = M[col][j]; M[col][j] = M[piv][j]; M[piv][j] = t; }
    Frac t = v[col]; v[col] = v[piv]; v[piv] = t;
    for (int i = 0; i < n; i++) {
      if (i == col || M[i][col].p == 0) continue;
      Frac r = fdiv(M[i][col], M[col][col]);
      for (int j = 0; j < n; j++) M[i][j] = fsub(M[i][j], fmul(r, M[col][j]));
      v[i] = fsub(v[i], fmul(r, v[col]));
    }
  }
  for (int i = 0; i < n; i++) x[i] = fdiv(v[i], M[i][i]);
  return 1;
}

/* ---------- 遞迴關係 ---------- */
/* a(n) = c[1]a(n-1) + ... + c[k]a(n-k) + f(n)，n ≥ k；f(n) = 各項 P(n)·s^n 相加 */
typedef struct { long long s; int d; long long P[3]; } Term;   /* P(n) = P[0] + P[1]n + P[2]n²，d = 次數 */
typedef struct {
  int k; long long c[4]; long long init[3];   /* 階數、係數 c[1..k]、初始條件 a(0..k-1) */
  int nf; Term f[2];                          /* 非齊次項（nf = 0 是齊次） */
  int nr; long long root[3]; int mult[3];     /* 特徵根與重數 */
  int pm[2]; Frac q[2][MAXV];                 /* 特解：n^pm · (q0 + q1 n + q2 n²) · s^n */
  Frac A[MAXV];                               /* 齊次解係數，對應 n^i · root^n */
} Rec;

long long polyAt(const Term *T, long long n) { return T->P[0] + T->P[1] * n + T->P[2] * n * n; }
long long fval(const Rec *R, int n) {
  long long v = 0;
  for (int t = 0; t < R->nf; t++) v += polyAt(&R->f[t], n) * ipow(R->f[t].s, n);
  return v;
}

/* 1. 照遞迴關係直接算前 N 項 */
void recurTerms(const Rec *R, long long a[], int N) {
  for (int n = 0; n < N; n++) {
    if (n < R->k) { a[n] = R->init[n]; continue; }   /* 前 k 項是初始條件 */
    long long v = fval(R, n);
    for (int i = 1; i <= R->k; i++) v += R->c[i] * a[n - i];
    a[n] = v;
  }
}

/* 2 階特徵方程式 r² − c1 r − c2 = 0 的整數根：回傳 2（相異根）、1（重根）、0（不是整數根） */
int roots2(long long c1, long long c2, long long r[2]) {
  long long D = c1 * c1 + 4 * c2;             /* 判別式 */
  if (D < 0) return 0;                         /* 共軛複根 */
  long long s = (long long)sqrt((double)D);
  while (s * s > D) s--;
  while ((s + 1) * (s + 1) <= D) s++;
  if (s * s != D) return 0;                    /* D 不是完全平方數：無理根 */
  r[0] = (c1 + s) / 2;                         /* D 和 c1² 同奇偶，所以一定整除 */
  r[1] = (c1 - s) / 2;
  return D == 0 ? 1 : 2;
}

/* 2. 特徵根：2 階用判別式；3 階用有理根定理（整數根一定整除 c[k]），找到就做綜合除法降次 */
int charRoots(Rec *R) {
  R->nr = 0;
  if (R->k == 2) {
    long long r[2];
    int t = roots2(R->c[1], R->c[2], r);
    if (t == 0) return 0;
    R->root[0] = r[0]; R->mult[0] = t == 1 ? 2 : 1;
    if (t == 2) { R->root[1] = r[1]; R->mult[1] = 1; }
    R->nr = t;
    return 1;
  }
  long long poly[4], deg = R->k, ck = R->c[R->k] < 0 ? -R->c[R->k] : R->c[R->k];
  poly[0] = 1;                                 /* poly[i] 是 r^(deg-i) 的係數 */
  for (int i = 1; i <= R->k; i++) poly[i] = -R->c[i];
  for (long long r = -ck; r <= ck && deg > 0; r++) {
    if (r == 0 || ck % r != 0) continue;
    int m = 0;
    for (;;) {
      long long b[4], acc = 0;                 /* 綜合除法：餘數 acc = poly(r) */
      for (int i = 0; i <= deg; i++) { acc = acc * r + poly[i]; b[i] = acc; }
      if (acc != 0) break;
      for (int i = 0; i < deg; i++) poly[i] = b[i];
      deg--; m++;
      if (deg == 0) break;
    }
    if (m) { R->root[R->nr] = r; R->mult[R->nr] = m; R->nr++; }
  }
  return deg == 0;                             /* 全部降完才表示根都是整數 */
}

int multiplicity(const Rec *R, long long s) {
  for (int i = 0; i < R->nr; i++) if (R->root[i] == s) return R->mult[i];
  return 0;
}

/* 3. 對 f 的第 t 項 P(n)·s^n，猜 n^m (q0 + q1 n + ... + qd n^d) s^n，代回遞迴解出 q */
void particular(Rec *R, int t) {
  Term *T = &R->f[t];
  int m = multiplicity(R, T->s), d = T->d, k = R->k;
  Frac M[MAXV][MAXV], v[MAXV];
  for (int e = 0; e <= d; e++) {              /* 代 n = k, k+1, ..., k+d，得到 d+1 條方程式 */
    long long n = k + e;
    for (int j = 0; j <= d; j++) {            /* q_j 的係數：s^k n^(m+j) − Σ c_i s^(k−i) (n−i)^(m+j) */
      long long coef = ipow(T->s, k) * ipow(n, m + j);
      for (int i = 1; i <= k; i++) coef -= R->c[i] * ipow(T->s, k - i) * ipow(n - i, m + j);
      M[e][j] = F(coef, 1);
    }
    v[e] = F(ipow(T->s, k) * polyAt(T, n), 1);   /* 兩邊同除 s^(n−k) */
  }
  R->pm[t] = m;
  gauss(d + 1, M, v, R->q[t]);
}

Frac partAt(const Rec *R, long long n) {        /* 特解在 n 的值 */
  Frac sum = F(0, 1);
  for (int t = 0; t < R->nf; t++) {
    Frac p = F(0, 1);
    for (int j = 0; j <= R->f[t].d; j++) p = fadd(p, fmul(R->q[t][j], F(ipow(n, j), 1)));
    sum = fadd(sum, fmul(p, F(ipow(n, R->pm[t]) * ipow(R->f[t].s, n), 1)));
  }
  return sum;
}

/* 4. 初始條件扣掉特解，剩下的交給齊次解：解 k 元聯立方程求係數 */
void solveCoef(Rec *R) {
  Frac M[MAXV][MAXV], v[MAXV];
  for (int n = 0; n < R->k; n++) {
    int col = 0;
    for (int i = 0; i < R->nr; i++)
      for (int e = 0; e < R->mult[i]; e++)    /* m 重根 r 提供 r^n, n r^n, ..., n^(m-1) r^n */
        M[n][col++] = F(ipow(n, e) * ipow(R->root[i], n), 1);
    v[n] = fsub(F(R->init[n], 1), partAt(R, n));
  }
  gauss(R->k, M, v, R->A);
}

Frac closedAt(const Rec *R, long long n) {      /* 閉合式在 n 的值 */
  Frac sum = partAt(R, n);
  int col = 0;
  for (int i = 0; i < R->nr; i++)
    for (int e = 0; e < R->mult[i]; e++)
      sum = fadd(sum, fmul(R->A[col++], F(ipow(n, e) * ipow(R->root[i], n), 1)));
  return sum;
}

/* 解整個遞迴：回傳 0 表示特徵根不全是整數（這個工具只處理整數根） */
int solve(Rec *R) {
  if (!charRoots(R)) return 0;                 /* 1. 特徵方程式的根與重數 */
  for (int t = 0; t < R->nf; t++)              /* 2. 每一種 s^n 各猜一個特解（疊加） */
    particular(R, t);
  solveCoef(R);                                /* 3. 用初始條件解齊次解的係數 */
  return 1;
}

/* 5. 代回前幾項驗證：遞迴值和閉合式必須逐項相等 */
int verify(const Rec *R, int N) {
  long long a[40];
  recurTerms(R, a, N);
  for (int n = 0; n < N; n++) {
    Frac c = closedAt(R, n);
    if (c.q != 1 || c.p != a[n]) return 0;
  }
  return 1;
}

void report(const char *name, Rec *R) {
  printf("== %s\n", name);
  if (!solve(R)) { printf("  特徵根不全是整數\n"); return; }
  printf("  特徵根：");
  for (int i = 0; i < R->nr; i++) printf("%lld(x%d) ", R->root[i], R->mult[i]);
  printf("\n  齊次係數：");
  for (int i = 0; i < R->k; i++) { fprint(R->A[i]); printf(" "); }
  for (int t = 0; t < R->nf; t++) {
    printf("\n  特解（s = %lld，乘 n^%d）：q = ", R->f[t].s, R->pm[t]);
    for (int j = 0; j <= R->f[t].d; j++) { fprint(R->q[t][j]); printf(" "); }
  }
  long long a[8];
  recurTerms(R, a, 8);
  printf("\n  前 8 項：");
  for (int n = 0; n < 8; n++) printf("%lld ", a[n]);
  printf("\n  驗證前 20 項：%s\n", verify(R, 20) ? "一致" : "不一致");
}

/* 6. Fibonacci 的 Binet 公式 F(n) = (φ^n − ψ^n)/√5，用浮點數算，找出第一個四捨五入後錯的 n */
int binetFailDouble(void) {
  unsigned long long a = 0, b = 1;              /* 精確的 F(n)、F(n+1) */
  double phi = (1 + sqrt(5.0)) / 2, psi = (1 - sqrt(5.0)) / 2;
  for (int n = 0; n <= 92; n++) {
    double v = (pow(phi, n) - pow(psi, n)) / sqrt(5.0);
    if ((unsigned long long)llround(v) != a) return n;
    unsigned long long t = a + b; a = b; b = t;
  }
  return -1;
}
int binetFailLong(void) {
  unsigned long long a = 0, b = 1;
  long double r5 = sqrtl(5.0L), phi = (1 + r5) / 2, psi = (1 - r5) / 2;
  for (int n = 0; n <= 92; n++) {
    long double v = (powl(phi, n) - powl(psi, n)) / r5;
    if ((unsigned long long)llroundl(v) != a) return n;
    unsigned long long t = a + b; a = b; b = t;
  }
  return -1;
}

/* 7. 建模驗證：長度 n、不含連續 00 的二進位字串個數，暴力法 vs 遞迴 a(n) = a(n-1) + a(n-2) */
long long no00Brute(int n) {
  long long cnt = 0;
  for (long long s = 0; s < (1LL << n); s++) {
    int ok = 1;
    for (int i = 0; i + 1 < n; i++)
      if (!((s >> i) & 1) && !((s >> (i + 1)) & 1)) { ok = 0; break; }
    cnt += ok;
  }
  return cnt;
}
long long no00Rec(int n) {                      /* a(1) = 2、a(2) = 3 */
  long long a = 2, b = 3;
  if (n == 1) return 2;
  for (int i = 3; i <= n; i++) { long long t = a + b; a = b; b = t; }
  return b;
}

/* 河內塔：H(n) = 2H(n-1) + 1，用遞迴實際搬一次數步數，對照閉合式 2^n − 1 */
long long hanoiMoves(int n, int from, int to, int via) {
  if (n == 0) return 0;
  long long m = hanoiMoves(n - 1, from, via, to);  /* 上面 n−1 個先移到中間 */
  m += 1;                                          /* 最大的一個移到目標 */
  return m + hanoiMoves(n - 1, via, to, from);     /* n−1 個再疊上去 */
}

int main(void) {
  /* 頁面與動畫的例子 */
  Rec fibInt  = { .k = 2, .c = {0, 1, 1},  .init = {0, 1} };            /* 根無理：工具會回報 */
  Rec rep     = { .k = 2, .c = {0, 4, -4}, .init = {3, 4} };            /* 重根 2 */
  Rec polyEx  = { .k = 2, .c = {0, 5, -6}, .init = {10, 15}, .nf = 1,
                  .f = {{ .s = 1, .d = 1, .P = {7, 2} }} };             /* + 2n + 7 */
  Rec expEx   = { .k = 2, .c = {0, 3, 4},  .init = {3, 23}, .nf = 1,
                  .f = {{ .s = 4, .d = 0, .P = {5} }} };                /* + 5·4^n，4 是特徵根 */
  Rec third   = { .k = 3, .c = {0, 2, 1, -2}, .init = {3, 2, 6} };       /* 根 1, −1, 2 */
  Rec stairs  = { .k = 2, .c = {0, 1, 2},  .init = {1, 1} };            /* 2×n 鋪磚（直放 2×1、兩塊橫放、2×2 方塊） */
  Rec hanoi   = { .k = 1, .c = {0, 2},     .init = {0}, .nf = 1,
                  .f = {{ .s = 1, .d = 0, .P = {1} }} };                /* H(n) = 2H(n-1) + 1 */
  Rec mixed   = { .k = 2, .c = {0, 2, -1}, .init = {1, 4}, .nf = 1,
                  .f = {{ .s = 1, .d = 0, .P = {2} }} };                /* 重根 1 且 f 是常數：乘 n² */
  report("Fibonacci（無理根）", &fibInt);
  report("重根 a(n) = 4a(n-1) - 4a(n-2)", &rep);
  report("多項式 a(n) = 5a(n-1) - 6a(n-2) + 2n + 7", &polyEx);
  report("指數重複 a(n) = 3a(n-1) + 4a(n-2) + 5*4^n", &expEx);
  report("3 階 a(n) = 2a(n-1) + a(n-2) - 2a(n-3)", &third);
  report("a(n) = a(n-1) + 2a(n-2)", &stairs);
  report("河內塔 H(n) = 2H(n-1) + 1", &hanoi);
  report("a(n) = 2a(n-1) - a(n-2) + 2（重根 1）", &mixed);

  /* 驗算考古題 */
  Rec e30 = { .k = 2, .c = {0, 5, -6}, .init = {3, 7}, .nf = 1, .f = {{ .s = 1, .d = 0, .P = {2} }} };
  Rec e32 = { .k = 2, .c = {0, 4, -3}, .init = {3000, 3300}, .nf = 1, .f = {{ .s = 1, .d = 0, .P = {-200} }} };
  Rec e42 = { .k = 2, .c = {0, 4, -4}, .init = {2, 10}, .nf = 2,
              .f = {{ .s = 2, .d = 0, .P = {1} }, { .s = 3, .d = 0, .P = {1} }} };
  Rec e158 = { .k = 1, .c = {0, 3}, .init = {2}, .nf = 1, .f = {{ .s = 3, .d = 0, .P = {5} }} };
  Rec e176 = { .k = 3, .c = {0, 6, -11, 6}, .init = {1, 2, 2} };
  report("考古 dm-0030", &e30);
  report("考古 dm-0032", &e32);
  report("考古 dm-0042", &e42);
  report("考古 dm-0158", &e158);
  report("考古 dm-0176", &e176);

  printf("== Binet 公式：double 從 n = %d 開始錯，long double 從 n = %d 開始錯\n", binetFailDouble(), binetFailLong());
  printf("== 不含 00 的字串：");
  for (int n = 1; n <= 12; n++) {
    if (no00Brute(n) != no00Rec(n)) { printf("n = %d 不一致\n", n); return 1; }
    printf("%lld ", no00Rec(n));
  }
  printf("（暴力法全部一致）\n== 河內塔：");
  for (int n = 1; n <= 10; n++) {
    long long m = hanoiMoves(n, 0, 2, 1);
    if (m != (1LL << n) - 1) { printf("n = %d 不一致\n", n); return 1; }
    printf("%lld ", m);
  }
  printf("（都等於 2^n − 1）\n");
  return 0;
}
