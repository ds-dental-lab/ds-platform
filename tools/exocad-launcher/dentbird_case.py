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
  그래서 케이스마다 같은 자세이고, **고정 각도**가 그대로 통합니다.
  ★ 그 각도는 `orient.py` 가 한 곳에서 정합니다 (x135 — 실측으로 정한 값).
    여기 숫자를 적어 두면 어느 날 서로 달라집니다. 실제로 그 일이
    났습니다 (2026-10-14, 옛 숫자 x150/y140 을 베껴 한 판을 뽑음).
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


#: 브라우저가 같은 이름을 또 받으면 붙이는 꼬리 — "… (2)"
_COPY = re.compile(r"\s*\(\d+\)$")


def _bare(stem: str) -> str:
    return _COPY.sub("", stem)


def beside(stl: Path) -> Path | None:
    """
    크라운 STL 의 **짝인** `.constructionInfo`. 짝이 없으면 None.

    ★ 이름이 딱 맞지는 않습니다 —
        크라운  …-upperjaw_27-27-crown.stl
        정보    …-upperjaw_27.constructionInfo
      **정보 파일 이름이 크라운 이름의 앞머리**여야 짝입니다.

    ★★★ **짝이 없으면 아무것도 안 줍니다** (2026-10-15 에 고침). 전에는
      맞는 게 없으면 `found[0]` — 폴더에 있던 **아무 정보 파일**이나 줬고,
      하나뿐이면 이름도 안 보고 줬습니다. 실제로 윤기두 16번 크라운이
      크라운만 따로 내보내져 짝이 없었는데, 내려받기 폴더에 있던 **다른
      환자의** 정보 파일을 집어 **치식 37** 로 읽었습니다. 37번 주문이
      기다리고 있었다면 **16번 크라운이 다른 환자 37번 자리로 출력**됐습니다.
      머리글자가 조금 겹치는 것('2026-' 따위)도 짝이 아닙니다.
    """
    want = _bare(stl.stem)
    best: Path | None = None
    for f in stl.parent.glob("*.constructionInfo"):
        head = _bare(f.stem)
        # ★ 앞머리가 맞고, 바로 다음 글자가 이어지는 자리여야 합니다
        #   ('…_2' 가 '…_27-27-crown' 의 짝인 척하지 않게)
        if want.startswith(head) and want[len(head):len(head) + 1] in ("-", "_", ""):
            if best is None or len(_bare(best.stem)) < len(head):
                best = f
    return best


#: 덴트버드 크라운 이름 — `…_16-16-crown`. 앞뒤 번호가 같으면 싱글, 다르면 브릿지(꼬리는 crown 또는 bridge 로 짐작)
#: ★ 브릿지는 범위가 **두 번** 적힙니다 — `…_26-27-26-27-bridge` (2026-10-30 실측, 폰틱 없는 26-27).
#:   맨 뒤의 한 쌍을 읽습니다. 폰틱이 낀 브릿지(25-27)에서 두 쌍이 다른지는 아직 못 봤습니다 —
#:   그래서 정보 파일과 다르면 check() 가 "치식이 서로 다릅니다" 로 멈춥니다.
_NAME_TEETH = re.compile(r"[_-]([1-4][1-8])-([1-4][1-8])-(?:crown|bridge)$", re.IGNORECASE)


def teeth_from_name(stl: Path) -> list[int]:
    """
    파일 이름에 적힌 치식. 못 읽으면 빈 목록.

    ★ 덴트버드가 크라운 이름에 치식을 적어 줍니다 (`…_16-16-crown.stl`).
      정보 파일이 같이 안 오는 날(크라운만 골라 내보낼 때)에도 이것은 남습니다.
    ★ 앞뒤 번호가 다르면 브릿지입니다 — 덴트버드 화면이 "브릿지 25-27" 로 부르는 범위
      (2026-10-28 실측). 그 사이 이를 FDI 순서로 **전부** 폅니다 (25-27 → 25·26·27,
      13-23 → 13·12·11·21·22·23). 내보낸 파일의 꼬리(crown/bridge)는 아직 못 봐서 둘 다 받습니다.
    """
    m = _NAME_TEETH.search(_bare(stl.stem))
    if not m:
        return []
    return fdi_range(int(m.group(1)), int(m.group(2)))


def fdi_range(a: int, b: int) -> list[int]:
    """FDI 번호 a 에서 b 까지 이가 놓인 순서대로 — 같은 사분면이면 번호 차례, 정중선을 넘으면
    1번끼리 맞닿습니다(13 → 12 → 11 → 21 → 22 → 23). 위아래를 넘는 범위는 브릿지가 아니라 빈 목록."""
    if a == b:
        return [a]
    qa, qb = a // 10, b // 10
    if qa == qb:
        lo, hi = sorted((a, b))
        return list(range(lo, hi + 1))
    # 정중선을 넘는 짝은 (1,2) 또는 (3,4) 뿐
    if {qa, qb} not in ({1, 2}, {3, 4}):
        return []
    left, right = (a, b) if qa in (1, 3) else (b, a)   # 1·3 사분면 쪽이 '왼쪽' (환자 기준 오른쪽)
    lq, rq = left // 10, right // 10
    return list(range(left, lq * 10, -1)) + list(range(rq * 10 + 1, right + 1))


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
    named = teeth_from_name(stl)
    info = beside(stl)

    if not info:
        # ★ 정보 파일이 없으면 **이름에서** 읽습니다. 자세(CAM 축)는 대조를
        #   못 합니다 — 그 사실을 말해 둡니다. 조용히 넘어가면 대조가 된
        #   줄로 압니다.
        if named:
            return Check(True, f"치식 {named} (파일 이름에서 · 자세 대조는 못 함)", named)
        return Check(True, "치식 정보 파일이 없어 대조하지 못했습니다", [])

    case = read(info)
    if not case.teeth:
        if named:
            return Check(True, f"치식 {named} (파일 이름에서 · 정보 파일을 못 읽음)", named)
        return Check(True, "치식 정보를 읽지 못했습니다", [])

    # ★★ 근거가 둘이면 **둘이 맞아야** 합니다. 다르면 어느 한쪽이 틀린 것이고,
    #   어느 쪽인지 기계가 정할 수 없습니다 — 사람이 봅니다.
    if named and sorted(named) != case.numbers:
        return Check(
            False,
            f"치식이 서로 다릅니다 — 파일 이름 {named} · 정보 파일 {case.numbers}",
            case.numbers,
        )

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
