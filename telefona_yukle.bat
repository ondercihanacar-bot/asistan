@echo off
chcp 65001 >nul
title Asistan Pro - Telefona Yükle & Başlat

echo =======================================================
echo    📲 ASİSTAN PRO - TELEFONA APK YÜKLE VE BAŞLAT
echo =======================================================
echo.

set "ADB_PATH=%LOCALAPPDATA%\Microsoft\WinGet\Packages\Google.PlatformTools_Microsoft.Winget.Source_8wekyb3d8bbwe\platform-tools\adb.exe"

if not exist "%ADB_PATH%" (
    where adb >nul 2>nul
    if %errorlevel% equ 0 (
        set "ADB_PATH=adb"
    ) else (
        echo [HATA] ADB bulunamadi!
        pause
        exit /b 1
    )
)

echo [1/4] Telefon baglantisi kontrol ediliyor...
"%ADB_PATH%" devices

echo.
echo [2/4] USB Port koprusu kuruluyor (8000)...
"%ADB_PATH%" reverse tcp:8000 tcp:8000

set "APK_FILE=Asistan-Pro.apk"
if not exist "%APK_FILE%" (
    if exist "android\app\build\outputs\apk\debug\app-debug.apk" (
        set "APK_FILE=android\app\build\outputs\apk\debug\app-debug.apk"
    )
)

if not exist "%APK_FILE%" (
    echo.
    echo [BILGI] Yerel APK bulunamadi, GitHub Releases'ten en guncel surum indiriliyor...
    curl -L -s -o "Asistan-Pro.apk" "https://github.com/ondercihanacar-bot/asistan/releases/download/mobile-latest/Asistan-Pro.apk"
    if exist "Asistan-Pro.apk" (
        set "APK_FILE=Asistan-Pro.apk"
    )
)

if exist "%APK_FILE%" (
    echo.
    echo [3/4] APK telefona yukleniyor: %APK_FILE%
    "%ADB_PATH%" install -r -d "%APK_FILE%"
    
    if %errorlevel% equ 0 (
        echo.
        echo [4/4] Uygulama telefonda baslatiliyor...
        "%ADB_PATH%" shell am start -n com.asistan.app/.MainActivity
        echo.
        echo =======================================================
        echo  [TEBRIKLER] Asistan Pro telefonunuza kuruldu ve acildi!
        echo =======================================================
    ) else (
        echo.
        echo [HATA] APK yukleme basarisiz oldu. Lutfen telefon ekranindaki
        echo guvenlik / izin uyarilarini onaylayin.
    )
) else (
    echo.
    echo [BILGI] APK henuz hazir degil. Telefonunuzun tarayicisinda uygulama aciliyor...
    "%ADB_PATH%" shell am start -a android.intent.action.VIEW -d "http://localhost:8000"
    echo.
    echo GitHub Actions APK derleme tamamlandiginda bu dosyayi tekrar calistirabilirsiniz.
)

echo.
pause
