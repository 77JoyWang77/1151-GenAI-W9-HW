"""全站統一頁首（CLAUDE.md 6.6）：check.py 用它比對每一頁的 <header>。"""


def site_header(root, subject_id=None, subject_zh=None):
    """root：到網站根目錄的相對路徑（"" / "../../" / "../../../"）；有科目時多兩個連結。"""
    links = [f'        <a href="{root}index.html#subjects">科目</a>']
    if subject_id:
        links.append(f'        <a href="{root}subjects/{subject_id}/index.html">{subject_zh}</a>')
        links.append(f'        <a href="{root}subjects/{subject_id}/questions.html">題庫</a>')
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
