#Requires -Version 5.1
<#
  dsh-boot-suite —— 急救：把插件从 desktop profile 里彻底卸掉

  什么时候用：开机黑屏、动画卡死、界面点不动，你想先让客户端恢复正常。
  用法：
    1) 用任务管理器结束全部 "DeepSeek Harness" 进程
    2) 右键 tools\emergency-uninstall.cmd → 运行（或 powershell -File 本文件）
    3) 重新打开桌面端，就是没有开机动画的干净界面

  只做减法：卸载插件 + 从 bundles 列表里去掉它，不碰你的配置和素材。
#>
[CmdletBinding()]
param([string]$Profile = 'desktop')

$ErrorActionPreference = 'Stop'
function Say($m) { Write-Host $m }
function Die($m) { Write-Host ('[x] ' + $m) -ForegroundColor Red; exit 1 }

function Get-NodeExe {
  $c = Get-Command node -ErrorAction SilentlyContinue
  if ($c) { return $c.Source }
  Die 'PATH 里找不到 node'
}

# pnpm：优先 PATH，其次 DSH 自带（在安装目录 runtime 下）
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
    $hit = Get-ChildItem $r -Recurse -Filter 'pnpm.cjs' -ErrorAction SilentlyContinue |
      Where-Object { $_.FullName -match 'pnpm\\bin\\pnpm\.cjs$' } | Select-Object -First 1
    if ($hit) { return @{ node = Get-NodeExe; pnpm = $hit.FullName } }
  }
  Die '找不到 pnpm（PATH 和 DeepSeek Harness 安装目录里都没有）'
}

$profilesRoot = Join-Path $env:USERPROFILE '.dsh\profiles'
$ProfileDir = Join-Path $profilesRoot $Profile
$pj = Join-Path $ProfileDir 'package.json'
if (-not (Test-Path $pj)) { Die ('找不到 profile：' + $ProfileDir) }

$running = @(Get-Process -Name 'DeepSeek Harness' -ErrorAction SilentlyContinue)
if ($running.Count -gt 0) {
  Die ('桌面端还在运行（' + $running.Count + ' 个进程）。先用任务管理器结束它，再运行本脚本。')
}

$pm = Get-PnpmCjs
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$bk = Join-Path $ProfileDir ('_backup-emergency-' + $stamp)
New-Item -ItemType Directory -Force -Path $bk | Out-Null
Copy-Item $pj (Join-Path $bk 'package.json') -Force
Say ('[1/3] 已备份 profile 配置 → ' + $bk)

Say '[2/3] 卸载 dsh-boot-suite …'
& $pm.node $pm.pnpm remove --dir $ProfileDir dsh-boot-suite 2>&1 | ForEach-Object { '    ' + $_ }

Say '[3/3] 清理 bundles 列表与残留链接 …'
$pkg = [System.IO.File]::ReadAllText($pj) | ConvertFrom-Json
if ($pkg.dsh -and $pkg.dsh.profile) {
  $keep = @()
  foreach ($b in @($pkg.dsh.profile.bundles)) {
    if ($b -in @('dsh-boot-suite', 'dsh-startup-screen', 'dsh-chat-wallpaper')) { continue }
    $keep += $b
  }
  $pkg.dsh.profile.bundles = $keep
  [System.IO.File]::WriteAllText($pj, ($pkg | ConvertTo-Json -Depth 20), (New-Object System.Text.UTF8Encoding($false)))
  Say ('    bundles = ' + ($keep -join ', '))
}

$inst = Join-Path $ProfileDir 'node_modules\dsh-boot-suite'
if (Test-Path $inst) {
  $item = Get-Item $inst -Force
  if ($item.LinkType) { cmd /c rmdir "$inst" | Out-Null } else { Remove-Item $inst -Recurse -Force -ErrorAction SilentlyContinue }
  Say '    已清掉 node_modules\dsh-boot-suite'
}

Say ''
Say '完成 —— 重新打开桌面端，就是没有开机动画的干净界面。'
