# -*- coding: utf-8 -*-
"""
출력판 **자리 돌리기** (사용자 2026-10-21 "안 비웠는데 비웠습니다 누르면?").

★ A1 mini 는 판 위에 뭐가 남았는지 모릅니다. 「비웠습니다」는 사람의 확인일 뿐이라,
  안 비우고 누르면 노즐이 같은 자리(판 가운데)의 옛 크라운에 부딪힙니다.
★ 그래서 크라운을 **매번 다른 자리**에 놓습니다. 여섯 자리를 돌아가며 쓰고,
  이어지는 두 자리는 멀리 떨어뜨려 두어(≥35mm) 바로 앞 것이 남아 있어도 안 겹칩니다.
  여섯 번 연속 안 비워야 비로소 겹칩니다.
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

#: 판 위 자리(mm, 180×180 A1 mini). 이어지는 둘은 서로 35mm 넘게 떨어져 있습니다.
#: 가장자리는 비워 둡니다 — 앞쪽(Y<10)은 과잉 압출 선, 뒤쪽(Y>170)은 노즐 닦기 자리입니다.
SLOTS: tuple[tuple[float, float], ...] = (
    (90.0, 70.0),
    (55.0, 110.0),
    (125.0, 70.0),
    (90.0, 110.0),
    (55.0, 70.0),
    (125.0, 110.0),
)

#: 과잉 압출 선을 X 로 얼마나 옮길지. 원래 선은 X68→115 (앞쪽 가운데).
#: -45 면 X23→70(왼쪽), +45 면 X113→160(오른쪽). 판(180) 안입니다.
PURGE_SHIFTS: tuple[float, ...] = (0.0, -45.0, 45.0)

STATE_FILE = Path(os.environ.get("APPDATA", Path.home())) / "DenFlow" / "plate_slot.json"

#: 자리와 선이 같이 처음으로 돌아오는 주기 (6 과 3 의 최소공배수)
CYCLE = math.lcm(len(SLOTS), len(PURGE_SHIFTS))


@dataclass(frozen=True)
class Slot:
    index: int  # 0부터, SLOTS 안의 번호
    x: float
    y: float
    purge_dx: float

    @property
    def label(self) -> str:
        col = {55.0: "왼쪽", 90.0: "가운데", 125.0: "오른쪽"}.get(self.x, "")
        row = {70.0: "앞", 110.0: "뒤"}.get(self.y, "")
        return f"자리 {self.index + 1}/{len(SLOTS)} ({row}{col})"


def slot_at(n: int) -> Slot:
    """n번째(0부터) 차례의 자리. 돌아가므로 몇이든 됩니다"""
    i = n % len(SLOTS)
    x, y = SLOTS[i]
    return Slot(i, x, y, PURGE_SHIFTS[n % len(PURGE_SHIFTS)])


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
