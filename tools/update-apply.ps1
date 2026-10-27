#Requires -Version 5.1
<#
  dsh-boot-suite 自动更新执行器（手动关闭 DSH 版）
  v2.13.2 起：先校验 zip 完整性 -> 解压到临时目录 -> 校验版本/必需文件 -> 才替换旧目录。
  任何一步失败都会恢复旧版本目录和配置，并在桌面（或版本目录）留一份「更新日志」。
#>
param(
  [Parameter(Mandatory=$true)][string]$Zip,
  [Parameter(Mandatory=$true)][string]$Version,
  [Parameter(Mandatory=$true)][string]$Exe,
  [Parameter(Mandatory=$true)][string]$Config
)
$ErrorActionPreference = 'Continue'
$work = Join-Path $env:USERPROFILE ('.dsh\boot-suite-updates\' + $Version)
if (-not (Test-Path $work)) { New-Item -ItemType Directory -Force -Path $work | Out-Null }
$desktop = [Environment]::GetFolderPath('Desktop')
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$logName = 'dsh-boot-suite 更新日志 ' + $stamp + '.txt'
$log = Join-Path $desktop $logName
$fallbackLog = Join-Path $work $logName
$pkg = Join-Path $work 'pkg'
$pkgNew = Join-Path $work 'pkg.new'
$pkgOld = Join-Path $work 'pkg.old'
$hadOld = $false

function Log($m) {
  $line = (Get-Date -Format 'HH:mm:ss') + '  ' + $m
  Write-Host $line -ForegroundColor Cyan
  foreach ($target in @($log, $fallbackLog)) {
    try { Add-Content -Path $target -Value $line -Encoding UTF8; break } catch {}
  }
}

function Fail($m) { throw $m }

function Test-UpdateZip($path, $expectVersion) {
  if (-not (Test-Path $path)) { Fail ('安装包不存在：' + $path) }
  $fi = Get-Item $path
  Log ('安装包：' + $path)
  Log ('大小：' + $fi.Length + ' 字节')
  try { Log ('SHA256：' + (Get-FileHash -Path $path -Algorithm SHA256).Hash) } catch { Log 'SHA256：计算失败（继续）' }
  try {
    Add-Type -AssemblyName System.IO.Compression.FileSystem -ErrorAction Stop
    $z = [System.IO.Compression.ZipFile]::OpenRead($path)
    try { $names = @($z.Entries | ForEach-Object { $_.FullName.Replace('\', '/') }) } finally { $z.Dispose() }
  } catch {
    Fail ('安装包不是完整的 zip（可能下载中断或被截断）：' + $_.Exception.Message)
  }
  if ($names.Count -lt 50) { Fail ('安装包内容异常（只有 ' + $names.Count + ' 个文件）') }
  foreach ($need in @('package.json', 'tools/install.ps1', 'lib/index.js', 'lib/splash.js', 'lib/client.js')) {
    if (-not ($names -contains $need)) { Fail ('安装包缺少必需文件：' + $need) }
  }
  Log ('zip 校验通过：' + $names.Count + ' 个文件')
}

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
  if ($still) { Fail '等待 15 分钟仍未检测到 DSH 退出，已取消本次更新' }

  Log '已检测到 DSH 退出，开始校验安装包…'
  Test-UpdateZip $Zip $Version

  Log '备份配置…'
  $bk = Join-Path $work 'backup'
  New-Item -ItemType Directory -Force -Path $bk | Out-Null
  if (Test-Path $Config) { Copy-Item $Config (Join-Path $bk 'dsh-startup.json') -Force }

  Log '解压新版本到临时目录…'
  if (Test-Path $pkgNew) { Remove-Item $pkgNew -Recurse -Force -ErrorAction SilentlyContinue }
  New-Item -ItemType Directory -Force -Path $pkgNew | Out-Null
  try {
    Expand-Archive -Path $Zip -DestinationPath $pkgNew -Force -ErrorAction Stop
  } catch {
    Fail ('解压失败（安装包可能损坏）：' + $_.Exception.Message)
  }

  $pkgJson = Join-Path $pkgNew 'package.json'
  if (-not (Test-Path $pkgJson)) { Fail '解压后没有 package.json' }
  $bytes = [System.IO.File]::ReadAllBytes($pkgJson)
  if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
    [System.IO.File]::WriteAllBytes($pkgJson, $bytes[3..($bytes.Length - 1)])
    Log '已移除 package.json 的 BOM'
  }
  try {
    $obj = [System.IO.File]::ReadAllText($pkgJson, [System.Text.Encoding]::UTF8) | ConvertFrom-Json
  } catch {
    Fail ('包内 package.json 不是合法 JSON：' + $_.Exception.Message)
  }
  if ([string]$obj.version -ne $Version) { Fail ('版本不匹配：包内为 ' + $obj.version + '，期望 ' + $Version) }
  Log ('临时目录校验通过：v' + $obj.version)

  $hadOld = Test-Path $pkg
  if (Test-Path $pkgOld) { Remove-Item $pkgOld -Recurse -Force -ErrorAction SilentlyContinue }
  if ($hadOld) {
    Log '备份旧版本目录…'
    Move-Item $pkg $pkgOld -Force
  }
  try {
    Move-Item $pkgNew $pkg -Force
  } catch {
    if ($hadOld -and (Test-Path $pkgOld)) { Move-Item $pkgOld $pkg -Force }
    Fail ('替换目录失败：' + $_.Exception.Message)
  }
  Log '新版本目录已就位（旧目录已备份，安装成功后清理）'

  Log '运行安装器（可能需要几十秒）…'
  $installer = Join-Path $pkg 'tools\install.ps1'
  if (-not (Test-Path $installer)) { Fail '安装包里没有 tools/install.ps1' }
  $proc = Start-Process -FilePath 'powershell.exe' -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File', $installer) -Wait -PassThru -NoNewWindow
  if ($proc.ExitCode -ne 0) { Fail ('安装器退出码 ' + $proc.ExitCode) }

  Log '安装完成，清理旧版本目录…'
  if (Test-Path $pkgOld) { Remove-Item $pkgOld -Recurse -Force -ErrorAction SilentlyContinue }
  Log '回滚按钮已就绪：桌面上「紧急回滚-V<旧版本>」可在新版打不开时用；更新成功后旧按钮已被安装器自动清理。'

  Log '正在重新打开 DSH…'
  if (Test-Path $Exe) { Start-Process -FilePath $Exe } else { Log '找不到 DSH 可执行文件，请手动打开客户端' }
  Log '更新成功。本窗口 10 秒后自动关闭。'
  Start-Sleep -Seconds 10
  exit 0
} catch {
  Log ('更新失败：' + $_.Exception.Message)

  try {
    if ($hadOld -and (Test-Path $pkgOld)) {
      if (Test-Path $pkg) { Remove-Item $pkg -Recurse -Force -ErrorAction SilentlyContinue }
      Move-Item $pkgOld $pkg -Force
      Log '已恢复旧版本目录。'
    }
  } catch { Log ('恢复旧版本目录失败：' + $_.Exception.Message) }

  try {
    $bk = Join-Path $work 'backup'
    if (Test-Path (Join-Path $bk 'dsh-startup.json')) { Copy-Item (Join-Path $bk 'dsh-startup.json') $Config -Force }
    Log '配置已恢复。'
  } catch {}

  Log '旧版插件应仍可用，正在重新打开 DSH…'
  if (Test-Path $Exe) { Start-Process -FilePath $Exe }
  Log ('请把「更新日志」文件发给作者：' + $log)
  Start-Sleep -Seconds 30
  exit 1
}
