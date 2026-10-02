@echo off
rem Full python path — bare "pythonw" opens the "choose an app" dialog when not on PATH.
set "PY=C:\Users\DS\AppData\Local\Programs\Python\Python315\pythonw.exe"
if not exist "%PY%" set "PY=pythonw.exe"
start "" "%PY%" "%~dp0scan_agent.py"
