@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
  echo Install Node.js 24 LTS from https://nodejs.org/en/download, then reopen this file.
  pause
  exit /b 1
)
node scripts\practice-setup.mjs
if errorlevel 1 goto failed
call npm ci
if errorlevel 1 goto failed
call npm run build
if errorlevel 1 goto failed
echo.
echo Setup complete. Open Start-Windows.cmd to run Optical Operator.
echo Instructions: docs\practice-computer-setup.md
pause
exit /b 0
:failed
echo.
echo Setup did not finish. Review the error above before trying again.
pause
exit /b 1
