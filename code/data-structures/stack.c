#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <ctype.h>

/* ===== 1. 陣列實作的整數堆疊 ===== */
#define MAX 6                          /* 堆疊大小（示範用） */
#define EXPR_MAX 100                   /* 運算式最大長度 */
int stack[MAX];
int top = -1;                         /* -1 表示空堆疊 */

int isEmpty(void) { return top == -1; }
int isFull(void)  { return top == MAX - 1; }

void push(int x) {
  if (isFull()) { printf("Stack Overflow\n"); exit(1); }
  stack[++top] = x;                   /* 先把 top 加 1，再放入 */
}

int pop(void) {
  if (isEmpty()) { printf("Stack Underflow\n"); exit(1); }
  return stack[top--];                /* 先取出，再把 top 減 1 */
}

int peek(void) {
  if (isEmpty()) { printf("Stack Underflow\n"); exit(1); }
  return stack[top];
}

/* ===== 2. 鏈結串列實作的堆疊 ===== */
typedef struct Node {
  int data;
  struct Node *next;                  /* 指向下面那個節點 */
} Node;

Node *ltop = NULL;                    /* NULL 表示空堆疊 */

void lpush(int x) {
  Node *p = malloc(sizeof(Node));
  p->data = x;
  p->next = ltop;                     /* 新節點接在最上面 */
  ltop = p;
}

int lpop(void) {
  if (ltop == NULL) { printf("Stack Underflow\n"); exit(1); }
  Node *p = ltop;
  int x = p->data;
  ltop = p->next;                     /* top 往下移一個 */
  free(p);
  return x;
}

/* ===== 3. 中序轉後序（isp / icp） ===== */
/* 運算元為單一字母或數字；'#' 代表 eos，放在運算子堆疊底 */
int isp(char c) {                     /* 在堆疊裡的優先權 */
  switch (c) {
    case '(': return 0;
    case '+': case '-': return 12;
    case '*': case '/': case '%': return 13;
    case '^': return 14;
    default:  return 0;               /* '#'（eos） */
  }
}

int icp(char c) {                     /* 剛讀入時的優先權 */
  switch (c) {
    case '(': return 20;
    case '+': case '-': return 12;
    case '*': case '/': case '%': return 13;
    case '^': return 15;              /* 右結合：icp > isp */
    default:  return 0;
  }
}

void infixToPostfix(const char *in, char *out) {
  char ops[EXPR_MAX];                 /* 運算子堆疊 */
  int otop = 0, k = 0;
  ops[0] = '#';                       /* 堆疊底放 eos */
  for (int i = 0; in[i] != '\0'; i++) {
    char t = in[i];
    if (isalnum((unsigned char)t)) {
      out[k++] = t;                   /* 運算元直接輸出 */
    } else if (t == ')') {
      while (ops[otop] != '(') out[k++] = ops[otop--];
      otop--;                         /* 丟掉 '(' */
    } else {
      while (isp(ops[otop]) >= icp(t)) out[k++] = ops[otop--];
      ops[++otop] = t;
    }
  }
  while (ops[otop] != '#') out[k++] = ops[otop--];
  out[k] = '\0';
}

/* ===== 4. 後序式求值（運算元為一位數字） ===== */
int evalPostfix(const char *post) {
  top = -1;                           /* 重用上面的整數堆疊 */
  for (int i = 0; post[i] != '\0'; i++) {
    char t = post[i];
    if (isdigit((unsigned char)t)) {
      push(t - '0');
    } else {
      int b = pop();                  /* 先 pop 的是右運算元 */
      int a = pop();
      switch (t) {
        case '+': push(a + b); break;
        case '-': push(a - b); break;
        case '*': push(a * b); break;
        case '/': push(a / b); break;
        case '%': push(a % b); break;
      }
    }
  }
  return pop();
}

int main(void) {
  /* 陣列堆疊 */
  push(3); push(8); push(5);
  printf("peek = %d\n", peek());                /* 5 */
  printf("pop  = %d\n", pop());                 /* 5 */
  printf("pop  = %d\n", pop());                 /* 8 */

  /* 鏈結堆疊 */
  lpush(1); lpush(2); lpush(3);
  int x1 = lpop(), x2 = lpop(), x3 = lpop();    /* 分開寫，保證由左到右 pop */
  printf("lpop = %d %d %d\n", x1, x2, x3);      /* 3 2 1 */

  /* 中序轉後序 */
  const char *tests[] = { "a+b*c", "a*(b+c)*d", "a/b-c+d*e-a*c", "2^3^2" };
  char out[EXPR_MAX];
  for (int i = 0; i < 4; i++) {
    infixToPostfix(tests[i], out);
    printf("%-15s -> %s\n", tests[i], out);
  }

  /* 後序式求值 */
  printf("623+-382/+* = %d\n", evalPostfix("623+-382/+*"));   /* 7 */
  return 0;
}
