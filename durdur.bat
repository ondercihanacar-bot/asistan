@echo off
title Odeme Asistani Durduruluyor...
echo Odeme ve Hatirlatici Asistani servisi kapatiliyor...

powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"

echo.
echo Asistan servisi basariyla durduruldu.
timeout /t 2 >nul
exit
