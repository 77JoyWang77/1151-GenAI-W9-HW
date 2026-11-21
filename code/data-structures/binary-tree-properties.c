/* Binary Tree Properties & Representation（二元樹性質與表示法）完整程式：只用來編譯驗證，頁面上的片段都從這裡取出 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

/* ---------- 鏈結表示法 ---------- */
typedef struct treeNode *treePointer;
typedef struct treeNode {
  treePointer left;                            /* 左子樹 */
  char data;
  treePointer right;                           /* 右子樹 */
} treeNode;

treePointer newNode(char c) {
  treePointer p = malloc(sizeof(treeNode));
  if (p == NULL) { printf("Memory Full\n"); exit(1); }
  p->data = c;
  p->left = p->right = NULL;
  return p;
}

/* ---------- 陣列表示法 → 鏈結表示法：a[1..size]，'-' 代表空位 ---------- */
treePointer buildFromArray(const char a[], int size, int i) {
  if (i > size || a[i] == '-') return NULL;    /* 超出陣列或空位：空樹 */
  treePointer t = newNode(a[i]);
  t->left = buildFromArray(a, size, 2 * i);    /* 左子在 2i */
  t->right = buildFromArray(a, size, 2 * i + 1); /* 右子在 2i + 1 */
  return t;
}

/* ---------- 用遞迴計算各種性質 ---------- */
int countNodes(treePointer t) {
  if (t == NULL) return 0;
  return 1 + countNodes(t->left) + countNodes(t->right);
}

int height(treePointer t) {                    /* 只有根時高度是 1，空樹是 0 */
  if (t == NULL) return 0;
  int hl = height(t->left), hr = height(t->right);
  return 1 + (hl > hr ? hl : hr);
}

void countDegree(treePointer t, int cnt[3]) {  /* cnt[d]：分支度為 d 的節點數 */
  if (t == NULL) return;
  int d = (t->left != NULL) + (t->right != NULL);
  cnt[d]++;
  countDegree(t->left, cnt);
  countDegree(t->right, cnt);
}

/* ---------- 判斷完全二元樹：依編號放進去不能超出 n ---------- */
int isComplete(treePointer t, int i, int n) {
  if (t == NULL) return 1;
  if (i > n) return 0;                         /* 編號超過 n 代表中間有空洞 */
  return isComplete(t->left, 2 * i, n) && isComplete(t->right, 2 * i + 1, n);
}

/* ---------- 判斷每個節點都是 0 或 2 個子節點 ---------- */
int isStrict(treePointer t) {
  if (t == NULL) return 1;
  if ((t->left == NULL) != (t->right == NULL)) return 0; /* 只有一個子節點 */
  return isStrict(t->left) && isStrict(t->right);
}

/* ---------- n 個節點的不同二元樹個數（Catalan number）---------- */
long long countShapes(int n) {
  long long b[40] = {1};                       /* b[0] = 1：空樹只有一種 */
  for (int k = 1; k <= n; k++) {
    b[k] = 0;
    for (int i = 0; i < k; i++)                /* 左子樹 i 個、右子樹 k - 1 - i 個 */
      b[k] += b[i] * b[k - 1 - i];
  }
  return b[n];
}

void freeTree(treePointer t) {
  if (t == NULL) return;
  freeTree(t->left);
  freeTree(t->right);
  free(t);
}

/* ---------- 測試 ---------- */
void report(const char *name, const char *s) {
  char a[64];
  int size = (int)strlen(s);
  a[0] = ' ';
  memcpy(a + 1, s, size);                      /* a[1..size] */
  treePointer t = buildFromArray(a, size, 1);
  int cnt[3] = {0, 0, 0};
  countDegree(t, cnt);
  int n = countNodes(t);
  printf("%-10s n=%d h=%d n0=%d n1=%d n2=%d complete=%d strict=%d\n", name, n,
         height(t), cnt[0], cnt[1], cnt[2], isComplete(t, 1, n), isStrict(t));
  freeTree(t);
}

int main(void) {
  report("full", "ABCDEFG");                   /* 高度 3 的完滿二元樹 */
  report("complete", "ABCDEF");                /* 完全二元樹 */
  report("hole", "ABCD-FG");                   /* [5] 空著：不是完全 */
  report("skewed", "A-B---C");                 /* 右歪斜 */
  report("demo", "ABCDE-F--GH");
  for (int k = 0; k <= 6; k++) printf("b(%d)=%lld ", k, countShapes(k));
  printf("\n");
  return 0;
}
