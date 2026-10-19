@echo off
setlocal
chcp 65001 >nul 2>nul
title dsh-boot-suite 一键安装
echo.
echo ============================================================
echo   DeepSeek Harness 开机动画插件 - 一键安装
echo ============================================================
echo.
echo   [重要] 请先完全退出 DeepSeek Harness Desktop（右下角托盘也要退出）
echo.
echo   安装方式：把插件链接到 DSH 的插件目录（不会复制文件，后续更新直接生效）
echo   卸载方式：运行 tools\emergency-uninstall.cmd
echo.
echo   按任意键开始安装...
pause >nul
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\install.ps1" %*
echo.
echo 安装脚本结束。如果有报错，请把上面的红字/报错整段截图发给作者。
pause