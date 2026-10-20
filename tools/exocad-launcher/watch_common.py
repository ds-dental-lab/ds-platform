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

#: ★ '이미 누가 돌고 있어 물러납니다' 의 종료 코드 (2026-10-16). 시작프로그램 vbs 는
#:   이걸 받으면 **스스로 끝납니다** — 안 그러면 다시 띄울 때마다 반복기가 하나씩
#:   늘어, 10초마다 띄웠다 물러나기를 끝없이 되풀이했습니다(한때 여섯 개).
ALREADY_RUNNING = 3


def log_to_crash(name: str) -> None:
    """표준 출력·오류를 `{name}-crash.txt` 에 **나눠 쓸 수 있게** 붙입니다 (2026-10-16)

    ★★ 전에는 시작프로그램이 `cmd /c python … >> crash.txt` 로 이었습니다. cmd 는
      그 파일을 **혼자 쓰려고** 열어서, 이미 하나가 돌며 쓰고 있으면 두 번째 cmd 는
      파일을 못 열고 **파이썬을 실행조차 안 했습니다** — 흔적도 없이. 그래서 덧
      띄운 반복기가 '이미 떠 있음(3)' 을 받을 기회도 없이 영원히 돌았습니다.
      파이썬의 open 은 남과 나눠 씁니다.
    ★ pythonw 로 뜨면 표준 출력이 아예 없습니다 — 여기서 붙여야 print 가 남습니다.
    """
    try:
        STATE.mkdir(parents=True, exist_ok=True)
        f = open(STATE / f"{name}-crash.txt", "a", encoding="utf-8", buffering=1)  # noqa: SIM115
        sys.stdout = f
        sys.stderr = f
    except OSError:
        pass
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
            # ★ 떼어서 — 물려받은 손잡이로 상대의 crash.txt 를 잠그지 않게 (spawn.py)
            from spawn import detached  # noqa: PLC0415
            detached(["wscript.exe", str(vbs)])
            say(f"{other} 가 {int(min(_age(other), 9999))}초째 소식이 없어 다시 띄웠습니다")
            # ★ 바로 또 띄우지 않게, 상대가 표시를 남길 틈을 줍니다
            (STATE / f"{other}.alive").write_text(str(time.time()), encoding="utf-8")
        except OSError as e:
            say(f"{other} 를 못 띄웠습니다 — {e}")


if __name__ == "__main__":
    for n in VBS:
        print(f"{n:14} 마지막 소식 {_age(n):.0f}초 전")
    sys.exit(0)


SEED = Path(__file__).resolve().parent / "_seed_design_agent.json"
REAL_STATE = Path(__file__).resolve().parent / "_real_state.txt"


def ensure_design_key(who: str) -> None:
    """설계 PC 열쇠가 실제 사용자 폴더에 없으면, 저장소에 잠깐 둔 사본을 옮깁니다 (2026-10-16)

    (preflight() 가 같은 것을 1분마다 다시 봅니다 — 없어지면 상태판에 뜹니다)

    ★★ 왜 — 작업 도구(Claude 쪽)가 AppData 에 쓴 파일은 **실제 Windows 에서 안
      보였습니다.** 10/14 에 거기서 만든 design_agent.json 이 실제로는 없어서, PC 를
      켤 때마다 exocad 지켜보기는 치과 열쇠를 잡고 일꾼·임시치아 지켜보기는 바로
      꺼졌습니다. 저장소 폴더는 양쪽이 같이 봅니다 — 거기 둔 사본을 실제 쪽이
      한 번 옮기고 **바로 지웁니다** (git 에는 .gitignore 로 안 올라감).
    ★ 무엇을 봤는지 저장소의 _real_state.txt 에 남깁니다 — 실제 쪽 사정을 알 길이
      그것뿐입니다.
    """
    import json as _json
    key = Path(os.environ.get("APPDATA", Path.home())) / "DenFlow" / "design_agent.json"
    note = ""
    try:
        ok = key.is_file() and bool(_json.loads(key.read_text(encoding="utf-8")).get("token"))
    except (OSError, ValueError):
        ok = False
    if not ok and SEED.is_file():
        try:
            key.parent.mkdir(parents=True, exist_ok=True)
            key.write_text(SEED.read_text(encoding="utf-8"), encoding="utf-8")
            SEED.unlink()
            note = "열쇠를 옮겼습니다"
            ok = True
        except OSError as e:
            note = f"열쇠를 못 옮겼습니다 — {e!r}"
    # ★ 임시치아 지켜보기는 오르카 준비도 (자를 때 사용자 폴더의 설정을 씁니다)
    if who == "temp_watch":
        conf = Path.home() / "AppData" / "Roaming" / "OrcaSlicer" / "OrcaSlicer.conf"
        note += f" 오르카={'준비됨' if conf.exists() else '안 켜 봄(설정 없음)'}"
    try:
        with REAL_STATE.open("a", encoding="utf-8") as f:
            f.write(f"{time.strftime('%Y-%m-%d %H:%M:%S')} {who} pid={os.getpid()} "
                    f"설계열쇠={'있음' if ok else '없음'} {note}" + chr(10))
    except OSError:
        pass


#: 시작프로그램에 있어야 할 것 (install_watch.WATCHERS 와 같게 — 시험이 맞춰 봅니다)
STARTUP_VBS = ("덴플로우 exocad 지켜보기.vbs", "덴플로우 임시치아 지켜보기.vbs", "덴플로우 설계 일꾼.vbs")
#: vbs 이름 → 스크립트 이름
WATCHER_OF = {
    "덴플로우 exocad 지켜보기.vbs": "exocad_watch",
    "덴플로우 임시치아 지켜보기.vbs": "temp_watch",
    "덴플로우 설계 일꾼.vbs": "design_worker",
}


def watchers_file(appdata: Path | None = None) -> Path:
    """이 PC 가 맡은 지켜보기 목록 — install_watch 가 적습니다 (2026-10-20)."""
    appdata = appdata or Path(os.environ.get("APPDATA", Path.home()))
    return appdata / "DenFlow" / "watchers.json"


def expected_watchers(appdata: Path | None = None) -> list[str]:
    """이 PC 에 있어야 할 vbs 이름들.

    ★ 왜 (2026-10-20) — 서버 PC 는 설계 일꾼·임시치아만 맡고 exocad 지켜보기는 디자인
      PC 에 남습니다. 목록 파일이 없으면 예전처럼 셋 다 있어야 하는 것으로 봅니다.
    """
    import json as _json
    try:
        got = _json.loads(watchers_file(appdata).read_text(encoding="utf-8")).get("installed")
        if isinstance(got, list):
            return [n for n in STARTUP_VBS if n in got]
    except (OSError, ValueError):
        pass
    return list(STARTUP_VBS)


def expected_scripts(appdata: Path | None = None) -> list[str]:
    return [WATCHER_OF[n] for n in expected_watchers(appdata)]


def preflight(appdata: Path | None = None, home: Path | None = None) -> list[str]:
    """설계 PC 가 일하는 데 꼭 필요한 것 중 **빠진 것** 이름들 (2026-10-16)

    ★★ 왜 — 이날 빠진 것 둘(설계 열쇠·런처 설정)이 **아무 말 없이** 일을 멈췄습니다.
      런처는 창 없이 떴다가 config.json 이 없어 바로 죽었고, 사람은 "exocad 가 안
      열린다" 로만 알았습니다. 일꾼이 1분마다 이것을 보고 상태판에 올립니다 —
      실제 쪽에서 돌기 때문에 **실제 쪽에서 보이는 것**을 봅니다.
    ★ 빠진 것을 고치지는 않습니다(열쇠·비밀번호가 걸린 일). 알리기만 합니다.
    """
    import json as _json
    appdata = appdata or Path(os.environ.get("APPDATA", Path.home()))
    home = home or Path.home()
    missing: list[str] = []
    key = appdata / "DenFlow" / "design_agent.json"
    try:
        if not _json.loads(key.read_text(encoding="utf-8")).get("token"):
            missing.append("설계 열쇠(design_agent.json)")
    except (OSError, ValueError):
        missing.append("설계 열쇠(design_agent.json)")
    expected = expected_watchers(appdata)
    # ★ 런처 설정은 exocad 를 맡은 PC 에서만 필요합니다 (서버 PC 에는 exocad 가 없음)
    if "덴플로우 exocad 지켜보기.vbs" in expected and not (appdata / "DenFlow" / "launcher" / "config.json").is_file():
        missing.append("런처 설정(config.json) — exocad 가 안 열립니다")
    if not (home / "AppData" / "Roaming" / "OrcaSlicer" / "OrcaSlicer.conf").is_file():
        missing.append("오르카 설정 — 오르카를 한 번 켜야 합니다")
    startup = appdata / "Microsoft" / "Windows" / "Start Menu" / "Programs" / "Startup"
    for name in expected:
        if not (startup / name).is_file():
            missing.append(f"시작프로그램 {name}")
    return missing
