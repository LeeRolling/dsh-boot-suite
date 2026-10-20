#Requires -Version 5.1
<#
  dsh-boot-suite —— 一键诊断
  把环境信息写到桌面：dsh诊断-时间.txt
  用户把这个文件发给作者即可定位问题。
#>
$ErrorActionPreference = 'Continue'
$out = Join-Path ([Environment]::GetFolderPath('Desktop')) ('dsh诊断-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.txt')
$lines = New-Object System.Collections.Generic.List[string]
function L($s) { $lines.Add($s); Write-Host $s }

L '=== dsh-boot-suite 诊断报告 ==='
L ('时间：' + (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'))
L ('用户：' + $env:USERNAME + '　机器：' + $env:COMPUTERNAME)
L ''

L '--- DSH 安装位置与版本 ---'
$roots = @(
  (Join-Path $env:LOCALAPPDATA 'Programs\DeepSeek Harness'),
  (Join-Path ([Environment]::GetEnvironmentVariable('ProgramFiles')) 'DeepSeek Harness'),
  (Join-Path ([Environment]::GetEnvironmentVariable('ProgramFiles(x86)')) 'DeepSeek Harness')
)
$found = $false
foreach ($r in $roots) {
  if (-not $r -or -not (Test-Path $r)) { continue }
  $found = $true
  L ('安装目录：' + $r)
  $exe = Join-Path $r 'DeepSeek Harness.exe'
  if (Test-Path $exe) { L ('客户端版本：' + (Get-Item $exe).VersionInfo.FileVersion) }
  $pj = Join-Path $r 'resources\app\package.json'
  if (-not (Test-Path $pj)) { $pj = Join-Path $r 'resources\app.asar' }
  if (Test-Path $pj) { L ('app 资源：' + $pj) }
}
if (-not $found) { L '（没找到常见安装目录）' }
L ''

L '--- 进程 ---'
Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.ProcessName -like '*DeepSeek*' } | ForEach-Object {
  L ('  ' + $_.ProcessName + ' pid=' + $_.Id)
}
L ''

L '--- profiles ---'
$profilesRoot = Join-Path $env:USERPROFILE '.dsh\profiles'
if (Test-Path $profilesRoot) {
  Get-ChildItem $profilesRoot -Directory | ForEach-Object {
    L ('profile：' + $_.Name)
    $pj = Join-Path $_.FullName 'package.json'
    if (Test-Path $pj) {
      try {
        $pkg = [System.IO.File]::ReadAllText($pj) | ConvertFrom-Json
        $deps = @()
        if ($pkg.dependencies) { $deps = $pkg.dependencies.PSObject.Properties.Name }
        L ('  dependencies：' + (($deps -join ', ') -replace '^$', '（空）'))
        $bundles = @()
        if ($pkg.dsh -and $pkg.dsh.profile -and $pkg.dsh.profile.bundles) { $bundles = @($pkg.dsh.profile.bundles) }
        L ('  bundles：' + (($bundles -join ', ') -replace '^$', '（空）'))
      } catch { L '  package.json 解析失败：' + $_.Exception.Message }
      L ('  package.json 路径：' + $pj)
    } else { L '  （没有 package.json）' }
    $nm = Join-Path $_.FullName 'node_modules'
    if (Test-Path $nm) {
      Get-ChildItem $nm -Force -ErrorAction SilentlyContinue | Where-Object { $_.Name -like 'dsh-*' } | ForEach-Object {
        $lt = ''
        try { if ($_.LinkType) { $lt = ' [' + $_.LinkType + ' → ' + $_.Target + ']' } } catch {}
        L ('  node_modules\' + $_.Name + $lt)
      }
    }
  }
} else { L '（没有 profiles 目录）' }
L ''

L '--- dsh 配置与模板 ---'
foreach ($p in @('.dsh\config.json', '.dsh\startup.json', '.dsh\dsh-startup.json')) {
  $f = Join-Path $env:USERPROFILE $p
  if (Test-Path $f) {
    L ('存在：' + $f)
    try { L ('  内容：' + ((Get-Content $f -Raw -Encoding UTF8) -replace '\s+', ' ').Substring(0, [Math]::Min(600, ((Get-Content $f -Raw -Encoding UTF8) -replace '\s+', ' ').Length))) } catch {}
  }
}
$tplRoot = Join-Path $env:USERPROFILE '.dsh\startup-templates'
if (Test-Path $tplRoot) {
  L ('用户模板目录：' + $tplRoot)
  Get-ChildItem $tplRoot -Directory -ErrorAction SilentlyContinue | ForEach-Object { L ('  ' + $_.Name) }
}
L ''

L '--- 安装包残留（临时目录里的 dsh-boot-suite-*.zip 解压目录） ---'
Get-ChildItem $env:TEMP -Directory -ErrorAction SilentlyContinue | Where-Object { $_.Name -like '*dsh-boot-suite*' } | Select-Object -First 10 | ForEach-Object { L ('  ' + $_.FullName) }
L ''

$lines | Out-File -FilePath $out -Encoding UTF8
Write-Host ''
Write-Host ('诊断报告已生成：' + $out) -ForegroundColor Green
Write-Host '把这个文件发给作者即可。'
