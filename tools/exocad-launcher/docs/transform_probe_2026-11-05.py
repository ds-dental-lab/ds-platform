# -*- coding: utf-8 -*-
"""이동 및 변형 손잡이 실험 (2026-11-05) — 참고용. docs/bridge_rules.md 4절."""
import sys, time
sys.path.insert(0, r"C:\Users\DS\Desktop\ds-platform\tools\exocad-launcher")
from batch_review import quietly
from dentbird_web import attach

def tab():
    d = quietly(attach)
    for h in d.window_handles:
        d.switch_to.window(h)
        if "caseUniqueID=01a1aae9" in d.current_url:
            return d
    raise SystemExit("케이스 탭 없음")
import sys, time
from dentbird_params import plus_areas, select_tooth, _open_tool, _click, close_panels

def handles(d):
    return d.execute_script(r"""
const svg=[...document.querySelectorAll('[data-testid=mesh-viewer-container] svg')].find(s=>s.querySelector('circle'));
if(!svg) return null;
const pts=[...svg.querySelectorAll('circle,rect')].map(e=>{const r=e.getBoundingClientRect(); return {t:e.tagName, x:r.x+r.width/2, y:r.y+r.height/2, w:r.width}}).filter(p=>p.w<12);
return pts;""")

def drag(d, x1, y1, x2, y2, steps=12):
    send = lambda typ, x, y, **k: d.execute_cdp_cmd("Input.dispatchMouseEvent", {"type": typ, "x": x, "y": y, "button": "left", **k})
    send("mouseMoved", x1, y1, buttons=0)
    time.sleep(0.2)
    send("mousePressed", x1, y1, buttons=1, clickCount=1)
    for i in range(1, steps + 1):
        send("mouseMoved", x1 + (x2 - x1) * i / steps, y1 + (y2 - y1) * i / steps, buttons=1)
        time.sleep(0.03)
    send("mouseReleased", x2, y2, buttons=0, clickCount=1)
    time.sleep(0.3)
    send("mouseMoved", 5, 900, buttons=0)


d = tab()
import sys
from dentbird_params import _click as click_tid
click_tid(d, "UndoButton"); time.sleep(3)
print("undo -> plus", plus_areas(d, print)); close_panels(d)

def open_transform(tooth):
    select_tooth(d, tooth)
    _open_tool(d, "toolbar-tool-refine", "refine-group-Adapt-btn")
    _click(d, "refine-group-Transform-btn"); time.sleep(1.5)

total = 0
for step in [float(a) for a in sys.argv[1:]]:
    open_transform(47)
    cs = [h for h in handles(d) if h["t"] == "circle" and h["x"] > 0]
    l = min(cs, key=lambda c: c["x"]); r = max(cs, key=lambda c: c["x"])
    drag(d, r["x"], r["y"], r["x"] + step, r["y"])
    time.sleep(2)
    cs2 = [h for h in handles(d) if h["t"] == "circle" and h["x"] > 0]
    l2 = min(cs2, key=lambda c: c["x"]); r2 = max(cs2, key=lambda c: c["x"])
    total += step
    close_panels(d)
    print(f"+{step}px (누계 {total}) 상자 {round(l['x'])}-{round(r['x'])} -> {round(l2['x'])}-{round(r2['x'])} · plus", plus_areas(d, print))
    close_panels(d)
