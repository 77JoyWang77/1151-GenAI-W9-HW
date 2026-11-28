/* Multiprocessors and GPUs（多處理器與 GPU）完整程式
   編譯：gcc -std=c99 -Wall -Wextra -fsanitize=address,undefined multiprocessors.c -lm */
#include <stdio.h>
#include <string.h>

/* ===================== 1. 加速比與擴展 ===================== */

/* 序列部分 serial 個時間單位，可平行的 work 個單位平均分給 p 個核心 */
double parallelTime(double serial, double work, int p) {
  return serial + work / p;
}

/* 負載不平衡：最忙的核心分到 maxShare 個單位，其他核心做完也要等它 */
double imbalancedTime(double serial, double maxShare) {
  return serial + maxShare;
}

double speedupOf(double t1, double tp) { return t1 / tp; }
double efficiency(double t1, double tp, int p) { return t1 / tp / p; }

/* ===================== 2. 樹狀平行加總 ===================== */

/* 樹狀加總：每一輪讓前一半的核心把後一半的部分和加進來 */
float treeSum(float part[], int p) {
  for (int half = p / 2; half >= 1; half /= 2)   /* 每輪參與的核心數減半 */
    for (int i = 0; i < half; i++)               /* 這一輪 i = 0..half-1 同時做 */
      part[i] = part[i] + part[i + half];        /* 真的平行時，每輪之間要 barrier */
  return part[0];
}

/* ===================== 3. 共享變數的交錯執行 ===================== */

#define MAXI 16
#define MAXC 3
typedef enum { LOAD, ADDI, MULI, STORE, STOREI } Op;
typedef struct { Op op; int var; int k; int first; } Inst;   /* first：高階運算的第一條 */
typedef struct { Inst prog[MAXI]; int len, pc, reg; } Core;

int mem[2];                    /* 共享記憶體裡的兩個變數 a、b */
int atomicOps;                 /* 1：每個高階運算（例如 a += 1）不可分割 */
int seenA[4096], seenB[4096], nSeen;

void step(Core *c) {
  Inst in = c->prog[c->pc];
  switch (in.op) {
    case LOAD:   c->reg = mem[in.var]; break;      /* 讀共享記憶體到自己的暫存器 */
    case ADDI:   c->reg = c->reg + in.k; break;    /* 只改自己的暫存器 */
    case MULI:   c->reg = c->reg * in.k; break;
    case STORE:  mem[in.var] = c->reg; break;      /* 寫回共享記憶體，別人才看得到 */
    case STOREI: mem[in.var] = in.k; break;
  }
  c->pc++;
}

/* 加鎖（原子）時：一次把整個高階運算做完，中間不讓別人插隊 */
void runOp(Core *c) {
  do step(c); while (c->pc < c->len && !c->prog[c->pc].first);
}

void record(int a, int b) {
  for (int i = 0; i < nSeen; i++) if (seenA[i] == a && seenB[i] == b) return;
  if (nSeen < 4096) { seenA[nSeen] = a; seenB[nSeen] = b; nSeen++; }
}

/* 窮舉所有交錯：每次選一個還沒跑完的核心先走一步 */
void explore(Core cs[], int n) {
  int moved = 0;
  for (int i = 0; i < n; i++) {
    if (cs[i].pc == cs[i].len) continue;       /* 這個核心已經跑完 */
    Core saved = cs[i];
    int m0 = mem[0], m1 = mem[1];
    if (atomicOps) runOp(&cs[i]); else step(&cs[i]);
    explore(cs, n);
    cs[i] = saved; mem[0] = m0; mem[1] = m1;   /* 還原，換下一個核心先走 */
    moved = 1;
  }
  if (!moved) record(mem[0], mem[1]);          /* 全部跑完：記下一種結果 */
}

/* 組出一個核心的程式：x += k 變成 load / addi / store 三條 */
void emit(Core *c, Op op, int var, int k, int first) {
  Inst in = { op, var, k, first };
  c->prog[c->len++] = in;
}
void opAdd(Core *c, int var, int k) { emit(c, LOAD, var, 0, 1); emit(c, ADDI, var, k, 0); emit(c, STORE, var, 0, 0); }
void opMul(Core *c, int var, int k) { emit(c, LOAD, var, 0, 1); emit(c, MULI, var, k, 0); emit(c, STORE, var, 0, 0); }
void opSet(Core *c, int var, int k) { emit(c, STOREI, var, k, 1); }

void showOutcomes(const char *title, Core cs[], int n, int a0, int b0, int atomic) {
  mem[0] = a0; mem[1] = b0; nSeen = 0; atomicOps = atomic;
  explore(cs, n);
  /* 依 a、b 排序後印出 */
  for (int i = 0; i < nSeen; i++)
    for (int j = i + 1; j < nSeen; j++)
      if (seenA[j] < seenA[i] || (seenA[j] == seenA[i] && seenB[j] < seenB[i])) {
        int t = seenA[i]; seenA[i] = seenA[j]; seenA[j] = t;
        t = seenB[i]; seenB[i] = seenB[j]; seenB[j] = t;
      }
  printf("%s%s：", title, atomic ? "（加鎖）" : "");
  for (int i = 0; i < nSeen; i++) printf(" (a=%d,b=%d)", seenA[i], seenB[i]);
  printf("\n");
}

/* ===================== 4. 同步指令（MIPS ll / sc） =====================
   用 ll / sc 做 atomic swap（交換 $s4 與 0($s1)）：
try:  add  $t0, $zero, $s4   # 要寫進去的值
      ll   $t1, 0($s1)       # load linked：讀舊值，並記下這個位址
      sc   $t0, 0($s1)       # store conditional：期間沒人寫過才成功，$t0 = 1
      beq  $t0, $zero, try   # 失敗（$t0 = 0）就整段重來
      add  $s4, $zero, $t1   # 把讀到的舊值放進 $s4

   用 ll / sc 做 spin lock（0($s1) 為 0 表示沒人拿，1 表示被占用）：
lock: ll   $t0, 0($s1)       # 讀鎖目前的值
      bne  $t0, $zero, lock  # 已經被占用就繼續轉（spin）
      addi $t0, $zero, 1
      sc   $t0, 0($s1)       # 試著把 1 寫進去
      beq  $t0, $zero, lock  # 被別人搶先寫了，sc 失敗，重來
      ...                    # critical section
      sw   $zero, 0($s1)     # unlock：寫回 0 就好，不用 ll / sc
*/

/* ===================== 5. Snooping：MSI / MESI ===================== */

#define MAXP 4
enum { I, S, E, M };
const char *stName = "ISEM";
int state[MAXP];               /* 每個核心快取裡這個 block 的狀態 */
int nproc, useMESI;
int busTx, invals, flushes, misses;

void access(int p, int isWrite) {
  int others = 0;                                    /* 其他快取有沒有副本 */
  for (int q = 0; q < nproc; q++) if (q != p && state[q] != I) others = 1;
  if (!isWrite) {                                    /* ---- 讀 ---- */
    if (state[p] != I) return;                       /* S、E、M 都是 read hit */
    busTx++; misses++;                               /* read miss：送出 BusRd */
    for (int q = 0; q < nproc; q++) {
      if (q == p) continue;
      if (state[q] == M) { flushes++; state[q] = S; } /* 有最新值的寫回，降成 S */
      else if (state[q] == E) state[q] = S;
    }
    state[p] = (useMESI && !others) ? E : S;         /* MESI：沒人有副本就拿 E */
    return;
  }
  /* ---- 寫 ---- */
  if (state[p] == M) return;                         /* write hit，不必通知別人 */
  if (state[p] == E) { state[p] = M; return; }       /* 獨占：悄悄升成 M，不上 bus */
  busTx++;                                           /* S：BusUpgr；I：BusRdX */
  if (state[p] == I) misses++;
  for (int q = 0; q < nproc; q++) {
    if (q == p || state[q] == I) continue;
    if (state[q] == M) flushes++;                    /* 最新值先寫回 */
    state[q] = I;                                    /* 其他副本全部作廢 */
    invals++;
  }
  state[p] = M;
}

void resetCaches(int n, int mesi) {
  nproc = n; useMESI = mesi; busTx = invals = flushes = misses = 0;
  for (int q = 0; q < MAXP; q++) state[q] = I;
}

/* trace 例如 "0r 1r 1w 2r 0w"：核心編號 + r / w */
void runTrace(const char *trace, int n, int mesi) {
  resetCaches(n, mesi);
  for (const char *s = trace; *s; s++) {
    if (*s >= '0' && *s <= '9' && (s[1] == 'r' || s[1] == 'w')) {
      access(*s - '0', s[1] == 'w');
      s++;
    }
  }
  printf("%s [%s]：最後狀態", mesi ? "MESI" : "MSI ", trace);
  for (int q = 0; q < n; q++) printf(" P%d=%c", q, stName[state[q]]);
  printf("；bus 交易 %d、miss %d、invalidate %d、寫回 %d\n", busTx, misses, invals, flushes);
}

/* ===================== 6. 互連網路：連線數與 bisection ===================== */

#define MAXN 16
int adj[MAXN][MAXN];

void clearNet(void) { memset(adj, 0, sizeof adj); }
void link2(int a, int b) { if (a != b) adj[a][b] = adj[b][a] = 1; }

int countLinks(int n) {
  int c = 0;
  for (int a = 0; a < n; a++) for (int b = a + 1; b < n; b++) c += adj[a][b];
  return c;
}

/* 窮舉所有把節點分成兩半的方法，找跨過切線的最少連線數 */
int bisection(int n) {
  int best = 1 << 30;
  for (int mask = 0; mask < (1 << n); mask++) {
    if (!(mask & 1) || __builtin_popcount(mask) != n / 2) continue;   /* 固定節點 0 在左半，避免重複 */
    int cut = 0;
    for (int a = 0; a < n; a++) for (int b = a + 1; b < n; b++)
      if (adj[a][b] && (((mask >> a) & 1) != ((mask >> b) & 1))) cut++;
    if (cut < best) best = cut;
  }
  return best;
}

void buildRing(int n) { clearNet(); for (int i = 0; i < n; i++) link2(i, (i + 1) % n); }
void buildMesh(int k, int wrap) {             /* k × k 網格；wrap = 1 是 torus */
  clearNet();
  for (int r = 0; r < k; r++) for (int c = 0; c < k; c++) {
    int v = r * k + c;
    if (c + 1 < k) link2(v, v + 1); else if (wrap) link2(v, r * k);
    if (r + 1 < k) link2(v, v + k); else if (wrap) link2(v, c);
  }
}
void buildFull(int n) { clearNet(); for (int a = 0; a < n; a++) for (int b = a + 1; b < n; b++) link2(a, b); }
void buildCube(int d) { clearNet(); for (int v = 0; v < (1 << d); v++) for (int k = 0; k < d; k++) link2(v, v ^ (1 << k)); }

/* ===================== 7. GPU：warp divergence 與延遲隱藏 ===================== */

/* 一個 warp 的 thread 依條件分兩路：只要兩路都有人走，兩路都要依序執行 */
int warpCycles(const int takeIf[], int lanes, int ifCycles, int elseCycles) {
  int nIf = 0;
  for (int t = 0; t < lanes; t++) nIf += takeIf[t];
  int cycles = 0;
  if (nIf > 0) cycles += ifCycles;          /* 有人走 if：全 warp 跑 if，其他 lane 被 mask */
  if (nIf < lanes) cycles += elseCycles;    /* 有人走 else：再跑一次 else */
  return cycles;
}

/* 每個 warp 連續算 compute 個 cycle 後發一次要等 latency 個 cycle 的 load；
   要讓排程器每個 cycle 都有 warp 可發，至少需要幾個 warp */
int warpsToHide(int compute, int latency) {
  return (latency + compute - 1) / compute + 1;
}

/* 模擬：n 個 warp 輪流發指令，回傳 T 個 cycle 裡有幾個 cycle 閒置 */
int simulateIdle(int n, int compute, int latency, int T) {
  int left[64], readyAt[64], idle = 0;
  for (int w = 0; w < n; w++) { left[w] = compute; readyAt[w] = 0; }
  for (int t = 0; t < T; t++) {
    int w = -1;
    for (int k = 0; k < n; k++) if (readyAt[k] <= t) { w = k; break; }
    if (w < 0) { idle++; continue; }
    if (--left[w] == 0) { left[w] = compute; readyAt[w] = t + 1 + latency; }   /* 最後一條是 load */
  }
  return idle;
}

/* ===================== 8. 向量處理器：strip mining ===================== */

/* 向量長度上限 mvl：n 個元素切成好幾段，第一段先處理餘數 */
int daxpyStrip(int n, double a, const double x[], double y[], int mvl) {
  int low = 0, segments = 0;
  int vl = n % mvl;                             /* 第一段先處理餘數（可能是 0） */
  if (vl == 0) vl = mvl;
  for (int j = 0; j <= (n - 1) / mvl; j++) {    /* 共 ceil(n / mvl) 段 */
    for (int i = low; i < low + vl; i++)        /* 這一段等於一組向量指令 */
      y[i] = a * x[i] + y[i];
    low += vl;
    vl = mvl;                                   /* 之後每一段都是最長 */
    segments++;
  }
  return segments;
}

/* ===================== 測試 ===================== */

int main(void) {
  /* 1. 加速比：20 個序列加法 + N×N 矩陣加總 */
  int P[] = {1, 8, 32};
  for (int s = 16; s <= 32; s += 16) {
    double work = (double)s * s, t1 = parallelTime(20, work, 1);
    for (int k = 1; k < 3; k++) {
      double tp = parallelTime(20, work, P[k]);
      printf("N=%d P=%d：T1=%.0f Tp=%.2f speedup=%.2f 效率=%.1f%%\n", s, P[k], t1, tp,
             speedupOf(t1, tp), 100 * efficiency(t1, tp, P[k]));
    }
  }
  printf("weak：P=8、N=16 → %.0f；P=32、N=32 → %.0f\n", parallelTime(20, 256, 8), parallelTime(20, 1024, 32));
  double tImb = imbalancedTime(20, 64);
  printf("不平衡：N=32、P=32、最忙的分到 64 → Tp=%.0f speedup=%.2f\n", tImb, speedupOf(1044, tImb));

  /* 2. 樹狀加總：浮點數加總順序不同，結果可能不同 */
  float part[8] = {1e8f, 1, 1, 1, -1e8f, 1, 1, 1};
  float seq = 0;
  for (int i = 0; i < 8; i++) seq += part[i];
  printf("循序加總 = %.1f，樹狀加總 = %.1f\n", seq, treeSum(part, 8));

  /* 3. 交錯 */
  Core c2[2];
  memset(c2, 0, sizeof c2);
  opAdd(&c2[0], 0, 1); opAdd(&c2[0], 1, 1);           /* P1：a++; b++ */
  opSet(&c2[1], 0, 2); opAdd(&c2[1], 1, 2);           /* P2：a = 2; b = b + 2 */
  showOutcomes("a++,b++ ‖ a=2,b+=2", c2, 2, 0, 0, 0);
  showOutcomes("a++,b++ ‖ a=2,b+=2", c2, 2, 0, 0, 1);

  memset(c2, 0, sizeof c2);
  opAdd(&c2[0], 0, 1); opMul(&c2[1], 0, 2);           /* x = x + 1 ‖ x = x * 2，x 初值 1 */
  showOutcomes("x+=1 ‖ x*=2", c2, 2, 1, 0, 0);
  showOutcomes("x+=1 ‖ x*=2", c2, 2, 1, 0, 1);

  Core c3[3];
  memset(c3, 0, sizeof c3);
  opSet(&c3[0], 0, 4); opAdd(&c3[0], 0, 4);
  opAdd(&c3[1], 0, 1); opMul(&c3[1], 0, 2);
  opSet(&c3[2], 0, 6); opMul(&c3[2], 0, 2);
  showOutcomes("三核心 A", c3, 3, 0, 0, 0);

  /* 5. MSI / MESI */
  runTrace("0r 1r 1w 2r 0w", 3, 0);
  runTrace("0r 1r 1w 2r 0w", 3, 1);
  runTrace("0r 0w 1r 1w 0r", 2, 0);
  runTrace("0r 0w 1r 1w 0r", 2, 1);
  runTrace("0r 1r 2r 0w 1w 2w", 3, 0);
  runTrace("0r 1r 2r 0w 1w 2w", 3, 1);
  runTrace("0w 1w 0w 1w 0w 1w 0w 1w", 2, 0);    /* X、Y 在同一個 block：false sharing */
  runTrace("0w 0w 0w 0w", 2, 0);                  /* X、Y 在不同 block：X 的 block 只有 P0 在寫 */
  runTrace("1w 1w 1w 1w", 2, 0);                  /* Y 的 block 只有 P1 在寫 */

  /* 6. 互連網路（16 個節點） */
  buildRing(16);    printf("ring    ：連線 %d、bisection %d\n", countLinks(16), bisection(16));
  buildMesh(4, 0);  printf("4x4 mesh：連線 %d、bisection %d\n", countLinks(16), bisection(16));
  buildMesh(4, 1);  printf("4x4 torus：連線 %d、bisection %d\n", countLinks(16), bisection(16));
  buildCube(4);     printf("hypercube：連線 %d、bisection %d\n", countLinks(16), bisection(16));
  buildFull(16);    printf("全連接  ：連線 %d、bisection %d\n", countLinks(16), bisection(16));

  /* 7. GPU */
  int lanes[32];
  for (int t = 0; t < 32; t++) lanes[t] = (t % 4 == 0);
  int cyc = warpCycles(lanes, 32, 20, 10);
  printf("tid %% 4 == 0：warp 花 %d cycles，有效率 %.1f%%\n", cyc, 100.0 * (8 * 20 + 24 * 10) / (32.0 * cyc));
  for (int t = 0; t < 32; t++) lanes[t] = 1;
  printf("整個 warp 同一路：%d cycles\n", warpCycles(lanes, 32, 20, 10));
  int total = 0;                                  /* 128 個 thread、以 warp 為單位分路：warp 0 走 if */
  for (int w = 0; w < 4; w++) {
    for (int t = 0; t < 32; t++) lanes[t] = (w % 4 == 0);
    total += warpCycles(lanes, 32, 20, 10);
  }
  printf("以 warp 為單位分路：4 個 warp 共 %d cycles（分歧版 4 × 30 = 120）\n", total);
  printf("10 個 warp：使用率 %.1f%%（模擬 42000 cycles）\n", 100.0 * (42000 - simulateIdle(10, 20, 400, 42000)) / 42000);
  printf("compute 20、latency 400：至少 %d 個 warp；模擬 n=20 閒置 %d、n=21 閒置 %d（10000 cycles）\n",
         warpsToHide(20, 400), simulateIdle(20, 20, 400, 10000), simulateIdle(21, 20, 400, 10000));

  /* 8. strip mining */
  double x[1000], y[1000];
  for (int i = 0; i < 1000; i++) { x[i] = i; y[i] = 1; }
  int seg = daxpyStrip(1000, 2.0, x, y, 64);
  printf("n=1000、MVL=64：%d 段，第一段 %d 個，y[999]=%.0f\n", seg, 1000 % 64, y[999]);
  return 0;
}
