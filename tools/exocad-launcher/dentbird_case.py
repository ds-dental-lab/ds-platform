# -*- coding: utf-8 -*-
"""
덴트버드가 크라운 옆에 끼워 주는 `.constructionInfo` 읽기 (2026-10-07).

덴트버드 내보내기 한 벌은 이렇게 나옵니다:

    2026-08-21_차정순-upperjaw.stl              상악 스캔
    2026-08-21_차정순-lowerjaw.stl              하악 스캔
    2026-08-21_차정순-upperjaw_27-27-crown.stl  크라운
    2026-08-21_차정순-upperjaw_27.constructionInfo
    27-Margin.vtp                               마진 선

★★ **치식이 이 파일에 적혀 있습니다.** 그래서 사람 눈으로 견주지 않아도
  됩니다 — 덴트버드가 잡은 치식과 주문서 치식을 **기계가 대조**합니다.
  자동 판별이 좋은 기능이지만 틀렸을 때 아무도 모르는 것이 위험합니다.

★★ **삽입축도 적혀 있습니다.** 「CAM 축에 좌표 정렬」을 켜고 내보내면
  Axis 가 (0, 0, 1) 로 나옵니다 — 크라운이 **삽입축이 +Z 인 자세**로
  정렬돼 나온다는 뜻입니다(실측 2026-10-07, 차정순 27번).
  그래서 케이스마다 같은 자세이고, 고정 각도(x150/y140)가 그대로 통합니다.
  축이 +Z 가 아니면 그 토글이 꺼진 채 내보낸 것이라 **멈춰야** 합니다.

★ 쓰지 않는 것: 마진 선(Vec3 1156개)·핀·디자인 수치. 읽을 수는 있지만
  출력에는 필요 없어서 건드리지 않습니다.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path

#: 축이 +Z 에서 이만큼 넘게 틀어져 있으면 CAM 정렬이 꺼진 것으로 봅니다
AXIS_TOLERANCE_DEG = 5.0

_NUM = r"[-+0-9.eE]+"


@dataclass
class Tooth:
    number: int
    #: 삽입축. CAM 정렬을 켜면 (0, 0, 1)
    axis: tuple[float, float, float] = (0.0, 0.0, 1.0)


@dataclass
class DentbirdCase:
    teeth: list[Tooth] = field(default_factory=list)
    #: 파일 이름 → 그 파일이 담은 치식들
    files: dict[str, list[int]] = field(default_factory=dict)

    @property
    def numbers(self) -> list[int]:
        return sorted({t.number for t in self.teeth})

    def axis_off_by(self) -> float:
        """삽입축이 +Z 에서 몇 도 틀어져 있나 (가장 많이 틀어진 이)"""
        import math

        worst = 0.0
        for t in self.teeth:
            x, y, z = t.axis
            length = math.sqrt(x * x + y * y + z * z)
            if length == 0:
                continue
            cos = min(1.0, abs(z) / length)
            worst = max(worst, math.degrees(math.acos(cos)))
        return worst

    def cam_aligned(self) -> bool:
        """「CAM 축에 좌표 정렬」을 켜고 내보냈는가"""
        return bool(self.teeth) and self.axis_off_by() <= AXIS_TOLERANCE_DEG


def _vec(block: str, tag: str) -> tuple[float, float, float] | None:
    m = re.search(
        rf"<{tag}>\s*<x>({_NUM})</x>\s*<y>({_NUM})</y>\s*<z>({_NUM})</z>\s*</{tag}>",
        block,
        re.S,
    )
    return (float(m.group(1)), float(m.group(2)), float(m.group(3))) if m else None


def read(path: Path) -> DentbirdCase:
    """
    `.constructionInfo` 하나를 읽습니다.

    ★ XML 이지만 **정규식으로 읽습니다.** 마진 점이 1156개라 트리로 올리면
      쓰지도 않을 것에 메모리를 씁니다. 우리가 보는 것은 앞쪽 몇 줄뿐입니다.
    """
    text = path.read_text(encoding="utf-8", errors="replace")
    case = DentbirdCase()

    # 이 하나하나 — 번호와 축
    for block in re.findall(r"<Tooth>(.*?)</Tooth>", text, re.S):
        m = re.search(r"<Number>\s*(\d+)\s*</Number>", block)
        if not m:
            continue
        axis = _vec(block, "Axis") or (0.0, 0.0, 1.0)
        case.teeth.append(Tooth(number=int(m.group(1)), axis=axis))

    # 어느 파일이 어느 이를 담았나 (크라운이 여럿일 때 가립니다)
    for block in re.findall(r"<ConstructionFile>(.*?)</ConstructionFile>", text, re.S):
        name = re.search(r"<Filename>(.*?)</Filename>", block, re.S)
        if not name:
            continue
        nums = [int(n) for n in re.findall(r"<int>\s*(\d+)\s*</int>", block)]
        case.files[name.group(1).strip()] = nums

    return case


def beside(stl: Path) -> Path | None:
    """
    크라운 STL 옆의 `.constructionInfo` 를 찾습니다.

    ★ 이름이 딱 맞지는 않습니다 —
        크라운  …-upperjaw_27-27-crown.stl
        정보    …-upperjaw_27.constructionInfo
      그래서 같은 폴더에서 **머리글자가 겹치는 것**을 고릅니다.
    """
    folder = stl.parent
    found = sorted(folder.glob("*.constructionInfo"))
    if not found:
        return None
    if len(found) == 1:
        return found[0]

    stem = stl.stem
    best, score = None, 0
    for f in found:
        n = 0
        for a, b in zip(stem, f.stem):
            if a != b:
                break
            n += 1
        if n > score:
            best, score = f, n
    return best or found[0]


@dataclass
class Check:
    ok: bool
    message: str
    teeth: list[int] = field(default_factory=list)


def check(stl: Path, want: list[int] | None = None) -> Check:
    """
    크라운 STL 하나를 보내도 되는지 봅니다.

    ★ 정보 파일이 **없으면 막지 않습니다.** 사람이 크라운만 따로 옮겨
      놓았을 수 있습니다 — 그때는 대조를 못 할 뿐입니다. 다만 그 사실을
      말해 줍니다. 조용히 넘어가면 대조가 되는 줄로 알게 됩니다.
    """
    info = beside(stl)
    if not info:
        return Check(True, "치식 정보 파일이 없어 대조하지 못했습니다", [])

    case = read(info)
    if not case.teeth:
        return Check(True, "치식 정보를 읽지 못했습니다", [])

    if not case.cam_aligned():
        return Check(
            False,
            "「CAM 축에 좌표 정렬」을 켜고 다시 내보내 주세요 "
            f"(삽입축이 {case.axis_off_by():.0f}° 틀어져 있습니다)",
            case.numbers,
        )

    got = case.numbers
    if want is not None and sorted(want) != got:
        return Check(
            False,
            f"치식이 다릅니다 — 주문서 {sorted(want)} · 디자인 {got}",
            got,
        )

    return Check(True, f"치식 {got} 확인", got)
