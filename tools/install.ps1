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
  $c = Get-Command dsh -ErrorAction SilentlyContinue
  if ($c) { return $c.Source }
  $roots = @(
    (Join-Path $env:LOCALAPPDATA 'Programs\DeepSeek Harness'),
    (Join-Path ([Environment]::GetEnvironmentVariable('ProgramFiles')) 'DeepSeek Harness'),
    (Join-Path ([Environment]::GetEnvironmentVariable('ProgramFiles(x86)')) 'DeepSeek Harness')
  )
  foreach ($r in $roots) {
    if (-not $r) { continue }
    $p = Join-Path $r 'resources\runtime\cli\bin\dsh.cmd'
    if (Test-Path $p) { return $p }
  }
  return $null
}

$dsh = Find-DshCli
if (-not $dsh) {
  Die '找不到 DeepSeek Harness 的命令行。请先安装桌面端（或 npm i -g @deepseek-ai/dsh）再运行本脚本。'
}
Say ('DSH 命令行：' + $dsh)

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

  Say '  [1/3] 卸掉同类旧插件（没装就跳过）…'
  foreach ($old in @('dsh-startup-screen', 'dsh-chat-wallpaper')) {
    & $dsh plugin --profile $profile remove $old 2>&1 | Out-Null
  }

  Say '  [2/3] 安装本插件（link 方式，改代码即生效）…'
  & $dsh plugin --profile $profile add $spec 2>&1 | ForEach-Object { '        ' + $_ }
  if ($LASTEXITCODE -ne 0) {
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
