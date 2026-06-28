@echo off
REM ============================================================
REM Run remaining farming weeks (all cheap self-transfers)
REM Use: just double-click this file
REM ============================================================
cd /d "%~dp0"
echo Airdrop Farming Toolkit - Batch Runner
echo =======================================
echo.
echo This will run all remaining farming weeks.
echo Each week costs ~$0.04 in gas.
echo.
echo Current week to start from (default: 1^):
set /p WEEK="Week number: "
if "%WEEK%"=="" set WEEK=1

echo.
echo Running weeks %WEEK% to 52...
echo Press Ctrl+C to stop at any time.
echo.

for /l %%i in (%WEEK%,1,52) do (
    echo.
    echo ===== Week %%i =====
    node airdrop_farmer.js %%i
    if errorlevel 1 (
        echo Error on week %%i - stopping
        pause
        exit /b 1
    )
    timeout /t 2 /nobreak >nul
)

echo.
echo All weeks complete!
pause
