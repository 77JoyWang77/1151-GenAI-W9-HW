/* Master Theorem（主定理）完整程式
   編譯：gcc -std=c99 -Wall -Wextra -fsanitize=address,undefined master-theorem.c -lm */
#include <stdio.h>
#include <math.h>

#define EPS 1e-9

/* f(n) = n^k · (lg n)^p，lg 是以 2 為底的對數 */
double f(double n, double k, int p) {
  return pow(n, k) * pow(log2(n), p);
}

/* 臨界指數 log_b a：遞迴樹的葉子有 n^(log_b a) 片 */
double critExp(int a, int b) {
  return log(a) / log(b);
}

/* 判斷 T(n) = aT(n/b) + n^k lg^p n 落在哪個 case 並印出答案；回傳 1、2、3，不能套用回傳 0 */
int masterCase(int a, int b, double k, int p) {
  double e = critExp(a, b);
  if (k < e - EPS) {                       /* f 比 n^e 小了一個多項式倍：葉子主導 */
    printf("case 1：T(n) = Θ(n^%.3f)\n", e);
    return 1;
  }
  if (k > e + EPS) {                       /* f 比 n^e 大了一個多項式倍：樹根主導 */
    double c = a / pow(b, k);              /* 正則條件：a·f(n/b) ≤ c·f(n)，c = a / b^k < 1 */
    printf("case 3（c = %.3f < 1）：T(n) = Θ(n^%g lg^%d n)\n", c, k, p);
    return 3;
  }
  if (p >= 0) {                            /* 同階：每層差不多一樣大，再乘上層數 lg n */
    printf("case 2：T(n) = Θ(n^%.3f lg^%d n)\n", e, p + 1);
    return 2;
  }
  printf("不能套用：f = n^%.3f / lg^%d n 落在 case 1 和 case 2 之間\n", e, -p);
  return 0;
}

/* 遞迴樹：n = b^L，第 i 層有 a^i 個大小 n/b^i 的子問題，最後一層是葉子 */
double recursionTree(int a, int b, double k, int p, int L) {
  double n = pow(b, L), total = 0;
  for (int i = 0; i < L; i++) {
    double nodes = pow(a, i);              /* 第 i 層的節點數 */
    double size = n / pow(b, i);           /* 每個子問題的大小 */
    double level = nodes * f(size, k, p);  /* 這一層的總成本 */
    printf("  第 %d 層：%g 個 × f(%g) = %g\n", i, nodes, size, level);
    total += level;
  }
  double leaves = pow(a, L);               /* a^L = n^(log_b a) 片葉子，每片 T(1) = 1 */
  printf("  葉子：%g 個 × T(1) = %g\n", leaves, leaves);
  return total + leaves;
}

/* 直接照遞迴式算 T(n)：a 個子問題大小都一樣，遞迴一次再乘 a */
double T(double n, int a, int b, double k, int p) {
  if (n < b) return 1;                     /* T(1) = 1 */
  return a * T(n / b, a, b, k, p) + f(n, k, p);
}

/* 真的把問題分成 a 個子問題去遞迴，並數總共呼叫幾次 */
long calls;
double Tsplit(long n, int a, int b, double k, int p) {
  calls++;
  if (n < b) return 1;
  double cost = f(n, k, p);                /* 這一層自己的分割、合併成本 */
  for (int j = 0; j < a; j++) cost += Tsplit(n / b, a, b, k, p);
  return cost;
}

/* 主定理給的答案 g(n)；不能套用時用遞迴樹算出的結果 */
double answer(int a, int b, double k, int p, double n) {
  double e = critExp(a, b), lg = log2(n);
  if (k < e - EPS) return pow(n, e);
  if (k > e + EPS) return f(n, k, p);
  if (p >= 0) return pow(n, e) * pow(lg, p + 1);
  if (p == -1) return pow(n, e) * log2(lg);  /* 空隙裡的 n^e / lg n：Θ(n^e lg lg n) */
  return pow(n, e);                          /* p < -1：每層成本加起來收斂，Θ(n^e) */
}

void check(const char *name, int a, int b, double k, int p) {
  printf("\n== %s：T(n) = %dT(n/%d) + n^%g lg^%d n，log_%d %d = %.4f ==\n",
         name, a, b, k, p, b, a, critExp(a, b));
  masterCase(a, b, k, p);
  printf("  %-12s %-16s %-16s %s\n", "n", "T(n)", "g(n)", "T(n)/g(n)");
  for (int m = 4; m <= 24; m += 4) {
    double n = pow(b, m);
    if (n > 1e15) break;
    double t = T(n, a, b, k, p);
    printf("  %-12g %-16.6g %-16.6g %.4f\n", n, t, answer(a, b, k, p, n), t / answer(a, b, k, p, n));
  }
}

int main(void) {
  check("Merge sort", 2, 2, 1, 0);
  check("Binary search", 1, 2, 0, 0);
  check("Strassen", 7, 2, 2, 0);
  check("八個子問題的矩陣乘法", 8, 2, 2, 0);
  check("case 3：2T(n/2)+n^2", 2, 2, 2, 0);
  check("case 3：3T(n/4)+n lg n", 3, 4, 1, 1);
  check("延伸 case 2：2T(n/2)+n lg n", 2, 2, 1, 1);
  check("空隙：2T(n/2)+n/lg n", 2, 2, 1, -1);
  check("空隙：2T(n/2)+n/lg^2 n", 2, 2, 1, -2);
  check("4T(n/2)+n^2 lg n", 4, 2, 2, 1);
  check("9T(n/3)+n", 9, 3, 1, 0);
  check("T(n/3)+1 vs 3T(n/9)+sqrt n", 3, 9, 0.5, 0);
  check("4T(n/2)+n^2.5", 4, 2, 2.5, 0);
  check("2T(n/4)+1", 2, 4, 0, 0);

  printf("\n== 遞迴樹逐層加總 = 直接遞迴 ==\n");
  int A[] = {2, 1, 7, 2, 2}, B[] = {2, 2, 2, 2, 2}, P[] = {0, 0, 0, 0, -1};
  double K[] = {1, 0, 2, 2, 1};
  for (int t = 0; t < 5; t++) {
    double s = recursionTree(A[t], B[t], K[t], P[t], 5);
    printf("  a=%d b=%d k=%g p=%d：遞迴樹總和 %g，T(32) = %g\n", A[t], B[t], K[t], P[t], s, T(32, A[t], B[t], K[t], P[t]));
  }

  printf("\n== 真的分成 a 個子問題遞迴，數呼叫次數 ==\n");
  for (int m = 4; m <= 16; m += 4) {
    long n = 1L << m;
    calls = 0; double t1 = Tsplit(n, 2, 2, 1, 0); long c1 = calls;
    calls = 0; double t2 = Tsplit(n, 1, 2, 0, 0); long c2 = calls;
    printf("  n = %-6ld merge sort：T = %-9g 呼叫 %-7ld 次｜binary search：T = %-4g 呼叫 %ld 次\n", n, t1, c1, t2, c2);
  }
  calls = 0; double t3 = Tsplit(256, 7, 2, 2, 0);
  printf("  n = 256 Strassen：T = %g，呼叫 %ld 次（= (7^9 - 1)/6）\n", t3, calls);
  return 0;
}
