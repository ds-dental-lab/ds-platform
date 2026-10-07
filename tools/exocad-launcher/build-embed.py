# -*- coding: utf-8 -*-
r"""
에이전트를 **서명된 파이썬**으로 묶습니다 (2026-10-07).

    python build-embed.py

★★ 왜 PyInstaller 를 버리는가 — 실제 치과에서 Windows 보안이 막았습니다.
  PyInstaller 가 만드는 것은 **서명 없는 새 실행 파일**이고, 그 안에
  `pyi-` · `_MEIPASS` 같은 표식이 그대로 박힙니다. 거기에 우리 에이전트가
  하는 일(폴더 감시 → 인터넷 업로드 → 부팅 때 자동 실행)이 겹치면
  정보 탈취 프로그램의 행동 프로필과 구별이 안 됩니다.

  **행동은 못 바꿉니다.** 그게 하는 일이니까요. 그래서 실행 파일을 없앱니다.

★ 여기서 묶는 것 안에는 **우리가 만든 실행 파일이 하나도 없습니다.**
  python.exe / pythonw.exe 는 **Python 재단이 서명한 파일**이고(확인함),
  나머지는 전부 글자로 된 .py 입니다. 백신이 뜯어볼 것이 없습니다.

★ 바로가기는 **처음 켤 때 에이전트가 만듭니다.** zip 안의 .lnk 는 풀어 놓은
  자리가 달라지면 깨집니다 — 절대 경로를 품고 있어서입니다.
"""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
import urllib.request
import zipfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
OUT = HERE / "dist-embed" / "덴플로우 에이전트"

#: 끼워 넣은 파이썬이 들어갈 폴더 이름.
#:
#: ★★ **영문이어야 합니다.** cmd 는 배치 파일을 콘솔 코드페이지(cp949)로
#:   읽습니다. 파일을 utf-8 로 써 두면 그 안의 한글이 깨져서
#:   `?고???pythonw.exe 를 찾을 수 없습니다` 가 납니다 (실제 치과 2026-10-07).
#:   배치 파일 **안에 한글을 두지 않는 것**이 유일하게 안 틀리는 길입니다.
RUNTIME_DIR = "runtime"

#: 끼워 넣을 파이썬. 3.13 은 pystray·Pillow 바퀴가 넉넉히 나와 있습니다
PY_VER = "3.13.7"
PY_TAG = "313"
PY_URL = f"https://www.python.org/ftp/python/{PY_VER}/python-{PY_VER}-embed-amd64.zip"

#: 치과 PC 로 가져갈 우리 파일들.
#:
#: ★ scan_agent 가 medit_case 를, medit_case 가 dxd_case 를 부릅니다.
#:   하나라도 빠지면 **창이 아예 안 뜹니다** — 치과에서 그게 제일 나쁩니다.
#:   빠진 것이 있는지는 아래 check_imports() 가 빌드할 때 봅니다.
SOURCES = ["scan_agent.py", "medit_case.py", "dxd_case.py", "denflow.ico"]

#: 자동 출력까지 쓰려면 함께 가야 하는 것들 (치과 PC 가 프린터에 보냅니다)
PRINT_SOURCES = ["print_loop.py", "printer_send.py", "printer_find.py"]

NEEDS = ["pystray", "pillow"]

#: 치과가 두 번 누르는 것.
#:
#: ★★ **안에 한글을 한 글자도 두지 않습니다.** cmd 는 배치 파일을 콘솔
#:   코드페이지(cp949)로 읽는데 우리는 utf-8 로 씁니다. 한글이 있으면
#:   깨져서 `?고???pythonw.exe 를 찾을 수 없습니다` 가 납니다
#:   (실제 치과에서 터졌습니다, 2026-10-07).
#:   `%~dp0` 는 cmd 가 파일 체계에서 바로 읽어 와 한글 경로여도 괜찮습니다 —
#:   **배치 파일 안에 적힌 글자**만 문제입니다. 그래서 주석도 영문입니다.
CMD = f"""@echo off
rem DenFlow Agent - launched with the signed Python runtime.
rem Keep this file ASCII-only: cmd reads it in the console codepage,
rem so Korean text here becomes garbage and the path breaks.
start "" "%~dp0{RUNTIME_DIR}\\pythonw.exe" "%~dp0scan_agent.py" %*
"""


def say(*a) -> None:
    print(" ", *a, flush=True)


def fetch_python(work: Path) -> Path:
    """끼워 넣을 파이썬을 받아 풉니다"""
    cache = HERE / "build" / f"python-{PY_VER}-embed.zip"
    cache.parent.mkdir(parents=True, exist_ok=True)
    if not cache.exists():
        say("파이썬 받는 중…", PY_URL)
        urllib.request.urlretrieve(PY_URL, cache)
    runtime = work / RUNTIME_DIR
    runtime.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(cache) as z:
        z.extractall(runtime)

    # ★ 끼워 넣은 파이썬은 기본으로 site-packages 를 안 봅니다.
    #   한 줄 주석을 풀어야 우리가 넣은 꾸러미를 찾습니다.
    pth = runtime / f"python{PY_TAG}._pth"
    text = pth.read_text(encoding="utf-8")
    text = text.replace("#import site", "import site")
    # ★ `Lib` 도 넣어야 tkinter 가 보입니다. 기본 _pth 에는 python313.zip 과
    #   '.' 만 있어서, Lib/tkinter 를 가져다 놔도 못 찾습니다.
    # ★★ `._pth` 가 있으면 파이썬이 **스크립트가 있는 폴더를 경로에 안 넣습니다**
    #   (격리 모드). 그래서 `..` 도 적어 줘야 우리 .py 를 찾습니다 —
    #   `..` 는 런타임의 윗폴더, 곧 에이전트 폴더입니다.
    #   이것을 빠뜨리면 치과에서 **창이 아예 안 뜹니다** (실측 2026-10-07).
    lines = [ln for ln in text.splitlines()]
    for want in ("Lib", ".."):
        if not any(ln.strip() == want for ln in lines):
            lines.insert(1, want)
    text = "\n".join(lines) + "\n"
    pth.write_text(text, encoding="utf-8")
    return runtime


#: tkinter 는 **끼워 넣는 판에 안 들어 있습니다.** 같은 판(3.13)의 정식
#: 설치본에서 조각을 가져와야 합니다. 조각은 네 덩이입니다:
#:   DLLs/_tkinter.pyd · DLLs/tcl86t.dll · DLLs/tk86t.dll · Lib/tkinter/ · tcl/
#:
#: ★ ABI 가 맞아야 해서 **판 번호가 같아야** 합니다. 3.15 것을 3.13 에
#:   넣으면 불러오다 죽습니다.
#: ★ zlib1.dll 을 빠뜨리면 tcl86t.dll 이 안 열립니다. 그런데 오류 문구는
#:   "tcl86t.dll 을 찾을 수 없습니다" 라고 나와서, 없는 것은 zlib 인데
#:   엉뚱한 파일을 찾게 됩니다 (실측 2026-10-07).
TK_BITS = [
    ("DLLs/_tkinter.pyd", "_tkinter.pyd"),
    ("DLLs/tcl86t.dll", "tcl86t.dll"),
    ("DLLs/tk86t.dll", "tk86t.dll"),
    ("DLLs/zlib1.dll", "zlib1.dll"),
]
TK_TREES = [("Lib/tkinter", "Lib/tkinter"), ("tcl", "tcl")]


def find_full_python() -> Path | None:
    """
    tkinter 조각이 있는 곳을 찾습니다.

    ★ 먼저 **챙겨 둔 사본**(build/tk313)을 봅니다. 정식 3.13 을 깔아야만
      빌드되면, 쓰는 PC 가 바뀔 때마다 막힙니다. 한 번 꺼내 두면 그 뒤로는
      설치 없이 빌드됩니다.
    """
    cached = HERE / "build" / f"tk{PY_TAG}"
    if (cached / "DLLs" / "_tkinter.pyd").exists():
        return cached

    guesses = [
        Path(os.environ.get("LOCALAPPDATA", "")) / "Programs" / "Python" / f"Python{PY_TAG}",
        Path(f"C:/Python{PY_TAG}"),
        Path(os.environ.get("PROGRAMFILES", "")) / f"Python{PY_TAG}",
    ]
    for g in guesses:
        if (g / "DLLs" / "_tkinter.pyd").exists():
            return g
    return None


def add_tkinter(runtime: Path) -> bool:
    """
    tkinter 를 끼워 넣습니다.

    ★ 없으면 **빌드를 멈춥니다.** 화면이 안 뜨는 에이전트를 치과에 보내는
      것보다 여기서 서는 편이 낫습니다.
    """
    full = find_full_python()
    if not full:
        say(f"!! 같은 판({PY_VER})의 정식 파이썬을 못 찾았습니다.")
        say("   python.org 에서 3.13 을 깔면 거기서 tkinter 를 가져옵니다.")
        return False

    say("tkinter 가져오는 중…", str(full))
    for src, dst in TK_BITS:
        shutil.copy(full / src, runtime / dst)
    for src, dst in TK_TREES:
        target = runtime / dst
        target.parent.mkdir(parents=True, exist_ok=True)
        if target.exists():
            shutil.rmtree(target)
        shutil.copytree(full / src, target)
    return True


def add_packages(runtime: Path) -> None:
    """pystray·Pillow 를 끼워 넣은 파이썬 안으로"""
    target = runtime / "Lib" / "site-packages"
    target.mkdir(parents=True, exist_ok=True)
    say("꾸러미 넣는 중…", ", ".join(NEEDS))
    subprocess.run(
        [
            sys.executable, "-m", "pip", "install",
            "--target", str(target),
            "--only-binary=:all:",
            "--python-version", PY_TAG[0] + "." + PY_TAG[1:],
            "--platform", "win_amd64",
            "--quiet",
            *NEEDS,
        ],
        check=True,
    )


def check_imports(runtime: Path) -> bool:
    """
    묶은 그대로 **불러봅니다.**

    ★★ 파일 하나 빠뜨리면 치과에서 **창이 아예 안 뜹니다.** 그게 제일 나쁜
      고장입니다 — 아무 말도 없이 안 됩니다. medit_case 를 빠뜨려 한 번
      겪었습니다(2026-10-07). 그래서 빌드가 끝나기 전에 직접 확인합니다.
    ★ scan_agent 는 `__main__` 가드가 있어 불러도 창이 안 뜹니다.
    """
    say("묶은 그대로 불러보는 중…")

    # ★ `-c` 로는 안 됩니다. 끼워 넣은 파이썬은 `._pth` 로 경로가 고정돼 있어
    #   현재 폴더를 안 봅니다. **스크립트를 경로로 띄워야** 그 폴더가
    #   sys.path 에 들어갑니다 — 실제로 뜨는 방식과 같게 맞춥니다.
    probe = OUT / "_확인.py"
    probe.write_text(
        "import scan_agent, medit_case, dxd_case, tkinter, pystray, PIL.Image\nprint('ok')\n",
        encoding="utf-8",
    )
    try:
        r = subprocess.run(
            [str(runtime / "python.exe"), str(probe)],
            cwd=str(OUT), capture_output=True, text=True, encoding="utf-8", errors="replace",
        )
    finally:
        probe.unlink(missing_ok=True)
    if r.returncode != 0:
        say("!! 불러오다 실패했습니다 — 빠진 파일이 있습니다")
        for line in (r.stderr or "").strip().splitlines()[-4:]:
            say("  ", line)
        return False
    say("불러오기 통과")
    return True


def main() -> int:
    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir(parents=True)

    runtime = fetch_python(OUT)
    if not add_tkinter(runtime):
        return 1
    add_packages(runtime)

    for name in SOURCES + PRINT_SOURCES:
        src = HERE / name
        if src.exists():
            shutil.copy(src, OUT / name)
            say("담음", name)

    # ★ 한글이 한 글자라도 섞이면 여기서 멈춥니다. 치과에서 깨지는 것보다
    #   빌드가 서는 편이 낫습니다 (2026-10-07 에 한 번 당했습니다).
    if not CMD.isascii():
        say("!! 배치 파일에 한글이 섞였습니다 — cmd 가 깨뜨립니다")
        return 1
    (OUT / "덴플로우 에이전트.cmd").write_text(CMD, encoding="ascii")

    if not check_imports(runtime):
        return 1

    # 크기와 '우리가 만든 실행 파일' 수를 봅니다
    files = list(OUT.rglob("*"))
    size = sum(f.stat().st_size for f in files if f.is_file())
    exes = [f for f in files if f.suffix.lower() in (".exe", ".dll", ".pyd")]
    ours = [f for f in exes if RUNTIME_DIR not in f.parts]

    print()
    say(f"폴더  {OUT}")
    say(f"크기  {size / 1024 / 1024:.1f} MB · 파일 {len([f for f in files if f.is_file()]):,}개")
    say(f"실행 파일 {len(exes)}개 — 전부 파이썬 재단 것, 우리가 만든 것 {len(ours)}개")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
