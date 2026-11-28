/* Red-Black Tree（紅黑樹）：插入、刪除（前驅／後繼）、性質檢查
 * 編譯：gcc -std=c99 -Wall -Wextra -fsanitize=address,undefined red-black-tree.c
 * NIL 用 NULL 表示，colorOf(NULL) 一律回傳 BLACK。
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

typedef enum { RED, BLACK } Color;

typedef struct Node {
  int key;
  Color color;
  struct Node *left, *right, *parent;
} Node;

Node *root = NULL;

Color colorOf(Node *x) { return x == NULL ? BLACK : x->color; } /* NIL 是黑 */

/* 左旋：x 的右子 y 轉上來，y 的左子樹 β 改掛到 x 的右邊 */
void leftRotate(Node *x) {
  Node *y = x->right;
  x->right = y->left;                     /* β 搬到 x 的右邊 */
  if (y->left != NULL) y->left->parent = x;
  y->parent = x->parent;                  /* y 接到 x 原本的父節點 */
  if (x->parent == NULL) root = y;
  else if (x == x->parent->left) x->parent->left = y;
  else x->parent->right = y;
  y->left = x;                            /* x 變成 y 的左子 */
  x->parent = y;
}

/* 右旋：x 的左子 y 轉上來，y 的右子樹 β 改掛到 x 的左邊 */
void rightRotate(Node *x) {
  Node *y = x->left;
  x->left = y->right;                     /* β 搬到 x 的左邊 */
  if (y->right != NULL) y->right->parent = x;
  y->parent = x->parent;
  if (x->parent == NULL) root = y;
  else if (x == x->parent->right) x->parent->right = y;
  else x->parent->left = y;
  y->right = x;                           /* x 變成 y 的右子 */
  x->parent = y;
}

Node *search(int key) {
  Node *x = root;
  while (x != NULL && x->key != key)
    x = key < x->key ? x->left : x->right;
  return x;
}

/* 插入後修正：z 是紅色，若父節點也是紅色就違反「紅紅不相連」 */
void insertFixup(Node *z) {
  while (colorOf(z->parent) == RED) {     /* 父紅 → 祖父一定存在且是黑 */
    Node *p = z->parent, *g = p->parent;
    if (p == g->left) {
      Node *u = g->right;                 /* 叔叔 */
      if (colorOf(u) == RED) {            /* case 1：叔叔紅 → 變色，問題上移 */
        p->color = BLACK;
        u->color = BLACK;
        g->color = RED;
        z = g;
      } else {
        if (z == p->right) {              /* case 2：LR 型，先左旋父變 LL */
          z = p;
          leftRotate(z);
          p = z->parent;
        }
        p->color = BLACK;                 /* case 3：LL 型，父祖換色再右旋 */
        g->color = RED;
        rightRotate(g);
      }
    } else {                              /* 鏡像：父是祖父的右子 */
      Node *u = g->left;
      if (colorOf(u) == RED) {            /* case 1（鏡像）：叔叔紅 → 變色 */
        p->color = BLACK;
        u->color = BLACK;
        g->color = RED;
        z = g;
      } else {
        if (z == p->left) {               /* case 2（鏡像）：RL 型，先右旋父 */
          z = p;
          rightRotate(z);
          p = z->parent;
        }
        p->color = BLACK;                 /* case 3（鏡像）：RR 型，再左旋祖父 */
        g->color = RED;
        leftRotate(g);
      }
    }
  }
  root->color = BLACK;                    /* 根一定塗黑 */
}

/* 插入：先照 BST 規則放到葉子，塗紅，再修正 */
int rbInsert(int key) {
  Node *p = NULL, *x = root;
  while (x != NULL) {
    p = x;
    if (key == x->key) return 0;          /* 已存在，不插入 */
    x = key < x->key ? x->left : x->right;
  }
  Node *z = malloc(sizeof(Node));
  z->key = key;
  z->left = z->right = NULL;
  z->parent = p;
  z->color = RED;                         /* 新節點一律塗紅 */
  if (p == NULL) root = z;
  else if (key < p->key) p->left = z;
  else p->right = z;
  insertFixup(z);
  return 1;
}

/* 用 v 取代 u 在樹中的位置（v 可以是 NULL） */
void replaceNode(Node *u, Node *v) {
  if (u->parent == NULL) root = v;
  else if (u == u->parent->left) u->parent->left = v;
  else u->parent->right = v;
  if (v != NULL) v->parent = u->parent;
}

/* 刪除後修正：x 是「要拿掉的黑色葉子」或往上傳的 double black 節點 */
void deleteFixup(Node *x) {
  while (x != root && x->color == BLACK) {
    Node *p = x->parent;
    if (x == p->left) {
      Node *s = p->right;                 /* 兄弟 */
      if (colorOf(s) == RED) {            /* case 1：兄弟紅 → 旋轉成兄弟黑 */
        s->color = BLACK;
        p->color = RED;
        leftRotate(p);
        s = p->right;
      }
      if (colorOf(s->left) == BLACK && colorOf(s->right) == BLACK) {
        s->color = RED;                   /* case 2：兄弟黑、兩姪黑 → 兄弟變紅，上移 */
        x = p;
      } else {
        if (colorOf(s->right) == BLACK) { /* case 3：遠姪黑、近姪紅 → 先右旋兄弟 */
          s->left->color = BLACK;
          s->color = RED;
          rightRotate(s);
          s = p->right;
        }
        s->color = p->color;              /* case 4：遠姪紅 → 左旋父，結束 */
        p->color = BLACK;
        s->right->color = BLACK;
        leftRotate(p);
        x = root;
      }
    } else {                              /* 鏡像：x 是右子 */
      Node *s = p->left;
      if (colorOf(s) == RED) {            /* case 1（鏡像）：兄弟紅 */
        s->color = BLACK;
        p->color = RED;
        rightRotate(p);
        s = p->left;
      }
      if (colorOf(s->left) == BLACK && colorOf(s->right) == BLACK) {
        s->color = RED;                   /* case 2（鏡像）：兩姪黑 */
        x = p;
      } else {
        if (colorOf(s->left) == BLACK) {  /* case 3（鏡像）：遠姪黑、近姪紅 */
          s->right->color = BLACK;
          s->color = RED;
          leftRotate(s);
          s = p->left;
        }
        s->color = p->color;              /* case 4（鏡像）：遠姪紅 → 右旋父 */
        p->color = BLACK;
        s->left->color = BLACK;
        rightRotate(p);
        x = root;
      }
    }
  }
  x->color = BLACK;                       /* 紅色節點吸收多出來的黑 */
}

/* 拿掉最多只有一個子節點的 z */
void removeOne(Node *z) {
  Node *child = z->left != NULL ? z->left : z->right;
  if (child != NULL) {                    /* z 黑、child 紅：child 頂上並塗黑 */
    child->color = BLACK;
    replaceNode(z, child);
  } else {
    if (z->color == BLACK) deleteFixup(z); /* 黑色葉子：先修 double black */
    replaceNode(z, NULL);                 /* 紅色葉子：直接拿掉 */
  }
  free(z);
}

/* 刪除：兩個子節點時用左子樹最大（中序前驅）取代 */
int rbDelete(int key) {
  Node *z = search(key);
  if (z == NULL) return 0;                /* 找不到 */
  if (z->left != NULL && z->right != NULL) {
    Node *s = z->left;                    /* 左子樹最大 */
    while (s->right != NULL) s = s->right;
    z->key = s->key;                      /* 複製前驅的值 */
    z = s;                                /* 改成刪除前驅，它沒有右子 */
  }
  removeOne(z);
  return 1;
}

/* 刪除：兩個子節點時用右子樹最小（中序後繼）取代 */
int rbDeleteSucc(int key) {
  Node *z = search(key);
  if (z == NULL) return 0;
  if (z->left != NULL && z->right != NULL) {
    Node *s = z->right;                   /* 右子樹最小 */
    while (s->left != NULL) s = s->left;
    z->key = s->key;                      /* 複製後繼的值 */
    z = s;                                /* 改成刪除後繼，它沒有左子 */
  }
  removeOne(z);
  return 1;
}

/* 檢查紅黑樹性質：回傳從 x 往下到 NIL 經過的黑色內部節點數（含 x 自己），違反時回傳 -1 */
int blackHeight(Node *x, int lo, int hi) {
  if (x == NULL) return 0;
  if (x->key <= lo || x->key >= hi) return -1;               /* 不是 BST */
  if (x->color == RED && (colorOf(x->left) == RED || colorOf(x->right) == RED))
    return -1;                                                /* 紅紅相連 */
  if (x->left && x->left->parent != x) return -1;
  if (x->right && x->right->parent != x) return -1;
  int a = blackHeight(x->left, lo, x->key), b = blackHeight(x->right, x->key, hi);
  if (a < 0 || b < 0 || a != b) return -1;                    /* 黑高度不同 */
  return a + (x->color == BLACK ? 1 : 0);
}
int isValid(void) {
  if (colorOf(root) == RED) return 0;
  return blackHeight(root, -1000000, 1000000) >= 0;
}

int height(Node *x) {
  if (x == NULL) return 0;
  int a = height(x->left), b = height(x->right);
  return 1 + (a > b ? a : b);
}
int countColor(Node *x, Color c) {
  if (x == NULL) return 0;
  return (x->color == c) + countColor(x->left, c) + countColor(x->right, c);
}

/* 把樹寫成 key(B/R)(左, 右) 字串，方便和預期結果比對 */
void dump(Node *x, char *buf) {
  char t[32];
  if (x == NULL) { strcat(buf, "-"); return; }
  sprintf(t, "%d%c", x->key, x->color == RED ? 'R' : 'B');
  strcat(buf, t);
  if (x->left == NULL && x->right == NULL) return;
  strcat(buf, "(");
  dump(x->left, buf);
  strcat(buf, ",");
  dump(x->right, buf);
  strcat(buf, ")");
}

void freeTree(Node *x) {
  if (x == NULL) return;
  freeTree(x->left);
  freeTree(x->right);
  free(x);
}

/* 依「節點 key 與顏色」的前序字串直接建樹（測試考古題給定的樹用）
 * 格式：key 後接 R/B；用 BST 規則插入但不做修正 */
void plant(const int *keys, const char *colors, int n) {
  for (int i = 0; i < n; i++) {
    Node *p = NULL, *x = root;
    while (x != NULL) { p = x; x = keys[i] < x->key ? x->left : x->right; }
    Node *z = malloc(sizeof(Node));
    z->key = keys[i];
    z->color = colors[i] == 'R' ? RED : BLACK;
    z->left = z->right = NULL;
    z->parent = p;
    if (p == NULL) root = z;
    else if (keys[i] < p->key) p->left = z;
    else p->right = z;
  }
}

static int fails = 0;
void expect(const char *name, const char *want) {
  char buf[2048] = "";
  dump(root, buf);
  int ok = strcmp(buf, want) == 0 && isValid();
  printf("%-28s %s  %s\n", name, ok ? "OK  " : "FAIL", buf);
  if (!ok) { printf("   want %s\n", want); fails++; }
}
void reset(void) { freeTree(root); root = NULL; }

int main(void) {
  /* 示範：依序插入 10, 20, 30, 15, 25, 5, 1 */
  int a[] = {10, 20, 30, 15, 25, 5, 1};
  for (int i = 0; i < 7; i++) rbInsert(a[i]);
  expect("demo insert", "20B(10R(5B(1R,-),15B),30B(25R,-))");
  reset();

  /* 陽明交大 110：5, 3, 8, 2 */
  int b[] = {5, 3, 8, 2};
  for (int i = 0; i < 4; i++) rbInsert(b[i]);
  expect("nycu110 5,3,8,2", "5B(3B(2R,-),8B)");
  reset();

  /* 陽明交大 111：5, 2, 7, 3, 4 */
  int c[] = {5, 2, 7, 3, 4};
  for (int i = 0; i < 5; i++) rbInsert(c[i]);
  expect("nycu111 5,2,7,3,4", "5B(3B(2R,4R),7B)");
  reset();

  /* 成大 111：給定樹插入 62 */
  int k1[] = {50, 10, 80, 65, 90, 60, 70};
  plant(k1, "BBRBBRR", 7);
  rbInsert(62);
  expect("ncku111 +62", "65B(50R(10B,60B(-,62R)),80R(70B,90B))");
  reset();

  /* 成大 112：插 6, 14, 11 */
  int k2[] = {10, 8, 3, 7, 9, 15, 13, 22};
  plant(k2, "BRBRBBRR", 8);
  rbInsert(6); rbInsert(14); rbInsert(11);
  expect("ncku112 +6,14,11", "10B(8R(6B(3R,7R),9B),15R(13B(11R,14R),22B))");
  reset();

  /* 成大 114：刪除題 */
  int k3[] = {12, 7, 3, 2, 5, 9, 8, 42, 29, 18, 22, 38, 57, 45};
  plant(k3, "BBBRRBRBRBRBBR", 14);
  expect("ncku114 given", "12B(7B(3B(2R,5R),9B(8R,-)),42B(29R(18B(-,22R),38B),57B(45R,-)))");
  rbDelete(45); rbDelete(57);
  expect("ncku114 -45,-57", "12B(7B(3B(2R,5R),9B(8R,-)),29B(18B(-,22R),42B(38R,-)))");
  reset();
  plant(k3, "BBBRRBRBRBRBBR", 14);
  int h0 = height(root);
  rbDelete(42);                           /* 前驅 38 取代 */
  printf("ncku114 -42 (pred): height %d -> %d\n", h0, height(root));
  expect("ncku114 -42 pred", "12B(7B(3B(2R,5R),9B(8R,-)),38B(22R(18B,29B),57B(45R,-)))");
  reset();

  /* 刪除示範：50,30,70,20,40,60,80,10 後刪 20、70、50 */
  int d[] = {50, 30, 70, 20, 40, 60, 80, 10};
  for (int i = 0; i < 8; i++) rbInsert(d[i]);
  expect("del demo build", "50B(30R(20B(10R,-),40B),70B(60R,80R))");
  rbDelete(40);
  expect("del demo -40", "50B(20R(10B,30B),70B(60R,80R))");
  rbDeleteSucc(50);
  expect("del demo -50 succ", "60B(20R(10B,30B),70B(-,80R))");
  reset();

  /* 隨機壓力測試：插入、刪除交錯，每步都檢查性質 */
  srand(7);
  int inTree[200] = {0};
  for (int step = 0; step < 20000; step++) {
    int k = rand() % 200, op = rand() % 3;
    if (op < 2) { int r = rbInsert(k); if (r != !inTree[k]) fails++; inTree[k] = 1; }
    else {
      int r = (step & 1) ? rbDelete(k) : rbDeleteSucc(k);
      if (r != inTree[k]) fails++;
      inTree[k] = 0;
    }
    if (!isValid()) { printf("invalid at step %d\n", step); fails++; break; }
  }
  printf("random test: %s, red=%d black=%d height=%d\n", fails ? "FAIL" : "OK",
         countColor(root, RED), countColor(root, BLACK), height(root));
  reset();

  printf(fails ? "%d FAILED\n" : "all passed\n", fails);
  return fails != 0;
}
