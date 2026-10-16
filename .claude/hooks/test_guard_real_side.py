# -*- coding: utf-8 -*-
"""문지기 훅 시험 — python .claude/hooks/test_guard_real_side.py (막혀야 할 것·두어야 할 것)"""
import sys, importlib.util
spec = importlib.util.spec_from_file_location("g", __file__.replace("test_guard_real_side", "guard_real_side"))
g = importlib.util.module_from_spec(spec); spec.loader.exec_module(g)
block = [
 r'cp x.json "$APPDATA/DenFlow/design_agent.json"',
 r'Copy-Item a.json "$env:APPDATA\DenFlow\launcher\config.json"',
 r'echo {} > C:/Users/DS/AppData/Roaming/DenFlow/x.json',
 r'rm -f C:\Users\DS\AppData\Roaming\DenFlow\launcher\expected-export.json',
 r'python -c "open(r\"C:\Users\DS\AppData\Roaming\DenFlow\a\",\"w\")"',
 r'pythonw tools/exocad-launcher/exocad_watch.py',
 r'Start-Process pythonw -ArgumentList tools\exocad-launcher\design_worker.py',
 r'wscript.exe "C:\Users\DS\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup\덴플로우 temp_watch.vbs"',
 r'python tools/exocad-launcher/scan_agent.py',
 r'python -c "import dentbird_web; dentbird_web.open_browser()"',
]
allow = [
 r'cat "$APPDATA/DenFlow/launcher/_real_state.txt"',
 r'tail -50 C:/Users/DS/AppData/Roaming/DenFlow/launcher/launcher.log',
 r'ls C:\Users\DS\AppData\Roaming\DenFlow',
 r'Get-Content "$env:APPDATA\DenFlow\launcher\crash.log" -Tail 20',
 r'python tools/exocad-launcher/design_worker.py --once',
 r'taskkill /F /IM chromedriver.exe',
 r'grep -n beat tools/exocad-launcher/temp_watch.py',
 r'git add tools/exocad-launcher/exocad_watch.py',
 r'python -m pytest tools/exocad-launcher/test_heartbeat.py',
 r'npx vitest run',
]
bad = 0
for c in block:
    if not g.verdict(c): print("NOT BLOCKED:", c); bad += 1
for c in allow:
    if g.verdict(c): print("WRONGLY BLOCKED:", c); bad += 1
print("bad", bad)
more_allow = [
 r'cd /c/x/tools/exocad-launcher && grep -n "_health\|def " design_worker.py | head',
 r'sed -n 1,40p tools/exocad-launcher/exocad_watch.py',
 r'git diff tools/exocad-launcher/scan_agent.py',
 r'python -m unittest tools/exocad-launcher/test_heartbeat.py',
 r'python build-embed.py  # SOURCES has scan_agent.py',
]
more_block = [
 r'cd tools/exocad-launcher && pythonw design_worker.py',
 r'"C:\Python315\pythonw.exe" "C:\x\tools\exocad-launcher\temp_watch.py"',
 r'Start-Process pythonw.exe -ArgumentList "exocad_watch.py"',
]
# heredoc — 본문에 이름이 나오는 것은 통과, 대상이 그 폴더면 막힘
more_allow.append("cat >> notes.md <<'EOF'\n막는 곳: AppData\\Roaming\\DenFlow\npythonw exocad_watch.py\nEOF\ngrep -n x MEMORY.md")
more_block.append("cat > \"$APPDATA/DenFlow/design_agent.json\" <<'EOF'\n{}\nEOF")
for c in more_allow:
    if g.verdict(c): print("WRONGLY BLOCKED:", c); bad += 1
for c in more_block:
    if not g.verdict(c): print("NOT BLOCKED:", c); bad += 1
print("done")
sys.exit(1 if bad else 0)
