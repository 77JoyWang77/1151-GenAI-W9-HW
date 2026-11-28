/* Process Concept（行程與行程狀態）
 * 編譯：gcc -std=c99 -Wall -Wextra -fsanitize=address,undefined process-concept.c
 * 內容：
 *   1. 變數放在哪個 segment（text / data / BSS / heap / stack）
 *   2. 行程狀態轉移：五狀態＋兩個 suspend 狀態，非法轉移回傳 -1
 *   3. fork 計數題：迴圈 fork、迴圈內 printf、&& ||、fan、chain
 *   4. fork 後變數各自獨立；printf 緩衝區被複製
 *   5. fork + exec + wait；zombie 與 orphan
 * fork 的輸出順序由排程決定，main 裡的 capture() 把所有後代的輸出收集起來排序後只統計次數，
 * 所以每次執行的結果都一樣。
 */
#define _DEFAULT_SOURCE
#define _POSIX_C_SOURCE 200809L
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <signal.h>
#include <sys/types.h>
#include <sys/wait.h>
#include <sys/prctl.h>

/* ---------- 1. 變數放在哪裡 ---------- */
int g_init = 5;                /* initialized data：有初值的 global */
int g_zero;                    /* BSS：沒有初值的 global，載入時清成 0 */
const char *msg = "hi";        /* msg 本身在 data；字串常數 "hi" 在唯讀區（和 text 相鄰） */

void segments(int param) {     /* param 和 local 一樣在 stack */
  static int calls = 0;        /* static 區域變數：在 BSS（初值 0），不在 stack，函式返回仍保留 */
  int local = param + 1;       /* stack：函式返回就消失 */
  int *p = malloc(sizeof(int)); /* p 本身在 stack，*p 在 heap */
  *p = local * g_init;
  calls++;
  printf("calls=%d local=%d *p=%d g_zero=%d msg=%s\n", calls, local, *p, g_zero, msg);
  free(p);                     /* heap 要自己釋放 */
}

/* ---------- 2. 行程狀態轉移 ---------- */
enum State { NEW, READY, RUNNING, WAITING, TERMINATED, READY_SUSPEND, BLOCKED_SUSPEND };
enum Event { ADMIT, DISPATCH, TIMEOUT, IO_WAIT, IO_DONE, EXIT, SUSPEND, RESUME };

/* 回傳新狀態；這個狀態下不可能發生這個事件就回傳 -1 */
int transition(int s, int ev) {
  switch (s) {
  case NEW:
    if (ev == ADMIT) return READY;              /* long-term scheduler 允許它進入記憶體 */
    break;
  case READY:
    if (ev == DISPATCH) return RUNNING;         /* short-term scheduler 選中，dispatcher 切過去 */
    if (ev == SUSPEND) return READY_SUSPEND;    /* medium-term scheduler 把它換出到磁碟 */
    break;
  case RUNNING:
    if (ev == TIMEOUT) return READY;            /* timer interrupt：time quantum 用完被搶先 */
    if (ev == IO_WAIT) return WAITING;          /* 發出 I/O 或等待某個事件 */
    if (ev == EXIT) return TERMINATED;          /* 呼叫 exit()，等 parent 用 wait() 回收 */
    break;
  case WAITING:
    if (ev == IO_DONE) return READY;            /* 事件完成：回 ready，不是直接 running */
    if (ev == SUSPEND) return BLOCKED_SUSPEND;
    break;
  case READY_SUSPEND:
    if (ev == RESUME) return READY;             /* 換回記憶體 */
    break;
  case BLOCKED_SUSPEND:
    if (ev == IO_DONE) return READY_SUSPEND;    /* 事件完成了，但人還在磁碟上 */
    if (ev == RESUME) return WAITING;
    break;
  }
  return -1;                                    /* 非法轉移，例如 WAITING 直接 DISPATCH */
}

/* ---------- 3. fork 計數題 ---------- */
/* (1) 迴圈裡 fork n 次，最後每個 process 印一行 */
void loopFork(int n) {
  for (int i = 0; i < n; i++)
    fork();
  printf("hello\n");
}

/* (2) 每一輪 fork 完都印出 i */
void loopPrint(int n) {
  for (int i = 0; i < n; i++) {
    fork();
    printf("%d\n", i);
  }
}

/* (3) 短路求值：&& 左邊為 0 就不算右邊；|| 左邊非 0 就不算右邊 */
void andOr(int n) {
  (void)n;
  if ((fork() && fork()) || fork())
    printf("T\n");
  else
    printf("F\n");
}

/* (4) fan：child 一出生就 break，只有原本的 process 在 fork */
void fan(int n) {
  int i;
  for (i = 0; i < n; i++)
    if (fork() == 0) break;
  printf("i=%d\n", i);
}

/* (5) chain：parent fork 完就 break，換 child 接著 fork */
void chain(int n) {
  int i;
  for (i = 0; i < n; i++)
    if (fork() > 0) break;
  printf("i=%d\n", i);
}

/* ---------- 4. 變數各自獨立、緩衝區被複製 ---------- */
int value = 10;                /* data section：fork 之後 parent、child 各有一份 */

void forkValue(int n) {
  (void)n;
  pid_t pid = fork();
  if (pid == 0) {              /* child 改的是自己的複本 */
    value += 10;
    printf("child: value = %d\n", value);
    exit(0);
  }
  wait(NULL);                  /* parent 等 child 結束，輸出順序因此固定 */
  printf("parent: value = %d\n", value);
}

void bufferDup(int n) {
  (void)n;
  printf("A");                 /* 沒有換行：還在 stdout 的緩衝區，沒送出 */
  fork();                      /* 緩衝區也在記憶體裡，跟著被複製 */
  printf("B\n");               /* 兩個 process 各自送出 "AB" */
}

/* ---------- 5. fork + exec + wait ---------- */
void runCommand(void) {
  pid_t pid = fork();
  if (pid < 0) {               /* fork 失敗：process 數到上限或記憶體不足 */
    perror("fork");
    return;
  }
  if (pid == 0) {              /* child：fork() 回傳 0 */
    execlp("echo", "echo", "child runs echo", (char *)NULL);
    perror("exec");            /* exec 成功就不會回來，回來代表失敗 */
    exit(1);
  }
  int status;
  waitpid(pid, &status, 0);    /* parent：fork() 回傳 child 的 PID */
  if (WIFEXITED(status))
    printf("parent: child exited with %d\n", WEXITSTATUS(status));
}

/* 讀 /proc/<pid>/stat 的狀態欄：R 執行、S 睡眠、Z zombie；不存在回傳 '-' */
char procState(pid_t pid) {
  char path[64], st = '-';
  snprintf(path, sizeof path, "/proc/%d/stat", (int)pid);
  FILE *f = fopen(path, "r");
  if (!f) return st;
  if (fscanf(f, "%*d (%*[^)]) %c", &st) != 1) st = '?';
  fclose(f);
  return st;
}

/* child 先結束、parent 還沒 wait：child 變成 zombie */
void zombieDemo(void) {
  pid_t pid = fork();
  if (pid == 0)
    exit(7);                   /* child 立刻結束，結束碼 7 */
  siginfo_t info;
  waitid(P_PID, pid, &info, WEXITED | WNOWAIT);  /* 等它結束，但先不回收 */
  printf("before wait: state %c\n", procState(pid));  /* Z：只剩 PCB 裡的 PID 和結束碼 */
  int status;
  waitpid(pid, &status, 0);    /* 回收：PCB 和 PID 這時才釋放 */
  printf("after wait: exit code %d, state %c\n", WEXITSTATUS(status), procState(pid));
}

/* parent 先結束、child 還在：child 變成 orphan，被收養 */
void orphanDemo(void) {
  pid_t me = getpid();
  if (fork() > 0)
    exit(0);                   /* parent 不 wait 就結束 */
  while (getppid() == me)      /* child 等到 parent 真的結束 */
    usleep(1000);
  printf("orphan: adopted by a new parent\n");
}

/* ---------- 測試用：收集所有後代的輸出，排序後統計 ---------- */
typedef void (*Prog)(int);

static int cmpStr(const void *a, const void *b) {
  return strcmp(*(char *const *)a, *(char *const *)b);
}

void capture(const char *name, Prog prog, int n) {
  int fd[2];
  if (pipe(fd) < 0) { perror("pipe"); return; }
  fflush(stdout);
  pid_t pid = fork();
  if (pid == 0) {
    close(fd[0]);
    dup2(fd[1], STDOUT_FILENO);
    close(fd[1]);
    prog(n);
    printf("#\n");             /* 每個 process 都會走到這裡：# 的行數 = process 數 */
    while (wait(NULL) > 0) ;   /* 每個 process 等自己的 child，避免 zombie */
    exit(0);
  }
  close(fd[1]);
  char buf[4096];
  size_t len = 0;
  ssize_t k;
  while (len < sizeof buf - 1 && (k = read(fd[0], buf + len, sizeof buf - 1 - len)) > 0) len += (size_t)k;
  buf[len] = '\0';
  close(fd[0]);
  waitpid(pid, NULL, 0);
  char *lines[512];
  int cnt = 0, procs = 0;
  for (char *s = strtok(buf, "\n"); s && cnt < 512; s = strtok(NULL, "\n")) {
    if (strcmp(s, "#") == 0) procs++;
    else lines[cnt++] = s;
  }
  qsort(lines, (size_t)cnt, sizeof lines[0], cmpStr);
  printf("%s(%d): %d processes, %d lines:", name, n, procs, cnt);
  for (int i = 0; i < cnt; ) {
    int j = i;
    while (j < cnt && strcmp(lines[j], lines[i]) == 0) j++;
    printf(" [%s]x%d", lines[i], j - i);
    i = j;
  }
  printf("\n");
}

int main(void) {
  setvbuf(stdout, NULL, _IOLBF, 0);   /* 行緩衝：有換行就送出（和終端機一樣） */

  segments(1);
  segments(2);

  const char *SN[] = { "new", "ready", "running", "waiting", "terminated", "ready/suspend", "blocked/suspend" };
  const char *EN[] = { "admit", "dispatch", "timeout", "io_wait", "io_done", "exit", "suspend", "resume" };
  for (int s = NEW; s <= BLOCKED_SUSPEND; s++)
    for (int e = ADMIT; e <= RESUME; e++) {
      int t = transition(s, e);
      if (t >= 0) printf("%s --%s--> %s\n", SN[s], EN[e], SN[t]);
    }

  for (int n = 1; n <= 4; n++) capture("loopFork", loopFork, n);
  for (int n = 1; n <= 4; n++) capture("loopPrint", loopPrint, n);
  capture("andOr", andOr, 0);
  for (int n = 1; n <= 4; n++) capture("fan", fan, n);
  for (int n = 1; n <= 4; n++) capture("chain", chain, n);
  capture("forkValue", forkValue, 0);
  capture("bufferDup", bufferDup, 0);

  fflush(stdout);
  runCommand();
  zombieDemo();

  prctl(PR_SET_CHILD_SUBREAPER, 1);   /* 讓 main 收養 orphan，才能 wait 它、輸出才固定 */
  fflush(stdout);
  if (fork() == 0) {
    orphanDemo();
    exit(0);
  }
  while (wait(NULL) > 0) ;
  return 0;
}
