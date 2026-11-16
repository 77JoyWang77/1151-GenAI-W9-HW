#!/usr/bin/env python3
"""檢查所有科目與主題頁是否符合 CLAUDE.md 的規則。只用標準函式庫。

用法：python scripts/check.py
"""
import json
from html import unescape
import re
import sys
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MIN_TEXT = 2500   # 主題頁正文最少字數（不含程式碼），確保講解完整
VOID = {"meta", "link", "br", "img", "input", "hr", "source", "wbr"}
SLUG = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")


class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.body, self.desc, self.scripts = {}, None, []
        self.style_tag = self.inline_style = self.toggle = False
        self.sections = []          # [section id, 是否有 h2]
        self.viz = 0
        self.figs = self.figcaps = 0
        self._depth = 0             # 目前在第幾層 section 裡
        self._skip = 0              # 在 <pre>/<script>/<style> 裡時不計入文字量
        self._in_main = False
        self.text = []
        self._open = []             # 目前開啟中的元素 class（用來判斷 pre.code 是否在 .code-block 裡）
        self.loose_code = 0         # 沒有放在 .code-block 裡的 pre.code
        self.code_blocks = self.untitled = self.full_code = 0
        self.bad_tabs = 0
        self.unfolded = 0           # 沒有收合在 details.code-fold 裡的程式碼
        self.qbank = None           # 練習題容器的 data-questions
        self.qlinks = []            # 「例題」連結指向的題目 id

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
        if tag == "div" and "fig-draw" in cls and a.get("data-fig"):
            self.figs += 1
        if tag == "figcaption":
            self.figcaps += 1
        if tag in ("pre", "script", "style"):
            self._skip += 1
        if tag == "main":
            self._in_main = True
        if tag == "pre" and "code" in cls and not any("code-block" in c for c in self._open):
            self.loose_code += 1
        inside = lambda name: any(name in c for c in self._open)
        if ("code-tabs" in cls or ("code-block" in cls and not inside("code-tabs"))) and not inside("code-fold") and not inside("code-full"):
            self.unfolded += 1
        if "qbank" in cls:
            self.qbank = a.get("data-questions")
        if tag == "a" and (a.get("href") or "").startswith("#q-"):
            self.qlinks.append(a["href"][3:])
        if "code-block" in cls:
            self.code_blocks += 1
            if any("code-tabs" in c for c in self._open[-1:]) and not a.get("data-tab"):
                self.bad_tabs += 1
        if "code-head" in cls:
            self._open_head = True
        if tag == "details" and "code-full" in cls:
            self.full_code += 1
        if tag not in VOID:
            self._open.append(cls)

    def handle_endtag(self, tag):
        if tag not in VOID and self._open:
            self._open.pop()
        if tag == "section":
            self._depth -= 1
        if tag in ("pre", "script", "style"):
            self._skip -= 1
        if tag == "main":
            self._in_main = False

    def handle_data(self, data):
        if self._in_main and not self._skip:
            self.text.append(data)


QUESTIONS = {}
QTYPES = {"選擇", "填空", "計算", "追蹤", "證明", "實作", "簡答"}


def check_questions(subject_id, topic_ids, errors):
    path = ROOT / "data" / "questions" / f"{subject_id}.json"
    if not path.exists():
        errors.append(f"[{subject_id}] 缺少題庫 data/questions/{subject_id}.json")
        return
    data = json.loads(path.read_text(encoding="utf-8"))
    levels = data.get("levels", {})
    seen = set()
    for q in data["questions"]:
        e = lambda m: errors.append(f"[questions/{q.get('id')}] {m}")
        if q.get("id") in seen:
            e("id 重複")
        seen.add(q.get("id"))
        for k in ("topics", "level", "type", "source", "question", "answer", "explanation"):
            if not q.get(k):
                e(f"缺少欄位 {k}")
        for t in q.get("topics", []):
            if t not in topic_ids:
                e(f"topics 裡的「{t}」不是這個科目的主題")
        if q.get("level") not in levels:
            e(f"level 必須是 {list(levels)}")
        if q.get("type") not in QTYPES:
            e(f"type 必須是 {sorted(QTYPES)}")
        if q.get("type") == "選擇" and len(q.get("choices", [])) < 2:
            e("選擇題要有 choices")
        src = q.get("source", {})
        if src.get("kind") not in ("original", "exam"):
            e("source.kind 必須是 original 或 exam")
        if src.get("kind") == "exam":
            for k in ("school", "year", "dept", "no"):
                if not src.get(k):
                    e(f"考古題的 source 要有 {k}")
    QUESTIONS[subject_id] = data["questions"]


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
    # 完整的文字講解（不含程式碼）＋至少一張有圖說的靜態圖
    chars = len(re.sub(r"\s+", "", "".join(p.text)))
    if chars < MIN_TEXT:
        err(f"文字講解太少：正文約 {chars} 字（不含程式碼），至少要 {MIN_TEXT} 字")
    if p.figs < 1:
        err('至少要有一張靜態圖 <figure class="fig"><div class="fig-draw" data-fig=...>')
    if p.figcaps < p.figs:
        err("每張圖都要有 <figcaption> 圖說")
    js = "../../../assets/js/"
    expected = [js + "theme.js", js + "site.js", js + "viz-core.js", f"{js}viz/{subj['id']}/{t['id']}.js"]
    if not (ROOT / "assets" / "js" / "viz" / subj["id"] / f"{t['id']}.js").exists():
        err(f"找不到圖與動畫腳本 assets/js/viz/{subj['id']}/{t['id']}.js")
    if p.scripts != expected:
        err(f"script 應依序為 {expected}")
    # 程式碼：每段都要放在有標題的 .code-block；有程式碼時要附完整可編譯程式
    if p.loose_code:
        err(f'有 {p.loose_code} 段 <pre class="code"> 沒有放在 <div class="code-block"> 裡（每段程式碼都要有標題）')
    if p.code_blocks and html.count('class="code-head"') < p.code_blocks:
        err("每個 .code-block 都要有 .code-head 標題")
    if p.bad_tabs:
        err(".code-tabs 裡的每個 .code-block 都要有 data-tab（頁籤名稱）")
    if p.unfolded:
        err(f'有 {p.unfolded} 段程式碼沒有收合：要放在 <details class="code-fold"><summary>看程式碼：…</summary> 裡')
    # 練習題：要有 .qbank 容器，題庫中這個主題每個難度至少 2 題
    if p.qbank != t["id"]:
        err(f'要有 <div class="qbank" data-questions="{t["id"]}"> 練習題區塊')
    mine = [q for q in QUESTIONS.get(subj["id"], []) if t["id"] in q["topics"]]
    for lv in ("basic", "advanced", "exam"):
        k = sum(1 for q in mine if q["level"] == lv and q["source"]["kind"] == "original")
        if k < 2:
            err(f"題庫中這個主題的 {lv} 難度原創題只有 {k} 題，至少要 2 題")
    ids = {q["id"] for q in QUESTIONS.get(subj["id"], [])}
    for qid in p.qlinks:
        if qid not in ids:
            err(f"「例題」連結指向不存在的題目 {qid}")
    if p.full_code:
        err('頁面上不放完整程式（details.code-full），完整程式只存在 code/ 裡供編譯驗證')
    src = ROOT / "code" / subj["id"] / f"{t['id']}.c"
    if p.code_blocks:
        if not src.exists():
            err(f"有程式碼的主題要把完整程式存成 code/{subj['id']}/{t['id']}.c（編譯驗證用）")
        else:
            # 每段片段的每一行都要能在完整程式中找到（片段要從完整程式取出）
            src_lines = set(src.read_text(encoding="utf-8").split("\n"))
            for snip in re.findall(r'<pre class="code">(.*?)</pre>', html, re.S):
                missing = [l for l in unescape(snip).split("\n") if l.strip() and l not in src_lines]
                if missing:
                    err(f"程式碼片段有 {len(missing)} 行不在 code/{subj['id']}/{t['id']}.c 裡，例如：{missing[0].strip()[:50]}")
                    break
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


# 網站上不可用 emoji 或文字符號當 icon（CLAUDE.md 第 10.1 節）
EMOJI = re.compile("[\U0001F300-\U0001FAFF\u2600-\u27BF\u2B50\u23E9-\u23FA\u25B6\u25B8\u25C0\u2713\u2717]")


def check_no_emoji(errors):
    paths = [ROOT / "index.html", *ROOT.glob("subjects/**/*.html"), *ROOT.glob("templates/*.html"),
             *ROOT.glob("assets/**/*.js"), *ROOT.glob("assets/**/*.css"), *ROOT.glob("data/**/*.json")]
    for path in paths:
        for n, line in enumerate(path.read_text(encoding="utf-8").split("\n"), 1):
            m = EMOJI.search(line)
            if m:
                errors.append(f"[{path.relative_to(ROOT)}:{n}] 用了 emoji / 符號「{m.group(0)}」當 icon，請改用 assets/icons.svg")
                break


def main():
    errors = []
    check_no_emoji(errors)
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
        if not (ROOT / "subjects" / s["id"] / "questions.html").exists():
            errors.append(f"[{s['id']}] 缺少題庫頁 subjects/{s['id']}/questions.html")
        check_questions(s["id"], {t["id"] for c in subj["chapters"] for t in c["topics"]}, errors)
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
        for page in (ROOT / "subjects" / s["id"]).glob("*/*.html"):  # 只看 <chapter>/<topic>.html
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
