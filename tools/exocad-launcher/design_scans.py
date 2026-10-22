# -*- coding: utf-8 -*-
"""
주문의 스캔 묶음에서 덴트버드에 올릴 두 개를 고릅니다 (2026-10-15).

    작업치 턱(지대치가 있는 쪽) + 대합치 턱

★ 이름으로 고릅니다. 스캐너마다 이름이 다릅니다 (실제로 본 것):
    exocad     …PreparationScan.stl / …AntagonistScan.stl   ← 이름이 곧 역할
    메디트·3Shape  Maxilla_Base.stl / Mandible_Base.stl / Occlusion_FirstBase.stl
    그 밖      upperjaw / lowerjaw, 상악 / 하악
  역할 이름(Preparation·Antagonist)이 있으면 그대로 씁니다. 없으면 **치식으로**
  턱을 정합니다 — 17 이면 위턱이 작업치, 아래턱이 대합치.
★ 교합 스캔(Occlusion·Bite·Buccal)은 안 올립니다. 턱 둘이면 덴트버드가 맞춥니다.
★ 같은 이름의 stl 과 ply 가 함께 오면 stl 을 씁니다.
★ **애매하면 고르지 않습니다.** 위턱 후보가 둘이면 멈추고 까닭을 돌려줍니다 —
  엉뚱한 턱을 올리면 덴트버드가 엉뚱한 이를 설계합니다.
"""

from __future__ import annotations

import re
import zipfile
from pathlib import Path

#: ★ obj 도 받습니다 (2026-10-22) — 메딧 Link 의 기본 내보내기가 obj 입니다. 올리기 전에
#:   STL 로 바꿉니다(to_stl) — 설계 서비스가 obj 를 받는지에 기대지 않습니다.
SCAN_EXT = (".stl", ".ply", ".obj")
#: exocad 전용 묶음 — 안의 턱 파일이 전용 형식이라 임시치아 설계에 못 씁니다
DXD_EXT = ".dxd"

PREP = re.compile(r"preparation|(^|[^a-z])prep([^a-z]|$)", re.I)
ANTAGONIST = re.compile(r"antagonist", re.I)
# ★ 메딧 기본 이름은 '…-maxillary' / '…-mandibular' (2026-10-22 시험에서 'mandible' 만 보던
#   탓에 아래턱을 못 찾았음). 어근(maxill·mandib)으로 봅니다.
UPPER = re.compile(r"maxill|upper|상악", re.I)
LOWER = re.compile(r"mandib|lower|하악", re.I)
# ★ 잇몸 분리(gingiva)·삭제 전(preop/situ) 스캔도 뺍니다 (2026-10-22) — DS Core 내보내기가
#   '-upperjaw-gingiva.ply' 를 같이 주면 위턱 후보가 둘이 되어 멈췄습니다.
SKIP = re.compile(r"occlusion|bite|buccal|교합|gingiva|preop|pre-op|situ", re.I)


class PickError(Exception):
    """어느 파일을 올릴지 못 정했습니다 — 사람이 볼 차례입니다"""


def is_upper(tooth: int) -> bool:
    return tooth // 10 in (1, 2, 5, 6)


def unzip_all(folder: Path) -> None:
    """폴더 안 zip 을 그 자리에 풉니다. 바깥으로 새는 경로는 막습니다"""
    for z in list(folder.rglob("*.zip")):
        out = z.with_suffix("")
        out.mkdir(exist_ok=True)
        with zipfile.ZipFile(z) as zf:
            for m in zf.infolist():
                target = (out / m.filename).resolve()
                if not str(target).startswith(str(out.resolve())):
                    raise PickError(f"zip 안에 바깥을 가리키는 경로가 있습니다: {m.filename}")
            zf.extractall(out)


def ensure_meshes(folder: Path, folder_name: str, say=print) -> list[Path]:
    """
    시로나 dxd 만 온 주문을 위해 — **DS Core 에서 ply 로 바꿔** 폴더에 둡니다 (2026-10-22).

    ★ dxd 안의 턱은 RSA 로 잠겨 있어(client "SIR") 우리가 못 풉니다. 크라운 쪽 exocad 런처가
      2026-09-10 부터 쓰던 길(dscore.convert: DS Core 에 올려 exocad 용 ply 로 받기)을 그대로
      씁니다. 치과는 dxd 한 번만 내보내고, 크라운은 dxd(색 있음)로, 임시치아는 이 ply 로.
    ★ stl·ply·obj 가 하나라도 있으면 아무것도 안 합니다 — DS Core 왕복(3~5분)은 꼭 필요할 때만.
    ★ 서버 PC 에 DS Core 계정(settings.json)이 없으면 분명한 말로 멈춥니다.
    """
    meshes = [p for p in folder.rglob("*") if p.is_file() and p.suffix.lower() in SCAN_EXT]
    if meshes:
        return meshes
    dxds = sorted(p for p in folder.rglob("*") if p.is_file() and p.suffix.lower() == DXD_EXT)
    if not dxds:
        return meshes
    import dscore  # noqa: PLC0415

    if not dscore.has_settings():
        raise PickError(
            "스캔이 exocad 묶음(dxd)뿐인데 이 PC 에 DS Core 계정이 없어 STL 로 못 바꿉니다 — "
            "서버 PC 에서 setup_server.py 의 DS Core 단계를 해 주세요"
        )
    say(f"dxd 를 DS Core 에서 ply 로 바꾸는 중 (3~5분) — {dxds[0].name}")
    placed = dscore.convert(dxds[0], folder, folder_name, "", "", say=say)
    say(f"바꿨습니다 — {', '.join(p.name for p in placed)}")
    return [p for p in folder.rglob("*") if p.is_file() and p.suffix.lower() in SCAN_EXT]


def candidates(folder: Path) -> list[Path]:
    """올릴 만한 스캔들 — 교합 스캔 빼고, 같은 이름이면 stl 우선

    ★ dxd 만 있으면 바로 멈춥니다 (2026-10-22 확인). dxd 는 zip 이지만 안의 UpperJaw·LowerJaw 가
      exocad 전용 형식(STL·PLY 아님)이라 꺼내 써도 설계 서비스가 못 읽습니다.
    """
    found = [p for p in folder.rglob("*") if p.is_file() and p.suffix.lower() in SCAN_EXT]
    if not found and any(p.suffix.lower() == DXD_EXT for p in folder.rglob("*") if p.is_file()):
        raise PickError(
            "스캔이 exocad 묶음(dxd)뿐입니다 — 임시치아 설계에는 STL·PLY·OBJ 가 필요합니다. "
            "스캐너에서 STL 로 내보내 다시 올려 주세요"
        )
    found = [p for p in found if not SKIP.search(p.stem)]
    by_stem: dict[str, Path] = {}
    for p in sorted(found, key=lambda x: (x.suffix.lower() != ".stl", str(x))):
        by_stem.setdefault(p.stem.lower(), p)
    return sorted(by_stem.values())


def pick(files: list[Path], tooth: int) -> tuple[Path, Path]:
    """(작업치 턱, 대합치 턱)"""
    def only(group: list[Path], what: str) -> Path:
        if len(group) == 1:
            return group[0]
        if not group:
            raise PickError(f"{what} 스캔을 못 찾았습니다 — 파일: {', '.join(p.name for p in files) or '없음'}")
        raise PickError(f"{what} 스캔 후보가 {len(group)}개입니다 — {', '.join(p.name for p in group)}")

    prep = [p for p in files if PREP.search(p.stem)]
    anta = [p for p in files if ANTAGONIST.search(p.stem)]
    if prep or anta:
        return only(prep, "작업치(Preparation)"), only(anta, "대합치(Antagonist)")

    upper = [p for p in files if UPPER.search(p.stem) and not LOWER.search(p.stem)]
    lower = [p for p in files if LOWER.search(p.stem) and not UPPER.search(p.stem)]
    up, low = only(upper, "위턱"), only(lower, "아래턱")
    return (up, low) if is_upper(tooth) else (low, up)


# ---------------------------------------------------------------- obj → stl

def to_stl(path: Path) -> Path:
    """
    올리기 전에 STL 로 맞춥니다. stl·ply 는 그대로, obj 는 옆에 같은 이름의 .stl 로 바꿔 둡니다.

    ★ 메딧 obj 는 'v x y z' 와 'f a b c' 뿐입니다(재질·텍스처 참조는 무시). 면이 네 점 이상이면
      부채꼴로 삼각형을 냅니다. 색·법선은 버립니다 — 설계에 필요 없습니다.
    ★ 이미 바꿔 둔 .stl 이 있으면 다시 안 바꿉니다.
    """
    if path.suffix.lower() != ".obj":
        return path
    out = path.with_suffix(".stl")
    if out.exists() and out.stat().st_mtime >= path.stat().st_mtime:
        return out

    import numpy as np  # noqa: PLC0415
    from mesh_io import save_stl  # noqa: PLC0415

    verts: list[tuple[float, float, float]] = []
    faces: list[tuple[int, int, int]] = []
    with path.open("r", encoding="utf-8", errors="replace") as f:
        for line in f:
            if line.startswith("v "):
                parts = line.split()
                verts.append((float(parts[1]), float(parts[2]), float(parts[3])))
            elif line.startswith("f "):
                idx = [int(tok.split("/")[0]) for tok in line.split()[1:]]
                idx = [i - 1 if i > 0 else len(verts) + i for i in idx]
                for k in range(1, len(idx) - 1):
                    faces.append((idx[0], idx[k], idx[k + 1]))
    if not verts or not faces:
        raise PickError(f"obj 를 읽지 못했습니다 — {path.name} (점 {len(verts)}, 면 {len(faces)})")
    v = np.asarray(verts, dtype=np.float32)
    tris = v[np.asarray(faces, dtype=np.int64)]
    save_stl(out, tris, "denflow")
    return out
