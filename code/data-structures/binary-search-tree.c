#include <stdio.h>
#include <stdlib.h>

typedef struct Node {
  int key;
  struct Node *left, *right;
} Node;

Node *newNode(int x) {
  Node *p = malloc(sizeof(Node));
  p->key = x;
  p->left = p->right = NULL;
  return p;
}

/* ===== 搜尋 ===== */
Node *search(Node *root, int x) {               /* 迴圈版 */
  while (root != NULL && root->key != x) {
    if (x < root->key) root = root->left;
    else               root = root->right;
  }
  return root;                                   /* NULL 表示找不到 */
}

Node *searchRec(Node *root, int x) {            /* 遞迴版 */
  if (root == NULL || root->key == x) return root;
  if (x < root->key) return searchRec(root->left, x);
  return searchRec(root->right, x);
}

/* ===== 插入 ===== */
Node *insert(Node *root, int x) {               /* 遞迴版 */
  if (root == NULL) return newNode(x);
  if (x < root->key)
    root->left = insert(root->left, x);
  else if (x > root->key)
    root->right = insert(root->right, x);
  /* x == root->key：已存在，不插入 */
  return root;
}

Node *insertIter(Node *root, int x) {           /* 迴圈版 */
  Node *parent = NULL, *cur = root;
  while (cur != NULL) {                          /* 先找到要接的位置 */
    if (x == cur->key) return root;              /* 已存在 */
    parent = cur;
    cur = (x < cur->key) ? cur->left : cur->right;
  }
  Node *p = newNode(x);
  if (parent == NULL) return p;                  /* 原本是空樹 */
  if (x < parent->key) parent->left = p;
  else parent->right = p;
  return root;
}

/* ===== 刪除（兩個子節點時用左子樹最大）===== */
Node *deletePred(Node *root, int x) {
  if (root == NULL) return NULL;                 /* 找不到 */
  if (x < root->key)      root->left  = deletePred(root->left, x);
  else if (x > root->key) root->right = deletePred(root->right, x);
  else {
    if (root->left == NULL)  { Node *r = root->right; free(root); return r; }
    if (root->right == NULL) { Node *l = root->left;  free(root); return l; }
    Node *s = root->left;                        /* 左子樹最大 */
    while (s->right) s = s->right;
    root->key = s->key;
    root->left = deletePred(root->left, s->key);
  }
  return root;
}

/* ===== 刪除（兩個子節點時用右子樹最小）===== */
Node *deleteSucc(Node *root, int x) {
  if (root == NULL) return NULL;
  if (x < root->key)      root->left  = deleteSucc(root->left, x);
  else if (x > root->key) root->right = deleteSucc(root->right, x);
  else {
    if (root->left == NULL)  { Node *r = root->right; free(root); return r; }
    if (root->right == NULL) { Node *l = root->left;  free(root); return l; }
    Node *s = root->right;                       /* 右子樹最小 */
    while (s->left) s = s->left;
    root->key = s->key;
    root->right = deleteSucc(root->right, s->key);
  }
  return root;
}

/* ===== 中序走訪 ===== */
void inorder(Node *t) {
  if (t == NULL) return;
  inorder(t->left);
  printf("%d ", t->key);                         /* visit */
  inorder(t->right);
}

void freeTree(Node *t) {
  if (t == NULL) return;
  freeTree(t->left);
  freeTree(t->right);
  free(t);
}

Node *build(void) {
  int keys[] = { 50, 30, 70, 20, 40, 60, 80, 35, 65 };
  Node *root = NULL;
  for (int i = 0; i < 9; i++) root = insert(root, keys[i]);
  return root;
}

int main(void) {
  Node *root = build();
  printf("inorder: "); inorder(root); printf("\n");

  printf("search 35: %s\n", search(root, 35) ? "found" : "not found");
  printf("search 99: %s\n", searchRec(root, 99) ? "found" : "not found");

  root = insertIter(root, 45);
  printf("insert 45: "); inorder(root); printf("\n");

  root = deletePred(root, 20);                   /* Case 1：葉節點 */
  root = deletePred(root, 60);                   /* Case 2：一個子節點 */
  printf("delete 20, 60: "); inorder(root); printf("\n");

  root = deletePred(root, 50);                   /* Case 3：兩個子節點 */
  printf("delete 50 (左子樹最大): root = %d, inorder: ", root->key); inorder(root); printf("\n");
  freeTree(root);

  root = deleteSucc(build(), 50);
  printf("delete 50 (右子樹最小): root = %d, inorder: ", root->key); inorder(root); printf("\n");
  freeTree(root);
  return 0;
}
