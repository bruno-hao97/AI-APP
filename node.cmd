@echo off
set "NODE_DIR=%~dp0.tools\node"
if not exist "%NODE_DIR%\node.exe" (
  echo [demo-video] Chua co Node trong .tools\node
  echo Chay: powershell -ExecutionPolicy Bypass -File "%~dp0scripts\setup-node.ps1"
  exit /b 1
)
"%NODE_DIR%\node.exe" %*
