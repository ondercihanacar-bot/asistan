@echo off
cd /d "%~dp0"
.venv\Scripts\python.exe run_app.py >> server_log.txt 2>&1
