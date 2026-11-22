"""考古題的圖：原卷裁切（crop + img_html）或用 viz-core 重畫（fig_html）。
在題目模組裡：import sys; sys.path.insert(0, "<repo>/scripts/exam"); from qfig import crop, img_html, fig_html
"""
import json, html, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from PIL import Image, ImageDraw
from _common import REPO, PAGES as IMG

def crop(page, box, name, subject, masks=(), maxw=1100):
    """page：頁面檔名（不含 .png），例如 "nycu_113_hardware-03"
    box：(x0, y0, x1, y1)，頁寬／頁高的比例 0~1
    masks：要塗白的區域（同樣用整頁比例），用來遮掉手寫註記
    name：輸出檔名，例如 "nycu-113-q12"；subject：科目 id
    回傳網站根目錄相對路徑 assets/exam-img/<subject>/<name>.png"""
    im = Image.open(IMG / f"{page}.png").convert("L"); W, H = im.size
    d = ImageDraw.Draw(im)
    for m in masks:
        d.rectangle([int(m[0]*W), int(m[1]*H), int(m[2]*W), int(m[3]*H)], fill=255)
    c = im.crop((int(box[0]*W), int(box[1]*H), int(box[2]*W), int(box[3]*H)))
    if c.width > maxw: c = c.resize((maxw, int(c.height*maxw/c.width)), Image.LANCZOS)
    c = c.point(lambda v: 255 if v > 235 else v)          # 底色變純白
    c = c.quantize(colors=16, dither=Image.Dither.NONE)
    rel = f"assets/exam-img/{subject}/{name}.png"
    out = REPO / rel; out.parent.mkdir(parents=True, exist_ok=True)
    c.save(out, optimize=True)
    return rel

def img_html(rel, caption, alt=None):
    """原卷裁切圖。caption 例如 "<b>圖</b>：Fig. 1 原卷附圖" """
    return (f'<figure class="fig"><img class="q-img" data-src="{rel}" alt="{html.escape(alt or "原卷附圖")}">'
            f'<figcaption>{caption}</figcaption></figure>')

def fig_html(spec, caption):
    """用 viz-core 重畫：spec = {width, height, nodes, edges, pointers, labels}（和 figure() 回傳的格式相同）"""
    return (f'<figure class="fig"><div class="q-fig" data-spec="{html.escape(json.dumps(spec, ensure_ascii=False))}"></div>'
            f'<figcaption>{caption}</figcaption></figure>')
