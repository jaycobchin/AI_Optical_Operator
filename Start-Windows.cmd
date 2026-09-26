@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 goto setup
if not exist .env goto setup
if not exist dist\index.html goto setup
if not exist node_modules\express\package.json goto setup
echo Keep this window open while using Optical Operator.
echo Open the browser address printed by the server below.
node --env-file=.env apps\api\server.mjs
set "optical_exit=%errorlevel%"
echo.
echo Optical Operator has stopped.
pause
exit /b %optical_exit%
:setup
echo Run Setup-Windows.cmd first. It installs dependencies and builds the application.
pause
exit /b 1
