#Requires -Version 5.1
<#
  dsh-boot-suite —— 彻底卸载（急救）
  会处理 desktop 和 web 两个 profile，清掉：
    · dsh-boot-suite 依赖与 node_modules 链接
    · bundles 列表里的 dsh-boot-suite / dsh-startup-screen / dsh-chat-wallpaper
    · 残留的旧插件链接
  用法：先完全退出桌面端（托盘也退），再双击「卸载.cmd」。
#>
[CmdletBinding()]
param([string[]]$Profiles)

$ErrorActionPreference = 'Stop'
function Say($m) { Write-Host $m }
function Die($m) { Write-Host ('[x] ' + $m) -ForegroundColor Red; exit 1 }

$profilesRoot = Join-Path $env:USERPROFILE '.dsh\profiles'
if (-not (Test-Path $profilesRoot)) { Die '找不到 profile 目录，可能还没装过 DeepSeek Harness。' }

$running = @(Get-Process -Name 'DeepSeek Harness' -ErrorAction SilentlyContinue)
if ($running.Count -gt 0) {
  Die ('桌面端还在运行（' + $running.Count + ' 个进程）。请先在任务管理器结束全部 DeepSeek Harness，再从托盘确认已退出。')
}

$targets = @()
if ($Profiles) {
  foreach ($p in $Profiles) { if (Test-Path (Join-Path $profilesRoot $p)) { $targets += $p } }
} else {
  foreach ($p in @('desktop', 'web')) { if (Test-Path (Join-Path $profilesRoot $p)) { $targets += $p } }
}
if ($targets.Count -eq 0) { Die '没有找到 desktop / web profile。' }

$pluginNames = @('dsh-boot-suite', 'dsh-startup-screen', 'dsh-chat-wallpaper')
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'

foreach ($profile in $targets) {
  $dir = Join-Path $profilesRoot $profile
  $pj = Join-Path $dir 'package.json'
  Say ''
  Say ('=== profile: ' + $profile + ' ===')
  if (-not (Test-Path $pj)) { Say '  （没有 package.json，跳过）'; continue }

  $bk = Join-Path $dir ('_backup-uninstall-' + $stamp)
  New-Item -ItemType Directory -Force -Path $bk | Out-Null
  Copy-Item $pj (Join-Path $bk 'package.json') -Force
  Say ('  备份 → ' + $bk)

  # 1) 从 dependencies 删掉（直接改 JSON，不依赖 pnpm/npm 是否可用）
  $pkg = [System.IO.File]::ReadAllText($pj) | ConvertFrom-Json
  $removed = @()
  if ($pkg.dependencies) {
    foreach ($name in $pluginNames) {
      if ($pkg.dependencies.PSObject.Properties[$name]) {
        $pkg.dependencies.PSObject.Properties.Remove($name)
        $removed += $name
      }
    }
  }

  # 2) bundles 列表清理
  $keep = @()
  if ($pkg.dsh -and $pkg.dsh.profile -and $pkg.dsh.profile.bundles) {
    foreach ($b in @($pkg.dsh.profile.bundles)) {
      if ($b -in $pluginNames) { continue }
      $keep += $b
    }
    $pkg.dsh.profile.bundles = $keep
  }
  [System.IO.File]::WriteAllText($pj, ($pkg | ConvertTo-Json -Depth 20), (New-Object System.Text.UTF8Encoding($false)))
  Say ('  依赖已移除：' + (($removed -join ', ') -replace '^$', '（本来就没有）'))
  Say ('  bundles = ' + (($keep -join ', ') -replace '^$', '（空）'))

  # 3) 删 node_modules 里的链接/目录
  $nm = Join-Path $dir 'node_modules'
  if (Test-Path $nm) {
    foreach ($name in $pluginNames + @('dsh-boot-suite-link')) {
      $inst = Join-Path $nm $name
      if (-not (Test-Path $inst)) { continue }
      $item = Get-Item $inst -Force
      try {
        if ($item.LinkType) { cmd /c rmdir "$inst" | Out-Null }
        else { Remove-Item $inst -Recurse -Force -ErrorAction SilentlyContinue }
        Say ('  已删除 node_modules\' + $name)
      } catch { Say ('  [!] 删除失败：' + $inst) }
    }
  }
  # 4) 残留 lockfile 备份，不删
}

Say ''
Say '完成。请重新打开 DeepSeek Harness，确认界面恢复且没有开机动画。'
Say '如果仍有动画：说明还有第二份安装（另一个 profile 或另一个插件目录），'
Say '请双击「诊断.cmd」生成报告发给作者。'
