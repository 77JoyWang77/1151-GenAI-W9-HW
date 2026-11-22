#!/bin/sh
# 把一份考卷 PDF 轉成頁面圖並 OCR（OCR 只用來找題目位置，收錄時一律對照頁面圖逐字確認）
# 用法：EXAM_PAGES=~/exams/img sh scripts/exam/ocr.sh <paper.pdf>
# 需要 pdftoppm（poppler）與 tesseract（eng + chi_tra）
f="$1"; b=$(basename "$f" .pdf)
img="${EXAM_PAGES:-$HOME/exams/img}"; ocr="$(dirname "$img")/ocr"
mkdir -p "$img" "$ocr"
pdftoppm -r 200 -gray -png "$f" "$img/$b"
for p in "$img/$b"-*.png; do
  tesseract "$p" stdout -l eng+chi_tra --psm 6 > "$ocr/$(basename "$p" .png).txt" 2>/dev/null
done
