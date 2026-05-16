# Cài Node.js portable vào .tools/node (không cần quyền admin)
$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path $PSScriptRoot -Parent
$Tools = Join-Path $ProjectRoot ".tools"
$Zip = Join-Path $Tools "node-v22.14.0-win-x64.zip"
$NodeHome = Join-Path $Tools "node"
$Version = "22.14.0"
$Url = "https://nodejs.org/dist/v$Version/node-v$Version-win-x64.zip"

New-Item -ItemType Directory -Force -Path $Tools | Out-Null

if (-not (Test-Path "$NodeHome\node.exe")) {
  Write-Host "Dang tai Node.js $Version..."
  if (-not (Test-Path $Zip)) {
    curl.exe -L -o $Zip $Url
  }
  if (Test-Path $NodeHome) { Remove-Item $NodeHome -Recurse -Force }
  Expand-Archive -Path $Zip -DestinationPath $Tools -Force
  Rename-Item (Join-Path $Tools "node-v$Version-win-x64") $NodeHome
}

$nodeExe = Join-Path $NodeHome "node.exe"
$npmCmd = Join-Path $NodeHome "npm.cmd"

Write-Host "Node:" (& $nodeExe -v)
Write-Host "npm:" (& $npmCmd -v)

Write-Host "Dang chay npm install..."
Push-Location $ProjectRoot
& $npmCmd install
Pop-Location

Write-Host ""
Write-Host "Xong. Chay frontend:"
Write-Host "  .\scripts\npm.ps1 run dev"
Write-Host "Hoac mo terminal moi sau khi chay:"
Write-Host "  .\scripts\use-node.ps1"
