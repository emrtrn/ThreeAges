param(
  [switch]$Lan,
  [switch]$NoDebug,
  [switch]$Preview,
  [switch]$Editor,
  [ValidateSet("browser", "editor", "preview")]
  [string]$Mode = "browser"
)

$ErrorActionPreference = "Stop"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$Port = 5173
$HostArg = if ($Lan) { "0.0.0.0" } else { "127.0.0.1" }
$UrlHost = "127.0.0.1"

if ($Lan) {
  $Address = Get-NetIPAddress -AddressFamily IPv4 |
    Where-Object {
      $_.IPAddress -notlike "127.*" -and
      $_.IPAddress -notlike "169.254.*" -and
      $_.PrefixOrigin -ne "WellKnown"
    } |
    Select-Object -First 1 -ExpandProperty IPAddress
  if ($Address) {
    $UrlHost = $Address
  }
}

if ($Editor) {
  $Mode = "editor"
}
if ($Preview) {
  $Mode = "preview"
}

$Path = switch ($Mode) {
  "editor" {
    if ($NoDebug) { "/?editor" } else { "/?editor&debug" }
  }
  "preview" {
    if ($NoDebug) { "/" } else { "/?debug" }
  }
  default {
    "/"
  }
}
$Url = "http://${UrlHost}:${Port}${Path}"

function Test-PreviewReady {
  param([string]$TargetUrl)

  try {
    $Response = Invoke-WebRequest -Uri $TargetUrl -UseBasicParsing -TimeoutSec 1
    return $Response.StatusCode -eq 200
  } catch {
    return $false
  }
}

if (-not (Test-PreviewReady -TargetUrl $Url)) {
  $LogDir = Join-Path $Root ".dev-server"
  New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
  $OutLog = Join-Path $LogDir "dev-server.out.log"
  $ErrLog = Join-Path $LogDir "dev-server.err.log"
  $ScriptName = if ($Mode -eq "preview") {
    if ($Lan) { "dev:lan" } else { "dev:local" }
  } else {
    if ($Lan) { "editor:lan" } else { "editor" }
  }

  Start-Process `
    -FilePath "npm.cmd" `
    -ArgumentList @("run", $ScriptName) `
    -WorkingDirectory $Root `
    -WindowStyle Hidden `
    -RedirectStandardOutput $OutLog `
    -RedirectStandardError $ErrLog | Out-Null

  $Ready = $false
  for ($Attempt = 0; $Attempt -lt 40; $Attempt += 1) {
    Start-Sleep -Milliseconds 250
    if (Test-PreviewReady -TargetUrl $Url) {
      $Ready = $true
      break
    }
  }

  if (-not $Ready) {
    Write-Host "Dev server could not start on ${HostArg}:${Port}."
    Write-Host "Logs:"
    Write-Host "  $OutLog"
    Write-Host "  $ErrLog"
    exit 1
  }
}

Start-Process $Url
Write-Host "Opened $Url"
Write-Host "Game URL: http://127.0.0.1:${Port}/"
Write-Host "Editor URL while Vite is running: http://127.0.0.1:${Port}/?editor&debug"
Write-Host "Use 'Dev Server: LAN Phone Test' for phone testing on the same Wi-Fi."
