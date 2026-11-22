"""檢查一個題目模組（不寫入）：python scripts/exam/validate.py <subject-id> <module.py>"""
import re, sys
from _common import load_module, year_of, url_of, topic_ids

TYPES = ["選擇", "填空", "計算", "追蹤", "證明", "實作", "簡答"]
S, f = sys.argv[1], sys.argv[2]
valid = topic_ids(S); m = load_module(f)
err = 0; seen = set()
def E(k, s):
    global err; err += 1; print("ERR", k, s)
for q in m.Q:
    y = year_of(m, q); k = (y, str(q.get("no")))
    if k in seen: E(k, "題號重複")
    seen.add(k)
    for key in ["no", "topics", "type", "question", "answer", "explanation"]:
        if key not in q: E(k, "缺少 " + key)
    if not isinstance(y, int): E(k, "缺少 year")
    for t in q.get("topics", []):
        if t not in valid: E(k, f"topic 不存在：{t}（沒有合適的主題時，先在 data/{S}.json 新增 planned 主題）")
    if q.get("type") not in TYPES: E(k, "type 不合法")
    if q.get("type") == "選擇" and not q.get("choices"): E(k, "選擇題要有 choices")
    if not url_of(m, y).startswith("https://"): E(k, "url 要是 https")
    for fld in ["question", "explanation"]:
        s = q.get(fld, "")
        for tag in ["b", "i", "p", "ul", "ol", "li", "pre", "code", "table", "tr", "td", "th", "sub", "sup", "small", "figure", "figcaption"]:
            if len(re.findall(f"<{tag}[ >]", s)) != s.count(f"</{tag}>"): E(k, f"{fld} 的 <{tag}> 沒有成對")
        if re.search(r"[\U0001F300-\U0001FAFF✅❌▶★⚠]", s): E(k, fld + " 有 emoji")
        if re.search("課本|參考書|§", s): E(k, fld + " 提到課本")
for s in getattr(m, "SKIP", []):
    if not s.get("reason"): E((s.get("year"), s.get("no")), "SKIP 要寫 reason")
print(f, len(m.Q), "questions", "OK" if not err else f"{err} errors")
sys.exit(1 if err else 0)
