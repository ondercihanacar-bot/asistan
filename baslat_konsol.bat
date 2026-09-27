@echo off
title Akilli Odeme ve Hatirlatici Asistani (Konsol Modu)
cd /d "%~dp0"
start "" "http://localhost:8000"
.venv\Scripts\python.exe -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
pause
