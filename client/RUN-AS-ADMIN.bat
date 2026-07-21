@echo off
REM LapCam - One-Click Setup (Runs as Administrator)
REM Double-click this file to start installation

echo Starting LapCam setup...
echo.

powershell -Command "Start-Process powershell -ArgumentList '-ExecutionPolicy Bypass -File \"%~dp0setup-and-install.ps1\"' -Verb RunAs"

echo.
echo If a blue window appeared, click 'Yes' to continue.
echo If nothing happened, please run PowerShell as Administrator manually.
echo.
pause
