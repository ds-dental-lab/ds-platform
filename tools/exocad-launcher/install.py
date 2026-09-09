# -*- coding: utf-8 -*-
"""denflow:// 프로토콜을 이 PC(현재 사용자)에 등록합니다. 관리자 권한 불필요.
   python install.py          등록      python install.py --remove   해제"""
import sys, winreg
from pathlib import Path

HERE = Path(__file__).resolve().parent
PYW = Path(sys.executable).with_name("pythonw.exe")
CMD = f'"{PYW}" "{HERE / "launcher.py"}" "%1"'

def install() -> None:
    root = winreg.CreateKey(winreg.HKEY_CURRENT_USER, r"Software\Classes\denflow")
    winreg.SetValueEx(root, "", 0, winreg.REG_SZ, "URL:DenFlow Protocol")
    winreg.SetValueEx(root, "URL Protocol", 0, winreg.REG_SZ, "")
    cmd = winreg.CreateKey(root, r"shell\open\command")
    winreg.SetValueEx(cmd, "", 0, winreg.REG_SZ, CMD)
    print("등록됨:", CMD)

def remove() -> None:
    for sub in (r"Software\Classes\denflow\shell\open\command", r"Software\Classes\denflow\shell\open",
                r"Software\Classes\denflow\shell", r"Software\Classes\denflow"):
        try: winreg.DeleteKey(winreg.HKEY_CURRENT_USER, sub)
        except FileNotFoundError: pass
    print("해제됨")

if __name__ == "__main__":
    remove() if "--remove" in sys.argv else install()
