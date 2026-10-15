@echo off
rem Double-click to run the booth game. Add --lan to let phones/tablets on the same Wi-Fi join.
cd /d "%~dp0"
python server.py %*
pause
