@echo off
rem Use the full python path. Bare "pythonw" opens the "choose an app" dialog
rem when it is not on PATH (2026-09-28). Korean comments break cmd encoding.
set "PY=C:\Users\DS\AppData\Local\Programs\Python\Python315\pythonw.exe"
if not exist "%PY%" set "PY=pythonw.exe"
start "" "%PY%" "%~dp0stl_image.py"
