# -*- coding: utf-8 -*-
"""
STL·PLY 읽고 쓰기 (2026-09-29).

★ 3D 라이브러리를 안 씁니다 — 런처의 다른 모듈과 같은 원칙입니다.
  exocad 가 내놓는 것만 읽으면 됩니다: 이진 STL, 이진/아스키 PLY(꼭짓점+면).
"""

from __future__ import annotations

import struct
from pathlib import Path

import numpy as np

from stl_render import load_stl  # STL 읽기는 여기 있습니다


def save_stl(path: Path, tris: np.ndarray, name: str = "denflow") -> None:
    """이진 STL. tris = (면, 3, 3)"""
    tris = np.asarray(tris, dtype=np.float32)
    n = np.cross(tris[:, 1] - tris[:, 0], tris[:, 2] - tris[:, 0])
    ln = np.linalg.norm(n, axis=1, keepdims=True)
    n = n / np.where(ln == 0, 1, ln)

    with open(path, "wb") as f:
        f.write(name.encode("ascii", "ignore")[:80].ljust(80, b"\0"))
        f.write(struct.pack("<I", len(tris)))
        block = np.zeros((len(tris), 50), dtype=np.uint8)
        block[:, 0:12] = n.astype("<f4").view(np.uint8).reshape(-1, 12)
        block[:, 12:48] = tris.astype("<f4").view(np.uint8).reshape(-1, 36)
        f.write(block.tobytes())


def load_ply_vertices(path: Path) -> np.ndarray:
    """PLY 의 꼭짓점 좌표만. 색·법선은 건너뜁니다 (인접치 위치만 필요합니다)."""
    raw = path.read_bytes()
    end = raw.find(b"end_header")
    if end < 0:
        return np.zeros((0, 3), dtype=np.float32)

    header = raw[:end].decode("ascii", "ignore").splitlines()
    body = raw[raw.find(b"\n", end) + 1 :]

    fmt = "ascii"
    count = 0
    props: list[tuple[str, str]] = []
    in_vertex = False

    for line in header:
        parts = line.split()
        if not parts:
            continue
        if parts[0] == "format":
            fmt = parts[1]
        elif parts[0] == "element":
            in_vertex = parts[1] == "vertex"
            if in_vertex:
                count = int(parts[2])
        elif parts[0] == "property" and in_vertex and parts[1] != "list":
            props.append((parts[1], parts[2]))

    if count == 0:
        return np.zeros((0, 3), dtype=np.float32)

    if fmt == "ascii":
        rows = []
        for line in body.decode("ascii", "ignore").splitlines()[:count]:
            p = line.split()
            if len(p) >= 3:
                rows.append([float(p[0]), float(p[1]), float(p[2])])
        return np.asarray(rows, dtype=np.float32)

    sizes = {"float": 4, "float32": 4, "double": 8, "uchar": 1, "uint8": 1, "char": 1,
             "int8": 1, "short": 2, "ushort": 2, "int": 4, "uint": 4, "int32": 4, "uint32": 4}
    kinds = {"float": "f4", "float32": "f4", "double": "f8", "uchar": "u1", "uint8": "u1",
             "char": "i1", "int8": "i1", "short": "i2", "ushort": "u2", "int": "i4",
             "uint": "u4", "int32": "i4", "uint32": "u4"}

    little = fmt.endswith("little_endian")
    order = "<" if little else ">"
    dtype = np.dtype([(f"p{i}", order + kinds.get(t, "f4")) for i, (t, _) in enumerate(props)])
    stride = sum(sizes.get(t, 4) for t, _ in props)
    data = np.frombuffer(body, dtype=dtype, count=min(count, len(body) // stride))

    names = [n for _, n in props]
    ix, iy, iz = names.index("x"), names.index("y"), names.index("z")
    return np.stack([data[f"p{ix}"], data[f"p{iy}"], data[f"p{iz}"]], axis=1).astype(np.float32)


def load_ply_mesh(path: Path) -> tuple[np.ndarray, np.ndarray]:
    """PLY 의 꼭짓점과 면. 면은 삼각형만 (사각형은 둘로 쪼갭니다).

    ★ 날개를 만들려면 옆 치아 **면**이 필요합니다 — 점만으로는 두께를 세울 수 없습니다.
    """
    verts = load_ply_vertices(path)
    raw = path.read_bytes()
    end = raw.find(b"end_header")
    if end < 0 or len(verts) == 0:
        return verts, np.zeros((0, 3), dtype=np.int64)

    header = raw[:end].decode("ascii", "ignore").splitlines()
    body = raw[raw.find(b"\n", end) + 1 :]

    fmt = "ascii"
    counts: dict[str, int] = {}
    props: dict[str, list[tuple[str, str]]] = {}
    current = ""

    for line in header:
        parts = line.split()
        if not parts:
            continue
        if parts[0] == "format":
            fmt = parts[1]
        elif parts[0] == "element":
            current = parts[1]
            counts[current] = int(parts[2])
            props[current] = []
        elif parts[0] == "property" and current:
            props[current].append((parts[1], " ".join(parts[2:])))

    face_count = counts.get("face", 0)
    if face_count == 0:
        return verts, np.zeros((0, 3), dtype=np.int64)

    if fmt == "ascii":
        lines = body.decode("ascii", "ignore").splitlines()
        faces = []
        for line in lines[counts.get("vertex", 0) : counts.get("vertex", 0) + face_count]:
            p = [int(x) for x in line.split()]
            if not p:
                continue
            if p[0] == 3:
                faces.append(p[1:4])
            elif p[0] == 4:
                faces.extend([[p[1], p[2], p[3]], [p[1], p[3], p[4]]])
        return verts, np.asarray(faces, dtype=np.int64)

    # 이진 — 꼭짓점 블록을 건너뛰고 면을 읽습니다
    sizes = {"float": 4, "float32": 4, "double": 8, "uchar": 1, "uint8": 1, "char": 1,
             "int8": 1, "short": 2, "ushort": 2, "int": 4, "uint": 4, "int32": 4, "uint32": 4}
    vstride = sum(sizes.get(t, 4) for t, _ in props.get("vertex", []))
    offset = counts.get("vertex", 0) * vstride

    order = "<" if fmt.endswith("little_endian") else ">"
    faces = []
    pos = offset
    for _ in range(face_count):
        n = body[pos]
        pos += 1
        idx = np.frombuffer(body, dtype=order + "i4", count=n, offset=pos)
        pos += 4 * n
        if n == 3:
            faces.append(idx.tolist())
        elif n == 4:
            faces.extend([[idx[0], idx[1], idx[2]], [idx[0], idx[2], idx[3]]])

    return verts, np.asarray(faces, dtype=np.int64)
