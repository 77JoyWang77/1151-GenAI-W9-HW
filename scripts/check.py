#!/usr/bin/env python3
"""檢查所有主題頁是否符合 CLAUDE.md 的規則。只用標準函式庫。

用法：python scripts/check.py
"""
import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TOPICS = ROOT / "topics"
SECTIONS = ["intro", "viz", "ops", "code", "exam", "pitfalls", "quiz"]
SLUG = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")


class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.sections, self.body, self.desc, self.scripts = [], {}, None, []
        self.style_tag = self.inline_style = False
        self.viz = self.exam = self.quiz = self.pitfalls = self.callout = self.terms = 0

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        cls = (a.get("class") or "").split()
        if "style" in a:
            self.inline_style = True
        if tag == "style":
            self.style_tag = True
        if tag == "body":
            self.body = a
        if tag == "meta" and a.get("name") == "description":
            self.desc = a.get("content")
        if tag == "script" and a.get("src"):
            self.scripts.append(a["src"])
        if tag == "section" and a.get("id"):
            self.sections.append(a["id"])
        if tag == "div" and "viz" in cls and a.get("data-viz"):
            self.viz += 1
        if "exam-q" in cls:
            self.exam += 1
        if "callout" in cls:
            self.callout += 1
        if "term" in cls:
            self.terms += 1
        if tag == "details" and "quiz" in cls:
            self.quiz += 1
        if tag == "li" and self.sections and self.sections[-1] == "pitfalls":
            self.pitfalls += 1


def main():
    errors = []
    syl = json.loads((ROOT / "data" / "syllabus.json").read_text(encoding="utf-8"))
    css = (ROOT / "assets" / "css" / "style.css").read_text(encoding="utf-8")
    topics, ids = {}, set()
    for ch in syl["chapters"]:
        if not SLUG.match(ch["id"]):
            errors.append(f"[syllabus] 章節 id「{ch['id']}」不是 kebab-case")
        if f"--ch-{ch['id']}:" not in css or f'body[data-chapter="{ch["id"]}"]' not in css:
            errors.append(f"[css] 章節 {ch['id']} 缺少 --ch-{ch['id']} 或 body[data-chapter] 對應")
        for t in ch["topics"]:
            if t["id"] in ids:
                errors.append(f"[syllabus] topic-id「{t['id']}」重複（必須全站唯一）")
            ids.add(t["id"])
            if not SLUG.match(t["id"]):
                errors.append(f"[syllabus] 主題 id「{t['id']}」不是 kebab-case")
            topics[f"{ch['id']}/{t['id']}"] = t

    files = sorted(p for p in TOPICS.rglob("*.html") if not p.name.startswith("_"))
    seen = set()
    for path in files:
        tid = path.relative_to(TOPICS).with_suffix("").as_posix()
        seen.add(tid)
        err = lambda m: errors.append(f"[{tid}] {m}")
        meta = topics.get(tid)
        if not meta:
            err("沒有登錄在 data/syllabus.json")
            continue
        chapter, topic = tid.split("/")
        html = path.read_text(encoding="utf-8")
        p = Page()
        p.feed(html)

        if "{{" in html:
            err("還有模板佔位符 {{...}} 沒有取代")
        if meta.get("status") != "done":
            err("頁面已存在，但 syllabus.json 的 status 不是 done")
        if p.sections != SECTIONS:
            err(f"section 應依序為 {SECTIONS}，實際為 {p.sections}")
        if p.body.get("data-chapter") != chapter or p.body.get("data-topic") != tid or p.body.get("data-root") != "../../":
            err("<body> 的 data-chapter / data-topic / data-root 不正確")
        if p.style_tag or p.inline_style:
            err("主題頁不可使用 <style> 或 inline style")
        if p.viz < 1:
            err("至少要有一個 <div class=\"viz\" data-viz=...>")
        if p.callout < 1:
            err("核心概念至少要有一個 .callout")
        if p.terms < 2:
            err("專有名詞應使用 <span class=\"term\">English<small>（中文）</small></span> 標示")
        if not 2 <= p.exam <= 4:
            err(f"考研重點應為 2～4 題，實際 {p.exam}")
        if not 3 <= p.pitfalls <= 5:
            err(f"易錯點應為 3～5 點，實際 {p.pitfalls}")
        if not 3 <= p.quiz <= 6:
            err(f"自我測驗應為 3～6 題，實際 {p.quiz}")
        if not p.desc or len(p.desc) > 70:
            err("<meta description> 必須存在且 ≤ 70 字")
        expected = ["../../assets/js/site.js", "../../assets/js/viz-core.js", f"../../assets/js/viz/{topic}.js"]
        if p.scripts != expected:
            err(f"script 載入順序應為 {expected}")
        if not (ROOT / "assets" / "js" / "viz" / f"{topic}.js").exists():
            err(f"找不到動畫腳本 assets/js/viz/{topic}.js")
        if re.search(r'(href|src)="/', html):
            err("不可使用 / 開頭的絕對路徑")
        if f"最後更新：{meta.get('updated')}" not in html:
            err("頁尾「最後更新」與 syllabus.json 的 updated 不一致")
        if meta.get("difficulty") not in (1, 2, 3):
            err("difficulty 必須是 1、2、3")
        if not 2 <= len(meta.get("tags", [])) <= 5:
            err("tags 應為 2～5 個")

    for tid, t in topics.items():
        if t.get("status") == "done" and tid not in seen:
            errors.append(f"[syllabus] {tid} 標為 done 但找不到 topics/{tid}.html")

    if errors:
        print("\n".join(errors))
        print(f"\n✗ {len(errors)} 個問題")
        sys.exit(1)
    done = sum(1 for t in topics.values() if t.get("status") == "done")
    print(f"✓ All checks passed（{done} 個主題完成 / 共規劃 {len(topics)} 個主題、{len(syl['chapters'])} 章）")


if __name__ == "__main__":
    main()
