# -*- coding: utf-8 -*-
"""
새 판을 켜면 **새 쪽이 옛것을 내리고 자리를 잡습니다** (사용자 요청 2026-10-19, 1.3.7).

★ 왜 — 전에는 두 번째로 켠 쪽이 무조건 물러났습니다(두 개가 같이 돌면 같은 스캔을
  둘 다 올리고 출력도 두 번 가서). 그래서 새 판을 깔 때 "끝내기 → 켜기" 를 꼭 해야
  했고, 잊으면 옛 창만 앞으로 올라와 "새로 받았는데 1.3.2 네?" 가 됐습니다.
★ 규칙: 떠 있는 쪽이 **더 옛 판**일 때만 내립니다. 같은 판이면 전처럼 그 창을 앞으로
  올리고 물러납니다(바탕화면 아이콘을 또 누른 경우).
★ 두 길:
  · 1.3.7 이상이 떠 있으면 — 파일로 "자리 넘겨 주세요" 를 적고, 그쪽이 1초 안에 스스로
    정리하고 끝냅니다(곱게).
  · 1.3.6 이하가 떠 있으면 — 그쪽은 이 약속을 모릅니다. 창 제목으로 프로세스를 찾아
    끝냅니다. 올리던 것이 있었다면 다음 차례에 다시 올립니다(서버가 같은 케이스를 압니다).
★ 떠 있는 쪽의 판은 run 파일로 압니다. run 파일이 없으면 1.3.6 이하라는 뜻입니다.
"""

from __future__ import annotations

import json
import os
import time
from pathlib import Path

#: 실행 중인 에이전트가 자기 판·pid 를 적는 곳 / 새 쪽이 "넘겨 달라" 고 적는 곳
RUN_FILE: Path | None = None
TAKEOVER_FILE: Path | None = None
#: 자리를 넘겨받았으면 옛 판 번호 (App 이 기록에 적습니다)
TOOK_OVER: str | None = None

WINDOW_TITLE = "덴플로우 에이전트"


def configure(settings_dir: Path) -> None:
    global RUN_FILE, TAKEOVER_FILE
    RUN_FILE = settings_dir / "scan_agent.run.json"
    TAKEOVER_FILE = settings_dir / "scan_agent.takeover"


def parse_version(v: str) -> tuple[int, ...] | None:
    try:
        parts = tuple(int(p) for p in str(v).strip().split("."))
    except ValueError:
        return None
    return parts if 2 <= len(parts) <= 4 else None


def newer(mine: str, theirs: str | None) -> bool:
    """내 판이 저쪽보다 새로운가. 저쪽을 모르면(None·이상한 값) **새롭다**고 봅니다 — run 파일이
    없는 쪽은 1.3.6 이하라서입니다"""
    a = parse_version(mine)
    b = parse_version(theirs) if theirs else None
    if a is None:
        return False
    if b is None:
        return True
    return a > b


def decide(mine: str, running: dict | None) -> str:
    """'raise'(창만 앞으로) 또는 'takeover'(내리고 자리 잡기)"""
    their = (running or {}).get("version")
    return "takeover" if newer(mine, their) else "raise"


# ---------- run 파일 ----------

def write_run(version: str) -> None:
    if RUN_FILE is None:
        return
    try:
        RUN_FILE.parent.mkdir(parents=True, exist_ok=True)
        RUN_FILE.write_text(json.dumps({"pid": os.getpid(), "version": version, "at": time.time()}), encoding="utf-8")
    except OSError:
        pass


def read_run() -> dict | None:
    if RUN_FILE is None or not RUN_FILE.is_file():
        return None
    try:
        d = json.loads(RUN_FILE.read_text(encoding="utf-8"))
        return d if isinstance(d, dict) else None
    except (OSError, ValueError):
        return None


def clear_run() -> None:
    """내가 적은 것일 때만 지웁니다 — 새 쪽이 이미 적었을 수 있습니다"""
    if RUN_FILE is None:
        return
    try:
        d = read_run()
        if d and d.get("pid") == os.getpid():
            RUN_FILE.unlink(missing_ok=True)
    except OSError:
        pass


# ---------- 곱게 넘기기 (1.3.7 이상끼리) ----------

def request_handoff() -> None:
    if TAKEOVER_FILE is None:
        return
    try:
        TAKEOVER_FILE.parent.mkdir(parents=True, exist_ok=True)
        TAKEOVER_FILE.write_text(str(os.getpid()), encoding="utf-8")
    except OSError:
        pass


def handoff_requested() -> bool:
    """떠 있는 쪽이 1초마다 봅니다. 있으면 지우고 True — 그쪽은 끝냅니다"""
    if TAKEOVER_FILE is None or not TAKEOVER_FILE.is_file():
        return False
    try:
        TAKEOVER_FILE.unlink()
    except OSError:
        pass
    return True


# ---------- 모르는 옛 판 내리기 ----------

def pid_of_window(title: str = WINDOW_TITLE) -> int | None:
    if os.name != "nt":
        return None
    import ctypes
    from ctypes import wintypes

    user32 = ctypes.windll.user32
    hwnd = user32.FindWindowW(None, title)
    if not hwnd:
        return None
    pid = wintypes.DWORD()
    user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))
    return pid.value or None


def terminate(pid: int) -> bool:
    if os.name != "nt" or not pid or pid == os.getpid():
        return False
    import ctypes

    kernel32 = ctypes.windll.kernel32
    PROCESS_TERMINATE = 0x0001
    h = kernel32.OpenProcess(PROCESS_TERMINATE, False, pid)
    if not h:
        return False
    try:
        return bool(kernel32.TerminateProcess(h, 0))
    finally:
        kernel32.CloseHandle(h)


def take_over(mine: str, running: dict | None, try_mutex, wait_s: float = 8.0) -> bool:
    """옛것을 내리고 표(뮤텍스)를 받습니다. try_mutex() 는 표를 받으면 True.

    ★ 먼저 곱게(파일) 청하고 3초 기다립니다. 그래도 안 비면 창으로 프로세스를 찾아 끝냅니다.
    """
    global TOOK_OVER
    request_handoff()
    deadline = time.time() + 3.0
    while time.time() < deadline:
        time.sleep(0.25)
        if try_mutex():
            TOOK_OVER = (running or {}).get("version") or "옛 판"
            return True
    pid = (running or {}).get("pid") or pid_of_window()
    if pid:
        terminate(int(pid))
    deadline = time.time() + (wait_s - 3.0)
    while time.time() < deadline:
        time.sleep(0.25)
        if try_mutex():
            TOOK_OVER = (running or {}).get("version") or "옛 판"
            return True
    return False
