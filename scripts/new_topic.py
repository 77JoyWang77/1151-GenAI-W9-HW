"""從 templates/topic.html 產生（或重新產生）一個主題頁（CLAUDE.md 11 節）。

用法：
  python scripts/new_topic.py <subject-id> <topic-id> --sub "一句話副標" --desc "≤ 70 字描述" [--body body.html]

- 名稱、章節、tags、難度、更新日期都從 data/<subject-id>.json 讀，不用手打（先在 JSON 補好這些欄位）。
- 外殼（頁首、麵包屑、meta 列、練習題、頁尾、script）來自模板，和全站一致；頁首用 header.py 產生。
- --body：頁面主體（多個 <section>，不含 practice），可用 {{X}} {{OK}} {{BULB}} {{MARK}} 代表
  x-circle、check-circle、bulb、bookmark icon。沒給 --body 時保留模板的範例段落，讓你照著填。
- 最後自動執行 stamp.py 更新版本號。
"""
import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(Path(__file__).resolve().parent))
from header import site_header  # noqa: E402

ICON = lambda n: f'<svg class="icon" aria-hidden="true"><use href="../../../assets/icons.svg#i-{n}"></use></svg>'


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("subject")
    ap.add_argument("topic")
    ap.add_argument("--sub", required=True, help="大標下的一句話副標")
    ap.add_argument("--desc", required=True, help="<meta description>，≤ 70 字")
    ap.add_argument("--body", help="頁面主體 HTML 檔")
    a = ap.parse_args()

    subjects = json.loads((ROOT / "data/subjects.json").read_text(encoding="utf-8"))["subjects"]
    subj = next((s for s in subjects if s["id"] == a.subject), None)
    if not subj:
        sys.exit(f"找不到科目 {a.subject}")
    data = json.loads((ROOT / f"data/{a.subject}.json").read_text(encoding="utf-8"))
    found = [(c, t) for c in data["chapters"] for t in c["topics"] if t["id"] == a.topic]
    if not found:
        sys.exit(f"data/{a.subject}.json 裡沒有主題 {a.topic}")
    ch, t = found[0]
    missing = [k for k in ("difficulty", "tags", "updated") if not t.get(k)]
    if missing:
        sys.exit(f"先在 data/{a.subject}.json 補上 {', '.join(missing)}（CLAUDE.md 第 8 節）")
    if len(a.desc) > 70:
        sys.exit(f"--desc 有 {len(a.desc)} 字，超過 70 字")

    html = (ROOT / "templates/topic.html").read_text(encoding="utf-8")
    html = re.sub(r"<!--.*?-->\n?", "", html, count=1, flags=re.S)          # 模板開頭的使用說明
    html = re.sub(r'  <header class="site-header">.*?</header>', site_header("../../../"), html, flags=re.S)

    start, end = html.index('      <section id="{{what-is-xxx}}">'), html.index('      <section id="practice">')
    if a.body:
        body = Path(a.body).read_text(encoding="utf-8").strip("\n")
        for k, n in (("X", "x-circle"), ("OK", "check-circle"), ("BULB", "bulb"), ("MARK", "bookmark")):
            body = body.replace("{{%s}}" % k, ICON(n))
        html = html[:start] + body + "\n\n" + html[end:]
        html = re.sub(r"      <!-- =====.*?-->\n\n?", "", html)                      # 模板裡給作者看的分段提示

    tags = "\n".join(f'          <span class="chip">{x}</span>' for x in t["tags"])
    html = html.replace('          <span class="chip">{{tag}}</span>', tags)
    rep = {
        "{{English}}": t["en"], "{{中文}}": t["zh"], "{{科目中文}}": subj["zh"],
        "{{一句話說明這個主題，≤ 70 字}}": a.desc, "{{subject-id}}": a.subject, "{{chapter-id}}": ch["id"],
        "{{章節編號}}": str(ch["no"]), "{{topic-id}}": a.topic,
        "{{科目 English 中文}}": f'{subj["en"]} {subj["zh"]}', "{{章節 English 中文}}": f'{ch["en"]} {ch["zh"]}',
        "{{章節 English}}": ch["en"], "{{一句話副標}}": a.sub, "{{1～3}}": str(t["difficulty"]), "{{YYYY-MM-DD}}": t["updated"],
    }
    for k, v in rep.items():
        html = html.replace(k, v)

    out = ROOT / "subjects" / a.subject / ch["id"] / f"{a.topic}.html"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(html, encoding="utf-8")
    subprocess.run([sys.executable, str(ROOT / "scripts/stamp.py")], check=True, stdout=subprocess.DEVNULL)
    left = sorted(set(re.findall(r"\{\{[^}]*\}\}", html)))
    print(f"wrote {out.relative_to(ROOT)}")
    if left:
        print(f"還有 {len(left)} 種佔位符要填：{' '.join(left[:8])}{' …' if len(left) > 8 else ''}")


if __name__ == "__main__":
    main()
