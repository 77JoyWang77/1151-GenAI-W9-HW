/* Hash Functions（雜湊函數）：各種雜湊函數、universal hashing、Bloom filter
   編譯：gcc -std=c99 -Wall -Wextra -fsanitize=address,undefined hash-functions.c -lm */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdint.h>
#include <math.h>

/* ---------- 除法 ---------- */
int hashDiv(int k, int m) {                    /* k ≥ 0，m 最好是不靠近 2 的冪的質數 */
  return k % m;
}

/* ---------- 乘法 ---------- */
int hashMul(int k, int m) {
  const double A = 0.6180339887;               /* (√5 − 1) / 2，常用的 A */
  double t = k * A;
  double frac = t - floor(t);                  /* kA 的小數部分，介於 [0, 1) */
  return (int)(m * frac);                      /* floor(m × 小數部分) */
}

uint32_t hashMulShift(uint32_t k, int p) {     /* m = 2^p，1 ≤ p ≤ 32，字組 w = 32 位元 */
  const uint32_t s = 2654435769u;              /* s = floor(A × 2^32) */
  uint32_t r0 = k * s;                         /* 乘積只留低 32 位元（自動 mod 2^32） */
  return r0 >> (32 - p);                       /* 取 r0 最高的 p 個位元 */
}

/* ---------- 平方取中 ---------- */
int numDigits(long long x) {
  int d = 1;
  while (x >= 10) { x /= 10; d++; }
  return d;
}

int hashMidSquare(long long k, int r) {        /* 取 k² 中間的 r 位（十進位），k ≤ 999999 */
  long long sq = k * k, pw = 1;
  int drop = (numDigits(sq) - r) / 2;          /* 右邊丟掉幾位；剩下奇數位時左邊多丟一位 */
  for (int i = 0; i < drop; i++) sq /= 10;
  for (int i = 0; i < r; i++) pw *= 10;
  return (int)(sq % pw);                       /* 再留下最右邊 r 位 */
}

/* ---------- 折疊 ---------- */
int part(const char *s, int from, int r, int rev) {  /* 從 s[from] 起讀 r 位數字，rev = 1 時倒著讀 */
  int n = (int)strlen(s), end = from + r < n ? from + r : n, v = 0;
  for (int i = 0; i < end - from; i++)
    v = v * 10 + (s[rev ? end - 1 - i : from + i] - '0');
  return v;
}

int foldShift(const char *key, int r) {        /* 每 r 位切一段，直接相加 */
  int n = (int)strlen(key), sum = 0;
  for (int i = 0; i < n; i += r) sum += part(key, i, r, 0);
  return sum;
}

int foldBoundary(const char *key, int r) {     /* 第 2、4、6… 段反轉後再相加 */
  int n = (int)strlen(key), sum = 0;
  for (int i = 0, j = 0; i < n; i += r, j++) sum += part(key, i, r, j % 2 == 1);
  return sum;
}

/* ---------- 字串 ---------- */
int hashStrSum(const char *s, int m) {         /* 只把字元碼加總：換位字一定撞 */
  int sum = 0;
  for (int i = 0; s[i] != '\0'; i++) sum += (unsigned char)s[i];
  return sum % m;
}

int hashStr(const char *s, int m) {            /* 多項式雜湊，用 Horner 法計算 */
  const long long B = 31;                      /* 基底 */
  long long h = 0;
  for (int i = 0; s[i] != '\0'; i++)
    h = (h * B + (unsigned char)s[i]) % m;     /* 每一步都 mod m，數字不會溢位 */
  return (int)h;
}

/* ---------- universal hashing ---------- */
#define P 1000003LL                            /* 質數，比所有可能的 key 都大 */

int hashUniv(long long a, long long b, long long k, int m) {  /* 1 ≤ a < P，0 ≤ b < P */
  return (int)(((a * k + b) % P) % m);
}

/* ---------- Bloom filter ---------- */
#define MAXBITS 32
int BM = 16;                                   /* bit array 的大小 m */
int BK = 3;                                    /* 雜湊函數的個數 k */
unsigned char bits[MAXBITS];

int bloomPos(int x, int i) {                   /* 第 i 個雜湊函數（i = 0…k−1） */
  return (x % BM + i * (1 + x % (BM - 1))) % BM;
}

void bloomInsert(int x) {
  for (int i = 0; i < BK; i++) bits[bloomPos(x, i)] = 1;
}

int bloomQuery(int x) {                        /* 0：一定不在；1：可能在 */
  for (int i = 0; i < BK; i++)
    if (bits[bloomPos(x, i)] == 0) return 0;   /* 有一個 bit 是 0 就一定沒插入過 */
  return 1;                                    /* 全部是 1：可能在，也可能是 false positive */
}

/* ---------- 測試 ---------- */
static int fails = 0;
static void expect(const char *what, long long got, long long want) {
  if (got != want) { printf("FAIL %s: got %lld want %lld\n", what, got, want); fails++; }
}

int main(void) {
  /* 除法 */
  expect("div 2024 % 13", hashDiv(2024, 13), 2024 % 13);
  /* m = 12 與 m = 13：4 的倍數 */
  int used12 = 0, used13 = 0, seen12[12] = {0}, seen13[13] = {0};
  for (int k = 0; k < 48; k += 4) { seen12[hashDiv(k, 12)] = 1; seen13[hashDiv(k, 13)] = 1; }
  for (int i = 0; i < 12; i++) used12 += seen12[i];
  for (int i = 0; i < 13; i++) used13 += seen13[i];
  printf("multiples of 4 (0..44): m=12 uses %d slots, m=13 uses %d slots\n", used12, used13);

  /* 乘法 */
  printf("hashMul(2024, 16) = %d\n", hashMul(2024, 16));
  printf("hashMulShift(2024, 4) = %u\n", hashMulShift(2024, 4));
  int agree = 0;
  for (int k = 0; k < 10000; k++) agree += hashMul(k, 16) == (int)hashMulShift((uint32_t)k, 4);
  printf("float vs shift agree on %d / 10000 keys (m = 16)\n", agree);

  /* 平方取中 */
  expect("mid 1234 r3", hashMidSquare(1234, 3), 227);
  printf("hashMidSquare(4321, 3) = %d\n", hashMidSquare(4321, 3));

  /* 折疊 */
  printf("foldShift(25361482917, 3) = %d\n", foldShift("25361482917", 3));
  printf("foldBoundary(25361482917, 3) = %d\n", foldBoundary("25361482917", 3));
  expect("shift", foldShift("25361482917", 3), 253 + 614 + 829 + 17);
  expect("boundary", foldBoundary("25361482917", 3), 253 + 416 + 829 + 71);

  /* 字串 */
  printf("sum: cat=%d act=%d tac=%d (m=97)\n", hashStrSum("cat", 97), hashStrSum("act", 97), hashStrSum("tac", 97));
  printf("horner: cat=%d act=%d tac=%d (m=97)\n", hashStr("cat", 97), hashStr("act", 97), hashStr("tac", 97));
  printf("horner: cat=%d act=%d tac=%d (m=101)\n", hashStr("cat", 101), hashStr("act", 101), hashStr("tac", 101));

  /* universal：固定兩個 key，換很多組 (a, b) 數碰撞比例 */
  srand(1);
  int col = 0, trials = 200000;
  for (int t = 0; t < trials; t++) {
    long long a = 1 + rand() % (P - 1), b = rand() % P;
    col += hashUniv(a, b, 17, 10) == hashUniv(a, b, 27, 10);
  }
  printf("universal: Pr[h(17) = h(27)] ~ %.4f (bound 1/m = 0.1)\n", (double)col / trials);

  /* Bloom filter */
  memset(bits, 0, sizeof bits);
  int ins[] = {5, 12, 30};
  for (int i = 0; i < 3; i++) bloomInsert(ins[i]);
  printf("bits:");
  for (int i = 0; i < BM; i++) printf(" %d", bits[i]);
  printf("\n");
  for (int x = 0; x < 64; x++)
    if (bloomQuery(x) && x != 5 && x != 12 && x != 30) printf("false positive: %d\n", x);
  expect("no false negative 5", bloomQuery(5), 1);
  double fp = pow(1 - exp(-3.0 * 3 / 16), 3);
  printf("FP approx (k=3,n=3,m=16) = %.4f\n", fp);

  printf(fails ? "%d FAILED\n" : "all tests passed\n", fails);
  return fails != 0;
}
