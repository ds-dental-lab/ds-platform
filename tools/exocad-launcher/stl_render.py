# -*- coding: utf-8 -*-
"""
STL 을 화면 없이 그림으로 (2026-09-28).

★ 3D 라이브러리를 안 씁니다. OpenGL 을 쓰는 것들(pyrender·vtk·moderngl)은
  원격/헤드리스에서 화면 잡기에 실패하는 일이 잦고, 설치도 무겁습니다.
  여기서는 numpy 로 직접 그립니다 — 삼각형을 면적만큼 점으로 흩뿌리고
  z 버퍼로 앞의 것만 남기는 방식이라, 반복문 없이 한 번에 끝납니다.

★ 크라운 하나가 보통 7만 면인데 여섯 방향을 1초 안에 그립니다.
"""

from __future__ import annotations

import struct
from pathlib import Path

import numpy as np
from PIL import Image

# 여섯 방향 — 이름은 종이에 그대로 찍힙니다
VIEWS: list[tuple[str, tuple[float, float]]] = [
    ("위", (0.0, 0.0)),
    ("아래", (180.0, 0.0)),
    ("앞", (90.0, 0.0)),
    ("뒤", (-90.0, 180.0)),
    ("왼쪽", (90.0, 90.0)),
    ("오른쪽", (90.0, -90.0)),
]


def load_stl(path: Path) -> np.ndarray:
    """(면 수, 3, 3) 꼭짓점 배열. 이진·아스키 둘 다."""
    raw = path.read_bytes()
    if len(raw) < 84:
        return np.zeros((0, 3, 3), dtype=np.float32)

    count = struct.unpack("<I", raw[80:84])[0]
    if 84 + count * 50 == len(raw):  # 이진
        data = np.frombuffer(raw, dtype=np.uint8, count=count * 50, offset=84).reshape(count, 50)
        tris = data[:, 12:48].copy().view("<f4").reshape(count, 3, 3)
        return np.asarray(tris, dtype=np.float32)

    # 아스키
    nums: list[float] = []
    for line in raw.decode("utf-8", "ignore").splitlines():
        s = line.strip()
        if s.startswith("vertex"):
            nums.extend(float(x) for x in s.split()[1:4])
    arr = np.asarray(nums, dtype=np.float32)
    return arr[: len(arr) // 9 * 9].reshape(-1, 3, 3)


def _rotation(elev_deg: float, azim_deg: float) -> np.ndarray:
    e, a = np.radians(elev_deg), np.radians(azim_deg)
    rz = np.array([[np.cos(a), -np.sin(a), 0], [np.sin(a), np.cos(a), 0], [0, 0, 1]], dtype=np.float32)
    rx = np.array([[1, 0, 0], [0, np.cos(e), -np.sin(e)], [0, np.sin(e), np.cos(e)]], dtype=np.float32)
    return rx @ rz


def render(tris: np.ndarray, elev: float, azim: float, size: int = 360, scale: float | None = None) -> Image.Image:
    """한 방향에서 본 회색 음영 그림. scale 을 주면 여섯 장의 크기를 맞출 수 있습니다.

    ★ 두 배로 그린 뒤 줄입니다 — 점이 성기게 박힌 자리(구멍)가 메워지고 가장자리도 부드러워집니다.
    """
    if len(tris) == 0:
        return Image.fromarray(np.full((size, size), 255, dtype=np.uint8))
    big = _render_raw(tris, elev, azim, size * 2, scale)
    return Image.fromarray(big).resize((size, size), Image.LANCZOS)


def _render_raw(tris: np.ndarray, elev: float, azim: float, size: int, scale: float | None) -> np.ndarray:

    v = tris.reshape(-1, 3) @ _rotation(elev, azim).T
    v = v.reshape(-1, 3, 3)

    center = (v.reshape(-1, 3).min(0) + v.reshape(-1, 3).max(0)) / 2
    v = v - center
    span = float(np.abs(v[:, :, :2]).max()) * 2 or 1.0
    px_per_unit = (size * 0.86) / (scale or span)

    xy = v[:, :, :2] * px_per_unit + size / 2
    z = v[:, :, 2]

    # 면 법선 → 빛 (앞에서 비추고 살짝 위)
    n = np.cross(v[:, 1] - v[:, 0], v[:, 2] - v[:, 0])
    ln = np.linalg.norm(n, axis=1, keepdims=True)
    n = n / np.where(ln == 0, 1, ln)
    light = np.array([0.35, 0.35, 0.87], dtype=np.float32)
    shade = np.clip(np.abs(n @ light), 0, 1) * 0.72 + 0.2

    # 삼각형마다 면적만큼 점을 흩뿌립니다 (반복문 없이)
    area = np.abs(
        (xy[:, 1, 0] - xy[:, 0, 0]) * (xy[:, 2, 1] - xy[:, 0, 1])
        - (xy[:, 2, 0] - xy[:, 0, 0]) * (xy[:, 1, 1] - xy[:, 0, 1])
    ) / 2
    counts = np.clip(np.ceil(area * 3.0).astype(np.int64), 1, 900)
    idx = np.repeat(np.arange(len(tris)), counts)

    rng = np.random.default_rng(7)
    r1 = np.sqrt(rng.random(len(idx), dtype=np.float32))
    r2 = rng.random(len(idx), dtype=np.float32)
    w0 = (1 - r1)[:, None]
    w1 = (r1 * (1 - r2))[:, None]
    w2 = (r1 * r2)[:, None]

    pts = xy[idx, 0] * w0 + xy[idx, 1] * w1 + xy[idx, 2] * w2
    depth = z[idx, 0] * w0[:, 0] + z[idx, 1] * w1[:, 0] + z[idx, 2] * w2[:, 0]

    xi = np.clip(pts[:, 0].astype(np.int32), 0, size - 1)
    yi = np.clip((size - pts[:, 1]).astype(np.int32), 0, size - 1)
    flat = yi.astype(np.int64) * size + xi

    # z 버퍼 — 가장 앞(=z 큰) 것만 남깁니다
    best = np.full(size * size, -np.inf, dtype=np.float32)
    np.maximum.at(best, flat, depth)
    keep = depth >= best[flat]

    out = np.full(size * size, 255, dtype=np.uint8)
    out[flat[keep]] = np.clip(shade[idx[keep]] * 255, 0, 255).astype(np.uint8)
    return out.reshape(size, size)


def render_six_tris(tris: np.ndarray, size: int = 360) -> list[tuple[str, Image.Image]]:
    """여섯 방향. 크기를 서로 맞춰 한 줄에 놓았을 때 들쭉날쭉하지 않습니다."""
    if len(tris) == 0:
        return []
    pts = tris.reshape(-1, 3)
    span = float((pts.max(0) - pts.min(0)).max()) or 1.0
    return [(name, render(tris, e, a, size, scale=span)) for name, (e, a) in VIEWS]


def render_six(path: Path, size: int = 360) -> list[tuple[str, Image.Image]]:
    return render_six_tris(load_stl(path), size)
