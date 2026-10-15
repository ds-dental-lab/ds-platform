# -*- coding: utf-8 -*-
r"""지켜보기 둘이 **서로를 살립니다** (2026-10-15).

★★ **왜 — 재부팅 뒤 하나만 떴습니다.** 2026-10-15 아침, PC 를 껐다 켜니
  exocad 지켜보기는 떴는데 임시치아 지켜보기는 안 떴습니다. 시작프로그램
  폴더에 둘 다 있고, 윈도우 '시작 앱' 에서 꺼진 것도 아니고, 손으로 돌리면
  멀쩡히 뜹니다. 윈도우 기록에는 시작프로그램 **폴더** 쪽이 안 남아서 왜
  빠졌는지 집을 수가 없었습니다. 치과에서 이러면 **아무 말 없이 임시치아가
  안 나옵니다.**

  원인을 몰라도 살아나야 합니다. 그래서:

  - 돌 때마다 **살아 있다는 표시**(…alive 파일)를 남깁니다.
  - 1분마다 **상대의 표시**를 보고, 3분 넘게 소식이 없으면 상대를 띄웁니다.
  - 그러면 **하나만 떠도 둘 다** 돕니다.

★★ **한 번에 하나만 돕니다** (`single_instance`). 살리다 보면 겹쳐 뜰 수
  있는데, 임시치아 지켜보기가 둘이면 **같은 크라운을 두 번 올립니다.**
  자물쇠를 못 잡으면 조용히 물러납니다.
"""
from __future__ import annotations

import os
import subprocess
import sys
import time
from pathlib import Path

STATE = Path(os.environ.get("APPDATA", Path.home())) / "DenFlow" / "launcher"
STARTUP = Path(os.environ.get("APPDATA", "")) / "Microsoft" / "Windows" / "Start Menu" / "Programs" / "Startup"

#: 지켜보기 이름 → 그것을 띄우는 시작프로그램 vbs
VBS = {
    "exocad_watch": STARTUP / "덴플로우 exocad 지켜보기.vbs",
    "temp_watch": STARTUP / "덴플로우 임시치아 지켜보기.vbs",
    # ★ 설계 일꾼 (2026-10-15) — 셋이 서로를 살립니다
    "design_worker": STARTUP / "덴플로우 설계 일꾼.vbs",
}

#: 상대 소식이 이만큼 없으면 죽은 것으로 봅니다. 돌기 한 바퀴보다 넉넉히 —
#:   AI 자르기·올리기 중에는 한 바퀴가 1분 가까이 걸립니다.
STALE_SECONDS = 180
#: 상대를 얼마나 자주 보나
CHECK_SECONDS = 60

_locks: dict[str, object] = {}
_last_check = 0.0


def single_instance(name: str) -> bool:
    """자물쇠를 잡으면 True. 이미 누가 쥐고 있으면 False — 물러나야 합니다"""
    import msvcrt  # noqa: PLC0415 — 윈도우 전용

    STATE.mkdir(parents=True, exist_ok=True)
    path = STATE / f"{name}.lock"
    f = open(path, "a+b")  # noqa: SIM115 — 프로세스가 사는 동안 쥐고 있어야 합니다
    try:
        f.seek(0)
        msvcrt.locking(f.fileno(), msvcrt.LK_NBLCK, 1)
    except OSError:
        f.close()
        return False
    _locks[name] = f  # ★ 놓치면 GC 가 닫아 자물쇠가 풀립니다
    return True


def beat(name: str) -> None:
    """살아 있다는 표시"""
    try:
        (STATE / f"{name}.alive").write_text(str(time.time()), encoding="utf-8")
    except OSError:
        pass


def _age(name: str) -> float:
    try:
        return time.time() - (STATE / f"{name}.alive").stat().st_mtime
    except OSError:
        return float("inf")


def revive(me: str, say=print) -> None:
    """1분에 한 번, 상대가 죽었으면 띄웁니다"""
    global _last_check
    if time.time() - _last_check < CHECK_SECONDS:
        return
    _last_check = time.time()

    for other, vbs in VBS.items():
        if other == me or _age(other) < STALE_SECONDS:
            continue
        if not vbs.is_file():
            continue
        try:
            subprocess.Popen(["wscript.exe", str(vbs)], close_fds=True)
            say(f"{other} 가 {int(min(_age(other), 9999))}초째 소식이 없어 다시 띄웠습니다")
            # ★ 바로 또 띄우지 않게, 상대가 표시를 남길 틈을 줍니다
            (STATE / f"{other}.alive").write_text(str(time.time()), encoding="utf-8")
        except OSError as e:
            say(f"{other} 를 못 띄웠습니다 — {e}")


if __name__ == "__main__":
    for n in VBS:
        print(f"{n:14} 마지막 소식 {_age(n):.0f}초 전")
    sys.exit(0)
