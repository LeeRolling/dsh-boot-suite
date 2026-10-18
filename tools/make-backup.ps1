#Requires -Version 5.1
<#
  给当前状态留一份"已知可用"快照（改代码前先跑一次）。

  产物：backups\known-good-<时间戳>\
          src\        插件源码（不含 .git / node_modules）
          config\     ~/.dsh 下的两个配置文件
#>
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$RepoRoot = Split-Path -Parent $PSScriptRoot
$stamp = Get-Date -Format 'yyyy-MM-dd_HHmmss'
$out = Join-Path $RepoRoot ('backups\known-good-' + $stamp)
New-Item -ItemType Directory -Force -Path (Join-Path $out 'src') | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $out 'config') | Out-Null

$skip = @('.git', 'node_modules', 'backups', 'tools', 'docs')
function Copy-Tree($from, $to) {
  New-Item -ItemType Directory -Force -Path $to | Out-Null
  foreach ($n in Get-ChildItem $from -Force) {
    if ($skip -contains $n.Name) { continue }
    $a = $n.FullName; $b = Join-Path $to $n.Name
    if ($n.PSIsContainer) { Copy-Tree $a $b } else { Copy-Item $a $b -Force }
  }
}
Copy-Tree $RepoRoot (Join-Path $out 'src')

$home_ = Join-Path $env:USERPROFILE '.dsh'
foreach ($f in @('dsh-startup.json', 'chat-wallpaper.json')) {
  $p = Join-Path $home_ $f
  if (Test-Path $p) { Copy-Item $p (Join-Path $out ('config\' + $f)) -Force }
}

Set-Content -Path (Join-Path $out 'README.txt') -Value @(
  '已知可用快照 ' + $stamp,
  '',
  '回滚：tools\rollback.cmd（默认取 backups 下最新的 known-good-*）'
) -Encoding UTF8

Write-Host ('备份完成 → ' + $out)
