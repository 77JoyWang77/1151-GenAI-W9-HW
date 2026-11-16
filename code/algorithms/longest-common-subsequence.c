/* Longest Common Subsequence（最長共同子序列）完整程式
   編譯：gcc -std=c99 -Wall -Wextra -fsanitize=address,undefined longest-common-subsequence.c */
#include <stdio.h>
#include <string.h>

#define MAX 32

int c[MAX + 1][MAX + 1];      /* c[i][j]：X 前 i 個字元與 Y 前 j 個字元的 LCS 長度 */
char b[MAX + 1][MAX + 1];     /* b[i][j]：c[i][j] 是從哪裡來的：'D' 左上、'U' 上、'L' 左 */
long calls;                   /* 計算遞迴呼叫次數 */

/* 由下而上填表：一列一列、由左到右 */
int lcsLength(const char *X, const char *Y) {
  int m = strlen(X), n = strlen(Y);
  for (int i = 0; i <= m; i++) c[i][0] = 0;   /* 空字串和任何字串的 LCS 長度都是 0 */
  for (int j = 0; j <= n; j++) c[0][j] = 0;
  for (int i = 1; i <= m; i++)
    for (int j = 1; j <= n; j++) {
      if (X[i - 1] == Y[j - 1]) {              /* 最後一個字元相同：一定可以接在 LCS 後面 */
        c[i][j] = c[i - 1][j - 1] + 1;
        b[i][j] = 'D';
      } else if (c[i - 1][j] >= c[i][j - 1]) { /* 不同：丟掉 X 的最後一個字元比較好（平手往上） */
        c[i][j] = c[i - 1][j];
        b[i][j] = 'U';
      } else {                                 /* 丟掉 Y 的最後一個字元比較好 */
        c[i][j] = c[i][j - 1];
        b[i][j] = 'L';
      }
    }
  return c[m][n];
}

/* 平手時改成往左：表格的數字完全一樣，只有箭頭不同，找出來的 LCS 可能不同 */
int lcsLengthLeft(const char *X, const char *Y) {
  int m = strlen(X), n = strlen(Y);
  for (int i = 0; i <= m; i++) c[i][0] = 0;
  for (int j = 0; j <= n; j++) c[0][j] = 0;
  for (int i = 1; i <= m; i++)
    for (int j = 1; j <= n; j++) {
      if (X[i - 1] == Y[j - 1]) {
        c[i][j] = c[i - 1][j - 1] + 1;
        b[i][j] = 'D';
      } else if (c[i][j - 1] >= c[i - 1][j]) { /* 平手往左 */
        c[i][j] = c[i][j - 1];
        b[i][j] = 'L';
      } else {
        c[i][j] = c[i - 1][j];
        b[i][j] = 'U';
      }
    }
  return c[m][n];
}

/* 從 b[i][j] 倒著走回去，遞迴到底再印，所以順序是正的 */
void printLCS(const char *X, int i, int j) {
  if (i == 0 || j == 0) return;
  if (b[i][j] == 'D') {
    printLCS(X, i - 1, j - 1);
    putchar(X[i - 1]);
  } else if (b[i][j] == 'U') {
    printLCS(X, i - 1, j);
  } else {
    printLCS(X, i, j - 1);
  }
}

/* 直接照遞迴式寫：同一個子問題會被算很多次 */
int lcsNaive(const char *X, const char *Y, int i, int j) {
  calls++;
  if (i == 0 || j == 0) return 0;
  if (X[i - 1] == Y[j - 1]) return lcsNaive(X, Y, i - 1, j - 1) + 1;
  int up = lcsNaive(X, Y, i - 1, j), left = lcsNaive(X, Y, i, j - 1);
  return up >= left ? up : left;
}

/* 由上而下 + 記憶：memo[i][j] = -1 表示還沒算過 */
int memo[MAX + 1][MAX + 1];
int lcsMemo(const char *X, const char *Y, int i, int j) {
  calls++;
  if (i == 0 || j == 0) return 0;
  if (memo[i][j] != -1) return memo[i][j];     /* 算過了，直接查表 */
  int r;
  if (X[i - 1] == Y[j - 1]) r = lcsMemo(X, Y, i - 1, j - 1) + 1;
  else {
    int up = lcsMemo(X, Y, i - 1, j), left = lcsMemo(X, Y, i, j - 1);
    r = up >= left ? up : left;
  }
  return memo[i][j] = r;
}

/* 只要長度時，只留兩列：空間從 O(mn) 降到 O(n) */
int lcsTwoRows(const char *X, const char *Y) {
  int m = strlen(X), n = strlen(Y);
  int prev[MAX + 1] = {0}, cur[MAX + 1] = {0};
  for (int i = 1; i <= m; i++) {
    for (int j = 1; j <= n; j++) {
      if (X[i - 1] == Y[j - 1]) cur[j] = prev[j - 1] + 1;
      else cur[j] = prev[j] >= cur[j - 1] ? prev[j] : cur[j - 1];
    }
    memcpy(prev, cur, sizeof prev);             /* 這一列變成下一輪的「上一列」 */
  }
  return prev[n];
}

void run(const char *X, const char *Y) {
  int m = strlen(X), n = strlen(Y);
  int len = lcsLength(X, Y);
  printf("X = %s, Y = %s\nLCS 長度 = %d，LCS = ", X, Y, len);
  printLCS(X, m, n);
  printf("（平手往左：");
  lcsLengthLeft(X, Y);
  printLCS(X, m, n);
  printf("）\n");
  lcsLength(X, Y);
  calls = 0;
  lcsNaive(X, Y, m, n);
  long naive = calls;
  memset(memo, -1, sizeof memo);
  calls = 0;
  int lm = lcsMemo(X, Y, m, n);
  printf("單純遞迴呼叫 %ld 次，記憶化呼叫 %ld 次，兩列版長度 %d，記憶化長度 %d\n",
         naive, calls, lcsTwoRows(X, Y), lm);
  printf("    ");
  for (int j = 0; j < n; j++) printf(" %c", Y[j]);
  printf("\n");
  for (int i = 0; i <= m; i++) {
    printf("%c ", i ? X[i - 1] : ' ');
    for (int j = 0; j <= n; j++) printf("%d ", c[i][j]);
    printf("\n");
  }
  printf("\n");
}

int main(void) {
  run("STONE", "LONGEST");
  run("ABAB", "BABA");
  run("AABBC", "ABCBA");
  run("ACGTAC", "CATGCA");
  run("ABCDEFGHIJ", "BADCFEHGJI");
  return 0;
}
