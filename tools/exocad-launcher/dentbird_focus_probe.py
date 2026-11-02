# -*- coding: utf-8 -*-
r"""'치아 초점 보기' 눈금으로 크라운 폭경을 재 봅니다 — 떠 있는 덴트버드 창에서 (2026-11-02).

    python dentbird_focus_probe.py

★ 왜: 커넥터 횡단을 치아 크기로 정하려고 합니다 (사용자 2026-11-02 "밑에 치아 초점 보기에 숫자들이 표기가
  되어 있으니 저 숫자들로 크라운 폭경을 체크하고"). 눈금이 글자(DOM)인지 그림인지부터 모릅니다.
★ 크라운을 고른 상태(합치기 전)에서 돌립니다. 커넥터 패널과 '치아 초점 보기 표시' 를 켤 뿐,
  값·합치기·내보내기는 건드리지 않습니다. 건수가 들지 않습니다.
★ 패널 그림과 구조를 이 폴더의 focus_probe 에 남깁니다 — 사진으로 보내 주시면 됩니다.
  (서버 PC 는 바탕화면 폴더가 원드라이브 쪽이라 ~/Desktop 이 없었습니다, 2026-11-02)
★ 첫 실행(2026-11-02): 제목 글자에서 위로 올라가며 찾았더니 제목 줄(120x24)과 커넥터 패널만 잡혔습니다.
  이제는 화면의 canvas 를 다 모아, 큰 3D 화면을 뺀 작은 canvas 를 치아 칸으로 보고 그 둘레 글자를 모읍니다.
"""
from __future__ import annotations

import json
import re
import time
from pathlib import Path

from dentbird_macro import alive, attach
from dentbird_params import _open_tool, _q

#: 사용자가 26-27 에서 고른 횡단 7.6 ÷ 그 치아 폭 약 12.3mm (2026-11-02, 한 케이스 값)
WIDTH_RATIO = 0.62

OUT = Path(__file__).resolve().parent / "focus_probe"

NUM = re.compile(r"-?\d+(\.\d+)?")

# 화면의 canvas 전부와, 보이는 글자(맨 끝 요소, svg text 포함) 전부를 위치와 함께 모읍니다
SCAN_JS = r"""
const canvases = [...document.querySelectorAll('canvas')].map(c => {
  const b = c.getBoundingClientRect();
  return {l: b.left, t: b.top, w: b.width, h: b.height, pw: c.width, ph: c.height};
}).filter(c => c.w > 0 && c.h > 0);
const texts = [];
for (const e of document.querySelectorAll('body *')) {
  if (e.childElementCount !== 0) continue;
  const t = (e.textContent || '').trim();
  if (!t || t.length > 12) continue;
  const b = e.getBoundingClientRect();
  if (b.width === 0 || b.height === 0) continue;
  texts.push({t, tag: e.tagName.toLowerCase(), x: b.left + b.width / 2, y: b.top + b.height / 2,
              l: b.left, tp: b.top, w: b.width, h: b.height});
}
return {dpr: window.devicePixelRatio, vw: innerWidth, vh: innerHeight, canvases, texts};
"""


def _show_focus(d) -> None:
    """커넥터 패널을 열고 '치아 초점 보기 표시' 가 꺼져 있으면 켭니다"""
    _open_tool(d, "toolbar-tool-connect", "connect-process")
    sw = _q(d, "connect-sub-renderer-switch")
    box = sw.find_elements("css selector", "input[type=checkbox]")
    if box and not box[0].is_selected():
        d.execute_script("arguments[0].click()", box[0])
    time.sleep(2.0)


def _near(texts: list[dict], r: dict, pad: float = 40) -> list[dict]:
    return [t for t in texts
            if r["l"] - pad <= t["x"] <= r["l"] + r["w"] + pad and r["t"] - pad <= t["y"] <= r["t"] + r["h"] + pad]


def _axis(texts: list[dict], key: str, other: str) -> tuple[float, float] | None:
    """한 줄로 늘어선 숫자 눈금(가장 많은 줄)에서 mm = a·px + b 를 맞춥니다. key 는 눈금이 늘어선 방향"""
    nums = [t for t in texts if NUM.fullmatch(t["t"])]
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


def _measure(img, r: dict, texts: list[dict], dpr: float) -> dict | str:
    """칸 그림에서 바탕과 다른 픽셀의 가로 덩어리(10px 넘는 줄)를 모아 치아 테두리를 잡고, 눈금으로 mm 로 바꿉니다"""
    import numpy as np  # noqa: PLC0415

    ax = _axis(texts, "x", "y")
    ay = _axis(texts, "y", "x")
    if ax is None or ay is None:
        return "눈금 숫자를 글자로 못 찾음"
    x0c, y0c = int(r["l"] * dpr), int(r["t"] * dpr)
    sub = img[y0c: y0c + int(r["h"] * dpr), x0c: x0c + int(r["w"] * dpr)].astype(int)
    h, w, _ = sub.shape
    keep = np.ones((h, w), bool)
    for t in texts:  # 글자·단추 자리는 지웁니다 (제목·치식·눈금)
        a0, b0 = int((t["l"] - r["l"]) * dpr) - 3, int((t["tp"] - r["t"]) * dpr) - 3
        keep[max(0, b0): max(0, b0 + int(t["h"] * dpr) + 6), max(0, a0): max(0, a0 + int(t["w"] * dpr) + 6)] = False
    nums = [t for t in texts if NUM.fullmatch(t["t"])]
    left = max((t["l"] + t["w"] for t in nums if t["x"] < r["l"] + r["w"] * 0.2), default=r["l"])
    bottom = min((t["tp"] for t in nums if t["y"] > r["t"] + r["h"] * 0.8), default=r["t"] + r["h"])
    keep[:, : max(0, int((left - r["l"]) * dpr) + 3)] = False
    keep[max(0, int((bottom - r["t"]) * dpr) - 3):, :] = False
    if not keep.any():
        return "칸 안에 그림 자리가 없음"
    bg = np.median(sub[keep].reshape(-1, 3), axis=0)
    mask = (np.abs(sub - bg).sum(axis=2) > 24) & keep
    lefts, rights, ys = [], [], []
    for y in range(h):
        idx = np.flatnonzero(mask[y])
        if len(idx) < 10:
            continue
        cuts = np.flatnonzero(np.diff(idx) > 3)  # 이어진 덩어리 중 10px 넘는 것만 (격자선·점은 버림)
        runs = [(s, e) for s, e in zip(np.r_[idx[0], idx[cuts + 1]], np.r_[idx[cuts], idx[-1]]) if e - s >= 10]
        if runs:
            lefts.append(min(s for s, _ in runs))
            rights.append(max(e for _, e in runs))
            ys.append(y)
    if len(ys) < 5:
        return "그림에서 치아를 못 찾음"
    px_w = (float(np.percentile(rights, 99)) - float(np.percentile(lefts, 1))) / dpr
    px_h = (ys[-1] - ys[0]) / dpr
    return {"폭mm": round(abs(ax[0]) * px_w, 1), "높이mm": round(abs(ay[0]) * px_h, 1),
            "눈금mm/px": [round(abs(ax[0]), 4), round(abs(ay[0]), 4)]}


def main() -> int:
    if not alive():
        print("덴트버드 창이 안 떠 있습니다")
        return 1
    d = attach()
    _show_focus(d)
    got = d.execute_script(SCAN_JS)
    OUT.mkdir(exist_ok=True)
    (OUT / "scan.json").write_text(json.dumps(got, ensure_ascii=False, indent=1), encoding="utf-8")
    png = OUT / "screen.png"
    png.write_bytes(d.get_screenshot_as_png())
    dpr = float(got.get("dpr") or 1)
    canvases = sorted(got.get("canvases") or [], key=lambda c: c["w"] * c["h"], reverse=True)
    texts = got.get("texts") or []
    print(f"화면 {got.get('vw')}x{got.get('vh')} · 배율 {dpr} · canvas {len(canvases)}개 · 글자 {len(texts)}개"
          f" · 숫자 글자 {sum(1 for t in texts if NUM.fullmatch(t['t']))}개")
    for c in canvases:
        print(f"  canvas 자리 ({round(c['l'])},{round(c['t'])}) 크기 {round(c['w'])}x{round(c['h'])}")
    try:
        import numpy as np  # noqa: PLC0415
        from PIL import Image  # noqa: PLC0415

        img = np.asarray(Image.open(png).convert("RGB"))
    except ImportError:
        img = None
    widths = []
    for i, c in enumerate(canvases[1:]):  # 가장 큰 것은 3D 화면
        near = _near(texts, c)
        nums = [t["t"] for t in near if NUM.fullmatch(t["t"])]
        print(f"[{i}] 크기 {round(c['w'])}x{round(c['h'])} · 둘레 숫자 {len(nums)}개: {' '.join(nums[:24])}")
        if img is None:
            print("    잰 값: 못 잼 (numpy/PIL 없음)")
            continue
        m = _measure(img, c, near, dpr)
        print("    잰 값:", m)
        if isinstance(m, dict):
            widths.append(m["폭mm"])
    if len(canvases) < 2:
        bottom = [t["t"] for t in texts if NUM.fullmatch(t["t"]) and t["y"] > (got.get("vh") or 0) * 0.5]
        print("작은 canvas 가 없습니다 — 화면 아래쪽 숫자 글자:", " ".join(bottom[:40]))
    if widths:
        w = min(widths)
        print(f"작은 쪽 폭 {w}mm → 횡단 {round(w * WIDTH_RATIO, 1)} (비율 {WIDTH_RATIO})")
    print("그림·구조:", OUT)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
