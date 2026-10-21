#Requires -Version 5.1
<#
  dsh-boot-suite —— 在线一键安装（GitHub 直连，不用网盘）
  用法（PowerShell 里执行一行）：
    irm https://raw.githubusercontent.com/LeeRolling/dsh-boot-suite/main/安装-在线.ps1 | iex
#>
[CmdletBinding()]
param([switch]$CheckOnly)

$ErrorActionPreference = 'Stop'
$repo = 'LeeRolling/dsh-boot-suite'
$zipUrl = 'https://github.com/' + $repo + '/releases/latest/download/dsh-boot-suite-win.zip'
$fallbackUrl = 'https://github.com/' + $repo + '/archive/refs/heads/main.zip'

Write-Host ''
Write-Host '============================================================' -ForegroundColor Cyan
Write-Host '  dsh-boot-suite —— 在线安装' -ForegroundColor Cyan
Write-Host '============================================================' -ForegroundColor Cyan
Write-Host '  [重要] 请先完全退出 DeepSeek Harness Desktop（右下角托盘也要退出）'
Write-Host ''

$tmp = Join-Path $env:TEMP ('dsh-boot-suite-online-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Force -Path $tmp | Out-Null
$zip = Join-Path $tmp 'package.zip'
$dir = Join-Path $tmp 'pkg'

Write-Host '[1/3] 下载最新版…'
$downloaded = $false
try {
  Invoke-WebRequest -Uri $zipUrl -OutFile $zip -UseBasicParsing -TimeoutSec 120
  $downloaded = $true
} catch {
  Write-Host ('      发布包下载失败：' + $_.Exception.Message)
  Write-Host '      改用源码包（main 分支）…'
}
if (-not $downloaded) {
  Invoke-WebRequest -Uri $fallbackUrl -OutFile $zip -UseBasicParsing -TimeoutSec 120
}

Write-Host '[2/3] 解压…'
Expand-Archive -Path $zip -DestinationPath $dir -Force

$installCmd = Get-ChildItem $dir -Recurse -Filter '安装.cmd' -ErrorAction SilentlyContinue | Select-Object -First 1
$installPs1 = Get-ChildItem $dir -Recurse -Filter 'install.ps1' -ErrorAction SilentlyContinue | Where-Object { $_.FullName -match 'tools' } | Select-Object -First 1
if (-not $installCmd -and -not $installPs1) {
  Write-Host '[x] 压缩包里没找到安装脚本，可能下载不完整。' -ForegroundColor Red
  exit 1
}

Write-Host '[3/3] 开始安装…'
if ($CheckOnly) {
  if ($installPs1) { & powershell -NoProfile -ExecutionPolicy Bypass -File $installPs1.FullName -CheckOnly }
  else { Write-Host '（检查模式：只下载解压成功，不执行安装）' }
} else {
  if ($installCmd) { & $installCmd.FullName }
  elseif ($installPs1) { & powershell -NoProfile -ExecutionPolicy Bypass -File $installPs1.FullName }
}

Write-Host ''
Write-Host ('临时目录：' + $tmp)
Write-Host '安装结束。如果失败，请运行包里的「诊断.cmd」并把桌面生成的报告发给作者。'
