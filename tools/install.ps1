#Requires -Version 5.1
<#
  dsh-boot-suite —— 一键安装

  用法：双击仓库根目录的「安装.cmd」，或者：
        powershell -NoProfile -ExecutionPolicy Bypass -File tools\install.ps1
        powershell -NoProfile -ExecutionPolicy Bypass -File tools\install.ps1 -CheckOnly   # 只看计划，不动手

  它做什么：
    1. 自动找到 DSH 的命令行（PATH 里没有也没关系，会去安装目录找）
    2. 找到已经初始化过的 profile（web / desktop）
    3. 桌面端在跑就先停下，要求你完全退出
    4. 卸掉同类的旧插件（dsh-startup-screen / dsh-chat-wallpaper）
    5. 以 link: 方式安装本仓库
    6. 修正 profile 的 bundles 列表（DSH 靠它决定加载哪些插件）
    7. 自检并告诉你下一步
#>
[CmdletBinding()]
param([switch]$CheckOnly, [string[]]$Profiles)

$ErrorActionPreference = 'Stop'
function Say($m) { Write-Host $m }
function Die($m) { Write-Host ('[x] ' + $m) -ForegroundColor Red; exit 1 }

$RepoRoot = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path (Join-Path $RepoRoot 'package.json'))) { Die ('这不像插件目录：' + $RepoRoot) }
if (-not (Test-Path (Join-Path $RepoRoot 'lib\index.js'))) { Die '源码不完整（缺 lib\index.js），你下载的可能是残缺的压缩包' }

# 注意：Windows PowerShell 5.1 的 Get-Content 会按 ANSI 解码 UTF-8 文件，中文会糊成乱码、JSON 直接解析失败。
# 统一用 [System.IO.File]::ReadAllText —— 它按 UTF-8 读。
$pkgSelf = [System.IO.File]::ReadAllText((Join-Path $RepoRoot 'package.json')) | ConvertFrom-Json
Say ('dsh-boot-suite v' + $pkgSelf.version)
Say ('仓库位置：' + $RepoRoot)

if ($CheckOnly) { Say '[检查模式] 只报告计划，不修改任何东西' }

# ── 1. 找 DSH 命令行 ────────────────────────────────────────────────────────
function Find-DshCli {
  # 优先 DSH 安装目录里的官方 CLI（跳过 PATH 里的第三方包装脚本，如 ai-manager 的 dsh.ps1）
  $official = @(
    (Join-Path $env:LOCALAPPDATA 'Programs\DeepSeek Harness\resources\runtime\cli\bin\dsh.cmd'),
    (Join-Path ([Environment]::GetEnvironmentVariable('ProgramFiles')) 'DeepSeek Harness\resources\runtime\cli\bin\dsh.cmd'),
    (Join-Path ([Environment]::GetEnvironmentVariable('ProgramFiles(x86)')) 'DeepSeek Harness\resources\runtime\cli\bin\dsh.cmd')
  )
  foreach ($op in $official) { if ($op -and (Test-Path $op)) { return $op } }
  $c = Get-Command dsh -ErrorAction SilentlyContinue
  if ($c -and $c.Source) {
    if ($c.Source -match '\.ai-manager') { $c = $null } else { return $c.Source }
  }

  # 桌面端可能装在任意目录：命令行 / 常见位置 / 注册表 / 正在运行的进程 / 有界递归
  $candidates = New-Object System.Collections.Generic.List[string]
  $roots = @(
    (Join-Path $env:LOCALAPPDATA 'Programs'),
    ([Environment]::GetEnvironmentVariable('ProgramFiles')),
    ([Environment]::GetEnvironmentVariable('ProgramFiles(x86)')),
    (Join-Path $env:LOCALAPPDATA 'Microsoft\WinGet\Packages')
  )
  foreach ($r in $roots) {
    if (-not $r -or -not (Test-Path $r)) { continue }
    $candidates.Add((Join-Path $r 'DeepSeek Harness\resources\runtime\cli\bin\dsh.cmd'))
  }
  $uninstallRoots = @(
    'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*',
    'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*',
    'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*'
  )
  foreach ($u in $uninstallRoots) {
    try {
      Get-ItemProperty $u -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -like '*DeepSeek*' -and $_.InstallLocation } | ForEach-Object {
        $candidates.Add((Join-Path $_.InstallLocation 'resources\runtime\cli\bin\dsh.cmd'))
      }
    } catch {}
  }
  try {
    Get-Process -ErrorAction SilentlyContinue | ForEach-Object {
      if ($_.Path -and ($_.ProcessName -like '*DeepSeek*' -or $_.ProcessName -like '*dsh*')) {
        $candidates.Add((Join-Path (Split-Path -Parent $_.Path) 'resources\runtime\cli\bin\dsh.cmd'))
      }
    }
  } catch {}
  foreach ($cand in $candidates) { if (Test-Path -LiteralPath $cand) { return $cand } }

  # 有界递归兜底（深度 4）
  foreach ($r in $roots) {
    if (-not $r -or -not (Test-Path $r)) { continue }
    try {
      $hit = Get-ChildItem -LiteralPath $r -Filter 'dsh.cmd' -Recurse -Depth 4 -ErrorAction SilentlyContinue | Where-Object { $_.FullName -match '[/\\]cli[/\\]bin[/\\]dsh\.cmd$' } | Select-Object -First 1
      if ($hit) { return $hit.FullName }
    } catch {}
  }
  return $null
}

$dsh = Find-DshCli
$ManualMode = $false
if (-not $dsh) {
  Say '[!] 没找到 DeepSeek Harness 的命令行（dsh）。'
  Say '    不一定是没装：精简安装 / 便携版可能不带 CLI。'
  Say '    本脚本改用「手动安装」：直接改 profile 配置 + 建目录联接，效果一样。'
  $ManualMode = $true
} else {
  Say ('DSH 命令行：' + $dsh)
}

# ── 2. 找 profile ───────────────────────────────────────────────────────────
$profilesRoot = Join-Path $env:USERPROFILE '.dsh\profiles'
if (-not (Test-Path $profilesRoot)) {
  Die '还没初始化过 profile。请先打开一次 DeepSeek Harness Desktop，完全退出后再运行本脚本。'
}

$targets = @()
if ($Profiles) {
  foreach ($p in $Profiles) { if (Test-Path (Join-Path $profilesRoot $p)) { $targets += $p } }
} else {
  foreach ($p in @('desktop', 'web')) { if (Test-Path (Join-Path $profilesRoot $p)) { $targets += $p } }
}
if ($targets.Count -eq 0) { Die '没有找到已初始化的 profile（desktop / web）。先打开一次桌面端再退出。' }
Say ('要装的 profile：' + ($targets -join '、'))

# ── 3. 桌面端必须先完全退出 ─────────────────────────────────────────────────
if ($targets -contains 'desktop') {
  $running = @(Get-Process -Name 'DeepSeek Harness' -ErrorAction SilentlyContinue)
  if ($running.Count -gt 0 -and -not $CheckOnly) {
    Die ('桌面端还在运行（' + $running.Count + ' 个进程）。请完全退出 DeepSeek Harness Desktop 后再双击安装。')
  }
  if ($running.Count -gt 0) { Say '（检查模式）桌面端正在运行 —— 真正安装前需要先完全退出' }
}

$spec = 'link:' + ($RepoRoot -replace '\\', '/')

function Fix-Bundles([string]$profileDir) {
  $pj = Join-Path $profileDir 'package.json'
  if (-not (Test-Path $pj)) { return }
  $pkg = [System.IO.File]::ReadAllText($pj) | ConvertFrom-Json
  if (-not $pkg.dsh -or -not $pkg.dsh.profile) { return }
  $keep = @()
  foreach ($b in @($pkg.dsh.profile.bundles)) {
    if ($b -in @('dsh-startup-screen', 'dsh-chat-wallpaper')) { continue }
    $keep += $b
  }
  if ($keep -notcontains 'dsh-boot-suite') {
    $idx = [array]::IndexOf($keep, 'dsh-plugin-desktop-notify')
    if ($idx -gt 0) { $keep = @($keep[0..($idx-1)]) + 'dsh-boot-suite' + @($keep[$idx..($keep.Count-1)]) }
    else { $keep += 'dsh-boot-suite' }
  }
  $pkg.dsh.profile.bundles = $keep
  [System.IO.File]::WriteAllText($pj, ($pkg | ConvertTo-Json -Depth 20), (New-Object System.Text.UTF8Encoding($false)))
}

function Remove-Manual([string]$profileDir, [string]$name) {
  $pj = Join-Path $profileDir 'package.json'
  if (-not (Test-Path $pj)) { return }
  $pkg = [System.IO.File]::ReadAllText($pj) | ConvertFrom-Json
  if ($pkg.dependencies) { $pkg.dependencies.PSObject.Properties.Remove($name) }
  if ($pkg.dsh -and $pkg.dsh.profile -and $pkg.dsh.profile.bundles) {
    $keep = @()
    foreach ($b in @($pkg.dsh.profile.bundles)) { if ($b -ne $name) { $keep += $b } }
    $pkg.dsh.profile.bundles = $keep
  }
  [System.IO.File]::WriteAllText($pj, ($pkg | ConvertTo-Json -Depth 20), (New-Object System.Text.UTF8Encoding($false)))
  $inst = Join-Path $profileDir ('node_modules' + [char]92 + $name)
  if (Test-Path $inst) {
    $item = Get-Item $inst -Force
    if ($item.LinkType) { cmd /c rmdir "$inst" | Out-Null } else { Remove-Item $inst -Recurse -Force -ErrorAction SilentlyContinue }
  }
}

function Install-Manual([string]$profileDir) {
  $pj = Join-Path $profileDir 'package.json'
  $pkgObj = [System.IO.File]::ReadAllText($pj) | ConvertFrom-Json
  if (-not $pkgObj.PSObject.Properties['dependencies']) {
    $pkgObj | Add-Member -NotePropertyName dependencies -NotePropertyValue ([pscustomobject]@{}) -Force
  }
  $pkgObj.dependencies | Add-Member -NotePropertyName 'dsh-boot-suite' -NotePropertyValue $spec -Force
  [System.IO.File]::WriteAllText($pj, ($pkgObj | ConvertTo-Json -Depth 20), (New-Object System.Text.UTF8Encoding($false)))
  $nm = Join-Path $profileDir 'node_modules'
  if (-not (Test-Path $nm)) { New-Item -ItemType Directory -Force -Path $nm | Out-Null }
  $linkPath = Join-Path $nm 'dsh-boot-suite'
  if (Test-Path $linkPath) {
    $item = Get-Item $linkPath -Force
    if ($item.LinkType) { cmd /c rmdir "$linkPath" | Out-Null }
    else { Move-Item $linkPath (Join-Path $bk.FullName 'node_modules-old') -Force -ErrorAction SilentlyContinue }
  }
  cmd /c mklink /J "$linkPath" "$RepoRoot" | Out-Null
  if (-not (Test-Path $linkPath)) {
    Copy-Item (Join-Path $bk.FullName 'package.json') $pj -Force
    Die '手动安装失败：无法创建 node_modules 目录联接（可能被杀毒软件拦截）'
  }
  Say ('        ok -> ' + $linkPath)
}
foreach ($profile in $targets) {
  $profileDir = Join-Path $profilesRoot $profile
  Say ''
  Say ('=== profile: ' + $profile + ' ===')

  if ($CheckOnly) {
    Say ('  会执行：dsh plugin --profile ' + $profile + ' remove dsh-startup-screen / dsh-chat-wallpaper（装过才卸）')
    Say ('  会执行：dsh plugin --profile ' + $profile + ' add ' + $spec)
    continue
  }

  New-Item -ItemType Directory -Force -Path (Join-Path $profileDir ('_backup-install-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))) | Out-Null
  $bk = Get-ChildItem $profileDir -Directory -Filter '_backup-install-*' | Sort-Object LastWriteTime -Descending | Select-Object -First 1
  Copy-Item (Join-Path $profileDir 'package.json') $bk.FullName -Force
  Copy-Item (Join-Path $profileDir 'pnpm-lock.yaml') $bk.FullName -Force -ErrorAction SilentlyContinue

  Say '  [1/3] 检查并卸掉同类旧插件…'
  foreach ($old in @('dsh-startup-screen', 'dsh-chat-wallpaper')) {
    $installedOld = $false
    try {
      $pjTmp = [System.IO.File]::ReadAllText((Join-Path $profileDir 'package.json')) | ConvertFrom-Json
      if ($pjTmp.dependencies -and $pjTmp.dependencies.PSObject.Properties[$old]) { $installedOld = $true }
    } catch {}
    if (-not $installedOld) { Say ('        跳过 ' + $old + '（未安装）'); continue }
    Say ('        卸载旧插件 ' + $old + ' …')
    $eapOld = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    $outRm = ''
    try { $outRm = (& $dsh plugin --profile $profile remove $old 2>&1 | Out-String) } catch { $outRm = $_.Exception.Message }
    if ($outRm.Trim()) { $outRm.Trim().Split([char]10) | ForEach-Object { '        ' + $_ } }
    if ($outRm -match 'managed exclusively' -or $outRm -match 'not installed' -or $outRm -match '未安装') {
      Remove-Manual $profileDir $old
      Say '        已改为手动清理（命令行不允许管理 desktop profile）'
    }
    $ErrorActionPreference = $eapOld
  }

  Say '  [2/3] 安装本插件（link 方式，改代码即生效）…'
  if ($ManualMode) {
    Install-Manual $profileDir
  } else {
    $eapAdd = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    $outAdd = ''
    try { $outAdd = (& $dsh plugin --profile $profile add $spec 2>&1 | Out-String) } catch { $outAdd = $_.Exception.Message }
    if ($outAdd.Trim()) { $outAdd.Trim().Split([char]10) | ForEach-Object { '        ' + $_ } }
    $addExit = $LASTEXITCODE
    $ErrorActionPreference = $eapAdd
    if ($addExit -ne 0 -or $outAdd -match 'managed exclusively') {
      Say '  [2/3] 命令行被拒绝（desktop profile 仅允许客户端管理），改用「手动安装」…'
      Install-Manual $profileDir
      if (Test-Path (Join-Path $profileDir 'node_modules\dsh-boot-suite')) { $addExit = 0 } else { $addExit = 1 }
    }
  }
  if (-not $ManualMode -and $addExit -ne 0) {
    Say '  [x] 安装失败，正在回滚 profile 配置'
    Copy-Item (Join-Path $bk.FullName 'package.json') (Join-Path $profileDir 'package.json') -Force
    Copy-Item (Join-Path $bk.FullName 'pnpm-lock.yaml') (Join-Path $profileDir 'pnpm-lock.yaml') -Force -ErrorAction SilentlyContinue
    Die '安装失败，已回滚。把上面的报错发到仓库 issue。'
  }

  Say '  [3/3] 修正 bundles 列表 …'
  Fix-Bundles $profileDir

  $inst = Join-Path $profileDir 'node_modules\dsh-boot-suite'
  if (Test-Path $inst) {
    $ver = ([System.IO.File]::ReadAllText((Join-Path $inst 'package.json')) | ConvertFrom-Json).version
    Say ('  装好了：v' + $ver)
  } else {
    Say '  [!] node_modules 里没看到 dsh-boot-suite，请检查上面的输出'
  }
}

Say ''
if ($CheckOnly) {
  Say '检查完毕 —— 没有修改任何东西。确认无误后双击「安装.cmd」正式安装。'
} else {
  Say '完成 —— 现在打开 DeepSeek Harness Desktop。'
  Say '打开后确认三件事：'
  Say '  1) 设置页里多出「启动动画」和「聊天背景」两项'
  Say '  2) 冷启动会播六幕开机动画'
  Say '  3) 动画结束后播开场视频、落在聊天底图上'
  Say ''
  Say '出问题（黑屏/点不动）：任务管理器结束全部 DeepSeek Harness 进程，然后双击「卸载.cmd」。'
}
