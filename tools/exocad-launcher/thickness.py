# -*- coding: utf-8 -*-
"""크라운 STL 의 벽 두께 — 자르기 전에 재서 기록에 남깁니다 (2026-10-28).

    python thickness.py <크라운.stl>

★★ 왜 — 27번 PLA 출력품에 구멍이 났는데 메쉬는 멀쩡했습니다(닫힘, 열린 모서리 0).
  두께를 재 보니 0.45mm 아래가 0.5%, 0.8mm 아래가 18% 였습니다. 0.4 노즐은 선폭이
  약 0.42mm 라 그 아래는 한 줄도 못 깔고, 벽 두 줄(wall_loops 2)에는 0.84mm 가
  필요합니다. **구멍은 메쉬가 아니라 두께에서 났습니다.** 그래서 자르기 전에 재고,
  얇은 곳이 있으면 기록에 남겨 출력물이 이상할 때 바로 까닭을 알게 합니다.

★ numpy 만 씁니다 — 서버 PC 에 trimesh 가 없습니다 (setup_server.cmd: requests selenium numpy pillow).
  삼각형 무게중심 몇천 점에서 **안쪽으로** 광선을 쏘아 맞은편 면까지의 거리를 잽니다
  (Möller–Trumbore, 묶음으로 벡터 계산). 4만 면 STL 에 2천 점이면 몇 초입니다.
★ 막지 않습니다. 얇다고 멈추면 사람이 매번 봐야 하는데, 지금은 **알리는 것**이 목적입니다.
  막을지는 몇 건 기록을 본 뒤 정합니다.
"""
from __future__ import annotations

import sys
import time
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np

#: 0.4 노즐 선폭 — 이 아래는 슬라이서가 한 줄도 못 깝니다
LINE_WIDTH = 0.42
#: 벽 두 줄 — 프로파일 wall_loops 2
TWO_WALLS = 0.84
#: 기록에 쓰는 문턱들
THRESHOLDS = (0.45, 0.6, 0.8)
#: 광선 수 — 더 많으면 정확하지만 느립니다
SAMPLES = 2000
#: 자기 면을 다시 맞히지 않게 띄우는 거리
EPS = 1e-4
#: 이보다 얇은 곳이 이 비율을 넘으면 '구멍 날 수 있음' 으로 적습니다
WARN_BELOW = LINE_WIDTH
WARN_FRACTION = 0.005


@dataclass
class Thickness:
    samples: int
    minimum: float
    median: float
    #: 문턱 → 그 아래 비율 (0~1)
    below: dict[float, float] = field(default_factory=dict)
    #: 선폭(LINE_WIDTH) 아래 비율 — 이게 구멍의 기준입니다
    below_line: float = 0.0
    seconds: float = 0.0

    def risky(self) -> bool:
        """선폭 아래가 WARN_FRACTION 을 넘는가 — 출력물에 구멍이 날 수 있는 두께"""
        return self.below_line > WARN_FRACTION

    def describe(self) -> str:
        parts = [f"두께 최소 {self.minimum:.2f}mm · 중앙 {self.median:.2f}mm"]
        parts += [f"{t:.2f} 미만 {self.below[t] * 100:.1f}%" for t in sorted(self.below)]
        line = " · ".join(parts)
        if self.risky():
            line += f" — ★ 선폭({LINE_WIDTH}mm) 아래가 있어 출력물에 구멍이 날 수 있습니다"
        return line


def _normals(tris: np.ndarray) -> np.ndarray:
    n = np.cross(tris[:, 1] - tris[:, 0], tris[:, 2] - tris[:, 0])
    length = np.linalg.norm(n, axis=1)
    length[length == 0] = 1.0
    return n / length[:, None]


def cast(tris: np.ndarray, origins: np.ndarray, dirs: np.ndarray, chunk: int = 48) -> np.ndarray:
    """광선마다 처음 맞는 면까지의 거리. 안 맞으면 inf"""
    v0 = tris[:, 0].astype(np.float64)
    e1 = (tris[:, 1] - tris[:, 0]).astype(np.float64)
    e2 = (tris[:, 2] - tris[:, 0]).astype(np.float64)
    out = np.full(len(origins), np.inf)
    for s in range(0, len(origins), chunk):
        o = origins[s:s + chunk, None, :].astype(np.float64)   # (r,1,3)
        d = dirs[s:s + chunk, None, :].astype(np.float64)
        p = np.cross(d, e2[None])                              # (r,f,3)
        det = np.einsum("rfj,fj->rf", p, e1)
        ok = np.abs(det) > 1e-12
        inv = np.where(ok, 1.0 / np.where(ok, det, 1.0), 0.0)
        t_vec = o - v0[None]
        u = np.einsum("rfj,rfj->rf", t_vec, p) * inv
        q = np.cross(t_vec, e1[None])
        v = np.einsum("rfj,rfj->rf", q, d) * inv
        t = np.einsum("fj,rfj->rf", e2, q) * inv
        hit = ok & (u >= 0) & (v >= 0) & (u + v <= 1) & (t > EPS)
        t = np.where(hit, t, np.inf)
        out[s:s + chunk] = t.min(axis=1)
    return out


def measure(tris: np.ndarray, samples: int = SAMPLES, seed: int = 0) -> Thickness:
    """면 무게중심에서 안쪽으로 쏜 광선의 길이 분포"""
    t0 = time.time()
    if len(tris) == 0:
        return Thickness(0, 0.0, 0.0, {t: 0.0 for t in THRESHOLDS})
    rng = np.random.default_rng(seed)
    idx = rng.choice(len(tris), min(samples, len(tris)), replace=False)
    nrm = _normals(tris)[idx]
    cen = tris[idx].mean(axis=1)
    # ★ 바깥을 향한 법선의 반대로 쏩니다 — STL 의 법선은 보통 바깥을 봅니다.
    #   뒤집힌 면이면 바깥으로 쏘아 안 맞고(inf) 빠집니다 — 그런 점은 세지 않습니다.
    dist = cast(tris, cen, -nrm)
    good = dist[np.isfinite(dist)]
    if len(good) == 0:
        return Thickness(0, 0.0, 0.0, {t: 0.0 for t in THRESHOLDS}, time.time() - t0)
    # ★ 딱 문턱과 같은 두께(0.8 벽을 0.8 문턱에)는 '미만' 이 아닙니다 — 부동소수 오차만큼 봐줍니다
    below = {t: float((good < t - 1e-6).mean()) for t in THRESHOLDS}
    below_line = float((good < WARN_BELOW - 1e-6).mean())
    return Thickness(int(len(good)), float(good.min()), float(np.median(good)), below, below_line, time.time() - t0)


def measure_file(stl: Path, samples: int = SAMPLES) -> Thickness:
    from stl_render import load_stl  # noqa: PLC0415

    return measure(load_stl(stl), samples)


def main(argv: list[str] | None = None) -> int:
    args = sys.argv[1:] if argv is None else argv
    if not args:
        print(__doc__)
        return 2
    th = measure_file(Path(args[0]))
    print(th.describe(), f"({th.samples}점, {th.seconds:.1f}초)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
