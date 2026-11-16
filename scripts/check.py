#!/usr/bin/env python3
"""檢查所有科目與主題頁是否符合 CLAUDE.md 的規則。只用標準函式庫。

用法：python scripts/check.py
"""
import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SLUG = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")


class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.body, self.desc, self.scripts = {}, None, []
        self.style_tag = self.inline_style = self.toggle = False
        self.sections = []          # [section id, 是否有 h2]
        self.viz = 0
        self._depth = 0             # 目前在第幾層 section 裡

    def handle_starttag(self, tag, a):
        a = dict(a)
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
        if "data-theme-toggle" in a:
            self.toggle = True
        if tag == "section":
            self._depth += 1
            if self._depth == 1:
                self.sections.append([a.get("id"), False])
        if tag == "h2" and self._depth == 1 and self.sections:
            self.sections[-1][1] = True
        if tag == "div" and "viz" in cls and a.get("data-viz"):
            self.viz += 1

    def handle_endtag(self, tag):
        if tag == "section":
            self._depth -= 1


def load(path):
    return json.loads((ROOT / path).read_text(encoding="utf-8"))


def check_topic(path, subj, ch, t, errors):
    key = f"{subj['id']}/{ch['id']}/{t['id']}"
    err = lambda m: errors.append(f"[{key}] {m}")
    html = path.read_text(encoding="utf-8")
    p = Page()
    p.feed(html)
    if "{{" in html:
        err("還有模板佔位符 {{...}} 沒有取代")
    want = {"data-subject": subj["id"], "data-chapter": ch["id"], "data-chno": str(ch["no"]), "data-topic": key, "data-root": "../../../"}
    for k, v in want.items():
        if p.body.get(k) != v:
            err(f'<body {k}> 應為 "{v}"，實際為 "{p.body.get(k)}"')
    if p.style_tag or p.inline_style:
        err("主題頁不可使用 <style> 或 inline style")
    if not p.toggle:
        err("頁首缺少 data-theme-toggle 切換按鈕")
    # 段落不限定，但每個頂層 section 要有 id 和 h2（目錄 TOC 靠它）
    if len(p.sections) < 2:
        err("至少要有 2 個 <section>")
    for sid, has_h2 in p.sections:
        if not sid or not SLUG.match(sid):
            err(f"每個 <section> 都要有 kebab-case 的 id（找到：{sid}）")
        if not has_h2:
            err(f"<section id=\"{sid}\"> 缺少 <h2> 標題")
    if not p.desc or len(p.desc) > 70:
        err("<meta description> 必須存在且 ≤ 70 字")
    js = "../../../assets/js/"
    expected = [js + "theme.js", js + "site.js"]
    if p.viz:
        expected += [js + "viz-core.js", f"{js}viz/{subj['id']}/{t['id']}.js"]
        if not (ROOT / "assets" / "js" / "viz" / subj["id"] / f"{t['id']}.js").exists():
            err(f"找不到動畫腳本 assets/js/viz/{subj['id']}/{t['id']}.js")
    if p.scripts != expected:
        err(f"script 應依序為 {expected}（有互動元件時才載入 viz-core 和動畫腳本）")
    if bool(t.get("viz")) != bool(p.viz):
        err(f"JSON 的 viz = {t.get('viz')}，但頁面{'有' if p.viz else '沒有'}互動元件")
    if re.search(r'(href|src)="/', html):
        err("不可使用 / 開頭的絕對路徑")
    if f"最後更新：{t.get('updated')}" not in html:
        err("頁尾「最後更新」與 JSON 的 updated 不一致")
    if re.search(r"課本|參考書|§", html):
        err("頁面內容要獨立，不可提到課本 / 參考書或 § 節次（參考書只給 AI 查閱）")
    if t.get("difficulty") not in (1, 2, 3):
        err("difficulty 必須是 1、2、3")
    if not 2 <= len(t.get("tags", [])) <= 5:
        err("tags 應為 2～5 個")


def main():
    errors = []
    css = (ROOT / "assets" / "css" / "style.css").read_text(encoding="utf-8")
    reg = load("data/subjects.json")
    total_done = total = 0
    for s in reg["subjects"]:
        if not SLUG.match(s["id"]):
            errors.append(f"[subjects] 科目 id「{s['id']}」不是 kebab-case")
        if s["status"] != "active":
            continue
        if not (ROOT / "data" / f"{s['id']}.json").exists():
            errors.append(f"[{s['id']}] active 的科目要有 data/{s['id']}.json")
            continue
        if not (ROOT / "subjects" / s["id"] / "index.html").exists():
            errors.append(f"[{s['id']}] 缺少科目首頁 subjects/{s['id']}/index.html")
        subj = load(f"data/{s['id']}.json")
        subj["id"] = s["id"]
        if subj.get("subject", {}).get("id") != s["id"]:
            errors.append(f"[{s['id']}] JSON 內的 subject.id 不一致")
        ids = set()
        for ch in subj["chapters"]:
            if not SLUG.match(ch["id"]):
                errors.append(f"[{s['id']}] 章節 id「{ch['id']}」不是 kebab-case")
            if not isinstance(ch.get("no"), int):
                errors.append(f"[{s['id']}/{ch['id']}] 章節要有整數 no（決定章節色與順序）")
            for t in ch["topics"]:
                total += 1
                if t["id"] in ids:
                    errors.append(f"[{s['id']}] topic-id「{t['id']}」在科目內重複")
                ids.add(t["id"])
                if not SLUG.match(t["id"]):
                    errors.append(f"[{s['id']}] 主題 id「{t['id']}」不是 kebab-case")
                if t.get("priority") not in ("high", "mid", "low"):
                    errors.append(f"[{s['id']}/{t['id']}] priority 必須是 high / mid / low")
                page = ROOT / "subjects" / s["id"] / ch["id"] / f"{t['id']}.html"
                if t["status"] == "done":
                    total_done += 1
                    if not page.exists():
                        errors.append(f"[{s['id']}/{ch['id']}/{t['id']}] 標為 done 但找不到頁面")
                    else:
                        check_topic(page, subj, ch, t, errors)
                elif page.exists():
                    errors.append(f"[{s['id']}/{ch['id']}/{t['id']}] 頁面存在但 status 不是 done")
        # 沒登錄的頁面
        for page in (ROOT / "subjects" / s["id"]).glob("*/*.html"):
            chid, tid = page.parent.name, page.stem
            if not any(c["id"] == chid and any(t["id"] == tid for t in c["topics"]) for c in subj["chapters"]):
                errors.append(f"[{s['id']}/{chid}/{tid}] 頁面沒有登錄在 data/{s['id']}.json")

    for i in range(1, 13):
        if f"--ch-{i}:" not in css or f'body[data-chno="{i}"]' not in css:
            errors.append(f"[css] 缺少章節色 --ch-{i} 或 body[data-chno=\"{i}\"]")

    if errors:
        print("\n".join(errors))
        print(f"\n✗ {len(errors)} 個問題")
        sys.exit(1)
    print(f"✓ All checks passed（{len(reg['subjects'])} 個科目；已完成 {total_done} / 共規劃 {total} 個主題）")


if __name__ == "__main__":
    main()
