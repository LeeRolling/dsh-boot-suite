#Requires -Version 5.1
<#
  dsh-boot-suite 自动更新执行器（手动关闭 DSH 版）
#>
param(
  [Parameter(Mandatory=$true)][string]$Zip,
  [Parameter(Mandatory=$true)][string]$Version,
  [Parameter(Mandatory=$true)][string]$Exe,
  [Parameter(Mandatory=$true)][string]$Config
)
$ErrorActionPreference = 'Continue'
$desktop = [Environment]::GetFolderPath('Desktop')
$log = Join-Path $desktop ('dsh-boot-suite 更新日志 ' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.txt')
function Log($m) {
  $line = (Get-Date -Format 'HH:mm:ss') + '  ' + $m
  Write-Host $line -ForegroundColor Cyan
  try { Add-Content -Path $log -Value $line -Encoding UTF8 } catch {}
}
$work = Join-Path $env:USERPROFILE ('.dsh\boot-suite-updates\' + $Version)
try {
  Log ('更新器已启动，目标版本 v' + $Version)
  Log '请手动完全退出 DeepSeek Harness（窗口 + 右下角托盘）'
  Log '检测到 DSH 退出后会自动安装并重新打开，请勿关闭本窗口'
  $deadline = (Get-Date).AddMinutes(15)
  while ((Get-Date) -lt $deadline) {
    $p = Get-Process -Name 'DeepSeek Harness' -ErrorAction SilentlyContinue
    if (-not $p) { break }
    Start-Sleep -Seconds 2
  }
  $still = Get-Process -Name 'DeepSeek Harness' -ErrorAction SilentlyContinue
  if ($still) { throw '等待 15 分钟仍未检测到 DSH 退出，已取消本次更新' }
  Log '已检测到 DSH 退出，开始安装…'
  $pkg = Join-Path $work 'pkg'
  if (Test-Path $pkg) { Remove-Item $pkg -Recurse -Force -ErrorAction SilentlyContinue }
  New-Item -ItemType Directory -Force -Path $pkg | Out-Null
  Log '解压新版本…'
  Expand-Archive -Path $Zip -DestinationPath $pkg -Force
  # 防止发布包里的 package.json 带 UTF-8 BOM（严格 JSON 解析会拒绝加载插件）
  $pkgJson = Join-Path $pkg 'package.json'
  if (Test-Path $pkgJson) {
    $bytes = [System.IO.File]::ReadAllBytes($pkgJson)
    if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
      [System.IO.File]::WriteAllBytes($pkgJson, $bytes[3..($bytes.Length - 1)])
      Log '已移除 package.json 的 BOM'
    }
  }
  Log '备份配置…'
  $bk = Join-Path $work 'backup'
  New-Item -ItemType Directory -Force -Path $bk | Out-Null
  if (Test-Path $Config) { Copy-Item $Config (Join-Path $bk 'dsh-startup.json') -Force }
  Log '运行安装器（可能需要几十秒）…'
  $installer = Join-Path $pkg 'tools\install.ps1'
  if (-not (Test-Path $installer)) { throw '安装包里没有 tools/install.ps1' }
  $proc = Start-Process -FilePath 'powershell.exe' -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File', $installer) -Wait -PassThru -NoNewWindow
  if ($proc.ExitCode -ne 0) { throw ('安装器退出码 ' + $proc.ExitCode) }
  Log '安装完成，正在重新打开 DSH…'
  if (Test-Path $Exe) { Start-Process -FilePath $Exe } else { Log '找不到 DSH 可执行文件，请手动打开客户端' }
  Log '更新成功。本窗口 10 秒后自动关闭。'
  Start-Sleep -Seconds 10
  exit 0
} catch {
  Log ('更新失败：' + $_.Exception.Message)
  try {
    $bk = Join-Path $work 'backup'
    if (Test-Path (Join-Path $bk 'dsh-startup.json')) { Copy-Item (Join-Path $bk 'dsh-startup.json') $Config -Force }
    Log '配置已恢复。'
  } catch {}
  Log '旧版插件应仍可用，正在重新打开 DSH…'
  if (Test-Path $Exe) { Start-Process -FilePath $Exe }
  Log '请把桌面上的「更新日志」文件发给作者。本窗口 30 秒后关闭。'
  Start-Sleep -Seconds 30
  exit 1
}
