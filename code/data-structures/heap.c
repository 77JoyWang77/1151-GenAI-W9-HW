/* Heap（堆積）完整程式：只用來編譯驗證，頁面上的片段都從這裡取出 */
#include <stdio.h>
#include <stdlib.h>

#define MAX 100
int heap[MAX + 1];                             /* 用 heap[1..n]，heap[0] 不用 */
int n = 0;

void swap(int *a, int *b) { int t = *a; *a = *b; *b = t; }

/* ---------- insert：放在最後，往上浮 ---------- */
void insert(int x) {
  if (n == MAX) { printf("Heap Full\n"); exit(1); }
  int i = ++n;                                 /* 先放在最後一個位置 */
  heap[i] = x;
  while (i > 1 && heap[i] > heap[i / 2]) {     /* 比父節點大就往上換 */
    swap(&heap[i], &heap[i / 2]);
    i /= 2;
  }
}

/* ---------- 往下沉：deleteMax 與 buildHeap 共用 ---------- */
void siftDown(int a[], int i, int size) {
  while (2 * i <= size) {                      /* 還有子節點就繼續 */
    int c = 2 * i;                             /* 先假設左子比較大 */
    if (c + 1 <= size && a[c + 1] > a[c]) c++; /* 右子更大就改選右子 */
    if (a[i] >= a[c]) break;                   /* 比兩個子節點都大，停 */
    swap(&a[i], &a[c]);
    i = c;
  }
}

/* ---------- deleteMax：取走根，最後一個補上來再往下沉 ---------- */
int deleteMax(void) {
  if (n == 0) { printf("Heap Empty\n"); exit(1); }
  int top = heap[1];
  heap[1] = heap[n--];                         /* 最後一個移到根 */
  siftDown(heap, 1, n);
  return top;
}

/* ---------- buildHeap：由下往上調整，O(n) ---------- */
void buildHeap(int a[], int size) {
  for (int i = size / 2; i >= 1; i--)          /* 從最後一個內部節點往前 */
    siftDown(a, i, size);
}

void print(int a[], int size) {
  for (int i = 1; i <= size; i++) printf("%d ", a[i]);
  printf("\n");
}

int isMaxHeap(int a[], int size) {
  for (int i = 2; i <= size; i++) if (a[i] > a[i / 2]) return 0;
  return 1;
}

int main(void) {
  int seq[] = {30, 50, 20, 70, 60, 10, 80};
  for (int k = 0; k < 7; k++) insert(seq[k]);
  printf("insert 後："); print(heap, n);
  printf("deleteMax = %d，", deleteMax());
  printf("deleteMax = %d，剩下：", deleteMax());
  print(heap, n);

  int b[] = {0, 10, 20, 30, 40, 50, 60, 70};   /* b[0] 不用 */
  buildHeap(b, 7);
  printf("buildHeap：");
  print(b, 7);
  printf("isMaxHeap = %d %d\n", isMaxHeap(heap, n), isMaxHeap(b, 7));
  return 0;
}
