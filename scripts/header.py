"""全站統一頁首（CLAUDE.md 6.6）：每一頁都一模一樣，只有相對路徑 root 不同。
連結固定是：科目、每個進行中科目的名稱；只有一個進行中科目時再加「題庫」直達它的題庫頁。
check.py 用它比對每一頁的 <header>。"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def active_subjects():
    data = json.loads((ROOT / "data" / "subjects.json").read_text(encoding="utf-8"))
    return [(s["id"], s["zh"]) for s in data["subjects"] if s["status"] == "active"]


def site_header(root, active=None):
    """root：到網站根目錄的相對路徑（"" / "../../" / "../../../"）"""
    active = active_subjects() if active is None else active
    links = [f'        <a href="{root}index.html#subjects">科目</a>']
    links += [f'        <a href="{root}subjects/{sid}/index.html">{zh}</a>' for sid, zh in active]
    if len(active) == 1:
        links.append(f'        <a href="{root}subjects/{active[0][0]}/questions.html">題庫</a>')
    return "\n".join([
        '  <header class="site-header">',
        '    <div class="wrap">',
        f'      <a class="brand" href="{root}index.html"><span class="logo">CS</span><span class="brand-name">資工考研互動學習站</span></a>',
        '      <nav class="nav-links">',
        *links,
        '        <button class="theme-toggle" type="button" data-theme-toggle>深色</button>',
        '      </nav>',
        '    </div>',
        '  </header>',
    ])


if __name__ == "__main__":
    # 重新產生所有頁面與模板的頁首：python scripts/header.py
    import re
    pat = re.compile(r"  <header class=\"site-header\">.*?</header>", re.S)
    pages = [ROOT / "index.html", *ROOT.glob("subjects/**/*.html"), *ROOT.glob("templates/*.html")]
    for f in pages:
        s = f.read_text(encoding="utf-8")
        r = re.search(r'data-root="([^"]*)"', s).group(1)
        f.write_text(pat.sub(lambda m: site_header(r), s, count=1), encoding="utf-8")
    print(f"已更新 {len(pages)} 個檔案的頁首")
