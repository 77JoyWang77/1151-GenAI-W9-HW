/* Threads and Multithreading Models（執行緒與多執行緒模型）
 * 編譯：gcc -std=c99 -Wall -Wextra -pthread -fsanitize=address,undefined threads.c
 * 內容：
 *   1. pthread_create / pthread_join：分段加總（每個 thread 的區域變數在自己的 stack）
 *   2. thread 與 fork 的差別：共享的 global 變數 vs 複製出來的位址空間
 *   3. 共享變數加 mutex：結果才固定
 *   4. deferred cancellation：只在 cancellation point 被取消
 *   5. 多執行緒模型的模擬：某個 user thread 做 blocking system call 時誰會被卡住
 */
#define _POSIX_C_SOURCE 200809L
#include <stdio.h>
#include <stdlib.h>
#include <pthread.h>
#include <unistd.h>
#include <sched.h>
#include <sys/types.h>
#include <sys/wait.h>

/* ---------- 1. 分段加總 ---------- */
#define NT 4
#define LEN 1000
int data[LEN];                 /* data section：所有 thread 共用 */
long partial[NT];              /* 每個 thread 寫自己的那一格，不會互相干擾 */

void *sumPart(void *arg) {
  int id = *(int *)arg;        /* 參數指向 main 裡 ids[] 的一格 */
  long s = 0;                  /* 區域變數在這個 thread 自己的 stack 上 */
  for (int i = id * (LEN / NT); i < (id + 1) * (LEN / NT); i++) s += data[i];
  partial[id] = s;
  return NULL;
}

long parallelSum(void) {
  pthread_t tid[NT];
  int ids[NT];                 /* 每個 thread 一個獨立的參數，不能共用同一個 i */
  for (int i = 0; i < NT; i++) {
    ids[i] = i;
    pthread_create(&tid[i], NULL, sumPart, &ids[i]);
  }
  long total = 0;
  for (int i = 0; i < NT; i++) {
    pthread_join(tid[i], NULL);  /* 等第 i 個 thread 結束（synchronous threading） */
    total += partial[i];
  }
  return total;
}

/* ---------- 2. thread 共享、fork 複製 ---------- */
int value = 5;                 /* global 變數 */

void *addTen(void *arg) {
  (void)arg;
  value += 10;                 /* 改到的是同一個 process 裡唯一的那份 value */
  return NULL;
}

void threadVsFork(void) {
  pthread_t t;
  pthread_create(&t, NULL, addTen, NULL);
  pthread_join(t, NULL);
  printf("thread 之後：value = %d\n", value);   /* 15：thread 改的 parent 看得到 */

  fflush(stdout);              /* 先清空緩衝區，避免 fork 後子行程重複印出 */
  pid_t pid = fork();
  if (pid == 0) {              /* 子行程：拿到 value 的一份複本 */
    value += 10;
    printf("child：value = %d\n", value);        /* 25 */
    exit(0);
  }
  waitpid(pid, NULL, 0);
  printf("fork 之後 parent：value = %d\n", value); /* 仍是 15：child 改的是自己的複本 */
}

/* ---------- 3. 共享計數器：用 mutex 保護 ---------- */
long counter = 0;
pthread_mutex_t lock = PTHREAD_MUTEX_INITIALIZER;

void *inc(void *arg) {
  int times = *(int *)arg;
  for (int i = 0; i < times; i++) {
    pthread_mutex_lock(&lock);
    counter++;                 /* 讀、加、寫三步，鎖住才不會被插隊 */
    pthread_mutex_unlock(&lock);
  }
  return NULL;
}

/* ---------- 4. deferred cancellation ---------- */
volatile int started = 0;

void *spin(void *arg) {
  (void)arg;
  started = 1;
  for (;;) {
    /* ……做一小段不能被打斷的工作…… */
    pthread_testcancel();      /* cancellation point：有取消要求就在這裡結束 */
  }
  return NULL;
}

/* ---------- 5. 多執行緒模型的模擬 ---------- */
enum { MANY_TO_ONE, ONE_TO_ONE, MANY_TO_MANY, TWO_LEVEL };
#define MAXT 8
int model, nUser, nLWP, cores;   /* nLWP：many-to-many 共用的 kernel thread 數 */
int blocked[MAXT];             /* user thread 正卡在 blocking system call */
int kblocked[MAXT];            /* kernel thread 被卡在 kernel 裡 */
int lwpOf[MAXT];               /* 卡住的 user thread 用的是哪個 kernel thread */

int numKernel(void) {
  if (model == MANY_TO_ONE) return 1;
  if (model == ONE_TO_ONE) return nUser;
  if (model == MANY_TO_MANY) return nLWP;
  return 1 + nLWP;             /* two-level：T0 綁定 K0，其餘共用 nLWP 個 */
}

/* user thread t 能不能用 kernel thread k */
int allowed(int t, int k) {
  if (model == MANY_TO_ONE) return k == 0;
  if (model == ONE_TO_ONE) return k == t;
  if (model == MANY_TO_MANY) return 1;
  return t == 0 ? k == 0 : k >= 1;   /* two-level：bound thread 只用自己的 K0 */
}

/* 排程一輪：kernel 把沒被卡住的 kernel thread 排上 CPU，
   thread library 替每個 kernel thread 挑一個 ready 的 user thread */
int schedule(int running[]) {
  int taken[MAXT] = {0}, cnt = 0;
  for (int k = 0; k < numKernel() && cnt < cores; k++) {
    if (kblocked[k]) continue;                 /* 卡在 system call 的 kernel thread 不能上 CPU */
    for (int t = 0; t < nUser; t++)
      if (!blocked[t] && !taken[t] && allowed(t, k)) {
        taken[t] = 1;
        running[cnt++] = t;
        break;
      }
  }
  return cnt;                                  /* 同時在跑的 user thread 數 */
}

/* user thread t（目前跑在 kernel thread k 上）呼叫 read() 之類的 blocking system call */
void blockingCall(int t, int k) {
  blocked[t] = 1;
  kblocked[k] = 1;             /* kernel 只看得到 kernel thread：卡住的是 k */
  lwpOf[t] = k;
}

/* I/O 完成：t 和它的 kernel thread 回到 ready */
void ioDone(int t) {
  blocked[t] = 0;
  kblocked[lwpOf[t]] = 0;
}

void setup(int m, int u, int l, int c) {
  model = m; nUser = u; nLWP = l; cores = c;
  for (int i = 0; i < MAXT; i++) blocked[i] = kblocked[i] = 0, lwpOf[i] = -1;
}

/* 找出 t 這一輪跑在哪個 kernel thread（照 schedule 的順序重算一次） */
int kernelOf(int t) {
  int taken[MAXT] = {0}, cnt = 0;
  for (int k = 0; k < numKernel() && cnt < cores; k++) {
    if (kblocked[k]) continue;
    for (int u = 0; u < nUser; u++)
      if (!blocked[u] && !taken[u] && allowed(u, k)) {
        taken[u] = 1; cnt++;
        if (u == t) return k;
        break;
      }
  }
  return -1;
}

void demoModel(const char *name, int m, int u, int l, int c, int blocker) {
  int run[MAXT];
  setup(m, u, l, c);
  int before = schedule(run);
  int k = kernelOf(blocker);
  if (k == -1) { printf("%s：T%d 這一輪沒在跑\n", name, blocker); return; }
  blockingCall(blocker, k);
  int after = schedule(run);
  printf("%s：block 前 %d 個在跑，T%d block 後 %d 個在跑：", name, before, blocker, after);
  for (int i = 0; i < after; i++) printf(" T%d", run[i]);
  printf("\n");
  ioDone(blocker);
}

int main(void) {
  for (int i = 0; i < LEN; i++) data[i] = i + 1;
  printf("parallelSum = %ld（應為 %d）\n", parallelSum(), LEN * (LEN + 1) / 2);

  threadVsFork();

  pthread_t a, b;
  int times = 10000;
  pthread_create(&a, NULL, inc, &times);
  pthread_create(&b, NULL, inc, &times);
  pthread_join(a, NULL);
  pthread_join(b, NULL);
  printf("counter = %ld（有 mutex，一定是 20000）\n", counter);

  pthread_t s;
  void *res;
  pthread_create(&s, NULL, spin, NULL);
  while (!started) sched_yield();   /* 等 spin 真的開始跑 */
  pthread_cancel(s);           /* 只是送出取消要求 */
  pthread_join(s, &res);
  printf("spin %s\n", res == PTHREAD_CANCELED ? "在 cancellation point 被取消" : "正常結束");

  /* 4 個 user thread、2 顆核心；T0 先跑，讓 T0 做 blocking call */
  demoModel("many-to-one", MANY_TO_ONE, 4, 0, 2, 0);
  demoModel("one-to-one", ONE_TO_ONE, 4, 0, 2, 0);
  demoModel("many-to-many(2 LWP)", MANY_TO_MANY, 4, 2, 2, 0);
  demoModel("two-level(1+2)", TWO_LEVEL, 4, 2, 2, 0);
  return 0;
}
