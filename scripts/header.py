"""全站統一頁首（CLAUDE.md 6.6）：每一頁都一模一樣，只有相對路徑 root 不同。
頁首只放每一頁都適用的東西：logo＋站名、「科目」、「考古題」、亮暗切換。
屬於某個科目的連結（科目首頁、題庫）放在頁面裡（麵包屑、題庫卡片），不放頁首。
check.py 用它比對每一頁的 <header>。"""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def site_header(root):
    """root：到網站根目錄的相對路徑（"" / "../../" / "../../../"）"""
    return "\n".join([
        '  <header class="site-header">',
        '    <div class="wrap">',
        f'      <a class="brand" href="{root}index.html"><span class="logo">CS</span><span class="brand-name">資工考研互動學習站</span></a>',
        '      <nav class="nav-links">',
        f'        <a href="{root}index.html#subjects">科目</a>',
        f'        <a href="{root}exams/index.html">考古題</a>',
        '        <button class="theme-toggle" type="button" data-theme-toggle>深色</button>',
        '      </nav>',
        '    </div>',
        '  </header>',
    ])


if __name__ == "__main__":
    # 重新產生所有頁面與模板的頁首：python scripts/header.py
    import re
    pat = re.compile(r"  <header class=\"site-header\">.*?</header>", re.S)
    pages = [ROOT / "index.html", *ROOT.glob("subjects/**/*.html"), *ROOT.glob("exams/*.html"), *ROOT.glob("templates/*.html")]
    for f in pages:
        s = f.read_text(encoding="utf-8")
        r = re.search(r'data-root="([^"]*)"', s).group(1)
        f.write_text(pat.sub(lambda m: site_header(r), s, count=1), encoding="utf-8")
    print(f"已更新 {len(pages)} 個檔案的頁首")
