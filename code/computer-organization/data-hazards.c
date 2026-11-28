/* Data Hazards and Forwarding（資料危障與轉送）完整程式
   1. 找出指令之間的 RAW / WAR / WAW 相依
   2. 五階段管線逐週期模擬：forwarding unit 決定 ForwardA / ForwardB，
      hazard detection unit 偵測 load-use 並插入 bubble
   3. 編譯器重排指令，避開 load-use stall
   編譯：gcc -std=c99 -Wall -Wextra -fsanitize=address,undefined data-hazards.c */
#include <stdio.h>
#include <string.h>
#include <stdlib.h>

#define MAXN 16
#define EMPTY -1      /* 管線暫存器是空的（還沒有指令進來） */
#define BUBBLE -2     /* hazard detection unit 塞進來的 bubble（控制訊號全為 0） */

typedef struct {
  char op[8];
  int dst;            /* 寫入的暫存器編號（R 型的 rd、addi 與 lw 的 rt）；不寫暫存器為 -1 */
  int rs, rt;         /* 讀取的暫存器編號；沒用到為 -1。rs → ALU 上方輸入，rt → 下方輸入或 sw 要存的資料 */
  int regWrite;       /* 會寫回暫存器 */
  int memRead;        /* lw：資料要到 MEM 結束才拿得到 */
  int memWrite;       /* sw */
  int off;            /* lw / sw 的位移，base 就是 rs */
} Inst;

/* 暫存器名稱 → 編號：$zero、$0～$31、$at、$v0、$a0、$t0、$s0、$k0、$gp、$sp、$fp、$ra */
int regNum(const char *s) {
  static const char *name[32] = {"zero", "at", "v0", "v1", "a0", "a1", "a2", "a3",
    "t0", "t1", "t2", "t3", "t4", "t5", "t6", "t7", "s0", "s1", "s2", "s3", "s4", "s5", "s6", "s7",
    "t8", "t9", "k0", "k1", "gp", "sp", "fp", "ra"};
  if (s[0] != '$') return -1;
  s++;
  for (int k = 0; k < 32; k++)
    if (strcmp(s, name[k]) == 0) return k;
  char *end;
  long v = strtol(s, &end, 10);
  if (end != s && *end == '\0' && v >= 0 && v < 32) return (int)v;
  return -1;
}

/* 把一行組合語言拆成 Inst：add/sub/and/or/slt rd,rs,rt、addi/andi/ori/slti rt,rs,imm、lw/sw rt,off(rs) */
int parse(const char *line, Inst *x) {
  char buf[64], a[8] = "", b[8] = "", c[8] = "";
  strncpy(buf, line, sizeof buf - 1);
  buf[sizeof buf - 1] = '\0';
  for (char *p = buf; *p; p++)
    if (*p == ',' || *p == '(' || *p == ')') *p = ' ';
  if (sscanf(buf, "%7s %7s %7s %7s", x->op, a, b, c) != 4) return 0;
  x->memRead = strcmp(x->op, "lw") == 0;
  x->memWrite = strcmp(x->op, "sw") == 0;
  x->off = 0;
  if (x->memRead || x->memWrite) {          /* lw / sw rt, off(rs) */
    x->off = atoi(b);
    x->rs = regNum(c);
    x->rt = x->memWrite ? regNum(a) : -1;   /* sw 讀 rt（要存的資料） */
    x->dst = x->memRead ? regNum(a) : -1;   /* lw 寫 rt */
  } else if (x->op[strlen(x->op) - 1] == 'i') { /* addi rt, rs, imm：第二個運算元是立即值 */
    x->dst = regNum(a); x->rs = regNum(b); x->rt = -1;
  } else {                                  /* add rd, rs, rt */
    x->dst = regNum(a); x->rs = regNum(b); x->rt = regNum(c);
  }
  x->regWrite = x->dst >= 0;
  return 1;
}

/* 1. 相依分析：j 在 i 後面 */
void findDeps(const Inst *in, int n) {
  for (int j = 1; j < n; j++)
    for (int i = 0; i < j; i++) {
      int r = in[i].dst, newest = 1;
      for (int k = i + 1; k < j; k++)       /* 中間有人又寫了 r，j 讀到的就不是 i 的結果 */
        if (in[k].dst == r) newest = 0;
      if (r > 0 && newest && (r == in[j].rs || r == in[j].rt))
        printf("  I%d → I%d：RAW（true dependence），$%d\n", i + 1, j + 1, r);
      r = in[j].dst;
      if (r > 0 && (r == in[i].rs || r == in[i].rt))
        printf("  I%d → I%d：WAR（anti-dependence），$%d\n", i + 1, j + 1, r);
      if (r > 0 && r == in[i].dst)
        printf("  I%d → I%d：WAW（output dependence），$%d\n", i + 1, j + 1, r);
    }
}

/* 2. Forwarding unit：EX 階段的運算元 src 要從哪裡來
      回傳 2（10：EX/MEM）、1（01：MEM/WB）、0（00：ID/EX 從暫存器檔讀出的值） */
int forwardSel(int src, const Inst *exmem, const Inst *memwb) {
  if (src < 0) return 0;                                  /* 沒用到這個運算元 */
  if (exmem && exmem->regWrite && exmem->dst != 0 && exmem->dst == src)
    return 2;                                             /* EX hazard：上一條剛算完 */
  if (memwb && memwb->regWrite && memwb->dst != 0 && memwb->dst == src)
    return 1;                                             /* MEM hazard：EX/MEM 沒命中才輪到它 */
  return 0;
}

/* Hazard detection unit：EX 的 lw 要寫的暫存器，正是 ID 的指令要讀的 → 停一個週期 */
int loadUseStall(const Inst *idex, const Inst *ifid) {
  return idex && ifid && idex->memRead &&
         (idex->dst == ifid->rs || idex->dst == ifid->rt);
}

static const char *SEL[] = {"00", "01", "10"};
static const char *STAGE[] = {"IF", "ID", "EX", "MEM", "WB"};
int fwdA[MAXN], fwdB[MAXN];   /* 每條指令在 EX 時 forwarding unit 選的 ForwardA / ForwardB */
#define AT(k) ((k) >= 0 ? &in[k] : NULL)

/* 印出一個週期各階段是哪條指令（- 是空的，nop 是 bubble） */
static void trace(int cycle, const int st[5], int stall) {
  printf("  週期 %2d：", cycle);
  for (int k = 0; k < 5; k++) {
    char buf[16];
    if (st[k] >= 0) snprintf(buf, sizeof buf, "I%d", st[k] + 1);
    else strcpy(buf, st[k] == BUBBLE ? "nop" : "-");
    printf("%s %-4s", STAGE[k], buf);
  }
  if (st[2] >= 0) printf("  ForwardA=%s ForwardB=%s", SEL[fwdA[st[2]]], SEL[fwdB[st[2]]]);
  if (stall) printf("  load-use → stall");
  printf("\n");
}

/* 逐週期模擬；回傳總週期數，*nStall 存 stall 次數 */
int simulate(const Inst *in, int n, int verbose, int *nStall) {
  int pc = 0, ifid = EMPTY, idex = EMPTY, exmem = EMPTY, memwb = EMPTY;
  *nStall = 0;
  for (int cycle = 1; ; cycle++) {
    int fetch = pc < n ? pc : EMPTY;        /* 這個週期 IF 抓的指令 */
    if (fetch < 0 && ifid < 0 && idex < 0 && exmem < 0 && memwb < 0) return cycle - 1;
    if (idex >= 0) {                        /* EX 的指令：forwarding unit 選 ALU 的兩個輸入 */
      fwdA[idex] = forwardSel(in[idex].rs, AT(exmem), AT(memwb));
      fwdB[idex] = forwardSel(in[idex].rt, AT(exmem), AT(memwb));
    }
    int stall = loadUseStall(AT(idex), AT(ifid));   /* ID 的指令要用 EX 那條 lw 的結果？ */
    if (verbose) {
      int st[5] = {fetch, ifid, idex, exmem, memwb};
      trace(cycle, st, stall);
    }
    /* 時脈邊緣：管線暫存器一起往後移 */
    memwb = exmem;
    exmem = idex;
    if (stall) {                            /* PCWrite = 0、IF/IDWrite = 0：PC 和 IF/ID 不動 */
      idex = BUBBLE;                        /* 控制訊號清 0 送進 ID/EX：往 EX 塞一個 bubble */
      (*nStall)++;
    } else {
      idex = ifid;
      ifid = fetch;
      if (fetch >= 0) pc++;
    }
  }
}

/* 3. 編譯器重排：a 原本在 b 前面，兩者能不能交換順序 */
int conflict(const Inst *a, const Inst *b) {
  if (a->dst > 0 && (a->dst == b->rs || a->dst == b->rt)) return 1;   /* RAW */
  if (b->dst > 0 && (b->dst == a->rs || b->dst == a->rt)) return 1;   /* WAR */
  if (a->dst > 0 && a->dst == b->dst) return 1;                       /* WAW */
  if ((a->memWrite && (b->memRead || b->memWrite)) || (b->memWrite && a->memRead))
    if (!(a->rs == b->rs && abs(a->off - b->off) >= 4)) return 1;    /* 可能是同一個位址 */
  return 0;
}

/* 每個位置挑原本順序中最前面、可以合法搬上來、又不會和上一條形成 load-use 的指令 */
void reorder(const Inst *in, int n, int *order) {
  int used[MAXN] = {0};
  for (int k = 0; k < n; k++) {
    int pick = -1, first = -1;
    for (int j = 0; j < n && pick < 0; j++) {
      if (used[j]) continue;
      int ok = 1;
      for (int i = 0; i < j; i++)           /* 要跳過的每一條（原本在 j 前面、還沒排）都要能交換 */
        if (!used[i] && conflict(&in[i], &in[j])) { ok = 0; break; }
      if (!ok) continue;
      if (first < 0) first = j;
      if (k == 0 || !loadUseStall(&in[order[k - 1]], &in[j])) pick = j;
    }
    if (pick < 0) pick = first;             /* 每一條都會停：照原本順序，接受這次 stall */
    order[k] = pick;
    used[pick] = 1;
  }
}

/* ---------------- 測試 ---------------- */
static int load(const char (*src)[32], int n, Inst *in) {
  for (int k = 0; k < n; k++)
    if (!parse(src[k], &in[k])) { printf("parse error: %s\n", src[k]); exit(1); }
  return n;
}

static void run(const char *title, const char (*src)[32], int n) {
  Inst in[MAXN];
  int st;
  load(src, n, in);
  printf("== %s ==\n", title);
  for (int k = 0; k < n; k++) printf("  I%d %s\n", k + 1, src[k]);
  findDeps(in, n);
  int total = simulate(in, n, 1, &st);
  printf("  總週期 %d（5 + %d − 1 + %d stall），CPI = %.2f\n", total, n, st, (double)total / n);
}

static void runReorder(const char *title, const char (*src)[32], int n) {
  Inst in[MAXN], out[MAXN];
  int order[MAXN], st1, st2;
  load(src, n, in);
  int t1 = simulate(in, n, 0, &st1);
  reorder(in, n, order);
  for (int k = 0; k < n; k++) out[k] = in[order[k]];
  int t2 = simulate(out, n, 0, &st2);
  printf("== 重排：%s ==\n  重排前 %d 個 stall、%d 週期；重排後 %d 個 stall、%d 週期\n", title, st1, t1, st2, t2);
  for (int k = 0; k < n; k++) printf("  %d. I%d %s\n", k + 1, order[k] + 1, src[order[k]]);
}

int main(void) {
  /* 動畫預設：EX/MEM、double data hazard、load-use、sw 的資料轉送 */
  const char demo[][32] = {"add $t1,$s1,$s2", "sub $t1,$t1,$s3", "lw $t0,0($t1)", "add $t2,$t0,$t1", "sw $t2,4($s0)"};
  run("動畫預設", demo, 5);

  const char deps[][32] = {"lw $t0,0($s0)", "add $t1,$t0,$s1", "sub $t0,$s2,$s3", "or $t1,$t1,$t0"};
  run("圖 1：三種相依", deps, 4);

  const char dbl[][32] = {"add $t1,$t1,$t2", "add $t1,$t1,$t3", "add $t1,$t1,$t4"};
  run("double data hazard", dbl, 3);

  const char zero[][32] = {"add $zero,$t1,$t2", "add $t3,$zero,$t4"};
  run("寫入 $zero：不轉送", zero, 2);

  const char mem[][32] = {"lw $t0,0($s0)", "sw $t0,4($s0)", "lw $t1,8($s0)", "addi $t2,$t1,1"};
  run("lw → sw、lw → addi", mem, 4);

  /* 頁面例子：重排 */
  const char ex1[][32] = {"lw $t0,0($a0)", "lw $t1,4($a0)", "sub $t2,$t0,$t1", "sw $t2,8($a0)",
                          "lw $t3,12($a0)", "addi $t4,$t3,1", "sw $t4,16($a0)"};
  runReorder("頁面例子", ex1, 7);
  const char ex2[][32] = {"lw $t0,0($s0)", "add $t1,$t0,$s1", "sw $t1,0($s0)"};
  runReorder("沒有可以搬的指令", ex2, 3);

  /* 練習題驗算 */
  const char q23[][32] = {"add $t2,$t1,$t3", "lw $t1,0($t2)", "sub $t3,$t1,$t2", "and $t2,$t3,$t1"};
  run("co-0223", q23, 4);
  const char q26[][32] = {"sub $t2,$t1,$t3", "and $t2,$t2,$t5", "or $t4,$t2,$t2", "add $t6,$t4,$t2", "sw $t6,8($t2)"};
  run("co-0226", q26, 5);
  const char q27[][32] = {"add $zero,$s1,$s2", "sub $t0,$s3,$zero"};
  run("co-0227", q27, 2);
  const char q29[][32] = {"lw $t1,0($s0)", "add $t2,$t1,$s1", "lw $t3,4($t2)", "sw $t3,8($t1)",
                          "sub $t4,$t3,$t2", "or $t5,$t4,$t1"};
  run("co-0229", q29, 6);
  const char q30[][32] = {"lw $t0,0($s0)", "add $t1,$t0,$t0", "lw $t2,4($s0)", "sub $t3,$t2,$s1",
                          "addi $s0,$s0,8", "sw $t1,0($s1)", "sw $t3,4($s1)"};
  runReorder("co-0230", q30, 7);
  return 0;
}
