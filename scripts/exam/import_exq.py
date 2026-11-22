"""把題目模組合併進題庫：python scripts/exam/import_exq.py <subject-id> mod1.py mod2.py ...
- 依（學校, 年, 題號）去重，已收的跳過；新題目的 id 接在題庫最大號之後
- 模組的 SKIP（不收的題目與原因）寫進 data/exam-log.json
- 要更新已收題目的內容，用 sync_exq.py"""
import sys
from _common import REPO, load_module, year_of, url_of, load_json, save_json, topic_ids

S = sys.argv[1]
P = REPO / "data" / "questions" / f"{S}.json"
valid = topic_ids(S); d = load_json(P)
pre = d["questions"][0]["id"].split("-")[0]
have = {(q["source"].get("school"), q["source"].get("year"), str(q["source"].get("no")))
        for q in d["questions"] if q["source"]["kind"] == "exam"}
n = max(int(q["id"].split("-")[1]) for q in d["questions"])
LOG = REPO / "data" / "exam-log.json"; log = load_json(LOG)
added = 0; bad = []
for f in sys.argv[2:]:
    m = load_module(f)
    for q in m.Q:
        y = year_of(m, q); key = (m.SCHOOL, y, str(q["no"]))
        if key in have: continue
        miss = [t for t in q["topics"] if t not in valid]
        if miss: bad.append((f, q["no"], miss)); continue
        n += 1
        e = {"id": f"{pre}-{n:04d}", "topics": q["topics"], "level": "exam", "type": q["type"],
             "source": {"kind": "exam", "school": m.SCHOOL, "year": y, "dept": q.get("dept", m.DEPT),
                        "no": q["no"], "url": url_of(m, y)},
             "question": q["question"]}
        if "choices" in q: e["choices"] = q["choices"]
        e["answer"] = q["answer"]; e["explanation"] = q["explanation"]
        d["questions"].append(e); have.add(key); added += 1
    for s in getattr(m, "SKIP", []):
        y = s.get("year", getattr(m, "YEAR", None))
        paper = next((p for p in log["papers"] if p["school"] == m.SCHOOL and p["year"] == y and p["url"] == url_of(m, y)), None)
        if paper is None:
            print("exam-log.json 沒有這份考卷，請先登錄：", m.SCHOOL, y, url_of(m, y)); continue
        if not any(str(x["no"]) == str(s["no"]) for x in paper["skipped"]):
            paper["skipped"].append({"no": s["no"], "subject": S, "reason": s["reason"]})
# 已經收進題庫的題號，從不收清單移除（例如依新規則重新收錄）
for paper in log["papers"]:
    paper["skipped"] = [x for x in paper["skipped"]
                        if x.get("subject") != S or (paper["school"], paper["year"], str(x["no"])) not in have]
save_json(P, d); save_json(LOG, log)
print(S, "added", added, "last", f"{pre}-{n:04d}")
for b in bad: print("topic 不存在，沒有匯入：", b)
