@echo off
rem Build the clinic-side agent (no Python needed on the clinic PC).
rem Output: dist\덴플로우 에이전트\  (folder: exe + _internal)
rem
rem ★ --onedir, NOT --onefile. A onefile exe unpacks itself into a temp folder at
rem   startup, which looks exactly like a packer to antivirus heuristics and causes
rem   false positives. Clinics run V3 / ALYac, which are stricter than Defender.
rem   The cost: the whole folder must be copied together, not a single file.
rem Needs: pip install pyinstaller
rem Note: --icon must be an absolute path (PyInstaller resolves it from --specpath).
rem       %~dp0 already expands to one.

set "PY=C:\Users\DS\AppData\Local\Programs\Python\Python315\python.exe"
if not exist "%PY%" set "PY=python"

"%PY%" -m PyInstaller --noconfirm --onedir --windowed ^
  --name "덴플로우 에이전트" ^
  --icon "%~dp0denflow.ico" ^
  --add-data "%~dp0denflow.ico;." ^
  --distpath "%~dp0dist" --workpath "%~dp0build" --specpath "%~dp0build" ^
  "%~dp0scan_agent.py"

echo.
echo Done: %~dp0dist
pause
