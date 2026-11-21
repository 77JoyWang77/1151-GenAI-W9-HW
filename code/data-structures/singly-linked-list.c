/* Singly Linked List（單向鏈結串列）完整程式：只用來編譯驗證，頁面上的片段都從這裡取出 */
#include <stdio.h>
#include <stdlib.h>

/* ---------- 節點結構 ---------- */
typedef struct node *listPointer;
typedef struct node {
  int data;
  listPointer link;                            /* 指向下一個節點，最後一個是 NULL */
} node;

listPointer newNode(int x) {
  listPointer p = malloc(sizeof(node));
  if (p == NULL) { printf("Memory Full\n"); exit(1); }
  p->data = x;
  p->link = NULL;
  return p;
}

/* ---------- 走訪：印出、長度、搜尋 ---------- */
void printList(listPointer first) {
  for (listPointer p = first; p != NULL; p = p->link)
    printf("%d -> ", p->data);
  printf("NULL\n");
}

int length(listPointer first) {
  int count = 0;
  for (listPointer p = first; p != NULL; p = p->link)
    count++;
  return count;
}

listPointer search(listPointer first, int x) {
  listPointer p = first;
  while (p != NULL && p->data != x)            /* 一個一個往後找 */
    p = p->link;
  return p;                                    /* 找不到時 p 是 NULL */
}

/* ---------- 插入 ---------- */
void insertFront(listPointer *first, int x) {
  listPointer p = newNode(x);
  p->link = *first;                            /* 新節點先指向原本的第一個 */
  *first = p;                                  /* 再讓 first 指向新節點 */
}

void insertAfter(listPointer prev, int x) {
  listPointer p = newNode(x);
  p->link = prev->link;                        /* 先接後面 */
  prev->link = p;                              /* 再接前面 */
}

void insertSorted(listPointer *first, int x) {
  listPointer prev = NULL, cur = *first;
  while (cur != NULL && cur->data < x) {       /* 找第一個 >= x 的節點 */
    prev = cur;
    cur = cur->link;
  }
  if (prev == NULL) insertFront(first, x);     /* 插在最前面要改 first */
  else insertAfter(prev, x);
}

/* ---------- 刪除 ---------- */
int deleteValue(listPointer *first, int x) {
  listPointer prev = NULL, cur = *first;
  while (cur != NULL && cur->data != x) {      /* 找要刪的節點，順便記住前一個 */
    prev = cur;
    cur = cur->link;
  }
  if (cur == NULL) return 0;                   /* 找不到 */
  if (prev == NULL) *first = cur->link;        /* 刪第一個：first 往後移 */
  else prev->link = cur->link;                 /* 前一個直接跳過 cur */
  free(cur);
  return 1;
}

/* ---------- 反轉：三個指標 ---------- */
listPointer reverse(listPointer first) {
  listPointer prev = NULL, cur = first, next;
  while (cur != NULL) {
    next = cur->link;                          /* 先記住下一個，不然會斷掉 */
    cur->link = prev;                          /* 箭頭反過來指向前一個 */
    prev = cur;                                /* 三個指標一起往後移 */
    cur = next;
  }
  return prev;                                 /* prev 停在原本的最後一個 */
}

/* ---------- 其他常考操作 ---------- */
listPointer middle(listPointer first) {
  listPointer slow = first, fast = first;
  while (fast != NULL && fast->link != NULL) { /* fast 一次走兩步 */
    slow = slow->link;
    fast = fast->link->link;
  }
  return slow;                                 /* 偶數個時回傳後半的第一個 */
}

listPointer concatenate(listPointer a, listPointer b) {
  if (a == NULL) return b;
  listPointer p = a;
  while (p->link != NULL) p = p->link;         /* 走到 a 的最後一個 */
  p->link = b;
  return a;
}

void freeList(listPointer first) {
  while (first != NULL) {
    listPointer next = first->link;            /* free 之前先記住下一個 */
    free(first);
    first = next;
  }
}

/* ---------- 帶 dummy head 的寫法 ---------- */
void insertSortedDummy(listPointer head, int x) {
  listPointer prev = head;                     /* head 是不存資料的 dummy */
  while (prev->link != NULL && prev->link->data < x)
    prev = prev->link;
  insertAfter(prev, x);                        /* 不需要特別處理最前面 */
}

/* ---------- 測試 ---------- */
int main(void) {
  listPointer first = NULL;
  int vals[] = {30, 10, 50, 20, 40};
  for (int i = 0; i < 5; i++) insertSorted(&first, vals[i]);
  printList(first);                            /* 10 20 30 40 50 */
  printf("length = %d, middle = %d\n", length(first), middle(first)->data);
  printf("search 40: %s, search 35: %s\n", search(first, 40) ? "found" : "none",
         search(first, 35) ? "found" : "none");

  insertFront(&first, 5);
  insertAfter(search(first, 30), 35);
  printList(first);                            /* 5 10 20 30 35 40 50 */

  deleteValue(&first, 5);                      /* 刪第一個 */
  deleteValue(&first, 35);                     /* 刪中間 */
  deleteValue(&first, 50);                     /* 刪最後一個 */
  printf("delete 99 -> %d\n", deleteValue(&first, 99));
  printList(first);                            /* 10 20 30 40 */

  first = reverse(first);
  printList(first);                            /* 40 30 20 10 */
  printf("middle of 4 = %d\n", middle(first)->data);

  listPointer second = NULL;
  insertFront(&second, 70);
  insertFront(&second, 60);
  first = concatenate(first, second);
  printList(first);                            /* 40 30 20 10 60 70 */
  freeList(first);

  listPointer head = newNode(0);               /* dummy head */
  for (int i = 0; i < 5; i++) insertSortedDummy(head, vals[i]);
  printList(head->link);                       /* 10 20 30 40 50 */
  freeList(head);

  listPointer empty = NULL;
  printf("reverse(NULL) = %p, length = %d\n", (void *)reverse(empty), length(empty));
  return 0;
}
