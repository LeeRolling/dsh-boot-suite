#Requires -Version 5.1
<#
  dsh-boot-suite 自动更新执行器
  由插件在用户确认重启后启动；本脚本在 DSH 退出后安装新版本并重新打开。
  参数：-Zip 新版压缩包 -Version 版本号 -Exe DSH 可执行文件 -Config 配置文件路径
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
  Write-Host $line
  try { Add-Content -Path $log -Value $line -Encoding UTF8 } catch {}
}
$work = Join-Path $env:USERPROFILE ('.dsh\boot-suite-updates\' + $Version)
try {
  Log ('准备更新到 v' + $Version)
  Log '2 秒后自动关闭 DeepSeek Harness…'
  Start-Sleep -Seconds 2
  Get-Process -Name 'DeepSeek Harness' -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 2
  $pkg = Join-Path $work 'pkg'
  if (Test-Path $pkg) { Remove-Item $pkg -Recurse -Force -ErrorAction SilentlyContinue }
  New-Item -ItemType Directory -Force -Path $pkg | Out-Null
  Log '解压新版本…'
  Expand-Archive -Path $Zip -DestinationPath $pkg -Force
  Log '备份配置…'
  $bk = Join-Path $work 'backup'
  New-Item -ItemType Directory -Force -Path $bk | Out-Null
  if (Test-Path $Config) { Copy-Item $Config (Join-Path $bk 'dsh-startup.json') -Force }
  Log '运行安装器（可能需要几十秒）…'
  $installer = Join-Path $pkg 'tools\install.ps1'
  if (-not (Test-Path $installer)) { throw '安装包里没有 tools/install.ps1' }
  $p = Start-Process -FilePath 'powershell.exe' -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File', $installer) -Wait -PassThru -NoNewWindow
  if ($p.ExitCode -ne 0) { throw ('安装器退出码 ' + $p.ExitCode) }
  Log '安装完成，正在重新打开 DSH…'
  if (Test-Path $Exe) { Start-Process -FilePath $Exe } else { Log '找不到 DSH 可执行文件，请手动打开客户端' }
  Log '更新成功。'
  exit 0
} catch {
  Log ('更新失败：' + $_.Exception.Message)
  Log '正在恢复配置备份…'
  try {
    $bk = Join-Path $work 'backup'
    if (Test-Path (Join-Path $bk 'dsh-startup.json')) { Copy-Item (Join-Path $bk 'dsh-startup.json') $Config -Force }
  } catch {}
  Log '配置已恢复（旧版插件应仍可用），正在重新打开 DSH…'
  if (Test-Path $Exe) { Start-Process -FilePath $Exe }
  Log '请把桌面上的「更新日志」文件发给作者。'
  exit 1
}
