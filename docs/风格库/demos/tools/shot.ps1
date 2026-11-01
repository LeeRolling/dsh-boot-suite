# shot.ps1 — 用 headless Chrome 给某个风格包在多个时间点截图
# 例： .\tools\shot.ps1 -pack k22-origami -ts "0,0.6,1.2,1.8,2.4,2.95" -cols 3 -w 640 -out k22
param(
  [Parameter(Mandatory = $true)][string]$pack,
  [string]$ts = "0,0.6,1.2,1.8,2.4,2.95",
  [int]$cols = 3,
  [int]$w = 640,
  [string]$out = "shot",
  [int]$winW = 1920,
  [int]$winH = 1080
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
if (-not (Test-Path $chrome)) { $chrome = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" }

$probe = Join-Path $PSScriptRoot "_probe.html"
if (-not (Test-Path $probe)) { throw "_probe.html 不存在，先跑 node tools/probe.mjs" }

$uri = ([System.Uri]$probe).AbsoluteUri
$url = "$uri`?p=$pack&ts=$ts&cols=$cols&w=$w"

$shots = Join-Path $PSScriptRoot "_shots"
New-Item -ItemType Directory -Force -Path $shots | Out-Null
$png = Join-Path $shots "$out.png"
if (Test-Path $png) { Remove-Item $png -Force }

$prevEap = $ErrorActionPreference
$ErrorActionPreference = "SilentlyContinue"
$null = & $chrome --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 `
  --window-size="$winW,$winH" --virtual-time-budget=5000 `
  --screenshot="$png" $url 2>&1
$ErrorActionPreference = $prevEap

if (Test-Path $png) { "OK  $png  $((Get-Item $png).Length) bytes" } else { "FAIL $out" }
