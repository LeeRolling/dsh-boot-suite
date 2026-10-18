#Requires -Version 5.1
<#
  dsh-boot-suite —— 回滚到某个备份

  备份由 tools\make-backup.ps1 生成，放在仓库的 backups\known-good-<时间戳>\ 下。

  用法：
    1) 完全退出桌面端
    2) 运行 tools\rollback.cmd（默认取最新备份）
       或 powershell -File tools\rollback.ps1 -Backup "backups\known-good-2026-10-18_170000"
    3) 重新打开桌面端
#>
[CmdletBinding()]
param([string]$Backup, [string]$Profile = 'desktop')

$ErrorActionPreference = 'Stop'
function Say($m) { Write-Host $m }
function Die($m) { Write-Host ('[x] ' + $m) -ForegroundColor Red; exit 1 }

$RepoRoot = Split-Path -Parent $PSScriptRoot
$ProfilesRoot = Join-Path $env:USERPROFILE '.dsh\profiles'
$ProfileDir = Join-Path $ProfilesRoot $Profile

function Get-NodeExe { $c = Get-Command node -ErrorAction SilentlyContinue; if ($c) { return $c.Source } ; Die 'PATH 里找不到 node' }
function Get-PnpmCjs {
  $c = Get-Command pnpm -ErrorAction SilentlyContinue
  if ($c) { return @{ node = Get-NodeExe; pnpm = $c.Source } }
  $roots = @(
    (Join-Path $env:LOCALAPPDATA 'Programs\DeepSeek Harness'),
    (Join-Path ([Environment]::GetEnvironmentVariable('ProgramFiles')) 'DeepSeek Harness'),
    (Join-Path ([Environment]::GetEnvironmentVariable('ProgramFiles(x86)')) 'DeepSeek Harness')
  )
  foreach ($r in $roots) {
    if (-not $r -or -not (Test-Path $r)) { continue }
    $hit = Get-ChildItem $r -Recurse -Filter 'pnpm.cjs' -ErrorAction SilentlyContinue | Where-Object { $_.FullName -match 'pnpm\\bin\\pnpm\.cjs$' } | Select-Object -First 1
    if ($hit) { return @{ node = Get-NodeExe; pnpm = $hit.FullName } }
  }
  Die '找不到 pnpm'
}

if (-not $Backup) {
  $bkRoot = Join-Path $RepoRoot 'backups'
  if (-not (Test-Path $bkRoot)) { Die ('还没有任何备份：' + $bkRoot) }
  $latest = Get-ChildItem $bkRoot -Directory -Filter 'known-good-*' | Sort-Object LastWriteTime -Descending | Select-Object -First 1
  if (-not $latest) { Die 'backups 下没有 known-good-* 目录' }
  $Backup = $latest.FullName
} elseif (-not (Test-Path $Backup)) {
  $cand = Join-Path $RepoRoot $Backup
  if (Test-Path $cand) { $Backup = $cand } else { Die ('备份不存在：' + $Backup) }
}

$srcDir = Join-Path $Backup 'src'
if (-not (Test-Path (Join-Path $srcDir 'lib\index.js'))) { Die ('备份里没有完整源码：' + $srcDir) }

$running = @(Get-Process -Name 'DeepSeek Harness' -ErrorAction SilentlyContinue)
if ($running.Count -gt 0) { Die ('桌面端还在运行（' + $running.Count + ' 个进程）。完全退出后再试。') }

$pj = Join-Path $ProfileDir 'package.json'
if (-not (Test-Path $pj)) { Die ('找不到 profile：' + $ProfileDir) }
$pm = Get-PnpmCjs

Say ('[1/4] 使用备份：' + $Backup)
$keepDir = Join-Path $ProfileDir ('_backup-rollback-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Force -Path $keepDir | Out-Null
Copy-Item $pj (Join-Path $keepDir 'package.json') -Force
if (Test-Path (Join-Path $ProfileDir 'pnpm-lock.yaml')) { Copy-Item (Join-Path $ProfileDir 'pnpm-lock.yaml') (Join-Path $keepDir 'pnpm-lock.yaml') -Force }

Say '[2/4] 卸载当前版本 …'
& $pm.node $pm.pnpm remove --dir $ProfileDir dsh-boot-suite 2>&1 | ForEach-Object { '    ' + $_ }

Say '[3/4] 从备份安装 …'
$spec = 'link:' + ($srcDir -replace '\\', '/')
& $pm.node $pm.pnpm add --dir $ProfileDir $spec 2>&1 | ForEach-Object { '    ' + $_ }
if ($LASTEXITCODE -ne 0) {
  Say '[x] 安装失败，恢复 profile 配置'
  Copy-Item (Join-Path $keepDir 'package.json') $ProfileDir -Force
  if (Test-Path (Join-Path $keepDir 'pnpm-lock.yaml')) { Copy-Item (Join-Path $keepDir 'pnpm-lock.yaml') $ProfileDir -Force }
  exit 1
}

Say '[4/4] 修正 bundles 列表 …'
$pkg = [System.IO.File]::ReadAllText($pj) | ConvertFrom-Json
$keep = @()
foreach ($b in @($pkg.dsh.profile.bundles)) { if ($b -in @('dsh-startup-screen', 'dsh-chat-wallpaper')) { continue }; $keep += $b }
if ($keep -notcontains 'dsh-boot-suite') {
  $idx = [array]::IndexOf($keep, 'dsh-plugin-desktop-notify')
  if ($idx -gt 0) { $keep = @($keep[0..($idx-1)]) + 'dsh-boot-suite' + @($keep[$idx..($keep.Count-1)]) } else { $keep += 'dsh-boot-suite' }
}
$pkg.dsh.profile.bundles = $keep
[System.IO.File]::WriteAllText($pj, ($pkg | ConvertTo-Json -Depth 20), (New-Object System.Text.UTF8Encoding($false)))

$cfgDir = Join-Path $Backup 'config'
if (Test-Path $cfgDir) {
  foreach ($f in Get-ChildItem $cfgDir -File) { Copy-Item $f.FullName (Join-Path $env:USERPROFILE ('.dsh\' + $f.Name)) -Force -ErrorAction SilentlyContinue }
}

Say ''
Say '回滚完成 —— 可以重新打开桌面端了。'
