@echo off
cd /d "%~dp0"
python batch_review.py --limit 10
echo.
echo DONE - see Desktop folder for review sheet
pause
