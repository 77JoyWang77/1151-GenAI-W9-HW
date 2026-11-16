/* Circular Queue（環狀佇列）完整程式：只用來編譯驗證，頁面上的片段都從這裡取出 */
#include <stdio.h>
#include <stdlib.h>

/* ---------- 線性佇列（對照用）---------- */
#define LMAX 8
int lq[LMAX];
int lfront = -1, lrear = -1;                   /* front 指向第一個元素的前一格 */

void lenqueue(int x) {
  if (lrear == LMAX - 1) { printf("Queue Full\n"); exit(1); }   /* 前面有空位也算滿 */
  lq[++lrear] = x;
}

int ldequeue(void) {
  if (lfront == lrear) { printf("Queue Empty\n"); exit(1); }
  return lq[++lfront];
}

/* ---------- 環狀佇列：犧牲一格 ---------- */
#define MAX 8                                  /* 陣列大小；最多只能放 MAX - 1 個 */
int queue[MAX];
int front = 0, rear = 0;                       /* front 指向第一個元素的前一格 */

int isEmpty(void) { return front == rear; }
int isFull(void)  { return (rear + 1) % MAX == front; }

void enqueue(int x) {
  if (isFull()) { printf("Queue Full\n"); exit(1); }
  rear = (rear + 1) % MAX;                     /* rear 先往前一格 */
  queue[rear] = x;
}

int dequeue(void) {
  if (isEmpty()) { printf("Queue Empty\n"); exit(1); }
  front = (front + 1) % MAX;                   /* front 先往前一格 */
  return queue[front];
}

int size(void) { return (rear - front + MAX) % MAX; }

/* ---------- 環狀佇列：多記一個 count ---------- */
int cq[MAX];
int head = 0, count = 0;                       /* head：第一個元素；count：目前個數 */

void enqueueCount(int x) {
  if (count == MAX) { printf("Queue Full\n"); exit(1); }
  cq[(head + count) % MAX] = x;                /* 最後一個元素的下一格 */
  count++;
}

int dequeueCount(void) {
  if (count == 0) { printf("Queue Empty\n"); exit(1); }
  int x = cq[head];
  head = (head + 1) % MAX;
  count--;
  return x;
}

int main(void) {
  /* 線性佇列：放 8 個、拿 4 個之後，前面雖然空出 4 格，卻已經不能再放 */
  for (int i = 1; i <= LMAX; i++) lenqueue(i);
  for (int i = 0; i < 4; i++) printf("%d ", ldequeue());
  printf("| lrear = %d，再 enqueue 就會 Queue Full\n", lrear);

  /* 犧牲一格：MAX = 8 最多放 7 個 */
  for (int i = 1; i <= MAX - 1; i++) enqueue(i * 10);
  printf("放了 %d 個，isFull = %d\n", size(), isFull());
  for (int i = 0; i < 3; i++) printf("%d ", dequeue());
  enqueue(80); enqueue(90);                    /* rear 繞回陣列前面 */
  printf("| front = %d, rear = %d, size = %d\n", front, rear, size());
  while (!isEmpty()) printf("%d ", dequeue());
  printf("| 清空後 front = rear = %d\n", front);

  /* count 版：MAX 格全部用得到 */
  for (int i = 1; i <= MAX; i++) enqueueCount(i);
  printf("count 版放了 %d 個；", count);
  for (int i = 0; i < 3; i++) printf("%d ", dequeueCount());
  enqueueCount(9);
  printf("| head = %d, count = %d\n", head, count);
  return 0;
}
