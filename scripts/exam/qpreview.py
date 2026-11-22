"""預覽題目模組裡的圖與題目：python3 scripts/exam/qpreview.py <module.py> <輸出資料夾> [題號...]
會在輸出資料夾產生 <year>_<no>_light.png / _dark.png，用 Read 工具看圖檢查。"""
import sys, json, importlib.util, re, os
from pathlib import Path
from playwright.sync_api import sync_playwright
sys.path.insert(0, str(Path(__file__).resolve().parent))
from _common import REPO
f, out = sys.argv[1], Path(sys.argv[2]); want = set(sys.argv[3:]); out.mkdir(parents=True, exist_ok=True)
sp = importlib.util.spec_from_file_location("m", f); m = importlib.util.module_from_spec(sp); sp.loader.exec_module(m)
qs = [q for q in m.Q if not want or str(q["no"]) in want]
page_html = f"""<!DOCTYPE html><html><head><meta charset="utf-8"><link rel="stylesheet" href="{REPO}/assets/css/style.css"></head>
<body data-root="{REPO}/"><main class="wrap" style="max-width:860px"><div id="box"></div></main>
<script src="{REPO}/assets/js/viz-core.js"></script><script>
const QS = {json.dumps(qs, ensure_ascii=False)};
const box = document.getElementById('box');
QS.forEach((q,i)=>{{ const a=document.createElement('article'); a.className='qcard'; a.id='q'+i;
  a.innerHTML='<div class="qtext">'+q.question+'</div>'+(q.choices?'<ul class="qchoices">'+q.choices.map(c=>'<li>'+c+'</li>').join('')+'</ul>':'')+'<div class="qa"><p><b>答案：</b>'+q.answer+'</p>'+q.explanation+'</div>';
  box.appendChild(a);
  a.querySelectorAll('img.q-img[data-src]').forEach(im=>im.src=document.body.dataset.root+im.dataset.src);
  a.querySelectorAll('.q-fig[data-spec]').forEach(d=>{{const f=JSON.parse(d.dataset.spec); d.style.setProperty('--fig-w',(f.width||640)+'px'); new DSViz.Player(d,{{static:true,width:f.width||640,height:f.height||240,title:''}}).load([f],{{autoplay:false}});}});
}});
</script></body></html>"""
tmp = out / "_preview.html"; tmp.write_text(page_html, encoding="utf-8")
with sync_playwright() as p:
    b = p.chromium.launch(**({"executable_path": os.environ["CHROME"]} if os.environ.get("CHROME") else {}))
    for theme in ["light", "dark"]:
        pg = b.new_page(viewport={"width": 900, "height": 800})
        pg.goto(tmp.as_uri())
        if theme == "dark": pg.evaluate("document.documentElement.setAttribute('data-theme','dark')")
        pg.wait_for_timeout(600)
        for i, q in enumerate(qs):
            name = re.sub(r"[^\w-]", "_", f"{q.get('year', getattr(m,'YEAR',''))}_{q['no']}")
            pg.locator(f"#q{i}").screenshot(path=str(out / f"{name}_{theme}.png"))
    b.close()
print("wrote", len(qs) * 2, "images to", out)
