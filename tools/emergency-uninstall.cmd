@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0emergency-uninstall.ps1" %*
echo.
pause
