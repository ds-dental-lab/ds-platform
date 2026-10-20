@echo off
rem =====================================================================
rem  DenFlow server PC bootstrap (2026-10-20)
rem  Fresh Windows 11 -> Git, Python, Chrome, OrcaSlicer -> clone repo -> setup_server.py
rem  Run this ONCE on the new server PC (double-click or from a terminal).
rem  ASCII only on purpose: cmd reads this file as ANSI, Korean breaks here.
rem =====================================================================
setlocal
set ROOT=C:\DenFlow
set REPO=%ROOT%\ds-platform

echo [1/4] Installing tools with winget (Git, Python 3.13, Chrome, OrcaSlicer)...
winget install -e --id Git.Git --accept-source-agreements --accept-package-agreements
winget install -e --id Python.Python.3.13 --accept-source-agreements --accept-package-agreements
winget install -e --id Google.Chrome --accept-source-agreements --accept-package-agreements
winget install -e --id SoftFever.OrcaSlicer --accept-source-agreements --accept-package-agreements

rem winget installs do not update PATH of this window - reopen by hand if commands are missing
set "PATH=%PATH%;%ProgramFiles%\Git\cmd;%LOCALAPPDATA%\Programs\Python\Python313;%LOCALAPPDATA%\Programs\Python\Python313\Scripts"

echo [2/4] Cloning the repository to %REPO% (a GitHub sign-in window may open)...
if not exist "%ROOT%" mkdir "%ROOT%"
if exist "%REPO%\.git" (
  cd /d "%REPO%" && git pull
) else (
  git clone https://github.com/ds-dental-lab/ds-platform.git "%REPO%" || goto :fail
)

echo [3/4] Python packages...
python -m pip install --upgrade pip >nul
python -m pip install requests selenium numpy pillow || goto :fail

echo [4/4] DenFlow setup (Korean prompts follow)...
cd /d "%REPO%\tools\exocad-launcher"
python setup_server.py
goto :end

:fail
echo.
echo *** A step failed. Close this window, reopen a terminal and run again. ***
:end
pause
