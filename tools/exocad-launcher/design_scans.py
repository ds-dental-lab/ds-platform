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

SCAN_EXT = (".stl", ".ply")

PREP = re.compile(r"preparation|(^|[^a-z])prep([^a-z]|$)", re.I)
ANTAGONIST = re.compile(r"antagonist", re.I)
UPPER = re.compile(r"maxilla|upper|상악", re.I)
LOWER = re.compile(r"mandible|lower|하악", re.I)
SKIP = re.compile(r"occlusion|bite|buccal|교합", re.I)


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


def candidates(folder: Path) -> list[Path]:
    """올릴 만한 스캔들 — 교합 스캔 빼고, 같은 이름이면 stl 우선"""
    found = [p for p in folder.rglob("*") if p.is_file() and p.suffix.lower() in SCAN_EXT]
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
