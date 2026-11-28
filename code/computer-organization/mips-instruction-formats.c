/* MIPS Instruction Formats（MIPS 指令格式）
 * 組譯（欄位 → 32 位元機器碼）、解碼（機器碼 → 欄位）、
 * 立即值的符號延伸 / 零延伸、branch 與 jump 目標位址、lui + ori 載入 32 位元常數。
 * 編譯：gcc -std=c99 -Wall -Wextra -fsanitize=address,undefined mips-instruction-formats.c
 */
#include <stdio.h>
#include <stdint.h>
#include <string.h>

/* ---------- 指令表：名稱、格式、opcode、funct ---------- */
typedef enum { FMT_R, FMT_I, FMT_J } Format;

typedef struct {
  const char *name;
  Format fmt;
  int op;       /* 31:26 */
  int funct;    /* 5:0，只有 R-type 用到 */
} OpInfo;

static const OpInfo OPS[] = {
  {"add", FMT_R, 0, 0x20}, {"sub", FMT_R, 0, 0x22}, {"and", FMT_R, 0, 0x24},
  {"or",  FMT_R, 0, 0x25}, {"slt", FMT_R, 0, 0x2A}, {"sll", FMT_R, 0, 0x00},
  {"srl", FMT_R, 0, 0x02}, {"jr",  FMT_R, 0, 0x08},
  {"beq", FMT_I, 4, 0},    {"bne", FMT_I, 5, 0},    {"addi", FMT_I, 8, 0},
  {"slti", FMT_I, 10, 0},  {"andi", FMT_I, 12, 0},  {"ori", FMT_I, 13, 0},
  {"lui", FMT_I, 15, 0},   {"lw",  FMT_I, 35, 0},   {"sw",  FMT_I, 43, 0},
  {"j",   FMT_J, 2, 0},    {"jal", FMT_J, 3, 0},
};
#define NOPS ((int)(sizeof OPS / sizeof OPS[0]))

const OpInfo *findOp(const char *name) {
  for (int i = 0; i < NOPS; i++)
    if (strcmp(OPS[i].name, name) == 0) return &OPS[i];
  return NULL;
}

/* ---------- 組譯：把各欄位移到自己的位置再 OR 起來 ---------- */
uint32_t encodeR(int rs, int rt, int rd, int shamt, int funct) {
  return (0u << 26)                     /* R-type 的 opcode 一律是 0 */
       | ((uint32_t)rs << 21) | ((uint32_t)rt << 16)
       | ((uint32_t)rd << 11) | ((uint32_t)shamt << 6)
       | (uint32_t)funct;               /* 真正的運算由 funct 決定 */
}

uint32_t encodeI(int op, int rs, int rt, int imm) {
  return ((uint32_t)op << 26) | ((uint32_t)rs << 21) | ((uint32_t)rt << 16)
       | ((uint32_t)imm & 0xFFFFu);     /* 負數取低 16 位，就是 2's complement */
}

uint32_t encodeJ(int op, uint32_t target) {
  return ((uint32_t)op << 26)
       | ((target >> 2) & 0x03FFFFFFu); /* 去掉最低 2 位（必為 00）與最高 4 位 */
}

/* ---------- 解碼：右移再遮罩，把每個欄位取出來 ---------- */
typedef struct {
  int op, rs, rt, rd, shamt, funct;
  uint32_t imm;    /* 15:0，尚未延伸 */
  uint32_t addr;   /* 25:0 */
} Fields;

Fields decode(uint32_t x) {
  Fields f;
  f.op    = (int)((x >> 26) & 0x3F);
  f.rs    = (int)((x >> 21) & 0x1F);
  f.rt    = (int)((x >> 16) & 0x1F);
  f.rd    = (int)((x >> 11) & 0x1F);
  f.shamt = (int)((x >> 6) & 0x1F);
  f.funct = (int)(x & 0x3F);
  f.imm   = x & 0xFFFFu;
  f.addr  = x & 0x03FFFFFFu;
  return f;
}

Format formatOf(int op) {
  if (op == 0) return FMT_R;              /* opcode 0：看 funct */
  if (op == 2 || op == 3) return FMT_J;   /* j、jal */
  return FMT_I;                           /* 其他都是 I-type */
}

/* ---------- 立即值延伸成 32 位元 ---------- */
int32_t signExt16(uint32_t imm) {        /* addi、slti、lw、sw、beq、bne */
  int32_t v = (int32_t)(imm & 0xFFFFu);
  return v >= 0x8000 ? v - 0x10000 : v;  /* 最高位是 1 → 負數，高 16 位補 1 */
}

uint32_t zeroExt16(uint32_t imm) {       /* andi、ori：高 16 位補 0 */
  return imm & 0xFFFFu;
}

/* ---------- branch：PC-relative，以「下一條指令」為基準、單位是 word ---------- */
uint32_t branchTarget(uint32_t pc, uint32_t imm) {
  return pc + 4 + (uint32_t)signExt16(imm) * 4u;
}

int branchOffset(uint32_t pc, uint32_t target, int *off) {
  int64_t diff = (int64_t)target - ((int64_t)pc + 4);
  if (diff % 4 != 0) return 0;                     /* 目標沒有對齊 4 */
  int64_t words = diff / 4;
  if (words < -32768 || words > 32767) return 0;   /* 16 位元放不下：超出 ±2^15 words */
  *off = (int)words;
  return 1;
}

/* ---------- jump：pseudodirect，高 4 位沿用 PC+4 ---------- */
uint32_t jumpTarget(uint32_t pc, uint32_t addr26) {
  return ((pc + 4) & 0xF0000000u) | (addr26 << 2);
}

int canJump(uint32_t pc, uint32_t target) {
  return target % 4 == 0 &&
         ((pc + 4) & 0xF0000000u) == (target & 0xF0000000u);  /* 同一個 256MB 區塊 */
}

/* ---------- 32 位元常數：lui 放高 16 位，ori / addi 補低 16 位 ---------- */
void splitOri(uint32_t c, uint32_t *hi, uint32_t *lo) {
  *hi = c >> 16;          /* lui $t, hi  → $t = hi << 16 */
  *lo = c & 0xFFFFu;      /* ori $t, $t, lo：零延伸，直接填進低 16 位 */
}

void splitAddi(uint32_t c, uint32_t *hi, uint32_t *lo) {
  *lo = c & 0xFFFFu;                    /* addi 會把 lo 符號延伸 */
  *hi = ((c + 0x8000u) >> 16) & 0xFFFFu; /* lo ≥ 0x8000 時等於減了 0x10000，hi 先加 1 補回來 */
}

/* ====================== 測試（含考古題的數字） ====================== */
static int fails = 0;
static void expect(const char *what, uint32_t got, uint32_t want) {
  printf("%-38s 0x%08X %s\n", what, (unsigned)got, got == want ? "OK" : "FAIL");
  if (got != want) fails++;
}

int main(void) {
  int off = 0;
  uint32_t hi, lo;

  /* R-type：and $4, $6, $8；sll $t2, $s0, 4 */
  expect("and $4,$6,$8", encodeR(6, 8, 4, 0, findOp("and")->funct), 0x00C82024u);
  expect("add $t0,$s1,$s2", encodeR(17, 18, 8, 0, 0x20), 0x02324020u);
  expect("sll $t2,$s0,4", encodeR(0, 16, 10, 4, 0x00), 0x00105100u);
  expect("jr $ra", encodeR(31, 0, 0, 0, 0x08), 0x03E00008u);

  /* I-type：sw $5, -7($9)；lw $t0, -8($sp) */
  expect("sw $5,-7($9)", encodeI(43, 9, 5, -7), 0xAD25FFF9u);
  expect("lw $t0,-8($sp)", encodeI(35, 29, 8, -8), 0x8FA8FFF8u);

  /* branch：程式從 0x88004000 開始，beq 在 0x88004004，跳到 0x88004014 */
  if (branchOffset(0x88004004u, 0x88004014u, &off))
    expect("beq $s2,$zero,finish", encodeI(4, 18, 0, off), 0x12400003u);
  expect("beq target", branchTarget(0x88004004u, 3), 0x88004014u);
  /* beq $t0,$0,L1：往後跳過 2 條指令 */
  expect("beq $t0,$0,+2", encodeI(4, 8, 0, 2), 0x11000002u);
  /* 往回跳：bne $t0,$s1,-5 在 0x00400020 */
  expect("bne back target", branchTarget(0x00400020u, 0xFFFBu), 0x00400010u);
  expect("far branch rejected", (uint32_t)branchOffset(0x00400000u, 0x00440000u, &off), 0);

  /* jump：j loop 在 0x88004010，loop = 0x88004004 */
  expect("j loop", encodeJ(2, 0x88004004u), 0x0A001001u);
  expect("j target", jumpTarget(0x88004010u, 0x2001001u), 0x88004004u);
  expect("max j target from 0xAB05FF84", jumpTarget(0xAB05FF84u, 0x03FFFFFFu), 0xAFFFFFFCu);
  expect("j across 256MB rejected", (uint32_t)canJump(0x0FFFFFFCu, 0x0FFFFFF0u), 0);

  /* decode */
  Fields f = decode(0x1511FFFBu);
  expect("decode op", (uint32_t)f.op, 5);
  expect("decode rs", (uint32_t)f.rs, 8);
  expect("decode rt", (uint32_t)f.rt, 17);
  expect("decode imm sign-ext", (uint32_t)signExt16(f.imm), 0xFFFFFFFBu);
  expect("zero-ext 0xFFFB", zeroExt16(f.imm), 0x0000FFFBu);
  expect("format of 0x23", (uint32_t)formatOf(0x23), FMT_I);

  /* 32 位元常數 */
  splitOri(0x0120001Au, &hi, &lo);
  expect("lui/ori hi", hi, 288);
  expect("lui/ori lo", lo, 26);
  splitAddi(0x1234ABCDu, &hi, &lo);
  expect("lui/addi hi", hi, 0x1235u);
  expect("lui/addi rebuild", (hi << 16) + (uint32_t)signExt16(lo), 0x1234ABCDu);

  printf(fails ? "%d FAILED\n" : "all passed\n", fails);
  return fails != 0;
}
