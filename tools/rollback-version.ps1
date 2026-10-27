#Requires -Version 5.1
<#
  dsh-boot-suite —— 紧急回滚到更新前的版本（v2.13.3 起）

  安装器在每次更新前会自动在桌面生成：
    紧急回滚-V<旧版本>（先完全退出 DSH 再双击）.cmd
  它调用的就是本脚本：把插件 link 回到更新前那个版本的目录。
  只换插件版本，不碰用户配置（~/.dsh/*.json、模板、底图）。

  用法：
    powershell -NoProfile -ExecutionPolicy Bypass -File tools\rollback-version.ps1 -TargetPkg "<旧版本pkg目录>" -Profile desktop
    加 -CheckOnly 只检查、不改动；加 -NoStart 回滚后不自动打开 DSH。
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)][string]$TargetPkg,
  [string]$Profile = 'desktop',
  [switch]$CheckOnly,
  [switch]$NoStart
)

$ErrorActionPreference = 'Stop'
function Say($m) { Write-Host $m }
function Die($m) { Write-Host ('[x] ' + $m) -ForegroundColor Red; exit 1 }

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$desktop = [Environment]::GetFolderPath('Desktop')
if (-not $desktop) { $desktop = Join-Path $env:USERPROFILE 'Desktop' }
$updatesRoot = Join-Path $env:USERPROFILE '.dsh\boot-suite-updates'
$logName = 'dsh-boot-suite 回滚日志 ' + $stamp + '.txt'
$log = Join-Path $desktop $logName
$fallbackLog = Join-Path $updatesRoot $logName
function Log($m) {
  $line = (Get-Date -Format 'HH:mm:ss') + '  ' + $m
  Write-Host $line -ForegroundColor Cyan
  foreach ($t in @($log, $fallbackLog)) {
    try { Add-Content -Path $t -Value $line -Encoding UTF8; break } catch {}
  }
}

$TargetPkg = $TargetPkg.Trim().TrimEnd('\')
Log ('紧急回滚启动，目标目录：' + $TargetPkg)
if (-not (Test-Path (Join-Path $TargetPkg 'package.json'))) { Die ('目标版本目录不存在或不完整：' + $TargetPkg) }
try {
  $tobj = [System.IO.File]::ReadAllText((Join-Path $TargetPkg 'package.json'), [System.Text.Encoding]::UTF8) | ConvertFrom-Json
} catch { Die '目标版本的 package.json 无法解析' }
if (-not (Test-Path (Join-Path $TargetPkg 'lib\index.js'))) { Die '目标版本缺少 lib\index.js，目录不完整' }
if (-not (Test-Path (Join-Path $TargetPkg 'tools\install.ps1'))) { Die '目标版本缺少 tools\install.ps1，无法回滚' }
$targetVer = [string]$tobj.version
Log ('目标版本：v' + $targetVer)

$ProfileDir = Join-Path (Join-Path $env:USERPROFILE '.dsh\profiles') $Profile
if (-not (Test-Path (Join-Path $ProfileDir 'package.json'))) { Die ('找不到 profile：' + $ProfileDir) }
if ($CheckOnly) { Log '检查通过（CheckOnly，未修改任何东西）'; exit 0 }

$running = @(Get-Process -Name 'DeepSeek Harness' -ErrorAction SilentlyContinue)
if ($running.Count -gt 0) {
  Log '检测到 DSH 还在运行。请完全退出（窗口 + 右下角托盘），本窗口会等待，最多 5 分钟…'
  $deadline = (Get-Date).AddMinutes(5)
  $lastTick = Get-Date
  while ((Get-Date) -lt $deadline) {
    if (-not (Get-Process -Name 'DeepSeek Harness' -ErrorAction SilentlyContinue)) { break }
    if (((Get-Date) - $lastTick).TotalSeconds -ge 15) { $lastTick = Get-Date; Log '仍在等待 DSH 退出…' }
    Start-Sleep -Seconds 2
  }
  if (Get-Process -Name 'DeepSeek Harness' -ErrorAction SilentlyContinue) { Die '等了 5 分钟 DSH 还没退出，已取消回滚（不会改动任何东西）' }
}
Log '已确认 DSH 完全退出'

$keep = Join-Path $updatesRoot ('rollback-backup-' + $stamp)
New-Item -ItemType Directory -Force -Path $keep | Out-Null
Copy-Item (Join-Path $ProfileDir 'package.json') (Join-Path $keep 'profile-package.json') -Force
if (Test-Path (Join-Path $ProfileDir 'pnpm-lock.yaml')) {
  Copy-Item (Join-Path $ProfileDir 'pnpm-lock.yaml') (Join-Path $keep 'pnpm-lock.yaml') -Force -ErrorAction SilentlyContinue
}
Log ('当前 profile 状态已备份到：' + $keep)

$installer = Join-Path $TargetPkg 'tools\install.ps1'
Log '运行旧版本安装器（把插件 link 回旧版本目录）…'
$env:DSH_BOOT_SUITE_ROLLBACK = '1'
try {
  $proc = Start-Process -FilePath 'powershell.exe' -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $installer, '-Profiles', $Profile) -Wait -PassThru -NoNewWindow
} finally {
  Remove-Item Env:DSH_BOOT_SUITE_ROLLBACK -ErrorAction SilentlyContinue
}
if ($proc.ExitCode -ne 0) {
  Copy-Item (Join-Path $keep 'profile-package.json') (Join-Path $ProfileDir 'package.json') -Force
  if (Test-Path (Join-Path $keep 'pnpm-lock.yaml')) {
    Copy-Item (Join-Path $keep 'pnpm-lock.yaml') (Join-Path $ProfileDir 'pnpm-lock.yaml') -Force -ErrorAction SilentlyContinue
  }
  Die ('旧版本安装器退出码 ' + $proc.ExitCode + '，已恢复 profile 配置')
}

$inst = Join-Path $ProfileDir 'node_modules\dsh-boot-suite'
if (-not (Test-Path $inst)) { Die '回滚后 node_modules 里没有 dsh-boot-suite，请把回滚日志发给作者' }
$gotVer = $null
try {
  $gotVer = [string](([System.IO.File]::ReadAllText((Join-Path $inst 'package.json'), [System.Text.Encoding]::UTF8) | ConvertFrom-Json).version)
} catch {}
if ($gotVer -ne $targetVer) {
  Die ('回滚后版本是 ' + $gotVer + '，不是期望的 ' + $targetVer + '，请把回滚日志发给作者')
}
Log ('回滚成功：现在装的是 v' + $gotVer)

if (-not $NoStart) {
  $exe = Join-Path $env:LOCALAPPDATA 'Programs\DeepSeek Harness\DeepSeek Harness.exe'
  if (Test-Path $exe) {
    Log '正在重新打开 DSH…'
    Start-Process -FilePath $exe
  } else {
    Log '没找到 DSH 可执行文件，请手动打开客户端'
  }
}
Log '完成。如果新版一直打不开，就双击这个回滚按钮；回滚成功后请把「回滚日志」发给作者。'
Start-Sleep -Seconds 5
exit 0
