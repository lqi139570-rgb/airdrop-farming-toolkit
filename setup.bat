@echo off
REM ============================================================
REM Airdrop Farming Toolkit — Setup & Quick Start
REM ============================================================
echo.
echo === Airdrop Farming Toolkit ===
echo.
echo Checking dependencies...
where node >nul 2>&1 || ( echo ERROR: Node.js not found && exit /b 1 )
echo [OK] Node.js
echo.
echo Installing dependencies...
cd /d "%~dp0"
npm install ethers@6 2>&1 | findstr /v "up to date"
echo.
echo === All set! ===
echo.
echo Commands:
echo   node airdrop_farmer.js 1    Run week 1
echo   node tracker.js            View progress
echo   start dashboard.html        Open dashboard
echo.
pause
