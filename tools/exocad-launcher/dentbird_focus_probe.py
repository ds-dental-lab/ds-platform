# -*- coding: utf-8 -*-
r"""'치아 초점 보기' 눈금으로 크라운 폭경을 재 봅니다 — 떠 있는 덴트버드 창에서 (2026-11-02).

    python dentbird_focus_probe.py

★ 왜: 커넥터 횡단을 치아 크기로 정하려고 합니다 (사용자 2026-11-02 "밑에 치아 초점 보기에 숫자들이 표기가
  되어 있으니 저 숫자들로 크라운 폭경을 체크하고"). 눈금이 글자(DOM)인지 그림인지부터 모릅니다.
★ 크라운을 고른 상태(합치기 전)에서 돌립니다. 커넥터 패널과 '치아 초점 보기 표시' 를 켤 뿐,
  값·합치기·내보내기는 건드리지 않습니다. 건수가 들지 않습니다.
★ 패널 그림과 구조를 이 폴더의 focus_probe 에 남깁니다 — 사진으로 보내 주시면 됩니다.
  (서버 PC 는 바탕화면 폴더가 원드라이브 쪽이라 ~/Desktop 이 없었습니다, 2026-11-02)
"""
from __future__ import annotations

import json
import time
from pathlib import Path

from dentbird_macro import alive, attach
from dentbird_params import _open_tool, _q

#: 사용자가 26-27 에서 고른 횡단 7.6 ÷ 그 치아 폭 약 12.3mm (2026-11-02, 한 케이스 값)
WIDTH_RATIO = 0.62

OUT = Path(__file__).resolve().parent / "focus_probe"

# 제목 '치아 초점 보기' 가 든 칸마다, canvas/svg 를 품은 조상까지 올라가 숫자 글자와 위치를 모읍니다
PANELS_JS = r"""
const num = /^-?\d+(\.\d+)?$/;
const out = [];
const leaves = [...document.querySelectorAll('body *')].filter(
  e => e.childElementCount === 0 && (e.textContent || '').includes('치아 초점 보기'));
for (const lab of leaves) {
  let p = lab;
  for (let i = 0; i < 10 && p; i++) {
    if (p.querySelector('canvas, svg')) break;
    p = p.parentElement;
  }
  if (!p) continue;
  const r = p.getBoundingClientRect();
  const texts = [];
  for (const e of p.querySelectorAll('*')) {
    if (e.childElementCount !== 0) continue;
    const t = (e.textContent || '').trim();
    if (!t) continue;
    const b = e.getBoundingClientRect();
    texts.push({t, tag: e.tagName.toLowerCase(), x: b.left + b.width / 2, y: b.top + b.height / 2,
                l: b.left, tp: b.top, w: b.width, h: b.height});
  }
  out.push({
    rect: {l: r.left, t: r.top, w: r.width, h: r.height},
    canvases: [...p.querySelectorAll('canvas')].map(c => {
      const b = c.getBoundingClientRect(); return [c.width, c.height, b.width, b.height]; }),
    svgs: p.querySelectorAll('svg').length,
    numbers: texts.filter(x => num.test(x.t)).length,
    texts,
  });
}
return {dpr: window.devicePixelRatio, panels: out};
"""


def _show_focus(d) -> None:
    """커넥터 패널을 열고 '치아 초점 보기 표시' 가 꺼져 있으면 켭니다"""
    _open_tool(d, "toolbar-tool-connect", "connect-process")
    sw = _q(d, "connect-sub-renderer-switch")
    box = sw.find_elements("css selector", "input[type=checkbox]")
    if box and not box[0].is_selected():
        d.execute_script("arguments[0].click()", box[0])
    time.sleep(2.0)


def _axis(texts: list[dict], key: str, other: str) -> tuple[float, float] | None:
    """한 줄로 늘어선 숫자 눈금(가장 많은 줄)에서 mm = a·px + b 를 맞춥니다. key 는 눈금이 늘어선 방향"""
    import re  # noqa: PLC0415

    nums = [t for t in texts if re.fullmatch(r"-?\d+(\.\d+)?", t["t"])]
    rows: dict[int, list[dict]] = {}
    for t in nums:
        rows.setdefault(round(t[other] / 4), []).append(t)
    if not rows:
        return None
    line = max(rows.values(), key=len)
    if len(line) < 3:
        return None
    xs = [t[key] for t in line]
    ys = [float(t["t"]) for t in line]
    n = len(xs)
    mx, my = sum(xs) / n, sum(ys) / n
    sxx = sum((x - mx) ** 2 for x in xs)
    if sxx == 0:
        return None
    a = sum((x - mx) * (y - my) for x, y in zip(xs, ys)) / sxx
    return a, my - a * mx


def _measure(png: Path, panel: dict, dpr: float) -> dict | None:
    """패널 그림에서 바탕과 다른 픽셀의 가로 덩어리(10px 넘는 줄)를 모아 치아 테두리를 잡고, 눈금으로 mm 로 바꿉니다"""
    try:
        import numpy as np  # noqa: PLC0415
        from PIL import Image  # noqa: PLC0415
    except ImportError:
        return None
    ax = _axis(panel["texts"], "x", "y")
    ay = _axis(panel["texts"], "y", "x")
    if ax is None or ay is None:
        return None
    img = np.asarray(Image.open(png).convert("RGB")).astype(int)
    h, w, _ = img.shape
    r = panel["rect"]
    # 글자·단추 자리는 지웁니다 (제목·치식·눈금·버튼)
    keep = np.ones((h, w), bool)
    for t in panel["texts"]:
        x0, y0 = int((t["l"] - r["l"]) * dpr) - 2, int((t["tp"] - r["t"]) * dpr) - 2
        keep[max(0, y0): y0 + int(t["h"] * dpr) + 4, max(0, x0): x0 + int(t["w"] * dpr) + 4] = False
    # 눈금 숫자 바깥(축 칸)도 지웁니다
    nums = [t for t in panel["texts"] if t["t"].lstrip("-").replace(".", "").isdigit()]
    left = max((t["l"] + t["w"] for t in nums if t["x"] < r["l"] + r["w"] * 0.2), default=r["l"])
    bottom = min((t["tp"] for t in nums if t["y"] > r["t"] + r["h"] * 0.8), default=r["t"] + r["h"])
    keep[:, : int((left - r["l"]) * dpr) + 3] = False
    keep[int((bottom - r["t"]) * dpr) - 3:, :] = False
    bg = np.median(img[keep].reshape(-1, 3), axis=0)
    diff = np.abs(img - bg).sum(axis=2) > 24
    mask = diff & keep
    lefts, rights, ys = [], [], []
    for y in range(h):
        row = mask[y]
        idx = np.flatnonzero(row)
        if len(idx) < 10:
            continue
        # 이어진 덩어리 중 10px 넘는 것만 (격자선·점은 버림)
        cuts = np.flatnonzero(np.diff(idx) > 3)
        starts = np.r_[idx[0], idx[cuts + 1]]
        ends = np.r_[idx[cuts], idx[-1]]
        runs = [(s, e) for s, e in zip(starts, ends) if e - s >= 10]
        if not runs:
            continue
        lefts.append(min(s for s, _ in runs))
        rights.append(max(e for _, e in runs))
        ys.append(y)
    if len(ys) < 5:
        return None
    to_css = lambda px, o: px / dpr + o  # noqa: E731
    x0 = to_css(float(np.percentile(lefts, 1)), r["l"])
    x1 = to_css(float(np.percentile(rights, 99)), r["l"])
    y0, y1 = to_css(float(ys[0]), r["t"]), to_css(float(ys[-1]), r["t"])
    a, _ = ax
    b, _ = ay
    return {"폭mm": round(abs(a) * (x1 - x0), 1), "높이mm": round(abs(b) * (y1 - y0), 1),
            "mm/px": round(abs(a), 4)}


def main() -> int:
    if not alive():
        print("덴트버드 창이 안 떠 있습니다")
        return 1
    d = attach()
    _show_focus(d)
    got = d.execute_script(PANELS_JS)
    OUT.mkdir(exist_ok=True)
    (OUT / "panels.json").write_text(json.dumps(got, ensure_ascii=False, indent=1), encoding="utf-8")
    panels = got.get("panels") or []
    print(f"치아 초점 보기 칸 {len(panels)}개 · 화면 배율 {got.get('dpr')}")
    widths = []
    for i, p in enumerate(panels):
        texts = p["texts"]
        tooth = [t["t"] for t in texts if t["t"].isdigit() and len(t["t"]) == 2]
        print(f"[{i}] 크기 {round(p['rect']['w'])}x{round(p['rect']['h'])} · canvas {p['canvases']} · svg {p['svgs']}"
              f" · 숫자 글자 {p['numbers']}개 · 두 자리 숫자 {tooth[:4]}")
        print("    글자 보기:", " ".join(t["t"] for t in texts[:30]))
        png = OUT / f"panel_{i}.png"
        els = d.find_elements("xpath", "//*[contains(text(),'치아 초점 보기')]")
        if i < len(els):
            box = els[i]
            for _ in range(10):
                if box.find_elements("css selector", "canvas, svg"):
                    break
                box = box.find_element("xpath", "..")
            box.screenshot(str(png))
            m = _measure(png, p, float(got.get("dpr") or 1))
            print("    잰 값:", m if m else "못 잼 (눈금이 글자가 아니거나 그림에서 치아를 못 찾음)")
            if m:
                widths.append(m["폭mm"])
    if widths:
        w = min(widths)
        print(f"작은 쪽 폭 {w}mm → 횡단 {round(w * WIDTH_RATIO, 1)} (비율 {WIDTH_RATIO})")
    print("그림·구조:", OUT)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
