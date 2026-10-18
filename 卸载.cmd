@echo off
setlocal
chcp 65001 >nul 2>nul
echo.
echo ============================================================
echo   dsh-boot-suite 卸载（界面出问题时的急救）
echo ============================================================
echo   请先用任务管理器结束全部 DeepSeek Harness 进程
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\emergency-uninstall.ps1" %*
echo.
pause
