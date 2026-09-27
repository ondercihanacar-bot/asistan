@echo off
chcp 65001 >nul
title Asistan - USB Telefon Köprüsü (Port Yönlendirme)

echo =======================================================
echo    📱 ASİSTAN - USB TELEFON KÖPRÜSÜ
echo =======================================================
echo.

set "ADB_PATH=%LOCALAPPDATA%\Microsoft\WinGet\Packages\Google.PlatformTools_Microsoft.Winget.Source_8wekyb3d8bbwe\platform-tools\adb.exe"

if not exist "%ADB_PATH%" (
    where adb >nul 2>nul
    if %errorlevel% equ 0 (
        set "ADB_PATH=adb"
    ) else (
        echo [HATA] ADB bulunamadi! Lutfen Android Platform Tools yukleyin.
        pause
        exit /b 1
    )
)

echo [1/2] Bagli telefon kontrol ediliyor...
"%ADB_PATH%" devices

echo.
echo [2/2] USB uzerinden 8000 portu telefona baglaniyor...
"%ADB_PATH%" reverse tcp:8000 tcp:8000

if %errorlevel% equ 0 (
    echo.
    echo =======================================================
    echo  [BASARILI] Telefonunuz artik USB uzerinden
    echo  http://localhost:8000 adresine dogrudan erisebilir!
    echo =======================================================
) else (
    echo.
    echo [UYARI] Port yonlendirme basarisiz oldu. Telefon ekraninda
    echo 'USB Hata Ayiklamaya izin ver' uyarisi ciktiysa onaylayin.
)

echo.
pause
