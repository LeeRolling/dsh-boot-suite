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
$sumUrl = 'https://github.com/' + $repo + '/releases/latest/download/SHA256SUMS.txt'

Write-Host ''
Write-Host '============================================================' -ForegroundColor Cyan
Write-Host '  dsh-boot-suite —— 在线安装' -ForegroundColor Cyan
Write-Host '============================================================' -ForegroundColor Cyan
Write-Host '  [重要] 请先完全退出 DeepSeek Harness Desktop（右下角托盘也要退出）'
Write-Host ''

$tmp = Join-Path $env:TEMP ('dsh-boot-suite-online-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Force -Path $tmp | Out-Null
$zip = Join-Path $tmp 'package.zip'
$sum = Join-Path $tmp 'SHA256SUMS.txt'
$dir = Join-Path $tmp 'pkg'

Write-Host '[1/4] 下载最新版与官方校验和…'
try {
  Invoke-WebRequest -Uri $zipUrl -OutFile $zip -UseBasicParsing -TimeoutSec 120
} catch {
  Write-Host ('[x] 下载失败（绝不安装未校验的包）：' + $_.Exception.Message) -ForegroundColor Red
  exit 1
}
$haveSums = $false
try {
  Invoke-WebRequest -Uri $sumUrl -OutFile $sum -UseBasicParsing -TimeoutSec 60
  $haveSums = $true
} catch {
  Write-Host '[1/4] 本次发布未提供 SHA256SUMS.txt，稍后改用 GitHub API 官方摘要校验…'
}

Write-Host '[2/4] 校验 SHA-256（官方发布摘要）…'
$entry = $null
if ($haveSums) {
try {
  $entry = Get-Content -Path $sum -ErrorAction Stop |
    ForEach-Object { [regex]::Match($_, '^([0-9a-fA-F]{64})\s+(.+)$') } |
    Where-Object { $_.Success } |
    ForEach-Object { [pscustomobject]@{ Hash = $_.Groups[1].Value.ToLower(); Name = $_.Groups[2].Value.Trim() } } |
    Where-Object { $_.Name -like 'dsh-boot-suite-win*.zip' } |
    Select-Object -First 1
} catch { $entry = $null }
}
if (-not $entry) {
  Write-Host '[2/4] 校验和文件里没有安装包摘要，改从 GitHub API 读取官方资产摘要…'
  try {
    $apiUrl = 'https://api.github.com/repos/' + $repo + '/releases/latest'
    $rel = Invoke-RestMethod -Uri $apiUrl -UseBasicParsing -Headers @{ 'User-Agent' = 'dsh-boot-suite-installer' } -TimeoutSec 30
    $asset = $rel.assets | Where-Object { $_.name -like 'dsh-boot-suite-win*.zip' -and $_.digest } | Select-Object -First 1
    if (-not $asset) { $asset = $rel.assets | Where-Object { $_.name -like 'dsh-boot-suite-win*.zip' } | Select-Object -First 1 }
    if ($asset -and $asset.digest) {
      $m = [regex]::Match([string]$asset.digest, '^sha256:([0-9a-fA-F]{64})$')
      if ($m.Success) { $entry = [pscustomobject]@{ Hash = $m.Groups[1].Value.ToLower(); Name = 'dsh-boot-suite-win.zip' } }
    }
  } catch {
    Write-Host ('[x] 读取 GitHub API 官方摘要失败：' + $_.Exception.Message) -ForegroundColor Red
  }
}
if (-not $entry) {
  Write-Host '[x] 发布里没有可用的官方 SHA-256 摘要（校验和文件与 GitHub API 都取不到），拒绝安装。' -ForegroundColor Red
  exit 1
}
$actual = (Get-FileHash -Path $zip -Algorithm SHA256).Hash.ToLower()
if ($actual -ne $entry.Hash) {
  Write-Host ('[x] 安装包 SHA-256 与官方发布不一致，拒绝安装。' + "实际=$actual 期望=$($entry.Hash)") -ForegroundColor Red
  exit 1
}
Write-Host '      校验通过。'

Write-Host '[3/4] 解压…'
Expand-Archive -Path $zip -DestinationPath $dir -Force

$installCmd = Get-ChildItem $dir -Recurse -Filter '安装.cmd' -ErrorAction SilentlyContinue | Select-Object -First 1
$installPs1 = Get-ChildItem $dir -Recurse -Filter 'install.ps1' -ErrorAction SilentlyContinue | Where-Object { $_.FullName -match 'tools' } | Select-Object -First 1
if (-not $installCmd -and -not $installPs1) {
  Write-Host '[x] 压缩包里没找到安装脚本，可能下载不完整。' -ForegroundColor Red
  exit 1
}

Write-Host '[4/4] 开始安装…'
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
