@echo off
setlocal
chcp 65001 >nul 2>nul
echo.
echo ============================================================
echo   dsh-boot-suite 一键安装
echo ============================================================
echo   请先完全退出 DeepSeek Harness Desktop
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\install.ps1" %*
echo.
pause
