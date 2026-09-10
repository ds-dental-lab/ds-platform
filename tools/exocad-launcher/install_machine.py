# -*- coding: utf-8 -*-
"""denflow:// 를 컴퓨터 전체 영역(HKLM\Software\Classes)에 등록. 관리자 권한 필요.
   ★ 이 PC 의 Chrome·Edge 가 사용자 영역(HKCU) 등록을 무시해서 (2026-09-10) — TeamViewer 처럼 HKLM 에."""
import sys, winreg
from pathlib import Path
HERE = Path(__file__).resolve().parent
PYW = Path(sys.executable).with_name("pythonw.exe")
CMD = f'"{HERE / "launch.cmd"}" "%1"'  # ★ 진단용: 불렸는지 먼저 적고 python.exe(콘솔)로 실행
root = winreg.CreateKey(winreg.HKEY_LOCAL_MACHINE, r"Software\Classes\denflow")
winreg.SetValueEx(root, "", 0, winreg.REG_SZ, "URL:DenFlow Protocol")
winreg.SetValueEx(root, "URL Protocol", 0, winreg.REG_SZ, "")
ico = winreg.CreateKey(root, "DefaultIcon"); winreg.SetValueEx(ico, "", 0, winreg.REG_SZ, f"{PYW},0")
so = winreg.CreateKey(root, r"shell\open"); winreg.SetValueEx(so, "FriendlyAppName", 0, winreg.REG_SZ, "덴플로우 런처")
cmd = winreg.CreateKey(root, r"shell\open\command"); winreg.SetValueEx(cmd, "", 0, winreg.REG_SZ, CMD)
(HERE / "logs" / "install_machine.txt").write_text("ok " + CMD, encoding="utf-8")
