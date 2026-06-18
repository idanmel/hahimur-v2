@echo off
chcp 65001 >nul
cd /d "%~dp0"
if "%SIMS%"=="" set "SIMS=3000"
if "%PORT%"=="" set "PORT=5173"
echo Starting LIVE win-prob server on http://localhost:%PORT% ...
start "" cmd /c "timeout /t 5 >nul & start http://localhost:%PORT%"
npx --yes tsx server.ts
pause
