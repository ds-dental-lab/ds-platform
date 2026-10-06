@echo off
rem Build the clinic-side scan agent into one .exe (no Python needed on the clinic PC).
rem Output: dist\덴플로우 에이전트.exe  (~14MB, one file)
rem Needs: pip install pyinstaller
rem Note: --icon must be an absolute path (PyInstaller resolves it from --specpath).
rem       %~dp0 already expands to one.

set "PY=C:\Users\DS\AppData\Local\Programs\Python\Python315\python.exe"
if not exist "%PY%" set "PY=python"

"%PY%" -m PyInstaller --noconfirm --onefile --windowed ^
  --name "덴플로우 에이전트" ^
  --icon "%~dp0denflow.ico" ^
  --distpath "%~dp0dist" --workpath "%~dp0build" --specpath "%~dp0build" ^
  "%~dp0scan_agent.py"

echo.
echo Done: %~dp0dist
pause
