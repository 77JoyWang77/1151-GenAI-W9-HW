/* Propositional Logic（命題邏輯）完整程式
   剖析命題公式 → 產生真值表 → 判斷恆真 / 矛盾 / 可滿足，以及兩式是否等價
   編譯：gcc -std=c99 -Wall -Wextra -fsanitize=address,undefined propositional-logic.c */
#include <stdio.h>
#include <string.h>

/* ---------- 語法樹 ---------- */
enum { VAR, CONST, NOT, AND, XOR, OR, IMP, IFF };
enum { CONTRADICTION, CONTINGENT, TAUTOLOGY };

typedef struct {
  int op;          /* VAR、CONST、NOT、AND …… */
  int var;         /* VAR：0..3 代表 p q r s；CONST：1 = T、0 = F */
  int l, r;        /* 左右子樹在 node[] 裡的位置（NOT 只用 l） */
} Node;

#define MAXN 128
Node node[MAXN];
int nn;                        /* 已經用掉幾個節點 */
int pos[4], nvar;              /* pos[字母] = 它是真值表的第幾個變數；nvar = 變數個數 */

const char *src;               /* 正在剖析的字串 */
int at;                        /* 目前讀到第幾個字元 */
const char *err;               /* 錯誤訊息；NULL 表示沒有錯 */
int errAt;                     /* 錯誤發生的位置（從 0 開始） */

/* ---------- 剖析器：遞迴下降，一層優先順序一個函式 ---------- */
/* 優先順序（高 → 低）：~  &  ^  |  ->  <->；-> 從右結合，其餘從左結合 */

void skip(void) { while (src[at] == ' ') at++; }

int eat(const char *tok) {     /* 下一個符號是 tok 就吃掉它，回傳 1 */
  skip();
  int n = strlen(tok);
  if (strncmp(src + at, tok, n) == 0) { at += n; return 1; }
  return 0;
}

int fail(const char *msg) {
  if (!err) { err = msg; errAt = at; }   /* 只記第一個錯誤 */
  return -1;
}

int mk(int op, int var, int l, int r) {
  if (nn >= MAXN) return fail("公式太長");
  node[nn] = (Node){ op, var, l, r };
  return nn++;
}

int parseIff(void);

int parseAtom(void) {          /* 變數、常數、括號 */
  skip();
  char c = src[at];
  if (c >= 'p' && c <= 's') { at++; return mk(VAR, c - 'p', -1, -1); }
  if (c == 'T' || c == 'F') { at++; return mk(CONST, c == 'T', -1, -1); }
  if (c == '(') {
    at++;
    int k = parseIff();
    if (k < 0) return -1;
    if (!eat(")")) return fail("少了右括號 )");
    return k;
  }
  if (c == '\0') return fail("公式還沒結束，這裡需要一個變數或左括號");
  return fail("這裡需要變數 p q r s、常數 T F 或左括號");
}

int parseNot(void) {           /* ~ 只作用在緊接著的那一項 */
  if (eat("~")) {
    int k = parseNot();
    return k < 0 ? -1 : mk(NOT, 0, k, -1);
  }
  return parseAtom();
}

int parseAnd(void) {
  int k = parseNot();
  while (k >= 0 && eat("&")) { int r = parseNot(); k = r < 0 ? -1 : mk(AND, 0, k, r); }
  return k;
}

int parseXor(void) {
  int k = parseAnd();
  while (k >= 0 && eat("^")) { int r = parseAnd(); k = r < 0 ? -1 : mk(XOR, 0, k, r); }
  return k;
}

int parseOr(void) {
  int k = parseXor();
  while (k >= 0 && eat("|")) { int r = parseXor(); k = r < 0 ? -1 : mk(OR, 0, k, r); }
  return k;
}

int parseImp(void) {           /* p -> q -> r 讀成 p -> (q -> r) */
  int k = parseOr();
  if (k >= 0 && eat("->")) { int r = parseImp(); k = r < 0 ? -1 : mk(IMP, 0, k, r); }
  return k;
}

int parseIff(void) {
  int k = parseImp();
  while (k >= 0 && eat("<->")) { int r = parseImp(); k = r < 0 ? -1 : mk(IFF, 0, k, r); }
  return k;
}

int parse(const char *s) {     /* 成功回傳根節點，失敗回傳 -1（err、errAt 說明原因） */
  src = s; at = 0; err = NULL;
  int k = parseIff();
  skip();
  if (k >= 0 && src[at] != '\0')
    return fail(src[at] == ')' ? "多了一個右括號 )" : "這裡多出了無法辨識的符號");
  return k;
}

/* 統計用到哪些變數，依 p q r s 的順序編號 */
void collect(int k, int *used) {
  if (k < 0) return;
  if (node[k].op == VAR) used[node[k].var] = 1;
  collect(node[k].l, used);
  collect(node[k].r, used);
}

void setVars(const int *used) {
  nvar = 0;
  for (int v = 0; v < 4; v++) if (used[v]) pos[v] = nvar++;
}

/* ---------- 求值：row 的二進位就是各變數的真值（1 = T） ---------- */
int eval(int k, int row) {
  Node *t = &node[k];
  switch (t->op) {
  case VAR:   return (row >> (nvar - 1 - pos[t->var])) & 1;
  case CONST: return t->var;
  case NOT:   return !eval(t->l, row);
  case AND:   return eval(t->l, row) && eval(t->r, row);
  case XOR:   return eval(t->l, row) != eval(t->r, row);   /* 剛好一個為真 */
  case OR:    return eval(t->l, row) || eval(t->r, row);
  case IMP:   return !eval(t->l, row) || eval(t->r, row);  /* 前提假就為真 */
  case IFF:   return eval(t->l, row) == eval(t->r, row);   /* 真值相同才為真 */
  }
  return 0;
}

int classify(int root) {
  int t = 0, rows = 1 << nvar;
  for (int row = rows - 1; row >= 0; row--)     /* 由全 T 到全 F，共 2^n 列 */
    t += eval(root, row);                       /* 數有幾列為真 */
  if (t == rows) return TAUTOLOGY;              /* 每一列都真 */
  if (t == 0) return CONTRADICTION;             /* 每一列都假 */
  return CONTINGENT;                            /* 有真有假：可滿足但不是恆真 */
}

int equivalent(int a, int b) {                  /* 回傳反例那一列；-1 表示等價 */
  for (int row = (1 << nvar) - 1; row >= 0; row--)
    if (eval(a, row) != eval(b, row)) return row;   /* 這一列兩式真值不同 */
  return -1;                                    /* 每一列都相同：a ≡ b */
}

/* ---------- 印出：依優先順序只加必要的括號 ---------- */
int prec(int op) {
  switch (op) {
  case IFF: return 1;
  case IMP: return 2;
  case OR:  return 3;
  case XOR: return 4;
  case AND: return 5;
  case NOT: return 6;
  }
  return 7;                                     /* 變數、常數 */
}

void show(int k, char *out) {                   /* 把子樹 k 接在 out 後面 */
  static const char *sym[] = { "", "", "~", " & ", " ^ ", " | ", " -> ", " <-> " };
  Node *t = &node[k];
  if (t->op == VAR) { char v[2] = { (char)('p' + t->var), '\0' }; strcat(out, v); return; }
  if (t->op == CONST) { strcat(out, t->var ? "T" : "F"); return; }
  int p = prec(t->op);
  if (t->op == NOT) {
    int paren = prec(node[t->l].op) < p;
    strcat(out, "~");
    if (paren) strcat(out, "(");
    show(t->l, out);
    if (paren) strcat(out, ")");
    return;
  }
  int pl = prec(node[t->l].op), pr = prec(node[t->r].op);
  int lp = pl < p || (pl == p && t->op == IMP);  /* -> 從右結合：左邊同級一定要括號 */
  int rp = pr <= p;                              /* 右邊同級也加括號，讀起來比較清楚 */
  if (lp) strcat(out, "(");
  show(t->l, out);
  if (lp) strcat(out, ")");
  strcat(out, sym[t->op]);
  if (rp) strcat(out, "(");
  show(t->r, out);
  if (rp) strcat(out, ")");
}

/* 依「先算子式、再算整體」的順序列出要算的欄位（後序，重複的子式只列一次） */
int cols[MAXN], ncol;
char colText[MAXN][160];

void addCols(int k) {
  if (node[k].op == VAR || node[k].op == CONST) return;
  addCols(node[k].l);
  if (node[k].r >= 0) addCols(node[k].r);
  char buf[160] = "";
  show(k, buf);
  for (int i = 0; i < ncol; i++) if (strcmp(colText[i], buf) == 0) return;
  strcpy(colText[ncol], buf);
  cols[ncol++] = k;
}

void truthTable(int root) {
  ncol = 0;
  addCols(root);
  for (int v = 0; v < 4; v++) if (pos[v] >= 0) printf("%c ", 'p' + v);
  for (int i = 0; i < ncol; i++) printf("| %s ", colText[i]);
  printf("\n");
  for (int row = (1 << nvar) - 1; row >= 0; row--) {
    for (int i = 0; i < nvar; i++) printf("%c ", (row >> (nvar - 1 - i)) & 1 ? 'T' : 'F');
    for (int i = 0; i < ncol; i++) {
      int w = strlen(colText[i]);
      printf("| %*c ", w, eval(cols[i], row) ? 'T' : 'F');
    }
    printf("\n");
  }
}

/* ---------- 測試 ---------- */
const char *KIND[] = { "矛盾式（每一列都假）", "可滿足但非恆真", "恆真式（每一列都真）" };

int prepare(const char *a, const char *b, int *ra, int *rb) {
  int used[4] = { 0, 0, 0, 0 };
  nn = 0;
  for (int v = 0; v < 4; v++) pos[v] = -1;
  *ra = parse(a);
  if (*ra < 0) { printf("「%s」第 %d 個字元：%s\n", a, errAt + 1, err); return 0; }
  collect(*ra, used);
  if (b) {
    *rb = parse(b);
    if (*rb < 0) { printf("「%s」第 %d 個字元：%s\n", b, errAt + 1, err); return 0; }
    collect(*rb, used);
  }
  setVars(used);
  return 1;
}

void report(const char *a) {
  int ra, rb;
  if (!prepare(a, NULL, &ra, &rb)) return;
  char buf[160] = "";
  show(ra, buf);
  int t = 0;
  for (int row = (1 << nvar) - 1; row >= 0; row--) t += eval(ra, row);
  printf("\n公式 %s（讀成 %s）\n", a, buf);
  truthTable(ra);
  printf("→ %d / %d 列為真，%s\n", t, 1 << nvar, KIND[classify(ra)]);
}

void compare(const char *a, const char *b) {
  int ra, rb;
  if (!prepare(a, b, &ra, &rb)) return;
  int row = equivalent(ra, rb);
  printf("%-22s vs %-22s ", a, b);
  if (row < 0) { printf("等價\n"); return; }
  printf("不等價，反例：");
  for (int v = 0; v < 4; v++) if (pos[v] >= 0)
    printf("%c=%c ", 'p' + v, (row >> (nvar - 1 - pos[v])) & 1 ? 'T' : 'F');
  printf("（左 %c、右 %c）\n", eval(ra, row) ? 'T' : 'F', eval(rb, row) ? 'T' : 'F');
}

int countTrue(const char *a) {
  int ra, rb, t = 0;
  if (!prepare(a, NULL, &ra, &rb)) return -1;
  for (int row = (1 << nvar) - 1; row >= 0; row--) t += eval(ra, row);
  return t;
}

int main(void) {
  /* 頁面上的例子 */
  report("p -> q");
  report("(p -> q) & ~q -> ~p");
  report("p & ~p");
  report("p | ~p");
  report("~(p -> q) | p & q");
  report("p -> (q & r)");
  report("p | q & ~r -> s");

  printf("\n=== 等價判斷 ===\n");
  compare("~(p & q)", "~p | ~q");               /* De Morgan */
  compare("~(p | q)", "~p & ~q");
  compare("p -> q", "~p | q");                  /* 蘊含消去 */
  compare("p -> q", "~q -> ~p");                /* 逆否 */
  compare("p -> q", "q -> p");                  /* 逆命題不等價 */
  compare("p -> q", "~p -> ~q");                /* 否命題不等價 */
  compare("q -> p", "~p -> ~q");                /* 逆 ≡ 否 */
  compare("p <-> q", "(p -> q) & (q -> p)");
  compare("p ^ q", "~(p <-> q)");
  compare("p & (q | r)", "p & q | p & r");      /* 分配律 */
  compare("p | q & r", "(p | q) & (p | r)");
  compare("p | p & q", "p");                    /* 吸收律 */
  compare("~(p -> q) | p & q", "p");            /* 化簡例子 */
  compare("(p -> r) & (q -> r)", "p | q -> r");
  compare("(p -> q) | (p -> r)", "p -> q | r");
  compare("p <-> q", "p & q | ~p & ~q");        /* DNF */
  compare("p <-> q", "(~p | q) & (p | ~q)");    /* CNF */

  printf("\n=== 練習題驗算 ===\n");
  report("(p & q) | (p & ~q) | (~p & q)");
  compare("(p & q) | (p & ~q) | (~p & q)", "p | q");
  report("p | q -> r ^ p");
  printf("p | q -> r ^ p 為真的列數：%d\n", countTrue("p | q -> r ^ p"));
  report("(p -> q) & (q -> r) -> (p -> r)");
  compare("p -> (q -> r)", "p & q -> r");
  compare("p -> (q -> r)", "q -> (p -> r)");
  compare("p -> (q -> r)", "(p -> q) -> r");
  compare("p -> (q -> r)", "~p | ~q | r");
  compare("p -> q -> r", "p -> (q -> r)");
  report("(p & (p -> q)) -> q");
  report("p -> p & q");
  report("p & q -> p");
  report("p ^ p");
  report("p -> q | ~q");

  /* 計數題：3 個變數的真值表函數共 2^8 種，f -> (p & q) 恆真的 f 有幾個 */
  int cnt = 0, contingent = 0;
  for (int f = 0; f < 256; f++) {
    int ok = 1;
    if (f != 0 && f != 255) contingent++;
    for (int row = 0; row < 8; row++) {
      int fp = (f >> row) & 1, pq = ((row >> 2) & 1) && ((row >> 1) & 1);
      if (fp && !pq) ok = 0;                    /* f 真但 p & q 假：蘊含為假 */
    }
    cnt += ok;
  }
  printf("3 變數：可滿足但非恆真的函數 %d 個；使 f -> (p & q) 恆真的 f 有 %d 個\n", contingent, cnt);

  /* 錯誤輸入 */
  printf("\n=== 錯誤輸入 ===\n");
  report("p & ");
  report("(p | q");
  report("p | q)");
  report("p + q");
  report("p q");
  return 0;
}
