# -*- coding: utf-8 -*-
r"""exocad 지켜보기를 **PC 켜면 저절로 뜨게** 합니다 (2026-10-14).

    python install_watch.py          넣습니다
    python install_watch.py --off    뺍니다

★★ **왜 — 꺼져 있으면 아무 일도 안 일어납니다.** 브라우저가 쏘던 때는
  윈도우가 즉시 띄워 줬습니다. 이제는 이 프로그램이 떠 있어야 열립니다.
  사람이 매일 켜야 하는 것으로 두면 **언젠가 안 켭니다** — 그날 아침에
  단추가 먹통이 되고, 까닭을 또 이틀 찾습니다.

★ 시작프로그램 폴더에 .cmd 하나를 둡니다. 레지스트리 Run 이 아니라
  폴더인 이유는 **사람이 열어 보고 지울 수 있기 때문**입니다. 남의 PC 에
  숨겨 두는 자동 실행은 안 만듭니다.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
NAME = "덴플로우 exocad 지켜보기.cmd"
STARTUP = (
    Path(os.environ["APPDATA"]) / "Microsoft" / "Windows" / "Start Menu" / "Programs" / "Startup"
)

BODY = """@echo off
rem 덴플로우 — exocad 열기를 지켜봅니다 (install_watch.py 가 넣었습니다)
start "" "{pythonw}" "{script}"
"""


def main() -> int:
    target = STARTUP / NAME

    if "--off" in sys.argv:
        if target.exists():
            target.unlink()
            print(f"뺐습니다: {target}")
        else:
            print("들어 있지 않습니다")
        return 0

    pythonw = Path(sys.executable).with_name("pythonw.exe")
    if not pythonw.exists():
        pythonw = Path(sys.executable)

    STARTUP.mkdir(parents=True, exist_ok=True)
    target.write_text(
        BODY.format(pythonw=pythonw, script=HERE / "exocad_watch.py"),
        encoding="utf-8",
        newline="\r\n",
    )
    print(f"넣었습니다: {target}")
    print("지금 바로 띄우려면:")
    print(f'  start "" "{pythonw}" "{HERE / "exocad_watch.py"}"')
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
