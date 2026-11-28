/* Control Hazards and Branch Prediction（控制危障與分支預測）
 * 1. 分支在不同階段決定時的 penalty、四種靜態做法的 IF 時序（fetchTrace）
 * 2. 分支造成的 CPI 損失（branchCPI）
 * 3. 1-bit、2-bit（飽和計數器／跳躍版）預測器模擬與迴圈正確率
 * 編譯：gcc -std=c99 -Wall -Wextra -fsanitize=address,undefined control-hazards.c
 */
#include <stdio.h>
#include <string.h>

/* ---------- 1. 分支在哪一級決定 ---------- */
enum { IF = 1, ID = 2, EX = 3, MEM = 4 };          /* 階段編號：分支在第 1 個週期 IF */

/* 分支在 resolve 這一級結束才知道結果，在那之前 IF 已經多抓了 resolve - 1 條 */
int branchPenalty(int resolve) {
  return resolve - 1;
}

typedef enum { STALL, PREDICT_NT, PREDICT_T, DELAYED } Strategy;

typedef struct {
  char name[12];   /* 抓進來的是哪一條：beq、i+1、i+2…（循序）、t1、t2…（目標）、slot、bubble */
  int cycle;       /* 在第幾個週期 IF */
  int flushed;     /* 1：猜錯，被清掉（變成 bubble） */
} Fetch;

/* 從 beq 開始，列出前 n 個週期 IF 各抓了什麼；回傳損失的週期數（bubble + flush） */
int fetchTrace(Strategy st, int resolve, int taken, Fetch *out, int n) {
  int lost = 0, seq = 1, tgt = 1;
  snprintf(out[0].name, sizeof out[0].name, "beq");
  out[0].cycle = 1;
  out[0].flushed = 0;
  for (int c = 2; c <= n; c++) {
    Fetch *f = &out[c - 1];
    f->cycle = c;
    f->flushed = 0;
    if (c > resolve) {                              /* 結果已知：照實際方向抓 */
      if (taken) snprintf(f->name, sizeof f->name, "t%d", tgt++);
      else snprintf(f->name, sizeof f->name, "i+%d", seq++);
    } else if (st == DELAYED && c == 2) {           /* delay slot：不管跳不跳都執行 */
      snprintf(f->name, sizeof f->name, "slot");
      seq = 2;                                      /* slot 就是原本的 i+1 */
    } else if (st == STALL || st == DELAYED) {      /* 還不知道：什麼都不抓 */
      snprintf(f->name, sizeof f->name, "bubble");
      lost++;
    } else if (st == PREDICT_NT) {                  /* 猜不跳：照常抓 PC + 4 */
      snprintf(f->name, sizeof f->name, "i+%d", seq++);
      if (taken) { f->flushed = 1; lost++; }
    } else {                                        /* 猜跳：BTB 在 IF 就給出目標 */
      snprintf(f->name, sizeof f->name, "t%d", tgt++);
      if (!taken) { f->flushed = 1; lost++; }
    }
  }
  return lost;
}

/* ---------- 2. 分支造成的 CPI 損失 ---------- */
double branchCPI(double baseCPI, double branchFrac, double missRate, int penalty) {
  return baseCPI + branchFrac * missRate * penalty;   /* 每條指令平均多出的週期 */
}

/* ---------- 3. 動態預測器 ---------- */
typedef enum { ONE_BIT, TWO_BIT_SAT, TWO_BIT_JUMP } Kind;
/* 狀態：1-bit 用 1 = 上次 taken、0 = 上次 not taken；
 * 2-bit 用 3 = 強 taken、2 = 弱 taken、1 = 弱 not taken、0 = 強 not taken */

int predictTaken(Kind k, int s) {
  if (k == ONE_BIT) return s == 1;
  return s >= 2;                                    /* 2 和 3 預測 taken */
}

int nextState(Kind k, int s, int taken) {
  if (k == ONE_BIT) return taken;                   /* 只記住上一次的結果 */
  if (k == TWO_BIT_JUMP) {                          /* 跳躍版：弱狀態猜錯直接跳到另一邊的強狀態 */
    if (taken && s == 1) return 3;
    if (!taken && s == 2) return 0;
  }
  if (taken) return s < 3 ? s + 1 : 3;              /* 飽和計數器：往上加，最多到 3 */
  return s > 0 ? s - 1 : 0;                         /* 往下減，最少到 0 */
}

/* outcome[i] = 1 表示 taken；回傳猜對的次數，*state 留下最後的狀態 */
int runPredictor(Kind k, int *state, const int *outcome, int n, int verbose) {
  int correct = 0;
  for (int i = 0; i < n; i++) {
    int p = predictTaken(k, *state);
    if (p == outcome[i]) correct++;
    if (verbose)
      printf("  #%-2d 狀態 %d 預測 %c 實際 %c %s\n", i + 1, *state,
             p ? 'T' : 'N', outcome[i] ? 'T' : 'N', p == outcome[i] ? "對" : "錯");
    *state = nextState(k, *state, outcome[i]);
  }
  return correct;
}

/* 迴圈尾端的向後分支：內圈 inner 次（前 inner - 1 次 taken、最後一次 not taken），整段重複 outer 次 */
int loopOutcomes(int inner, int outer, int *outcome) {
  int n = 0;
  for (int r = 0; r < outer; r++)
    for (int i = 0; i < inner; i++) outcome[n++] = (i < inner - 1);
  return n;
}

/* ---------- 測試 ---------- */
static int parseTN(const char *s, int *out) {
  int n = 0;
  for (; *s; s++)
    if (*s == 'T' || *s == 'N') out[n++] = (*s == 'T');
  return n;
}

static const char *KN[] = {"1-bit", "2-bit 飽和", "2-bit 跳躍"};
static const char *SN[] = {"stall", "predict-not-taken", "predict-taken", "delayed"};

int main(void) {
  int o[64];

  printf("== penalty：決定在 ID / EX / MEM ==\n");
  for (int r = ID; r <= MEM; r++) printf("  resolve=%d penalty=%d\n", r, branchPenalty(r));

  printf("== fetchTrace（決定在 EX）==\n");
  for (int st = STALL; st <= DELAYED; st++)
    for (int t = 0; t <= 1; t++) {
      Fetch f[6];
      int lost = fetchTrace((Strategy)st, EX, t, f, 6);
      printf("  %-17s %s lost=%d :", SN[st], t ? "T" : "N", lost);
      for (int c = 0; c < 6; c++) printf(" %s%s", f[c].name, f[c].flushed ? "(x)" : "");
      printf("\n");
    }

  printf("== co-0164：25%% 分支、正確率 20%% ==\n");
  printf("  MEM 更正：額外 CPI = %.2f\n", branchCPI(1, 0.25, 0.8, branchPenalty(MEM)) - 1);
  printf("  ID  更正：額外 CPI = %.2f\n", branchCPI(1, 0.25, 0.8, branchPenalty(ID)) - 1);

  printf("== co-0132：內圈 6 次 × 外圈 3 次，初始 taken ==\n");
  int n = loopOutcomes(6, 3, o);
  for (int k = ONE_BIT; k <= TWO_BIT_JUMP; k++) {
    int s = (k == ONE_BIT) ? 1 : 3;
    printf("  %s：%d/%d\n", KN[k], runPredictor((Kind)k, &s, o, n, 0), n);
  }

  printf("== co-0165：N T N N T 重複，從強 taken 開始 ==\n");
  for (int rep = 1; rep <= 3; rep++) {
    int m = 0, s = 3;
    for (int r = 0; r < rep; r++) m += parseTN("NTNNT", o + m);
    printf("  重複 %d 次：%d/%d\n", rep, runPredictor(TWO_BIT_SAT, &s, o, m, rep == 1), m);
  }

  printf("== 兩種 2-bit 版本對照：T T N T T T N T，從強 not taken 開始 ==\n");
  n = parseTN("TTNTTTNT", o);
  for (int k = TWO_BIT_SAT; k <= TWO_BIT_JUMP; k++) {
    int s = 0;
    printf("  %s：\n", KN[k]);
    printf("  → %d/%d\n", runPredictor((Kind)k, &s, o, n, 1), n);
  }
  return 0;
}
