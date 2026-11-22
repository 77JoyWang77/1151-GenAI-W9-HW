/* Pipelining（管線化）完整程式
   1. 模擬一串 MIPS 指令在五階段管線（IF ID EX MEM WB）的時序：
      偵測 RAW 相依，在有／無 forwarding 時插入 stall，算出總週期數與 CPI
   2. 計算時脈週期、加速比、throughput 與 latency
   編譯：gcc -std=c99 -Wall -Wextra -fsanitize=address,undefined pipelining.c */
#include <stdio.h>
#include <string.h>

#define MAXN 16

typedef struct {
  char op[8];
  char dst[8];        /* 寫入的暫存器；sw 沒有，存空字串 */
  char src[2][8];     /* 讀取的暫存器，最多兩個；沒有就是空字串 */
  int isLoad;         /* 1：lw，資料要到 MEM 結束才拿得到 */
} Inst;

int fetch[MAXN];      /* 第 j 條指令 IF 的週期 */
int decode[MAXN];     /* 第 j 條指令真正完成 ID（讀暫存器）的週期；EX = decode + 1 */
int stalls[MAXN];     /* 第 j 條指令被擋了幾個週期 */

/* 把一行組合語言拆成 Inst，支援 R 型（add sub and or slt）、I 型（addi andi ori slti）、lw、sw */
int parse(const char *line, Inst *x) {
  char buf[64], a[8] = "", b[8] = "", c[8] = "";
  strncpy(buf, line, sizeof buf - 1);
  buf[sizeof buf - 1] = '\0';
  for (char *p = buf; *p; p++)
    if (*p == ',' || *p == '(' || *p == ')') *p = ' ';
  if (sscanf(buf, "%7s %7s %7s %7s", x->op, a, b, c) != 4) return 0;
  x->isLoad = strcmp(x->op, "lw") == 0;
  if (x->isLoad) {                          /* lw rt, off(rs)：讀 rs、寫 rt */
    strcpy(x->dst, a); strcpy(x->src[0], c); x->src[1][0] = '\0';
  } else if (strcmp(x->op, "sw") == 0) {    /* sw rt, off(rs)：讀 rt 和 rs、不寫暫存器 */
    x->dst[0] = '\0'; strcpy(x->src[0], a); strcpy(x->src[1], c);
  } else if (x->op[strlen(x->op) - 1] == 'i') { /* addi rt, rs, imm */
    strcpy(x->dst, a); strcpy(x->src[0], b); x->src[1][0] = '\0';
  } else {                                  /* add rd, rs, rt */
    strcpy(x->dst, a); strcpy(x->src[0], b); strcpy(x->src[1], c);
  }
  return 1;
}

/* 找出第 j 條指令之前，最近一條寫入 reg 的指令；沒有就回傳 -1 */
int lastWriter(const Inst *in, int j, const char *reg) {
  if (reg[0] == '\0' || strcmp(reg, "$zero") == 0 || strcmp(reg, "$0") == 0) return -1;
  for (int i = j - 1; i >= 0; i--)
    if (strcmp(in[i].dst, reg) == 0) return i;
  return -1;
}

/* 排出每條指令的時序，回傳總週期數（最後一條指令 WB 的週期） */
int schedule(const Inst *in, int n, int forwarding) {
  for (int j = 0; j < n; j++) {
    fetch[j] = (j == 0) ? 1 : decode[j - 1];   /* 前一條離開 IF/ID，這一條才完成 IF */
    int d = fetch[j] + 1;                      /* 沒有危障：下一個週期就 ID */
    for (int s = 0; s < 2; s++) {
      int i = lastWriter(in, j, in[j].src[s]); /* RAW：我要讀的暫存器是誰寫的 */
      if (i < 0) continue;
      int need;
      if (!forwarding) need = decode[i] + 3;          /* 等它 WB：前半週期寫、後半週期讀 */
      else if (in[i].isLoad) need = decode[i] + 2;    /* load-use：MEM 結束才有資料 */
      else need = decode[i] + 1;                      /* EX 結束就能轉送給下一條 */
      if (need > d) d = need;
    }
    decode[j] = d;
    stalls[j] = d - fetch[j] - 1;              /* 多等的週期就是 stall */
  }
  return decode[n - 1] + 3;                    /* 最後一條：EX、MEM、WB 還要 3 個週期 */
}

/* 印出管線時序圖：stall 畫在 IF 和 ID 之間 */
void printTable(const char lines[][32], int n, int total) {
  printf("%-18s", "");
  for (int c = 1; c <= total; c++) printf("%-6d", c);
  printf("\n");
  for (int j = 0; j < n; j++) {
    printf("%-18s", lines[j]);
    for (int c = 1; c <= total; c++) {
      const char *cell = "";
      int d = decode[j];
      if (c == fetch[j]) cell = "IF";
      else if (c > fetch[j] && c < d) cell = "stall";
      else if (c == d) cell = "ID";
      else if (c == d + 1) cell = "EX";
      else if (c == d + 2) cell = "MEM";
      else if (c == d + 3) cell = "WB";
      printf("%-6s", cell);
    }
    printf("\n");
  }
}

void simulate(const char *title, const char lines[][32], int n) {
  Inst in[MAXN];
  for (int j = 0; j < n; j++)
    if (!parse(lines[j], &in[j])) { printf("格式錯誤：%s\n", lines[j]); return; }
  printf("== %s ==\n", title);
  for (int f = 0; f <= 1; f++) {
    int total = schedule(in, n, f);
    int st = 0;
    for (int j = 0; j < n; j++) st += stalls[j];
    printf("%s forwarding：總週期 %d = 5 + (%d - 1) + %d 個 stall，CPI = %d / %d = %.2f\n",
           f ? "有" : "無", total, n, st, total, n, (double)total / n);
    printTable(lines, n, total);
  }
  printf("\n");
}

/* 單週期與管線的時間比較；stage[] 是各階段延遲（ps），reg 是管線暫存器的額外延遲 */
void pipeTime(const int stage[], int k, int reg, long n) {
  int sum = 0, mx = 0;
  for (int s = 0; s < k; s++) {
    sum += stage[s];
    if (stage[s] > mx) mx = stage[s];
  }
  int cycle = mx + reg;                       /* 時脈由最慢的階段決定 */
  long single = n * sum;                      /* 單週期：每條指令都花 sum */
  long piped = (k + n - 1) * cycle;           /* 管線：填滿 k 個週期，之後每週期完成一條 */
  printf("各階段總和 %d ps、最慢階段 %d ps、管線時脈 %d ps\n", sum, mx, cycle);
  printf("  n = %ld：單週期 %ld ps、管線 %ld ps，加速比 %.3f（理想 %d）\n",
         n, single, piped, (double)single / piped, k);
  printf("  單一指令 latency：單週期 %d ps、管線 %d ps\n", sum, k * cycle);
}

/* 有危障時：平均 CPI = 1 + 每條指令平均 stall 數 */
double effectiveCPI(double loadFrac, double useFrac, double branchFrac, int branchPenalty) {
  return 1 + loadFrac * useFrac * 1 + branchFrac * branchPenalty;
}

/* 洗衣比喻：有時脈的管線，每一步都要等最慢的那台機器 */
void laundry(const int stage[], int k, int loads) {
  int sum = 0, mx = 0;
  for (int s = 0; s < k; s++) { sum += stage[s]; if (stage[s] > mx) mx = stage[s]; }
  printf("洗衣 %d 籃：依序 %d 分鐘，管線 %d 分鐘\n", loads, loads * sum, (k + loads - 1) * mx);
}

int main(void) {
  const char demo[][32] = {"lw $t0,0($s0)", "add $t1,$t0,$t2", "sub $t3,$t1,$t4"};
  simulate("示範：lw → add → sub", demo, 3);

  const char indep[][32] = {"add $t1,$s1,$s2", "sub $t2,$s3,$s4", "and $t3,$s5,$s6", "or $t4,$s1,$s3", "slt $t5,$s2,$s4"};
  simulate("沒有相依", indep, 5);

  const char chain[][32] = {"add $t0,$s1,$s2", "sub $t1,$t0,$s3", "and $t2,$t1,$t0", "or $t3,$t2,$s4"};
  simulate("ALU 連續相依", chain, 4);

  const char gap[][32] = {"lw $t0,0($s0)", "addi $s1,$s1,4", "add $t1,$t0,$t2"};
  simulate("load-use 中間隔一條", gap, 3);

  /* 練習題：co-0010 */
  const char q10[][32] = {"lw $t1,4($s0)", "add $t2,$t1,$s1", "sw $t2,8($s0)", "or $t3,$s2,$s3", "sub $t4,$t3,$t1"};
  simulate("練習題 co-0010", q10, 5);

  /* 練習題：co-0011 重排前後 */
  const char q11a[][32] = {"lw $t0,0($a0)", "add $t1,$t0,$s1", "lw $t2,4($a0)", "sub $t3,$t2,$s2", "sw $t1,8($a0)", "sw $t3,12($a0)"};
  simulate("練習題 co-0011 重排前", q11a, 6);
  const char q11b[][32] = {"lw $t0,0($a0)", "lw $t2,4($a0)", "add $t1,$t0,$s1", "sub $t3,$t2,$s2", "sw $t1,8($a0)", "sw $t3,12($a0)"};
  simulate("練習題 co-0011 重排後", q11b, 6);

  /* 最壞情況：6 條全部相依、沒有 forwarding */
  const char worst[][32] = {"lw $t0,0($s0)", "add $t1,$t0,$t0", "sub $t2,$t1,$t1", "and $t3,$t2,$t2", "or $t4,$t3,$t3", "sw $t4,4($s0)"};
  simulate("最壞情況", worst, 6);

  int st1[] = {250, 150, 200, 300, 100};      /* 頁面例子 */
  pipeTime(st1, 5, 20, 1);
  pipeTime(st1, 5, 20, 100);
  pipeTime(st1, 5, 20, 1000000);
  int bal[] = {200, 200, 200, 200, 200};      /* 同樣總和但完全平衡 */
  pipeTime(bal, 5, 0, 100);
  pipeTime(bal, 5, 0, 1000000);
  int q8[] = {180, 120, 200, 250, 90};        /* 練習題 co-0008 */
  pipeTime(q8, 5, 0, 1);
  int q9[] = {220, 160, 240, 280, 140};       /* 練習題 co-0009 */
  pipeTime(q9, 5, 20, 1000);

  double cpi = effectiveCPI(0.25, 0.4, 0.15, 2);  /* 練習題 co-0012 */
  printf("co-0012：CPI = %.2f，加速比 = 1000 / (%.2f × 220) = %.3f\n", cpi, cpi, 1000 / (cpi * 220));
  printf("頁面例子：CPI = %.2f\n", effectiveCPI(0.3, 0.5, 0.1, 1));

  int wash[] = {30, 40, 20};
  laundry(wash, 3, 4);
  int wash2[] = {30, 30, 30};
  laundry(wash2, 3, 4);
  laundry(wash2, 3, 100);
  return 0;
}
