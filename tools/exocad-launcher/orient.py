# -*- coding: utf-8 -*-
"""
출력 방향 맞추기 (2026-10-06).

★ **오르카의 회전 옵션을 쓰지 않습니다.**
  2.4.2 에서 `--rotate-x` / `--rotate-y` 는 동작하지 않습니다 — 실측입니다.
    --rotate 30        → 됩니다 (Z 축)
    --rotate-x 150     → exit 127
    --rotate-x 10      → **세그폴트**
  그래서 메쉬를 **우리가 돌려서** 넘깁니다. 오르카는 자르기만 합니다.

★ 직접 돌리는 편이 오히려 낫습니다.
  - 쓴 각도를 그대로 적어 둘 수 있습니다 (auto_jobs.rotate_x/y/z).
    목표가 "동일한 각도" 인데, 적어 두지 않으면 달라져도 알 수가 없습니다.
  - 돌린 뒤 그림을 뽑아 주문에 붙일 수 있습니다 (stl_render.py).
  - 오르카 판이 올라가도 이 자리는 안 흔들립니다.

★ 돌리는 순서는 **X → Y → Z** 입니다. 순서가 바뀌면 결과가 달라집니다.
  바꾸지 마세요. 바꾸면 지난 케이스와 견줄 수 없게 됩니다.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np

from mesh_io import save_stl
from stl_render import load_stl


def _rx(deg: float) -> np.ndarray:
    t = np.radians(deg)
    c, s = np.cos(t), np.sin(t)
    return np.array([[1, 0, 0], [0, c, -s], [0, s, c]], dtype=np.float64)


def _ry(deg: float) -> np.ndarray:
    t = np.radians(deg)
    c, s = np.cos(t), np.sin(t)
    return np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]], dtype=np.float64)


def _rz(deg: float) -> np.ndarray:
    t = np.radians(deg)
    c, s = np.cos(t), np.sin(t)
    return np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]], dtype=np.float64)


def rotation(rx: float = 0.0, ry: float = 0.0, rz: float = 0.0) -> np.ndarray:
    """X → Y → Z 순서로 돌리는 행렬. 순서를 바꾸지 마세요"""
    return _rz(rz) @ _ry(ry) @ _rx(rx)


def spin(tris: np.ndarray, rx: float = 0.0, ry: float = 0.0, rz: float = 0.0) -> np.ndarray:
    """(면, 3, 3) 을 제 무게중심 기준으로 돌립니다"""
    pts = tris.reshape(-1, 3).astype(np.float64)
    mid = (pts.max(axis=0) + pts.min(axis=0)) / 2
    out = (pts - mid) @ rotation(rx, ry, rz).T + mid
    return out.reshape(tris.shape)


def drop_to_bed(tris: np.ndarray, bed: tuple[float, float] | None = None) -> np.ndarray:
    """
    바닥(z=0)에 내려놓고 판 가운데로 옮깁니다.

    ★ 돌리고 나면 메쉬가 바닥 아래로 내려갑니다. 그대로 넘기면 오르카가
      잠긴 부분을 잘라 버리거나 판 밖이라고 거부합니다.
    ★ `bed` 를 주면 그 가운데로, 안 주면 원점으로 옮깁니다.
    """
    pts = tris.reshape(-1, 3).astype(np.float64)
    lo, hi = pts.min(axis=0), pts.max(axis=0)
    mid = (lo + hi) / 2

    cx, cy = (bed[0] / 2, bed[1] / 2) if bed else (0.0, 0.0)
    shift = np.array([cx - mid[0], cy - mid[1], -lo[2]], dtype=np.float64)
    return (pts + shift).reshape(tris.shape)


def insertion_axis(tris: np.ndarray) -> np.ndarray:
    """
    삽입축을 어림합니다 — 크라운 **내면**이 바라보는 쪽.

    ★ 왜 내면인가: 크라운은 속이 빈 모자입니다. 안쪽 면의 법선을 모으면
      대개 한쪽(삽입 반대쪽)으로 쏠립니다. 그 쏠린 방향이 축입니다.
    ★ 어림입니다. 들어오는 STL 좌표계가 케이스마다 같다면 쓸 일이 없고,
      다를 때만 기준을 세우는 데 씁니다 (2026-10-06 아직 확인 전).
    ★ 면적으로 무게를 줍니다. 잘게 쪼개진 곳이 표를 더 갖지 않게.
    """
    a, b, c = tris[:, 0], tris[:, 1], tris[:, 2]
    n = np.cross(b - a, c - a)
    area = np.linalg.norm(n, axis=1)
    keep = area > 0
    if not keep.any():
        return np.array([0.0, 0.0, 1.0])

    n = n[keep] / area[keep, None]
    mid = tris.reshape(-1, 3).mean(axis=0)
    centers = tris[keep].mean(axis=1)

    # 바깥을 보는 면은 무게중심에서 멀어지는 쪽, 내면은 향하는 쪽
    inward = np.einsum('ij,ij->i', n, centers - mid) < 0
    if not inward.any():
        return np.array([0.0, 0.0, 1.0])

    axis = (n[inward] * area[keep][inward, None]).sum(axis=0)
    ln = np.linalg.norm(axis)
    return axis / ln if ln > 0 else np.array([0.0, 0.0, 1.0])


def place(
    src: Path,
    dst: Path,
    rx: float = 0.0,
    ry: float = 0.0,
    rz: float = 0.0,
    bed: tuple[float, float] | None = None,
) -> dict:
    """
    STL 을 돌려 바닥에 내려놓고 새 STL 로 씁니다.

    돌려주는 것은 **적어 둘 값**입니다 — 어느 각도로 어떻게 놓였는지.
    """
    tris = load_stl(src)
    if len(tris) == 0:
        raise ValueError(f"읽을 면이 없습니다: {src.name}")

    moved = drop_to_bed(spin(tris, rx, ry, rz), bed)
    save_stl(dst, moved.astype(np.float32), "denflow")

    pts = moved.reshape(-1, 3)
    lo, hi = pts.min(axis=0), pts.max(axis=0)
    return {
        "faces": int(len(tris)),
        "rotate_x": float(rx),
        "rotate_y": float(ry),
        "rotate_z": float(rz),
        "size": [round(float(v), 2) for v in (hi - lo)],
        "min": [round(float(v), 2) for v in lo],
        "max": [round(float(v), 2) for v in hi],
    }
