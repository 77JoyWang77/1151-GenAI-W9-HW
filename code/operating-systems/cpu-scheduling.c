/* CPU Scheduling（CPU 排程演算法）完整程式：只用來編譯驗證，頁面上的片段都從這裡取出 */
#include <stdio.h>
#include <string.h>

#define N 10
#define TMAX 200
typedef struct {
  char name[4];
  int arrival, burst, priority;                /* priority：數字越小越優先 */
  int remain, start, finish;                   /* start = -1 表示還沒執行過 */
} Proc;

Proc p[N];
int n;
int gantt[TMAX], len;                          /* gantt[t]：時間 t～t+1 執行的行程，-1 = 閒置 */

enum { FCFS, SJF, PRIORITY };

void reset(void) {
  for (int i = 0; i < n; i++) { p[i].remain = p[i].burst; p[i].start = -1; p[i].finish = 0; }
  len = 0;
}

int key(int i, int alg) {                      /* 挑選依據：值越小越先 */
  if (alg == FCFS) return p[i].arrival;
  if (alg == SJF) return p[i].remain;          /* SJF / SRTF 看剩下的 burst */
  return p[i].priority;
}

/* 在時間 t 已到達、還沒做完的行程中，挑 key 最小的；平手時先到的優先 */
int pick(int t, int alg) {
  int best = -1;
  for (int i = 0; i < n; i++) {
    if (p[i].remain == 0 || p[i].arrival > t) continue;
    if (best == -1 || key(i, alg) < key(best, alg) ||
        (key(i, alg) == key(best, alg) && p[i].arrival < p[best].arrival)) best = i;
  }
  return best;
}

/* ---------- 非搶先：FCFS、SJF、Priority ---------- */
void nonPreemptive(int alg) {
  int t = 0, done = 0;
  reset();
  while (done < n) {
    int i = pick(t, alg);
    if (i == -1) { gantt[t++] = -1; continue; }   /* 沒有行程到達：CPU 閒置 */
    p[i].start = t;
    while (p[i].remain > 0) {                  /* 一旦開始就做到完 */
      gantt[t++] = i;
      p[i].remain--;
    }
    p[i].finish = t;
    done++;
  }
  len = t;
}

/* ---------- 搶先：SRTF（alg = SJF）、搶先式 Priority ---------- */
void preemptive(int alg) {
  int t = 0, done = 0, cur = -1;
  reset();
  while (done < n) {
    int i = pick(t, alg);
    if (cur != -1 && p[cur].remain > 0 && key(cur, alg) <= key(i, alg)) i = cur;   /* 平手不搶 */
    if (i == -1) { gantt[t++] = -1; continue; }
    if (p[i].start == -1) p[i].start = t;
    gantt[t++] = i;                            /* 每個時間單位都重新挑一次 */
    if (--p[i].remain == 0) { p[i].finish = t; done++; }
    cur = i;
  }
  len = t;
}

/* ---------- Round Robin ---------- */
void roundRobin(int q) {
  int queue[TMAX], front = 0, rear = 0;
  int t = 0, done = 0, next = 0;               /* next：下一個還沒進 queue 的行程（依到達時間排序） */
  reset();
  while (done < n) {
    while (next < n && p[next].arrival <= t) queue[rear++] = next++;   /* 新到的放進 queue 尾端 */
    if (front == rear) { gantt[t++] = -1; continue; }
    int i = queue[front++];
    if (p[i].start == -1) p[i].start = t;
    int run = p[i].remain < q ? p[i].remain : q;   /* 最多跑一個 time quantum */
    for (int k = 0; k < run; k++) { gantt[t++] = i; p[i].remain--; }
    while (next < n && p[next].arrival <= t) queue[rear++] = next++;   /* 這段時間內到達的先排進去 */
    if (p[i].remain > 0) queue[rear++] = i;    /* 還沒做完：排到 queue 最後面 */
    else { p[i].finish = t; done++; }
  }
  len = t;
}

/* ---------- 輸出 ---------- */
void report(const char *title) {
  double tw = 0, tt = 0, tr = 0;
  printf("%-10s ", title);
  for (int t = 0; t < len; t++)
    if (t == 0 || gantt[t] != gantt[t - 1]) printf("%d:%s ", t, gantt[t] < 0 ? "idle" : p[gantt[t]].name);
  printf("%d\n", len);
  for (int i = 0; i < n; i++) {
    int turnaround = p[i].finish - p[i].arrival;
    int waiting = turnaround - p[i].burst;
    int response = p[i].start - p[i].arrival;
    tw += waiting; tt += turnaround; tr += response;
  }
  printf("           平均等待 %.2f　平均回覆 %.2f　平均周轉 %.2f\n", tw / n, tr / n, tt / n);
}

void load(int count, const char *names[], const int a[], const int b[], const int pr[]) {
  n = count;
  for (int i = 0; i < n; i++) {
    strcpy(p[i].name, names[i]);
    p[i].arrival = a[i]; p[i].burst = b[i]; p[i].priority = pr[i];
  }
}

int main(void) {
  /* 頁面範例：四個行程，依到達時間排序 */
  const char *nm[] = {"P1", "P2", "P3", "P4"};
  int arr[] = {0, 2, 3, 5}, bur[] = {7, 4, 1, 6}, pri[] = {3, 1, 4, 2};
  load(4, nm, arr, bur, pri);
  nonPreemptive(FCFS);     report("FCFS");
  nonPreemptive(SJF);      report("SJF");
  preemptive(SJF);         report("SRTF");
  nonPreemptive(PRIORITY); report("Priority");
  preemptive(PRIORITY);    report("P-Priority");
  roundRobin(3);           report("RR q=3");

  /* convoy effect：長的先跑 vs 短的先跑（全部在時間 0 到達） */
  const char *cn[] = {"P1", "P2", "P3"};
  int ca[] = {0, 0, 0}, cb[] = {20, 4, 2}, cp[] = {0, 0, 0};
  load(3, cn, ca, cb, cp);
  nonPreemptive(FCFS);     report("convoy");
  nonPreemptive(SJF);      report("短的先");
  return 0;
}
