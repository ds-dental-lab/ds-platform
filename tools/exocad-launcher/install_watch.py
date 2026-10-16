# -*- coding: utf-8 -*-
r"""exocad 지켜보기를 **PC 켜면 저절로 뜨게** 합니다 (2026-10-14).

    python install_watch.py          넣습니다
    python install_watch.py --off    뺍니다

★★ **꺼져 있으면 아무 일도 안 일어납니다.** 브라우저가 쏘던 때는 윈도우가
  즉시 띄워 줬습니다. 이제는 이 프로그램이 떠 있어야 열립니다. 사람이 매일
  켜야 하는 것으로 두면 **언젠가 안 켭니다** — 그날 아침에 단추가 먹통이
  되고, 까닭을 또 이틀 찾습니다.

★★ **죽으면 다시 띄웁니다.** 파이썬 쪽은 무슨 일이 나도 안 죽게 고쳤지만,
  그래도 죽는 날이 옵니다 — 실제로 11분 만에 조용히 죽어 있었고 사람은 또
  "왜 안 되지" 를 했습니다. 지켜보는 것이 죽으면 **아무도 안 지켜봅니다.**
  10초 뒤에 다시 띄우고, 터진 까닭은 파일에 남깁니다.

★ 시작프로그램 **폴더**에 둡니다. 레지스트리 Run 이 아니라 폴더인 이유는
  사람이 열어 보고 지울 수 있기 때문입니다 — 남의 PC 에 숨겨 두지 않습니다.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
#: 지켜볼 것 둘 — exocad 열기와 임시치아 파일. 같은 모양이라 같이 넣습니다.
WATCHERS = {
    "덴플로우 exocad 지켜보기.vbs": "exocad_watch.py",
    "덴플로우 임시치아 지켜보기.vbs": "temp_watch.py",
    "덴플로우 설계 일꾼.vbs": "design_worker.py",
}
STARTUP = (
    Path(os.environ["APPDATA"]) / "Microsoft" / "Windows" / "Start Menu" / "Programs" / "Startup"
)

#: ★ 창이 안 보이게 띄웁니다. .cmd 를 그냥 두면 검은 창이 하나 떠 있고,
#:   사람이 무심코 닫으면 그날부터 아무 일도 안 일어납니다.
#: ★ 창이 안 보이게 띄웁니다. .cmd 를 그냥 두면 검은 창이 하나 떠 있고,
#:   사람이 무심코 닫으면 그날부터 아무 일도 안 일어납니다.
#: ★ VBScript 는 따옴표를 **두 번** 적어야 한 개가 됩니다 — 경로에 빈칸이
#:   있으면 따옴표 없이는 거기서 잘립니다.
#: ★★ **vbs 하나로 끝냅니다** (2026-10-14). 처음엔 .cmd 에 재시작 고리를
#:   두었는데, 창 없이 띄우면 `timeout` 이 콘솔이 없어 바로 실패하고
#:   고리가 헛돌았습니다. VBScript 가 기다렸다 다시 띄우면 그만입니다.
#: ★★ **한글 이름을 쓰지 않습니다.** VBScript 는 UTF-8 파일을 ANSI 로
#:   읽어서, 한글이 들어간 경로는 깨지고 "파일을 찾을 수 없습니다" 로
#:   조용히 끝납니다 — `런타임`→`runtime` 때와 **같은 함정**입니다.
#:   그래서 UTF-16 으로 적습니다.
#: ★ 터져 죽은 까닭은 파일에 남깁니다. 조용히 사라지지 않게.
def vbs_for(python, script, crash) -> str:
    q = chr(34)
    # ★★ cmd 는 **첫 글자가 따옴표면** 바깥 한 쌍을 떼어 냅니다. 그래서
    #   `cmd /c "a" "b"` 는 엉뚱하게 잘립니다 — 전체를 한 번 더
    #   감싸야 합니다(`cmd /c ""a" "b""`). 이것 때문에 파이썬이
    #   아예 안 떴고, 터짐 기록조차 안 남았습니다.
    inner = f'{q}{python}{q} {q}{script}{q} >> {q}{crash}{q} 2>&1'
    full = f'cmd /c {q}{inner}{q}'
    # VBScript 안에서 따옴표 한 개는 두 번 적습니다
    literal = q + full.replace(q, q * 2) + q
    # ★★ 켜자마자 띄우지 않습니다 (2026-10-16). PC 를 막 켰을 때 셋 중 하나만
    #   살고 둘은 파이썬도 안 남긴 채 사라졌고, 산 하나는 설계 열쇠를 못 보고
    #   치과 열쇠를 잡았습니다. 로그인 뒤 45초 기다립니다.
    # ★ 띄울 때마다 한 줄 남깁니다 — 또 생기면 '띄우기는 했나' 부터 볼 수 있게.
    #   (ASCII 만 — VBScript 파일 쓰기는 한글을 깨뜨립니다)
    stem = Path(str(script)).stem
    starts = Path(str(crash)).with_name("vbs-starts.txt")
    lines = [
        chr(39) + ' DenFlow - ' + stem + '. Hidden, restarts if it dies.',
        'Set sh = CreateObject(' + q + 'WScript.Shell' + q + ')',
        'Set fs = CreateObject(' + q + 'Scripting.FileSystemObject' + q + ')',
        'WScript.Sleep 45000',
        'Do',
        '  On Error Resume Next',
        '  Set f = fs.OpenTextFile(' + q + str(starts) + q + ', 8, True)',
        '  f.WriteLine Now & ' + q + ' start ' + stem + q,
        '  f.Close',
        '  On Error GoTo 0',
        '  sh.Run ' + literal + ', 0, True',
        '  WScript.Sleep 10000',
        'Loop',
    ]
    return chr(10).join(lines) + chr(10)


def main() -> int:
    off = "--off" in sys.argv

    python = Path(sys.executable)
    if python.name.lower() == "pythonw.exe":
        python = python.with_name("python.exe")

    STARTUP.mkdir(parents=True, exist_ok=True)

    for name, script in WATCHERS.items():
        target = STARTUP / name

        if off:
            if target.exists():
                target.unlink()
                print(f"뺐습니다: {target}")
            continue

        crash = (
            Path(os.environ["APPDATA"]) / "DenFlow" / "launcher"
            / f"{Path(script).stem}-crash.txt"
        )
        crash.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(
            vbs_for(python, HERE / script, crash), encoding="utf-16", newline="\r\n"
        )
        print(f"넣었습니다: {target}")

    if off:
        print("★ 이미 돌고 있는 것은 작업 관리자에서 python.exe 를 끝내 주세요")
        return 0

    print("지금 바로 띄우려면 그 vbs 들을 두 번 누르세요")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
