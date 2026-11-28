/* I/O Systems：polling、interrupt、DMA 的模擬與 CPU 負擔計算
   編譯：gcc -std=c99 -Wall -Wextra -fsanitize=address,undefined io-systems.c */
#include <stdio.h>

/* ===================== 一、CPU 負擔計算 ===================== */
/* rate：裝置傳輸率（byte/s）　unit：每次 poll／中斷搬的 byte 數
   clock：CPU 時脈（Hz）　active：裝置真的在傳資料的時間比例（0～1） */
double pollingLoad(double rate, double unit, double cPoll, double clock) {
  double polls = rate / unit;              /* 要跟上裝置，每秒至少查這麼多次 */
  return polls * cPoll / clock;            /* 裝置閒著也得照查，和 active 無關 */
}

double interruptLoad(double rate, double unit, double cInt, double clock, double active) {
  double ints = rate / unit * active;      /* 只有裝置真的在傳時才會中斷 */
  return ints * cInt / clock;
}

double dmaLoad(double rate, double block, double cDma, double clock, double active) {
  double blocks = rate / block * active;   /* 每搬完一整塊才中斷一次 */
  return blocks * cDma / clock;            /* cDma = 設定 DMA + 完成中斷的週期數 */
}

/* ===================== 二、裝置控制器（模擬） ===================== */
enum { IDLE, BUSY, READY };
#define CMD_READ 1

typedef struct {
  int status;        /* status register：IDLE／BUSY／READY */
  int control;       /* control register：driver 寫入命令 */
  int dataIn;        /* data-in register：裝置要給主機的資料 */
  int delay;         /* 模擬用：還要幾個時間單位資料才準備好 */
  int next;          /* 模擬用：裝置下一筆資料的值 */
} Controller;

Controller dev;
int ioDelay = 3;     /* 裝置每準備一筆資料要幾個時間單位 */

void issueRead(Controller *c, int delay) {   /* driver 寫 control register 下命令 */
  c->control = CMD_READ;
  c->status = BUSY;
  c->delay = delay;
}

/* 時間前進一個單位；資料剛準備好時回傳 1 */
int deviceTick(Controller *c) {
  if (c->status != BUSY) return 0;
  if (--c->delay > 0) return 0;
  c->dataIn = c->next++;
  c->status = READY;
  return 1;
}

/* ===================== 三、Polling（programmed I/O） ===================== */
/* CPU 自己等、自己搬：回傳花在空轉檢查的次數 */
int pollingRead(Controller *c, int *buf, int n, int delay) {
  int polls = 0;
  for (int i = 0; i < n; i++) {
    issueRead(c, delay);                 /* 1. 寫 control register 下命令 */
    while (c->status != READY) {         /* 2. busy-wait：反覆讀 status register */
      polls++;
      deviceTick(c);
    }
    buf[i] = c->dataIn;                  /* 3. CPU 讀 data-in，自己寫進記憶體 */
    c->status = IDLE;                    /* 4. 清掉 ready，準備下一筆 */
  }
  return polls;
}

/* ===================== 四、Interrupt-driven I/O ===================== */
typedef void (*Handler)(void);
#define NVEC 8
#define IRQ_DEV 3
#define IRQ_DMA 5
Handler vector[NVEC];                    /* interrupt vector table：中斷編號 → 處理常式 */
int irqLine = -1;                        /* interrupt-request line：-1 表示沒有中斷 */
int useDMA = 0;                          /* 裝置的資料交給 DMA 還是發中斷給 CPU */
int *ioBuf, ioWant, ioPos, ioDone;
int otherWork, interrupts;               /* 等 I/O 時 CPU 做的其他工作、中斷次數 */
int dmaCycle(void);

void devISR(void) {                      /* 裝置的 interrupt service routine */
  ioBuf[ioPos++] = dev.dataIn;           /* 一次中斷搬一筆 */
  dev.status = IDLE;                     /* 回應裝置，清掉中斷原因 */
  if (ioPos < ioWant) issueRead(&dev, ioDelay);   /* 還沒讀完：下一筆的命令 */
  else ioDone = 1;                       /* 讀完：喚醒等待的 process */
}

void cpuRun(void) {                      /* CPU 的主迴圈（模擬） */
  while (!ioDone) {
    otherWork++;                         /* 執行其他 process 的一條指令 */
    if (deviceTick(&dev) && !useDMA) irqLine = IRQ_DEV;
    if (useDMA && dmaCycle()) irqLine = IRQ_DMA;
    if (irqLine >= 0) {                  /* 每條指令結束時檢查 interrupt-request line */
      int irq = irqLine;
      irqLine = -1;
      interrupts++;                      /* 硬體：保存 PC 與狀態、切到 kernel mode */
      vector[irq]();                     /* 查向量表，跳到對應的 handler */
    }                                    /* handler 返回：恢復狀態，回到被中斷的程式 */
  }
}

int interruptRead(int *buf, int n, int delay) {
  ioBuf = buf; ioWant = n; ioPos = 0; ioDone = 0; ioDelay = delay;
  otherWork = 0; interrupts = 0; useDMA = 0;
  vector[IRQ_DEV] = devISR;
  issueRead(&dev, delay);                /* 下完第一筆命令就去做別的事 */
  cpuRun();
  return otherWork;
}

/* ===================== 五、DMA ===================== */
typedef struct {
  int *dst;          /* 目的記憶體位址 */
  int count;         /* 還剩幾筆 */
  int busy;
} DMAController;
DMAController dma;
int stolen;          /* DMA 用掉的 bus cycle 數（cycle stealing） */

void dmaISR(void) { ioDone = 1; }        /* 整塊只中斷這一次 */

void dmaStart(int *dst, int n) {         /* driver 寫 DMA 的位址、長度暫存器 */
  dma.dst = dst;
  dma.count = n;
  dma.busy = 1;
  issueRead(&dev, ioDelay);              /* 之後 CPU 就不管了 */
}

/* 裝置有資料（DMA-request）時，DMA 搶一個 bus cycle 寫進記憶體；整塊搬完回傳 1 */
int dmaCycle(void) {
  if (!dma.busy || dev.status != READY) return 0;
  *dma.dst++ = dev.dataIn;               /* 直接寫記憶體，不經過 CPU */
  stolen++;                              /* 這個 bus cycle CPU 用不到 */
  dev.status = IDLE;                     /* DMA-acknowledge：裝置準備下一筆 */
  if (--dma.count > 0) { issueRead(&dev, ioDelay); return 0; }
  dma.busy = 0;
  return 1;                              /* 整塊搬完：發中斷 */
}

int dmaRead(int *buf, int n, int delay) {
  ioDone = 0; ioDelay = delay; otherWork = 0; interrupts = 0; stolen = 0; useDMA = 1;
  vector[IRQ_DMA] = dmaISR;
  dmaStart(buf, n);
  cpuRun();
  return otherWork;
}

/* ===================== 六、double buffering 的時間 ===================== */
/* 裝置填滿一個 buffer 要 tFill，CPU 處理一個 buffer 要 tProc，共 n 個 block */
double singleBuffer(int n, double tFill, double tProc) {
  return n * (tFill + tProc);            /* 只有一個 buffer：裝置和 CPU 輪流等對方 */
}

double doubleBuffer(int n, double tFill, double tProc) {
  double slow = tFill > tProc ? tFill : tProc;
  return tFill + (n - 1) * slow + tProc; /* 兩個 buffer 輪流用：填下一塊與處理這一塊重疊 */
}

int main(void) {
  int buf[8];

  /* 頁面上的例子：硬碟 8 MB/s、每次 16 B、1 GHz、poll 300、中斷 600、DMA 8 KB 塊 3000 週期 */
  double rate = 8e6, clock = 1e9;
  printf("polling      : %.4f%%\n", 100 * pollingLoad(rate, 16, 300, clock));
  printf("interrupt 100%%: %.4f%%\n", 100 * interruptLoad(rate, 16, 600, clock, 1.0));
  printf("interrupt 20%% : %.4f%%\n", 100 * interruptLoad(rate, 16, 600, clock, 0.2));
  printf("DMA 8KB      : %.4f%%\n", 100 * dmaLoad(rate, 8000, 3000, clock, 1.0));
  printf("mouse polling: %.6f%%\n", 100 * pollingLoad(120, 4, 300, clock));

  dev.next = 10;
  int polls = pollingRead(&dev, buf, 4, 3);
  printf("polling: polls=%d data=%d %d %d %d\n", polls, buf[0], buf[1], buf[2], buf[3]);

  int w = interruptRead(buf, 4, 3);
  printf("interrupt: otherWork=%d interrupts=%d data=%d %d %d %d\n", w, interrupts, buf[0], buf[1], buf[2], buf[3]);

  w = dmaRead(buf, 4, 3);
  printf("DMA: otherWork=%d interrupts=%d stolen=%d data=%d %d %d %d\n", w, interrupts, stolen, buf[0], buf[1], buf[2], buf[3]);

  printf("buffer: single=%.1f double=%.1f\n", singleBuffer(10, 4, 3), doubleBuffer(10, 4, 3));
  return 0;
}
