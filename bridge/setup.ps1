param([string]$RtspUrl)
$ErrorActionPreference = 'Stop'
$bridgeDirectory = $PSScriptRoot
$runtimeDirectory = Join-Path $bridgeDirectory 'runtime'
New-Item -ItemType Directory -Force -Path $runtimeDirectory | Out-Null
$releaseVersion = 'v1.9.15'
$release = Invoke-RestMethod -Uri "https://api.github.com/repos/AlexxIT/go2rtc/releases/tags/$releaseVersion" -TimeoutSec 30
$asset = $release.assets | Where-Object { $_.name -eq 'go2rtc_win64.zip' }
if (-not $asset -or -not $asset.digest.StartsWith('sha256:')) { throw 'No se encontró el paquete oficial con su huella SHA-256.' }
$archivePath = Join-Path $runtimeDirectory 'go2rtc_win64.zip'
Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $archivePath -TimeoutSec 90
$actualHash = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash.ToLowerInvariant()
if ($actualHash -ne $asset.digest.Substring(7)) { throw 'La huella del ejecutable no coincide con la publicación oficial.' }
Expand-Archive -LiteralPath $archivePath -DestinationPath $runtimeDirectory -Force
$configPath = Join-Path $bridgeDirectory 'bridge.local.json'
if (-not (Test-Path -LiteralPath $configPath)) {
  if (-not $RtspUrl) {
    $secret = Read-Host 'URL RTSP completa (se guarda solo en esta PC)' -AsSecureString
    $RtspUrl = [System.Net.NetworkCredential]::new('', $secret).Password
  }
  $tokenBytes = New-Object byte[] 24
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($tokenBytes)
  $config = @{ rtspUrl=$RtspUrl; token=[Convert]::ToBase64String($tokenBytes); port=1985; host='0.0.0.0'; allowedOrigins=@('https://camarita-ia.vercel.app','http://localhost:5173','http://127.0.0.1:5173','http://localhost:4173','http://127.0.0.1:4173') }
  $config | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $configPath -Encoding utf8
}
Write-Output 'Puente descargado y verificado. Ejecutá npm run bridge. Las credenciales y el ejecutable están excluidos de Git.'
