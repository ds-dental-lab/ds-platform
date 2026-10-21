@echo off
rem =====================================================================
rem  DenFlow server PC update (2026-10-21)
rem  git pull -> stop running watchers (pythonw) -> start them again from Startup
rem  Double-click this on the server PC after a push. Safe to run any time.
rem  ASCII only on purpose: cmd reads this file as ANSI, Korean breaks here.
rem =====================================================================
setlocal
set REPO=C:\DenFlow\ds-platform
set STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup

echo [1/3] git pull
cd /d "%REPO%" || (echo repo not found: %REPO% & pause & exit /b 1)
git pull --ff-only || (echo git pull failed & pause & exit /b 1)

echo [2/3] stopping watchers (pythonw)
taskkill /f /im pythonw.exe >nul 2>&1
timeout /t 2 /nobreak >nul

echo [3/3] starting watchers from Startup
set STARTED=0
for %%F in ("%STARTUP%\*.vbs") do (
    echo   start %%~nxF
    start "" wscript.exe "%%~F"
    set STARTED=1
)
if "%STARTED%"=="0" echo   no .vbs in Startup -- run: python tools\exocad-launcher\install_watch.py --only design_worker temp_watch

echo.
echo done. check DenFlow ^> device status in 1-2 minutes.
timeout /t 8
