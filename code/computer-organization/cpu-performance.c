/* CPU Time and CPI（CPU 時間與 CPI）
 * 平均 CPI、CPU time、MIPS、兩部機器比較、改良單一指令類別、roofline 可達效能
 * 編譯：gcc -std=c99 -Wall -Wextra -fsanitize=address,undefined cpu-performance.c -o cpu-performance
 */
#include <stdio.h>

#define MAXC 8

typedef struct {
  const char *name;   /* 指令類別名稱，例如 INT、L/S */
  double cpi;         /* 這類指令每條要幾個 clock cycle */
  double count;       /* 這類指令的數量（或比例，evaluate 會自己正規化） */
} InstClass;

typedef struct {
  double ic;          /* instruction count：總指令數 */
  double cpi;         /* 平均 CPI */
  double cycles;      /* 總 clock cycle 數 */
  double seconds;     /* CPU time */
  double mips;        /* 每秒執行幾百萬條指令 */
} Perf;

/* CPU time = IC × CPI × cycle time = IC × CPI ÷ clock rate */
double cpuTime(double ic, double cpi, double clockHz) {
  return ic * cpi / clockHz;
}

/* 由量到的時間反推平均 CPI */
double cpiFromTime(double seconds, double ic, double cycleTime) {
  return seconds / (ic * cycleTime);
}

Perf evaluate(const InstClass cls[], int n, double clockHz) {
  Perf p = {0, 0, 0, 0, 0};
  for (int i = 0; i < n; i++) p.ic += cls[i].count;      /* 總指令數 IC */
  for (int i = 0; i < n; i++) {
    double frac = cls[i].count / p.ic;                    /* 這類指令佔的比例 */
    p.cpi += frac * cls[i].cpi;                           /* 加權平均 CPI */
  }
  p.cycles = p.ic * p.cpi;                                /* 總 clock cycles */
  p.seconds = p.cycles / clockHz;                         /* CPU time = cycles ÷ clock rate */
  p.mips = clockHz / (p.cpi * 1e6);                       /* MIPS = clock rate ÷ (CPI × 10^6) */
  return p;
}

/* 效能 = 1 / 執行時間，所以「快幾倍」= 時間的反比 */
double speedup(Perf before, Perf after) {
  return before.seconds / after.seconds;
}

/* 只把第 k 類的 CPI 改成 newCPI，其他不變 */
Perf improveClass(const InstClass cls[], int n, int k, double newCPI, double clockHz) {
  InstClass tmp[MAXC];
  for (int i = 0; i < n; i++) tmp[i] = cls[i];
  tmp[k].cpi = newCPI;
  return evaluate(tmp, n, clockHz);
}

/* 只改第 k 類，要快 target 倍時它的 CPI 最多是多少；做不到回傳 -1 */
double cpiNeeded(const InstClass cls[], int n, int k, double target) {
  double total = 0;
  for (int i = 0; i < n; i++) total += cls[i].count * cls[i].cpi;
  double others = total - cls[k].count * cls[k].cpi;      /* 其他類別的 cycle 不會變 */
  double left = total / target - others;                  /* 留給第 k 類的 cycle 數 */
  if (left <= 0) return -1;                               /* 就算第 k 類變成 0 也不夠 */
  return left / cls[k].count;
}

/* roofline：可達效能 = min(峰值運算, 記憶體頻寬 × arithmetic intensity) */
double attainable(double peakFlops, double bandwidth, double intensity) {
  double memRoof = bandwidth * intensity;
  return memRoof < peakFlops ? memRoof : peakFlops;
}

static void show(const char *title, Perf p) {
  printf("%s：IC = %.4g、CPI = %.4g、cycles = %.4g、CPU time = %.4g s、MIPS = %.4g\n",
         title, p.ic, p.cpi, p.cycles, p.seconds, p.mips);
}

int main(void) {
  /* 例 0：頁面的教學例（比例 %，IC = 2 × 10^9，2.5 GHz） */
  InstClass t[] = { {"ALU", 1, 40}, {"L/S", 3, 35}, {"Branch", 2, 20}, {"FP", 6, 5} };
  Perf e = evaluate(t, 4, 2.5e9);
  printf("例 0：CPI = %.4g、CPU time = %.4g s、MIPS = %.4g\n", e.cpi, cpuTime(2e9, e.cpi, 2.5e9), e.mips);
  printf("  L/S CPI 改成 1.5：加速 %.4f；L/S 變 0 的上限 %.4f；只改 L/S 要快 1.5 倍：CPI ≤ %.4f\n",
         speedup(e, improveClass(t, 4, 1, 1.5, 2.5e9)), speedup(e, improveClass(t, 4, 1, 0, 2.5e9)),
         cpiNeeded(t, 4, 1, 1.5));

  /* 例 1：四類指令（單位 10^6 條），3.2 GHz */
  InstClass f[] = { {"INT", 1, 12e6}, {"FP", 2, 15e6}, {"L/S", 4, 50e6}, {"Branch", 2, 13e6} };
  Perf p = evaluate(f, 4, 3.2e9);
  show("例 1", p);
  printf("  L/S CPI 改成 1.2：加速 %.4f\n", speedup(p, improveClass(f, 4, 2, 1.2, 3.2e9)));
  printf("  FP CPI 改成 0（上限）：加速 %.4f\n", speedup(p, improveClass(f, 4, 1, 0, 3.2e9)));
  printf("  只改 L/S 要快 2 倍：CPI ≤ %.4f；只改 FP：%.4f（-1 表示做不到）\n",
         cpiNeeded(f, 4, 2, 2), cpiNeeded(f, 4, 1, 2));

  /* 例 2：用比例表示（30%、25%、20%、25%），兩部同 ISA 的機器 */
  InstClass p1[] = { {"A", 1, 30}, {"B", 1, 25}, {"C", 4, 20}, {"D", 3, 25} };
  InstClass p2[] = { {"A", 2, 30}, {"B", 2, 25}, {"C", 2, 20}, {"D", 2, 25} };
  Perf a = evaluate(p1, 4, 1e9), b = evaluate(p2, 4, 1.25e9);
  show("P1", a);
  show("P2", b);
  printf("  P2 比 P1 快 %.4f 倍；只改 C 類讓 P1 追上 P2：CPI_C < %.4f\n",
         speedup(a, b), cpiNeeded(p1, 4, 2, speedup(a, b)));

  /* 例 3：MIPS 高的反而慢 */
  printf("A：%.3f s、MIPS %.0f；B：%.3f s、MIPS %.0f\n",
         cpuTime(10e9, 1.0, 4e9), 4e9 / (1.0 * 1e6), cpuTime(8e9, 1.2, 4e9), 4e9 / (1.2 * 1e6));

  /* 例 4：反推 CPI */
  printf("C1 CPI = %.3f、C2 CPI = %.3f\n", cpiFromTime(1.1, 1.0e9, 1e-9), cpiFromTime(1.5, 1.2e9, 1e-9));

  /* 例 5：roofline（峰值 100 GFLOP/s、頻寬 20 GB/s） */
  double ai[] = {0.25, 1, 5, 16};
  for (int i = 0; i < 4; i++)
    printf("intensity %.2f FLOP/B → %.1f GFLOP/s\n", ai[i], attainable(100e9, 20e9, ai[i]) / 1e9);
  return 0;
}
