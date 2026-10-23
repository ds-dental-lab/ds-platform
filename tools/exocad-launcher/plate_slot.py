# -*- coding: utf-8 -*-
"""
출력판 **자리 돌리기** (사용자 2026-10-21 "안 비웠는데 비웠습니다 누르면?").

★ A1 mini 는 판 위에 뭐가 남았는지 모릅니다. 「비웠습니다」는 사람의 확인일 뿐이라,
  안 비우고 누르면 노즐이 같은 자리(판 가운데)의 옛 크라운에 부딪힙니다.
★ 그래서 크라운을 **매번 다른 자리**에 놓습니다. 스무 자리를 돌아가며 쓰고,
  이어지는 두 자리는 멀리 떨어뜨려 두어(≥45mm) 바로 앞 것이 남아 있어도 안 겹칩니다.
★★ **판 전체를 고르게** 씁니다 (사용자 2026-10-23 "배드 한곳에만 출력하면 접지력이
  약해져서 균등하게 해야 해"). 처음 여섯 자리는 판 가운데 70×40mm 에만 몰려 그 자리
  표면만 닳았습니다. 이제 5열×4행, 판 130×105mm 에 고르게 퍼집니다.
★ 시작 때 앞쪽 가장자리(Y≈-2.5)에 긋는 **과잉 압출 선**도 같은 자리에 겹쳐 쌓였습니다
  (사용자 "저번엔 겹쳐져서 나온 것 같았어"). 그 선은 세 자리를 돌립니다 — 판 앞쪽
  가운데·왼쪽·오른쪽.
★ 어디까지 돌았는지는 이 PC 의 작은 파일에 적습니다. 서버는 모릅니다 — 몰라도
  됩니다. 파일이 없거나 깨졌으면 첫 자리부터 다시 돕니다.
"""
from __future__ import annotations

import json
import math
import os
from dataclasses import dataclass
from pathlib import Path

#: 판 위 줄과 칸(mm, 180×180 A1 mini) — 5열 × 4행 = 20자리 (2026-10-23)
#: 가장자리는 비워 둡니다 — 앞쪽(Y<10)은 과잉 압출 선, 뒤쪽(Y>170)은 노즐 닦기 자리,
#: 양옆은 크라운 반 폭(≈7mm)에 여유를 둡니다.
COLS: tuple[float, ...] = (25.0, 57.5, 90.0, 122.5, 155.0)
ROWS: tuple[float, ...] = (35.0, 70.0, 105.0, 140.0)  # 앞 → 뒤

#: 돌리는 **순서**. 이어지는 둘은 ≥47.8mm, 최근 세 자리끼리도 ≥32.5mm 떨어지게 골랐습니다
#: (스크래치 계산 — 바로 앞과 멀리, 그다음 최근 셋과 멀리). 고리로 돌아 20 → 1 도 멉니다.
SLOTS: tuple[tuple[float, float], ...] = (
    (57.5, 35.0),
    (155.0, 140.0),
    (25.0, 140.0),
    (155.0, 35.0),
    (25.0, 35.0),
    (122.5, 140.0),
    (90.0, 70.0),
    (25.0, 105.0),
    (155.0, 70.0),
    (90.0, 140.0),
    (90.0, 35.0),
    (25.0, 70.0),
    (155.0, 105.0),
    (57.5, 140.0),
    (122.5, 35.0),
    (57.5, 70.0),
    (122.5, 105.0),
    (57.5, 105.0),
    (122.5, 70.0),
    (90.0, 105.0),
)

#: 과잉 압출 선 **코스** (시작 X, 시작 Y, 세로인가) — 길이 47mm (2026-10-23)
#: 사용자 "압출선도 모서리 쪽으로 여러 코스". 앞쪽 띠 가로 6개(세 칸 × 두 줄) +
#: 양옆 가장자리 세로 4개(X4·X176 × 앞 반·뒤 반). 크라운 자리(X 18~162, Y 28~147)와 안 겹칩니다.
#: 가로 셋은 끝이 안 닿게 X15·68·121 (옛 23·68·113 은 끝이 2mm 겹쳤습니다).
#: 순서는 이어지는 둘이 멀리 — 앞 가운데 → 왼쪽 뒤 → 오른쪽 앞 → …
PURGE_COURSES: tuple[tuple[float, float, bool], ...] = (
    (68.0, -2.5, False),   # 앞 가운데 (원래 자리)
    (4.0, 95.0, True),     # 왼쪽 가장자리 뒤쪽 반 (Y95→142)
    (176.0, 45.0, True),   # 오른쪽 가장자리 앞쪽 반 (Y45→92)
    (15.0, 4.0, False),    # 앞 왼쪽 둘째 줄 (X15→62)
    (121.0, -2.5, False),  # 앞 오른쪽 (X121→168)
    (4.0, 45.0, True),     # 왼쪽 가장자리 앞쪽 반
    (176.0, 95.0, True),   # 오른쪽 가장자리 뒤쪽 반
    (68.0, 4.0, False),    # 앞 가운데 둘째 줄
    (15.0, -2.5, False),   # 앞 왼쪽
    (121.0, 4.0, False),   # 앞 오른쪽 둘째 줄
)
#: 옛 이름 — 가로 코스의 X 옮김 (시험·옛 호출용)
PURGE_SHIFTS: tuple[float, ...] = tuple(x - 68.0 for x, y, v in PURGE_COURSES if not v and y == -2.5)

STATE_FILE = Path(os.environ.get("APPDATA", Path.home())) / "DenFlow" / "plate_slot.json"

#: 자리와 선이 같이 처음으로 돌아오는 주기 (20 과 10 의 최소공배수 = 20)
CYCLE = math.lcm(len(SLOTS), len(PURGE_COURSES))


@dataclass(frozen=True)
class Slot:
    index: int  # 0부터, SLOTS 안의 번호
    x: float
    y: float
    purge: tuple[float, float, bool]

    @property
    def purge_dx(self) -> float:
        """옛 이름 — 가로 코스면 X 옮김, 세로면 0"""
        x, _, vertical = self.purge
        return 0.0 if vertical else x - 68.0

    @property
    def label(self) -> str:
        # 앞에서 몇째 줄, 왼쪽에서 몇째 칸 — 판을 앞에서 보는 사람 눈으로
        row = ROWS.index(self.y) + 1 if self.y in ROWS else 0
        col = COLS.index(self.x) + 1 if self.x in COLS else 0
        return f"자리 {self.index + 1}/{len(SLOTS)} (앞에서 {row}줄 · 왼쪽에서 {col}칸)"


def slot_at(n: int) -> Slot:
    """n번째(0부터) 차례의 자리. 돌아가므로 몇이든 됩니다"""
    i = n % len(SLOTS)
    x, y = SLOTS[i]
    return Slot(i, x, y, PURGE_COURSES[n % len(PURGE_COURSES)])


def take(state: Path = STATE_FILE) -> Slot:
    """다음 자리를 꺼내고 **한 칸 넘깁니다**. 파일이 없거나 깨졌으면 처음부터"""
    n = 0
    try:
        got = json.loads(state.read_text(encoding="utf-8"))
        n = int(got.get("next", 0))
    except (OSError, ValueError, AttributeError):
        n = 0
    if n < 0:
        n = 0
    slot = slot_at(n)
    try:
        state.parent.mkdir(parents=True, exist_ok=True)
        state.write_text(json.dumps({"next": (n + 1) % CYCLE}), encoding="utf-8")
    except OSError:
        pass  # 못 적으면 다음에도 같은 자리 — 멈출 일은 아닙니다
    return slot
