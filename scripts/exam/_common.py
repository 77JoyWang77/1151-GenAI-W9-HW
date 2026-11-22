"""考古題匯入工具共用：載入題目模組、路徑設定。"""
import importlib.util, json, os
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
# 考卷頁面圖（pdftoppm 轉出的 PNG）放在 repo 外，避免把整份掃描檔放上網站
PAGES = Path(os.environ.get("EXAM_PAGES", Path.home() / "exams" / "img"))
SUBJECTS = ["data-structures", "algorithms", "discrete-math", "linear-algebra",
            "computer-organization", "operating-systems"]

def load_module(path):
    spec = importlib.util.spec_from_file_location("exam_mod", path)
    m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
    return m

def year_of(m, q):
    return q.get("year", getattr(m, "YEAR", None))

def url_of(m, y):
    return m.U(y) if hasattr(m, "U") else m.URL

def load_json(p):
    return json.loads(Path(p).read_text(encoding="utf-8"))

def save_json(p, d):
    Path(p).write_text(json.dumps(d, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

def topic_ids(subject):
    d = load_json(REPO / "data" / f"{subject}.json")
    return {t["id"] for c in d["chapters"] for t in c["topics"]}


SCHOOL_SLUG = {"國立臺灣大學": "ntu", "國立陽明交通大學": "nycu", "國立中央大學": "ncu", "國立成功大學": "ncku"}


def paper_id(school, year, paper):
    """考卷 id：<學校縮寫>-<學年>-<software|hardware|math>，例如 ncu-115-software（考古卷頁的網址用它）"""
    if school not in SCHOOL_SLUG:
        raise SystemExit(f"_common.py 的 SCHOOL_SLUG 還沒有「{school}」的縮寫，請先補上")
    return f"{SCHOOL_SLUG[school]}-{year}-{paper}"


def ensure_paper_ids(log):
    """替 exam-log.json 裡還沒有 id 的考卷補上 id"""
    for p in log["papers"]:
        p.setdefault("id", paper_id(p["school"], p["year"], p["paper"]))
