@echo off
REM LapCam Client - Windows Build Script

echo ========================================
echo  LapCam Client - Windows Build Script
echo ========================================
echo.

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python is not installed or not in PATH
    echo Please install Python 3.10+ from https://www.python.org/downloads/
    pause
    exit /b 1
)

echo [1/4] Creating virtual environment...
python -m venv venv
if errorlevel 1 (
    echo [ERROR] Failed to create virtual environment
    pause
    exit /b 1
)

echo [2/4] Activating virtual environment...
call venv\Scripts\activate.bat

echo [3/4] Installing dependencies...
pip install --upgrade pip
pip install -r requirements-windows.txt
if errorlevel 1 (
    echo [ERROR] Failed to install dependencies
    pause
    exit /b 1
)

echo [4/4] Building executable with PyInstaller...
pyinstaller --clean lapcam-client.spec
if errorlevel 1 (
    echo [ERROR] Build failed
    pause
    exit /b 1
)

echo.
echo ========================================
echo  Build Complete!
echo ========================================
echo.
echo Executable location: dist\LapCamClient\LapCamClient.exe
echo.
echo To run:
echo   1. Copy config.aws.yaml to the same folder as LapCamClient.exe
echo   2. Run: LapCamClient.exe --config config.aws.yaml
echo.
pause
