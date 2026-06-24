@echo off
cd /d "%~dp0.."
if "%~1"=="" (
  set PORT=3000
) else (
  set PORT=%~1
)
"C:\Program Files\nodejs\node.exe" node_modules\next\dist\bin\next dev --hostname 127.0.0.1 --port %PORT%
