/* Binary Tree Traversal（二元樹走訪）完整程式：只用來編譯驗證，頁面上的片段都從這裡取出 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

typedef struct Node {
  char data;
  struct Node *left, *right;
} Node;

Node *newNode(char c) {
  Node *p = malloc(sizeof(Node));
  p->data = c;
  p->left = p->right = NULL;
  return p;
}

/* ---------- 三種深度優先走訪：只差在「拜訪自己」放在哪裡 ---------- */
void preorder(Node *t) {
  if (t == NULL) return;
  printf("%c ", t->data);                        /* V：先拜訪自己 */
  preorder(t->left);                             /* L */
  preorder(t->right);                            /* R */
}

void inorder(Node *t) {
  if (t == NULL) return;
  inorder(t->left);                              /* L */
  printf("%c ", t->data);                        /* V：左子樹走完才拜訪自己 */
  inorder(t->right);                             /* R */
}

void postorder(Node *t) {
  if (t == NULL) return;
  postorder(t->left);                            /* L */
  postorder(t->right);                           /* R */
  printf("%c ", t->data);                        /* V：兩棵子樹都走完才拜訪自己 */
}

/* ---------- 不用遞迴的中序：自己用 stack ---------- */
void inorderIter(Node *t) {
  Node *stack[100];
  int top = -1;
  while (t != NULL || top != -1) {
    while (t != NULL) {                          /* 一路往左走，沿途 push */
      stack[++top] = t;
      t = t->left;
    }
    t = stack[top--];                            /* 左邊到底了，pop 出來拜訪 */
    printf("%c ", t->data);
    t = t->right;                                /* 再處理它的右子樹 */
  }
}

/* ---------- 層序走訪：用 queue ---------- */
void levelorder(Node *t) {
  Node *queue[100];
  int front = 0, rear = 0;                       /* front：下一個要取的；rear：下一個空位 */
  if (t == NULL) return;
  queue[rear++] = t;
  while (front < rear) {
    Node *p = queue[front++];
    printf("%c ", p->data);
    if (p->left)  queue[rear++] = p->left;       /* 先左後右放進 queue */
    if (p->right) queue[rear++] = p->right;
  }
}

/* ---------- 由 preorder 與 inorder 重建二元樹 ---------- */
Node *build(const char *pre, const char *in, int n) {
  if (n == 0) return NULL;
  Node *t = newNode(pre[0]);                     /* preorder 的第一個一定是根 */
  int k = 0;
  while (in[k] != pre[0]) k++;                   /* 根在 inorder 的位置：左邊 k 個是左子樹 */
  t->left  = build(pre + 1, in, k);
  t->right = build(pre + 1 + k, in + k + 1, n - k - 1);
  return t;
}

/* 測試用：由層序字串建樹，'-' 表示空 */
Node *fromLevel(const char *s, int i, int n) {
  if (i >= n || s[i] == '-') return NULL;
  Node *t = newNode(s[i]);
  t->left = fromLevel(s, 2 * i + 1, n);
  t->right = fromLevel(s, 2 * i + 2, n);
  return t;
}

void freeTree(Node *t) {
  if (t == NULL) return;
  freeTree(t->left);
  freeTree(t->right);
  free(t);
}

int main(void) {
  const char *lv = "ABCDE-F--G---HI";             /* 頁面上的範例樹 */
  Node *t = fromLevel(lv, 0, (int)strlen(lv));
  printf("pre : "); preorder(t);    printf("\n");
  printf("in  : "); inorder(t);     printf("\n");
  printf("post: "); postorder(t);   printf("\n");
  printf("in2 : "); inorderIter(t); printf("\n");
  printf("lvl : "); levelorder(t);  printf("\n");

  Node *r = build("ABDGCEHF", "DGBAEHCF", 8);     /* 練習題：由前序 + 中序求後序 */
  printf("rebuilt post: "); postorder(r); printf("\n");
  freeTree(t);
  freeTree(r);
  return 0;
}
