@echo off
chcp 65001 >nul
cd /d "%~dp0"
set "SIMS=%~1"
if "%SIMS%"=="" set "SIMS=20000"
echo Running %SIMS% simulations...
npx --yes tsx winprob.ts %SIMS%
echo.
echo Opening winprob.html...
start "" "%~dp0winprob.html"
pause
