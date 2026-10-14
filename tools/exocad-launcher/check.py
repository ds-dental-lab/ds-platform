# -*- coding: utf-8 -*-
"""런처가 **지금 열리는 상태인가**를 봅니다 (2026-10-14).

    python check.py

★★ **왜 — 이 고리는 조용히 끊어집니다.** 등록된 자리를 옮기거나 파일을
  옮기면, 브라우저는 여전히 옛 자리를 부르고 그쪽은 시작하자마자 죽습니다.
  pythonw 라 창도 로그도 없이요. 화면에는 '여는 중' 만 남고, 사람은
  **브라우저가 안 부른 건지 런처가 죽은 건지 구별할 수가 없습니다.**
  실제로 그 자리에서 이틀을 썼습니다 (10-13 ~ 10-14, 일곱 건).

★ 그래서 고치는 쪽이 아니라 **보는 쪽**을 만듭니다. 판을 올린 뒤 이것부터
  돌리면, 끊어졌는지 10초 만에 압니다.
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
import winreg
from pathlib import Path

HERE = Path(__file__).resolve().parent
STATE = Path(os.environ.get("APPDATA", Path.home())) / "DenFlow" / "launcher"

bad = 0


def say(ok: bool, what: str, detail: str = "") -> None:
    global bad
    if not ok:
        bad += 1
    print(f"  {'O' if ok else 'X'}  {what}" + (f"  — {detail}" if detail else ""))


def registered() -> str | None:
    """브라우저가 실제로 쓰는 명령. HKCR 이 HKCU·HKLM 을 합친 결과입니다"""
    try:
        with winreg.OpenKey(winreg.HKEY_CLASSES_ROOT, r"denflow\shell\open\command") as k:
            return winreg.QueryValueEx(k, "")[0]
    except OSError:
        return None


def target_of(cmd: str) -> Path | None:
    """명령줄에서 **.py 경로**를 꺼냅니다"""
    parts = [p.strip('"') for p in cmd.split('" "')]
    for p in parts:
        if p.lower().endswith(".py"):
            return Path(p.strip('"'))
    return None


print("덴플로우 런처 점검\n")

# ---------- 1. 등록 ----------
cmd = registered()
say(bool(cmd), "denflow:// 가 등록돼 있다", "없으면 install_machine.py 를 관리자로" if not cmd else "")

script = target_of(cmd or "")
say(bool(script), "등록이 가리키는 .py 를 읽을 수 있다", cmd or "")
if script:
    say(script.is_file(), f"그 파일이 있다", str(script))
    #: ★ 저장소 것이 아니어도 괜찮습니다 — 넘겨 주기만 하면 됩니다.
    #:   그래서 '어디를 가리키나' 가 아니라 **'도는가'** 를 봅니다.
    if script.is_file():
        exe = (cmd or "").split('"')[1] if '"' in (cmd or "") else sys.executable
        r = subprocess.run([exe.replace("pythonw.exe", "python.exe"), str(script)],
                           capture_output=True, text=True, encoding="utf-8",
                           errors="replace", timeout=60)
        out = (r.stdout + r.stderr).strip()
        say("사용:" in out, "그 파일이 실제로 돈다", out.splitlines()[-1][:110] if out else "아무 말이 없습니다")

# ---------- 2. 설정 ----------
cfg = STATE / "config.json"
say(cfg.is_file(), "설정이 있다", str(cfg))
if cfg.is_file():
    try:
        base = json.loads(cfg.read_text(encoding="utf-8")).get("base_url", "https://denflow.kr")
        say(True, "서버 주소", base)
    except ValueError as e:
        say(False, "설정을 읽을 수 있다", str(e))

# ---------- 3. 꾸러미 ----------
for mod in ("requests", "tkinter", "selenium"):
    try:
        __import__(mod)
        say(True, f"{mod} 를 부를 수 있다")
    except ImportError as e:
        say(mod == "selenium", f"{mod} 를 부를 수 있다",
            "dxd 변환에만 씁니다" if mod == "selenium" else str(e))

# ---------- 4. exocad ----------
try:
    sys.path.insert(0, str(HERE))
    from make_project import CAD_DATA  # noqa: PLC0415

    say(CAD_DATA.is_dir(), "exocad CAD-Data 폴더가 있다", str(CAD_DATA))
except Exception as e:  # noqa: BLE001
    say(False, "exocad 자리를 찾을 수 있다", str(e))

# ---------- 5. 마지막으로 불린 때 ----------
hit = STATE / "불렸습니다.txt"
if hit.is_file():
    last = hit.read_text(encoding="utf-8").strip().splitlines()[-1]
    print(f"\n  마지막으로 불린 때: {last}")
else:
    print("\n  아직 한 번도 안 불렸습니다 (단추를 눌러 보세요)")

print(f"\n{'모두 통과했습니다' if not bad else f'{bad} 군데가 틀렸습니다'}")
raise SystemExit(1 if bad else 0)
