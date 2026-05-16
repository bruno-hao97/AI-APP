# Them Node portable vao PATH cho session hien tai
$NodeHome = Join-Path (Split-Path $PSScriptRoot -Parent) ".tools\node"
if (-not (Test-Path "$NodeHome\node.exe")) {
  Write-Error "Chua co Node. Chay: .\scripts\setup-node.ps1"
}
$env:PATH = "$NodeHome;$env:PATH"
Write-Host "Node $(node -v) | npm $(npm -v)"
