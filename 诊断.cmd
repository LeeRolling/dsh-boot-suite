@echo off
chcp 65001 >nul 2>nul
cd /d "%~dp0"
echo 正在收集诊断信息…
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\doctor.ps1"
echo.
pause
