param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Args)
$NodeHome = Join-Path (Split-Path $PSScriptRoot -Parent) ".tools\node"
$npm = Join-Path $NodeHome "npm.cmd"
if (-not (Test-Path $npm)) {
  Write-Error "Chua co npm. Chay truoc: .\scripts\setup-node.ps1"
}
& $npm @Args
