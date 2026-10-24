# -*- coding: utf-8 -*-
"""
PTFE 튜브 멈춤 클립 (사용자 2026-10-24) — 건조기 출구로 튜브가 빨려 들어가는 것을 막습니다.

★ 튜브 2.5 내경 × 4 외경. 옆에서 **딸깍 끼우는 C 클립**이라 튜브를 빼지 않고 답니다.
  클립 몸통(얇은 고리)이 튜브를 물고, 아래 넓은 날개(플랜지)가 건조기 출구에 걸려
  더 못 들어갑니다. 건조기 바깥에서 출구 바로 앞에 끼웁니다.
★ 구멍이 너무 헐겁거나 빡빡할 수 있어 세 가지로 만듭니다 — 3.8 · 3.9 · 4.0mm.
  셋 다 뽑아 보고 손으로 끼웠을 때 튜브를 당겨도 안 밀리는 것을 쓰면 됩니다.

    python make_tube_stop.py           → 같은 폴더에 tube_stop_3.8.stl 등 셋
"""
from __future__ import annotations

import math
import struct
from pathlib import Path

#: 옆 틈 — 4mm 튜브가 밀고 들어가며 벌려 끼워집니다
SLOT = 3.0
#: 클립 고리 두께·높이, 날개 지름·두께
RING_WALL = 1.4
RING_TOP = 10.0
FLANGE_R = 9.0
FLANGE_H = 2.2
SEGMENTS = 96


def c_shape(r_in: float, r_out: float) -> tuple[list, list]:
    """옆 틈(평행)을 뺀 고리 — 바깥 호와 안쪽 호를 같은 개수로 (z 없이)"""
    a_out = math.asin((SLOT / 2) / r_out)
    a_in = math.asin((SLOT / 2) / r_in)
    outer, inner = [], []
    for i in range(SEGMENTS + 1):
        t = i / SEGMENTS
        ao = a_out + t * (2 * math.pi - 2 * a_out)
        ai = a_in + t * (2 * math.pi - 2 * a_in)
        outer.append((r_out * math.cos(ao), r_out * math.sin(ao)))
        inner.append((r_in * math.cos(ai), r_in * math.sin(ai)))
    return outer, inner


def extrude(outer: list, inner: list, z0: float, z1: float) -> list:
    """C 모양을 z0→z1 로 밀어 닫힌 입체의 삼각형들"""
    tris = []
    n = len(outer)

    def P(p, z):
        return (p[0], p[1], z)

    for i in range(n - 1):
        o0, o1, i0, i1 = outer[i], outer[i + 1], inner[i], inner[i + 1]
        # 윗면(+z) · 아랫면(-z)
        tris += [(P(o0, z1), P(o1, z1), P(i1, z1)), (P(o0, z1), P(i1, z1), P(i0, z1))]
        tris += [(P(o0, z0), P(i1, z0), P(o1, z0)), (P(o0, z0), P(i0, z0), P(i1, z0))]
        # 바깥 벽 · 안쪽 벽
        tris += [(P(o0, z0), P(o1, z0), P(o1, z1)), (P(o0, z0), P(o1, z1), P(o0, z1))]
        tris += [(P(i0, z0), P(i1, z1), P(i1, z0)), (P(i0, z0), P(i0, z1), P(i1, z1))]
    # 틈의 두 마구리 — 면이 **입체 바깥(틈 쪽)** 을 보게 방향을 맞춥니다
    for o, i_, inward in ((outer[0], inner[0], outer[1]), (outer[-1], inner[-1], outer[-2])):
        a = [P(o, z0), P(i_, z0), P(i_, z1), P(o, z1)]
        q = [(a[0], a[1], a[2]), (a[0], a[2], a[3])]
        nx, ny, _ = normal(q[0])
        if nx * (inward[0] - o[0]) + ny * (inward[1] - o[1]) > 0:
            q = [(x, z, y) for x, y, z in q]
        tris += q
    return tris


def normal(t) -> tuple:
    (ax, ay, az), (bx, by, bz), (cx, cy, cz) = t
    ux, uy, uz = bx - ax, by - ay, bz - az
    vx, vy, vz = cx - ax, cy - ay, cz - az
    nx, ny, nz = uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx
    m = math.sqrt(nx * nx + ny * ny + nz * nz) or 1.0
    return nx / m, ny / m, nz / m


def write_stl(path: Path, tris: list) -> None:
    with open(path, "wb") as f:
        f.write(b"DenFlow tube stop".ljust(80, b" "))
        f.write(struct.pack("<I", len(tris)))
        for t in tris:
            f.write(struct.pack("<3f", *normal(t)))
            for v in t:
                f.write(struct.pack("<3f", *v))
            f.write(b"\0\0")


def make(bore: float) -> list:
    r_in = bore / 2
    ring_out = r_in + RING_WALL
    flange = extrude(*c_shape(r_in, FLANGE_R), 0.0, FLANGE_H)
    # 고리는 날개와 0.2 겹쳐 슬라이서가 하나로 합칩니다
    ring = extrude(*c_shape(r_in, ring_out), FLANGE_H - 0.2, RING_TOP)
    return flange + ring


def main() -> None:
    here = Path(__file__).resolve().parent
    for bore in (3.8, 3.9, 4.0):
        out = here / f"tube_stop_{bore:.1f}.stl"
        write_stl(out, make(bore))
        print("만듦", out.name)


if __name__ == "__main__":
    main()
