"""用題目模組的最新內容覆蓋已收的題目（修正詳解、答案時用）：
python scripts/exam/sync_exq.py <subject-id> mod.py ..."""
import sys
from _common import REPO, load_module, year_of, load_json, save_json

S = sys.argv[1]; P = REPO / "data" / "questions" / f"{S}.json"; d = load_json(P)
idx = {(q["source"].get("school"), q["source"].get("year"), str(q["source"].get("no"))): q
       for q in d["questions"] if q["source"]["kind"] == "exam"}
ch = []
for f in sys.argv[2:]:
    m = load_module(f)
    for q in m.Q:
        e = idx.get((m.SCHOOL, year_of(m, q), str(q["no"])))
        if not e: continue
        for k in ["question", "choices", "answer", "explanation", "topics", "type"]:
            if k in q and e.get(k) != q[k]: e[k] = q[k]; ch.append((e["id"], k))
save_json(P, d); print(S, "updated", ch)
