@echo off
if "%~1"=="" (
  set PORT=3000
) else (
  set PORT=%~1
)
start "next-dev" /min cmd.exe /k ""%~dp0start-dev-server.cmd" %PORT%"
