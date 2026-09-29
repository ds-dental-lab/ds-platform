# -*- coding: utf-8 -*-
"""
지그 만들기 (2026-09-29, 사용자 요청).

  exocad 에서 디자인이 끝난 크라운 STL 을 **복사해서**, 인접면이 옆 치아에
  **딱 닿도록(간격 0)** 맞춘 뒤 `<환자명> 지그.stl` 로 저장합니다.

★ 사용자가 고른 방식: "인접치에 닿을 때까지 깎기".
  크라운은 인접면에 보통 몇 십 μm 의 틈을 두고 설계됩니다. 지그는 옆 치아에
  물려 자리를 잡아야 하므로 그 틈을 0 으로 만듭니다.

★ **안쪽(지대치에 앉는 면)은 건드리지 않습니다.**
  스캔에는 옆 치아와 삭제된 지대치가 함께 들어 있습니다. 둘을 가르는 기준은
  '크라운을 위에서 내려다본 발자국' 입니다 — 발자국 **안**은 제 지대치,
  **밖**은 옆 치아·잇몸입니다. 안쪽 점은 아예 안 봅니다.

★ 스캔 점을 격자에 담아 찾습니다(가까운 점 찾기). 11만 점에서도 1초 안팎입니다.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import numpy as np

from mesh_io import load_ply_vertices, save_stl
from stl_render import load_stl

# 인접면으로 볼 거리 — 이보다 멀면 손대지 않습니다 (설계 틈은 보통 0.02~0.1mm)
CONTACT_ZONE_MM = 0.35
# 남길 틈. 0 이면 딱 닿습니다 (사용자 요청)
TARGET_GAP_MM = 0.0


@dataclass
class JigResult:
    out_path: Path
    moved: int
    total: int
    max_move: float
    contact_points: int


def _cross2(a: np.ndarray, b: np.ndarray) -> float:
    """평면에서의 외적 (numpy 2 는 2차원 cross 를 뺐습니다)"""
    return float(a[0] * b[1] - a[1] * b[0])


def _convex_hull_xy(points: np.ndarray) -> np.ndarray:
    """XY 평면의 볼록껍질 (단조 사슬). scipy 없이."""
    p = np.unique(np.round(points[:, :2], 3), axis=0)
    p = p[np.lexsort((p[:, 1], p[:, 0]))]
    if len(p) < 3:
        return p

    def half(seq: np.ndarray) -> list[np.ndarray]:
        out: list[np.ndarray] = []
        for q in seq:
            while len(out) >= 2 and _cross2(out[-1] - out[-2], q - out[-1]) <= 0:
                out.pop()
            out.append(q)
        return out

    lower = half(p)
    upper = half(p[::-1])
    return np.array(lower[:-1] + upper[:-1])


def _inside_polygon(points: np.ndarray, poly: np.ndarray) -> np.ndarray:
    """점이 다각형 안인가 (광선 교차). 벡터로 한 번에."""
    x, y = points[:, 0], points[:, 1]
    inside = np.zeros(len(points), dtype=bool)
    n = len(poly)

    for i in range(n):
        x1, y1 = poly[i]
        x2, y2 = poly[(i + 1) % n]
        crosses = (y1 > y) != (y2 > y)
        with np.errstate(divide="ignore", invalid="ignore"):
            xin = (x2 - x1) * (y - y1) / np.where(y2 - y1 == 0, np.nan, y2 - y1) + x1
        inside ^= crosses & (x < xin)

    return inside


class _Grid:
    """가까운 점 찾기용 격자. cell 보다 먼 것은 안 찾습니다(안 쓰므로)."""

    def __init__(self, points: np.ndarray, cell: float) -> None:
        self.points = points
        self.cell = cell
        keys = np.floor(points / cell).astype(np.int64)
        self.buckets: dict[tuple[int, int, int], np.ndarray] = {}
        order = np.lexsort((keys[:, 2], keys[:, 1], keys[:, 0]))
        keys_sorted = keys[order]
        starts = np.flatnonzero(np.r_[True, np.any(keys_sorted[1:] != keys_sorted[:-1], axis=1)])
        for s, e in zip(starts, np.r_[starts[1:], len(order)]):
            self.buckets[tuple(keys_sorted[s])] = order[s:e]

    def nearest(self, query: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
        """각 query 점의 가장 가까운 점 (거리, 좌표). 못 찾으면 거리 inf."""
        best_d = np.full(len(query), np.inf, dtype=np.float32)
        best_p = np.zeros((len(query), 3), dtype=np.float32)
        base = np.floor(query / self.cell).astype(np.int64)

        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                for dz in (-1, 0, 1):
                    shifted = base + (dx, dy, dz)
                    # 같은 칸끼리 묶어 한 번에 잽니다
                    for key in set(map(tuple, shifted)):
                        idx = self.buckets.get(key)
                        if idx is None:
                            continue
                        rows = np.flatnonzero((shifted == key).all(axis=1))
                        pts = self.points[idx]
                        d = np.linalg.norm(query[rows][:, None, :] - pts[None, :, :], axis=2)
                        j = d.argmin(axis=1)
                        dmin = d[np.arange(len(rows)), j]
                        better = dmin < best_d[rows]
                        best_d[rows[better]] = dmin[better]
                        best_p[rows[better]] = pts[j[better]]

        return best_d, best_p


def pick_scan(case_dir: Path, crown: np.ndarray) -> Path | None:
    """상악·하악 중 크라운이 앉은 쪽. 가까운 점이 많은 쪽을 고릅니다."""
    best: tuple[int, Path] | None = None
    verts = crown.reshape(-1, 3)
    sample = verts[:: max(1, len(verts) // 400)]

    for path in sorted(case_dir.glob("*.ply")):
        low = path.name.lower()
        if "marker" in low or "gingiva" in low:
            continue
        pts = load_ply_vertices(path)
        if len(pts) == 0:
            continue

        # ★ 중심 거리로 고르면 반대 악이 이깁니다 (마주 보는 치아가 더 넓게 깔림).
        #   크라운 **표면에 딱 붙은** 점이 많은 쪽이 이 크라운이 앉은 악입니다.
        thin = pts[:: max(1, len(pts) // 20000)]
        d = np.linalg.norm(thin[:, None, :] - sample[None, :, :], axis=2).min(axis=1)
        near = int((d < 1.0).sum())
        if best is None or near > best[0]:
            best = (near, path)

    return best[1] if best else None


def make_jig(
    design_stl: Path,
    scan_ply: Path,
    out_path: Path,
    contact_zone: float = CONTACT_ZONE_MM,
    gap: float = TARGET_GAP_MM,
) -> JigResult:
    tris = load_stl(design_stl)
    if len(tris) == 0:
        raise ValueError("디자인 파일을 읽지 못했습니다")

    verts = tris.reshape(-1, 3)
    scan = load_ply_vertices(scan_ply)
    if len(scan) == 0:
        raise ValueError("스캔 파일을 읽지 못했습니다")

    # ① 크라운 발자국 안(제 지대치)은 뺍니다 — 인접치만 남깁니다
    hull = _convex_hull_xy(verts)
    outside = ~_inside_polygon(scan, hull)
    # 위아래로 너무 멀리 있는 것도 뺍니다 (반대 악, 잇몸 아래)
    zmin, zmax = verts[:, 2].min() - 3, verts[:, 2].max() + 3
    near_z = (scan[:, 2] > zmin) & (scan[:, 2] < zmax)
    neighbours = scan[outside & near_z]
    if len(neighbours) == 0:
        raise ValueError("인접치 스캔을 찾지 못했습니다")

    # ② 같은 좌표는 한 점으로 묶습니다 — 삼각형마다 복사돼 있어 그대로 두면 틈이 벌어집니다
    keys, inverse = np.unique(np.round(verts, 4), axis=0, return_inverse=True)

    # ③ 점마다 바깥 방향(법선) — 면 법선을 모아 평균
    face_n = np.cross(tris[:, 1] - tris[:, 0], tris[:, 2] - tris[:, 0])
    normals = np.zeros_like(keys)
    for k in range(3):
        np.add.at(normals, inverse.reshape(-1, 3)[:, k], face_n)
    ln = np.linalg.norm(normals, axis=1, keepdims=True)
    normals = normals / np.where(ln == 0, 1, ln)

    # ④ 인접치까지 거리
    grid = _Grid(neighbours, max(contact_zone, 0.2))
    dist, target = grid.nearest(keys)

    to_target = target - keys
    with np.errstate(invalid="ignore", divide="ignore"):
        toward = np.einsum("ij,ij->i", to_target / np.where(dist[:, None] == 0, 1, dist[:, None]), normals)

    """
    ★ 바깥 면만 밉니다. 가까운 점이 **내가 보는 쪽**에 있어야(법선과 같은 방향)
      인접면입니다. 옆에서 스치듯 지나가는 점을 따라가면 면이 찢어집니다.
    ★ 가장자리에서 뚝 끊기지 않게, 가까울수록 1 에서 멀수록 0 으로 부드럽게 섞습니다.
    """
    need = np.clip(np.nan_to_num(dist, posinf=0.0) - gap, 0, None)
    weight = np.clip((contact_zone - dist) / (contact_zone * 0.5), 0, 1)
    weight = np.where((toward > 0.35) & (dist <= contact_zone) & np.isfinite(dist), weight, 0.0)
    amount = need * weight

    # ⑤ 밀어낼 양을 이웃과 고르게 폅니다 (라플라시안) — 톱니 자국을 없앱니다
    edges = np.concatenate(
        [inverse.reshape(-1, 3)[:, [0, 1]], inverse.reshape(-1, 3)[:, [1, 2]], inverse.reshape(-1, 3)[:, [2, 0]]]
    )
    edges = np.concatenate([edges, edges[:, ::-1]])
    counts = np.bincount(edges[:, 0], minlength=len(keys)).astype(np.float32)
    counts[counts == 0] = 1

    for _ in range(6):
        summed = np.bincount(edges[:, 0], weights=amount[edges[:, 1]], minlength=len(keys))
        amount = 0.35 * amount + 0.65 * (summed / counts)

    shifted = keys + normals * amount[:, None]
    moved = shifted[inverse]

    out = moved.reshape(-1, 3, 3)
    save_stl(out_path, out, name="denflow jig")

    return JigResult(
        out_path=out_path,
        moved=int((amount > 1e-4).sum()),
        total=len(verts),
        max_move=float(np.linalg.norm(moved - verts, axis=1).max()) if len(verts) else 0.0,
        contact_points=int(len(neighbours)),
    )
