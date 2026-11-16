"""替所有頁面引用的 CSS / JS 加上版本號 ?v=<雜湊>（CLAUDE.md 4）。

GitHub Pages 會讓瀏覽器把 CSS、JS 暫存約 10 分鐘；如果拿到新的 HTML 卻配上暫存的舊 JS，
頁面就會壞掉。版本號是 assets/ 裡所有 CSS、JS 內容的雜湊，內容一改就變，瀏覽器會改抓新檔。
改過 assets/ 之後、push 之前執行：python scripts/stamp.py（check.py 會檢查有沒有忘記）。"""
import hashlib
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
REF = re.compile(r'((?:src|href)="[^"]*assets/(?:css|js)/[^"?]+\.(?:css|js))(?:\?v=[0-9a-f]+)?"')


def asset_version():
    h = hashlib.sha1()
    for f in sorted([*ROOT.glob("assets/css/*.css"), *ROOT.glob("assets/js/**/*.js")]):
        h.update(f.relative_to(ROOT).as_posix().encode())
        h.update(f.read_bytes())
    return h.hexdigest()[:8]


def pages():
    return [ROOT / "index.html", *ROOT.glob("subjects/**/*.html"), *ROOT.glob("templates/*.html")]


def stale(html, v):
    """回傳沒有正確版本號的引用"""
    return [m.group(0) for m in REF.finditer(html) if not m.group(0).endswith(f'?v={v}"')]


if __name__ == "__main__":
    v = asset_version()
    for f in pages():
        s = f.read_text(encoding="utf-8")
        f.write_text(REF.sub(lambda m: f'{m.group(1)}?v={v}"', s), encoding="utf-8")
    print(f"版本號 v={v}，已更新 {len(pages())} 個檔案")
