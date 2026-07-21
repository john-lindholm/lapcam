# LapCam Client - Complete One-Click Setup and Installation
# Run this ONCE as Administrator - it does everything!

Write-Host "========================================" -ForegroundColor Cyan
Write-Host " LapCam - Complete Setup & Installation" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if running as administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] `
    [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole( `
    [Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "[ERROR] Please run as Administrator!" -ForegroundColor Red
    Write-Host "Right-click this script → 'Run as Administrator'" -ForegroundColor Yellow
    Write-Host ""
    pause
    exit 1
}

$installDir = "C:\LapCam"
$taskName = "LapCam Client"
$scriptDir = Split-Path $MyInvocation.MyCommand.Path

Write-Host "[Step 1/6] Checking Python installation..." -ForegroundColor Yellow
try {
    $pythonVersion = python --version 2>&1
    Write-Host "[OK] Python found: $pythonVersion" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Python not found!" -ForegroundColor Red
    Write-Host "Please install Python 3.10+ from https://www.python.org/downloads/" -ForegroundColor Yellow
    Write-Host "☑ Check 'Add Python to PATH' during installation" -ForegroundColor Yellow
    Write-Host ""
    pause
    exit 1
}

Write-Host ""
Write-Host "[Step 2/6] Building executable..." -ForegroundColor Yellow
Write-Host "(This takes 5-10 minutes, please wait...)" -ForegroundColor Gray
Write-Host ""

Set-Location $scriptDir

# Check if venv exists, create if not
if (Test-Path "venv\Scripts\Activate.ps1") {
    Write-Host "[INFO] Virtual environment found, skipping creation" -ForegroundColor Gray
} else {
    Write-Host "[INFO] Creating virtual environment..." -ForegroundColor Gray
    python -m venv venv
}

# Activate venv
.\venv\Scripts\Activate.ps1

# Install dependencies
Write-Host "[INFO] Installing dependencies..." -ForegroundColor Gray
pip install --upgrade pip --quiet
pip install -r requirements-windows.txt --quiet

# Build executable
Write-Host "[INFO] Building LapCamClient.exe..." -ForegroundColor Gray
pyinstaller --clean lapcam-client.spec --noconfirm

if ($LASTEXITCODE -eq 0) {
    Write-Host "[OK] Build successful!" -ForegroundColor Green
} else {
    Write-Host "[ERROR] Build failed!" -ForegroundColor Red
    Write-Host "Check the error messages above" -ForegroundColor Yellow
    Write-Host ""
    pause
    exit 1
}

Write-Host ""
Write-Host "[Step 3/6] Creating installation folder..." -ForegroundColor Yellow

# Create install directory
if (Test-Path $installDir) {
    Write-Host "[INFO] Folder already exists: $installDir" -ForegroundColor Gray
} else {
    New-Item -ItemType Directory -Path $installDir | Out-Null
    Write-Host "[OK] Created: $installDir" -ForegroundColor Green
}

Write-Host ""
Write-Host "[Step 4/6] Copying files..." -ForegroundColor Yellow

# Copy executable
$exeSource = "dist\LapCamClient\LapCamClient.exe"
$exeDest = "$installDir\LapCamClient.exe"

if (Test-Path $exeSource) {
    Copy-Item $exeSource $exeDest -Force
    Write-Host "[OK] Copied: LapCamClient.exe" -ForegroundColor Green
} else {
    Write-Host "[ERROR] Executable not found: $exeSource" -ForegroundColor Red
    Write-Host ""
    pause
    exit 1
}

# Copy config file
$configSource = "config.aws.yaml"
$configDest = "$installDir\config.aws.yaml"

if (Test-Path $configSource) {
    Copy-Item $configSource $configDest -Force
    Write-Host "[OK] Copied: config.aws.yaml" -ForegroundColor Green
} else {
    Write-Host "[WARN] Config file not found, you'll need to create it manually" -ForegroundColor Yellow
}

# Copy helper scripts
Copy-Item "disable-sleep-windows.bat" "$installDir\" -Force -ErrorAction SilentlyContinue
Copy-Item "install-windows-service.ps1" "$installDir\" -Force -ErrorAction SilentlyContinue

Write-Host "[OK] Helper scripts copied" -ForegroundColor Green

Write-Host ""
Write-Host "[Step 5/6] Installing Windows service..." -ForegroundColor Yellow
Write-Host ""

# Change to install directory and run installer
Set-Location $installDir
& .\install-windows-service.ps1

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "[ERROR] Service installation failed!" -ForegroundColor Red
    Write-Host ""
    pause
    exit 1
}

Write-Host ""
Write-Host "[Step 6/6] Disabling sleep mode..." -ForegroundColor Yellow
Write-Host ""

# Disable sleep mode
powercfg -setactive SCHEME_MIN
powercfg -change -monitor-timeout-ac 0
powercfg -change -monitor-timeout-dc 0
powercfg -change -disk-timeout-ac 0
powercfg -change -disk-timeout-dc 0
powercfg -change -standby-timeout-ac 0
powercfg -change -standby-timeout-dc 0

Write-Host "[OK] Sleep mode disabled" -ForegroundColor Green

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host " 🎉 Installation Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Installation location: $installDir" -ForegroundColor Cyan
Write-Host ""
Write-Host "What's installed:" -ForegroundColor Cyan
Write-Host "  ✓ LapCamClient.exe (camera monitoring)" -ForegroundColor White
Write-Host "  ✓ config.aws.yaml (your configuration)" -ForegroundColor White
Write-Host "  ✓ Windows service (auto-starts on boot)" -ForegroundColor White
Write-Host "  ✓ Sleep prevention (PC stays awake 24/7)" -ForegroundColor White
Write-Host ""
Write-Host "Management Commands:" -ForegroundColor Cyan
Write-Host "  Status:    schtasks /Query /TN `"$taskName`"" -ForegroundColor White
Write-Host "  Stop:      schtasks /End /TN `"$taskName`"" -ForegroundColor White
Write-Host "  Start:     schtasks /Run /TN `"$taskName`"" -ForegroundColor White
Write-Host "  Uninstall: C:\LapCam\install-windows-service.ps1 -Uninstall" -ForegroundColor White
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Cyan
Write-Host "  1. Verify camera shows 🟢 Live in web UI" -ForegroundColor White
Write-Host "  2. Test motion detection (wave hand in front)" -ForegroundColor White
Write-Host "  3. Check screenshot appears in UI" -ForegroundColor White
Write-Host "  4. Restart computer to verify auto-start works" -ForegroundColor White
Write-Host ""
Write-Host "Your camera will now monitor 24/7!" -ForegroundColor Green
Write-Host ""

pause
